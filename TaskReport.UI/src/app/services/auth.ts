import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Swagger'da gördüğümüz o adres
  private apiUrl = 'https://localhost:7167/api/Auth';

  constructor(private http: HttpClient) {}

  register(userData: any): Observable<any> {
    // POST /api/Auth/register
    return this.http.post(`${this.apiUrl}/register`, userData);
  }

// 1. Doğrulama kodu gönderme isteği
  sendVerificationCode(userData: any) {
    return this.http.post(`https://localhost:7167/api/auth/send-verification`, userData);
  }

  // 2. Kod ile birlikte kaydı tamamlama isteği
  registerWithVerification(userData: any, code: string) {
    return this.http.post(`https://localhost:7167/api/auth/register-with-verification`, { ...userData, code });
  }

  login(userData: any): Observable<any> {
    // POST /api/Auth/login
    return this.http.post(`${this.apiUrl}/login`, userData);
  }

  // Profil Bilgilerini Getir
  getProfile() {
    return this.http.get(`https://localhost:7167/api/auth/profile`);
  }

  // Profili Güncelle
  updateProfile(userData: any) {
    return this.http.put(`https://localhost:7167/api/auth/profile/update`, userData);
  }

  // Hesabı Kalıcı Olarak Sil
 // Hesabı Kalıcı Olarak Sil (Şifre Korumalı)
  deleteAccount(password: string) {
    return this.http.post(`https://localhost:7167/api/auth/delete-account`, { password });
  }

  // 📧 E-Posta Onay Kodu (OTP) İsteme Metodu
  sendOtpToEmail(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/send-otp`, { email });
  }

  // Şifre sıfırlama kodu talep etme
  sendForgotPasswordOtp(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/forgot-password`, { email });
  }

  // Yeni şifreyi onaylama ve kaydetme
  resetPassword(email: string, code: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/reset-password`, { email, code, newPassword });
  }

  // Google ile Giriş Yap
  googleLogin(idToken: string) {
    return this.http.post(`${this.apiUrl}/google-login`, { idToken });
  }

  
}