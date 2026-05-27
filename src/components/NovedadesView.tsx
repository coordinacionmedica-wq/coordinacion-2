import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileSpreadsheet, Printer, Sparkles, XCircle, Info, Calendar, ChevronRight, Send, UserPlus, CheckCircle, XOctagon, ChevronDown, ChevronUp, ClipboardList, Bell } from 'lucide-react';
import Markdown from 'react-markdown';
import { AuditEntry, UserSession, RegistrationRequest, DoctorRole } from '../types';

const ROLES: DoctorRole[] = [
  'Médico General', 'Médico Rural', 'Médico Especialista', 'Médico Obstetra/Ginecólogo',
  'Enfermero Jefe', 'Jefe de Partos', 'Auxiliar Enfermería', 'Interno',
  'Triage', 'Odontólogo', 'Laboratorio', 'Fisioterapeuta', 'Rayos X'
];

const CATS = ['Planta', 'CTA', 'APS', 'Rural', 'Disponibilidad'] as const;

interface Props {
  session: UserSession;
  monthName: string;
  selectedYear: number;
  auditLogs: AuditEntry[];
  selectedMonth: number;
  onExportExcel: () => void;
  onExportPDF: () => void;
  onGenerateAI: () => void;
  isGeneratingAI: boolean;
  aiReport: string | null;
  setAiReport: (r: string | null) => void;
  onPushNotification: (doctorId: number, message: string) => void;
  registrationRequests: RegistrationRequest[];
  onApproveRegistration: (requestId: string, assignedRol: string, assignedCat: string) => Promise<void>;
  onRejectRegistration: (requestId: string, reason: string) => Promise<void>;
}

