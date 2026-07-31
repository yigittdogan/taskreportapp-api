namespace TaskReport.Core.Entities
{
    public class TeamMember
    {
        public int Id { get; set; }
        public int TeamId { get; set; }
        public int UserId { get; set; }
        public string Role { get; set; } // "Admin" veya "Member" gibi rolleri tutacak
    }
}