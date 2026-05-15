import { Calendar, ChevronRight, Send, MapPin, ClipboardList, Settings } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export function BottomNav() {
  const { session, activeTab, setActiveTab } = useAppContext();

  const navItems = [
    { id: 'home', icon: ChevronRight, label: 'Home' },
    { id: 'turnos', icon: Calendar, label: 'Turnos' },
    { id: 'solicitudes', icon: Send, label: 'Solicitudes' },
    { id: 'rural', icon: MapPin, label: 'Rural' },
    { id: 'novedades', icon: ClipboardList, label: 'Novedades' },
    ...(session?.r === 'admin' ? [{ id: 'admin', icon: Settings, label: 'Admin' }] : [])
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-emerald-100 p-1 md:p-2 flex justify-around z-50 no-print max-w-7xl mx-auto rounded-t-3xl sm:mb-2 sm:px-4 shadow-2xl safe-area-bottom">
      {navItems.map(btn => (
        <button
          key={btn.id}
          onClick={() => setActiveTab(btn.id)}
          className={`flex flex-col items-center justify-center p-2 md:p-3 rounded-2xl flex-1 md:w-24 transition-all ${
            activeTab === btn.id ? 'text-white bg-emerald-600 shadow-lg' : 'text-slate-400 hover:text-emerald-600'
          }`}
        >
          <btn.icon className="w-5 h-5 md:w-6 md:h-6 mb-0.5 md:mb-1" />
          <span className="text-[8px] md:text-[10px] font-black uppercase tracking-tight md:tracking-widest">{btn.label}</span>
        </button>
      ))}
    </nav>
  );
}
