import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  HelpCircle,
  Loader2,
  Mic,
  MicOff,
  MoreHorizontal,
  Music2,
  Search,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { SmartCifraLogo } from './SmartCifraLogo';
import type { Setlist, Song, VoiceLog } from '../types/cifra';

export interface AssistantActionResult {
  intent: string;
  reply: string;
  songId?: string;
  setlistId?: string;
  transposeDelta?: number;
  setlistName?: string;
  searchQuery?: string;
  generatedSong?: {
    title: string;
    artist: string;
    genre: string;
    originalKey: string;
    bpm: number;
    timeSignature: string;
    difficulty: string;
    content: string;
  };
}

interface VoiceAssistantHubProps {
  songs: Song[];
  setlists: Setlist[];
  voiceLogs: VoiceLog[];
  activeSong: Song | null;
  onNavigateLibrary: (initialSearch?: string) => void;
  onNavigateSetlists: () => void;
  onOpenSong: (song: Song) => void;
  onNewSong: () => void;
  onExecuteAssistantAction: (transcript: string, result: AssistantActionResult) => Promise<void>;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
}

const EXAMPLE_COMMANDS = [
  'Abrir Tempo Perdido',
  'Criar repertório Acústico de Domingo',
  'Gerar cifra de Asa Branca',
  'Quais acordes formam o campo harmônico de Sol?',
];

