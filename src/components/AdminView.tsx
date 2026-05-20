import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Settings,
  Trash2,
  UserPlus,
  FileDown,
  FileSpreadsheet,
  Clock,
  Save,
  Power,
  Wand2,
  Palette,
  CheckCircle,
  Database,
  Plus,
  BrainCircuit,
  Sparkles,
  ShieldCheck,
  Activity,
  XCircle,
  Bell,
  ChevronRight,
} from 'lucide-react';
import { SlotType, Doctor, DoctorRole } from '../types';
import { MONTH_NAMES } from '../constants';
import { useAppContext } from '../context/AppContext';

interface AdminViewProps {
  onDownloadTemplate: () => void;
  onImportExcel: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddDoctor: () => void;
  onEditDoctor: (doc: Doctor) => void;
  onGenerateCapacityReport: (period: string) => void;
  onGenerateServiceReport: () => void;
  assignFreeDaysToPlanta: () => void;
  newDocName: string;
  setNewDocName: (v: string) => void;
  newDocEmail: string;
  setNewDocEmail: (v: string) => void;
  newDocContact: string;
  setNewDocContact: (v: string) => void;
  newDocCat: string;
  setNewDocCat: (v: any) => void;
  newDocRol: string;
  setNewDocRol: (v: any) => void;
}

