/**
 * InstantDB Live Status & User Sync Badge
 */

import React from 'react';
import { Zap, ShieldCheck } from 'lucide-react';
import { db } from '../../services/instantDb';

interface InstantSyncBadgeProps {
  onOpenAuthModal: () => void;
  demoUser?: { email: string; rol: string; nombre: string } | null;
}

export const InstantSyncBadge: React.FC<InstantSyncBadgeProps> = ({
  onOpenAuthModal,
  demoUser
}) => {
  const { user: instantUser } = db.useAuth();
  const activeUser = instantUser || demoUser;

  return (
    <button
      id="btn-instantdb-auth"
      onClick={onOpenAuthModal}
      className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/80 px-2.5 py-1.5 text-xs text-slate-200 hover:border-amber-500/50 hover:bg-slate-900 transition-all cursor-pointer shadow-sm group"
      title="InstantDB Real-time Sync & Autenticación de Usuarios"
    >
      <div className="flex items-center gap-1">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <Zap className="h-3.5 w-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
      </div>

      <div className="flex items-center gap-1">
        <span className="font-bold text-[11px] text-slate-300">InstantDB</span>
        {activeUser ? (
          <span className="rounded bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-0.5 max-w-[120px] truncate">
            <ShieldCheck className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
            <span className="truncate">{activeUser.email?.split('@')[0]}</span>
          </span>
        ) : (
          <span className="rounded bg-amber-500/10 text-amber-400 px-1.5 py-0.2 text-[10px] font-bold border border-amber-500/30">
            Conectado
          </span>
        )}
      </div>
    </button>
  );
};
