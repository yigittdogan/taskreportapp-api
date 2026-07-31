using Microsoft.AspNetCore.SignalR;

namespace TaskReport.API.Hubs
{
    // SignalR iletişim köprümüz. Şimdilik içi boş kalabilir, 
    // çünkü mesajları istemciden sunucuya değil, sunucudan istemcilere (Angular'a) fırlatacağız.
    public class NotificationHub : Hub
    {
    }
}