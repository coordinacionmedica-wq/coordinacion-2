import { AnimatePresence, motion } from 'motion/react';
import { ShieldCheck, XCircle, CheckCircle } from 'lucide-react';
import { ShiftRequest, Doctor } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  requests: ShiftRequest[];
  doctors: Doctor[];
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}

export function AuthInboxModal({ isOpen, onClose, requests, doctors, onApprove, onReject }: Props) {
  const pending = requests.filter(r => r.status === 'pending');

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-6">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-2xl p-8 rounded-[32px] border border-emerald-100 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <ShieldCheck className="w-48 h-48 text-emerald-600" />
            </div>

            <div className="flex justify-between items-center mb-6 relative z-10">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                Bandeja de Autorización
              </h2>
              <button onClick={onClose} className="bg-slate-50 p-2 rounded-xl text-slate-400 hover:text-rose-500 transition-colors border border-slate-200">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 relative z-10">
              {pending.length === 0 ? (
                <div className="text-center py-20">
                  <div className="text-emerald-500/30 font-black uppercase tracking-widest italic">No hay solicitudes pendientes</div>
                </div>
              ) : (
                pending.map(req => {
                  const docName = doctors.find(d => d.id === req.doctorId)?.nombre || 'Médico Desconocido';
                  return (
                    <div key={req.id} className="bg-slate-50 border border-emerald-100 p-5 rounded-2xl flex justify-between items-center group hover:border-emerald-500/50 transition-all shadow-sm">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-black text-slate-800 uppercase text-sm">{docName}</span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase">Solicitud</span>
                        </div>
                        <div className="text-xs text-emerald-600">
                          Día {req.day} - Jornada: <span className="font-bold uppercase">{req.slot}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2 italic bg-white p-3 rounded-xl border border-emerald-50 border-dashed">
                          "{req.reason || 'Sin motivo especificado'}"
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => onApprove(req.id)}
                          className="w-12 h-12 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:scale-110 active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
                          title="Autorizar"
                        >
                          <CheckCircle className="w-6 h-6" />
                        </button>
                        <button
                          onClick={() => onReject(req.id)}
                          className="w-12 h-12 flex items-center justify-center bg-rose-500 text-white rounded-xl hover:scale-110 active:scale-95 transition-all shadow-lg shadow-rose-500/20"
                          title="Rechazar"
                        >
                          <XCircle className="w-6 h-6" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-emerald-100 text-[10px] text-slate-400 italic text-center">
              Las solicitudes autorizadas se verán reflejadas automáticamente en el turnero.
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
