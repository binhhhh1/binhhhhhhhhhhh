export type NavSection =
  | 'dashboard'
  | 'daily-training'
  | 'scrim-schedule'
  | 'availability'
  | 'team-management'
  | 'performance';

export const DRILL_CATEGORIES = [
  'Aim Training',
  'Deathmatch',
  'Team Deathmatch',
  'Range Practice',
  'Movement Training',
  'Crosshair Placement',
  'Spray Control',
  'Agent Practice',
  'Map Knowledge',
  'VOD Review',
  'Game Sense',
  'Communication',
  'Scrim Review',
] as const;

export type DrillCategory = (typeof DRILL_CATEGORIES)[number];

export type DrillStatus = 'todo' | 'in_progress' | 'completed' | 'skipped';

export const AIM_PLATFORMS = [
  'Aimlabs',
  "Kovaak's",
  'Valorant Range',
  'Deathmatch',
] as const;

export type AimPlatform = (typeof AIM_PLATFORMS)[number];

export const AIM_FOCUS_AREAS = [
  'Micro Adjustment',
  'Flicking',
  'Tracking',
  'Precision',
  'Speed',
  'Crosshair Placement',
] as const;

export type AimFocusArea = (typeof AIM_FOCUS_AREAS)[number];

export type ScrimStatus = 'planned' | 'confirmed' | 'live' | 'completed' | 'cancelled';

export const GAME_ROLES = [
  'Duelist',
  'Initiator',
  'Controller',
  'Sentinel',
  'Flex',
] as const;

export type GameRole = (typeof GAME_ROLES)[number];

export type TeamRole = 'coach' | 'player';

export type ScrimMemberStatus = 'ready' | 'sub' | 'unavailable';

export const VALORANT_MAPS = [
  'Ascent',
  'Bind',
  'Haven',
  'Split',
  'Lotus',
  'Sunset',
  'Abyss',
  'Icebox',
  'Breeze',
  'Fracture',
  'Pearl',
] as const;

export const VALORANT_SERVERS = [
  'Singapore',
  'Hong Kong',
  'Tokyo',
  'Sydney',
  'Mumbai',
] as const;

export interface TrainingDrill {
  id: string;
  teamId: string;
  teamOwnerId: string;
  ownerId: string;
  assignedBy: string;
  title: string;
  category: DrillCategory;
  date: string; // YYYY-MM-DD (Asia/Ho_Chi_Minh)
  startTime: string; // HH:mm
  durationMin: number;
  goal?: string;
  description?: string;
  status: DrillStatus;
  actualResult?: string;
  notes?: string;
  proofUrl?: string;
  proofImageDataUrl?: string;
  proofUploadedAt?: string;
  proofNote?: string;
  proofVerified?: boolean;
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type AimProofType = 'screenshot' | 'video' | 'link';

export interface AimLog {
  id: string;
  teamId: string;
  teamOwnerId: string;
  ownerId: string;
  date: string;
  exerciseName: string;
  platform: AimPlatform;
  focusArea: AimFocusArea;
  durationMin: number;
  score: number;
  accuracy: number;
  notes?: string;
  proofUrl?: string;
  proofImageDataUrl?: string;
  proofUploadedAt?: string;
  proofType?: AimProofType;
  proofNote?: string;
  proofVerified?: boolean;
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Scrim {
  id: string;
  teamId: string;
  teamOwnerId: string;
  createdBy: string;
  opponent: string;
  date: string;
  startTime: string;
  endTime: string;
  mapCount: number;
  maps: string[];
  server: string;
  status: ScrimStatus;
  notes?: string;
  vodUrl?: string;
  mapResultsText?: string;
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AvailabilitySlot {
  id: string;
  teamId: string;
  teamOwnerId: string;
  ownerId: string;
  memberName: string;
  date: string;
  startTime: string;
  endTime: string;
  slotType: 'available' | 'busy';
  notes?: string;
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplateDrillItem {
  title: string;
  category: DrillCategory;
  startTime: string;
  durationMin: number;
  goal?: string;
  description?: string;
}

export interface TrainingTemplate {
  id: string;
  teamId: string;
  teamOwnerId: string;
  ownerId: string;
  name: string;
  description?: string;
  items: TemplateDrillItem[];
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeamMember {
  uid: string;
  teamOwnerId: string;
  displayName: string;
  riotId: string;
  teamRole: TeamRole;
  gameRole: GameRole;
  mainAgent: string;
  scrimStatus: ScrimMemberStatus;
  username?: string;
  managedBy?: string;
  managedByName?: string;
  isDemo?: boolean;
  joinedAt?: string;
  updatedAt?: string;
}

export type NotificationType =
  | 'drill_due'
  | 'scrim_upcoming'
  | 'scrim_created'
  | 'scrim_updated'
  | 'availability_updated'
  | 'drill_assigned';

export interface TeamNotification {
  id: string;
  teamId: string;
  teamOwnerId: string;
  actorId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  isDemo?: boolean;
  createdAt: string;
}

export interface TeamWorkspace {
  id: string;
  name: string;
  tag: string;
  ownerId: string;
  weeklyGoalHours: number;
  isDemo?: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  riotId: string;
  gameRole: GameRole;
  mainAgent: string;
  activeTeamId?: string;
}

export type DataSourceMode = 'local_account' | 'cloud';

export interface GeneratedDailyDrill {
  id: string;
  title: string;
  category: DrillCategory;
  focusTag: string;
  startTime: string;
  durationMin: number;
  goal: string;
  description: string;
}

export interface AiDailyPlan {
  date: string;
  focusAreas: string[];
  coachNote: string;
  generatedAt: string;
  drills: GeneratedDailyDrill[];
}

export type EffectivenessLevel =
  | 'Xuất sắc'
  | 'Hiệu quả cao'
  | 'Đạt yêu cầu'
  | 'Cần cải thiện';

export interface AiEvaluationRecommendedDrill {
  id: string;
  title: string;
  category: DrillCategory;
  focusTag: string;
  startTime: string;
  durationMin: number;
  goal: string;
  description: string;
}

export interface AiTrainingEvaluation {
  id: string;
  date: string;
  ownerId: string;
  playerName: string;
  gameRole: string;
  mainAgent: string;
  reportedSummary: string;
  durationMin: number;
  scoreOrResult: string;
  accuracyPct: number;
  headshotPct: number;
  effectivenessScore: number;
  effectivenessLevel: EffectivenessLevel;
  overallFeedback: string;
  strengths: string[];
  weaknesses: string[];
  whatToPracticeNext: string[];
  recommendedDrills: AiEvaluationRecommendedDrill[];
  evaluatedAt: string;
}


