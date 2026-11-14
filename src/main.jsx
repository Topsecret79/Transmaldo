import React, { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  handleForceUpdate = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
      }
    } catch (e) {
      console.error(e);
    }
    window.location.href = window.location.origin + window.location.pathname + '?reload=' + Date.now();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#fee2e2', color: '#991b1b', border: '1px solid #f87171', borderRadius: '8px', margin: '20px', fontFamily: 'sans-serif' }}>
          <h2>💥 Algo ha salido mal en la aplicación</h2>
          <p>Por favor, copia este error y envíaselo al desarrollador:</p>
          <pre style={{ background: '#fef2f2', padding: '15px', border: '1px solid #fee2e2', overflowX: 'auto', whiteSpace: 'pre-wrap', color: '#991b1b' }}>
            {this.state.error ? this.state.error.toString() : 'Error desconocido'}
            {"\n\nStack:\n"}
            {this.state.error ? this.state.error.stack : ''}
          </pre>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
            <button 
              onClick={this.handleForceUpdate} 
              style={{ padding: '10px 18px', background: '#991b1b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem' }}
            >
              🔄 Limpiar Caché y Actualizar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// Registrar Service Worker para soporte PWA y auto-actualización inteligente sin borrar caché
if ('serviceWorker' in navigator) {
  let swRegistration = null;

  const checkForSwUpdate = () => {
    if (swRegistration) {
      swRegistration.update().catch(() => {});
    }
  };

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then(reg => {
        swRegistration = reg;
        console.log('SW registrado:', reg.scope);
        reg.update().catch(() => {});
      })
      .catch(err => console.warn('Fallo al registrar SW:', err));
  });

  // Comprobar nuevas versiones al volver de segundo plano, recuperar red y cada 5 minutos
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForSwUpdate();
    } else if (document.visibilityState === 'hidden' && window.__pendingSwReload) {
      window.__pendingSwReload = false;
      window.location.reload();
    }
  });
  window.addEventListener('online', checkForSwUpdate);
  window.addEventListener('pageshow', checkForSwUpdate);
  setInterval(checkForSwUpdate, 5 * 60 * 1000);

  // Recarga segura cuando el nuevo Service Worker toma el control
  let refreshing = false;
  const triggerSafeReload = () => {
    if (refreshing) return;
    const activeTag = document.activeElement?.tagName;
    const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';
    if (window.__isAppBusyForReload || isTyping) {
      console.log('Actualización lista en segundo plano; esperando a que el usuario termine su acción...');
      window.__pendingSwReload = true;
      return;
    }
    refreshing = true;
    window.__pendingSwReload = false;
    console.log('Aplicando nueva versión de la aplicación automáticamente...');
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', triggerSafeReload);
  window.addEventListener('focusout', () => {
    if (window.__pendingSwReload) {
      setTimeout(triggerSafeReload, 300);
    }
  });
}
