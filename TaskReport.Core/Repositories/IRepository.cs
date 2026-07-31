using System.Linq.Expressions;

namespace TaskReport.Core.Repositories
{
    // Buradaki <T> kısmı hatayı çözen anahtar noktadır
    public interface IRepository<T> where T : class
    {
        Task<T?> GetByIdAsync(int id);
        Task<IEnumerable<T>> GetAllAsync();
        IQueryable<T> Where(Expression<Func<T, bool>> expression);
        Task AddAsync(T entity);
        void Update(T entity);
        void Remove(T entity);
    }
}