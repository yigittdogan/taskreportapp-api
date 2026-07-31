import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TeamService {
  private apiUrl = 'https://localhost:7167/api/team'; 

  constructor(private http: HttpClient) { }

  // 1. DÜZELTME: Token'ı güvenli ve standart formata çeviren yardımcı fonksiyon
  private getAuthOptions() {
    const token = localStorage.getItem('token') || '';
    return {
      headers: new HttpHeaders({
        'Authorization': `Bearer ${token}`
      })
    };
  }

  getMyTeams(userId: number) {
    // getAuthOptions() çağrılarak token kesin olarak isteğe ekleniyor
    return this.http.get(`${this.apiUrl}/my-teams/${userId}`, this.getAuthOptions());
  }

  createTeam(teamName: string, userId: number): Observable<any> {
    const body = { teamName: teamName, userId: userId };
    return this.http.post(`${this.apiUrl}/create`, body, this.getAuthOptions());
  }

  inviteUser(teamId: number, inviterUserId: number, email: string) {
    const body = { teamId: teamId, inviterUserId: inviterUserId, invitedEmail: email };
    return this.http.post(`${this.apiUrl}/invite`, body, this.getAuthOptions());
  }

  // team.ts içindeki acceptInvite metodunu bununla değiştir:
  acceptInvite(token: string, userId: number) {
    const body = { token: token, userId: userId };
    
    // getAuthOptions() fonksiyonunu kullanarak tarayıcıdaki güncel JWT token'ı isteğe ekliyoruz!
    return this.http.post(`${this.apiUrl}/accept-invite`, body, this.getAuthOptions());
  }

  getTeamMembers(teamId: number) {
    // Mevcut http istek yapına göre (this.http.get veya bu dosyadaki tanımlı baseUrl hangisiyse ona göre çalışır)
    return this.http.get(`https://localhost:7167/api/team/members/${teamId}`);
  }

  updateMemberRole(teamId: number, userId: number, role: string) {
    return this.http.post(`https://localhost:7167/api/team/update-role`, { teamId, userId, role });
  }

  leaveTeam(teamId: number, userId: number) {
    return this.http.post(`https://localhost:7167/api/team/leave`, { teamId, userId });
  }

  removeMember(teamId: number, userId: number) {
    return this.http.post(`https://localhost:7167/api/team/remove-member`, { teamId, userId });
  }
}