export function VoiceAssistantHub({
  songs,
  setlists,
  voiceLogs,
  activeSong,
  onNavigateLibrary,
  onNavigateSetlists,
  onOpenSong,
  onNewSong,
  onExecuteAssistantAction,
}: VoiceAssistantHubProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [assistantReply, setAssistantReply] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showQuickSearch, setShowQuickSearch] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore cleanup error
      }
    };
  }, []);

  const submitCommand = async (rawText: string) => {
    const transcript = rawText.trim();
    if (!transcript || isProcessing) return;

    setErrorMsg(null);
    setIsProcessing(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          songs: songs.map((s) => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
            originalKey: s.originalKey,
          })),
          setlists: setlists.map((sl) => ({ id: sl.id, name: sl.name })),
          activeSongTitle: activeSong?.title ?? null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Não foi possível interpretar o comando.');
      }

      const result = data as AssistantActionResult;
      setAssistantReply(result.reply);
      setCommandInput('');
      await onExecuteAssistantAction(transcript, result);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Erro ao conectar com o assistente inteligente.',
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleMicrophone = () => {
    setErrorMsg(null);

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setErrorMsg(
        'Reconhecimento de voz nativo indisponível neste navegador. Digite seu comando abaixo.',
      );
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'pt-BR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const spoken = event.results?.[0]?.[0]?.transcript;
        setIsListening(false);
        if (spoken) {
          setCommandInput(spoken);
          void submitCommand(spoken);
        }
      };

      recognition.onerror = (ev) => {
        setIsListening(false);
        if (ev.error !== 'aborted') {
          setErrorMsg('Não foi possível captar o áudio. Verifique a permissão do microfone ou digite abaixo.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      setIsListening(true);
      recognition.start();
    } catch {
      setIsListening(false);
      setErrorMsg('Erro ao iniciar o microfone. Digite seu comando abaixo.');
    }
  };

  const quickFilteredSongs = quickQuery.trim()
    ? songs.filter(
        (s) =>
          s.title.toLowerCase().includes(quickQuery.toLowerCase()) ||
          s.artist.toLowerCase().includes(quickQuery.toLowerCase()),
      )
    : songs.slice(0, 5);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] lg:min-h-screen smartcifra-gradient text-white flex flex-col overflow-hidden">
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-8 h-14">
        <button
          type="button"
          onClick={() => onNavigateLibrary()}
          aria-label="Voltar para biblioteca de cifras"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowQuickSearch((prev) => !prev)}
            aria-label="Buscar cifra"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <Search className="w-5 h-5 text-white" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu((prev) => !prev)}
              aria-label="Mais opções"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            >
              <MoreHorizontal className="w-5 h-5 text-white" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-slate-950/95 backdrop-blur-md border border-white/15 rounded-2xl p-1.5 shadow-2xl z-30">
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onNewSong();
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-white hover:bg-white/10 transition-colors"
                >
                  Nova cifra manual
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onNavigateLibrary();
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-white hover:bg-white/10 transition-colors"
                >
                  Ver todas as cifras
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onNavigateSetlists();
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-white hover:bg-white/10 transition-colors"
                >
                  Meus repertórios
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showQuickSearch && (
        <div className="relative z-20 mx-4 sm:mx-8 mb-4 bg-slate-950/75 backdrop-blur-md border border-white/15 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-blue-300 shrink-0" />
            <input
              type="text"
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              placeholder="Buscar cifra ou artista..."
              autoFocus
              className="w-full bg-transparent text-sm text-white placeholder:text-blue-200/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowQuickSearch(false)}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {quickFilteredSongs.map((song) => (
              <button
                key={song.id}
                type="button"
                onClick={() => {
                  setShowQuickSearch(false);
                  onOpenSong(song);
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/10 text-left transition-colors"
              >
                <span className="text-sm font-medium truncate pr-3">
                  {song.title} <span className="text-blue-200/75 font-normal">· {song.artist}</span>
                </span>
                <span className="text-xs font-mono text-blue-200 shrink-0">{song.originalKey}</span>
              </button>
            ))}
            {quickFilteredSongs.length === 0 && (
              <p className="text-xs text-blue-200/75 px-3 py-2">Nenhuma música encontrada.</p>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 px-5 sm:px-10 pb-24 lg:pb-10 items-center max-w-6xl w-full mx-auto">
        <div className="lg:col-span-7 flex flex-col items-center justify-center text-center py-4 sm:py-8">
          <SmartCifraLogo variant="light" size="lg" />

          <div className="mt-7 flex items-center justify-center gap-2">
            <h1 className="font-display text-lg sm:text-xl font-semibold text-white tracking-tight">
              Como posso ajudar?
            </h1>
            <button
              type="button"
              onClick={() => setShowHelp((prev) => !prev)}
              aria-label="Ajuda e comandos de voz"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="relative mt-7 mb-4 flex items-center justify-center">
            {isListening && (
              <span
                aria-hidden="true"
                className="absolute w-28 h-28 rounded-full bg-blue-400/40 animate-mic-ripple"
              />
            )}
            <button
              type="button"
              onClick={toggleMicrophone}
              disabled={isProcessing}
              aria-label={isListening ? 'Parar escuta' : 'Falar comando'}
              className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300/60 ${
                isListening
                  ? 'bg-sky-400 shadow-[0_0_48px_rgba(56,189,248,0.85)] scale-105'
                  : 'bg-[#1D63FF] hover:bg-[#2B70FF] shadow-[0_0_38px_rgba(37,99,235,0.65)] active:scale-95'
              }`}
            >
              {isProcessing ? (
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              ) : isListening ? (
                <MicOff className="w-8 h-8 text-slate-950" />
              ) : (
                <Mic className="w-8 h-8 text-white" />
              )}
            </button>
          </div>

          <p className="text-sm font-medium text-blue-100/90 min-h-[20px]">
            {isProcessing
              ? 'Processando comando...'
              : isListening
                ? 'Ouvindo...'
                : 'Toque para falar ou digite abaixo'}
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitCommand(commandInput);
            }}
            className="mt-6 w-full max-w-md flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-1.5 focus-within:border-blue-300 transition-colors"
          >
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder="Ex: Abrir Evidências ou gerar cifra..."
              className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder:text-blue-200/70 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isProcessing || !commandInput.trim()}
              aria-label="Enviar comando"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white text-blue-900 hover:bg-blue-50 disabled:opacity-40 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {assistantReply && (
            <div className="mt-4 w-full max-w-md bg-slate-950/55 border border-white/15 rounded-2xl px-4 py-3 text-left text-sm text-blue-50 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{assistantReply}</p>
            </div>
          )}

          {errorMsg && (
            <div className="mt-4 w-full max-w-md bg-rose-950/70 border border-rose-400/30 rounded-2xl px-4 py-3 text-left text-sm text-rose-100">
              {errorMsg}
            </div>
          )}

          <div className="mt-6 w-full max-w-md">
            <p className="text-xs text-blue-200/75 mb-2.5">Sugestões rápidas</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EXAMPLE_COMMANDS.map((cmd) => (
                <button
                  key={cmd}
                  type="button"
                  onClick={() => void submitCommand(cmd)}
                  disabled={isProcessing}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs text-left text-blue-50 transition-colors truncate"
                >
                  “{cmd}”
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-5">
          <div className="bg-slate-950/45 backdrop-blur-md border border-white/15 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-base font-semibold text-white">
                Acesso rápido ao repertório
              </h2>
              <button
                type="button"
                onClick={() => onNavigateLibrary()}
                className="text-xs font-medium text-blue-200 hover:text-white transition-colors"
              >
                Ver todas ({songs.length})
              </button>
            </div>
            <div className="divide-y divide-white/10">
              {songs.slice(0, 4).map((song) => (
                <button
                  key={song.id}
                  type="button"
                  onClick={() => onOpenSong(song)}
                  className="w-full min-h-[52px] py-2.5 flex items-center justify-between gap-3 text-left hover:bg-white/5 px-2 -mx-2 rounded-xl transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{song.title}</p>
                    <p className="text-xs text-blue-200/75 truncate">
                      {song.artist} · Tom {song.originalKey} · {song.bpm} BPM
                    </p>
                  </div>
                  <Music2 className="w-4 h-4 text-blue-300 shrink-0" />
                </button>
              ))}
              {songs.length === 0 && (
                <p className="text-xs text-blue-200/75 py-4">
                  Suas cifras organizadas aparecerão aqui.
                </p>
              )}
            </div>
          </div>

          <div className="bg-slate-950/45 backdrop-blur-md border border-white/15 rounded-2xl p-5">
            <h2 className="font-display text-base font-semibold text-white mb-3">
              Últimos comandos no Firebase
            </h2>
            <div className="space-y-2.5 max-h-52 overflow-y-auto">
              {voiceLogs.slice(0, 4).map((log) => (
                <div
                  key={log.id}
                  className="text-xs border-b border-white/10 last:border-b-0 pb-2.5 last:pb-0"
                >
                  <p className="font-medium text-white">“{log.transcript}”</p>
                  <p className="text-blue-200/80 mt-0.5">{log.responseSummary}</p>
                </div>
              ))}
              {voiceLogs.length === 0 && (
                <p className="text-xs text-blue-200/75">
                  Nenhum comando registrado ainda. Experimente falar ou digitar acima.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full sm:max-w-md bg-slate-900 border border-white/15 rounded-t-3xl sm:rounded-2xl p-6 text-white space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Comandos de voz cifrasLara</h3>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ul className="space-y-2.5 text-sm text-blue-100/90">
              <li>• <strong>Abrir música:</strong> “Abrir Evidências” ou “Tocar Tempo Perdido”</li>
              <li>• <strong>Transpor tom:</strong> “Subir 1 tom” ou “Descer meio tom”</li>
              <li>• <strong>Criar cifra com IA:</strong> “Gerar cifra de Asa Branca em Sol”</li>
              <li>• <strong>Organizar repertório:</strong> “Criar repertório Culto de Domingo”</li>
              <li>• <strong>Dúvidas musicais:</strong> “Quais acordes do campo harmônico de Ré?”</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
