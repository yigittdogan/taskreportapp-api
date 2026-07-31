using System;

namespace TaskReport.Core.Entities
{
    public class TeamInvitation
    {
        public int Id { get; set; }

        // Hangi takıma davet ediliyor?
        public int TeamId { get; set; }

        // Daveti gönderen kişinin (senin) ID'n
        public int InviterUserId { get; set; }

        // Davet edilen kişinin e-posta adresi
        public string InvitedEmail { get; set; } = string.Empty;

        // E-posta linkine eklenecek eşsiz, tahmin edilemez güvenlik kodu
        public string Token { get; set; } = string.Empty;

        // Davet kabul edildi mi? (İlk başta false olacak)
        public bool IsAccepted { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        // Opsiyonel: Davetiyenin son kullanma tarihi (Örn: 3 gün sonra)
        public DateTime ExpirationDate { get; set; } = DateTime.Now.AddDays(3);
    }
}