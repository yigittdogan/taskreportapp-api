namespace TaskReport.Core.UnitOfWorks
{
    public interface IUnitOfWork
    {
        Task CommitAsync(); // SaveChangesAsync() işlemini tetikleyecek
        void Commit();      // SaveChanges() işlemini tetikleyecek
    }
}