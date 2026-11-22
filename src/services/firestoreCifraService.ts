import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  ALLOWED_DIFFICULTIES,
  ALLOWED_INSTRUMENTS,
  BLUEPRINT_LIMITS,
  clampInt,
  generateSafeId,
  sanitizeStr,
  type DifficultyLevel,
  type InstrumentType,
  type Setlist,
  type SetlistItem,
  type Song,
  type UserProfile,
  type VoiceLog,
} from '../types/cifra';
import { STARTER_SONGS } from '../utils/musicTheory';

export async function ensureUserProfileAndSeed(
  uid: string,
  displayNameRaw: string | null | undefined,
): Promise<UserProfile> {
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const displayName = sanitizeStr(
        displayNameRaw || 'Músico cifrasLara',
        BLUEPRINT_LIMITS.MAX_DISPLAY_NAME_LEN,
        'Músico cifrasLara',
      );
      const profilePayload = {
        userId: uid,
        displayName,
        preferredInstrument: 'Violão' as InstrumentType,
        stageDarkMode: false,
        hasSeededLibrary: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(userRef, profilePayload);
      await seedStarterLibrary(uid);
      return {
        userId: uid,
        displayName,
        preferredInstrument: 'Violão',
        stageDarkMode: false,
        hasSeededLibrary: true,
      };
    }

    const data = snap.data() as UserProfile;
    if (!data.hasSeededLibrary) {
      await seedStarterLibrary(uid);
    }
    return data;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

async function seedStarterLibrary(uid: string): Promise<void> {
  const userRef = doc(db, 'users', uid);
  try {
    const batch = writeBatch(db);
    const createdSongIds: string[] = [];

    for (const seed of STARTER_SONGS) {
      const songId = generateSafeId('song');
      createdSongIds.push(songId);
      const songRef = doc(db, 'users', uid, 'songs', songId);
      batch.set(songRef, {
        userId: uid,
        title: sanitizeStr(seed.title, BLUEPRINT_LIMITS.MAX_TITLE_LEN, 'Sem título'),
        artist: sanitizeStr(seed.artist, BLUEPRINT_LIMITS.MAX_ARTIST_LEN, 'Desconhecido'),
        genre: sanitizeStr(seed.genre, BLUEPRINT_LIMITS.MAX_GENRE_LEN, 'MPB'),
        originalKey: sanitizeStr(seed.originalKey, BLUEPRINT_LIMITS.MAX_KEY_LEN, 'C'),
        transposeOffset: 0,
        capo: clampInt(seed.capo, BLUEPRINT_LIMITS.MIN_CAPO, BLUEPRINT_LIMITS.MAX_CAPO),
        bpm: clampInt(seed.bpm, BLUEPRINT_LIMITS.MIN_BPM, BLUEPRINT_LIMITS.MAX_BPM),
        timeSignature: sanitizeStr(seed.timeSignature, BLUEPRINT_LIMITS.MAX_TIME_SIG_LEN, '4/4'),
        difficulty: seed.difficulty,
        isFavorite: seed.isFavorite,
        content: sanitizeStr(seed.content, BLUEPRINT_LIMITS.MAX_CONTENT_LEN, '[C]'),
        notes: sanitizeStr(seed.notes, BLUEPRINT_LIMITS.MAX_NOTES_LEN, ''),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const setlistId = generateSafeId('setlist');
    const setlistRef = doc(db, 'users', uid, 'setlists', setlistId);
    batch.set(setlistRef, {
      userId: uid,
      name: 'Show Acústico de Sábado',
      venue: 'Palco Principal',
      eventDate: 'Sábado · 20h',
      description: 'Repertório principal com clássicos de violão e voz.',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.update(userRef, {
      hasSeededLibrary: true,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    const itemsBatch = writeBatch(db);
    createdSongIds.slice(0, 3).forEach((songId, index) => {
      const itemId = generateSafeId('item');
      const itemRef = doc(db, 'users', uid, 'setlists', setlistId, 'items', itemId);
      itemsBatch.set(itemRef, {
        userId: uid,
        setlistId,
        songId,
        order: index,
        customTranspose: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await itemsBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}/songs`);
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      onData(snap.exists() ? (snap.data() as UserProfile) : null);
    },
    (error) => handleFirestoreError(error, OperationType.GET, path),
  );
}

export async function updateUserPreferences(
  uid: string,
  updates: {
    displayName?: string;
    preferredInstrument?: InstrumentType;
    stageDarkMode?: boolean;
  },
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return;
    const current = snap.data() as UserProfile;

    const preferredInstrument =
      updates.preferredInstrument && ALLOWED_INSTRUMENTS.includes(updates.preferredInstrument)
        ? updates.preferredInstrument
        : current.preferredInstrument;

    await updateDoc(doc(db, 'users', uid), {
      displayName: sanitizeStr(
        updates.displayName ?? current.displayName,
        BLUEPRINT_LIMITS.MAX_DISPLAY_NAME_LEN,
        current.displayName,
      ),
      preferredInstrument,
      stageDarkMode: updates.stageDarkMode ?? current.stageDarkMode,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeSongs(uid: string, onData: (songs: Song[]) => void): Unsubscribe {
  const path = `users/${uid}/songs`;
  const q = query(collection(db, 'users', uid, 'songs'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Song[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Song, 'id'>),
      }));
      list.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path),
  );
}

export interface SongInput {
  title: string;
  artist: string;
  genre: string;
  originalKey: string;
  transposeOffset?: number;
  capo?: number;
  bpm?: number;
  timeSignature?: string;
  difficulty?: DifficultyLevel;
  isFavorite?: boolean;
  content: string;
  notes?: string;
}

export async function createSong(uid: string, input: SongInput): Promise<string> {
  const songId = generateSafeId('song');
  const path = `users/${uid}/songs/${songId}`;
  const difficulty: DifficultyLevel =
    input.difficulty && ALLOWED_DIFFICULTIES.includes(input.difficulty)
      ? input.difficulty
      : 'Intermediário';

  try {
    await setDoc(doc(db, 'users', uid, 'songs', songId), {
      userId: uid,
      title: sanitizeStr(input.title, BLUEPRINT_LIMITS.MAX_TITLE_LEN, 'Nova Cifra'),
      artist: sanitizeStr(input.artist, BLUEPRINT_LIMITS.MAX_ARTIST_LEN, 'Autor Desconhecido'),
      genre: sanitizeStr(input.genre, BLUEPRINT_LIMITS.MAX_GENRE_LEN, 'MPB'),
      originalKey: sanitizeStr(input.originalKey, BLUEPRINT_LIMITS.MAX_KEY_LEN, 'C'),
      transposeOffset: clampInt(
        input.transposeOffset ?? 0,
        BLUEPRINT_LIMITS.MIN_TRANSPOSE,
        BLUEPRINT_LIMITS.MAX_TRANSPOSE,
      ),
      capo: clampInt(input.capo ?? 0, BLUEPRINT_LIMITS.MIN_CAPO, BLUEPRINT_LIMITS.MAX_CAPO),
      bpm: clampInt(input.bpm ?? 90, BLUEPRINT_LIMITS.MIN_BPM, BLUEPRINT_LIMITS.MAX_BPM),
      timeSignature: sanitizeStr(input.timeSignature ?? '4/4', BLUEPRINT_LIMITS.MAX_TIME_SIG_LEN, '4/4'),
      difficulty,
      isFavorite: Boolean(input.isFavorite),
      content: sanitizeStr(input.content, BLUEPRINT_LIMITS.MAX_CONTENT_LEN, '[C]'),
      notes: sanitizeStr(input.notes ?? '', BLUEPRINT_LIMITS.MAX_NOTES_LEN, ''),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return songId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSongFull(uid: string, songId: string, input: SongInput): Promise<void> {
  const path = `users/${uid}/songs/${songId}`;
  const difficulty: DifficultyLevel =
    input.difficulty && ALLOWED_DIFFICULTIES.includes(input.difficulty)
      ? input.difficulty
      : 'Intermediário';

  try {
    await updateDoc(doc(db, 'users', uid, 'songs', songId), {
      title: sanitizeStr(input.title, BLUEPRINT_LIMITS.MAX_TITLE_LEN, 'Sem título'),
      artist: sanitizeStr(input.artist, BLUEPRINT_LIMITS.MAX_ARTIST_LEN, 'Autor'),
      genre: sanitizeStr(input.genre, BLUEPRINT_LIMITS.MAX_GENRE_LEN, 'MPB'),
      originalKey: sanitizeStr(input.originalKey, BLUEPRINT_LIMITS.MAX_KEY_LEN, 'C'),
      transposeOffset: clampInt(
        input.transposeOffset ?? 0,
        BLUEPRINT_LIMITS.MIN_TRANSPOSE,
        BLUEPRINT_LIMITS.MAX_TRANSPOSE,
      ),
      capo: clampInt(input.capo ?? 0, BLUEPRINT_LIMITS.MIN_CAPO, BLUEPRINT_LIMITS.MAX_CAPO),
      bpm: clampInt(input.bpm ?? 90, BLUEPRINT_LIMITS.MIN_BPM, BLUEPRINT_LIMITS.MAX_BPM),
      timeSignature: sanitizeStr(input.timeSignature ?? '4/4', BLUEPRINT_LIMITS.MAX_TIME_SIG_LEN, '4/4'),
      difficulty,
      isFavorite: Boolean(input.isFavorite),
      content: sanitizeStr(input.content, BLUEPRINT_LIMITS.MAX_CONTENT_LEN, '[C]'),
      notes: sanitizeStr(input.notes ?? '', BLUEPRINT_LIMITS.MAX_NOTES_LEN, ''),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateSongStageControls(
  uid: string,
  songId: string,
  controls: { transposeOffset: number; capo: number; bpm: number },
): Promise<void> {
  const path = `users/${uid}/songs/${songId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'songs', songId), {
      transposeOffset: clampInt(
        controls.transposeOffset,
        BLUEPRINT_LIMITS.MIN_TRANSPOSE,
        BLUEPRINT_LIMITS.MAX_TRANSPOSE,
      ),
      capo: clampInt(controls.capo, BLUEPRINT_LIMITS.MIN_CAPO, BLUEPRINT_LIMITS.MAX_CAPO),
      bpm: clampInt(controls.bpm, BLUEPRINT_LIMITS.MIN_BPM, BLUEPRINT_LIMITS.MAX_BPM),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleSongFavorite(
  uid: string,
  songId: string,
  isFavorite: boolean,
): Promise<void> {
  const path = `users/${uid}/songs/${songId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'songs', songId), {
      isFavorite,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSong(uid: string, songId: string): Promise<void> {
  const path = `users/${uid}/songs/${songId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'songs', songId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeSetlists(uid: string, onData: (setlists: Setlist[]) => void): Unsubscribe {
  const path = `users/${uid}/setlists`;
  const q = query(collection(db, 'users', uid, 'setlists'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Setlist[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Setlist, 'id'>),
      }));
      list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path),
  );
}

export async function createSetlist(
  uid: string,
  input: { name: string; venue?: string; eventDate?: string; description?: string },
): Promise<string> {
  const setlistId = generateSafeId('setlist');
  const path = `users/${uid}/setlists/${setlistId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'setlists', setlistId), {
      userId: uid,
      name: sanitizeStr(input.name, BLUEPRINT_LIMITS.MAX_SETLIST_NAME_LEN, 'Novo Repertório'),
      venue: sanitizeStr(input.venue ?? '', BLUEPRINT_LIMITS.MAX_VENUE_LEN, ''),
      eventDate: sanitizeStr(input.eventDate ?? '', BLUEPRINT_LIMITS.MAX_EVENT_DATE_LEN, ''),
      description: sanitizeStr(input.description ?? '', BLUEPRINT_LIMITS.MAX_DESCRIPTION_LEN, ''),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return setlistId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteSetlist(uid: string, setlistId: string): Promise<void> {
  const path = `users/${uid}/setlists/${setlistId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'setlists', setlistId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeSetlistItems(
  uid: string,
  setlistId: string,
  onData: (items: SetlistItem[]) => void,
): Unsubscribe {
  const path = `users/${uid}/setlists/${setlistId}/items`;
  const q = query(
    collection(db, 'users', uid, 'setlists', setlistId, 'items'),
    where('userId', '==', uid),
    where('setlistId', '==', setlistId),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: SetlistItem[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SetlistItem, 'id'>),
      }));
      items.sort((a, b) => a.order - b.order);
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path),
  );
}

export async function addSongToSetlist(
  uid: string,
  setlistId: string,
  songId: string,
  order: number,
  customTranspose = 0,
): Promise<string> {
  const itemId = generateSafeId('item');
  const path = `users/${uid}/setlists/${setlistId}/items/${itemId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'setlists', setlistId, 'items', itemId), {
      userId: uid,
      setlistId,
      songId,
      order: clampInt(order, 0, 500),
      customTranspose: clampInt(
        customTranspose,
        BLUEPRINT_LIMITS.MIN_TRANSPOSE,
        BLUEPRINT_LIMITS.MAX_TRANSPOSE,
      ),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return itemId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSetlistItemOrderOrTranspose(
  uid: string,
  setlistId: string,
  itemId: string,
  updates: { order: number; customTranspose: number },
): Promise<void> {
  const path = `users/${uid}/setlists/${setlistId}/items/${itemId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'setlists', setlistId, 'items', itemId), {
      order: clampInt(updates.order, 0, 500),
      customTranspose: clampInt(
        updates.customTranspose,
        BLUEPRINT_LIMITS.MIN_TRANSPOSE,
        BLUEPRINT_LIMITS.MAX_TRANSPOSE,
      ),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeSetlistItem(
  uid: string,
  setlistId: string,
  itemId: string,
): Promise<void> {
  const path = `users/${uid}/setlists/${setlistId}/items/${itemId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'setlists', setlistId, 'items', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeVoiceLogs(uid: string, onData: (logs: VoiceLog[]) => void): Unsubscribe {
  const path = `users/${uid}/voiceLogs`;
  const q = query(collection(db, 'users', uid, 'voiceLogs'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const logs: VoiceLog[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<VoiceLog, 'id'>),
      }));
      logs.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      onData(logs.slice(0, 12));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path),
  );
}

export async function createVoiceLog(
  uid: string,
  transcript: string,
  intent: string,
  responseSummary: string,
): Promise<void> {
  const logId = generateSafeId('voice');
  const path = `users/${uid}/voiceLogs/${logId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'voiceLogs', logId), {
      userId: uid,
      transcript: sanitizeStr(transcript, BLUEPRINT_LIMITS.MAX_TRANSCRIPT_LEN, 'Comando'),
      intent: sanitizeStr(intent, BLUEPRINT_LIMITS.MAX_INTENT_LEN, 'general'),
      responseSummary: sanitizeStr(responseSummary, BLUEPRINT_LIMITS.MAX_RESPONSE_LEN, 'Executado'),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
