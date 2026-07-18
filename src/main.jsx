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
          <button onClick={() => window.location.reload(true)} style={{ marginTop: '10px', padding: '8px 16px', background: '#991b1b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            🔄 Recargar Aplicación
          </button>
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
