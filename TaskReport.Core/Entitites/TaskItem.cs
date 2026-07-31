using System;
using TaskReportApp;

namespace TaskReport.Core.Entities
{
    public class TaskItem
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string Priority { get; set; } = "Medium"; // Low, Medium, High
        public bool IsCompleted { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public List<SubTask> SubTasks { get; set; } = new List<SubTask>();

        public int TeamId { get; set; }

        public int UserId { get; set; }
        public User User { get; set; } = null!;

        public int? AssigneeId { get; set; }

        // ==========================================
        // YENİ EKLENEN AGILE & JIRA ÖZELLİKLERİ
        // ==========================================
        public TaskType Type { get; set; } = TaskType.Task; // Varsayılan olarak standart görev
        public ProjectStatus Status { get; set; } = ProjectStatus.ToDo; // Varsayılan olarak ToDo sütunu[cite: 1]

        // Bir görevin bir Epic'e (büyük iş paketine) bağlanabilmesi için (Boş bırakılabilir)[cite: 1]
        public int? EpicId { get; set; }

        public decimal EstimatedHours { get; set; } = 0;
        public decimal LoggedHours { get; set; } = 0;

        public string Tags { get; set; } = "[]";

        // Mevcut Task sınıfınızın içerisine eklenecek alanlar:

        // Hangi sprinte ait olduğu (Null ise Backlog'dadır)
        // TaskItem.cs sınıfının içerisine eklenecekler:
        public int? SprintId { get; set; }
        public int? StoryPoint { get; set; }
        public Sprint? Sprint { get; set; }
    }


}