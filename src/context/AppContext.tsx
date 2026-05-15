import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Doctor,
  MonthlyData,
  VarSlotConfig,
  UserSession,
  SlotType,
  DoctorShifts,
  AuditEntry,
  ShiftRequest,
  RuralAvailability,
  AvailabilityCall,
  TrainingActivity,
  ServiceMapping
} from '../types';
import { MASTER_ADMIN, MASTER_READER, DEFAULT_VARS, MONTH_NAMES, STORAGE_KEYS } from '../constants';
import {
  collection,
  onSnapshot,
  setDoc,
  doc,
  query,
  where,
  getDocs,
  deleteDoc,
  updateDoc,
  orderBy,
  limit
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  firebaseConfig
} from '../firebase';
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
  signOut,
  User
} from 'firebase/auth';

// ─── Notification Type ──────────────────────────────────────
export interface AppNotification {
  message: string;
  type: 'success' | 'error' | 'info';
}

// ─── Context Shape ──────────────────────────────────────────
interface AppContextType {
  // Session
  session: UserSession | null;
  setSession: React.Dispatch<React.SetStateAction<UserSession | null>>;
  fbUser: User | null;
  isBooting: boolean;
  isOnline: boolean;
  isFirebaseUnauthenticatedAdmin: boolean;

  // Data
  doctors: Doctor[];
  variables: VarSlotConfig;
  setVariables: React.Dispatch<React.SetStateAction<VarSlotConfig>>;
  currentMonthData: MonthlyData;
  setCurrentMonthData: React.Dispatch<React.SetStateAction<MonthlyData>>;
  auditLogs: AuditEntry[];
  shiftRequests: ShiftRequest[];
  ruralAvailabilities: RuralAvailability[];
  availabilityCalls: AvailabilityCall[];
  activities: TrainingActivity[];
  serviceMappings: ServiceMapping[];
  setServiceMappings: React.Dispatch<React.SetStateAction<ServiceMapping[]>>;
  userNotifications: { id: string; message: string; timestamp: number; read: boolean }[];
  isMonthPublished: boolean;

  // Date
  selectedMonth: number;
  setSelectedMonth: React.Dispatch<React.SetStateAction<number>>;
  selectedYear: number;
  setSelectedYear: React.Dispatch<React.SetStateAction<number>>;
  daysInMonth: number;

  // UI Notification
  notification: AppNotification | null;
  setNotification: React.Dispatch<React.SetStateAction<AppNotification | null>>;
  notify: (message: string, type: AppNotification['type']) => void;

  // Theme
  theme: { primary: string; font: string };
  setTheme: React.Dispatch<React.SetStateAction<{ primary: string; font: string }>>;
  updateTheme: (newTheme: { primary: string; font: string }) => Promise<void>;

  // Tab
  activeTab: string;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;

  // Auth actions
  handleLogin: (loginU: string, loginP: string) => Promise<void>;
  handleGoogleLogin: () => Promise<void>;
  handleLogout: () => void;

  // Data actions
  pushNotification: (doctorId: number, message: string) => Promise<void>;
  markNotificationRead: (notifId: string) => void;
  updateDoctorMonth: (doctorId: number, shifts: DoctorShifts) => Promise<void>;
  updateMonthlyData: (data: MonthlyData) => Promise<void>;

  // AI state
  isGeneratingAI: boolean;
  setIsGeneratingAI: React.Dispatch<React.SetStateAction<boolean>>;
  aiReport: string | null;
  setAiReport: React.Dispatch<React.SetStateAction<string | null>>;

