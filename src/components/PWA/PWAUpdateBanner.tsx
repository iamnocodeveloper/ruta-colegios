/**
 * PWA Update Banner
 * Muestra "Nueva versión disponible" cuando el service worker nuevo está instalado,
 * y permite aplicar la actualización con un clic (recarga la app con la build nueva).
 */

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useServiceWorkerUpdate } from '../../services/appUpdate';

export const PWAUpdateBanner: React.FC = () => {
  const { waiting, updated, applyUpdate } = useServiceWorkerUpdate();

  if (!waiting && !updated) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-emerald-600 px-4 py-2 text-white shadow-lg text-xs font-bold">
      {updated ? (
        <span className="flex items-center gap-2">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Actualizado · aplicando nueva versión...
        </span>
      ) : (
        <>
          <span>🚀 Hay una nueva versión de RutaEscolar disponible</span>
          <button
            id="btn-pwa-update"
            onClick={applyUpdate}
            className="rounded-lg bg-white px-3 py-1 text-xs font-black text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer shadow"
          >
            Actualizar ahora
          </button>
        </>
      )}
    </div>
  );
};
