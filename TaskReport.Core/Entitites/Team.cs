using System;

namespace TaskReport.Core.Entities
{
    public class Team
    {
        public int Id { get; set; }
        public string Name { get; set; } // Takımın Adı (Örn: Yazılım Ekibi)
        public DateTime CreatedDate { get; set; } = DateTime.Now;
    }
}