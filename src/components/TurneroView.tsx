import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { PhoneIncoming } from 'lucide-react';
import { SlotType } from '../types';
import { useAppContext } from '../context/AppContext';
import { useShiftActions } from '../hooks/useShiftActions';
import { useTurneroFilters } from '../hooks/useTurneroFilters';
import { useTurneroExport } from '../hooks/useTurneroExport';
import { useTurneroAI } from '../hooks/useTurneroAI';
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

  const ai = useTurneroAI({
    session, doctors, currentMonthData,
    selectedMonth, selectedYear,
    setCurrentMonthData, setNotification,
  });

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

  // ── Render ──
  return (
    <motion.div key="turnos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 md:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 md:p-6 rounded-2xl md:rounded-[24px] border border-slate-200 shadow-sm no-print">
        <div>
          <h2 className="text-lg md:text-2xl font-black text-slate-800">Turnero Hospitalario</h2>
          <p className="text-[10px] md:text-xs text-stone-500 font-mono italic">Sistema de Gestión de Talento Humano</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {(session?.r === 'admin' || (session?.doctorId && doctors.find(d => d.id === session.doctorId)?.permissions?.includes('call_availability'))) && (
            <button
              onClick={onOpenCallModal}
              className="bg-rose-500 text-white px-3 py-2 rounded-xl font-black flex items-center gap-2 hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20 text-[10px] sm:text-xs flex-1 sm:flex-none justify-center"
            >
              <PhoneIncoming className="w-4 h-4 animate-pulse" />
              <span className="hidden sm:inline">LLAMAR DISPONIBILIDAD</span>
              <span className="sm:hidden">DISPONIBILIDAD</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 no-print">
        <div className="bg-white p-3 md:p-4 rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-[9px] md:text-[10px] text-emerald-600 uppercase font-black mb-1">Último Llamado</p>
          <div className="text-[10px] md:text-[11px] font-bold text-slate-800 truncate">
            {availabilityCalls[0] ? `${availabilityCalls[0].doctorName} (${new Date(availabilityCalls[0].timestamp).toLocaleTimeString()})` : 'Sin llamados'}
          </div>
        </div>
        <div className="bg-white p-3 md:p-4 rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-[9px] md:text-[10px] text-sky-600 uppercase font-black mb-1">Personal Planta</p>
          <div className="text-lg md:text-xl font-black text-slate-800">{doctors.filter(d => d.cat === 'Planta' && d.st === 'activo').length}</div>
        </div>
        <div className="bg-white p-3 md:p-4 rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-[9px] md:text-[10px] text-rose-600 uppercase font-black mb-1">Personal Rural</p>
          <div className="text-lg md:text-xl font-black text-slate-800">{doctors.filter(d => d.cat === 'Rural' && d.st === 'activo').length}</div>
        </div>
        <div className="bg-white p-3 md:p-4 rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-[9px] md:text-[10px] text-amber-600 uppercase font-black mb-1">Novedades Mes</p>
          <div className="text-lg md:text-xl font-black text-slate-800">{auditLogs.filter(l => l.targetMonth === selectedMonth).length}</div>
        </div>
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

