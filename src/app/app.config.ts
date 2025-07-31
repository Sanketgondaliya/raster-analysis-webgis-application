// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { provideRouter, withHashLocation } from '@angular/router'; // <-- import withHashLocation
import Aura from '@primeuix/themes/aura';

import { routes } from './app.routes';  // Ensure your app.routes.ts exports the routes array
import { provideHttpClient } from '@angular/common/http';
import { MessageService } from "primeng/api";
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withHashLocation()),  // <-- Enable hash-based routing
    provideAnimationsAsync(),
    provideHttpClient(),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          prefix: 'p',
          darkModeSelector: 'light',
          cssLayer: false
        }
      }
    }),
    MessageService,
  ]
};
