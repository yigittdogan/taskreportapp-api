using System;

namespace TaskReport.Core
{
    public enum SprintActionType
    {
        SprintCreated,
        SprintStarted,
        SprintCompleted,
        SprintCancelled,
        TaskAddedAfterStart,    // Aktif sprinte iş eklendi
        TaskRemovedAfterStart,  // Aktif sprintten iş çıkarıldı
        SprintScopeChanged      // Genel kapsam değişikliği
    }

    public class SprintAuditLog
    {
        public int Id { get; set; }
        public int SprintId { get; set; }

        // Hangi görev eklendi/çıkarıldı (Sprint bazlı loglarda null olabilir)
        public int? TaskId { get; set; }

        public int UserId { get; set; }

        public SprintActionType ActionType { get; set; }

        public string? Details { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}