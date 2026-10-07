export type UserLevel = 'admin' | 'operatore';

export interface UserPermissions {
  viewQuotes: boolean;
  createQuotes: boolean;
  receiveOrders: boolean;
  viewClientsProjects: boolean;
  manageProjects: boolean;
  logActivities: boolean;
  viewAllActivities: boolean;
  deleteActivities: boolean;
  generateInterventionReport: boolean;
  manageUsers: boolean;
}

export const ALL_PERMISSIONS_TRUE: UserPermissions = {
  viewQuotes: true,
  createQuotes: true,
  receiveOrders: true,
  viewClientsProjects: true,
  manageProjects: true,
  logActivities: true,
  viewAllActivities: true,
  deleteActivities: true,
  generateInterventionReport: true,
  manageUsers: true,
};

export const DEFAULT_OPERATOR_PERMISSIONS: UserPermissions = {
  viewQuotes: false,
  createQuotes: false,
  receiveOrders: false,
  viewClientsProjects: true,
  manageProjects: false,
  logActivities: true,
  viewAllActivities: false,
  deleteActivities: false,
  generateInterventionReport: true,
  manageUsers: false,
};

export const PERMISSION_DEFINITIONS: {
  key: keyof UserPermissions;
  label: string;
  shortLabel: string;
  description: string;
}[] = [
  {
    key: 'viewQuotes',
    label: 'Visualizza Offerte & Ordini',
    shortLabel: 'Vedi Offerte',
    description: 'Consultazione elenco offerte commerciali, revisioni e stato ordini.',
  },
  {
    key: 'createQuotes',
    label: 'Genera / Revisiona Offerte & PDF',
    shortLabel: 'Crea/Rev. Offerte',
    description: 'Creazione nuove offerte, emissione revisioni (Rev. 00, 01, 02...) e stampa PDF.',
  },
  {
    key: 'receiveOrders',
    label: 'Ricezione Ordini (Crea Cliente/Progetto)',
    shortLabel: 'Ricevi Ordini',
    description: 'Conferma ordine cliente con creazione automatica cliente e progetto.',
  },
  {
    key: 'viewClientsProjects',
    label: 'Gestione Anagrafica Clienti & Stabilimenti',
    shortLabel: 'Anagrafica Clienti',
    description: 'Inserimento e gestione anagrafica clienti con tutte le informazioni e stabilimenti.',
  },
  {
    key: 'manageProjects',
    label: 'Gestione Stato Progetti',
    shortLabel: 'Chiudi Progetti',
    description: 'Possibilità di contrassegnare un progetto come completato.',
  },
  {
    key: 'logActivities',
    label: 'Compilazione Attività (Memorizza / Storicizza)',
    shortLabel: 'Segna Attività',
    description: 'Compilazione tabelle Taratura, Qualifica e Compliance, Memorizza e Storicizza.',
  },
  {
    key: 'generateInterventionReport',
    label: 'Genera Reportino PDF con Firma Digitale',
    shortLabel: 'Reportino PDF',
    description: 'Generazione Reportino PDF filtrato per data/progetto (Copia Cliente + Amministrazione).',
  },
  {
    key: 'viewAllActivities',
    label: 'Visualizza Attività di Tutti i Tecnici',
    shortLabel: 'Vedi Tutti i Tecnici',
    description: 'Se disattivato, l’operatore vede esclusivamente le proprie esecuzioni.',
  },
  {
    key: 'deleteActivities',
    label: 'Elimina Esecuzioni Attività',
    shortLabel: 'Elimina Attività',
    description: 'Cancellazione di righe attività storicizzate.',
  },
  {
    key: 'manageUsers',
    label: 'Gestione Utenti & Matrice Privilegi',
    shortLabel: 'Gestione Utenti',
    description: 'Creazione utenti e modifica della matrice dei privilegi.',
  },
];

export interface UserPublicProfile {
  id: string;
  uid: string;
  username: string;
  displayName: string;
  level: UserLevel;
  department: string;
  permissions: UserPermissions;
  orgId: 'enterprise_hq';
}

export function hasPermission(
  user: UserPublicProfile | null,
  perm: keyof UserPermissions
): boolean {
  if (!user) return false;
  if (user.level === 'admin') return true;
  return Boolean(user.permissions?.[perm]);
}

export type QuoteMacroCategory = 'qualifica' | 'compliance' | 'taratura';

export type QuoteDurationType = 'singola' | 'annuale' | 'multianno';

export const DURATION_TYPE_LABELS: Record<QuoteDurationType, string> = {
  singola: 'Singola volta',
  annuale: 'Annuale',
  multianno: 'Multianno',
};

export type QuotePricingMode =
  | 'consuntivo_giornate'
  | 'progetto_equipment'
  | 'a_strumento'
  | 'consuntivo_strumento';

export const MACRO_CATEGORY_LABELS: Record<QuoteMacroCategory, string> = {
  qualifica: 'Qualifica',
  compliance: 'Compliance',
  taratura: 'Taratura',
};

