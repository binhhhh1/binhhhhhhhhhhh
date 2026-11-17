import test from 'node:test';
import assert from 'node:assert/strict';
import type { AimLog } from '../types/training';
import {
  listLocalAccountIdentifiers,
  loginLocalAccount,
} from '../services/localAuth';
import {
  computeAimProofSummary,
  getLocalProofImage,
  hasAimProof,
  inferProofType,
  removeLocalProofImage,
  saveLocalProofImage,
  validateProofUrl,
} from './aimProof';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) ?? null) : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

test('validateProofUrl accepts empty or http/https URLs and rejects unsafe schemes', () => {
  assert.deepEqual(validateProofUrl('  '), { valid: true, normalized: '' });

  const normalized = validateProofUrl('medal.tv/games/valorant/clips/123');
  assert.equal(normalized.valid, true);
  assert.equal(normalized.normalized, 'https://medal.tv/games/valorant/clips/123');

  const unsafe = validateProofUrl('javascript:alert(1)');
  assert.equal(unsafe.valid, false);
  assert.ok(unsafe.error);

  const tooLong = validateProofUrl(`https://example.com/${'a'.repeat(500)}`);
  assert.equal(tooLong.valid, false);
});

test('inferProofType detects screenshot, video, or generic link', () => {
  assert.equal(inferProofType('', true), 'screenshot');
  assert.equal(inferProofType('https://youtu.be/abc123', false), 'video');
  assert.equal(inferProofType('https://medal.tv/clips/xyz', false), 'video');
  assert.equal(inferProofType('https://cdn.example.com/score.png', false), 'screenshot');
  assert.equal(inferProofType('https://aimlabs.com/profile', false), 'link');
  assert.equal(inferProofType('', false), undefined);
});

test('hasAimProof and computeAimProofSummary compute proof stats accurately', () => {
  const base: Omit<AimLog, 'id'> = {
    teamId: 't1',
    teamOwnerId: 'u1',
    ownerId: 'u1',
    date: '2026-11-18',
    exerciseName: 'VT Sixshot',
    platform: 'Aimlabs',
    focusArea: 'Precision',
    durationMin: 25,
    score: 95000,
    accuracy: 93,
  };

  const logs: AimLog[] = [
    { ...base, id: 'a1', proofUrl: 'https://aimlabs.com/run/1', proofVerified: true },
    { ...base, id: 'a2', proofImageDataUrl: 'data:image/jpeg;base64,abc', proofVerified: false },
    { ...base, id: 'a3' },
    { ...base, id: 'a4', proofVerified: true }, // no actual proof attached -> shouldn't count
  ];

  assert.equal(hasAimProof(logs[0]), true);
  assert.equal(hasAimProof(logs[1]), true);
  assert.equal(hasAimProof(logs[2]), false);

  const summary = computeAimProofSummary(logs);
  assert.deepEqual(summary, {
    totalSessions: 4,
    withProofCount: 2,
    missingProofCount: 2,
    verifiedCount: 1,
    proofCoveragePct: 50,
  });
});

test('local proof image cache saves, reads, and removes thumbnails cleanly', () => {
  const storage = createMemoryStorage();
  saveLocalProofImage('aim_99', 'data:image/jpeg;base64,xyz', storage);
  assert.equal(getLocalProofImage('aim_99', storage), 'data:image/jpeg;base64,xyz');
  removeLocalProofImage('aim_99', storage);
  assert.equal(getLocalProofImage('aim_99', storage), '');
});

test('seeded accounts noti (admin/manager) and binh (manager) log in with configured passwords', async () => {
  const storage = createMemoryStorage();
  const list = listLocalAccountIdentifiers(storage);
  const notiMeta = list.find((a) => a.identifier === 'noti');
  const binhMeta = list.find((a) => a.identifier === 'binh');

  assert.ok(notiMeta);
  assert.equal(notiMeta.teamRole, 'coach');
  assert.equal(notiMeta.isAdmin, true);

  assert.ok(binhMeta);
  assert.equal(binhMeta.teamRole, 'coach');
  assert.equal(binhMeta.isAdmin, false);

  const notiSession = await loginLocalAccount('noti', '12345678', storage);
  assert.equal(notiSession.session.account.isAdmin, true);
  assert.equal(notiSession.session.account.teamRole, 'coach');

  const binhSession = await loginLocalAccount('binh', '123456789', storage);
  assert.equal(binhSession.session.account.isAdmin, false);
  assert.equal(binhSession.session.account.teamRole, 'coach');

  await assert.rejects(() => loginLocalAccount('noti', 'wrongpass', storage));
  await assert.rejects(() => loginLocalAccount('binh', '12345678', storage));
});
