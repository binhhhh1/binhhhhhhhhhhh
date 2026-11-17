import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAimAnalytics,
  computeDashboardMetrics,
  computePerformanceReport,
  computeTeamAvailabilityOverlap,
  detectScrimConflicts,
  generatePerformanceCsv,
} from './analytics';
import type { AimLog, AvailabilitySlot, Scrim, TeamMember, TrainingDrill } from '../types/training';

const baseDrill = (overrides: Partial<TrainingDrill>): TrainingDrill => ({
  id: 'd1',
  teamId: 't1',
  teamOwnerId: 'u1',
  ownerId: 'u1',
  assignedBy: 'u1',
  title: 'Gridshot Warmup',
  category: 'Aim Training',
  date: '2026-11-17',
  startTime: '14:00',
  durationMin: 60,
  status: 'completed',
  ...overrides,
});

const baseScrim = (overrides: Partial<Scrim>): Scrim => ({
  id: 's1',
  teamId: 't1',
  teamOwnerId: 'u1',
  createdBy: 'u1',
  opponent: 'Paper Rex Academy',
  date: '2026-11-17',
  startTime: '19:00',
  endTime: '21:00',
  mapCount: 2,
  maps: ['Ascent', 'Lotus'],
  server: 'Singapore',
  status: 'confirmed',
  ...overrides,
});

const baseAim = (overrides: Partial<AimLog>): AimLog => ({
  id: 'a1',
  teamId: 't1',
  teamOwnerId: 'u1',
  ownerId: 'u1',
  date: '2026-11-17',
  exerciseName: 'Sixshot Ultimate',
  platform: 'Aimlabs',
  focusArea: 'Precision',
  durationMin: 30,
  score: 92000,
  accuracy: 91.5,
  ...overrides,
});

test('computeDashboardMetrics calculates today hours, streak, remaining free time, and weekly goal', () => {
  const drills: TrainingDrill[] = [
    baseDrill({ id: 'd1', date: '2026-11-17', startTime: '10:00', durationMin: 60, status: 'completed' }),
    baseDrill({ id: 'd2', date: '2026-11-17', startTime: '16:00', durationMin: 60, status: 'todo' }),
    baseDrill({ id: 'd3', date: '2026-11-16', startTime: '10:00', durationMin: 90, status: 'completed' }),
    baseDrill({ id: 'd4', date: '2026-11-15', startTime: '10:00', durationMin: 60, status: 'completed' }),
  ];
  const scrims: Scrim[] = [
    baseScrim({ id: 's1', date: '2026-11-17', startTime: '19:00', endTime: '21:00', status: 'confirmed' }),
  ];
  const aimLogs: AimLog[] = [
    baseAim({ id: 'a1', date: '2026-11-17', durationMin: 30, score: 95000 }),
  ];
  const availabilities: AvailabilitySlot[] = [];

  const metrics = computeDashboardMetrics({
    drills,
    scrims,
    aimLogs,
    availabilities,
    weeklyGoalHours: 20,
    todayDate: '2026-11-17',
    nowMinutes: 15 * 60, // 15:00
    activeOwnerId: 'u1',
  });

  // Today hours: 60m completed drill + 30m aim + 120m confirmed scrim = 210m = 3.5h
  assert.equal(metrics.todayTrainingHours, 3.5);
  assert.equal(metrics.todayCompletedDrills, 1);
  assert.equal(metrics.todayIncompleteDrills, 1);
  assert.equal(metrics.streakDays, 3);
  assert.equal(metrics.nextScrim?.id, 's1');
  // Window 15:00 -> 23:30 = 510 min. Busy: 16:00-17:00 (60m) + 19:00-21:00 (120m) = 180m. Free = 330m.
  assert.equal(metrics.remainingFreeMinutesToday, 330);
  assert.equal(metrics.dailyAimScore, 95000);
  assert.equal(metrics.personalBestScore, 95000);
});

test('detectScrimConflicts detects overlapping scrims, drills, and busy member slots', () => {
  const scrims = [
    baseScrim({ id: 's1', date: '2026-11-17', startTime: '19:00', endTime: '21:00', status: 'confirmed' }),
    baseScrim({ id: 's2', date: '2026-11-17', startTime: '19:00', endTime: '21:00', status: 'cancelled' }),
  ];
  const drills = [
    baseDrill({ id: 'd1', date: '2026-11-17', startTime: '18:30', durationMin: 60, status: 'todo' }),
  ];
  const availabilities: AvailabilitySlot[] = [
    {
      id: 'av1',
      teamId: 't1',
      teamOwnerId: 'u1',
      ownerId: 'u2',
      memberName: 'Khai',
      date: '2026-11-17',
      startTime: '20:30',
      endTime: '22:00',
      slotType: 'busy',
      notes: 'Học đại học',
    },
  ];

  const conflicts = detectScrimConflicts({
    candidate: { date: '2026-11-17', startTime: '19:00', endTime: '21:00' },
    scrims,
    drills,
    availabilities,
  });

  assert.equal(conflicts.length, 3);
  assert.deepEqual(
    conflicts.map((c) => c.kind).sort(),
    ['busy', 'drill', 'scrim'],
  );
});

