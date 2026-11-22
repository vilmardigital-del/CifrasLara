import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  ListMusic,
  Minus,
  Moon,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Star,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ChordDiagramModal } from './ChordDiagramModal';
import type { Setlist, Song } from '../types/cifra';
import {
  extractUniqueChords,
  parseCifraContent,
  transposeKey,
} from '../utils/musicTheory';

interface CifraReaderProps {
  song: Song;
  stageDarkMode: boolean;
  setlists: Setlist[];
  stageQueue?: {
    setlistName: string;
    currentIndex: number;
    total: number;
    hasPrev: boolean;
    hasNext: boolean;
    onPrev: () => void;
    onNext: () => void;
  } | null;
  onBack: () => void;
  onEdit: () => void;
  onToggleFavorite: (song: Song) => Promise<void>;
  onSaveStageControls: (
    song: Song,
    controls: { transposeOffset: number; capo: number; bpm: number },
  ) => Promise<void>;
  onToggleStageDark: (nextVal: boolean) => Promise<void>;
  onAddToSetlist: (song: Song, setlistId: string) => Promise<void>;
}

export function CifraReader({
  song,
  stageDarkMode,
  setlists,
  stageQueue,
  onBack,
  onEdit,
  onToggleFavorite,
  onSaveStageControls,
  onToggleStageDark,
  onAddToSetlist,
}: CifraReaderProps) {
  const [transposeOffset, setTransposeOffset] = useState(song.transposeOffset);
  const [capo, setCapo] = useState(song.capo);
  const [bpm, setBpm] = useState(song.bpm);
  const [fontSize, setFontSize] = useState(16);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1);
  const [isMetronomeOn, setIsMetronomeOn] = useState(false);
  const [beatFlash, setBeatFlash] = useState(false);
  const [selectedChord, setSelectedChord] = useState<string | null>(null);
  const [showSetlistPicker, setShowSetlistPicker] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setTransposeOffset(song.transposeOffset);
    setCapo(song.capo);
    setBpm(song.bpm);
    setIsAutoScrolling(false);
    setIsMetronomeOn(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [song.id, song.transposeOffset, song.capo, song.bpm]);

  useEffect(() => {
    if (!isAutoScrolling) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    if (container.scrollHeight <= container.clientHeight + 4) {
      setIsAutoScrolling(false);
      setAddedFeedback('Toda a cifra já está visível na tela.');
      window.setTimeout(() => setAddedFeedback(null), 2500);
      return;
    }

    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 2) {
      container.scrollTop = 0;
    }

    let rafId = 0;
    let lastTime = performance.now();
    let remainder = 0;

    const step = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      const el = scrollContainerRef.current;
      if (el) {
        const pxPerSec = 24 * scrollSpeed;
        remainder += pxPerSec * dt;
        if (remainder >= 1) {
          const intPx = Math.floor(remainder);
          remainder -= intPx;
          el.scrollTop += intPx;
        }
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
          setIsAutoScrolling(false);
          return;
        }
      }
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [isAutoScrolling, scrollSpeed]);

  useEffect(() => {
    if (!isMetronomeOn) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioCtxRef.current && AudioCtx) {
      audioCtxRef.current = new AudioCtx();
    }

    const playClick = () => {
      const ctx = audioCtxRef.current;
      if (ctx) {
        if (ctx.state === 'suspended') {
          void ctx.resume();
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(980, ctx.currentTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.055);
      }
      setBeatFlash(true);
      window.setTimeout(() => setBeatFlash(false), 90);
    };

    playClick();
    const intervalMs = Math.max(250, Math.round(60000 / Math.max(40, bpm)));
    const timer = window.setInterval(playClick, intervalMs);
    return () => window.clearInterval(timer);
  }, [isMetronomeOn, bpm]);

  const currentKey = useMemo(
    () => transposeKey(song.originalKey, transposeOffset),
    [song.originalKey, transposeOffset],
  );

  const parsedLines = useMemo(
    () => parseCifraContent(song.content, transposeOffset, currentKey),
    [song.content, transposeOffset, currentKey],
  );

  const uniqueChords = useMemo(
    () => extractUniqueChords(song.content, transposeOffset, currentKey),
    [song.content, transposeOffset, currentKey],
  );

  const commitControls = (nextTranspose: number, nextCapo: number, nextBpm: number) => {
    setTransposeOffset(nextTranspose);
    setCapo(nextCapo);
    setBpm(nextBpm);
    void onSaveStageControls(song, {
      transposeOffset: nextTranspose,
      capo: nextCapo,
      bpm: nextBpm,
    });
  };

  const handleTranspose = (delta: number) => {
    let next = transposeOffset + delta;
    if (next > 11) next -= 12;
    if (next < -11) next += 12;
    commitControls(next, capo, bpm);
  };

  return (
    <div
      className={`h-screen overflow-hidden flex flex-col transition-colors ${
        stageDarkMode
          ? 'bg-slate-950 text-slate-100'
          : 'bg-slate-50 text-slate-900'
      }`}
    >
      <header
        className={`sticky top-0 z-30 border-b px-4 sm:px-6 py-3 flex items-center justify-between gap-4 backdrop-blur-md ${
          stageDarkMode
            ? 'bg-slate-950/90 border-slate-800'
            : 'bg-white/90 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-display text-base sm:text-lg font-bold truncate">
              {song.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {song.artist} · {song.genre} · {song.timeSignature}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => void onToggleFavorite(song)}
            aria-label={song.isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            <Star
              className={`w-5 h-5 ${
                song.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
              }`}
            />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSetlistPicker((p) => !p)}
              aria-label="Adicionar ao repertório"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            >
              <ListMusic className="w-5 h-5" />
            </button>

            {showSetlistPicker && (
              <div
                className={`absolute right-0 mt-2 w-60 rounded-2xl border p-2 shadow-xl z-40 ${
                  stageDarkMode
                    ? 'bg-slate-900 border-slate-700 text-white'
                    : 'bg-white border-slate-200 text-slate-900'
                }`}
              >
                <p className="text-xs font-medium text-slate-500 px-2 py-1.5">
                  Adicionar ao repertório
                </p>
                {setlists.map((sl) => (
                  <button
                    key={sl.id}
                    type="button"
                    onClick={async () => {
                      await onAddToSetlist(song, sl.id);
                      setShowSetlistPicker(false);
                      setAddedFeedback(`Adicionada em "${sl.name}"`);
                      window.setTimeout(() => setAddedFeedback(null), 2500);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-blue-600 hover:text-white transition-colors truncate"
                  >
                    {sl.name}
                  </button>
                ))}
                {setlists.length === 0 && (
                  <p className="text-xs text-slate-500 px-2 py-2">
                    Crie um repertório primeiro na aba Repertórios.
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void onToggleStageDark(!stageDarkMode)}
            aria-label="Alternar modo palco escuro"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            {stageDarkMode ? <Sun className="w-5 h-5 text-amber-300" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={onEdit}
            aria-label="Editar cifra"
            className="min-h-[44px] px-3 flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors whitespace-nowrap"
          >
            <Edit3 className="w-4 h-4" />
            <span className="hidden sm:inline">Editar</span>
          </button>
        </div>
      </header>

      <div
        className={`border-b px-4 sm:px-6 py-2.5 ${
          stageDarkMode ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
              <button
                type="button"
                onClick={() => handleTranspose(-1)}
                aria-label="Descer meio tom"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="px-2.5 text-xs font-mono font-semibold tabular-nums whitespace-nowrap text-slate-900 dark:text-white">
                Tom {currentKey}
              </span>
              <button
                type="button"
                onClick={() => handleTranspose(1)}
                aria-label="Subir meio tom"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                <Plus className="w-4 h-4" />
              </button>
              {transposeOffset !== 0 && (
                <button
                  type="button"
                  onClick={() => commitControls(0, capo, bpm)}
                  aria-label="Restaurar tom original"
                  className="min-h-[36px] px-2 flex items-center justify-center rounded-lg text-xs text-blue-600 dark:text-sky-400 hover:bg-white dark:hover:bg-slate-700"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span>Capo</span>
              <select
                value={capo}
                onChange={(e) => commitControls(transposeOffset, Number(e.target.value), bpm)}
                className="min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
              >
                <option value={0}>Sem capo</option>
                {Array.from({ length: 11 }).map((_, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {idx + 1}ª casa
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setIsAutoScrolling((s) => !s)}
                className={`min-h-[36px] px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  isAutoScrolling
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700'
                }`}
              >
                {isAutoScrolling ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                Rolagem
              </button>
              <select
                value={scrollSpeed}
                onChange={(e) => setScrollSpeed(Number(e.target.value))}
                aria-label="Velocidade de rolagem"
                className="min-h-[36px] bg-transparent px-1.5 text-xs font-mono tabular-nums text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value={0.5}>0.5x</option>
                <option value={1}>1.0x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2.0x</option>
                <option value={3}>3.0x</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setIsMetronomeOn((m) => !m)}
              className={`min-h-[38px] px-3 rounded-xl flex items-center gap-1.5 text-xs font-mono tabular-nums border transition-colors whitespace-nowrap ${
                isMetronomeOn
                  ? beatFlash
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-sky-300 border-blue-300 dark:border-blue-700'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
            >
              {isMetronomeOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              {bpm} BPM
            </button>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setFontSize((f) => Math.max(13, f - 1))}
                className="min-h-[36px] px-2.5 text-xs font-medium rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => setFontSize((f) => Math.min(24, f + 1))}
                className="min-h-[36px] px-2.5 text-xs font-medium rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                A+
              </button>
            </div>
          </div>
        </div>
      </div>

      {addedFeedback && (
        <div className="bg-blue-600 text-white text-xs font-medium text-center py-2 px-4">
          {addedFeedback}
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-6 pb-[40vh]"
      >
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8">
            {song.notes && (
              <p
                className={`mb-6 text-sm leading-relaxed pb-4 border-b ${
                  stageDarkMode
                    ? 'text-slate-300 border-slate-800'
                    : 'text-slate-600 border-slate-200'
                }`}
              >
                <span className="font-semibold">Notas de execução:</span> {song.notes}
              </p>
            )}

            <div
              className="space-y-3 leading-relaxed"
              style={{ fontSize: `${fontSize}px` }}
            >
              {parsedLines.map((line, lineIdx) => {
                if (line.type === 'empty') {
                  return <div key={lineIdx} className="h-4" />;
                }

                if (line.type === 'section') {
                  return (
                    <h2
                      key={lineIdx}
                      className={`pt-4 pb-1 font-display text-sm font-bold tracking-wide ${
                        stageDarkMode ? 'text-sky-400' : 'text-blue-700'
                      }`}
                    >
                      {line.sectionTitle}
                    </h2>
                  );
                }

                return (
                  <div key={lineIdx} className="flex flex-wrap items-end leading-tight">
                    {line.tokens.map((tok, tokIdx) => (
                      <span
                        key={tokIdx}
                        className="inline-flex flex-col items-start whitespace-pre-wrap"
                      >
                        {tok.chord ? (
                          <button
                            type="button"
                            onClick={() => setSelectedChord(tok.chord)}
                            className={`font-mono font-bold text-[0.88em] leading-none mb-1 mr-1.5 rounded px-1 -ml-1 py-0.5 transition-colors ${
                              stageDarkMode
                                ? 'text-sky-400 hover:bg-sky-400/15'
                                : 'text-blue-700 hover:bg-blue-100'
                            }`}
                          >
                            {tok.chord}
                          </button>
                        ) : (
                          <span className="text-[0.88em] leading-none mb-1 opacity-0 select-none" aria-hidden="true">
                            &nbsp;
                          </span>
                        )}
                        <span>{tok.lyric || ' '}</span>
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          <aside
            className={`lg:col-span-4 rounded-2xl border p-5 ${
              stageDarkMode
                ? 'bg-slate-900 border-slate-800'
                : 'bg-white border-slate-200'
            }`}
          >
            <h3 className="font-display text-sm font-bold mb-1">Acordes desta música</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Toque em qualquer acorde na cifra ou abaixo para abrir o diagrama no braço do violão.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {uniqueChords.map((chord) => (
                <button
                  key={chord}
                  type="button"
                  onClick={() => setSelectedChord(chord)}
                  className={`min-h-[44px] rounded-xl border font-mono text-sm font-semibold transition-colors ${
                    stageDarkMode
                      ? 'border-slate-700 bg-slate-800 text-sky-400 hover:border-sky-500'
                      : 'border-slate-200 bg-slate-50 text-blue-700 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  {chord}
                </button>
              ))}
            </div>
          </aside>
        </div>
      </div>

      {stageQueue && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-30 border-t px-4 py-3 backdrop-blur-md ${
            stageDarkMode
              ? 'bg-slate-950/95 border-slate-800 text-white'
              : 'bg-white/95 border-slate-200 text-slate-900'
          }`}
        >
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={!stageQueue.hasPrev}
              onClick={stageQueue.onPrev}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 text-xs font-medium disabled:opacity-35"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
            <div className="text-center min-w-0">
              <p className="text-xs font-medium truncate">{stageQueue.setlistName}</p>
              <p className="text-xs text-slate-500 tabular-nums">
                Música {stageQueue.currentIndex + 1} de {stageQueue.total}
              </p>
            </div>
            <button
              type="button"
              disabled={!stageQueue.hasNext}
              onClick={stageQueue.onNext}
              className="min-h-[44px] px-4 rounded-xl bg-blue-600 text-white flex items-center gap-1.5 text-xs font-medium disabled:opacity-35"
            >
              Próxima
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <ChordDiagramModal chordName={selectedChord} onClose={() => setSelectedChord(null)} />
    </div>
  );
}
