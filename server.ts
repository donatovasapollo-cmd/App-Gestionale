import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'production_db.json');

interface UserPermissions {
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

const ALL_PERMISSIONS_TRUE: UserPermissions = {
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

const DEFAULT_OPERATOR_PERMISSIONS: UserPermissions = {
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

interface DbUser {
  id: string;
  uid: string;
  username: string;
  password: string;
  displayName: string;
  level: 'admin' | 'operatore';
  department: string;
  permissions: UserPermissions;
  orgId: 'enterprise_hq';
}

type QuoteMacroCategory = 'qualifica' | 'compliance' | 'taratura';
type QuotePricingMode =
  | 'consuntivo_giornate'
  | 'progetto_equipment'
  | 'a_strumento'
  | 'consuntivo_strumento';
type QuoteDurationType = 'singola' | 'annuale' | 'multianno';

interface DbQuoteLineItem {
  id: string;
  itemType: string;
  activityOrSpec: string;
  plannedTests?: string[];
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  addedManuallyInProject?: boolean;
}

interface DbClientFacility {
  id: string;
  name: string;
  address: string;
  city: string;
}

interface DbClient {
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
  facilities: DbClientFacility[];
  sourceQuoteNumber: string;
  orgId: 'enterprise_hq';
  createdByUid: string;
}

interface DbQuoteDailyRates {
  engineer?: number;
  specialist?: number;
  consultant?: number;
}

interface DbQuote {
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
  dailyRates?: DbQuoteDailyRates;
  lineItems: DbQuoteLineItem[];
  estimatedHours: number;
  hourlyRate: number;
  totalAmount: number;
  status: 'sent' | 'accepted' | 'superseded' | 'cancelled';
  orderNumber: string;
  orderDate: string;
  linkedClientId: string;
  linkedProjectId: string;
  createdAt: string;
  orgId: 'enterprise_hq';
  createdByUid: string;
  createdByName: string;
}

interface DbProject {
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
  dailyRates?: DbQuoteDailyRates;
  lineItems: DbQuoteLineItem[];
  pendingWorksheet?: any;
  orderNumber: string;
  orderDate: string;
  title: string;
  description: string;
  systemInfo?: string;
  extraCosts?: string;
  budgetHours: number;
  hourlyRate: number;
  totalContractAmount?: number;
  status: 'active' | 'completed';
  orgId: 'enterprise_hq';
  createdByUid: string;
}

interface DbActivity {
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
  calibrationActivityType?: string;
  calibrationInstrumentType?: string;
  instrumentCount?: number;
  qualificationActivityType?: string;
  qualificationPhase?: string;
  machineType?: string;
  complianceDocumentType?: string;
  workplaceFlag?: 'cliente' | 'ufficio';
  isExtra?: boolean;
  scadenza?: string;
  cycleYearNumber?: number;
  notes?: string;
  lineItemId?: string;
  lineItemTitle?: string;
  executionDate: string;
  executionDates?: string[];
  isFullDay?: boolean;
  startTime: string;
  endTime: string;
  durationHours: number;
  activityType: string;
  locationMode: string;
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

interface EnterpriseDb {
  users: DbUser[];
  quotes: DbQuote[];
  clients: DbClient[];
  projects: DbProject[];
  activities: DbActivity[];
}

function getCleanInitialDb(): EnterpriseDb {
  return {
    users: [
      {
        id: 'admin_donato',
        uid: 'admin_donato',
        username: 'donato.vasapollo@gmail.com',
        password: 'admin',
        displayName: 'Donato Vasapollo',
        level: 'admin',
        department: 'Amministrazione & Direzione',
        permissions: { ...ALL_PERMISSIONS_TRUE },
        orgId: 'enterprise_hq',
      },
    ],
    quotes: [],
    clients: [],
    projects: [],
    activities: [],
  };
}

function normalizeDb(parsed: EnterpriseDb): EnterpriseDb {
  if (!parsed.users || parsed.users.length === 0) {
    parsed.users = getCleanInitialDb().users;
  }
  parsed.clients = (parsed.clients || []).map((c) => {
    const facilities = Array.isArray(c.facilities) && c.facilities.length > 0
      ? c.facilities
      : [
          {
            id: `fac_${c.id}_1`,
            name: 'Sede Principale / Stabilimento 1',
            address: c.address || '',
            city: c.city || '',
          },
        ];
    return {
      ...c,
      facilities,
    };
  });
  parsed.quotes = (parsed.quotes || []).map((q) => ({
    ...q,
    revision: typeof q.revision === 'number' ? q.revision : 0,
    macroCategory: q.macroCategory || 'qualifica',
    pricingMode: q.pricingMode || 'consuntivo_giornate',
    durationType: q.durationType || 'singola',
    contractYears:
      q.durationType === 'multianno'
        ? Math.max(2, Number(q.contractYears) || 2)
        : 1,
    estimatedDays:
      typeof q.estimatedDays === 'number'
        ? q.estimatedDays
        : Math.max(1, Number(((q.estimatedHours || 8) / 8).toFixed(1))),
    dailyRate:
      typeof q.dailyRate === 'number' ? q.dailyRate : (q.hourlyRate || 80) * 8,
    lineItems: Array.isArray(q.lineItems)
      ? q.lineItems.slice(0, 20).map((li) => ({
          ...li,
          plannedTests: Array.isArray(li.plannedTests)
            ? li.plannedTests.filter((t) => typeof t === 'string' && t.trim().length > 0)
            : [],
        }))
      : [],
    systemInfo: q.systemInfo || '',
    extraCosts: q.extraCosts || '',
    createdAt: q.createdAt || new Date().toISOString().slice(0, 10),
  }));
  parsed.projects = (parsed.projects || []).map((p) => ({
    ...p,
    durationType: p.durationType || 'singola',
    contractYears:
      p.durationType === 'multianno'
        ? Math.max(2, Number(p.contractYears) || 2)
        : 1,
    completedYearsCount:
      typeof p.completedYearsCount === 'number' ? p.completedYearsCount : 0,
    lineItems: Array.isArray(p.lineItems) ? p.lineItems : [],
  }));
  parsed.activities = parsed.activities || [];
  return parsed;
}

function loadDb(): EnterpriseDb {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial = getCleanInitialDb();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as EnterpriseDb;
    return normalizeDb(parsed);
  } catch (err) {
    console.error('Error loading DB, initializing clean state:', err);
    return getCleanInitialDb();
  }
}

function saveDb(data: EnterpriseDb) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving DB:', err);
  }
}

function generateNextUniqueQuoteNumber(quotes: DbQuote[]): string {
  const year = new Date().getFullYear();
  const prefix = `OFF-${year}-`;
  let maxSeq = 0;
  for (const q of quotes) {
    if (q.quoteNumber && q.quoteNumber.startsWith(prefix)) {
      const numPart = parseInt(q.quoteNumber.slice(prefix.length), 10);
      if (!isNaN(numPart) && numPart > maxSeq) {
        maxSeq = numPart;
      }
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '5mb' }));

