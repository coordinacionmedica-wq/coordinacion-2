/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  Info,
  WifiOff
} from 'lucide-react';
import {
  Doctor,
  DoctorRole,
  MonthlyData,
  UserSession,
  SlotType,
  AvailabilityCall,
  TrainingActivity,
  ServiceMapping,
  AIEngineSettings
} from './types';
import {
  MASTER_ADMIN,
  MASTER_READER,
  MONTH_NAMES,
  STORAGE_KEYS
} from './constants';
import { GoogleGenAI } from "@google/genai";
import { 
  setDoc, 
  doc, 
  deleteDoc, 
  updateDoc
} from 'firebase/firestore';
import { 
  auth, 
  db, 
  handleFirestoreError, 
  OperationType,
  firebaseConfig
} from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithCustomToken,
  signOut
} from 'firebase/auth';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { InductionManual } from './components/InductionManual';
import { AntibioticManual } from './components/AntibioticManual';
import { HumanResourcesView } from './components/HumanResourcesView';
import { ProductivityStatsView } from './components/ProductivityStatsView';
import { AdminToolbox } from './components/AdminToolbox';
import { AppProvider } from './context/AppContext';
import { BootScreen } from './components/BootScreen';
import { LoginPage } from './components/LoginPage';
import { AppHeader } from './components/AppHeader';
import { BottomNav } from './components/BottomNav';
import { AyudaView } from './components/AyudaView';
import { DocsView } from './components/DocsView';
import { TurneroView } from './components/TurneroView';
import { HomeView } from './components/HomeView';
import { RuralView } from './components/RuralView';
import { PICView } from './components/PICView';
import { AdminView } from './components/AdminView';
import { CodigoRojoModal } from './components/CodigoRojoModal';
import { CodigoAzulModal } from './components/CodigoAzulModal';
import { AuthInboxModal } from './components/AuthInboxModal';
import { CallModal } from './components/CallModal';
import { EditDoctorModal } from './components/EditDoctorModal';
import { ActivitiesModal } from './components/ActivitiesModal';
import { SolicitudesView } from './components/SolicitudesView';
import { NovedadesView } from './components/NovedadesView';
import { AppStyles } from './components/AppStyles';
import { useAppContext } from './context/AppContext';
import { useShiftActions } from './hooks/useShiftActions';

