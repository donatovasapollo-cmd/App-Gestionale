import React, { useState } from 'react';
import {
  Building2,
  MapPin,
  Search,
  Plus,
  Trash2,
  Edit3,
  X,
  Phone,
  Mail,
  User,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  type ActivityLog,
  type Client,
  type ClientFacility,
  type Project,
} from '../types';

interface ClientsProjectsViewProps {
  clients: Client[];
  projects?: Project[];
  activities?: ActivityLog[];
  currentUserName?: string;
  canManageProjects?: boolean;
  canLogActivities?: boolean;
  onCreateClient: (data: {
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
  }) => Promise<void>;
  onUpdateClient: (
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
  ) => Promise<void>;
  onSelectProjectForTimesheet?: (projectId: string) => void;
  onCompleteProject?: (projectId: string) => Promise<void>;
}

export const ClientsProjectsView: React.FC<ClientsProjectsViewProps> = ({
  clients,
  onCreateClient,
  onUpdateClient,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClientIds, setExpandedClientIds] = useState<string[]>([]);

  // Modal state for creating or editing a client with all its information and facilities
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [sdiCode, setSdiCode] = useState('0000000');
  const [pecEmail, setPecEmail] = useState('');
  const [sector, setSector] = useState('Farmaceutico / GMP');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [facilities, setFacilities] = useState<ClientFacility[]>([
    { id: 'fac_1', name: 'Stabilimento Principale', address: '', city: '' },
  ]);

  const [submittingClient, setSubmittingClient] = useState(false);
  const [clientModalError, setClientModalError] = useState<string | null>(null);

  const toggleClientCard = (clientId: string) => {
    setExpandedClientIds((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId]
    );
  };

  const openNewClientModal = () => {
    setEditingClient(null);
    setCompanyName('');
    setVatNumber('');
    setTaxCode('');
    setSdiCode('0000000');
    setPecEmail('');
    setSector('Farmaceutico / GMP');
    setContactName('');
    setEmail('');
    setPhone('');
    setCity('');
    setAddress('');
    setNotes('');
    setFacilities([
      {
        id: `fac_${Date.now()}_1`,
        name: 'Stabilimento Principale',
        address: '',
        city: '',
      },
    ]);
    setClientModalError(null);
    setShowClientModal(true);
  };

  const openEditClientModal = (client: Client) => {
    setEditingClient(client);
    setCompanyName(client.companyName);
    setVatNumber(client.vatNumber);
    setTaxCode(client.taxCode || '');
    setSdiCode(client.sdiCode || '0000000');
    setPecEmail(client.pecEmail || '');
    setSector(client.sector || 'Farmaceutico / Industriale');
    setContactName(client.contactName || '');
    setEmail(client.email || '');
    setPhone(client.phone || '');
    setCity(client.city && client.city !== '-' ? client.city : '');
    setAddress(client.address || '');
    setNotes(client.notes || '');
    setFacilities(
      client.facilities && client.facilities.length > 0
        ? client.facilities.map((f) => ({ ...f }))
        : [
            {
              id: `fac_${Date.now()}_1`,
              name: 'Stabilimento Principale',
              address: client.address || '',
              city: client.city || '',
            },
          ]
    );
    setClientModalError(null);
    setShowClientModal(true);
  };

  const handleAddFacilityRow = () => {
    setFacilities((prev) => [
      ...prev,
      {
        id: `fac_${Date.now()}_${prev.length + 1}`,
        name: `Stabilimento ${prev.length + 1}`,
        address: '',
        city: '',
      },
    ]);
  };

  const handleUpdateFacilityRow = (
    id: string,
    field: keyof ClientFacility,
    value: string
  ) => {
    setFacilities((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  };

  const handleRemoveFacilityRow = (id: string) => {
    setFacilities((prev) =>
      prev.length > 1 ? prev.filter((f) => f.id !== id) : prev
    );
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientModalError(null);

    if (!companyName.trim() || !vatNumber.trim()) {
      setClientModalError('Inserisci Ragione Sociale e Partita IVA del cliente.');
      return;
    }

    const validFacilities = facilities.filter(
      (f) => f.name.trim() !== '' || f.address.trim() !== '' || f.city.trim() !== ''
    );
    if (validFacilities.length === 0) {
      validFacilities.push({
        id: `fac_${Date.now()}_1`,
        name: 'Sede Principale',
        address: address.trim(),
        city: city.trim(),
      });
    }

    const payload = {
      companyName: companyName.trim(),
      vatNumber: vatNumber.trim().toUpperCase(),
      taxCode: taxCode.trim().toUpperCase(),
      sdiCode: sdiCode.trim().toUpperCase() || '0000000',
      pecEmail: pecEmail.trim(),
      contactName: contactName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      city: city.trim() || validFacilities[0]?.city?.trim() || '-',
      address: address.trim() || validFacilities[0]?.address?.trim() || '',
      sector: sector.trim() || 'Farmaceutico / Industriale',
      notes: notes.trim(),
      facilities: validFacilities,
    };

    setSubmittingClient(true);
    try {
      if (editingClient) {
        await onUpdateClient(editingClient.id, payload);
      } else {
        await onCreateClient(payload);
      }
      setShowClientModal(false);
    } catch (err: any) {
      setClientModalError(err?.message || 'Errore salvataggio cliente.');
    } finally {
      setSubmittingClient(false);
    }
  };

  const filteredClients = clients.filter((c) => {
    const q = searchQuery.toLowerCase();
    const facMatch = (c.facilities || []).some(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.address.toLowerCase().includes(q) ||
        f.city.toLowerCase().includes(q)
    );
    return (
      c.companyName.toLowerCase().includes(q) ||
      c.vatNumber.toLowerCase().includes(q) ||
      (c.taxCode || '').toLowerCase().includes(q) ||
      (c.contactName || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q) ||
      c.sector.toLowerCase().includes(q) ||
      facMatch
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Anagrafica Clienti
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Inserisci e gestisci i clienti con tutte le loro informazioni societarie, fiscali, di contatto e gli stabilimenti operativi.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewClientModal}
          className="min-h-[44px] px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Nuovo Cliente</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xl">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca cliente per ragione sociale, P.IVA, referente, città o stabilimento..."
            className="w-full min-h-[42px] pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <div className="text-xs font-mono text-slate-600 font-semibold">
          Clienti in anagrafica: <strong className="text-slate-950">{filteredClients.length}</strong>
        </div>
      </div>

      {/* Client Cards Directory */}
      {filteredClients.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center">
          <p className="text-sm font-semibold text-slate-700">
            Nessun cliente trovato in anagrafica.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Clicca su &quot;+ Nuovo Cliente&quot; in alto a destra per inserire un nuovo cliente con tutte le sue informazioni.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClients.map((client) => {
            const clientFacilities =
              client.facilities && client.facilities.length > 0
                ? client.facilities
                : [
                    {
                      id: 'default',
                      name: 'Sede Principale',
                      address: client.address || '',
                      city: client.city,
                    },
                  ];
            const isExpanded = expandedClientIds.includes(client.id);

            return (
              <div
                key={client.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs transition-all"
              >
                {/* Clickable Client Card Header */}
                <button
                  type="button"
                  onClick={() => toggleClientCard(client.id)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-slate-950 text-white flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                          {client.companyName}
                        </h2>
                        {client.sector && (
                          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                            {client.sector}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span>P.IVA: {client.vatNumber}</span>
                        {client.sdiCode && <span>SDI: {client.sdiCode}</span>}
                        {client.city && client.city !== '-' && <span>Città: {client.city}</span>}
                        {client.contactName && <span>Ref.: {client.contactName}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-xs font-mono font-bold">
                      {clientFacilities.length}{' '}
                      {clientFacilities.length === 1 ? 'Stabilimento' : 'Stabilimenti'}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Client Details & Facilities */}
                {isExpanded && (
                  <div className="border-t border-slate-200 p-4 sm:p-6 bg-slate-50/50 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                        Scheda Anagrafica Completa Cliente
                      </div>
                      <button
                        type="button"
                        onClick={() => openEditClientModal(client)}
                        className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Modifica Informazioni Cliente</span>
                      </button>
                    </div>

                    {/* Grid of Client Information */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Ragione Sociale
                        </div>
                        <div className="font-bold text-slate-900 mt-1 break-words">
                          {client.companyName}
                        </div>
                      </div>

                      <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Partita IVA &amp; Cod. Fiscale
                        </div>
                        <div className="font-mono font-bold text-slate-900 mt-1">
                          P.IVA: {client.vatNumber}
                        </div>
                        {client.taxCode && (
                          <div className="font-mono text-slate-600 text-[11px]">
                            C.F.: {client.taxCode}
                          </div>
                        )}
                      </div>

                      <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Fatturazione Elettronica (SDI / PEC)
                        </div>
                        <div className="font-mono font-bold text-slate-900 mt-1">
                          SDI: {client.sdiCode || '0000000'}
                        </div>
                        {client.pecEmail && (
                          <div className="text-slate-600 text-[11px] break-all">
                            PEC: {client.pecEmail}
                          </div>
                        )}
                      </div>

                      <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Settore Merceologico
                        </div>
                        <div className="font-bold text-slate-900 mt-1 break-words">
                          {client.sector || '—'}
                        </div>
                      </div>

                      <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <User className="w-3 h-3" /> Referente Cliente
                        </div>
                        <div className="font-bold text-slate-900 mt-1 break-words">
                          {client.contactName || '—'}
                        </div>
                      </div>

                      <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> Email
                        </div>
                        <div className="font-semibold text-slate-900 mt-1 break-all">
                          {client.email || '—'}
                        </div>
                      </div>

                      <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> Recapito Telefonico
                        </div>
                        <div className="font-mono font-semibold text-slate-900 mt-1">
                          {client.phone || '—'}
                        </div>
                      </div>

                      <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Sede Legale
                        </div>
                        <div className="font-semibold text-slate-900 mt-1 break-words">
                          {[client.address, client.city !== '-' ? client.city : '']
                            .filter(Boolean)
                            .join(' — ') || '—'}
                        </div>
                      </div>
                    </div>

                    {client.notes && (
                      <div className="p-3.5 bg-white border border-slate-200 rounded-xl text-xs">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                          <FileText className="w-3 h-3" /> Note Anagrafiche Cliente
                        </div>
                        <div className="text-slate-700 whitespace-pre-wrap break-words">
                          {client.notes}
                        </div>
                      </div>
                    )}

                    {/* Stabilimenti / Sedi del Cliente */}
                    <div className="space-y-2.5">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-700" />
                        <span>Stabilimenti e Sedi Operative ({clientFacilities.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {clientFacilities.map((fac) => (
                          <div
                            key={fac.id}
                            className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs flex items-start gap-2.5"
                          >
                            <MapPin className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 break-words">
                                {fac.name}
                              </div>
                              <div className="text-slate-600 break-words mt-0.5">
                                {[fac.address, fac.city].filter(Boolean).join(' — ') ||
                                  'Indirizzo non specificato'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Create / Edit Client with All Information & Multiple Facilities */}
      {showClientModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-5 sm:p-6 space-y-5 shadow-xl my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-mono text-slate-500 font-semibold uppercase tracking-wider">
                  {editingClient ? 'MODIFICA ANAGRAFICA CLIENTE' : 'NUOVA ANAGRAFICA CLIENTE'}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                  {editingClient
                    ? `Modifica Cliente: ${editingClient.companyName}`
                    : 'Inserisci Nuovo Cliente'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Compila tutte le informazioni societarie, fiscali, i recapiti e gli stabilimenti del cliente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowClientModal(false)}
                className="p-2 bg-slate-950 hover:bg-slate-800 text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {clientModalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                {clientModalError}
              </div>
            )}

            <form onSubmit={handleSaveClient} className="space-y-5">
              {/* Dati Societari e Fiscali */}
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                  1. Dati Societari e Fiscali
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-6">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ragione Sociale Cliente *
                    </label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Es. BioPharma Italia S.p.A."
                      className="w-full min-h-[42px] px-3.5 py-2 border border-slate-300 rounded-xl text-sm"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Partita IVA *
                    </label>
                    <input
                      type="text"
                      required
                      value={vatNumber}
                      onChange={(e) => setVatNumber(e.target.value)}
                      placeholder="IT08976540961"
                      className="w-full min-h-[42px] px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-mono uppercase"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Codice Fiscale
                    </label>
                    <input
                      type="text"
                      value={taxCode}
                      onChange={(e) => setTaxCode(e.target.value)}
                      placeholder="08976540961"
                      className="w-full min-h-[42px] px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-mono uppercase"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Codice Univoco SDI
                    </label>
                    <input
                      type="text"
                      value={sdiCode}
                      onChange={(e) => setSdiCode(e.target.value)}
                      placeholder="0000000"
                      className="w-full min-h-[42px] px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-mono uppercase"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Indirizzo PEC
                    </label>
                    <input
                      type="email"
                      value={pecEmail}
                      onChange={(e) => setPecEmail(e.target.value)}
                      placeholder="amministrazione@pec.azienda.it"
                      className="w-full min-h-[42px] px-3.5 py-2 border border-slate-300 rounded-xl text-sm"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Settore Merceologico
                    </label>
                    <input
                      type="text"
                      value={sector}
                      onChange={(e) => setSector(e.target.value)}
                      placeholder="Farmaceutico / Chimico / Medical Device"
                      className="w-full min-h-[42px] px-3.5 py-2 border border-slate-300 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Sede Legale e Contatti */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                  2. Sede Legale, Referenti e Contatti
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Città Sede Legale
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Es. Milano (MI)"
                      className="w-full min-h-[42px] px-3.5 py-2 border border-slate-300 rounded-xl text-sm"
                    />
                  </div>
                  <div className="sm:col-span-8">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Indirizzo Sede Legale
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Es. Via delle Scienze 42"
                      className="w-full min-h-[42px] px-3.5 py-2 border border-slate-300 rounded-xl text-sm"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Referente Cliente (Nome e Cognome)
                    </label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Es. Ing. Marco Verdi"
                      className="w-full min-h-[42px] px-3.5 py-2 border border-slate-300 rounded-xl text-sm"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Referente / Aziendale
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="m.verdi@azienda.it"
                      className="w-full min-h-[42px] px-3.5 py-2 border border-slate-300 rounded-xl text-sm"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Telefono
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+39 02 1234567"
                      className="w-full min-h-[42px] px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-mono"
                    />
                  </div>

                  <div className="sm:col-span-12">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Note Anagrafiche (Opzionale)
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Eventuali note amministrative, orari di accesso o riferimenti interni del cliente..."
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Stabilimenti / Sedi del Cliente */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      3. Stabilimenti / Sedi Operative del Cliente
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Inserisci uno o più stabilimenti con la rispettiva via e città.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddFacilityRow}
                    className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Aggiungi Stabilimento</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {facilities.map((fac, idx) => (
                    <div
                      key={fac.id}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white p-3 rounded-xl border border-slate-200 items-center"
                    >
                      <div className="sm:col-span-4">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                          Nome Stabilimento #{idx + 1}
                        </label>
                        <input
                          type="text"
                          value={fac.name}
                          onChange={(e) =>
                            handleUpdateFacilityRow(fac.id, 'name', e.target.value)
                          }
                          placeholder="Es. Stabilimento Produttivo Nord"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div className="sm:col-span-5">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                          Indirizzo / Via Stabilimento
                        </label>
                        <input
                          type="text"
                          value={fac.address}
                          onChange={(e) =>
                            handleUpdateFacilityRow(fac.id, 'address', e.target.value)
                          }
                          placeholder="Es. Via Leonardo da Vinci 18"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                          Città
                        </label>
                        <input
                          type="text"
                          value={fac.city}
                          onChange={(e) =>
                            handleUpdateFacilityRow(fac.id, 'city', e.target.value)
                          }
                          placeholder="Milano (MI)"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div className="sm:col-span-1 flex justify-end pt-3">
                        {facilities.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFacilityRow(fac.id)}
                            className="p-1.5 bg-slate-950 hover:bg-slate-800 text-white rounded-lg cursor-pointer"
                            title="Rimuovi stabilimento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
                  className="min-h-[42px] px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={submittingClient}
                  className="min-h-[42px] px-5 py-2 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  {submittingClient ? 'Salvataggio...' : 'Salva Anagrafica Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
