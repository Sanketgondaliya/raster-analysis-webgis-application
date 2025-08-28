import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VactorDataManagementComponent } from './vactor-data-management.component';

describe('VactorDataManagementComponent', () => {
  let component: VactorDataManagementComponent;
  let fixture: ComponentFixture<VactorDataManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VactorDataManagementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VactorDataManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
