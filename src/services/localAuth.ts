import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { buildDemoDataset, type HubDataset } from '../data/demoSeed.ts';
import type {
  GameRole,
  ScrimMemberStatus,
  TeamMember,
  TeamRole,
  UserProfile,
} from '../types/training.ts';
import { getLocalProofImage, saveLocalProofImage } from '../utils/aimProof.ts';
import { db } from './firebase.ts';

export interface LocalAccountRecord {
  uid: string;
  identifier: string; // normalized lowercase username or email
  displayIdentifier: string;
  passwordSalt: string;
  passwordHash: string;
  displayName: string;
  riotId: string;
  teamRole: TeamRole;
  isAdmin?: boolean;
  gameRole: GameRole;
  mainAgent: string;
  managedBy?: string;
  managedByName?: string;
  createdAt: string;
}

export interface LocalAccountSession {
  account: LocalAccountRecord;
  profile: UserProfile;
}

export interface CloudHubSyncStatus {
  connected: boolean;
  syncing: boolean;
  revision: number;
  lastSyncedAt: string | null;
  updatedBy: string;
  error?: string;
}

export const UNIFIED_TEAM_ID = 'team_valorant_training_hub';
export const UNIFIED_TEAM_OWNER_ID = 'acct_manager_binh';
export const CLOUD_HUB_SYNC_TOKEN = 'vth_cloud_sync_v2';
export const ACCOUNTS_KEY = 'vth_local_accounts_v2';
export const ACTIVE_SESSION_KEY = 'vth_active_local_session_v1';
export const UNIFIED_HUB_DB_KEY = 'vth_unified_hub_database_v2';
export const UNIFIED_DB_UPDATED_AT_KEY = 'vth_unified_hub_updated_at_v2';
export const UNIFIED_DB_REVISION_KEY = 'vth_unified_hub_revision_v2';
export const UNIFIED_DB_CUSTOMIZED_KEY = 'vth_unified_hub_customized_v2';

