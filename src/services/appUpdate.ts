/**
 * Actualización de la PWA (Service Worker) + versión de la app.
 *
 * El HTML se sirve network-first (sw.js), así que al recargar se baja el index.html
 * nuevo con los assets con hash nuevos. Este módulo añade:
 *   1. Indicador de versión (APP_VERSION) para confirmar de un vistazo la build en uso.
 *   2. Hook `useServiceWorkerUpdate()` que detecta una nueva versión del SW y permite
 *      aplicarla con un clic (banner "Nueva versión disponible").
 */
import { useEffect, useState } from 'react';

export const APP_VERSION = '1.2.0';

export interface ServiceWorkerUpdateState {
  /** Hay un nuevo service worker instalado esperando (nueva versión lista). */
  waiting: boolean;
  /** El service worker nuevo ya activó (hay que recargar para aplicar). */
  updated: boolean;
  /** Fuerza la activación del SW nuevo (y recarga). */
  applyUpdate: () => void;
}

/**
 * Detecta actualizaciones del service worker y expone cómo aplicarlas.
 */
export function useServiceWorkerUpdate(): ServiceWorkerUpdateState {
  const [waiting, setWaiting] = useState<boolean>(false);
  const [updated, setUpdated] = useState<boolean>(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;

    const onUpdateFound = (reg: ServiceWorkerRegistration) => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // Nueva versión instalada y hay una versión anterior controlando la página
          setWaiting(true);
        }
      });
    };

    // Espera a que el SW esté listo y escucha nuevas versiones
    navigator.serviceWorker.ready.then((reg) => {
      registration = reg;
      if (reg.waiting) setWaiting(true);
      reg.addEventListener('updatefound', () => onUpdateFound(reg));
    });

    // Cuando el SW nuevo toma control, hay que recargar para aplicar la nueva build
    const onControllerChange = () => {
      setWaiting(false);
      setUpdated(true);
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      if (registration) {
        registration.removeEventListener('updatefound', () => undefined);
      }
    };
  }, []);

  // Al activarse el SW nuevo, recarga automáticamente para aplicar la build
  useEffect(() => {
    if (!updated) return;
    const t = setTimeout(() => window.location.reload(), 500);
    return () => clearTimeout(t);
  }, [updated]);

  const applyUpdate = () => {
    if (!('serviceWorker' in navigator)) {
      window.location.reload();
      return;
    }
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        window.location.reload();
      }
    });
  };

  return { waiting, updated, applyUpdate };
}
