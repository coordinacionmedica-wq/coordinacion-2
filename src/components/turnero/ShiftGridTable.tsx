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
  compactView?: boolean;
}

// Hour limits per category
const HOUR_LIMITS: Record<string, { min: number; max: number }> = {
  'Planta': { min: 150, max: 200 },
  'CTA': { min: 150, max: 200 },
  'APS': { min: 100, max: 160 },
  'Rural': { min: 120, max: 180 },
  'Disponibilidad': { min: 0, max: 48 },
};

export function ShiftGridTable(props: ShiftGridTableProps) {
  const {
    doctors, currentMonthData, variables,
    selectedMonth, selectedYear, daysInMonth,
    showGridHours, isAdmin, onSetShift, conflicts, sundays,
    compactView,
  } = props;

  const [editingCell, setEditingCell] = useState<{ doctorId: number; day: number; slot: SlotType } | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [pasteMessage, setPasteMessage] = useState('');

  const handleSetShift = async (doctorId: number, day: number, slot: SlotType, value: string) => {
    await onSetShift(doctorId, day, slot, value);
    setEditingCell(null);
  };

  // Build ordered list of (doctorId, slot) rows for paste navigation
  const rowOrder = useMemo(() => {
    const rows: { doctorId: number; slot: SlotType }[] = [];
    doctors.forEach(med => {
      (['m', 't', 'n'] as SlotType[]).forEach(slot => {
        rows.push({ doctorId: med.id, slot });
      });
    });
    return rows;
  }, [doctors]);

  // Bulk paste handler: parses tab/newline-separated clipboard data from Excel
  const handleBulkPaste = async (e: React.ClipboardEvent) => {
    if (!isAdmin || !editingCell) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text || !text.includes('\t')) return; // Only handle multi-cell paste (has tabs)

    e.preventDefault();
    const rows = text.split(/\r?\n/).filter(r => r.trim());
    if (rows.length === 0) return;

    const startRowIdx = rowOrder.findIndex(r => r.doctorId === editingCell.doctorId && r.slot === editingCell.slot);
    const startDay = editingCell.day;

    let cellCount = 0;
    for (let ri = 0; ri < rows.length; ri++) {
      const cells = rows[ri].split('\t');
      const currentRowIdx = startRowIdx + ri;
      if (currentRowIdx >= rowOrder.length) break;
      const { doctorId, slot } = rowOrder[currentRowIdx];

      for (let ci = 0; ci < cells.length; ci++) {
        const day = startDay + ci;
        if (day > daysInMonth) break;
        const value = cells[ci].trim() || 'X';
        await onSetShift(doctorId, day, slot, value);
        cellCount++;
      }
    }

    setEditingCell(null);
    setPasteMessage(`✓ ${cellCount} celdas pegadas`);
    setTimeout(() => setPasteMessage(''), 3000);
  };

  return (
    <div className="relative" onPaste={handleBulkPaste}>
      {/* Mobile hint */}
      <div className="md:hidden flex items-center justify-between px-2 pb-1 text-[8px] text-slate-400 font-bold italic">
        <span>← Desliza horizontalmente →</span>
      </div>

      {pasteMessage && (
        <div className="absolute top-2 right-4 z-50 bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg animate-pulse">
          {pasteMessage}
        </div>
      )}

      <div className="overflow-x-auto border border-slate-200 rounded-xl md:rounded-[18px] bg-white shadow-xl overflow-y-hidden custom-scrollbar -mx-1 md:mx-0">
        <table className="w-full text-xs md:text-xs text-center border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="sticky left-0 bg-slate-50 z-30 min-w-[90px] md:min-w-[160px] text-left px-2 md:px-4 py-3 md:py-4 text-sky-700 border-r-2 border-sky-500 border-b border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.05)] text-[8px] md:text-xs font-black">
                MÉDICO
              </th>
              <th className="w-6 md:w-8 border border-slate-200 text-slate-400 font-black border-b text-[7px] md:text-xs">J.</th>
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dow = new Date(selectedYear, selectedMonth, day).getDay();
                return (
                  <th key={day} className={`px-0.5 md:px-2 py-1 md:py-2 border border-slate-200 border-b ${dow === 0 ? 'border-r-2 border-r-sky-500' : ''} ${dow === 0 || dow === 6 ? 'bg-sky-50/50' : ''}`}>
                    <div className="text-slate-800 text-xs md:text-sm font-bold">{day}</div>
                    <div className="text-[6px] md:text-[8px] text-emerald-600 uppercase font-bold">{DAY_NAMES[dow]}</div>
                  </th>
                );
              })}
              {sundays.map((_, i) => (
                <th key={i} className="min-w-[30px] md:min-w-[40px] px-1 md:px-2 bg-slate-100 border border-slate-200 border-b text-[7px] md:text-[8px] text-sky-600 font-bold">
                  S{i + 1}
                </th>
              ))}
              <th className="sticky right-0 z-30 bg-sky-500 text-white font-black px-2 md:px-4 min-w-[40px] md:min-w-[60px] border-b border-slate-200 shadow-[-2px_0_5px_rgba(0,0,0,0.1)] text-[8px] md:text-xs">TOT</th>
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

              const limits = HOUR_LIMITS[med.cat] || { min: 0, max: 999 };
              const hourStatus = medTotalMonth < limits.min ? 'low' : medTotalMonth > limits.max ? 'high' : 'ok';

              // ── Compact View: single row per doctor ──
              if (compactView) {
                return (
                  <tr key={med.id} className="group hover:bg-slate-50 transition-colors border-b-2 border-slate-200">
                    <td className="sticky left-0 bg-white z-20 text-left px-2 md:px-4 border-r-2 border-sky-500 border-b border-slate-200 shadow-xl group-hover:bg-slate-50">
                      <div className="font-bold text-slate-800 text-xs md:text-xs whitespace-nowrap truncate max-w-[80px] md:max-w-none">
                        {med.genero === 'F' ? 'Dra.' : 'Dr.'} {med.nombre}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[7px] md:text-[8px] text-slate-400 font-mono">{med.cat}</span>
                        <span className={`text-[7px] font-bold ${hourStatus === 'low' ? 'text-amber-600' : hourStatus === 'high' ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {medTotalMonth}h / {limits.min}-{limits.max}h
                        </span>
                      </div>
                    </td>
                    <td className="bg-slate-50 text-slate-400 font-black text-[7px] py-1 border-r border-slate-200">—</td>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const d = i + 1;
                      const dow = new Date(selectedYear, selectedMonth, d).getDay();
                      const m = currentMonthData[med.id]?.m?.[d] || 'X';
                      const t = currentMonthData[med.id]?.t?.[d] || 'X';
                      const n = currentMonthData[med.id]?.n?.[d] || 'X';
                      const activeCount = [m, t, n].filter(v => v !== 'X' && v !== 'PT').length;
                      const hasPT = [m, t, n].includes('PT');
                      const bg = activeCount === 0 ? '' : activeCount === 1 ? 'bg-emerald-100' : activeCount >= 2 ? 'bg-sky-200' : '';
                      return (
                        <td key={d} className={`border border-slate-200 py-1 text-center text-[7px] md:text-xs font-bold ${dow === 0 ? 'border-r-2 border-r-sky-500' : ''} ${bg} ${hasPT ? 'text-amber-500' : 'text-slate-600'}`}
                          title={`M:${m} T:${t} N:${n}`}
                        >
                          {activeCount > 0 ? activeCount : hasPT ? 'PT' : ''}
                        </td>
                      );
                    })}
                    {weeklyAcc.map((wv, wi) => {
                      let colorClass = 'bg-emerald-100 text-emerald-800';
                      let weekLabel = 'Semana normal';
                      if (wv >= 42) { colorClass = 'bg-emerald-500 text-white'; weekLabel = 'Semana en límite'; }
                      if (wv >= 66) { colorClass = 'bg-rose-500 text-white shadow-inner'; weekLabel = 'Semana excedida'; }
                      return (
                        <td key={wi} className={`border border-slate-200 font-black text-[8px] md:text-xs ${colorClass}`}
                          title={`Semana ${wi + 1}: ${wv}h — ${weekLabel} (límite normal <42h, máx 66h)`}>
                          {wv}h
                        </td>
                      );
                    })}
                    <td className={`sticky right-0 z-20 font-black text-[8px] md:text-xs border border-slate-200 shadow-[-2px_0_5px_rgba(0,0,0,0.1)] ${
                      hourStatus === 'low' ? 'bg-amber-500 text-white' :
                      hourStatus === 'high' ? 'bg-rose-500 text-white' :
                      'bg-sky-500 text-white'
                    }`} title={`Total mes: ${medTotalMonth}h — Rango aceptado: ${limits.min}h–${limits.max}h | ${
                      hourStatus === 'low' ? '⚠️ Bajo el mínimo requerido' :
                      hourStatus === 'high' ? '🔴 Supera el máximo' :
                      '✅ Dentro del rango'
                    }`}>
                      {medTotalMonth}h
                    </td>
                  </tr>
                );
              }

              // ── Full View: 3 rows per doctor (M/T/N) ──
              return (['m', 't', 'n'] as SlotType[]).map((slot, sIdx) => (
                <tr key={`${med.id}-${slot}`} className={`group hover:bg-slate-50 transition-colors ${sIdx === 2 ? 'border-b-4 border-slate-200' : ''}`}>
                  {sIdx === 0 && (
                    <td rowSpan={3} className="sticky left-0 bg-white z-20 text-left px-2 md:px-4 border-r-2 border-sky-500 border-b border-slate-200 shadow-xl group-hover:bg-slate-50">
                      <div className="font-bold text-slate-800 text-xs md:text-xs whitespace-nowrap truncate max-w-[80px] md:max-w-none">
                        {med.genero === 'F' ? 'Dra.' : 'Dr.'} {med.nombre}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] md:text-xs text-slate-400 font-mono">{med.cat}</span>
                        <span className={`text-[7px] font-bold ${hourStatus === 'low' ? 'text-amber-600' : hourStatus === 'high' ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {medTotalMonth}/{limits.min}-{limits.max}h
                        </span>
                      </div>
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
                            onChange={e => setEditingValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); handleSetShift(med.id, d, slot, editingValue || 'X'); }
                              if (e.key === 'Escape') { setEditingCell(null); }
                              if (e.key === 'Tab') { e.preventDefault(); handleSetShift(med.id, d, slot, editingValue || 'X'); }
                            }}
                            onBlur={() => handleSetShift(med.id, d, slot, editingValue || 'X')}
                            className="w-full text-center bg-transparent outline-none text-emerald-700 text-[8px] md:text-xs"
                            style={{ minWidth: 22 }}
                            maxLength={6}
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
                        let weekLabel = 'Semana normal';
                        if (wv >= 42) { colorClass = 'bg-emerald-500 text-white'; weekLabel = 'Semana en límite'; }
                        if (wv >= 66) { colorClass = 'bg-rose-500 text-white shadow-inner'; weekLabel = 'Semana excedida'; }
                        return (
                          <td key={wi} rowSpan={3} className={`border border-slate-200 font-black text-[8px] md:text-xs ${colorClass}`}
                            title={`Semana ${wi + 1}: ${wv}h — ${weekLabel} (límite normal <42h, máx 66h)`}>
                            {wv}h
                          </td>
                        );
                      })}
                      <td rowSpan={3} className={`sticky right-0 z-20 font-black text-[8px] md:text-xs border border-slate-200 shadow-[-2px_0_5px_rgba(0,0,0,0.1)] ${
                        hourStatus === 'low' ? 'bg-amber-500 text-white' :
                        hourStatus === 'high' ? 'bg-rose-500 text-white' :
                        'bg-sky-500 text-white'
                      }`} title={`Total mes: ${medTotalMonth}h — Rango: ${limits.min}h–${limits.max}h | ${
                        hourStatus === 'low' ? '⚠️ Bajo el mínimo' :
                        hourStatus === 'high' ? '🔴 Supera el máximo' :
                        '✅ Dentro del rango'
                      }`}>
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
