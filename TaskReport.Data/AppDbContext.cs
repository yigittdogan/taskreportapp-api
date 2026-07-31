using Microsoft.EntityFrameworkCore;
using TaskReport.Core;
using TaskReport.Core.Entities;
using TaskReportApp;

namespace TaskReport.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<TaskItem> TaskItems { get; set; }
        public DbSet<Message> Messages { get; set; }
        public DbSet<TaskActivity> TaskActivities { get; set; }
        public DbSet<TeamInvitation> TeamInvitations { get; set; }
        public DbSet<Team> Teams { get; set; }
        public DbSet<TeamMember> TeamMembers { get; set; }
        public DbSet<SubTask> SubTasks { get; set; }
        public DbSet<TaskComment> TaskComments { get; set; }
        public DbSet<KanbanColumn> KanbanColumns { get; set; }
        public DbSet<Notification> Notifications { get; set; }

        // Sprint Modülü Tabloları
        public DbSet<Sprint> Sprints { get; set; }
        public DbSet<SprintAuditLog> SprintAuditLogs { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // 1. TaskItem ile Sprint Arasındaki İlişki (Bire-Çok)
            modelBuilder.Entity<TaskItem>()
                .HasOne(t => t.Sprint)
                .WithMany(s => s.Tasks)
                .HasForeignKey(t => t.SprintId)
                .OnDelete(DeleteBehavior.SetNull); // Sprint silindiğinde görevler silinmez, Backlog'a (null) düşer

            // 2. Ondalık (Decimal) Basamak Tanımlamaları (Sarı uyarıları çözer)
            modelBuilder.Entity<TaskItem>()
                .Property(t => t.EstimatedHours)
                .HasColumnType("decimal(18,2)");

            modelBuilder.Entity<TaskItem>()
                .Property(t => t.LoggedHours)
                .HasColumnType("decimal(18,2)");

            // 3. Race Condition Koruması (Filtered Unique Index)
            // Aynı panoda aynı anda yalnızca 1 tane Active (State = 1) sprint bulunabilir.
            modelBuilder.Entity<Sprint>()
                .HasIndex(s => s.TeamId)
                .IsUnique()
                .HasFilter("[State] = 1");
        }
    }
}