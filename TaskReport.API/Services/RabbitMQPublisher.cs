using RabbitMQ.Client;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace TaskReport.API.Services
{
    public class RabbitMQPublisher
    {
        private readonly string _hostname = "localhost";

        public async Task PublishTaskCreatedMessageAsync(object messageObject)
        {
            var factory = new ConnectionFactory() { HostName = _hostname };

            using var connection = await factory.CreateConnectionAsync();
            using var channel = await connection.CreateChannelAsync();

            // 'task_notifications' adında bir kuyruk oluşturuyoruz
            await channel.QueueDeclareAsync(
                queue: "task_notifications",
                durable: true,
                exclusive: false,
                autoDelete: false,
                arguments: null
            );

            var jsonString = JsonSerializer.Serialize(messageObject);
            var body = Encoding.UTF8.GetBytes(jsonString);

            // Mesajı kuyruğa fırlatıyoruz
            await channel.BasicPublishAsync(
                exchange: "",
                routingKey: "task_notifications",
                body: body
            );
        }
    }
}