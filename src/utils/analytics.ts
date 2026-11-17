import type {
  AimLog,
  AvailabilitySlot,
  Scrim,
  TeamMember,
  TrainingDrill,
} from '../types/training';
import {
  addDaysToDateKey,
  doTimeRangesOverlap,
  formatShortVNDate,
  getWeekDateKeys,
  minutesToTime,
  timeToMinutes,
} from './timezone';

export interface DashboardMetrics {
  todayTrainingHours: number;
  todayCompletedDrills: number;
  todayIncompleteDrills: number;
  nextScrim: Scrim | null;
  remainingFreeMinutesToday: number;
  streakDays: number;
  weeklyTrainingHours: number;
  weeklyGoalPct: number;
  dailyAimScore: number | null;
  dailyAimDeltaPct: number | null;
  personalBestScore: number | null;
}

export interface ScrimConflict {
  kind: 'scrim' | 'drill' | 'busy';
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  memberName?: string;
}

export interface AvailabilityTimelineSlot {
  startMin: number;
  endMin: number;
  startTime: string;
  endTime: string;
  availableMembers: TeamMember[];
  busyMembers: TeamMember[];
  conflictMembers: TeamMember[];
  availableCount: number;
  totalMembers: number;
}

export interface RecommendedScrimWindow {
  startTime: string;
  endTime: string;
  durationMin: number;
  minAvailableCount: number;
  totalMembers: number;
  allAvailable: boolean;
}

export interface TeamAvailabilityAnalysis {
  slots: AvailabilityTimelineSlot[];
  allFreeWindows: RecommendedScrimWindow[];
  recommendedWindows: RecommendedScrimWindow[];
  memberConflicts: Array<{
    memberName: string;
    date: string;
    startTime: string;
    endTime: string;
    reason: string;
  }>;
}

export interface AimAnalyticsSummary {
  highScore: number | null;
  personalBests: Array<{
    exerciseName: string;
    platform: string;
    bestScore: number;
    bestAccuracy: number;
    date: string;
    sessions: number;
  }>;
  dailyScoreSeries: Array<{ label: string; dateKey: string; value: number; accuracy: number }>;
  weeklyAccuracySeries: Array<{ label: string; value: number; sessions: number }>;
  dailyDurationSeries: Array<{ label: string; dateKey: string; value: number }>;
  weekOverWeek: {
    thisWeekAvgScore: number;
    lastWeekAvgScore: number;
    scoreDeltaPct: number | null;
    thisWeekAvgAccuracy: number;
    lastWeekAvgAccuracy: number;
    accuracyDelta: number | null;
    thisWeekMinutes: number;
    lastWeekMinutes: number;
    thisWeekSessions: number;
    lastWeekSessions: number;
  };
}

export type ReportPeriod = 'daily' | 'weekly' | 'monthly';

export interface PerformanceReport {
  period: ReportPeriod;
  periodLabel: string;
  totalTrainingHours: number;
  completedDrills: number;
  totalDrills: number;
  completionRate: number;
  aimTrainingHours: number;
  deathmatchCount: number;
  scrimCount: number;
  vodReviewCount: number;
  trainingHoursSeries: Array<{ label: string; value: number }>;
  aimProgressSeries: Array<{ label: string; value: number }>;
  completionRateSeries: Array<{ label: string; value: number }>;
  scrimHistory: Scrim[];
  evaluationRows: Array<{
    label: string;
    drillsCompleted: number;
    drillsTotal: number;
    completionRate: number;
    trainingHours: number;
    avgAimScore: number | null;
    scrimCount: number;
  }>;
}

function mergeIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
  if (intervals.length === 0) return [];
  const sorted = [...intervals]
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  if (sorted.length === 0) return [];
  const merged: Array<[number, number]> = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = sorted[i];
    if (curr[0] <= prev[1]) {
      prev[1] = Math.max(prev[1], curr[1]);
    } else {
      merged.push([...curr]);
    }
  }
  return merged;
}

