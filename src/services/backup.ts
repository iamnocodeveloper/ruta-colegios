/**
 * Respaldo de solo lectura: descarga un JSON con los datos actuales (InstantDB +
 * resumen de localStorage). No modifica ni borra nada.
 */

export function downloadBackup(data: Record<string, any>, label = 'rutaescolar') {
  const lsSummary: Record<string, string> = {};
  if (typeof localStorage !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('rutaescolar_')) {
        lsSummary[k] = localStorage.getItem(k) || '';
      }
    }
  }

  const payload = {
    app: 'RutaEscolar',
    generated_at: new Date().toISOString(),
    cloud: data,
    local_storage: lsSummary,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${label}_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
