import {
  DRILL_CATEGORIES,
  type DrillCategory,
  type GeneratedDailyDrill,
  type TrainingDrill,
} from '../types/training.ts';

export const DEFAULT_AI_FOCUS_AREAS = [
  'Tracking',
  'Flicking',
  'Micro Adjustment',
  'Crosshair Placement',
  'Spray Control',
  'Movement Training',
] as const;

export interface RawGeneratedDrill {
  title?: unknown;
  category?: unknown;
  focusTag?: unknown;
  startTime?: unknown;
  durationMin?: unknown;
  goal?: unknown;
  description?: unknown;
}

const VALID_CATEGORIES = new Set<string>(DRILL_CATEGORIES);

function sanitizeCategory(raw: unknown, focusTag: string): DrillCategory {
  if (typeof raw === 'string' && VALID_CATEGORIES.has(raw.trim())) {
    return raw.trim() as DrillCategory;
  }
  const f = focusTag.toLowerCase();
  if (f.includes('crosshair')) return 'Crosshair Placement';
  if (f.includes('spray')) return 'Spray Control';
  if (f.includes('movement') || f.includes('strafe')) return 'Movement Training';
  if (f.includes('deathmatch')) return 'Deathmatch';
  if (f.includes('range')) return 'Range Practice';
  return 'Aim Training';
}