export function computeDashboardMetrics(params: {
  drills: TrainingDrill[];
  scrims: Scrim[];
  aimLogs: AimLog[];
  availabilities: AvailabilitySlot[];
  weeklyGoalHours: number;
  todayDate: string;
  nowMinutes: number;
  activeOwnerId?: string;
}): DashboardMetrics {
  const {
    drills,
    scrims,
    aimLogs,
    availabilities,
    weeklyGoalHours,
    todayDate,
    nowMinutes,
    activeOwnerId,
  } = params;

  const userDrills = activeOwnerId
    ? drills.filter((d) => d.ownerId === activeOwnerId)
    : drills;
  const userAimLogs = activeOwnerId
    ? aimLogs.filter((a) => a.ownerId === activeOwnerId)
    : aimLogs;

  const todayDrills = userDrills.filter((d) => d.date === todayDate);
  const todayCompletedDrills = todayDrills.filter((d) => d.status === 'completed').length;
  const todayIncompleteDrills = todayDrills.filter(
    (d) => d.status === 'todo' || d.status === 'in_progress',
  ).length;

  const todayDrillMinutes = todayDrills
    .filter((d) => d.status === 'completed' || d.status === 'in_progress')
    .reduce((sum, d) => sum + d.durationMin, 0);

  const todayAimMinutes = userAimLogs
    .filter((a) => a.date === todayDate)
    .reduce((sum, a) => sum + a.durationMin, 0);

  const todayScrimMinutes = scrims
    .filter(
      (s) =>
        s.date === todayDate &&
        (s.status === 'completed' || s.status === 'live' || s.status === 'confirmed'),
    )
    .reduce((sum, s) => Math.max(0, timeToMinutes(s.endTime) - timeToMinutes(s.startTime)) + sum, 0);

  const todayTrainingHours = Number(
    ((todayDrillMinutes + todayAimMinutes + todayScrimMinutes) / 60).toFixed(1),
  );

  // Next scrim from now onward
  const upcomingScrims = scrims
    .filter((s) => s.status === 'planned' || s.status === 'confirmed' || s.status === 'live')
    .filter((s) => {
      if (s.date > todayDate) return true;
      if (s.date < todayDate) return false;
      return timeToMinutes(s.endTime) > nowMinutes || s.status === 'live';
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });
  const nextScrim = upcomingScrims[0] ?? null;

  // Remaining free time today (from max(nowMinutes, 08:00) until 23:30)
  const windowStart = Math.max(nowMinutes, 8 * 60);
  const windowEnd = 23 * 60 + 30;
  let remainingFreeMinutesToday = 0;
  if (windowEnd > windowStart) {
    const busyBlocks: Array<[number, number]> = [];
    for (const d of todayDrills) {
      if (d.status === 'todo' || d.status === 'in_progress') {
        const s = timeToMinutes(d.startTime);
        busyBlocks.push([Math.max(windowStart, s), Math.min(windowEnd, s + d.durationMin)]);
      }
    }
    for (const s of scrims) {
      if (
        s.date === todayDate &&
        (s.status === 'planned' || s.status === 'confirmed' || s.status === 'live')
      ) {
        busyBlocks.push([
          Math.max(windowStart, timeToMinutes(s.startTime)),
          Math.min(windowEnd, timeToMinutes(s.endTime)),
        ]);
      }
    }
    const userBusyAvail = availabilities.filter(
      (a) =>
        a.date === todayDate &&
        a.slotType === 'busy' &&
        (!activeOwnerId || a.ownerId === activeOwnerId),
    );
    for (const b of userBusyAvail) {
      busyBlocks.push([
        Math.max(windowStart, timeToMinutes(b.startTime)),
        Math.min(windowEnd, timeToMinutes(b.endTime)),
      ]);
    }
    const merged = mergeIntervals(busyBlocks);
    const busyMin = merged.reduce((sum, [s, e]) => sum + (e - s), 0);
    remainingFreeMinutesToday = Math.max(0, windowEnd - windowStart - busyMin);
  }

  // Training streak (days with >= 1 completed drill or >= 1 aimLog)
  const activeDates = new Set<string>();
  for (const d of userDrills) {
    if (d.status === 'completed') activeDates.add(d.date);
  }
  for (const a of userAimLogs) {
    activeDates.add(a.date);
  }
  let streakDays = 0;
  let cursor = activeDates.has(todayDate) ? todayDate : addDaysToDateKey(todayDate, -1);
  while (activeDates.has(cursor)) {
    streakDays++;
    cursor = addDaysToDateKey(cursor, -1);
  }

  // Weekly hours & goal %
  const weekKeys = new Set(getWeekDateKeys(todayDate));
  const weekDrillMinutes = userDrills
    .filter((d) => weekKeys.has(d.date) && d.status === 'completed')
    .reduce((sum, d) => sum + d.durationMin, 0);
  const weekAimMinutes = userAimLogs
    .filter((a) => weekKeys.has(a.date))
    .reduce((sum, a) => sum + a.durationMin, 0);
  const weekScrimMinutes = scrims
    .filter(
      (s) =>
        weekKeys.has(s.date) &&
        (s.status === 'completed' || s.status === 'confirmed' || s.status === 'live'),
    )
    .reduce((sum, s) => sum + Math.max(0, timeToMinutes(s.endTime) - timeToMinutes(s.startTime)), 0);

  const weeklyTrainingHours = Number(
    ((weekDrillMinutes + weekAimMinutes + weekScrimMinutes) / 60).toFixed(1),
  );
  const weeklyGoalPct =
    weeklyGoalHours > 0
      ? Math.min(100, Math.round((weeklyTrainingHours / weeklyGoalHours) * 100))
      : 0;

  // Daily Aim Score
  const sortedAim = [...userAimLogs].sort((a, b) => a.date.localeCompare(b.date));
  const todayAim = sortedAim.filter((a) => a.date === todayDate);
  let dailyAimScore: number | null = null;
  let dailyAimDeltaPct: number | null = null;

  if (todayAim.length > 0) {
    dailyAimScore = Math.round(
      todayAim.reduce((s, a) => s + a.score, 0) / todayAim.length,
    );
  } else if (sortedAim.length > 0) {
    const latestDate = sortedAim[sortedAim.length - 1].date;
    const latestLogs = sortedAim.filter((a) => a.date === latestDate);
    dailyAimScore = Math.round(
      latestLogs.reduce((s, a) => s + a.score, 0) / latestLogs.length,
    );
  }

  if (dailyAimScore !== null && sortedAim.length >= 2) {
    const prevDate = sortedAim.filter((a) => a.date < (todayAim.length > 0 ? todayDate : sortedAim[sortedAim.length - 1].date));
    if (prevDate.length > 0) {
      const prevAvg =
        prevDate.reduce((s, a) => s + a.score, 0) / prevDate.length;
      if (prevAvg > 0) {
        dailyAimDeltaPct = Number(
          (((dailyAimScore - prevAvg) / prevAvg) * 100).toFixed(1),
        );
      }
    }
  }

  const personalBestScore =
    sortedAim.length > 0 ? Math.max(...sortedAim.map((a) => a.score)) : null;

  return {
    todayTrainingHours,
    todayCompletedDrills,
    todayIncompleteDrills,
    nextScrim,
    remainingFreeMinutesToday,
    streakDays,
    weeklyTrainingHours,
    weeklyGoalPct,
    dailyAimScore,
    dailyAimDeltaPct,
    personalBestScore,
  };
}

