import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Registrar Service Worker para soporte PWA y recarga automática en actualizaciones
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('SW registrado:', reg.scope);
      })
      .catch(err => console.warn('Fallo al registrar SW:', err));
  });

  // Escuchar cuando el nuevo SW toma el control y recargar la página para aplicar los cambios
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      console.log('Detectada actualización de la app. Recargando...');
      window.location.reload();
    }
  });
}