function sanitizeTime(raw: unknown, fallbackIndex: number): string {
  if (typeof raw === 'string' && /^\d{2}:\d{2}$/.test(raw.trim())) {
    const [hh, mm] = raw.trim().split(':').map(Number);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
  }
  const totalMin = 9 * 60 + fallbackIndex * 45;
  const hh = Math.min(22, Math.floor(totalMin / 60));
  const mm = totalMin % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function normalizeGeneratedDrills(
  rawList: unknown,
  dateKey: string,
): GeneratedDailyDrill[] {
  if (!Array.isArray(rawList)) return [];
  const results: GeneratedDailyDrill[] = [];

  for (let i = 0; i < rawList.length && results.length < 6; i++) {
    const item = rawList[i] as RawGeneratedDrill | null | undefined;
    if (!item || typeof item !== 'object') continue;

    const title =
      typeof item.title === 'string' ? item.title.trim().slice(0, 120) : '';
    if (!title) continue;

    const focusTag =
      typeof item.focusTag === 'string' && item.focusTag.trim()
        ? item.focusTag.trim().slice(0, 40)
        : 'Tracking & Flick';

    const rawDur = Number(item.durationMin);
    const durationMin = Number.isFinite(rawDur)
      ? Math.max(10, Math.min(180, Math.round(rawDur)))
      : 25;

    const goal =
      typeof item.goal === 'string' ? item.goal.trim().slice(0, 200) : '';
    const description =
      typeof item.description === 'string'
        ? item.description.trim().slice(0, 600)
        : '';

    results.push({
      id: `ai_${dateKey}_${i + 1}`,
      title,
      category: sanitizeCategory(item.category, focusTag),
      focusTag,
      startTime: sanitizeTime(item.startTime, results.length),
      durationMin,
      goal,
      description,
    });
  }

  return results;
}

export function toTrainingDrill(
  generated: GeneratedDailyDrill,
  context: {
    id: string;
    date: string;
    teamId: string;
    teamOwnerId: string;
    ownerId: string;
    assignedBy: string;
  },
): TrainingDrill {
  return {
    id: context.id,
    teamId: context.teamId,
    teamOwnerId: context.teamOwnerId,
    ownerId: context.ownerId,
    assignedBy: context.assignedBy,
    title: generated.title,
    category: generated.category,
    date: context.date,
    startTime: generated.startTime,
    durationMin: generated.durationMin,
    goal: generated.goal,
    description: generated.description
      ? `[AI · ${generated.focusTag}] ${generated.description}`
      : `[AI · ${generated.focusTag}]`,
    status: 'todo',
  };
}

export interface SmartPlanInput {
  date: string;
  playerName?: string;
  gameRole?: string;
  mainAgent?: string;
  focusAreas?: string[];
  durationBudgetMin?: number;
  variationSeed?: number;
  recentStats?: {
    avgAccuracy?: number;
    lastScore?: number;
    totalSessions?: number;
  };
}

interface DrillBlueprint {
  focusTag: string;
  category: DrillCategory;
  titleTemplate: (agent: string, role: string) => string;
  baseDuration: number;
  goalTemplate: (accTarget: number) => string;
  descriptionTemplate: (agent: string, role: string) => string;
}

const DRILL_LIBRARY: DrillBlueprint[] = [
  {
    focusTag: 'Tracking',
    category: 'Aim Training',
    titleTemplate: () => 'Aimlabs — VT Smoothbot & Reactive Tracking',
    baseDuration: 20,
    goalTemplate: (acc) => `Duy trì tâm mượt trên mục tiêu đổi hướng · Accuracy >= ${Math.max(88, acc)}%`,
    descriptionTemplate: (agent) =>
      `Giữ cổ tay thả lỏng, bám tâm liên tục theo chuyển động ngang/dọc của bot mà không giật chuột. Rất quan trọng khi ${agent} đấu súng tầm trung.`,
  },
  {
    focusTag: 'Tracking',
    category: 'Range Practice',
    titleTemplate: () => 'Valorant Range — Strafe Tracking & Moving Bots',
    baseDuration: 20,
    goalTemplate: () => 'Bám đầu bot di chuyển 100 mạng liên tiếp không trượt nhịp counter-strafe',
    descriptionTemplate: (_, role) =>
      `Di chuyển A-D kết hợp giữ tâm dính vào đầu bot đang chạy trong Range để ổn định nhịp Tracking thực chiến cho vị trí ${role}.`,
  },
  {
    focusTag: 'Flicking',
    category: 'Aim Training',
    titleTemplate: () => "Kovaak's / Aimlabs — VT 1w4ts & Reflex Wide Flick",
    baseDuration: 25,
    goalTemplate: (acc) => `95,000+ điểm · Tỷ lệ bắn trúng phát đầu >= ${acc}%`,
    descriptionTemplate: () =>
      'Vẩy tâm dứt khoát theo đường thẳng tới mục tiêu xa rồi dừng tâm tức thì (stop power), tránh over-flick quá đầu đối phương.',
  },
  {
    focusTag: 'Flicking',
    category: 'Range Practice',
    titleTemplate: (agent) => `Valorant Range — Hard Bots 30 & ${agent} Fast Re-peek`,
    baseDuration: 20,
    goalTemplate: () => 'Đạt >= 22/30 Hard Bots với Vandal/Sheriff (100% Headshot)',
    descriptionTemplate: (agent) =>
      `Đặt tâm ở vị trí trung tâm, phản xạ vẩy 1-tap ngay khi bot xuất hiện kết hợp bộ kỹ năng đặc trưng của ${agent}.`,
  },
  {
    focusTag: 'Micro Adjustment',
    category: 'Aim Training',
    titleTemplate: () => 'Aimlabs — VT Sixshot & Micro Cluster Precision',
    baseDuration: 20,
    goalTemplate: (acc) => `Accuracy >= ${Math.min(96, acc + 2)}% · Không bắn vội khi tâm chưa khóa đầu`,
    descriptionTemplate: () =>
      'Tập trung chỉnh vi mô bằng ngón tay (fingertip micro-correction) trong phạm vi hẹp 1–3 độ quanh vùng đầu đối thủ.',
  },
  {
    focusTag: 'Micro Adjustment',
    category: 'Deathmatch',
    titleTemplate: () => 'Deathmatch — Guardian / Sheriff Headshot Micro-Correct',
    baseDuration: 25,
    goalTemplate: () => '2 trận DM · Headshot rate >= 42% · Chỉ tap từng viên',
    descriptionTemplate: () =>
      'Chỉ dùng Guardian hoặc Sheriff, dừng hẳn bằng phím ngược hướng trước khi tinh chỉnh 1–2mm cuối cùng vào đầu.',
  },
  {
    focusTag: 'Crosshair Placement',
    category: 'Crosshair Placement',
    titleTemplate: (agent, role) =>
      `Deathmatch — Pre-aim Góc Кê Chuẩn (${role} · ${agent})`,
    baseDuration: 25,
    goalTemplate: () => '80% mạng hạ gục không cần vẩy chuột quá 5 độ',
    descriptionTemplate: (agent, role) =>
      `Kê sẵn tâm ngang tầm đầu ở mọi góc peek phổ biến (Ascent, Lotus, Haven), tối ưu nhịp mở góc cho ${role} (${agent}).`,
  },
  {
    focusTag: 'Spray Control',
    category: 'Spray Control',
    titleTemplate: () => 'Range & DM — Vandal/Phantom 2-Tap Burst & Spray Transfer',
    baseDuration: 20,
    goalTemplate: () => 'Kiểm soát loạt 5 viên đầu cụm gọn và chuyển mục tiêu thứ 2 dưới 450ms',
    descriptionTemplate: () =>
      'Luyện nhịp bắn 2–3 viên ngắt nghỉ (deadzone burst) ở cự ly >20m và kéo ghìm tâm chuyển mục tiêu (spray transfer) ở cự ly gần.',
  },
  {
    focusTag: 'Movement Training',
    category: 'Movement Training',
    titleTemplate: (agent) => `Range & Custom — Deadzoning, Jiggle Peek & ${agent} Movement`,
    baseDuration: 20,
    goalTemplate: () => 'Bắn chính xác 100% viên đầu ở điểm chuyển hướng A-D',
    descriptionTemplate: (agent) =>
      `Luyện nhịp nhấp nhả A-D bắn viên đơn ở khoảnh khắc vận tốc bằng 0, kết hợp di chuyển đặc thù của ${agent} để khó bị bắt bài.`,
  },
];

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function buildSmartTacticalDailyPlan(
  input: SmartPlanInput,
): {
  date: string;
  focusAreas: string[];
  coachNote: string;
  generatedAt: string;
  drills: GeneratedDailyDrill[];
} {
  const dateKey =
    typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date)
      ? input.date
      : new Date().toISOString().slice(0, 10);

  const focusAreas =
    Array.isArray(input.focusAreas) && input.focusAreas.length > 0
      ? input.focusAreas.slice(0, 6).map((s) => String(s).trim()).filter(Boolean)
      : [...DEFAULT_AI_FOCUS_AREAS.slice(0, 4)];

  const budget = Math.max(30, Math.min(240, Number(input.durationBudgetMin) || 90));
  const agent = (input.mainAgent || 'Jett').trim() || 'Jett';
  const role = (input.gameRole || 'Duelist').trim() || 'Duelist';
  const accBaseline = Math.max(
    88,
    Math.min(95, Math.round(Number(input.recentStats?.avgAccuracy) || 92)),
  );
  const seed = hashSeed(
    `${dateKey}:${agent}:${role}:${focusAreas.join(',')}:${input.variationSeed ?? 0}`,
  );

  // Pick 4 drills matching the requested focus areas first
  const selectedBlueprints: DrillBlueprint[] = [];
  const usedIndices = new Set<number>();

  for (let fIdx = 0; fIdx < focusAreas.length && selectedBlueprints.length < 4; fIdx++) {
    const focus = focusAreas[fIdx].toLowerCase();
    const matchingIndices = DRILL_LIBRARY.map((b, idx) => ({ b, idx })).filter(
      ({ b, idx }) =>
        !usedIndices.has(idx) && b.focusTag.toLowerCase() === focus,
    );
    if (matchingIndices.length > 0) {
      const pick = matchingIndices[(seed + fIdx) % matchingIndices.length];
      usedIndices.add(pick.idx);
      selectedBlueprints.push(pick.b);
    }
  }

  for (let i = 0; i < DRILL_LIBRARY.length && selectedBlueprints.length < 4; i++) {
    const idx = (seed + i) % DRILL_LIBRARY.length;
    if (!usedIndices.has(idx)) {
      usedIndices.add(idx);
      selectedBlueprints.push(DRILL_LIBRARY[idx]);
    }
  }

  const rawTotal = selectedBlueprints.reduce((s, b) => s + b.baseDuration, 0) || 80;
  const scale = budget / rawTotal;

  let currentMinutes = 9 * 60; // start at 09:00
  const drills: GeneratedDailyDrill[] = selectedBlueprints.map((bp, idx) => {
    const durationMin = Math.max(
      10,
      Math.min(90, Math.round((bp.baseDuration * scale) / 5) * 5),
    );
    const hh = String(Math.min(22, Math.floor(currentMinutes / 60))).padStart(2, '0');
    const mm = String(currentMinutes % 60).padStart(2, '0');
    currentMinutes += durationMin + 15;

    return {
      id: `ai_${dateKey}_${idx + 1}`,
      title: bp.titleTemplate(agent, role),
      category: bp.category,
      focusTag: bp.focusTag,
      startTime: `${hh}:${mm}`,
      durationMin,
      goal: bp.goalTemplate(accBaseline),
      description: bp.descriptionTemplate(agent, role),
    };
  });

  const coachNote = `Giáo án ngày ${dateKey} cho ${role} (${agent}): Ưu tiên làm nóng cổ tay với ${focusAreas.slice(0, 2).join(' & ')}, giữ kỷ luật dừng tâm chuẩn xác trước khi vào chuỗi Deathmatch tốc độ cao.`;

  return {
    date: dateKey,
    focusAreas,
    coachNote,
    generatedAt: new Date().toISOString(),
    drills,
  };
}

