using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using TaskReport.Core.Entities;
using TaskReport.Data;

namespace TaskReportApp.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize] // 🔑 Kullanıcı kimliğini okumak için eklendi
    public class SubTasksController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SubTasksController(AppDbContext context)
        {
            _context = context;
        }

        // 🕒 AKTİVİTE LOGLAMA YARDIMCI METODU
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

        // 1. Bir Göreve Ait Alt Görevleri Getir
        [HttpGet("task/{taskId}")]
        public async Task<IActionResult> GetByTaskId(int taskId)
        {
            var subtasks = await _context.SubTasks
                .Where(s => s.TaskId == taskId)
                .ToListAsync();
            return Ok(subtasks);
        }

        // 2. Yeni Alt Görev Ekle
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] SubTask subTask)
        {
            if (string.IsNullOrWhiteSpace(subTask.Title))
                return BadRequest("Başlık boş olamaz.");

            _context.SubTasks.Add(subTask);
            await _context.SaveChangesAsync();

            // 🕒 LOG: ALT GÖREV EKLENDİ
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue("UserId");
            var userName = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("name") ?? User.FindFirstValue("FullName") ?? "Bir Üye";

            if (int.TryParse(userIdStr, out int userId))
            {
                await LogActivityAsync(subTask.TaskId, userId, userName, $"'{subTask.Title}' adında yeni bir alt görev ekledi.");
            }

            return Ok(subTask);
        }

        // 3. Alt Görevin Tamamlandı (Checkbox) Durumunu Güncelle
        [HttpPut("{id}/toggle")]
        public async Task<IActionResult> Toggle(int id)
        {
            var subTask = await _context.SubTasks.FindAsync(id);
            if (subTask == null) return NotFound();

            subTask.IsCompleted = !subTask.IsCompleted;
            await _context.SaveChangesAsync();

            // 🕒 LOG: ALT GÖREV TAMAMLANDI / İŞARET KALDIRILDI
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue("UserId");
            var userName = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("name") ?? User.FindFirstValue("FullName") ?? "Bir Üye";

            if (int.TryParse(userIdStr, out int userId))
            {
                string statusText = subTask.IsCompleted ? "tamamlandı olarak işaretledi." : "işaretini kaldırdı.";
                await LogActivityAsync(subTask.TaskId, userId, userName, $"'{subTask.Title}' alt görevini {statusText}");
            }

            return Ok(subTask);
        }

        // 4. Alt Görev Sil
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var subTask = await _context.SubTasks.FindAsync(id);
            if (subTask == null) return NotFound();

            int taskId = subTask.TaskId;
            string title = subTask.Title;

            _context.SubTasks.Remove(subTask);
            await _context.SaveChangesAsync();

            // 🕒 LOG: ALT GÖREV SİLİNDİ
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue("UserId");
            var userName = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("name") ?? User.FindFirstValue("FullName") ?? "Bir Üye";

            if (int.TryParse(userIdStr, out int userId))
            {
                await LogActivityAsync(taskId, userId, userName, $"'{title}' alt görevini sildi.");
            }

            return Ok();
        }
    }
}