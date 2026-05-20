import { motion } from 'motion/react';
import { FileSpreadsheet, Printer, Sparkles, XCircle, Info, Calendar, ChevronRight, Send } from 'lucide-react';
import Markdown from 'react-markdown';
import { AuditEntry, UserSession } from '../types';

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
}

export function NovedadesView({
  session, monthName, selectedYear, auditLogs, selectedMonth,
  onExportExcel, onExportPDF, onGenerateAI, isGeneratingAI,
  aiReport, setAiReport, onPushNotification
}: Props) {
  const isAdmin = session.r === 'admin';
  const monthLogs = auditLogs.filter(l => l.targetMonth === selectedMonth && l.targetYear === selectedYear);

  return (
    <motion.div
      key="novedades"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      <div className="flex justify-between items-center bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Novedades de {monthName} {selectedYear}</h2>
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

      {isGeneratingAI && (
        <div className="bg-white p-12 rounded-[32px] border border-violet-100 text-center space-y-4">
          <div className="flex justify-center">
            <Sparkles className="w-12 h-12 text-violet-500 animate-spin" />
          </div>
          <p className="text-violet-600 font-black animate-pulse uppercase tracking-widest text-xs">Analizando indicadores con IA...</p>
        </div>
      )}

      {aiReport && !isGeneratingAI && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 border-l-4 border-violet-500 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Sparkles className="w-32 h-32" />
          </div>
          <div className="flex justify-between items-start mb-6 border-b border-white/10 pb-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400" /> Dashboard Estadístico IA
            </h3>
            <button onClick={() => setAiReport(null)} className="text-white/40 hover:text-white transition-colors">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-li:my-1">
            <Markdown>{aiReport}</Markdown>
          </div>
          <div className="mt-8 pt-4 border-t border-white/10 flex justify-between items-center">
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
          <div className="bg-stone-100/50 border border-emerald-100 p-12 rounded-3xl text-center">
            <Info className="w-12 h-12 text-emerald-200 mx-auto mb-4" />
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
    </motion.div>
  );
}
