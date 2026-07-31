import { Component, OnInit, Output, EventEmitter, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile-settings.component.html',
  styleUrl: './profile-settings.component.css',
  encapsulation: ViewEncapsulation.None // 🚀 İŞTE TÜM MODAL CSS'LERİNİ SERBEST BIRAKAN SATIR
})
export class ProfileSettingsComponent implements OnInit {
  userProfile = { name: '', email: '', username: '', password: '' };
  confirmPassword = '';
  isProfileLoading: boolean = false;
  isDeleteModalOpen: boolean = false;
  deleteConfirmPassword = '';

  // E-POSTA DOĞRULAMA (OTP) DEĞİŞKENLERİ
  isOtpModalOpen: boolean = false;
  otpCode: string = '';
  isOtpLoading: boolean = false;

  @Output() toastMessageEvent = new EventEmitter<{message: string, type: 'success' | 'error'}>();
  @Output() logoutEvent = new EventEmitter<void>();

  constructor(private authService: AuthService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadProfile();
  }

  showToast(message: string, type: 'success' | 'error') {
    this.toastMessageEvent.emit({ message, type });
  }

  loadProfile() {
    this.authService.getProfile().subscribe({
      next: (res: any) => {
        this.userProfile.name = res.name || res.Name || res.fullName || res.FullName || '';
        this.userProfile.email = res.email || res.Email || '';
        this.userProfile.username = res.username || res.Username || res.userName || res.UserName || '';
        this.cdr.detectChanges(); 
      },
      error: () => this.showToast('Profil bilgileri alınamadı.', 'error')
    });
  }

  saveProfile() {
    if (this.userProfile.password && this.userProfile.password.trim() !== '') {
      if (this.userProfile.password !== this.confirmPassword) {
        this.showToast('Girdiğiniz şifreler birbiriyle eşleşmiyor!', 'error');
        return;
      }
      this.requestOtpAndOpenModal();
      return; 
    }
    this.executeSaveProfile();
  }

  requestOtpAndOpenModal() {
    this.isProfileLoading = true;
    this.authService.sendOtpToEmail(this.userProfile.email).subscribe({
      next: () => {
        this.isProfileLoading = false;
        this.isOtpModalOpen = true;
        this.otpCode = ''; 
        this.showToast('E-postanıza bir doğrulama kodu gönderildi!', 'success');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isProfileLoading = false;
        this.showToast('Mail gönderilemedi. Lütfen e-posta adresinizi kontrol edin.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  verifyOtpAndSave() {
    if (!this.otpCode || this.otpCode.trim().length < 4) {
      this.showToast('Lütfen geçerli bir doğrulama kodu girin.', 'error');
      return;
    }

    this.isOtpLoading = true;
    const payload = {
      ...this.userProfile,
      otpCode: this.otpCode
    };

    this.authService.updateProfile(payload).subscribe({
      next: () => {
        this.isOtpLoading = false;
        this.isOtpModalOpen = false;
        this.showToast('Şifreniz başarıyla değiştirildi ve profil güncellendi!', 'success');
        localStorage.setItem('loggedInUser', this.userProfile.username);
        this.userProfile.password = '';
        this.confirmPassword = '';
        this.otpCode = '';
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isOtpLoading = false;
        this.showToast(err.error?.message || 'Doğrulama kodu hatalı veya işlem başarısız!', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  closeOtpModal() {
    this.isOtpModalOpen = false;
    this.otpCode = '';
    this.cdr.detectChanges();
  }

  executeSaveProfile() {
    this.isProfileLoading = true;
    this.authService.updateProfile(this.userProfile).subscribe({
      next: () => {
        this.isProfileLoading = false;
        this.showToast('Profil başarıyla güncellendi!', 'success');
        localStorage.setItem('loggedInUser', this.userProfile.username);
        this.userProfile.password = ''; 
        this.confirmPassword = '';
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isProfileLoading = false;
        this.showToast(err.error?.message || 'Profil güncellenirken hata oluştu.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  openDeleteModal() {
    this.isDeleteModalOpen = true;
    this.deleteConfirmPassword = '';
    this.cdr.detectChanges();
  }

  closeDeleteModal() {
    this.isDeleteModalOpen = false;
    this.deleteConfirmPassword = '';
    this.cdr.detectChanges();
  }

  confirmDeleteAccount() {
    if (!this.deleteConfirmPassword) {
      this.showToast('Lütfen devam etmek için şifrenizi girin.', 'error');
      return;
    }

    this.authService.deleteAccount(this.deleteConfirmPassword).subscribe({
      next: () => {
        this.showToast('Hesabınız başarıyla silindi. Yönlendiriliyorsunuz...', 'success');
        this.closeDeleteModal();
        setTimeout(() => { this.logoutEvent.emit(); }, 1500);
      },
      error: (err: any) => {
        this.showToast(err.error?.message || 'Hesap silinirken bir hata oluştu.', 'error');
      }
    });
  }
}