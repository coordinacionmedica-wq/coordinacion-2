import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PhoneIncoming, Users, Clock, Eye, EyeOff } from 'lucide-react';
import { SlotType, Doctor } from '../types';
import { useAppContext } from '../context/AppContext';
import { useShiftActions } from '../hooks/useShiftActions';
import { useTurneroFilters } from '../hooks/useTurneroFilters';
import { useTurneroExport } from '../hooks/useTurneroExport';
import { useAIActions } from '../hooks/useAIActions';
import { TurneroFilterPanel, TurneroAIPanel, ShiftGridTable } from './turnero';

interface TurneroViewProps {
  onOpenCallModal: () => void;
  onDownloadTemplate: () => void;
  onImportExcel: (e: React.ChangeEvent<HTMLInputElement>) => void;
  globalTotalHours: number;
}

export function TurneroView({ onOpenCallModal, onDownloadTemplate, onImportExcel, globalTotalHours }: TurneroViewProps) {
  const {
    session, doctors, currentMonthData, variables,
    selectedMonth, setSelectedMonth, selectedYear, setSelectedYear, daysInMonth,
    availabilityCalls, auditLogs, setCurrentMonthData, setNotification,
  } = useAppContext();

  const { setShift: hookSetShift, publishTurnos } = useShiftActions();
  const isAdminUser = session?.r === 'admin' || session?.r === 'root';

  // ── Hooks ──
  const filters = useTurneroFilters(doctors, currentMonthData, variables, daysInMonth);

  const { exportExcel, exportPDF } = useTurneroExport({
    doctors, currentMonthData, variables,
    selectedMonth, selectedYear, daysInMonth,
    showGridHours: filters.showGridHours,
    selectedRoles: filters.selectedRoles,
    selectedCategories: filters.selectedCategories,
    doctorFilter: filters.doctorFilter,
  });

  // AI Suggestions via unified hook
  const { generateAISuggestions, applyAISuggestions } = useAIActions();
  const [aiIsGenerating, setAiIsGenerating] = React.useState(false);
  const [aiSuggestions, setAiSuggestions] = React.useState<import('../types').MonthlyData | null>(null);

  const ai = {
    isGenerating: aiIsGenerating,
    suggestions: aiSuggestions,
    generate: async () => {
      setAiIsGenerating(true);
      const result = await generateAISuggestions();
      setAiSuggestions(result);
      setAiIsGenerating(false);
    },
    apply: async () => {
      if (aiSuggestions) {
        await applyAISuggestions(aiSuggestions);
        setAiSuggestions(null);
      }
    },
    discard: () => setAiSuggestions(null),
  };

  // ── Computed data ──
  const conflicts = useMemo(() => {
    const map: Record<string, { type: string; message: string }[]> = {};
    const criticalCoverageMap: Record<string, string[]> = {};
    const criticalSiglas: Record<SlotType, string[]> = { m: ['M'], t: ['T'], n: ['N'] };
    doctors.forEach(doc => {
      if (doc.st !== 'activo') return;
      for (let d = 1; d <= daysInMonth; d++) {
        const m = currentMonthData[doc.id]?.m?.[d] || 'X';
        const t = currentMonthData[doc.id]?.t?.[d] || 'X';
        const n = currentMonthData[doc.id]?.n?.[d] || 'X';
        const activeSlots = [
          { s: 'm' as SlotType, v: m },
          { s: 't' as SlotType, v: t },
          { s: 'n' as SlotType, v: n }
        ].filter(x => x.v !== 'X' && x.v !== 'PT');
        if (activeSlots.length > 1) {
          activeSlots.forEach(as => {
            const key = `${doc.id}-${d}-${as.s}`;
            if (!map[key]) map[key] = [];
            map[key].push({ type: 'overlap', message: `Sobrecarga: El médico tiene múltiples turnos activos el mismo día (${activeSlots.map(x => x.s.toUpperCase()).join(', ')}).` });
          });
        }
        if (n !== 'X' && n !== 'PT' && d < daysInMonth) {
          const nextM = currentMonthData[doc.id]?.m?.[d + 1] || 'X';
          if (nextM !== 'X' && nextM !== 'PT') {
            const keyN = `${doc.id}-${d}-n`;
            const keyM = `${doc.id}-${d + 1}-m`;
            if (!map[keyN]) map[keyN] = [];
            if (!map[keyM]) map[keyM] = [];
            const msg = `Conflicto Post-Turno: Turno de noche seguido de mañana sin PT.`;
            map[keyN].push({ type: 'post-turno', message: msg });
            map[keyM].push({ type: 'post-turno', message: msg });
          }
        }
      }
    });
    for (let d = 1; d <= daysInMonth; d++) {
      (['m', 't', 'n'] as SlotType[]).forEach(slot => {
        const assigned = Object.values(currentMonthData).map(ds => ds[slot]?.[d] || 'X');
        criticalSiglas[slot].forEach(sigla => {
          if (!assigned.includes(sigla)) {
            const key = `${d}-${slot}`;
            if (!criticalCoverageMap[key]) criticalCoverageMap[key] = [];
            criticalCoverageMap[key].push(`Falta cobertura crítica: '${sigla}'`);
          }
        });
      });
    }
    return { personal: map, coverage: criticalCoverageMap };
  }, [currentMonthData, doctors, daysInMonth]);

  const sundays = useMemo(() => {
    const list: number[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(selectedYear, selectedMonth, d).getDay() === 0 || d === daysInMonth) list.push(d);
    }
    return list;
  }, [selectedMonth, selectedYear, daysInMonth]);

  // ── Compact view toggle ──
  const [compactView, setCompactView] = useState(false);
  const [showOnDuty, setShowOnDuty] = useState(false);
  const [showCoverage, setShowCoverage] = useState(false);

  // ── Who's on shift NOW ──
  const currentShiftInfo = useMemo(() => {
    const now = new Date();
    const today = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    if (currentMonth !== selectedMonth || currentYear !== selectedYear) return null;
    const hour = now.getHours();
    let currentSlot: SlotType = 'm';
    if (hour >= 7 && hour < 13) currentSlot = 'm';
    else if (hour >= 13 && hour < 19) currentSlot = 't';
    else currentSlot = 'n';

    const onDuty: { doctor: Doctor; sigla: string }[] = [];
    doctors.forEach(doc => {
      if (doc.st !== 'activo') return;
      const sigla = currentMonthData[doc.id]?.[currentSlot]?.[today] || 'X';
      if (sigla !== 'X' && sigla !== 'PT') {
        onDuty.push({ doctor: doc, sigla });
      }
    });
    return { slot: currentSlot, today, onDuty };
  }, [doctors, currentMonthData, selectedMonth, selectedYear]);

  // ── Conflict counts ──
  const conflictCounts = useMemo(() => {
    let overlaps = 0;
    let postTurno = 0;
    let noCoverage = 0;
    Object.values(conflicts.personal).forEach(arr => {
      arr.forEach(c => {
        if (c.type === 'overlap') overlaps++;
        if (c.type === 'post-turno') postTurno++;
      });
    });
    Object.values(conflicts.coverage).forEach(arr => { noCoverage += arr.length; });
    return { overlaps, postTurno, noCoverage, total: overlaps + postTurno + noCoverage };
  }, [conflicts]);

  // ── Daily coverage summary (for coverage row) ──
  const dailyCoverage = useMemo(() => {
    const cov: { day: number; m: number; t: number; n: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      let mCount = 0, tCount = 0, nCount = 0;
      doctors.forEach(doc => {
        if (doc.st !== 'activo') return;
        const ms = currentMonthData[doc.id]?.m?.[d] || 'X';
        const ts = currentMonthData[doc.id]?.t?.[d] || 'X';
        const ns = currentMonthData[doc.id]?.n?.[d] || 'X';
        if (ms !== 'X' && ms !== 'PT') mCount++;
        if (ts !== 'X' && ts !== 'PT') tCount++;
        if (ns !== 'X' && ns !== 'PT') nCount++;
      });
      cov.push({ day: d, m: mCount, t: tCount, n: nCount });
    }
    return cov;
  }, [doctors, currentMonthData, daysInMonth]);

  // ── Render ──
  return (
    <motion.div key="turnos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1.5 md:space-y-2">

      {/* ── Unified compact top bar ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm no-print">

        {/* Row 1: title + stats chips + action button */}
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
          <h2 className="text-xs font-black text-slate-800 shrink-0">Turnero</h2>
          <span className="text-[8px] text-slate-400 font-mono hidden sm:inline">|</span>

          {/* Stats chips */}
          <div className="flex flex-wrap gap-1 flex-1 min-w-0">
            <span className="text-[8px] font-bold bg-sky-50 text-sky-700 border border-sky-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
              🏥 Planta: {doctors.filter(d => d.cat === 'Planta' && d.st === 'activo').length}
            </span>
            <span className="text-[8px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
              🌿 Rural: {doctors.filter(d => d.cat === 'Rural' && d.st === 'activo').length}
            </span>
            <span className="text-[8px] font-bold bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
              📋 Nov: {auditLogs.filter(l => l.targetMonth === selectedMonth).length}
            </span>
            {conflictCounts.total > 0 ? (
              <span className="text-[8px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                ⚠️ {conflictCounts.overlaps > 0 ? `${conflictCounts.overlaps} SC` : ''}{conflictCounts.postTurno > 0 ? ` ${conflictCounts.postTurno} PT` : ''}{conflictCounts.noCoverage > 0 ? ` ${conflictCounts.noCoverage} NC` : ''}
              </span>
            ) : (
              <span className="text-[8px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">✓ Sin conflictos</span>
            )}
            {availabilityCalls[0] && (
              <span className="text-[8px] font-bold bg-slate-50 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded-full truncate max-w-[140px]" title={availabilityCalls[0].doctorName}>
                📞 {availabilityCalls[0].doctorName}
              </span>
            )}
          </div>

          {/* Expandable toggles */}
          <div className="flex items-center gap-1 shrink-0">
            {currentShiftInfo && (
              <button
                onClick={() => setShowOnDuty(v => !v)}
                title="En turno ahora"
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-bold border transition-all ${
                  showOnDuty ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span className="hidden sm:inline">En turno</span>
                <span className="bg-white/30 text-[7px] font-black px-1 rounded-full">{currentShiftInfo.onDuty.length}</span>
              </button>
            )}
            <button
              onClick={() => setShowCoverage(v => !v)}
              title="Cobertura diaria"
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-bold border transition-all ${
                showCoverage ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Users className="w-3 h-3" />
              <span className="hidden sm:inline">Cobertura</span>
            </button>
            {(session?.r === 'admin' || (session?.doctorId && doctors.find(d => d.id === session.doctorId)?.permissions?.includes('call_availability'))) && (
              <button
                onClick={onOpenCallModal}
                className="flex items-center gap-1 bg-rose-500 text-white px-2 py-1 rounded-lg font-black text-[8px] hover:bg-rose-600 transition-all shadow-sm"
              >
                <PhoneIncoming className="w-3 h-3 animate-pulse" />
                <span className="hidden sm:inline">Disponibilidad</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2 (collapsible): En turno ahora */}
        <AnimatePresence>
          {showOnDuty && currentShiftInfo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden border-t border-indigo-100"
            >
              <div className="px-3 py-2 bg-indigo-50/50">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-3 h-3 text-indigo-500 animate-pulse" />
                  <span className="text-[9px] font-black text-indigo-800">
                    {currentShiftInfo.slot === 'm' ? 'Mañana (7-13h)' : currentShiftInfo.slot === 't' ? 'Tarde (13-19h)' : 'Noche (19-7h)'} · Día {currentShiftInfo.today} · {currentShiftInfo.onDuty.length} médicos
                  </span>
                </div>
                {currentShiftInfo.onDuty.length === 0 ? (
                  <p className="text-[9px] text-rose-600 font-bold">⚠️ Sin asignaciones</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {currentShiftInfo.onDuty.map(({ doctor, sigla }) => (
                      <span key={doctor.id} className="bg-white text-[8px] font-bold text-slate-700 border border-indigo-100 px-2 py-0.5 rounded-full">
                        {doctor.genero === 'F' ? 'Dra.' : 'Dr.'} {doctor.nombre.split(' ')[0]} <span className="text-indigo-600">{sigla}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Row 3 (collapsible): Cobertura diaria */}
        <AnimatePresence>
          {showCoverage && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden border-t border-slate-200"
            >
              <div className="px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[8px] font-black text-slate-600 flex items-center gap-1"><Users className="w-3 h-3" /> Cobertura Diaria</span>
                  <button
                    onClick={() => setCompactView(!compactView)}
                    className="flex items-center gap-1 text-[7px] font-bold text-slate-400 hover:text-slate-700"
                  >
                    {compactView ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                    {compactView ? 'Completa' : 'Compacta'}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <div className="flex gap-[1px] min-w-max">
                    {dailyCoverage.map(dc => {
                      const total = dc.m + dc.t + dc.n;
                      const getColor = (count: number) => count === 0 ? 'bg-rose-500' : count <= 1 ? 'bg-amber-400' : 'bg-emerald-400';
                      return (
                        <div key={dc.day} className="flex flex-col items-center gap-[1px]" title={`Día ${dc.day}: M=${dc.m} T=${dc.t} N=${dc.n}`}>
                          <span className="text-[5px] text-slate-400 font-bold">{dc.day}</span>
                          <div className={`w-2 h-1.5 rounded-[1px] ${getColor(dc.m)}`} />
                          <div className={`w-2 h-1.5 rounded-[1px] ${getColor(dc.t)}`} />
                          <div className={`w-2 h-1.5 rounded-[1px] ${getColor(dc.n)}`} />
                          <span className="text-[5px] font-bold text-slate-500">{total}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 mt-1 text-[6px] text-slate-400 font-bold">
                    <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-sm bg-rose-500" /> Sin cob.</span>
                    <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-sm bg-amber-400" /> 1 méd.</span>
                    <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-sm bg-emerald-400" /> 2+</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* AI Panel */}
      {(session?.r === 'admin' || session?.r === 'root') && (
        <TurneroAIPanel
          isGenerating={ai.isGenerating}
          suggestions={ai.suggestions}
          onGenerate={ai.generate}
          onApply={ai.apply}
          onDiscard={ai.discard}
        />
      )}

      {/* Filters & Controls */}
      <TurneroFilterPanel
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        doctors={doctors}
        doctorFilter={filters.doctorFilter}
        addDoctorFilter={filters.addDoctorFilter}
        removeDoctorFilter={filters.removeDoctorFilter}
        clearDoctorFilter={filters.clearDoctorFilter}
        selectedRoles={filters.selectedRoles}
        toggleRole={filters.toggleRole}
        clearRoles={filters.clearRoles}
        roleSearch={filters.roleSearch}
        setRoleSearch={filters.setRoleSearch}
        showRoleSelector={filters.showRoleSelector}
        setShowRoleSelector={filters.setShowRoleSelector}
        filteredRolesList={filters.filteredRolesList}
        selectedCategories={filters.selectedCategories}
        toggleCategory={filters.toggleCategory}
        clearCategories={filters.clearCategories}
        showCatSelector={filters.showCatSelector}
        setShowCatSelector={filters.setShowCatSelector}
        showGridHours={filters.showGridHours}
        setShowGridHours={filters.setShowGridHours}
        onDownloadTemplate={onDownloadTemplate}
        onExportExcel={exportExcel}
        onExportPDF={exportPDF}
        onImportExcel={onImportExcel}
        onPublish={publishTurnos}
        isAdmin={!!isAdminUser}
        globalTotalHours={globalTotalHours}
      />

      {/* Shift Grid */}
      <ShiftGridTable
        doctors={filters.filteredDoctors}
        currentMonthData={currentMonthData}
        variables={variables}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        daysInMonth={daysInMonth}
        showGridHours={filters.showGridHours}
        isAdmin={!!isAdminUser}
        onSetShift={hookSetShift}
        conflicts={conflicts}
        sundays={sundays}
        compactView={compactView}
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-2 md:gap-4 text-[8px] md:text-[9px] text-[#7aa8c8] font-mono no-print px-1">
        <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-[#4ade80] rounded-full"></span> &lt;42h</div>
        <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-[#16a34a] rounded-full"></span> 42-66h</div>
        <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-[#ff7d33] rounded-full"></span> &gt;66h</div>
        <div className="flex items-center gap-1 ml-auto text-amber-400"><span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-amber-400 rounded-full"></span> PT</div>
      </div>
    </motion.div>
  );
}

