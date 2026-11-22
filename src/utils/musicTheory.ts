import type { DifficultyLevel } from '../types/cifra';

const SHARP_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_SCALE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const NOTE_TO_INDEX: Record<string, number> = {
  C: 0,
  'B#': 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  F: 5,
  'E#': 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

const FLAT_KEY_ROOTS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

function transposeRoot(note: string, semitones: number, preferFlats: boolean): string {
  const idx = NOTE_TO_INDEX[note];
  if (idx === undefined) return note;
  const normalized = (((idx + semitones) % 12) + 12) % 12;
  return preferFlats ? FLAT_SCALE[normalized] : SHARP_SCALE[normalized];
}

export function transposeKey(originalKey: string, semitones: number): string {
  if (!semitones) return originalKey;
  const match = originalKey.trim().match(/^([A-G](?:#|b)?)(.*)$/);
  if (!match) return originalKey;
  const [, root, suffix] = match;
  const targetIndex = (((NOTE_TO_INDEX[root] ?? 0) + semitones) % 12 + 12) % 12;
  const candidateSharp = SHARP_SCALE[targetIndex] + suffix;
  const candidateFlat = FLAT_SCALE[targetIndex] + suffix;
  const preferFlats = FLAT_KEY_ROOTS.has(candidateFlat) || (originalKey.includes('b') && !originalKey.includes('#'));
  return preferFlats ? candidateFlat : candidateSharp;
}

export function transposeChord(chord: string, semitones: number, targetKey?: string): string {
  if (!semitones) return chord;
  const preferFlats = targetKey ? FLAT_KEY_ROOTS.has(targetKey) : chord.includes('b');
  const slashParts = chord.split('/');
  const transposedParts = slashParts.map((part) => {
    const m = part.trim().match(/^([A-G](?:#|b)?)(.*)$/);
    if (!m) return part;
    const [, root, rest] = m;
    return transposeRoot(root, semitones, preferFlats) + rest;
  });
  return transposedParts.join('/');
}

export interface ChordToken {
  chord: string | null;
  lyric: string;
}

export interface ParsedLine {
  type: 'section' | 'empty' | 'lyrics';
  sectionTitle?: string;
  tokens: ChordToken[];
}

export function parseCifraContent(
  content: string,
  transposeOffset: number,
  targetKey?: string,
): ParsedLine[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');

  return lines.map((rawLine) => {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      return { type: 'empty', tokens: [] };
    }

    if (
      /^\[(Intro|Introdução|Verso(?:\s+\d+)?|Estrofe(?:\s+\d+)?|Refrão|Pré-Refrão|Ponte|Solo|Final|Interlúdio|Tab|Parte\s+\d+)\]$/i.test(
        trimmed,
      )
    ) {
      return {
        type: 'section',
        sectionTitle: trimmed.slice(1, -1),
        tokens: [],
      };
    }

    const tokens: ChordToken[] = [];
    const regex = /\[([^\]]+)\]/g;
    let lastIndex = 0;
    let pendingChord: string | null = null;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(rawLine)) !== null) {
      const textBefore = rawLine.slice(lastIndex, match.index);
      if (textBefore.length > 0 || pendingChord !== null) {
        tokens.push({
          chord: pendingChord,
          lyric: textBefore,
        });
      }
      pendingChord = transposeChord(match[1].trim(), transposeOffset, targetKey);
      lastIndex = match.index + match[0].length;
    }

    const remainingText = rawLine.slice(lastIndex);
    if (remainingText.length > 0 || pendingChord !== null) {
      tokens.push({
        chord: pendingChord,
        lyric: remainingText,
      });
    }

    if (tokens.length === 0) {
      tokens.push({ chord: null, lyric: rawLine });
    }

    return { type: 'lyrics', tokens };
  });
}

export function extractUniqueChords(content: string, transposeOffset: number, targetKey?: string): string[] {
  const seen = new Set<string>();
  const regex = /\[([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const raw = match[1].trim();
    if (
      /^(Intro|Introdução|Verso(?:\s+\d+)?|Estrofe(?:\s+\d+)?|Refrão|Pré-Refrão|Ponte|Solo|Final|Interlúdio|Tab|Parte\s+\d+)$/i.test(
        raw,
      )
    ) {
      continue;
    }
    const transposed = transposeChord(raw, transposeOffset, targetKey);
    seen.add(transposed);
  }
  return Array.from(seen);
}

export interface ChordDiagramData {
  name: string;
  baseFret: number;
  frets: [number, number, number, number, number, number];
  fingers: [number, number, number, number, number, number];
  barre?: number;
}

const GUITAR_VOICINGS: Record<string, Omit<ChordDiagramData, 'name'>> = {
  C: { baseFret: 1, frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  C7: { baseFret: 1, frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
  C9: { baseFret: 1, frets: [-1, 3, 2, 0, 3, 3], fingers: [0, 2, 1, 0, 3, 4] },
  Cadd9: { baseFret: 1, frets: [-1, 3, 2, 0, 3, 3], fingers: [0, 2, 1, 0, 3, 4] },
  Cmaj7: { baseFret: 1, frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
  C7M: { baseFret: 1, frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
  Cm: { baseFret: 3, frets: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1], barre: 3 },
  'C#m': { baseFret: 4, frets: [-1, 4, 6, 6, 5, 4], fingers: [0, 1, 3, 4, 2, 1], barre: 4 },
  'C#m7': { baseFret: 4, frets: [-1, 4, 6, 4, 5, 4], fingers: [0, 1, 3, 1, 2, 1], barre: 4 },
  D: { baseFret: 1, frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  D7: { baseFret: 1, frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  Dm: { baseFret: 1, frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  Dm7: { baseFret: 1, frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1] },
  'D/F#': { baseFret: 1, frets: [2, -1, 0, 2, 3, 2], fingers: [1, 0, 0, 2, 4, 3] },
  Dsus4: { baseFret: 1, frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 3] },
  D4: { baseFret: 1, frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 3] },
  E: { baseFret: 1, frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  E7: { baseFret: 1, frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  Em: { baseFret: 1, frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  Em7: { baseFret: 1, frets: [0, 2, 2, 0, 3, 0], fingers: [0, 1, 2, 0, 3, 0] },
  F: { baseFret: 1, frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barre: 1 },
  Fmaj7: { baseFret: 1, frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
  F7M: { baseFret: 1, frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
  Fm: { baseFret: 1, frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1], barre: 1 },
  'F#m': { baseFret: 2, frets: [2, 4, 4, 2, 2, 2], fingers: [1, 3, 4, 1, 1, 1], barre: 2 },
  'F#m7': { baseFret: 2, frets: [2, 4, 2, 2, 2, 2], fingers: [1, 3, 1, 1, 1, 1], barre: 2 },
  'F#': { baseFret: 2, frets: [2, 4, 4, 3, 2, 2], fingers: [1, 3, 4, 2, 1, 1], barre: 2 },
  G: { baseFret: 1, frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  G7: { baseFret: 1, frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  Gm: { baseFret: 3, frets: [3, 5, 5, 3, 3, 3], fingers: [1, 3, 4, 1, 1, 1], barre: 3 },
  'G/B': { baseFret: 1, frets: [-1, 2, 0, 0, 3, 3], fingers: [0, 1, 0, 0, 3, 4] },
  A: { baseFret: 1, frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  A7: { baseFret: 1, frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
  Am: { baseFret: 1, frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  Am7: { baseFret: 1, frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  Asus4: { baseFret: 1, frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0] },
  B: { baseFret: 2, frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 2, 3, 4, 1], barre: 2 },
  B7: { baseFret: 1, frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
  Bm: { baseFret: 2, frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], barre: 2 },
  Bm7: { baseFret: 2, frets: [-1, 2, 4, 2, 3, 2], fingers: [0, 1, 3, 1, 2, 1], barre: 2 },
  Bb: { baseFret: 1, frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1], barre: 1 },
  Eb: { baseFret: 6, frets: [-1, 6, 8, 8, 8, 6], fingers: [0, 1, 2, 3, 4, 1], barre: 6 },
  Ab: { baseFret: 4, frets: [4, 6, 6, 5, 4, 4], fingers: [1, 3, 4, 2, 1, 1], barre: 4 },
};

export function getChordDiagram(chordName: string): ChordDiagramData | null {
  if (GUITAR_VOICINGS[chordName]) {
    return { name: chordName, ...GUITAR_VOICINGS[chordName] };
  }
  const base = chordName.split('/')[0];
  if (GUITAR_VOICINGS[base]) {
    return { name: chordName, ...GUITAR_VOICINGS[base] };
  }
  const match = base.match(/^([A-G](?:#|b)?)(m?)/);
  if (match) {
    const simplified = match[1] + match[2];
    if (GUITAR_VOICINGS[simplified]) {
      return { name: chordName, ...GUITAR_VOICINGS[simplified] };
    }
  }
  return null;
}

export interface StarterSongSeed {
  title: string;
  artist: string;
  genre: string;
  originalKey: string;
  capo: number;
  bpm: number;
  timeSignature: string;
  difficulty: DifficultyLevel;
  isFavorite: boolean;
  notes: string;
  content: string;
}

export const STARTER_SONGS: StarterSongSeed[] = [
  {
    title: 'Tempo Perdido',
    artist: 'Legião Urbana',
    genre: 'Rock Nacional',
    originalKey: 'C',
    capo: 0,
    bpm: 124,
    timeSignature: '4/4',
    difficulty: 'Iniciante',
    isFavorite: true,
    notes: 'Batida pop rock constante. Destaque para a passagem C -> Am7 -> Bm -> Em.',
    content: `[Intro]
[C]  [Am7]  [Bm]  [Em]

[Verso 1]
[C]Todos os dias quando a[Am7]cordo
Não [Bm]tenho mais o tempo que pas[Em]sou
Mas [C]tenho muito [Am7]tempo
Temos [Bm]todo o tempo do [Em]mundo

[Verso 2]
[C]Todos os dias antes de dor[Am7]mir
Lem[Bm]bro e esqueço como foi o [Em]dia
Sem[C]pre em frente, não [Am7]temos tempo a per[Bm]der  [Em]

[Refrão]
[C]Nosso suor sa[Am7]grado é bem mais [Bm]belo que esse sangue a[Em]margo
E tão [C]sério e sel[Am7]vagem, sel[Bm]vagem, sel[Em]vagem

[Verso 3]
[C]Veja o sol dessa ma[Am7]nhã tão cinza
A tem[Bm]pestade que chega é da cor dos teus [Em]olhos
Cas[C]tanhos, en[Am7]tão me abraça [Bm]forte e diz mais uma [Em]vez
Que já es[C]tamos dis[Am7]tantes de [Bm]tudo  [Em]
Temos nosso [C]próprio [Am7]tempo  [Bm]  [Em]`,
  },
  {
    title: 'Evidências',
    artist: 'Chitãozinho & Xororó',
    genre: 'Sertanejo',
    originalKey: 'E',
    capo: 0,
    bpm: 74,
    timeSignature: '4/4',
    difficulty: 'Intermediário',
    isFavorite: true,
    notes: 'Clássico sertanejo. Atenção nas modulações do pré-refrão.',
    content: `[Intro]
[E]  [B/D#]  [C#m]  [A]  [B7]

[Verso 1]
[E]Quando eu digo que deixei de te a[B]mar
É porque eu te [C#m]amo
Quando eu digo que não quero mais vo[A]cê
É porque eu te [F#m]quero
Eu tenho medo de te dar meu cora[B7]ção
E confessar que eu estou em tuas [E]mãos  [B7]

[Pré-Refrão]
[E]Mas não posso imaginar o que vai [B]ser de mim
Se eu te per[C#m]der um dia
[A]Eu me afasto e me defendo de vo[F#m]cê
Mas depois me en[B7]trego

[Refrão]
[E]E nessa loucura de dizer que não te [B]quero
Vou negando as aparên[C#m]cias, disfarçando as evidên[A]cias
Mas pra que viver fin[F#m]gindo, se eu não posso enga[B7]nar meu cora[E]ção  [B7]
Eu sei que te [E]amo!
Chega de men[B]tiras, de negar o meu de[C#m]sejo
Eu te quero mais que [A]tudo, eu preciso do teu [F#m]beijo
Eu entrego a minha [B7]vida pra você fazer o que qui[E]ser de mim`,
  },
  {
    title: 'Trem-Bala',
    artist: 'Ana Vilela',
    genre: 'MPB / Folk',
    originalKey: 'G',
    capo: 0,
    bpm: 88,
    timeSignature: '4/4',
    difficulty: 'Iniciante',
    isFavorite: false,
    notes: 'Dedilhado suave P-I-M-A ou batida leve folk.',
    content: `[Intro]
[G]  [D/F#]  [Em]  [C9]

[Verso 1]
Não é sobre ter [G]todas as pessoas do mundo pra [D/F#]si
É sobre saber que em al[Em]gum lugar alguém zela por [C9]ti
É sobre cantar e po[G]der escutar mais do que a própria [D/F#]voz
É sobre dançar na [Em]chuva de vida que cai sobre [C9]nós

[Pré-Refrão]
[Am7]É saber se sentir infi[C9]nito
Num universo tão [G]vasto e bonito é saber son[D]har
[Am7]Então fazer valer a [C9]pena
Cada verso da[G]quele poema sobre acredi[D]tar

[Refrão]
Não é sobre che[G]gar no topo do mundo e saber que ven[D/F#]ceu
É sobre escalar e sen[Em]tir que o caminho te fortale[C9]ceu
É sobre ser a[G]brigo e também ter morada em outros cora[D/F#]ções
E assim ter a[Em]migos contigo em todas as situa[C9]ções

[Final]
Segura teu [G]filho no colo, sorria e abrace teus [D/F#]pais enquanto estão a[Em]qui
Que a vida é trem-[C9]bala, parceiro, e a gente é só passageiro prestes a par[G]tir`,
  },
  {
    title: 'Oceanos',
    artist: 'Ana Nóbrega',
    genre: 'Worship / Gospel',
    originalKey: 'D',
    capo: 2,
    bpm: 66,
    timeSignature: '4/4',
    difficulty: 'Iniciante',
    isFavorite: true,
    notes: 'Dinâmica crescente na ponte. Manter capo na 2ª casa para soar em E.',
    content: `[Intro]
[Bm]  [A/C#]  [D]  [A]  [G]

[Verso 1]
[Bm]Tua voz me [A/C#]chama sobre as [D]águas
Onde os meus [A]pés podem fa[G]lhar
[Bm]E ali Te en[A/C#]contro no mis[D]tério
Em meio ao [A]mar, confiarei[G]

[Refrão]
[G]Ao Teu [D]nome clama[A]rei
[G]E além das [D]ondas olha[A]rei
Se o mar cres[G]cer, somente em [D]Ti descan[A]sarei
Pois eu sou [G]Teu e Tu és [A]meu  [Bm]

[Ponte]
[Bm]Guia-me pra que em [G]Tudo em Ti confie
Sobre as [D]águas eu caminhe
Por onde [A]quer que chames
[Bm]Leva-me mais fundo do que já es[G]tive
E minha fé será mais [D]firme
Senhor, em Tua pre[A]sença`,
  },
  {
    title: 'Aquarela',
    artist: 'Toquinho',
    genre: 'MPB',
    originalKey: 'G',
    capo: 0,
    bpm: 108,
    timeSignature: '4/4',
    difficulty: 'Intermediário',
    isFavorite: false,
    notes: 'Passagem clássica com baixo descendente: G -> G/B -> C -> D7.',
    content: `[Intro]
[G]  [D/F#]  [Em]  [D]  [C]  [G/B]  [Am7]  [D7]

[Verso 1]
Numa folha qual[G]quer eu desenho um [D/F#]sol ama[Em]relo  [D]
E com cinco ou seis [C]retas é [G/B]fácil fa[Am7]zer um cas[D7]telo
Corro o lápis em [G]torno da mão e me [D/F#]dou uma [Em]luva  [D]
E se faço cho[C]ver, com dois [G/B]riscos te[Am7]nho um guarda-[D7]chuva

[Refrão]
Se um pinguinho de [C]tinta cai num peda[D7]cinho azul do pa[G]pel  [Em]
Num instante ima[Am7]gino uma linda gai[D7]vota a voar no [G]céu  [G7]
Vai vo[C]ando, contor[D7]nando a imensa [G]curva norte e [Em]sul
Vou com [Am7]ela via[D7]jando Havaí, Pequim ou Istam[G]bul

[Verso 2]
Pinto um barco a [G]vela branco nave[D/F#]gando, é tanto [Em]céu e mar num [D]beijo azul
Entre as nuvens [C]vem surgindo um [G/B]lindo avião [Am7]rosa e gre[D7]ná`,
  },
];
