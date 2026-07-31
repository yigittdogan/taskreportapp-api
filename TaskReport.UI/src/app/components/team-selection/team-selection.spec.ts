import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamSelection } from './team-selection';

describe('TeamSelection', () => {
  let component: TeamSelection;
  let fixture: ComponentFixture<TeamSelection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamSelection],
    }).compileComponents();

    fixture = TestBed.createComponent(TeamSelection);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
