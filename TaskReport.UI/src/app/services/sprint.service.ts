import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SprintService {
  private apiUrl = 'https://localhost:7167/api/Sprint'; // Kendi backend portun ile kontrol et

  constructor(private http: HttpClient) {}

  // 1. Takımın Sprintlerini ve Backlog Görevlerini Getir
  getTeamSprintsAndBacklog(teamId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/team/${teamId}`);
  }

  // 2. Yeni Sprint Oluştur
  createSprint(sprintDto: any): Observable<any> {
    return this.http.post(`${this.apiUrl}`, sprintDto);
  }

  // 3. Sprint Başlat
  startSprint(sprintId: number, userId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${sprintId}/start?userId=${userId}`, {});
  }

  // 4. Sprint Tamamla (Atomik Transaction)
  completeSprint(sprintId: number, completeDto: any, userId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${sprintId}/complete?userId=${userId}`, completeDto);
  }

  // 5. Görevi Backlog <-> Sprint Arasında Taşı (Drag & Drop)
  moveTask(taskId: number, moveDto: any, userId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/move-task/${taskId}?userId=${userId}`, moveDto);
  }

  deleteSprint(sprintId: number): Observable<any> {
  return this.http.delete(`${this.apiUrl}/${sprintId}`);
}

}