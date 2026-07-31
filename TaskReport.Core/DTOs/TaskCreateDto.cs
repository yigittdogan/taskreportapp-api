using System;
using TaskReport.Core.Entities;

namespace TaskReport.Core.DTOs
{
    public class TaskCreateDto
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public string Priority { get; set; } = "Normal";
        public int TeamId { get; set; }
        public bool IsCompleted { get; set; }
        public TaskType Type { get; set; } = TaskType.Task;
        public ProjectStatus Status { get; set; } = ProjectStatus.ToDo;
        public int? EpicId { get; set; }

        public decimal EstimatedHours { get; set; } = 0;
        public decimal LoggedHours { get; set; } = 0;

        public int? AssigneeId { get; set; }

        public string Tags { get; set; } = "[]";
            
    }
}