import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronRight,
  Calendar,
  Send,
  MapPin,
  ClipboardList,
  Settings,
  Database,
  FileText,
  BrainCircuit,
  BookOpen,
  BarChart3,
  ShieldCheck,
  Bell,
  CheckCircle,
  LogOut,
  MessageCircle
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

interface AppHeaderProps {
  isAdminUser: boolean;
  showAuthInbox: () => void;
}

export function AppHeader({ isAdminUser, showAuthInbox }: AppHeaderProps) {
  const {
    session,
    activeTab,
    setActiveTab,
    shiftRequests,
    userNotifications,
    markNotificationRead,
    handleLogout,
    handleGoogleLogin,
    isFirebaseUnauthenticatedAdmin
  } = useAppContext();

  if (!session) return null;

  return (
    <>
      {isFirebaseUnauthenticatedAdmin && (
        <div className="bg-amber-500 text-black text-[10px] uppercase font-black py-2 px-4 flex items-center justify-center gap-3 sticky top-0 z-[60] shadow-lg">
          <ShieldCheck className="w-4 h-4" />
          <span>Atención: Ha entrado como Administrador Maestro pero no ha iniciado sesión con Google. Los cambios no se guardarán en la nube.</span>
          <button
            onClick={handleGoogleLogin}
            className="bg-black text-white px-3 py-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Vincular Google
          </button>
        </div>
      )}

      <header className="bg-white/95 backdrop-blur-md border-b border-emerald-100 sticky top-0 z-40 p-2 md:p-4 no-print shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="font-black text-emerald-700 tracking-tighter flex items-center gap-2">
                <img src="/Logo_HDSA.jpg" alt="Logo" className="h-12 w-auto object-contain rounded-xl shadow-md border border-emerald-100" />
                COORDINACIÓN MÉDICA HDSAR
              </h1>
              <p className="text-[10px] text-stone-500 font-mono italic">Julián Humberto Vélez Varela Md - Coordinador Médico</p>
            </div>

            {isAdminUser && (
              <button
                onClick={showAuthInbox}
                className={`
                  p-2 rounded-xl border flex items-center gap-2 transition-all relative ml-4
                  ${shiftRequests.filter(r => r.status === 'pending').length > 0
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 animate-pulse'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'}
                `}
              >
                <ShieldCheck className="w-5 h-5" />
                <div className="text-left hidden lg:block">
                  <div className="text-[8px] uppercase font-bold opacity-50">Administración</div>
                  <div className="text-[10px] uppercase font-black">Bandeja de Autorización</div>
                </div>
                {shiftRequests.filter(r => r.status === 'pending').length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-black shadow-lg">
                    {shiftRequests.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </button>
            )}

            {session?.doctorId && userNotifications.length > 0 && (
              <div className="relative group">
                <button className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20 text-emerald-600 relative">
                  <Bell className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {userNotifications.length}
                  </span>
                </button>
                <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-emerald-100 rounded-2xl shadow-2xl p-4 hidden group-hover:block z-[60]">
                  <h4 className="text-[10px] uppercase text-emerald-600 font-bold mb-3 border-b border-emerald-500/10 pb-2">Notificaciones</h4>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    {userNotifications.map(n => (
                      <div key={n.id} className="text-[11px] bg-emerald-50/30 p-3 rounded-xl border border-emerald-100 group/item">
                        <p className="text-slate-700">{n.message}</p>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-[8px] text-slate-400">{new Date(n.timestamp).toLocaleTimeString()}</span>
                          <button
                            onClick={() => markNotificationRead(n.id)}
                            className="text-emerald-500 hover:scale-110 active:scale-95"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://wa.me/573173683886?mode=gi_t"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-[#25D366] text-white px-4 py-1.5 rounded-xl text-xs font-black hover:bg-[#20ba59] transition-all shadow-lg shadow-emerald-500/10 no-print"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden md:inline uppercase">Chat Médico</span>
            </a>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-rose-500 font-bold text-xs bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 no-print"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline uppercase">Cerrar Sesión</span>
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="max-w-7xl mx-auto mt-4 overflow-x-auto">
          <div className="flex gap-2">
            {[
              { id: 'home', label: 'Dashboard', icon: ChevronRight },
              { id: 'turnos', label: 'Turnero Hospitalario', icon: Calendar },
              { id: 'pic', label: 'Capacitaciones (PIC)', icon: BrainCircuit },
              { id: 'solicitudes', label: 'Solicitudes', icon: Send },
              { id: 'rural', label: 'Disponibilidades Rurales', icon: MapPin },
              ...((session.r === 'admin' || session.r === 'root') ? [
                { id: 'stats', label: 'Estadísticas', icon: BarChart3 }
              ] : []),
              { id: 'novedades', label: 'Novedades', icon: ClipboardList },
              { id: 'bd', label: 'Talento Humano', icon: Database },
              { id: 'docs', label: 'Guías & Manuales', icon: FileText },
              ...(session.r === 'admin' ? [
                { id: 'admin', label: 'Panel Administrativo', icon: Settings },
                { id: 'toolbox', label: 'Caja de Herramientas AI', icon: Database },
                { id: 'ayuda', label: 'Resumen Órdenes', icon: BookOpen }
              ] : [])
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                    : 'bg-white text-emerald-800/60 hover:bg-emerald-50 border border-emerald-100'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>
    </>
  );
}
