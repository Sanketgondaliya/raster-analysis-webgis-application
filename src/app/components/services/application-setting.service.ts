import { Injectable } from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class ApplicationSettingService {
  settings = {
    toastConfig: {
      success: {
        severity: "success",
        summary: "Success",
        life: 1500,
        closable: true,
        sticky: false,
        icon: "pi pi-check",
        styleClass: "custom-toast-success",
      },
      error: {
        severity: "error",
        summary: "Error",
        life: 1500,
        closable: true,
        sticky: false,
        icon: "pi pi-times",
        styleClass: "custom-toast-error",
      },
      info: {
        severity: "info",
        summary: "Information",
        life: 1500,
        closable: true,
        sticky: false,
        icon: "pi pi-info-circle",
        styleClass: "custom-toast-info",
      },
      warn: {
        severity: "warn",
        summary: "Warning",
        life: 1500,
        closable: true,
        sticky: false,
        icon: "pi pi-exclamation-triangle",
        styleClass: "custom-toast-warn",
      },
    },
    themeConfig: [],
    languageConfig: [],
  };
  projectName:string='';
}