  // 1. Local Login Endpoint
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      res.status(400).json({ error: 'Inserisci username/email e password.' });
      return;
    }
    const db = loadDb();
    const cleanUser = username.trim().toLowerCase();
    const found = db.users.find(
      (u) =>
        (u.username.toLowerCase() === cleanUser ||
          (u.id === 'admin_donato' && cleanUser === 'donato')) &&
        u.password === password
    );
    if (!found) {
      res.status(401).json({
        error: 'Credenziali non valide. Verifica username e password.',
      });
      return;
    }
    const { password: _pwd, ...safeUser } = found;
    res.json({ user: safeUser });
  });

  // 2. Get Current Application State
  app.get('/api/state', (_req: Request, res: Response) => {
    const db = loadDb();
    const safeUsers = db.users.map(({ password: _p, ...rest }) => rest);
    res.json({
      users: safeUsers,
      quotes: db.quotes,
      clients: db.clients,
      projects: db.projects,
      activities: db.activities,
    });
  });

  // 3. Create New User
  app.post('/api/users', (req: Request, res: Response) => {
    const { username, password, displayName, level, department, permissions } = req.body as {
      username?: string;
      password?: string;
      displayName?: string;
      level?: 'admin' | 'operatore';
      department?: string;
      permissions?: Partial<UserPermissions>;
    };

    if (!username || !password || !displayName) {
      res.status(400).json({ error: 'Compila nome, username e password.' });
      return;
    }

    const db = loadDb();
    const cleanUsername = username.trim().toLowerCase();
    if (db.users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      res.status(409).json({ error: 'Questo username/email è già registrato.' });
      return;
    }

    const userLevel: 'admin' | 'operatore' = level === 'admin' ? 'admin' : 'operatore';
    const finalPermissions: UserPermissions =
      userLevel === 'admin'
        ? { ...ALL_PERMISSIONS_TRUE }
        : {
            ...DEFAULT_OPERATOR_PERMISSIONS,
            ...(permissions || {}),
          };

    const newUid = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newUser: DbUser = {
      id: newUid,
      uid: newUid,
      username: cleanUsername,
      password: password.trim(),
      displayName: displayName.trim().slice(0, 100),
      level: userLevel,
      department: (department || 'Area Tecnica').trim().slice(0, 80),
      permissions: finalPermissions,
      orgId: 'enterprise_hq',
    };

    db.users.push(newUser);
    saveDb(db);

    const { password: _pwd, ...safeUser } = newUser;
    res.json({ user: safeUser });
  });

  // 4. Update User
  app.patch('/api/users/:uid', (req: Request, res: Response) => {
    const { displayName, username, level, department, newPassword, permissions } = req.body as {
      displayName?: string;
      username?: string;
      level?: 'admin' | 'operatore';
      department?: string;
      newPassword?: string;
      permissions?: Partial<UserPermissions>;
    };

    const db = loadDb();
    const user = db.users.find((u) => u.uid === req.params.uid);
    if (!user) {
      res.status(404).json({ error: 'Utente non trovato.' });
      return;
    }

    if (displayName !== undefined && displayName.trim()) {
      user.displayName = displayName.trim().slice(0, 100);
    }
    if (username !== undefined && username.trim()) {
      const cleanU = username.trim().toLowerCase();
      if (db.users.some((other) => other.uid !== user.uid && other.username.toLowerCase() === cleanU)) {
        res.status(409).json({ error: 'Username già in uso da un altro utente.' });
        return;
      }
      user.username = cleanU;
    }
    if (department !== undefined) {
      user.department = department.trim().slice(0, 80);
    }
    if (level !== undefined) {
      const adminCount = db.users.filter((u) => u.level === 'admin').length;
      if (user.level === 'admin' && level === 'operatore' && adminCount <= 1) {
        res.status(400).json({ error: 'Deve esistere almeno un Amministratore nel sistema.' });
        return;
      }
      user.level = level;
    }
    if (user.level === 'admin') {
      user.permissions = { ...ALL_PERMISSIONS_TRUE };
    } else if (permissions) {
      user.permissions = {
        ...user.permissions,
        ...permissions,
      };
    }
    if (newPassword && newPassword.trim().length >= 3) {
      user.password = newPassword.trim();
    }

    saveDb(db);
    const { password: _p, ...safeUser } = user;
    res.json({ user: safeUser });
  });

  // 5. Delete User
  app.delete('/api/users/:uid', (req: Request, res: Response) => {
    const db = loadDb();
    const target = db.users.find((u) => u.uid === req.params.uid);
    if (!target) {
      res.status(404).json({ error: 'Utente non trovato.' });
      return;
    }
    const adminCount = db.users.filter((u) => u.level === 'admin').length;
    if (target.level === 'admin' && adminCount <= 1) {
      res.status(400).json({ error: "Impossibile eliminare l'unico Amministratore." });
      return;
    }
    db.users = db.users.filter((u) => u.uid !== req.params.uid);
    saveDb(db);
    res.json({ ok: true });
  });

  // 6. Create or Update Client with Multiple Facilities (Stabilimenti)
  app.post('/api/clients', (req: Request, res: Response) => {
    const body = req.body as {
      companyName?: string;
      vatNumber?: string;
      taxCode?: string;
      sdiCode?: string;
      pecEmail?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      city?: string;
      address?: string;
      sector?: string;
      notes?: string;
      facilities?: DbClientFacility[];
      createdByUid?: string;
    };

    if (!body.companyName || !body.vatNumber) {
      res.status(400).json({ error: 'Inserisci Ragione Sociale e Partita IVA del cliente.' });
      return;
    }

    const db = loadDb();
    const cleanVat = body.vatNumber.trim().toUpperCase();
    const cleanName = body.companyName.trim();

    if (
      db.clients.some(
        (c) =>
          c.vatNumber.toLowerCase() === cleanVat.toLowerCase() ||
          c.companyName.toLowerCase() === cleanName.toLowerCase()
      )
    ) {
      res.status(409).json({ error: 'Esiste già un cliente con questa Ragione Sociale o P.IVA.' });
      return;
    }

    const rawFacilities = Array.isArray(body.facilities) ? body.facilities : [];
    const sanitizedFacilities: DbClientFacility[] = rawFacilities
      .filter((f) => f && (f.name?.trim() || f.address?.trim() || f.city?.trim()))
      .map((f, idx) => ({
        id: f.id || `fac_${Date.now()}_${idx + 1}`,
        name: (f.name || `Stabilimento ${idx + 1}`).trim().slice(0, 100),
        address: (f.address || '').trim().slice(0, 150),
        city: (f.city || '').trim().slice(0, 100),
      }));

    if (sanitizedFacilities.length === 0) {
      sanitizedFacilities.push({
        id: `fac_${Date.now()}_1`,
        name: 'Sede Principale / Stabilimento 1',
        address: (body.address || '').trim().slice(0, 150),
        city: (body.city || '').trim().slice(0, 100),
      });
    }

    const primaryFac = sanitizedFacilities[0];
    const newClient: DbClient = {
      id: `client_${Date.now()}`,
      companyName: cleanName.slice(0, 120),
      vatNumber: cleanVat.slice(0, 30),
      taxCode: (body.taxCode || '').trim().toUpperCase().slice(0, 30),
      sdiCode: (body.sdiCode || '0000000').trim().toUpperCase().slice(0, 20),
      pecEmail: (body.pecEmail || '').trim().slice(0, 120),
      contactName: (body.contactName || '').trim().slice(0, 100),
      email: (body.email || '').trim().slice(0, 120),
      phone: (body.phone || '').trim().slice(0, 50),
      city: (body.city || primaryFac.city || '-').trim().slice(0, 100),
      address: (body.address || primaryFac.address || '').trim().slice(0, 150),
      sector: (body.sector || 'Farmaceutico / Industriale').trim().slice(0, 80),
      notes: (body.notes || '').trim().slice(0, 1000),
      facilities: sanitizedFacilities,
      sourceQuoteNumber: 'Inserimento Anagrafica',
      orgId: 'enterprise_hq',
      createdByUid: body.createdByUid || 'admin_donato',
    };

    db.clients.unshift(newClient);
    saveDb(db);
    res.json({ client: newClient });
  });

  app.patch('/api/clients/:id', (req: Request, res: Response) => {
    const body = req.body as {
      companyName?: string;
      vatNumber?: string;
      taxCode?: string;
      sdiCode?: string;
      pecEmail?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      city?: string;
      address?: string;
      sector?: string;
      notes?: string;
      facilities?: DbClientFacility[];
    };

    const db = loadDb();
    const client = db.clients.find((c) => c.id === req.params.id);
    if (!client) {
      res.status(404).json({ error: 'Cliente non trovato.' });
      return;
    }

    if (body.companyName && body.companyName.trim()) {
      client.companyName = body.companyName.trim().slice(0, 120);
    }
    if (body.vatNumber && body.vatNumber.trim()) {
      client.vatNumber = body.vatNumber.trim().toUpperCase().slice(0, 30);
    }
    if (body.taxCode !== undefined) {
      client.taxCode = body.taxCode.trim().toUpperCase().slice(0, 30);
    }
    if (body.sdiCode !== undefined) {
      client.sdiCode = (body.sdiCode.trim() || '0000000').toUpperCase().slice(0, 20);
    }
    if (body.pecEmail !== undefined) {
      client.pecEmail = body.pecEmail.trim().slice(0, 120);
    }
    if (body.contactName !== undefined) {
      client.contactName = body.contactName.trim().slice(0, 100);
    }
    if (body.email !== undefined) {
      client.email = body.email.trim().slice(0, 120);
    }
    if (body.phone !== undefined) {
      client.phone = body.phone.trim().slice(0, 50);
    }
    if (body.city !== undefined) {
      client.city = body.city.trim().slice(0, 100) || '-';
    }
    if (body.address !== undefined) {
      client.address = body.address.trim().slice(0, 150);
    }
    if (body.sector !== undefined) {
      client.sector = body.sector.trim().slice(0, 80);
    }
    if (body.notes !== undefined) {
      client.notes = body.notes.trim().slice(0, 1000);
    }
    if (Array.isArray(body.facilities)) {
      const sanitized: DbClientFacility[] = body.facilities
        .filter((f) => f && (f.name?.trim() || f.address?.trim() || f.city?.trim()))
        .map((f, idx) => ({
          id: f.id || `fac_${Date.now()}_${idx + 1}`,
          name: (f.name || `Stabilimento ${idx + 1}`).trim().slice(0, 100),
          address: (f.address || '').trim().slice(0, 150),
          city: (f.city || '').trim().slice(0, 100),
        }));
      if (sanitized.length > 0) {
        client.facilities = sanitized;
        if (!body.city) client.city = sanitized[0].city || client.city;
        if (!body.address) client.address = sanitized[0].address || client.address;
      }
    }

    saveDb(db);
    res.json({ client });
  });

  // 7. Create New Quote OR Create a New Revision of an Existing Quote
  app.post('/api/quotes', (req: Request, res: Response) => {
    const body = req.body as Partial<DbQuote> & { baseQuoteNumberForRevision?: string };
    const db = loadDb();

    let quoteNumber: string;
    let revision = 0;

    if (body.baseQuoteNumberForRevision && body.baseQuoteNumberForRevision.trim()) {
      quoteNumber = body.baseQuoteNumberForRevision.trim();
      const sameNumberQuotes = db.quotes.filter((q) => q.quoteNumber === quoteNumber);
      const maxExistingRev = sameNumberQuotes.reduce(
        (max, q) => (q.revision > max ? q.revision : max),
        -1
      );
      revision = maxExistingRev + 1;

      for (const prev of sameNumberQuotes) {
        if (prev.status === 'sent') {
          prev.status = 'superseded';
        }
      }
    } else {
      quoteNumber = generateNextUniqueQuoteNumber(db.quotes);
      revision = 0;
    }

    const macroCategory: QuoteMacroCategory =
      body.macroCategory === 'compliance' || body.macroCategory === 'taratura'
        ? body.macroCategory
        : 'qualifica';

    const pricingMode: QuotePricingMode =
      body.pricingMode === 'progetto_equipment' ||
      body.pricingMode === 'a_strumento' ||
      body.pricingMode === 'consuntivo_strumento'
        ? body.pricingMode
        : 'consuntivo_giornate';

    const durationType: QuoteDurationType =
      body.durationType === 'annuale' || body.durationType === 'multianno'
        ? body.durationType
        : 'singola';

    const contractYears =
      durationType === 'multianno'
        ? Math.max(2, Math.min(20, parseInt(String(body.contractYears || 2), 10) || 2))
        : 1;

    const rawItems = Array.isArray(body.lineItems) ? body.lineItems.slice(0, 20) : [];
    const sanitizedItems: DbQuoteLineItem[] = rawItems
      .filter(
        (item) =>
          item &&
          ((item.itemType && item.itemType.trim().length > 0) ||
            (item.activityOrSpec && item.activityOrSpec.trim().length > 0))
      )
      .map((item, idx) => {
        const qty =
          pricingMode === 'consuntivo_strumento'
            ? 1
            : Math.max(1, Number(item.quantity) || 1);
        const unit = Math.max(0, Number(item.unitPrice) || 0);
        const cleanTests = Array.isArray(item.plannedTests)
          ? item.plannedTests
              .map((t) => String(t || '').trim())
              .filter((t) => t.length > 0)
          : [];
        const cleanType = (item.itemType || item.activityOrSpec || '').trim().slice(0, 140);
        return {
          id: item.id || `row_${idx + 1}_${Date.now()}`,
          itemType: cleanType,
          activityOrSpec: (item.activityOrSpec || '').trim().slice(0, 200),
          plannedTests: cleanTests,
          quantity: qty,
          unitPrice: unit,
          totalPrice: Number((qty * unit).toFixed(2)),
        };
      });

    const estimatedDays = Math.max(0.5, Number(body.estimatedDays) || 1);
    const sanitizedDailyRates: DbQuoteDailyRates | undefined = body.dailyRates
      ? {
          engineer: Math.max(0, Number(body.dailyRates.engineer) || 0),
          specialist: Math.max(0, Number(body.dailyRates.specialist) || 0),
          consultant: Math.max(0, Number(body.dailyRates.consultant) || 0),
        }
      : undefined;
    const primaryRate =
      sanitizedDailyRates &&
      (sanitizedDailyRates.engineer ||
        sanitizedDailyRates.specialist ||
        sanitizedDailyRates.consultant)
        ? sanitizedDailyRates.engineer ||
          sanitizedDailyRates.specialist ||
          sanitizedDailyRates.consultant ||
          640
        : Math.max(0, Number(body.dailyRate) || 640);
    const dailyRate = primaryRate;

    let totalAmount = 0;
    const estimatedHours = Math.max(1, Number((estimatedDays * 8).toFixed(1)));
    let hourlyRate = Math.max(1, Number((dailyRate / 8).toFixed(2)));

    if (pricingMode === 'consuntivo_giornate') {
      totalAmount = sanitizedDailyRates
        ? Number(
            (
              (sanitizedDailyRates.engineer || 0) +
              (sanitizedDailyRates.specialist || 0) +
              (sanitizedDailyRates.consultant || 0)
            ).toFixed(2)
          ) || Number((estimatedDays * dailyRate).toFixed(2))
        : Number((estimatedDays * dailyRate).toFixed(2));
    } else {
      totalAmount = Number(
        sanitizedItems.reduce((sum, r) => sum + r.totalPrice, 0).toFixed(2)
      );
      if (estimatedDays > 0 && totalAmount > 0) {
        hourlyRate = Number((totalAmount / Math.max(1, estimatedHours)).toFixed(2));
      }
    }

    const quoteId = `quote_${Date.now()}_rev${String(revision).padStart(2, '0')}`;
    const newQuote: DbQuote = {
      id: quoteId,
      quoteNumber,
      revision,
      macroCategory,
      pricingMode,
      durationType,
      contractYears,
      clientId: body.clientId || '',
      clientName: (body.clientName || '').trim().slice(0, 120),
      clientVat: (body.clientVat || '').trim().toUpperCase().slice(0, 30),
      clientSdi: (body.clientSdi || '0000000').trim().toUpperCase().slice(0, 20),
      clientCity: (body.clientCity || '').trim().slice(0, 80),
      facilityId: body.facilityId || '',
      facilityName: (body.facilityName || '').trim().slice(0, 100),
      facilityAddress: (body.facilityAddress || '').trim().slice(0, 150),
      projectTitle: (body.projectTitle || '').trim().slice(0, 150),
      projectDescription: (body.projectDescription || '').trim().slice(0, 2000),
      systemInfo: (body.systemInfo || '').trim().slice(0, 4000),
      extraCosts: (body.extraCosts || '').trim().slice(0, 2000),
      estimatedDays,
      dailyRate,
      dailyRates: sanitizedDailyRates,
      lineItems: sanitizedItems,
      estimatedHours,
      hourlyRate,
      totalAmount,
      status: 'sent',
      orderNumber: '',
      orderDate: '',
      linkedClientId: '',
      linkedProjectId: '',
      createdAt: new Date().toISOString().slice(0, 10),
      orgId: 'enterprise_hq',
      createdByUid: body.createdByUid || 'admin_donato',
      createdByName: body.createdByName || 'Donato Vasapollo',
    };

    db.quotes.unshift(newQuote);
    saveDb(db);
    res.json({ quote: newQuote });
  });

  // 8. Receive Order -> Auto-create Client (if not exists) + Auto-create Project with Description & Activities/Equipment
  app.post('/api/quotes/:id/order', (req: Request, res: Response) => {
    const quoteId = req.params.id;
    const { orderNumber, orderDate, sector, userId } = req.body as {
      orderNumber?: string;
      orderDate?: string;
      sector?: string;
      userId?: string;
    };

    const db = loadDb();
    const quote = db.quotes.find((q) => q.id === quoteId);
    if (!quote) {
      res.status(404).json({ error: 'Offerta non trovata.' });
      return;
    }

    const fullQuoteRef = `${quote.quoteNumber} Rev. ${String(quote.revision ?? 0).padStart(2, '0')}`;

    let client = db.clients.find(
      (c) =>
        (quote.clientId && c.id === quote.clientId) ||
        c.vatNumber.toLowerCase() === quote.clientVat.toLowerCase() ||
        c.companyName.toLowerCase() === quote.clientName.toLowerCase()
    );

    if (!client) {
      client = {
        id: `client_${Date.now()}`,
        companyName: quote.clientName,
        vatNumber: quote.clientVat,
        sdiCode: quote.clientSdi,
        city: quote.clientCity,
        address: quote.facilityAddress || '',
        sector: (sector || 'Farmaceutico / Industriale').trim(),
        facilities: [
          {
            id: `fac_${Date.now()}_1`,
            name: quote.facilityName || 'Stabilimento Principale',
            address: quote.facilityAddress || '',
            city: quote.clientCity || '',
          },
        ],
        sourceQuoteNumber: fullQuoteRef,
        orgId: 'enterprise_hq',
        createdByUid: userId || quote.createdByUid,
      };
      db.clients.push(client);
    }

    const newProject: DbProject = {
      id: `proj_${Date.now()}`,
      clientId: client.id,
      clientName: client.companyName,
      clientVat: client.vatNumber,
      facilityId: quote.facilityId || client.facilities?.[0]?.id || '',
      facilityName: quote.facilityName || client.facilities?.[0]?.name || '',
      facilityAddress: quote.facilityAddress || client.facilities?.[0]?.address || '',
      clientCity: quote.clientCity || client.city || '',
      quoteId: quote.id,
      quoteNumber: fullQuoteRef,
      quoteRevision: quote.revision,
      macroCategory: quote.macroCategory,
      pricingMode: quote.pricingMode,
      durationType: quote.durationType || 'singola',
      contractYears:
        quote.durationType === 'multianno'
          ? Math.max(2, Number(quote.contractYears) || 2)
          : 1,
      completedYearsCount: 0,
      estimatedDays: quote.estimatedDays,
      dailyRate: quote.dailyRate,
      dailyRates: quote.dailyRates,
      lineItems: Array.isArray(quote.lineItems) ? [...quote.lineItems] : [],
      orderNumber: (orderNumber || `ORD-${Date.now()}`).trim(),
      orderDate: orderDate || new Date().toISOString().slice(0, 10),
      title: quote.projectTitle,
      description: quote.projectDescription,
      systemInfo: quote.systemInfo || '',
      extraCosts: quote.extraCosts || '',
      budgetHours: quote.estimatedHours,
      hourlyRate: quote.hourlyRate,
      totalContractAmount: quote.totalAmount,
      status: 'active',
      orgId: 'enterprise_hq',
      createdByUid: userId || quote.createdByUid,
    };

    db.projects.unshift(newProject);

    quote.status = 'accepted';
    quote.orderNumber = newProject.orderNumber;
    quote.orderDate = newProject.orderDate;
    quote.linkedClientId = client.id;
    quote.linkedProjectId = newProject.id;

    for (const other of db.quotes) {
      if (
        other.quoteNumber === quote.quoteNumber &&
        other.id !== quote.id &&
        other.status === 'sent'
      ) {
        other.status = 'superseded';
      }
    }

    saveDb(db);
    res.json({ quote, client, project: newProject });
  });

  // 9. Add Manual Activity Item to a Project (when not in offer or added manually later)
  app.post('/api/projects/:id/items', (req: Request, res: Response) => {
    const { itemType, activityOrSpec } = req.body as {
      itemType?: string;
      activityOrSpec?: string;
    };

    if (!itemType || !itemType.trim()) {
      res.status(400).json({ error: "Inserisci il nome dell'attività o equipment." });
      return;
    }

    const db = loadDb();
    const project = db.projects.find((p) => p.id === req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Progetto non trovato.' });
      return;
    }

    const newItem: DbQuoteLineItem = {
      id: `manual_item_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      itemType: itemType.trim().slice(0, 140),
      activityOrSpec: (activityOrSpec || '').trim().slice(0, 200),
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      addedManuallyInProject: true,
    };

    if (!Array.isArray(project.lineItems)) {
      project.lineItems = [];
    }
    project.lineItems.push(newItem);
    saveDb(db);
    res.json({ project, item: newItem });
  });

  // 10. Complete Project
  app.patch('/api/projects/:id/status', (req: Request, res: Response) => {
    const db = loadDb();
    const project = db.projects.find((p) => p.id === req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Progetto non trovato.' });
      return;
    }
    project.status = 'completed';
    saveDb(db);
    res.json({ project });
  });

  // 10b. Memorizza Pending Worksheet for a Project (saved in DB, visible to all users, not in Storico until storicizzato)
  app.put('/api/projects/:id/worksheet', (req: Request, res: Response) => {
    const db = loadDb();
    const project = db.projects.find((p) => p.id === req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Progetto non trovato.' });
      return;
    }
    const { calibrationRows, qualificationRows, complianceRows, updatedByName } = req.body as {
      calibrationRows?: any[];
      qualificationRows?: any[];
      complianceRows?: any[];
      updatedByName?: string;
    };
    project.pendingWorksheet = {
      calibrationRows: Array.isArray(calibrationRows) ? calibrationRows : project.pendingWorksheet?.calibrationRows || [],
      qualificationRows: Array.isArray(qualificationRows) ? qualificationRows : project.pendingWorksheet?.qualificationRows || [],
      complianceRows: Array.isArray(complianceRows) ? complianceRows : project.pendingWorksheet?.complianceRows || [],
      updatedAt: new Date().toISOString(),
      updatedByName: updatedByName || 'Tecnico',
    };
    saveDb(db);
    res.json({ project });
  });

  // 11. Log Single or Multiple Executed Activities (Salva e Storicizza Taratura / Qualifica / Compliance)
  app.post('/api/activities', (req: Request, res: Response) => {
    const body = req.body as Partial<DbActivity> & {
      clearPendingWorksheet?: boolean;
      nextPendingWorksheet?: {
        calibrationRows?: any[];
        qualificationRows?: any[];
        complianceRows?: any[];
      };
      items?: {
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
    };
    const db = loadDb();

    const targetProj = body.projectId
      ? db.projects.find((p) => p.id === body.projectId)
      : undefined;
    const currentCycleYear = (targetProj?.completedYearsCount || 0) + 1;

    const defaultIsFullDay = Boolean(body.isFullDay);
    const defaultStartTime = defaultIsFullDay ? '09:00' : body.startTime || '09:00';
    const defaultEndTime = defaultIsFullDay ? '17:00' : body.endTime || '13:00';
    const defaultDurationHours = defaultIsFullDay ? 8 : Number(body.durationHours) || 0;

    const batchItems =
      Array.isArray(body.items) && body.items.length > 0
        ? body.items
        : [
            {
              lineItemId: body.lineItemId || '',
              lineItemTitle: body.lineItemTitle || '',
              description: body.description || '',
              macroCategory: body.macroCategory,
              calibrationActivityType: body.calibrationActivityType,
              calibrationInstrumentType: body.calibrationInstrumentType,
              instrumentCount: body.instrumentCount,
              qualificationActivityType: body.qualificationActivityType,
              qualificationPhase: body.qualificationPhase,
              machineType: body.machineType,
              complianceDocumentType: body.complianceDocumentType,
              workplaceFlag: body.workplaceFlag,
              executionDate: body.executionDate,
              executionDates: body.executionDates,
              scadenza: body.scadenza,
              durationHours: body.durationHours,
              notes: body.notes,
              isExtra: body.isExtra,
            },
          ];

    const createdList: DbActivity[] = [];

    for (const entry of batchItems) {
      const nextNum = db.activities.length + 1;
      const reportNumber = `ATT-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;
      const rowHours =
        entry.durationHours !== undefined ? Number(entry.durationHours) || 0 : defaultDurationHours;
      const datesList =
        Array.isArray(entry.executionDates) && entry.executionDates.length > 0
          ? entry.executionDates.filter(Boolean)
          : [entry.executionDate || body.executionDate || new Date().toISOString().slice(0, 10)];

      const newAct: DbActivity = {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        reportNumber,
        projectId: body.projectId || '',
        projectTitle: body.projectTitle || '',
        quoteNumber: body.quoteNumber || '',
        clientId: body.clientId || '',
        clientName: body.clientName || '',
        facilityName: body.facilityName || '',
        facilityAddress: body.facilityAddress || '',
        orderNumber: body.orderNumber || '',
        macroCategory: entry.macroCategory || body.macroCategory || 'qualifica',
        calibrationActivityType: entry.calibrationActivityType || '',
        calibrationInstrumentType: entry.calibrationInstrumentType || '',
        instrumentCount:
          entry.instrumentCount !== undefined ? Math.max(1, Number(entry.instrumentCount) || 1) : undefined,
        qualificationActivityType: entry.qualificationActivityType || '',
        qualificationPhase: entry.qualificationPhase || '',
        machineType: (entry.machineType || '').trim(),
        complianceDocumentType: (entry.complianceDocumentType || '').trim(),
        workplaceFlag: entry.workplaceFlag,
        isExtra: Boolean(entry.isExtra),
        scadenza: entry.scadenza || '',
        cycleYearNumber: currentCycleYear,
        notes: (entry.notes || '').trim(),
        lineItemId: entry.lineItemId || '',
        lineItemTitle: (entry.lineItemTitle || '').trim(),
        executionDate: datesList[0] || new Date().toISOString().slice(0, 10),
        executionDates: datesList,
        isFullDay: defaultIsFullDay,
        startTime: defaultStartTime,
        endTime: defaultEndTime,
        durationHours: rowHours,
        activityType: body.activityType || entry.macroCategory || 'qualifica',
        locationMode:
          entry.workplaceFlag === 'ufficio'
            ? 'remoto'
            : body.locationMode || 'onsite',
        description: (entry.description || entry.notes || body.description || entry.lineItemTitle || '').trim(),
        materialsNotes: (entry.notes || body.materialsNotes || '').trim(),
        clientSignerName: (body.clientSignerName || '').trim(),
        clientSignatureDataUrl: body.clientSignatureDataUrl || '',
        technicianSignatureDataUrl: body.technicianSignatureDataUrl || '',
        technicianUid: body.technicianUid || 'admin_donato',
        technicianName: body.technicianName || 'Tecnico',
        createdAt: new Date().toISOString(),
        orgId: 'enterprise_hq',
      };

      db.activities.unshift(newAct);
      createdList.push(newAct);
    }

    // Progress multi-year cycle or finalize project on Salva e Storicizza
    if (targetProj) {
      const totalYears =
        targetProj.durationType === 'multianno'
          ? Math.max(2, Number(targetProj.contractYears) || 2)
          : 1;
      const newCompletedCount = (targetProj.completedYearsCount || 0) + 1;
      targetProj.completedYearsCount = newCompletedCount;

      if (
        targetProj.durationType === 'multianno' &&
        newCompletedCount < totalYears &&
        body.nextPendingWorksheet
      ) {
        // Leave the table emptied of dates and with the Scadenza column for the next year
        targetProj.pendingWorksheet = {
          calibrationRows: Array.isArray(body.nextPendingWorksheet.calibrationRows)
            ? body.nextPendingWorksheet.calibrationRows
            : [],
          qualificationRows: Array.isArray(body.nextPendingWorksheet.qualificationRows)
            ? body.nextPendingWorksheet.qualificationRows
            : [],
          complianceRows: Array.isArray(body.nextPendingWorksheet.complianceRows)
            ? body.nextPendingWorksheet.complianceRows
            : [],
          updatedAt: new Date().toISOString(),
          updatedByName: body.technicianName || 'Tecnico',
        };
      } else if (body.clearPendingWorksheet) {
        targetProj.pendingWorksheet = {
          calibrationRows: [],
          qualificationRows: [],
          complianceRows: [],
          updatedAt: new Date().toISOString(),
          updatedByName: body.technicianName || 'Tecnico',
        };
        if (newCompletedCount >= totalYears) {
          targetProj.status = 'completed';
        }
      }
    }

    saveDb(db);
    res.json({ activity: createdList[0], activities: createdList, project: targetProj });
  });

  // 12. Delete Activity
  app.delete('/api/activities/:id', (req: Request, res: Response) => {
    const db = loadDb();
    db.activities = db.activities.filter((a) => a.id !== req.params.id);
    saveDb(db);
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ConsuntivaPro Production Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
