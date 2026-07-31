using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using TaskReport.API.Services;
using TaskReport.Core.DTOs;
using TaskReport.Core.Entities;
using TaskReport.Core.Repositories;
using TaskReport.Core.UnitOfWorks;
using TaskReport.Data;
using Microsoft.AspNetCore.SignalR;
using TaskReport.API.Hubs;
using ClosedXML.Excel;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace TaskReport.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class TaskController : ControllerBase
    {
        private readonly ITaskRepository _taskRepository;
        private readonly IUnitOfWork _unitOfWork;
        private readonly AppDbContext _context;
        private readonly IDistributedCache _cache;
        private readonly RabbitMQPublisher _rabbitMQPublisher;
        private readonly IHubContext<NotificationHub> _hubContext;

        public TaskController(
            ITaskRepository taskRepository,
            IUnitOfWork unitOfWork,
            AppDbContext context,
            IDistributedCache cache,
            RabbitMQPublisher rabbitMQPublisher,
            IHubContext<NotificationHub> hubContext)
        {
            _taskRepository = taskRepository;
            _unitOfWork = unitOfWork;
            _context = context;
            _cache = cache;
            _hubContext = hubContext;
            _rabbitMQPublisher = rabbitMQPublisher;
        }

        [HttpGet]
        public async Task<IActionResult> GetMyTasks()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue("sub");
            if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

            int userId = int.Parse(userIdStr);

            // 1. Kullanıcının üye olduğu tüm takımların ID'lerini çekiyoruz
            var userTeamIds = await _context.TeamMembers
                .Where(tm => tm.UserId == userId)
                .Select(tm => tm.TeamId)
                .ToListAsync();

            // 2. Takımlara ait TÜM görevleri çekiyoruz
            var tasks = await _context.TaskItems
                .Where(t => userTeamIds.Contains(t.TeamId)
                            || t.UserId == userId
                            || t.AssigneeId == userId)
                .Select(t => new
                {
                    t.Id,
                    t.Title,
                    t.Description,
                    t.Status,
                    t.Priority,
                    t.Type,
                    t.TeamId,
                    t.StartDate,
                    t.EndDate,
                    t.EpicId,
                    t.AssigneeId,
                    t.EstimatedHours,
                    t.LoggedHours,
                    Tags = t.Tags ?? "[]"
                })
                .ToListAsync();

            return Ok(tasks);
        }


        [HttpPost]
        [AllowAnonymous]
        public async Task<IActionResult> CreateTask([FromBody] TaskCreateDto request)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue("UserId") ?? User.FindFirstValue("sub");
            if (string.IsNullOrEmpty(userIdStr)) return Unauthorized("Giriş yapmanız gerekiyor.");
            int userId = int.Parse(userIdStr);

            if (request.TeamId <= 0) return BadRequest("Görev oluşturmak için geçerli bir takım seçmelisiniz.");

            var newTask = new TaskItem
            {
                Title = request.Title,
                Description = request.Description,
                TeamId = request.TeamId,
                UserId = userId,
                CreatedAt = DateTime.Now,
                IsCompleted = request.Status == ProjectStatus.Done,
                StartDate = request.StartDate ?? DateTime.MinValue,
                EndDate = request.EndDate ?? DateTime.MinValue,
                Priority = request.Priority,
                Type = request.Type,
                Status = request.Status,
                EpicId = request.EpicId,
                AssigneeId = request.AssigneeId,
                EstimatedHours = request.EstimatedHours,
                Tags = string.IsNullOrEmpty(request.Tags) ? "[]" : request.Tags // 🚨 YENİ EKLENDİ
            };

            _context.TaskItems.Add(newTask);
            await _context.SaveChangesAsync();

            var userName = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("name") ?? User.FindFirstValue("FullName") ?? "Bir Üye";
            await LogActivityAsync(newTask.Id, userId, userName, "görevi oluşturdu.");

            // 🚨 İŞTE EKSİK OLAN KISIM: VERİTABANINA KALICI BİLDİRİM YAZIYORUZ
            if (newTask.AssigneeId.HasValue && newTask.AssigneeId.Value != userId)
            {
                await SaveNotificationAsync(newTask.AssigneeId.Value, "🎯 Yeni Görev Ataması", $"Sana yeni bir görev atandı: '{newTask.Title}'");
            }

            var teamUserIds = await _context.TeamMembers.Where(tm => tm.TeamId == request.TeamId).Select(tm => tm.UserId).ToListAsync();
            foreach (var memberId in teamUserIds) { await _cache.RemoveAsync($"tasks_user_{memberId}"); }

            await _rabbitMQPublisher.PublishTaskCreatedMessageAsync(new { Event = "TaskCreated", TaskId = newTask.Id, Title = newTask.Title, CreatedByUserId = userId, CreatedAt = DateTime.Now });
            await _hubContext.Clients.All.SendAsync("ReceiveNotification", "CREATED", userId, newTask.AssigneeId, newTask.Title, $"'{newTask.Title}' adında yeni bir görev oluşturuldu.");

            return Ok(new { Message = "Görev başarıyla eklendi!", Task = newTask });
        }
        [HttpPut("{id}/complete")]
        public async Task<IActionResult> MarkAsCompleted(int id)
        {
            var task = await _taskRepository.GetByIdAsync(id);
            if (task == null) return NotFound("Görev bulunamadı.");

            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                         ?? User.FindFirstValue("id")
                         ?? User.FindFirstValue("UserId")
                         ?? User.FindFirstValue("sub");

            if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

            if (task.UserId.ToString() != userIdStr) return Forbid();

            task.IsCompleted = true;
            task.Status = ProjectStatus.Done;
            _taskRepository.Update(task);
            await _unitOfWork.CommitAsync();

            // 🕒 AKTİVİTE LOGU: GÖREV TAMAMLANDI OLARAK İŞARETLENDİ
            var userName = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("name") ?? User.FindFirstValue("FullName") ?? "Bir Üye";
            await LogActivityAsync(task.Id, int.Parse(userIdStr), userName, "görevi tamamlandı olarak işaretledi.");

            await _cache.RemoveAsync($"tasks_user_{userIdStr}");

            return Ok(new { Message = "Görev tamamlandı olarak işaretlendi!" });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTask(int id)
        {
            var task = await _taskRepository.GetByIdAsync(id);
            if (task == null) return NotFound("Görev bulunamadı.");

            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                         ?? User.FindFirstValue("id")
                         ?? User.FindFirstValue("UserId")
                         ?? User.FindFirstValue("sub");

            if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

            int userId = int.Parse(userIdStr);

            var teamMember = await _context.TeamMembers
                .FirstOrDefaultAsync(tm => tm.TeamId == task.TeamId && tm.UserId == userId);

            if (teamMember == null) return Forbid();

            string role = teamMember.Role;

            bool isFounderOrAdmin = role == "Founder" || role == "Admin";
            bool isCreator = task.UserId == userId;

            if (!isFounderOrAdmin && !isCreator)
            {
                return Forbid();
            }

            int teamId = task.TeamId;

            _taskRepository.Remove(task);
            await _unitOfWork.CommitAsync();

            var teamUserIds = await _context.TeamMembers
                .Where(tm => tm.TeamId == teamId)
                .Select(tm => tm.UserId)
                .ToListAsync();

            foreach (var memberId in teamUserIds)
            {
                await _cache.RemoveAsync($"tasks_user_{memberId}");
            }

            return Ok(new { Message = "Görev başarıyla silindi." });
        }

        [HttpGet("{taskId}/activities")]
        public async Task<IActionResult> GetTaskActivities(int taskId)
        {
            var activities = await _context.TaskActivities
                .Where(a => a.TaskId == taskId)
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();
            return Ok(activities);
        }

        private async Task LogActivityAsync(int taskId, int userId, string userName, string action)
        {
            // 🕵️ Token'la uğraşmak yerine doğrudan veritabanındaki FullName sütununu okuyoruz
            var user = await _context.Users.FindAsync(userId);

            string displayName = (user != null && !string.IsNullOrWhiteSpace(user.FullName))
                ? user.FullName
                : (user?.Username ?? userName);

            var activity = new TaskActivity
            {
                TaskId = taskId,
                UserId = userId,
                UserName = displayName, // 👈 Artık DB'den doğrudan "Yiğit Doğan" çekilip yazılacak
                Action = action,
                CreatedAt = DateTime.Now
            };

            _context.TaskActivities.Add(activity);
            await _context.SaveChangesAsync();
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTask(int id, TaskCreateDto request)
        {
            var task = await _taskRepository.GetByIdAsync(id);
            if (task == null) return NotFound("Görev bulunamadı.");

            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                         ?? User.FindFirstValue("id")
                         ?? User.FindFirstValue("UserId")
                         ?? User.FindFirstValue("sub");

            if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

            int userId = int.Parse(userIdStr);

            bool isTeamMember = await _context.TeamMembers
                .AnyAsync(tm => tm.TeamId == task.TeamId && tm.UserId == userId);

            if (!isTeamMember)
            {
                return Forbid();
            }



            // 🕵️ EŞLEŞTİRME İÇİN ESKİ DEĞERLERİ HAFIZAYA ALIYORUZ
            var oldStatus = task.Status;
            var oldDescription = task.Description;
            var oldPriority = task.Priority;
            var oldAssigneeId = task.AssigneeId;
            var oldTitle = task.Title;

            // GÜNCELLEMELERİ UYGULUYORUZ
            task.Title = request.Title;
            task.Description = request.Description;
            task.StartDate = request.StartDate ?? DateTime.MinValue;
            task.EndDate = request.EndDate ?? DateTime.MinValue;
            task.Priority = request.Priority;
            task.TeamId = request.TeamId;
            task.Status = request.Status;
            task.Type = request.Type;
            task.EpicId = request.EpicId;
            task.IsCompleted = request.Status == ProjectStatus.Done; // veya (int)request.Status == 4
            task.EstimatedHours = request.EstimatedHours;
            task.Tags = string.IsNullOrEmpty(request.Tags) ? "[]" : request.Tags; // 🚨 YENİ EKLENDİ
            task.AssigneeId = request.AssigneeId;

            _taskRepository.Update(task);
            await _unitOfWork.CommitAsync();

            // 🚨 İŞTE EKSİK OLAN KISIM: GÖREV BAŞKASINA ATANDIYSA KALICI BİLDİRİM YAZIYORUZ
            if (request.AssigneeId.HasValue && request.AssigneeId != oldAssigneeId && request.AssigneeId.Value != userId)
            {
                await SaveNotificationAsync(request.AssigneeId.Value, "🎯 Yeni Görev Ataması", $"'{task.Title}' adlı göreve atandın.");
            }

            // 🧠 AKILLI LOGLAMA: SADECE DEĞİŞENLERİ TESPİT ET
            var userName = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("name") ?? User.FindFirstValue("FullName") ?? "Bir Üye";
            List<string> changes = new List<string>();

            if (oldStatus != request.Status)
            {
                int statusVal = (int)request.Status;
                string statusName = statusVal switch
                {
                    0 => "Backlog",
                    1 => "Yapılacaklar",
                    2 => "Geliştirmede",
                    3 => "Test Aşamasında",
                    4 => "Tamamlandı",
                    _ => "Bilinmeyen Aşama"
                };
                changes.Add($"görevi '{statusName}' sütununa taşıdı.");
            }

            if (oldDescription != request.Description)
                changes.Add("görevin açıklamasını güncelledi.");

            if (oldPriority != request.Priority)
                changes.Add($"görev önceliğini '{request.Priority}' olarak değiştirdi.");

            if (oldTitle != request.Title)
                changes.Add($"başlığı '{request.Title}' olarak değiştirdi.");

            if (oldAssigneeId != request.AssigneeId)
            {
                if (request.AssigneeId == null)
                    changes.Add("görevin atamasını kaldırdı (Kimse Yok).");
                else
                    changes.Add("görevi yeni bir kişiye atadı.");
            }

            // EĞER GERÇEKTEN BİR ŞEY DEĞİŞTİYSE VERİTABANINA YAZ (Boş 'Kaydet' tıklamalarını yok sayar)
            foreach (var change in changes)
            {
                await LogActivityAsync(task.Id, userId, userName, change);
            }

            // TAKIMDAKİ TÜM ÜYELERİN REDIS ÖNBELLEĞİNİ TEMİZLE
            var teamUserIds = await _context.TeamMembers
                .Where(tm => tm.TeamId == task.TeamId)
                .Select(tm => tm.UserId)
                .ToListAsync();

            foreach (var memberId in teamUserIds)
            {
                await _cache.RemoveAsync($"tasks_user_{memberId}");
            }

            // ⚡ SIGNALR İLE ANGULAR'A CANLI BİLDİRİM FIRLATMA
            string actionType = (oldAssigneeId != request.AssigneeId && request.AssigneeId != null) ? "ASSIGNED" : "UPDATED";

            string customMessage = actionType == "ASSIGNED"
                ? $"Sana yeni bir görev atandı: '{task.Title}'"
                : $"Sana ait '{task.Title}' görevinde durum/içerik güncellemesi yapıldı.";

            await _hubContext.Clients.All.SendAsync("ReceiveNotification",
                actionType,
                userId,
                task.AssigneeId,
                task.Title,
                customMessage
            );

            return Ok(new { Message = "Görev başarıyla güncellendi!" });
        }

        [HttpGet("export/excel/{teamId}")]
        public async Task<IActionResult> ExportToExcel(int teamId)
        {
            var tasks = await _context.TaskItems.Where(t => t.TeamId == teamId).ToListAsync();

            using (var workbook = new XLWorkbook())
            {
                var worksheet = workbook.Worksheets.Add("Görev Raporu");
                var currentRow = 1;

                // Başlıklar
                worksheet.Cell(currentRow, 1).Value = "Görev Başlığı";
                worksheet.Cell(currentRow, 2).Value = "Durum";
                worksheet.Cell(currentRow, 3).Value = "Öncelik";
                worksheet.Cell(currentRow, 4).Value = "Başlangıç";
                worksheet.Cell(currentRow, 5).Value = "Bitiş";

                worksheet.Row(1).Style.Font.Bold = true;
                worksheet.Row(1).Style.Fill.BackgroundColor = XLColor.LightBlue;

                // Veriler
                foreach (var task in tasks)
                {
                    currentRow++;
                    int statusVal = (int)task.Status;
                    string statusName = statusVal switch
                    {
                        0 => "Backlog",
                        1 => "Yapılacaklar",
                        2 => "Geliştirmede",
                        3 => "Test Aşamasında",
                        4 => "Tamamlandı",
                        _ => "Bilinmeyen"
                    };

                    worksheet.Cell(currentRow, 1).Value = task.Title;
                    worksheet.Cell(currentRow, 2).Value = statusName;
                    worksheet.Cell(currentRow, 3).Value = task.Priority;
                    worksheet.Cell(currentRow, 4).Value = task.StartDate.ToString("dd.MM.yyyy");
                    worksheet.Cell(currentRow, 5).Value = task.EndDate.ToString("dd.MM.yyyy");
                }

                worksheet.Columns().AdjustToContents();

                using (var stream = new MemoryStream())
                {
                    workbook.SaveAs(stream);
                    var content = stream.ToArray();
                    return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"Takim_{teamId}_Gorev_Raporu.xlsx");
                }
            }
        }

        [HttpGet("export/pdf/{teamId}")]
        public async Task<IActionResult> ExportToPdf(int teamId)
        {
            var tasks = await _context.TaskItems.Where(t => t.TeamId == teamId).ToListAsync();

            // QuestPDF Lisans Ayarı (Ücretsiz Sürüm İçin Zorunlu)
            QuestPDF.Settings.License = LicenseType.Community;

            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(2, Unit.Centimetre);
                    page.PageColor(Colors.White);
                    page.DefaultTextStyle(x => x.FontSize(11));

                    page.Header().Text($"Takım Görev Raporu (Takım ID: {teamId})").SemiBold().FontSize(20).FontColor(Colors.Blue.Darken2);

                    page.Content().PaddingVertical(1, Unit.Centimetre).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(3); // Başlık (Geniş)
                            columns.RelativeColumn(2); // Durum
                            columns.RelativeColumn(2); // Öncelik
                            columns.RelativeColumn(2); // Bitiş Tarihi
                        });

                        // Tablo Başlıkları
                        table.Header(header =>
                        {
                            header.Cell().BorderBottom(1).Padding(2).Text("Görev Başlığı").SemiBold();
                            header.Cell().BorderBottom(1).Padding(2).Text("Durum").SemiBold();
                            header.Cell().BorderBottom(1).Padding(2).Text("Öncelik").SemiBold();
                            header.Cell().BorderBottom(1).Padding(2).Text("Bitiş Tarihi").SemiBold();
                        });

                        // Veriler
                        foreach (var task in tasks)
                        {
                            int statusVal = (int)task.Status;
                            string statusName = statusVal switch
                            {
                                0 => "Backlog",
                                1 => "Yapılacaklar",
                                2 => "Geliştirmede",
                                3 => "Test Aşamasında",
                                4 => "Tamamlandı",
                                _ => "Bilinmeyen"
                            };

                            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(2).Text(task.Title);
                            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(2).Text(statusName);
                            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(2).Text(task.Priority);
                            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(2).Text(task.EndDate.ToString("dd.MM.yyyy"));
                        }
                    });

                    page.Footer().AlignCenter().Text(x =>
                    {
                        x.Span("Sayfa ");
                        x.CurrentPageNumber();
                        x.Span(" / ");
                        x.TotalPages();
                    });
                });
            });

            byte[] pdfBytes = document.GeneratePdf();
            return File(pdfBytes, "application/pdf", $"Takim_{teamId}_Gorev_Raporu.pdf");
        }

        [HttpGet("{taskId}/comments")]
        public async Task<IActionResult> GetTaskComments(int taskId)
        {
            var comments = await _context.TaskComments
                .Include(c => c.User)
                .Where(c => c.TaskId == taskId)
                .OrderBy(c => c.CreatedAt)
                .Select(c => new {
                    c.Id,
                    c.TaskId,
                    c.UserId,
                    UserName = (c.User != null && !string.IsNullOrWhiteSpace(c.User.FullName)) ? c.User.FullName : (c.User != null ? c.User.Username : "Bilinmeyen"),
                    c.CommentText,
                    c.CreatedAt
                })
                .ToListAsync();

            return Ok(comments);
        }

        [HttpPost("{taskId}/comments")]
        public async Task<IActionResult> AddComment(int taskId, [FromBody] CommentCreateDto request)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue("sub");
            if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

            int userId = int.Parse(userIdStr);

            var comment = new TaskComment
            {
                TaskId = taskId,
                UserId = userId,
                CommentText = request.CommentText,
                CreatedAt = DateTime.Now
            };

            _context.TaskComments.Add(comment);
            await _context.SaveChangesAsync();

            // 🕒 Hareket geçmişine de log yazalım
            var user = await _context.Users.FindAsync(userId);
            string userName = user?.FullName ?? user?.Username ?? "Bir Üye";
            await LogActivityAsync(taskId, userId, userName, "göreve bir yorum yaptı.");

            return Ok(new { Message = "Yorum eklendi!", Comment = comment });
        }

        public class CommentCreateDto { public string CommentText { get; set; } = string.Empty; }

        // 🔔 VERİTABANINA KALICI BİLDİRİM KAYDETME YARDIMCISI
        private async Task SaveNotificationAsync(int targetUserId, string title, string message)
        {
            var notif = new Notification
            {
                UserId = targetUserId,
                Title = title,
                Message = message,
                IsRead = false,
                CreatedAt = DateTime.Now
            };
            _context.Notifications.Add(notif);
            await _context.SaveChangesAsync();
        }

        [HttpGet("my-notifications")]
        public async Task<IActionResult> GetMyNotifications()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue("sub");
            if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

            int userId = int.Parse(userIdStr);

            var list = await _context.Notifications
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.CreatedAt)
                .Take(20)
                .Select(n => new {
                    n.Id,
                    n.Title,
                    n.Message,
                    n.IsRead, // 🚨 EKLENDİ: Artık bildirimin okunup okunmadığını Angular'a gönderiyoruz
                    Time = n.CreatedAt.ToString("dd.MM.yyyy HH:mm")
                })
                .ToListAsync();

            return Ok(list);
        }

        // 🚨 YENİ EKLENEN METOT: Tıklanan bildirimleri veritabanında okundu yapar
        [HttpPut("my-notifications/mark-read")]
        public async Task<IActionResult> MarkNotificationsAsRead()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue("sub");
            if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

            int userId = int.Parse(userIdStr);

            var unreadNotifs = await _context.Notifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .ToListAsync();

            foreach (var notif in unreadNotifs)
            {
                notif.IsRead = true; // Hepsini okundu olarak işaretle
            }

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Bildirimler okundu olarak işaretlendi." });
        }


        [HttpDelete("my-notifications/clear")]
        public async Task<IActionResult> ClearMyNotifications()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue("sub");
            if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

            int userId = int.Parse(userIdStr);

            var userNotifs = await _context.Notifications.Where(n => n.UserId == userId).ToListAsync();
            _context.Notifications.RemoveRange(userNotifs);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Bildirimler temizlendi." });
        }


        // ⏱️ ZAMAN TAKİBİ EFOR KAYDI
        [HttpPost("{taskId}/log-time")]
        public async Task<IActionResult> LogWorkTime(int taskId, [FromBody] LogTimeDto request)
        {
            var task = await _taskRepository.GetByIdAsync(taskId);
            if (task == null) return NotFound("Görev bulunamadı.");

            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue("sub");
            if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

            int userId = int.Parse(userIdStr);

            task.LoggedHours += request.Hours;
            _taskRepository.Update(task);
            await _unitOfWork.CommitAsync();

            // 🕒 Aktivite geçmişine çalışma süresini logla
            var user = await _context.Users.FindAsync(userId);
            string userName = user?.FullName ?? user?.Username ?? "Bir Üye";
            await LogActivityAsync(taskId, userId, userName, $"görevin eforuna {request.Hours} saat çalışma süresi kaydetti.");

            return Ok(new { Message = "Süre kaydı eklendi!", LoggedHours = task.LoggedHours });
        }

        public class LogTimeDto { public decimal Hours { get; set; } }



        // 🔄 ZAMAN KAYDINI SIFIRLA
        [HttpPost("{taskId}/reset-time")]
        public async Task<IActionResult> ResetWorkTime(int taskId)
        {
            var task = await _taskRepository.GetByIdAsync(taskId);
            if (task == null) return NotFound("Görev bulunamadı.");

            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue("sub");
            if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

            int userId = int.Parse(userIdStr);
            task.LoggedHours = 0;

            _taskRepository.Update(task);
            await _unitOfWork.CommitAsync();

            var user = await _context.Users.FindAsync(userId);
            string userName = user?.FullName ?? user?.Username ?? "Bir Üye";
            await LogActivityAsync(taskId, userId, userName, "görevin harcanan çalışma süresini sıfırladı.");

            return Ok(new { Message = "Süre sıfırlandı." });
        }

        // 📊 ÜYEYE ÖZEL AKTİVİTE VE PERFORMANS RAPORU
        [HttpGet("team/{teamId}/user/{targetUserId}/activities")]
        public async Task<IActionResult> GetUserActivitiesInTeam(int teamId, int targetUserId)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue("sub");
            if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

            // 1. Önce bu takıma ait tüm görevlerin ID'lerini buluyoruz
            var teamTaskIds = await _context.TaskItems
                .Where(t => t.TeamId == teamId)
                .Select(t => t.Id)
                .ToListAsync();

            // 2. Bu kullanıcının, bu takımdaki görevler üzerinde yaptığı son 30 hareketi çekiyoruz
            var activities = await _context.TaskActivities
                .Where(a => a.UserId == targetUserId && teamTaskIds.Contains(a.TaskId))
                .OrderByDescending(a => a.CreatedAt)
                .Take(30)
                .Select(a => new {
                    a.Id,
                    Action = a.Action,
                    CreatedAt = a.CreatedAt,
                    TaskTitle = _context.TaskItems.Where(t => t.Id == a.TaskId).Select(t => t.Title).FirstOrDefault()
                })
                .ToListAsync();

            return Ok(activities);
        }


        [HttpPost("send-otp")]
        public async Task<IActionResult> SendOtp([FromBody] SendOtpDto request)
        {
            if (string.IsNullOrEmpty(request.Email))
                return BadRequest(new { Message = "E-posta adresi boş olamaz." });

            // 1. 6 haneli rastgele doğrulama kodu üret
            var otpCode = new Random().Next(100000, 999999).ToString();

            // 2. Geliştirme (Test) ortamı için kodu Visual Studio / Terminal konsoluna yeşil renkle yazdır
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine($"==========================================");
            Console.WriteLine($"[OTP DOĞRULAMA KODU] Email: {request.Email} | Kod: {otpCode}");
            Console.WriteLine($"==========================================");
            Console.ResetColor();

            // 💡 NOT: Eğer projenizde SMTP/MailKit entegrasyonu varsa mail gönderme metodunuzu buraya ekleyebilirsiniz:
            // await _emailService.SendEmailAsync(request.Email, "Şifre Değiştirme Onay Kodu", $"Onay kodunuz: {otpCode}");

            return Ok(new { Message = "Doğrulama kodu başarıyla oluşturuldu.", OtpCode = otpCode });
        }

        // DTO Sınıfı (AuthController dışına veya en altına ekleyebilirsiniz)
        public class SendOtpDto
        {
            public string Email { get; set; } = string.Empty;
        }

    }







}