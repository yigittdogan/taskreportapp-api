import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './auth.interceptor'; // Yeni oluşturduğumuz interceptor'ı import et

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    // provideHttpClient kısmını aşağıdaki gibi 'withInterceptors' ile güncelle:
    provideHttpClient(
      withInterceptors([authInterceptor])
    )
  ]
};