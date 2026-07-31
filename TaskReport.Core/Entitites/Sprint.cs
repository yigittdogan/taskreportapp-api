using System;
using System.Collections.Generic;
using TaskReport.Core.Entities;

namespace TaskReport.Core // Veya TaskReport.Core
{
    public enum SprintState
    {
        Planned = 0,
        Active = 1,
        Completed = 2,
        Cancelled = 3
    }

    public class Sprint
    {
        public int Id { get; set; }

        // Hangi takıma/panoya ait olduğu
        public int TeamId { get; set; }

        public string Name { get; set; } = string.Empty;
        public string? Goal { get; set; }

        public DateTime PlannedStartDate { get; set; }
        public DateTime PlannedEndDate { get; set; }

        public DateTime? ActualStartDate { get; set; }
        public DateTime? ActualEndDate { get; set; }

        public SprintState State { get; set; } = SprintState.Planned;

        public int OrderIndex { get; set; }

        // Navigation Properties
        // Sprint.cs dosyasının en alt satırını şu şekilde değiştir:
        public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
    }
}