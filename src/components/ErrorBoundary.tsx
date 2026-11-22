import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Erro inesperado no cifrasLara.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('SmartCifra ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendly = 'Ocorreu um problema de sincronização ou permissão com o banco de dados.';
      if (this.state.message.includes('PERMISSION_DENIED') || this.state.message.includes('Missing or insufficient permissions')) {
        friendly = 'Permissão negada ao acessar os dados do Firestore. Verifique se sua conta está autenticada.';
      } else if (this.state.message.includes('Quota exceeded')) {
        friendly = 'Cota diária gratuita do Firestore atingida. Tente novamente amanhã.';
      }

      return (
        <div className="min-h-screen smartcifra-gradient flex items-center justify-center p-6 text-white">
          <div className="max-w-md w-full bg-slate-950/75 backdrop-blur-md border border-white/15 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-300">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="font-display text-lg font-bold">Algo saiu do ritmo</h2>
            </div>
            <p className="text-sm text-blue-100/90 leading-relaxed">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Recarregar cifrasLara
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
