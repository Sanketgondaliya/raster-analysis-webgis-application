import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GeoserverComponent } from './geoserver.component';

describe('GeoserverComponent', () => {
  let component: GeoserverComponent;
  let fixture: ComponentFixture<GeoserverComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GeoserverComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GeoserverComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
