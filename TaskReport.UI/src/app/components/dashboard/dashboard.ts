import { Component, OnInit, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router'; 
import { TaskService } from '../../services/task';
import { TeamService } from '../../services/team';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, moveItemInArray, transferArrayItem, DragDropModule } from '@angular/cdk/drag-drop';
import { ProfileSettingsComponent } from '../profile-settings/profile-settings.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { KanbanBoardComponent } from '../kanban-board.component/kanban-board.component';
import { FileService } from '../../services/file'; 
import * as signalR from '@microsoft/signalr';
import Chart from 'chart.js/auto';
import { ChatService } from '../../services/chat.service'; 
import { SprintService } from '../../services/sprint.service'; 

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, ProfileSettingsComponent, SidebarComponent, KanbanBoardComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  encapsulation: ViewEncapsulation.None
})
export class DashboardComponent implements OnInit {
activeTab: 'board' | 'stats' | 'profile' | 'calendar' | 'backlog' = 'board';
  todoTasks: any[] = [];
  doneTasks: any[] = [];
  teams: any[] = [];
  currentTeamId: any = null;
  backlogTasks: any[] = [];
  devTasks: any[] = [];
  qaTasks: any[] = [];
  
  // UI Durumları
  currentDate: Date = new Date();
  calendarDays: any[] = [];
  weekDays: string[] = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  calendarZoom: number = 0.9; 
  isDarkTheme: boolean = false;
  isSidebarCollapsed: boolean = false;
  userName: string = ''; 
  toastMessage: string = '';
  toastType: 'success' | 'error' = 'success';
  toastTimeout: any;
  isConfirmModalOpen: boolean = false;
  taskToDeleteId: any = null;
  isTeamModalOpen: boolean = false;
  newTeamName: string = '';
  isInviteModalOpen: boolean = false;
  generatedInviteLink: string = '';
  isMembersModalOpen: boolean = false;
  teamMembers: any[] = [];
  currentUserRole: string = 'Member';
  isDetailModalOpen: boolean = false;
  selectedTask: any = null;

  // DOSYA YÜKLEME (MINIO) DEĞİŞKENLERİ
  selectedFile: File | null = null;
  uploadedFileUrl: string = '';
  isUploading: boolean = false;

  // Görev Formu
  isAddingTask: boolean = false;
  editingTask: any = null;
  newTaskTitle: string = '';
  newTaskDescription: string = '';
  newTaskStartDate: string = '';
  newTaskEndDate: string = '';
  newTaskPriority: string = 'Normal';
  newTaskEstimatedHours: number = 0; 
  newTaskType: number = 0; 
  newTaskStatus: number = 0; 
  newSubtaskTitle: string = '';

  taskComments: any[] = [];
  newCommentText: string = '';


  // ARAMA VE FİLTRELEME DEĞİŞKENLERİ
  searchTerm: string = '';

  isFilterDropdownOpen: boolean = false;

  // DİNAMİK SÜTUN DEĞİŞKENLERİ
  boardColumns: any[] = [];
  isColumnModalOpen: boolean = false;
  newColumnName: string = '';

  // ⏱️ ZAMAN TAKİBİ DEĞİŞKENLERİ
  manualHoursToLog: number = 0;
  isTimerRunning: boolean = false;
  timerInterval: any;
  timerSeconds: number = 0;

  // 🏷️ ETİKET (TAGS) DEĞİŞKENLERİ
  availableTagColors: string[] = ['#ef4444', '#f97316', '#facc15', '#10b981', '#38bdf8', '#6366f1', '#d946ef', '#64748b'];
  newTaskTags: any[] = [];
  newTagName: string = '';
  newTagColor: string = '#38bdf8'; 

  // 👨‍💻 ÜYE PERFORMANS RAPORU DEĞİŞKENLERİ
  selectedStatMemberId: any = '';
  selectedStatMemberTasks: any[] = [];
  selectedStatMemberActivities: any[] = [];

  // ÇOKLU DOSYA VE DAKİKA DEĞİŞKENLERİ
  uploadedFiles: string[] = []; // Artık dizi (Birden fazla dosya için)
  newTaskEstimatedMinutes: number = 0; // Saat yerine Dakika


  isChatOpen = false;
  chatActiveTab: 'contacts' | 'messages' = 'contacts'; // Sekme kontrolü
  selectedContact: any = null;
  newMessage = '';
  chatMessages: any[] = [];
  recentChats: any[] = [];
  unreadChatCount: number = 0; // 🚀 YENİ: Okunmamış sohbet bildirim rozeti
 


  // SPRINT & BACKLOG DEĞİŞKENLERİ
sprints: any[] = [];
backlogTasksList: any[] = [];
isCreateSprintModalOpen: boolean = false;
newSprintName: string = '';
newSprintGoal: string = '';
newSprintStartDate: string = '';
newSprintEndDate: string = '';

// SPRINT TAMAMLAMA MODALI DEĞİŞKENLERİ
isCompleteSprintModalOpen: boolean = false;
sprintToCompleteId: number | null = null;
incompleteTaskDestination: 'Backlog' | 'NextSprint' = 'Backlog';
targetNextSprintId: number | null = null;
activeSprintName: string | null = null;
showCompletedSprints: boolean = false;


  toggleFilterDropdown(): void {
    this.isFilterDropdownOpen = !this.isFilterDropdownOpen;
    // Eğer filtre menüsünü açıyorsak bildirim menüsünü kapatalım (üst üste binmesinler)
    if (this.isFilterDropdownOpen) {
      this.isNotificationDropdownOpen = false;
    }
    this.cdr.detectChanges();
  }
  filterPriority: string = '';
  filterAssignee: any = '';

  constructor(
    private router: Router, 
    private taskService: TaskService, 
    private teamService: TeamService,
    private fileService: FileService, 
    private cdr: ChangeDetectorRef, 
    private chatService: ChatService,
    private sprintService: SprintService 
  ) {}

ngOnInit() {
  // 🚀 HESABA ÖZEL DİNAMİK ÇÖZÜCÜYÜ ÇAĞIRIYORUZ
  this.updateSidebarUserName();

  const userId = localStorage.getItem('userId');
  if (!userId) { this.router.navigate(['/login']); return; }
  
  this.currentTeamId = localStorage.getItem('selectedTeamId');
  
  this.loadTeams();
  if (this.currentTeamId) { 
      this.loadTasks(); 
      this.loadTeamMembers(); 
  }

  this.chatService.startConnection(userId);

  this.chatService.onMessageReceived$.subscribe(msg => {
    const sender = msg.senderId || msg.SenderId;
    if (sender !== this.currentUserId) {
      const activeContactId = this.selectedContact ? (this.selectedContact.userId || this.selectedContact.UserId) : null;
      
      if (!this.isChatOpen || activeContactId !== sender) {
        this.unreadChatCount++;
        const targetUser = this.teamMembers.find(m => (m.userId || m.UserId) === sender);
        if (targetUser) {
          targetUser.hasUnread = true;
        }
        this.extractRecentChats();
        this.cdr.detectChanges();
      }
    }
  });

  // ==========================================
  // 🔔 2. MEVCUT KISIM: BİLDİRİM SIGNALR BAĞLANTISI
  // ==========================================
  const connection = new signalR.HubConnectionBuilder()
    .withUrl('https://localhost:7167/notificationHub') 
    .withAutomaticReconnect() 
    .build();
    
  // BACKEND'DEN "ReceiveNotification" DİYE FIRLATILAN MESAJI YAKALA
  connection.on("ReceiveNotification", (actionType: any, actionUserId: any, assigneeId: any, taskTitle: string, customMessage: string) => {
      this.processIncomingNotification(actionType, actionUserId, assigneeId, taskTitle, customMessage);
      
      // Sayı / Metin çakışmasını engellemek için Number() ile zorunlu dönüştürüyoruz
      if (Number(actionUserId) !== Number(this.currentUserId)) {
        this.loadTasks(); 
      }
  });

  // BAĞLANTIYI BAŞLAT
  connection.start()
    .then(() => console.log('🟢 SignalR Canlı Bildirim Ağına Bağlanıldı!'))
    .catch(err => console.error('🔴 SignalR Bağlantı Hatası: ', err));


  // ==========================================
  // 📊 MEVCUT KISIM: ARKA PLANDA İLERLEME ÇUBUKLARINI DOLDURMA
  // ==========================================
  setTimeout(() => {
    const allTasks = [
      ...(this.backlogTasks || []), 
      ...(this.todoTasks || []), 
      ...(this.devTasks || []), 
      ...(this.qaTasks || []), 
      ...(this.doneTasks || [])
    ];
    
    allTasks.forEach(task => {
      const taskId = task.id || task.Id;
      if (taskId) {
        this.taskService.getSubtasksByTaskId(taskId).subscribe({
          next: (data: any) => {
            task.subtasks = data; 
            this.cdr.detectChanges(); 
          },
          error: () => {} 
        });
      }
    });
  }, 500); 

  this.loadStoredNotifications();
}


