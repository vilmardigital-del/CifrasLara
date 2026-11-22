import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/assistant', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY não configurada no servidor.',
        });
      }

      const { transcript, songs, setlists, activeSongTitle } = req.body as {
        transcript?: string;
        songs?: Array<{ id: string; title: string; artist: string; originalKey: string }>;
        setlists?: Array<{ id: string; name: string }>;
        activeSongTitle?: string | null;
      };

      if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
        return res.status(400).json({ error: 'Comando vazio.' });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const songCatalog = (songs || [])
        .slice(0, 60)
        .map((s) => `- id: "${s.id}", título: "${s.title}", artista: "${s.artist}", tom: "${s.originalKey}"`)
        .join('\n');

      const setlistCatalog = (setlists || [])
        .slice(0, 30)
        .map((sl) => `- id: "${sl.id}", nome: "${sl.name}"`)
        .join('\n');

      const prompt = `
Você é o assistente de voz oficial do aplicativo cifrasLara para músicos (violão, guitarra, teclado, igreja e shows).
Interprete o comando do músico em Português do Brasil e devolva exatamente uma ação estruturada.

Música atualmente aberta: ${activeSongTitle ? `"${activeSongTitle}"` : 'Nenhuma'}

Músicas do usuário:
${songCatalog || '(Nenhuma música cadastrada ainda)'}

Repertórios do usuário:
${setlistCatalog || '(Nenhum repertório cadastrado ainda)'}

Comando do usuário: "${transcript.trim()}"

Regras:
- Se o usuário pedir para abrir, tocar ou ver uma música existente, use intent "open_song" com songId correspondente.
- Se o usuário pedir para subir ou descer o tom (ex: "subir 2 tons", "meio tom abaixo", "transpor +1"), use intent "transpose" e transposeDelta em semitons (ex: +2, -1, +4). Nota: 1 tom = 2 semitons; meio tom = 1 semitom.
- Se o usuário pedir para criar uma nova cifra ou gerar a cifra de uma música (ex: "criar cifra de Asa Branca", "gerar cifra romântica em Sol"), use intent "create_song" e preencha generatedSong com acordes entre colchetes acima da letra no formato "[G]Quando o [D]sol...".
- Se o usuário pedir para criar um repertório/setlist (ex: "criar repertório Sábado Acústico"), use intent "create_setlist" com setlistName.
- Se o usuário pedir para abrir os repertórios ou um repertório específico, use intent "open_setlists" (com setlistId se existir).
- Se o usuário pedir para buscar ou filtrar músicas (ex: "buscar músicas em Sol", "mostrar favoritas"), use intent "search_songs" e searchQuery.
- Se o usuário fizer uma pergunta musical (ex: "quais acordes do campo harmônico de Ré?", "como tocar Bm7?"), use intent "answer_theory" e responda com clareza e objetividade em reply.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: {
                type: Type.STRING,
                description:
                  'One of: open_song, transpose, create_song, create_setlist, open_setlists, search_songs, open_library, answer_theory',
              },
              reply: {
                type: Type.STRING,
                description: 'Resposta natural curta em português para confirmar a ação ao músico.',
              },
              songId: { type: Type.STRING },
              setlistId: { type: Type.STRING },
              transposeDelta: { type: Type.INTEGER },
              setlistName: { type: Type.STRING },
              searchQuery: { type: Type.STRING },
              generatedSong: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  artist: { type: Type.STRING },
                  genre: { type: Type.STRING },
                  originalKey: { type: Type.STRING },
                  bpm: { type: Type.INTEGER },
                  timeSignature: { type: Type.STRING },
                  difficulty: { type: Type.STRING },
                  content: { type: Type.STRING },
                },
              },
            },
            required: ['intent', 'reply'],
          },
        },
      });

      const rawText = response.text;
      if (!rawText) {
        return res.status(502).json({ error: 'Resposta vazia do assistente Gemini.' });
      }

      const parsed = JSON.parse(rawText);
      return res.json(parsed);
    } catch (error) {
      console.error('Assistant error:', error);
      const message = error instanceof Error ? error.message : 'Erro interno ao processar comando.';
      return res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`cifrasLara server listening on http://localhost:${PORT}`);
  });
}

startServer();
