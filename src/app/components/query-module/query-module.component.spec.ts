import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QueryModuleComponent } from './query-module.component';

describe('QueryModuleComponent', () => {
  let component: QueryModuleComponent;
  let fixture: ComponentFixture<QueryModuleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QueryModuleComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QueryModuleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
