import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ShieldCheck,
  Bell,
  CheckCircle,
  LogOut,
  MessageCircle,
  Menu,
  X,
  ChevronDown,
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
  Users,
  MoreHorizontal,
  Home,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

interface AppHeaderProps {
  isAdminUser: boolean;
  showAuthInbox: () => void;
}

export function AppHeader({ isAdminUser, showAuthInbox }: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
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

  const pendingCount = shiftRequests.filter(r => r.status === 'pending').length;

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

      <header className="bg-white/95 backdrop-blur-md border-b border-emerald-100 sticky top-0 z-40 p-2 md:p-3 no-print shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          {/* Logo + Title */}
          <div className="flex items-center gap-3">
            <img
              src="/Logo_HDSA.jpg"
              alt="Logo"
              className="h-10 w-auto object-contain rounded-lg shadow-sm border border-emerald-100"
            />
            <div>
              <h1 className="font-black text-emerald-700 tracking-tighter text-sm md:text-base">
                COORDINACIÓN MÉDICA HDSAR
              </h1>
              <p className="text-[9px] text-stone-500 font-mono italic hidden sm:block">
                Julián Humberto Vélez Varela Md - Coordinador Médico
              </p>
            </div>
          </div>

          {/* Hamburger Menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`p-2 rounded-xl border transition-all ${
                menuOpen
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-72 bg-white border border-emerald-100 rounded-2xl shadow-2xl p-3 z-[60]"
                >
                  {/* Admin: Bandeja */}
                  {isAdminUser && (
                    <button
                      onClick={() => { showAuthInbox(); setMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl mb-2 transition-all ${
                        pendingCount > 0
                          ? 'bg-amber-50 border border-amber-200 text-amber-700'
                          : 'bg-emerald-50/50 border border-emerald-100 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      <ShieldCheck className="w-5 h-5" />
                      <div className="text-left flex-1">
                        <div className="text-[10px] uppercase font-bold opacity-60">Administración</div>
                        <div className="text-xs font-black">Bandeja de Autorización</div>
                      </div>
                      {pendingCount > 0 && (
                        <span className="bg-amber-500 text-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black">
                          {pendingCount}
                        </span>
                      )}
                    </button>
                  )}

                  {/* Doctor: Notifications */}
                  {session?.doctorId && userNotifications.length > 0 && (
                    <div className="mb-2 border border-emerald-100 rounded-xl p-3 bg-emerald-50/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Bell className="w-4 h-4 text-emerald-600" />
                        <span className="text-[10px] uppercase font-bold text-emerald-600">Notificaciones</span>
                        <span className="bg-rose-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold ml-auto">
                          {userNotifications.length}
                        </span>
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {userNotifications.map(n => (
                          <div key={n.id} className="text-[11px] bg-white p-2 rounded-lg border border-emerald-100 flex justify-between items-center">
                            <span className="text-slate-700 truncate mr-2">{n.message}</span>
                            <button
                              onClick={() => markNotificationRead(n.id)}
                              className="text-emerald-500 hover:scale-110 active:scale-95 shrink-0"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Chat Médico */}
                  <a
                    href="https://wa.me/573173683886?mode=gi_t"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 text-[#128C7E] hover:bg-[#25D366]/20 transition-all mb-2"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-xs font-black uppercase">Chat Médico</span>
                  </a>

                  {/* Logout */}
                  <button
                    onClick={() => { handleLogout(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="text-xs font-black uppercase">Cerrar Sesión</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Top Tab Navigation */}
        {(() => {
          const isAdmin = session.r === 'admin';
          const isAdminOrRoot = session.r === 'admin' || session.r === 'root';

          const primaryTabs = [
            { id: 'home',        label: 'Inicio',       icon: Home },
            { id: 'turnos',      label: 'Turnos',       icon: Calendar },
            { id: 'pic',         label: 'PIC',          icon: BrainCircuit },
            { id: 'solicitudes', label: 'Solicita',     icon: Send },
            { id: 'rural',       label: 'Rural',        icon: MapPin },
            ...(isAdminOrRoot ? [{ id: 'stats', label: 'Estadísticas', icon: BarChart3 }] : []),
            { id: 'novedades',   label: 'Novedades',    icon: ClipboardList },
            { id: 'bd',          label: 'Talento Hum.', icon: Users },
          ];

          const secondaryTabs = isAdmin ? [
            { id: 'docs',    label: 'Guías',    icon: FileText },
            { id: 'admin',   label: 'Admin',    icon: Settings },
            { id: 'toolbox', label: 'AI',       icon: Database },
            { id: 'ayuda',   label: 'Órdenes',  icon: BookOpen },
          ] : [];

          const secondaryActive = secondaryTabs.some(t => t.id === activeTab);

          return (
            <div className="max-w-7xl mx-auto mt-2 flex items-center gap-1 overflow-x-auto no-scrollbar">
              {primaryTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold text-[10px] md:text-xs transition-all whitespace-nowrap shrink-0 ${
                    activeTab === tab.id
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-white/60 text-emerald-700 hover:bg-emerald-50 border border-emerald-100'
                  }`}
                >
                  <tab.icon className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                </button>
              ))}

              {secondaryTabs.length > 0 && (
                <div className="relative shrink-0 ml-auto">
                  <button
                    onClick={() => setMoreMenuOpen(v => !v)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold text-[10px] md:text-xs transition-all whitespace-nowrap border ${
                      secondaryActive || moreMenuOpen
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : 'bg-white/60 text-emerald-700 border-emerald-100 hover:bg-emerald-50'
                    }`}
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Más</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${moreMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {moreMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-0 top-full mt-1 bg-white border border-emerald-100 rounded-xl shadow-xl p-1.5 z-[60] min-w-[130px]"
                      >
                        {secondaryTabs.map(tab => (
                          <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setMoreMenuOpen(false); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-xs transition-all ${
                              activeTab === tab.id
                                ? 'bg-emerald-600 text-white'
                                : 'text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            <tab.icon className="w-3.5 h-3.5" />
                            {tab.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          );
        })()}
      </header>
    </>
  );
}