export const PRICING_MODE_LABELS: Record<QuotePricingMode, string> = {
  consuntivo_giornate: 'A Consuntivo (Valorizzazione a Giornate)',
  progetto_equipment: 'A Progetto / Ad Attività (Forfait su Lista Equipment)',
  a_strumento: 'A Strumento (Valorizzazione Strumento per Strumento)',
  consuntivo_strumento: 'Consuntivo a Strumento (Quotazione Unitaria per Tipologia)',
};

// TARATURA: Colonna 1 - Tipo Attività
export type CalibrationActivityType =
  | 'Taratura'
  | 'Certificato'
  | 'Etichette'
  | 'Taratura + Etichette'
  | 'Tarature + Certificato (Gentium)'
  | 'Taratura + Certificato + Etichette';

export const CALIBRATION_ACTIVITY_TYPES: CalibrationActivityType[] = [
  'Taratura',
  'Certificato',
  'Etichette',
  'Taratura + Etichette',
  'Tarature + Certificato (Gentium)',
  'Taratura + Certificato + Etichette',
];

// TARATURA: Colonna 2 - Tipo Strumento
export type CalibrationInstrumentType =
  | 'Temperatura'
  | 'Umidità'
  | 'Pressione'
  | 'Pressione differenziale'
  | 'Portata'
  | 'Massa'
  | 'Conta litri'
  | 'Conducibilità'
  | 'pH'
  | 'Redox'
  | 'Convertitori';

export const CALIBRATION_INSTRUMENT_TYPES: CalibrationInstrumentType[] = [
  'Temperatura',
  'Umidità',
  'Pressione',
  'Pressione differenziale',
  'Portata',
  'Massa',
  'Conta litri',
  'Conducibilità',
  'pH',
  'Redox',
  'Convertitori',
];

// QUALIFICA: Voci menù a tendina Tipologia Attività
export type QualificationActivityType =
  | 'Scrittura protocollo'
  | 'Esecuzione attività'
  | 'Compilazione protocollo'
  | 'Scrittura report';

export const QUALIFICATION_ACTIVITY_TYPES: QualificationActivityType[] = [
  'Scrittura protocollo',
  'Esecuzione attività',
  'Compilazione protocollo',
  'Scrittura report',
];

// QUALIFICA: Sottomenù collegato a Tipologia Attività
export type QualificationPhase = 'FAT' | 'SAT' | 'IQ' | 'OQ' | 'IOQ' | 'PQ';

export const QUALIFICATION_PHASES: QualificationPhase[] = [
  'FAT',
  'SAT',
  'IQ',
  'OQ',
  'IOQ',
  'PQ',
];

export type WorkplaceFlag = 'cliente' | 'ufficio';
export type QualificationWorkplaceFlag = WorkplaceFlag;

// Righe in lavorazione ("Memorizza" sul database, visibili a tutti prima dello "Salva e Storicizza")
export interface PendingCalibrationRow {
  id: string;
  selected?: boolean;
  calibrationActivityType: CalibrationActivityType;
  instrumentType: CalibrationInstrumentType;
  instrumentNumber: number;
  executionDates: string[]; // Una data o una serie di date
  scadenza?: string; // Es. "30 Ottobre 2027" per commesse multianno dopo storicizzazione anno precedente
  notes: string;
  isExtra: boolean;
  workplaceFlag: WorkplaceFlag;
}

export interface PendingQualificationRow {
  id: string;
  selected?: boolean;
  activityType: QualificationActivityType;
  phase: QualificationPhase;
  machineType: string;
  executionDates: string[]; // Una data o una serie di date
  scadenza?: string; // Es. "30 Ottobre 2027" per commesse multianno
  hours: number;
  notes: string;
  isExtra: boolean;
  workplaceFlag: WorkplaceFlag;
}

export interface PendingComplianceRow {
  id: string;
  selected?: boolean;
  documentType: string; // Colonna libera "Tipologia Documento"
  executionDates: string[]; // Una data o una serie di date
  scadenza?: string; // Es. "30 Ottobre 2027" per commesse multianno
  notes: string;
  isExtra: boolean;
  workplaceFlag: WorkplaceFlag;
}

export interface ProjectPendingWorksheet {
  calibrationRows: PendingCalibrationRow[];
  qualificationRows: PendingQualificationRow[];
  complianceRows: PendingComplianceRow[];
  updatedAt?: string;
  updatedByName?: string;
}

export interface QuoteLineItem {
  id: string;
  itemType: string;
  activityOrSpec: string;
  plannedTests?: string[];
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  addedManuallyInProject?: boolean;
}

