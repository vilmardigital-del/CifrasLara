import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  Library,
  ListMusic,
  Loader2,
  LogOut,
  Mic,
  Music,
} from 'lucide-react';
import { auth, googleProvider } from './firebase';
import {
  addSongToSetlist,
  createSetlist,
  createSong,
  createVoiceLog,
  deleteSong,
  ensureUserProfileAndSeed,
  subscribeSetlists,
  subscribeSongs,
  subscribeUserProfile,
  subscribeVoiceLogs,
  toggleSongFavorite,
  updateSongFull,
  updateSongStageControls,
  updateUserPreferences,
} from './services/firestoreCifraService';
import {
  ALLOWED_DIFFICULTIES,
  type DifficultyLevel,
  type Setlist,
  type Song,
  type UserProfile,
  type VoiceLog,
} from './types/cifra';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SmartCifraLogo } from './components/SmartCifraLogo';
import {
  VoiceAssistantHub,
  type AssistantActionResult,
} from './components/VoiceAssistantHub';
import { LibraryView } from './components/LibraryView';
import { SetlistsView } from './components/SetlistsView';
import { CifraReader } from './components/CifraReader';
import { SongEditorModal } from './components/SongEditorModal';

type ActiveTab = 'assistant' | 'library' | 'setlists';

function SmartCifraShell() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [voiceLogs, setVoiceLogs] = useState<VoiceLog[]>([]);
  const [syncingUser, setSyncingUser] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('assistant');
  const [libraryInitialSearch, setLibraryInitialSearch] = useState('');
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [stageQueue, setStageQueue] = useState<{
    setlist: Setlist;
    songIds: string[];
    index: number;
  } | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);

      if (firebaseUser) {
        setSyncingUser(true);
        try {
          await ensureUserProfileAndSeed(firebaseUser.uid, firebaseUser.displayName);
        } finally {
          setSyncingUser(false);
        }
      } else {
        setProfile(null);
        setSongs([]);
        setSetlists([]);
        setVoiceLogs([]);
        setActiveSongId(null);
        setStageQueue(null);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || syncingUser) return;
    const unsubProfile = subscribeUserProfile(user.uid, setProfile);
    const unsubSongs = subscribeSongs(user.uid, setSongs);
    const unsubSetlists = subscribeSetlists(user.uid, setSetlists);
    const unsubVoice = subscribeVoiceLogs(user.uid, setVoiceLogs);

    return () => {
      unsubProfile();
      unsubSongs();
      unsubSetlists();
      unsubVoice();
    };
  }, [user, syncingUser]);

  const stageDarkMode = profile?.stageDarkMode ?? false;

  useEffect(() => {
    if (stageDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [stageDarkMode]);

  const activeSong = songs.find((s) => s.id === activeSongId) ?? null;

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Não foi possível concluir o login com Google.',
      );
    } finally {
      setSigningIn(false);
    }
  };

  const handleExecuteAssistantAction = async (
    transcript: string,
    result: AssistantActionResult,
  ) => {
    if (!user) return;
    await createVoiceLog(user.uid, transcript, result.intent, result.reply);

    switch (result.intent) {
      case 'open_song': {
        if (result.songId) {
          const match = songs.find((s) => s.id === result.songId);
          if (match) {
            setStageQueue(null);
            setActiveSongId(match.id);
          }
        }
        break;
      }
      case 'transpose': {
        const target = activeSong ?? songs[0];
        if (target && typeof result.transposeDelta === 'number') {
          let next = target.transposeOffset + result.transposeDelta;
          if (next > 11) next -= 12;
          if (next < -11) next += 12;
          await updateSongStageControls(user.uid, target.id, {
            transposeOffset: next,
            capo: target.capo,
            bpm: target.bpm,
          });
          setActiveSongId(target.id);
        }
        break;
      }
      case 'create_song': {
        if (result.generatedSong) {
          const diff = ALLOWED_DIFFICULTIES.includes(
            result.generatedSong.difficulty as DifficultyLevel,
          )
            ? (result.generatedSong.difficulty as DifficultyLevel)
            : 'Intermediário';
          const newId = await createSong(user.uid, {
            title: result.generatedSong.title || 'Nova Cifra',
            artist: result.generatedSong.artist || 'cifrasLara',
            genre: result.generatedSong.genre || 'MPB',
            originalKey: result.generatedSong.originalKey || 'G',
            bpm: result.generatedSong.bpm || 92,
            timeSignature: result.generatedSong.timeSignature || '4/4',
            difficulty: diff,
            content: result.generatedSong.content || '[G]Nova cifra gerada',
            notes: `Gerada via comando: "${transcript}"`,
          });
          setActiveSongId(newId);
        }
        break;
      }
      case 'create_setlist': {
        if (result.setlistName) {
          await createSetlist(user.uid, {
            name: result.setlistName,
            description: 'Criado via assistente de voz cifrasLara',
          });
          setActiveTab('setlists');
        }
        break;
      }
      case 'open_setlists': {
        setActiveSongId(null);
        setActiveTab('setlists');
        break;
      }
      case 'search_songs': {
        setLibraryInitialSearch(result.searchQuery ?? '');
        setActiveSongId(null);
        setActiveTab('library');
        break;
      }
      case 'open_library': {
        setLibraryInitialSearch('');
        setActiveSongId(null);
        setActiveTab('library');
        break;
      }
      default:
        break;
    }
  };

  if (!authReady || syncingUser) {
    return (
      <div className="min-h-screen smartcifra-gradient flex flex-col items-center justify-center text-white gap-5 p-6">
        <SmartCifraLogo variant="light" size="lg" />
        <Loader2 className="w-7 h-7 animate-spin text-blue-200" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen smartcifra-gradient text-white flex flex-col justify-between p-6 sm:p-10">
        <div className="max-w-5xl w-full mx-auto flex items-center justify-between">
          <SmartCifraLogo variant="light" size="sm" />
          <span className="text-xs text-blue-200/85">Firebase Cloud Sync</span>
        </div>

        <div className="max-w-4xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center my-auto py-10">
          <div className="lg:col-span-7 space-y-5 text-center lg:text-left">
            <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight leading-tight text-balance">
              Tenha todas as suas músicas organizadas
            </h1>
            <p className="text-base text-blue-100/90 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Organize suas cifras, transponha tons em segundos, monte repertórios de palco e controle tudo por voz com sincronização em tempo real no Firebase.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={signingIn}
                className="w-full sm:w-auto min-h-[48px] px-7 rounded-2xl bg-white text-blue-950 hover:bg-blue-50 font-display font-bold text-sm flex items-center justify-center gap-3 shadow-xl transition-colors disabled:opacity-60"
              >
                {signingIn ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Music className="w-4 h-4 text-blue-700" />
                )}
                Entrar com Google
              </button>
            </div>
            {authError && (
              <p className="text-xs text-rose-200 bg-rose-950/60 border border-rose-400/30 rounded-xl px-4 py-2.5">
                {authError}
              </p>
            )}
          </div>

          {/* Preview Card echoing the SmartCifra screenshot */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-xs rounded-3xl bg-slate-950/40 backdrop-blur-md border border-white/20 p-8 flex flex-col items-center text-center shadow-2xl">
              <SmartCifraLogo variant="light" size="sm" />
              <p className="mt-6 text-sm font-medium text-white">Como posso ajudar?</p>
              <div className="mt-5 w-16 h-16 rounded-full bg-[#1D63FF] shadow-[0_0_32px_rgba(37,99,235,0.8)] flex items-center justify-center">
                <Mic className="w-7 h-7 text-white" />
              </div>
              <p className="mt-3 text-xs text-blue-200/80">Ouvindo...</p>
            </div>
          </div>
        </div>

        <footer className="max-w-5xl w-full mx-auto text-center lg:text-left text-xs text-blue-200/70">
          cifrasLara · Biblioteca pessoal de cifras, acordes e repertórios
        </footer>
      </div>
    );
  }

  // Stage / Reader View
  if (activeSong) {
    const queueInfo = stageQueue
      ? {
          setlistName: stageQueue.setlist.name,
          currentIndex: stageQueue.index,
          total: stageQueue.songIds.length,
          hasPrev: stageQueue.index > 0,
          hasNext: stageQueue.index < stageQueue.songIds.length - 1,
          onPrev: () => {
            const prevIdx = stageQueue.index - 1;
            if (prevIdx >= 0) {
              setStageQueue({ ...stageQueue, index: prevIdx });
              setActiveSongId(stageQueue.songIds[prevIdx]);
            }
          },
          onNext: () => {
            const nextIdx = stageQueue.index + 1;
            if (nextIdx < stageQueue.songIds.length) {
              setStageQueue({ ...stageQueue, index: nextIdx });
              setActiveSongId(stageQueue.songIds[nextIdx]);
            }
          },
        }
      : null;

    return (
      <>
        <CifraReader
          song={activeSong}
          stageDarkMode={stageDarkMode}
          setlists={setlists}
          stageQueue={queueInfo}
          onBack={() => {
            setActiveSongId(null);
            setStageQueue(null);
          }}
          onEdit={() => {
            setEditingSong(activeSong);
            setEditorOpen(true);
          }}
          onToggleFavorite={async (song) => {
            await toggleSongFavorite(user.uid, song.id, !song.isFavorite);
          }}
          onSaveStageControls={async (song, controls) => {
            await updateSongStageControls(user.uid, song.id, controls);
          }}
          onToggleStageDark={async (nextVal) => {
            await updateUserPreferences(user.uid, { stageDarkMode: nextVal });
          }}
          onAddToSetlist={async (song, setlistId) => {
            await addSongToSetlist(user.uid, setlistId, song.id, 0, song.transposeOffset);
          }}
        />
        {editorOpen && (
          <SongEditorModal
            initialSong={editingSong}
            onClose={() => {
              setEditorOpen(false);
              setEditingSong(null);
            }}
            onSave={async (input) => {
              if (editingSong) {
                await updateSongFull(user.uid, editingSong.id, input);
              }
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Desktop Navigation Rail */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-30">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-center">
          <SmartCifraLogo variant={stageDarkMode ? 'light' : 'dark'} size="sm" />
        </div>

        <nav className="flex-1 p-4 space-y-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('assistant')}
            className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-medium transition-colors ${
              activeTab === 'assistant'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Mic className="w-4 h-4 shrink-0" />
            Assistente de voz
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center justify-between text-sm font-medium transition-colors ${
              activeTab === 'library'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-3">
              <Library className="w-4 h-4 shrink-0" />
              Minhas cifras
            </span>
            <span className="text-xs font-mono tabular-nums opacity-75">{songs.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('setlists')}
            className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center justify-between text-sm font-medium transition-colors ${
              activeTab === 'setlists'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-3">
              <ListMusic className="w-4 h-4 shrink-0" />
              Repertórios
            </span>
            <span className="text-xs font-mono tabular-nums opacity-75">{setlists.length}</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="px-2">
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {profile?.displayName || user.displayName || 'Músico'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {profile?.preferredInstrument || 'Violão'} · Firebase ativo
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signOut(auth)}
            className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair da conta
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 lg:pl-64 min-w-0">
        {activeTab === 'assistant' && (
          <VoiceAssistantHub
            songs={songs}
            setlists={setlists}
            voiceLogs={voiceLogs}
            activeSong={activeSong}
            onNavigateLibrary={(q) => {
              setLibraryInitialSearch(q ?? '');
              setActiveTab('library');
            }}
            onNavigateSetlists={() => setActiveTab('setlists')}
            onOpenSong={(song) => {
              setStageQueue(null);
              setActiveSongId(song.id);
            }}
            onNewSong={() => {
              setEditingSong(null);
              setEditorOpen(true);
            }}
            onExecuteAssistantAction={handleExecuteAssistantAction}
          />
        )}

        {activeTab === 'library' && (
          <LibraryView
            songs={songs}
            initialSearch={libraryInitialSearch}
            onOpenSong={(song) => {
              setStageQueue(null);
              setActiveSongId(song.id);
            }}
            onNewSong={() => {
              setEditingSong(null);
              setEditorOpen(true);
            }}
            onToggleFavorite={async (song) => {
              await toggleSongFavorite(user.uid, song.id, !song.isFavorite);
            }}
            onDeleteSong={async (song) => {
              await deleteSong(user.uid, song.id);
            }}
            onOpenVoiceHub={() => setActiveTab('assistant')}
          />
        )}

        {activeTab === 'setlists' && (
          <SetlistsView
            uid={user.uid}
            songs={songs}
            setlists={setlists}
            onLaunchStageQueue={(setlist, orderedSongs, startIndex) => {
              if (orderedSongs.length === 0) return;
              setStageQueue({
                setlist,
                songIds: orderedSongs.map((s) => s.id),
                index: startIndex,
              });
              setActiveSongId(orderedSongs[startIndex].id);
            }}
          />
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (< 15% viewport height) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 items-center">
        <button
          type="button"
          onClick={() => setActiveTab('assistant')}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
            activeTab === 'assistant'
              ? 'text-blue-600 dark:text-sky-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Mic className="w-5 h-5" />
          <span>Assistente</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('library')}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
            activeTab === 'library'
              ? 'text-blue-600 dark:text-sky-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Library className="w-5 h-5" />
          <span>Cifras</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('setlists')}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
            activeTab === 'setlists'
              ? 'text-blue-600 dark:text-sky-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <ListMusic className="w-5 h-5" />
          <span>Repertórios</span>
        </button>
      </nav>

      {editorOpen && (
        <SongEditorModal
          initialSong={editingSong}
          onClose={() => {
            setEditorOpen(false);
            setEditingSong(null);
          }}
          onSave={async (input) => {
            if (editingSong) {
              await updateSongFull(user.uid, editingSong.id, input);
            } else {
              const newId = await createSong(user.uid, input);
              setActiveSongId(newId);
            }
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SmartCifraShell />
    </ErrorBoundary>
  );
}