  // --- İSTATİSTİK HESAPLAMALARI ---
  get totalActiveTasks(): number { return this.todoTasks.length + this.devTasks.length + this.qaTasks.length; }
  get totalCompletedTasks(): number { return this.doneTasks.length; }
  get totalTasks(): number { return this.backlogTasks.length + this.todoTasks.length + this.devTasks.length + this.qaTasks.length + this.doneTasks.length; }
  get completionPercentage(): number {
    if (this.totalTasks === 0) return 0;
    return Math.round((this.totalCompletedTasks / this.totalTasks) * 100);
  }
  get mostFrequentPriority(): string {
    const allTasks = [...this.todoTasks, ...this.doneTasks];
    if (allTasks.length === 0) return '-';
    const counts: { [key: string]: number } = {};
    let maxCount = 0;
    let mostFrequent = '-';
    for (const task of allTasks) {
      const p = task.priority || 'Normal';
      counts[p] = (counts[p] || 0) + 1;
      if (counts[p] > maxCount) { maxCount = counts[p]; mostFrequent = p; }
    }
    return mostFrequent;
  }

  // --- Temel Metotlar ---
  get currentUserId(): number { return Number(localStorage.getItem('userId')); }
  toggleSidebar() { this.isSidebarCollapsed = !this.isSidebarCollapsed; this.cdr.detectChanges(); }
  toggleTheme() { this.isDarkTheme = !this.isDarkTheme; localStorage.setItem('theme', this.isDarkTheme ? 'dark' : 'light'); this.cdr.detectChanges(); }
  logout() { localStorage.clear(); this.router.navigate(['/login']); }
  
  showToast(message: string, type: 'success' | 'error') {
    this.toastMessage = message; 
    this.toastType = type;
    this.cdr.detectChanges();
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => { this.toastMessage = ''; this.cdr.detectChanges(); }, 3000);
  }

  // --- Takım & Üye Yönetimi ---
loadTeams() {
    const userId = Number(localStorage.getItem('userId'));
    this.teamService.getMyTeams(userId).subscribe({
      next: (data: any) => {
        this.teams = Array.isArray(data) ? data : [];
        
        // 🚀 OTOMATİK TAKIM SEÇİMİ
        if (this.teams.length > 0) {
          const isValidTeam = this.teams.some(t => (t.teamId || t.TeamId) == this.currentTeamId);
          // Daha önce seçili takım yoksa veya silindiyse direkt ilk takımı seç
          if (!this.currentTeamId || !isValidTeam) {
            this.selectTeam(this.teams[0].teamId || this.teams[0].TeamId);
          }
        }
        this.cdr.detectChanges(); 
      },
      error: (err) => { this.teams = []; this.cdr.detectChanges(); }
    });
  }


  // YARDIMCI METOTLAR: Açıklamayı ve Linki Ayrıştırmak İçin
  getCleanDescription(desc: string): string {
    if (!desc) return '';
    return desc.split('Ekli Dosya:')[0].trim();
  }

  getAttachmentUrl(desc: string): string | null {
    if (!desc) return null;
    const parts = desc.split('Ekli Dosya:');
    return parts.length > 1 ? parts[1].trim() : null;
  }

openDetailModal(task: any) {
    this.selectedTask = { ...task }; 
    this.isDetailModalOpen = true;
    
    // Çoklu Link Ayıklayıcı
    const parts = (this.selectedTask.description || '').split('\n\nEkli Dosya:');
    this.selectedTask.description = parts[0].trim();
    this.uploadedFiles = [];
    for (let i = 1; i < parts.length; i++) { this.uploadedFiles.push(parts[i].trim()); }
    
    this.isUploading = false;
    this.loadSubtasks(); this.loadTaskActivities(); this.loadTaskComments(); this.cdr.detectChanges();
  }


  loadTaskActivities() {
  const taskId = this.selectedTask?.id || this.selectedTask?.Id || this.selectedTask?.taskId;
  if (!taskId) return;

  this.taskService.getTaskActivities(taskId).subscribe({
    next: (data: any) => {
      this.selectedTaskActivities = Array.isArray(data) ? data : [];
      this.cdr.detectChanges();
    },
    error: (err) => console.error("Aktiviteler yüklenemedi:", err)
  });
}

  loadSubtasks() {
    const taskId = this.selectedTask?.id || this.selectedTask?.Id || this.selectedTask?.taskId;
    if (!taskId) return;

    this.taskService.getSubtasksByTaskId(taskId).subscribe({
      next: (data: any) => {
        const subtasksArray = Array.isArray(data) ? [...data] : [];
        this.selectedTask.subtasks = subtasksArray;
        this.selectedTask.subTasks = subtasksArray;
        this.cdr.detectChanges();
      },
      error: (err) => console.error("Alt görevler yüklenemedi:", err)
    });
  }

deleteSubtask(index: number) {
    if (!this.selectedTask || !this.selectedTask.subtasks) return;
    const st = this.selectedTask.subtasks[index];
    const subtaskId = st?.id || st?.Id;

    if (!subtaskId) return;

    this.taskService.deleteSubtask(subtaskId).subscribe({
      next: () => {
        this.selectedTask.subtasks.splice(index, 1);
        this.selectedTask.subtasks = [...this.selectedTask.subtasks];
        this.selectedTask.subTasks = this.selectedTask.subtasks;
        
        this.refreshTaskLists(); // 🚀 Anında yüzdeyi tetikle
        this.loadTaskActivities(); // 🕒 EKLENEN KOD: Geçmişi anında yenile
        this.cdr.detectChanges();
      },
      error: (err) => console.error("Alt görev silinemedi:", err)
    });
  }
  closeDetailModal() {
    this.isDetailModalOpen = false;
    this.selectedTask = null;
    this.cdr.detectChanges();
  }

saveAssignment() {
    if (!this.selectedTask) return;
    let finalDesc = this.selectedTask.description ? this.selectedTask.description.trim() : '';
    this.uploadedFiles.forEach(url => { finalDesc += `\n\nEkli Dosya: ${url}`; });

    const taskId = this.selectedTask.id || this.selectedTask.Id || this.selectedTask.taskId;
    const tagsJsonString = JSON.stringify(this.selectedTask.parsedTags || []);

    const taskData = {
      ...this.selectedTask, id: taskId, description: finalDesc, 
      assigneeId: this.selectedTask.assigneeId ? Number(this.selectedTask.assigneeId) : null,
      AssigneeId: this.selectedTask.assigneeId ? Number(this.selectedTask.assigneeId) : null,
      tags: tagsJsonString, Tags: tagsJsonString
    };

    this.taskService.updateTask(taskId, taskData).subscribe({
      next: () => { this.loadTasks(); this.closeDetailModal(); this.showToast('Görev kaydedildi!', 'success'); this.cdr.detectChanges(); },
      error: () => this.showToast('Hata oluştu.', 'error')
    });
  }

  // --- DOSYA YÜKLEME METOTLARI ---
  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.uploadSelectedFile();
      event.target.value = ''; 
    }
  }

