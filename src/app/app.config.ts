import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { definePreset, palette } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth, connectAuthEmulator } from '@angular/fire/auth';
import { getFirestore, provideFirestore, connectFirestoreEmulator } from '@angular/fire/firestore';
import { getFunctions, provideFunctions, connectFunctionsEmulator } from '@angular/fire/functions';
import { getStorage, provideStorage, connectStorageEmulator } from '@angular/fire/storage';
import { ConfirmationService, MessageService } from 'primeng/api';

// Custom theme preset with pink primary color and dark surfaces
// IMPORTANT: PrimeNG convention - surface.0 = lightest (for form backgrounds), surface.950 = darkest
const AppTheme = definePreset(Aura, {
  semantic: {
    primary: palette('#f637e3'), // Pink primary color
    colorScheme: {
      dark: {
        surface: {
          // Following PrimeNG convention: 0 = lightest, 950 = darkest
          0: '#FAFAFA',
          50: '#E4E4E7',
          100: '#D4D4D8',
          200: '#A1A1AA',
          300: '#71717A',
          400: '#52525B',
          500: '#3F3F46',
          600: '#2E2E2E',
          700: '#262626',
          800: '#1A1A1A',
          900: '#161616',
          950: '#0F0F0F'
        }
      }
    }
  },
  components: {
    // DataTable - transparent backgrounds
    datatable: {
      header: {
        background: 'transparent'
      },
      row: {
        background: 'transparent'
      }
    },
  }
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: AppTheme,
        options: {
          darkModeSelector: '.dark',
          cssLayer: {
            name: 'primeng',
            order: 'theme, base, primeng'
          }
        }
      }
    }),
    ConfirmationService,
    MessageService,
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => {
      const auth = getAuth();
      if (environment.useEmulators) {
        connectAuthEmulator(auth, `http://localhost:${environment.emulators.auth}`, { disableWarnings: true });
      }
      return auth;
    }),
    provideFirestore(() => {
      const firestore = getFirestore();
      if (environment.useEmulators) {
        connectFirestoreEmulator(firestore, 'localhost', environment.emulators.firestore);
      }
      return firestore;
    }),
    provideFunctions(() => {
      const functions = getFunctions();
      if (environment.useEmulators) {
        connectFunctionsEmulator(functions, 'localhost', environment.emulators.functions);
      }
      return functions;
    }),
    provideStorage(() => {
      const storage = getStorage();
      if (environment.useEmulators) {
        connectStorageEmulator(storage, 'localhost', environment.emulators.storage);
      }
      return storage;
    })
  ]
};
