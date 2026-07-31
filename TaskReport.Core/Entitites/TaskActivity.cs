namespace TaskReport.Core.Entities
{
    public class TaskActivity
    {
        public int Id { get; set; }
        public int TaskId { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; }
        public string Action { get; set; } // Örn: "görevi oluşturdu", "Geliştirmede sütununa taşıdı"
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}