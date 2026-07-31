using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Net;
using System.Net.Mail;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using TaskReport.Core.DTOs;
using TaskReport.Core.Entities;
using TaskReport.Core.Repositories;
using TaskReport.Core.UnitOfWorks;
using TaskReport.Data;
using Google.Apis.Auth;


namespace TaskReport.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IRepository<User> _userRepository;
        private readonly IUnitOfWork _unitOfWork;
        private readonly IConfiguration _configuration;
        private readonly AppDbContext _context;
        private readonly IMemoryCache _cache;

        public AuthController(IRepository<User> userRepository, IUnitOfWork unitOfWork, IConfiguration configuration, AppDbContext context, IMemoryCache cache)
        {
            _userRepository = userRepository;
            _unitOfWork = unitOfWork;
            _configuration = configuration;
            _context = context;
            _cache = cache;
        }

        // 📧 1. ANGULAR'IN İSTEDİĞİ ŞİFRE DEĞİŞTİRME MAİLİ ATAN YENİ ENDPOINT
        [HttpPost("send-otp")]
        public async Task<IActionResult> SendOtp([FromBody] SendOtpDto request)
        {
            if (string.IsNullOrEmpty(request.Email))
                return BadRequest("E-posta adresi boş olamaz.");

            string code = new Random().Next(100000, 999999).ToString();
            // Kod 5 dakika hafızada tutulacak
            _cache.Set($"otp_{request.Email}", code, TimeSpan.FromMinutes(5));

            try
            {
                MailMessage mail = new MailMessage();
                mail.From = new MailAddress("MAIL_ADRESINIZ_BURAYA");
                mail.To.Add(request.Email);
                mail.Subject = "TaskReport - Şifre Değiştirme Onay Kodu";
                mail.Body = $"Merhaba,\n\nŞifrenizi güncellemek için onay kodunuz: {code}\n\nBu kod 5 dakika boyunca geçerlidir.";

                SmtpClient smtp = new SmtpClient("smtp.gmail.com", 587)
                {
                    Credentials = new NetworkCredential("MAIL_ADRESINIZ_BURAYA", "***************"),
                    EnableSsl = true
                };

                await smtp.SendMailAsync(mail);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MAIL HATASI]: {ex.Message}");
                return BadRequest("Mail gönderilirken bir hata oluştu. Lütfen e-posta adresinizi kontrol edin.");
            }

            return Ok(new { Message = "Doğrulama kodu e-postanıza başarıyla gönderildi!" });
        }

        [HttpPost("send-verification")]
        public async Task<IActionResult> SendVerificationCode([FromBody] RegisterDto request)
        {
            var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Username == request.Username);
            if (existingUser != null) return BadRequest("Bu kullanıcı adı zaten alınmış!");

            var existingEmail = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
            if (existingEmail != null) return BadRequest("Bu e-posta adresi sistemde zaten kayıtlı!");

            string code = new Random().Next(100000, 999999).ToString();
            _cache.Set(request.Email, code, TimeSpan.FromMinutes(5));

            try
            {
                MailMessage mail = new MailMessage();
                mail.From = new MailAddress("MAIL_ADRESINIZ_BURAYA");
                mail.To.Add(request.Email);
                mail.Subject = "TaskReport - Kayıt Doğrulama Kodu";
                mail.Body = $"Hoş geldin {request.Name}!\n\nKayıt işlemini tamamlamak için doğrulama kodun: {code}\n\nBu kod 5 dakika geçerlidir.";

                SmtpClient smtp = new SmtpClient("smtp.gmail.com", 587);
                smtp.Credentials = new NetworkCredential("MAIL_ADRESINIZ_BURAYA", "***************");
                smtp.EnableSsl = true;

                await smtp.SendMailAsync(mail);
            }
            catch (Exception)
            {
                return BadRequest("Mail gönderilemedi. Lütfen geçerli bir e-posta adresi girdiğinizden emin olun.");
            }

            return Ok(new { Message = "Doğrulama kodu gönderildi!" });
        }

        [HttpPost("register-with-verification")]
        public async Task<IActionResult> RegisterWithVerification([FromBody] RegisterWithCodeDto request)
        {
            if (!_cache.TryGetValue(request.Email, out string savedCode))
                return BadRequest("Doğrulama kodunun süresi dolmuş veya geçersiz!");

            if (savedCode != request.Code)
                return BadRequest("Hatalı doğrulama kodu girdiniz!");

            var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Username == request.Username);
            if (existingUser != null) return BadRequest("Bu kullanıcı adı siz doğrulama yaparken alınmış!");

            CreatePasswordHash(request.Password, out byte[] passwordHash, out byte[] passwordSalt);
            var newUser = new User
            {
                Email = request.Email,
                Username = request.Username,
                FullName = request.Name,
                PasswordHash = passwordHash,
                PasswordSalt = passwordSalt
            };

            _context.Users.Add(newUser);
            await _context.SaveChangesAsync();
            _cache.Remove(request.Email);

            return Ok(new { Message = "Kayıt başarılı!" });
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto request)
        {
            var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Username == request.Username);
            if (existingUser != null) return BadRequest("Bu kullanıcı adı zaten alınmış! Lütfen başka bir kullanıcı adı seçin.");

            var existingEmail = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
            if (existingEmail != null) return BadRequest("Bu e-posta adresi sistemde zaten kayıtlı!");

            CreatePasswordHash(request.Password, out byte[] passwordHash, out byte[] passwordSalt);

            var newUser = new User
            {
                Email = request.Email,
                Username = request.Username,
                FullName = request.Name,
                PasswordHash = passwordHash,
                PasswordSalt = passwordSalt
            };

            _context.Users.Add(newUser);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Kayıt başarılı!" });
        }

        [HttpPost("login")]
        public IActionResult Login(UserLoginDto request)
        {
            // 🚀 Kullanıcı Username kutusuna "ahmet" de yazsa, "ahmet@gmail.com" da yazsa çalışır!
            var user = _context.Users.FirstOrDefault(x => x.Username == request.Username || x.Email == request.Username);

            if (user == null) return BadRequest("Kullanıcı veya e-posta bulunamadı.");

            if (!VerifyPasswordHash(request.Password, user.PasswordHash, user.PasswordSalt))
                return BadRequest("Yanlış şifre.");

            string token = CreateToken(user);
            return Ok(new { Token = token, Message = "Giriş başarılı!" });
        }


        // 👤 2. PROFİL GETİRİRKEN AD SOYAD BİLGİSİNİ TAM DÖNDÜRÜYORUZ
        [HttpGet("profile")]
        [Authorize]
        public async Task<IActionResult> GetProfile()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue("UserId") ?? User.FindFirstValue("sub");
            if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();
            int userId = int.Parse(userIdStr);

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("Kullanıcı bulunamadı.");

            return Ok(new { user.Id, Name = user.FullName ?? user.Username, user.Email, user.Username });
        }

        // 🔐 3. ŞİFRE GÜNCELLENİRKEN E-POSTA KODUNU (OTP) DOĞRULAYAN METOT
        [HttpPut("profile/update")]
        [Authorize]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto request)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue("UserId") ?? User.FindFirstValue("sub");
            if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();
            int userId = int.Parse(userIdStr);

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("Kullanıcı bulunamadı.");

            if (user.Username != request.Username && await _context.Users.AnyAsync(u => u.Username == request.Username))
                return BadRequest("Bu kullanıcı adı zaten kullanılıyor.");

            if (user.Email != request.Email && await _context.Users.AnyAsync(u => u.Email == request.Email))
                return BadRequest("Bu e-posta adresi zaten kullanılıyor.");

            // Eğer şifre doldurulduysa OTP doğrulamasını zorunlu tut
            if (!string.IsNullOrEmpty(request.Password))
            {
                if (!_cache.TryGetValue($"otp_{request.Email}", out string savedCode) || savedCode != request.OtpCode)
                {
                    return BadRequest("Girdiğiniz doğrulama kodu hatalı veya süresi dolmuş!");
                }

                CreatePasswordHash(request.Password, out byte[] passwordHash, out byte[] passwordSalt);
                user.PasswordHash = passwordHash;
                user.PasswordSalt = passwordSalt;

                // Kullanılan kodu temizle
                _cache.Remove($"otp_{request.Email}");
            }

            user.FullName = request.Name;
            user.Username = request.Username;
            user.Email = request.Email;

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Profil başarıyla güncellendi!" });
        }

        [HttpPost("delete-account")]
        [Authorize]
        public async Task<IActionResult> DeleteAccount([FromBody] DeleteAccountDto request)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue("UserId") ?? User.FindFirstValue("sub");
            if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();
            int userId = int.Parse(userIdStr);

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("Kullanıcı bulunamadı.");

            if (!VerifyPasswordHash(request.Password, user.PasswordHash, user.PasswordSalt))
                return BadRequest("Girdiğiniz şifre yanlış. Hesap silme işlemi iptal edildi.");

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Hesabınız başarıyla silindi." });
        }

        public class DeleteAccountDto { public string Password { get; set; } }

        private void CreatePasswordHash(string password, out byte[] passwordHash, out byte[] passwordSalt)
        {
            using (var hmac = new HMACSHA512())
            {
                passwordSalt = hmac.Key;
                passwordHash = hmac.ComputeHash(Encoding.UTF8.GetBytes(password));
            }
        }

        private bool VerifyPasswordHash(string password, byte[] passwordHash, byte[] passwordSalt)
        {
            using (var hmac = new HMACSHA512(passwordSalt))
            {
                var computedHash = hmac.ComputeHash(Encoding.UTF8.GetBytes(password));
                return computedHash.SequenceEqual(passwordHash);
            }
        }

        private string CreateToken(User user)
        {
            List<Claim> claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim("FullName", user.FullName ?? user.Username)
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration.GetSection("AppSettings:Token").Value!));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha512Signature);
            var token = new JwtSecurityToken(claims: claims, expires: DateTime.Now.AddDays(1), signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        // 📧 1. ŞİFRE SIFIRLAMA KODU GÖNDERME
        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
            if (user == null) return BadRequest("Bu e-posta adresine kayıtlı bir hesap bulunamadı.");

            string code = new Random().Next(100000, 999999).ToString();
            _cache.Set($"reset_{request.Email}", code, TimeSpan.FromMinutes(5)); // Kod 5 dakika geçerli

            try
            {
                MailMessage mail = new MailMessage();
                mail.From = new MailAddress("MAIL_ADRESINIZ_BURAYA");
                mail.To.Add(request.Email);
                mail.Subject = "TaskReport - Şifre Sıfırlama Kodu";
                mail.Body = $"Merhaba {user.FullName ?? user.Username},\n\nŞifrenizi sıfırlamak için onay kodunuz: {code}\n\nBu kod 5 dakika boyunca geçerlidir.";

                SmtpClient smtp = new SmtpClient("smtp.gmail.com", 587)
                {
                    Credentials = new NetworkCredential("MAIL_ADRESINIZ_BURAYA", "***************"),
                    EnableSsl = true
                };

                await smtp.SendMailAsync(mail);
            }
            catch (Exception)
            {
                return BadRequest("Mail gönderilirken bir hata oluştu.");
            }

            return Ok(new { Message = "Şifre sıfırlama kodu e-postanıza gönderildi." });
        }

        // 🔐 2. KODU DOĞRULAYIP YENİ ŞİFREYİ BELİRLEME
        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto request)
        {
            if (!_cache.TryGetValue($"reset_{request.Email}", out string savedCode) || savedCode != request.Code)
                return BadRequest("Girdiğiniz doğrulama kodu hatalı veya süresi dolmuş!");

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
            if (user == null) return BadRequest("Kullanıcı bulunamadı.");

            CreatePasswordHash(request.NewPassword, out byte[] passwordHash, out byte[] passwordSalt);
            user.PasswordHash = passwordHash;
            user.PasswordSalt = passwordSalt;

            await _context.SaveChangesAsync();
            _cache.Remove($"reset_{request.Email}");

            return Ok(new { Message = "Şifreniz başarıyla sıfırlandı! Yeni şifrenizle giriş yapabilirsiniz." });
        }


        [HttpPost("google-login")]
        public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginDto request)
        {
            try
            {
                // Google'dan gelen token'ı doğrula ve içindeki e-posta, isim gibi bilgileri çöz
                var payload = await GoogleJsonWebSignature.ValidateAsync(request.IdToken, new GoogleJsonWebSignature.ValidationSettings());

                // Bu e-posta bizde kayıtlı mı bak
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == payload.Email);

                if (user == null)
                {
                    // Kayıtlı değilse otomatik olarak yeni üyelik aç!
                    user = new User
                    {
                        Email = payload.Email,
                        Username = payload.Email.Split('@')[0] + new Random().Next(100, 999), // Benzersiz kullanıcı adı
                        FullName = payload.Name
                    };

                    // Rastgele bir şifre oluşturup veritabanına kaydediyoruz (Zaten Google ile girecek)
                    CreatePasswordHash(Guid.NewGuid().ToString(), out byte[] passwordHash, out byte[] passwordSalt);
                    user.PasswordHash = passwordHash;
                    user.PasswordSalt = passwordSalt;

                    _context.Users.Add(user);
                    await _context.SaveChangesAsync();
                }

                // Sistemimize giriş yapması için kendi Token'ımızı üretiyoruz
                string token = CreateToken(user);
                return Ok(new { Token = token, Message = "Google ile giriş başarılı!" });
            }
            catch (Exception)
            {
                return BadRequest("Google doğrulaması başarısız oldu.");
            }
        }

        public class SendOtpDto { public string Email { get; set; } = string.Empty; }
        public class RegisterDto { public string Name { get; set; } public string Email { get; set; } public string Username { get; set; } public string Password { get; set; } }
        public class RegisterWithCodeDto : RegisterDto { public string Code { get; set; } }
        public class UpdateProfileDto { public string Name { get; set; } public string Email { get; set; } public string Username { get; set; } public string Password { get; set; } public string? OtpCode { get; set; } }

        public class ForgotPasswordDto { public string Email { get; set; } = string.Empty; }
        public class ResetPasswordDto { public string Email { get; set; } = string.Empty; public string Code { get; set; } = string.Empty; public string NewPassword { get; set; } = string.Empty; }

        public class GoogleLoginDto { public string IdToken { get; set; } = string.Empty; }
    }
}