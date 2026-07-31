using TaskReport.Core.Entities;

namespace TaskReport.Core.Repositories
{
    // Class yerine 'interface' anahtar kelimesini kullandığından emin ol
    public interface ITaskRepository : IRepository<TaskItem>
    {
        Task<IEnumerable<TaskItem>> GetTasksByUserIdAsync(int userId);
    }
}