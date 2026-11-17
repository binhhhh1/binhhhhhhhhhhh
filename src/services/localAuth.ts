import { buildDemoDataset, type HubDataset } from '../data/demoSeed.ts';
import type {
  GameRole,
  ScrimMemberStatus,
  TeamMember,
  TeamRole,
  UserProfile,
} from '../types/training.ts';

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

export const UNIFIED_TEAM_ID = 'team_valorant_training_hub';
export const UNIFIED_TEAM_OWNER_ID = 'acct_manager_binh';
export const ACCOUNTS_KEY = 'vth_local_accounts_v2';
export const ACTIVE_SESSION_KEY = 'vth_active_local_session_v1';
export const UNIFIED_HUB_DB_KEY = 'vth_unified_hub_database_v2';
export const UNIFIED_DB_UPDATED_AT_KEY = 'vth_unified_hub_updated_at_v2';

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
// player default: salt 'vth_salt_player_v1', pass '123456' -> d8be31eb99817ef228d57063efbc05b787b88766ad1b9f4e2fb6377f3915d858
const PLAYER_DEFAULT_SALT = 'vth_salt_player_v1';
const PLAYER_DEFAULT_HASH =
  'd8be31eb99817ef228d57063efbc05b787b88766ad1b9f4e2fb6377f3915d858';

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

  // Ensure every player account has a valid manager reference
  for (let i = 0; i < merged.length; i++) {
    const acc = merged[i];
    if (acc.teamRole === 'player' && !acc.managedBy) {
      merged[i] = {
        ...acc,
        managedBy: UNIFIED_TEAM_OWNER_ID,
        managedByName: 'Manager Binh',
      };
      mutated = true;
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

/**
 * Reconciles `accounts` and `dataset` so that:
 * 1. All records share the unified `UNIFIED_TEAM_ID` and `UNIFIED_TEAM_OWNER_ID`.
 * 2. Every account in `accounts` is present in `dataset.members` with consistent role, username, and manager control metadata.
 * 3. No orphan/ghost coach from legacy demo seed remains.
 */
export function reconcileUnifiedDatabase(
  accounts: LocalAccountRecord[],
  dataset: HubDataset,
): HubDataset {
  const existingMemberByUid = new Map<string, TeamMember>();
  for (const m of dataset.members || []) {
    existingMemberByUid.set(m.uid, m);
  }

  const unifiedMembers: TeamMember[] = accounts.map((acc) => {
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
    drills: (dataset.drills || []).map((d) => ({
      ...d,
      teamId: UNIFIED_TEAM_ID,
      teamOwnerId: UNIFIED_TEAM_OWNER_ID,
      ownerId: validUids.has(d.ownerId) ? d.ownerId : 'demo_player_kyro',
      isDemo: false,
    })),
    aimLogs: (dataset.aimLogs || []).map((l) => ({
      ...l,
      teamId: UNIFIED_TEAM_ID,
      teamOwnerId: UNIFIED_TEAM_OWNER_ID,
      ownerId: validUids.has(l.ownerId) ? l.ownerId : 'demo_player_kyro',
      isDemo: false,
    })),
    scrims: (dataset.scrims || []).map((s) => ({
      ...s,
      teamId: UNIFIED_TEAM_ID,
      teamOwnerId: UNIFIED_TEAM_OWNER_ID,
      isDemo: false,
    })),
    availabilities: (dataset.availabilities || [])
      .filter((a) => validUids.has(a.ownerId))
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

export function saveUnifiedWorkspace(
  dataset: HubDataset,
  storage: Storage = localStorage,
  syncToServer: boolean = true,
): HubDataset {
  const accounts = readAccounts(storage);
  const reconciled = reconcileUnifiedDatabase(accounts, dataset);
  const nowIso = new Date().toISOString();
  try {
    storage.setItem(UNIFIED_HUB_DB_KEY, JSON.stringify(reconciled));
    storage.setItem(UNIFIED_DB_UPDATED_AT_KEY, nowIso);
  } catch {
    // ignore quota errors
  }
  if (syncToServer && typeof window !== 'undefined') {
    void pushUnifiedStateToServer(accounts, reconciled, nowIso);
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
    // Safe no-op when offline or deployed on static host without /api/hub-state
  }
}

export async function pullUnifiedStateFromServer(
  storage: Storage = localStorage,
): Promise<{ accounts: LocalAccountRecord[]; dataset: HubDataset } | null> {
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

    const localUpdatedAt = storage.getItem(UNIFIED_DB_UPDATED_AT_KEY) || '';
    if (localUpdatedAt && parsed.updatedAt && localUpdatedAt > parsed.updatedAt) {
      // Local is newer; push local state to server
      const localAccounts = readAccounts(storage);
      const localDataset = loadUnifiedWorkspace(storage);
      await pushUnifiedStateToServer(localAccounts, localDataset, localUpdatedAt);
      return { accounts: localAccounts, dataset: localDataset };
    }

    writeAccounts(parsed.accounts, storage);
    const reconciled = reconcileUnifiedDatabase(parsed.accounts, parsed.dataset);
    storage.setItem(UNIFIED_HUB_DB_KEY, JSON.stringify(reconciled));
    if (parsed.updatedAt) {
      storage.setItem(UNIFIED_DB_UPDATED_AT_KEY, parsed.updatedAt);
    }
    return { accounts: parsed.accounts, dataset: reconciled };
  } catch {
    return null;
  }
}

/**
 * Creates a new Player account AND TeamMember strictly under a Manager's control.
 * Only accounts with `teamRole === 'coach'` or `isAdmin === true` may invoke this.
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

/**
 * Allows adding a Player from the Login/Auth screen ONLY when valid Manager credentials (`noti` or `binh`) are supplied.
 */
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

/**
 * Updates a Player's profile, role, agent, scrim status, or password under Manager control,
 * keeping `accounts` and `dataset` 100% unified.
 */
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

/**
 * Deletes a Player from both `accounts` and the unified `dataset` (Manager only).
 */
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
  const accounts = readAccounts(storage);
  const found = accounts.find((a) => a.identifier === normalized);
  if (!found) {
    throw new Error(
      'Không tìm thấy tài khoản này. Chỉ Manager mới có quyền cấp tài khoản cho tuyển thủ.',
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
