import { TestBed } from '@angular/core/testing';

import { ApplicationSettingService } from './application-setting.service';

describe('ApplicationSettingService', () => {
  let service: ApplicationSettingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ApplicationSettingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
