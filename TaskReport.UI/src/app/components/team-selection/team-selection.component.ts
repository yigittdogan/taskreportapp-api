import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TeamService } from '../../services/team';

@Component({
  selector: 'app-team-selection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './team-selection.component.html',
  styleUrl: './team-selection.component.css'
})
export class TeamSelectionComponent implements OnInit {
  teams: any[] = [];
  newTeamName: string = '';
  userId!: number;
  userName: string = '';

  constructor(private teamService: TeamService, private router: Router) {}

  ngOnInit() {
    this.userId = Number(localStorage.getItem('userId')) || 0; 
    this.userName = localStorage.getItem('loggedInUser') || 'Geliştirici';

    if (this.userId === 0) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadUserTeams();
  }

  loadUserTeams() {
    this.teamService.getMyTeams(this.userId).subscribe({
      next: (data: any) => {
        this.teams = data;
      },
      error: (err: any) => console.error('Takımlar yüklenemedi:', err)
    });
  }

  onCreateTeam() {
    if (!this.newTeamName || this.newTeamName.trim() === '') return;

    this.teamService.createTeam(this.newTeamName, this.userId).subscribe({
      next: (res: any) => {
        this.newTeamName = '';
        this.loadUserTeams(); 
      },
      error: (err: any) => alert('Takım oluşturulurken bir hata oluştu!')
    });
  }

  selectTeam(teamId: number, teamName: string) {
    localStorage.setItem('selectedTeamId', teamId.toString());
    localStorage.setItem('selectedTeamName', teamName);
    this.router.navigate(['/dashboard']);
  }

  logout() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}