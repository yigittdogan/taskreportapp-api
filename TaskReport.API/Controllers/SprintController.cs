using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;
using TaskReport.Core;
using TaskReport.Core.DTOs;
using TaskReport.Data;

namespace TaskReport.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SprintController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SprintController(AppDbContext context)
        {
            _context = context;
        }

        // 1. TAKIMA AİT SPRINTLERİ VE BACKLOG'U GETİR (Backlog Ekranı İçin)
        [HttpGet("team/{teamId}")]
        public async Task<IActionResult> GetTeamSprintsAndBacklog(int teamId)
        {
            // Sprintleri ve içindeki görevleri getir
            var sprints = await _context.Sprints
                .Where(s => s.TeamId == teamId)
                .Include(s => s.Tasks)
                .OrderByDescending(s => s.State == SprintState.Active)
                .ThenBy(s => s.OrderIndex)
                .ToListAsync();

            // SprintId == null olanlar Backlog görevleridir
            var backlogTasks = await _context.TaskItems
                .Where(t => t.TeamId == teamId && t.SprintId == null)
                .ToListAsync();

            return Ok(new
            {
                Sprints = sprints,
                Backlog = backlogTasks
            });
        }

        // 2. YENİ SPRINT OLUŞTUR
        [HttpPost]
        public async Task<IActionResult> CreateSprint([FromBody] CreateSprintDto dto)
        {
            if (dto.PlannedEndDate <= dto.PlannedStartDate)
                return BadRequest("Bitiş tarihi başlangıç tarihinden sonra olmalıdır.");

            var sprint = new Sprint
            {
                TeamId = dto.TeamId,
                Name = dto.Name,
                Goal = dto.Goal,
                PlannedStartDate = dto.PlannedStartDate,
                PlannedEndDate = dto.PlannedEndDate,
                State = SprintState.Planned
            };

            _context.Sprints.Add(sprint);
            await _context.SaveChangesAsync();

            return Ok(sprint);
        }

        // 3. SPRINTİ BAŞLAT (Tüm Güvenlik ve İş Kuralları İle)
        [HttpPost("{sprintId}/start")]
        public async Task<IActionResult> StartSprint(int sprintId, [FromQuery] int userId)
        {
            var sprint = await _context.Sprints
                .Include(s => s.Tasks)
                .FirstOrDefaultAsync(s => s.Id == sprintId);

            if (sprint == null) return NotFound("Sprint bulunamadı.");
            if (sprint.State != SprintState.Planned) return BadRequest("Sadece 'Planned' durumundaki sprintler başlatılabilir.");

            // İŞ KURALI 1: Boş sprint başlatılamaz
            if (!sprint.Tasks.Any())
                return BadRequest("İçerisinde en az bir görev bulunmayan sprint başlatılamaz!");

            // İŞ KURALI 2: Aynı panoda aktif sprint varken ikincisi başlatılamaz
            bool hasActiveSprint = await _context.Sprints.AnyAsync(s => s.TeamId == sprint.TeamId && s.State == SprintState.Active);
            if (hasActiveSprint)
                return BadRequest("Bu takımda zaten aktif bir sprint bulunmaktadır. Önce onu tamamlamalısınız.");

            // Sprinti Aktif Yap
            sprint.State = SprintState.Active;
            sprint.ActualStartDate = DateTime.Now;

            // Audit Log Kaydı
            _context.SprintAuditLogs.Add(new SprintAuditLog
            {
                SprintId = sprint.Id,
                UserId = userId,
                ActionType = SprintActionType.SprintStarted,
                Details = $"'{sprint.Name}' isimli sprint başlatıldı.",
                CreatedAt = DateTime.Now
            });

            await _context.SaveChangesAsync();
            return Ok(sprint);
        }

        // 4. SPRINTİ TAMAMLA (Atomik Transaction ile Görev Taşıma)
        [HttpPost("{sprintId}/complete")]
        public async Task<IActionResult> CompleteSprint(int sprintId, [FromBody] CompleteSprintDto dto, [FromQuery] int userId)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var sprint = await _context.Sprints
                    .Include(s => s.Tasks)
                    .FirstOrDefaultAsync(s => s.Id == sprintId);

                if (sprint == null) return NotFound("Sprint bulunamadı.");
                if (sprint.State != SprintState.Active) return BadRequest("Sadece aktif sprintler tamamlanabilir.");

                // Tamamlanan ve tamamlanmayan görevleri ayır
                // (Sütun sırası 4 / Done olanlar tamamlanmış kabul edilir)
                // Status enum'ını (int) şeklinde sayıya dönüştürerek kıyaslıyoruz:
                var completedTasks = sprint.Tasks.Where(t => (int)t.Status == 4).ToList();
                var incompleteTasks = sprint.Tasks.Where(t => (int)t.Status != 4).ToList();

                // Tamamlanmayan görevleri seçilen hedefe taşı
                if (incompleteTasks.Any())
                {
                    if (dto.Destination == "NextSprint" && dto.TargetSprintId.HasValue)
                    {
                        foreach (var task in incompleteTasks)
                        {
                            task.SprintId = dto.TargetSprintId.Value;
                        }
                    }
                    else // Varsayılan: Backlog'a taşı
                    {
                        foreach (var task in incompleteTasks)
                        {
                            task.SprintId = null;
                        }
                    }
                }

                sprint.State = SprintState.Completed;
                sprint.ActualEndDate = DateTime.Now;

                _context.SprintAuditLogs.Add(new SprintAuditLog
                {
                    SprintId = sprint.Id,
                    UserId = userId,
                    ActionType = SprintActionType.SprintCompleted,
                    Details = $"Sprint tamamlandı. {completedTasks.Count} görev bitti, {incompleteTasks.Count} görev aktarıldı.",
                    CreatedAt = DateTime.Now
                });

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { Message = "Sprint başarıyla tamamlandı.", CompletedTasksCount = completedTasks.Count, IncompleteTasksCount = incompleteTasks.Count });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, $"Sprint tamamlanırken bir hata oluştu: {ex.Message}");
            }
        }

        // 5. GÖREVİ SPRINT'E / BACKLOG'A TAŞIMA (Drag-and-Drop Uç Noktası)
        [HttpPost("move-task/{taskId}")]
        public async Task<IActionResult> MoveTask(int taskId, [FromBody] MoveTaskSprintDto dto, [FromQuery] int userId)
        {
            var task = await _context.TaskItems.FindAsync(taskId);
            if (task == null) return NotFound("Görev bulunamadı.");

            // Eski ve Yeni Sprint Bilgilerini Çek
            var currentSprint = task.SprintId.HasValue ? await _context.Sprints.FindAsync(task.SprintId.Value) : null;
            var targetSprint = dto.TargetSprintId.HasValue ? await _context.Sprints.FindAsync(dto.TargetSprintId.Value) : null;

            // İŞ KURALI: Tamamlanmış sprint üzerindeki görevler değiştirilemez
            if (currentSprint != null && currentSprint.State == SprintState.Completed)
                return BadRequest("Tamamlanmış bir sprint içerisindeki görevler taşınamaz!");

            if (targetSprint != null && targetSprint.State == SprintState.Completed)
                return BadRequest("Tamamlanmış bir sprinte görev eklenemez!");

            // Scope Değişikliği (Aktif sprint'e eleman ekleniyor veya çıkarılıyorsa Audit Log yaz)
            if (currentSprint != null && currentSprint.State == SprintState.Active)
            {
                _context.SprintAuditLogs.Add(new SprintAuditLog
                {
                    SprintId = currentSprint.Id,
                    TaskId = task.Id,
                    UserId = userId,
                    ActionType = SprintActionType.TaskRemovedAfterStart,
                    Details = $"'{task.Title}' görevi aktif sprintten çıkarıldı.",
                    CreatedAt = DateTime.Now
                });
            }

            if (targetSprint != null && targetSprint.State == SprintState.Active)
            {
                _context.SprintAuditLogs.Add(new SprintAuditLog
                {
                    SprintId = targetSprint.Id,
                    TaskId = task.Id,
                    UserId = userId,
                    ActionType = SprintActionType.TaskAddedAfterStart,
                    Details = $"'{task.Title}' görevi aktif sprinte eklendi (Kapsam Değişikliği).",
                    CreatedAt = DateTime.Now
                });
            }

            // Görevin Yeni Sprint Bilgisini Güncelle
            task.SprintId = dto.TargetSprintId;
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Görev konumu başarıyla güncellendi." });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSprint(int id)
        {
            var sprint = await _context.Sprints.FindAsync(id);
            if (sprint == null) return NotFound("Sprint bulunamadı.");
            if (sprint.State == SprintState.Completed) return BadRequest("Tamamlanmış sprintler silinemez.");

            _context.Sprints.Remove(sprint);
            await _context.SaveChangesAsync();
            return Ok();
        }
    }
}