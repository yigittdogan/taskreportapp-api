using System;
using System.Collections.Generic;

namespace TaskReport.Core.DTOs
{
    public class CreateSprintDto
    {
        public int TeamId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Goal { get; set; }
        public DateTime PlannedStartDate { get; set; }
        public DateTime PlannedEndDate { get; set; }
    }

    public class UpdateSprintDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Goal { get; set; }
        public DateTime PlannedStartDate { get; set; }
        public DateTime PlannedEndDate { get; set; }
    }

    public class CompleteSprintDto
    {
        // "Backlog" veya "NextSprint"
        public string Destination { get; set; } = "Backlog";

        // Destination == "NextSprint" ise hedef sprint ID'si
        public int? TargetSprintId { get; set; }
    }

    public class MoveTaskSprintDto
    {
        // Null ise Backlog'a taşınır, dolu ise belirtilen Sprint'e taşınır
        public int? TargetSprintId { get; set; }
    }
}