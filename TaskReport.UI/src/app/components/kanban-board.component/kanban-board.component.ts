import { Component, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { ScrollingModule } from '@angular/cdk/scrolling'; 
import { FileService } from '../../services/file'; // veya file.service (dosya adına göre)

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [CommonModule, DragDropModule, ScrollingModule],
  templateUrl: './kanban-board.component.html',
  styleUrl: './kanban-board.component.css'
})
export class KanbanBoardComponent {
  @Input() backlogTasks: any[] = [];
  @Input() todoTasks: any[] = [];
  @Input() devTasks: any[] = [];
  @Input() qaTasks: any[] = [];
  @Input() doneTasks: any[] = [];
  @Input() teamMembers: any[] = []; 
  @Input() boardColumns: any[] = [];
  
  selectedFile: File | null = null;
  uploadedFileUrl: string = '';
  isUploading: boolean = false;

  @Output() taskDropped = new EventEmitter<CdkDragDrop<any[]>>();
  @Output() editTask = new EventEmitter<any>();
  @Output() deleteTask = new EventEmitter<any>();
  @Output() addTask = new EventEmitter<void>(); 
  @Output() openDetail = new EventEmitter<any>(); 

  // SERVİSİ CONSTRUCTOR İÇİNE ENJEKTE EDİYORUZ
  constructor(
    private fileService: FileService,
  private cdr: ChangeDetectorRef //
  ) {}

  // DOSYA SEÇİLDİĞİNDE TETİKLENEN METOT
  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.uploadSelectedFile();
      event.target.value = ''; // Input'u temizliyoruz ki aynı dosya tekrar seçilse de tetiklensin
    }
  }

  // MINIO'YA DOSYA YÜKLEYEN METOT
  uploadSelectedFile(): void {
    if (!this.selectedFile) return;

    this.isUploading = true;
    this.uploadedFileUrl = ''; // Eski linki temizle
    this.cdr.detectChanges();  // "Yükleniyor..." yazısını ekrana anında bas

    this.fileService.uploadFile(this.selectedFile).subscribe({
      next: (response) => {
        this.uploadedFileUrl = response.fileUrl;
        this.isUploading = false;
        this.selectedFile = null;
        this.cdr.detectChanges(); // EKRAMI ANINDA YENİLE (Yeşil başarı kutusu hemen görünecek)
        console.log('Dosya MinIO sunucusuna yüklendi:', response.fileUrl);
      },
      error: (err) => {
        console.error('Dosya yükleme hatası:', err);
        this.isUploading = false;
        this.cdr.detectChanges(); // Hata durumunda da ekranı anında yenile
      }
    });
  }

  getUrgencyText(endDateStr: string | null): string | null {
    if (!endDateStr) return null;
    
    const endDate = new Date(endDateStr);
    endDate.setHours(0, 0, 0, 0); 
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return '🚨 Gecikti';
    if (diffDays === 0 || diffDays === 1) return '⏳ Son Gün';
    if (diffDays === 2) return '⏳ Son 2 Gün';
    
    return null; 
  }

  getAssignee(assigneeId: any) {
    if (!assigneeId) return null;
    return this.teamMembers.find(m => (m.userId || m.UserId) == assigneeId);
  }

  getMemberName(assigneeId: any): string {
    const member = this.teamMembers.find(m => (m.userId || m.UserId) == assigneeId);
    if (!member) return '';
    
    return member.fullName || member.FullName || member.name || member.Name || member.userName || member.UserName || '';
  }

  getMemberInitials(assigneeId: any): string {
    const name = this.getMemberName(assigneeId);
    return name ? name[0].toUpperCase() : '';
  }

getTaskProgress(task: any): number {
    if (!task) return 0;
    
    // 🚨 1. Görev "Tamamlandı" durumundaysa (Status 4 veya isCompleted) DİREKT %100 göster
    const isDone = task.status === 4 || task.Status === 4 || task.isCompleted === true;
    if (isDone) {
      return 100;
    }
    
    // 🚨 2. Görev başka bir sekmeye çekilirse otomatik olarak alt görev yüzdesine geri döner
    const subtasks = task.subtasks || task.subTasks || task.SubTasks;
    
    if (!subtasks || !Array.isArray(subtasks) || subtasks.length === 0) {
      return 0;
    }
    
    const completedCount = subtasks.filter((st: any) => 
      st.isCompleted === true || 
      st.IsCompleted === true || 
      st.isCompleted === 'true' || 
      st.IsCompleted === 'true' ||
      st.isCompleted === 1 ||
      st.IsCompleted === 1
    ).length;

    return Math.round((completedCount / subtasks.length) * 100);
  }
  // Açıklama metninden "Ekli Dosya:" kısmını kesip temiz metni döndürür
  getCleanDescription(desc: string): string {
    if (!desc) return '';
    return desc.split('Ekli Dosya:')[0].trim();
  }

getAttachmentUrls(desc: string): string[] {
    if (!desc) return [];
    const parts = desc.split('\n\nEkli Dosya:');
    const urls = [];
    for (let i = 1; i < parts.length; i++) {
       urls.push(parts[i].trim());
    }
    return urls;
  }

  
  formatTime(hours: number): string {
    if (!hours || hours <= 0) return '0 dk';
    const totalMinutes = Math.round(hours * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hrs > 0 && mins > 0) return `${hrs} sa ${mins} dk`;
    if (hrs > 0) return `${hrs} sa`;
    return `${mins} dk`;
  }

  
}