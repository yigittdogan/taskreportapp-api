using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Minio;
using Minio.DataModel.Args;
using System;
using System.IO;
using System.Threading.Tasks;

namespace TaskReport.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    // [Authorize]
    public class FileController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly IMinioClient _minioClient;

        public FileController(IConfiguration configuration)
        {
            _configuration = configuration;

            // Appsettings'ten MinIO konfigürasyonunu okuyoruz
            var endpoint = _configuration["Minio:Endpoint"];
            var accessKey = _configuration["Minio:AccessKey"];
            var secretKey = _configuration["Minio:SecretKey"];

            // MinIO İstemcisini oluşturuyoruz
            _minioClient = new MinioClient()
                .WithEndpoint(endpoint)
                .WithCredentials(accessKey, secretKey)
                .Build();
        }

        [HttpPost("upload")]
        [AllowAnonymous] // Test süresince açık dursun
        public async Task<IActionResult> UploadFile(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("Lütfen geçerli bir dosya seçin.");

            string bucketName = _configuration["Minio:BucketName"] ?? "task-files";

            try
            {
                // 1. Kova (Bucket) var mı kontrol et, yoksa otomatik oluştur
                bool found = await _minioClient.BucketExistsAsync(new BucketExistsArgs().WithBucket(bucketName));
                if (!found)
                {
                    await _minioClient.MakeBucketAsync(new MakeBucketArgs().WithBucket(bucketName));
                }

                // 2. HERKESE AÇIK OKUMA POLİTİKASI (DÜZELTİLDİ: SetPolicyAsync & SetPolicyArgs)
                var policyJson = $@"{{
                  ""Version"": ""2012-10-17"",
                  ""Statement"": [
                    {{
                      ""Action"": [""s3:GetObject""],
                      ""Effect"": ""Allow"",
                      ""Principal"": {{""AWS"": [""*""]}},
                      ""Resource"": [""arn:aws:s3:::{bucketName}/*""]
                    }}
                  ]
                }}";

                var setPolicyArgs = new SetPolicyArgs()
                    .WithBucket(bucketName)
                    .WithPolicy(policyJson);

                await _minioClient.SetPolicyAsync(setPolicyArgs);

                // 3. Çakışmayı önlemek için dosyaya benzersiz bir ad ver (Guid + Orijinal Ad)
                string objectName = $"{Guid.NewGuid()}_{file.FileName}";

                // 4. Dosyayı MinIO sunucusuna aktar (Stream olarak)
                using (var stream = file.OpenReadStream())
                {
                    var putObjectArgs = new PutObjectArgs()
                        .WithBucket(bucketName)
                        .WithObject(objectName)
                        .WithStreamData(stream)
                        .WithObjectSize(file.Length)
                        .WithContentType(file.ContentType);

                    await _minioClient.PutObjectAsync(putObjectArgs);
                }

                // 5. İndirme veya önizleme URL'ini oluşturup döndür
                string fileUrl = $"http://localhost:9000/{bucketName}/{objectName}";

                return Ok(new
                {
                    Message = "Dosya başarıyla yüklendi!",
                    FileName = objectName,
                    FileUrl = fileUrl
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Dosya yükleme hatası: {ex.Message}");
            }
        }
    }
}