test('computeTeamAvailabilityOverlap finds exact common free windows and warns on busy overlaps', () => {
  const members: TeamMember[] = [
    {
      uid: 'u1',
      teamOwnerId: 'u1',
      displayName: 'TenzVN',
      riotId: 'TenzVN#SEA',
      teamRole: 'player',
      gameRole: 'Duelist',
      mainAgent: 'Jett',
      scrimStatus: 'ready',
    },
    {
      uid: 'u2',
      teamOwnerId: 'u1',
      displayName: 'Khai',
      riotId: 'Khai#VN',
      teamRole: 'player',
      gameRole: 'Controller',
      mainAgent: 'Omen',
      scrimStatus: 'ready',
    },
  ];

  const availabilities: AvailabilitySlot[] = [
    {
      id: 'a1',
      teamId: 't1',
      teamOwnerId: 'u1',
      ownerId: 'u1',
      memberName: 'TenzVN',
      date: '2026-11-17',
      startTime: '18:00',
      endTime: '23:00',
      slotType: 'available',
    },
    {
      id: 'a2',
      teamId: 't1',
      teamOwnerId: 'u1',
      ownerId: 'u2',
      memberName: 'Khai',
      date: '2026-11-17',
      startTime: '19:00',
      endTime: '22:00',
      slotType: 'available',
    },
    {
      id: 'b2',
      teamId: 't1',
      teamOwnerId: 'u1',
      ownerId: 'u2',
      memberName: 'Khai',
      date: '2026-11-17',
      startTime: '21:00',
      endTime: '21:30',
      slotType: 'busy',
      notes: 'Họp nhóm',
    },
  ];

  const analysis = computeTeamAvailabilityOverlap({
    members,
    availabilities,
    date: '2026-11-17',
  });

  assert.equal(analysis.memberConflicts.length, 1);
  assert.equal(analysis.memberConflicts[0].startTime, '21:00');
  // All free windows: 19:00-21:00 (120m) and 21:30-22:00 (30m)
  assert.equal(analysis.allFreeWindows.length, 2);
  assert.equal(analysis.allFreeWindows[0].startTime, '19:00');
  assert.equal(analysis.allFreeWindows[0].endTime, '21:00');
  assert.equal(analysis.allFreeWindows[0].durationMin, 120);
});

test('computeAimAnalytics tracks personal bests and week-over-week comparison', () => {
  const logs: AimLog[] = [
    baseAim({ id: 'a1', date: '2026-11-10', score: 80000, accuracy: 88, durationMin: 20 }), // last week
    baseAim({ id: 'a2', date: '2026-11-17', score: 100000, accuracy: 94, durationMin: 40 }), // this week
  ];

  const summary = computeAimAnalytics(logs, '2026-11-17');
  assert.equal(summary.highScore, 100000);
  assert.equal(summary.personalBests[0].bestScore, 100000);
  assert.equal(summary.weekOverWeek.thisWeekAvgScore, 100000);
  assert.equal(summary.weekOverWeek.lastWeekAvgScore, 80000);
  assert.equal(summary.weekOverWeek.scoreDeltaPct, 25);
  assert.equal(summary.weekOverWeek.accuracyDelta, 6);
});

test('computePerformanceReport and generatePerformanceCsv aggregate real metrics cleanly', () => {
  const drills: TrainingDrill[] = [
    baseDrill({ id: 'd1', date: '2026-11-17', category: 'VOD Review', durationMin: 60, status: 'completed' }),
    baseDrill({ id: 'd2', date: '2026-11-17', category: 'Deathmatch', durationMin: 30, status: 'completed' }),
    baseDrill({ id: 'd3', date: '2026-11-17', category: 'Range Practice', durationMin: 30, status: 'todo' }),
  ];
  const aimLogs: AimLog[] = [
    baseAim({ id: 'a1', date: '2026-11-17', durationMin: 30, score: 90000 }),
  ];
  const scrims: Scrim[] = [
    baseScrim({ id: 's1', date: '2026-11-17', startTime: '19:00', endTime: '20:00', status: 'completed' }),
  ];

  const report = computePerformanceReport({
    period: 'weekly',
    drills,
    aimLogs,
    scrims,
    anchorDate: '2026-11-17',
  });

  assert.equal(report.completedDrills, 2);
  assert.equal(report.totalDrills, 3);
  assert.equal(report.completionRate, 67);
  assert.equal(report.deathmatchCount, 1);
  assert.equal(report.vodReviewCount, 1);
  assert.equal(report.scrimCount, 1);

  const csv = generatePerformanceCsv(report);
  assert.ok(csv.includes('TỔNG KẾT'));
  assert.ok(csv.includes('67'));
});