export function detectScrimConflicts(params: {
  candidate: { id?: string; date: string; startTime: string; endTime: string };
  scrims: Scrim[];
  drills: TrainingDrill[];
  availabilities: AvailabilitySlot[];
}): ScrimConflict[] {
  const { candidate, scrims, drills, availabilities } = params;
  const cStart = timeToMinutes(candidate.startTime);
  const cEnd = timeToMinutes(candidate.endTime);
  if (cEnd <= cStart) return [];

  const conflicts: ScrimConflict[] = [];

  for (const s of scrims) {
    if (s.id === candidate.id || s.status === 'cancelled' || s.date !== candidate.date) {
      continue;
    }
    if (doTimeRangesOverlap(cStart, cEnd, timeToMinutes(s.startTime), timeToMinutes(s.endTime))) {
      conflicts.push({
        kind: 'scrim',
        id: s.id,
        title: `Trùng lịch Scrim vs ${s.opponent}`,
        startTime: s.startTime,
        endTime: s.endTime,
      });
    }
  }

  for (const d of drills) {
    if (d.date !== candidate.date || d.status === 'skipped') continue;
    const dStart = timeToMinutes(d.startTime);
    const dEnd = dStart + d.durationMin;
    if (doTimeRangesOverlap(cStart, cEnd, dStart, dEnd)) {
      conflicts.push({
        kind: 'drill',
        id: d.id,
        title: `Trùng bài tập: ${d.title}`,
        startTime: d.startTime,
        endTime: minutesToTime(dEnd),
      });
    }
  }

  for (const a of availabilities) {
    if (a.date !== candidate.date || a.slotType !== 'busy') continue;
    if (doTimeRangesOverlap(cStart, cEnd, timeToMinutes(a.startTime), timeToMinutes(a.endTime))) {
      conflicts.push({
        kind: 'busy',
        id: a.id,
        title: `${a.memberName} báo bận (${a.notes || 'Không thể tham gia'})`,
        startTime: a.startTime,
        endTime: a.endTime,
        memberName: a.memberName,
      });
    }
  }

  return conflicts;
}

