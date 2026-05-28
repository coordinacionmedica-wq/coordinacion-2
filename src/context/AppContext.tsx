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
  ServiceMapping,
  RegistrationRequest
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
  getDoc,
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
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
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
  fbUser: User | null | undefined;
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

  // Doctor CRUD
  saveEditedDoctor: (doctor: Doctor) => Promise<void>;
  toggleDoctorStatus: (id: number) => Promise<void>;
  deleteDoctor: (id: number) => Promise<void>;
  resetDoctorPass: (id: number) => Promise<void>;
  changePassword: (doctorId: number, oldPass: string, newPass: string) => Promise<void>;

  // Variables
  addVariable: (slot: SlotType, code: string, hours: number) => Promise<void>;
  removeVariable: (slot: SlotType, code: string) => Promise<void>;

  // Activities
  addActivity: (activity: Partial<TrainingActivity>) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;

  // Service Mappings
  saveServiceMappings: (mappings: ServiceMapping[]) => Promise<void>;

  // Registration Requests
  registrationRequests: RegistrationRequest[];
  approveRegistration: (requestId: string, assignedRol: string, assignedCat: string) => Promise<void>;
  rejectRegistration: (requestId: string, reason: string) => Promise<void>;

  // Shift Requests
  submitShiftRequest: (day: number, slot: SlotType, reason: string) => Promise<void>;
  updateRequestStatus: (id: number, status: 'approved' | 'rejected') => Promise<void>;

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
  const [fbUser, setFbUser] = useState<User | null | undefined>(undefined);

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
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([]);
  const [isMonthPublished, setIsMonthPublished] = useState(false);

  // AI
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  // Idle
  const [idleTimeout, setIdleTimeout] = useState(() => {
    const stored = localStorage.getItem('idleTimeout');
    return stored ? Number(stored) : 15;
  });

  const isFirebaseUnauthenticatedAdmin = session?.r === 'admin' && (!fbUser || fbUser.isAnonymous);

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

  // ── Admin email list ──
  const ADMIN_EMAILS = ['julive17@gmail.com', 'coordinacionmedica@correohdsa.gov.co'];

  // ── Firebase Auth listener ──
  const reauthAttempted = React.useRef(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFbUser(user);
      // Re-authenticate if session exists but Firebase has no user (once only)
      if (!user && !reauthAttempted.current) {
        reauthAttempted.current = true;
        const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
        if (stored) {
          signInAnonymously(auth).catch(() => {});
        }
      }
    });
    // Handle Google redirect result — detect admin by email
    getRedirectResult(auth).then((result) => {
      if (result?.user?.email) {
        const email = result.user.email;
        if (ADMIN_EMAILS.includes(email)) {
          const sess: UserSession = { r: 'admin', n: result.user.displayName || email };
          setSession(sess);
          localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
        }
      }
    }).catch((err) => {
      console.error('Google redirect error:', err);
    });
    return unsub;
  }, []);

  // ── Firestore listeners (wait for auth to resolve before subscribing) ──
  useEffect(() => {
    if (fbUser === undefined) return; // auth not resolved yet — skip to avoid permission-denied flood
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

    // Registration Requests
    unsubs.push(
      onSnapshot(collection(db, 'registrationRequests'), (snap) => {
        setRegistrationRequests(
          snap.docs.map(d => d.data() as RegistrationRequest)
            .sort((a, b) => b.createdAt - a.createdAt)
        );
      })
    );

    return () => unsubs.forEach(u => u());
  }, [fbUser]);

  // ── Monthly data listener ──
  useEffect(() => {
    if (fbUser === undefined) return; // auth not resolved yet
    // Reset data immediately on month/year change so counters start at 0
    setCurrentMonthData({});
    setIsMonthPublished(false);

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
  }, [selectedMonth, selectedYear, fbUser]);

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
    // Admin login — credentials only, Firebase anonymous auth
    if (loginU === MASTER_ADMIN.u && loginP === MASTER_ADMIN.p) {
      try { await signInAnonymously(auth); } catch { /* optional */ }
      const sess: UserSession = { r: 'admin', n: 'Admin General' };
      setSession(sess);
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
      return;
    }
    // Reader login
    if (loginU === MASTER_READER.u) {
      try { await signInAnonymously(auth); } catch { /* optional */ }
      const sess: UserSession = { r: 'read', n: 'Personal Invitado' };
      setSession(sess);
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
      return;
    }
    // Doctor login — client-side validation against Firestore
    try {
      try { await signInAnonymously(auth); } catch { /* optional */ }
      const q = query(collection(db, 'doctors'), where('username', '==', loginU));
      const snap = await getDocs(q);
      if (snap.empty) { alert('Credenciales inválidas.'); return; }
      const docData = snap.docs[0].data() as Doctor;
      if (docData.password !== loginP) { alert('Contraseña incorrecta.'); return; }
      // Check password expiry
      const expiryDays = 90;
      const lastChanged = docData.passwordLastChanged || 0;
      const daysSince = (Date.now() - lastChanged) / (1000 * 60 * 60 * 24);
      if (daysSince > expiryDays) {
        alert('Su contraseña ha expirado (vence cada 3 meses). Por favor cámbiela.');
      }
      const prefix = docData.genero === 'F' ? 'Dra.' : 'Dr.';
      const sess: UserSession = { r: 'doctor', n: `${prefix} ${docData.nombre}`, doctorId: docData.id };
      setSession(sess);
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
    } catch (err) {
      console.error('Login error:', err);
      alert('Error al iniciar sesión. Intente de nuevo.');
    }
  }, []);

  const handleGoogleLogin = useCallback(async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result?.user?.email) {
        const email = result.user.email;
        if (ADMIN_EMAILS.includes(email)) {
          const sess: UserSession = { r: 'admin', n: result.user.displayName || email };
          setSession(sess);
          localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
        }
      }
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

  const ensureAuth = useCallback(async () => {
    if (auth.currentUser) return;
    // Wait up to 3s for auth to resolve
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 200));
      if (auth.currentUser) return;
    }
    try { await signInAnonymously(auth); } catch { /* ignore */ }
  }, []);

  const updateDoctorMonth = useCallback(async (doctorId: number, shifts: DoctorShifts) => {
    const monthKey = `${selectedYear}_${selectedMonth}`;
    try {
      await ensureAuth();
      await setDoc(doc(db, 'monthlyData', monthKey, 'doctors', String(doctorId)), shifts);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `monthlyData/${monthKey}/doctors/${doctorId}`);
    }
  }, [selectedMonth, selectedYear, ensureAuth]);

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

  // ── Doctor CRUD ──
  const saveEditedDoctor = useCallback(async (doctor: Doctor) => {
    try {
      await setDoc(doc(db, 'doctors', doctor.id.toString()), doctor);
      notify('Médico actualizado correctamente', 'success');
    } catch (err) {
      notify('Error: No se pudo actualizar el médico', 'error');
      handleFirestoreError(err, OperationType.WRITE, `doctors/${doctor.id}`);
    }
  }, [notify]);

  const toggleDoctorStatus = useCallback(async (id: number) => {
    const d = doctors.find(doc => doc.id === id);
    if (!d) return;
    try {
      await updateDoc(doc(db, 'doctors', id.toString()), { st: d.st === 'activo' ? 'inactivo' : 'activo' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `doctors/${id}`);
    }
  }, [doctors]);

  const deleteDoctor = useCallback(async (id: number) => {
    if (!confirm('¿Eliminar permanentemente?')) return;
    try {
      await deleteDoc(doc(db, 'doctors', id.toString()));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `doctors/${id}`);
    }
  }, []);

  const resetDoctorPass = useCallback(async (id: number) => {
    const defaultPass = `ESE${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      await updateDoc(doc(db, 'doctors', id.toString()), { password: defaultPass, passwordLastChanged: Date.now() });
      notify(`Contraseña reseteada a: ${defaultPass}`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `doctors/${id}`);
    }
  }, [notify]);

  const changePassword = useCallback(async (doctorId: number, oldPass: string, newPass: string) => {
    const d = doctors.find(doc => doc.id === doctorId);
    if (!d) return;
    if (d.password !== oldPass) { alert('La contraseña actual es incorrecta'); return; }
    if (newPass.length < 4) { alert('La nueva contraseña debe tener al menos 4 caracteres'); return; }
    try {
      await updateDoc(doc(db, 'doctors', doctorId.toString()), { password: newPass, passwordLastChanged: Date.now() });
      notify('Contraseña actualizada con éxito', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `doctors/${doctorId}`);
    }
  }, [doctors, notify]);

  // ── Variables ──
  const addVariable = useCallback(async (slot: SlotType, code: string, hours: number) => {
    if (!code.trim()) { alert('La sigla no puede estar vacía.'); return; }
    const upper = code.trim().toUpperCase();
    if (['L','CAP','X','PT'].includes(upper)) { alert('Esta sigla es reservada del sistema.'); return; }
    const updated = { ...variables, [slot]: { ...variables[slot], [upper]: hours } };
    try {
      await setDoc(doc(db, 'settings', 'variables'), updated);
      notify(`Sigla ${upper} agregada`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/variables');
    }
  }, [variables, notify]);

  const removeVariable = useCallback(async (slot: SlotType, code: string) => {
    if (['L','CAP','X'].includes(code)) { alert('Esta sigla es reservada del sistema.'); return; }
    if (!confirm(`¿Eliminar la sigla ${code}?`)) return;
    const newSlot = { ...variables[slot] };
    delete newSlot[code];
    const updated = { ...variables, [slot]: newSlot };
    try {
      await setDoc(doc(db, 'settings', 'variables'), updated);
      notify(`Sigla ${code} eliminada`, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/variables');
    }
  }, [variables, notify]);

  // ── Activities ──
  const addActivity = useCallback(async (activity: Partial<TrainingActivity>) => {
    if (!activity.activityName || !activity.day) {
      alert('El nombre de la actividad y el día son obligatorios.'); return;
    }
    const id = Date.now().toString();
    const newA: TrainingActivity = {
      id, month: selectedMonth, year: selectedYear,
      activityName: activity.activityName!, day: activity.day!,
      place: activity.place || '', modality: activity.modality || 'presencial',
      hours: activity.hours || 0, targetGroup: activity.targetGroup || '',
      responsible: activity.responsible || '', targetPopulation: activity.targetPopulation || '',
      files: activity.files || {}, attendees: activity.attendees || [],
      status: activity.status || 'programada', timestamp: Date.now(),
    };
    try {
      await setDoc(doc(db, 'trainingActivities', id), newA);
      notify('Actividad registrada correctamente', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `trainingActivities/${id}`);
    }
  }, [selectedMonth, selectedYear, notify]);

  const deleteActivity = useCallback(async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta actividad?')) return;
    try {
      await deleteDoc(doc(db, 'trainingActivities', id));
      notify('Actividad eliminada', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `trainingActivities/${id}`);
    }
  }, [notify]);

  // ── Service Mappings ──
  const saveServiceMappings = useCallback(async (newMappings: ServiceMapping[]) => {
    const cleaned = newMappings.map(m => ({ ...m, siglas: m.siglas.map(s => s.trim().toUpperCase()).filter(s => s !== '') }));
    try {
      await setDoc(doc(db, 'settings', 'serviceMappings'), { mappings: cleaned });
      notify('Mapeos de servicios guardados', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/serviceMappings');
    }
  }, [notify]);

  // ── Registration Requests ──
  const approveRegistration = useCallback(async (requestId: string, assignedRol: string, assignedCat: string) => {
    try {
      // Get the request data
      const reqDoc = await getDoc(doc(db, 'registrationRequests', requestId));
      if (!reqDoc.exists()) throw new Error('Solicitud no encontrada');
      const reqData = reqDoc.data() as RegistrationRequest;
      if (reqData.status !== 'pending') throw new Error('Esta solicitud ya fue procesada');

      // Find lowest available sequential ID
      const allDocs = await getDocs(collection(db, 'doctors'));
      const usedIds = new Set(
        allDocs.docs
          .map(d => parseInt(d.id))
          .filter(n => !isNaN(n) && n > 0 && n < 10000000)
      );
      let newId = 1;
      while (usedIds.has(newId)) newId++;

      // Generate credentials
      const cleanName = reqData.nombre.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '').substring(0, 5);
      const username = `${cleanName}${reqData.cedula.slice(-4)}`;
      const password = `ESE${Math.floor(1000 + Math.random() * 9000)}`;
      const now = Date.now();

      // Create the doctor
      const newDoctor: Doctor = {
        id: newId,
        nombre: `${reqData.nombre} ${reqData.apellidos}`,
        apellidos: reqData.apellidos,
        cedula: reqData.cedula,
        registroMedico: reqData.registroMedico || '',
        email: reqData.email,
        telefono: reqData.telefono || '',
        genero: reqData.genero,
        cat: assignedCat as any,
        rol: assignedRol as any,
        st: 'activo',
        username,
        password,
        passwordLastChanged: now,
        createdAt: now,
        mustChangePassword: true
      };

      await setDoc(doc(db, 'doctors', newId.toString()), newDoctor);

      // Update the request
      await updateDoc(doc(db, 'registrationRequests', requestId), {
        status: 'approved',
        reviewedAt: now,
        reviewedBy: session?.n || 'Admin',
        assignedId: newId
      });

      notify(`Médico registrado correctamente. Usuario: ${username}`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      notify(`Error: ${msg}`, 'error');
    }
  }, [session, notify, db]);

  const rejectRegistration = useCallback(async (requestId: string, reason: string) => {
    try {
      const reqDoc = await getDoc(doc(db, 'registrationRequests', requestId));
      if (!reqDoc.exists()) throw new Error('Solicitud no encontrada');

      await updateDoc(doc(db, 'registrationRequests', requestId), {
        status: 'rejected',
        rejectionReason: reason,
        reviewedAt: Date.now(),
        reviewedBy: session?.n || 'Admin'
      });

      notify('Solicitud rechazada', 'info');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      notify(`Error: ${msg}`, 'error');
    }
  }, [session, notify, db]);

  // ── Shift Requests ──
  const submitShiftRequest = useCallback(async (day: number, slot: SlotType, reason: string) => {
    if (!session?.doctorId || !reason) { alert('Por favor escriba un motivo.'); return; }
    const doctor = doctors.find(d => d.id === session.doctorId);
    if (!doctor) return;
    const id = Date.now();
    const newReq: ShiftRequest = {
      id, timestamp: id, doctorId: session.doctorId, doctorName: doctor.nombre,
      day, slot, reason, status: 'pending', targetMonth: selectedMonth, targetYear: selectedYear,
    };
    try {
      await setDoc(doc(db, 'shiftRequests', id.toString()), newReq);
      notify('Solicitud enviada a coordinación', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shiftRequests/${id}`);
    }
  }, [session, doctors, selectedMonth, selectedYear, notify]);

  const updateRequestStatus = useCallback(async (id: number, status: 'approved' | 'rejected') => {
    const req = shiftRequests.find(r => r.id === id);
    if (!req) return;
    try {
      await updateDoc(doc(db, 'shiftRequests', id.toString()), { status });
      const msg = status === 'approved'
        ? `✅ SOLICITUD APROBADA: Tu cambio para el día ${req.day} ha sido autorizado.`
        : `❌ SOLICITUD RECHAZADA: Tu solicitud para el día ${req.day} no pudo procesarse.`;
      await pushNotification(req.doctorId, msg);
      // Optional email notification
      const doctor = doctors.find(d => d.id === req.doctorId);
      if (doctor?.email) sendEmailNotification(doctor.email, `Solicitud ${status === 'approved' ? 'Aprobada' : 'Rechazada'}`, msg);
      notify(status === 'approved' ? 'Solicitud autorizada' : 'Solicitud rechazada', status === 'approved' ? 'success' : 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shiftRequests/${id}`);
    }
  }, [shiftRequests, doctors, pushNotification, sendEmailNotification, notify]);

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
    saveEditedDoctor, toggleDoctorStatus, deleteDoctor, resetDoctorPass, changePassword,
    addVariable, removeVariable,
    addActivity, deleteActivity,
    saveServiceMappings,
    registrationRequests, approveRegistration, rejectRegistration,
    submitShiftRequest, updateRequestStatus,
    isGeneratingAI, setIsGeneratingAI, aiReport, setAiReport,
    idleTimeout, setIdleTimeout
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
