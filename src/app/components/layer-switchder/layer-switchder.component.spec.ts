import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LayerSwitchderComponent } from './layer-switchder.component';

describe('LayerSwitchderComponent', () => {
  let component: LayerSwitchderComponent;
  let fixture: ComponentFixture<LayerSwitchderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LayerSwitchderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LayerSwitchderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