function AppContent() {
  // ── Shared state & actions from AppContext ────────────────
  const {
    session, setSession, fbUser, isBooting, isOnline, isFirebaseUnauthenticatedAdmin,
    doctors, variables, setVariables, currentMonthData, setCurrentMonthData,
    auditLogs, shiftRequests, ruralAvailabilities, availabilityCalls,
    activities, serviceMappings, setServiceMappings, userNotifications, isMonthPublished,
    selectedMonth, setSelectedMonth, selectedYear, setSelectedYear, daysInMonth,
    notification, setNotification, notify,
    theme, setTheme, updateTheme,
    activeTab, setActiveTab,
    pushNotification, markNotificationRead, updateDoctorMonth, updateMonthlyData,
    saveEditedDoctor, toggleDoctorStatus, deleteDoctor, resetDoctorPass,
    changePassword, addVariable, removeVariable, addActivity, deleteActivity,
    saveServiceMappings, submitShiftRequest: ctxSubmitShiftRequest, updateRequestStatus,
    isGeneratingAI, setIsGeneratingAI, aiReport, setAiReport,
    idleTimeout, setIdleTimeout,
  } = useAppContext();

  const {
    assignFreeDaysToPlanta,
    approveRequest,
    rejectRequest,
  } = useShiftActions();



  const generateAISchedulingProposal = async (settings: AIEngineSettings) => {
    setIsGeneratingAI(true);
    setAiReport(null);
    try {
      const activeDoctors = doctors.filter(d => d.st === 'activo');
      const monthRequests = shiftRequests.filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear);
      const daysCount = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      
      const siglaStats = Object.entries(variables).map(([slot, map]) => `${slot.toUpperCase()}: [${Object.keys(map).join(', ')}]`).join(' | ');

      const prompt = `Actúa como un experto en logística hospitalaria y Programación Médica (Shift Scheduling).
      CONTEXTO: Generar la propuesta de turnos para ${MONTH_NAMES[selectedMonth]} ${selectedYear} (${daysCount} días).
      
      PERSONAL DISPONIBLE:
      ${activeDoctors.map(d => `- ID: ${d.id}, Nombre: ${d.nombre}, Rol: ${d.rol}, Categoría: ${d.cat}`).join('\n')}
      
      SIGLAS DISPONIBLES:
      ${siglaStats}
      
      SOLICITUDES / RESTRICCIONES PREVIAS:
      ${monthRequests.map(r => `- Dr. ${r.doctorName} (ID ${r.doctorId}) pidió ${r.slot.toUpperCase()} el día ${r.day}: ${r.reason}`).join('\n')}
      
      REGLAS INSTITUCIONALES (SHIFT ENGINE V3):
      1. Máximo noches consecutivas: ${settings.maxConsecutiveNights}
      2. Descanso mínimo entre turnos: ${settings.minRestHoursBetweenShifts}h
      3. Máximo turnos por mes por médico: ${settings.maxShiftsPerMonth}
      4. Espaciado entre fines de semana: ${settings.weekendSpacingWeeks} semanas.
      5. Mínimo fines de semana libres: ${settings.mandatoryFreeWeekends}
      6. Priorizar Rurales para Disponibilidad (D1/D2/D3): ${settings.priorityRuralD1 ? 'SÍ' : 'NO'}
      7. Bloquear Tripletes: ${settings.blockTriplets ? 'SÍ' : 'NO'}
      8. Habilitar Descanso Post-Turno (PT): ${settings.enablePostShiftRest ? 'SÍ' : 'NO'}
      ${settings.customRules ? `OTRAS REGLAS ESPECÍFICAS:\n${settings.customRules}` : ''}
      
      TAREA:
      Genera una PROPUESTA DE PROGRAMACIÓN lógica y optimizada.
      Entretén una estructura de tabla o lista clara para que el administrador pueda revisarla.
      Enfócate en cubrir los servicios críticos (Urgencias, Hospitalización).
      Indica claramente por qué tomaste ciertas decisiones (Justificación técnica).
      
      FORMATO DE SALIDA: Markdown profesional con tablas y secciones de "Razonamiento del Algoritmo".`;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAiReport(response.text || "No se pudo generar la propuesta.");
    } catch (err) {
      console.error(err);
      setAiReport("Error al generar propuesta con el Engine V3. Verifica el API Key de Gemini.");
    } finally {
      setIsGeneratingAI(false);
    }
  };
  // Form States (Admin)
  const [loginU, setLoginU] = useState('');
  const [loginP, setLoginP] = useState('');
  const [newDocName, setNewDocName] = useState('');
  const [newDocEmail, setNewDocEmail] = useState('');
  const [newDocCat, setNewDocCat] = useState<'Planta' | 'CTA' | 'APS' | 'Rural' | 'Disponibilidad'>('Planta');
  const [newDocRol, setNewDocRol] = useState<DoctorRole>('Médico General');
  const [newDocContact, setNewDocContact] = useState('');
  // Registration States
  const [showRegModal, setShowRegModal] = useState(false);
  const [regNombre, setRegNombre] = useState('');
  const [regApellidos, setRegApellidos] = useState('');
  const [regCedula, setRegCedula] = useState('');
  const [regRegistroMedico, setRegRegistroMedico] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regTelefono, setRegTelefono] = useState('');
  const [regRol, setRegRol] = useState<DoctorRole>('Médico General');
  const [generatedCreds, setGeneratedCreds] = useState<{u: string, p: string} | null>(null);

  // Authorization Inbox
  const [showAuthInbox, setShowAuthInbox] = useState(false);


  // Editing Doctor
  const [editingDoc, setEditingDoc] = useState<Doctor | null>(null);
  
  // Availability Call States
  const [showCallModal, setShowCallModal] = useState(false);
  
  // Activities states
  const [showActivitiesModal, setShowActivitiesModal] = useState(false);
  const [showCodigoRojo, setShowCodigoRojo] = useState(false);
  const [showCodigoAzul, setShowCodigoAzul] = useState(false);
  const [newActivity, setNewActivity] = useState<Partial<TrainingActivity>>({
    modality: 'presencial',
    status: 'programada',
    files: {}
  });

  const [callDay, setCallDay] = useState(new Date().getDate());
  const [callSlot, setCallSlot] = useState<SlotType>('m');
  const [callTargetId, setCallTargetId] = useState<number | null>(null);
  const [callService, setCallService] = useState('Traslado Médico');
  const [callCaller, setCallCaller] = useState('');

  // Apply dynamic theme fonts to body
  useEffect(() => {
    const fontStack = theme.font === 'serif' ? 'ui-serif, Georgia, serif' :
                     theme.font === 'mono' ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' :
                     'Inter, ui-sans-serif, system-ui, sans-serif';
    document.body.style.fontFamily = fontStack;
  }, [theme.font]);

  // Request States
  const [reqDay, setReqDay] = useState<number>(1);
  const [reqSlot, setReqSlot] = useState<SlotType>('m');
  const [reqReason, setReqReason] = useState('');

  const [showInductionManual, setShowInductionManual] = useState(false);
  const [showAntibioticManual, setShowAntibioticManual] = useState(false);

  const sendEmailNotification = async (to: string, doctorName: string, requestDetails: any, status: 'approved' | 'rejected') => {
    try {
      const subject = `Notificación de Solicitud de Cambio - ${status === 'approved' ? 'APROBADA' : 'RECHAZADA'}`;
      const statusText = status === 'approved' ? 'aprobada' : 'rechazada';
      const color = status === 'approved' ? '#059669' : '#e11d48';

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: ${color}; text-align: center;">Tu solicitud ha sido ${statusText.toUpperCase()}</h2>
          <p>Hola <strong>${doctorName}</strong>,</p>
          <p>Te informamos que tu solicitud de cambio de turno ha sido procesada por la coordinación médica.</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p><strong>Detalles de la solicitud:</strong></p>
            <ul>
              <li><strong>Día:</strong> ${requestDetails.day} de ${MONTH_NAMES[requestDetails.targetMonth]} ${requestDetails.targetYear}</li>
              <li><strong>Jornada:</strong> ${requestDetails.slot === 'm' ? 'Mañana' : requestDetails.slot === 't' ? 'Tarde' : 'Noche'}</li>
              <li><strong>Motivo:</strong> ${requestDetails.reason}</li>
              <li><strong>Estado Final:</strong> <span style="color: ${color}; font-weight: bold;">${statusText.toUpperCase()}</span></li>
            </ul>
          </div>
          
          <p>Puedes consultar más detalles iniciando sesión en el Turnero Digital.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b; text-align: center;">Este es un mensaje automático, por favor no respondas a este correo.</p>
        </div>
      `;

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          text: `Hola ${doctorName}, tu solicitud del día ${requestDetails.day} ha sido ${statusText}.`,
          html
        })
      });

      const result = await response.json();
      if (result.success) {
        console.log("Email notification sent successfully to:", to);
      } else {
        console.warn("Email could not be sent:", result.message);
      }
    } catch (error) {
      console.error("Failed to send email notification:", error);
    }
  };

  // All Firebase listeners are handled by AppContext — no duplicate subscriptions here.

  // -- Auth --
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      setNotification({ message: "Sesión de Google iniciada", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      console.error("Google Login error:", err);
      if (err.code === 'auth/unauthorized-domain') {
        const currentDomain = window.location.hostname;
        const fullUrl = window.location.origin;
        setNotification({ 
          message: `⚠️ DOMINIO NO AUTORIZADO`, 
          type: 'error' 
        });
        alert(`⚠️ ERROR DE SEGURIDAD DE FIREBASE:\n\nEl dominio "${currentDomain}" no está en la lista blanca de tu proyecto.\n\nSI NO TIENES ACCESO A LA CONSOLA:\nSolicita al administrador del sistema que añada los siguientes dominios a "Authentication > Settings > Authorized Domains":\n\n1. ${currentDomain}\n2. ais-pre-xlref7u3vswxjgd2ec2l7j-500854713267.us-west2.run.app\n\nSi tú eres el administrador, asegúrate de estar logueado con la cuenta correcta en Firebase.`);
      } else {
        alert("Error al iniciar sesión con Google: " + (err.message || String(err)));
      }
    }
  };

  const handleLogin = async () => {
    // Admin Login
    if (loginU === MASTER_ADMIN.u && loginP === MASTER_ADMIN.p) {
      const sess: UserSession = { r: 'admin', n: 'Admin General' };
      setSession(sess);
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
      return;
    }
    
    // Reader Login
    if (loginU === MASTER_READER.u) {
      const sess: UserSession = { r: 'read', n: 'Personal Invitado' };
      setSession(sess);
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
      return;
    }

    // Doctor Login via API (Secure)
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ u: loginU, p: loginP })
      });
      const result = await response.json();

      if (result.success) {
        // Sign in to Firebase with Custom Token
        if (result.customToken) {
          try {
            await signInWithCustomToken(auth, result.customToken);
          } catch (tokenErr: any) {
            console.error("Firebase custom token auth failed:", tokenErr);
            if (tokenErr.code === 'auth/unauthorized-domain') {
              const currentDomain = window.location.hostname;
              const consoleUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;
              alert(`⚠️ ERROR DE DOMINIO (Auth Token):\n\nEl dominio "${currentDomain}" no está autorizado. \n\nPara solucionar esto:\n1. Abre: ${consoleUrl}\n2. Añade el dominio: ${currentDomain}\n3. Recarga la página.`);
            }
          }
        }

        const sess = result.session;
        const expiryDays = 90;
        const lastChanged = result.passwordLastChanged || 0;
        const daysSince = (Date.now() - lastChanged) / (1000 * 60 * 60 * 24);
        
        if (daysSince > expiryDays) {
          alert("Su contraseña ha expirado (vence cada 3 meses). Por favor cámbiela inmediatamente.");
        }

        setSession(sess);
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sess));
      } else {
        alert(result.error || "Credenciales incorrectas");
      }
    } catch (err) {
      console.error("Login API error:", err);
      alert("Error de conexión con el servidor");
    }
  };

  const [lastActivity, setLastActivity] = useState(Date.now());
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);

  // Idle timer check
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diffInMinutes = (now - lastActivity) / 60000;
      const diffInSeconds = (now - lastActivity) / 1000;
      const totalSecondsAllowed = idleTimeout * 60;
      const secondsLeft = totalSecondsAllowed - diffInSeconds;

      if (secondsLeft <= 0) {
        handleLogout();
        setNotification({ message: "Sesión cerrada por inactividad.", type: 'info' });
        clearInterval(interval);
      } else if (secondsLeft <= 5) {
        setNotification({ message: `⚠️ CERRANDO SESIÓN EN ${Math.ceil(secondsLeft)} SEGUNDOS...`, type: 'error' });
      } else if (secondsLeft <= 60 && !showInactivityWarning) {
        setShowInactivityWarning(true);
        setNotification({ message: "Su sesión caducará pronto por inactividad.", type: 'info' });
      } else if (secondsLeft > 60 && showInactivityWarning) {
        setShowInactivityWarning(false);
      }
    }, 1000);

    const resetTimer = () => setLastActivity(Date.now());
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
    };
  }, [session, lastActivity, idleTimeout, showInactivityWarning]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("Sign out error:", err);
    }
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    setSession(null);
    setLoginU('');
    setLoginP('');
    setActiveTab('turnos');
  };

  // -- Admin Actions --
  const addDoctor = async () => {
    if (!newDocName) return;
    const cleanName = newDocName.toLowerCase().replace(/\s+/g, '').substring(0, 8);
    const username = `${cleanName}${Math.floor(100 + Math.random() * 900)}`;
    const password = `ESE${Math.floor(1000 + Math.random() * 9000)}`;
    const id = Date.now();

    const newDoc: Doctor = { 
      id, 
      nombre: newDocName, 
      email: newDocEmail || undefined,
      cat: newDocCat, 
      rol: newDocRol,
      st: 'activo',
      contacto: newDocContact || undefined,
      username,
      password,
      passwordLastChanged: Date.now()
    };
    
    try {
      const docRef = doc(db, 'doctors', id.toString());
      await setDoc(docRef, newDoc);
      setNewDocName('');
      setNewDocEmail('');
      setNewDocContact('');
      setNotification({ message: "Médico añadido correctamente", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      setNotification({ message: "Error crítico: No tiene permisos. Vincule Google en el banner superior.", type: 'error' });
      handleFirestoreError(err, OperationType.WRITE, `doctors/${id}`);
    }
  };

  const [isRegistering, setIsRegistering] = useState(false);

  const handleSelfRegister = async () => {
    // 1. Basic required fields check
    if (!regNombre.trim() || !regApellidos.trim() || !regEmail.trim() || !regCedula.trim()) {
      return alert("Por favor complete los campos obligatorios: Nombres, Apellidos, Correo y Cédula.");
    }
    
    // 2. Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(regEmail.trim())) {
      return alert("El formato del correo electrónico no es válido.");
    }

    // 3. Cedula numeric validation (usually 6 to 12 digits in Colombia)
    const cleanCedula = regCedula.trim();
    if (!/^\d+$/.test(cleanCedula) || cleanCedula.length < 5 || cleanCedula.length > 12) {
      return alert("La cédula debe ser un número válido (entre 5 y 12 dígitos).");
    }

    try {
      setIsRegistering(true);
      setNotification({ message: "Verificando datos...", type: 'info' });
      
      // Verify if already exists via API (since doctors list may be restricted)
      const checkRes = await fetch('/api/check-doctor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula: cleanCedula })
      });
      const checkData = await checkRes.json();
      
      if (!checkData.success) throw new Error(checkData.error);
      
      const cleanName = regNombre.trim().toLowerCase().replace(/\s+/g, '').substring(0, 5);
      const username = `${cleanName}${cleanCedula.slice(-4)}`;
      const password = `ESE${Math.floor(1000 + Math.random() * 9000)}`;

      if (checkData.exists) {
        // If doctor exists but has no credentials, we "activate" them
        if (!checkData.username) {
          const updateData = {
            username,
            password,
            passwordLastChanged: Date.now(),
            email: regEmail.trim(),
            telefono: regTelefono.trim(),
            nombre: `${regNombre.trim()} ${regApellidos.trim()}`,
            apellidos: regApellidos.trim(),
            registroMedico: regRegistroMedico.trim()
          };

          const response = await fetch('/api/register-doctor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              doctorId: checkData.id,
              doctorData: updateData,
              isUpdate: true
            })
          });

          const result = await response.json();
          if (!result.success) throw new Error(result.error);

          // Send Email Notification
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: regEmail.trim(),
              subject: 'Activación de Cuenta - Turnero HDSAR',
              text: `Hola ${regNombre}, tu cuenta ha sido activada. Usuario: ${username}, Contraseña: ${password}`,
              html: `
                <div style="font-family: sans-serif; padding: 20px; color: #334155;">
                  <h2 style="color: #059669;">¡Cuenta Activada!</h2>
                  <p>Estimado(a) <strong>${regNombre}</strong>,</p>
                  <p>Tu acceso al Turnero Digital ha sido generado con éxito.</p>
                  <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                    <p style="margin: 5px 0;"><strong>Usuario:</strong> <code style="color: #059669; font-weight: bold;">${username}</code></p>
                    <p style="margin: 5px 0;"><strong>Contraseña:</strong> <code style="color: #059669; font-weight: bold;">${password}</code></p>
                  </div>
                  <p style="font-size: 12px; color: #64748b;">Le recomendamos cambiar su contraseña en el primer inicio de sesión.</p>
                </div>
              `
            })
          }).catch(e => console.error("Email registration err:", e));

          // Auth in Firebase with Custom Token
          if (result.customToken) {
            try {
              await signInWithCustomToken(auth, result.customToken);
            } catch (tokenErr: any) {
              console.error("Firebase custom token auth failed (Activation):", tokenErr);
              if (tokenErr.code === 'auth/unauthorized-domain') {
                 console.warn("Unauthorized domain for custom token auth - session persistence limited.");
              }
            }
          }

          setGeneratedCreds({ u: username, p: password });
          setNotification({ message: "¡Cuenta activada! Sus credenciales han sido generadas.", type: 'success' });
        } else {
          // Already has an account
          alert(`Ya existe una cuenta para esta cédula. Su usuario es: ${checkData.username}`);
          setShowRegModal(false);
          setLoginU(checkData.username);
          setNotification(null);
        }
      } else {
        // Create new doctor record
        const id = Date.now();
        const newDoc: Doctor = { 
          id, 
          nombre: `${regNombre.trim()} ${regApellidos.trim()}`,
          apellidos: regApellidos.trim(),
          cedula: cleanCedula,
          registroMedico: regRegistroMedico.trim(),
          email: regEmail.trim(),
          telefono: regTelefono.trim(),
          cat: regRol === 'Médico Rural' ? 'Rural' : 'Planta',
          rol: regRol,
          st: 'activo',
          username,
          password,
          passwordLastChanged: Date.now(),
          createdAt: Date.now()
        };

        const response = await fetch('/api/register-doctor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doctorId: id,
            doctorData: newDoc,
            isUpdate: false
          })
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error);

        // Send Email Notification
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: regEmail.trim(),
            subject: 'Registro Exitoso - Turnero HDSAR',
            text: `Hola ${regNombre}, tu registro ha sido exitoso. Usuario: ${username}, Contraseña: ${password}`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; color: #334155;">
                <h2 style="color: #059669;">¡Registro Exitoso!</h2>
                <p>Estimado(a) <strong>${regNombre}</strong>,</p>
                <p>Bienvenido al sistema de Coordinación Médica HDSAR.</p>
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                  <p style="margin: 5px 0;"><strong>Usuario:</strong> <code style="color: #059669; font-weight: bold;">${username}</code></p>
                  <p style="margin: 5px 0;"><strong>Contraseña:</strong> <code style="color: #059669; font-weight: bold;">${password}</code></p>
                </div>
                <p style="font-size: 12px; color: #64748b;">Le recomendamos cambiar su contraseña en el primer inicio de sesión.</p>
              </div>
            `
          })
        }).catch(e => console.error("Email registration err:", e));

        // Auth in Firebase with Custom Token
        if (result.customToken) {
          try {
            await signInWithCustomToken(auth, result.customToken);
          } catch (tokenErr: any) {
            console.error("Firebase custom token auth failed (Registration):", tokenErr);
            if (tokenErr.code === 'auth/unauthorized-domain') {
               console.warn("Unauthorized domain for custom token auth - registration worked but persistence limited.");
            }
          }
        }

        setGeneratedCreds({ u: username, p: password });
        setNotification({ message: "¡Registro exitoso! Sus credenciales han sido generadas.", type: 'success' });
      }
    } catch (err) {
      console.error("Registration error:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setNotification({ message: `Error: ${errMsg}`, type: 'error' });
      handleFirestoreError(err, OperationType.WRITE, `doctors/registration-api`);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleBatchImportDoctors = async (importedDoctors: any[]) => {
    if (session?.r !== 'admin') return;
    
    if (!confirm(`¿Desea importar/actualizar ${importedDoctors.length} registros? Se actualizarán los datos existentes.`)) return;

    setNotification({ message: "Procesando Talento Humano...", type: 'info' });
    let successCount = 0;
    let errorCount = 0;

    for (const docData of importedDoctors) {
      try {
        const id = docData.id || Date.now() + Math.random();
        const cleanCedula = (docData.cedula || '').toString().trim();
        if (!cleanCedula || !docData.nombre) continue;

        const doctorData: Doctor = {
          id: Number(id),
          nombre: docData.nombre.toString().trim(),
          apellidos: (docData.apellidos || '').toString().trim(),
          cedula: cleanCedula,
          registroMedico: (docData.registroMedico || '').toString().trim(),
          email: (docData.email || '').toString().trim(),
          telefono: (docData.telefono || '').toString().trim(),
          cat: (docData.cat || 'Planta') as any,
          rol: (docData.rol || 'Médico General').toString().trim(),
          st: (docData.st || 'activo') as any,
          username: (docData.username || '').toString().trim(),
          password: (docData.password || '123456').toString().trim(),
          createdAt: Date.now(),
          passwordLastChanged: Date.now()
        };

        await setDoc(doc(db, 'doctors', String(id)), doctorData, { merge: true });
        successCount++;
      } catch (err) {
        console.error("Error importing doctor:", err);
        errorCount++;
      }
    }
  setNotification({ message: `Importación finalizada. Éxito: ${successCount}, Errores: ${errorCount}`, type: 'success' });
  setTimeout(() => window.location.reload(), 2000);
};

const handleSubmitShiftRequest = async () => {
  await ctxSubmitShiftRequest(reqDay, reqSlot, reqReason);
  setReqReason('');
};

  const exportShiftRequests = () => {
    if (shiftRequests.length === 0) return alert("No hay solicitudes para exportar.");
    const rows = shiftRequests.map(r => ({
      'ID': r.id,
      'Médico': r.doctorName,
      'Día': r.day,
      'Jornada': r.slot === 'm' ? 'Mañana' : r.slot === 't' ? 'Tarde' : 'Noche',
      'Motivo': r.reason,
      'Estado': r.status === 'pending' ? 'Pendiente' : r.status === 'approved' ? 'Aprobada' : 'Rechazada',
      'Mes': MONTH_NAMES[r.targetMonth],
      'Año': r.targetYear,
      'Fecha': new Date(r.timestamp).toLocaleDateString('es-CO')
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Solicitudes");
    XLSX.writeFile(wb, `Solicitudes_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xlsx`);
  };

  const downloadTemplateExcel = () => {
    const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
    const headers = [['MÉDICO', 'JORNADA', ...days]];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Turnero');
    XLSX.writeFile(wb, `Plantilla_Turnero_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xlsx`);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        const headers = rows[0] as string[];
        const newData: MonthlyData = { ...currentMonthData };
        for (let ri = 1; ri < rows.length; ri++) {
          const row = rows[ri];
          const doctorName = row[0]?.toString().trim();
          const slotStr = row[1]?.toString().trim()?.toLowerCase();
          if (!doctorName || !slotStr) continue;
          const doctor = doctors.find(d => d.nombre.toLowerCase().includes(doctorName.toLowerCase()));
          if (!doctor) continue;
          const slot: SlotType = slotStr.startsWith('ma') ? 'm' : slotStr.startsWith('ta') ? 't' : 'n';
          if (!newData[doctor.id]) newData[doctor.id] = { m: {}, t: {}, n: {} };
          for (let ci = 2; ci < headers.length; ci++) {
            const day = parseInt(headers[ci]);
            if (isNaN(day)) continue;
            const value = row[ci]?.toString().trim().toUpperCase();
            if (value) newData[doctor.id][slot][day] = value;
          }
        }
        await updateMonthlyData(newData);
        setNotification({ message: "Turnero importado correctamente", type: 'success' });
        setTimeout(() => setNotification(null), 3000);
      } catch (err) {
        console.error("Import error:", err);
        setNotification({ message: "Error al importar Excel", type: 'error' });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const exportPICExcel = () => {
    const currentActivities = activities.filter(a => a.month === selectedMonth && a.year === selectedYear);
    if (currentActivities.length === 0) return alert("No hay actividades para exportar.");

    const rows = currentActivities.map(a => ({
      'Día': a.day,
      'Actividad': a.activityName,
      'Lugar': a.place,
      'Modalidad': a.modality,
      'Horas': a.hours,
      'Responsable': a.responsible,
      'Dirigida a': a.targetGroup,
      'Población': a.targetPopulation,
      'Estado': a.status
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PIC_" + MONTH_NAMES[selectedMonth]);
    XLSX.writeFile(wb, `PIC_Capacitaciones_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xlsx`);
  };

  const exportPICPDF = () => {
    const currentActivities = activities.filter(a => a.month === selectedMonth && a.year === selectedYear);
    if (currentActivities.length === 0) return alert("No hay actividades para exportar.");

    const doc = new jsPDF('l', 'pt', 'a4');
    
    // Header
    doc.setFillColor(245, 158, 11); // Amber-500
    doc.rect(0, 0, 842, 60, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("PIC - PROGRAMA INSTITUCIONAL DE CAPACITACIONES", 40, 38);
    
    doc.setFontSize(10);
    doc.text(`PLAN DE CAPACITACIÓN HDSAR - ${MONTH_NAMES[selectedMonth].toUpperCase()} ${selectedYear}`, 40, 52);
    
    const tableData = currentActivities.sort((a, b) => a.day - b.day).map(a => [
      a.day,
      a.activityName,
      a.place,
      a.modality.toUpperCase(),
      a.hours,
      a.responsible,
      a.targetGroup,
      a.targetPopulation
    ]);

    (doc as any).autoTable({
      startY: 80,
      head: [['DÍA', 'ACTIVIDAD', 'LUGAR', 'MODALIDAD', 'H', 'RESPONSABLE', 'DIRIGIDA A', 'POBLACIÓN']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 150 },
        2: { cellWidth: 80 },
        3: { cellWidth: 70 },
        4: { cellWidth: 20 },
        5: { cellWidth: 100 },
        6: { cellWidth: 100 },
        7: { cellWidth: 100 }
      },
      margin: { top: 80 }
    });

    doc.save(`PIC_${MONTH_NAMES[selectedMonth]}_${selectedYear}.pdf`);
  };

  const handleSaveEditedDoctor = async () => {
    if (!editingDoc) return;
    await saveEditedDoctor(editingDoc);
    setEditingDoc(null);
  };

  const handleAddActivity = async () => {
    await addActivity(newActivity);
    setNewActivity({ modality: 'presencial', status: 'programada', files: {} });
  };


  const isAdminUser = session?.r === 'admin';
  const isSignedInUser = !!fbUser;

  const handleCallAvailability = async () => {
    let targetDocId = callTargetId;
    if (!targetDocId) {
      // Find the first available if not selected
      Object.keys(currentMonthData).forEach(id => {
        const sigla = currentMonthData[Number(id)]?.[callSlot]?.[callDay] || 'X';
        if (sigla.startsWith('D')) {
          targetDocId = Number(id);
        }
      });
    }

    if (!targetDocId) {
      return alert("No se encontró ningún asistencial en Disponibilidad para este horario.");
    }

    if (!callService) {
      return alert("Por favor indique el servicio o labor administrativa.");
    }

    const docData = doctors.find(d => d.id === targetDocId);
    if (!docData) return;

    if (!confirm(`¿Confirmar llamado a Disponibilidad para: ${docData.nombre}?`)) return;

    const callId = Date.now().toString();
    const newCall: AvailabilityCall = {
      id: callId,
      timestamp: Date.now(),
      doctorId: docData.id,
      doctorName: docData.nombre,
      callerName: callCaller || session?.n || 'Personal Saliente',
      service: callService,
      day: callDay,
      slot: callSlot,
      month: selectedMonth,
      year: selectedYear
    };

    if (docData.telefono) {
      const cleanPhone = docData.telefono.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        const text = encodeURIComponent(`🚨 LLAMADO DISPONIBILIDAD: ${callService.toUpperCase()}. Turno: ${callSlot.toUpperCase()}. Dr. ${docData.nombre}. Llamado por: ${newCall.callerName}`);
        window.open(`https://wa.me/57${cleanPhone}?text=${text}`, '_blank');
      }
    }

    try {
      await setDoc(doc(db, 'availabilityCalls', callId), newCall);
      await pushNotification(docData.id, `🚨 LLAMADO DISPONIBILIDAD: ${callService}. Por favor presentarse.`);
      
      setNotification({ message: `Llamado registrado con éxito`, type: 'success' });
      setShowCallModal(false);
      setCallService('');
      setCallCaller('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `availabilityCalls/${callId}`);
    }
  };

  const exportNovedadesExcel = () => {
    const filteredLogs = auditLogs.filter(log => log.targetMonth === selectedMonth && log.targetYear === selectedYear);
    if (filteredLogs.length === 0) return alert("No hay novedades para este mes.");

    const rows = filteredLogs.map(log => ({
      'Fecha': new Date(log.timestamp).toLocaleString(),
      'Médico': log.doctorName,
      'Día': log.day,
      'Jornada': log.slot.toUpperCase(),
      'Anterior': log.oldSigla,
      'Nuevo': log.newSigla,
      'Autor': log.adminName
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Novedades");
    XLSX.writeFile(wb, `Reporte_Novedades_${MONTH_NAMES[selectedMonth]}_${selectedYear}.xlsx`);
  };

  const exportNovedadesPDF = () => {
    const filteredLogs = auditLogs.filter(log => log.targetMonth === selectedMonth && log.targetYear === selectedYear);
    if (filteredLogs.length === 0) return alert("No hay novedades para este mes.");

    const doc = new jsPDF('p', 'pt', 'a4');
    doc.setFillColor(5, 150, 105); // Emerald-600
    doc.rect(0, 0, 595, 60, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE MENSUAL DE NOVEDADES", 40, 38);
    
    doc.setFontSize(10);
    doc.text(`ESE ROLDANILLO - ${MONTH_NAMES[selectedMonth].toUpperCase()} ${selectedYear}`, 40, 52);
    
    const tableData = filteredLogs.map(log => [
      new Date(log.timestamp).toLocaleDateString(),
      log.doctorName,
      log.day,
      log.slot.toUpperCase(),
      log.oldSigla,
      log.newSigla,
      log.adminName
    ]);

    (doc as any).autoTable({
      startY: 80,
      head: [['FECHA', 'MÉDICO', 'DÍA', 'SLOT', 'ANT.', 'NUEV.', 'AUTOR']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], fontSize: 8 },
      bodyStyles: { fontSize: 8 }
    });

    doc.save(`Novedades_${MONTH_NAMES[selectedMonth]}_${selectedYear}.pdf`);
  };

  const generateAIStatsReport = async () => {
    setIsGeneratingAI(true);
    setAiReport(null);

    try {
      const daysCount = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      
      // 1. Capacidad Instalada
      let usedSlots = 0;
      let totalHours = 0;
      const activeDoctors = doctors.filter(d => d.st === 'activo');
      const totalPossibleSlots = activeDoctors.length * daysCount * 3;
      
      // Area Breakdown
      const areaStats: Record<string, number> = {
        'Urgencias': 0,
        'Hospitalización': 0,
        'Cirugía': 0,
        'Consulta Externa': 0,
        'Triage': 0,
        'Otros': 0
      };

      activeDoctors.forEach(doc => {
        ['m', 't', 'n'].forEach(slot => {
          for (let d = 1; d <= daysCount; d++) {
            const sigla = currentMonthData[doc.id]?.[slot as SlotType]?.[d];
            if (sigla && sigla !== 'X' && sigla !== 'DESC' && sigla !== 'PT') {
              usedSlots++;
              const h = variables[slot as SlotType]?.[sigla] || 0;
              totalHours += h;
              
              // Map to area (heuristics based on common siglas)
              const s = sigla.toUpperCase();
              if (s.includes('CX')) areaStats['Cirugía']++;
              else if (s === 'EXT' || s.startsWith('CE')) areaStats['Consulta Externa']++;
              else if (s === 'TR' || (doc.rol === 'Triage')) areaStats['Triage']++;
              else if (s === 'H' || s.startsWith('12')) areaStats['Hospitalización']++;
              else if (['M', 'T', 'N', '10', '11', '13', '14', '15', '16'].some(x => s.startsWith(x))) areaStats['Urgencias']++;
              else areaStats['Otros']++;
            }
          }
        });
      });

      // 2. Indicadores de Capacitación
      const monthActivities = activities.filter(a => a.month === selectedMonth && a.year === selectedYear);
      const planned = monthActivities.length;
      const completed = monthActivities.filter(a => a.status === 'realizada').length;
      const canceled = monthActivities.filter(a => a.status === 'cancelada').length;

      // 3. Indicadores de Uso
      const monthLogs = auditLogs.filter(l => l.targetMonth === selectedMonth && l.targetYear === selectedYear);
      const ruralReports = ruralAvailabilities.filter(r => r.targetMonth === selectedMonth && r.targetYear === selectedYear);

      const prompt = `Actúa como un experto en analítica hospitalaria. Analiza los siguientes indicadores del mes de ${MONTH_NAMES[selectedMonth]} ${selectedYear}:
      
      ESTADÍSTICAS OPERATIVAS:
      - Capacidad Instalada (Slots usados / totales): ${usedSlots} / ${totalPossibleSlots} (${((usedSlots/totalPossibleSlots)*100).toFixed(1)}%)
      - Horas totales asistenciales: ${totalHours}h
      
      DISTRIBUCIÓN POR ÁREAS (Servicios):
      - Urgencias: ${areaStats['Urgencias']} turnos
      - Hospitalización: ${areaStats['Hospitalización']} turnos
      - Cirugía: ${areaStats['Cirugía']} turnos
      - Triage: ${areaStats['Triage']} turnos
      - Consulta Externa: ${areaStats['Consulta Externa']} turnos
      
      CALIDAD Y CAPACITACIÓN (PIC):
      - Actividades Programadas: ${planned}
      - Actividades Realizadas: ${completed} (${planned > 0 ? ((completed/planned)*100).toFixed(1) : 0}%)
      - Actividades Canceladas: ${canceled}
      
      INDICADORES DE USO DE LA APP:
      - Cambios/Novedades registrados: ${monthLogs.length}
      - Reportes de disponibilidad rural: ${ruralReports.length}
      - Médicos activos participando: ${activeDoctors.length}

      Genera un análisis estadístico gerencial estructurado que:
      1. Evalúe la EFICIENCIA de la capacidad instalada.
      2. Muestre el CUMPLIMIENTO del plan de capacitaciones (PIC).
      3. Analice la ADOPCIÓN TECNOLÓGICA basada en el uso de la app.
      4. Identifique posibles cuellos de botella en servicios específicos (Urgencias vs otros).
      
      Usa un tono directivo, formal y enfocado en indicadores. Solo usa negritas y viñetas.`;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAiReport(response.text || "No se pudo generar el reporte.");
    } catch (err) {
      console.error(err);
      setAiReport("Error al generar reporte IA.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const generateAICapacityReport = async (period: 'semanal' | 'quincenal' | 'mensual') => {
    setIsGeneratingAI(true);
    setAiReport(null);

    try {
      const days = period === 'semanal' ? Array.from({length: 7}, (_, i) => i + 1) :
                   period === 'quincenal' ? Array.from({length: 15}, (_, i) => i + 1) :
                   Array.from({length: daysInMonth}, (_, i) => i + 1);

      // Calculate Metrics
      let totalHours = 0;
      const hoursByCat: Record<string, number> = { Planta: 0, CTA: 0, APS: 0 };
      const workload: Record<string, number> = {};
      let usedSlots = 0;
      const totalPossibleDocSlots = doctors.filter(d => d.st === 'activo').length * days.length * 3;

      days.forEach(day => {
        doctors.forEach(doc => {
          if (doc.st !== 'activo') return;
          ['m', 't', 'n'].forEach(slot => {
            const sigla = currentMonthData[doc.id]?.[slot as SlotType]?.[day];
            if (sigla && sigla !== 'X' && sigla !== 'DESC') {
              const h = variables[slot as SlotType]?.[sigla] || 0;
              totalHours += h;
              hoursByCat[doc.cat] += h;
              workload[doc.nombre] = (workload[doc.nombre] || 0) + h;
              usedSlots++;
            }
          });
        });
      });

      const topWorkload = Object.entries(workload)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([n, h]) => `${n}: ${h}h`)
        .join(', ');

      const prompt = `Analiza la capacidad instalada y el talento humano de un hospital para el periodo ${period} de ${MONTH_NAMES[selectedMonth]} ${selectedYear}.
      Datos:
      - Horas totales programadas: ${totalHours}h
      - Distribución por categoría: Planta (${hoursByCat.Planta}h), CTA (${hoursByCat.CTA}h), APS (${hoursByCat.APS}h)
      - Cobertura de turnos asignados: ${((usedSlots / (days.length * 3)) * 100).toFixed(1)}% (basado en slots m/t/n requeridos)
      - Médicos con mayor carga: ${topWorkload}
      - Total médicos activos: ${doctors.filter(d => d.st === 'activo').length}

      Genera un reporte gerencial conciso en español que incluya:
      1. Resumen de capacidad (¿Estamos sobrecargados o hay subutilización?)
      2. Análisis de riesgos (¿Pocas horas en alguna categoría? ¿Concentración de carga?)
      3. Recomendaciones estratégicas para la Coordinación Médica.
      Utiliza un tono profesional y directo. No uses Markdown excesivo, solo negritas y puntos.`;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAiReport(response.text || "No se pudo generar el reporte.");
    } catch (err) {
      console.error(err);
      setAiReport("Error al contactar con la IA. Verifica tu conexión.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const generateAIServiceReport = async () => {
    setIsGeneratingAI(true);
    setAiReport(null);

    try {
      const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const activeDoctors = doctors.filter(d => d.st === 'activo');
      
      // 1. Calculate stats per service
      const serviceStats: Record<string, { hours: number, shifts: number, slotsByDay: number[] }> = {};
      serviceMappings.forEach(m => {
        serviceStats[m.name] = { hours: 0, shifts: 0, slotsByDay: new Array(daysInMonth).fill(0) };
      });
      serviceStats['Otros'] = { hours: 0, shifts: 0, slotsByDay: new Array(daysInMonth).fill(0) };

      let globalTotalHours = 0;
      let globalUsedSlots = 0;

      activeDoctors.forEach(doc => {
        (['m', 't', 'n'] as SlotType[]).forEach(slot => {
          for (let d = 1; d <= daysInMonth; d++) {
            const sigla = currentMonthData[doc.id]?.[slot]?.[d];
            if (sigla && sigla !== 'X' && sigla !== 'DESC' && sigla !== 'PT') {
              const h = variables[slot][sigla] || 0;
              globalTotalHours += h;
              globalUsedSlots++;

              const mapping = serviceMappings.find(m => m.siglas.some(s => s.trim().toUpperCase() === sigla.trim().toUpperCase()));
              if (mapping) {
                serviceStats[mapping.name].hours += h;
                serviceStats[mapping.name].shifts++;
                serviceStats[mapping.name].slotsByDay[d-1]++;
              } else {
                serviceStats['Otros'].hours += h;
                serviceStats['Otros'].shifts++;
                serviceStats['Otros'].slotsByDay[d-1]++;
              }
            }
          }
        });
      });

      // Analyzed Occupation Patterns (Busy days vs Quiet days)
      const serviceDetails = Object.entries(serviceStats).map(([name, stats]) => {
        const peakDay = stats.slotsByDay.indexOf(Math.max(...stats.slotsByDay)) + 1;
        const avgShiftsPerDay = (stats.shifts / daysInMonth).toFixed(2);
        return `- **${name}**: ${stats.hours}h totales, ${stats.shifts} turnos. (Promedio diario: ${avgShiftsPerDay} turnos. Pico: Día ${peakDay})`;
      }).join('\n');

      const totalCapacityPossible = activeDoctors.length * daysInMonth * 3; // Max theoretical slots
      const totalHoursCapacity = activeDoctors.length * 240; // Rough theoretical max hours (if 240 is full time)
      
      const prompt = `Actúa como un Consultor de Gerencia Hospitalaria. Analiza los datos de servicios del mes de ${MONTH_NAMES[selectedMonth]} ${selectedYear}:

ESTADÍSTICAS POR SERVICIO:
${serviceDetails}

DATOS GLOBALES:
- Total Médicos Activos: ${activeDoctors.length}
- Horas Totales Ejecutadas: ${globalTotalHours}h
- Slots Totales Utilizados: ${globalUsedSlots} de ${totalCapacityPossible} (${((globalUsedSlots/totalCapacityPossible)*100).toFixed(1)}% de ocupación teórica)
- Novedades/Cambios: ${auditLogs.filter(l => l.targetMonth === selectedMonth).length}

INSTRUCCIONES:
Genera un INFORME GERENCIAL DE CAPACIDAD Y SERVICIOS que incluya:
1. ANÁLISIS DE OCUPACIÓN: Evalúa si la distribución de carga es equilibrada entre servicios.
2. PATRONES DE USO: Identifica días de mayor congestión y servicios con mayor demanda de talento humano.
3. CAPACIDAD INSTALADA: Analiza si el recurso médico actual es suficiente o si hay subutilización/sobrecarga crítica.
4. RECOMENDACIONES ESTRATÉGICAS: 3 acciones concretas para mejorar la eficiencia operativa y cobertura.

Usa un tono directivo, formal y conciso en español. Solo usa negritas y viñetas para estructurar la información.`;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview", // Use Pro for more complex analysis
        contents: prompt,
      });

      setAiReport(response.text || "No se pudo generar el reporte.");
    } catch (err) {
      console.error(err);
      setAiReport("Error al generar análisis de servicios. Intente nuevamente.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // -- Calculations --
  const globalTotalHours = useMemo(() => {
    let total = 0;
    Object.keys(currentMonthData).forEach(docId => {
      const docShifts = currentMonthData[Number(docId)];
      (['m', 't', 'n'] as SlotType[]).forEach(slot => {
        if (docShifts[slot]) {
          Object.values(docShifts[slot]).forEach(sigla => {
            total += variables[slot][sigla] || 0;
          });
        }
      });
    });
    return total;
  }, [currentMonthData, variables]);

  if (isBooting) return <BootScreen />;

  if (!session) return <LoginPage />;

  {/* LoginPage extracted to components/LoginPage.tsx */}


  return (
    <div className={`bg-stone-50 min-h-screen text-slate-800 flex flex-col font-sans transition-all duration-500`} style={{ '--primary': theme.primary } as any}>
      <AppStyles theme={theme} />
      {/* Offline Alert */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-orange-500 text-white text-[10px] uppercase font-black py-1 px-4 flex items-center justify-center gap-2 overflow-hidden sticky top-0 z-[60]"
          >
            <WifiOff className="w-3 h-3" />
            Modo Offline: Los cambios se sincronizarán cuando vuelvas a tener conexión
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 20 }}
            exit={{ opacity: 0, y: -50 }}
            onClick={() => setNotification(null)}
            className={`cursor-pointer fixed top-4 left-1/2 -translate-x-1/2 z-[100] ${
              notification.type === 'error' ? 'bg-rose-600' : 
              notification.type === 'info' ? 'bg-sky-600' : 'bg-emerald-600'
            } text-white px-6 py-3 rounded-2xl font-bold shadow-2xl flex items-center gap-3`}
          >
            {notification.type === 'success' ? <Bell className="w-5 h-5 animate-bounce" /> : <Info className="w-5 h-5" />}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>
      
      <AppHeader isAdminUser={isAdminUser} showAuthInbox={() => setShowAuthInbox(true)} />

      {/* Main Content */}
      <main className="flex-1 max-w-[100vw] overflow-x-hidden p-4 pb-24 md:pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <HomeView
              globalTotalHours={globalTotalHours}
              onShowCodigoRojo={() => setShowCodigoRojo(true)}
              onShowCodigoAzul={() => setShowCodigoAzul(true)}
              onGenerateAIStats={generateAIStatsReport}
            />
          )}

          {activeTab === 'ayuda' && <AyudaView />}

          {activeTab === 'stats' && (
            <motion.div 
               key="stats"
               initial={{ opacity: 0, x: 10 }} 
               animate={{ opacity: 1, x: 0 }} 
               exit={{ opacity: 0, x: -10 }}
               className="max-w-7xl mx-auto"
            >
              <div className="flex justify-between items-center mb-8 bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                <div>
                   <h2 className="text-3xl font-black text-slate-800">Análisis de Productividad</h2>
                   <p className="text-sm text-slate-500">Visualización avanzada de carga laboral por servicio y médico</p>
                </div>
                <div className="flex gap-4">
                  <select 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 font-bold outline-none focus:border-emerald-500"
                  >
                    {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                  <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 font-bold outline-none focus:border-emerald-500"
                  >
                    {Array.from({ length: 10 }, (_, i) => 2026 + i).map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              <ProductivityStatsView 
                doctors={doctors}
                currentMonthData={currentMonthData}
                variables={variables}
                serviceMappings={serviceMappings}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
              />
            </motion.div>
          )}

          {activeTab === 'turnos' && (
            <TurneroView onOpenCallModal={() => setShowCallModal(true)} onDownloadTemplate={downloadTemplateExcel} onImportExcel={handleImportExcel} globalTotalHours={globalTotalHours} />
          )}

          {activeTab === 'pic' && (
            <PICView
              newActivity={newActivity}
              setNewActivity={setNewActivity}
              onAddActivity={handleAddActivity}
              onExportExcel={exportPICExcel}
              onExportPDF={exportPICPDF}
            />
          )}

          {activeTab === 'toolbox' && session.r === 'admin' && (
            <motion.div 
              key="toolbox"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-5xl mx-auto"
            >
               <AdminToolbox 
                 onNotify={(msg, type) => setNotification({message: msg, type})}
                 variables={variables}
                 doctors={doctors}
                 onGenerateProposal={generateAISchedulingProposal}
                 isGenerating={isGeneratingAI}
                 selectedMonth={selectedMonth}
                 selectedYear={selectedYear}
               />
            </motion.div>
          )}

          {activeTab === 'solicitudes' && (
            <SolicitudesView
              session={session}
              daysInMonth={daysInMonth}
              reqDay={reqDay}
              setReqDay={setReqDay}
              reqSlot={reqSlot}
              setReqSlot={setReqSlot}
              reqReason={reqReason}
              setReqReason={setReqReason}
              onSubmit={handleSubmitShiftRequest}
              shiftRequests={shiftRequests}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onExport={exportShiftRequests}
              onUpdateStatus={updateRequestStatus as any}
            />
          )}

          {activeTab === 'rural' && <RuralView />}

          {activeTab === 'novedades' && (
            <NovedadesView
              session={session}
              monthName={MONTH_NAMES[selectedMonth]}
              selectedYear={selectedYear}
              auditLogs={auditLogs}
              selectedMonth={selectedMonth}
              onExportExcel={exportNovedadesExcel}
              onExportPDF={exportNovedadesPDF}
              onGenerateAI={generateAIStatsReport}
              isGeneratingAI={isGeneratingAI}
              aiReport={aiReport}
              setAiReport={setAiReport}
              onPushNotification={pushNotification}
            />
          )}

          {activeTab === 'bd' && (
            <motion.div
              key="bd"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <HumanResourcesView
                doctors={doctors}
                currentMonthData={currentMonthData}
                variables={variables}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                isAdmin={session?.r === 'admin'}
                onUpdateDoctorStatus={async (id, st) => {
                  if(!confirm(`¿Desea cambiar el estado a ${st.toUpperCase()}?`)) return;
                  try {
                    await updateDoc(doc(db, 'doctors', id.toString()), { st });
                  } catch (e) {
                    handleFirestoreError(e, OperationType.WRITE, `doctors/${id}`);
                  }
                }}
                onEditDoctor={(docData) => {
                  setEditingDoc(docData);
                }}
                onAddDoctorClick={() => {
                  const cleanName = 'nuevo_usuario';
                  const username = `${cleanName}${Math.floor(100 + Math.random() * 900)}`;
                  const password = `ESE${Math.floor(1000 + Math.random() * 9000)}`;
                  setEditingDoc({
                    id: Date.now(),
                    nombre: '',
                    cat: 'Planta',
                    rol: 'Médico General',
                    st: 'activo',
                    username,
                    password,
                    permissions: [],
                    createdAt: Date.now()
                  });
                }}
                onUpdateDoctorPermissions={async (id, perms) => {
                  try {
                    await updateDoc(doc(db, 'doctors', id.toString()), { permissions: perms });
                  } catch (e) {
                    handleFirestoreError(e, OperationType.WRITE, `doctors/${id}/permissions`);
                  }
                }}
                onImportDoctors={handleBatchImportDoctors}
              />
            </motion.div>
          )}

          {activeTab === 'docs' && (
            <DocsView
              onShowAntibioticManual={() => setShowAntibioticManual(true)}
              onShowInductionManual={() => setShowInductionManual(true)}
            />
          )}

          {activeTab === 'admin' && session.r === 'admin' && (
            <AdminView
              onDownloadTemplate={downloadTemplateExcel}
              onImportExcel={handleImportExcel}
              onAddDoctor={addDoctor}
              onEditDoctor={(doc) => setEditingDoc(doc)}
              onGenerateCapacityReport={generateAICapacityReport}
              onGenerateServiceReport={generateAIServiceReport}
              assignFreeDaysToPlanta={assignFreeDaysToPlanta}
              newDocName={newDocName}
              setNewDocName={setNewDocName}
              newDocEmail={newDocEmail}
              setNewDocEmail={setNewDocEmail}
              newDocContact={newDocContact}
              setNewDocContact={setNewDocContact}
              newDocCat={newDocCat}
              setNewDocCat={setNewDocCat}
              newDocRol={newDocRol}
              setNewDocRol={setNewDocRol}
            />
          )}
        </AnimatePresence>
      </main>

      <BottomNav />

      {editingDoc && (
        <EditDoctorModal
          doctor={editingDoc}
          onChange={setEditingDoc}
          onSave={handleSaveEditedDoctor}
          onCancel={() => setEditingDoc(null)}
        />
      )}
      <AuthInboxModal
        isOpen={showAuthInbox}
        onClose={() => setShowAuthInbox(false)}
        requests={shiftRequests}
        doctors={doctors}
        onApprove={(id) => {
          const req = shiftRequests.find(r => r.id === id);
          if (req) approveRequest(req.id.toString(), req.doctorId, req.day, req.slot);
        }}
        onReject={(id) => {
          const req = shiftRequests.find(r => r.id === id);
          if (req) rejectRequest(req.id.toString(), req.doctorId, req.day, req.slot);
        }}
      />
      {/* Modal Components */}
      <InductionManual 
        isOpen={showInductionManual} 
        onClose={() => setShowInductionManual(false)} 
      />
      <AntibioticManual
        isOpen={showAntibioticManual}
        onClose={() => setShowAntibioticManual(false)}
      />

      {/* Availability Call Modal */}
      <CallModal
        isOpen={showCallModal}
        onClose={() => setShowCallModal(false)}
        callDay={callDay}
        setCallDay={setCallDay}
        callSlot={callSlot}
        setCallSlot={setCallSlot}
        callTargetId={callTargetId}
        setCallTargetId={setCallTargetId}
        callService={callService}
        setCallService={setCallService}
        callCaller={callCaller}
        setCallCaller={setCallCaller}
        daysInMonth={daysInMonth}
        currentMonthData={currentMonthData}
        doctors={doctors}
        sessionName={session?.n}
        onConfirm={handleCallAvailability}
      />

      <ActivitiesModal
        isOpen={showActivitiesModal}
        onClose={() => setShowActivitiesModal(false)}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        monthName={MONTH_NAMES[selectedMonth]}
        newActivity={newActivity}
        setNewActivity={setNewActivity}
        onAdd={handleAddActivity}
        activities={activities}
        onDelete={deleteActivity}
        onExportExcel={exportPICExcel}
        onExportPDF={exportPICPDF}
      />

      <CodigoRojoModal isOpen={showCodigoRojo} onClose={() => setShowCodigoRojo(false)} />

      <CodigoAzulModal isOpen={showCodigoAzul} onClose={() => setShowCodigoAzul(false)} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