  // Idle
  idleTimeout: number;
  setIdleTimeout: React.Dispatch<React.SetStateAction<number>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────
export function AppProvider({ children }: { children: React.ReactNode }) {
  // Boot & connectivity
  const [isBooting, setIsBooting] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Session
  const [session, setSession] = useState<UserSession | null>(null);
  const [fbUser, setFbUser] = useState<User | null>(null);

  // Date
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  // UI
  const [activeTab, setActiveTab] = useState<string>('turnos');
  const [notification, setNotification] = useState<AppNotification | null>(null);
  const [theme, setTheme] = useState({ primary: '#059669', font: 'sans' });

  // Data
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [variables, setVariables] = useState<VarSlotConfig>(DEFAULT_VARS);
  const [currentMonthData, setCurrentMonthData] = useState<MonthlyData>({});
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [shiftRequests, setShiftRequests] = useState<ShiftRequest[]>([]);
  const [ruralAvailabilities, setRuralAvailabilities] = useState<RuralAvailability[]>([]);
  const [availabilityCalls, setAvailabilityCalls] = useState<AvailabilityCall[]>([]);
  const [activities, setActivities] = useState<TrainingActivity[]>([]);
  const [serviceMappings, setServiceMappings] = useState<ServiceMapping[]>([]);
  const [userNotifications, setUserNotifications] = useState<{ id: string; message: string; timestamp: number; read: boolean }[]>([]);
  const [isMonthPublished, setIsMonthPublished] = useState(false);

  // AI
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  // Idle
  const [idleTimeout, setIdleTimeout] = useState(() => {
    const stored = localStorage.getItem('idleTimeout');
    return stored ? Number(stored) : 15;
  });

  const isFirebaseUnauthenticatedAdmin = session?.r === 'admin' && !fbUser;

  // ── Notify helper ──
  const notify = useCallback((message: string, type: AppNotification['type']) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // ── Boot timer ──
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (stored) {
      try { setSession(JSON.parse(stored)); } catch { /* ignore */ }
    }
    const timer = setTimeout(() => setIsBooting(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  // ── Firebase Auth listener ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFbUser(user);
    });
    return unsub;
  }, []);

  // ── Firestore listeners ──
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    // Doctors
    unsubs.push(
      onSnapshot(collection(db, 'doctors'), (snap) => {
        setDoctors(snap.docs.map(d => ({ id: Number(d.id), ...d.data() } as Doctor)));
      })
    );

    // Variables
    unsubs.push(
      onSnapshot(doc(db, 'settings', 'variables'), (snap) => {
        if (snap.exists()) setVariables(snap.data() as VarSlotConfig);
      })
    );

    // Audit logs
    unsubs.push(
      onSnapshot(collection(db, 'auditLogs'), (snap) => {
        setAuditLogs(snap.docs.map(d => d.data() as AuditEntry).sort((a, b) => b.timestamp - a.timestamp));
      })
    );

    // Shift requests
    unsubs.push(
      onSnapshot(collection(db, 'shiftRequests'), (snap) => {
        setShiftRequests(snap.docs.map(d => d.data() as ShiftRequest).sort((a, b) => b.timestamp - a.timestamp));
      })
    );

    // Rural availability
    unsubs.push(
      onSnapshot(collection(db, 'ruralAvailability'), (snap) => {
        setRuralAvailabilities(snap.docs.map(d => d.data() as RuralAvailability));
      })
    );

    // Availability calls
    unsubs.push(
      onSnapshot(collection(db, 'availabilityCalls'), (snap) => {
        setAvailabilityCalls(snap.docs.map(d => d.data() as AvailabilityCall).sort((a, b) => b.timestamp - a.timestamp));
      })
    );

    // Training activities
    unsubs.push(
      onSnapshot(collection(db, 'trainingActivities'), (snap) => {
        setActivities(snap.docs.map(d => d.data() as TrainingActivity));
      })
    );

    // Theme
    unsubs.push(
      onSnapshot(doc(db, 'settings', 'theme'), (snap) => {
        if (snap.exists()) setTheme(snap.data() as any);
      })
    );

