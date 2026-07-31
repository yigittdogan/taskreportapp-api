using Microsoft.AspNetCore.SignalR;
using TaskReport.Data;
using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Threading.Tasks;

namespace TaskReport.API.Hubs
{
    public class ChatHub : Hub
    {
        private static ConcurrentDictionary<string, string> OnlineUsers = new ConcurrentDictionary<string, string>();
        private readonly AppDbContext _context;

        public ChatHub(AppDbContext context)
        {
            _context = context;
        }

        public override async Task OnConnectedAsync()
        {
            var userId = Context.GetHttpContext()?.Request.Query["userId"].ToString();
            if (!string.IsNullOrEmpty(userId))
            {
                OnlineUsers.AddOrUpdate(userId, Context.ConnectionId, (key, oldValue) => Context.ConnectionId);
            }
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = OnlineUsers.FirstOrDefault(x => x.Value == Context.ConnectionId).Key;
            if (userId != null)
            {
                OnlineUsers.TryRemove(userId, out _);
            }
            await base.OnDisconnectedAsync(exception);
        }

        public async Task SendMessage(int senderId, int receiverId, string content)
        {
            try
            {
                var message = new Message
                {
                    SenderId = senderId,
                    ReceiverId = receiverId,
                    Content = content,
                    SentAt = DateTime.Now,
                    IsRead = false,
                    IsDeletedBySender = false,
                    IsDeletedByReceiver = false
                };

                _context.Messages.Add(message);
                await _context.SaveChangesAsync();

                if (OnlineUsers.TryGetValue(receiverId.ToString(), out string receiverConnectionId))
                {
                    await Clients.Client(receiverConnectionId).SendAsync("ReceiveMessage", message);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SOHBET HATASI]: {ex.Message}");
                throw;
            }
        }
    }
}