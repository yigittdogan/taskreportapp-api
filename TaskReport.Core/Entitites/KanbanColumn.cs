namespace TaskReport.Core.Entities
{
    public class KanbanColumn
    {
        public int Id { get; set; }
        public int TeamId { get; set; }
        public string Name { get; set; } = string.Empty;
        public int Order { get; set; }
    }
}