import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class SongModel {
  final String id;
  final String userId;
  final String title;
  final String artist;
  final String genre;
  final String originalKey;
  final int transposeOffset;
  final int capo;
  final int bpm;
  final String timeSignature;
  final String difficulty;
  final bool isFavorite;
  final String content;
  final String notes;

  SongModel({
    required this.id,
    required this.userId,
    required this.title,
    required this.artist,
    required this.genre,
    required this.originalKey,
    required this.transposeOffset,
    required this.capo,
    required this.bpm,
    required this.timeSignature,
    required this.difficulty,
    required this.isFavorite,
    required this.content,
    required this.notes,
  });

  factory SongModel.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return SongModel(
      id: doc.id,
      userId: data['userId'] ?? '',
      title: data['title'] ?? '',
      artist: data['artist'] ?? '',
      genre: data['genre'] ?? 'MPB',
      originalKey: data['originalKey'] ?? 'C',
      transposeOffset: (data['transposeOffset'] ?? 0) as int,
      capo: (data['capo'] ?? 0) as int,
      bpm: (data['bpm'] ?? 90) as int,
      timeSignature: data['timeSignature'] ?? '4/4',
      difficulty: data['difficulty'] ?? 'Intermediário',
      isFavorite: (data['isFavorite'] ?? false) as bool,
      content: data['content'] ?? '',
      notes: data['notes'] ?? '',
    );
  }
}

class FirestoreCifraService {
  static const String firestoreDatabaseId = 'ai-studio-015089ad-5c67-4a76-a34c-b9db45e9054b';

  final FirebaseFirestore _db = FirebaseFirestore.instanceFor(
    app: FirebaseFirestore.instance.app,
    databaseId: firestoreDatabaseId,
  );

  Future<void> ensureProfile(User user) async {
    final ref = _db.collection('users').doc(user.uid);
    final snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        'userId': user.uid,
        'displayName': user.displayName ?? 'Músico cifrasLara',
        'preferredInstrument': 'Violão',
        'stageDarkMode': false,
        'hasSeededLibrary': false,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
    }
  }

  Stream<List<SongModel>> watchSongs(String uid) {
    return _db
        .collection('users')
        .doc(uid)
        .collection('songs')
        .where('userId', isEqualTo: uid)
        .snapshots()
        .map((snap) => snap.docs.map(SongModel.fromDoc).toList());
  }

  Future<void> updateTranspose(String uid, SongModel song, int delta) async {
    int next = song.transposeOffset + delta;
    if (next > 11) next -= 12;
    if (next < -11) next += 12;
    await _db
        .collection('users')
        .doc(uid)
        .collection('songs')
        .doc(song.id)
        .update({
      'transposeOffset': next,
      'capo': song.capo,
      'bpm': song.bpm,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }
}