export const QUALIFICATION_QUOTE_ACTIVITIES: string[] = [
  'Scrittura Protocollo',
  'IQ',
  'OQ',
  'IOQ',
  'PQ',
  'FAT',
  'SAT',
  'Esecuzione Protocollo',
  'Scrittura Protocollo IQ',
  'Scrittura Protocollo OQ',
  'Scrittura Protocollo IOQ',
  'Scrittura Protocollo PQ',
  'Esecuzione IQ',
  'Esecuzione OQ',
  'Esecuzione IOQ',
  'Esecuzione PQ',
  'Report di Qualifica',
  'Rivalidazione / Riqualifica',
  'Mappatura Termica',
];

export type QuoteStatus = 'sent' | 'accepted' | 'superseded' | 'cancelled';

export interface ClientFacility {
  id: string;
  name: string;
  address: string;
  city: string;
}

export interface Client {
  id: string;
  companyName: string;
  vatNumber: string;
  taxCode?: string;
  sdiCode: string;
  pecEmail?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  city: string;
  address?: string;
  sector: string;
  notes?: string;
  facilities: ClientFacility[];
  sourceQuoteNumber: string;
  orgId: 'enterprise_hq';
  createdByUid: string;
}

export interface QuoteDailyRates {
  engineer?: number;
  specialist?: number;
  consultant?: number;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  revision: number;
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
  dailyRates?: QuoteDailyRates;
  lineItems: QuoteLineItem[];
  estimatedHours: number;
  hourlyRate: number;
  totalAmount: number;
  status: QuoteStatus;
  orderNumber: string;
  orderDate: string;
  linkedClientId: string;
  linkedProjectId: string;
  createdAt: string;
  orgId: 'enterprise_hq';
  createdByUid: string;
  createdByName: string;
}

export function formatRevision(revision: number | undefined | null): string {
  const revNum = typeof revision === 'number' && !isNaN(revision) ? Math.max(0, revision) : 0;
  return String(revNum).padStart(2, '0');
}

export function formatQuoteCodeWithRev(quoteNumber: string, revision: number): string {
  return `${quoteNumber} Rev. ${formatRevision(revision)}`;
}

export type ProjectStatus = 'active' | 'completed';

export interface Project {
  id: string;
  clientId: string;
  clientName: string;
  clientVat: string;
  facilityId?: string;
  facilityName?: string;
  facilityAddress?: string;
  clientCity?: string;
  quoteId: string;
  quoteNumber: string;
  quoteRevision?: number;
  macroCategory?: QuoteMacroCategory;
  pricingMode?: QuotePricingMode;
  durationType?: QuoteDurationType;
  contractYears?: number;
  completedYearsCount?: number;
  estimatedDays?: number;
  dailyRate?: number;
  dailyRates?: QuoteDailyRates;
  lineItems: QuoteLineItem[];
  pendingWorksheet?: ProjectPendingWorksheet; // Stato memorizzato ("Memorizza") condiviso sul DB
  orderNumber: string;
  orderDate: string;
  title: string;
  description: string;
  systemInfo?: string;
  extraCosts?: string;
  budgetHours: number;
  hourlyRate: number;
  totalContractAmount?: number;
  status: ProjectStatus;
  orgId: 'enterprise_hq';
  createdByUid: string;
}

export type ActivityType =
  | 'qualifica'
  | 'compliance'
  | 'taratura'
  | 'installazione'
  | 'configurazione'
  | 'sviluppo'
  | 'manutenzione'
  | 'collaudo'
  | 'formazione'
  | 'supporto';

export type LocationMode = 'onsite' | 'remoto' | 'trasferta';

export interface ActivityLog {
  id: string;
  reportNumber: string;
  projectId: string;
  projectTitle: string;
  quoteNumber?: string;
  clientId: string;
  clientName: string;
  facilityName?: string;
  facilityAddress?: string;
  orderNumber: string;
  macroCategory?: QuoteMacroCategory;
  // Campi specifici Taratura
  calibrationActivityType?: CalibrationActivityType;
  calibrationInstrumentType?: CalibrationInstrumentType;
  instrumentCount?: number;
  // Campi specifici Qualifica
  qualificationActivityType?: QualificationActivityType;
  qualificationPhase?: QualificationPhase;
  machineType?: string;
  // Campi specifici Compliance
  complianceDocumentType?: string;
  // Campi comuni
  workplaceFlag?: WorkplaceFlag; // 'cliente' | 'ufficio'
  isExtra?: boolean; // false = Ordinaria, true = Extra
  scadenza?: string;
  cycleYearNumber?: number;
  notes?: string;
  lineItemId?: string;
  lineItemTitle?: string;
  executionDate: string;
  executionDates?: string[]; // Serie di date associate alla riga
  isFullDay?: boolean;
  startTime: string;
  endTime: string;
  durationHours: number;
  activityType: ActivityType;
  locationMode: LocationMode;
  description: string;
  materialsNotes: string;
  clientSignerName: string;
  clientSignatureDataUrl?: string;
  technicianSignatureDataUrl?: string;
  technicianUid: string;
  technicianName: string;
  createdAt?: string;
  orgId: 'enterprise_hq';
}