uploadSelectedFile(): void {
    if (!this.selectedFile) return;
    this.isUploading = true;
    this.cdr.detectChanges();

    this.fileService.uploadFile(this.selectedFile).subscribe({
      next: (response: any) => {
        this.uploadedFiles.push(response.fileUrl); // 🚀 Diziye ekle (Çoklu dosya)
        this.isUploading = false;
        this.selectedFile = null;
        this.cdr.detectChanges(); 
      },
      error: (err) => { this.isUploading = false; this.cdr.detectChanges(); }
    });
  }

  removeFile(index: number) {
    this.uploadedFiles.splice(index, 1);
    this.cdr.detectChanges();
  }


  // --- Görev Ekleme, Silme ve Düzenleme ---
  openAddTaskModal() {
    this.isAddingTask = true;
    this.selectedFile = null;
    this.uploadedFileUrl = '';
    this.isUploading = false;
    this.cdr.detectChanges();
  }
  
  getCurrentTeamName(): string { const selected = this.teams.find(t => t.teamId == this.currentTeamId); return selected ? selected.teamName : 'Takım Seç'; }
  getCurrentUserRole(): string { const selected = this.teams.find(t => t.teamId == this.currentTeamId); return selected ? (selected.role || selected.Role || 'Member') : 'Member'; }
  openTeamModal() {
    this.isTeamModalOpen = true;
    this.cdr.detectChanges();

    const userId = Number(localStorage.getItem('userId'));
    if (!userId || isNaN(userId)) return;

    this.teamService.getMyTeams(userId).subscribe({
      next: (data: any) => {
        this.teams = Array.isArray(data) ? data : [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.teams = [];
        this.cdr.detectChanges();
      }
    });
  }
  closeTeamModal() {
    this.isTeamModalOpen = false;
    this.cdr.detectChanges();
  }
  selectTeam(teamId: any) { 
    this.currentTeamId = teamId; 
    localStorage.setItem('selectedTeamId', teamId); 
    this.loadTasks(); 
    this.loadTeamMembers(); 
    this.closeTeamModal();
    this.cdr.detectChanges(); 
  }
  createTeam() {
    if (!this.newTeamName || this.newTeamName.trim() === '') return;
    this.teamService.createTeam(this.newTeamName, Number(localStorage.getItem('userId'))).subscribe(() => { this.loadTeams(); this.closeTeamModal(); });
  }
  openMembersModal() { this.currentUserRole = this.getCurrentUserRole(); this.isMembersModalOpen = true; this.loadTeamMembers(); }
  closeMembersModal() { this.isMembersModalOpen = false; this.cdr.detectChanges(); }

loadTeamMembers() {
  if (!this.currentTeamId) {
    console.warn("Takım ID bulunamadı, üyeler çekilemiyor.");
    return;
  }

  // 🚀 TypeScript'in tip hatalarını (any) ile tamamen susturuyoruz
  const anyThis = this as any;
  const tService = anyThis.teamService;
  const taskSvc = anyThis.taskService;
  const sprintSvc = anyThis.sprintService;

  let serviceToUse: any = null;

  // Hangi serviste bu metot gizliyse onu buluyoruz
  if (tService && typeof tService.getTeamMembers === 'function') {
    serviceToUse = tService;
  } else if (taskSvc && typeof taskSvc.getTeamMembers === 'function') {
    serviceToUse = taskSvc;
  } else if (sprintSvc && typeof sprintSvc.getTeamMembers === 'function') {
    serviceToUse = sprintSvc;
  }

  if (serviceToUse) {
    serviceToUse.getTeamMembers(this.currentTeamId).subscribe({
      next: (res: any) => {
        // API'den gelen veriyi (Data objesi içinde olsa bile) güvenle çıkarıyoruz
        const membersData = res.data ? res.data : (res.Data ? res.Data : res);
        
        this.teamMembers = Array.isArray(membersData) ? membersData : [];
        this.updateUserNameFromMembers();
        
        this.cdr.detectChanges(); // Arayüzü güncelle
      },
      error: (err: any) => {
        console.error('Takım üyeleri API\'den çekilemedi:', err);
        this.teamMembers = [];
        this.cdr.detectChanges();
      }
    });
  } else {
    console.error("HATA: getTeamMembers metodu tanımlı hiçbir servis bulunamadı! Lütfen takım üyelerini çeken servisi kontrol et.");
    this.teamMembers = [];
    this.cdr.detectChanges();
  }
}


// 🚀 ASLA İSMİ EZMEYEN GÜVENLİ METOT
updateUserNameFromMembers() {
  const currentUserId = localStorage.getItem('userId');
  const me = this.teamMembers.find(m => 
    String(m.userId || m.UserId || m.id || m.Id) === String(currentUserId)
  );

  if (me) {
    const memberName = me.fullName || me.FullName || me.userName || me.UserName || me.name || me.Name;
    if (memberName) {
      this.cdr.detectChanges();
    }
  }
  // DİKKAT: Buradaki 'else { this.userName = 'Kullanıcı'; }' kısmını tamamen çöpe attık!
  // Böylece arka plandaki API isteği token'dan gelen "Yiğit Doğan" ismini asla ezip "Kullanıcı" yapamayacak.
}


// 🚀 Türkçe Karakter Destekli Güvenli JWT Çözücü
updateSidebarUserName() {
  try {
    const token = localStorage.getItem('token');
    if (token) {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      const payload = JSON.parse(jsonPayload);
      
      // Token içindeki tüm olası ad-soyad anahtarlarını kontrol ediyoruz
      const fullName = payload.FullName || 
                       payload.fullName || 
                       payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || 
                       payload.name || 
                       payload.unique_name;

      if (fullName) {
        this.userName = fullName;
        this.cdr.detectChanges();
        return;
      }
    }
  } catch (e) {
    console.error('Token çözülemedi:', e);
  }

  // Token'da bulunamazsa localStorage'daki kullanıcı adını baz al
  this.userName = localStorage.getItem('loggedInUser') || 'Kullanıcı';
  this.cdr.detectChanges();
}

updateMemberRole(member: any, newRole: string) { this.teamService.updateMemberRole(this.currentTeamId, member.userId || member.UserId, newRole).subscribe(() => this.loadTeamMembers()); }
  leaveTeam() { if (confirm('Ayrılmak istediğine emin misin?')) { this.teamService.leaveTeam(this.currentTeamId, this.currentUserId).subscribe(() => { this.currentTeamId = null; localStorage.removeItem('selectedTeamId'); this.loadTeams(); this.isMembersModalOpen = false; }); } }
  removeMemberFromTeam(member: any) { this.teamService.removeMember(this.currentTeamId, member.userId || member.UserId).subscribe(() => this.loadTeamMembers()); }

  // --- Davet İşlemleri ---
  openInviteModal() { this.isInviteModalOpen = true; this.cdr.detectChanges(); }
  closeInviteModal() { this.isInviteModalOpen = false; this.generatedInviteLink = ''; this.cdr.detectChanges(); }
  sendInvite() {
    if (!this.currentTeamId) { this.showToast('Lütfen önce bir takım seçin!', 'error'); return; }
    this.teamService.inviteUser(this.currentTeamId, this.currentUserId, "acik-davet@link.com").subscribe({
      next: (response: any) => {
        this.generatedInviteLink = response.inviteLink || response.InviteLink; 
        this.showToast('Davet linki başarıyla oluşturuldu!', 'success');
      },
      error: () => this.showToast('Davet oluşturulamadı.', 'error')
    });
  }
  copyInviteLink() {
    if (!this.generatedInviteLink) return;
    navigator.clipboard.writeText(this.generatedInviteLink).then(() => {
      this.showToast('Davet linki kopyalandı! 📋', 'success');
    }).catch(() => this.showToast('Link kopyalanamadı.', 'error'));
  }

  // --- Görev Metotları ---
loadTasks() {
  if (!this.currentTeamId) return; 

  // 1. Önce Sprintleri çek ki "Aktif" olanı bulalım
  this.sprintService.getTeamSprintsAndBacklog(this.currentTeamId).subscribe((sprintData: any) => {
    this.sprints = sprintData.sprints || sprintData.Sprints || [];
    this.backlogTasksList = sprintData.backlog || sprintData.Backlog || [];
    
    const activeSprint = this.sprints.find((s: any) => s.state === 1 || s.State === 1);
    this.activeSprintName = activeSprint ? (activeSprint.name || activeSprint.Name) : null;

    // 2. Takımın Sütunlarını Çek
    this.taskService.getTeamColumns(this.currentTeamId).subscribe((cols: any) => {
      this.boardColumns = Array.isArray(cols) ? cols : [];

      // 3. Görevleri Çek
      this.taskService.getMyTasks().subscribe((data: any) => {
        const allTeamTasks = (Array.isArray(data) ? data : []).filter((t: any) => t.teamId == this.currentTeamId || t.TeamId == this.currentTeamId);
        
        let teamTasks: any[] = [];
        
        // 🚀 BÜYÜK DÜZELTME BURADA: Backend'den SprintId gelmesine gerek kalmadan 
        // doğrudan Aktif Sprint'in içindeki Görev ID'leri ile kusursuz eşleştirme yapıyoruz!
        if (activeSprint) {
            const activeSprintTasks = activeSprint.tasks || activeSprint.Tasks || [];
            const activeTaskIds = activeSprintTasks.map((st: any) => st.id || st.Id);
            
            teamTasks = allTeamTasks.filter((t: any) => {
                const taskId = t.id || t.Id;
                return activeTaskIds.includes(taskId);
            });
        }

        const existingSubtasksMap = new Map<number, any[]>();
        [...this.backlogTasks, ...this.todoTasks, ...this.devTasks, ...this.qaTasks, ...this.doneTasks].forEach(t => {
          const id = t.id || t.Id;
          if (id && t.subtasks && t.subtasks.length > 0) {
            existingSubtasksMap.set(id, t.subtasks);
          }
        });

        teamTasks.forEach((t: any) => {
          t.parsedTags = this.safeParseTags(t.tags || t.Tags);
          const id = t.id || t.Id;
          if (id && existingSubtasksMap.has(id)) {
            t.subtasks = existingSubtasksMap.get(id);
            t.subTasks = t.subtasks;
          }
        });

        // Görevleri eski dizilere dağıt
        this.backlogTasks = teamTasks.filter((t: any) => t.status === 0 || t.Status === 0);
        this.todoTasks = teamTasks.filter((t: any) => t.status === 1 || t.Status === 1);
        this.devTasks = teamTasks.filter((t: any) => t.status === 2 || t.Status === 2);
        this.qaTasks = teamTasks.filter((t: any) => t.status === 3 || t.Status === 3);
        this.doneTasks = teamTasks.filter((t: any) => t.status === 4 || t.Status === 4);

        // Görevleri Dinamik Sütunlara dağıt
        this.boardColumns.forEach((col, index) => {
          col.tasks = teamTasks.filter((t: any) => {
            const colId = col.id || col.Id;
            if (t.columnId || t.ColumnId) return (t.columnId || t.ColumnId) == colId;
            const statusVal = t.status !== undefined ? t.status : t.Status;
            return statusVal === col.order || statusVal === index;
          });
        });

        // Alt görevleri eksik olanları tekrar çek
        teamTasks.forEach(task => {
          const taskId = task.id || task.Id;
          if (taskId && (!task.subtasks || task.subtasks.length === 0)) {
            this.taskService.getSubtasksByTaskId(taskId).subscribe({
              next: (subtasksData: any) => {
                const list = Array.isArray(subtasksData) ? [...subtasksData] : [];
                task.subtasks = list;
                task.subTasks = list;
                this.cdr.detectChanges();
              },
              error: () => {}
            });
          }
        });

        this.applyFilters();
        this.generateCalendar();
        this.cdr.detectChanges();
      });
    });
  });
}


drop(event: CdkDragDrop<any[]>) {
  if (event.previousContainer === event.container) {
    moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
  } else {
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );

    const movedTask = event.container.data[event.currentIndex];
    
    // Hangi dinamik sütuna sürüklendiğini buluyoruz
    const targetCol = this.boardColumns.find(c => c.tasks === event.container.data);
    if (targetCol) {
      movedTask.columnId = targetCol.id || targetCol.Id;
      movedTask.status = targetCol.order ?? 0;
      movedTask.Status = targetCol.order ?? 0;
      movedTask.isCompleted = (targetCol.order === 4 || (targetCol.name || targetCol.Name)?.toLowerCase().includes('tamam'));
    }

    this.taskService.updateTask(movedTask.id || movedTask.Id, movedTask).subscribe({
      next: () => {},
      error: (err) => {
         transferArrayItem(event.container.data, event.previousContainer.data, event.currentIndex, event.previousIndex);
      }
    });
  }
}

