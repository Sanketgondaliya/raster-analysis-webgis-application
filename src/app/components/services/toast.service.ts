import { Injectable } from "@angular/core";
import { MessageService } from "primeng/api";
import { ApplicationSettingService } from "./application-setting.service";

@Injectable({
  providedIn: "root",
})
export class ToastService {
  toastConfig: any;

  constructor(
    private messageService: MessageService,
    private applicationSettingService: ApplicationSettingService
  ) {
    this.toastConfig = this.applicationSettingService.settings.toastConfig;
  }

  showSuccess(detail: string) {
    const config = this.toastConfig.success;
    this.messageService.add({
      ...config,
      detail,
    });
  }

  showError(detail: string) {
    const config = this.toastConfig.error;
    this.messageService.add({
      ...config,
      detail,
    });
  }

  showInfo(detail: string) {
    const config = this.toastConfig.info;
    this.messageService.add({
      ...config,
      detail,
    });
  }

  showWarn(detail: string) {
    const config = this.toastConfig.warn;
    this.messageService.add({
      ...config,
      detail,
    });
  }
}
