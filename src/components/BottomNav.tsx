import {
  Calendar, ChevronRight, Send, MapPin, ClipboardList,
  Settings, BrainCircuit, BarChart3, Database, FileText, BookOpen
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export function BottomNav() {
  const { session, activeTab, setActiveTab } = useAppContext();

  const navItems = [
    { id: 'home', icon: ChevronRight, label: 'Inicio' },
    { id: 'turnos', icon: Calendar, label: 'Turnos' },
    { id: 'pic', icon: BrainCircuit, label: 'PIC' },
    { id: 'solicitudes', icon: Send, label: 'Solicita' },
    { id: 'rural', icon: MapPin, label: 'Rural' },
    ...((session?.r === 'admin' || session?.r === 'root') ? [
      { id: 'stats', icon: BarChart3, label: 'Stats' }
    ] : []),
    { id: 'novedades', icon: ClipboardList, label: 'Novedades' },
    { id: 'bd', icon: Database, label: 'TH' },
    { id: 'docs', icon: FileText, label: 'Guías' },
    ...(session?.r === 'admin' ? [
      { id: 'admin', icon: Settings, label: 'Admin' },
      { id: 'toolbox', icon: Database, label: 'AI' },
      { id: 'ayuda', icon: BookOpen, label: 'Órdenes' }
    ] : [])
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-emerald-100 z-50 no-print shadow-2xl">
      <div className="max-w-7xl mx-auto flex justify-around overflow-x-auto px-1 py-1 md:py-2">
        {navItems.map(btn => (
          <button
            key={btn.id}
            onClick={() => setActiveTab(btn.id)}
            className={`flex flex-col items-center justify-center p-2 rounded-xl min-w-[52px] md:min-w-[64px] transition-all ${
              activeTab === btn.id
                ? 'text-white bg-emerald-600 shadow-lg'
                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
            }`}
          >
            <btn.icon className="w-5 h-5 md:w-6 md:h-6 mb-0.5" />
            <span className="text-[7px] md:text-[9px] font-black uppercase tracking-tight whitespace-nowrap">{btn.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
