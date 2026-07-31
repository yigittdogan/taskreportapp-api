namespace TaskReport.Core.Entities
{
    public enum TaskType
    {
        Task = 0,    // Standart düz görev
        Bug = 1,     // Hata bildirimi
        Story = 2,   // Kullanıcı hikayesi / yeni özellik
        Epic = 3     // Büyük iş paketi (Diğer görevleri kapsar)
    }
}