import { useState } from 'react';
import { X } from 'lucide-react';
import {
  ALLOWED_DIFFICULTIES,
  BLUEPRINT_LIMITS,
  type DifficultyLevel,
  type Song,
} from '../types/cifra';
import type { SongInput } from '../services/firestoreCifraService';

interface SongEditorModalProps {
  initialSong?: Song | null;
  onClose: () => void;
  onSave: (input: SongInput) => Promise<void>;
}

const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B', 'Am', 'Bm', 'Cm', 'Dm', 'Em', 'F#m', 'Gm'];

export function SongEditorModal({ initialSong, onClose, onSave }: SongEditorModalProps) {
  const [title, setTitle] = useState(initialSong?.title ?? '');
  const [artist, setArtist] = useState(initialSong?.artist ?? '');
  const [genre, setGenre] = useState(initialSong?.genre ?? 'MPB');
  const [originalKey, setOriginalKey] = useState(initialSong?.originalKey ?? 'G');
  const [capo, setCapo] = useState(initialSong?.capo ?? 0);
  const [bpm, setBpm] = useState(initialSong?.bpm ?? 92);
  const [timeSignature, setTimeSignature] = useState(initialSong?.timeSignature ?? '4/4');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(
    initialSong?.difficulty ?? 'Intermediário',
  );
  const [notes, setNotes] = useState(initialSong?.notes ?? '');
  const [content, setContent] = useState(
    initialSong?.content ??
      `[Intro]\n[G]  [D/F#]  [Em]  [C9]\n\n[Verso 1]\n[G]Escreva sua letra com [D/F#]acordes entre colchetes\n[Em]Para transpor [C9]automaticamente`,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const insertToken = (token: string) => {
    setContent((prev) => `${prev}${prev.endsWith(' ') || prev.endsWith('\n') ? '' : ' '}${token}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !artist.trim() || !content.trim()) {
      setError('Preencha título, artista e o conteúdo da cifra.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({
        title,
        artist,
        genre,
        originalKey,
        transposeOffset: initialSong?.transposeOffset ?? 0,
        capo,
        bpm,
        timeSignature,
        difficulty,
        isFavorite: initialSong?.isFavorite ?? false,
        content,
        notes,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar cifra.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            {initialSong ? 'Editar cifra' : 'Nova cifra'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Título da música</span>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.MAX_TITLE_LEN}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Ex: Tempo Perdido"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Artista / Intérprete</span>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.MAX_ARTIST_LEN}
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                required
                placeholder="Ex: Legião Urbana"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Tom</span>
              <select
                value={originalKey}
                onChange={(e) => setOriginalKey(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm font-mono text-slate-900 dark:text-white"
              >
                {KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Capo</span>
              <input
                type="number"
                min={BLUEPRINT_LIMITS.MIN_CAPO}
                max={BLUEPRINT_LIMITS.MAX_CAPO}
                value={capo}
                onChange={(e) => setCapo(Number(e.target.value))}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm font-mono text-slate-900 dark:text-white"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">BPM</span>
              <input
                type="number"
                min={BLUEPRINT_LIMITS.MIN_BPM}
                max={BLUEPRINT_LIMITS.MAX_BPM}
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm font-mono text-slate-900 dark:text-white"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Compasso</span>
              <select
                value={timeSignature}
                onChange={(e) => setTimeSignature(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm font-mono text-slate-900 dark:text-white"
              >
                <option value="4/4">4/4</option>
                <option value="3/4">3/4</option>
                <option value="6/8">6/8</option>
                <option value="2/4">2/4</option>
              </select>
            </label>

            <label className="block space-y-1.5 col-span-2 sm:col-span-1">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Nível</span>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-sm text-slate-900 dark:text-white"
              >
                {ALLOWED_DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Estilo / Gênero</span>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.MAX_GENRE_LEN}
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="Ex: MPB, Sertanejo, Worship, Rock"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-white"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Observações de palco</span>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.MAX_NOTES_LEN}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Entrar com dedilhado suave"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-white"
              />
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Cifra e letra (use colchetes nos acordes, ex: [G])
              </span>
              <div className="flex flex-wrap gap-1.5">
                {['[Refrão]', '[Verso 1]', '[G]', '[D/F#]', '[Em7]', '[C9]'].map((tok) => (
                  <button
                    key={tok}
                    type="button"
                    onClick={() => insertToken(tok)}
                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-xs font-mono text-blue-700 dark:text-sky-300 transition-colors"
                  >
                    {tok}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              rows={9}
              maxLength={BLUEPRINT_LIMITS.MAX_CONTENT_LEN}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3.5 font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? 'Salvando...' : initialSong ? 'Salvar alterações' : 'Salvar cifra'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
