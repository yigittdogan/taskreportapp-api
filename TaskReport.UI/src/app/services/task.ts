import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  // Kendi local API adresine göre (Swagger'daki portla aynı olmalı) tam adresi yazıyoruz:
  private apiUrl = 'https://localhost:7167/api/Task'; 

  constructor(private http: HttpClient) {}

  getMyTasks(): Observable<any> {
    return this.http.get(this.apiUrl);
  }

  addTask(task: any) {
    return this.http.post(`https://localhost:7167/api/task`, task);
  }

  completeTask(id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/complete`, {});
  }

  updateTask(id: number, task: any) {
    return this.http.put(`https://localhost:7167/api/task/${id}`, task);
  }

  deleteTask(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

 // --- SUBTASK (ALT GÖREV) METOTLARI ---
  
  // DÜZELTME: 'Task/subtasks' yerine doğrudan 'subtasks' kullanıyoruz
getSubtasksByTaskId(taskId: number) {
    // apiUrl '/api/Task' ile bittiği için doğrudan domain üzerinden /api/subtasks'e atıyoruz
    return this.http.get(`https://localhost:7167/api/subtasks/task/${taskId}`);
  }

  // 2. Yeni alt görev ekle
  addSubtask(subtask: any) {
    return this.http.post(`https://localhost:7167/api/subtasks`, subtask);
  }

  // 3. Durum değiştir (Checkbox)
  toggleSubtask(id: number) {
    return this.http.put(`https://localhost:7167/api/subtasks/${id}/toggle`, {});
  }

  // 4. Alt görev sil
  deleteSubtask(id: number) {
    return this.http.delete(`https://localhost:7167/api/subtasks/${id}`);
  }

  // task.ts (Görev Servisi)
// task.ts İÇİNDEKİ METODU ŞU ŞEKİLDE DEĞİŞTİR:
getTaskActivities(taskId: number) {
  return this.http.get(`${this.apiUrl}/${taskId}/activities`);
}


// --- RAPOR İNDİRME METOTLARI ---
  exportTasksToExcel(teamId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/excel/${teamId}`, { responseType: 'blob' });
  }

  exportTasksToPdf(teamId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/pdf/${teamId}`, { responseType: 'blob' });
  }

  // --- YORUM METOTLARI ---
  getTaskComments(taskId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${taskId}/comments`);
  }

  addTaskComment(taskId: number, commentText: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${taskId}/comments`, { commentText });
  }

  // --- DİNAMİK SÜTUN METOTLARI ---
  getTeamColumns(teamId: number): Observable<any> {
    return this.http.get(`https://localhost:7167/api/KanbanColumns/team/${teamId}`);
  }

  createColumn(teamId: number, name: string): Observable<any> {
    return this.http.post(`https://localhost:7167/api/KanbanColumns`, { teamId, name });
  }

  updateColumn(columnId: number, name: string): Observable<any> {
    return this.http.put(`https://localhost:7167/api/KanbanColumns/${columnId}`, { name });
  }

  deleteColumn(columnId: number): Observable<any> {
    return this.http.delete(`https://localhost:7167/api/KanbanColumns/${columnId}`);
  }

  reorderColumns(columnIds: number[]): Observable<any> {
    return this.http.put(`https://localhost:7167/api/KanbanColumns/reorder`, columnIds);
  }

  // --- BİLDİRİM METOTLARI ---
  getMyNotifications(): Observable<any> {
    return this.http.get(`${this.apiUrl}/my-notifications`);
  }

  clearMyNotifications(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/my-notifications/clear`);
  }

  markNotificationsAsRead(): Observable<any> {
    return this.http.put(`${this.apiUrl}/my-notifications/mark-read`, {});
  }

  logWorkTime(taskId: number, hours: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${taskId}/log-time`, { hours });
  }

  resetWorkTime(taskId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${taskId}/reset-time`, {});
  }

  getMemberActivities(teamId: number, userId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/team/${teamId}/user/${userId}/activities`);
  }

}