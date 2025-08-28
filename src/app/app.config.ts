// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { provideRouter, withHashLocation } from '@angular/router';
import Aura from '@primeuix/themes/aura';
import Nora from '@primeuix/themes/nora';
import Material from '@primeuix/themes/material';
import Lara from '@primeuix/themes/lara';

import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { MessageService } from "primeng/api";
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { LoadingInterceptor } from './services/loading.interceptor';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withHashLocation()),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptorsFromDi()), // <-- Important for DI interceptors
    providePrimeNG({
      theme: {
        preset: Nora,
        options: {
          prefix: 'p',
          darkModeSelector: 'light',
          cssLayer: false
        }
      }
    }),
    MessageService,
    { provide: HTTP_INTERCEPTORS, useClass: LoadingInterceptor, multi: true } // <-- Register interceptor
  ]
};
