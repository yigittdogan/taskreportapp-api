using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading.Tasks;
using TaskReport.Data;

namespace TaskReport.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ChatController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ChatController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("history/{userId}/{contactId}")]
        public async Task<IActionResult> GetMessageHistory(int userId, int contactId)
        {
            var messages = await _context.Messages
                .Where(m =>
                    (m.SenderId == userId && m.ReceiverId == contactId && !m.IsDeletedBySender) ||
                    (m.SenderId == contactId && m.ReceiverId == userId && !m.IsDeletedByReceiver))
                .OrderBy(m => m.SentAt)
                .ToListAsync();

            return Ok(messages);
        }

        [HttpDelete("{messageId}/delete-for-me/{userId}")]
        public async Task<IActionResult> DeleteForMe(int messageId, int userId)
        {
            var msg = await _context.Messages.FindAsync(messageId);
            if (msg == null) return NotFound();

            if (msg.SenderId == userId) msg.IsDeletedBySender = true;
            else if (msg.ReceiverId == userId) msg.IsDeletedByReceiver = true;

            if (msg.IsDeletedBySender && msg.IsDeletedByReceiver)
                _context.Messages.Remove(msg);

            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpDelete("clear-chat/{userId}/{contactId}")]
        public async Task<IActionResult> ClearChat(int userId, int contactId)
        {
            var messages = await _context.Messages
                .Where(m => (m.SenderId == userId && m.ReceiverId == contactId) ||
                            (m.SenderId == contactId && m.ReceiverId == userId))
                .ToListAsync();

            foreach (var msg in messages)
            {
                if (msg.SenderId == userId) msg.IsDeletedBySender = true;
                else if (msg.ReceiverId == userId) msg.IsDeletedByReceiver = true;

                if (msg.IsDeletedBySender && msg.IsDeletedByReceiver)
                {
                    _context.Messages.Remove(msg);
                }
            }

            await _context.SaveChangesAsync();
            return Ok();
        }


        [HttpGet("all-messages/{userId}")]
        public async Task<IActionResult> GetAllUserMessages(int userId)
        {
            var messages = await _context.Messages
                .Where(m => (m.SenderId == userId && !m.IsDeletedBySender) ||
                            (m.ReceiverId == userId && !m.IsDeletedByReceiver))
                .OrderBy(m => m.SentAt)
                .ToListAsync();

            return Ok(messages);
        }





    }
}