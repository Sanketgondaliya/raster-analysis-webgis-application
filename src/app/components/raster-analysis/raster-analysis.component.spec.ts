import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RasterAnalysisComponent } from './raster-analysis.component';

describe('RasterAnalysisComponent', () => {
  let component: RasterAnalysisComponent;
  let fixture: ComponentFixture<RasterAnalysisComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RasterAnalysisComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RasterAnalysisComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
