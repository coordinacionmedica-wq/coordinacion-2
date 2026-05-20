import React, { useState, useMemo } from 'react';
import { SlotType, MonthlyData, VarSlotConfig, Doctor } from '../../types';
import { DAY_NAMES } from '../../constants';

interface ShiftGridTableProps {
  doctors: Doctor[];
  currentMonthData: MonthlyData;
  variables: VarSlotConfig;
  selectedMonth: number;
  selectedYear: number;
  daysInMonth: number;
  showGridHours: boolean;
  isAdmin: boolean;
  onSetShift: (doctorId: number, day: number, slot: SlotType, sigla: string) => Promise<void>;
  conflicts: {
    personal: Record<string, { type: string; message: string }[]>;
    coverage: Record<string, string[]>;
  };
  sundays: number[];
}

export function ShiftGridTable(props: ShiftGridTableProps) {
  const {
    doctors, currentMonthData, variables,
    selectedMonth, selectedYear, daysInMonth,
    showGridHours, isAdmin, onSetShift, conflicts, sundays,
  } = props;

  const [editingCell, setEditingCell] = useState<{ doctorId: number; day: number; slot: SlotType } | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const handleSetShift = async (doctorId: number, day: number, slot: SlotType, value: string) => {
    await onSetShift(doctorId, day, slot, value);
    setEditingCell(null);
  };

  return (
    <div className="relative">
      {/* Mobile hint */}
      <div className="md:hidden flex items-center justify-between px-2 pb-1 text-[8px] text-slate-400 font-bold italic">
        <span>← Desliza horizontalmente →</span>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl md:rounded-[18px] bg-white shadow-xl overflow-y-hidden custom-scrollbar -mx-1 md:mx-0">
        <table className="w-full text-[9px] md:text-[10px] text-center border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="sticky left-0 bg-slate-50 z-30 min-w-[90px] md:min-w-[160px] text-left px-2 md:px-4 py-3 md:py-4 text-sky-700 border-r-2 border-sky-500 border-b border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.05)] text-[8px] md:text-[10px] font-black">
                MÉDICO
              </th>
              <th className="w-6 md:w-8 border border-slate-200 text-slate-400 font-black border-b text-[7px] md:text-[9px]">J.</th>
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dow = new Date(selectedYear, selectedMonth, day).getDay();
                return (
                  <th key={day} className={`px-0.5 md:px-2 py-1 md:py-2 border border-slate-200 border-b ${dow === 0 ? 'border-r-2 border-r-sky-500' : ''} ${dow === 0 || dow === 6 ? 'bg-sky-50/50' : ''}`}>
                    <div className="text-slate-800 text-[9px] md:text-[11px] font-bold">{day}</div>
                    <div className="text-[6px] md:text-[8px] text-emerald-600 uppercase font-bold">{DAY_NAMES[dow]}</div>
                  </th>
                );
              })}
              {sundays.map((_, i) => (
                <th key={i} className="min-w-[30px] md:min-w-[40px] px-1 md:px-2 bg-slate-100 border border-slate-200 border-b text-[7px] md:text-[8px] text-sky-600 font-bold">
                  S{i + 1}
                </th>
              ))}
              <th className="sticky right-0 z-30 bg-sky-500 text-white font-black px-2 md:px-4 min-w-[40px] md:min-w-[60px] border-b border-slate-200 shadow-[-2px_0_5px_rgba(0,0,0,0.1)] text-[8px] md:text-[10px]">TOT</th>
            </tr>
          </thead>
          <tbody>
            {doctors.map(med => {
              let medTotalMonth = 0;
              let weeklyAcc = Array(sundays.length).fill(0);

              for (let d = 1; d <= daysInMonth; d++) {
                (['m', 't', 'n'] as SlotType[]).forEach(slot => {
                  const sigla = currentMonthData[med.id]?.[slot]?.[d] || 'X';
                  const peso = variables[slot][sigla] || 0;
                  medTotalMonth += peso;
                  const wIdx = sundays.findIndex(sunD => d <= sunD);
                  if (wIdx !== -1) weeklyAcc[wIdx] += peso;
                });
              }

              return (['m', 't', 'n'] as SlotType[]).map((slot, sIdx) => (
                <tr key={`${med.id}-${slot}`} className={`group hover:bg-slate-50 transition-colors ${sIdx === 2 ? 'border-b-4 border-slate-200' : ''}`}>
                  {sIdx === 0 && (
                    <td rowSpan={3} className="sticky left-0 bg-white z-20 text-left px-2 md:px-4 border-r-2 border-sky-500 border-b border-slate-200 shadow-xl group-hover:bg-slate-50">
                      <div className="font-bold text-slate-800 text-[9px] md:text-xs whitespace-nowrap truncate max-w-[80px] md:max-w-none">{med.nombre}</div>
                      <div className="text-[8px] md:text-[9px] text-slate-400 font-mono">{med.cat}</div>
                    </td>
                  )}
                  <td className="bg-slate-50 text-slate-400 font-black text-[7px] md:text-[8px] py-1 md:py-2 border-r border-slate-200 uppercase">
                    {slot === 'm' ? 'M' : slot === 't' ? 'T' : 'N'}
                  </td>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const d = i + 1;
                    const dow = new Date(selectedYear, selectedMonth, d).getDay();
                    const val = currentMonthData[med.id]?.[slot]?.[d] || 'X';
                    const isPT = val === 'PT';
                    const isShift = val !== 'X';
                    const cellConflicts = conflicts.personal[`${med.id}-${d}-${slot}`] || [];
                    const hasConflict = cellConflicts.length > 0;
                    const isEditing = editingCell?.doctorId === med.id && editingCell?.day === d && editingCell?.slot === slot;

                    return (
                      <td
                        key={d}
                        onClick={() => {
                          if (!isAdmin) return;
                          setEditingCell({ doctorId: med.id, day: d, slot });
                          setEditingValue(val === 'X' ? '' : val);
                        }}
                        title={cellConflicts.map(c => c.message).join('\n')}
                        className={`
                          border border-slate-200 py-0.5 md:py-1 cursor-pointer
                          transition-all duration-150 relative text-center text-[8px] md:text-xs
                          ${dow === 0 ? 'border-r-2 border-r-sky-500' : ''}
                          ${dow === 0 || dow === 6 ? 'bg-sky-50/30' : ''}
                          ${isEditing ? 'bg-emerald-50 ring-2 ring-emerald-400 ring-inset z-10' : ''}
                          ${!isEditing && !isShift ? 'opacity-10 text-slate-400' : ''}
                          ${!isEditing && isPT ? 'text-amber-600 font-black' : 'text-slate-800 font-medium'}
                          ${!isEditing && hasConflict ? 'bg-rose-50 text-rose-600' : ''}
                        `}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value.toUpperCase())}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); handleSetShift(med.id, d, slot, editingValue || 'X'); }
                              if (e.key === 'Escape') { setEditingCell(null); }
                              if (e.key === 'Tab') { e.preventDefault(); handleSetShift(med.id, d, slot, editingValue || 'X'); }
                            }}
                            onBlur={() => handleSetShift(med.id, d, slot, editingValue || 'X')}
                            className="w-full text-center bg-transparent outline-none font-black text-emerald-700 text-[8px] md:text-xs uppercase"
                            style={{ minWidth: 22 }}
                            maxLength={4}
                          />
                        ) : (
                          isShift ? (showGridHours ? `${variables[slot][val] || 0}` : val) : ''
                        )}
                      </td>
                    );
                  })}
                  {sIdx === 0 && (
                    <>
                      {weeklyAcc.map((wv, wi) => {
                        let colorClass = 'bg-emerald-100 text-emerald-800';
                        if (wv >= 42) colorClass = 'bg-emerald-500 text-white';
                        if (wv >= 66) colorClass = 'bg-rose-500 text-white shadow-inner';
                        return (
                          <td key={wi} rowSpan={3} className={`border border-slate-200 font-black text-[8px] md:text-xs ${colorClass}`}>
                            {wv}h
                          </td>
                        );
                      })}
                      <td rowSpan={3} className="sticky right-0 z-20 bg-sky-500 text-white font-black text-[8px] md:text-xs border border-slate-200 shadow-[-2px_0_5px_rgba(0,0,0,0.1)]">
                        {medTotalMonth}h
                      </td>
                    </>
                  )}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
