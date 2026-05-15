import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, X, CheckCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export function LoginPage() {
  const { handleLogin, handleGoogleLogin, fbUser } = useAppContext();

  const [loginU, setLoginU] = useState('');
  const [loginP, setLoginP] = useState('');
  const [showRegModal, setShowRegModal] = useState(false);
  const [generatedCreds, setGeneratedCreds] = useState<{ u: string; p: string } | null>(null);

  // Registration form state
  const [regNombre, setRegNombre] = useState('');
  const [regApellidos, setRegApellidos] = useState('');
  const [regCedula, setRegCedula] = useState('');
  const [regRegistroMedico, setRegRegistroMedico] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regTelefono, setRegTelefono] = useState('');
  const [regRol, setRegRol] = useState('Médico General');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSelfRegister = async () => {
    if (!regNombre || !regApellidos || !regCedula || !regEmail) {
      return alert("Por favor complete todos los campos obligatorios.");
    }
    setIsRegistering(true);
    try {
      const res = await fetch('/api/register-doctor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: `${regNombre} ${regApellidos}`,
          apellidos: regApellidos,
          cedula: regCedula,
          registroMedico: regRegistroMedico,
          email: regEmail,
          telefono: regTelefono,
          rol: regRol
        })
      });
      if (!res.ok) throw new Error('Registration failed');
      const data = await res.json();
      setGeneratedCreds({ u: data.username, p: data.password });
    } catch (err) {
      alert("Error al registrar. Intente nuevamente.");
    } finally {
      setIsRegistering(false);
    }
  };

  const doLogin = () => handleLogin(loginU, loginP);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 md:p-10 rounded-[32px] border border-emerald-100 w-full max-w-md text-center shadow-2xl relative my-4 md:my-8"
      >
        <div className="flex justify-center mb-6">
          <div className="bg-emerald-50 p-4 rounded-full border border-emerald-100">
            <ShieldCheck className="w-10 h-10 text-emerald-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-emerald-700 mb-8 uppercase tracking-widest">COORDINACION MEDICA HDSAR</h2>
        
        {fbUser && (
          <div className="mb-6 flex items-center justify-center gap-2 bg-emerald-50/50 py-2 px-4 rounded-full border border-emerald-100/50">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[9px] uppercase font-black text-emerald-600/70 tracking-widest">
              Acceso Cifrado y Protegido
            </span>
          </div>
        )}

        <div className="space-y-4">
          <input 
            type="text" 
            placeholder="Usuario / ID" 
            className="w-full bg-stone-50 border border-slate-200 text-slate-800 p-4 rounded-xl outline-none focus:border-emerald-500 transition-colors font-bold"
            value={loginU}
            onChange={(e) => setLoginU(e.target.value)}
          />
          <input 
            type="password" 
            placeholder="Contraseña" 
            className="w-full bg-stone-50 border border-slate-200 text-slate-800 p-4 rounded-xl outline-none focus:border-emerald-500 transition-colors font-bold"
            value={loginP}
            onChange={(e) => setLoginP(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doLogin()}
          />
          <button 
            onClick={doLogin}
            className="w-full bg-emerald-600 text-white p-4 rounded-xl font-black text-lg shadow-xl shadow-emerald-500/20 active:scale-95 transition-transform"
          >
            ACCEDER AL SISTEMA
          </button>

          <button 
            onClick={() => setShowRegModal(true)}
            className="w-full bg-emerald-50 text-emerald-700 p-4 rounded-xl font-bold border border-emerald-100 hover:bg-emerald-100 transition-colors"
          >
            REGISTRAR TALENTO HUMANO
          </button>

          <a 
            href="https://wa.me/573173683886" 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-6 flex items-center justify-center gap-2 text-emerald-700 font-bold bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50 hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className="w-6 h-6 text-emerald-500">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.472-1.761-1.645-2.06-.173-.298-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <div className="text-left">
              <span className="block text-[10px] uppercase text-emerald-600/70">Contacto Coordinador</span>
              <span>+57 317 3683886</span>
            </div>
          </a>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest"><span className="bg-white px-4 text-slate-400">O acceder con</span></div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            className="w-full bg-white border border-slate-200 text-slate-800 p-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            CONTINUAR CON GOOGLE
          </button>
        </div>
        <p className="text-[10px] text-slate-500 mt-8 tracking-widest uppercase font-mono">Consolidado 2026</p>
      </motion.div>

      {/* Registration Modal */}
      <AnimatePresence>
        {showRegModal && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[200] flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-white w-full h-full sm:h-auto sm:max-w-2xl sm:rounded-[40px] shadow-2xl p-6 sm:p-10 border-0 sm:border sm:border-emerald-100 relative flex flex-col pt-20 sm:pt-10"
            >
              <button 
                onClick={() => { setShowRegModal(false); setGeneratedCreds(null); }}
                className="absolute top-6 right-6 p-3 bg-slate-100/50 hover:bg-rose-50 rounded-full text-slate-400 hover:text-rose-600 transition-all active:scale-90 z-[210] flex items-center gap-2 group"
              >
                <span className="text-[10px] uppercase font-black tracking-widest hidden sm:inline group-hover:inline">Cancelar</span>
                <X className="w-6 h-6" />
              </button>

              {generatedCreds ? (
                <div className="text-center py-10 space-y-6">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-emerald-600" />
                  </div>
                  <h2 className="text-3xl font-black text-slate-800">¡Registro Exitoso!</h2>
                  <p className="text-slate-500">Sus credenciales han sido enviadas a <span className="font-bold text-emerald-600">{regEmail}</span>.</p>
                  
                  <div className="bg-emerald-50 p-8 rounded-3xl border border-emerald-100 space-y-4">
                    <div className="flex justify-between items-center border-b border-emerald-200/50 pb-3">
                      <span className="text-[10px] uppercase font-black text-emerald-600/50">Usuario</span>
                      <span className="text-xl font-mono font-black text-emerald-700">{generatedCreds.u}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-black text-emerald-600/50">Contraseña</span>
                      <span className="text-xl font-mono font-black text-emerald-700">{generatedCreds.p}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      setShowRegModal(false);
                      setGeneratedCreds(null);
                      setLoginU(generatedCreds.u);
                      setLoginP(generatedCreds.p);
                    }}
                    className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-emerald-500/20 active:scale-95 transition-transform"
                  >
                    INICIAR SESIÓN AHORA
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Auto-Registro de Talento Humano</h2>
                    <p className="text-sm text-slate-400 italic">Complete todos los requerimientos para acceder al sistema hospitalario.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] uppercase font-black text-emerald-600 ml-2 mb-1 block">Nombres *</label>
                        <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" value={regNombre} onChange={e => setRegNombre(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-black text-emerald-600 ml-2 mb-1 block">Apellidos *</label>
                        <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" value={regApellidos} onChange={e => setRegApellidos(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-black text-emerald-600 ml-2 mb-1 block">Cédula de Ciudadanía *</label>
                        <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" value={regCedula} onChange={e => setRegCedula(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-black text-emerald-600 ml-2 mb-1 block">Registro Médico / Tarjeta Prof.</label>
                        <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" value={regRegistroMedico} onChange={e => setRegRegistroMedico(e.target.value)} />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] uppercase font-black text-emerald-600 ml-2 mb-1 block">Correo Electrónico *</label>
                        <input type="email" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-black text-emerald-600 ml-2 mb-1 block">Teléfono / WhatsApp</label>
                        <input className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" value={regTelefono} onChange={e => setRegTelefono(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-black text-emerald-600 ml-2 mb-1 block">Cargo / Rol *</label>
                        <select className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl outline-none focus:border-emerald-500 font-bold" value={regRol} onChange={e => setRegRol(e.target.value)}>
                          <option value="Médico General">Médico General</option>
                          <option value="Médico Rural">Médico Rural</option>
                          <option value="Médico Especialista">Médico Especialista</option>
                          <option value="Médico Obstetra/Ginecólogo">Médico Ginecobstetra</option>
                          <option value="Enfermero Jefe">Enfermera(o) Jefe</option>
                          <option value="Jefe de Partos">Jefe de Partos</option>
                          <option value="Auxiliar Enfermería">Auxiliar de Enfermería</option>
                          <option value="Interno">Médico Interno</option>
                          <option value="Triage">Personal de Triage</option>
                          <option value="Odontólogo">Odontólogo</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleSelfRegister}
                    disabled={isRegistering}
                    className={`w-full mt-8 ${isRegistering ? 'bg-slate-300' : 'bg-emerald-600'} text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3`}
                  >
                    {isRegistering ? (
                      <>
                        <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                        PROCESANDO...
                      </>
                    ) : (
                      'FINALIZAR REGISTRO Y GENERAR ACCESOS'
                    )}
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
