import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'services/firestore_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  runApp(const SmartCifraApp());
}

class SmartCifraApp extends StatelessWidget {
  const SmartCifraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'cifrasLara',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF1D63FF),
      ),
      home: const SmartCifraHome(),
    );
  }
}

class SmartCifraHome extends StatefulWidget {
  const SmartCifraHome({super.key});

  @override
  State<SmartCifraHome> createState() => _SmartCifraHomeState();
}

class _SmartCifraHomeState extends State<SmartCifraHome> {
  final _speech = SpeechToText();
  final _service = FirestoreCifraService();
  int _tabIndex = 0;
  bool _isListening = false;
  String _recognized = '';

  Future<void> _toggleMic() async {
    if (_isListening) {
      await _speech.stop();
      setState(() => _isListening = false);
      return;
    }
    final available = await _speech.initialize();
    if (!available) return;
    setState(() => _isListening = true);
    await _speech.listen(
      localeId: 'pt_BR',
      onResult: (res) {
        setState(() => _recognized = res.recognizedWords);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, authSnap) {
        final user = authSnap.data;
        if (user == null) {
          return Scaffold(
            body: Container(
              decoration: const BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment(0, -0.15),
                  radius: 1.1,
                  colors: [Color(0xFF1E6BFF), Color(0xFF1143B5), Color(0xFF061848)],
                ),
              ),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'cifrasLara',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 38,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: () => FirebaseAuth.instance.signInWithProvider(
                        GoogleAuthProvider(),
                      ),
                      child: const Text('Entrar com Google'),
                    ),
                  ],
                ),
              ),
            ),
          );
        }

        return Scaffold(
          body: IndexedStack(
            index: _tabIndex,
            children: [
              _buildVoiceHub(),
              _buildSongsTab(user.uid),
            ],
          ),
          bottomNavigationBar: NavigationBar(
            selectedIndex: _tabIndex,
            onDestinationSelected: (i) => setState(() => _tabIndex = i),
            destinations: const [
              NavigationDestination(icon: Icon(Icons.mic), label: 'Assistente'),
              NavigationDestination(icon: Icon(Icons.library_music), label: 'Cifras'),
            ],
          ),
        );
      },
    );
  }

  Widget _buildVoiceHub() {
    return Container(
      decoration: const BoxDecoration(
        gradient: RadialGradient(
          center: Alignment(0, -0.15),
          radius: 1.1,
          colors: [Color(0xFF1E6BFF), Color(0xFF1143B5), Color(0xFF061848)],
        ),
      ),
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    icon: const Icon(Icons.chevron_left, color: Colors.white, size: 28),
                    onPressed: () => setState(() => _tabIndex = 1),
                  ),
                  Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.search, color: Colors.white),
                        onPressed: () => setState(() => _tabIndex = 1),
                      ),
                      IconButton(
                        icon: const Icon(Icons.more_horiz, color: Colors.white),
                        onPressed: () {},
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Spacer(),
            const Text(
              'cifrasLara',
              style: TextStyle(color: Colors.white, fontSize: 38, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 24),
            const Text(
              'Como posso ajudar?',
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 28),
            GestureDetector(
              onTap: _toggleMic,
              child: Container(
                width: 84,
                height: 84,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _isListening ? const Color(0xFF38BDF8) : const Color(0xFF1D63FF),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF2563EB).withValues(alpha: 0.7),
                      blurRadius: 36,
                    ),
                  ],
                ),
                child: Icon(
                  _isListening ? Icons.mic_off : Icons.mic,
                  color: Colors.white,
                  size: 34,
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              _isListening ? 'Ouvindo...' : (_recognized.isEmpty ? 'Toque para falar' : _recognized),
              style: const TextStyle(color: Colors.white70, fontSize: 14),
            ),
            const Spacer(flex: 2),
          ],
        ),
      ),
    );
  }

  Widget _buildSongsTab(String uid) {
    return SafeArea(
      child: StreamBuilder<List<SongModel>>(
        stream: _service.watchSongs(uid),
        builder: (context, snap) {
          final songs = snap.data ?? [];
          return ListView.separated(
            itemCount: songs.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final song = songs[index];
              return ListTile(
                leading: CircleAvatar(child: Text(song.originalKey)),
                title: Text(song.title),
                subtitle: Text('${song.artist} · ${song.genre} · ${song.bpm} BPM'),
                trailing: IconButton(
                  icon: const Icon(Icons.add),
                  onPressed: () => _service.updateTranspose(uid, song, 1),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
