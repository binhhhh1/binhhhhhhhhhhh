import {
  DRILL_CATEGORIES,
  type AiEvaluationRecommendedDrill,
  type AiTrainingEvaluation,
  type DrillCategory,
  type EffectivenessLevel,
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

export const QUICK_REPORT_AIM_PRESETS = [
  'Range 100 Bots & Hard Bots 30 (Vandal/Sheriff)',
  'Deathmatch 3 trận (Pre-aim & Crosshair Placement)',
  'Aimlabs VT Smoothbot Tracking & Sixshot Micro',
  'Luyện Counter-strafe Deadzoning & Burst 2 viên',
  'Spray Control & Spray Transfer cự ly 15-25m',
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
  generated: GeneratedDailyDrill | AiEvaluationRecommendedDrill,
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
      ? `[AI Đề xuất · ${generated.focusTag}] ${generated.description}`
      : `[AI Đề xuất · ${generated.focusTag}]`,
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

export interface AimEvaluationInput {
  date: string;
  ownerId: string;
  playerName?: string;
  gameRole?: string;
  mainAgent?: string;
  reportedSummary: string;
  durationMin: number;
  scoreOrResult?: string;
  accuracyPct?: number;
  headshotPct?: number;
  completedDrillsCount?: number;
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
    goalTemplate: (acc) =>
      `Duy trì tâm mượt trên mục tiêu đổi hướng · Accuracy >= ${Math.max(88, acc)}%`,
    descriptionTemplate: (agent) =>
      `Giữ cổ tay thả lỏng, bám tâm liên tục theo chuyển động ngang/dọc của bot mà không giật chuột. Rất quan trọng khi ${agent} đấu súng tầm trung.`,
  },
  {
    focusTag: 'Tracking',
    category: 'Range Practice',
    titleTemplate: () => 'Valorant Range — Strafe Tracking & Moving Bots',
    baseDuration: 20,
    goalTemplate: () =>
      'Bám đầu bot di chuyển 100 mạng liên tiếp không trượt nhịp counter-strafe',
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
    goalTemplate: (acc) =>
      `Accuracy >= ${Math.min(96, acc + 2)}% · Không bắn vội khi tâm chưa khóa đầu`,
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
      `Deathmatch — Pre-aim Góc Kê Chuẩn (${role} · ${agent})`,
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
    goalTemplate: () =>
      'Kiểm soát loạt 5 viên đầu cụm gọn và chuyển mục tiêu thứ 2 dưới 450ms',
    descriptionTemplate: () =>
      'Luyện nhịp bắn 2–3 viên ngắt nghỉ (deadzone burst) ở cự ly >20m và kéo ghìm tâm chuyển mục tiêu (spray transfer) ở cự ly gần.',
  },
  {
    focusTag: 'Movement Training',
    category: 'Movement Training',
    titleTemplate: (agent) =>
      `Range & Custom — Deadzoning, Jiggle Peek & ${agent} Movement`,
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

  let currentMinutes = 9 * 60;
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

/**
 * Evaluates a player's self-reported daily Aim training session and generates:
 * - Effectiveness score (0-100) & rating
 * - Detailed coach evaluation
 * - Strengths & weaknesses
 * - Specific "What to practice next" recommendations (`whatToPracticeNext` & `recommendedDrills`)
 */
export function evaluateAimTrainingSession(
  input: AimEvaluationInput,
): AiTrainingEvaluation {
  const dateKey =
    typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date)
      ? input.date
      : new Date().toISOString().slice(0, 10);
  const playerName = (input.playerName || 'Tuyển thủ').trim() || 'Tuyển thủ';
  const role = (input.gameRole || 'Duelist').trim() || 'Duelist';
  const agent = (input.mainAgent || 'Jett').trim() || 'Jett';
  const summary = (input.reportedSummary || '').trim();
  const lower = summary.toLowerCase();

  const durationMin = Math.max(5, Math.min(360, Number(input.durationMin) || 45));
  const accuracyPct = Math.max(10, Math.min(100, Number(input.accuracyPct) || 88));
  const headshotPct = Math.max(5, Math.min(100, Number(input.headshotPct) || 35));
  const scoreOrResult =
    (input.scoreOrResult || '').trim() ||
    `Accuracy ${accuracyPct}% · Headshot ${headshotPct}%`;

  // Detect practiced components from player's self-report
  const hasRange =
    lower.includes('range') || lower.includes('bot') || lower.includes('hard');
  const hasDm =
    lower.includes('dm') ||
    lower.includes('deathmatch') ||
    lower.includes('sheriff') ||
    lower.includes('vandal') ||
    lower.includes('guardian');
  const hasTracking =
    lower.includes('track') ||
    lower.includes('smooth') ||
    lower.includes('strafe');
  const hasMicro =
    lower.includes('micro') ||
    lower.includes('sixshot') ||
    lower.includes('1w4ts') ||
    lower.includes('gridshot') ||
    lower.includes('aimlab') ||
    lower.includes('kovaak');
  const hasMovementOrSpray =
    lower.includes('spray') ||
    lower.includes('deadzone') ||
    lower.includes('burst') ||
    lower.includes('peeking') ||
    lower.includes('pre-aim') ||
    lower.includes('crosshair');

  const varietyCount = [
    hasRange,
    hasDm,
    hasTracking,
    hasMicro,
    hasMovementOrSpray,
  ].filter(Boolean).length;

  // Score calculation (0 - 100)
  const durationPoints = Math.min(35, Math.round((durationMin / 60) * 30));
  const accuracyPoints = Math.min(25, Math.max(8, Math.round((accuracyPct - 65) * 0.8)));
  const hsPoints = Math.min(25, Math.max(6, Math.round(headshotPct * 0.55)));
  const varietyPoints = Math.min(15, Math.max(5, varietyCount * 4));
  const effectivenessScore = Math.max(
    42,
    Math.min(99, durationPoints + accuracyPoints + hsPoints + varietyPoints),
  );

  const effectivenessLevel: EffectivenessLevel =
    effectivenessScore >= 88
      ? 'Xuất sắc'
      : effectivenessScore >= 76
      ? 'Hiệu quả cao'
      : effectivenessScore >= 62
      ? 'Đạt yêu cầu'
      : 'Cần cải thiện';

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const whatToPracticeNext: string[] = [];
  const missingFocusTags: string[] = [];

  if (durationMin >= 45) {
    strengths.push(
      `Thời lượng tập luyện (${durationMin} phút) đủ độ sâu để làm nóng cơ tay và duy trì muscle memory cho vị trí ${role}.`,
    );
  } else {
    weaknesses.push(
      `Thời lượng tập (${durationMin} phút) còn hơi ngắn, dễ bị hụt cảm giác tay khi bước vào loạt Scrim BO3 dài.`,
    );
    whatToPracticeNext.push(
      `Tăng tổng thời lượng tập Aim lên tối thiểu 45–60 phút/ngày (chia rõ 20p Warmup + 25p Thực chiến Deathmatch).`,
    );
  }

  if (headshotPct >= 38) {
    strengths.push(
      `Tỷ lệ Headshot (${headshotPct}%) đạt chuẩn thi đấu cao, phản ánh khả năng kê tâm ngang đầu và kỷ luật bắn viên đầu tốt.`,
    );
  } else {
    weaknesses.push(
      `Tỷ lệ Headshot (${headshotPct}%) cần cải thiện thêm để thắng các pha đấu súng 50/50 với ${agent}.`,
    );
    whatToPracticeNext.push(
      'Bổ sung 2 trận Deathmatch chỉ dùng Guardian/Sheriff (tuyệt đối không ngồi bắn, chỉ 1-tap ngang tầm đầu) để nâng HS% lên trên 40%.',
    );
    missingFocusTags.push('Crosshair Placement');
  }

  if (accuracyPct >= 90) {
    strengths.push(
      `Độ chính xác (${accuracyPct}%) rất ổn định, kiểm soát tốt nhịp dừng tâm (stop power) trước khi bóp cò.`,
    );
  } else {
    weaknesses.push(
      `Accuracy (${accuracyPct}%) cho thấy vẫn còn các pha bắn vội (over-flick) trước khi tâm thực sự khóa vào đầu mục tiêu.`,
    );
    whatToPracticeNext.push(
      'Luyện thêm bài Aimlabs VT Sixshot / Micro Adjustment chậm rãi, ưu tiên độ chính xác >= 93% trước khi tăng tốc độ vẩy.',
    );
    missingFocusTags.push('Micro Adjustment');
  }

  if (!hasTracking) {
    weaknesses.push(
      'Buổi tập hôm nay thiếu bài Tracking mục tiêu di chuyển ngang (rất dễ hụt đạn khi đối thủ jiggle peek hoặc neon/raze lướt).',
    );
    whatToPracticeNext.push(
      'Cần tập thêm: 15–20 phút Tracking (VT Smoothbot hoặc Strafe Tracking với bot di chuyển trong Range) để giữ tâm mượt hơn.',
    );
    missingFocusTags.push('Tracking');
  } else {
    strengths.push('Đã kết hợp bài tập Tracking giúp cổ tay bám mục tiêu di chuyển mượt mà.');
  }

  if (!hasDm) {
    weaknesses.push(
      'Chưa áp dụng cảm giác tay từ phòng tập vào môi trường Deathmatch có áp lực góc kê thực tế.',
    );
    whatToPracticeNext.push(
      `Cần tập thêm: 2–3 trận Deathmatch Vandal/Phantom tập trung Pre-aim các góc mở site đặc trưng của ${agent} (${role}).`,
    );
    missingFocusTags.push('Crosshair Placement');
  } else {
    strengths.push(
      'Có kết hợp bắn thực chiến Deathmatch giúp chuyển hóa cảm giác Aim sang các góc đấu súng trong map.',
    );
  }

  if (!hasMovementOrSpray) {
    whatToPracticeNext.push(
      'Cần tập thêm: 15 phút luyện Counter-strafe (A-D Deadzoning) kết hợp loạt bắn 2–3 viên ngắt nghỉ ở cự ly 20–30m.',
    );
    missingFocusTags.push('Movement Training');
  }

  if (whatToPracticeNext.length === 0) {
    whatToPracticeNext.push(
      `Duy trì bài tập Micro Adjustment cự ly xa và ôn thêm góc Pre-aim/Retake cho ${agent} trước giờ Scrim của đội.`,
    );
  }

  // Pick 3 concrete recommended drills based on what the player needs to practice next
  const targetTags =
    missingFocusTags.length > 0
      ? missingFocusTags
      : ['Micro Adjustment', 'Crosshair Placement', 'Tracking'];
  const recommendedDrills: AiEvaluationRecommendedDrill[] = [];
  const usedIdx = new Set<number>();

  for (let i = 0; i < targetTags.length && recommendedDrills.length < 3; i++) {
    const tag = targetTags[i].toLowerCase();
    const foundIdx = DRILL_LIBRARY.findIndex(
      (b, idx) => !usedIdx.has(idx) && b.focusTag.toLowerCase() === tag,
    );
    if (foundIdx >= 0) {
      usedIdx.add(foundIdx);
      const bp = DRILL_LIBRARY[foundIdx];
      recommendedDrills.push({
        id: `rec_${dateKey}_${recommendedDrills.length + 1}`,
        title: bp.titleTemplate(agent, role),
        category: bp.category,
        focusTag: bp.focusTag,
        startTime: sanitizeTime(undefined, recommendedDrills.length + 1),
        durationMin: bp.baseDuration,
        goal: bp.goalTemplate(Math.max(90, accuracyPct)),
        description: bp.descriptionTemplate(agent, role),
      });
    }
  }

  for (let i = 0; i < DRILL_LIBRARY.length && recommendedDrills.length < 3; i++) {
    if (!usedIdx.has(i)) {
      usedIdx.add(i);
      const bp = DRILL_LIBRARY[i];
      recommendedDrills.push({
        id: `rec_${dateKey}_${recommendedDrills.length + 1}`,
        title: bp.titleTemplate(agent, role),
        category: bp.category,
        focusTag: bp.focusTag,
        startTime: sanitizeTime(undefined, recommendedDrills.length + 1),
        durationMin: bp.baseDuration,
        goal: bp.goalTemplate(Math.max(90, accuracyPct)),
        description: bp.descriptionTemplate(agent, role),
      });
    }
  }

  const overallFeedback = `Đánh giá buổi tập của ${playerName} (${role} · ${agent}): Khai báo "${summary || 'Tập Aim tổng hợp'}" trong ${durationMin} phút đạt mức ${effectivenessLevel} (${effectivenessScore}/100 điểm). ${
    effectivenessScore >= 80
      ? 'Khối lượng và chỉ số bắn hôm nay đáp ứng tốt yêu cầu trước giờ Scrim, cần bổ sung thêm các bài tập chuyên sâu bên dưới để hoàn thiện độ ổn định.'
      : 'Cần bổ sung thêm các bài tập còn thiếu bên dưới để cân bằng giữa phản xạ vẩy tâm (Flick/Micro) và kỹ năng kê góc thực chiến (Pre-aim/Movement).'
  }`;

  return {
    id: `eval_${dateKey}_${Date.now()}`,
    date: dateKey,
    ownerId: input.ownerId,
    playerName,
    gameRole: role,
    mainAgent: agent,
    reportedSummary: summary || 'Luyện tập Aim hằng ngày',
    durationMin,
    scoreOrResult,
    accuracyPct,
    headshotPct,
    effectivenessScore,
    effectivenessLevel,
    overallFeedback,
    strengths: strengths.slice(0, 3),
    weaknesses:
      weaknesses.length > 0
        ? weaknesses.slice(0, 3)
        : ['Cần duy trì tốc độ phản xạ viên đầu ổn định hơn ở cuối buổi tập.'],
    whatToPracticeNext: whatToPracticeNext.slice(0, 4),
    recommendedDrills,
    evaluatedAt: new Date().toISOString(),
  };
}

export function parseAiEvaluationResponseSafely(
  rawText: string,
  fallbackInput: AimEvaluationInput,
): AiTrainingEvaluation {
  const fallback = evaluateAimTrainingSession(fallbackInput);
  const trimmed = (rawText || '').trim();
  if (!trimmed || !trimmed.startsWith('{')) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(trimmed) as Partial<AiTrainingEvaluation> & {
      recommendedDrills?: unknown;
    };
    if (
      typeof parsed.overallFeedback !== 'string' ||
      !parsed.overallFeedback.trim()
    ) {
      return fallback;
    }

    const rawScore = Number(parsed.effectivenessScore);
    const effectivenessScore = Number.isFinite(rawScore)
      ? Math.max(10, Math.min(100, Math.round(rawScore)))
      : fallback.effectivenessScore;

    const validLevels: EffectivenessLevel[] = [
      'Xuất sắc',
      'Hiệu quả cao',
      'Đạt yêu cầu',
      'Cần cải thiện',
    ];
    const effectivenessLevel: EffectivenessLevel =
      typeof parsed.effectivenessLevel === 'string' &&
      validLevels.includes(parsed.effectivenessLevel as EffectivenessLevel)
        ? (parsed.effectivenessLevel as EffectivenessLevel)
        : effectivenessScore >= 88
        ? 'Xuất sắc'
        : effectivenessScore >= 76
        ? 'Hiệu quả cao'
        : effectivenessScore >= 62
        ? 'Đạt yêu cầu'
        : 'Cần cải thiện';

    const normalizedRecs = normalizeGeneratedDrills(
      parsed.recommendedDrills,
      fallbackInput.date,
    );

    return {
      ...fallback,
      effectivenessScore,
      effectivenessLevel,
      overallFeedback: parsed.overallFeedback.trim().slice(0, 600),
      strengths:
        Array.isArray(parsed.strengths) && parsed.strengths.length > 0
          ? parsed.strengths.map((s) => String(s).trim()).filter(Boolean).slice(0, 4)
          : fallback.strengths,
      weaknesses:
        Array.isArray(parsed.weaknesses) && parsed.weaknesses.length > 0
          ? parsed.weaknesses.map((s) => String(s).trim()).filter(Boolean).slice(0, 4)
          : fallback.weaknesses,
      whatToPracticeNext:
        Array.isArray(parsed.whatToPracticeNext) &&
        parsed.whatToPracticeNext.length > 0
          ? parsed.whatToPracticeNext
              .map((s) => String(s).trim())
              .filter(Boolean)
              .slice(0, 5)
          : fallback.whatToPracticeNext,
      recommendedDrills:
        normalizedRecs.length > 0 ? normalizedRecs : fallback.recommendedDrills,
      evaluatedAt: new Date().toISOString(),
    };
  } catch {
    return fallback;
  }
}

export function buildDailyAiCacheKey(accountId: string, dateKey: string): string {
  const safeId = accountId.replace(/[^a-zA-Z0-9_-]/g, '_') || 'guest';
  return `vth_ai_daily_${safeId}_${dateKey}`;
}

export function buildDailyAiEvaluationCacheKey(
  accountId: string,
  dateKey: string,
): string {
  const safeId = accountId.replace(/[^a-zA-Z0-9_-]/g, '_') || 'guest';
  return `vth_ai_eval_v1_${safeId}_${dateKey}`;
}

export function shouldAutoGenerateDailyPlan(
  cachedPlanDate: string | null | undefined,
  todayDate: string,
): boolean {
  return cachedPlanDate !== todayDate;
}