export function AdminView({
  onDownloadTemplate,
  onImportExcel,
  onAddDoctor,
  onEditDoctor,
  onGenerateCapacityReport,
  onGenerateServiceReport,
  assignFreeDaysToPlanta,
  newDocName, setNewDocName,
  newDocEmail, setNewDocEmail,
  newDocContact, setNewDocContact,
  newDocCat, setNewDocCat,
  newDocRol, setNewDocRol,
}: AdminViewProps) {
  const {
    session,
    doctors, variables, serviceMappings, setServiceMappings,
    auditLogs, selectedMonth, selectedYear,
    isGeneratingAI, aiReport, setAiReport,
    idleTimeout, setIdleTimeout,
    setActiveTab, setNotification,
    addVariable, removeVariable,
    toggleDoctorStatus, deleteDoctor, resetDoctorPass,
    saveServiceMappings,
    theme, updateTheme,
  } = useAppContext();

  // Variable form state
  const [newVarCode, setNewVarCode] = useState('');
  const [newVarHour, setNewVarHour] = useState('');
  const [newVarSlot, setNewVarSlot] = useState<SlotType>('m');
  const [editingVar, setEditingVar] = useState<{ slot: SlotType; code: string } | null>(null);

  const handleAddVariable = async () => {
    await addVariable(newVarSlot, newVarCode, parseFloat(newVarHour));
    setNewVarCode('');
    setNewVarHour('');
    setEditingVar(null);
  };

  const addServiceMapping = () => {
    const newService = {
      id: Date.now().toString(),
      name: '',
      siglas: [] as string[],
    };
    setServiceMappings([...serviceMappings, newService]);
  };

  const deleteServiceMapping = (id: string) => {
    if (confirm('¿Eliminar este mapeo de servicio?')) {
      setServiceMappings(serviceMappings.filter(m => m.id !== id));
    }
  };

  if (!session) return null;

  return (
    <motion.div
      key="admin"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-8 max-w-5xl mx-auto"
    >
      <div className="flex gap-4 mb-4 no-print">
        <button
          onClick={() => setActiveTab('toolbox')}
          className="flex-1 bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-6 rounded-[32px] font-black flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Settings className="w-6 h-6" /> CONFIGURAR REGLAS SHIFT ENGINE V3
        </button>
      </div>

      {/* Variable Management */}
      <div className="bg-white rounded-[32px] p-8 border border-emerald-100 shadow-xl">
        <h3 className="text-xl font-bold text-emerald-700 mb-6 flex items-center gap-2">
          <Settings className="w-6 h-6" /> Gestión de Siglas Horarias
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-emerald-50 rounded-2xl mb-8 border border-emerald-100">
          <input
            className="bg-white border border-emerald-100 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold"
            placeholder="Sigla (Eje: N, M, T)"
            value={newVarCode}
            onChange={(e) => setNewVarCode(e.target.value)}
          />
          <input
            type="number"
            step="0.1"
            min="0"
            className="bg-white border border-emerald-100 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold"
            placeholder="Horas"
            value={newVarHour}
            onChange={(e) => setNewVarHour(e.target.value)}
          />
          <select
            className="bg-white border border-emerald-100 p-4 rounded-xl outline-none font-bold"
            value={newVarSlot}
            onChange={(e) => setNewVarSlot(e.target.value as SlotType)}
          >
            <option value="m">Mañana</option>
            <option value="t">Tarde</option>
            <option value="n">Noche</option>
          </select>
          <button
            onClick={handleAddVariable}
            className="bg-emerald-600 text-white font-black rounded-xl hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-emerald-500/20"
          >
            {editingVar ? 'ACTUALIZAR' : 'GUARDAR SIGLA'}
          </button>
          {editingVar && (
            <button onClick={() => { setEditingVar(null); setNewVarCode(''); setNewVarHour(''); }} className="text-[10px] text-rose-500 mt-1 font-bold underline text-center">Cancelar</button>
          )}
        </div>

        <div className="space-y-6">
          {(['m', 't', 'n'] as SlotType[]).map(slot => (
            <div key={slot} className="border-t border-emerald-50 pt-4">
              <p className="text-[10px] text-emerald-600 uppercase font-bold mb-3">{slot === 'm' ? 'Jornada Mañana' : slot === 't' ? 'Jornada Tarde' : 'Jornada Noche'}</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(variables[slot]).map(([k, v]) => (
                  <div key={k} className="group relative bg-stone-50 pl-3 pr-8 py-2 rounded-lg border border-emerald-100 text-[10px] flex gap-2 hover:border-emerald-500 transition-all cursor-pointer shadow-sm" onClick={() => {
                    setEditingVar({ slot, code: k });
                    setNewVarCode(k);
                    setNewVarHour(v.toString());
                    setNewVarSlot(slot);
                  }}>
                    <span className="font-black text-emerald-600">{k}</span>
                    <span className="text-slate-400">{v}h</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeVariable(slot, k); }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-rose-400 hover:text-rose-600 transition-all rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Staff Management */}
      <div className="bg-white rounded-[32px] p-8 border border-emerald-100 shadow-xl">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <h3 className="text-xl font-bold text-emerald-700 flex items-center gap-2">
            <UserPlus className="w-6 h-6" /> Nómina Médica
          </h3>
          <div className="flex gap-2">
            <button
              onClick={onDownloadTemplate}
              className="bg-stone-50 text-slate-600 border border-slate-200 px-4 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-slate-100 transition-all shadow-sm"
            >
              <FileDown className="w-4 h-4" /> Plantilla
            </button>
            <label className="cursor-pointer bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-blue-600 hover:text-white transition-all shadow-sm">
              <FileSpreadsheet className="w-4 h-4" /> Importar Turnos
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={onImportExcel} />
            </label>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <button
            onClick={assignFreeDaysToPlanta}
            className="bg-emerald-50 text-emerald-700 border border-emerald-100 p-4 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
          >
            <Clock className="w-4 h-4" /> Asignar Día Libre Semanal (Planta)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-8 bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100">
          <input
            className="bg-white border border-emerald-100 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold"
            placeholder="Nombre Completo"
            value={newDocName}
            onChange={(e) => setNewDocName(e.target.value)}
          />
          <input
            className="bg-white border border-emerald-100 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold"
            placeholder="Email de Notificación"
            type="email"
            value={newDocEmail}
            onChange={(e) => setNewDocEmail(e.target.value)}
          />
          <input
            className="bg-white border border-emerald-100 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold"
            placeholder="WhatsApp / Contacto"
            value={newDocContact}
            onChange={(e) => setNewDocContact(e.target.value)}
          />
          <select
            className="bg-white border border-emerald-100 p-4 rounded-xl outline-none font-bold"
            value={newDocCat}
            onChange={(e) => setNewDocCat(e.target.value as any)}
          >
            <option value="Planta">PLANTA</option>
            <option value="CTA">CTA</option>
            <option value="APS">APS</option>
            <option value="Rural">RURAL</option>
            <option value="Disponibilidad">DISPONIBILIDAD</option>
          </select>
          <select
            className="bg-white border border-emerald-100 p-4 rounded-xl outline-none font-bold"
            value={newDocRol}
            onChange={(e) => setNewDocRol(e.target.value as any)}
          >
            <option value="Médico General">Médico General</option>
            <option value="Médico Especialista">Médico Especialista</option>
            <option value="Médico Rural">Médico Rural</option>
            <option value="Enfermero Jefe">Enfermera(o) Jefe</option>
            <option value="Auxiliar Enfermería">Auxiliar de Enf.</option>
            <option value="Interno">Médico Interno</option>
            <option value="Triage">Triage / Urgencias</option>
            <option value="Laboratorio">Laboratorio</option>
            <option value="Odontólogo">Odontólogo</option>
            <option value="Fisioterapeuta">Fisioterapeuta</option>
            <option value="Rayos X">Rayos X</option>
          </select>
          <button
            onClick={onAddDoctor}
            className="bg-emerald-700 text-white font-black rounded-xl hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-emerald-700/20 col-span-1 sm:col-span-5 py-4"
          >
            AÑADIR AL EQUIPO MÉDICO
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {doctors.map(d => (
            <div key={d.id} className={`p-4 rounded-2xl border transition-all ${d.st === 'activo' ? 'bg-stone-50 border-emerald-100 shadow-sm' : 'bg-rose-50 border-rose-100 opacity-50'}`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-bold text-slate-800 leading-tight">{d.nombre}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] text-emerald-600 uppercase font-black">{d.cat}</div>
                    <div className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 rounded uppercase font-bold">{d.rol || 'Médico'}</div>
                    {d.email && <div className="text-[9px] text-slate-400 italic">({d.email})</div>}
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono mt-1">
                    Cédula: <span className="font-bold">{d.cedula || 'N/A'}</span> | RM: <span className="font-bold">{d.registroMedico || 'N/A'}</span>
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                    User: <span className="text-emerald-700 font-bold">{d.username}</span> | Pass: <span className="text-emerald-700 font-bold">{d.password}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onEditDoctor(d)}
                    className="p-2 rounded-lg border bg-white border-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                    title="Editar Médico"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => resetDoctorPass(d.id)}
                    className="p-2 rounded-lg border bg-white border-amber-100 text-amber-600 hover:bg-amber-500 hover:text-white transition-all shadow-sm"
                    title="Restablecer Contraseña"
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => toggleDoctorStatus(d.id)}
                    className={`p-2 rounded-lg border transition-all shadow-sm ${d.st === 'activo' ? 'bg-white border-emerald-500 text-emerald-600 hover:bg-emerald-500 hover:text-white' : 'bg-white border-amber-500 text-amber-600 hover:bg-amber-500 hover:text-white'}`}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteDoctor(d.id)}
                    className="p-2 rounded-lg border bg-white border-rose-100 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="text-[9px] font-mono text-slate-300">UID: {d.id}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Theme Settings */}
      <div className="bg-white rounded-[32px] p-8 border border-emerald-100 shadow-xl">
        <h3 className="text-xl font-bold text-emerald-700 mb-6 flex items-center gap-2">
          <Palette className="w-6 h-6 text-emerald-600" /> Personalización Visual
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="text-xs text-emerald-600 uppercase font-black block mb-4">Color Principal</label>
            <div className="grid grid-cols-5 gap-3">
              {['#00c8f0', '#00e5a0', '#ff7d33', '#f43f5e', '#a855f7', '#eab308', '#22c55e', '#3b82f6', '#ec4899', '#f97316'].map(c => (
                <button
                  key={c}
                  onClick={() => updateTheme({ ...theme, primary: c })}
                  className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${theme.primary === c ? 'border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-emerald-600 uppercase font-black block mb-4">Fuente del Sistema</label>
            <div className="flex flex-col gap-2">
              {(['sans', 'serif', 'mono'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => updateTheme({ ...theme, font: f })}
                  className={`px-4 py-3 rounded-xl border text-left flex justify-between items-center transition-all ${theme.font === f ? 'bg-emerald-600 text-white border-white' : 'bg-stone-50 border-emerald-100 text-slate-600'}`}
                  style={f === 'serif' ? { fontFamily: 'serif' } : f === 'mono' ? { fontFamily: 'monospace' } : { fontFamily: 'sans-serif' }}
                >
                  <span>
                    {f === 'sans' ? 'Inter (Moderna)' : f === 'serif' ? 'Playfair (Elegante)' : 'JetBrains (Técnica)'}
                  </span>
                  {theme.font === f && <CheckCircle className="w-5 h-5" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Productividad - Gestión de Mapeos */}
      <div className="bg-white rounded-[32px] p-8 border border-emerald-100 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Database className="w-6 h-6 text-emerald-700" />
            <h3 className="text-xl font-bold text-emerald-700">Mapeo de Servicios (Productividad)</h3>
          </div>
          <button
            onClick={addServiceMapping}
            className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-200 font-bold text-[10px] uppercase flex items-center gap-2 hover:bg-emerald-100 transition-all"
          >
            <Plus className="w-4 h-4" /> Añadir Servicio
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mb-6 uppercase font-bold">Asigne las siglas que corresponden a cada servicio hospitalario para el cálculo de productividad.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {serviceMappings.map((m, idx) => (
            <div key={m.id} className="bg-stone-50 p-6 rounded-2xl border border-emerald-100 flex flex-col gap-2 relative group">
              <button
                onClick={() => deleteServiceMapping(m.id)}
                className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="space-y-1">
                <span className="text-[10px] text-emerald-600 font-black uppercase">Nombre del Servicio</span>
                <input
                  className="w-full bg-white border border-emerald-100 p-2 rounded-lg text-xs font-bold outline-none focus:border-emerald-500"
                  value={m.name}
                  onChange={(e) => {
                    const newMappings = [...serviceMappings];
                    newMappings[idx].name = e.target.value;
                    setServiceMappings(newMappings);
                  }}
                />
              </div>
              <div className="space-y-1 mt-2">
                <span className="text-[9px] text-slate-400 uppercase font-bold">Siglas Asociadas (separadas por coma)</span>
                <input
                  className="w-full bg-white border border-emerald-100 p-2 rounded-lg text-xs font-bold outline-none focus:border-emerald-500"
                  placeholder="Ej: 13, 13A, 13B"
                  value={m.siglas.join(', ')}
                  onChange={(e) => {
                    const newMappings = [...serviceMappings];
                    newMappings[idx].siglas = e.target.value.split(',').map(s => s.trim().toUpperCase());
                    setServiceMappings(newMappings);
                  }}
                />
              </div>
            </div>
          ))}
          {serviceMappings.length === 0 && (
            <div className="col-span-1 md:col-span-2 text-center py-10 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
              <p className="text-sm text-slate-400 italic">No hay servicios configurados</p>
            </div>
          )}
          <button
            onClick={() => saveServiceMappings(serviceMappings)}
            className="col-span-1 md:col-span-2 bg-emerald-700 text-white font-black py-4 rounded-2xl hover:bg-emerald-800 transition-all shadow-lg flex items-center justify-center gap-2 mt-4"
          >
            <Save className="w-5 h-5" /> GUARDAR MAPEOS DE PRODUCTIVIDAD
          </button>
        </div>
      </div>

      {/* AI Capacity Report */}
      <div className="bg-white rounded-[32px] p-8 border border-emerald-100 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <BrainCircuit className="w-24 h-24 text-emerald-600" />
        </div>
        <h3 className="text-xl font-bold text-emerald-700 mb-6 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-emerald-500" /> Reporte de Capacidad IA
        </h3>

        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={() => onGenerateCapacityReport('semanal')}
            disabled={isGeneratingAI}
            className="flex-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 p-6 rounded-2xl flex flex-col items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
          >
            <span className="text-emerald-700 font-black text-sm uppercase tracking-tight">SEMANAL</span>
            <span className="text-[10px] text-slate-400">Días 1 a 7</span>
          </button>
          <button
            onClick={() => onGenerateCapacityReport('quincenal')}
            disabled={isGeneratingAI}
            className="flex-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 p-6 rounded-2xl flex flex-col items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
          >
            <span className="text-emerald-700 font-black text-sm uppercase tracking-tight">QUINCENAL</span>
            <span className="text-[10px] text-slate-400">Días 1 a 15</span>
          </button>
          <button
            onClick={() => onGenerateCapacityReport('mensual')}
            disabled={isGeneratingAI}
            className="flex-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 p-6 rounded-2xl flex flex-col items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
          >
            <span className="text-emerald-700 font-black text-sm uppercase tracking-tight">MENSUAL</span>
            <span className="text-[10px] text-slate-400">Mes completo</span>
          </button>
        </div>

        {isGeneratingAI && (
          <div className="flex flex-col items-center gap-4 py-8 bg-emerald-50/50 rounded-2xl border border-emerald-100 animate-pulse mb-8">
            <BrainCircuit className="w-12 h-12 text-emerald-500 animate-spin" />
            <p className="text-sm font-black text-emerald-800 uppercase italic">Gemini está analizando la cobertura...</p>
          </div>
        )}

        {aiReport && (
          <div className="bg-slate-900 text-emerald-400 p-8 rounded-3xl border-4 border-emerald-500/20 shadow-2xl overflow-x-auto text-xs font-mono mb-8">
            <pre className="whitespace-pre-wrap">{aiReport}</pre>
          </div>
        )}
      </div>

      {/* Session Security Settings */}
      <div className="bg-white rounded-[32px] p-8 border border-emerald-100 shadow-xl">
        <h3 className="text-xl font-bold text-emerald-700 mb-6 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-600" /> Seguridad de Sesión
        </h3>
        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex flex-wrap justify-between items-center gap-4">
          <div className="flex-1">
            <h4 className="font-black text-emerald-900 uppercase text-sm mb-1 tracking-tight">Auto-Cierre por Inactividad</h4>
            <p className="text-[10px] text-slate-500 font-bold uppercase opacity-60">Cierra la sesión automáticamente tras el tiempo seleccionado sin actividad del mouse o teclado.</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={idleTimeout}
              onChange={(e) => {
                const val = Number(e.target.value);
                setIdleTimeout(val);
                localStorage.setItem('idleTimeout', val.toString());
                setNotification({ message: `Cierre automático actualizado: ${val} minutos`, type: 'success' });
              }}
              className="bg-white border-2 border-emerald-200 text-emerald-800 font-black p-3 rounded-xl outline-none focus:border-emerald-500 text-sm shadow-sm"
            >
              {[5, 10, 15, 20, 30].map(t => (
                <option key={t} value={t}>{t} Minutos</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <button
          onClick={onGenerateServiceReport}
          disabled={isGeneratingAI}
          className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 rounded-2xl flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-emerald-500/20"
        >
          <div className="bg-white/20 p-2 rounded-xl">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <span className="block font-black text-sm uppercase tracking-wider">Análisis Profundo de Servicios (Gerencia IA)</span>
            <span className="block text-[10px] text-white/70">Ocupación, patrones de uso y capacidad instalada</span>
          </div>
          <Sparkles className="w-5 h-5 ml-auto text-emerald-200 animate-pulse" />
        </button>
      </div>

      {isGeneratingAI ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Wand2 className="w-12 h-12 text-emerald-600" />
          </motion.div>
          <p className="text-emerald-700/40 text-sm font-black animate-pulse">GENERANDO ANÁLISIS ESTRATÉGICO...</p>
        </div>
      ) : aiReport ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-stone-50 p-8 rounded-3xl border border-emerald-100"
        >
          <div className="flex justify-between items-center mb-6">
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-black uppercase tracking-widest">Resultados de Inteligencia Artificial</span>
            <button
              onClick={() => setAiReport(null)}
              className="text-slate-400 hover:text-rose-500 transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-sans">
            {aiReport}
          </div>
          <div className="mt-8 pt-6 border-t border-emerald-100 flex justify-between items-center">
            <p className="text-[9px] text-slate-400 italic">Este reporte es generado automáticamente por el motor Gemini IA de Google.</p>
            <button
              onClick={() => {
                const blob = new Blob([aiReport], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `Reporte_IA_Capacidad_${MONTH_NAMES[selectedMonth]}.txt`;
                link.click();
              }}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-black shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all"
            >
              DESCARGAR REPORTE
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="py-12 text-center">
          <p className="text-slate-300 text-sm uppercase font-black opacity-60">Selecciona un periodo para generar el reporte estratégico</p>
        </div>
      )}

      {/* Audit Logs */}
      <div className="bg-white rounded-[32px] p-8 border border-emerald-100 shadow-xl">
        <h3 className="text-xl font-bold text-emerald-700 mb-6 flex items-center gap-2">
          <Bell className="w-6 h-6 text-emerald-500" /> Registro de Auditoría ({MONTH_NAMES[selectedMonth]} {selectedYear})
        </h3>
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {auditLogs.filter(log => log.targetMonth === selectedMonth && log.targetYear === selectedYear).length === 0 && (
            <div className="text-center py-10 text-slate-300 font-mono text-sm italic">
              No hay registros para este período.
            </div>
          )}
          {auditLogs
            .filter(log => log.targetMonth === selectedMonth && log.targetYear === selectedYear)
            .map(log => (
              <div key={log.id} className="bg-stone-50 p-4 rounded-xl border border-emerald-100 flex justify-between items-center text-xs group hover:border-emerald-500/30 transition-colors shadow-sm">
                <div>
                  <div className="text-slate-800 font-bold mb-1">
                    Dr. {log.doctorName} <span className="text-emerald-600 ml-2 font-black">Día {log.day} ({log.slot.toUpperCase()})</span>
                    {log.doctorContact && <span className="ml-2 text-[8px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md border border-emerald-100 font-bold">{log.doctorContact}</span>}
                  </div>
                  <div className="text-slate-400 flex items-center gap-2">
                    Cambio: <span className="text-rose-400 line-through opacity-50">{log.oldSigla}</span>
                    <ChevronRight className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-600 font-black px-1.5 py-0.5 bg-emerald-50 rounded">{log.newSigla}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 mb-1">{new Date(log.timestamp).toLocaleTimeString()}</div>
                  <div className="text-[9px] uppercase font-black text-emerald-700/50">Sincronizado</div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </motion.div>
  );
}
