/**
 * PWA Install Prompt Banner & Network Status
 */

import React, { useState, useEffect } from 'react';
import { Download, WifiOff, X } from 'lucide-react';

export const PWAInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  if (!isOnline) {
    return (
      <div className="bg-rose-600 px-3 py-1.5 text-center text-xs font-bold text-white flex items-center justify-center gap-1.5 shadow-md">
        <WifiOff className="h-3.5 w-3.5" />
        <span>Modo sin conexión activo. Los datos locales se sincronizarán al recuperar la red.</span>
      </div>
    );
  }

  if (!deferredPrompt || isDismissed) return null;

  return (
    <div className="bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-2 text-slate-950 flex items-center justify-between shadow-lg text-xs font-bold">
      <div className="flex items-center gap-2">
        <span className="text-base">📲</span>
        <span>¡Instala RutaEscolar PWA en tu pantalla de inicio para acceso rápido sin conexión!</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleInstallClick}
          className="rounded-lg bg-slate-950 px-3 py-1 text-xs text-amber-400 hover:bg-slate-900 transition-all cursor-pointer shadow"
        >
          Instalar App
        </button>
        <button onClick={() => setIsDismissed(true)} className="p-1 hover:opacity-70">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
