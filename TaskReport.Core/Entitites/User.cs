

namespace TaskReport.Core.Entities
{
    public class User
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public byte[] PasswordHash { get; set; } = new byte[0]; // Şifrelenmiş saklama için
        public byte[] PasswordSalt { get; set; } = new byte[0]; // Güvenlik tuzu

        public string FullName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Bir kullanıcının birden fazla görevi olabilir (İlişki)
        public ICollection<TaskItem> TaskItems { get; set; } = new List<TaskItem>();
    }
}