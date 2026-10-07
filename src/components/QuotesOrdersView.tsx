import React, { useState } from 'react';
import {
  FileText,
  Plus,
  CheckCircle2,
  Printer,
  Search,
  ArrowRight,
  X,
  Trash2,
  GitBranch,
  History,
  MapPin,
  Clock,
  Lock,
  Unlock,
  ClipboardCheck,
  Building2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  CALIBRATION_INSTRUMENT_TYPES,
  DURATION_TYPE_LABELS,
  MACRO_CATEGORY_LABELS,
  PRICING_MODE_LABELS,
  QUALIFICATION_QUOTE_ACTIVITIES,
  formatQuoteCodeWithRev,
  formatRevision,
  type ActivityLog,
  type Client,
  type Project,
  type Quote,
  type QuoteDurationType,
  type QuoteLineItem,
  type QuoteMacroCategory,
  type QuotePricingMode,
} from '../types';
import { generateQuotePdf } from '../utils/pdfGenerator';

interface QuotesOrdersViewProps {
  quotes: Quote[];
  clients: Client[];
  projects: Project[];
  activities: ActivityLog[];
  canCreateQuotes: boolean;
  canReceiveOrders: boolean;
  onCreateQuote: (data: {
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
  }) => Promise<void>;
  onReceiveOrder: (
    quote: Quote,
    orderNumber: string,
    orderDate: string,
    sector: string
  ) => Promise<void>;
  onOpenProjectActivities?: (projectId: string) => void;
}

const MAX_LINE_ITEMS = 20;