    // Service Mappings
    unsubs.push(
      onSnapshot(doc(db, 'settings', 'serviceMappings'), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data?.mappings) setServiceMappings(data.mappings);
        }
      })
    );

    return () => unsubs.forEach(u => u());
  }, []);

  // ── Monthly data listener ──
  useEffect(() => {
    const monthKey = `${selectedYear}_${selectedMonth}`;

    const unsubMeta = onSnapshot(doc(db, 'monthlyData', monthKey), (snap) => {
      if (snap.exists()) {
        setIsMonthPublished(!!snap.data()?.published);
      } else {
        setIsMonthPublished(false);
      }
    });

    const unsubDocs = onSnapshot(collection(db, 'monthlyData', monthKey, 'doctors'), (snap) => {
      const data: MonthlyData = {};
      snap.docs.forEach(d => {
        data[Number(d.id)] = d.data() as DoctorShifts;
      });
      setCurrentMonthData(data);
    });

    return () => { unsubMeta(); unsubDocs(); };
  }, [selectedMonth, selectedYear]);

  // ── Notifications listener ──
  useEffect(() => {
    if (!session?.doctorId) { setUserNotifications([]); return; }
    const q = query(
      collection(db, 'notifications'),
      where('doctorId', '==', session.doctorId),
      where('read', '==', false)
    );
    const unsub = onSnapshot(q, (snap) => {
      setUserNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });
    return unsub;
  }, [session?.doctorId]);

  // ── Idle timeout logic ──
  useEffect(() => {
    if (!session) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        handleLogout();
        notify('Sesión cerrada por inactividad', 'info');
      }, idleTimeout * 60 * 1000);
    };
    const events = ['mousemove', 'keydown', 'click', 'touchstart'];
    events.forEach(e => window.addEventListener(e, reset));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [session, idleTimeout]);

  // ── Actions ──
  const handleLogin = useCallback(async (loginU: string, loginP: string) => {
    if (loginU === MASTER_ADMIN.u && loginP === MASTER_ADMIN.p) {
      const sess: UserSession = { r: 'admin', n: 'Admin General' };
      setSession(sess);
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
      return;
    }
    if (loginU === MASTER_READER.u) {
      const sess: UserSession = { r: 'read', n: 'Personal Invitado' };
      setSession(sess);
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
      return;
    }
    // Doctor login
    const q = query(collection(db, 'doctors'), where('username', '==', loginU));
    const snap = await getDocs(q);
    if (snap.empty) {
      alert('Credenciales inválidas.');
      return;
    }
    const docData = snap.docs[0].data() as Doctor;
    if (docData.password !== loginP) {
      alert('Contraseña incorrecta.');
      return;
    }
    // Try server login for custom token
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginU, password: loginP })
      });
      if (res.ok) {
        const { token } = await res.json();
        await signInWithCustomToken(auth, token);
      }
    } catch { /* custom token is optional */ }

    const sess: UserSession = {
      r: 'doctor',
      n: docData.nombre,
      doctorId: docData.id
    };
    setSession(sess);
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
  }, []);

  const handleGoogleLogin = useCallback(async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Google login error:', err);
    }
  }, []);

  const handleLogout = useCallback(() => {
    setSession(null);
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    signOut(auth).catch(() => {});
  }, []);

  const pushNotification = useCallback(async (doctorId: number, message: string) => {
    const id = Date.now().toString();
    try {
      await setDoc(doc(db, 'notifications', id), {
        doctorId,
        message,
        timestamp: Date.now(),
        read: false
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `notifications/${id}`);
    }
  }, []);

  const markNotificationRead = useCallback((notifId: string) => {
    updateDoc(doc(db, 'notifications', notifId), { read: true }).catch(() => {});
  }, []);

  const updateDoctorMonth = useCallback(async (doctorId: number, shifts: DoctorShifts) => {
    const monthKey = `${selectedYear}_${selectedMonth}`;
    try {
      await setDoc(doc(db, 'monthlyData', monthKey, 'doctors', String(doctorId)), shifts);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `monthlyData/${monthKey}/doctors/${doctorId}`);
    }
  }, [selectedMonth, selectedYear]);

  const updateMonthlyData = useCallback(async (data: MonthlyData) => {
    const monthKey = `${selectedYear}_${selectedMonth}`;
    const promises = Object.entries(data).map(([id, shifts]) =>
      setDoc(doc(db, 'monthlyData', monthKey, 'doctors', id), shifts)
    );
    await Promise.all(promises);
  }, [selectedMonth, selectedYear]);

  const updateThemeAction = useCallback(async (newTheme: { primary: string; font: string }) => {
    try {
      await setDoc(doc(db, 'settings', 'theme'), newTheme);
      setTheme(newTheme);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/theme');
    }
  }, []);

  // Send email notification helper (fire & forget)
  const sendEmailNotification = useCallback(async (to: string, subject: string, body: string) => {
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text: body })
      });
    } catch { /* ignore */ }
  }, []);

  const value: AppContextType = {
    session, setSession, fbUser, isBooting, isOnline, isFirebaseUnauthenticatedAdmin,
    doctors, variables, setVariables, currentMonthData, setCurrentMonthData,
    auditLogs, shiftRequests, ruralAvailabilities, availabilityCalls,
    activities, serviceMappings, setServiceMappings, userNotifications, isMonthPublished,
    selectedMonth, setSelectedMonth, selectedYear, setSelectedYear, daysInMonth,
    notification, setNotification, notify,
    theme, setTheme, updateTheme: updateThemeAction,
    activeTab, setActiveTab,
    handleLogin, handleGoogleLogin, handleLogout,
    pushNotification, markNotificationRead, updateDoctorMonth, updateMonthlyData,
    isGeneratingAI, setIsGeneratingAI, aiReport, setAiReport,
    idleTimeout, setIdleTimeout
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
