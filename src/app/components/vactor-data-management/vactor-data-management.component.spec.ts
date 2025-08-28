import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VectorDataManagementComponent } from './vactor-data-management.component';

describe('VectorDataManagementComponent', () => {
  let component: VectorDataManagementComponent;
  let fixture: ComponentFixture<VectorDataManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VectorDataManagementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VectorDataManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
