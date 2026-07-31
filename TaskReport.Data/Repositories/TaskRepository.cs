using Microsoft.EntityFrameworkCore;
using TaskReport.Core.Entities;
using TaskReport.Core.Repositories;

namespace TaskReport.Data.Repositories
{
    public class TaskRepository : GenericRepository<TaskItem>, ITaskRepository
    {
        public TaskRepository(AppDbContext context) : base(context)
        {
        }

        public async Task<IEnumerable<TaskItem>> GetTasksByUserIdAsync(int userId)
        {
            // Belirli bir kullanıcıya ait görevleri veritabanından çekiyoruz
            return await _context.TaskItems.Where(t => t.UserId == userId).ToListAsync();
        }
    }
}