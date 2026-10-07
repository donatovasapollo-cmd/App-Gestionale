import React, { useCallback, useEffect, useState } from 'react';
import {
  LogOut,
  ArrowRight,
  FileText,
  Building2,
  LayoutDashboard,
  ClipboardCheck,
  Shield,
} from 'lucide-react';
import './firebase';
import {
  hasPermission,
  type ActivityLog,
  type ActivityType,
  type Client,
  type ClientFacility,
  type LocationMode,
  type Project,
  type Quote,
  type QuoteDurationType,
  type QuoteLineItem,
  type QuoteMacroCategory,
  type QuotePricingMode,
  type UserLevel,
  type UserPermissions,
  type UserPublicProfile,
} from './types';
import { LoginScreen } from './components/LoginScreen';
import { QuotesOrdersView } from './components/QuotesOrdersView';
import { ClientsProjectsView } from './components/ClientsProjectsView';
import { TimesheetView } from './components/TimesheetView';
import { TeamDirectoryView } from './components/TeamDirectoryView';

type ActiveTab = 'dashboard' | 'quotes' | 'clients' | 'timesheet' | 'team';

const SESSION_STORAGE_KEY = 'consuntivapro_auth_session_v2';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserPublicProfile | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!saved) return null;
      const parsed = JSON.parse(saved) as UserPublicProfile;
      if (!parsed || !parsed.uid || !parsed.level) return null;
      return parsed;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [preselectedProjectId, setPreselectedProjectId] = useState<string | null>(null);

  const [usersPublic, setUsersPublic] = useState<UserPublicProfile[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  const fetchServerState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (!res.ok) return;
      const data = (await res.json()) as {
        users: UserPublicProfile[];
        quotes: Quote[];
        clients: Client[];
        projects: Project[];
        activities: ActivityLog[];
      };
      setUsersPublic(data.users || []);
      setQuotes(data.quotes || []);
      setClients(data.clients || []);
      setProjects(data.projects || []);
      setActivities(data.activities || []);

      if (currentUser) {
        const freshMe = (data.users || []).find((u) => u.uid === currentUser.uid);
        if (freshMe) {
          setCurrentUser(freshMe);
          try {
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(freshMe));
          } catch {
            // ignore
          }
        }
      }
    } catch (err) {
      console.error('Failed to load server state:', err);
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    if (currentUser) {
      fetchServerState();
    }
  }, [currentUser?.uid, fetchServerState]);

  const handleLoginSuccess = (user: UserPublicProfile) => {
    setCurrentUser(user);
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // ignore
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const myProfile =
    usersPublic.find((u) => u.uid === currentUser.uid) || currentUser;
  const currentUserName = myProfile.displayName;

  // Evaluate Privilege Matrix Flags
  const canViewQuotes =
    hasPermission(myProfile, 'viewQuotes') ||
    hasPermission(myProfile, 'createQuotes') ||
    hasPermission(myProfile, 'receiveOrders');
  const canCreateQuotes = hasPermission(myProfile, 'createQuotes');
  const canReceiveOrders = hasPermission(myProfile, 'receiveOrders');
  const canViewClientsProjects = hasPermission(myProfile, 'viewClientsProjects');
  const canManageProjects = hasPermission(myProfile, 'manageProjects');
  const canLogActivities = hasPermission(myProfile, 'logActivities');
  const canViewAllActivities = hasPermission(myProfile, 'viewAllActivities');
  const canDeleteActivities = hasPermission(myProfile, 'deleteActivities');
  const canGenerateReport = hasPermission(myProfile, 'generateInterventionReport');
  const canManageUsers = hasPermission(myProfile, 'manageUsers');

  // 1. Client & Multi-Facility Management
  const handleCreateClient = async (data: {
    companyName: string;
    vatNumber: string;
    taxCode?: string;
    sdiCode: string;
    pecEmail?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    city?: string;
    address?: string;
    sector: string;
    notes?: string;
    facilities: ClientFacility[];
  }) => {
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        createdByUid: myProfile.uid,
      }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error || 'Errore creazione cliente');
    }
    await fetchServerState();
  };

  const handleUpdateClient = async (
    clientId: string,
    data: {
      companyName: string;
      vatNumber: string;
      taxCode?: string;
      sdiCode: string;
      pecEmail?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      city?: string;
      address?: string;
      sector: string;
      notes?: string;
      facilities: ClientFacility[];
    }
  ) => {
    const res = await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error || 'Errore aggiornamento cliente');
    }
    await fetchServerState();
  };

  // 2. Create Quote or New Revision
  const handleCreateQuote = async (data: {
    baseQuoteNumberForRevision?: string;
    macroCategory: QuoteMacroCategory;
    pricingMode: QuotePricingMode;
    durationType?: QuoteDurationType;
    contractYears?: number;
    clientId?: string;
    clientName: string;
    clientVat: string;
    clientSdi: string;
    clientCity: string;
    facilityId?: string;
    facilityName?: string;
    facilityAddress?: string;
    projectTitle: string;
    projectDescription: string;
    systemInfo?: string;
    extraCosts?: string;
    estimatedDays: number;
    dailyRate: number;
    dailyRates?: {
      engineer?: number;
      specialist?: number;
      consultant?: number;
    };
    lineItems: QuoteLineItem[];
  }) => {
    const res = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        createdByUid: myProfile.uid,
        createdByName: currentUserName,
      }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error || 'Errore creazione offerta');
    }
    await fetchServerState();
  };

  // 3. Receive Order -> Auto-create Client (if not exists) + Auto-create Project with activities
  const handleReceiveOrder = async (
    quote: Quote,
    orderNumber: string,
    orderDate: string,
    sector: string
  ) => {
    const res = await fetch(`/api/quotes/${quote.id}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNumber,
        orderDate,
        sector,
        userId: myProfile.uid,
      }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error || 'Errore registrazione ordine');
    }
    await fetchServerState();
  };

  // 4. Add Manual Activity Item to a Project
  const handleAddManualProjectItem = async (
    projectId: string,
    itemType: string,
    activityOrSpec: string
  ) => {
    const res = await fetch(`/api/projects/${projectId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemType, activityOrSpec }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error || 'Errore aggiunta attività');
    }
    await fetchServerState();
  };

  // 5a. Memorize Pending Worksheet on Project (saved in DB, visible to all users, not in Storico yet)
  const handleMemorizeWorksheet = async (
    projectId: string,
    worksheet: {
      calibrationRows?: any[];
      qualificationRows?: any[];
      complianceRows?: any[];
    }
  ) => {
    const res = await fetch(`/api/projects/${projectId}/worksheet`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...worksheet,
        updatedByName: currentUserName,
      }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error || 'Errore durante la memorizzazione attività');
    }
    await fetchServerState();
  };

  // 5b. Log Single or Multiple Executed Activities (Salva e Storicizza)
  const handleAddActivityBatch = async (data: {
    project: Project;
    items: {
      lineItemId?: string;
      lineItemTitle: string;
      description?: string;
      macroCategory?: QuoteMacroCategory;
      calibrationActivityType?: string;
      calibrationInstrumentType?: string;
      instrumentCount?: number;
      qualificationActivityType?: string;
      qualificationPhase?: string;
      machineType?: string;
      complianceDocumentType?: string;
      workplaceFlag?: 'cliente' | 'ufficio';
      executionDate?: string;
      executionDates?: string[];
      scadenza?: string;
      durationHours?: number;
      notes?: string;
      isExtra?: boolean;
    }[];
    nextPendingWorksheet?: {
      calibrationRows?: any[];
      qualificationRows?: any[];
      complianceRows?: any[];
    };
    executionDate: string;
    isFullDay: boolean;
    startTime: string;
    endTime: string;
    durationHours: number;
    activityType: ActivityType;
    locationMode: LocationMode;
    materialsNotes: string;
  }) => {
    const res = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: data.project.id,
        projectTitle: data.project.title,
        quoteNumber: data.project.quoteNumber,
        clientId: data.project.clientId,
        clientName: data.project.clientName,
        facilityName: data.project.facilityName || '',
        facilityAddress: data.project.facilityAddress || '',
        orderNumber: data.project.orderNumber,
        macroCategory: data.project.macroCategory || 'qualifica',
        clearPendingWorksheet: true,
        nextPendingWorksheet: data.nextPendingWorksheet,
        items: data.items,
        executionDate: data.executionDate,
        isFullDay: data.isFullDay,
        startTime: data.startTime,
        endTime: data.endTime,
        durationHours: data.durationHours,
        activityType: data.activityType,
        locationMode: data.locationMode,
        materialsNotes: data.materialsNotes,
        technicianUid: myProfile.uid,
        technicianName: currentUserName,
      }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error || 'Errore salvataggio esecuzione attività');
    }
    await fetchServerState();
  };

  const handleDeleteActivity = async (activityId: string) => {
    await fetch(`/api/activities/${activityId}`, { method: 'DELETE' });
    await fetchServerState();
  };

  const handleCompleteProject = async (project: Project) => {
    await fetch(`/api/projects/${project.id}/status`, { method: 'PATCH' });
    await fetchServerState();
  };

  // 6. User Management & Privilege Matrix Handlers
  const handleCreateNewOperator = async (data: {
    username: string;
    password: string;
    displayName: string;
    level: UserLevel;
    department: string;
    permissions: UserPermissions;
  }) => {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) {
      throw new Error(body.error || 'Errore creazione utente');
    }
    await fetchServerState();
  };

  const handleUpdateUser = async (
    uid: string,
    data: {
      displayName?: string;
      username?: string;
      level?: UserLevel;
      department?: string;
      newPassword?: string;
      permissions?: UserPermissions;
    }
  ) => {
    const res = await fetch(`/api/users/${uid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      await fetchServerState();
    }
  };

  const handleDeleteUser = async (uid: string) => {
    const res = await fetch(`/api/users/${uid}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      await fetchServerState();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col pb-20 md:pb-0">
      {/* Top Bar Contract: Strict 1-row, 3-zone header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#dashboard"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('dashboard');
            }}
            className="text-base sm:text-lg font-bold tracking-tight text-slate-950 whitespace-nowrap"
          >
            GestionApp
          </a>

          {/* Zone 2: Clean desktop text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`py-1 transition-colors whitespace-nowrap cursor-pointer border-b-2 ${
                activeTab === 'dashboard'
                  ? 'border-slate-950 text-slate-950 font-semibold'
                  : 'border-transparent hover:text-slate-950'
              }`}
            >
              Home
            </button>

            {canViewClientsProjects && (
              <button
                type="button"
                onClick={() => setActiveTab('clients')}
                className={`py-1 transition-colors whitespace-nowrap cursor-pointer border-b-2 ${
                  activeTab === 'clients'
                    ? 'border-slate-950 text-slate-950 font-semibold'
                    : 'border-transparent hover:text-slate-950'
                }`}
              >
                Clienti
              </button>
            )}

            {canViewQuotes && (
              <button
                type="button"
                onClick={() => setActiveTab('quotes')}
                className={`py-1 transition-colors whitespace-nowrap cursor-pointer border-b-2 ${
                  activeTab === 'quotes'
                    ? 'border-slate-950 text-slate-950 font-semibold'
                    : 'border-transparent hover:text-slate-950'
                }`}
              >
                Offerte & Ordini
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('timesheet')}
              className={`py-1 transition-colors whitespace-nowrap cursor-pointer border-b-2 ${
                activeTab === 'timesheet'
                  ? 'border-slate-950 text-slate-950 font-semibold'
                  : 'border-transparent hover:text-slate-950'
              }`}
            >
              Attività
            </button>

            {canManageUsers && (
              <button
                type="button"
                onClick={() => setActiveTab('team')}
                className={`py-1 transition-colors whitespace-nowrap cursor-pointer border-b-2 ${
                  activeTab === 'team'
                    ? 'border-slate-950 text-slate-950 font-semibold'
                    : 'border-transparent hover:text-slate-950'
                }`}
              >
                Utenti & Privilegi
              </button>
            )}
          </nav>

          {/* Zone 3: Single Clean User / Logout Action */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLogout}
              className="min-h-[40px] px-3.5 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer"
              title="Esci / Cambia Utente"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="max-w-[130px] sm:max-w-none truncate">{currentUserName}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-5 sm:py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-5">
              <div className="text-xs text-slate-500 font-mono tabular-nums flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                  Utente: <strong className="text-slate-900">{currentUserName}</strong> ({myProfile.username})
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Livello:{' '}
                  <strong className="text-slate-900">
                    {myProfile.level === 'admin' ? 'Amministratore' : 'Operatore'}
                  </strong>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 mt-1">
                GestionApp
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Piattaforma di gestione quotazioni, ordini e attività
              </p>
            </div>

            {/* Clean & Uniform Navigation Cards with Identical Black Buttons and Logic */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {canViewClientsProjects && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <div className="text-xs font-mono text-slate-500 font-semibold">
                      01. PAGINA CLIENTI
                    </div>
                    <h3 className="text-sm font-bold text-slate-950">
                      Anagrafica Clienti & Stabilimenti
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Accedi alla pagina per inserire e gestire l’anagrafica dei clienti, tutte le relative informazioni e gli stabilimenti operativi.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('clients')}
                    className="min-h-[42px] px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-between gap-2 cursor-pointer transition-colors"
                  >
                    <span>Vai alla Pagina Clienti</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {canViewQuotes && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <div className="text-xs font-mono text-slate-500 font-semibold">
                      02. PAGINA OFFERTE & ORDINI
                    </div>
                    <h3 className="text-sm font-bold text-slate-950">
                      Gestione Offerte, Revisioni & Ordini
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Accedi alla pagina per creare e revisionare le offerte commerciali (Rev. 00, 01...), confermare gli ordini e consultare lo storico.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('quotes')}
                    className="min-h-[42px] px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-between gap-2 cursor-pointer transition-colors"
                  >
                    <span>Vai alla Pagina Offerte & Ordini</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <div className="text-xs font-mono text-slate-500 font-semibold">
                    03. PAGINA ATTIVITÀ
                  </div>
                  <h3 className="text-sm font-bold text-slate-950">
                    Gestione Attività, Storico & Reportino
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Accedi alla pagina per compilare, memorizzare e storicizzare le attività di Taratura, Qualifica e Compliance e stampare il Reportino PDF.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('timesheet')}
                  className="min-h-[42px] px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-between gap-2 cursor-pointer transition-colors"
                >
                  <span>Vai alla Pagina Attività</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {canManageUsers && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <div className="text-xs font-mono text-slate-500 font-semibold">
                      04. PAGINA UTENTI & PRIVILEGI
                    </div>
                    <h3 className="text-sm font-bold text-slate-950">
                      Gestione Utenti, Ruoli & Privilegi
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Accedi alla pagina per inserire gli utenti aziendali e configurare la matrice dei privilegi operativi.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('team')}
                    className="min-h-[42px] px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-between gap-2 cursor-pointer transition-colors"
                  >
                    <span>Vai alla Pagina Utenti & Privilegi</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'quotes' && canViewQuotes && (
          <QuotesOrdersView
            quotes={quotes}
            clients={clients}
            projects={projects}
            activities={activities}
            canCreateQuotes={canCreateQuotes}
            canReceiveOrders={canReceiveOrders}
            onCreateQuote={handleCreateQuote}
            onReceiveOrder={handleReceiveOrder}
            onOpenProjectActivities={(projectId) => {
              setPreselectedProjectId(projectId);
              setActiveTab('timesheet');
            }}
          />
        )}

        {activeTab === 'clients' && canViewClientsProjects && (
          <ClientsProjectsView
            clients={clients}
            projects={projects}
            activities={activities}
            currentUserName={currentUserName}
            canManageProjects={canManageProjects}
            canLogActivities={canLogActivities}
            onCreateClient={handleCreateClient}
            onUpdateClient={handleUpdateClient}
            onSelectProjectForTimesheet={(projectId) => {
              setPreselectedProjectId(projectId);
              setActiveTab('timesheet');
            }}
            onCompleteProject={handleCompleteProject}
          />
        )}

        {activeTab === 'timesheet' && (
          <TimesheetView
            projects={projects}
            clients={clients}
            activities={activities}
            currentUserUid={myProfile.uid}
            currentUserName={currentUserName}
            canLogActivities={canLogActivities}
            canViewAllActivities={canViewAllActivities}
            canDeleteActivities={canDeleteActivities}
            canGenerateReport={canGenerateReport}
            preselectedProjectId={preselectedProjectId}
            onAddManualProjectItem={handleAddManualProjectItem}
            onMemorizeWorksheet={handleMemorizeWorksheet}
            onAddActivityBatch={handleAddActivityBatch}
            onDeleteActivity={handleDeleteActivity}
          />
        )}

        {activeTab === 'team' && canManageUsers && (
          <TeamDirectoryView
            users={usersPublic}
            currentUserProfile={myProfile}
            onCreateNewOperator={handleCreateNewOperator}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 px-2 py-1.5 flex items-center justify-around gap-1 shadow-lg">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 min-h-[48px] flex flex-col items-center justify-center rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
            activeTab === 'dashboard' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 mb-0.5" />
          <span>Home</span>
        </button>

        {canViewClientsProjects && (
          <button
            type="button"
            onClick={() => setActiveTab('clients')}
            className={`flex-1 min-h-[48px] flex flex-col items-center justify-center rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              activeTab === 'clients' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-4 h-4 mb-0.5" />
            <span>Clienti</span>
          </button>
        )}

        {canViewQuotes && (
          <button
            type="button"
            onClick={() => setActiveTab('quotes')}
            className={`flex-1 min-h-[48px] flex flex-col items-center justify-center rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              activeTab === 'quotes' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4 mb-0.5" />
            <span>Offerte</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('timesheet')}
          className={`flex-1 min-h-[48px] flex flex-col items-center justify-center rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
            activeTab === 'timesheet' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ClipboardCheck className="w-4 h-4 mb-0.5" />
          <span>Attività</span>
        </button>

        {canManageUsers && (
          <button
            type="button"
            onClick={() => setActiveTab('team')}
            className={`flex-1 min-h-[48px] flex flex-col items-center justify-center rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              activeTab === 'team' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Shield className="w-4 h-4 mb-0.5" />
            <span>Utenti</span>
          </button>
        )}
      </nav>
    </div>
  );
}