addNewTask() {
    if (!this.newTaskTitle || this.newTaskTitle.trim() === '') return;
    let finalDescription = this.newTaskDescription || '';
    
    // Tüm linkleri alt alta ekle
    this.uploadedFiles.forEach(url => { finalDescription += `\n\nEkli Dosya: ${url}`; });

    const newTask = { 
      title: this.newTaskTitle, description: finalDescription, priority: this.newTaskPriority, 
      teamId: Number(this.currentTeamId), type: Number(this.newTaskType), status: Number(this.newTaskStatus),
      startDate: this.newTaskStartDate ? new Date(this.newTaskStartDate).toISOString() : null,
      endDate: this.newTaskEndDate ? new Date(this.newTaskEndDate).toISOString() : null,
      assigneeId: null,
      estimatedHours: Number(this.newTaskEstimatedMinutes) / 60, // 🚀 Dakikayı saate çevirip Backend'e yolla
      tags: JSON.stringify(this.newTaskTags)
    };

    this.taskService.addTask(newTask).subscribe({
      next: () => { this.closeAddTaskModal(); this.loadTasks(); this.showToast('Görev başarıyla eklendi!', 'success'); },
      error: () => this.showToast('Görev eklenirken bir hata oluştu.', 'error')
    });
  }
  
  
  closeAddTaskModal() { 
    this.isAddingTask = false; 
    this.newTaskTitle = ''; 
    this.newTaskDescription = ''; 
    this.newTaskStartDate = ''; 
    this.newTaskEndDate = '';
    this.selectedFile = null;
    this.uploadedFileUrl = '';
    this.isUploading = false;
    this.cdr.detectChanges(); 
    this.newTaskEstimatedHours = 0;
    this.newTaskTags = []; this.newTagName = '';
  }

startEdit(task: any) { 
    this.editingTask = { ...task }; 
    // Backend'den gelen saati 60 ile çarpıp dakikaya çeviriyoruz ki kutuda "70" yazsın
    this.editingTask.estimatedMinutes = Math.round((task.estimatedHours || task.EstimatedHours || 0) * 60);
    this.editingTask.parsedTags = this.safeParseTags(task.tags || task.Tags);
    this.editingTask.type = task.type !== undefined ? task.type : (task.Type !== undefined ? task.Type : 0);
    if (this.editingTask.startDate) this.editingTask.startDate = this.editingTask.startDate.split('T')[0];
    if (this.editingTask.endDate) this.editingTask.endDate = this.editingTask.endDate.split('T')[0];

    // Çoklu Link Ayıklayıcı
    let desc = this.editingTask.description || '';
    const parts = desc.split('\n\nEkli Dosya:');
    this.editingTask.description = parts[0].trim();
    this.uploadedFiles = [];
    for(let i=1; i < parts.length; i++) { this.uploadedFiles.push(parts[i].trim()); }

    this.cdr.detectChanges();
  }

  
  cancelEdit() { 
    this.editingTask = null; 
    this.cdr.detectChanges(); 
  }

saveEdit() {
    const taskId = this.editingTask.id || this.editingTask.Id || this.editingTask.taskId;
    if (!taskId) return;
    
    let finalDesc = this.editingTask.description ? this.editingTask.description.trim() : '';
    this.uploadedFiles.forEach(url => { finalDesc += `\n\nEkli Dosya: ${url}`; });

    const updatedTask = {
      ...this.editingTask, description: finalDesc, assigneeId: this.editingTask.assigneeId || null, 
      startDate: this.editingTask.startDate ? new Date(this.editingTask.startDate).toISOString() : null,
      endDate: this.editingTask.endDate ? new Date(this.editingTask.endDate).toISOString() : null,
      estimatedHours: Number(this.editingTask.estimatedMinutes) / 60,
      type: Number(this.editingTask.type), // 🚀 İŞTE EKLENEN SATIR BURASI
      // , // 🚀 Tekrar saate çevir
      tags: JSON.stringify(this.editingTask.parsedTags || [])
    };

    this.taskService.updateTask(taskId, updatedTask).subscribe(() => {
      this.editingTask = null; this.uploadedFiles = []; this.loadTasks(); this.showToast('Görev güncellendi!', 'success');
    });
  }



