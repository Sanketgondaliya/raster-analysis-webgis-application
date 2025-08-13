import { TestBed } from '@angular/core/testing';

import { RasterGlobalMethodService } from './raster-global-method.service';

describe('RasterGlobalMethodService', () => {
  let service: RasterGlobalMethodService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RasterGlobalMethodService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
