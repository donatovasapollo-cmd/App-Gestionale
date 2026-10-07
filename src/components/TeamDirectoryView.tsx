import React, { useState } from 'react';
import {
  Shield,
  UserPlus,
  Trash2,
  KeyRound,
  Check,
  Search,
} from 'lucide-react';
import {
  ALL_PERMISSIONS_TRUE,
  DEFAULT_OPERATOR_PERMISSIONS,
  PERMISSION_DEFINITIONS,
  type UserLevel,
  type UserPermissions,
  type UserPublicProfile,
} from '../types';

interface TeamDirectoryViewProps {
  users: UserPublicProfile[];
  currentUserProfile: UserPublicProfile;
  onCreateNewOperator: (data: {
    username: string;
    password: string;
    displayName: string;
    level: UserLevel;
    department: string;
    permissions: UserPermissions;
  }) => Promise<void>;
  onUpdateUser: (
    uid: string,
    data: {
      displayName?: string;
      username?: string;
      level?: UserLevel;
      department?: string;
      newPassword?: string;
      permissions?: UserPermissions;
    }
  ) => Promise<void>;
  onDeleteUser: (uid: string) => Promise<void>;
}

export const TeamDirectoryView: React.FC<TeamDirectoryViewProps> = ({
  users,
  currentUserProfile,
  onCreateNewOperator,
  onUpdateUser,
  onDeleteUser,
}) => {
  // New User Form State
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDepartment, setNewDepartment] = useState('Squadra Tecnica in Campo');
  const [newLevel, setNewLevel] = useState<UserLevel>('operatore');
  const [newPermissions, setNewPermissions] = useState<UserPermissions>({
    ...DEFAULT_OPERATOR_PERMISSIONS,
  });
  const [creating, setCreating] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null
  );

  // Password Change Modal / Inline State
  const [editingPasswordUid, setEditingPasswordUid] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [savingUid, setSavingUid] = useState<string | null>(null);

  const handleToggleNewPerm = (key: keyof UserPermissions) => {
    if (newLevel === 'admin') return;
    setNewPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);
    if (!newDisplayName.trim() || !newUsername.trim() || !newPassword.trim()) {
      setFormMsg({
        type: 'error',
        text: 'Inserisci Nome e Cognome, Username/Email e Password.',
      });
      return;
    }

    setCreating(true);
    try {
      await onCreateNewOperator({
        displayName: newDisplayName.trim(),
        username: newUsername.trim().toLowerCase(),
        password: newPassword.trim(),
        department: newDepartment.trim() || 'Area Tecnica',
        level: newLevel,
        permissions:
          newLevel === 'admin' ? { ...ALL_PERMISSIONS_TRUE } : newPermissions,
      });
      setFormMsg({
        type: 'success',
        text: `Utente "${newDisplayName.trim()}" (${newLevel === 'admin' ? 'Amministratore' : 'Operatore'}) creato con successo.`,
      });
      setNewDisplayName('');
      setNewUsername('');
      setNewPassword('');
      setNewLevel('operatore');
      setNewPermissions({ ...DEFAULT_OPERATOR_PERMISSIONS });
    } catch (err) {
      setFormMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Errore creazione utente',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleUserPermission = async (
    targetUser: UserPublicProfile,
    permKey: keyof UserPermissions
  ) => {
    if (targetUser.level === 'admin') return;
    setSavingUid(targetUser.uid);
    try {
      const updatedPerms: UserPermissions = {
        ...targetUser.permissions,
        [permKey]: !targetUser.permissions[permKey],
      };
      await onUpdateUser(targetUser.uid, { permissions: updatedPerms });
    } finally {
      setSavingUid(null);
    }
  };

  const handleChangeUserLevel = async (
    targetUser: UserPublicProfile,
    nextLevel: UserLevel
  ) => {
    setSavingUid(targetUser.uid);
    try {
      await onUpdateUser(targetUser.uid, {
        level: nextLevel,
        permissions:
          nextLevel === 'admin'
            ? { ...ALL_PERMISSIONS_TRUE }
            : { ...DEFAULT_OPERATOR_PERMISSIONS },
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSavingUid(null);
    }
  };

  const handleSaveNewPassword = async (uid: string) => {
    if (!tempPassword.trim() || tempPassword.trim().length < 3) return;
    setSavingUid(uid);
    try {
      await onUpdateUser(uid, { newPassword: tempPassword.trim() });
      setEditingPasswordUid(null);
      setTempPassword('');
    } finally {
      setSavingUid(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const s = searchQuery.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(s) ||
      u.username.toLowerCase().includes(s) ||
      u.department.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
          Gestione Utenti &amp; Matrice dei Privilegi
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          Inserisci tutti gli utenti che desideri. Imposta il livello <strong>Amministratore</strong> (accesso totale) oppure <strong>Operatore</strong> personalizzando ogni singola funzione con le caselle di spunta.
        </p>
      </div>

      {/* Section 1: Create New User Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-slate-800" />
            <h2 className="text-base font-bold text-slate-950">
              Inserisci Nuovo Utente
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Utenti attivi: {users.length}
          </span>
        </div>

        {formMsg && (
          <div className="p-3.5 rounded-lg text-xs font-semibold border bg-slate-100 border-slate-300 text-slate-950">
            {formMsg.text}
          </div>
        )}

        <form onSubmit={handleCreateSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nome e Cognome *
              </label>
              <input
                type="text"
                required
                placeholder="Es. Marco Galli"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Username / Email per Login *
              </label>
              <input
                type="text"
                required
                placeholder="Es. m.galli"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-mono text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password di Accesso *
              </label>
              <input
                type="text"
                required
                placeholder="Inserisci password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-mono text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Reparto / Mansione
              </label>
              <input
                type="text"
                placeholder="Es. Tecnico Trasfertista"
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
              />
            </div>
          </div>

          {/* Level Selection: Amministratore vs Operatore */}
          <div className="space-y-3 pt-1">
            <label className="block text-xs font-semibold text-slate-700">
              Livello di Utenza *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNewLevel('operatore')}
                className={`min-h-[52px] p-3.5 rounded-lg border text-left transition-colors cursor-pointer flex items-center justify-between ${
                  newLevel === 'operatore'
                    ? 'border-slate-950 bg-slate-950 text-white'
                    : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div>
                  <div
                    className={`text-sm font-bold ${
                      newLevel === 'operatore' ? 'text-white' : 'text-slate-950'
                    }`}
                  >
                    Livello Operatore (Personalizzabile)
                  </div>
                  <div
                    className={`text-xs ${
                      newLevel === 'operatore' ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    Abilita solo le funzionalità spuntate nella matrice privilegi sotto
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                    newLevel === 'operatore'
                      ? 'border-white bg-white text-slate-950'
                      : 'border-slate-300'
                  }`}
                >
                  {newLevel === 'operatore' && <Check className="w-3.5 h-3.5" />}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setNewLevel('admin')}
                className={`min-h-[52px] p-3.5 rounded-lg border text-left transition-colors cursor-pointer flex items-center justify-between ${
                  newLevel === 'admin'
                    ? 'border-slate-950 bg-slate-950 text-white'
                    : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div>
                  <div
                    className={`text-sm font-bold ${
                      newLevel === 'admin' ? 'text-white' : 'text-slate-950'
                    }`}
                  >
                    Livello Amministratore (Accesso Completo)
                  </div>
                  <div
                    className={`text-xs ${
                      newLevel === 'admin' ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    Può eseguire qualsiasi operazione e gestire tutti gli utenti
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                    newLevel === 'admin'
                      ? 'border-white bg-white text-slate-950'
                      : 'border-slate-300'
                  }`}
                >
                  {newLevel === 'admin' && <Check className="w-3.5 h-3.5" />}
                </div>
              </button>
            </div>
          </div>

          {/* Privilege Checkboxes for New User */}
          {newLevel === 'operatore' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900">
                  Spunta i Privilegi da Assegnare a questo Operatore:
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNewPermissions({ ...DEFAULT_OPERATOR_PERMISSIONS })}
                    className="px-3 py-1.5 text-xs bg-slate-950 hover:bg-slate-800 text-white font-semibold rounded-lg cursor-pointer"
                  >
                    Preset Tecnico in Campo
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setNewPermissions({
                        viewQuotes: true,
                        createQuotes: true,
                        receiveOrders: true,
                        viewClientsProjects: true,
                        manageProjects: true,
                        logActivities: false,
                        viewAllActivities: true,
                        deleteActivities: false,
                        generateInterventionReport: true,
                        manageUsers: false,
                      })
                    }
                    className="px-3 py-1.5 text-xs bg-slate-950 hover:bg-slate-800 text-white font-semibold rounded-lg cursor-pointer"
                  >
                    Preset Ufficio Commerciale
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setNewPermissions({ ...ALL_PERMISSIONS_TRUE, manageUsers: false })
                    }
                    className="px-3 py-1.5 text-xs bg-slate-950 hover:bg-slate-800 text-white font-semibold rounded-lg cursor-pointer"
                  >
                    Seleziona Tutti
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {PERMISSION_DEFINITIONS.map((perm) => {
                  const checked = newPermissions[perm.key];
                  return (
                    <label
                      key={perm.key}
                      className={`min-h-[48px] p-3 rounded-lg border flex items-start gap-3 cursor-pointer select-none transition-colors ${
                        checked
                          ? 'bg-white border-slate-950 text-slate-950'
                          : 'bg-white/60 border-slate-200 text-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleNewPerm(perm.key)}
                        className="mt-0.5 w-4 h-4 accent-slate-950 rounded shrink-0"
                      />
                      <div className="text-xs leading-tight">
                        <div className="font-semibold text-slate-950">{perm.label}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {perm.description}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer"
            >
              {creating ? 'Salvataggio in corso...' : '+ Crea Utente e Salva Privilegi'}
            </button>
          </div>
        </form>
      </div>

      {/* Section 2: Interactive Privilege Matrix for All Existing Users */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-800" />
              <span>Matrice dei Privilegi Utenti ({filteredUsers.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Spunta o rimuovi i flag per abilitare o disabilitare in tempo reale ciascuna funzionalità per ogni operatore.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca utente o username..."
              className="w-full min-h-[42px] pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
            />
          </div>
        </div>

        {/* Desktop Interactive Matrix Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-950 text-white text-[11px] font-semibold uppercase tracking-wider">
                <th className="py-3 px-4 min-w-[210px]">Utente &amp; Credenziali</th>
                <th className="py-3 px-3 min-w-[130px]">Livello</th>
                {PERMISSION_DEFINITIONS.map((p) => (
                  <th
                    key={p.key}
                    className="py-3 px-2 text-center max-w-[95px]"
                    title={p.description}
                  >
                    <div className="leading-tight">{p.shortLabel}</div>
                  </th>
                ))}
                <th className="py-3 px-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredUsers.map((u) => {
                const isAdmin = u.level === 'admin';
                return (
                  <tr
                    key={u.uid}
                    className={`hover:bg-slate-50 transition-colors ${
                      savingUid === u.uid ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-950 text-sm">
                        {u.displayName}
                        {u.uid === currentUserProfile.uid && (
                          <span className="ml-1.5 text-xs font-normal text-slate-500">
                            (Tu)
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs text-slate-600">{u.username}</div>
                      <div className="text-[11px] text-slate-500">{u.department}</div>

                      {editingPasswordUid === u.uid && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="Nuova password..."
                            value={tempPassword}
                            onChange={(e) => setTempPassword(e.target.value)}
                            className="px-2 py-1 border border-slate-300 rounded text-xs font-mono w-32"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveNewPassword(u.uid)}
                            className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-white rounded text-xs font-semibold cursor-pointer"
                          >
                            Salva
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPasswordUid(null);
                              setTempPassword('');
                            }}
                            className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-white rounded text-xs font-semibold cursor-pointer"
                          >
                            Chiudi
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-3">
                      <select
                        value={u.level}
                        disabled={u.id === 'admin_donato'}
                        onChange={(e) =>
                          handleChangeUserLevel(u, e.target.value as UserLevel)
                        }
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${
                          isAdmin
                            ? 'bg-slate-950 text-white border-slate-950'
                            : 'bg-white text-slate-900 border-slate-300'
                        }`}
                      >
                        <option value="admin">Amministratore</option>
                        <option value="operatore">Operatore</option>
                      </select>
                    </td>

                    {PERMISSION_DEFINITIONS.map((perm) => {
                      const isChecked = isAdmin
                        ? true
                        : Boolean(u.permissions?.[perm.key]);
                      return (
                        <td key={perm.key} className="py-3.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isAdmin}
                            onChange={() => handleToggleUserPermission(u, perm.key)}
                            className="w-4 h-4 accent-slate-950 rounded cursor-pointer disabled:opacity-50"
                            title={`${perm.label}: ${isChecked ? 'Abilitato' : 'Disabilitato'}`}
                          />
                        </td>
                      );
                    })}

                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPasswordUid(u.uid);
                            setTempPassword('');
                          }}
                          className="p-2 bg-slate-950 hover:bg-slate-800 text-white rounded-lg cursor-pointer"
                          title="Cambia Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        {u.id !== 'admin_donato' && u.uid !== currentUserProfile.uid && (
                          <button
                            type="button"
                            onClick={() => onDeleteUser(u.uid)}
                            className="p-2 bg-slate-950 hover:bg-slate-800 text-white rounded-lg cursor-pointer"
                            title="Elimina Utente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile & Tablet Touch-First Cards for Privilege Matrix */}
        <div className="lg:hidden divide-y divide-slate-200">
          {filteredUsers.map((u) => {
            const isAdmin = u.level === 'admin';
            return (
              <div key={u.uid} className="p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-base text-slate-950">
                      {u.displayName}
                      {u.uid === currentUserProfile.uid && (
                        <span className="ml-1.5 text-xs font-normal text-slate-500">
                          (Tu)
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-slate-600">{u.username}</div>
                    <div className="text-xs text-slate-500">{u.department}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={u.level}
                      disabled={u.id === 'admin_donato'}
                      onChange={(e) =>
                        handleChangeUserLevel(u, e.target.value as UserLevel)
                      }
                      className={`min-h-[40px] px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                        isAdmin
                          ? 'bg-slate-950 text-white border-slate-950'
                          : 'bg-white text-slate-900 border-slate-300'
                      }`}
                    >
                      <option value="admin">Amministratore</option>
                      <option value="operatore">Operatore</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingPasswordUid(
                          editingPasswordUid === u.uid ? null : u.uid
                        );
                        setTempPassword('');
                      }}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center bg-slate-950 hover:bg-slate-800 text-white rounded-lg cursor-pointer"
                      title="Cambia Password"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>

                    {u.id !== 'admin_donato' && u.uid !== currentUserProfile.uid && (
                      <button
                        type="button"
                        onClick={() => onDeleteUser(u.uid)}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center bg-slate-950 hover:bg-slate-800 text-white rounded-lg cursor-pointer"
                        title="Elimina Utente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {editingPasswordUid === u.uid && (
                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <input
                      type="text"
                      placeholder="Nuova password..."
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      className="flex-1 min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveNewPassword(u.uid)}
                      className="min-h-[42px] px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Salva Password
                    </button>
                  </div>
                )}

                {isAdmin ? (
                  <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-800 font-medium">
                    Livello Amministratore: tutti i privilegi dell’applicazione sono attivi.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PERMISSION_DEFINITIONS.map((perm) => {
                      const checked = Boolean(u.permissions?.[perm.key]);
                      return (
                        <label
                          key={perm.key}
                          className={`min-h-[44px] px-3 py-2.5 rounded-lg border flex items-center justify-between gap-3 cursor-pointer ${
                            checked
                              ? 'bg-slate-50 border-slate-950 text-slate-950'
                              : 'bg-white border-slate-200 text-slate-500'
                          }`}
                        >
                          <span className="text-xs font-medium">{perm.label}</span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleUserPermission(u, perm.key)}
                            className="w-5 h-5 accent-slate-950 rounded shrink-0"
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
