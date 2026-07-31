import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TeamService } from '../../services/team'; 
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-accept-invite',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="login-wrapper">
      <div class="glass-card">
        <div class="login-header">
          <div class="icon-glow">🤝</div>
          <h2>Takım Daveti</h2>
          
          <!-- DÜZELTME: Karşılama mesajı artık normal renkte. Sadece hata varsa kırmızı yanacak. -->
          <p class="subtitle" *ngIf="!isSuccess && !isLoading && !isError">
            {{ message }}
          </p>
          <p class="subtitle success-text" *ngIf="isSuccess">
            {{ message }}
          </p>
          <p class="subtitle error-text" *ngIf="isError">
            {{ message }}
          </p>
        </div>

        <div *ngIf="isLoading" class="loader-container">
          <div class="spinner"></div>
          <p class="loading-text">İşlem yapılıyor, lütfen bekle...</p>
        </div>

        <div class="login-form" *ngIf="!isLoading && !isSuccess">
          <button (click)="onJoinClick()" class="btn-primary">Takıma Katıl</button>
          <button (click)="goToLogin()" class="btn-secondary">Giriş Yap / Değiştir</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Login ekranındaki birebir aynı arka plan ve font ayarları */
    .login-wrapper {
      font-family: "Nunito", sans-serif;
      background: linear-gradient(-225deg, #2cd8d5 0%, #c5c1ff 56%, #ffbac3 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }

    /* Gerçek Glassmorphism (Buzlu Cam) Kartı */
    .glass-card {
      background: rgba(255, 255, 255, 0.45);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 2.5px solid rgba(255, 255, 255, 0.6);
      border-radius: 20px;
      padding: 40px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
      text-align: center;
    }

    .login-header { margin-bottom: 25px; }
    .icon-glow { font-size: 55px; margin-bottom: 10px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1)); }
    h2 { margin: 0 0 8px 0; color: #1e293b; font-size: 28px; font-weight: 800; }
    .subtitle { color: #475569; font-size: 15px; font-weight: 600; line-height: 1.5; margin: 0; }
    
    /* Hata ve Başarı Renkleri (Artık karşılama yazısı kırmızı olmayacak) */
    .success-text { color: #047857; background: rgba(16, 185, 129, 0.15); padding: 10px; border-radius: 8px; border: 1px solid rgba(16,185,129,0.3); }
    .error-text { color: #b91c1c; background: rgba(239, 68, 68, 0.15); padding: 10px; border-radius: 8px; border: 1px solid rgba(239,68,68,0.3); }

    .login-form { display: flex; flex-direction: column; gap: 12px; }

    /* Login ekranındaki şık mavi buton */
    .btn-primary {
      width: 100%;
      padding: 14px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 12px;
      font-weight: 700;
      font-size: 15px;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
    }
    .btn-primary:hover { background: #1d4ed8; transform: translateY(-2px); }

    /* İkincil buton (Giriş yap / Değiştir) */
    .btn-secondary {
      width: 100%;
      padding: 14px;
      background: rgba(255, 255, 255, 0.6);
      color: #1e293b;
      border: 1.5px solid rgba(255, 255, 255, 0.8);
      border-radius: 12px;
      font-weight: 700;
      font-size: 15px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-secondary:hover { background: white; transform: translateY(-2px); }

    .loader-container { display: flex; flex-direction: column; align-items: center; margin: 20px 0; }
    .spinner { border: 3px solid rgba(255,255,255,0.5); border-top: 3px solid #2563eb; border-radius: 50%; width: 28px; height: 28px; animation: spin 1s linear infinite; margin-bottom: 12px; }
    .loading-text { color: #475569; font-weight: 700; font-size: 14px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  `]
})
export class AcceptInviteComponent implements OnInit {
  isLoading = false;
  message = 'Seni takımda görmek için sabırsızlanıyoruz! Katıl butonuna basarak işlemini tamamla.';
  isSuccess = false;
  isError = false; // YENİ: Kırmızı arka planı sadece gerçekten hata varsa göstermek için

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private teamService: TeamService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token');
    const userId = localStorage.getItem('userId');

    if (!userId) {
      if (token) {
        localStorage.setItem('pendingInviteToken', token);
        this.router.navigate(['/login']);
      } else {
        this.message = 'Davet linki bulunamadı.';
        this.isError = true;
      }
      return;
    }
  }

  onJoinClick() {
    const token = this.route.snapshot.queryParamMap.get('token');
    const userId = localStorage.getItem('userId');

    if (!token) {
        this.message = 'Hata: URL\'de token yok!';
        this.isError = true;
        return;
    }
    if (!userId) {
        this.message = 'Hata: Kullanıcı girişi yapılmamış! (localStorage boş)';
        this.isError = true;
        return;
    }

    this.isLoading = true;
    this.isError = false;
    this.cdr.detectChanges(); 

    this.teamService.acceptInvite(token, Number(userId)).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.isSuccess = true;
        this.isError = false;
        this.message = 'Başarılı! Artık takımın bir parçasısın. Dashboard\'a yönlendiriliyorsun...';
        this.cdr.detectChanges(); 
        setTimeout(() => { window.location.href = '/dashboard'; }, 2000);
      },
      error: (err: any) => {
        this.isLoading = false;
        this.isSuccess = false;
        this.isError = true;
        this.message = 'Bir hata oluştu: ' + (err.error?.message || 'Lütfen tekrar dene.');
        this.cdr.detectChanges(); 
      }
    });
  }

  goToLogin() { 
    this.router.navigate(['/login']); 
  }
}