export function computeTeamAvailabilityOverlap(params: {
  members: TeamMember[];
  availabilities: AvailabilitySlot[];
  date: string;
}): TeamAvailabilityAnalysis {
  const { members, availabilities, date } = params;
  const daySlots = availabilities.filter((a) => a.date === date);

  const memberConflicts: TeamAvailabilityAnalysis['memberConflicts'] = [];
  for (const m of members) {
    const mAvail = daySlots.filter((a) => a.ownerId === m.uid && a.slotType === 'available');
    const mBusy = daySlots.filter((a) => a.ownerId === m.uid && a.slotType === 'busy');
    for (const av of mAvail) {
      for (const bz of mBusy) {
        const avS = timeToMinutes(av.startTime);
        const avE = timeToMinutes(av.endTime);
        const bzS = timeToMinutes(bz.startTime);
        const bzE = timeToMinutes(bz.endTime);
        if (doTimeRangesOverlap(avS, avE, bzS, bzE)) {
          memberConflicts.push({
            memberName: m.displayName,
            date,
            startTime: minutesToTime(Math.max(avS, bzS)),
            endTime: minutesToTime(Math.min(avE, bzE)),
            reason: bz.notes || 'Khung giờ rảnh bị chồng lấn với lịch bận',
          });
        }
      }
    }
  }

  const slots: AvailabilityTimelineSlot[] = [];
  // 08:00 to 24:00 in 30-min steps (32 slots)
  for (let startMin = 8 * 60; startMin < 24 * 60; startMin += 30) {
    const endMin = startMin + 30;
    const availableMembers: TeamMember[] = [];
    const busyMembers: TeamMember[] = [];
    const conflictMembers: TeamMember[] = [];

    for (const m of members) {
      const mSlots = daySlots.filter((a) => a.ownerId === m.uid);
      const hasAvail = mSlots.some(
        (s) =>
          s.slotType === 'available' &&
          timeToMinutes(s.startTime) <= startMin &&
          timeToMinutes(s.endTime) >= endMin,
      );
      const hasBusy = mSlots.some(
        (s) =>
          s.slotType === 'busy' &&
          doTimeRangesOverlap(startMin, endMin, timeToMinutes(s.startTime), timeToMinutes(s.endTime)),
      );

      if (hasAvail && hasBusy) {
        conflictMembers.push(m);
        busyMembers.push(m);
      } else if (hasAvail) {
        availableMembers.push(m);
      } else if (hasBusy) {
        busyMembers.push(m);
      }
    }

    slots.push({
      startMin,
      endMin,
      startTime: minutesToTime(startMin),
      endTime: minutesToTime(endMin),
      availableMembers,
      busyMembers,
      conflictMembers,
      availableCount: availableMembers.length,
      totalMembers: members.length,
    });
  }

  // Merge contiguous blocks where all members are available
  const allFreeWindows: RecommendedScrimWindow[] = [];
  let runStart: number | null = null;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const isAllFree = members.length > 0 && slot.availableCount === members.length;
    if (isAllFree && runStart === null) {
      runStart = slot.startMin;
    } else if (!isAllFree && runStart !== null) {
      const prevEnd = slots[i - 1].endMin;
      allFreeWindows.push({
        startTime: minutesToTime(runStart),
        endTime: minutesToTime(prevEnd),
        durationMin: prevEnd - runStart,
        minAvailableCount: members.length,
        totalMembers: members.length,
        allAvailable: true,
      });
      runStart = null;
    }
  }
  if (runStart !== null && slots.length > 0) {
    const lastEnd = slots[slots.length - 1].endMin;
    allFreeWindows.push({
      startTime: minutesToTime(runStart),
      endTime: minutesToTime(lastEnd),
      durationMin: lastEnd - runStart,
      minAvailableCount: members.length,
      totalMembers: members.length,
      allAvailable: true,
    });
  }

  // Recommend best windows >= 90 min (preferring allAvailable, otherwise max availableCount)
  const recommendedWindows: RecommendedScrimWindow[] = [...allFreeWindows.filter((w) => w.durationMin >= 60)];
  if (recommendedWindows.length === 0 && members.length > 0) {
    const threshold = Math.max(1, members.length - 1);
    let partialStart: number | null = null;
    let partialMinCount = members.length;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (slot.availableCount >= threshold) {
        if (partialStart === null) {
          partialStart = slot.startMin;
          partialMinCount = slot.availableCount;
        } else {
          partialMinCount = Math.min(partialMinCount, slot.availableCount);
        }
      } else if (partialStart !== null) {
        const prevEnd = slots[i - 1].endMin;
        if (prevEnd - partialStart >= 90) {
          recommendedWindows.push({
            startTime: minutesToTime(partialStart),
            endTime: minutesToTime(prevEnd),
            durationMin: prevEnd - partialStart,
            minAvailableCount: partialMinCount,
            totalMembers: members.length,
            allAvailable: false,
          });
        }
        partialStart = null;
      }
    }
    if (partialStart !== null && slots.length > 0) {
      const lastEnd = slots[slots.length - 1].endMin;
      if (lastEnd - partialStart >= 90) {
        recommendedWindows.push({
          startTime: minutesToTime(partialStart),
          endTime: minutesToTime(lastEnd),
          durationMin: lastEnd - partialStart,
          minAvailableCount: partialMinCount,
          totalMembers: members.length,
          allAvailable: false,
        });
      }
    }
  }

  recommendedWindows.sort((a, b) => {
    if (a.allAvailable !== b.allAvailable) return a.allAvailable ? -1 : 1;
    if (b.minAvailableCount !== a.minAvailableCount) return b.minAvailableCount - a.minAvailableCount;
    return b.durationMin - a.durationMin;
  });

  return {
    slots,
    allFreeWindows,
    recommendedWindows: recommendedWindows.slice(0, 4),
    memberConflicts,
  };
}

