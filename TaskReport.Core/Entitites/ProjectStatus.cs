namespace TaskReport.Core.Entities
{
    public enum ProjectStatus
    {
        Backlog = 0,      // Henüz planlanmamış havuz
        ToDo = 1,         // Yapılacaklar
        Development = 2,  // Geliştirme aşaması
        QA = 3,           // Test / Kalite Kontrol aşaması
        Done = 4          // Tamamlananlar
    }
}