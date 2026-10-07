import React, { useState, useEffect, useRef } from 'react';
import {
  Printer,
  Plus,
  Trash2,
  Calendar,
  PenTool,
  RotateCcw,
  Check,
  MapPin,
  X,
  Save,
  History,
  FileSpreadsheet,
  Wrench,
  ClipboardList,
  FileCheck2,
  BookmarkCheck,
  Building2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  CALIBRATION_ACTIVITY_TYPES,
  CALIBRATION_INSTRUMENT_TYPES,
  DURATION_TYPE_LABELS,
  QUALIFICATION_ACTIVITY_TYPES,
  QUALIFICATION_PHASES,
  type ActivityLog,
  type ActivityType,
  type CalibrationActivityType,
  type CalibrationInstrumentType,
  type Client,
  type LocationMode,
  type PendingCalibrationRow,
  type PendingComplianceRow,
  type PendingQualificationRow,
  type Project,
  type QualificationActivityType,
  type QualificationPhase,
  type QuoteMacroCategory,
  type WorkplaceFlag,
} from '../types';
import {
  formatItalianDate,
  generateConsuntivoPdf,
} from '../utils/pdfGenerator';

// Dynamic Auto-Expanding Textarea so cells grow automatically and text is always 100% readable
const AutoResizeTextarea: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder, className = '' }) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(38, el.scrollHeight)}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 leading-relaxed whitespace-pre-wrap break-words overflow-hidden resize-y focus:outline-none focus:ring-2 focus:ring-slate-950 ${className}`}
    />
  );
};

// Multi-Date / Date Series Cell Component ("possibilità di inserire la data o più date o una serie di date")
const MultiDateCell: React.FC<{
  dates: string[];
  onChange: (newDates: string[]) => void;
}> = ({ dates, onChange }) => {
  const handleAddDate = (newDate: string) => {
    if (!newDate) return;
    if (!dates.includes(newDate)) {
      const sorted = [...dates, newDate].sort();
      onChange(sorted);
    }
  };

  const handleRemoveDate = (target: string) => {
    onChange(dates.filter((d) => d !== target));
  };

  const handleReplaceSingleDate = (idx: number, val: string) => {
    if (!val) {
      onChange(dates.filter((_, i) => i !== idx));
      return;
    }
    const copy = [...dates];
    copy[idx] = val;
    const uniqueSorted = Array.from(new Set(copy)).sort();
    onChange(uniqueSorted);
  };

  return (
    <div className="space-y-1.5 min-w-[165px]">
      {dates.length === 0 ? (
        <div className="inline-flex items-center gap-1 bg-slate-50 border border-dashed border-slate-300 rounded-md px-2 py-1 text-[11px] font-mono text-slate-600">
          <input
            type="date"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                handleAddDate(e.target.value);
              }
            }}
            className="bg-transparent font-mono text-[11px] font-bold text-slate-900 focus:outline-none cursor-pointer"
          />
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {dates.map((d, idx) => (
            <div
              key={d + idx}
              className="inline-flex items-center gap-1 bg-slate-100 border border-slate-300 rounded-md px-1.5 py-0.5 text-[11px] font-mono text-slate-900"
            >
              <input
                type="date"
                value={d}
                onChange={(e) => handleReplaceSingleDate(idx, e.target.value)}
                className="bg-transparent font-mono text-[11px] font-bold text-slate-900 focus:outline-none cursor-pointer"
              />
              <button
                type="button"
                onClick={() => handleRemoveDate(d)}
                className="text-slate-400 hover:text-red-600 font-bold px-0.5 cursor-pointer"
                title="Rimuovi questa data"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1">
        <label className="inline-flex items-center gap-1 text-[10px] font-semibold text-white bg-slate-950 hover:bg-slate-800 rounded px-2 py-0.5 cursor-pointer transition-colors">
          <Plus className="w-3 h-3" />
          <span>+ Data</span>
          <input
            type="date"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                handleAddDate(e.target.value);
                e.target.value = '';
              }
            }}
            className="w-4 h-4 opacity-0 absolute pointer-events-auto cursor-pointer"
          />
        </label>
        {dates.length > 1 && (
          <span className="text-[10px] font-mono text-slate-500">
            ({dates.length} gg)
          </span>
        )}
      </div>
    </div>
  );
};

// Helper to generate all ISO dates between start and end inclusive
function getDatesInRange(startDate: string, endDate: string): string[] {
  if (!startDate) return [];
  if (!endDate || endDate < startDate) return [startDate];
  const result: string[] = [];
  const curr = new Date(startDate + 'T00:00:00');
  const last = new Date(endDate + 'T00:00:00');
  let safety = 0;
  while (curr <= last && safety < 60) {
    result.push(curr.toISOString().slice(0, 10));
    curr.setDate(curr.getDate() + 1);
    safety++;
  }
  return result;
}

const ITALIAN_MONTH_NAMES = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

/**
 * Calcola la Scadenza dell'anno successivo a partire dalla data di esecuzione:
 * "Diciamo, l'anno prima è stata fatta il 10 ottobre, quindi l'anno dopo sarà scadenza il 30 ottobre"
 */
function computeNextYearScadenzaFromDates(dates: string[]): string {
  const validDates = (dates || []).filter(Boolean).sort();
  const refIso = validDates[validDates.length - 1] || new Date().toISOString().slice(0, 10);
  const parts = refIso.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    if (!isNaN(year) && monthIdx >= 0 && monthIdx < 12) {
      const nextYear = year + 1;
      const day = monthIdx === 1 ? '28' : '30';
      return `${day} ${ITALIAN_MONTH_NAMES[monthIdx]} ${nextYear}`;
    }
  }
  return '30 Ottobre';
}

/**
 * NON-ADDITIVE CALIBRATION COUNT HELPER:
 * "Per quanto riguarda la tipologia tarature, solo la tipologia tarature, devi fare il conteggio perché devo consuntivare quante cose ho fatto nell'arco dell'attività.
 * Quindi di conseguenza devi contare per la stessa tipologia strumento se è stato valorizzato il numero che hai in tarature, etichette e certificati, ma non li devi sommare,
 * cioè se un giorno ho fatto solo taratura, un giorno ho fatto i certificati, un giorno ho fatto le etichette, allora dello stesso numero lo conti una volta quel numero."
 */
function calculateUniqueInstrumentCount(
  rows: {
    calibrationActivityType?: string;
    instrumentNumber: number;
  }[]
): {
  uniqueCount: number;
  taraturaCount: number;
  certificatoCount: number;
  etichetteCount: number;
} {
  let taraturaCount = 0;
  let certificatoCount = 0;
  let etichetteCount = 0;

  for (const r of rows) {
    const num = Math.max(0, Number(r.instrumentNumber) || 0);
    const act = r.calibrationActivityType || 'Taratura';

    if (
      act === 'Taratura' ||
      act === 'Taratura + Etichette' ||
      act === 'Tarature + Certificato (Gentium)' ||
      act === 'Taratura + Certificato (Gentium)' ||
      act === 'Taratura + Certificato + Etichette'
    ) {
      taraturaCount += num;
    }
    if (
      act === 'Certificato' ||
      act === 'Tarature + Certificato (Gentium)' ||
      act === 'Taratura + Certificato (Gentium)' ||
      act === 'Taratura + Certificato + Etichette'
    ) {
      certificatoCount += num;
    }
    if (
      act === 'Etichette' ||
      act === 'Taratura + Etichette' ||
      act === 'Taratura + Certificato + Etichette'
    ) {
      etichetteCount += num;
    }
  }

  // Do NOT sum Taratura + Certificato + Etichette: take the max across the three phases so the same batch of instruments is counted once
  const uniqueCount = Math.max(taraturaCount, certificatoCount, etichetteCount);

  return {
    uniqueCount,
    taraturaCount,
    certificatoCount,
    etichetteCount,
  };
}

interface TimesheetViewProps {
  projects: Project[];
  clients: Client[];
  activities: ActivityLog[];
  currentUserUid: string;
  currentUserName: string;
  canLogActivities: boolean;
  canViewAllActivities: boolean;
  canDeleteActivities: boolean;
  canGenerateReport: boolean;
  preselectedProjectId: string | null;
  onAddManualProjectItem: (
    projectId: string,
    itemType: string,
    activityOrSpec: string
  ) => Promise<void>;
  onMemorizeWorksheet: (
    projectId: string,
    worksheet: {
      calibrationRows?: PendingCalibrationRow[];
      qualificationRows?: PendingQualificationRow[];
      complianceRows?: PendingComplianceRow[];
    }
  ) => Promise<void>;
  onAddActivityBatch: (data: {
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
      calibrationRows?: PendingCalibrationRow[];
      qualificationRows?: PendingQualificationRow[];
      complianceRows?: PendingComplianceRow[];
    };
    executionDate: string;
    isFullDay: boolean;
    startTime: string;
    endTime: string;
    durationHours: number;
    activityType: ActivityType;
    locationMode: LocationMode;
    materialsNotes: string;
  }) => Promise<void>;
  onDeleteActivity: (activityId: string) => Promise<void>;
}

export const TimesheetView: React.FC<TimesheetViewProps> = ({
  projects,
  clients,
  activities,
  currentUserUid,
  currentUserName,
  canLogActivities,
  canViewAllActivities,
  canDeleteActivities,
  canGenerateReport,
  preselectedProjectId,
  onMemorizeWorksheet,
  onAddActivityBatch,
  onDeleteActivity,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'compilazione' | 'storico'>('compilazione');

  const unlockedProjects = projects.filter(
    (p) => Boolean(p.orderNumber && p.orderNumber.trim() !== '') && p.status !== 'completed'
  );

  const [selectedClientFilter, setSelectedClientFilter] = useState<string>(
    unlockedProjects[0]?.clientId || 'all'
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    preselectedProjectId || (unlockedProjects[0]?.id ?? '')
  );
  const [expandedStoricoClientKey, setExpandedStoricoClientKey] = useState<string | null>(null);

  const todayIso = new Date().toISOString().slice(0, 10);

  // Bulk Date / Date Series state for selected rows
  const [bulkDateStart, setBulkDateStart] = useState<string>(todayIso);
  const [bulkDateEnd, setBulkDateEnd] = useState<string>('');

  // 1) TARATURA Rows State
  const createDefaultCalibrationRow = (): PendingCalibrationRow => ({
    id: `cal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    selected: false,
    calibrationActivityType: 'Taratura',
    instrumentType: 'Temperatura',
    instrumentNumber: 1,
    executionDates: [todayIso],
    notes: '',
    isExtra: false,
    workplaceFlag: 'cliente',
  });

  // 2) QUALIFICA Rows State
  const createDefaultQualificationRow = (): PendingQualificationRow => ({
    id: `qual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    selected: false,
    activityType: 'Scrittura protocollo',
    phase: 'IQ',
    machineType: '',
    executionDates: [todayIso],
    hours: 4,
    notes: '',
    isExtra: false,
    workplaceFlag: 'cliente',
  });

  // 3) COMPLIANCE Rows State
  const createDefaultComplianceRow = (): PendingComplianceRow => ({
    id: `comp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    selected: false,
    documentType: '',
    executionDates: [todayIso],
    notes: '',
    isExtra: false,
    workplaceFlag: 'cliente',
  });

  const [calibrationRows, setCalibrationRows] = useState<PendingCalibrationRow[]>(() => [
    createDefaultCalibrationRow(),
  ]);
  const [qualificationRows, setQualificationRows] = useState<PendingQualificationRow[]>(() => [
    createDefaultQualificationRow(),
  ]);
  const [complianceRows, setComplianceRows] = useState<PendingComplianceRow[]>(() => [
    createDefaultComplianceRow(),
  ]);

  const [memorizing, setMemorizing] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);
  const [saveSuccessBanner, setSaveSuccessBanner] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Storico & Reportino Filter State
  const [reportFilterProjectId, setReportFilterProjectId] = useState<string>(
    preselectedProjectId || 'all'
  );
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');

  // Modal State for Generating Reportino with Digital Signatures
  const [showReportSignatureModal, setShowReportSignatureModal] = useState(false);
  const [clientSignerName, setClientSignerName] = useState('');
  const [hasClientSig, setHasClientSig] = useState(false);
  const [hasTechSig, setHasTechSig] = useState(false);

  const clientCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const techCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingTargetRef = useRef<'client' | 'tech' | null>(null);

  useEffect(() => {
    if (preselectedProjectId && unlockedProjects.some((p) => p.id === preselectedProjectId)) {
      const target = unlockedProjects.find((p) => p.id === preselectedProjectId);
      if (target) {
        setSelectedClientFilter(target.clientId);
      }
      setSelectedProjectId(preselectedProjectId);
      setReportFilterProjectId(preselectedProjectId);
    } else if (
      (!selectedProjectId || !unlockedProjects.some((p) => p.id === selectedProjectId)) &&
      unlockedProjects.length > 0
    ) {
      setSelectedProjectId(unlockedProjects[0].id);
    }
  }, [preselectedProjectId, projects, selectedProjectId]);

  const unlockedClientOptions = Array.from(
    new Map(unlockedProjects.map((p) => [p.clientId, p.clientName])).entries()
  );

  // Group unlocked projects by Client for the Client Card view
  const unlockedByClient = unlockedClientOptions.map(([cId, cName]) => {
    const clientProjs = unlockedProjects.filter((p) => p.clientId === cId);
    const clientObj = clients.find((c) => c.id === cId);
    return {
      clientId: cId,
      clientName: cName,
      clientVat: clientObj?.vatNumber || clientProjs[0]?.clientVat || '-',
      projects: clientProjs,
    };
  });

  // Group filtered historical activities by Client for the Storico Client Card view
  const getHistoricalByClient = (acts: ActivityLog[]) => {
    const map = new Map<
      string,
      {
        clientKey: string;
        clientId: string;
        clientName: string;
        activities: ActivityLog[];
      }
    >();
    for (const a of acts) {
      const key = a.clientId || a.clientName.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.activities.push(a);
      } else {
        map.set(key, {
          clientKey: key,
          clientId: a.clientId,
          clientName: a.clientName,
          activities: [a],
        });
      }
    }
    return Array.from(map.values());
  };

  const visibleUnlockedProjects =
    selectedClientFilter === 'all'
      ? unlockedProjects
      : unlockedProjects.filter((p) => p.clientId === selectedClientFilter);

  const selectedProject =
    visibleUnlockedProjects.find((p) => p.id === selectedProjectId) ||
    unlockedProjects.find((p) => p.id === selectedProjectId) ||
    null;

  // Load Memorized Pending Worksheet from DB whenever the selected project changes or updates
  useEffect(() => {
    if (!selectedProject) return;
    const ws = selectedProject.pendingWorksheet;

    if (ws?.calibrationRows && ws.calibrationRows.length > 0) {
      setCalibrationRows(
        ws.calibrationRows.map((r) => ({
          ...r,
          selected: false,
          calibrationActivityType: r.calibrationActivityType || 'Taratura',
          executionDates: Array.isArray(r.executionDates) ? r.executionDates : [todayIso],
          scadenza: r.scadenza || '',
          workplaceFlag: r.workplaceFlag || 'cliente',
        }))
      );
    } else if (
      selectedProject.macroCategory === 'taratura' &&
      Array.isArray(selectedProject.lineItems) &&
      selectedProject.lineItems.length > 0
    ) {
      setCalibrationRows(
        selectedProject.lineItems.map((li, idx) => ({
          id: `cal_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          selected: false,
          calibrationActivityType: 'Taratura',
          instrumentType: CALIBRATION_INSTRUMENT_TYPES.includes(li.itemType as any)
            ? (li.itemType as CalibrationInstrumentType)
            : 'Temperatura',
          instrumentNumber: Math.max(1, Number(li.quantity) || 1),
          executionDates: [todayIso],
          notes: li.activityOrSpec || '',
          isExtra: false,
          workplaceFlag: 'cliente',
        }))
      );
    } else {
      setCalibrationRows([createDefaultCalibrationRow()]);
    }

    if (ws?.qualificationRows && ws.qualificationRows.length > 0) {
      setQualificationRows(
        ws.qualificationRows.map((r) => ({
          ...r,
          selected: false,
          executionDates: Array.isArray(r.executionDates) ? r.executionDates : [todayIso],
          scadenza: r.scadenza || '',
          workplaceFlag: r.workplaceFlag || 'cliente',
        }))
      );
    } else {
      setQualificationRows([createDefaultQualificationRow()]);
    }

    if (ws?.complianceRows && ws.complianceRows.length > 0) {
      setComplianceRows(
        ws.complianceRows.map((r) => ({
          ...r,
          selected: false,
          executionDates: Array.isArray(r.executionDates) ? r.executionDates : [todayIso],
          scadenza: r.scadenza || '',
          workplaceFlag: r.workplaceFlag || 'cliente',
        }))
      );
    } else {
      setComplianceRows([createDefaultComplianceRow()]);
    }
  }, [selectedProject?.id, selectedProject?.pendingWorksheet?.updatedAt]);

  const commessaCategory: QuoteMacroCategory =
    selectedProject?.macroCategory || 'qualifica';

  // --- TARATURA HANDLERS ---
  const handleAddCalibrationRow = () => {
    setCalibrationRows((prev) => [...prev, createDefaultCalibrationRow()]);
  };

  const handleRemoveCalibrationRow = (id: string) => {
    if (calibrationRows.length <= 1) return;
    setCalibrationRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateCalibrationRow = <K extends keyof PendingCalibrationRow>(
    id: string,
    field: K,
    value: PendingCalibrationRow[K]
  ) => {
    setCalibrationRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  // --- QUALIFICA HANDLERS ---
  const handleAddQualificationRow = () => {
    setQualificationRows((prev) => [...prev, createDefaultQualificationRow()]);
  };

  const handleRemoveQualificationRow = (id: string) => {
    if (qualificationRows.length <= 1) return;
    setQualificationRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateQualificationRow = <K extends keyof PendingQualificationRow>(
    id: string,
    field: K,
    value: PendingQualificationRow[K]
  ) => {
    setQualificationRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  // --- COMPLIANCE HANDLERS ---
  const handleAddComplianceRow = () => {
    setComplianceRows((prev) => [...prev, createDefaultComplianceRow()]);
  };

  const handleRemoveComplianceRow = (id: string) => {
    if (complianceRows.length <= 1) return;
    setComplianceRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateComplianceRow = <K extends keyof PendingComplianceRow>(
    id: string,
    field: K,
    value: PendingComplianceRow[K]
  ) => {
    setComplianceRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  // --- BULK DATE / DATE SERIES ASSIGNMENT FOR SELECTED ROWS ---
  const handleApplyBulkDatesToSelected = (mode: 'replace' | 'append') => {
    const datesToApply = getDatesInRange(bulkDateStart, bulkDateEnd);
    if (datesToApply.length === 0) return;

    if (commessaCategory === 'taratura') {
      setCalibrationRows((prev) =>
        prev.map((r) => {
          if (!r.selected) return r;
          const merged =
            mode === 'replace'
              ? datesToApply
              : Array.from(new Set([...r.executionDates, ...datesToApply])).sort();
          return { ...r, executionDates: merged };
        })
      );
    } else if (commessaCategory === 'compliance') {
      setComplianceRows((prev) =>
        prev.map((r) => {
          if (!r.selected) return r;
          const merged =
            mode === 'replace'
              ? datesToApply
              : Array.from(new Set([...r.executionDates, ...datesToApply])).sort();
          return { ...r, executionDates: merged };
        })
      );
    } else {
      setQualificationRows((prev) =>
        prev.map((r) => {
          if (!r.selected) return r;
          const merged =
            mode === 'replace'
              ? datesToApply
              : Array.from(new Set([...r.executionDates, ...datesToApply])).sort();
          return { ...r, executionDates: merged };
        })
      );
    }
  };

  // --- CONSUNTIVO TARATURE (NON-ADDITIVE COUNT ACROSS TARATURA / CERTIFICATO / ETICHETTE) ---
  const calibrationDraftSummary = CALIBRATION_INSTRUMENT_TYPES.map((instrumentType) => {
    const matchingOrd = calibrationRows.filter(
      (r) => r.instrumentType === instrumentType && !r.isExtra
    );
    const matchingExt = calibrationRows.filter(
      (r) => r.instrumentType === instrumentType && r.isExtra
    );

    const ordStats = calculateUniqueInstrumentCount(matchingOrd);
    const extStats = calculateUniqueInstrumentCount(matchingExt);

    return {
      instrumentType,
      ordinarie: ordStats.uniqueCount,
      extra: extStats.uniqueCount,
      totale: ordStats.uniqueCount + extStats.uniqueCount,
      taraturaTot: ordStats.taraturaCount + extStats.taraturaCount,
      certificatoTot: ordStats.certificatoCount + extStats.certificatoCount,
      etichetteTot: ordStats.etichetteCount + extStats.etichetteCount,
    };
  });

  const totalCalibrationOrdinarie = calibrationDraftSummary.reduce((s, x) => s + x.ordinarie, 0);
  const totalCalibrationExtra = calibrationDraftSummary.reduce((s, x) => s + x.extra, 0);
  const totalCalibrationOverall = totalCalibrationOrdinarie + totalCalibrationExtra;

  // --- CONSUNTIVO QUALIFICA ---
  const qualificationDraftSummary = QUALIFICATION_ACTIVITY_TYPES.map((actType) => {
    const matching = qualificationRows.filter((r) => r.activityType === actType);
    const ordinarieRows = matching.filter((r) => !r.isExtra);
    const extraRows = matching.filter((r) => r.isExtra);

    const ordinarieCount = ordinarieRows.length;
    const extraCount = extraRows.length;
    const ordinarieHours = ordinarieRows.reduce((s, r) => s + (Number(r.hours) || 0), 0);
    const extraHours = extraRows.reduce((s, r) => s + (Number(r.hours) || 0), 0);

    return {
      activityType: actType,
      ordinarieCount,
      extraCount,
      totaleCount: ordinarieCount + extraCount,
      ordinarieHours,
      extraHours,
      totaleHours: ordinarieHours + extraHours,
    };
  });

  const totalQualOrdinarieCount = qualificationDraftSummary.reduce((s, x) => s + x.ordinarieCount, 0);
  const totalQualExtraCount = qualificationDraftSummary.reduce((s, x) => s + x.extraCount, 0);
  const totalQualOverallCount = totalQualOrdinarieCount + totalQualExtraCount;
  const totalQualOrdinarieHours = qualificationDraftSummary.reduce((s, x) => s + x.ordinarieHours, 0);
  const totalQualExtraHours = qualificationDraftSummary.reduce((s, x) => s + x.extraHours, 0);
  const totalQualOverallHours = totalQualOrdinarieHours + totalQualExtraHours;

  // --- 1. TASTO "MEMORIZZA" (SALVA IN DATABASE COME PENDING, NON VA NELLO STORICO) ---
  const handleMemorizeClick = async () => {
    if (!selectedProject) return;
    setSaveError(null);
    setSaveSuccessBanner(null);
    setMemorizing(true);
    try {
      await onMemorizeWorksheet(selectedProject.id, {
        calibrationRows,
        qualificationRows,
        complianceRows,
      });
      setSaveSuccessBanner(
        'Attività memorizzate sul database (in lavorazione / pending). Rimarranno visibili qui per te e per gli altri utenti finché non cliccherai su "Salva e Storicizza".'
      );
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Errore durante la memorizzazione');
    } finally {
      setMemorizing(false);
    }
  };

  // --- 2. TASTO "SALVA E STORICIZZA" (SALVA IN DATABASE NELLA TAB STORICO + GESTIONE MULTIANNO E SCADENZA) ---
  const handleSaveAndHistorize = async () => {
    if (!selectedProject) return;
    setSaveError(null);
    setSaveSuccessBanner(null);

    const totalContractYears =
      selectedProject.durationType === 'multianno'
        ? Math.max(2, selectedProject.contractYears || 2)
        : 1;
    const completedAfterThis = (selectedProject.completedYearsCount || 0) + 1;
    const shouldKeepTableForNextYear =
      selectedProject.durationType === 'multianno' &&
      completedAfterThis < totalContractYears;

    if (commessaCategory === 'taratura') {
      if (calibrationRows.length === 0) {
        setSaveError('Aggiungi almeno una riga di taratura prima di storicizzare.');
        return;
      }
      if (calibrationRows.some((r) => !r.executionDates || r.executionDates.length === 0 || !r.executionDates[0])) {
        setSaveError('Inserisci la data di esecuzione per tutte le righe di taratura prima di storicizzare.');
        return;
      }
      setSavingBatch(true);
      try {
        const renewedCalibrationRows: PendingCalibrationRow[] = calibrationRows.map((r) => ({
          ...r,
          selected: false,
          scadenza: computeNextYearScadenzaFromDates(r.executionDates),
          executionDates: [],
        }));

        await onAddActivityBatch({
          project: selectedProject,
          nextPendingWorksheet: shouldKeepTableForNextYear
            ? {
                calibrationRows: renewedCalibrationRows,
                qualificationRows: [],
                complianceRows: [],
              }
            : undefined,
          items: calibrationRows.map((r) => {
            const locLabel = r.workplaceFlag === 'ufficio' ? 'In Ufficio' : 'Da Cliente';
            const datesFormatted = r.executionDates.map(formatItalianDate).join(', ');
            return {
              macroCategory: 'taratura',
              calibrationActivityType: r.calibrationActivityType,
              calibrationInstrumentType: r.instrumentType,
              instrumentCount: Math.max(1, Number(r.instrumentNumber) || 1),
              workplaceFlag: r.workplaceFlag,
              executionDate: r.executionDates[0] || todayIso,
              executionDates: r.executionDates,
              scadenza: r.scadenza || '',
              durationHours: 0,
              notes: r.notes.trim(),
              isExtra: r.isExtra,
              lineItemTitle: `${r.calibrationActivityType} — ${r.instrumentType} (N° ${Math.max(1, Number(r.instrumentNumber) || 1)}) [${locLabel}]${r.isExtra ? ' [EXTRA]' : ''}`,
              description: `${r.calibrationActivityType} su ${r.instrumentType} — N° ${Math.max(1, Number(r.instrumentNumber) || 1)} (${locLabel}) — Date: ${datesFormatted}${r.scadenza ? ` — Scadenza: ${r.scadenza}` : ''}${r.isExtra ? ' [EXTRA]' : ' [ORDINARIA]'}${r.notes.trim() ? ` — Note: ${r.notes.trim()}` : ''}`,
            };
          }),
          executionDate: calibrationRows[0]?.executionDates[0] || todayIso,
          isFullDay: false,
          startTime: '08:30',
          endTime: '17:30',
          durationHours: 0,
          activityType: 'taratura',
          locationMode: 'onsite',
          materialsNotes: '',
        });

        if (shouldKeepTableForNextYear) {
          setCalibrationRows(renewedCalibrationRows);
          setSaveSuccessBanner(
            `Annualità ${completedAfterThis}/${totalContractYears} inviata nello Storico! La tabella è rimasta qui nelle Attività svuotata delle date e con la colonna Scadenza per l'annualità ${completedAfterThis + 1}/${totalContractYears}.`
          );
        } else {
          setCalibrationRows([createDefaultCalibrationRow()]);
          setReportFilterProjectId(selectedProject.id);
          setActiveSubTab('storico');
          setSaveSuccessBanner(
            selectedProject.durationType === 'multianno'
              ? `Completate tutte le ${totalContractYears} annualità previste (${completedAfterThis}/${totalContractYears}): la commessa è ora storicizzata del tutto!`
              : 'Attività di Taratura salvate nel database e storicizzate del tutto nella Tab Storico.'
          );
        }
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Errore durante la storicizzazione');
      } finally {
        setSavingBatch(false);
      }
    } else if (commessaCategory === 'compliance') {
      const validRows = complianceRows.filter((r) => r.documentType.trim() !== '' || r.notes.trim() !== '');
      if (validRows.length === 0) {
        setSaveError('Compila almeno la Tipologia Documento prima di storicizzare.');
        return;
      }
      if (validRows.some((r) => !r.executionDates || r.executionDates.length === 0 || !r.executionDates[0])) {
        setSaveError('Inserisci la data di esecuzione per tutte le righe di compliance prima di storicizzare.');
        return;
      }
      setSavingBatch(true);
      try {
        const renewedComplianceRows: PendingComplianceRow[] = validRows.map((r) => ({
          ...r,
          selected: false,
          scadenza: computeNextYearScadenzaFromDates(r.executionDates),
          executionDates: [],
        }));

        await onAddActivityBatch({
          project: selectedProject,
          nextPendingWorksheet: shouldKeepTableForNextYear
            ? {
                calibrationRows: [],
                qualificationRows: [],
                complianceRows: renewedComplianceRows,
              }
            : undefined,
          items: validRows.map((r) => {
            const locLabel = r.workplaceFlag === 'ufficio' ? 'In Ufficio' : 'Da Cliente';
            const datesFormatted = r.executionDates.map(formatItalianDate).join(', ');
            return {
              macroCategory: 'compliance',
              complianceDocumentType: r.documentType.trim(),
              workplaceFlag: r.workplaceFlag,
              executionDate: r.executionDates[0] || todayIso,
              executionDates: r.executionDates,
              scadenza: r.scadenza || '',
              durationHours: 0,
              notes: r.notes.trim(),
              isExtra: r.isExtra,
              lineItemTitle: `Compliance: ${r.documentType.trim()} (${locLabel})${r.isExtra ? ' [EXTRA]' : ''}`,
              description: `Tipologia Documento: ${r.documentType.trim()} (${locLabel}) — Date: ${datesFormatted}${r.scadenza ? ` — Scadenza: ${r.scadenza}` : ''}${r.isExtra ? ' [EXTRA]' : ' [ORDINARIA]'}${r.notes.trim() ? ` — Note: ${r.notes.trim()}` : ''}`,
            };
          }),
          executionDate: validRows[0]?.executionDates[0] || todayIso,
          isFullDay: false,
          startTime: '08:30',
          endTime: '17:30',
          durationHours: 0,
          activityType: 'compliance',
          locationMode: 'onsite',
          materialsNotes: '',
        });

        if (shouldKeepTableForNextYear) {
          setComplianceRows(renewedComplianceRows);
          setSaveSuccessBanner(
            `Annualità ${completedAfterThis}/${totalContractYears} inviata nello Storico! La tabella è rimasta qui nelle Attività svuotata delle date e con la colonna Scadenza per l'annualità ${completedAfterThis + 1}/${totalContractYears}.`
          );
        } else {
          setComplianceRows([createDefaultComplianceRow()]);
          setReportFilterProjectId(selectedProject.id);
          setActiveSubTab('storico');
          setSaveSuccessBanner(
            selectedProject.durationType === 'multianno'
              ? `Completate tutte le ${totalContractYears} annualità previste (${completedAfterThis}/${totalContractYears}): la commessa è ora storicizzata del tutto!`
              : 'Attività di Compliance salvate nel database e storicizzate del tutto nella Tab Storico.'
          );
        }
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Errore durante la storicizzazione');
      } finally {
        setSavingBatch(false);
      }
    } else {
      // QUALIFICA
      if (qualificationRows.length === 0) {
        setSaveError('Aggiungi almeno una riga di qualifica prima di storicizzare.');
        return;
      }
      if (qualificationRows.some((r) => !r.executionDates || r.executionDates.length === 0 || !r.executionDates[0])) {
        setSaveError('Inserisci la data di esecuzione per tutte le righe di qualifica prima di storicizzare.');
        return;
      }
      setSavingBatch(true);
      try {
        const renewedQualificationRows: PendingQualificationRow[] = qualificationRows.map((r) => ({
          ...r,
          selected: false,
          scadenza: computeNextYearScadenzaFromDates(r.executionDates),
          executionDates: [],
        }));

        await onAddActivityBatch({
          project: selectedProject,
          nextPendingWorksheet: shouldKeepTableForNextYear
            ? {
                calibrationRows: [],
                qualificationRows: renewedQualificationRows,
                complianceRows: [],
              }
            : undefined,
          items: qualificationRows.map((r) => {
            const locLabel = r.workplaceFlag === 'ufficio' ? 'In Ufficio' : 'Da Cliente';
            const datesFormatted = r.executionDates.map(formatItalianDate).join(', ');
            return {
              macroCategory: 'qualifica',
              qualificationActivityType: r.activityType,
              qualificationPhase: r.phase,
              machineType: r.machineType.trim(),
              workplaceFlag: r.workplaceFlag,
              executionDate: r.executionDates[0] || todayIso,
              executionDates: r.executionDates,
              scadenza: r.scadenza || '',
              durationHours: Math.max(0.5, Number(r.hours) || 0),
              notes: r.notes.trim(),
              isExtra: r.isExtra,
              lineItemTitle: `${r.activityType} [${r.phase}]${r.machineType.trim() ? ` — Macchina: ${r.machineType.trim()}` : ''} (${locLabel})${r.isExtra ? ' [EXTRA]' : ''}`,
              description: `${r.activityType} (${r.phase})${r.machineType.trim() ? ` su ${r.machineType.trim()}` : ''} — ${locLabel} — Date: ${datesFormatted}${r.scadenza ? ` — Scadenza: ${r.scadenza}` : ''}${r.isExtra ? ' [EXTRA]' : ' [ORDINARIA]'}${r.notes.trim() ? ` — Note: ${r.notes.trim()}` : ''}`,
            };
          }),
          executionDate: qualificationRows[0]?.executionDates[0] || todayIso,
          isFullDay: false,
          startTime: '08:30',
          endTime: '17:30',
          durationHours: totalQualOverallHours,
          activityType: 'qualifica',
          locationMode: 'onsite',
          materialsNotes: '',
        });

        if (shouldKeepTableForNextYear) {
          setQualificationRows(renewedQualificationRows);
          setSaveSuccessBanner(
            `Annualità ${completedAfterThis}/${totalContractYears} inviata nello Storico! La tabella è rimasta qui nelle Attività svuotata delle date e con la colonna Scadenza per l'annualità ${completedAfterThis + 1}/${totalContractYears}.`
          );
        } else {
          setQualificationRows([createDefaultQualificationRow()]);
          setReportFilterProjectId(selectedProject.id);
          setActiveSubTab('storico');
          setSaveSuccessBanner(
            selectedProject.durationType === 'multianno'
              ? `Completate tutte le ${totalContractYears} annualità previste (${completedAfterThis}/${totalContractYears}): la commessa è ora storicizzata del tutto!`
              : 'Attività di Qualifica salvate nel database e storicizzate del tutto nella Tab Storico.'
          );
        }
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Errore durante la storicizzazione');
      } finally {
        setSavingBatch(false);
      }
    }
  };

  // --- STORICO TAB FILTERING & HISTORICAL CONSUNTIVO ---
  const filteredActivities = activities.filter((act) => {
    if (!canViewAllActivities && act.technicianUid !== currentUserUid) {
      return false;
    }
    if (reportFilterProjectId !== 'all' && act.projectId !== reportFilterProjectId) {
      return false;
    }
    if (filterDateFrom && act.executionDate < filterDateFrom) {
      return false;
    }
    if (filterDateTo && act.executionDate > filterDateTo) {
      return false;
    }
    return true;
  });

  // Historical Summary for Taratura (using the same non-additive rule across Taratura / Certificato / Etichette)
  const historicalTaraturaLogs = filteredActivities.filter(
    (a) => a.macroCategory === 'taratura' || Boolean(a.calibrationInstrumentType)
  );
  const historicalCalibrationSummary = CALIBRATION_INSTRUMENT_TYPES.map((instType) => {
    const matchingOrd = historicalTaraturaLogs
      .filter((a) => a.calibrationInstrumentType === instType && !a.isExtra)
      .map((a) => ({
        calibrationActivityType: a.calibrationActivityType || 'Taratura',
        instrumentNumber: a.instrumentCount ?? 1,
      }));
    const matchingExt = historicalTaraturaLogs
      .filter((a) => a.calibrationInstrumentType === instType && a.isExtra)
      .map((a) => ({
        calibrationActivityType: a.calibrationActivityType || 'Taratura',
        instrumentNumber: a.instrumentCount ?? 1,
      }));

    const ordStats = calculateUniqueInstrumentCount(matchingOrd);
    const extStats = calculateUniqueInstrumentCount(matchingExt);

    return {
      instrumentType: instType,
      ordinarie: ordStats.uniqueCount,
      extra: extStats.uniqueCount,
      totale: ordStats.uniqueCount + extStats.uniqueCount,
      taraturaTot: ordStats.taraturaCount + extStats.taraturaCount,
      certificatoTot: ordStats.certificatoCount + extStats.certificatoCount,
      etichetteTot: ordStats.etichetteCount + extStats.etichetteCount,
    };
  });
  const histCalTotalOrd = historicalCalibrationSummary.reduce((s, x) => s + x.ordinarie, 0);
  const histCalTotalExt = historicalCalibrationSummary.reduce((s, x) => s + x.extra, 0);

  // Historical Summary for Qualifica
  const historicalQualificaLogs = filteredActivities.filter(
    (a) => a.macroCategory === 'qualifica' || Boolean(a.qualificationActivityType)
  );
  const historicalQualificationSummary = QUALIFICATION_ACTIVITY_TYPES.map((actType) => {
    const matching = historicalQualificaLogs.filter(
      (a) => a.qualificationActivityType === actType
    );
    const ordRows = matching.filter((a) => !a.isExtra);
    const extRows = matching.filter((a) => a.isExtra);
    return {
      activityType: actType,
      ordinarieCount: ordRows.length,
      extraCount: extRows.length,
      totaleCount: ordRows.length + extRows.length,
      ordinarieHours: ordRows.reduce((s, a) => s + (a.durationHours || 0), 0),
      extraHours: extRows.reduce((s, a) => s + (a.durationHours || 0), 0),
    };
  });
  const histQualTotalOrdCount = historicalQualificationSummary.reduce(
    (s, x) => s + x.ordinarieCount,
    0
  );
  const histQualTotalExtCount = historicalQualificationSummary.reduce(
    (s, x) => s + x.extraCount,
    0
  );
  const histQualTotalOrdHours = historicalQualificationSummary.reduce(
    (s, x) => s + x.ordinarieHours,
    0
  );
  const histQualTotalExtHours = historicalQualificationSummary.reduce(
    (s, x) => s + x.extraHours,
    0
  );

  // Digital Signature Canvas Helpers
  const getCanvasCoords = (
    canvas: HTMLCanvasElement,
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const t = e.touches[0] || e.changedTouches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startSigDraw = (
    target: 'client' | 'tech',
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas =
      target === 'client' ? clientCanvasRef.current : techCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    drawingTargetRef.current = target;
    if (target === 'client') setHasClientSig(true);
    else setHasTechSig(true);

    const { x, y } = getCanvasCoords(canvas, e);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const moveSigDraw = (
    target: 'client' | 'tech',
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (drawingTargetRef.current !== target) return;
    const canvas =
      target === 'client' ? clientCanvasRef.current : techCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { x, y } = getCanvasCoords(canvas, e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopSigDraw = () => {
    drawingTargetRef.current = null;
  };

  const clearCanvas = (target: 'client' | 'tech') => {
    const canvas =
      target === 'client' ? clientCanvasRef.current : techCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (target === 'client') setHasClientSig(false);
    else setHasTechSig(false);
  };

  const handleConfirmAndGenerateReportinoPdf = () => {
    const targetProject =
      reportFilterProjectId !== 'all'
        ? projects.find((p) => p.id === reportFilterProjectId) || null
        : selectedProject;
    const targetClient = targetProject
      ? clients.find((c) => c.id === targetProject.clientId) || null
      : null;

    let dateLabel = 'Tutte le date storicizzate';
    if (filterDateFrom && filterDateTo) {
      dateLabel =
        filterDateFrom === filterDateTo
          ? `Giorno ${formatItalianDate(filterDateFrom)}`
          : `Dal ${formatItalianDate(filterDateFrom)} al ${formatItalianDate(filterDateTo)}`;
    } else if (filterDateFrom) {
      dateLabel = `Dal ${formatItalianDate(filterDateFrom)}`;
    } else if (filterDateTo) {
      dateLabel = `Fino al ${formatItalianDate(filterDateTo)}`;
    }

    const clientSigUrl =
      hasClientSig && clientCanvasRef.current
        ? clientCanvasRef.current.toDataURL('image/png')
        : '';
    const techSigUrl =
      hasTechSig && techCanvasRef.current
        ? techCanvasRef.current.toDataURL('image/png')
        : '';

    generateConsuntivoPdf({
      activities: filteredActivities,
      project: targetProject,
      client: targetClient,
      filterDescription: dateLabel,
      generatedBy: currentUserName,
      clientSignerName: clientSignerName.trim() || targetProject?.clientName || '',
      clientSignatureDataUrl: clientSigUrl,
      technicianSignatureDataUrl: techSigUrl,
    });

    setShowReportSignatureModal(false);
  };

  const selectedCount =
    commessaCategory === 'taratura'
      ? calibrationRows.filter((r) => r.selected).length
      : commessaCategory === 'compliance'
      ? complianceRows.filter((r) => r.selected).length
      : qualificationRows.filter((r) => r.selected).length;

  const hasMemorizedDataOnSelectedProject = Boolean(
    selectedProject?.pendingWorksheet &&
      ((selectedProject.pendingWorksheet.calibrationRows?.length || 0) > 0 ||
        (selectedProject.pendingWorksheet.qualificationRows?.length || 0) > 0 ||
        (selectedProject.pendingWorksheet.complianceRows?.length || 0) > 0)
  );

  return (
    <div className="space-y-6">
      {/* Header & Sub-Tab Switcher (Compilazione Attività vs Tab Storico) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Gestione Attività Commessa &amp; Consuntivo
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Usa <strong>Memorizza</strong> per salvare in database l&apos;attività in corso (visibile a tutti senza andare nello storico) e <strong>Salva e Storicizza</strong> a fine attività.
          </p>
        </div>

        <div className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200 shrink-0 gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('compilazione');
              setSaveSuccessBanner(null);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
              activeSubTab === 'compilazione'
                ? 'bg-slate-950 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Compilazione Attività (Pending)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('storico')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
              activeSubTab === 'storico'
                ? 'bg-slate-950 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Tab Storico</span>
            <span
              className={`px-2 py-0.5 text-[11px] rounded-md font-mono ${
                activeSubTab === 'storico'
                  ? 'bg-white text-slate-950 font-bold'
                  : 'bg-slate-200 text-slate-800'
              }`}
            >
              {activities.length}
            </span>
          </button>
        </div>
      </div>

      {saveSuccessBanner && (
        <div className="p-4 bg-slate-100 border border-slate-300 rounded-xl flex items-center justify-between text-xs sm:text-sm text-slate-900 font-medium">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-slate-900 shrink-0" />
            <span>{saveSuccessBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccessBanner(null)}
            className="px-2 py-1 bg-slate-950 text-white rounded-lg cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 1: COMPILAZIONE ATTIVITÀ (TARATURA / QUALIFICA / COMPLIANCE) */}
      {/* ===================================================================== */}
      {activeSubTab === 'compilazione' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-6">
          {/* Client Card Organization for Attività Pending */}
          <div className="space-y-3 border-b border-slate-100 pb-5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-700" />
                <span>
                  Clienti con Attività Sbloccate ({unlockedByClient.length}) — Clicca sulla Card del Cliente per aprire le relative commesse e attività
                </span>
              </div>
            </div>

            {unlockedProjects.length === 0 ? (
              <div className="w-full text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <strong>Nessuna commessa sbloccata per le Attività.</strong> Quando un&apos;offerta in attesa riceve la conferma dell&apos;ordine nella pagina <strong>Offerte &amp; Ordini</strong>, il relativo Cliente e Progetto verranno sbloccati automaticamente qui.
              </div>
            ) : (
              <div className="space-y-2.5">
                {unlockedByClient.map((clientGrp) => {
                  const isClientOpen =
                    selectedClientFilter === clientGrp.clientId ||
                    (selectedProject && selectedProject.clientId === clientGrp.clientId);

                  return (
                    <div
                      key={clientGrp.clientId}
                      className={`rounded-xl border transition-all overflow-hidden ${
                        isClientOpen
                          ? 'border-slate-950 bg-slate-50/70 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (isClientOpen && unlockedByClient.length > 1 && selectedClientFilter === clientGrp.clientId) {
                            setSelectedClientFilter('');
                          } else {
                            setSelectedClientFilter(clientGrp.clientId);
                            if (
                              !selectedProject ||
                              selectedProject.clientId !== clientGrp.clientId
                            ) {
                              const firstP = clientGrp.projects[0];
                              if (firstP) {
                                setSelectedProjectId(firstP.id);
                                setReportFilterProjectId(firstP.id);
                              }
                            }
                          }
                        }}
                        className="w-full p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-950 text-white flex items-center justify-center shrink-0">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-bold text-slate-950">
                                {clientGrp.clientName}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-md bg-slate-950 text-white font-mono text-xs font-bold">
                                {clientGrp.projects.length}{' '}
                                {clientGrp.projects.length === 1
                                  ? 'Commessa Attiva'
                                  : 'Commesse Attive'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">
                              P.IVA: {clientGrp.clientVat}
                            </div>
                          </div>
                        </div>

                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 text-white text-xs font-semibold shrink-0 self-start sm:self-center">
                          <span>{isClientOpen ? 'Cliente Aperto' : 'Apri Attività Cliente'}</span>
                          {isClientOpen ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      </button>

                      {isClientOpen && (
                        <div className="border-t border-slate-200 p-3.5 bg-white space-y-2.5">
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Seleziona la Commessa del Cliente {clientGrp.clientName}:
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {clientGrp.projects.map((p) => {
                              const isSelectedProj = selectedProject?.id === p.id;
                              const durType = p.durationType || 'singola';
                              const totY =
                                durType === 'multianno'
                                  ? Math.max(2, Number(p.contractYears) || 2)
                                  : 1;
                              const compY = Number(p.completedYearsCount) || 0;
                              const durInfo =
                                durType === 'multianno'
                                  ? `Multianno ${compY + 1}/${totY}`
                                  : DURATION_TYPE_LABELS[durType];

                              return (
                                <button
                                  type="button"
                                  key={p.id}
                                  onClick={() => {
                                    setSelectedClientFilter(clientGrp.clientId);
                                    setSelectedProjectId(p.id);
                                    setReportFilterProjectId(p.id);
                                  }}
                                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                    isSelectedProj
                                      ? 'bg-slate-950 text-white border-slate-950 shadow-xs'
                                      : 'bg-slate-50 text-slate-900 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                                      <span
                                        className={`px-2 py-0.5 rounded font-bold uppercase ${
                                          isSelectedProj
                                            ? 'bg-white text-slate-950'
                                            : 'bg-slate-950 text-white'
                                        }`}
                                      >
                                        {p.macroCategory || 'qualifica'}
                                      </span>
                                      <span>Off. {p.quoteNumber}</span>
                                      <span>· Ord. {p.orderNumber}</span>
                                      <span>· {durInfo}</span>
                                    </div>
                                    <div className="font-bold text-xs sm:text-sm truncate mt-1">
                                      {p.title}
                                    </div>
                                  </div>
                                  <Check
                                    className={`w-4 h-4 shrink-0 ${
                                      isSelectedProj ? 'text-white opacity-100' : 'opacity-0'
                                    }`}
                                  />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedProject && (
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                {hasMemorizedDataOnSelectedProject && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-900 border border-slate-300">
                    <BookmarkCheck className="w-4 h-4 text-slate-800" />
                    Sessione Pending Memorizzata ({selectedProject.pendingWorksheet?.updatedByName})
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border bg-slate-950 text-white border-slate-950">
                  {commessaCategory === 'taratura' && (
                    <>
                      <Wrench className="w-4 h-4 text-white" />
                      Commessa di TARATURA
                    </>
                  )}
                  {commessaCategory === 'compliance' && (
                    <>
                      <FileCheck2 className="w-4 h-4 text-white" />
                      Commessa di COMPLIANCE
                    </>
                  )}
                  {commessaCategory === 'qualifica' && (
                    <>
                      <ClipboardList className="w-4 h-4 text-white" />
                      Commessa di QUALIFICA
                    </>
                  )}
                </span>
              </div>
            )}
          </div>

          {selectedProject && (
            <>
              {/* Active Commessa Info & Bulk Multi-Date / Date Series Bar */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col xl:flex-row xl:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-slate-700">
                    <span>
                      Cliente: <strong className="text-slate-900">{selectedProject.clientName}</strong> · N° Offerta:{' '}
                      <strong className="text-slate-950">{selectedProject.quoteNumber}</strong> · N° Ordine:{' '}
                      <strong className="text-slate-950">{selectedProject.orderNumber}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-950 text-white font-mono text-[11px] font-bold">
                      {selectedProject.durationType === 'multianno'
                        ? `Multianno (${selectedProject.contractYears || 2} Anni) — Annualità ${(selectedProject.completedYearsCount || 0) + 1} di ${selectedProject.contractYears || 2}`
                        : DURATION_TYPE_LABELS[selectedProject.durationType || 'singola']}
                    </span>
                  </div>
                  {(selectedProject.facilityName || selectedProject.facilityAddress) && (
                    <div className="text-slate-600 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      <span>
                        Stabilimento: <strong>{selectedProject.facilityName || 'Sede'}</strong>
                        {selectedProject.facilityAddress ? ` — ${selectedProject.facilityAddress}` : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Bulk Date / Date Series Assignment for Selected Rows */}
                <div className="flex flex-wrap items-center gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200">
                  <Calendar className="w-4 h-4 text-slate-700 shrink-0" />
                  <span className="text-[11px] font-bold text-slate-700">
                    Data o Serie di Date per selezionate ({selectedCount}):
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 font-semibold">Dal/Data:</span>
                    <input
                      type="date"
                      value={bulkDateStart}
                      onChange={(e) => setBulkDateStart(e.target.value)}
                      className="px-2 py-1 border border-slate-300 rounded-lg text-xs font-mono text-slate-900"
                    />
                    <span className="text-[10px] text-slate-500 font-semibold">Al (opz. serie):</span>
                    <input
                      type="date"
                      value={bulkDateEnd}
                      onChange={(e) => setBulkDateEnd(e.target.value)}
                      className="px-2 py-1 border border-slate-300 rounded-lg text-xs font-mono text-slate-900"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={selectedCount === 0}
                    onClick={() => handleApplyBulkDatesToSelected('replace')}
                    className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Imposta Data/Serie
                  </button>
                  <button
                    type="button"
                    disabled={selectedCount === 0}
                    onClick={() => handleApplyBulkDatesToSelected('append')}
                    className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    + Aggiungi Date
                  </button>
                </div>
              </div>

              {selectedProject.durationType === 'multianno' &&
                (selectedProject.completedYearsCount || 0) > 0 && (
                  <div className="p-3.5 bg-slate-100 border border-slate-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-900">
                    <div>
                      <span className="font-bold uppercase tracking-wider font-mono">
                        Commessa Multianno — Rinnovo Annualità {(selectedProject.completedYearsCount || 0) + 1} di {selectedProject.contractYears || 2}:
                      </span>{' '}
                      Le attività dell&apos;annualità precedente sono state inviate nello <strong>Storico</strong>. La tabella qui sotto è stata svuotata delle sole date di esecuzione e mostra la colonna <strong>Scadenza</strong> con il mese di scadenza calcolato sull&apos;anno successivo. Quando avrai storicizzato tutte le {selectedProject.contractYears || 2} annualità, la commessa si storicizzerà del tutto.
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-slate-950 text-white font-mono font-bold shrink-0">
                      Storicizzazioni: {selectedProject.completedYearsCount || 0} / {selectedProject.contractYears || 2}
                    </span>
                  </div>
                )}

              {saveError && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
                  {saveError}
                </div>
              )}

              {/* =============================================================== */}
              {/* TABLE 1: TARATURA                                               */}
              {/* =============================================================== */}
              {commessaCategory === 'taratura' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Tabella Attività di Taratura
                      </h3>
                      <p className="text-xs text-slate-500">
                        Colonne: <strong>Tipo Attività</strong> (Taratura, Certificato, Etichette, Taratura + Etichette, Taratura + Certificato + Etichette), <strong>Tipo Strumento</strong>, <strong>Numero</strong>, <strong>Data / Serie di Date</strong>, <strong>Note dinamiche</strong>, <strong>Extra</strong> e <strong>Da Cliente / In Ufficio</strong>.
                      </p>
                    </div>
                    {canLogActivities && (
                      <button
                        type="button"
                        onClick={handleAddCalibrationRow}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer shrink-0 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        + Aggiungi Riga Taratura
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-left border-collapse min-w-[1060px]">
                      <thead>
                        <tr className="bg-slate-950 text-white text-[11px] uppercase tracking-wider">
                          <th className="py-3 px-2.5 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={
                                calibrationRows.length > 0 &&
                                calibrationRows.every((r) => r.selected)
                              }
                              onChange={(e) =>
                                setCalibrationRows((prev) =>
                                  prev.map((r) => ({ ...r, selected: e.target.checked }))
                                )
                              }
                              className="w-4 h-4 accent-slate-950 rounded cursor-pointer"
                            />
                          </th>
                          <th className="py-3 px-2.5 w-56">1. Tipo Attività</th>
                          <th className="py-3 px-2.5 w-48">2. Tipo Strumento</th>
                          <th className="py-3 px-2.5 w-24">3. Numero</th>
                          <th className="py-3 px-2.5 w-48">4. Data / Serie Date</th>
                          {showCalibrationScadenza && (
                            <th className="py-3 px-2.5 w-44">Scadenza</th>
                          )}
                          <th className="py-3 px-2.5 min-w-[220px]">5. Note (Cella Dinamica)</th>
                          <th className="py-3 px-2.5 w-24 text-center">6. Extra</th>
                          <th className="py-3 px-2.5 w-40 text-center">7. Cliente / Ufficio</th>
                          <th className="py-3 px-2 w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs align-top">
                        {calibrationRows.map((row) => (
                          <tr
                            key={row.id}
                            className={`transition-colors ${
                              row.selected
                                ? 'bg-slate-100'
                                : row.isExtra
                                ? 'bg-slate-50'
                                : 'bg-white hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="py-3 px-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(row.selected)}
                                onChange={(e) =>
                                  handleUpdateCalibrationRow(
                                    row.id,
                                    'selected',
                                    e.target.checked
                                  )
                                }
                                className="w-4 h-4 accent-slate-950 rounded cursor-pointer mt-2"
                              />
                            </td>

                            {/* Colonna 1: Tipo Attività */}
                            <td className="py-3 px-2.5">
                              <select
                                value={row.calibrationActivityType}
                                onChange={(e) =>
                                  handleUpdateCalibrationRow(
                                    row.id,
                                    'calibrationActivityType',
                                    e.target.value as CalibrationActivityType
                                  )
                                }
                                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-950"
                              >
                                {CALIBRATION_ACTIVITY_TYPES.map((act) => (
                                  <option key={act} value={act}>
                                    {act}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Colonna 2: Tipo Strumento */}
                            <td className="py-3 px-2.5">
                              <select
                                value={row.instrumentType}
                                onChange={(e) =>
                                  handleUpdateCalibrationRow(
                                    row.id,
                                    'instrumentType',
                                    e.target.value as CalibrationInstrumentType
                                  )
                                }
                                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-950"
                              >
                                {CALIBRATION_INSTRUMENT_TYPES.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Colonna 3: Numero scritto a mano */}
                            <td className="py-3 px-2.5">
                              <input
                                type="number"
                                min={1}
                                step={1}
                                value={row.instrumentNumber}
                                onChange={(e) =>
                                  handleUpdateCalibrationRow(
                                    row.id,
                                    'instrumentNumber',
                                    Math.max(1, parseInt(e.target.value, 10) || 1)
                                  )
                                }
                                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-950"
                              />
                            </td>

                            {/* Colonna 4: Data o Serie di Date */}
                            <td className="py-3 px-2.5">
                              <MultiDateCell
                                dates={row.executionDates}
                                onChange={(newDates) =>
                                  handleUpdateCalibrationRow(row.id, 'executionDates', newDates)
                                }
                              />
                            </td>

                            {showCalibrationScadenza && (
                              <td className="py-3 px-2.5">
                                <div className="space-y-1">
                                  <input
                                    type="text"
                                    value={row.scadenza || ''}
                                    onChange={(e) =>
                                      handleUpdateCalibrationRow(
                                        row.id,
                                        'scadenza',
                                        e.target.value
                                      )
                                    }
                                    placeholder="Es. 30 Ottobre"
                                    className="w-full px-2.5 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-950"
                                  />
                                  <div className="text-[10px] font-mono text-slate-500">
                                    Mese di scadenza
                                  </div>
                                </div>
                              </td>
                            )}

                            {/* Colonna 5: Note (Cella dinamica auto-espandibile) */}
                            <td className="py-3 px-2.5">
                              <AutoResizeTextarea
                                value={row.notes}
                                onChange={(val) =>
                                  handleUpdateCalibrationRow(row.id, 'notes', val)
                                }
                                placeholder="Scrivi nota (la cella si allarga automaticamente)..."
                              />
                            </td>

                            {/* Colonna 6: Flag Extra */}
                            <td className="py-3 px-2.5 text-center">
                              <label className="inline-flex items-center justify-center gap-1 cursor-pointer select-none mt-1.5">
                                <input
                                  type="checkbox"
                                  checked={row.isExtra}
                                  onChange={(e) =>
                                    handleUpdateCalibrationRow(
                                      row.id,
                                      'isExtra',
                                      e.target.checked
                                    )
                                  }
                                  className="w-4 h-4 accent-slate-950 rounded cursor-pointer"
                                />
                                <span
                                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                    row.isExtra
                                      ? 'bg-slate-950 text-white'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {row.isExtra ? 'EXTRA' : 'Ord.'}
                                </span>
                              </label>
                            </td>

                            {/* Colonna 7: Flag Da Cliente / In Ufficio */}
                            <td className="py-3 px-2.5 text-center">
                              <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-100 mt-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateCalibrationRow(
                                      row.id,
                                      'workplaceFlag',
                                      'cliente'
                                    )
                                  }
                                  className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                                    row.workplaceFlag === 'cliente'
                                      ? 'bg-slate-950 text-white'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  Da Cliente
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateCalibrationRow(
                                      row.id,
                                      'workplaceFlag',
                                      'ufficio'
                                    )
                                  }
                                  className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                                    row.workplaceFlag === 'ufficio'
                                      ? 'bg-slate-950 text-white'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  In Ufficio
                                </button>
                              </div>
                            </td>

                            <td className="py-3 px-2 text-center">
                              {calibrationRows.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCalibrationRow(row.id)}
                                  className="p-1.5 bg-slate-950 hover:bg-slate-800 text-white rounded-lg cursor-pointer mt-1"
                                  title="Elimina riga"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* CONTEGGIO CONSUNTIVO TARATURE PER TIPOLOGIA STRUMENTO */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Consuntivo Tarature per Tipologia Strumento (Conteggio Unico non sommato tra Taratura / Certificato / Etichette)
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Se lo stesso numero di strumenti viene lavorato in più fasi (es. un giorno Taratura, un giorno Certificati, un giorno Etichette), il numero viene conteggiato una sola volta.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono shrink-0">
                        <span className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-slate-900">
                          Ordinarie: <strong>{totalCalibrationOrdinarie}</strong>
                        </span>
                        <span className="px-2.5 py-1 bg-slate-200 border border-slate-300 rounded-lg text-slate-900">
                          Extra: <strong>{totalCalibrationExtra}</strong>
                        </span>
                        <span className="px-3 py-1 bg-slate-950 text-white rounded-lg font-bold">
                          Totale Consuntivato: {totalCalibrationOverall}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                      {calibrationDraftSummary.map((item) => (
                        <div
                          key={item.instrumentType}
                          className={`p-3 rounded-xl border text-xs flex flex-col justify-between ${
                            item.totale > 0
                              ? 'bg-white border-slate-900 shadow-2xs'
                              : 'bg-white/60 border-slate-200 opacity-75'
                          }`}
                        >
                          <div className="font-bold text-slate-900 break-words">
                            {item.instrumentType}
                          </div>
                          {item.totale > 0 && (
                            <div className="text-[10px] font-mono text-slate-500 mt-1">
                              T:{item.taraturaTot} · C:{item.certificatoTot} · E:{item.etichetteTot}
                            </div>
                          )}
                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between font-mono text-[11px]">
                            <span className="text-slate-600">
                              Ord: <strong className="text-slate-900">{item.ordinarie}</strong>
                            </span>
                            <span className="text-slate-700">
                              Extra: <strong>{item.extra}</strong>
                            </span>
                            <span className="px-2 py-0.5 bg-slate-950 text-white rounded font-bold">
                              Tot: {item.totale}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* =============================================================== */}
              {/* TABLE 2: COMPLIANCE                                             */}
              {/* =============================================================== */}
              {commessaCategory === 'compliance' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Tabella Attività di Compliance
                      </h3>
                      <p className="text-xs text-slate-500">
                        Colonna libera <strong>Tipologia Documento</strong> (cella dinamica auto-espandibile), <strong>Data o Serie di Date</strong>, <strong>Note dinamiche</strong>, flag <strong>Extra</strong> e <strong>Da Cliente / In Ufficio</strong>.
                      </p>
                    </div>
                    {canLogActivities && (
                      <button
                        type="button"
                        onClick={handleAddComplianceRow}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer shrink-0 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        + Aggiungi Riga Compliance
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                      <thead>
                        <tr className="bg-slate-950 text-white text-[11px] uppercase tracking-wider">
                          <th className="py-3 px-2.5 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={
                                complianceRows.length > 0 &&
                                complianceRows.every((r) => r.selected)
                              }
                              onChange={(e) =>
                                setComplianceRows((prev) =>
                                  prev.map((r) => ({ ...r, selected: e.target.checked }))
                                )
                              }
                              className="w-4 h-4 accent-slate-950 rounded cursor-pointer"
                            />
                          </th>
                          <th className="py-3 px-3 min-w-[260px]">
                            1. Tipologia Documento (Cella Libera Dinamica)
                          </th>
                          <th className="py-3 px-3 w-52">2. Data / Serie di Date</th>
                          {showComplianceScadenza && (
                            <th className="py-3 px-3 w-44">Scadenza</th>
                          )}
                          <th className="py-3 px-3 min-w-[260px]">3. Note (Cella Dinamica)</th>
                          <th className="py-3 px-2.5 w-24 text-center">4. Extra</th>
                          <th className="py-3 px-2.5 w-40 text-center">5. Cliente / Ufficio</th>
                          <th className="py-3 px-2 w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs align-top">
                        {complianceRows.map((row) => (
                          <tr
                            key={row.id}
                            className={`transition-colors ${
                              row.selected
                                ? 'bg-slate-100'
                                : row.isExtra
                                ? 'bg-slate-50'
                                : 'bg-white hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="py-3 px-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(row.selected)}
                                onChange={(e) =>
                                  handleUpdateComplianceRow(
                                    row.id,
                                    'selected',
                                    e.target.checked
                                  )
                                }
                                className="w-4 h-4 accent-slate-950 rounded cursor-pointer mt-2"
                              />
                            </td>

                            {/* Colonna 1: Tipologia Documento (Cella libera dinamica) */}
                            <td className="py-3 px-3">
                              <AutoResizeTextarea
                                value={row.documentType}
                                onChange={(val) =>
                                  handleUpdateComplianceRow(row.id, 'documentType', val)
                                }
                                placeholder="Scrivi qui la Tipologia Documento (la cella aumenta di dimensione automaticamente)..."
                                className="font-semibold"
                              />
                            </td>

                            {/* Colonna 2: Data o Serie di Date */}
                            <td className="py-3 px-3">
                              <MultiDateCell
                                dates={row.executionDates}
                                onChange={(newDates) =>
                                  handleUpdateComplianceRow(row.id, 'executionDates', newDates)
                                }
                              />
                            </td>

                            {showComplianceScadenza && (
                              <td className="py-3 px-3">
                                <div className="space-y-1">
                                  <input
                                    type="text"
                                    value={row.scadenza || ''}
                                    onChange={(e) =>
                                      handleUpdateComplianceRow(
                                        row.id,
                                        'scadenza',
                                        e.target.value
                                      )
                                    }
                                    placeholder="Es. 30 Ottobre"
                                    className="w-full px-2.5 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-950"
                                  />
                                  <div className="text-[10px] font-mono text-slate-500">
                                    Mese di scadenza
                                  </div>
                                </div>
                              </td>
                            )}

                            {/* Colonna 3: Note (Cella dinamica) */}
                            <td className="py-3 px-3">
                              <AutoResizeTextarea
                                value={row.notes}
                                onChange={(val) =>
                                  handleUpdateComplianceRow(row.id, 'notes', val)
                                }
                                placeholder="Inserisci eventuali note (la cella si espande automaticamente)..."
                              />
                            </td>

                            {/* Colonna 4: Extra */}
                            <td className="py-3 px-2.5 text-center">
                              <label className="inline-flex items-center justify-center gap-1 cursor-pointer select-none mt-1.5">
                                <input
                                  type="checkbox"
                                  checked={row.isExtra}
                                  onChange={(e) =>
                                    handleUpdateComplianceRow(
                                      row.id,
                                      'isExtra',
                                      e.target.checked
                                    )
                                  }
                                  className="w-4 h-4 accent-slate-950 rounded cursor-pointer"
                                />
                                <span
                                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                    row.isExtra
                                      ? 'bg-slate-950 text-white'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {row.isExtra ? 'EXTRA' : 'Ord.'}
                                </span>
                              </label>
                            </td>

                            {/* Colonna 5: Da Cliente / In Ufficio */}
                            <td className="py-3 px-2.5 text-center">
                              <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-100 mt-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateComplianceRow(
                                      row.id,
                                      'workplaceFlag',
                                      'cliente'
                                    )
                                  }
                                  className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                                    row.workplaceFlag === 'cliente'
                                      ? 'bg-slate-950 text-white'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  Da Cliente
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateComplianceRow(
                                      row.id,
                                      'workplaceFlag',
                                      'ufficio'
                                    )
                                  }
                                  className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                                    row.workplaceFlag === 'ufficio'
                                      ? 'bg-slate-950 text-white'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  In Ufficio
                                </button>
                              </div>
                            </td>

                            <td className="py-3 px-2 text-center">
                              {complianceRows.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveComplianceRow(row.id)}
                                  className="p-1.5 bg-slate-950 hover:bg-slate-800 text-white rounded-lg cursor-pointer mt-1"
                                  title="Elimina riga"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* =============================================================== */}
              {/* TABLE 3: QUALIFICA                                              */}
              {/* =============================================================== */}
              {commessaCategory === 'qualifica' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Tabella Attività di Qualifica
                      </h3>
                      <p className="text-xs text-slate-500">
                        Colonne con celle dinamiche auto-espandibili: <strong>Tipologia Attività</strong>, sottomenù <strong>Fase (FAT/SAT/IQ/OQ/IOQ/PQ)</strong>, <strong>Tipologia Macchina</strong>, <strong>Data / Serie di Date</strong>, <strong>Ora (h)</strong>, <strong>Note</strong>, <strong>Extra</strong> e <strong>Da Cliente / In Ufficio</strong>.
                      </p>
                    </div>
                    {canLogActivities && (
                      <button
                        type="button"
                        onClick={handleAddQualificationRow}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer shrink-0 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        + Aggiungi Riga Qualifica
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-left border-collapse min-w-[1120px]">
                      <thead>
                        <tr className="bg-slate-950 text-white text-[11px] uppercase tracking-wider">
                          <th className="py-3 px-2.5 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={
                                qualificationRows.length > 0 &&
                                qualificationRows.every((r) => r.selected)
                              }
                              onChange={(e) =>
                                setQualificationRows((prev) =>
                                  prev.map((r) => ({ ...r, selected: e.target.checked }))
                                )
                              }
                              className="w-4 h-4 accent-slate-950 rounded cursor-pointer"
                            />
                          </th>
                          <th className="py-3 px-2.5 w-52">1. Tipologia Attività</th>
                          <th className="py-3 px-2.5 w-28">2. Fase</th>
                          <th className="py-3 px-2.5 min-w-[190px]">
                            3. Tipologia Macchina (Dinamica)
                          </th>
                          <th className="py-3 px-2.5 w-48">4. Data / Serie Date</th>
                          {showQualificationScadenza && (
                            <th className="py-3 px-2.5 w-44">Scadenza</th>
                          )}
                          <th className="py-3 px-2.5 w-24">5. Ora (h)</th>
                          <th className="py-3 px-2.5 min-w-[210px]">6. Note (Dinamica)</th>
                          <th className="py-3 px-2.5 w-24 text-center">7. Extra</th>
                          <th className="py-3 px-2.5 w-40 text-center">8. Cliente / Ufficio</th>
                          <th className="py-3 px-2 w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs align-top">
                        {qualificationRows.map((row) => (
                          <tr
                            key={row.id}
                            className={`transition-colors ${
                              row.selected
                                ? 'bg-slate-100'
                                : row.isExtra
                                ? 'bg-slate-50'
                                : 'bg-white hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="py-3 px-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={Boolean(row.selected)}
                                onChange={(e) =>
                                  handleUpdateQualificationRow(
                                    row.id,
                                    'selected',
                                    e.target.checked
                                  )
                                }
                                className="w-4 h-4 accent-slate-950 rounded cursor-pointer mt-2"
                              />
                            </td>

                            {/* Colonna 1: Tipologia Attività */}
                            <td className="py-3 px-2.5">
                              <select
                                value={row.activityType}
                                onChange={(e) =>
                                  handleUpdateQualificationRow(
                                    row.id,
                                    'activityType',
                                    e.target.value as QualificationActivityType
                                  )
                                }
                                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-950"
                              >
                                {QUALIFICATION_ACTIVITY_TYPES.map((act) => (
                                  <option key={act} value={act}>
                                    {act}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Colonna 2: Sottomenù Fase (FAT, SAT, IQ, OQ, IOQ, PQ) */}
                            <td className="py-3 px-2.5">
                              <select
                                value={row.phase}
                                onChange={(e) =>
                                  handleUpdateQualificationRow(
                                    row.id,
                                    'phase',
                                    e.target.value as QualificationPhase
                                  )
                                }
                                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
                              >
                                {QUALIFICATION_PHASES.map((ph) => (
                                  <option key={ph} value={ph}>
                                    {ph}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Colonna 3: Tipologia Macchina (Cella dinamica auto-espandibile) */}
                            <td className="py-3 px-2.5">
                              <AutoResizeTextarea
                                value={row.machineType}
                                onChange={(val) =>
                                  handleUpdateQualificationRow(row.id, 'machineType', val)
                                }
                                placeholder="Scrivi tipologia macchina a mano..."
                                className="font-semibold"
                              />
                            </td>

                            {/* Colonna 4: Data o Serie di Date */}
                            <td className="py-3 px-2.5">
                              <MultiDateCell
                                dates={row.executionDates}
                                onChange={(newDates) =>
                                  handleUpdateQualificationRow(
                                    row.id,
                                    'executionDates',
                                    newDates
                                  )
                                }
                              />
                            </td>

                            {showQualificationScadenza && (
                              <td className="py-3 px-2.5">
                                <div className="space-y-1">
                                  <input
                                    type="text"
                                    value={row.scadenza || ''}
                                    onChange={(e) =>
                                      handleUpdateQualificationRow(
                                        row.id,
                                        'scadenza',
                                        e.target.value
                                      )
                                    }
                                    placeholder="Es. 30 Ottobre"
                                    className="w-full px-2.5 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-950"
                                  />
                                  <div className="text-[10px] font-mono text-slate-500">
                                    Mese di scadenza
                                  </div>
                                </div>
                              </td>
                            )}

                            {/* Colonna 5: Ora (h) */}
                            <td className="py-3 px-2.5">
                              <input
                                type="number"
                                min={0.5}
                                max={24}
                                step={0.5}
                                value={row.hours}
                                onChange={(e) =>
                                  handleUpdateQualificationRow(
                                    row.id,
                                    'hours',
                                    Math.max(0.5, parseFloat(e.target.value) || 0.5)
                                  )
                                }
                                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-950"
                              />
                            </td>

                            {/* Colonna 6: Note (Cella dinamica auto-espandibile) */}
                            <td className="py-3 px-2.5">
                              <AutoResizeTextarea
                                value={row.notes}
                                onChange={(val) =>
                                  handleUpdateQualificationRow(row.id, 'notes', val)
                                }
                                placeholder="Eventuale nota..."
                              />
                            </td>

                            {/* Colonna 7: Flag Extra */}
                            <td className="py-3 px-2.5 text-center">
                              <label className="inline-flex items-center justify-center gap-1 cursor-pointer select-none mt-1.5">
                                <input
                                  type="checkbox"
                                  checked={row.isExtra}
                                  onChange={(e) =>
                                    handleUpdateQualificationRow(
                                      row.id,
                                      'isExtra',
                                      e.target.checked
                                    )
                                  }
                                  className="w-4 h-4 accent-slate-950 rounded cursor-pointer"
                                />
                                <span
                                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                    row.isExtra
                                      ? 'bg-slate-950 text-white'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {row.isExtra ? 'EXTRA' : 'Ord.'}
                                </span>
                              </label>
                            </td>

                            {/* Colonna 8: Flag Da Cliente / In Ufficio */}
                            <td className="py-3 px-2.5 text-center">
                              <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-100 mt-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateQualificationRow(
                                      row.id,
                                      'workplaceFlag',
                                      'cliente'
                                    )
                                  }
                                  className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                                    row.workplaceFlag === 'cliente'
                                      ? 'bg-slate-950 text-white'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  Da Cliente
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateQualificationRow(
                                      row.id,
                                      'workplaceFlag',
                                      'ufficio'
                                    )
                                  }
                                  className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                                    row.workplaceFlag === 'ufficio'
                                      ? 'bg-slate-950 text-white'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  In Ufficio
                                </button>
                              </div>
                            </td>

                            <td className="py-3 px-2 text-center">
                              {qualificationRows.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveQualificationRow(row.id)}
                                  className="p-1.5 bg-slate-950 hover:bg-slate-800 text-white rounded-lg cursor-pointer mt-1"
                                  title="Elimina riga"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* RIEPILOGO ATTIVITÀ QUALIFICA */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Riepilogo Attività Qualifica (Ordinarie vs Extra)
                      </h4>
                      <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
                        <span className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-slate-900">
                          Ordinarie: <strong>{totalQualOrdinarieCount}</strong> ({totalQualOrdinarieHours}h)
                        </span>
                        <span className="px-2.5 py-1 bg-slate-200 border border-slate-300 rounded-lg text-slate-900">
                          Extra: <strong>{totalQualExtraCount}</strong> ({totalQualExtraHours}h)
                        </span>
                        <span className="px-3 py-1 bg-slate-950 text-white rounded-lg font-bold">
                          Totale: {totalQualOverallCount} ({totalQualOverallHours}h)
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {qualificationDraftSummary.map((item) => (
                        <div
                          key={item.activityType}
                          className={`p-3.5 rounded-xl border text-xs flex flex-col justify-between ${
                            item.totaleCount > 0
                              ? 'bg-white border-slate-900 shadow-2xs'
                              : 'bg-white/60 border-slate-200 opacity-75'
                          }`}
                        >
                          <div className="font-bold text-slate-900 break-words">
                            {item.activityType}
                          </div>
                          <div className="mt-2 pt-2 border-t border-slate-100 space-y-1 font-mono text-[11px]">
                            <div className="flex items-center justify-between text-slate-600">
                              <span>Ordinarie:</span>
                              <strong className="text-slate-900">
                                {item.ordinarieCount} ({item.ordinarieHours}h)
                              </strong>
                            </div>
                            <div className="flex items-center justify-between text-slate-700">
                              <span>Extra:</span>
                              <strong>
                                {item.extraCount} ({item.extraHours}h)
                              </strong>
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 font-bold text-slate-900">
                              <span>Totale:</span>
                              <span className="px-2 py-0.5 bg-slate-950 text-white rounded">
                                {item.totaleCount} ({item.totaleHours}h)
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* =============================================================== */}
              {/* BOTTOM ACTION BAR: "MEMORIZZA" vs "SALVA E STORICIZZA"          */}
              {/* =============================================================== */}
              {canLogActivities && (
                <div className="pt-5 border-t border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="text-xs text-slate-600 max-w-xl leading-relaxed">
                    <strong>Memorizza:</strong> salva le righe nel database come attività <em>in corso (pending)</em> visibile a te e agli altri operatori quando riaprite questa commessa, senza chiuderla nello storico.
                    <br />
                    <strong>Salva e Storicizza:</strong> consolida definitivamente le attività a fine giornate e le sposta nella <strong>Tab Storico</strong>.
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <button
                      type="button"
                      disabled={memorizing || savingBatch}
                      onClick={handleMemorizeClick}
                      className="min-h-[48px] px-5 py-3 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <BookmarkCheck className="w-4 h-4" />
                      <span>
                        {memorizing ? 'Memorizzazione...' : 'Memorizza (Continua Pending)'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={savingBatch || memorizing}
                      onClick={handleSaveAndHistorize}
                      className="min-h-[48px] px-6 py-3 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      <span>
                        {savingBatch ? 'Storicizzazione...' : 'Salva e Storicizza'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: TAB STORICO (CONTEGGIO STORICIZZATO + REPORTINO PDF)       */}
      {/* ===================================================================== */}
      {activeSubTab === 'storico' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500 font-semibold uppercase tracking-wider">
                <History className="w-4 h-4 text-slate-700" />
                <span>ARCHIVIO STORICO SUL DATABASE &amp; REPORTINO</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                Storico Attività Storicizzate, Consuntivo e Reportino PDF
              </h2>
            </div>

            {canGenerateReport && (
              <button
                type="button"
                disabled={filteredActivities.length === 0}
                onClick={() => {
                  const targetProj =
                    reportFilterProjectId !== 'all'
                      ? projects.find((p) => p.id === reportFilterProjectId)
                      : selectedProject;
                  setClientSignerName(targetProj?.clientName || '');
                  setHasClientSig(false);
                  setHasTechSig(false);
                  setShowReportSignatureModal(true);
                }}
                className="min-h-[46px] px-5 py-2.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Firma e Genera Reportino PDF ({filteredActivities.length})</span>
              </button>
            )}
          </div>

          {/* Filter Controls: Project + Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="sm:col-span-5">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Filtro Progetto / Commessa
              </label>
              <select
                value={reportFilterProjectId}
                onChange={(e) => setReportFilterProjectId(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white text-slate-900 font-medium"
              >
                <option value="all">Tutti i Progetti ({projects.length})</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.clientName} — {p.title} (Off. {p.quoteNumber} · Ord. {p.orderNumber})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Filtro Data Da
              </label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono bg-white"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Filtro Data A
              </label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono bg-white"
              />
            </div>

            <div className="sm:col-span-1 flex items-end">
              <button
                type="button"
                onClick={() => {
                  setFilterDateFrom('');
                  setFilterDateTo('');
                }}
                className="w-full min-h-[42px] px-2 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                title="Azzera filtro date"
              >
                Tutte
              </button>
            </div>
          </div>

          {/* CONSUNTIVO STORICIZZATO TARATURE (NON SOMMATO TRA TARATURA / CERTIFICATO / ETICHETTE) */}
          {historicalTaraturaLogs.length > 0 && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-slate-700" />
                  Consuntivo Storicizzato Tarature per Tipologia Strumento (Conteggio Unico non sommato)
                </h3>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-slate-900">
                    Ordinarie: <strong>{histCalTotalOrd}</strong>
                  </span>
                  <span className="px-2.5 py-1 bg-slate-200 border border-slate-300 rounded-lg text-slate-900">
                    Extra: <strong>{histCalTotalExt}</strong>
                  </span>
                  <span className="px-2.5 py-1 bg-slate-950 text-white rounded-lg font-bold">
                    Totale Strumenti: {histCalTotalOrd + histCalTotalExt}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {historicalCalibrationSummary.map((c) => (
                  <div
                    key={c.instrumentType}
                    className={`p-2.5 rounded-xl border text-xs ${
                      c.totale > 0
                        ? 'bg-white border-slate-900'
                        : 'bg-white/50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="font-bold text-slate-900 break-words">{c.instrumentType}</div>
                    {c.totale > 0 && (
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        T:{c.taraturaTot} · C:{c.certificatoTot} · E:{c.etichetteTot}
                      </div>
                    )}
                    <div className="flex items-center justify-between font-mono text-[11px] mt-1 pt-1 border-t border-slate-100">
                      <span>Ord: <strong>{c.ordinarie}</strong></span>
                      <span className="text-slate-700">Ext: <strong>{c.extra}</strong></span>
                      <span className="font-bold text-slate-900">Tot: {c.totale}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CONSUNTIVO STORICIZZATO QUALIFICHE */}
          {historicalQualificaLogs.length > 0 && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-slate-700" />
                  Consuntivo Storicizzato Qualifiche per Tipologia (Ordinarie vs Extra)
                </h3>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-slate-900">
                    Ordinarie: <strong>{histQualTotalOrdCount}</strong> ({histQualTotalOrdHours}h)
                  </span>
                  <span className="px-2.5 py-1 bg-slate-200 border border-slate-300 rounded-lg text-slate-900">
                    Extra: <strong>{histQualTotalExtCount}</strong> ({histQualTotalExtHours}h)
                  </span>
                  <span className="px-2.5 py-1 bg-slate-950 text-white rounded-lg font-bold">
                    Totale: {histQualTotalOrdCount + histQualTotalExtCount} ({histQualTotalOrdHours + histQualTotalExtHours}h)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                {historicalQualificationSummary.map((q) => (
                  <div
                    key={q.activityType}
                    className={`p-3 rounded-xl border text-xs ${
                      q.totaleCount > 0
                        ? 'bg-white border-slate-900'
                        : 'bg-white/50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="font-bold text-slate-900 break-words">{q.activityType}</div>
                    <div className="flex items-center justify-between font-mono text-[11px] mt-1.5 pt-1.5 border-t border-slate-100">
                      <span>Ord: <strong>{q.ordinarieCount}</strong> ({q.ordinarieHours}h)</span>
                      <span className="text-slate-700">Ext: <strong>{q.extraCount}</strong> ({q.extraHours}h)</span>
                      <span className="font-bold text-slate-900">Tot: {q.totaleCount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ORGANIZZAZIONE STORICO ATTIVITÀ PER CARD CLIENTE */}
          {filteredActivities.length === 0 ? (
            <div className="p-10 text-center border border-dashed border-slate-200 rounded-2xl">
              <p className="text-sm font-semibold text-slate-700">
                Nessuna attività storicizzata per i filtri selezionati.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Compila la tabella nella tab &quot;Compilazione Attività&quot; e clicca su &quot;Salva e Storicizza&quot; a fine attività.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-700" />
                <span>
                  Storico Attività per Cliente — Clicca sulla Card del Cliente per aprire lo storico delle attività svolte
                </span>
              </div>

              {getHistoricalByClient(filteredActivities).map((clientGroup) => {
                const isOpen = expandedStoricoClientKey === clientGroup.clientKey;
                return (
                  <div
                    key={clientGroup.clientKey}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedStoricoClientKey((prev) =>
                          prev === clientGroup.clientKey ? null : clientGroup.clientKey
                        )
                      }
                      className="w-full p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-slate-950 text-white flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-slate-950">
                              {clientGroup.clientName}
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-md bg-slate-950 text-white font-mono text-xs font-bold">
                              {clientGroup.activities.length}{' '}
                              {clientGroup.activities.length === 1
                                ? 'Attività Storicizzata'
                                : 'Attività Storicizzate'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-950 text-white text-xs font-semibold shrink-0 self-start sm:self-center">
                        <span>{isOpen ? 'Chiudi Storico' : 'Apri Storico Cliente'}</span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-200 overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[920px]">
                          <thead>
                            <tr className="bg-slate-950 text-white text-[11px] font-bold uppercase tracking-wider">
                              <th className="py-3 px-3">Data / Serie Date</th>
                              <th className="py-3 px-3">Cliente &amp; Commessa</th>
                              <th className="py-3 px-3">Tipo Attività / Documento</th>
                              <th className="py-3 px-3">Dettaglio (Strumento / Numero / Macchina / Ore)</th>
                              <th className="py-3 px-3">Note</th>
                              <th className="py-3 px-3 text-center">Luogo</th>
                              <th className="py-3 px-3 text-center">Ord. / Extra</th>
                              <th className="py-3 px-3">Tecnico</th>
                              {canDeleteActivities && <th className="py-3 px-3 w-12"></th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-xs align-top">
                            {clientGroup.activities.map((act) => (
                              <tr key={act.id} className="hover:bg-slate-50/80">
                                <td className="py-3 px-3 font-mono font-bold text-slate-900">
                                  {act.executionDates && act.executionDates.length > 1 ? (
                                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                                      {act.executionDates.map((d) => (
                                        <span
                                          key={d}
                                          className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px]"
                                        >
                                          {formatItalianDate(d)}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    formatItalianDate(act.executionDate)
                                  )}
                                  {act.scadenza && (
                                    <div className="mt-1 text-[10px] font-mono text-slate-600">
                                      Scad.: <strong>{act.scadenza}</strong>
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3">
                                  <div className="font-bold text-slate-900 break-words">{act.clientName}</div>
                                  <div className="text-[11px] text-slate-500 font-mono break-words">
                                    {act.projectTitle} (Off. {act.quoteNumber} · Ord. {act.orderNumber})
                                  </div>
                                </td>
                                <td className="py-3 px-3">
                                  {act.calibrationInstrumentType ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-900 border border-slate-300 font-bold">
                                      {act.calibrationActivityType || 'Taratura'}
                                    </span>
                                  ) : act.complianceDocumentType ? (
                                    <div className="font-bold text-slate-900 whitespace-pre-wrap break-words">
                                      {act.complianceDocumentType}
                                    </div>
                                  ) : act.qualificationActivityType ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-900 border border-slate-300 font-bold">
                                      {act.qualificationActivityType}
                                    </span>
                                  ) : (
                                    <span className="font-semibold text-slate-800 whitespace-pre-wrap break-words">
                                      {act.lineItemTitle || act.description}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 font-mono">
                                  {act.calibrationInstrumentType ? (
                                    <div className="space-y-0.5">
                                      <div className="font-sans font-bold text-slate-900">
                                        Strumento: {act.calibrationInstrumentType}
                                      </div>
                                      <div className="text-slate-700 font-bold">
                                        Numero: {act.instrumentCount ?? 1}
                                      </div>
                                    </div>
                                  ) : act.complianceDocumentType ? (
                                    <span className="text-slate-500 text-[11px]">Documento Compliance</span>
                                  ) : (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {act.qualificationPhase && (
                                        <span className="px-2 py-0.5 bg-slate-950 text-white rounded text-[11px] font-bold">
                                          {act.qualificationPhase}
                                        </span>
                                      )}
                                      {act.machineType && (
                                        <span className="text-slate-800 font-sans font-semibold whitespace-pre-wrap break-words">
                                          Macchina: {act.machineType}
                                        </span>
                                      )}
                                      {act.durationHours > 0 && (
                                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-900 rounded text-[11px] font-bold">
                                          {act.durationHours}h
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-slate-700 whitespace-pre-wrap break-words max-w-xs">
                                  {act.notes || act.materialsNotes || '—'}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded text-[11px] font-semibold whitespace-nowrap">
                                    {act.workplaceFlag === 'ufficio' ? 'In Ufficio' : 'Da Cliente'}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {act.isExtra ? (
                                    <span className="px-2.5 py-1 rounded-md bg-slate-950 text-white font-bold text-[11px]">
                                      EXTRA
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-300 font-bold text-[11px]">
                                      ORDINARIA
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-slate-600">{act.technicianName}</td>
                                {canDeleteActivities && (
                                  <td className="py-3 px-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => onDeleteActivity(act.id)}
                                      className="p-1.5 bg-slate-950 hover:bg-slate-800 text-white rounded-lg cursor-pointer"
                                      title="Elimina riga dallo storico"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Digital Signature & Reportino PDF Generation (Dual Copy) */}
      {showReportSignatureModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-5 shadow-xl my-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="text-xs font-mono text-slate-500 font-semibold uppercase tracking-wider">
                  GENERAZIONE REPORTINO INTERVENTO (2 COPIE)
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  Firma Digitale in Calce al Reportino
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verrà generato un PDF con <strong>Copia 1 per il Cliente</strong> e <strong>Copia 2 per l&apos;Amministrazione</strong> completo di data di stampa e firme digitali.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReportSignatureModal(false)}
                className="p-2 bg-slate-950 hover:bg-slate-800 text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome e Cognome Referente Cliente (Firmatario)
                </label>
                <input
                  type="text"
                  value={clientSignerName}
                  onChange={(e) => setClientSignerName(e.target.value)}
                  placeholder="Es. Ing. Marco Verdi"
                  className="w-full min-h-[44px] px-3.5 py-2 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <PenTool className="w-3.5 h-3.5 text-slate-700" />
                      <span>Firma Digitale Tecnico ({currentUserName})</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => clearCanvas('tech')}
                      className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-white text-[11px] font-semibold rounded-md inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Pulisci
                    </button>
                  </div>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 overflow-hidden">
                    <canvas
                      ref={techCanvasRef}
                      width={280}
                      height={120}
                      onMouseDown={(e) => startSigDraw('tech', e)}
                      onMouseMove={(e) => moveSigDraw('tech', e)}
                      onMouseUp={stopSigDraw}
                      onMouseLeave={stopSigDraw}
                      onTouchStart={(e) => startSigDraw('tech', e)}
                      onTouchMove={(e) => moveSigDraw('tech', e)}
                      onTouchEnd={stopSigDraw}
                      className="w-full h-[120px] touch-none cursor-crosshair"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <PenTool className="w-3.5 h-3.5 text-slate-700" />
                      <span>Firma Digitale per Accettazione Cliente</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => clearCanvas('client')}
                      className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-white text-[11px] font-semibold rounded-md inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Pulisci
                    </button>
                  </div>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 overflow-hidden">
                    <canvas
                      ref={clientCanvasRef}
                      width={280}
                      height={120}
                      onMouseDown={(e) => startSigDraw('client', e)}
                      onMouseMove={(e) => moveSigDraw('client', e)}
                      onMouseUp={stopSigDraw}
                      onMouseLeave={stopSigDraw}
                      onTouchStart={(e) => startSigDraw('client', e)}
                      onTouchMove={(e) => moveSigDraw('client', e)}
                      onTouchEnd={stopSigDraw}
                      className="w-full h-[120px] touch-none cursor-crosshair"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowReportSignatureModal(false)}
                className="min-h-[44px] px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleConfirmAndGenerateReportinoPdf}
                className="min-h-[44px] px-5 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Stampa / Scarica Reportino PDF (Cliente + Amministrazione)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
