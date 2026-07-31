using System;

namespace TaskReport.Core.Entities
{
    public class Notification
    {
        public int Id { get; set; }
        public int UserId { get; set; } // Bildirimin gideceği kullanıcı
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public bool IsRead { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}