import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard';
import { TeamSelectionComponent } from './components/team-selection/team-selection.component';
import { AcceptInviteComponent } from './components/accept-invite/accept-invite'; 

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'team-selection', component: TeamSelectionComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'accept-invitation', component: AcceptInviteComponent }, // <--- GÜVENLİ YERE TAŞINDI!
  { path: '**', redirectTo: 'login' } // <--- JOKER HER ZAMAN EN SONDA OLMALI!
];