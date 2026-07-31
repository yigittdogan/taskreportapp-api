using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading.Tasks;
using TaskReport.Core.Entities;
using TaskReport.Data;

namespace TaskReport.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class KanbanColumnsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public KanbanColumnsController(AppDbContext context)
        {
            _context = context;
        }

        // 📌 Takıma ait tüm sütunları getirir (Eğer sütun yoksa otomatik 5 varsayılan sütun oluşturur)
        [HttpGet("team/{teamId}")]
        public async Task<IActionResult> GetTeamColumns(int teamId)
        {
            var columns = await _context.KanbanColumns
                .Where(c => c.TeamId == teamId)
                .OrderBy(c => c.Order)
                .ToListAsync();

            // Eğer takımın henüz özel sütunu yoksa, varsayılan 5 sütunu otomatik oluştur
            if (!columns.Any())
            {
                var defaultColumns = new[]
                {
                    new KanbanColumn { TeamId = teamId, Name = "Backlog", Order = 0 },
                    new KanbanColumn { TeamId = teamId, Name = "Yapılacaklar", Order = 1 },
                    new KanbanColumn { TeamId = teamId, Name = "Geliştirmede", Order = 2 },
                    new KanbanColumn { TeamId = teamId, Name = "Test Aşamasında", Order = 3 },
                    new KanbanColumn { TeamId = teamId, Name = "Tamamlandı", Order = 4 }
                };

                _context.KanbanColumns.AddRange(defaultColumns);
                await _context.SaveChangesAsync();
                columns = defaultColumns.ToList();
            }

            return Ok(columns);
        }

        // ➕ Yeni Sütun Ekle
        [HttpPost]
        public async Task<IActionResult> CreateColumn([FromBody] KanbanColumn column)
        {
            if (string.IsNullOrWhiteSpace(column.Name)) return BadRequest("Sütun adı boş olamaz.");

            var maxOrder = await _context.KanbanColumns
                .Where(c => c.TeamId == column.TeamId)
                .Select(c => (int?)c.Order)
                .MaxAsync() ?? -1;

            column.Order = maxOrder + 1;
            _context.KanbanColumns.Add(column);
            await _context.SaveChangesAsync();

            return Ok(column);
        }

        // ✏️ Sütun Adını Güncelle
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateColumn(int id, [FromBody] KanbanColumn request)
        {
            var column = await _context.KanbanColumns.FindAsync(id);
            if (column == null) return NotFound("Sütun bulunamadı.");

            column.Name = request.Name;
            await _context.SaveChangesAsync();

            return Ok(column);
        }

        // 🗑️ Sütun Sil
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteColumn(int id)
        {
            var column = await _context.KanbanColumns.FindAsync(id);
            if (column == null) return NotFound("Sütun bulunamadı.");

            _context.KanbanColumns.Remove(column);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Sütun silindi." });
        }

        // 🔄 Sütun Sıralamasını Güncelle
        [HttpPut("reorder")]
        public async Task<IActionResult> ReorderColumns([FromBody] List<int> columnIds)
        {
            for (int i = 0; i < columnIds.Count; i++)
            {
                var column = await _context.KanbanColumns.FindAsync(columnIds[i]);
                if (column != null)
                {
                    column.Order = i;
                }
            }
            await _context.SaveChangesAsync();
            return Ok(new { Message = "Sıralama güncellendi." });
        }
    }
}