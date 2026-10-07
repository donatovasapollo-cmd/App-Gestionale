import React, { useState } from 'react';
import { Lock, UserCheck, AlertCircle } from 'lucide-react';
import type { UserPublicProfile } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (user: UserPublicProfile) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('donato.vasapollo@gmail.com');
  const [password, setPassword] = useState('admin');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { user?: UserPublicProfile; error?: string };
      if (!res.ok || !data.user) {
        throw new Error(data.error || 'Credenziali non valide');
      }
      onLoginSuccess(data.user);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Errore durante il login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between px-4 py-6 sm:px-8">
      <header className="max-w-md w-full mx-auto flex items-center justify-between border-b border-slate-200 pb-4">
        <span className="text-lg font-bold tracking-tight text-slate-950">GestionApp</span>
        <span className="text-xs font-mono text-slate-500">Accesso Operatori</span>
      </header>

      <main className="flex-1 flex items-center justify-center py-8">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-950 tracking-tight">
              GestionApp
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Piattaforma di gestione quotazioni, ordini e attività
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-slate-100 border border-slate-300 rounded-lg text-xs text-slate-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-slate-900 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Username o Email *
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                placeholder="Inserisci username o email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-mono text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password *
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="Inserisci password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-mono text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] py-2.5 px-4 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>{loading ? 'Accesso in corso...' : 'Entra nell’Applicazione'}</span>
            </button>
          </form>

          <div className="pt-4 border-t border-slate-200 space-y-1.5 text-xs text-slate-600">
            <div className="flex items-center gap-1.5 text-slate-900 font-semibold">
              <Lock className="w-3.5 h-3.5 text-slate-700" />
              <span>Account Amministratore Principale:</span>
            </div>
            <div className="font-mono text-[11px] text-slate-600">
              Utente: <strong className="text-slate-950">donato.vasapollo@gmail.com</strong> · Password iniziale:{' '}
              <strong className="text-slate-950">admin</strong>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-md w-full mx-auto text-center text-xs text-slate-500 pt-4 border-t border-slate-200">
        GestionApp · Piattaforma di gestione quotazioni, ordini e attività
      </footer>
    </div>
  );
};
