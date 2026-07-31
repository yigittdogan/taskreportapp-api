import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'] 
})
export class SidebarComponent {
  @Input() isCollapsed: boolean = false;
  @Input() userName: string = '';
  
  // activeTab tipini güncelledik
  @Input() activeTab: 'board' | 'stats' | 'profile' | 'calendar' | 'backlog' = 'board';
  @Input() isDarkTheme: boolean = false;

  // 🚀 DÜZELTME BURADA: EventEmitter içerisine 'backlog' eklendi!
  @Output() tabChange = new EventEmitter<'board' | 'stats' | 'profile' | 'calendar' | 'backlog'>();
  
  @Output() toggleTheme = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  // 🚀 DÜZELTME BURADA: Parametre tipleri temizlendi
  selectTab(tab: 'board' | 'stats' | 'profile' | 'calendar' | 'backlog') {
    this.tabChange.emit(tab);
  }
}