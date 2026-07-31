import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Tarayıcı hafızasından token'ı alıyoruz
  const token = localStorage.getItem('token');

  // Eğer token varsa, isteğin kafasına (Header) "Authorization" ekleyerek gönderiyoruz
  if (token) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(cloned);
  }

  // Token yoksa isteği olduğu gibi devam ettir
  return next(req);
};