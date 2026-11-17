import { buildDemoDataset, type HubDataset } from '../data/demoSeed.ts';
import type { GameRole, TeamRole, UserProfile } from '../types/training.ts';

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
  createdAt: string;
}

export interface LocalAccountSession {
  account: LocalAccountRecord;
  profile: UserProfile;
}

const ACCOUNTS_KEY = 'vth_local_accounts_v1';
const ACTIVE_SESSION_KEY = 'vth_active_local_session_v1';
const WORKSPACE_PREFIX = 'vth_account_ws_v1_';

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
  // Fallback FNV-1a mix for restricted environments without subtle crypto
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv_${(h >>> 0).toString(16)}`;
}

export function buildProfileFromAccount(account: LocalAccountRecord): UserProfile {
  return {
    uid: account.uid,
    email: account.identifier.includes('@')
      ? account.identifier
      : `${account.identifier}@local.vth`,
    displayName: account.displayName,
    riotId: account.riotId,
    gameRole: account.gameRole,
    mainAgent: account.mainAgent,
    activeTeamId: `team_${account.uid}`,
  };
}

export function buildInitialAccountWorkspace(account: LocalAccountRecord): HubDataset {
  const base = buildDemoDataset();
  const teamId = `team_${account.uid}`;
  return {
    team: {
      id: teamId,
      name: `${account.displayName} Hub`,
      tag: account.riotId.split('#')[1]?.slice(0, 6).toUpperCase() || 'VTH',
      ownerId: account.uid,
      weeklyGoalHours: 20,
      isDemo: false,
    },
    members: [
      {
        uid: account.uid,
        teamOwnerId: account.uid,
        displayName: account.displayName,
        riotId: account.riotId,
        teamRole: account.teamRole,
        gameRole: account.gameRole,
        mainAgent: account.mainAgent,
        scrimStatus: 'ready',
        isDemo: false,
      },
    ],
    drills: [],
    aimLogs: [],
    scrims: [],
    availabilities: [],
    templates: base.templates.map((tpl) => ({
      ...tpl,
      teamId,
      teamOwnerId: account.uid,
      ownerId: account.uid,
      isDemo: false,
    })),
    notifications: [
      {
        id: `notif_welcome_${account.uid}`,
        teamId,
        teamOwnerId: account.uid,
        actorId: account.uid,
        type: 'drill_assigned',
        title: 'Chào mừng tới Valorant Training Hub',
        message: `Tài khoản ${account.riotId} đã sẵn sàng. Hệ thống sẽ tự động gợi ý bài tập Tracking & Flick mỗi ngày trong Daily Training.`,
        read: false,
        isDemo: false,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

const DEFAULT_SEEDED_ACCOUNTS: LocalAccountRecord[] = [
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
];

function readAccounts(storage: Storage = localStorage): LocalAccountRecord[] {
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
  for (const seed of DEFAULT_SEEDED_ACCOUNTS) {
    if (!merged.some((a) => a.identifier === seed.identifier || a.uid === seed.uid)) {
      merged.push(seed);
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

function writeAccounts(accounts: LocalAccountRecord[], storage: Storage = localStorage): void {
  storage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function listLocalAccountIdentifiers(storage: Storage = localStorage): Array<{
  uid: string;
  identifier: string;
  displayName: string;
  riotId: string;
  teamRole: TeamRole;
  isAdmin?: boolean;
}> {
  return readAccounts(storage).map((a) => ({
    uid: a.uid,
    identifier: a.displayIdentifier,
    displayName: a.displayName,
    riotId: a.riotId,
    teamRole: a.teamRole,
    isAdmin: a.isAdmin,
  }));
}

export function loadAccountWorkspace(
  uid: string,
  fallbackAccount?: LocalAccountRecord,
  storage: Storage = localStorage,
): HubDataset {
  try {
    const raw = storage.getItem(`${WORKSPACE_PREFIX}${uid}`);
    if (raw) {
      const parsed = JSON.parse(raw) as HubDataset;
      if (parsed && parsed.team && Array.isArray(parsed.drills)) {
        return parsed;
      }
    }
  } catch {
    // ignore corrupted workspace
  }
  const account =
    fallbackAccount || readAccounts(storage).find((a) => a.uid === uid);
  const fresh = account
    ? buildInitialAccountWorkspace(account)
    : buildDemoDataset();
  saveAccountWorkspace(uid, fresh, storage);
  return fresh;
}

export function saveAccountWorkspace(
  uid: string,
  dataset: HubDataset,
  storage: Storage = localStorage,
): void {
  try {
    storage.setItem(`${WORKSPACE_PREFIX}${uid}`, JSON.stringify(dataset));
  } catch {
    // ignore quota errors
  }
}

export async function registerLocalAccount(
  input: {
    identifier: string;
    password: string;
    displayName: string;
    riotId: string;
    teamRole: TeamRole;
    gameRole: GameRole;
    mainAgent: string;
  },
  storage: Storage = localStorage,
): Promise<{ session: LocalAccountSession; dataset: HubDataset }> {
  const idErr = validateAccountIdentifier(input.identifier);
  if (idErr) throw new Error(idErr);
  const pwErr = validatePassword(input.password);
  if (pwErr) throw new Error(pwErr);

  const normalized = normalizeAccountIdentifier(input.identifier);
  const accounts = readAccounts(storage);
  if (accounts.some((a) => a.identifier === normalized)) {
    throw new Error('Tên đăng nhập hoặc email này đã tồn tại.');
  }

  const uid = `acct_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const salt = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const passwordHash = await hashPassword(input.password, salt);

  const displayName = input.displayName.trim() || input.identifier.trim().split('@')[0];
  const riotId = input.riotId.trim() || `${displayName.replace(/\s+/g, '')}#VN1`;

  const account: LocalAccountRecord = {
    uid,
    identifier: normalized,
    displayIdentifier: input.identifier.trim(),
    passwordSalt: salt,
    passwordHash,
    displayName: displayName.slice(0, 60),
    riotId: riotId.slice(0, 40),
    teamRole: input.teamRole,
    gameRole: input.gameRole,
    mainAgent: input.mainAgent.trim() || 'Jett',
    createdAt: new Date().toISOString(),
  };

  writeAccounts([...accounts, account], storage);
  const dataset = buildInitialAccountWorkspace(account);
  saveAccountWorkspace(uid, dataset, storage);
  storage.setItem(ACTIVE_SESSION_KEY, uid);

  return {
    session: {
      account,
      profile: buildProfileFromAccount(account),
    },
    dataset,
  };
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
    throw new Error('Không tìm thấy tài khoản này. Vui lòng kiểm tra lại hoặc tạo tài khoản mới.');
  }

  const candidateHash = await hashPassword(password, found.passwordSalt);
  if (candidateHash !== found.passwordHash) {
    throw new Error('Mật khẩu không chính xác.');
  }

  storage.setItem(ACTIVE_SESSION_KEY, found.uid);
  const dataset = loadAccountWorkspace(found.uid, found, storage);

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
    const found = readAccounts(storage).find((a) => a.uid === uid);
    if (!found) {
      storage.removeItem(ACTIVE_SESSION_KEY);
      return null;
    }
    return {
      session: {
        account: found,
        profile: buildProfileFromAccount(found),
      },
      dataset: loadAccountWorkspace(found.uid, found, storage),
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
