using System;

namespace TaskReport.Core.Entities
{
    public class TaskComment
    {
        public int Id { get; set; }
        public int TaskId { get; set; }
        public int UserId { get; set; }
        public string CommentText { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        // İlişkiler
        public virtual User? User { get; set; }
    }
}