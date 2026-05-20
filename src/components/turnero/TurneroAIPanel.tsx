import React from 'react';
import { BrainCircuit, Sparkles, Wand2, Info } from 'lucide-react';
import { MonthlyData } from '../../types';

interface TurneroAIPanelProps {
  isGenerating: boolean;
  suggestions: MonthlyData | null;
  onGenerate: () => void;
  onApply: () => void;
  onDiscard: () => void;
}

export function TurneroAIPanel({ isGenerating, suggestions, onGenerate, onApply, onDiscard }: TurneroAIPanelProps) {
  return (
    <div className="bg-emerald-900 text-emerald-100 p-4 md:p-6 rounded-2xl md:rounded-[32px] border border-emerald-800 shadow-xl no-print">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="p-2 md:p-3 bg-emerald-800 rounded-xl md:rounded-2xl text-emerald-400">
            <BrainCircuit className="w-5 h-5 md:w-6 md:h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="font-black uppercase tracking-tight text-white text-sm md:text-base">IA Shift Engine</h3>
            <p className="text-[9px] md:text-[10px] uppercase font-bold opacity-60">Generador de mallas automáticas</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {suggestions ? (
            <>
              <button
                onClick={onDiscard}
                className="flex-1 sm:flex-none bg-slate-800 text-white px-3 md:px-4 py-2 md:py-2.5 rounded-xl font-bold text-[10px] md:text-xs hover:bg-slate-700 transition-all border border-slate-700"
              >
                DESCARTAR
              </button>
              <button
                onClick={onApply}
                className="flex-1 sm:flex-none bg-emerald-500 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-black text-[10px] md:text-xs hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
              >
                APLICAR MALLA
              </button>
            </>
          ) : (
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className="flex-1 sm:flex-none bg-white text-emerald-900 px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-black text-[10px] md:text-xs hover:bg-emerald-50 transition-all shadow-lg shadow-white/10 disabled:opacity-50"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <Wand2 className="w-4 h-4 animate-spin" /> PROCESANDO...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4" /> GENERAR PROPUESTA
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {suggestions && (
        <div className="mt-4 md:mt-6 p-3 md:p-4 bg-emerald-950/50 rounded-xl md:rounded-2xl border border-emerald-800/50">
          <p className="text-[9px] md:text-[10px] font-bold text-emerald-400 mb-0 uppercase italic flex items-center gap-2">
            <Info className="w-3 h-3 flex-shrink-0" /> Propuesta generada. Revise antes de aplicar.
          </p>
        </div>
      )}
    </div>
  );
}