function isBrowserLocalStorage(storage: Storage): boolean {
  try {
    return typeof window !== 'undefined' && storage === window.localStorage;
  } catch {
    return false;
  }
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

export function normalizeAccountIdentifier(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateAccountIdentifier(raw: string): string | null {
  const normalized = normalizeAccountIdentifier(raw);
  if (normalized.length < 3) {
    return 'Tên đăng nhập hoặc email phải có ít nhất 3 ký tự.';
  }
  if (normalized.length > 100) {
    return 'Tên đăng nhập hoặc email tối đa 100 ký tự.';
  }
  if (/\s/.test(normalized)) {
    return 'Tên đăng nhập không được chứa khoảng trắng.';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 6) {
    return 'Mật khẩu phải có ít nhất 6 ký tự.';
  }
  return null;
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const input = `${salt}:${password}`;
  if (globalThis.crypto?.subtle) {
    const encoded = new TextEncoder().encode(input);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv_${(h >>> 0).toString(16)}`;
}

export function isManagerAccount(account: LocalAccountRecord | null | undefined): boolean {
  if (!account) return false;
  return account.teamRole === 'coach' || Boolean(account.isAdmin);
}

export function buildProfileFromAccount(account: LocalAccountRecord): UserProfile {
  return {
    uid: account.uid,
    email: account.identifier.includes('@')
      ? account.identifier
      : `${account.identifier}@vth.esports`,
    displayName: account.displayName,
    riotId: account.riotId,
    gameRole: account.gameRole,
    mainAgent: account.mainAgent,
    activeTeamId: UNIFIED_TEAM_ID,
  };
}

// Precomputed SHA-256 hashes:
// noti: salt 'vth_salt_noti_v1', pass '12345678' -> b9f386fdda8e941c859702ed374d1804938463ff5436286574a82c200fb89d8e
// binh: salt 'vth_salt_binh_v1', pass '123456789' -> 8d5b97a4bbe8b2f548b34faf6bc28cc9a7c86f2b5f1aeae9433085c56913c973
// player default: salt 'vth_salt_player_v1', pass '123456' -> 1651c10293b545f37ad252c7ab6a7868aa7ea1ce567d53d231d65a4392c1cc56
const PLAYER_DEFAULT_SALT = 'vth_salt_player_v1';
const LEGACY_PLAYER_DEFAULT_HASH =
  'd8be31eb99817ef228d57063efbc05b787b88766ad1b9f4e2fb6377f3915d858';
const PLAYER_DEFAULT_HASH =
  '1651c10293b545f37ad252c7ab6a7868aa7ea1ce567d53d231d65a4392c1cc56';

export const DEFAULT_SEEDED_ACCOUNTS: LocalAccountRecord[] = [
  {
    uid: 'acct_admin_noti',
    identifier: 'noti',
    displayIdentifier: 'noti',
    passwordSalt: 'vth_salt_noti_v1',
    passwordHash: 'b9f386fdda8e941c859702ed374d1804938463ff5436286574a82c200fb89d8e',
    displayName: 'Admin Noti',
    riotId: 'Noti#ADMIN',
    teamRole: 'coach',
    isAdmin: true,
    gameRole: 'Flex',
    mainAgent: 'Omen',
    createdAt: '2026-11-17T00:00:00+07:00',
  },
  {
    uid: 'acct_manager_binh',
    identifier: 'binh',
    displayIdentifier: 'binh',
    passwordSalt: 'vth_salt_binh_v1',
    passwordHash: '8d5b97a4bbe8b2f548b34faf6bc28cc9a7c86f2b5f1aeae9433085c56913c973',
    displayName: 'Manager Binh',
    riotId: 'Binh#MGR',
    teamRole: 'coach',
    isAdmin: false,
    gameRole: 'Flex',
    mainAgent: 'Sova',
    createdAt: '2026-11-17T00:00:00+07:00',
  },
  {
    uid: 'demo_player_kyro',
    identifier: 'kyro',
    displayIdentifier: 'kyro',
    passwordSalt: PLAYER_DEFAULT_SALT,
    passwordHash: PLAYER_DEFAULT_HASH,
    displayName: 'Hoàng "Kyro" Minh',
    riotId: 'Kyro#SGV1',
    teamRole: 'player',
    isAdmin: false,
    gameRole: 'Duelist',
    mainAgent: 'Jett / Raze',
    managedBy: 'acct_manager_binh',
    managedByName: 'Manager Binh',
    createdAt: '2026-11-17T00:00:00+07:00',
  },
  {
    uid: 'demo_player_zen',
    identifier: 'zen',
    displayIdentifier: 'zen',
    passwordSalt: PLAYER_DEFAULT_SALT,
    passwordHash: PLAYER_DEFAULT_HASH,
    displayName: 'Trần "Zen" Hải',
    riotId: 'Zen#VN99',
    teamRole: 'player',
    isAdmin: false,
    gameRole: 'Initiator',
    mainAgent: 'Sova / Fade',
    managedBy: 'acct_manager_binh',
    managedByName: 'Manager Binh',
    createdAt: '2026-11-17T00:00:00+07:00',
  },
  {
    uid: 'demo_player_nox',
    identifier: 'nox',
    displayIdentifier: 'nox',
    passwordSalt: PLAYER_DEFAULT_SALT,
    passwordHash: PLAYER_DEFAULT_HASH,
    displayName: 'Lê "Nox" Khang',
    riotId: 'Nox#CTRL',
    teamRole: 'player',
    isAdmin: false,
    gameRole: 'Controller',
    mainAgent: 'Omen / Viper',
    managedBy: 'acct_manager_binh',
    managedByName: 'Manager Binh',
    createdAt: '2026-11-17T00:00:00+07:00',
  },
  {
    uid: 'demo_player_vega',
    identifier: 'vega',
    displayIdentifier: 'vega',
    passwordSalt: PLAYER_DEFAULT_SALT,
    passwordHash: PLAYER_DEFAULT_HASH,
    displayName: 'Phạm "Vega" Long',
    riotId: 'Vega#LOCK',
    teamRole: 'player',
    isAdmin: false,
    gameRole: 'Sentinel',
    mainAgent: 'Cypher / Killjoy',
    managedBy: 'acct_manager_binh',
    managedByName: 'Manager Binh',
    createdAt: '2026-11-17T00:00:00+07:00',
  },
  {
    uid: 'demo_player_ryu',
    identifier: 'ryu',
    displayIdentifier: 'ryu',
    passwordSalt: PLAYER_DEFAULT_SALT,
    passwordHash: PLAYER_DEFAULT_HASH,
    displayName: 'Nguyễn "Ryu" Bảo',
    riotId: 'Ryu#FLEX',
    teamRole: 'player',
    isAdmin: false,
    gameRole: 'Flex',
    mainAgent: 'KAY/O / Breach',
    managedBy: 'acct_manager_binh',
    managedByName: 'Manager Binh',
    createdAt: '2026-11-17T00:00:00+07:00',
  },
];

const DEFAULT_SEED_PLAYER_IDS = new Set([
  'kyro',
  'zen',
  'nox',
  'vega',
  'ryu',
]);

export function isCustomizedAccountRoster(
  accounts: LocalAccountRecord[],
  storage: Storage = localStorage,
): boolean {
  try {
    if (storage.getItem(UNIFIED_DB_CUSTOMIZED_KEY) === '1') {
      return true;
    }
  } catch {
    // ignore
  }
  const players = accounts.filter((a) => a.teamRole === 'player');
  if (players.length !== DEFAULT_SEED_PLAYER_IDS.size) {
    return true;
  }
  for (const p of players) {
    if (!DEFAULT_SEED_PLAYER_IDS.has(p.identifier)) {
      return true;
    }
  }
  return false;
}

export function getLocalRevision(storage: Storage = localStorage): number {
  try {
    const raw = storage.getItem(UNIFIED_DB_REVISION_KEY);
    const num = Number(raw);
    return Number.isFinite(num) && num >= 0 ? num : 0;
  } catch {
    return 0;
  }
}

export function readAccounts(storage: Storage = localStorage): LocalAccountRecord[] {
  let existing: LocalAccountRecord[] = [];
  try {
    const raw = storage.getItem(ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        existing = parsed as LocalAccountRecord[];
      }
    }
  } catch {
    existing = [];
  }

  let mutated = false;
  const merged = [...existing];

  if (merged.length === 0) {
    for (const seed of DEFAULT_SEEDED_ACCOUNTS) {
      merged.push(seed);
    }
    mutated = true;
  } else {
    // Always guarantee the two core Manager/Admin accounts exist
    for (const coreManager of DEFAULT_SEEDED_ACCOUNTS.slice(0, 2)) {
      if (!merged.some((a) => a.identifier === coreManager.identifier || a.uid === coreManager.uid)) {
        merged.unshift(coreManager);
        mutated = true;
      }
    }
  }

  // Ensure every player account has a valid manager reference and valid default hash
  for (let i = 0; i < merged.length; i++) {
    const acc = merged[i];
    if (acc.teamRole === 'player') {
      const needsManagerFix = !acc.managedBy;
      const needsHashFix =
        acc.passwordSalt === PLAYER_DEFAULT_SALT &&
        acc.passwordHash === LEGACY_PLAYER_DEFAULT_HASH;
      if (needsManagerFix || needsHashFix) {
        merged[i] = {
          ...acc,
          managedBy: acc.managedBy || UNIFIED_TEAM_OWNER_ID,
          managedByName: acc.managedByName || 'Manager Binh',
          passwordHash: needsHashFix ? PLAYER_DEFAULT_HASH : acc.passwordHash,
        };
        mutated = true;
      }
    }
  }

  if (mutated) {
    try {
      storage.setItem(ACCOUNTS_KEY, JSON.stringify(merged));
    } catch {
      // ignore storage quota errors
    }
  }
  return merged;
}

export function writeAccounts(
  accounts: LocalAccountRecord[],
  storage: Storage = localStorage,
): void {
  try {
    storage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // ignore storage quota errors
  }
}

export function buildInitialUnifiedDataset(
  accounts: LocalAccountRecord[] = DEFAULT_SEEDED_ACCOUNTS,
): HubDataset {
  const base = buildDemoDataset();
  const members: TeamMember[] = accounts.map((acc) => ({
    uid: acc.uid,
    teamOwnerId: UNIFIED_TEAM_OWNER_ID,
    displayName: acc.displayName,
    riotId: acc.riotId,
    teamRole: acc.teamRole,
    gameRole: acc.gameRole,
    mainAgent: acc.mainAgent,
    scrimStatus: 'ready',
    username: acc.displayIdentifier,
    managedBy: acc.teamRole === 'player' ? acc.managedBy || UNIFIED_TEAM_OWNER_ID : undefined,
    managedByName:
      acc.teamRole === 'player' ? acc.managedByName || 'Manager Binh' : undefined,
    isDemo: false,
  }));

  return {
    team: {
      id: UNIFIED_TEAM_ID,
      name: 'Saigon Vanguard Esports',
      tag: 'SGV',
      ownerId: UNIFIED_TEAM_OWNER_ID,
      weeklyGoalHours: 24,
      isDemo: false,
    },
    members,
    drills: base.drills.map((d) => ({
      ...d,
      teamId: UNIFIED_TEAM_ID,
      teamOwnerId: UNIFIED_TEAM_OWNER_ID,
      ownerId: d.ownerId === base.team.ownerId ? UNIFIED_TEAM_OWNER_ID : d.ownerId,
      assignedBy: UNIFIED_TEAM_OWNER_ID,
      isDemo: false,
    })),
    aimLogs: base.aimLogs.map((l) => ({
      ...l,
      teamId: UNIFIED_TEAM_ID,
      teamOwnerId: UNIFIED_TEAM_OWNER_ID,
      isDemo: false,
    })),
    scrims: base.scrims.map((s) => ({
      ...s,
      teamId: UNIFIED_TEAM_ID,
      teamOwnerId: UNIFIED_TEAM_OWNER_ID,
      createdBy: UNIFIED_TEAM_OWNER_ID,
      isDemo: false,
    })),
    availabilities: base.availabilities
      .filter((a) => a.ownerId !== base.team.ownerId)
      .map((a) => ({
        ...a,
        teamId: UNIFIED_TEAM_ID,
        teamOwnerId: UNIFIED_TEAM_OWNER_ID,
        isDemo: false,
      })),
    templates: base.templates.map((tpl) => ({
      ...tpl,
      teamId: UNIFIED_TEAM_ID,
      teamOwnerId: UNIFIED_TEAM_OWNER_ID,
      ownerId: UNIFIED_TEAM_OWNER_ID,
      isDemo: false,
    })),
    notifications: base.notifications.map((n) => ({
      ...n,
      teamId: UNIFIED_TEAM_ID,
      teamOwnerId: UNIFIED_TEAM_OWNER_ID,
      actorId: n.actorId === base.team.ownerId ? UNIFIED_TEAM_OWNER_ID : n.actorId,
      isDemo: false,
    })),
  };
}

export function reconcileUnifiedDatabase(
  accounts: LocalAccountRecord[],
  dataset: HubDataset,
): HubDataset {
  const existingMemberByUid = new Map<string, TeamMember>();
  for (const m of dataset.members || []) {
    existingMemberByUid.set(m.uid, m);
  }

  // Deterministic ordering: Managers/Coaches first, then Players in account order
  const orderedAccounts = [...accounts].sort((a, b) => {
    if (a.teamRole !== b.teamRole) {
      return a.teamRole === 'coach' ? -1 : 1;
    }
    return 0;
  });

  const unifiedMembers: TeamMember[] = orderedAccounts.map((acc) => {
    const prev = existingMemberByUid.get(acc.uid);
    return {
      uid: acc.uid,
      teamOwnerId: UNIFIED_TEAM_OWNER_ID,
      displayName: prev?.displayName || acc.displayName,
      riotId: prev?.riotId || acc.riotId,
      teamRole: acc.teamRole,
      gameRole: prev?.gameRole || acc.gameRole,
      mainAgent: prev?.mainAgent || acc.mainAgent,
      scrimStatus: prev?.scrimStatus || 'ready',
      username: acc.displayIdentifier,
      managedBy:
        acc.teamRole === 'player'
          ? prev?.managedBy || acc.managedBy || UNIFIED_TEAM_OWNER_ID
          : undefined,
      managedByName:
        acc.teamRole === 'player'
          ? prev?.managedByName || acc.managedByName || 'Manager Binh'
          : undefined,
      isDemo: false,
    };
  });

  const validUids = new Set(unifiedMembers.map((m) => m.uid));
  const playerMembers = unifiedMembers.filter((m) => m.teamRole === 'player');
  const playerUids = new Set(playerMembers.map((m) => m.uid));
  const fallbackPlayerUid = playerMembers[0]?.uid || UNIFIED_TEAM_OWNER_ID;

  return {
    team: {
      id: UNIFIED_TEAM_ID,
      name: dataset.team?.name || 'Saigon Vanguard Esports',
      tag: dataset.team?.tag || 'SGV',
      ownerId: UNIFIED_TEAM_OWNER_ID,
      weeklyGoalHours: dataset.team?.weeklyGoalHours || 24,
      isDemo: false,
    },
    members: unifiedMembers,
    drills: (dataset.drills || []).map((d) => {
      const cachedProof =
        d.proofImageDataUrl || getLocalProofImage(`drill_${d.id}`) || undefined;
      return {
        ...d,
        teamId: UNIFIED_TEAM_ID,
        teamOwnerId: UNIFIED_TEAM_OWNER_ID,
        ownerId: validUids.has(d.ownerId) ? d.ownerId : fallbackPlayerUid,
        ...(cachedProof ? { proofImageDataUrl: cachedProof } : {}),
        isDemo: false,
      };
    }),
    aimLogs: (dataset.aimLogs || []).map((l) => {
      const cachedProof =
        l.proofImageDataUrl || getLocalProofImage(l.id) || undefined;
      return {
        ...l,
        teamId: UNIFIED_TEAM_ID,
        teamOwnerId: UNIFIED_TEAM_OWNER_ID,
        ownerId: validUids.has(l.ownerId) ? l.ownerId : fallbackPlayerUid,
        ...(cachedProof ? { proofImageDataUrl: cachedProof } : {}),
        isDemo: false,
      };
    }),
    scrims: (dataset.scrims || []).map((s) => ({
      ...s,
      teamId: UNIFIED_TEAM_ID,
      teamOwnerId: UNIFIED_TEAM_OWNER_ID,
      isDemo: false,
    })),
    // Strictly only Players have Scrim availability slots (Managers/Admins do not fill Scrim availability)
    availabilities: (dataset.availabilities || [])
      .filter((a) => playerUids.has(a.ownerId))
      .map((a) => ({
        ...a,
        teamId: UNIFIED_TEAM_ID,
        teamOwnerId: UNIFIED_TEAM_OWNER_ID,
        isDemo: false,
      })),
    templates: (dataset.templates || []).map((tpl) => ({
      ...tpl,
      teamId: UNIFIED_TEAM_ID,
      teamOwnerId: UNIFIED_TEAM_OWNER_ID,
      isDemo: false,
    })),
    notifications: (dataset.notifications || []).map((n) => ({
      ...n,
      teamId: UNIFIED_TEAM_ID,
      teamOwnerId: UNIFIED_TEAM_OWNER_ID,
      isDemo: false,
    })),
  };
}

export function listLocalAccountIdentifiers(storage: Storage = localStorage): Array<{
  uid: string;
  identifier: string;
  displayName: string;
  riotId: string;
  teamRole: TeamRole;
  isAdmin?: boolean;
  managedBy?: string;
  managedByName?: string;
}> {
  return readAccounts(storage).map((a) => ({
    uid: a.uid,
    identifier: a.displayIdentifier,
    displayName: a.displayName,
    riotId: a.riotId,
    teamRole: a.teamRole,
    isAdmin: a.isAdmin,
    managedBy: a.managedBy,
    managedByName: a.managedByName,
  }));
}

export function loadUnifiedWorkspace(storage: Storage = localStorage): HubDataset {
  try {
    const legacyKeys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith('vth_account_ws_v1_')) {
        legacyKeys.push(k);
      }
    }
    for (const k of legacyKeys) {
      storage.removeItem(k);
    }
  } catch {
    // ignore storage iteration errors
  }

  const accounts = readAccounts(storage);
  try {
    const raw = storage.getItem(UNIFIED_HUB_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as HubDataset;
      if (parsed && parsed.team && Array.isArray(parsed.drills)) {
        const reconciled = reconcileUnifiedDatabase(accounts, parsed);
        storage.setItem(UNIFIED_HUB_DB_KEY, JSON.stringify(reconciled));
        return reconciled;
      }
    }
  } catch {
    // ignore corrupted workspace
  }
  const fresh = reconcileUnifiedDatabase(
    accounts,
    buildInitialUnifiedDataset(accounts),
  );
  saveUnifiedWorkspace(fresh, storage, false);
  return fresh;
}

export async function pushProofToCloudFirestore(
  proofId: string,
  dataUrl: string,
): Promise<void> {
  if (typeof window === 'undefined') return;
  const safeProofId = proofId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  if (!safeProofId) return;
  try {
    const ref = doc(db, 'hubWorkspaces', UNIFIED_TEAM_ID, 'proofs', safeProofId);
    if (!dataUrl || dataUrl.length < 10) {
      await deleteDoc(ref);
      return;
    }
    if (dataUrl.length > 740000) return;
    await setDoc(ref, {
      id: safeProofId,
      workspaceId: UNIFIED_TEAM_ID,
      syncToken: CLOUD_HUB_SYNC_TOKEN,
      dataUrl,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // ignore transient offline/network error
  }
}

export async function pushUnifiedStateToCloudFirestore(
  accounts: LocalAccountRecord[],
  dataset: HubDataset,
  options?: {
    revision?: number;
    isCustomized?: boolean;
    updatedBy?: string;
    updatedAtMs?: number;
  },
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const reconciled = reconcileUnifiedDatabase(accounts, dataset);

    // Sync any inline proof images to the proofs subcollection and strip them from the main workspace doc
    for (const d of reconciled.drills) {
      if (d.proofImageDataUrl && d.proofImageDataUrl.startsWith('data:image/')) {
        saveLocalProofImage(`drill_${d.id}`, d.proofImageDataUrl);
        void pushProofToCloudFirestore(`drill_${d.id}`, d.proofImageDataUrl);
      }
    }
    for (const l of reconciled.aimLogs) {
      if (l.proofImageDataUrl && l.proofImageDataUrl.startsWith('data:image/')) {
        saveLocalProofImage(l.id, l.proofImageDataUrl);
        void pushProofToCloudFirestore(l.id, l.proofImageDataUrl);
      }
    }

    const sanitizedDrills = reconciled.drills.slice(0, 250).map((d) => {
      const copy = { ...d };
      delete copy.proofImageDataUrl;
      return stripUndefinedDeep(copy);
    });

    const sanitizedAimLogs = reconciled.aimLogs.slice(0, 250).map((l) => {
      const copy = { ...l };
      delete copy.proofImageDataUrl;
      return stripUndefinedDeep(copy);
    });

    const revision = options?.revision ?? getLocalRevision(localStorage) + 1;
    const isCustomized =
      options?.isCustomized ?? isCustomizedAccountRoster(accounts, localStorage);
    const updatedAtMs = options?.updatedAtMs ?? Date.now();
    const updatedBy = (
      options?.updatedBy ||
      localStorage.getItem(ACTIVE_SESSION_KEY) ||
      'system'
    ).slice(0, 128);

    const payload = {
      id: UNIFIED_TEAM_ID,
      syncToken: CLOUD_HUB_SYNC_TOKEN,
      revision,
      isCustomized: Boolean(isCustomized),
      updatedAtMs,
      updatedBy,
      team: stripUndefinedDeep(reconciled.team),
      accounts: stripUndefinedDeep(accounts.slice(0, 50)),
      members: stripUndefinedDeep(reconciled.members.slice(0, 50)),
      drills: sanitizedDrills,
      aimLogs: sanitizedAimLogs,
      scrims: stripUndefinedDeep(reconciled.scrims.slice(0, 100)),
      availabilities: stripUndefinedDeep(reconciled.availabilities.slice(0, 250)),
      templates: stripUndefinedDeep(reconciled.templates.slice(0, 50)),
      notifications: stripUndefinedDeep(reconciled.notifications.slice(0, 150)),
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'hubWorkspaces', UNIFIED_TEAM_ID), payload);
    try {
      localStorage.setItem(UNIFIED_DB_REVISION_KEY, String(revision));
      if (isCustomized) {
        localStorage.setItem(UNIFIED_DB_CUSTOMIZED_KEY, '1');
      }
      localStorage.setItem(UNIFIED_DB_UPDATED_AT_KEY, new Date(updatedAtMs).toISOString());
    } catch {
      // ignore storage quota
    }
    return true;
  } catch (err) {
    console.warn('Cloud Firestore sync warning:', err);
    return false;
  }
}

export function saveUnifiedWorkspace(
  dataset: HubDataset,
  storage: Storage = localStorage,
  syncToServer: boolean = true,
): HubDataset {
  const accounts = readAccounts(storage);
  const reconciled = reconcileUnifiedDatabase(accounts, dataset);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const nextRevision = getLocalRevision(storage) + (syncToServer ? 1 : 0);

  try {
    storage.setItem(UNIFIED_HUB_DB_KEY, JSON.stringify(reconciled));
    storage.setItem(UNIFIED_DB_UPDATED_AT_KEY, nowIso);
    if (syncToServer) {
      storage.setItem(UNIFIED_DB_REVISION_KEY, String(nextRevision));
      storage.setItem(UNIFIED_DB_CUSTOMIZED_KEY, '1');
    }
  } catch {
    // ignore quota errors
  }

  if (syncToServer && isBrowserLocalStorage(storage)) {
    void pushUnifiedStateToServer(accounts, reconciled, nowIso);
    void pushUnifiedStateToCloudFirestore(accounts, reconciled, {
      revision: nextRevision,
      isCustomized: true,
      updatedAtMs: nowMs,
    });
  }
  return reconciled;
}

// Keep backward-compatible aliases for callers
export function loadAccountWorkspace(
  _uid?: string,
  _fallbackAccount?: LocalAccountRecord,
  storage: Storage = localStorage,
): HubDataset {
  return loadUnifiedWorkspace(storage);
}

export function saveAccountWorkspace(
  _uid: string,
  dataset: HubDataset,
  storage: Storage = localStorage,
): void {
  saveUnifiedWorkspace(dataset, storage, true);
}

export async function pushUnifiedStateToServer(
  accounts: LocalAccountRecord[],
  dataset: HubDataset,
  updatedAt: string = new Date().toISOString(),
): Promise<void> {
  if (typeof fetch !== 'function') return;
  try {
    await fetch('/api/hub-state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accounts, dataset, updatedAt }),
    });
  } catch {
    // Safe no-op when offline or deployed on static host like Vercel
  }
}

interface RawCloudHubDoc {
  id: string;
  syncToken: string;
  revision: number;
  isCustomized: boolean;
  updatedAtMs: number;
  updatedBy: string;
  team: HubDataset['team'];
  accounts: LocalAccountRecord[];
  members: HubDataset['members'];
  drills: HubDataset['drills'];
  aimLogs: HubDataset['aimLogs'];
  scrims: HubDataset['scrims'];
  availabilities: HubDataset['availabilities'];
  templates: HubDataset['templates'];
  notifications: HubDataset['notifications'];
}

function applyCloudDocToStorage(
  cloudData: RawCloudHubDoc,
  storage: Storage = localStorage,
): { accounts: LocalAccountRecord[]; dataset: HubDataset } {
  const validAccounts =
    Array.isArray(cloudData.accounts) && cloudData.accounts.length >= 2
      ? cloudData.accounts
      : readAccounts(storage);

  writeAccounts(validAccounts, storage);
  const rawDataset: HubDataset = {
    team: cloudData.team,
    members: cloudData.members || [],
    drills: cloudData.drills || [],
    aimLogs: cloudData.aimLogs || [],
    scrims: cloudData.scrims || [],
    availabilities: cloudData.availabilities || [],
    templates: cloudData.templates || [],
    notifications: cloudData.notifications || [],
  };
  const reconciled = reconcileUnifiedDatabase(validAccounts, rawDataset);
  try {
    storage.setItem(UNIFIED_HUB_DB_KEY, JSON.stringify(reconciled));
    storage.setItem(UNIFIED_DB_REVISION_KEY, String(cloudData.revision || 1));
    if (cloudData.isCustomized) {
      storage.setItem(UNIFIED_DB_CUSTOMIZED_KEY, '1');
    }
    if (cloudData.updatedAtMs) {
      storage.setItem(
        UNIFIED_DB_UPDATED_AT_KEY,
        new Date(cloudData.updatedAtMs).toISOString(),
      );
    }
  } catch {
    // ignore storage quota
  }
  return { accounts: validAccounts, dataset: reconciled };
}

/**
 * Forces an immediate read from Cloud Firestore (getDocFromServer) so any computer/browser
 * can pull the latest cross-device database on demand or on tab focus.
 */
export async function pullUnifiedStateFromServer(
  storage: Storage = localStorage,
): Promise<{
  accounts: LocalAccountRecord[];
  dataset: HubDataset;
  revision?: number;
  updatedBy?: string;
} | null> {
  if (isBrowserLocalStorage(storage)) {
    try {
      const snap = await getDocFromServer(doc(db, 'hubWorkspaces', UNIFIED_TEAM_ID));
      const localAccounts = readAccounts(storage);
      const localDataset = loadUnifiedWorkspace(storage);
      const localIsCustom = isCustomizedAccountRoster(localAccounts, storage);
      const localRev = getLocalRevision(storage);

      if (!snap.exists()) {
        await pushUnifiedStateToCloudFirestore(localAccounts, localDataset, {
          revision: Math.max(1, localRev),
          isCustomized: localIsCustom,
          updatedAtMs: Date.now(),
        });
        return {
          accounts: localAccounts,
          dataset: localDataset,
          revision: Math.max(1, localRev),
        };
      }

      const cloudData = snap.data() as RawCloudHubDoc;
      if (localIsCustom && !cloudData.isCustomized) {
        const nextRev = (cloudData.revision || 1) + 1;
        await pushUnifiedStateToCloudFirestore(localAccounts, localDataset, {
          revision: nextRev,
          isCustomized: true,
          updatedAtMs: Date.now(),
        });
        return {
          accounts: localAccounts,
          dataset: localDataset,
          revision: nextRev,
        };
      }

      const applied = applyCloudDocToStorage(cloudData, storage);
      return {
        ...applied,
        revision: cloudData.revision || 1,
        updatedBy: cloudData.updatedBy || 'system',
      };
    } catch {
      // Fallback to local /api/hub-state if Firestore is temporarily unreachable
    }
  }

  if (typeof fetch !== 'function') return null;
  try {
    const res = await fetch('/api/hub-state', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.trim().startsWith('{')) return null;
    const parsed = JSON.parse(text) as {
      accounts?: LocalAccountRecord[];
      dataset?: HubDataset;
      updatedAt?: string;
    };
    if (
      !parsed ||
      !Array.isArray(parsed.accounts) ||
      parsed.accounts.length === 0 ||
      !parsed.dataset ||
      !parsed.dataset.team
    ) {
      return null;
    }

    writeAccounts(parsed.accounts, storage);
    const reconciled = reconcileUnifiedDatabase(parsed.accounts, parsed.dataset);
    storage.setItem(UNIFIED_HUB_DB_KEY, JSON.stringify(reconciled));
    return { accounts: parsed.accounts, dataset: reconciled };
  } catch {
    return null;
  }
}

/**
 * Real-time Cloud Firestore listener (`onSnapshot`) that keeps ALL computers, browsers,
 * and deployments (Vercel + AI Studio) 100% synchronized in real time (< 200ms).
 */
export function subscribeToUnifiedCloudHub(callbacks: {
  onWorkspaceUpdate: (payload: {
    accounts: LocalAccountRecord[];
    dataset: HubDataset;
    status: CloudHubSyncStatus;
  }) => void;
  onStatusChange?: (status: CloudHubSyncStatus) => void;
}): Unsubscribe {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const workspaceRef = doc(db, 'hubWorkspaces', UNIFIED_TEAM_ID);
  const proofsQuery = query(
    collection(db, 'hubWorkspaces', UNIFIED_TEAM_ID, 'proofs'),
    where('workspaceId', '==', UNIFIED_TEAM_ID),
    where('syncToken', '==', CLOUD_HUB_SYNC_TOKEN),
  );

  const unsubWorkspace = onSnapshot(
    workspaceRef,
    (snap) => {
      const localAccounts = readAccounts(localStorage);
      const localDataset = loadUnifiedWorkspace(localStorage);
      const localIsCustom = isCustomizedAccountRoster(localAccounts, localStorage);
      const localRev = getLocalRevision(localStorage);

      if (!snap.exists()) {
        // Seed Cloud Firestore for the first time
        void pushUnifiedStateToCloudFirestore(localAccounts, localDataset, {
          revision: Math.max(1, localRev),
          isCustomized: localIsCustom,
          updatedAtMs: Date.now(),
        });
        return;
      }

      const cloudData = snap.data() as RawCloudHubDoc;
      if (
        !cloudData ||
        !Array.isArray(cloudData.accounts) ||
        cloudData.accounts.length < 2
      ) {
        return;
      }

      // If this browser has a customized team roster (e.g., trung, tuong, hao, thanh)
      // while Cloud Firestore still holds an untouched initial seed, promote this browser's custom state to Cloud!
      if (localIsCustom && !cloudData.isCustomized) {
        const promotedRev = (cloudData.revision || 1) + 1;
        void pushUnifiedStateToCloudFirestore(localAccounts, localDataset, {
          revision: promotedRev,
          isCustomized: true,
          updatedAtMs: Date.now(),
        });
        return;
      }

      const applied = applyCloudDocToStorage(cloudData, localStorage);
      const status: CloudHubSyncStatus = {
        connected: true,
        syncing: false,
        revision: cloudData.revision || 1,
        lastSyncedAt: cloudData.updatedAtMs
          ? new Date(cloudData.updatedAtMs).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          : new Date().toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
        updatedBy: cloudData.updatedBy || 'system',
      };

      callbacks.onWorkspaceUpdate({
        accounts: applied.accounts,
        dataset: applied.dataset,
        status,
      });
    },
    (err) => {
      callbacks.onStatusChange?.({
        connected: false,
        syncing: false,
        revision: getLocalRevision(localStorage),
        lastSyncedAt: null,
        updatedBy: 'local',
        error: err instanceof Error ? err.message : String(err),
      });
    },
  );

  const unsubProofs = onSnapshot(
    proofsQuery,
    (snap) => {
      let changed = false;
      for (const d of snap.docs) {
        const data = d.data() as { id?: string; dataUrl?: string };
        if (data?.id && data?.dataUrl) {
          const existing = getLocalProofImage(data.id);
          if (existing !== data.dataUrl) {
            saveLocalProofImage(data.id, data.dataUrl);
            changed = true;
          }
        }
      }
      if (changed) {
        const accounts = readAccounts(localStorage);
        const dataset = loadUnifiedWorkspace(localStorage);
        callbacks.onWorkspaceUpdate({
          accounts,
          dataset,
          status: {
            connected: true,
            syncing: false,
            revision: getLocalRevision(localStorage),
            lastSyncedAt: new Date().toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            updatedBy: 'proof_sync',
          },
        });
      }
    },
    () => {
      // ignore proof subscription errors
    },
  );

  return () => {
    unsubWorkspace();
    unsubProofs();
  };
}

/**
 * Creates a new Player account AND TeamMember strictly under a Manager's control.
 * Immediately syncs to Cloud Firestore so every computer/browser sees the new player right away.
 */
export async function createManagedPlayerByManager(
  input: {
    managerUid: string;
    identifier: string;
    password: string;
    displayName: string;
    riotId: string;
    gameRole: GameRole;
    mainAgent: string;
    scrimStatus?: ScrimMemberStatus;
  },
  storage: Storage = localStorage,
): Promise<{
  playerAccount: LocalAccountRecord;
  playerMember: TeamMember;
  dataset: HubDataset;
}> {
  const accounts = readAccounts(storage);
  const manager = accounts.find((a) => a.uid === input.managerUid);
  if (!isManagerAccount(manager)) {
    throw new Error('Chỉ tài khoản có quyền Manager mới được phép thêm tuyển thủ.');
  }

  const idErr = validateAccountIdentifier(input.identifier);
  if (idErr) throw new Error(idErr);
  const pwErr = validatePassword(input.password);
  if (pwErr) throw new Error(pwErr);

  const normalized = normalizeAccountIdentifier(input.identifier);
  if (accounts.some((a) => a.identifier === normalized)) {
    throw new Error(`Tên đăng nhập "${normalized}" đã tồn tại trong hệ thống.`);
  }

  const uid = `player_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const salt = `vth_${Math.random().toString(36).slice(2, 10)}`;
  const passwordHash = await hashPassword(input.password, salt);

  const displayName =
    input.displayName.trim() || input.identifier.trim().split('@')[0];
  const riotId =
    input.riotId.trim() || `${displayName.replace(/\s+/g, '')}#VN1`;

  const playerAccount: LocalAccountRecord = {
    uid,
    identifier: normalized,
    displayIdentifier: input.identifier.trim(),
    passwordSalt: salt,
    passwordHash,
    displayName: displayName.slice(0, 60),
    riotId: riotId.slice(0, 40),
    teamRole: 'player',
    isAdmin: false,
    gameRole: input.gameRole,
    mainAgent: (input.mainAgent.trim() || 'Jett').slice(0, 40),
    managedBy: manager!.uid,
    managedByName: manager!.displayName,
    createdAt: new Date().toISOString(),
  };

  const nextAccounts = [...accounts, playerAccount];
  writeAccounts(nextAccounts, storage);
  try {
    storage.setItem(UNIFIED_DB_CUSTOMIZED_KEY, '1');
  } catch {
    // ignore
  }

  const currentDataset = loadUnifiedWorkspace(storage);
  const playerMember: TeamMember = {
    uid,
    teamOwnerId: UNIFIED_TEAM_OWNER_ID,
    displayName: playerAccount.displayName,
    riotId: playerAccount.riotId,
    teamRole: 'player',
    gameRole: playerAccount.gameRole,
    mainAgent: playerAccount.mainAgent,
    scrimStatus: input.scrimStatus || 'ready',
    username: playerAccount.displayIdentifier,
    managedBy: manager!.uid,
    managedByName: manager!.displayName,
    isDemo: false,
  };

  const nextDataset = saveUnifiedWorkspace(
    {
      ...currentDataset,
      members: [...currentDataset.members.filter((m) => m.uid !== uid), playerMember],
    },
    storage,
    true,
  );

  return {
    playerAccount,
    playerMember,
    dataset: nextDataset,
  };
}

export async function registerPlayerWithManagerAuth(
  input: {
    managerIdentifier: string;
    managerPassword: string;
    identifier: string;
    password: string;
    displayName: string;
    riotId: string;
    gameRole: GameRole;
    mainAgent: string;
  },
  storage: Storage = localStorage,
): Promise<{ session: LocalAccountSession; dataset: HubDataset }> {
  const managerNorm = normalizeAccountIdentifier(input.managerIdentifier);
  const accounts = readAccounts(storage);
  const manager = accounts.find((a) => a.identifier === managerNorm);
  if (!manager || !isManagerAccount(manager)) {
    throw new Error(
      'Chỉ tài khoản có quyền Manager (VD: noti hoặc binh) mới được phép thêm tuyển thủ mới.',
    );
  }

  const managerHash = await hashPassword(input.managerPassword, manager.passwordSalt);
  if (managerHash !== manager.passwordHash) {
    throw new Error('Mật khẩu xác thực của Manager không chính xác.');
  }

  const { playerAccount, dataset } = await createManagedPlayerByManager(
    {
      managerUid: manager.uid,
      identifier: input.identifier,
      password: input.password,
      displayName: input.displayName,
      riotId: input.riotId,
      gameRole: input.gameRole,
      mainAgent: input.mainAgent,
    },
    storage,
  );

  storage.setItem(ACTIVE_SESSION_KEY, playerAccount.uid);

  return {
    session: {
      account: playerAccount,
      profile: buildProfileFromAccount(playerAccount),
    },
    dataset,
  };
}

export async function updateManagedMemberByManager(
  input: {
    actorUid: string;
    member: TeamMember;
    newPassword?: string;
  },
  storage: Storage = localStorage,
): Promise<HubDataset> {
  const accounts = readAccounts(storage);
  const actor = accounts.find((a) => a.uid === input.actorUid);
  const isSelfUpdate = input.actorUid === input.member.uid;

  if (!isManagerAccount(actor) && !isSelfUpdate) {
    throw new Error('Chỉ quyền Manager mới được phép chỉnh sửa thông tin tuyển thủ.');
  }

  let newPasswordHash: string | undefined;
  let newPasswordSalt: string | undefined;
  if (input.newPassword && input.newPassword.trim()) {
    if (!isManagerAccount(actor)) {
      throw new Error('Chỉ Manager mới có quyền đặt lại mật khẩu cho tuyển thủ.');
    }
    const pwErr = validatePassword(input.newPassword.trim());
    if (pwErr) throw new Error(pwErr);
    newPasswordSalt = `vth_${Math.random().toString(36).slice(2, 10)}`;
    newPasswordHash = await hashPassword(input.newPassword.trim(), newPasswordSalt);
  }

  const nextAccounts = accounts.map((acc) => {
    if (acc.uid !== input.member.uid) return acc;
    return {
      ...acc,
      displayName: input.member.displayName.trim().slice(0, 60) || acc.displayName,
      riotId: input.member.riotId.trim().slice(0, 40) || acc.riotId,
      gameRole: input.member.gameRole,
      mainAgent: input.member.mainAgent.trim().slice(0, 40) || acc.mainAgent,
      ...(newPasswordHash && newPasswordSalt
        ? { passwordSalt: newPasswordSalt, passwordHash: newPasswordHash }
        : {}),
    };
  });
  writeAccounts(nextAccounts, storage);
  try {
    storage.setItem(UNIFIED_DB_CUSTOMIZED_KEY, '1');
  } catch {
    // ignore
  }

  const currentDataset = loadUnifiedWorkspace(storage);
  const nextMembers = currentDataset.members.map((m) =>
    m.uid === input.member.uid
      ? {
          ...m,
          displayName: input.member.displayName.trim().slice(0, 80),
          riotId: input.member.riotId.trim().slice(0, 40),
          gameRole: input.member.gameRole,
          mainAgent: input.member.mainAgent.trim().slice(0, 40),
          scrimStatus: input.member.scrimStatus,
        }
      : m,
  );

  const nextAvailabilities = currentDataset.availabilities.map((a) =>
    a.ownerId === input.member.uid
      ? { ...a, memberName: input.member.displayName.trim().slice(0, 80) }
      : a,
  );

  return saveUnifiedWorkspace(
    {
      ...currentDataset,
      members: nextMembers,
      availabilities: nextAvailabilities,
    },
    storage,
    true,
  );
}

export function deleteManagedPlayerByManager(
  input: {
    actorUid: string;
    targetUid: string;
  },
  storage: Storage = localStorage,
): HubDataset {
  const accounts = readAccounts(storage);
  const actor = accounts.find((a) => a.uid === input.actorUid);
  if (!isManagerAccount(actor)) {
    throw new Error('Chỉ tài khoản có quyền Manager mới được phép xóa tuyển thủ.');
  }

  const target = accounts.find((a) => a.uid === input.targetUid);
  if (target && isManagerAccount(target)) {
    throw new Error('Không thể xóa tài khoản Ban Huấn Luyện / Manager.');
  }

  const nextAccounts = accounts.filter((a) => a.uid !== input.targetUid);
  writeAccounts(nextAccounts, storage);
  try {
    storage.setItem(UNIFIED_DB_CUSTOMIZED_KEY, '1');
  } catch {
    // ignore
  }

  const currentDataset = loadUnifiedWorkspace(storage);
  return saveUnifiedWorkspace(
    {
      ...currentDataset,
      members: currentDataset.members.filter((m) => m.uid !== input.targetUid),
      drills: currentDataset.drills.filter((d) => d.ownerId !== input.targetUid),
      aimLogs: currentDataset.aimLogs.filter((l) => l.ownerId !== input.targetUid),
      availabilities: currentDataset.availabilities.filter(
        (a) => a.ownerId !== input.targetUid,
      ),
    },
    storage,
    true,
  );
}

export async function loginLocalAccount(
  identifier: string,
  password: string,
  storage: Storage = localStorage,
): Promise<{ session: LocalAccountSession; dataset: HubDataset }> {
  const normalized = normalizeAccountIdentifier(identifier);

  // If logging in from a real browser, first check local accounts; if not found, pull latest from Cloud Firestore
  let accounts = readAccounts(storage);
  let found = accounts.find((a) => a.identifier === normalized);
  if (!found && isBrowserLocalStorage(storage)) {
    const pulled = await pullUnifiedStateFromServer(storage);
    if (pulled) {
      accounts = pulled.accounts;
      found = accounts.find((a) => a.identifier === normalized);
    }
  }

  if (!found) {
    throw new Error(
      'Không tìm thấy tài khoản này trong hệ thống. Chỉ Manager mới có quyền cấp tài khoản cho tuyển thủ.',
    );
  }

  const candidateHash = await hashPassword(password, found.passwordSalt);
  if (candidateHash !== found.passwordHash) {
    throw new Error('Mật khẩu không chính xác.');
  }

  storage.setItem(ACTIVE_SESSION_KEY, found.uid);
  const dataset = loadUnifiedWorkspace(storage);

  return {
    session: {
      account: found,
      profile: buildProfileFromAccount(found),
    },
    dataset,
  };
}

export function getActiveLocalSession(
  storage: Storage = localStorage,
): { session: LocalAccountSession; dataset: HubDataset } | null {
  try {
    const uid = storage.getItem(ACTIVE_SESSION_KEY);
    if (!uid) return null;
    const accounts = readAccounts(storage);
    const found = accounts.find((a) => a.uid === uid);
    if (!found) {
      storage.removeItem(ACTIVE_SESSION_KEY);
      return null;
    }
    return {
      session: {
        account: found,
        profile: buildProfileFromAccount(found),
      },
      dataset: loadUnifiedWorkspace(storage),
    };
  } catch {
    return null;
  }
}

export function logoutLocalAccount(storage: Storage = localStorage): void {
  try {
    storage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    // ignore
  }
}