export function parseAiPlanResponseSafely(
  rawText: string,
  fallbackInput: SmartPlanInput,
): ReturnType<typeof buildSmartTacticalDailyPlan> {
  const trimmed = (rawText || '').trim();
  if (!trimmed || !trimmed.startsWith('{')) {
    return buildSmartTacticalDailyPlan(fallbackInput);
  }
  try {
    const parsed = JSON.parse(trimmed) as {
      date?: string;
      focusAreas?: string[];
      coachNote?: string;
      generatedAt?: string;
      drills?: unknown;
    };
    const drills = normalizeGeneratedDrills(parsed.drills, fallbackInput.date);
    if (drills.length === 0) {
      return buildSmartTacticalDailyPlan(fallbackInput);
    }
    return {
      date: typeof parsed.date === 'string' ? parsed.date : fallbackInput.date,
      focusAreas:
        Array.isArray(parsed.focusAreas) && parsed.focusAreas.length > 0
          ? parsed.focusAreas
          : fallbackInput.focusAreas || [...DEFAULT_AI_FOCUS_AREAS.slice(0, 4)],
      coachNote:
        typeof parsed.coachNote === 'string' && parsed.coachNote.trim()
          ? parsed.coachNote.trim()
          : buildSmartTacticalDailyPlan(fallbackInput).coachNote,
      generatedAt: parsed.generatedAt || new Date().toISOString(),
      drills,
    };
  } catch {
    return buildSmartTacticalDailyPlan(fallbackInput);
  }
}

export function buildDailyAiCacheKey(accountId: string, dateKey: string): string {
  const safeId = accountId.replace(/[^a-zA-Z0-9_-]/g, '_') || 'guest';
  return `vth_ai_daily_${safeId}_${dateKey}`;
}

export function shouldAutoGenerateDailyPlan(
  cachedPlanDate: string | null | undefined,
  todayDate: string,
): boolean {
  return cachedPlanDate !== todayDate;
}
