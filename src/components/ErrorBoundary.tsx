import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

/**
 * Global Error Boundary — prevents white screens.
 * If any component throws, we show a friendly fallback instead of a blank page.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };
  props: ErrorBoundaryProps;

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, message: error?.message || String(error) };
  }

  componentDidCatch(error: any, info: any) {
    console.error('[ErrorBoundary] Captured error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#F4F6FA] p-6 font-sans">
          <div className="w-full max-w-md rounded-[22px] bg-white border border-[#E6E9F0] shadow-[0px_10px_30px_rgba(0,0,0,0.03)] p-8 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EBF5FF] text-3xl">⚠️</div>
            <h2 className="text-lg font-extrabold text-[#1C1E21]">Algo salió mal</h2>
            <p className="text-sm text-[#8A94A6]">
              Ocurrió un error inesperado en la aplicación. Recarga la página para continuar.
            </p>
            {this.state.message && (
              <pre className="max-h-24 overflow-auto rounded-xl bg-[#F7F8FA] border border-[#E6E9F0] p-2 text-[10px] text-left text-[#1C1E21] font-mono whitespace-pre-wrap">
                {this.state.message}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="mt-2 rounded-xl bg-[#0084FF] px-5 py-2.5 text-sm font-black text-white hover:bg-blue-600 transition-colors cursor-pointer"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