// 3️⃣ İLERLEME ÇUBUĞU (TAMAMLANDI SEKMESİ İÇİN KESİN %100 MANTIĞI)
  getTimeProgress(): number {
    if (!this.selectedTask) return 0;
    
    // Görev "Tamamlandı" sütununda mı? (Sırası 4 veya adında 'tamam' geçiyorsa)
    const targetCol = this.boardColumns.find(c => (c.id || c.Id) === (this.selectedTask.columnId || this.selectedTask.ColumnId));
    const isDoneCol = targetCol 
        ? (targetCol.order === 4 || (targetCol.name || targetCol.Name)?.toLowerCase().includes('tamam')) 
        : (this.selectedTask.status === 4 || this.selectedTask.Status === 4);

    // 🚨 Eğer "Tamamlandı" içindeyse DİREKT 100 döndür. Değilse normal eforu hesapla!
    if (isDoneCol || this.selectedTask.isCompleted) return 100;

    const logged = Number(this.selectedTask.loggedHours || this.selectedTask.LoggedHours || 0);
    const estimated = Number(this.selectedTask.estimatedHours || this.selectedTask.EstimatedHours || 0);
    
    if (estimated === 0) return 0; 
    
    return Math.min(100, Math.round((logged / estimated) * 100));
  }
  askDeleteConfirm(task: any) { 
    this.taskToDeleteId = task.id || task.Id || task.taskId; 
    this.isConfirmModalOpen = true; 
    this.cdr.detectChanges(); // <-- DOM'u anında günceller, 2. tık ihtiyacını ortadan kaldırır
  }

 cancelDelete() { 
    this.isConfirmModalOpen = false; 
    this.taskToDeleteId = null; // 🧹 Hafızadaki silinecek ID'yi temizle
    this.cdr.detectChanges(); 
  }

  confirmDelete() { 
    if (!this.taskToDeleteId) return;

    this.taskService.deleteTask(this.taskToDeleteId).subscribe({
      next: () => { 
        this.isConfirmModalOpen = false; 
        this.loadTasks(); 
        this.showToast('Görev başarıyla silindi 🗑️', 'success');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Silme hatası:", err);
        this.isConfirmModalOpen = false; 
        this.showToast('Silinemedi! Sadece kendi oluşturduğunuz görevleri silebilirsiniz.', 'error');
        this.cdr.detectChanges();
      }
    }); 
  }

  // --- TAKVİM METOTLARI ---
  get allTasksList() {
    return [...this.backlogTasks, ...this.todoTasks, ...this.devTasks, ...this.qaTasks, ...this.doneTasks];
  }

  generateCalendar() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    const firstDayIndex = new Date(year, month, 1).getDay(); 
    const startingEmptyDays = firstDayIndex === 0 ? 6 : firstDayIndex - 1; 
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    this.calendarDays = [];

    for (let i = 0; i < startingEmptyDays; i++) {
      this.calendarDays.push({ date: null, tasks: [] });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dateObj = new Date(year, month, i);
      dateObj.setHours(0, 0, 0, 0);

      const tasksForThisDay = this.allTasksList.filter(task => {
        const taskDateStr = task.endDate || task.startDate;
        if (!taskDateStr) return false;
        const taskDate = new Date(taskDateStr);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate.getTime() === dateObj.getTime();
      });

      this.calendarDays.push({ date: i, fullDate: dateObj, tasks: tasksForThisDay });
    }

    const totalSlots = startingEmptyDays + daysInMonth;
    const totalRows = Math.ceil(totalSlots / 7);

    // TAKVİM ZOOM DÜZELTİLDİ: Tüm aylar ekrana kusursuz sığacak
    if (totalRows >= 6) {
      this.calendarZoom = 0.85; 
    } else {
      this.calendarZoom = 0.95; 
    }
  }

  prevMonth() {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
    this.generateCalendar();
  }

  nextMonth() {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    this.generateCalendar();
  }

  getMonthName(): string {
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    return `${months[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
  }

  zoomIn() {
    this.calendarZoom = 1.0; 
  }

  zoomOut() {
    this.calendarZoom = 0.9; 
  }

  // --- TAKVİM AY/YIL DEĞİŞKENLERİ ---
  isDatePickerOpen: boolean = false;
  monthsList: string[] = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  shortMonths: string[] = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];  
  pickerYear: number = new Date().getFullYear(); 

  toggleDatePicker() {
    if (!this.isDatePickerOpen) {
      this.pickerYear = this.currentDate.getFullYear(); 
    }
    this.isDatePickerOpen = !this.isDatePickerOpen;
  }

  changePickerYear(step: number) {
    this.pickerYear += step;
  }

  selectPickerMonth(monthIndex: number) {
    this.currentDate = new Date(this.pickerYear, monthIndex, 1);
    this.generateCalendar();
    this.isDatePickerOpen = false; 
  }

  get currentMonthIndex(): number {
    return this.currentDate.getMonth();
  }

  get currentYear(): number {
    return this.currentDate.getFullYear();
  }

  onMonthChange(monthIndex: any) {
    this.currentDate = new Date(this.currentYear, Number(monthIndex), 1);
    this.generateCalendar();
  }

  onYearChange(year: any) {
    this.currentDate = new Date(Number(year), this.currentMonthIndex, 1);
    this.generateCalendar();
  }

  // --- Alt Görev İşlemleri ---
addsubtask() {
    if (!this.newSubtaskTitle || !this.newSubtaskTitle.trim() || !this.selectedTask) return;
    
    const taskId = Number(this.selectedTask.id || this.selectedTask.Id || this.selectedTask.taskId);
    const title = this.newSubtaskTitle.trim();
    this.newSubtaskTitle = '';

    const newSubtask: any = {
      taskId: taskId,
      title: title,
      isCompleted: false,
      IsCompleted: false
    };

    const currentList = this.selectedTask.subtasks || [];
    const updatedList = [...currentList, newSubtask];
    this.selectedTask.subtasks = updatedList;
    this.selectedTask.subTasks = updatedList;
    
    this.syncTaskWithBoard(); // 🚀 ARKADAKİ KARTI EŞİTLE
    this.cdr.detectChanges();

    this.taskService.addSubtask(newSubtask).subscribe({
      next: (createdSubtask: any) => {
        const realId = createdSubtask.id || createdSubtask.Id;
        newSubtask.id = realId;
        newSubtask.Id = realId;
        this.selectedTask.subtasks = [...this.selectedTask.subtasks];
        this.selectedTask.subTasks = this.selectedTask.subtasks;
        this.syncTaskWithBoard(); // 🚀 ARKADAKİ KARTI EŞİTLE
        this.loadTaskActivities();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.selectedTask.subtasks = this.selectedTask.subtasks.filter((st: any) => st !== newSubtask);
        this.selectedTask.subTasks = this.selectedTask.subtasks;
        this.syncTaskWithBoard();
        this.cdr.detectChanges();
      }
    });
  }
  
  toggleSubtask(st: any) {
    const subtaskId = st.id || st.Id;
    
    if (!subtaskId) {
        setTimeout(() => st.isCompleted = !st.isCompleted, 50);
        return;
    }

    st.IsCompleted = st.isCompleted;

    if (this.selectedTask && this.selectedTask.subtasks) {
      this.selectedTask.subtasks = [...this.selectedTask.subtasks];
      this.selectedTask.subTasks = this.selectedTask.subtasks;
    }
    
    this.syncTaskWithBoard(); // 🚀 ARKADAKİ KARTI EŞİTLE
    this.cdr.detectChanges();

    this.taskService.toggleSubtask(subtaskId).subscribe({
      next: () => {
         this.syncTaskWithBoard(); // 🚀 ARKADAKİ KARTI EŞİTLE
         this.loadTaskActivities(); // 🕒 Geçmişi yenile
         this.cdr.detectChanges();
      },
      error: (err) => {
        st.isCompleted = !st.isCompleted;
        st.IsCompleted = st.isCompleted;
        if (this.selectedTask && this.selectedTask.subtasks) {
          this.selectedTask.subtasks = [...this.selectedTask.subtasks];
          this.selectedTask.subTasks = this.selectedTask.subtasks;
        }
        this.syncTaskWithBoard();
        this.cdr.detectChanges();
      }
    });
  }

  // MODALDAKİ DEĞİŞİKLİKLERİ ARKADAKİ KANBAN KARTLARINA CANLI AKTARAN SİHİRLİ METOT
  syncTaskWithBoard() {
    if (!this.selectedTask) return;
    const taskId = this.selectedTask.id || this.selectedTask.Id || this.selectedTask.taskId;
    
    // Tüm görevlerin olduğu diziyi birleştiriyoruz
    const allTasks = [...this.backlogTasks, ...this.todoTasks, ...this.devTasks, ...this.qaTasks, ...this.doneTasks];
    
    // Asıl görevi buluyoruz
    const originalTask = allTasks.find(t => (t.id || t.Id || t.taskId) === taskId);
    
    if (originalTask) {
      // Modal'daki alt görevleri birebir orijinal göreve kopyalıyoruz
      originalTask.subtasks = [...this.selectedTask.subtasks];
      originalTask.subTasks = [...this.selectedTask.subtasks];
    }
    
    this.refreshTaskLists();
  }
  // Kanban kartlarındaki yüzde barlarının anında yenilenmesi için yardımcı tetikleyici
  refreshTaskLists() {
    this.backlogTasks = [...this.backlogTasks];
    this.todoTasks = [...this.todoTasks];
    this.devTasks = [...this.devTasks];
    this.qaTasks = [...this.qaTasks];
    this.doneTasks = [...this.doneTasks];
  }
  getsubtaskProgress(): number {
    if (!this.selectedTask || !this.selectedTask.subtasks || this.selectedTask.subtasks.length === 0) {
      return 0;
    }
    const completedCount = this.selectedTask.subtasks.filter((st: any) => st.isCompleted).length;
    return Math.round((completedCount / this.selectedTask.subtasks.length) * 100);
  }

  // BİLDİRİM MERKEZİ DEĞİŞKENLERİ - SIFIRLANDI
  isNotificationDropdownOpen: boolean = false;
  unreadNotificationCount: number = 0; 
  notifications: any[] = [];

  selectedTaskActivities: any[] = [];



// --- BİLDİRİM FİLTRELEME BEYNİ ---
  processIncomingNotification(actionType: string, actionUserId: any, assigneeId: any, taskTitle: string, customMessage: string) {
    const myId = Number(this.currentUserId);
    const actUserId = Number(actionUserId);
    const assId = assigneeId ? Number(assigneeId) : null;

    // İşlemi yapan kişi kendimizsek bildirim alma
    if (actUserId === myId) {
      return; 
    }

    // 1. Sana Özel Yeni Görev Atandığında
    if (actionType === 'ASSIGNED' && assId === myId) {
      this.pushNotification('🎯 Yeni Görev Ataması', customMessage);
    }
    // 2. Sana Ait Bir Görev Güncellendiğinde
    else if (actionType === 'UPDATED' && assId === myId) {
      this.pushNotification('📝 Görevinde Güncelleme', customMessage);
    }
    // 3. Takıma Genel Yeni Bir Görev Eklendiğinde
    else if (actionType === 'CREATED') {
      // Eğer yeni oluşturulan görev doğrudan sana atandıysa özel bildirim fırlat
      if (assId === myId) {
        this.pushNotification('🎯 Yeni Görev Ataması', `Sana yeni bir görev atandı: '${taskTitle}'`);
      } else {
        this.pushNotification('🚀 Yeni Görev Eklendi', customMessage);
      }
    }
  }

  // 🔍 FİLTRE UYGULAMA METODU
  applyFilters() {
    const search = this.searchTerm.toLowerCase().trim();
    
    // Tüm görevleri tek bir havuzda topluyoruz
    const allTasks = [
      ...(this.backlogTasks || []),
      ...(this.todoTasks || []),
      ...(this.devTasks || []),
      ...(this.qaTasks || []),
      ...(this.doneTasks || [])
    ];

    allTasks.forEach(t => {
      // 1. Arama Filtresi (Başlık veya Açıklama içinde arar)
      const title = (t.title || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      const matchSearch = title.includes(search) || desc.includes(search);

      // 2. Öncelik Filtresi
      const priority = t.priority || t.Priority;
      const matchPriority = this.filterPriority === '' || priority === this.filterPriority;

      // 3. Atanan Kişi Filtresi
      const assigneeId = t.assigneeId || t.AssigneeId;
      let matchAssignee = true;
      
      if (this.filterAssignee === 'unassigned') {
        matchAssignee = (assigneeId === null || assigneeId === 0 || assigneeId === undefined);
      } else if (this.filterAssignee !== '') {
        matchAssignee = (assigneeId == this.filterAssignee);
      }

      // 💡 Eğer şartlara uymuyorsa görevi gizliyoruz (isHidden = true)
      t.isHidden = !(matchSearch && matchPriority && matchAssignee);
    });

    // 👇 EKLENEN KRİTİK SATIR: Alt bileşene dizilerin değiştiğini haber veriyoruz
    this.refreshTaskLists(); 

    this.cdr.detectChanges();
  }
  // 🧹 FİLTRELERİ TEMİZLEME METODU
  clearFilters() {
    this.searchTerm = '';
    this.filterPriority = '';
    this.filterAssignee = '';
    this.applyFilters();
  }

// 📊 RAPOR İNDİRME METOTLARI
  downloadExcelReport() {
    if (!this.currentTeamId) {
      this.showToast('Lütfen önce bir takım seçin.', 'error');
      return;
    }
    
    this.showToast('Excel raporu hazırlanıyor...', 'success');
    this.taskService.exportTasksToExcel(this.currentTeamId).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Takim_${this.currentTeamId}_Gorev_Raporu.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.showToast('Excel raporu indirilirken hata oluştu.', 'error')
    });
  }

  downloadPdfReport() {
    if (!this.currentTeamId) {
      this.showToast('Lütfen önce bir takım seçin.', 'error');
      return;
    }

    this.showToast('PDF raporu hazırlanıyor...', 'success');
    this.taskService.exportTasksToPdf(this.currentTeamId).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Takim_${this.currentTeamId}_Gorev_Raporu.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.showToast('PDF raporu indirilirken hata oluştu.', 'error')
    });
  }


  // 📊 GRAFİK DEĞİŞKENLERİ VE METOTLARI
  statusChart: any;
  memberChart: any;
  priorityChart: any;

  renderCharts() {
    // Eski grafikleri temizle (Sekme değiştirildiğinde grafiklerin üst üste binmesini önler)
    if (this.statusChart) this.statusChart.destroy();
    if (this.memberChart) this.memberChart.destroy();
    if (this.priorityChart) this.priorityChart.destroy();

    // 1. SÜTUN DAĞILIMI (Doughnut Chart)
   // 1. SÜTUN DAĞILIMI (Doughnut Chart)
    const statusCtx = document.getElementById('statusChart') as HTMLCanvasElement;
    if (statusCtx) {
      // 🚀 Grafiği Dinamik Sütunlardan Besliyoruz
      const dynamicLabels = this.boardColumns.map(c => c.name || c.Name);
      const dynamicData = this.boardColumns.map(c => c.tasks ? c.tasks.length : 0);
      
      // Sütun sayısına göre otomatik renk havuzu
      const colorPalette = ['#94a3b8', '#facc15', '#38bdf8', '#c084fc', '#10b981', '#f43f5e', '#8b5cf6', '#14b8a6', '#f97316'];
      const dynamicColors = dynamicLabels.map((_, index) => colorPalette[index % colorPalette.length]);

      this.statusChart = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
          labels: dynamicLabels,
          datasets: [{
            data: dynamicData,
            backgroundColor: dynamicColors,
            borderWidth: 0,
            hoverOffset: 10
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { family: 'sans-serif', weight: 'bold' } } } }, cutout: '75%' }
      });
    }

    // 2. ÜYELERE GÖRE ÜSTLENİLEN GÖREVLER (Bar Chart)
    const memberCtx = document.getElementById('memberChart') as HTMLCanvasElement;
    if (memberCtx) {
      const memberNames = this.teamMembers.map(m => m.fullName || m.userName || m.UserName || 'Bilinmeyen');
      const memberTaskCounts = this.teamMembers.map(m => {
         return this.allTasksList.filter(t => (t.assigneeId || t.AssigneeId) == (m.userId || m.UserId)).length;
      });

      this.memberChart = new Chart(memberCtx, {
        type: 'bar',
        data: {
          labels: memberNames,
          datasets: [{
            label: 'Üstlenilen Görev Sayısı',
            data: memberTaskCounts,
            backgroundColor: 'rgba(99, 102, 241, 0.8)',
            borderColor: '#6366f1',
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
      });
    }

    // 3. ÖNCELİK DAĞILIMI (Pie Chart)
    const priorityCtx = document.getElementById('priorityChart') as HTMLCanvasElement;
    if (priorityCtx) {
      const acil = this.allTasksList.filter(t => (t.priority || t.Priority) === 'Acil').length;
      const normal = this.allTasksList.filter(t => (t.priority || t.Priority) === 'Normal').length;
      const dusuk = this.allTasksList.filter(t => (t.priority || t.Priority) === 'Düşük').length;

      this.priorityChart = new Chart(priorityCtx, {
        type: 'pie',
        data: {
          labels: ['Acil', 'Normal', 'Düşük'],
          datasets: [{
            data: [acil, normal, dusuk],
            backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
            borderWidth: 0,
            hoverOffset: 10
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { weight: 'bold' } } } } }
      });
    }
  }

// 💬 YORUM YÖNETİM METOTLARI
  loadTaskComments() {
    const taskId = this.selectedTask?.id || this.selectedTask?.Id || this.selectedTask?.taskId;
    if (!taskId) return;

    this.taskService.getTaskComments(taskId).subscribe({
      next: (data: any) => {
        this.taskComments = Array.isArray(data) ? data : [];
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Yorumlar yüklenemedi:', err)
    });
  }

  sendComment() {
    if (!this.newCommentText || !this.newCommentText.trim() || !this.selectedTask) return;

    const taskId = this.selectedTask.id || this.selectedTask.Id || this.selectedTask.taskId;
    const text = this.newCommentText.trim();
    this.newCommentText = ''; // Kutuyu temizle

    this.taskService.addTaskComment(taskId, text).subscribe({
      next: () => {
        this.loadTaskComments(); // Yorum listesini yenile
        this.loadTaskActivities(); // Hareket geçmişini yenile
        this.cdr.detectChanges();
      },
      error: () => this.showToast('Yorum gönderilemedi.', 'error')
    });
  }

// 🛠️ DİNAMİK SÜTUN METOTLARI
  loadBoardColumns() {
    if (!this.currentTeamId) return;
    this.taskService.getTeamColumns(this.currentTeamId).subscribe({
      next: (cols: any) => {
        const fetchedCols = Array.isArray(cols) ? cols : [];
        
        // 🔥 EKRANDAKİ GÖREVLERİN KAYBOLMAMASI İÇİN ESKİ GÖREVLERİ YENİ SÜTUNLARA AKTARIYORUZ
        fetchedCols.forEach(newCol => {
          const oldCol = this.boardColumns.find(c => (c.id || c.Id) === (newCol.id || newCol.Id));
          if (oldCol && oldCol.tasks) {
            newCol.tasks = oldCol.tasks;
          } else {
            newCol.tasks = [];
          }
        });

        this.boardColumns = fetchedCols;
        this.cdr.detectChanges();
      },
      error: (err) => console.error("Sütunlar yüklenemedi:", err)
    });
  }
  openColumnModal() {
    this.isColumnModalOpen = true;
    this.loadBoardColumns();
  }

  closeColumnModal() {
    this.isColumnModalOpen = false;
    this.newColumnName = '';
    this.cdr.detectChanges();
  }

  addNewColumn() {
    if (!this.newColumnName || !this.newColumnName.trim() || !this.currentTeamId) return;
    this.taskService.createColumn(this.currentTeamId, this.newColumnName.trim()).subscribe({
      next: () => {
        this.newColumnName = '';
        this.loadBoardColumns();
        this.loadTasks(); // Görev alanını yenile
        this.showToast('Yeni sütun eklendi!', 'success');
      },
      error: () => this.showToast('Sütun eklenirken hata oluştu.', 'error')
    });
  }

  renameColumn(col: any, newName: string) {
    if (!newName || !newName.trim()) return;
    this.taskService.updateColumn(col.id || col.Id, newName.trim()).subscribe({
      next: () => {
        this.loadBoardColumns();
        this.showToast('Sütun adı güncellendi.', 'success');
      }
    });
  }

  removeColumn(columnId: number) {
    if (!confirm('Bu sütunu silmek istediğinize emin misiniz?')) return;
    this.taskService.deleteColumn(columnId).subscribe({
      next: () => {
        this.loadBoardColumns();
        this.loadTasks();
        this.showToast('Sütun silindi.', 'success');
      }
    });
  }

  // ↕️ SÜTUN YER DEĞİŞTİRME METOTLARI
  moveColumnUp(index: number) {
    if (index === 0) return;
    const temp = this.boardColumns[index];
    this.boardColumns[index] = this.boardColumns[index - 1];
    this.boardColumns[index - 1] = temp;
    this.saveColumnOrder();
  }

  moveColumnDown(index: number) {
    if (index === this.boardColumns.length - 1) return;
    const temp = this.boardColumns[index];
    this.boardColumns[index] = this.boardColumns[index + 1];
    this.boardColumns[index + 1] = temp;
    this.saveColumnOrder();
  }

  saveColumnOrder() {
    const orderedIds = this.boardColumns.map(c => c.id || c.Id);
    this.taskService.reorderColumns(orderedIds).subscribe({
      next: () => {
         this.loadTasks(); // Panoyu yeni sıraya göre yenile
      },
      error: () => this.showToast('Sıralama kaydedilemedi', 'error')
    });
  }


  // 🔔 VERİTABANINDAN BİLDİRİMLERİ YÜKLEME VE TEMİZLEME
loadStoredNotifications() {
    this.taskService.getMyNotifications().subscribe({
      next: (data: any) => {
        this.notifications = Array.isArray(data) ? data : [];
        // 🚨 SADECE "OKUNMAMIŞ (IsRead == false)" OLANLARI SAY VE KIRMIZI ROZETTE GÖSTER
        this.unreadNotificationCount = this.notifications.filter(n => n.isRead === false || n.IsRead === false).length;
        this.cdr.detectChanges();
      },
      error: (err: any) => console.error("Bildirimler yüklenemedi:", err)
    });
  }

  pushNotification(title: string, message: string) {
    this.notifications.unshift({ 
      title: title, 
      message: message, 
      isRead: false, // 🚨 Yeni canlı düşen bildirimler okunmamış kabul edilir
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) 
    });
    this.unreadNotificationCount++;
    this.cdr.detectChanges();
  }

  toggleNotifications(): void {
    this.isNotificationDropdownOpen = !this.isNotificationDropdownOpen;
    
    // 🚨 Zile tıklandığında menü açılıyorsa ve okunmamış bildirim varsa:
    if (this.isNotificationDropdownOpen && this.unreadNotificationCount > 0) {
      this.unreadNotificationCount = 0; // Ekrandaki kırmızı rozeti anında sil
      
      // Listedeki tüm bildirimleri görsel olarak okundu yap
      this.notifications.forEach(n => { n.isRead = true; n.IsRead = true; });

      // Backend'e "Bu adam bildirimleri gördü, veritabanına kaydet" komutunu gönder
      this.taskService.markNotificationsAsRead().subscribe({
        next: () => console.log('Tüm bildirimler kalıcı olarak okundu işaretlendi.'),
        error: (err: any) => console.error('Okundu işaretleme hatası:', err)
      });
    }
    this.cdr.detectChanges();
  }

  clearNotifications(): void {
    this.taskService.clearMyNotifications().subscribe({
      next: () => {
        this.notifications = [];
        this.unreadNotificationCount = 0;
        this.cdr.detectChanges();
      },
      // 👇 BURAYA DA GÜVENLİK AMAÇLI ERROR YAKALAYICI EKLENDİ
      error: (err: any) => console.error("Bildirimler silinemedi:", err)
    });
  }

// ⏱️ ZAMAN TAKİBİ VE CANLI KRONOMETRE METOTLARI
  toggleTimer() {
    if (this.isTimerRunning) {
      // Kronometreyi Durdur
      clearInterval(this.timerInterval);
      this.isTimerRunning = false;
      
      // Saniyeyi saate çevir (Min: 0.01 saat)
      const hoursLogged = Number((this.timerSeconds / 3600).toFixed(2));
      if (hoursLogged > 0) {
        this.saveWorkTime(hoursLogged);
      } else {
        this.showToast('Çalışma süresi 1 dakikadan az olduğu için kaydedilmedi.', 'error');
      }
      this.timerSeconds = 0;
    } else {
      // Kronometreyi Başlat
      this.isTimerRunning = true;
      this.timerInterval = setInterval(() => {
        this.timerSeconds++;
        this.cdr.detectChanges();
      }, 1000);
    }
    this.cdr.detectChanges();
  }

  get formattedTimer(): string {
    const hrs = Math.floor(this.timerSeconds / 3600);
    const mins = Math.floor((this.timerSeconds % 3600) / 60);
    const secs = this.timerSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  saveWorkTime(hours: number) {
    if (!hours || hours <= 0 || !this.selectedTask) return;
    const taskId = this.selectedTask.id || this.selectedTask.Id || this.selectedTask.taskId;

    this.taskService.logWorkTime(taskId, hours).subscribe({
      next: () => {
        const currentLogged = Number(this.selectedTask.loggedHours || this.selectedTask.LoggedHours || 0);
        const newTotal = Number((currentLogged + hours).toFixed(2));
        
        this.selectedTask.loggedHours = newTotal;
        this.selectedTask.LoggedHours = newTotal;
        this.manualHoursToLog = 0;

        this.loadTasks(); // Kartları güncelle
        this.loadTaskActivities(); // Geçmişe log düşür
        this.showToast(`${hours} saatlik çalışma kaydedildi! ⏱️`, 'success');
        this.cdr.detectChanges();
      },
      error: (err: any) => this.showToast('Süre kaydı eklenemedi.', 'error')
    });
  } 

  // 🕒 ONDALIK SAATİ "X sa Y dk" FORMATINA ÇEVİREN METOT
  formatTime(hours: number): string {
    if (!hours || hours <= 0) return '0 dk';
    const totalMinutes = Math.round(hours * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    if (hrs > 0 && mins > 0) return `${hrs} sa ${mins} dk`;
    if (hrs > 0) return `${hrs} sa`;
    return `${mins} dk`;
  }

  // 🔄 SÜRELERİ SIFIRLAMA METODU
  resetWorkTime() {
    if (!this.selectedTask) return;
    if (!confirm('Harcanan çalışma süresini sıfırlamak istediğinize emin misiniz?')) return;

    const taskId = this.selectedTask.id || this.selectedTask.Id || this.selectedTask.taskId;
    this.taskService.resetWorkTime(taskId).subscribe({
      next: () => {
        this.selectedTask.loggedHours = 0;
        this.selectedTask.LoggedHours = 0;
        this.loadTasks();
        this.loadTaskActivities();
        this.showToast('Çalışma süresi sıfırlandı 🔄', 'success');
        this.cdr.detectChanges();
      },
      error: () => this.showToast('Süre sıfırlanamadı.', 'error')
    });
  }

  // 🏷️ ETİKET METOTLARI
  safeParseTags(tagsString: string): any[] {
    if (!tagsString) return [];
    try { return JSON.parse(tagsString); } catch { return []; }
  }

  addTagToNewTask() {
    if (this.newTagName.trim()) {
      this.newTaskTags.push({ name: this.newTagName.trim(), color: this.newTagColor });
      this.newTagName = ''; // Kutuyu temizle
    }
  }

  removeTagFromNewTask(index: number) {
    this.newTaskTags.splice(index, 1);
  }

  addTagToEditingTask() {
    if (this.newTagName.trim() && this.editingTask) {
      if (!this.editingTask.parsedTags) this.editingTask.parsedTags = [];
      this.editingTask.parsedTags.push({ name: this.newTagName.trim(), color: this.newTagColor });
      this.newTagName = '';
    }
  }

  removeTagFromEditingTask(index: number) {
    if (this.editingTask && this.editingTask.parsedTags) {
      this.editingTask.parsedTags.splice(index, 1);
    }
  }

  addTagToSelectedTask() {
    if (this.newTagName.trim() && this.selectedTask) {
      if (!this.selectedTask.parsedTags) this.selectedTask.parsedTags = [];
      this.selectedTask.parsedTags.push({ name: this.newTagName.trim(), color: this.newTagColor });
      this.newTagName = '';
    }
  }

  removeTagFromSelectedTask(index: number) {
    if (this.selectedTask && this.selectedTask.parsedTags) {
      this.selectedTask.parsedTags.splice(index, 1);
    }
  }

  // 👨‍💻 ÜYE İSTATİSTİKLERİNİ GETİRME METOTLARI
  onStatMemberChange() {
    if (!this.selectedStatMemberId) {
      this.selectedStatMemberTasks = [];
      this.selectedStatMemberActivities = [];
      return;
    }

    // 1. Seçilen üyenin üzerindeki görevleri filtrele (Tamamlananlar ve Devam Edenler)
    this.selectedStatMemberTasks = this.allTasksList.filter(t => 
      (t.assigneeId || t.AssigneeId) == this.selectedStatMemberId
    );

    // 2. Backend'den üyenin hareket geçmişini çek
    if (this.currentTeamId) {
      this.taskService.getMemberActivities(this.currentTeamId, this.selectedStatMemberId).subscribe({
        next: (data: any) => {
          this.selectedStatMemberActivities = Array.isArray(data) ? data : [];
          this.cdr.detectChanges();
        },
        error: (err: any) => console.error("Üye aktiviteleri çekilemedi", err)
      });
    }
  }

  // Yüzdelik hesaplama yardımcıları
  get selectedMemberDoneCount(): number {
    return this.selectedStatMemberTasks.filter(t => t.status === 4 || t.Status === 4 || t.isCompleted).length;
  }
  get selectedMemberActiveCount(): number {
    return this.selectedStatMemberTasks.length - this.selectedMemberDoneCount;
  }

  // ⏱️ SEÇİLİ ÜYENİN TOPLAM HARCADIĞI VE TAHMİNİ SÜRESİ
  get selectedMemberTotalLogged(): number {
    return this.selectedStatMemberTasks.reduce((sum, t) => sum + Number(t.loggedHours || t.LoggedHours || 0), 0);
  }

  get selectedMemberTotalEstimated(): number {
    return this.selectedStatMemberTasks.reduce((sum, t) => sum + Number(t.estimatedHours || t.EstimatedHours || 0), 0);
  }

  // 🚨 GECİKEN GÖREV SAYISI (Bitiş tarihi geçmiş ama tamamlanmamış)
  get selectedMemberOverdueCount(): number {
    const now = new Date();
    return this.selectedStatMemberTasks.filter(t => {
      const isDone = t.status === 4 || t.Status === 4 || t.isCompleted;
      const endDateStr = t.endDate || t.EndDate;
      if (isDone || !endDateStr) return false;
      return new Date(endDateStr) < now;
    }).length;
  }

  // 🏆 SEÇİLİ ÜYENİN BAŞARI YÜZDESİ (Math.round hatasını çözen metot)
  get selectedMemberSuccessRate(): number {
    if (!this.selectedStatMemberTasks || this.selectedStatMemberTasks.length === 0) return 0;
    return Math.round((this.selectedMemberDoneCount / this.selectedStatMemberTasks.length) * 100);
  }

  toggleChat() {
  this.isChatOpen = !this.isChatOpen;
    
    if (this.isChatOpen) {
      this.extractRecentChats();
    } else {
      this.selectedContact = null;
    }
  }

  setChatTab(tab: 'contacts' | 'messages') {
    this.chatActiveTab = tab;
    if (tab === 'messages') this.extractRecentChats();
  }


// 1. GÜNCELLENEN METOT: extractRecentChats (Geçmiş mesajları çekerken kimde okunmamış var kontrol eder)
extractRecentChats() {
  this.chatService.getAllUserMessages(this.currentUserId).subscribe({
    next: (messages: any[]) => {
      const contactIds = new Set<number>();
      
      messages.forEach(m => {
        const sender = m.senderId || m.SenderId;
        const receiver = m.receiverId || m.ReceiverId;
        
        if (sender !== this.currentUserId) {
          contactIds.add(sender);
          // Eğer mesajı başkası atmış ve henüz okunmadı statüsündeyse (veya genel okunmamış sayısındaysak)
          // Bu kişinin kartına doğrudan hasUnread bayrağını işleyelim:
          const targetMember = this.teamMembers.find(tm => (tm.userId || tm.UserId) === sender);
          if (targetMember && this.unreadChatCount > 0) {
            targetMember.hasUnread = true;
          }
        }
        if (receiver !== this.currentUserId) contactIds.add(receiver);
      });

      this.recentChats = this.teamMembers.filter(member => 
        contactIds.has(member.userId || member.UserId)
      );
      this.cdr.detectChanges();
    }
  });
}


  selectContact(user: any) {
this.selectedContact = user;
  user.hasUnread = false;
  
  // (Devamı aynı kalacak...)
  // 🚀 BİLDİRİMİ SIFIRLAMA İŞLEMİNİ BURAYA ALDIK:
  this.unreadChatCount = 0; 

  const contactId = user.userId || user.UserId;
  if (!contactId) return;

  this.chatService.getMessageHistory(this.currentUserId, contactId).subscribe({
    next: (history) => {
      this.chatService.messages$.next(history);
      this.cdr.detectChanges(); 
    }
  });

  this.chatService.messages$.subscribe(messages => {
    this.chatMessages = messages.filter(m => {
      const sender = m.senderId || m.SenderId;
      const receiver = m.receiverId || m.ReceiverId;
      const deletedBySender = m.isDeletedBySender || m.IsDeletedBySender;
      const deletedByReceiver = m.isDeletedByReceiver || m.IsDeletedByReceiver;

      return (sender === this.currentUserId && receiver === contactId && !deletedBySender) ||
             (sender === contactId && receiver === this.currentUserId && !deletedByReceiver);
    });
    this.cdr.detectChanges(); 
    
    // 🚀 YENİ MESAJ GELDİĞİNDE VEYA SOHBET AÇILDIĞINDA OTOMATİK AŞAĞI KAYDIR:
    this.scrollToBottom(); 
  });
}


// 🚀 YENİ METOT: Sohbet penceresini yumuşakça en alta kaydırır
scrollToBottom(): void {
  setTimeout(() => {
    const chatContainer = document.querySelector('.messages-container');
    if (chatContainer) {
      chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, 150); // 150ms Angular'ın HTML'i çizmesi için en ideal süredir
}


backToContacts() { this.selectedContact = null; }

sendMessage() {
  if (!this.newMessage.trim() || !this.selectedContact) return;
  const contactId = this.selectedContact.userId || this.selectedContact.UserId;
  if (!contactId) return;

  const textToSend = this.newMessage; // Mesajı hafızaya al
  this.newMessage = ''; // Kutuyu anında temizle (Çift tıklama bug'ını engeller)

  this.chatService.sendMessage(this.currentUserId, contactId, textToSend).then(() => {
      const msg = {
        id: Math.random() * -1000, 
        senderId: this.currentUserId,
        receiverId: contactId,
        content: textToSend,
        sentAt: new Date(),
        isDeletedBySender: false,
        isDeletedByReceiver: false
      };
      const currentMsgs = this.chatService.messages$.getValue();
      this.chatService.messages$.next([...currentMsgs, msg]);
      
      this.cdr.detectChanges(); 
      
      // 🚀 ÇÖZÜM: Mesaj diziye eklendiği an sayfayı en alta kaydır!
      this.scrollToBottom(); 
  });
}


  
deleteSingleMessage(msg: any) {
    const msgId = msg.id || msg.Id;
    if (!msgId || msgId < 0) return; 
    
    this.chatService.deleteMessageForMe(msgId, this.currentUserId).subscribe(() => {
      const updatedMsgs = this.chatService.messages$.getValue().filter((m: any) => (m.id || m.Id) !== msgId);
      this.chatService.messages$.next(updatedMsgs);
      this.cdr.detectChanges();
    });
  }


// 🔄 Backlog ve Sprint Verilerini Yükleme
// 🔄 Backlog ve Sprint Verilerini Yükleme (Otomatik Kapanma Özellikli)
loadSprintsAndBacklog() {
  if (!this.currentTeamId) return;
  this.sprintService.getTeamSprintsAndBacklog(this.currentTeamId).subscribe({
    next: (data: any) => {
      const rawSprints = data.sprints || data.Sprints || [];
      
      // Tamamlanan (State === 2) sprintleri varsayılan olarak KAPALI getiriyoruz
      this.sprints = rawSprints.map((s: any) => ({
        ...s,
        isUICollapsed: s.state === 2 || s.State === 2
      }));

      this.backlogTasksList = data.backlog || data.Backlog || [];
      this.cdr.detectChanges();
    },
    error: (err: any) => console.error('Sprint verileri çekilemedi:', err)
  });
}

// Sprintleri Açıp Kapatma Fonksiyonu
toggleSprintCollapse(sprint: any) {
  sprint.isUICollapsed = !sprint.isUICollapsed;
  this.cdr.detectChanges();
}

// 🎯 Sekme Değiştiğinde Veriyi Tetikle
switchTab(tab: 'board' | 'stats' | 'profile' | 'calendar' | 'backlog') {
  this.activeTab = tab;
  
  if (tab === 'board') {
    this.loadTasks(); // 🚀 ÇÖZÜM BURADA: Görev Listesine tıklandığında veritabanından en güncel halini çek!
  }
  if (tab === 'backlog') {
    this.loadSprintsAndBacklog();
  }
  if (tab === 'stats') {
    setTimeout(() => this.renderCharts(), 150);
  }
  this.cdr.detectChanges();
}

// ➕ Yeni Sprint Oluşturma
openCreateSprintModal() { this.isCreateSprintModalOpen = true; }
closeCreateSprintModal() { this.isCreateSprintModalOpen = false; }

submitCreateSprint() {
  if (!this.newSprintName || !this.newSprintStartDate || !this.newSprintEndDate) {
    this.showToast('Lütfen gerekli alanları doldurun.', 'error');
    return;
  }

  // 🚀 ÇÖZÜM BURADA: Butona basıldığı an pencereyi kapat ki çift tıklanamasın
  this.isCreateSprintModalOpen = false;

  const dto = {
    teamId: Number(this.currentTeamId),
    name: this.newSprintName,
    goal: this.newSprintGoal,
    plannedStartDate: new Date(this.newSprintStartDate).toISOString(),
    plannedEndDate: new Date(this.newSprintEndDate).toISOString()
  };

  this.sprintService.createSprint(dto).subscribe({
    next: () => {
      this.showToast('Sprint başarıyla oluşturuldu! 🚀', 'success');
      this.newSprintName = ''; // Formu temizle
      this.newSprintGoal = '';
      this.loadSprintsAndBacklog();
    },
    error: (err: any) => this.showToast(err.error || 'Sprint oluşturulamadı.', 'error')
  });
}


// 🚀 Sprint Başlatma (İş Kuralları Kontrollü)
startSprint(sprint: any) {
  const sprintId = sprint.id || sprint.Id;
  this.sprintService.startSprint(sprintId, this.currentUserId).subscribe({
    next: () => {
      this.showToast(`'${sprint.name}' sprint'i başarıyla başlatıldı! 🔥`, 'success');
      this.loadSprintsAndBacklog();
      this.loadTasks(); // Kanban panosuna da yansıması için
    },
    error: (err) => this.showToast(err.error || 'Sprint başlatılamadı.', 'error')
  });
}

