import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ListMusic,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  addSongToSetlist,
  createSetlist,
  deleteSetlist,
  removeSetlistItem,
  subscribeSetlistItems,
  updateSetlistItemOrderOrTranspose,
} from '../services/firestoreCifraService';
import { BLUEPRINT_LIMITS, type Setlist, type SetlistItem, type Song } from '../types/cifra';
import { transposeKey } from '../utils/musicTheory';

interface SetlistsViewProps {
  uid: string;
  songs: Song[];
  setlists: Setlist[];
  onLaunchStageQueue: (setlist: Setlist, orderedSongs: Song[], startIndex: number) => void;
}

export function SetlistsView({
  uid,
  songs,
  setlists,
  onLaunchStageQueue,
}: SetlistsViewProps) {
  const [selectedSetlistId, setSelectedSetlistId] = useState<string | null>(null);
  const [items, setItems] = useState<SetlistItem[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [songToAddId, setSongToAddId] = useState('');

  useEffect(() => {
    if (!selectedSetlistId && setlists.length > 0) {
      setSelectedSetlistId(setlists[0].id);
    } else if (selectedSetlistId && !setlists.some((s) => s.id === selectedSetlistId)) {
      setSelectedSetlistId(setlists[0]?.id ?? null);
    }
  }, [setlists, selectedSetlistId]);

  useEffect(() => {
    if (!selectedSetlistId) {
      setItems([]);
      return;
    }
    const unsub = subscribeSetlistItems(uid, selectedSetlistId, setItems);
    return () => unsub();
  }, [uid, selectedSetlistId]);

  const selectedSetlist = setlists.find((s) => s.id === selectedSetlistId) ?? null;

  const songMap = new Map(songs.map((s) => [s.id, s]));
  const resolvedEntries = items
    .map((item) => {
      const song = songMap.get(item.songId);
      return song ? { item, song } : null;
    })
    .filter((x): x is { item: SetlistItem; song: Song } => x !== null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const newId = await createSetlist(uid, { name, venue, eventDate, description });
      setSelectedSetlistId(newId);
      setName('');
      setVenue('');
      setEventDate('');
      setDescription('');
      setShowCreateModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    if (!selectedSetlist) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= resolvedEntries.length) return;
    const current = resolvedEntries[index].item;
    const target = resolvedEntries[targetIdx].item;
    await Promise.all([
      updateSetlistItemOrderOrTranspose(uid, selectedSetlist.id, current.id, {
        order: targetIdx,
        customTranspose: current.customTranspose,
      }),
      updateSetlistItemOrderOrTranspose(uid, selectedSetlist.id, target.id, {
        order: index,
        customTranspose: target.customTranspose,
      }),
    ]);
  };

  const availableSongsToAdd = songs.filter(
    (s) => !resolvedEntries.some((entry) => entry.song.id === s.id),
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24 lg:pb-12">
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight truncate">
              Repertórios e Setlists
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {setlists.length} {setlists.length === 1 ? 'repertório salvo' : 'repertórios salvos'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo repertório
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 space-y-2">
          {setlists.map((sl) => {
            const active = sl.id === selectedSetlistId;
            return (
              <button
                key={sl.id}
                type="button"
                onClick={() => setSelectedSetlistId(sl.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-colors ${
                  active
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-400'
                }`}
              >
                <p className="font-display font-semibold text-sm truncate">{sl.name}</p>
                <p
                  className={`text-xs mt-1 truncate ${
                    active ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {[sl.venue, sl.eventDate].filter(Boolean).join(' · ') || 'Repertório personalizado'}
                </p>
              </button>
            );
          })}

          {setlists.length === 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-2">
              <ListMusic className="w-6 h-6 text-blue-600 mx-auto" />
              <p className="text-sm font-medium">Nenhum repertório criado</p>
              <p className="text-xs text-slate-500">
                Monte a ordem das músicas para seus ensaios, cultos ou shows.
              </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-8">
          {selectedSetlist ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold truncate">{selectedSetlist.name}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {[selectedSetlist.venue, selectedSetlist.eventDate, `${resolvedEntries.length} músicas`]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {selectedSetlist.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
                      {selectedSetlist.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={resolvedEntries.length === 0}
                    onClick={() =>
                      onLaunchStageQueue(
                        selectedSetlist,
                        resolvedEntries.map((e) => e.song),
                        0,
                      )
                    }
                    className="min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Modo palco
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteSetlist(uid, selectedSetlist.id)}
                    aria-label="Excluir repertório"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:px-6 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-2">
                <select
                  value={songToAddId}
                  onChange={(e) => setSongToAddId(e.target.value)}
                  className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-white"
                >
                  <option value="">Selecionar cifra para adicionar...</option>
                  {availableSongsToAdd.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} — {s.artist} ({s.originalKey})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!songToAddId}
                  onClick={async () => {
                    if (!songToAddId) return;
                    await addSongToSetlist(
                      uid,
                      selectedSetlist.id,
                      songToAddId,
                      resolvedEntries.length,
                      0,
                    );
                    setSongToAddId('');
                  }}
                  className="min-h-[44px] px-4 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-medium whitespace-nowrap"
                >
                  Adicionar música
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {resolvedEntries.map(({ item, song }, index) => {
                  const key = transposeKey(song.originalKey, song.transposeOffset);
                  return (
                    <div
                      key={item.id}
                      className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          onLaunchStageQueue(
                            selectedSetlist,
                            resolvedEntries.map((e) => e.song),
                            index,
                          )
                        }
                        className="flex-1 min-w-0 flex items-center gap-3 text-left min-h-[44px]"
                      >
                        <span className="w-6 text-xs font-mono text-slate-400 tabular-nums shrink-0">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {song.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate tabular-nums">
                            {song.artist} · Tom {key} · {song.bpm} BPM
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => void handleMove(index, -1)}
                          aria-label="Mover para cima"
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-25"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={index === resolvedEntries.length - 1}
                          onClick={() => void handleMove(index, 1)}
                          aria-label="Mover para baixo"
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-25"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeSetlistItem(uid, selectedSetlist.id, item.id)}
                          aria-label="Remover do repertório"
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {resolvedEntries.length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-10 px-4">
                    Este repertório está vazio. Selecione cifras acima para montar sua ordem de palco.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Novo repertório</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3.5">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Nome do repertório</span>
                <input
                  type="text"
                  required
                  maxLength={BLUEPRINT_LIMITS.MAX_SETLIST_NAME_LEN}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Culto de Domingo"
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Local / Evento (opcional)</span>
                <input
                  type="text"
                  maxLength={BLUEPRINT_LIMITS.MAX_VENUE_LEN}
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="Ex: Teatro Municipal"
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Data / Horário (opcional)</span>
                <input
                  type="text"
                  maxLength={BLUEPRINT_LIMITS.MAX_EVENT_DATE_LEN}
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  placeholder="Ex: Sábado · 21h"
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Notas (opcional)</span>
                <textarea
                  rows={2}
                  maxLength={BLUEPRINT_LIMITS.MAX_DESCRIPTION_LEN}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-sm"
                />
              </label>
              <button
                type="submit"
                disabled={saving}
                className="w-full min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Criando...' : 'Criar repertório'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
