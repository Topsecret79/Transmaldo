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
    const msg = String(error?.message || error || '');
    const isChunkError =
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('ChunkLoadError') ||
      msg.includes('Loading chunk');
    if (isChunkError && !sessionStorage.getItem('delivery_chunk_auto_reloaded')) {
      sessionStorage.setItem('delivery_chunk_auto_reloaded', '1');
      this.handleForceUpdate();
    }
  }

  handleSoftRecover = () => {
    try {
      localStorage.removeItem('delivery_form_draft');
      localStorage.removeItem('delivery_active_tab');
    } catch (_) {}
    this.setState({ hasError: false, error: null });
  };

  handleForceUpdate = async () => {
    try {
      localStorage.removeItem('delivery_form_draft');
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
        <div style={{ padding: '20px', background: '#1e1b4b', color: '#f8fafc', border: '1px solid #6366f1', borderRadius: '12px', margin: '20px', fontFamily: 'sans-serif', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          <h2 style={{ marginTop: 0, color: '#a5b4fc' }}>🛡️ Modo de Recuperación Automática</h2>
          <p style={{ fontSize: '0.92rem', color: '#cbd5e1' }}>
            La aplicación ha interceptado un fallo puntual para proteger tu sesión y tus repartos guardados. Pulsa <strong>Recuperar Pantalla</strong> para continuar trabajando al instante:
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px', marginBottom: '14px' }}>
            <button 
              onClick={this.handleSoftRecover} 
              style={{ padding: '10px 18px', background: '#10b981', color: '#0f172a', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '0.95rem' }}
            >
              ⚡ Recuperar Pantalla (Sin Cerrar Sesión)
            </button>
            <button 
              onClick={this.handleForceUpdate} 
              style={{ padding: '10px 18px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.95rem' }}
            >
              🔄 Limpiar Caché y Actualizar Aplicación
            </button>
          </div>
          <details style={{ marginTop: '10px', fontSize: '0.8rem', color: '#94a3b8' }}>
            <summary style={{ cursor: 'pointer', fontWeight: '600' }}>Ver detalle técnico del error</summary>
            <pre style={{ background: 'rgba(0,0,0,0.35)', padding: '12px', borderRadius: '8px', overflowX: 'auto', whiteSpace: 'pre-wrap', color: '#fca5a5', marginTop: '8px' }}>
              {this.state.error ? this.state.error.toString() : 'Error desconocido'}
              {"\n\nStack:\n"}
              {this.state.error ? this.state.error.stack : ''}
            </pre>
          </details>
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
