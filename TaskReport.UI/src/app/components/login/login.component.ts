import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth'; 

declare var google: any;
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent implements OnInit {
  username = '';
  password = '';

  registerName = '';
  registerEmail = ''; 
  registerUsername = '';
  registerPassword = '';

  // Şifremi Unuttum Değişkenleri
  isForgotPasswordMode = false;
  isForgotVerificationStep = false;
  forgotPasswordEmail = '';
  forgotPasswordCode = '';
  forgotPasswordNewPassword = '';

  isVerificationStep = false;
  verificationCode = '';
  isLoading = false; 

  isDarkTheme = false;
  isLoginMode: boolean = true; 

  constructor(
    private router: Router, 
    private authService: AuthService,
    private cdr: ChangeDetectorRef 
  ) {}

  ngOnInit() {
    const savedTheme = localStorage.getItem('theme');
    this.isDarkTheme = savedTheme === 'dark';
  }

  ngAfterViewInit() {
    this.renderGoogleButton();
  }

  renderGoogleButton() {
    setTimeout(() => {
      // Eğer Google scripti html'e yüklenmişse butonu çiz
      if (typeof google !== 'undefined') {
        google.accounts.id.initialize({
          client_id: '167096355604-8h2sjibgjannslh7jkimtpahqjb8fs5g.apps.googleusercontent.com', // 🚨 KENDİ KODUNU BURAYA YAPIŞTIR
          callback: this.handleGoogleSignIn.bind(this)
        });
        
        google.accounts.id.renderButton(
          document.getElementById("googleBtn"),
          { theme: this.isDarkTheme ? "filled_black" : "outline", size: "large", width: 350 }
        );
      } else {
        // Yüklenmediyse yarım saniye sonra tekrar dene
        setTimeout(() => this.renderGoogleButton(), 500);
      }
    }, 100);
  }

  // YENİ: GOOGLE'DAN CEVAP GELDİĞİNDE ÇALIŞACAK KISIM
// GOOGLE'DAN CEVAP GELDİĞİNDE ÇALIŞACAK KISIM
  handleGoogleSignIn(response: any) {
    this.isLoading = true;
    this.cdr.detectChanges();

    this.authService.googleLogin(response.credential).subscribe({
      next: (res: any) => {
        const token = res.token;
        localStorage.setItem('token', token);

        try {
          // 🚀 TOKEN'I DECODE EDİP USERID'Yİ LOCALSTORAGE'A KAYDEDİYORUZ
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(window.atob(base64));
          
          const userId = payload.sub 
                      || payload.nameid 
                      || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']
                      || payload.id;

          const username = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']
                        || payload.unique_name 
                        || payload.name 
                        || 'Google Kullanıcısı';

          if (userId) {
            // AuthGuard'ın aradığı kritik bilgileri yazıyoruz
            localStorage.setItem('userId', userId.toString());
            localStorage.setItem('loggedInUser', username);
            
            const pendingToken = localStorage.getItem('pendingInviteToken');
            
            if (pendingToken) {
              localStorage.removeItem('pendingInviteToken'); 
              window.location.href = '/accept-invitation?token=' + pendingToken;
            } else {
              // Artık güvenle Dashboard'a geçebiliriz!
              window.location.href = '/dashboard';
            }

          } else {
            console.error("Token'ın içinde ID bulunamadı:", payload);
            alert("Giriş yapıldı ama Token içinde kullanıcı ID'si bulunamadı!");
          }
        } catch (e) {
          console.error('Token decode hatası:', e);
          alert("Token decode edilemedi!");
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.cdr.detectChanges();
        alert("Hata: " + (err.error?.message || "Google ile giriş başarısız oldu."));
      }
    });
  }

  
  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;
    localStorage.setItem('theme', this.isDarkTheme ? 'dark' : 'light');
    this.cdr.detectChanges();
  }

  toggleMode() {
    this.isLoginMode = !this.isLoginMode;
    this.isForgotPasswordMode = false; // Mod değişince şifre sıfırlamayı kapat
    this.cdr.detectChanges();
  }

  toggleForgotPassword() {
    this.isForgotPasswordMode = true;
    this.isLoginMode = false;
    this.isForgotVerificationStep = false;
    this.forgotPasswordEmail = '';
    this.forgotPasswordCode = '';
    this.forgotPasswordNewPassword = '';
    this.cdr.detectChanges();
  }

  cancelForgotPassword() {
    this.isForgotPasswordMode = false;
    this.isLoginMode = true;
    this.cdr.detectChanges();
  }

  // --- ŞİFREMİ UNUTTUM İŞLEMLERİ ---
  onForgotPasswordStart() {
    if (!this.forgotPasswordEmail.trim()) {
      alert("Lütfen e-posta adresinizi girin!");
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    this.authService.sendForgotPasswordOtp(this.forgotPasswordEmail).subscribe({
      next: () => {
        this.isLoading = false;
        this.isForgotVerificationStep = true;
        this.cdr.detectChanges();
        alert("Şifre sıfırlama kodu e-postanıza gönderildi!");
      },
      error: (err) => {
        this.isLoading = false;
        this.cdr.detectChanges();
        alert("Hata: " + (err.error?.message || "Mail gönderilemedi.")); 
      }
    });
  }

  onResetPassword() {
    if (!this.forgotPasswordCode || !this.forgotPasswordNewPassword) {
      alert("Lütfen kodu ve yeni şifrenizi girin!");
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    this.authService.resetPassword(this.forgotPasswordEmail, this.forgotPasswordCode, this.forgotPasswordNewPassword).subscribe({
      next: () => {
        this.isLoading = false;
        alert("Şifreniz başarıyla değiştirildi! Şimdi giriş yapabilirsiniz.");
        this.cancelForgotPassword(); 
      },
      error: (err) => {
        this.isLoading = false;
        this.cdr.detectChanges();
        alert("Hata: " + (err.error?.message || "Şifre sıfırlanamadı."));
      }
    });
  }

  // --- KAYIT OL İŞLEMLERİ ---
  onRegisterStart() {
    if (!this.registerName.trim() || !this.registerEmail.trim() || !this.registerUsername.trim() || !this.registerPassword.trim()) {
      alert("Lütfen tüm alanları doldurun!");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.registerEmail)) {
      alert("Lütfen geçerli bir e-posta adresi girin!");
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges(); 

    const userData = {
      name: this.registerName,
      email: this.registerEmail,
      username: this.registerUsername,
      password: this.registerPassword
    };

    this.authService.sendVerificationCode(userData).subscribe({
      next: () => {
        this.isLoading = false;
        this.isVerificationStep = true; 
        this.cdr.detectChanges(); 
        alert("Doğrulama kodu e-posta adresinize gönderildi!");
      },
      error: (err) => {
        this.isLoading = false;
        this.cdr.detectChanges(); 
        const errorMessage = err.error?.message || err.error || "Mail gönderilemedi.";
        alert("Hata: " + errorMessage); 
      }
    });
  }

  onVerifyAndRegister() {
    if (!this.verificationCode || this.verificationCode.length !== 6) {
      alert("Lütfen 6 haneli doğrulama kodunu eksiksiz girin!");
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    const userData = {
      name: this.registerName,
      email: this.registerEmail,
      username: this.registerUsername,
      password: this.registerPassword
    };

    this.authService.registerWithVerification(userData, this.verificationCode).subscribe({
      next: () => {
        this.isLoading = false;
        this.cdr.detectChanges();

        alert("Kayıt işlemi başarılı! 🎉 Şimdi giriş yapabilirsiniz.");
        this.registerName = ''; this.registerEmail = ''; 
        this.registerUsername = ''; this.registerPassword = '';
        this.verificationCode = ''; this.isVerificationStep = false;
        this.toggleMode(); 
      },
      error: (err) => {
        this.isLoading = false;
        this.cdr.detectChanges();
        const errorMessage = err.error?.message || err.error || "Doğrulama başarısız.";
        alert("Hata: " + errorMessage);
      }
    });
  }

  cancelVerification() {
    this.isVerificationStep = false;
    this.verificationCode = '';
    this.cdr.detectChanges();
  }

  // --- GİRİŞ YAP İŞLEMLERİ ---
  onLogin() {
    if (!this.username.trim() || !this.password.trim()) {
      alert("Lütfen kullanıcı adı ve şifre alanlarını doldurun!");
      return;
    }

    this.authService.login({ username: this.username, password: this.password }).subscribe({
      next: (response: any) => {
        const token = response.token;
        localStorage.setItem('token', token);
        localStorage.setItem('loggedInUser', this.username); 

        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(window.atob(base64));
          
          const userId = payload.sub 
                      || payload.nameid 
                      || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']
                      || payload.id;

          if (userId) {
            localStorage.setItem('userId', userId.toString());
            
            const pendingToken = localStorage.getItem('pendingInviteToken');
            
            if (pendingToken) {
              localStorage.removeItem('pendingInviteToken'); 
              window.location.href = '/accept-invitation?token=' + pendingToken;
            } else {
              window.location.href = '/dashboard';
            }

          } else {
            console.error("Token'ın içinde ID bulunamadı. Payload içeriği:", payload);
            alert("Giriş yapıldı ama Token içinde kullanıcı ID'si bulunamadı!");
          }
        } catch (e) {
          console.error('Token decode hatası:', e);
          alert("Token decode edilemedi!");
        }
      },
      error: (err) => {
        console.error('Giriş hatası:', err);
        alert('Giriş başarısız!');
      }
    });
  }
}