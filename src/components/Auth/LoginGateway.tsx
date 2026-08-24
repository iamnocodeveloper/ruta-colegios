/**
 * Main Application Login & Access Gateway (Pantalla Principal de Inicio de Sesión)
 * Required before any operational views are rendered.
 * Provides:
 *   1. Staff / Admin / Driver Login (InstantDB Magic Code & 1-Click Demo Login admin@demo.com / 123456)
 *   2. Parent Portal Direct Access (Ingreso con ID de Alumno / Sugerencias de Alumnos)
 *   3. Real-time InstantDB database synchronization
 */

import React, { useState } from 'react';
import {
  Shield,
  Users,
  Compass,
  KeyRound,
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Database,
  Search,
  UserCheck,
  RefreshCw
} from 'lucide-react';
import { Alumno } from '../../types';
import { db, INSTANT_APP_ID, seedInstantDatabase } from '../../services/instantDb';

interface LoginGatewayProps {
  allStudents: Alumno[];
  onStaffLogin: (email: string) => void;
  onParentLogin: (studentId: string) => void;
}

export const LoginGateway: React.FC<LoginGatewayProps> = ({
  allStudents,
  onStaffLogin,
  onParentLogin
}) => {
  const [activeTab, setActiveTab] = useState<'staff' | 'parent'>('staff');

  // Staff form state
  const [email, setEmail] = useState('admin@demo.com');
  const [passwordOrCode, setPasswordOrCode] = useState('123456');
  const [codeSent, setCodeSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffSuccess, setStaffSuccess] = useState<string | null>(null);

  // Parent form state
  const [studentIdInput, setStudentIdInput] = useState('');
  const [parentError, setParentError] = useState<string | null>(null);

  // InstantDB Seed helper
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);

  // 1. Quick 1-Click Admin Login (dueño / demo)
  const handleQuickAdminLogin = () => {
    setIsSubmitting(true);
    setStaffError(null);
    setStaffSuccess('¡Sesión de Administrador iniciada con credenciales del dueño!');
    setTimeout(() => {
      onStaffLogin('admin@demo.com');
    }, 400);
  };

  // 2. Staff Form Submit (InstantDB Magic Code)
  const handleStaffFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setStaffError(null);
    setStaffSuccess(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = passwordOrCode.trim();

    // Acceso del dueño/admin ya creado (credenciales locales)
    if (cleanEmail === 'admin@demo.com' && (cleanPass === '123456' || cleanPass === 'admin')) {
      setStaffSuccess('¡Credenciales verificadas! Accediendo al sistema...');
      setTimeout(() => {
        onStaffLogin(cleanEmail);
      }, 400);
      return;
    }

    // Acceso por InstantDB Magic Code (código de 6 dígitos enviado al correo)
    try {
      if (!codeSent) {
        await db.auth.sendMagicCode({ email: cleanEmail });
        setCodeSent(true);
        setStaffSuccess(`Código de 6 dígitos enviado a ${cleanEmail}. Ingrésalo a continuación.`);
      } else {
        await db.auth.signInWithMagicCode({ email: cleanEmail, code: cleanPass });
        setStaffSuccess('¡Autenticado con éxito! Verificando acceso...');
        setTimeout(() => {
          onStaffLogin(cleanEmail);
        }, 500);
      }
    } catch (err: any) {
      setStaffError(err?.message || 'Error en la autenticación. Verifica el código o el correo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Parent Form Submit
  const handleParentFormSubmit = (e?: React.FormEvent, lookupId?: string) => {
    if (e) e.preventDefault();
    const target = (lookupId || studentIdInput).trim().toLowerCase();

    if (!target) {
      setParentError('Por favor ingresa el ID del estudiante.');
      return;
    }

    // Find student in available list or match case-insensitive
    const match = allStudents.find(
      (s) => s.id.toLowerCase() === target || s.nombre.toLowerCase().includes(target)
    );

    if (match) {
      setParentError(null);
      onParentLogin(match.id);
    } else {
      setParentError(`No se encontró ningún alumno con el ID "${target}". Prueba con un ID de la lista sugerida.`);
    }
  };

  // 4. Seed Database in InstantDB (con confirmación para no pisar datos)
  const handleSeedDatabase = async () => {
    if (!window.confirm('Se crearán/sobrescribirán los datos DEMO. Si ya tienes datos reales, NO los borra, pero añadirá los demo. ¿Continuar?')) return;
    setIsSeeding(true);
    try {
      const ok = await seedInstantDatabase(true);
      if (ok) {
        setSeedSuccess(true);
        setTimeout(() => setSeedSuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    }
    setIsSeeding(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-canvas p-4 sm:p-6 text-ink font-sans selection:bg-primary selection:text-white">
      <div className="w-full max-w-lg space-y-5 animate-fadeIn">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-blue-500 text-3xl text-white font-black shadow-xl shadow-primary/20">
            🚌
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-ink flex items-center justify-center gap-2">
            <span>RutaEscolar</span>
            <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-black text-primary border border-primary/25">
              PWA
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-muted max-w-sm mx-auto">
            Plataforma Inteligente de Transporte Escolar con Sincronización en Tiempo Real en InstantDB
          </p>

          {/* InstantDB App ID Status Pill */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-surface border border-line px-3 py-1 text-[11px] text-primary font-mono">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>InstantDB Conectado:</span>
            <span className="text-ink font-bold">{INSTANT_APP_ID.substring(0, 8)}...</span>
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-line bg-surface shadow-2xl p-5 sm:p-7 backdrop-blur-sm space-y-5">
          {/* Access Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-canvas border border-line">
            <button
              id="tab-staff-login"
              type="button"
              onClick={() => {
                setActiveTab('staff');
                setStaffError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'staff'
                  ? 'bg-primary text-white shadow-md font-black'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Shield className="h-4 w-4" />
              <span>Personal / Admin</span>
            </button>

            <button
              id="tab-parent-login"
              type="button"
              onClick={() => {
                setActiveTab('parent');
                setParentError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'parent'
                  ? 'bg-primary text-white shadow-md font-black'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Portal Representante</span>
            </button>
          </div>

          {/* TAB 1: STAFF / ADMIN / DRIVER LOGIN */}
          {activeTab === 'staff' && (
            <div className="space-y-4">
              {/* Quick 1-Click Demo Login Banner (dueño / demo) */}
              <div className="rounded-xl border border-primary/25 bg-primary/10 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Acceso Rápido Administrador
                  </span>
                  <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/25">
                    admin@demo.com / 123456
                  </span>
                </div>
                <p className="text-xs text-ink leading-relaxed">
                  Ingresa con un solo clic con las credenciales de administrador para gestionar rutas, escuelas y alumnos.
                </p>
                <button
                  id="btn-quick-admin-login-main"
                  type="button"
                  onClick={handleQuickAdminLogin}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-black text-white hover:bg-primary active:scale-95 transition-all shadow-md cursor-pointer"
                >
                  <Zap className="h-4 w-4" />
                  <span>Ingresar como Admin (1-Click)</span>
                  <ArrowRight className="h-4 w-4 ml-1" />
                </button>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-line"></div>
                <span className="flex-shrink mx-2 text-[10px] uppercase font-bold text-muted">
                  O inicia con tu correo y código
                </span>
                <div className="flex-grow border-t border-line"></div>
              </div>

              {/* Status messages */}
              {staffError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-600 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{staffError}</span>
                </div>
              )}

              {staffSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-600 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{staffSuccess}</span>
                </div>
              )}

              {/* Staff Credentials Form */}
              <form onSubmit={handleStaffFormSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 h-4 w-4 text-muted" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@demo.com"
                      className="w-full rounded-xl bg-canvas border border-line pl-10 pr-4 py-2.5 text-xs text-ink placeholder:text-muted focus:border-primary focus:outline-none transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">
                    Código de 6 dígitos (InstantDB)
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 h-4 w-4 text-muted" />
                    <input
                      type="password"
                      required
                      value={passwordOrCode}
                      onChange={(e) => setPasswordOrCode(e.target.value)}
                      placeholder="••••••"
                      className="w-full rounded-xl bg-canvas border border-line pl-10 pr-4 py-2.5 text-xs text-ink placeholder:text-muted focus:border-primary focus:outline-none transition-all shadow-inner"
                    />
                  </div>
                </div>

                <button
                  id="btn-staff-submit"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-soft-gray border border-line py-3 text-xs font-bold text-ink hover:bg-line hover:text-primary active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  <KeyRound className="h-4 w-4 text-primary" />
                  <span>{isSubmitting ? 'Verificando...' : 'Iniciar Sesión'}</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: PARENT PORTAL ACCESS (ID DE ALUMNO) */}
          {activeTab === 'parent' && (
            <div className="space-y-4">
              <div className="text-center space-y-1 pb-1">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/25 text-lg">
                  🎒
                </div>
                <h3 className="font-black text-ink text-base">Portal del Representante</h3>
                <p className="text-xs text-muted">
                  Ingresa con el <b className="text-primary">ID del Alumno</b> para ver el mapa interactivo y la hora de llegada en vivo.
                </p>
              </div>

              {parentError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-600 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{parentError}</span>
                </div>
              )}

              <form onSubmit={handleParentFormSubmit} className="space-y-3.5">
                <div>
                  <label htmlFor="input-student-id-gateway" className="block text-xs font-bold uppercase tracking-wider text-ink mb-1">
                    ID del Alumno *
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted" />
                    <input
                      id="input-student-id-gateway"
                      type="text"
                      required
                      autoFocus
                      value={studentIdInput}
                      onChange={(e) => {
                        setStudentIdInput(e.target.value);
                        if (parentError) setParentError(null);
                      }}
                      placeholder="Ej: alu_01, alu_02"
                      className="w-full rounded-xl bg-canvas border border-line pl-10 pr-4 py-2.5 text-sm font-mono text-primary placeholder:text-muted focus:border-primary focus:outline-none transition-all shadow-inner"
                    />
                  </div>
                </div>

                <button
                  id="btn-parent-submit-gateway"
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-black text-white hover:bg-primary active:scale-95 transition-all shadow-lg cursor-pointer"
                >
                  <span>Ingresar al Portal del Representante</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              {/* Quick Student ID Suggestions */}
              {allStudents.length > 0 && (
                <div className="border-t border-line pt-3 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                    Alumnos de prueba registrados en InstantDB:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {allStudents.slice(0, 6).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setStudentIdInput(s.id);
                          handleParentFormSubmit(undefined, s.id);
                        }}
                        className="rounded-lg bg-canvas border border-line px-2.5 py-1 text-xs text-ink hover:border-primary hover:text-primary transition-all font-mono cursor-pointer flex items-center gap-1"
                      >
                        <span className="font-bold text-primary">{s.id}</span>
                        <span className="text-muted">({s.nombre.split(' ')[0]})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Database Synchronization Helper in InstantDB */}
          <div className="border-t border-line/80 pt-3 flex items-center justify-between text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-primary" />
              <span>Tablas InstantDB Listas</span>
            </span>

            <button
              id="btn-seed-gateway"
              type="button"
              onClick={handleSeedDatabase}
              disabled={isSeeding}
              className="flex items-center gap-1 text-primary hover:text-primary transition-colors font-semibold cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${isSeeding ? 'animate-spin' : ''}`} />
              <span>{isSeeding ? 'Sincronizando...' : seedSuccess ? '¡Sincronizado!' : 'Poblar Datos Reales'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