// 🏁 Sprint Tamamlama Modalı
openCompleteSprintModal(sprint: any) {
  this.sprintToCompleteId = sprint.id || sprint.Id;
  this.isCompleteSprintModalOpen = true;
}

submitCompleteSprint() {
  if (!this.sprintToCompleteId) return;

  const dto = {
    destination: this.incompleteTaskDestination,
    targetSprintId: this.incompleteTaskDestination === 'NextSprint' ? Number(this.targetNextSprintId) : null
  };

  this.sprintService.completeSprint(this.sprintToCompleteId, dto, this.currentUserId).subscribe({
    next: (res: any) => {
      this.showToast('Sprint başarıyla tamamlandı! 🏆', 'success');
      this.isCompleteSprintModalOpen = false;
      this.loadSprintsAndBacklog();
      this.loadTasks();
    },
    error: (err) => this.showToast(err.error || 'Sprint tamamlanamadı.', 'error')
  });
}

// 🔀 DRAG AND DROP (Sürükle-Bırak) ile Görevi Taşıma
onTaskDropToSprintOrBacklog(event: CdkDragDrop<any[]>, targetSprintId: number | null) {
  if (event.previousContainer === event.container) {
    moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
  } else {
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );

    const movedTask = event.container.data[event.currentIndex];
    const taskId = movedTask.id || movedTask.Id;

    // 🚀 EKLENEN SATIRLAR: Taşıma yapıldığı an hafızadaki Sprint ID'sini de güncelle
    movedTask.sprintId = targetSprintId;
    movedTask.SprintId = targetSprintId;

    // Backend API'sine Taşıma İsteği At
    this.sprintService.moveTask(taskId, { targetSprintId: targetSprintId }, this.currentUserId).subscribe({
      next: () => this.showToast('Görev konumu güncellendi.', 'success'),
      error: (err: any) => {
        this.showToast(err.error || 'Görev taşınamadı!', 'error');
        this.loadSprintsAndBacklog();
      }
    });
  }
}


deleteSprint(sprintId: number) {
  if (!confirm('Bu sprinti silmek istediğinize emin misiniz? İçindeki görevler otomatik olarak Backlog\'a düşecektir.')) return;
  
  this.sprintService.deleteSprint(sprintId).subscribe({
    next: () => {
      this.showToast('Sprint başarıyla silindi 🗑️', 'success');
      this.loadSprintsAndBacklog(); // Ekranı yenile
    },
    error: (err: any) => this.showToast('Sprint silinemedi.', 'error')
  });
}

toggleCompletedSprints() {
  this.showCompletedSprints = !this.showCompletedSprints;
  this.cdr.detectChanges();
}

}