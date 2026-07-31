using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using TaskReport.Core.Entities;
using TaskReport.Data;

namespace TaskReport.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class TeamController : ControllerBase
    {
        private readonly AppDbContext _context;

        public TeamController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost("create")]
        public async Task<IActionResult> CreateTeam([FromBody] CreateTeamDto request)
        {
            if (string.IsNullOrWhiteSpace(request.TeamName))
                return BadRequest("Takım adı boş olamaz!");

            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue("UserId") ?? User.FindFirstValue("sub");
            if (string.IsNullOrEmpty(userIdStr)) return Unauthorized("Token içinden kullanıcı kimliği okunamadı.");
            int realUserId = int.Parse(userIdStr);

            var team = new Team { Name = request.TeamName };
            _context.Teams.Add(team);
            await _context.SaveChangesAsync();

            var teamMember = new TeamMember
            {
                TeamId = team.Id,
                UserId = realUserId,
                // DÜZELTME BURADA: Takımı kuran kişi artık düz Admin değil, Founder (Kurucu) oluyor.
                Role = "Founder"
            };

            _context.TeamMembers.Add(teamMember);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Takım başarıyla oluşturuldu!", TeamId = team.Id });
        }

        [HttpGet("my-teams/{userId}")]
        public async Task<IActionResult> GetMyTeams(int userId)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue("UserId") ?? User.FindFirstValue("sub");
            if (string.IsNullOrEmpty(userIdStr)) return Unauthorized("Token içinden kullanıcı kimliği okunamadı.");
            int realUserId = int.Parse(userIdStr);

            // --- DÜZELTME: ESKİ TAKIMLARI OTOMATİK ONARMA SİSTEMİ ---
            // Kullanıcının takımlarını çek ve Kurucu eksikliği var mı bak.
            var userTeams = await _context.TeamMembers.Where(tm => tm.UserId == realUserId).Select(tm => tm.TeamId).ToListAsync();
            bool dbChanged = false;
            foreach (var tId in userTeams)
            {
                var hasFounder = await _context.TeamMembers.AnyAsync(tm => tm.TeamId == tId && tm.Role == "Founder");
                if (!hasFounder)
                {
                    // Eğer takım eski bir takımsa ve Kurucusu yoksa, takıma "İlk" katılan kişiyi Kurucu yap.
                    var firstMember = await _context.TeamMembers.Where(tm => tm.TeamId == tId).OrderBy(tm => tm.Id).FirstOrDefaultAsync();
                    if (firstMember != null)
                    {
                        firstMember.Role = "Founder";
                        dbChanged = true;
                    }
                }
            }
            // Değişiklik varsa veritabanını güncelle
            if (dbChanged) await _context.SaveChangesAsync();
            // ---------------------------------------------------------

            var myTeams = await _context.TeamMembers
                .Where(tm => tm.UserId == realUserId)
                .Join(_context.Teams,
                      tm => tm.TeamId,
                      t => t.Id,
                      (tm, t) => new
                      {
                          TeamId = t.Id,
                          TeamName = t.Name,
                          Role = tm.Role
                      })
                .ToListAsync();

            return Ok(myTeams);
        }

        [HttpPost("invite")]
        public async Task<IActionResult> InviteUser([FromBody] InviteUserDto request)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue("UserId") ?? User.FindFirstValue("sub");
            if (string.IsNullOrEmpty(userIdStr)) return Unauthorized("Giriş yapmalısınız.");
            int realUserId = int.Parse(userIdStr);

            if (string.IsNullOrWhiteSpace(request.InvitedEmail)) return BadRequest("Mail adresi gerekli.");

            var oldInvites = await _context.TeamInvitations
                .Where(i => i.TeamId == request.TeamId && i.InvitedEmail == request.InvitedEmail)
                .ToListAsync();
            if (oldInvites.Any()) { _context.TeamInvitations.RemoveRange(oldInvites); }

            var token = Guid.NewGuid().ToString("N");
            var invitation = new TeamInvitation
            {
                TeamId = request.TeamId,
                InviterUserId = realUserId,
                InvitedEmail = request.InvitedEmail,
                Token = token,
                IsAccepted = false,
                CreatedAt = DateTime.Now,
                ExpirationDate = DateTime.Now.AddDays(30)
            };

            _context.TeamInvitations.Add(invitation);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Davetiye oluşturuldu!", InviteLink = $"http://localhost:4200/accept-invitation?token={token}" });
        }

        [HttpPost("accept-invite")]
        public async Task<IActionResult> AcceptInvitation([FromBody] AcceptInviteDto request)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue("UserId") ?? User.FindFirstValue("sub");
            if (string.IsNullOrEmpty(userIdStr)) return Unauthorized("Giriş yapmalısınız.");
            int realUserId = int.Parse(userIdStr);

            if (string.IsNullOrEmpty(request.Token)) return BadRequest("Token gönderilmedi!");

            var invitation = await _context.TeamInvitations.FirstOrDefaultAsync(i => i.Token == request.Token);
            if (invitation == null) return BadRequest("Davet linki geçersiz.");

            // --- 1. DEĞİŞİKLİK BURADA: Önce "Zaten Üye Mi?" kontrolü yapıyoruz ---
            var isAlreadyMember = await _context.TeamMembers
                .AnyAsync(tm => tm.TeamId == invitation.TeamId && tm.UserId == realUserId);

            if (isAlreadyMember)
                return Ok(new { Message = "Zaten bu takımın üyesisiniz! Yönlendiriliyorsunuz...", TeamId = invitation.TeamId });

            // --- 2. Linkin geçerlilik kontrolleri (Sadece yeni üyeler bu aşamaya düşer) ---
            if (invitation.ExpirationDate < DateTime.Now) return BadRequest("Davet süresi dolmuş.");
            if (invitation.IsAccepted) return BadRequest("Bu davet linki zaten kullanılmış!");

            // İŞLEMİ GERÇEKLEŞTİR
            var newMember = new TeamMember
            {
                TeamId = invitation.TeamId,
                UserId = realUserId,
                Role = "Member" // İleride rütbe sistemini (3. Adım) buraya bağlayacağız
            };

            _context.TeamMembers.Add(newMember);
            invitation.IsAccepted = true;

            await _context.SaveChangesAsync();

            return Ok(new { Message = "Takıma başarıyla katıldınız!", TeamId = invitation.TeamId });
        }

        [HttpGet("members/{teamId}")]
        public async Task<IActionResult> GetTeamMembers(int teamId)
        {
            var members = await _context.TeamMembers
                .Where(tm => tm.TeamId == teamId)
                .Join(_context.Users,
                      tm => tm.UserId,
                      u => u.Id,
                      (tm, u) => new
                      {
                          UserId = u.Id,
                          UserName = u.Username,
                          FullName = u.FullName, // Artık gerçek veritabanı sütunundan çekiyoruz
                          Role = tm.Role
                      })
                .ToListAsync();

            return Ok(members);
        }

        [HttpPost("update-role")]
        public async Task<IActionResult> UpdateMemberRole([FromBody] UpdateRoleDto request)
        {
            // İsteği yapan (butona basan) kişinin kimliğini buluyoruz
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue("UserId") ?? User.FindFirstValue("sub");
            if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();
            int requesterId = int.Parse(userIdStr);

            var requester = await _context.TeamMembers.FirstOrDefaultAsync(tm => tm.TeamId == request.TeamId && tm.UserId == requesterId);
            var targetMember = await _context.TeamMembers.FirstOrDefaultAsync(tm => tm.TeamId == request.TeamId && tm.UserId == request.UserId);

            if (targetMember == null || requester == null) return NotFound("Üye bulunamadı.");

            // DÜZELTME BURADA: GÜVENLİK KURALLARI (Hiyerarşi)
            // 1. Kurucunun yetkisi KİMSE tarafından değiştirilemez.
            if (targetMember.Role == "Founder") return BadRequest("Kurucunun yetkisi değiştirilemez.");

            // 2. Bir Yönetici (Admin), sadece Üyelerle oynayabilir. Başka bir Admin'in yetkisini değiştiremez.
            if (requester.Role == "Admin" && targetMember.Role == "Admin") return BadRequest("Yöneticiler birbirlerinin yetkisini değiştiremez.");

            // Kuralları geçtiyse yetkiyi ver
            targetMember.Role = request.Role;
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Rol başarıyla güncellendi." });
        }

        [HttpPost("leave")]
        public async Task<IActionResult> LeaveTeam([FromBody] LeaveTeamDto request)
        {
            var member = await _context.TeamMembers
                .FirstOrDefaultAsync(tm => tm.TeamId == request.TeamId && tm.UserId == request.UserId);

            if (member == null) return BadRequest("Bu takımın üyesi değilsiniz.");

            _context.TeamMembers.Remove(member);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Takımdan başarıyla ayrıldınız." });
        }


        [HttpPost("remove-member")]
        public async Task<IActionResult> RemoveMember([FromBody] RemoveMemberDto request)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue("UserId") ?? User.FindFirstValue("sub");
            if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();
            int requesterId = int.Parse(userIdStr);

            var requester = await _context.TeamMembers.FirstOrDefaultAsync(tm => tm.TeamId == request.TeamId && tm.UserId == requesterId);
            var targetMember = await _context.TeamMembers.FirstOrDefaultAsync(tm => tm.TeamId == request.TeamId && tm.UserId == request.UserId);

            if (targetMember == null || requester == null) return NotFound("Üye bulunamadı.");

            if (targetMember.Role == "Founder") return BadRequest("Kurucu takımdan çıkarılamaz.");

            if (requester.Role == "Member") return BadRequest("Üye çıkarma yetkiniz yok.");

            if (requester.Role == "Admin" && targetMember.Role == "Admin") return BadRequest("Yöneticiler birbirlerini takımdan çıkaramaz.");

            _context.TeamMembers.Remove(targetMember);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Üye başarıyla takımdan çıkarıldı." });
        }

        // BU DTO'YU DA EN ALTTA BULUNAN DİĞER DTO'LARIN YANINA EKLE:
        public class RemoveMemberDto { public int TeamId { get; set; } public int UserId { get; set; } }


        public class UpdateRoleDto { public int TeamId { get; set; } public int UserId { get; set; } public string Role { get; set; } }
        public class LeaveTeamDto { public int TeamId { get; set; } public int UserId { get; set; } }
        public class CreateTeamDto { public string TeamName { get; set; } public int UserId { get; set; } }
        public class InviteUserDto { public int TeamId { get; set; } public int InviterUserId { get; set; } public string InvitedEmail { get; set; } }
        public class AcceptInviteDto { public string Token { get; set; } public int UserId { get; set; } }
    }
}