export function computeAimAnalytics(aimLogs: AimLog[], todayDate: string): AimAnalyticsSummary {
  if (aimLogs.length === 0) {
    return {
      highScore: null,
      personalBests: [],
      dailyScoreSeries: [],
      weeklyAccuracySeries: [],
      dailyDurationSeries: [],
      weekOverWeek: {
        thisWeekAvgScore: 0,
        lastWeekAvgScore: 0,
        scoreDeltaPct: null,
        thisWeekAvgAccuracy: 0,
        lastWeekAvgAccuracy: 0,
        accuracyDelta: null,
        thisWeekMinutes: 0,
        lastWeekMinutes: 0,
        thisWeekSessions: 0,
        lastWeekSessions: 0,
      },
    };
  }

  const highScore = Math.max(...aimLogs.map((l) => l.score));

  // Personal Best per exerciseName
  const byExercise = new Map<string, AimLog[]>();
  for (const log of aimLogs) {
    const key = log.exerciseName.trim();
    const list = byExercise.get(key) ?? [];
    list.push(log);
    byExercise.set(key, list);
  }

  const personalBests = Array.from(byExercise.entries())
    .map(([exerciseName, logs]) => {
      const best = logs.reduce((acc, cur) => (cur.score > acc.score ? cur : acc), logs[0]);
      const bestAccuracy = Math.max(...logs.map((l) => l.accuracy));
      return {
        exerciseName,
        platform: best.platform,
        bestScore: best.score,
        bestAccuracy,
        date: best.date,
        sessions: logs.length,
      };
    })
    .sort((a, b) => b.bestScore - a.bestScore);

  // Daily score & duration series (last 10 distinct dates or last 7 days)
  const byDate = new Map<string, AimLog[]>();
  for (const log of aimLogs) {
    const list = byDate.get(log.date) ?? [];
    list.push(log);
    byDate.set(log.date, list);
  }
  const sortedDates = Array.from(byDate.keys()).sort();
  const recentDates = sortedDates.slice(-10);

  const dailyScoreSeries = recentDates.map((dateKey) => {
    const logs = byDate.get(dateKey) ?? [];
    const avgScore = Math.round(logs.reduce((s, l) => s + l.score, 0) / logs.length);
    const avgAccuracy = Number(
      (logs.reduce((s, l) => s + l.accuracy, 0) / logs.length).toFixed(1),
    );
    return {
      label: formatShortVNDate(dateKey),
      dateKey,
      value: avgScore,
      accuracy: avgAccuracy,
    };
  });

  // Daily duration series for current week
  const thisWeekDates = getWeekDateKeys(todayDate);
  const dailyDurationSeries = thisWeekDates.map((dateKey) => {
    const logs = byDate.get(dateKey) ?? [];
    return {
      label: formatShortVNDate(dateKey),
      dateKey,
      value: logs.reduce((s, l) => s + l.durationMin, 0),
    };
  });

  // Weekly accuracy (last 4 weeks ending this week)
  const weeklyAccuracySeries = [-3, -2, -1, 0].map((weekOffset) => {
    const anchor = addDaysToDateKey(todayDate, weekOffset * 7);
    const weekSet = new Set(getWeekDateKeys(anchor));
    const logs = aimLogs.filter((l) => weekSet.has(l.date));
    const avgAcc =
      logs.length > 0
        ? Number((logs.reduce((s, l) => s + l.accuracy, 0) / logs.length).toFixed(1))
        : 0;
    const label = weekOffset === 0 ? 'Tuần này' : weekOffset === -1 ? 'Tuần trước' : `Tuần ${weekOffset}`;
    return {
      label,
      value: avgAcc,
      sessions: logs.length,
    };
  });

  // Week-over-Week comparison
  const thisWeekSet = new Set(thisWeekDates);
  const lastWeekSet = new Set(getWeekDateKeys(addDaysToDateKey(todayDate, -7)));
  const thisWeekLogs = aimLogs.filter((l) => thisWeekSet.has(l.date));
  const lastWeekLogs = aimLogs.filter((l) => lastWeekSet.has(l.date));

  const thisWeekAvgScore =
    thisWeekLogs.length > 0
      ? Math.round(thisWeekLogs.reduce((s, l) => s + l.score, 0) / thisWeekLogs.length)
      : 0;
  const lastWeekAvgScore =
    lastWeekLogs.length > 0
      ? Math.round(lastWeekLogs.reduce((s, l) => s + l.score, 0) / lastWeekLogs.length)
      : 0;
  const scoreDeltaPct =
    thisWeekLogs.length > 0 && lastWeekAvgScore > 0
      ? Number((((thisWeekAvgScore - lastWeekAvgScore) / lastWeekAvgScore) * 100).toFixed(1))
      : null;

  const thisWeekAvgAccuracy =
    thisWeekLogs.length > 0
      ? Number((thisWeekLogs.reduce((s, l) => s + l.accuracy, 0) / thisWeekLogs.length).toFixed(1))
      : 0;
  const lastWeekAvgAccuracy =
    lastWeekLogs.length > 0
      ? Number((lastWeekLogs.reduce((s, l) => s + l.accuracy, 0) / lastWeekLogs.length).toFixed(1))
      : 0;
  const accuracyDelta =
    thisWeekLogs.length > 0 && lastWeekLogs.length > 0
      ? Number((thisWeekAvgAccuracy - lastWeekAvgAccuracy).toFixed(1))
      : null;

  return {
    highScore,
    personalBests,
    dailyScoreSeries,
    weeklyAccuracySeries,
    dailyDurationSeries,
    weekOverWeek: {
      thisWeekAvgScore,
      lastWeekAvgScore,
      scoreDeltaPct,
      thisWeekAvgAccuracy,
      lastWeekAvgAccuracy,
      accuracyDelta,
      thisWeekMinutes: thisWeekLogs.reduce((s, l) => s + l.durationMin, 0),
      lastWeekMinutes: lastWeekLogs.reduce((s, l) => s + l.durationMin, 0),
      thisWeekSessions: thisWeekLogs.length,
      lastWeekSessions: lastWeekLogs.length,
    },
  };
}

