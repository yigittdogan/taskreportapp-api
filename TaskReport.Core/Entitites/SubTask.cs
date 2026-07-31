using System.Text.Json.Serialization;
using TaskReport.Core.Entities;

namespace TaskReportApp // Kendi projenin namespace adı neyse onu bırak
{
    public class SubTask
    {
        public int Id { get; set; }
        public int TaskId { get; set; }
        public string Title { get; set; } = string.Empty;
        public bool IsCompleted { get; set; } = false;

        [JsonIgnore]
        public TaskItem? TaskItem { get; set; }
    }
}