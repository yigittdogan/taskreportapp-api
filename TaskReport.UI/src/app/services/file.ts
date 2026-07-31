import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UploadResponse {
  message: string;
  fileName: string;
  fileUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class FileService {
  private apiUrl = 'https://localhost:7167/api/File'; // Kendi API Portuna göre gerekirse güncelle

  constructor(private http: HttpClient) { }

  uploadFile(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.post<UploadResponse>(`${this.apiUrl}/upload`, formData);
  }
}