export function computePerformanceReport(params: {
  period: ReportPeriod;
  drills: TrainingDrill[];
  aimLogs: AimLog[];
  scrims: Scrim[];
  anchorDate: string;
}): PerformanceReport {
  const { period, drills, aimLogs, scrims, anchorDate } = params;

  let dateBuckets: Array<{ label: string; dates: Set<string> }> = [];
  let rangeDates = new Set<string>();
  let periodLabel = '';

  if (period === 'daily') {
    periodLabel = `Báo cáo ngày ${formatShortVNDate(anchorDate)}`;
    rangeDates = new Set([anchorDate]);
    // 7-day trend ending on anchorDate
    for (let i = -6; i <= 0; i++) {
      const dk = addDaysToDateKey(anchorDate, i);
      dateBuckets.push({ label: formatShortVNDate(dk), dates: new Set([dk]) });
    }
  } else if (period === 'weekly') {
    const weekKeys = getWeekDateKeys(anchorDate);
    periodLabel = `Tuần ${formatShortVNDate(weekKeys[0])} – ${formatShortVNDate(weekKeys[6])}`;
    rangeDates = new Set(weekKeys);
    dateBuckets = weekKeys.map((dk) => ({ label: formatShortVNDate(dk), dates: new Set([dk]) }));
  } else {
    const monthPrefix = anchorDate.slice(0, 7);
    periodLabel = `Tháng ${anchorDate.slice(5, 7)}/${anchorDate.slice(0, 4)}`;
    const allDates = new Set<string>();
    for (const d of drills) if (d.date.startsWith(monthPrefix)) allDates.add(d.date);
    for (const a of aimLogs) if (a.date.startsWith(monthPrefix)) allDates.add(a.date);
    for (const s of scrims) if (s.date.startsWith(monthPrefix)) allDates.add(s.date);
    rangeDates = allDates;

    // 4 weeks of the month
    for (let w = 0; w < 4; w++) {
      const startDay = w * 7 + 1;
      const endDay = w === 3 ? 31 : (w + 1) * 7;
      const bucketSet = new Set<string>();
      for (let day = startDay; day <= endDay; day++) {
        bucketSet.add(`${monthPrefix}-${String(day).padStart(2, '0')}`);
      }
      dateBuckets.push({ label: `Tuần ${w + 1}`, dates: bucketSet });
    }
  }

  const inRange = (d: string) =>
    period === 'monthly' ? d.startsWith(anchorDate.slice(0, 7)) : rangeDates.has(d);

  const fDrills = drills.filter((d) => inRange(d.date));
  const fAim = aimLogs.filter((a) => inRange(a.date));
  const fScrims = scrims.filter((s) => inRange(s.date) && s.status !== 'cancelled');

  const completedDrills = fDrills.filter((d) => d.status === 'completed').length;
  const totalDrills = fDrills.length;
  const completionRate =
    totalDrills > 0 ? Math.round((completedDrills / totalDrills) * 100) : 0;

  const drillMin = fDrills
    .filter((d) => d.status === 'completed' || d.status === 'in_progress')
    .reduce((s, d) => s + d.durationMin, 0);
  const aimMin = fAim.reduce((s, a) => s + a.durationMin, 0);
  const scrimMin = fScrims
    .filter((s) => s.status === 'completed' || s.status === 'confirmed' || s.status === 'live')
    .reduce((s, x) => s + Math.max(0, timeToMinutes(x.endTime) - timeToMinutes(x.startTime)), 0);

  const totalTrainingHours = Number(((drillMin + aimMin + scrimMin) / 60).toFixed(1));
  const aimTrainingHours = Number(
    (
      (aimMin +
        fDrills
          .filter((d) => d.category === 'Aim Training' && d.status === 'completed')
          .reduce((s, d) => s + d.durationMin, 0)) /
      60
    ).toFixed(1),
  );
  const deathmatchCount =
    fDrills.filter(
      (d) =>
        (d.category === 'Deathmatch' || d.category === 'Team Deathmatch') &&
        d.status === 'completed',
    ).length + fAim.filter((a) => a.platform === 'Deathmatch').length;
  const scrimCount = fScrims.length;
  const vodReviewCount = fDrills.filter(
    (d) => (d.category === 'VOD Review' || d.category === 'Scrim Review') && d.status === 'completed',
  ).length;

  const evaluationRows = dateBuckets.map((bucket) => {
    const bDrills = drills.filter((d) => bucket.dates.has(d.date));
    const bAim = aimLogs.filter((a) => bucket.dates.has(a.date));
    const bScrims = scrims.filter((s) => bucket.dates.has(s.date) && s.status !== 'cancelled');

    const bComp = bDrills.filter((d) => d.status === 'completed').length;
    const bTot = bDrills.length;
    const bRate = bTot > 0 ? Math.round((bComp / bTot) * 100) : 0;

    const bMin =
      bDrills.filter((d) => d.status === 'completed').reduce((s, d) => s + d.durationMin, 0) +
      bAim.reduce((s, a) => s + a.durationMin, 0) +
      bScrims
        .filter((s) => s.status === 'completed' || s.status === 'confirmed')
        .reduce((s, x) => s + Math.max(0, timeToMinutes(x.endTime) - timeToMinutes(x.startTime)), 0);

    const avgAimScore =
      bAim.length > 0
        ? Math.round(bAim.reduce((s, a) => s + a.score, 0) / bAim.length)
        : null;

    return {
      label: bucket.label,
      drillsCompleted: bComp,
      drillsTotal: bTot,
      completionRate: bRate,
      trainingHours: Number((bMin / 60).toFixed(1)),
      avgAimScore,
      scrimCount: bScrims.length,
    };
  });

  return {
    period,
    periodLabel,
    totalTrainingHours,
    completedDrills,
    totalDrills,
    completionRate,
    aimTrainingHours,
    deathmatchCount,
    scrimCount,
    vodReviewCount,
    trainingHoursSeries: evaluationRows.map((r) => ({ label: r.label, value: r.trainingHours })),
    aimProgressSeries: evaluationRows.map((r) => ({ label: r.label, value: r.avgAimScore ?? 0 })),
    completionRateSeries: evaluationRows.map((r) => ({ label: r.label, value: r.completionRate })),
    scrimHistory: [...fScrims].sort((a, b) => b.date.localeCompare(a.date)),
    evaluationRows,
  };
}

function escapeCsvField(val: string | number | null | undefined): string {
  const str = val === null || val === undefined ? '' : String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generatePerformanceCsv(report: PerformanceReport): string {
  const headers = [
    'Giai đoạn',
    'Bài tập hoàn thành',
    'Tổng bài tập',
    'Tỷ lệ hoàn thành (%)',
    'Giờ luyện tập (h)',
    'Điểm Aim TB',
    'Số buổi Scrim',
  ];

  const rows = report.evaluationRows.map((row) =>
    [
      row.label,
      row.drillsCompleted,
      row.drillsTotal,
      row.completionRate,
      row.trainingHours,
      row.avgAimScore ?? '',
      row.scrimCount,
    ]
      .map(escapeCsvField)
      .join(','),
  );

  const summary = [
    'TỔNG KẾT',
    report.completedDrills,
    report.totalDrills,
    report.completionRate,
    report.totalTrainingHours,
    '',
    report.scrimCount,
  ]
    .map(escapeCsvField)
    .join(',');

  return '\uFEFF' + [headers.map(escapeCsvField).join(','), ...rows, summary].join('\n');
}
