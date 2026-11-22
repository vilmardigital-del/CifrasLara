import { X } from 'lucide-react';
import { getChordDiagram } from '../utils/musicTheory';

interface ChordDiagramModalProps {
  chordName: string | null;
  onClose: () => void;
}

export function ChordDiagramModal({ chordName, onClose }: ChordDiagramModalProps) {
  if (!chordName) return null;
  const diagram = getChordDiagram(chordName);

  const stringLabels = ['E', 'A', 'D', 'G', 'B', 'e'];
  const fretCount = 4;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Diagrama de acorde · Violão</p>
            <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {chordName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar diagrama"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {diagram ? (
          <div className="flex flex-col items-center py-2">
            <svg viewBox="0 0 180 175" className="w-52 h-48 select-none" aria-label={`Acorde ${chordName}`}>
              {diagram.baseFret > 1 ? (
                <text
                  x="14"
                  y="44"
                  className="fill-slate-600 dark:fill-slate-300 font-mono"
                  fontSize="12"
                  fontWeight="600"
                >
                  {diagram.baseFret}ª
                </text>
              ) : (
                <line x1="34" y1="26" x2="154" y2="26" stroke="#1E293B" strokeWidth="4.5" />
              )}

              {Array.from({ length: fretCount + 1 }).map((_, fretIdx) => {
                const y = 26 + fretIdx * 28;
                return (
                  <line
                    key={fretIdx}
                    x1="34"
                    y1={y}
                    x2="154"
                    y2={y}
                    stroke="#CBD5E1"
                    strokeWidth={fretIdx === 0 ? 2 : 1.5}
                  />
                );
              })}

              {Array.from({ length: 6 }).map((_, stringIdx) => {
                const x = 34 + stringIdx * 24;
                return (
                  <line
                    key={stringIdx}
                    x1={x}
                    y1="26"
                    x2={x}
                    y2={26 + fretCount * 28}
                    stroke="#94A3B8"
                    strokeWidth={1.2 + (5 - stringIdx) * 0.25}
                  />
                );
              })}

              {diagram.barre && (
                <rect
                  x="28"
                  y={26 + (diagram.barre - diagram.baseFret + 0.5) * 28 - 8}
                  width="132"
                  height="16"
                  rx="8"
                  fill="#1D4ED8"
                  opacity="0.9"
                />
              )}

              {diagram.frets.map((fret, idx) => {
                const x = 34 + idx * 24;
                if (fret === -1) {
                  return (
                    <text
                      key={idx}
                      x={x}
                      y="17"
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="700"
                      className="fill-slate-400"
                    >
                      ×
                    </text>
                  );
                }
                if (fret === 0) {
                  return (
                    <circle
                      key={idx}
                      cx={x}
                      cy="13"
                      r="4.5"
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="1.8"
                    />
                  );
                }
                const relFret = fret - diagram.baseFret + 1;
                if (relFret < 1 || relFret > fretCount) return null;
                const cy = 26 + (relFret - 0.5) * 28;
                const finger = diagram.fingers[idx];
                return (
                  <g key={idx}>
                    <circle cx={x} cy={cy} r="8.5" fill="#1D4ED8" />
                    {finger > 0 && (
                      <text
                        x={x}
                        y={cy + 3.5}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="700"
                        fill="#FFFFFF"
                        className="font-mono"
                      >
                        {finger}
                      </text>
                    )}
                  </g>
                );
              })}

              {stringLabels.map((lbl, idx) => (
                <text
                  key={lbl + idx}
                  x={34 + idx * 24}
                  y="162"
                  textAnchor="middle"
                  fontSize="11"
                  className="fill-slate-500 font-mono"
                >
                  {lbl}
                </text>
              ))}
            </svg>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ○ corda solta · × abafada · números indicam os dedos
            </p>
          </div>
        ) : (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Diagrama detalhado para <span className="font-mono font-semibold">{chordName}</span> ainda não mapeado nesta visualização rápida.
            </p>
            <p className="text-xs text-slate-500">
              Dica: utilize a transposição para simplificar a pestana ou consulte o acorde base.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