export const QuotesOrdersView: React.FC<QuotesOrdersViewProps> = ({
  quotes,
  clients,
  projects,
  activities,
  canCreateQuotes,
  canReceiveOrders,
  onCreateQuote,
  onReceiveOrder,
  onOpenProjectActivities,
}) => {
  // Active Queue Tab: 'pending' = In Attesa di Ordine, 'confirmed' = Confermate, 'history' = Storico Revisioni
  const [activeQueue, setActiveQueue] = useState<'pending' | 'confirmed' | 'history'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClientKey, setExpandedClientKey] = useState<string | null>(null);

  // Modal: Create or Revise Quote
  const [showNewQuoteModal, setShowNewQuoteModal] = useState(false);

  // Modal: Click on Pending Quote -> Insert Order Number (Conferma / Annulla)
  const [orderModalQuote, setOrderModalQuote] = useState<Quote | null>(null);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Modal: Click on Confirmed Quote -> View Offer Details & Unlocked Activities
  const [selectedConfirmedQuote, setSelectedConfirmedQuote] = useState<Quote | null>(null);

  // Modal: View Revision History for a specific Quote Number (Rev. 00, Rev. 01, Rev. 02...)
  const [historyModalQuoteNumber, setHistoryModalQuoteNumber] = useState<string | null>(null);

  // Revision state
  const [baseQuoteForRevision, setBaseQuoteForRevision] = useState<Quote | null>(null);

  // New / Revision Quote Form State
  const [macroCategory, setMacroCategory] = useState<QuoteMacroCategory>('taratura');
  const [pricingMode, setPricingMode] = useState<QuotePricingMode>('a_strumento');
  const [durationType, setDurationType] = useState<QuoteDurationType>('singola');
  const [contractYears, setContractYears] = useState<number>(2);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [clientVat, setClientVat] = useState('');
  const [clientSdi, setClientSdi] = useState('');
  const [clientCity, setClientCity] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [facilityAddress, setFacilityAddress] = useState('');

  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [systemInfo, setSystemInfo] = useState('');
  const [extraCosts, setExtraCosts] = useState('');
  const [estimatedDays, setEstimatedDays] = useState(1);
  const [dailyRate, setDailyRate] = useState(650);
  const [dailyRateEngineer, setDailyRateEngineer] = useState<string>('600');
  const [dailyRateSpecialist, setDailyRateSpecialist] = useState<string>('750');
  const [dailyRateConsultant, setDailyRateConsultant] = useState<string>('900');
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([
    {
      id: 'item-1',
      itemType: CALIBRATION_INSTRUMENT_TYPES[0],
      activityOrSpec: '',
      plannedTests: [''],
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
    },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Compute next automatic unique quote number for preview
  const computeNextQuoteNumberPreview = (): string => {
    const year = new Date().getFullYear();
    const prefix = `OFF-${year}-`;
    let maxSeq = 0;
    for (const q of quotes) {
      if (q.quoteNumber && q.quoteNumber.startsWith(prefix)) {
        const numPart = parseInt(q.quoteNumber.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxSeq) {
          maxSeq = numPart;
        }
      }
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  };

  // Compute next revision number if revising an existing quote
  const computeNextRevisionPreview = (quoteNum: string): number => {
    const matching = quotes.filter((q) => q.quoteNumber === quoteNum);
    const maxRev = matching.reduce((max, q) => Math.max(max, q.revision ?? 0), -1);
    return maxRev + 1;
  };

  // Open Modal for Brand New Quote (Rev. 00)
  const handleOpenNewQuote = () => {
    setBaseQuoteForRevision(null);
    setMacroCategory('taratura');
    setPricingMode('a_strumento');
    setDurationType('singola');
    setContractYears(2);
    setSelectedClientId('');
    setSelectedFacilityId('');
    setClientName('');
    setClientVat('');
    setClientSdi('');
    setClientCity('');
    setFacilityName('');
    setFacilityAddress('');
    setProjectTitle('');
    setProjectDescription('');
    setSystemInfo('');
    setExtraCosts('');
    setEstimatedDays(1);
    setDailyRate(600);
    setDailyRateEngineer('600');
    setDailyRateSpecialist('750');
    setDailyRateConsultant('900');
    setLineItems([
      {
        id: `item-${Date.now()}`,
        itemType: CALIBRATION_INSTRUMENT_TYPES[0],
        activityOrSpec: '',
        plannedTests: [''],
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
      },
    ]);
    setErrorMsg(null);
    setShowNewQuoteModal(true);
  };

  // Open Modal for Revision of an Existing Quote (Rev. 01, Rev. 02...)
  const handleOpenRevisionModal = (quote: Quote, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setOrderModalQuote(null);
    setBaseQuoteForRevision(quote);
    setMacroCategory(quote.macroCategory || 'qualifica');
    setPricingMode(quote.pricingMode || 'consuntivo_giornate');
    setDurationType(quote.durationType || 'singola');
    setContractYears(
      quote.durationType === 'multianno' ? Math.max(2, quote.contractYears || 2) : 2
    );
    setSelectedClientId(quote.clientId || '');
    setSelectedFacilityId(quote.facilityId || '');
    setClientName(quote.clientName);
    setClientVat(quote.clientVat);
    setClientSdi(quote.clientSdi || '');
    setClientCity(quote.clientCity || '');
    setFacilityName(quote.facilityName || '');
    setFacilityAddress(quote.facilityAddress || '');
    setProjectTitle(quote.projectTitle);
    setProjectDescription(quote.projectDescription);
    setSystemInfo(quote.systemInfo || '');
    setExtraCosts(quote.extraCosts || '');
    setEstimatedDays(
      quote.estimatedDays || Math.max(1, Math.round((quote.estimatedHours || 8) / 8))
    );
    const fallbackRate = quote.dailyRate || (quote.hourlyRate ? quote.hourlyRate * 8 : 600);
    setDailyRate(fallbackRate);
    setDailyRateEngineer(
      quote.dailyRates?.engineer !== undefined
        ? String(quote.dailyRates.engineer)
        : String(fallbackRate)
    );
    setDailyRateSpecialist(
      quote.dailyRates?.specialist !== undefined ? String(quote.dailyRates.specialist) : '750'
    );
    setDailyRateConsultant(
      quote.dailyRates?.consultant !== undefined ? String(quote.dailyRates.consultant) : '900'
    );
    if (quote.lineItems && quote.lineItems.length > 0) {
      setLineItems(
        quote.lineItems.map((li) => ({
          ...li,
          plannedTests:
            Array.isArray(li.plannedTests) && li.plannedTests.length > 0
              ? [...li.plannedTests]
              : [''],
        }))
      );
    } else {
      setLineItems([
        {
          id: `item-${Date.now()}`,
          itemType: quote.macroCategory === 'taratura' ? CALIBRATION_INSTRUMENT_TYPES[0] : '',
          activityOrSpec: quote.macroCategory === 'qualifica' ? 'Scrittura Protocollo' : '',
          plannedTests: [''],
          quantity: 1,
          unitPrice: 0,
          totalPrice: 0,
        },
      ]);
    }
    setErrorMsg(null);
    setShowNewQuoteModal(true);
  };

  // Handle Client selection from dropdown
  const handleSelectClient = (id: string) => {
    setSelectedClientId(id);
    if (!id) {
      setSelectedFacilityId('');
      setClientName('');
      setClientVat('');
      setClientSdi('');
      setClientCity('');
      setFacilityName('');
      setFacilityAddress('');
      return;
    }
    const found = clients.find((c) => c.id === id);
    if (found) {
      setClientName(found.companyName);
      setClientVat(found.vatNumber);
      setClientSdi(found.sdiCode || '0000000');
      setClientCity(found.city || '');
      const firstFac = (found.facilities || [])[0];
      if (firstFac) {
        setSelectedFacilityId(firstFac.id);
        setFacilityName(firstFac.name);
        setFacilityAddress(firstFac.address);
        if (firstFac.city) setClientCity(firstFac.city);
      } else {
        setSelectedFacilityId('');
        setFacilityName('');
        setFacilityAddress(found.address || '');
      }
    }
  };

  // Handle Facility selection from dropdown
  const handleSelectFacility = (facId: string) => {
    setSelectedFacilityId(facId);
    const foundClient = clients.find((c) => c.id === selectedClientId);
    const fac = foundClient?.facilities?.find((f) => f.id === facId);
    if (fac) {
      setFacilityName(fac.name);
      setFacilityAddress(fac.address);
      if (fac.city) setClientCity(fac.city);
    } else {
      setFacilityName('');
      setFacilityAddress('');
    }
  };

  // Switch Macro Category and adjust allowed Pricing Mode
  const handleSelectMacroCategory = (cat: QuoteMacroCategory) => {
    setMacroCategory(cat);
    if (cat === 'qualifica') {
      if (pricingMode === 'a_strumento' || pricingMode === 'consuntivo_strumento') {
        setPricingMode('progetto_equipment');
      }
      setLineItems((prev) =>
        prev.map((li) => ({
          ...li,
          activityOrSpec: li.activityOrSpec || 'Scrittura Protocollo',
          plannedTests:
            Array.isArray(li.plannedTests) && li.plannedTests.length > 0
              ? li.plannedTests
              : [''],
        }))
      );
    } else if (cat === 'compliance') {
      if (pricingMode === 'a_strumento' || pricingMode === 'consuntivo_strumento') {
        setPricingMode('progetto_equipment');
      }
    } else if (cat === 'taratura') {
      if (pricingMode === 'progetto_equipment' || pricingMode === 'consuntivo_strumento') {
        setPricingMode('a_strumento');
      }
      setLineItems((prev) =>
        prev.map((li) => ({
          ...li,
          itemType: CALIBRATION_INSTRUMENT_TYPES.includes(li.itemType as any)
            ? li.itemType
            : CALIBRATION_INSTRUMENT_TYPES[0],
        }))
      );
    }
  };

  // Line items management (up to 20 rows)
  const handleAddLineItem = () => {
    if (lineItems.length >= MAX_LINE_ITEMS) return;
    setLineItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length + 1}`,
        itemType: macroCategory === 'taratura' ? CALIBRATION_INSTRUMENT_TYPES[0] : '',
        activityOrSpec: macroCategory === 'qualifica' ? 'Scrittura Protocollo' : '',
        plannedTests: [''],
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
      },
    ]);
  };

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateLineItem = (
    id: string,
    field: 'itemType' | 'activityOrSpec' | 'quantity' | 'unitPrice',
    value: string | number
  ) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        const qty = Math.max(1, Number(updated.quantity) || 1);
        const price = Math.max(0, Number(updated.unitPrice) || 0);
        updated.totalPrice = Math.round(qty * price * 100) / 100;
        return updated;
      })
    );
  };

  // Sub-items for "Test / Test Previsti" on Qualifica rows
  const handleAddPlannedTest = (itemId: string) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const currentTests = Array.isArray(item.plannedTests) ? item.plannedTests : [''];
        return {
          ...item,
          plannedTests: [...currentTests, ''],
        };
      })
    );
  };

  const handleUpdatePlannedTest = (itemId: string, testIdx: number, val: string) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const currentTests =
          Array.isArray(item.plannedTests) && item.plannedTests.length > 0
            ? [...item.plannedTests]
            : [''];
        currentTests[testIdx] = val;
        return {
          ...item,
          plannedTests: currentTests,
        };
      })
    );
  };

  const handleRemovePlannedTest = (itemId: string, testIdx: number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const currentTests = Array.isArray(item.plannedTests) ? [...item.plannedTests] : [''];
        if (currentTests.length <= 1) {
          return { ...item, plannedTests: [''] };
        }
        return {
          ...item,
          plannedTests: currentTests.filter((_, idx) => idx !== testIdx),
        };
      })
    );
  };

  // Helper to insert Word-like formatting snippets into "Informazioni sul Sistema"
  const handleInsertSystemInfoSnippet = (snippet: string) => {
    setSystemInfo((prev) => {
      if (!prev.trim()) return snippet;
      return `${prev.replace(/\s+$/, '')}\n${snippet}`;
    });
  };

  // Calculate total preview
  const parsedEngRate = Math.max(0, Number(dailyRateEngineer) || 0);
  const parsedSpecRate = Math.max(0, Number(dailyRateSpecialist) || 0);
  const parsedConsRate = Math.max(0, Number(dailyRateConsultant) || 0);

  const computedTotalAmount =
    pricingMode === 'consuntivo_giornate'
      ? parsedEngRate + parsedSpecRate + parsedConsRate
      : pricingMode === 'consuntivo_strumento'
      ? lineItems.reduce((sum, item) => sum + (Number(item.unitPrice) || 0), 0)
      : lineItems.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);

  const matchesSearch = (q: Quote) =>
    q.quoteNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.projectTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (q.facilityName && q.facilityName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (q.orderNumber && q.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()));

  const pendingQuotes = quotes.filter((q) => q.status === 'sent' && matchesSearch(q));
  const confirmedQuotes = quotes.filter((q) => q.status === 'accepted' && matchesSearch(q));

  // Group all quotes by quoteNumber for the Revision History ("Storico Revisioni")
  const allFilteredQuotes = quotes.filter(matchesSearch);
  const groupedHistoryByQuoteNumber: {
    quoteNumber: string;
    revisions: Quote[];
  }[] = Array.from(
    allFilteredQuotes.reduce((map, q) => {
      const list = map.get(q.quoteNumber) || [];
      list.push(q);
      map.set(q.quoteNumber, list);
      return map;
    }, new Map<string, Quote[]>())
  ).map(([quoteNumber, revs]) => ({
    quoteNumber,
    revisions: [...revs].sort((a, b) => (a.revision ?? 0) - (b.revision ?? 0)),
  }));

  // Count how many superseded revisions or multi-revision offers exist
  const supersededCount = quotes.filter((q) => q.status === 'superseded').length;

  // Group by Client helper for Pending, Confirmed, and History
  const groupQuotesByClient = (list: Quote[]) => {
    const map = new Map<
      string,
      {
        clientKey: string;
        clientName: string;
        clientVat: string;
        clientCity: string;
        quotes: Quote[];
      }
    >();
    for (const q of list) {
      const key = (q.clientName || 'Cliente').trim().toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.quotes.push(q);
      } else {
        map.set(key, {
          clientKey: key,
          clientName: q.clientName || 'Cliente',
          clientVat: q.clientVat || '-',
          clientCity: q.clientCity || '',
          quotes: [q],
        });
      }
    }
    return Array.from(map.values());
  };

  const pendingByClient = groupQuotesByClient(pendingQuotes);
  const confirmedByClient = groupQuotesByClient(confirmedQuotes);

  const historyByClient = (() => {
    const map = new Map<
      string,
      {
        clientKey: string;
        clientName: string;
        clientVat: string;
        groups: { quoteNumber: string; revisions: Quote[] }[];
      }
    >();
    for (const grp of groupedHistoryByQuoteNumber) {
      const latest = grp.revisions[grp.revisions.length - 1];
      const key = (latest?.clientName || 'Cliente').trim().toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.groups.push(grp);
      } else {
        map.set(key, {
          clientKey: key,
          clientName: latest?.clientName || 'Cliente',
          clientVat: latest?.clientVat || '-',
          groups: [grp],
        });
      }
    }
    return Array.from(map.values());
  })();

  const toggleClientCard = (clientKey: string) => {
    setExpandedClientKey((prev) => (prev === clientKey ? null : clientKey));
  };

  const getRevisionsForQuoteNumber = (quoteNumber: string): Quote[] => {
    return quotes
      .filter((q) => q.quoteNumber === quoteNumber)
      .sort((a, b) => (a.revision ?? 0) - (b.revision ?? 0));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedClientId && !clientName.trim()) {
      setErrorMsg('Seleziona un cliente dal menu a tendina.');
      return;
    }

    if (!projectDescription.trim()) {
      setErrorMsg('Inserisci la Descrizione delle attività (campo obbligatorio).');
      return;
    }

    const preparedLineItems: QuoteLineItem[] = lineItems
      .map((li) => {
        const cleanTests = (li.plannedTests || [])
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
        const effectiveItemType =
          li.itemType.trim() ||
          (macroCategory === 'qualifica' ? li.activityOrSpec.trim() : '');
        const effectiveQty =
          pricingMode === 'consuntivo_strumento' ? 1 : Math.max(1, Number(li.quantity) || 1);
        const effectiveUnit = Math.max(0, Number(li.unitPrice) || 0);
        return {
          ...li,
          itemType: effectiveItemType,
          activityOrSpec: li.activityOrSpec.trim(),
          plannedTests: cleanTests,
          quantity: effectiveQty,
          unitPrice: effectiveUnit,
          totalPrice: Math.round(effectiveQty * effectiveUnit * 100) / 100,
        };
      })
      .filter((li) => li.itemType !== '' || li.activityOrSpec !== '');

    if (pricingMode !== 'consuntivo_giornate' && preparedLineItems.length === 0) {
      setErrorMsg(
        pricingMode === 'a_strumento' || pricingMode === 'consuntivo_strumento'
          ? 'Inserisci almeno uno strumento nella tabella attività.'
          : 'Inserisci almeno una riga di attività nella tabella.'
      );
      return;
    }

    if (macroCategory === 'qualifica' && preparedLineItems.length === 0) {
      setErrorMsg('Aggiungi almeno una riga di attività per la qualifica.');
      return;
    }

    const effectiveDailyRate = parsedEngRate || parsedSpecRate || parsedConsRate || dailyRate || 600;

    setSubmitting(true);
    try {
      await onCreateQuote({
        baseQuoteNumberForRevision: baseQuoteForRevision
          ? baseQuoteForRevision.quoteNumber
          : undefined,
        macroCategory,
        pricingMode,
        durationType,
        contractYears: durationType === 'multianno' ? Math.max(2, Number(contractYears) || 2) : 1,
        clientId: selectedClientId || undefined,
        clientName: clientName.trim() || 'Cliente',
        clientVat: clientVat.trim() || '-',
        clientSdi: clientSdi || '0000000',
        clientCity,
        facilityId: selectedFacilityId || undefined,
        facilityName,
        facilityAddress,
        projectTitle:
          projectTitle.trim() ||
          `Quotazione ${MACRO_CATEGORY_LABELS[macroCategory]} — ${clientName.trim() || 'Cliente'}`,
        projectDescription: projectDescription.trim(),
        systemInfo: systemInfo.trim(),
        extraCosts: extraCosts.trim(),
        estimatedDays: 1,
        dailyRate: effectiveDailyRate,
        dailyRates:
          pricingMode === 'consuntivo_giornate'
            ? {
                engineer: parsedEngRate,
                specialist: parsedSpecRate,
                consultant: parsedConsRate,
              }
            : undefined,
        lineItems:
          pricingMode === 'consuntivo_giornate' && macroCategory !== 'qualifica'
            ? []
            : preparedLineItems,
      });
      setShowNewQuoteModal(false);
      setBaseQuoteForRevision(null);
      setActiveQueue('pending');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Errore durante il salvataggio offerta');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm Order Modal Submit
  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderModalQuote || !orderNumber.trim()) return;
    setSubmittingOrder(true);
    try {
      await onReceiveOrder(
        orderModalQuote,
        orderNumber.trim(),
        orderDate,
        'Life Sciences & Industriale'
      );
      setOrderModalQuote(null);
      setOrderNumber('');
      setActiveQueue('confirmed');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const selectedClientObj = clients.find((c) => c.id === selectedClientId);

  const getConfirmedQuoteProject = (quote: Quote): Project | undefined => {
    return projects.find(
      (p) =>
        p.quoteId === quote.id ||
        p.quoteNumber === formatQuoteCodeWithRev(quote.quoteNumber, quote.revision ?? 0) ||
        p.quoteNumber.startsWith(quote.quoteNumber)
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-950 tracking-tight">
            Gestione Offerte, Revisioni &amp; Ordini
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Le nuove offerte partono da <strong>Rev. 00</strong> in <strong>Attesa di Ordine</strong>. Tutte le revisioni successive (<strong>Rev. 01, Rev. 02...</strong>) vengono conservate nello <strong>Storico Revisioni</strong>.
          </p>
        </div>
        {canCreateQuotes && (
          <button
            type="button"
            onClick={handleOpenNewQuote}
            className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nuova Offerta (Rev. 00)</span>
          </button>
        )}
      </div>

      {/* Queue Switcher Tabs ("In Attesa di Ordine", "Confermate", "Storico Revisioni") + Search */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 bg-slate-200/80 p-1.5 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveQueue('pending')}
            className={`min-h-[42px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
              activeQueue === 'pending'
                ? 'bg-slate-950 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span>In Attesa di Ordine</span>
            <span className="font-mono text-xs opacity-80">({pendingQuotes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveQueue('confirmed')}
            className={`min-h-[42px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
              activeQueue === 'confirmed'
                ? 'bg-slate-950 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Confermate (Con Ordine)</span>
            <span className="font-mono text-xs opacity-80">({confirmedQuotes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveQueue('history')}
            className={`min-h-[42px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
              activeQueue === 'history'
                ? 'bg-slate-950 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <History className="w-4 h-4 shrink-0" />
            <span>Storico Revisioni</span>
            <span className="font-mono text-xs opacity-80">
              ({quotes.length}{supersededCount > 0 ? ` · ${supersededCount} rev. prec.` : ''})
            </span>
          </button>
        </div>

        <div className="relative flex-1 lg:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca per N° Offerta, N° Ordine, Cliente o Progetto..."
            className="w-full min-h-[42px] pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950"
          />
        </div>
      </div>

      {/* QUEUE 1: IN ATTESA DI ORDINE (ORGANIZZATO PER CARD CLIENTE) */}
      {activeQueue === 'pending' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              Quotazioni Pending per Cliente — Clicca sulla Card del Cliente per aprire le quotazioni in attesa di ordine
            </div>
          </div>

          {pendingByClient.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-950">
                Nessuna offerta in attesa di ordine
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Crea una nuova offerta (Rev. 00): verrà salvata sul database sotto la card del cliente finché non riceverai l&apos;ordine.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingByClient.map((clientGroup) => {
                const isOpen = expandedClientKey === `pending_${clientGroup.clientKey}`;
                const totalClientPending = clientGroup.quotes.reduce(
                  (acc, q) => acc + (q.totalAmount || 0),
                  0
                );

                return (
                  <div
                    key={clientGroup.clientKey}
                    className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
                  >
                    {/* CLIENT CARD HEADER */}
                    <button
                      type="button"
                      onClick={() => toggleClientCard(`pending_${clientGroup.clientKey}`)}
                      className="w-full p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-slate-950 text-white flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base sm:text-lg font-bold text-slate-950">
                              {clientGroup.clientName}
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-md bg-slate-950 text-white font-mono text-xs font-bold">
                              {clientGroup.quotes.length}{' '}
                              {clientGroup.quotes.length === 1
                                ? 'Quotazione Pending'
                                : 'Quotazioni Pending'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">
                            P.IVA: {clientGroup.clientVat}
                            {clientGroup.clientCity ? ` · ${clientGroup.clientCity}` : ''} · Valore Totale Pending: €{' '}
                            {totalClientPending.toLocaleString('it-IT', {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-950 text-white text-xs font-semibold shrink-0 self-start sm:self-center">
                        <span>{isOpen ? 'Chiudi Quotazioni' : 'Apri Quotazioni Pending'}</span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>

                    {/* EXPANDED CLIENT QUOTES */}
                    {isOpen && (
                      <div className="border-t border-slate-200 bg-slate-50/70 p-3 sm:p-4 space-y-3">
                        {clientGroup.quotes.map((quote) => {
                          const quoteHistoryList = getRevisionsForQuoteNumber(quote.quoteNumber);
                          return (
                            <div
                              key={quote.id}
                              onClick={() => {
                                if (canReceiveOrders) {
                                  setOrderModalQuote(quote);
                                  setOrderNumber('');
                                  setOrderDate(new Date().toISOString().split('T')[0]);
                                }
                              }}
                              className={`bg-white rounded-xl border border-slate-200 hover:border-slate-400 shadow-xs transition-colors p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                                canReceiveOrders ? 'cursor-pointer hover:bg-slate-50/70' : ''
                              }`}
                            >
                              <div className="space-y-1.5 flex-1">
                                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                                  <span className="font-bold text-slate-950 bg-slate-100 px-2.5 py-1 rounded border border-slate-300">
                                    {formatQuoteCodeWithRev(quote.quoteNumber, quote.revision ?? 0)}
                                  </span>
                                  <span className="text-slate-600 font-sans font-semibold">
                                    · IN ATTESA DI ORDINE
                                  </span>
                                  <span className="text-slate-600 font-sans">
                                    · {MACRO_CATEGORY_LABELS[quote.macroCategory || 'qualifica']}
                                  </span>
                                  <span className="text-slate-700 font-sans font-semibold">
                                    ·{' '}
                                    {quote.durationType === 'multianno'
                                      ? `Multianno (${quote.contractYears || 2} anni)`
                                      : DURATION_TYPE_LABELS[quote.durationType || 'singola']}
                                  </span>
                                  <span className="text-slate-500">
                                    · Del {new Date(quote.createdAt).toLocaleDateString('it-IT')}
                                  </span>
                                </div>

                                <div className="pt-1">
                                  <h4 className="text-sm sm:text-base font-bold text-slate-950">
                                    {quote.projectTitle}
                                  </h4>
                                  {quote.facilityName && (
                                    <div className="text-xs text-slate-600 font-medium flex items-center gap-1 mt-0.5">
                                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                      Stabilimento: <strong>{quote.facilityName}</strong>
                                      {quote.facilityAddress ? ` — ${quote.facilityAddress}` : ''}
                                    </div>
                                  )}
                                </div>

                                <div className="text-xs text-slate-600 font-medium flex items-center gap-1.5 pt-1">
                                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                                  Clicca sull&apos;offerta per inserire il Numero d&apos;Ordine e sbloccare le attività
                                </div>
                              </div>

                              <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0">
                                <div className="text-left lg:text-right">
                                  <div className="text-[11px] text-slate-500 uppercase font-semibold">
                                    Totale Offerta (IVA Escl.)
                                  </div>
                                  <div className="text-lg font-bold text-slate-950 font-mono tabular-nums">
                                    €{' '}
                                    {quote.totalAmount.toLocaleString('it-IT', {
                                      minimumFractionDigits: 2,
                                    })}
                                  </div>
                                </div>

                                <div
                                  className="flex flex-wrap items-center gap-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {quoteHistoryList.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setHistoryModalQuoteNumber(quote.quoteNumber);
                                      }}
                                      className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                      title="Visualizza lo storico di tutte le revisioni (Rev. 00, 01...)"
                                    >
                                      <History className="w-3.5 h-3.5" />
                                      <span>Storico ({quoteHistoryList.length})</span>
                                    </button>
                                  )}
                                  {canCreateQuotes && (
                                    <button
                                      type="button"
                                      onClick={(e) => handleOpenRevisionModal(quote, e)}
                                      className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                      title="Crea una nuova revisione di questa offerta"
                                    >
                                      <GitBranch className="w-3.5 h-3.5" />
                                      <span>
                                        Crea Rev. {formatRevision((quote.revision ?? 0) + 1)}
                                      </span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      generateQuotePdf(quote);
                                    }}
                                    className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span>PDF</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* QUEUE 2: CONFERMATE (ORGANIZZATO PER CARD CLIENTE) */}
      {activeQueue === 'confirmed' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <Unlock className="w-3.5 h-3.5 text-slate-500" />
              Ordini e Offerte Confermate per Cliente — Clicca sulla Card del Cliente per aprire gli ordini confermati
            </div>
          </div>

          {confirmedByClient.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-950">
                Nessuna offerta confermata
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Clicca su un&apos;offerta nella coda &quot;In Attesa di Ordine&quot; e inserisci il numero d&apos;ordine per confermarla e sbloccare le attività.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {confirmedByClient.map((clientGroup) => {
                const isOpen = expandedClientKey === `confirmed_${clientGroup.clientKey}`;
                const totalClientConfirmed = clientGroup.quotes.reduce(
                  (acc, q) => acc + (q.totalAmount || 0),
                  0
                );

                return (
                  <div
                    key={clientGroup.clientKey}
                    className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
                  >
                    {/* CLIENT CARD HEADER */}
                    <button
                      type="button"
                      onClick={() => toggleClientCard(`confirmed_${clientGroup.clientKey}`)}
                      className="w-full p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-slate-950 text-white flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base sm:text-lg font-bold text-slate-950">
                              {clientGroup.clientName}
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-md bg-slate-950 text-white font-mono text-xs font-bold">
                              {clientGroup.quotes.length}{' '}
                              {clientGroup.quotes.length === 1
                                ? 'Ordine Confermato'
                                : 'Ordini Confermati'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">
                            P.IVA: {clientGroup.clientVat}
                            {clientGroup.clientCity ? ` · ${clientGroup.clientCity}` : ''} · Valore Ordini: €{' '}
                            {totalClientConfirmed.toLocaleString('it-IT', {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-950 text-white text-xs font-semibold shrink-0 self-start sm:self-center">
                        <span>{isOpen ? 'Chiudi Ordini' : 'Apri Ordini Confermati'}</span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>

                    {/* EXPANDED CLIENT CONFIRMED ORDERS */}
                    {isOpen && (
                      <div className="border-t border-slate-200 bg-slate-50/70 p-3 sm:p-4 space-y-3">
                        {clientGroup.quotes.map((quote) => {
                          const linkedProject = getConfirmedQuoteProject(quote);
                          const projectActivitiesCount = linkedProject
                            ? activities.filter((a) => a.projectId === linkedProject.id).length
                            : 0;
                          const quoteHistoryList = getRevisionsForQuoteNumber(quote.quoteNumber);

                          return (
                            <div
                              key={quote.id}
                              onClick={() => setSelectedConfirmedQuote(quote)}
                              className="bg-white rounded-xl border border-slate-300 hover:border-slate-500 shadow-xs transition-colors p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70"
                            >
                              <div className="space-y-2.5 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="flex items-center gap-2 bg-slate-950 text-white px-3 py-1 rounded-md">
                                    <span className="text-[10px] uppercase tracking-wider text-slate-300 font-semibold">
                                      N° Offerta
                                    </span>
                                    <span className="font-mono text-xs sm:text-sm font-bold">
                                      {formatQuoteCodeWithRev(
                                        quote.quoteNumber,
                                        quote.revision ?? 0
                                      )}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 bg-slate-100 text-slate-950 border border-slate-300 px-3 py-1 rounded-md">
                                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                                      N° Ordine
                                    </span>
                                    <span className="font-mono text-xs sm:text-sm font-bold">
                                      {quote.orderNumber}
                                    </span>
                                  </div>

                                  {quote.orderDate && (
                                    <span className="text-xs text-slate-500 font-mono">
                                      · Ordine del{' '}
                                      {new Date(quote.orderDate).toLocaleDateString('it-IT')}
                                    </span>
                                  )}

                                  <span className="text-xs font-semibold text-slate-700">
                                    ·{' '}
                                    {quote.durationType === 'multianno'
                                      ? `MULTIANNO (${quote.contractYears || 2} ANNI)`
                                      : DURATION_TYPE_LABELS[
                                          quote.durationType || 'singola'
                                        ].toUpperCase()}
                                  </span>
                                  <span className="text-xs font-semibold text-slate-700">
                                    · ATTIVITÀ SBLOCCATE
                                  </span>
                                </div>

                                <div>
                                  <h4 className="text-sm sm:text-base font-bold text-slate-950">
                                    {quote.projectTitle}
                                  </h4>
                                  {quote.facilityName && (
                                    <div className="text-xs text-slate-600 font-medium flex items-center gap-1 mt-0.5">
                                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                      Stabilimento: <strong>{quote.facilityName}</strong>
                                      {quote.facilityAddress ? ` — ${quote.facilityAddress}` : ''}
                                    </div>
                                  )}
                                </div>

                                <div className="text-xs text-slate-600 font-medium flex flex-wrap items-center gap-1.5">
                                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                                  <span>
                                    Clicca per visualizzare l&apos;Offerta completa, le Attività previste e accedere alla consuntivazione
                                  </span>
                                  {projectActivitiesCount > 0 && (
                                    <span className="font-mono text-slate-900 font-semibold">
                                      · {projectActivitiesCount} esecuzioni storicizzate
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-2.5 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0">
                                <div className="text-left lg:text-right">
                                  <div className="text-[11px] text-slate-500 uppercase font-semibold">
                                    Importo Confermato
                                  </div>
                                  <div className="text-lg font-bold text-slate-950 font-mono tabular-nums">
                                    €{' '}
                                    {quote.totalAmount.toLocaleString('it-IT', {
                                      minimumFractionDigits: 2,
                                    })}
                                  </div>
                                </div>

                                <div
                                  className="flex flex-wrap items-center gap-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {quoteHistoryList.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => setHistoryModalQuoteNumber(quote.quoteNumber)}
                                      className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                    >
                                      <History className="w-3.5 h-3.5" />
                                      <span>Storico ({quoteHistoryList.length})</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setSelectedConfirmedQuote(quote)}
                                    className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                  >
                                    <span>Vedi Offerta &amp; Attività</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* QUEUE 3: STORICO REVISIONI OFFERTE (ORGANIZZATO PER CARD CLIENTE) */}
      {activeQueue === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <History className="w-3.5 h-3.5 text-slate-500" />
              Storico Offerte e Revisioni per Cliente — Clicca sulla Card del Cliente per aprire lo storico (Rev. 00, Rev. 01...)
            </div>
          </div>

          {historyByClient.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <History className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-950">
                Nessuna offerta nello storico
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Tutte le offerte create e le relative revisioni (Rev. 00, Rev. 01, Rev. 02...) verranno archiviate sotto la card del cliente.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {historyByClient.map((clientHist) => {
                const isOpen = expandedClientKey === `history_${clientHist.clientKey}`;
                const totalRevsCount = clientHist.groups.reduce(
                  (acc, g) => acc + g.revisions.length,
                  0
                );

                return (
                  <div
                    key={clientHist.clientKey}
                    className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
                  >
                    {/* CLIENT CARD HEADER */}
                    <button
                      type="button"
                      onClick={() => toggleClientCard(`history_${clientHist.clientKey}`)}
                      className="w-full p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-slate-950 text-white flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base sm:text-lg font-bold text-slate-950">
                              {clientHist.clientName}
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-md bg-slate-950 text-white font-mono text-xs font-bold">
                              {clientHist.groups.length}{' '}
                              {clientHist.groups.length === 1 ? 'Offerta' : 'Offerte'} ·{' '}
                              {totalRevsCount}{' '}
                              {totalRevsCount === 1 ? 'Revisione' : 'Revisioni'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">
                            P.IVA: {clientHist.clientVat}
                          </div>
                        </div>
                      </div>

                      <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-950 text-white text-xs font-semibold shrink-0 self-start sm:self-center">
                        <span>{isOpen ? 'Chiudi Storico' : 'Apri Storico Revisioni'}</span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>

                    {/* EXPANDED CLIENT REVISION HISTORY */}
                    {isOpen && (
                      <div className="border-t border-slate-200 bg-slate-50/70 p-3 sm:p-4 space-y-4">
                        {clientHist.groups.map((group) => {
                          const latestRev = group.revisions[group.revisions.length - 1];
                          return (
                            <div
                              key={group.quoteNumber}
                              className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs"
                            >
                              <div className="px-4 sm:px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-sm font-bold text-slate-950">
                                      Offerta {group.quoteNumber}
                                    </span>
                                    <span className="text-xs text-slate-500 font-mono">
                                      · {group.revisions.length}{' '}
                                      {group.revisions.length === 1
                                        ? 'revisione registrata'
                                        : 'revisioni registrate'}{' '}
                                      (da Rev. 00 a Rev. {formatRevision(latestRev.revision)})
                                    </span>
                                  </div>
                                  <div className="text-xs font-bold text-slate-900">
                                    {latestRev.projectTitle}
                                  </div>
                                </div>

                                {canCreateQuotes && latestRev.status === 'sent' && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRevisionModal(latestRev)}
                                    className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer self-start sm:self-center"
                                  >
                                    <GitBranch className="w-3.5 h-3.5" />
                                    <span>
                                      Nuova Revisione (Rev.{' '}
                                      {formatRevision((latestRev.revision ?? 0) + 1)})
                                    </span>
                                  </button>
                                )}
                              </div>

                              <div className="divide-y divide-slate-200">
                                {group.revisions.map((rev) => (
                                  <div
                                    key={rev.id}
                                    className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60"
                                  >
                                    <div className="space-y-1">
                                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                                        <span className="px-2.5 py-0.5 bg-slate-950 text-white rounded font-bold">
                                          Rev. {formatRevision(rev.revision)}
                                        </span>
                                        <span className="font-bold text-slate-900">
                                          {formatQuoteCodeWithRev(
                                            rev.quoteNumber,
                                            rev.revision ?? 0
                                          )}
                                        </span>
                                        <span className="text-slate-500">
                                          · Data:{' '}
                                          {new Date(rev.createdAt).toLocaleDateString('it-IT')}
                                        </span>
                                        <span className="font-sans font-semibold text-slate-700">
                                          ·{' '}
                                          {rev.status === 'accepted'
                                            ? `CONFERMATA (Ord. ${rev.orderNumber})`
                                            : rev.status === 'superseded'
                                            ? 'STORICIZZATA (Sostituita da revisione successiva)'
                                            : 'IN ATTESA DI ORDINE'}
                                        </span>
                                      </div>
                                      <div className="text-xs text-slate-600">
                                        {MACRO_CATEGORY_LABELS[rev.macroCategory || 'qualifica']} —{' '}
                                        {
                                          PRICING_MODE_LABELS[
                                            rev.pricingMode || 'consuntivo_giornate'
                                          ]
                                        }
                                        {rev.facilityName ? ` · Stab.: ${rev.facilityName}` : ''}
                                      </div>
                                      {rev.projectDescription && (
                                        <div className="text-xs text-slate-500 line-clamp-1">
                                          {rev.projectDescription}
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                      <div className="text-left sm:text-right font-mono">
                                        <div className="text-[10px] text-slate-400 uppercase font-sans font-semibold">
                                          Importo Rev. {formatRevision(rev.revision)}
                                        </div>
                                        <div className="text-sm font-bold text-slate-950 tabular-nums">
                                          €{' '}
                                          {rev.totalAmount.toLocaleString('it-IT', {
                                            minimumFractionDigits: 2,
                                          })}
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => generateQuotePdf(rev)}
                                        className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                      >
                                        <Printer className="w-3.5 h-3.5" />
                                        <span>PDF Rev. {formatRevision(rev.revision)}</span>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: STORICO REVISIONI PER SINGOLA OFFERTA */}
      {historyModalQuoteNumber && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-2xl w-full overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-950 text-white flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-300 block">
                  Storico Revisioni Offerta
                </span>
                <h3 className="text-base font-bold">
                  Tutte le Revisioni di {historyModalQuoteNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalQuoteNumber(null)}
                className="min-h-[36px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-[75vh] overflow-y-auto divide-y divide-slate-200">
              {getRevisionsForQuoteNumber(historyModalQuoteNumber).map((rev) => (
                <div
                  key={rev.id}
                  className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                      <span className="px-2 py-0.5 bg-slate-950 text-white rounded font-bold">
                        Rev. {formatRevision(rev.revision)}
                      </span>
                      <span className="font-bold text-slate-950">
                        {formatQuoteCodeWithRev(rev.quoteNumber, rev.revision ?? 0)}
                      </span>
                      <span className="text-slate-500">
                        · {new Date(rev.createdAt).toLocaleDateString('it-IT')}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-700">
                      Stato:{' '}
                      {rev.status === 'accepted'
                        ? `Confermata con Ordine ${rev.orderNumber}`
                        : rev.status === 'superseded'
                        ? 'Revisione Storicizzata (Sostituita)'
                        : 'In Attesa di Ordine'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {rev.projectTitle} — €{' '}
                      {rev.totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => generateQuotePdf(rev)}
                    className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Stampa PDF Rev. {formatRevision(rev.revision)}</span>
                  </button>
                </div>
              ))}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryModalQuoteNumber(null)}
                className="min-h-[40px] px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Chiudi Storico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP MODAL 1: CLICK ON PENDING QUOTE -> INSERT ORDER NUMBER (CONFERMA O ANNULLA) */}
      {orderModalQuote && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-950 text-white flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-300 block">
                  Conferma Ordine Cliente
                </span>
                <h3 className="text-base font-bold">
                  Offerta{' '}
                  {formatQuoteCodeWithRev(
                    orderModalQuote.quoteNumber,
                    orderModalQuote.revision ?? 0
                  )}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOrderModalQuote(null)}
                className="min-h-[36px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleOrderSubmit} className="p-6 space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Cliente:</span>
                  <span className="font-bold text-slate-950">{orderModalQuote.clientName}</span>
                </div>
                {orderModalQuote.facilityName && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Stabilimento:</span>
                    <span className="font-semibold text-slate-800">
                      {orderModalQuote.facilityName}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Progetto / Commessa:</span>
                  <span className="font-semibold text-slate-800">
                    {orderModalQuote.projectTitle}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Importo Offerta:</span>
                  <span className="font-mono font-bold text-slate-950 text-sm">
                    €{' '}
                    {orderModalQuote.totalAmount.toLocaleString('it-IT', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Inserisci Numero d&apos;Ordine Cliente *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="es. ORD-2026-99412 / PO-450012"
                  className="w-full min-h-[42px] px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Data Ricezione Ordine *
                </label>
                <input
                  type="date"
                  required
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full min-h-[42px] px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                Confermando l&apos;ordine, l&apos;offerta passerà nelle <strong>Confermate</strong> e si sbloccheranno tutte le <strong>Attività</strong> per questo cliente e questa commessa.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setOrderModalQuote(null);
                    setOrderNumber('');
                  }}
                  className="min-h-[42px] px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-lg cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={submittingOrder || !orderNumber.trim()}
                  className="min-h-[42px] px-5 py-2 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-lg cursor-pointer inline-flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{submittingOrder ? 'Conferma in corso...' : 'Conferma Ordine'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL 2: CLICK ON CONFIRMED QUOTE -> VIEW OFFER DETAILS & UNLOCKED ACTIVITIES */}
      {selectedConfirmedQuote && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-3xl w-full overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-950 text-white flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-xs font-bold bg-white/15 px-3 py-1 rounded">
                  OFFERTA:{' '}
                  {formatQuoteCodeWithRev(
                    selectedConfirmedQuote.quoteNumber,
                    selectedConfirmedQuote.revision ?? 0
                  )}
                </span>
                <span className="font-mono text-xs font-bold bg-white text-slate-950 px-3 py-1 rounded">
                  ORDINE: {selectedConfirmedQuote.orderNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedConfirmedQuote(null)}
                className="min-h-[36px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Offer & Client Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">
                    Cliente &amp; Stabilimento
                  </div>
                  <div className="text-base font-bold text-slate-950 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-slate-600" />
                    {selectedConfirmedQuote.clientName}
                  </div>
                  <div className="text-xs text-slate-600 font-mono">
                    P.IVA: {selectedConfirmedQuote.clientVat}
                  </div>
                  {selectedConfirmedQuote.facilityName && (
                    <div className="text-xs text-slate-700 font-medium flex items-center gap-1 pt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {selectedConfirmedQuote.facilityName}
                      {selectedConfirmedQuote.facilityAddress
                        ? ` (${selectedConfirmedQuote.facilityAddress})`
                        : ''}
                    </div>
                  )}
                </div>

                <div className="space-y-1 sm:text-right">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">
                    Commessa &amp; Valore
                  </div>
                  <div className="text-base font-bold text-slate-950">
                    {selectedConfirmedQuote.projectTitle}
                  </div>
                  <div className="text-xs text-slate-600">
                    {MACRO_CATEGORY_LABELS[selectedConfirmedQuote.macroCategory || 'qualifica']} —{' '}
                    {
                      PRICING_MODE_LABELS[
                        selectedConfirmedQuote.pricingMode || 'consuntivo_giornate'
                      ]
                    }
                  </div>
                  <div className="text-lg font-bold font-mono text-slate-950 pt-0.5">
                    €{' '}
                    {selectedConfirmedQuote.totalAmount.toLocaleString('it-IT', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                </div>
              </div>

              {/* Project Description */}
              <div>
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Descrizione Capitolato / Oggetto Offerta
                </h4>
                <p className="text-sm text-slate-800 bg-white border border-slate-200 rounded-lg p-3.5 whitespace-pre-wrap">
                  {selectedConfirmedQuote.projectDescription || '-'}
                </p>
              </div>

              {selectedConfirmedQuote.systemInfo && (
                <div>
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Informazioni sul Sistema
                  </h4>
                  <p className="text-sm text-slate-800 bg-white border border-slate-200 rounded-lg p-3.5 whitespace-pre-wrap">
                    {selectedConfirmedQuote.systemInfo}
                  </p>
                </div>
              )}

              {selectedConfirmedQuote.extraCosts && (
                <div>
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Costi Extra
                  </h4>
                  <p className="text-sm text-slate-800 bg-white border border-slate-200 rounded-lg p-3.5 whitespace-pre-wrap">
                    {selectedConfirmedQuote.extraCosts}
                  </p>
                </div>
              )}

              {/* Unlocked Activities List */}
              {(() => {
                const linkedProj = getConfirmedQuoteProject(selectedConfirmedQuote);
                const items =
                  linkedProj?.lineItems && linkedProj.lineItems.length > 0
                    ? linkedProj.lineItems
                    : selectedConfirmedQuote.lineItems || [];
                const projLogs = linkedProj
                  ? activities.filter((a) => a.projectId === linkedProj.id)
                  : [];

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <ClipboardCheck className="w-4 h-4 text-slate-700" />
                        Attività Sbloccate per questa Commessa
                      </h4>
                      <span className="text-xs font-mono text-slate-600">
                        {projLogs.length} esecuzioni storicizzate
                      </span>
                    </div>

                    {items.length > 0 ? (
                      <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-200">
                        {items.map((li, idx) => {
                          const itemLogs = projLogs.filter(
                            (l) =>
                              l.lineItemId === li.id ||
                              l.lineItemTitle?.startsWith(li.itemType)
                          );
                          const itemHours = itemLogs.reduce((s, l) => s + l.durationHours, 0);

                          return (
                            <div
                              key={li.id || idx}
                              className="p-3.5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-slate-500">
                                    #{idx + 1}
                                  </span>
                                  <span className="font-bold text-slate-950 text-sm">
                                    {li.itemType}
                                  </span>
                                  {li.quantity > 1 && (
                                    <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 font-mono">
                                      Q.tà {li.quantity}
                                    </span>
                                  )}
                                </div>
                                {li.activityOrSpec && (
                                  <div className="text-slate-600 pl-6">{li.activityOrSpec}</div>
                                )}
                                {li.plannedTests && li.plannedTests.length > 0 && (
                                  <div className="pl-6 pt-1 space-y-0.5">
                                    <div className="text-[11px] font-bold text-slate-700 uppercase">
                                      Test / Test Previsti:
                                    </div>
                                    <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5">
                                      {li.plannedTests.map((t, tIdx) => (
                                        <li key={tIdx}>{t}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-3 sm:text-right pl-6 sm:pl-0">
                                {li.totalPrice > 0 && (
                                  <span className="font-mono font-semibold text-slate-800">
                                    €{' '}
                                    {li.totalPrice.toLocaleString('it-IT', {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                )}
                                <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-800 font-mono font-semibold">
                                  {itemHours > 0 ? `${itemHours}h eseguite` : 'Attiva'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 space-y-2">
                        <div className="font-bold uppercase tracking-wider text-slate-900">
                          Attività a Consuntivo — Daily Rate:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
                          <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                            <span className="text-slate-500 block text-[10px] uppercase">Engineer</span>
                            <strong className="text-slate-950 text-sm">
                              €{' '}
                              {(
                                selectedConfirmedQuote.dailyRates?.engineer ??
                                selectedConfirmedQuote.dailyRate ??
                                0
                              ).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                            </strong>
                          </div>
                          <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                            <span className="text-slate-500 block text-[10px] uppercase">Specialist</span>
                            <strong className="text-slate-950 text-sm">
                              €{' '}
                              {(selectedConfirmedQuote.dailyRates?.specialist ?? 0).toLocaleString(
                                'it-IT',
                                { minimumFractionDigits: 2 }
                              )}
                            </strong>
                          </div>
                          <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                            <span className="text-slate-500 block text-[10px] uppercase">Consultant</span>
                            <strong className="text-slate-950 text-sm">
                              €{' '}
                              {(selectedConfirmedQuote.dailyRates?.consultant ?? 0).toLocaleString(
                                'it-IT',
                                { minimumFractionDigits: 2 }
                              )}
                            </strong>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => generateQuotePdf(selectedConfirmedQuote)}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Stampa Offerta PDF</span>
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedConfirmedQuote(null)}
                  className="min-h-[40px] px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Chiudi
                </button>
                {onOpenProjectActivities && (
                  <button
                    type="button"
                    onClick={() => {
                      const proj = getConfirmedQuoteProject(selectedConfirmedQuote);
                      setSelectedConfirmedQuote(null);
                      if (proj) {
                        onOpenProjectActivities(proj.id);
                      }
                    }}
                    className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    <span>Vai alla Pagina Attività per questa Commessa</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE NEW QUOTE (REV. 00) OR REVISION (REV. 01, 02...) */}
      {showNewQuoteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-4xl w-full overflow-hidden my-6">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-950 text-white">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase tracking-wider bg-white text-slate-950 px-2.5 py-0.5 rounded font-bold">
                    {baseQuoteForRevision
                      ? formatQuoteCodeWithRev(
                          baseQuoteForRevision.quoteNumber,
                          computeNextRevisionPreview(baseQuoteForRevision.quoteNumber)
                        )
                      : formatQuoteCodeWithRev(computeNextQuoteNumberPreview(), 0)}
                  </span>
                  <span className="text-xs text-slate-300 font-medium">
                    (Revisione {baseQuoteForRevision ? formatRevision(computeNextRevisionPreview(baseQuoteForRevision.quoteNumber)) : '00'} · In Attesa di Ordine)
                  </span>
                </div>
                <h3 className="text-base font-bold mt-1">
                  {baseQuoteForRevision
                    ? `Revisione Quotazione ${baseQuoteForRevision.quoteNumber} (Rev. ${formatRevision(
                        computeNextRevisionPreview(baseQuoteForRevision.quoteNumber)
                      )})`
                    : 'Nuova Quotazione (Rev. 00)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewQuoteModal(false)}
                className="min-h-[36px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleCreateSubmit}
              className="p-5 sm:p-6 space-y-6 max-h-[82vh] overflow-y-auto"
            >
              {errorMsg && (
                <div className="p-3.5 bg-slate-100 border border-slate-300 text-slate-950 text-xs font-semibold rounded-lg">
                  {errorMsg}
                </div>
              )}

              {/* 1. NUMERO UNIVOCO ASSEGNATO DIRETTAMENTE DALL'APP */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  1. Numero Univoco Quotazione (Assegnato dall&apos;App)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200 items-center">
                  <div className="sm:col-span-2">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase">
                      Codice Univoco Quotazione
                    </div>
                    <input
                      type="text"
                      readOnly
                      value={
                        baseQuoteForRevision
                          ? baseQuoteForRevision.quoteNumber
                          : computeNextQuoteNumberPreview()
                      }
                      className="mt-1 w-full min-h-[40px] px-3.5 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-950 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 uppercase">
                      Revisione Iniziale
                    </div>
                    <div className="mt-1 min-h-[40px] px-3.5 py-2 bg-slate-950 text-white rounded-lg text-sm font-mono font-bold flex items-center justify-between">
                      <span>
                        Rev.{' '}
                        {baseQuoteForRevision
                          ? formatRevision(
                              computeNextRevisionPreview(baseQuoteForRevision.quoteNumber)
                            )
                          : '00'}
                      </span>
                      <span className="text-[11px] font-sans font-normal text-slate-300">
                        Automatica
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. SELEZIONE CLIENTE DAL MENU A TENDINA (CLIENTI INSERITI IN CLIENTI) */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  2. Seleziona Cliente *
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Cliente (dall&apos;elenco Clienti) *
                    </label>
                    <select
                      required
                      value={selectedClientId}
                      onChange={(e) => handleSelectClient(e.target.value)}
                      className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
                    >
                      <option value="">
                        {clients.length > 0
                          ? '-- Seleziona un cliente dal menu a tendina --'
                          : '-- Nessun cliente registrato in Clienti --'}
                      </option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.companyName} (P.IVA {c.vatNumber})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Stabilimento / Sede del Cliente (Opzionale)
                    </label>
                    <select
                      value={selectedFacilityId}
                      onChange={(e) => handleSelectFacility(e.target.value)}
                      disabled={
                        !selectedClientObj || (selectedClientObj.facilities || []).length === 0
                      }
                      className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-950 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-950"
                    >
                      <option value="">
                        {!selectedClientObj
                          ? '-- Prima seleziona il cliente --'
                          : (selectedClientObj.facilities || []).length === 0
                          ? '-- Nessuno stabilimento registrato --'
                          : '-- Seleziona stabilimento --'}
                      </option>
                      {(selectedClientObj?.facilities || []).map((fac) => (
                        <option key={fac.id} value={fac.id}>
                          {fac.name}
                          {fac.address ? ` — ${fac.address}` : ''}
                          {fac.city ? ` (${fac.city})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedClientObj && (
                  <div className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
                    <div>
                      <span className="font-bold text-slate-950">{clientName}</span> · P.IVA:{' '}
                      <span className="font-mono">{clientVat}</span>
                    </div>
                    <div>
                      Stabilimento: <strong>{facilityName || 'Sede Principale'}</strong>
                      {facilityAddress ? ` — ${facilityAddress}` : ''}
                      {clientCity ? ` (${clientCity})` : ''}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. MACRO CATEGORIA: TARATURA, QUALIFICA O COMPLIANCE */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  3. Seleziona la Macro-Categoria (Taratura, Qualifica o Compliance) *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(['taratura', 'qualifica', 'compliance'] as QuoteMacroCategory[]).map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => handleSelectMacroCategory(cat)}
                      className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        macroCategory === cat
                          ? 'bg-slate-950 text-white border-slate-950'
                          : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-sm">{MACRO_CATEGORY_LABELS[cat]}</div>
                      <div
                        className={`text-[11px] mt-0.5 ${
                          macroCategory === cat ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {cat === 'taratura' && 'A strumento (fino a 20 righe) o a consuntivo'}
                        {cat === 'qualifica' && 'A consuntivo (giornate) o a progetto/equipment'}
                        {cat === 'compliance' && 'A consuntivo (giornate) o a progetto/attività'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. DURATA / PERIODICITÀ: SINGOLA VOLTA, ANNUALE O MULTIANNO */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  4. Durata della Quotazione (Singola volta, Annuale o Multianno) *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(['singola', 'annuale', 'multianno'] as QuoteDurationType[]).map((dur) => (
                    <button
                      type="button"
                      key={dur}
                      onClick={() => setDurationType(dur)}
                      className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        durationType === dur
                          ? 'bg-slate-950 text-white border-slate-950'
                          : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-sm">{DURATION_TYPE_LABELS[dur]}</div>
                      <div
                        className={`text-[11px] mt-0.5 ${
                          durationType === dur ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {dur === 'singola' && 'Esecuzione singola una tantum'}
                        {dur === 'annuale' && 'Validità annuale (1 annualità)'}
                        {dur === 'multianno' && 'Più annualità (inserisci il numero di anni)'}
                      </div>
                    </button>
                  ))}
                </div>

                {durationType === 'multianno' && (
                  <div className="p-3.5 bg-slate-50 border border-slate-300 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Numero di Anni (Multianno) *
                      </label>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Inserisci il numero di anni / storicizzazioni previste (es. 2, 3, 4...). Ad ogni &quot;Salva e Storicizza&quot; verrà mantenuta la tabella per l&apos;anno successivo con la colonna <strong>Scadenza</strong> fino al completamento di tutti gli anni.
                      </p>
                    </div>
                    <div className="w-full sm:w-36 shrink-0">
                      <input
                        type="number"
                        min={2}
                        max={20}
                        step={1}
                        required
                        value={contractYears}
                        onChange={(e) =>
                          setContractYears(Math.max(2, parseInt(e.target.value, 10) || 2))
                        }
                        placeholder="es. 2, 3, 4"
                        className="w-full min-h-[42px] px-3.5 py-2 bg-white border border-slate-400 rounded-lg text-base font-mono font-bold text-slate-950 text-center focus:outline-none focus:ring-2 focus:ring-slate-950"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 5. TIPOLOGIA DI QUOTAZIONE CON LE ATTIVITÀ */}
              <div className="space-y-4 pt-2 border-t border-slate-200">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    5. Tipologia di Quotazione e Attività *
                  </label>
                  {macroCategory === 'qualifica' || macroCategory === 'compliance' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPricingMode('consuntivo_giornate')}
                        className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                          pricingMode === 'consuntivo_giornate'
                            ? 'bg-slate-950 text-white border-slate-950'
                            : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-bold text-sm">A Consuntivo (Giornate)</div>
                        <div
                          className={`text-xs mt-0.5 ${
                            pricingMode === 'consuntivo_giornate'
                              ? 'text-slate-300'
                              : 'text-slate-500'
                          }`}
                        >
                          Il cliente paga le giornate effettivamente lavorate.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPricingMode('progetto_equipment')}
                        className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                          pricingMode === 'progetto_equipment'
                            ? 'bg-slate-950 text-white border-slate-950'
                            : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-bold text-sm">
                          A Progetto / Ad Attività (Forfait Equipment)
                        </div>
                        <div
                          className={`text-xs mt-0.5 ${
                            pricingMode === 'progetto_equipment'
                              ? 'text-slate-300'
                              : 'text-slate-500'
                          }`}
                        >
                          Forfait sulla lista di Equipment del cliente (fino a 20 righe valorizzate).
                        </div>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPricingMode('a_strumento')}
                        className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                          pricingMode === 'a_strumento'
                            ? 'bg-slate-950 text-white border-slate-950'
                            : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-bold text-sm">A Strumento (Quotazione a Strumento)</div>
                        <div
                          className={`text-xs mt-0.5 ${
                            pricingMode === 'a_strumento' ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          Selezione tipologia strumento dal menu a tendina con quantità e prezzo unitario.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPricingMode('consuntivo_giornate')}
                        className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                          pricingMode === 'consuntivo_giornate'
                            ? 'bg-slate-950 text-white border-slate-950'
                            : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-bold text-sm">A Consuntivo (Daily Rate)</div>
                        <div
                          className={`text-xs mt-0.5 ${
                            pricingMode === 'consuntivo_giornate'
                              ? 'text-slate-300'
                              : 'text-slate-500'
                          }`}
                        >
                          Il cliente paga le giornate di taratura effettuate (Engineer, Specialist, Consultant).
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Titolo Progetto / Commessa (Opzionale)
                  </label>
                  <input
                    type="text"
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    placeholder="es. Attività di Taratura / Qualifica Linee Produttive (non obbligatorio)"
                    className="w-full min-h-[40px] px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
                  />
                </div>

                {/* TABELLA RIGHE ATTIVITÀ: SEMPRE PRESENTE PER QUALIFICA (A PRESCINDERE DALLA TIPOLOGIA) O PER FORFAIT / A STRUMENTO */}
                {(macroCategory === 'qualifica' || pricingMode !== 'consuntivo_giornate') && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          {macroCategory === 'qualifica'
                            ? 'Righe Attività di Qualifica & Colonna Test / Test Previsti *'
                            : 'Elenco Attività / Strumenti in Quotazione *'}
                        </span>
                        {macroCategory === 'qualifica' && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Seleziona l&apos;attività (es. Scrittura Protocollo, IQ, OQ, IOQ, PQ) e, se vuoi, aggiungi nella colonna <strong>Test / Test Previsti</strong> le sottovoci dei test previsti scritte a mano (non obbligatorio).
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-mono text-slate-500 shrink-0">
                        Righe inserite: <strong>{lineItems.length}</strong> / {MAX_LINE_ITEMS}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {lineItems.map((item, idx) => {
                        const rowTests =
                          Array.isArray(item.plannedTests) && item.plannedTests.length > 0
                            ? item.plannedTests
                            : [''];

                        return (
                          <div
                            key={item.id}
                            className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-3"
                          >
                            {macroCategory === 'qualifica' ? (
                              /* LAYOUT RIGA QUALIFICA (CON COLONNA TEST / TEST PREVISTI E SOTTOVOCI AGGIUNGIBILI) */
                              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                                {/* Colonna 1: Attività / Protocollo (Scrittura Protocollo, IQ, OQ, IOQ, PQ...) */}
                                <div className="lg:col-span-3 space-y-1.5">
                                  <label className="block text-[11px] font-bold text-slate-800">
                                    {idx + 1}. Attività / Fase Qualifica *
                                  </label>
                                  <select
                                    value={
                                      QUALIFICATION_QUOTE_ACTIVITIES.includes(item.activityOrSpec)
                                        ? item.activityOrSpec
                                        : 'custom'
                                    }
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val !== 'custom') {
                                        handleUpdateLineItem(item.id, 'activityOrSpec', val);
                                      }
                                    }}
                                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
                                  >
                                    {QUALIFICATION_QUOTE_ACTIVITIES.map((act) => (
                                      <option key={act} value={act}>
                                        {act}
                                      </option>
                                    ))}
                                    <option value="custom">-- Altro (scrivi sotto) --</option>
                                  </select>
                                  <input
                                    type="text"
                                    value={item.activityOrSpec}
                                    onChange={(e) =>
                                      handleUpdateLineItem(
                                        item.id,
                                        'activityOrSpec',
                                        e.target.value
                                      )
                                    }
                                    placeholder="es. Scrittura Protocollo / IQ / OQ / PQ"
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
                                  />
                                </div>

                                {/* Colonna 2: Equipment / Macchina (Non obbligatorio) */}
                                <div className="lg:col-span-3 space-y-1.5">
                                  <label className="block text-[11px] font-semibold text-slate-700">
                                    Equipment / Macchina (Opzionale)
                                  </label>
                                  <input
                                    type="text"
                                    value={item.itemType}
                                    onChange={(e) =>
                                      handleUpdateLineItem(item.id, 'itemType', e.target.value)
                                    }
                                    placeholder="es. Autoclave / Isolatore / Linea (opzionale)"
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
                                  />
                                </div>

                                {/* Colonna 3: TEST / TEST PREVISTI (Sottovoci aggiungibili a mano, NON obbligatoria) */}
                                <div
                                  className={
                                    pricingMode === 'progetto_equipment'
                                      ? 'lg:col-span-3 space-y-1.5'
                                      : 'lg:col-span-5 space-y-1.5'
                                  }
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <label className="block text-[11px] font-bold text-slate-800">
                                      Test / Test Previsti (Opzionale)
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => handleAddPlannedTest(item.id)}
                                      className="px-2 py-0.5 bg-slate-950 hover:bg-slate-800 text-white rounded text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>+ Sottovoce Test</span>
                                    </button>
                                  </div>

                                  <div className="space-y-1.5">
                                    {rowTests.map((testVal, tIdx) => (
                                      <div key={tIdx} className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-mono text-slate-500 w-4 shrink-0">
                                          {tIdx + 1}.
                                        </span>
                                        <input
                                          type="text"
                                          value={testVal}
                                          onChange={(e) =>
                                            handleUpdatePlannedTest(item.id, tIdx, e.target.value)
                                          }
                                          placeholder="Scrivi a mano il test previsto (non obbligatorio)..."
                                          className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
                                        />
                                        {(rowTests.length > 1 || testVal.trim() !== '') && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemovePlannedTest(item.id, tIdx)}
                                            className="p-1 bg-slate-950 hover:bg-slate-800 text-white rounded cursor-pointer shrink-0"
                                            title="Rimuovi sottovoce test"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Colonna 4: Prezzi (se A Progetto / Forfait) + Pulsante Elimina Riga */}
                                {pricingMode === 'progetto_equipment' ? (
                                  <div className="grid grid-cols-3 lg:col-span-3 gap-2 items-end">
                                    <div>
                                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                        Q.tà
                                      </label>
                                      <input
                                        type="number"
                                        min={1}
                                        max={999}
                                        value={item.quantity}
                                        onChange={(e) =>
                                          handleUpdateLineItem(
                                            item.id,
                                            'quantity',
                                            Number(e.target.value)
                                          )
                                        }
                                        className="w-full px-2 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-950"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                        Prezzo (€)
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        step={5}
                                        value={item.unitPrice}
                                        onChange={(e) =>
                                          handleUpdateLineItem(
                                            item.id,
                                            'unitPrice',
                                            Number(e.target.value)
                                          )
                                        }
                                        className="w-full px-2 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-950"
                                      />
                                    </div>

                                    <div className="flex items-center justify-between gap-1">
                                      <div>
                                        <div className="text-[10px] text-slate-500 uppercase font-semibold">
                                          Totale
                                        </div>
                                        <div className="text-xs font-mono font-bold text-slate-950 py-1.5">
                                          € {item.totalPrice.toLocaleString('it-IT')}
                                        </div>
                                      </div>
                                      {lineItems.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveLineItem(item.id)}
                                          className="p-2 bg-slate-950 hover:bg-slate-800 text-white rounded-lg cursor-pointer"
                                          title="Rimuovi riga"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="lg:col-span-1 flex justify-end pt-5">
                                    {lineItems.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveLineItem(item.id)}
                                        className="p-2 bg-slate-950 hover:bg-slate-800 text-white rounded-lg cursor-pointer"
                                        title="Rimuovi riga"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* LAYOUT STANDARD TARATURA / COMPLIANCE */
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                                <div className="sm:col-span-4">
                                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                    {idx + 1}.{' '}
                                    {macroCategory === 'taratura'
                                      ? 'Tipologia Strumento *'
                                      : 'Attività / Documento Compliance *'}
                                  </label>
                                  {macroCategory === 'taratura' ? (
                                    <select
                                      value={
                                        CALIBRATION_INSTRUMENT_TYPES.includes(item.itemType as any)
                                          ? item.itemType
                                          : CALIBRATION_INSTRUMENT_TYPES[0]
                                      }
                                      onChange={(e) =>
                                        handleUpdateLineItem(item.id, 'itemType', e.target.value)
                                      }
                                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
                                    >
                                      {CALIBRATION_INSTRUMENT_TYPES.map((instType) => (
                                        <option key={instType} value={instType}>
                                          {instType}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      value={item.itemType}
                                      onChange={(e) =>
                                        handleUpdateLineItem(item.id, 'itemType', e.target.value)
                                      }
                                      placeholder="es. Gap Analysis GMP / CSV / Procedura SOP"
                                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
                                    />
                                  )}
                                </div>

                                <div className="sm:col-span-4">
                                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                    {pricingMode === 'a_strumento' ||
                                    pricingMode === 'consuntivo_strumento'
                                      ? 'Campo di Misura / Punti / Note (Opzionale)'
                                      : 'Dettaglio Attività (Opzionale)'}
                                  </label>
                                  <input
                                    type="text"
                                    value={item.activityOrSpec}
                                    onChange={(e) =>
                                      handleUpdateLineItem(
                                        item.id,
                                        'activityOrSpec',
                                        e.target.value
                                      )
                                    }
                                    placeholder={
                                      pricingMode === 'a_strumento' ||
                                      pricingMode === 'consuntivo_strumento'
                                        ? 'es. 3 punti (-20°C, 0°C, +50°C)'
                                        : 'es. Redazione e revisione documentale'
                                    }
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
                                  />
                                </div>

                                {pricingMode === 'consuntivo_strumento' ? (
                                  /* CONSUNTIVO A STRUMENTO: SENZA NUMERO DI STRUMENTI (Q.TÀ), SOLO QUOTAZIONE UNITARIA */
                                  <div className="sm:col-span-4 flex items-end gap-2">
                                    <div className="flex-1">
                                      <label className="block text-[11px] font-bold text-slate-900 mb-1">
                                        Quotazione Unitaria (€ / Strumento) *
                                      </label>
                                      <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-500">
                                          €
                                        </span>
                                        <input
                                          type="number"
                                          min={0}
                                          step={5}
                                          value={item.unitPrice}
                                          onChange={(e) =>
                                            handleUpdateLineItem(
                                              item.id,
                                              'unitPrice',
                                              Number(e.target.value)
                                            )
                                          }
                                          placeholder="es. 85"
                                          className="w-full pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
                                        />
                                      </div>
                                    </div>
                                    {lineItems.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveLineItem(item.id)}
                                        className="p-2 bg-slate-950 hover:bg-slate-800 text-white rounded-lg transition-colors cursor-pointer shrink-0"
                                        title="Rimuovi riga"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-3 sm:col-span-4 gap-2 items-end">
                                    <div>
                                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                        Q.tà
                                      </label>
                                      <input
                                        type="number"
                                        min={1}
                                        max={999}
                                        value={item.quantity}
                                        onChange={(e) =>
                                          handleUpdateLineItem(
                                            item.id,
                                            'quantity',
                                            Number(e.target.value)
                                          )
                                        }
                                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                        Prezzo Unit. (€)
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        step={5}
                                        value={item.unitPrice}
                                        onChange={(e) =>
                                          handleUpdateLineItem(
                                            item.id,
                                            'unitPrice',
                                            Number(e.target.value)
                                          )
                                        }
                                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
                                      />
                                    </div>

                                    <div className="flex items-center justify-between gap-1">
                                      <div>
                                        <div className="text-[10px] text-slate-500 uppercase font-semibold">
                                          Totale
                                        </div>
                                        <div className="text-xs font-mono font-bold text-slate-950 py-1.5">
                                          € {item.totalPrice.toLocaleString('it-IT')}
                                        </div>
                                      </div>
                                      {lineItems.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveLineItem(item.id)}
                                          className="p-2 bg-slate-950 hover:bg-slate-800 text-white rounded-lg transition-colors cursor-pointer"
                                          title="Rimuovi riga"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {lineItems.length < MAX_LINE_ITEMS ? (
                        <button
                          type="button"
                          onClick={handleAddLineItem}
                          className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>
                            {macroCategory === 'qualifica'
                              ? `+ Aggiungi Riga Qualifica (${lineItems.length}/${MAX_LINE_ITEMS})`
                              : pricingMode === 'a_strumento' ||
                                pricingMode === 'consuntivo_strumento'
                              ? `+ Aggiungi Strumento (${lineItems.length}/${MAX_LINE_ITEMS})`
                              : `+ Aggiungi Attività (${lineItems.length}/${MAX_LINE_ITEMS})`}
                          </span>
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-slate-700">
                          Raggiunto il limite massimo di {MAX_LINE_ITEMS} righe per offerta.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* PER LA TIPOLOGIA A CONSUNTIVO (PER TUTTE E TRE LE MACRO CATEGORIE): DAILY RATE CON 3 VOCI (ENGINEER, SPECIALIST, CONSULTANT) */}
                {pricingMode === 'consuntivo_giornate' && (
                  <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 space-y-3">
                    <div>
                      <span className="block text-xs font-bold text-slate-950 uppercase tracking-wider">
                        Daily Rate (Valorizzazione a Consuntivo — {MACRO_CATEGORY_LABELS[macroCategory]})
                      </span>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Inserisci il valore economico (€ / giornata) per ciascuna figura professionale:
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Voce 1: Engineer */}
                      <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
                        <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                          1. Engineer (€)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-500">
                            €
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={5}
                            value={dailyRateEngineer}
                            onChange={(e) => setDailyRateEngineer(e.target.value)}
                            placeholder="es. 600"
                            className="w-full min-h-[40px] pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
                          />
                        </div>
                      </div>

                      {/* Voce 2: Specialist */}
                      <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
                        <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                          2. Specialist (€)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-500">
                            €
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={5}
                            value={dailyRateSpecialist}
                            onChange={(e) => setDailyRateSpecialist(e.target.value)}
                            placeholder="es. 750"
                            className="w-full min-h-[40px] pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
                          />
                        </div>
                      </div>

                      {/* Voce 3: Consultant */}
                      <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
                        <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                          3. Consultant (€)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-500">
                            €
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={5}
                            value={dailyRateConsultant}
                            onChange={(e) => setDailyRateConsultant(e.target.value)}
                            placeholder="es. 900"
                            className="w-full min-h-[40px] pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Descrizione Attività *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="Sintesi dello scopo della quotazione e delle attività incluse (obbligatorio)..."
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
                  />
                </div>

                {/* CAMPO VUOTO DA COMPILARE A MANO TIPO WORD: INFORMAZIONI SUL SISTEMA (NON OBBLIGATORIO) */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Informazioni sul Sistema (Compilabile a mano tipo Word — Non obbligatorio)
                    </label>
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleInsertSystemInfoSnippet('• ')}
                        className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-white rounded text-[11px] font-semibold cursor-pointer"
                      >
                        • Elenco Puntato
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertSystemInfoSnippet('1. ')}
                        className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-white rounded text-[11px] font-semibold cursor-pointer"
                      >
                        1. Elenco Numerato
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleInsertSystemInfoSnippet('CARATTERISTICHE SISTEMA / IMPIANTO:\n- ')
                        }
                        className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-white rounded text-[11px] font-semibold cursor-pointer"
                      >
                        + Intestazione Sezione
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    value={systemInfo}
                    onChange={(e) => setSystemInfo(e.target.value)}
                    placeholder="Scrivi liberamente a mano le informazioni sul sistema, caratteristiche dell'impianto, configurazione tecnica, condizioni operative..."
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-950 leading-relaxed focus:outline-none focus:ring-2 focus:ring-slate-950"
                  />
                </div>

                {/* VOCE COSTI EXTRA COMPILABILE A MANO COME LA DESCRIZIONE (NON OBBLIGATORIO) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Costi Extra (Compilabile a mano — Non obbligatorio)
                  </label>
                  <textarea
                    rows={2}
                    value={extraCosts}
                    onChange={(e) => setExtraCosts(e.target.value)}
                    placeholder="Inserisci a mano eventuali costi extra, spese di trasferta, diarie o note economiche aggiuntive..."
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-950 text-white rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-300 font-medium block">
                    Totale Complessivo Quotazione (IVA Esclusa)
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {MACRO_CATEGORY_LABELS[macroCategory]} — {PRICING_MODE_LABELS[pricingMode]}
                  </span>
                </div>
                <span className="text-xl font-bold font-mono tabular-nums">
                  € {computedTotalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewQuoteModal(false)}
                  className="min-h-[42px] px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-lg cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[42px] px-6 py-2 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-lg cursor-pointer"
                >
                  {submitting ? 'Salvataggio...' : 'Salva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
