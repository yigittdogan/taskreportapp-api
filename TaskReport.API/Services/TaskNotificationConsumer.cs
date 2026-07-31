using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace TaskReport.API.Services
{
    public class TaskNotificationConsumer : BackgroundService
    {
        private readonly ILogger<TaskNotificationConsumer> _logger;
        private readonly string _hostname = "localhost";
        private readonly string _queueName = "task_notifications";

        public TaskNotificationConsumer(ILogger<TaskNotificationConsumer> logger)
        {
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var factory = new ConnectionFactory() { HostName = _hostname };

            using var connection = await factory.CreateConnectionAsync(stoppingToken);
            using var channel = await connection.CreateChannelAsync(cancellationToken: stoppingToken);

            // Kuyruğun varlığından emin oluyoruz
            await channel.QueueDeclareAsync(
                queue: _queueName,
                durable: true,
                exclusive: false,
                autoDelete: false,
                arguments: null,
                cancellationToken: stoppingToken
            );

            var consumer = new AsyncEventingBasicConsumer(channel);

            // Kuyruğa yeni mesaj geldiğinde tetiklenecek olay
            consumer.ReceivedAsync += async (model, ea) =>
            {
                var body = ea.Body.ToArray();
                var message = Encoding.UTF8.GetString(body);

                // Konsola/Log ekranına mesajın alındığını yazdırıyoruz
                _logger.LogInformation($"[RabbitMQ - BİLDİRİM ALINDI]: {message}");

                // Mesajın başarıyla işlendiğini RabbitMQ'ya bildiriyoruz (Ack)
                await channel.BasicAckAsync(deliveryTag: ea.DeliveryTag, multiple: false);
            };

            await channel.BasicConsumeAsync(
                queue: _queueName,
                autoAck: false, // Elle onaylama (Ack) mekanizması
                consumer: consumer,
                cancellationToken: stoppingToken
            );

            // Servis kapanana kadar arka planda dinlemeye devam etsin
            while (!stoppingToken.IsCancellationRequested)
            {
                await Task.Delay(1000, stoppingToken);
            }
        }
    }
}