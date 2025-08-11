import { TestBed } from '@angular/core/testing';

import { RasteranalysisService } from './rasteranalysis.service';

describe('RasteranalysisService', () => {
  let service: RasteranalysisService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RasteranalysisService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