export function NovedadesView({
  session, monthName, selectedYear, auditLogs, selectedMonth,
  onExportExcel, onExportPDF, onGenerateAI, isGeneratingAI,
  aiReport, setAiReport, onPushNotification,
  registrationRequests, onApproveRegistration, onRejectRegistration
}: Props) {
  const isAdmin = session.r === 'admin';
  const monthLogs = auditLogs.filter(l => l.targetMonth === selectedMonth && l.targetYear === selectedYear);
  const pendingReqs = registrationRequests.filter(r => r.status === 'pending');

  const [activeTab, setActiveTab] = useState<'registros' | 'novedades'>('registros');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [approvalState, setApprovalState] = useState<Record<string, { rol: string; cat: string; rejectReason: string; showReject: boolean; loading: boolean }>>({})

  const getApprovalState = (id: string) => approvalState[id] || { rol: 'Médico General', cat: 'Planta', rejectReason: '', showReject: false, loading: false };
  const setField = (id: string, field: string, value: string | boolean) =>
    setApprovalState(prev => ({ ...prev, [id]: { ...getApprovalState(id), [field]: value } }));

  const handleApprove = async (req: RegistrationRequest) => {
    const st = getApprovalState(req.id);
    setField(req.id, 'loading', true);
    await onApproveRegistration(req.id, st.rol, st.cat);
    setField(req.id, 'loading', false);
    setExpandedId(null);
  };

  const handleReject = async (req: RegistrationRequest) => {
    const st = getApprovalState(req.id);
    if (!st.rejectReason.trim()) return;
    setField(req.id, 'loading', true);
    await onRejectRegistration(req.id, st.rejectReason);
    setField(req.id, 'loading', false);
    setExpandedId(null);
  };

  return (
    <motion.div
      key="novedades"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-2">
        <div>
          <h2 className="text-base font-black text-slate-800">Novedades — {monthName} {selectedYear}</h2>
          <p className="text-xs text-slate-500 font-mono">Registro oficial de cambios en el turnero</p>
        </div>
        <div className="flex gap-3 no-print">
          <button onClick={onExportExcel} className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-200 font-bold text-[10px] uppercase flex items-center gap-2 hover:bg-emerald-100 transition-all">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button onClick={onExportPDF} className="bg-rose-50 text-rose-700 px-4 py-2 rounded-xl border border-rose-200 font-bold text-[10px] uppercase flex items-center gap-2 hover:bg-rose-100 transition-all">
            <Printer className="w-4 h-4" /> PDF
          </button>
          <button onClick={onGenerateAI} className="bg-violet-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 hover:bg-violet-700 shadow-lg shadow-violet-500/20 animate-pulse">
            <Sparkles className="w-4 h-4" /> Análisis IA
          </button>
        </div>
      </div>

      {/* Tabs — solo admin ve solicitudes de registro */}
      {isAdmin && (
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('registros')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase transition-all ${
              activeTab === 'registros' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Solicitudes de Registro
            {pendingReqs.length > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{pendingReqs.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('novedades')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase transition-all ${
              activeTab === 'novedades' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Registro de Cambios
          </button>
        </div>
      )}

      {/* ── SOLICITUDES DE REGISTRO ── */}
      {isAdmin && activeTab === 'registros' && (
        <div className="space-y-3">
          {registrationRequests.length === 0 ? (
            <div className="bg-stone-100/50 border border-emerald-100 p-8 rounded-2xl text-center">
              <UserPlus className="w-8 h-8 text-emerald-200 mx-auto mb-2" />
              <p className="text-slate-400 uppercase font-black tracking-widest text-xs italic">No hay solicitudes de registro</p>
            </div>
          ) : (
            registrationRequests.map(req => {
              const st = getApprovalState(req.id);
              const isExpanded = expandedId === req.id;
              const prefix = req.genero === 'F' ? 'Dra.' : 'Dr.';
              const statusColor = req.status === 'pending' ? 'bg-amber-50 border-amber-200 text-amber-700'
                : req.status === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-rose-50 border-rose-200 text-rose-700';
              const statusLabel = req.status === 'pending' ? 'Pendiente' : req.status === 'approved' ? 'Aprobado' : 'Rechazado';

              return (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all ${
                    req.status === 'pending' ? 'border-amber-200' : 'border-slate-200'
                  }`}
                >
                  {/* Header row */}
                  <div
                    className="p-4 flex flex-wrap gap-4 items-center justify-between cursor-pointer hover:bg-slate-50/60 transition-colors"
                    onClick={() => req.status === 'pending' && setExpandedId(isExpanded ? null : req.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 font-black border border-emerald-100 text-lg">
                        {req.nombre.charAt(0)}
                      </div>
                      <div>
                        <div className="font-black text-slate-800">{prefix} {req.nombre} {req.apellidos}</div>
                        <div className="text-[10px] text-slate-400 font-mono">CC {req.cedula} · RM {req.registroMedico || '—'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">{new Date(req.createdAt).toLocaleString()}</div>
                        <div className="text-[10px] text-slate-500">Solicitó: <span className="font-bold">{req.requestedRol}</span></div>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-full border ${statusColor}`}>
                        {statusLabel}
                      </span>
                      {req.status === 'pending' && (
                        <button className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded approval panel */}
                  <AnimatePresence>
                    {isExpanded && req.status === 'pending' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-amber-100 bg-amber-50/30 overflow-hidden"
                      >
                        <div className="p-5 space-y-4">
                          {/* Datos del solicitante */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-100">
                            <div><p className="text-[10px] uppercase font-black text-slate-400">Email</p><p className="text-sm font-bold text-slate-700 break-all">{req.email}</p></div>
                            <div><p className="text-[10px] uppercase font-black text-slate-400">Teléfono</p><p className="text-sm font-bold text-slate-700">{req.telefono || '—'}</p></div>
                            <div><p className="text-[10px] uppercase font-black text-slate-400">Género</p><p className="text-sm font-bold text-slate-700">{req.genero === 'M' ? 'Masculino' : 'Femenino'}</p></div>
                            <div><p className="text-[10px] uppercase font-black text-slate-400">Solicitó rol</p><p className="text-sm font-bold text-emerald-700">{req.requestedRol}</p></div>
                          </div>

                          {/* Asignación por admin */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] uppercase font-black text-emerald-600 ml-1 mb-1 block">Rol a Asignar *</label>
                              <select
                                className="w-full bg-white border border-emerald-200 p-3 rounded-xl outline-none focus:border-emerald-500 font-bold text-sm"
                                value={st.rol}
                                onChange={e => setField(req.id, 'rol', e.target.value)}
                              >
                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] uppercase font-black text-emerald-600 ml-1 mb-1 block">Categoría *</label>
                              <select
                                className="w-full bg-white border border-emerald-200 p-3 rounded-xl outline-none focus:border-emerald-500 font-bold text-sm"
                                value={st.cat}
                                onChange={e => setField(req.id, 'cat', e.target.value)}
                              >
                                {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          </div>

                          {/* Botones */}
                          {!st.showReject ? (
                            <div className="flex gap-3">
                              <button
                                onClick={() => handleApprove(req)}
                                disabled={st.loading}
                                className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50"
                              >
                                {st.loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                APROBAR Y ACTIVAR CUENTA
                              </button>
                              <button
                                onClick={() => setField(req.id, 'showReject', true)}
                                className="px-5 bg-rose-50 text-rose-600 border border-rose-200 py-3 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-rose-100 transition-all"
                              >
                                <XOctagon className="w-4 h-4" /> Rechazar
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div>
                                <label className="text-[10px] uppercase font-black text-rose-600 ml-1 mb-1 block">Motivo del Rechazo *</label>
                                <input
                                  className="w-full bg-white border border-rose-200 p-3 rounded-xl outline-none focus:border-rose-400 font-bold text-sm"
                                  placeholder="Ej: Documento incompleto, verificar registro médico..."
                                  value={st.rejectReason}
                                  onChange={e => setField(req.id, 'rejectReason', e.target.value)}
                                />
                              </div>
                              <div className="flex gap-3">
                                <button
                                  onClick={() => handleReject(req)}
                                  disabled={st.loading || !st.rejectReason.trim()}
                                  className="flex-1 bg-rose-600 text-white py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-rose-700 disabled:opacity-50 transition-all"
                                >
                                  {st.loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <XOctagon className="w-4 h-4" />}
                                  CONFIRMAR RECHAZO
                                </button>
                                <button
                                  onClick={() => setField(req.id, 'showReject', false)}
                                  className="px-5 bg-slate-100 text-slate-600 py-3 rounded-xl font-black text-sm hover:bg-slate-200 transition-all"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Aprobado/Rechazado footer */}
                  {req.status !== 'pending' && (
                    <div className={`px-5 py-2.5 border-t text-[10px] font-bold uppercase tracking-widest ${
                      req.status === 'approved' ? 'border-emerald-100 bg-emerald-50/50 text-emerald-600' : 'border-rose-100 bg-rose-50/50 text-rose-600'
                    }`}>
                      {req.status === 'approved'
                        ? `✅ Aprobado por ${req.reviewedBy} · ${req.reviewedAt ? new Date(req.reviewedAt).toLocaleString() : ''}`
                        : `❌ Rechazado: "${req.rejectionReason}" — ${req.reviewedBy}`
                      }
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* ── REGISTRO DE CAMBIOS (siempre visible para no-admin, tab para admin) ── */}
      {(!isAdmin || activeTab === 'novedades') && (
        <>
      {isGeneratingAI && (
        <div className="bg-white p-6 rounded-xl border border-violet-100 text-center space-y-3">
          <div className="flex justify-center">
            <Sparkles className="w-8 h-8 text-violet-500 animate-spin" />
          </div>
          <p className="text-violet-600 font-black animate-pulse uppercase tracking-widest text-xs">Analizando indicadores con IA...</p>
        </div>
      )}

      {aiReport && !isGeneratingAI && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 border-l-4 border-violet-500 p-5 rounded-2xl text-white shadow-lg relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Sparkles className="w-32 h-32" />
          </div>
          <div className="flex justify-between items-start mb-3 border-b border-white/10 pb-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400" /> Dashboard Estadístico IA
            </h3>
            <button onClick={() => setAiReport(null)} className="text-white/40 hover:text-white transition-colors">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-li:my-1">
            <Markdown>{aiReport}</Markdown>
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
            <p className="text-[9px] text-white/40 uppercase font-mono italic">Generado el {new Date().toLocaleString()}</p>
            <button
              onClick={() => {
                const win = window.open('', '_blank');
                win?.document.write(`<html><head><title>Informe Estadístico IA</title><style>body{font-family:sans-serif;padding:40px;line-height:1.6;color:#333}h2{color:#7c3aed}pre{white-space:pre-wrap;background:#f4f4f4;padding:20px;border-radius:10px}</style></head><body><h2>Informe Estadístico Gerencial - IA</h2><div style="font-size:14px">${aiReport.replace(/\n/g, '<br>')}</div></body></html>`);
              }}
              className="text-[10px] font-black underline underline-offset-4 hover:text-violet-400"
            >
              ABRIR PARA IMPRIMIR
            </button>
          </div>
        </motion.div>
      )}

      <div className="space-y-3">
        {monthLogs.length === 0 ? (
          <div className="bg-stone-100/50 border border-emerald-100 p-8 rounded-2xl text-center">
            <Info className="w-8 h-8 text-emerald-200 mx-auto mb-2" />
            <p className="text-slate-400 uppercase font-black tracking-widest text-xs italic">No hay movimientos registrados para este mes</p>
          </div>
        ) : (
          monthLogs.map(log => (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              key={log.id}
              className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-wrap gap-4 items-center justify-between group hover:border-emerald-500/40 transition-colors shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 font-black border border-emerald-100">
                  {log.doctorName.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">Dr. {log.doctorName}</div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Día {log.day} | Jornada: {log.slot.toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-stone-50 px-3 py-2 rounded-xl border border-slate-100">
                <span className="text-xs text-rose-400 line-through opacity-50 px-2">{log.oldSigla}</span>
                <ChevronRight className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md">{log.newSigla}</span>
              </div>

              <div className="flex items-center gap-3">
                {isAdmin && (
                  <button
                    onClick={() => onPushNotification(log.doctorId, `🔔 NOVEDAD INDIVIDUAL: Día ${log.day} (${log.slot.toUpperCase()}) cambio a ${log.newSigla}. Por favor verifique.`)}
                    className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all group/note"
                    title="Notificar inmediatamente a este médico"
                  >
                    <Send className="w-4 h-4 group-hover/note:translate-x-1 transition-transform" />
                  </button>
                )}
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleString()}</div>
                  <div className="text-[9px] uppercase font-bold text-emerald-700/60 transition-colors">Por: {log.adminName}</div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
        </>
      )}
    </motion.div>
  );
}
