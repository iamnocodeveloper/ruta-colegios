/**
 * InstantDB Authentication & Database Synchronization Modal
 * Supports Admin Demo quick access (admin@demo.com / 123456),
 * Email Magic Code auth, and Live InstantDB Cloud Sync
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Mail,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Sparkles,
  Database,
  RefreshCw,
  X,
  Zap,
  Lock,
  UserCheck,
  ArrowRight
} from 'lucide-react';
import { db, INSTANT_APP_ID, seedInstantDatabase } from '../../services/instantDb';

interface InstantAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDemoUser?: { email: string; rol: string; nombre: string } | null;
  onSetDemoUser?: (user: { email: string; rol: string; nombre: string } | null) => void;
}

export const InstantAuthModal: React.FC<InstantAuthModalProps> = ({
  isOpen,
  onClose,
  currentDemoUser,
  onSetDemoUser
}) => {
  const { isLoading: authLoading, user: instantUser } = db.useAuth();

  const [email, setEmail] = useState('admin@demo.com');
  const [passwordOrCode, setPasswordOrCode] = useState('123456');
  const [codeSent, setCodeSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  const activeUser = instantUser || currentDemoUser;

  useEffect(() => {
    if (isOpen && !activeUser) {
      setEmail('admin@demo.com');
      setPasswordOrCode('123456');
    }
  }, [isOpen, activeUser]);

  if (!isOpen) return null;

  // Instant one-click login for demo admin
  const handleQuickAdminLogin = () => {
    setIsSubmitting(true);
    setStatusMessage(null);

    const adminUser = {
      email: 'admin@demo.com',
      rol: 'admin',
      nombre: 'Administrador Demo'
    };

    localStorage.setItem('rutaescolar_demo_user', JSON.stringify(adminUser));
    if (onSetDemoUser) onSetDemoUser(adminUser);

    setStatusMessage({
      type: 'success',
      text: '¡Sesión de Administrador iniciada correctamente con credenciales temporales!'
    });

    setIsSubmitting(false);
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  // Form submission (Demo password verification or InstantDB Magic Code)
  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = passwordOrCode.trim();

    // Check if logging in with temporary admin credentials
    if (cleanEmail === 'admin@demo.com' && cleanPass === '123456') {
      const adminUser = {
        email: 'admin@demo.com',
        rol: 'admin',
        nombre: 'Administrador Demo'
      };
      localStorage.setItem('rutaescolar_demo_user', JSON.stringify(adminUser));
      if (onSetDemoUser) onSetDemoUser(adminUser);

      setStatusMessage({
        type: 'success',
        text: '¡Bienvenido Administrador! Acceso temporal concedido.'
      });
      setIsSubmitting(false);
      setTimeout(() => {
        onClose();
      }, 1000);
      return;
    }

    // Otherwise, use InstantDB Magic Code flow
    try {
      if (!codeSent) {
        await db.auth.sendMagicCode({ email: cleanEmail });
        setCodeSent(true);
        setStatusMessage({
          type: 'success',
          text: `Código de verificación de 6 dígitos enviado a ${cleanEmail}. Revisa tu bandeja de entrada.`
        });
      } else {
        await db.auth.signInWithMagicCode({ email: cleanEmail, code: cleanPass });
        setStatusMessage({
          type: 'success',
          text: '¡Sesión iniciada con éxito en InstantDB!'
        });
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Error en autenticación. Verifica tus datos.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await db.auth.signOut().catch(() => {});
      localStorage.removeItem('rutaescolar_demo_user');
      if (onSetDemoUser) onSetDemoUser(null);
      setCodeSent(false);
      setEmail('admin@demo.com');
      setPasswordOrCode('123456');
      setStatusMessage({ type: 'success', text: 'Sesión cerrada correctamente.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Error al cerrar sesión.' });
    }
  };

  const handleSeedData = async () => {
    setIsSeeding(true);
    setStatusMessage(null);
    const success = await seedInstantDatabase(true);
    if (success) {
      setStatusMessage({
        type: 'success',
        text: '¡Tablas y datos reales sincronizados en InstantDB correctamente!'
      });
    } else {
      setStatusMessage({
        type: 'error',
        text: 'Hubo un inconveniente al sembrar datos en InstantDB.'
      });
    }
    setIsSeeding(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-soft-gray p-4 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl space-y-4 text-ink relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted hover:text-white hover:bg-soft-gray transition-all cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header with InstantDB Badge */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/25">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-black text-ink text-base">Autenticación & InstantDB</h3>
              <div className="flex items-center gap-1 text-[11px] text-primary font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>App ID: {INSTANT_APP_ID.substring(0, 8)}...</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted pt-0.5">
            Acceso seguro y sincronización reactiva en tiempo real en la nube.
          </p>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                : 'bg-rose-50 border-rose-200 text-rose-600'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            )}
            <span className="leading-snug">{statusMessage.text}</span>
          </div>
        )}

        {/* Authenticated State */}
        {activeUser ? (
          <div className="rounded-xl border border-line bg-soft-gray p-4 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-black border border-emerald-200">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-ink font-bold">{activeUser.email}</span>
                    <span className="rounded bg-primary/10 text-primary px-1.5 py-0.2 text-[9px] font-black uppercase border border-primary/25">
                      {('rol' in activeUser && activeUser.rol) ? activeUser.rol : 'Admin'}
                    </span>
                  </div>
                  <span className="text-muted text-[10px]">Sesión Activa de Administrador</span>
                </div>
              </div>
              <span className="rounded-md bg-emerald-50 text-emerald-600 px-2 py-0.5 text-[10px] font-bold border border-emerald-200">
                Conectado
              </span>
            </div>

            <div className="text-muted text-[11px] border-t border-line/80 pt-2 space-y-1">
              <p className="text-ink font-medium">✓ Permisos totales para gestión de rutas, escuelas y estudiantes.</p>
              <p>Sincronización en vivo con InstantDB activa.</p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                id="btn-signout"
                onClick={handleSignOut}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-soft-gray py-2.5 text-xs font-bold text-alert hover:bg-line transition-all cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        ) : (
          /* Login Form with Quick Demo Access */
          <div className="space-y-3.5">
            {/* Quick Demo Access Action Button */}
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-primary flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Acceso Rápido Demo para Pruebas
                </span>
                <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/25">
                  admin@demo.com / 123456
                </span>
              </div>
              <p className="text-[11px] text-ink">
                Inicia sesión al instante con el usuario administrador preconfigurado.
              </p>
              <button
                id="btn-quick-admin-login"
                type="button"
                onClick={handleQuickAdminLogin}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-2 text-xs font-black text-ink hover:bg-primary active:scale-95 transition-all shadow-md cursor-pointer"
              >
                <Shield className="h-3.5 w-3.5" />
                <span>Ingresar como Admin Demo (1-Click)</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </button>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-line"></div>
              <span className="flex-shrink mx-2 text-[10px] uppercase font-bold text-muted">
                O ingresa tus credenciales
              </span>
              <div className="flex-grow border-t border-line"></div>
            </div>

            <form onSubmit={handleSubmitLogin} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-ink block mb-1">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@demo.com"
                    className="w-full rounded-xl bg-canvas border border-line pl-9 pr-3 py-2 text-xs text-ink placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">
                  Contraseña / Código Magic
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
                  <input
                    type="password"
                    required
                    value={passwordOrCode}
                    onChange={(e) => setPasswordOrCode(e.target.value)}
                    placeholder="123456"
                    className="w-full rounded-xl bg-canvas border border-line pl-9 pr-3 py-2 text-xs text-ink placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <button
                id="btn-submit-auth"
                type="submit"
                disabled={isSubmitting || authLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-soft-gray border border-line py-2.5 text-xs font-bold text-ink hover:bg-line active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-md"
              >
                <KeyRound className="h-4 w-4 text-primary" />
                <span>{isSubmitting ? 'Verificando...' : 'Iniciar Sesión'}</span>
              </button>
            </form>
          </div>
        )}

        {/* Database Real Seed & Sync Helper */}
        <div className="border-t border-line pt-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-ink flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-primary" />
              <span>Sincronización de Tablas InstantDB</span>
            </span>
          </div>
          <p className="text-[11px] text-muted leading-relaxed">
            Escribe y actualiza las tablas de Colegios, Representantes, Alumnos, Rutas, Paradas y Usuarios en tu App InstantDB.
          </p>
          <button
            id="btn-seed-instantdb"
            onClick={handleSeedData}
            disabled={isSeeding}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-soft-gray border border-line py-2 text-xs font-bold text-ink hover:bg-line transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-primary ${isSeeding ? 'animate-spin' : ''}`} />
            <span>{isSeeding ? 'Sincronizando Tablas...' : 'Sincronizar Tablas con Datos Reales'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
