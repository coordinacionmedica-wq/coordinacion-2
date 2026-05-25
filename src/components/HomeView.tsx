import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle,
  XCircle,
  Clock,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  Send,
  MapPin,
  FileSpreadsheet,
  MessageCircle,
  ClipboardList,
  Calendar,
  Users,
  FileText,
  BrainCircuit,
  BarChart3,
  Printer,
  Flame,
  Activity,
  Bell,
  Info,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Markdown from 'react-markdown';
import { MONTH_NAMES } from '../constants';
import { SlotType } from '../types';
import { useAppContext } from '../context/AppContext';

interface HomeViewProps {
  globalTotalHours: number;
  onShowCodigoRojo: () => void;
  onShowCodigoAzul: () => void;
  onGenerateAIStats: () => void;
}

export function HomeView({ globalTotalHours, onShowCodigoRojo, onShowCodigoAzul, onGenerateAIStats }: HomeViewProps) {
  const {
    session, doctors, shiftRequests, activities,
    selectedMonth, selectedYear, isMonthPublished, isOnline,
    isGeneratingAI, aiReport, setAiReport,
    setActiveTab, serviceMappings, variables, currentMonthData,
    changePassword,
  } = useAppContext();

  // Local form state
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [showProductivityStats, setShowProductivityStats] = useState(false);
  const [productivityResults, setProductivityResults] = useState<any[]>([]);

  const currentUserProfile = useMemo(() => {
    if (!session?.doctorId) return null;
    return doctors.find(d => d.id === session.doctorId);
  }, [session?.doctorId, doctors]);

  const canSeeCodigoRojo = useMemo(() => {
    if (session?.r === 'admin') return true;
    if (!currentUserProfile) return false;
    const role = currentUserProfile.rol;
    return ['Jefe de Partos', 'Enfermero Jefe', 'Médico Obstetra/Ginecólogo', 'Médico Especialista'].includes(role) ||
           (currentUserProfile.cat === 'Disponibilidad' && (role.includes('Médico') || role.includes('Especialista')));
  }, [session?.r, currentUserProfile]);

  const canSeeCodigoAzul = useMemo(() => {
    if (session?.r === 'admin') return true;
    if (!currentUserProfile) return false;
    const role = currentUserProfile.rol;
    return ['Médico Rural', 'Médico General', 'Triage', 'Enfermero Jefe', 'Médico Especialista', 'Intensivista'].some(r => role.includes(r)) ||
           (currentUserProfile.cat === 'Planta' && role.includes('Médico'));
  }, [session?.r, currentUserProfile]);

  const handleChangePassword = async () => {
    if (!session?.doctorId) return;
    await changePassword(session.doctorId, oldPass, newPass);
    setOldPass('');
    setNewPass('');
  };

  const calculateProductivity = () => {
    const activeDoctorsList = doctors.filter(d => d.st === 'activo');
    const daysInCurrentMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    const results = activeDoctorsList.map(doc => {
      const stats: Record<string, { shifts: number, hours: number }> = {};
      serviceMappings.forEach(m => {
        stats[m.name] = { shifts: 0, hours: 0 };
      });
      stats['Otros'] = { shifts: 0, hours: 0 };

      let totalDocHours = 0;

      (['m', 't', 'n'] as SlotType[]).forEach(slot => {
        for (let d = 1; d <= daysInCurrentMonth; d++) {
          const sigla = currentMonthData[doc.id]?.[slot]?.[d];
          if (sigla && sigla !== 'X' && sigla !== 'DESC' && sigla !== 'PT') {
            const h = variables[slot]?.[sigla] || 0;
            totalDocHours += h;

            const mapping = serviceMappings.find(m => m.siglas.some(s => s.trim().toUpperCase() === sigla.trim().toUpperCase()));
            if (mapping) {
              stats[mapping.name].shifts++;
              stats[mapping.name].hours += h;
            } else {
              stats['Otros'].shifts++;
              stats['Otros'].hours += h;
            }
          }
        }
      });

      return {
        doctor: doc.nombre,
        role: doc.rol,
        stats,
        totalDocHours
      };
    });

    setProductivityResults(results);
    setShowProductivityStats(true);
  };

  if (!session) return null;

  return (
    <motion.div
      key="home"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-6 max-w-5xl mx-auto pb-6"
    >
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">
            {MONTH_NAMES[selectedMonth]} {selectedYear}
          </p>
          <h2 className="text-base font-black text-slate-800">Bienvenido, {session.n}</h2>
        </div>
        <div className="flex items-center gap-2">
          {isMonthPublished
            ? <span className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-emerald-200"><CheckCircle className="w-3.5 h-3.5" /> Turnero Publicado</span>
            : <span className="flex items-center gap-1.5 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-amber-200"><Clock className="w-3.5 h-3.5" /> Borrador</span>
          }
          <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${isOnline ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
            {isOnline ? 'En línea' : 'Sin conexión'}
          </span>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden group lg:col-span-2">
          <div className="absolute right-2 top-2 opacity-5 group-hover:opacity-10 transition-opacity">
            <HeartPulse className="w-16 h-16 text-emerald-600" />
          </div>
          <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mb-1">Horas Globales del Mes</p>
          <div className="text-5xl font-black text-emerald-600">{globalTotalHours}<span className="text-2xl text-emerald-400 ml-1">h</span></div>
          <p className="text-[10px] text-slate-400 mt-2 font-mono">Consolidado Triple Sum</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center">
          <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mb-2">Médicos Activos</p>
          <div className="text-4xl font-black text-slate-800">{doctors.filter(d => d.st === 'activo').length}</div>
          <p className="text-[9px] text-slate-400 mt-1">de {doctors.length} total</p>
        </div>
        <div className={`p-5 rounded-2xl border shadow-sm text-center ${shiftRequests.filter(r => r.status === 'pending' && r.targetMonth === selectedMonth && r.targetYear === selectedYear).length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
          <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mb-2">Solicitudes Pendientes</p>
          <div className={`text-4xl font-black ${shiftRequests.filter(r => r.status === 'pending' && r.targetMonth === selectedMonth && r.targetYear === selectedYear).length > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
            {shiftRequests.filter(r => r.status === 'pending' && r.targetMonth === selectedMonth && r.targetYear === selectedYear).length}
          </div>
          <button onClick={() => setActiveTab('solicitudes')} className="text-[9px] text-emerald-600 font-bold underline mt-1 hover:text-emerald-700">ver todas</button>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center">
          <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mb-2">Actividades PIC</p>
          <div className="text-4xl font-black text-slate-800">{activities.filter(a => a.month === selectedMonth && a.year === selectedYear).length}</div>
          <button onClick={() => setActiveTab('pic')} className="text-[9px] text-emerald-600 font-bold underline mt-1 hover:text-emerald-700">ver módulo</button>
        </div>
      </div>

      {/* ── Emergencias (if visible) ── */}
      {(canSeeCodigoRojo || canSeeCodigoAzul) && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2 ml-1">Protocolos de Emergencia</p>
          <div className="grid grid-cols-2 gap-3">
            {canSeeCodigoRojo && (
              <button
                onClick={onShowCodigoRojo}
                className="bg-gradient-to-br from-rose-600 to-rose-700 text-white p-3.5 rounded-xl flex items-center gap-3 font-black hover:scale-[1.02] active:scale-95 transition-all shadow-md shadow-rose-500/25 border border-rose-400/30 group"
              >
                <div className="bg-white/20 p-3 rounded-xl group-hover:rotate-12 transition-transform shrink-0">
                  <Flame className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="text-[9px] uppercase opacity-70 leading-none mb-1">Obstetricia</div>
                  <div className="text-lg">CÓDIGO ROJO</div>
                </div>
              </button>
            )}
            {canSeeCodigoAzul && (
              <button
                onClick={onShowCodigoAzul}
                className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-3.5 rounded-xl flex items-center gap-3 font-black hover:scale-[1.02] active:scale-95 transition-all shadow-md shadow-blue-500/25 border border-blue-400/30 group"
              >
                <div className="bg-white/20 p-3 rounded-xl group-hover:animate-pulse shrink-0">
                  <Activity className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="text-[9px] uppercase opacity-70 leading-none mb-1">RCP / Paro</div>
                  <div className="text-lg">CÓDIGO AZUL</div>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Accesos Rápidos ── */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2 ml-1">Accesos Rápidos</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { id: 'turnos',      label: 'Turnero',       icon: Calendar,      color: 'text-emerald-600 bg-emerald-50  border-emerald-100' },
            { id: 'solicitudes', label: 'Solicitudes',   icon: Send,          color: 'text-amber-600  bg-amber-50    border-amber-100'   },
            { id: 'rural',       label: 'Rural',         icon: MapPin,        color: 'text-sky-600    bg-sky-50      border-sky-100'     },
            { id: 'novedades',   label: 'Novedades',     icon: ClipboardList, color: 'text-violet-600 bg-violet-50   border-violet-100'  },
            { id: 'pic',         label: 'Capacitaciones', icon: BrainCircuit, color: 'text-orange-600 bg-orange-50   border-orange-100'  },
            { id: 'bd',          label: 'Talento Humano', icon: Users,        color: 'text-slate-600  bg-slate-50    border-slate-100'   },
            { id: 'docs',        label: 'Guías',         icon: FileText,      color: 'text-teal-600   bg-teal-50     border-teal-100'    },
            { id: 'stats',       label: 'Estadísticas',  icon: BarChart3,     color: 'text-rose-600   bg-rose-50     border-rose-100'    },
          ].map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 p-4 rounded-2xl border font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-sm ${item.color}`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-xs uppercase tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Herramientas (admin/read) ── */}
      {(session.r === 'admin' || session.r === 'read') && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2 ml-1">Herramientas</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={onGenerateAIStats}
              disabled={isGeneratingAI}
              className="bg-violet-600 text-white p-4 rounded-2xl flex items-center gap-3 font-bold hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/20 disabled:opacity-60"
            >
              <Sparkles className={`w-5 h-5 ${isGeneratingAI ? 'animate-spin' : ''}`} />
              <div className="text-left">
                <div className="text-[9px] uppercase opacity-70">Inteligencia Artificial</div>
                <div className="text-sm">{isGeneratingAI ? 'Analizando...' : 'Análisis IA'}</div>
              </div>
            </button>
            <button
              onClick={calculateProductivity}
              className="bg-emerald-700 text-white p-4 rounded-2xl flex items-center gap-3 font-bold hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-500/20"
            >
              <ClipboardList className="w-5 h-5" />
              <div className="text-left">
                <div className="text-[9px] uppercase opacity-70">Resumen mensual</div>
                <div className="text-sm">Productividad</div>
              </div>
            </button>
            <button
              onClick={() => window.print()}
              className="bg-white border border-slate-200 text-slate-700 p-4 rounded-2xl flex items-center gap-3 font-bold hover:bg-slate-50 transition-all shadow-sm"
            >
              <Printer className="w-5 h-5" />
              <div className="text-left">
                <div className="text-[9px] uppercase opacity-70">Vista actual</div>
                <div className="text-sm">Imprimir</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── Comunidad ── */}
      <a
        href="https://wa.me/573173683886?mode=gi_t"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 bg-[#25D366] text-white p-5 rounded-2xl font-black hover:bg-[#20ba59] transition-all shadow-lg shadow-emerald-500/20 group"
      >
        <MessageCircle className="w-8 h-8 shrink-0 group-hover:animate-bounce" />
        <div>
          <div className="text-[9px] uppercase opacity-80 leading-none mb-1">Comunidad Médica</div>
          <div className="text-base">UNIRSE AL GRUPO WHATSAPP</div>
        </div>
      </a>

      {/* ── Gestión de contraseña (doctor) ── */}
      {session.r === 'doctor' && (
        <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm">
          <h3 className="text-sm font-bold text-emerald-700 mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Cambio de Contraseña
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input type="password" placeholder="Contraseña Actual" className="bg-stone-50 border border-emerald-100 p-3 rounded-xl outline-none focus:border-emerald-500 text-slate-800 text-sm" value={oldPass} onChange={(e) => setOldPass(e.target.value)} />
            <input type="password" placeholder="Nueva Contraseña" className="bg-stone-50 border border-emerald-100 p-3 rounded-xl outline-none focus:border-emerald-500 text-slate-800 text-sm" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
            <button onClick={handleChangePassword} className="bg-emerald-600 text-white font-black rounded-xl hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-emerald-500/20 text-sm">ACTUALIZAR</button>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 italic">Frecuencia de cambio obligatoria: Cada 90 días.</p>
        </div>
      )}

      {/* ── Tabla de Productividad (expandible) ── */}
      {showProductivityStats && productivityResults.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm overflow-hidden"
        >
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-emerald-600" />
              Productividad — {MONTH_NAMES[selectedMonth]} {selectedYear}
            </h3>
            <button onClick={() => setShowProductivityStats(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-emerald-50 text-[10px] text-emerald-800 font-bold uppercase tracking-wider">
                  <th className="p-3 rounded-tl-xl">MÉDICO / ROL</th>
                  {serviceMappings.map(m => <th key={m.id} className="p-3 text-center">{m.name}</th>)}
                  <th className="p-3 text-center">OTROS</th>
                  <th className="p-3 text-center rounded-tr-xl">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productivityResults.map((res, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-slate-800 text-sm">{res.doctor}</div>
                      <div className="text-[9px] text-slate-400 uppercase font-mono">{res.role}</div>
                    </td>
                    {serviceMappings.map(m => (
                      <td key={m.id} className="p-3 text-center">
                        <div className="font-black text-emerald-600 text-sm">{res.stats[m.name].shifts}<span className="text-[9px] font-normal text-slate-400 ml-0.5">T</span></div>
                        <div className="text-[9px] text-slate-400">{res.stats[m.name].hours}h</div>
                      </td>
                    ))}
                    <td className="p-3 text-center">
                      <div className="font-black text-amber-600 text-sm">{res.stats['Otros'].shifts}<span className="text-[9px] font-normal text-slate-400 ml-0.5">T</span></div>
                      <div className="text-[9px] text-slate-400">{res.stats['Otros'].hours}h</div>
                    </td>
                    <td className="p-3 text-center font-black text-slate-800 bg-emerald-50/30">
                      <div className="text-sm">{res.totalDocHours}h</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end no-print">
            <button
              onClick={() => {
                const ws = XLSX.utils.json_to_sheet(productivityResults.map(r => ({
                  'Médico': r.doctor, 'Rol': r.role,
                  ...Object.fromEntries(serviceMappings.map(m => [`${m.name} (H)`, r.stats[m.name].hours])),
                  'Otros (H)': r.stats['Otros'].hours, 'Total (H)': r.totalDocHours
                })));
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Productividad");
                XLSX.writeFile(wb, `Productividad_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xlsx`);
              }}
              className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-200 font-bold text-[10px] uppercase flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
            </button>
          </div>
        </motion.div>
      )}

      {/* ── AI Report ── */}
      {isGeneratingAI && (
        <div className="bg-white p-6 rounded-xl border border-violet-100 text-center space-y-3">
          <Sparkles className="w-10 h-10 text-violet-500 animate-spin mx-auto" />
          <p className="text-violet-600 font-black animate-pulse uppercase tracking-widest text-xs">Analizando indicadores con IA...</p>
        </div>
      )}
      {aiReport && !isGeneratingAI && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 border-l-4 border-violet-500 p-6 rounded-2xl text-white shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-6 opacity-5"><Sparkles className="w-24 h-24" /></div>
          <div className="flex justify-between items-start mb-5 border-b border-white/10 pb-4">
            <h3 className="text-base font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" /> Dashboard Estadístico IA
            </h3>
            <button onClick={() => setAiReport(null)} className="text-white/40 hover:text-white transition-colors"><XCircle className="w-5 h-5" /></button>
          </div>
          <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-li:my-1">
            <Markdown>{aiReport}</Markdown>
          </div>
          <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center">
            <p className="text-[9px] text-white/40 uppercase font-mono italic">Generado el {new Date().toLocaleString()}</p>
            <button
              onClick={() => {
                const win = window.open('', '_blank');
                win?.document.write(`<html><head><title>Informe IA</title><style>body{font-family:sans-serif;padding:40px;line-height:1.6;color:#333}h2{color:#7c3aed}</style></head><body><h2>Informe Estadístico Gerencial - IA</h2><div style="font-size:14px">${aiReport.replace(/\n/g, '<br>')}</div></body></html>`);
              }}
              className="text-[10px] font-black underline underline-offset-4 hover:text-violet-400"
            >ABRIR PARA IMPRIMIR</button>
          </div>
        </motion.div>
      )}

      {/* ── Estado del Sistema ── */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
        <p className="text-[10px] text-slate-400 font-mono leading-relaxed">
          <span className="font-bold text-slate-500">Motor V27.0</span> — El cálculo "Triple Sum" consolida las 24h por profesional antes de computar los semáforos semanales.
        </p>
      </div>
    </motion.div>
  );
}
