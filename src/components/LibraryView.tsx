import { useMemo, useState } from 'react';
import { ChevronRight, Mic, Plus, Search, Star, Trash2 } from 'lucide-react';
import type { Song } from '../types/cifra';
import { transposeKey } from '../utils/musicTheory';

interface LibraryViewProps {
  songs: Song[];
  initialSearch?: string;
  onOpenSong: (song: Song) => void;
  onNewSong: () => void;
  onToggleFavorite: (song: Song) => Promise<void>;
  onDeleteSong: (song: Song) => Promise<void>;
  onOpenVoiceHub: () => void;
}

export function LibraryView({
  songs,
  initialSearch = '',
  onOpenSong,
  onNewSong,
  onToggleFavorite,
  onDeleteSong,
  onOpenVoiceHub,
}: LibraryViewProps) {
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [filterMode, setFilterMode] = useState<'all' | 'favorites' | string>('all');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const genres = useMemo(() => {
    const set = new Set<string>();
    songs.forEach((s) => {
      if (s.genre) set.add(s.genre);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [songs]);

  const filteredSongs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return songs.filter((song) => {
      if (filterMode === 'favorites' && !song.isFavorite) return false;
      if (filterMode !== 'all' && filterMode !== 'favorites' && song.genre !== filterMode) {
        return false;
      }
      if (!q) return true;
      return (
        song.title.toLowerCase().includes(q) ||
        song.artist.toLowerCase().includes(q) ||
        song.genre.toLowerCase().includes(q) ||
        song.originalKey.toLowerCase().includes(q)
      );
    });
  }, [songs, searchQuery, filterMode]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24 lg:pb-12">
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight truncate">
              Minhas cifras
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {songs.length} {songs.length === 1 ? 'música organizada' : 'músicas organizadas'} no Firebase
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenVoiceHub}
              aria-label="Abrir assistente de voz"
              className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 text-xs font-medium whitespace-nowrap transition-colors"
            >
              <Mic className="w-4 h-4 text-blue-600 dark:text-sky-400" />
              <span className="hidden sm:inline">Comando por voz</span>
            </button>
            <button
              type="button"
              onClick={onNewSong}
              className="min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs font-medium whitespace-nowrap transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova cifra
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar música, artista ou tom..."
              className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 rounded-xl overflow-x-auto">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                filterMode === 'all'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('favorites')}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                filterMode === 'favorites'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Favoritas
            </button>
            {genres.map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => setFilterMode(genre)}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                  filterMode === genre
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {filteredSongs.length > 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {filteredSongs.map((song) => {
              const effectiveKey = transposeKey(song.originalKey, song.transposeOffset);
              return (
                <div
                  key={song.id}
                  className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onOpenSong(song)}
                    className="flex-1 min-w-0 flex items-center gap-4 text-left min-h-[48px]"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-sky-300 font-mono font-bold text-sm flex items-center justify-center shrink-0 tabular-nums">
                      {effectiveKey}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-semibold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                        {song.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 tabular-nums">
                        {song.artist} · {song.genre} · {song.bpm} BPM
                        {song.capo > 0 ? ` · Capo ${song.capo}ª` : ''} · {song.difficulty}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => void onToggleFavorite(song)}
                      aria-label={song.isFavorite ? 'Remover favorita' : 'Marcar favorita'}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          song.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
                        }`}
                      />
                    </button>

                    {pendingDeleteId === song.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeleteSong(song);
                            setPendingDeleteId(null);
                          }}
                          className="min-h-[36px] px-2.5 rounded-lg bg-rose-600 text-white text-xs font-medium whitespace-nowrap"
                        >
                          Excluir
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(null)}
                          className="min-h-[36px] px-2 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(song.id)}
                        aria-label="Excluir cifra"
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onOpenSong(song)}
                      aria-label="Abrir cifra"
                      className="min-h-[44px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-blue-600"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
            <h2 className="font-display text-base font-semibold">Nenhuma cifra encontrada</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Ajuste o termo de busca ou adicione uma nova cifra ao seu catálogo no Firebase.
            </p>
            <button
              type="button"
              onClick={onNewSong}
              className="min-h-[44px] px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Criar primeira cifra
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
