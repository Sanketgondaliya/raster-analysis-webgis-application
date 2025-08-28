import { TestBed } from '@angular/core/testing';

import { VectorDataService } from './vector-data.service';

describe('VectorDataService', () => {
  let service: VectorDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VectorDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
