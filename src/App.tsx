import React, { useCallback, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { AuthModal, type AuthModalSubmitPayload } from './components/auth/AuthModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationDrawer } from './components/layout/NotificationDrawer';
import { Sidebar } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { AvailabilityView } from './components/views/AvailabilityView';
import { DailyTrainingView, type DailyTrainingTab } from './components/views/DailyTrainingView';
import { DashboardView } from './components/views/DashboardView';
import { PerformanceView } from './components/views/PerformanceView';
import { ScrimScheduleView } from './components/views/ScrimScheduleView';
import {
  TeamManagementView,
  type CreateManagedPlayerInput,
} from './components/views/TeamManagementView';
import type { HubDataset } from './data/demoSeed';
import { auth, testConnection } from './services/firebase';
import {
  ACCOUNTS_KEY,
  buildProfileFromAccount,
  createManagedPlayerByManager,
  deleteManagedPlayerByManager,
  getActiveLocalSession,
  getLocalRevision,
  listLocalAccountIdentifiers,
  loadUnifiedWorkspace,
  loginLocalAccount,
  logoutLocalAccount,
  pullUnifiedStateFromServer,
  registerPlayerWithManagerAuth,
  saveUnifiedWorkspace,
  subscribeToUnifiedCloudHub,
  UNIFIED_HUB_DB_KEY,
  updateManagedMemberByManager,
  type CloudHubSyncStatus,
  type LocalAccountRecord,
} from './services/localAuth';
import {
  createClientId,
  deleteAimLogFromFirestore,
  deleteAvailabilityFromFirestore,
  deleteDrillFromFirestore,
  deleteScrimFromFirestore,
  deleteTeamMemberFromFirestore,
  ensureUserAndTeamWorkspace,
  saveAimLogToFirestore,
  saveAvailabilityToFirestore,
  saveDrillToFirestore,
  saveNotificationToFirestore,
  saveScrimToFirestore,
  saveTeamMemberToFirestore,
  saveTemplateToFirestore,
  subscribeTeamWorkspaceData,
  verifyAimProofInFirestore,
  verifyDrillProofInFirestore,
} from './services/firestoreSync';
import type {
  AiTrainingEvaluation,
  AimLog,
  AvailabilitySlot,
  DataSourceMode,
  NavSection,
  Scrim,
  TeamMember,
  TeamNotification,
  TeamRole,
  TeamWorkspace,
  TrainingDrill,
  TrainingTemplate,
  UserProfile,
} from './types/training';
import {
  buildDailyAiEvaluationCacheKey,
  evaluateAimTrainingSession,
  parseAiEvaluationResponseSafely,
} from './utils/aiDrills';
import {
  getLocalProofImage,
  removeLocalProofImage,
  saveLocalProofImage,
} from './utils/aimProof';
import { computeAimAnalytics } from './utils/analytics';
import { getVNDateKey, getVNTimeStr } from './utils/timezone';

function AppShell() {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [dailyTab, setDailyTab] = useState<DailyTrainingTab>('drills');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const handleNavigate = (section: NavSection, subTab?: DailyTrainingTab) => {
    setActiveSection(section);
    if (section === 'daily-training' && subTab) {
      setDailyTab(subTab);
    }
  };

  const [initialLocal] = useState(() => getActiveLocalSession());
  const [dataMode, setDataMode] = useState<DataSourceMode>('local_account');
  const [localAccount, setLocalAccount] = useState<LocalAccountRecord | null>(
    initialLocal?.session.account ?? null,
  );
  const [localProfile, setLocalProfile] = useState<UserProfile | null>(
    initialLocal?.session.profile ?? null,
  );
  const [unifiedData, setUnifiedData] = useState<HubDataset>(() =>
    initialLocal?.dataset ?? loadUnifiedWorkspace(),
  );
  const [savedAccountsList, setSavedAccountsList] = useState(() =>
    listLocalAccountIdentifiers(),
  );
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudHubSyncStatus>(() => ({
    connected: true,
    syncing: false,
    revision: getLocalRevision(),
    lastSyncedAt: null,
    updatedBy: 'system',
  }));

  // Auth & Cloud state
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [verifyNotice, setVerifyNotice] = useState('');
  const [cloudProfile, setCloudProfile] = useState<UserProfile | null>(null);
  const [cloudTeam, setCloudTeam] = useState<TeamWorkspace | null>(null);
  const [cloudMembers, setCloudMembers] = useState<TeamMember[]>([]);
  const [cloudDrills, setCloudDrills] = useState<TrainingDrill[]>([]);
  const [cloudAimLogs, setCloudAimLogs] = useState<AimLog[]>([]);
  const [cloudScrims, setCloudScrims] = useState<Scrim[]>([]);
  const [cloudAvailabilities, setCloudAvailabilities] = useState<AvailabilitySlot[]>([]);
  const [cloudTemplates, setCloudTemplates] = useState<TrainingTemplate[]>([]);
  const [cloudNotifications, setCloudNotifications] = useState<TeamNotification[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);

  // Daily AI Evaluation state
  const [aiEvaluation, setAiEvaluation] = useState<AiTrainingEvaluation | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const handleForceCloudSync = useCallback(async () => {
    setCloudSyncStatus((prev) => ({ ...prev, syncing: true }));
    const synced = await pullUnifiedStateFromServer();
    if (synced) {
      setUnifiedData(synced.dataset);
      setSavedAccountsList(listLocalAccountIdentifiers());
      setLocalAccount((prevAcc) => {
        if (!prevAcc) return null;
        const updatedAcc = synced.accounts.find((a) => a.uid === prevAcc.uid);
        if (!updatedAcc) {
          logoutLocalAccount();
          setLocalProfile(null);
          return null;
        }
        setLocalProfile(buildProfileFromAccount(updatedAcc));
        return updatedAcc;
      });
      setCloudSyncStatus({
        connected: true,
        syncing: false,
        revision: synced.revision || getLocalRevision(),
        lastSyncedAt: new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        updatedBy: synced.updatedBy || 'cloud',
      });
    } else {
      setCloudSyncStatus((prev) => ({ ...prev, syncing: false }));
    }
  }, []);

  // Startup Firestore connectivity check & Real-time Cross-Computer Cloud Firestore Subscription
  useEffect(() => {
    void testConnection();
    void handleForceCloudSync();

    const unsubCloudHub = subscribeToUnifiedCloudHub({
      onWorkspaceUpdate: ({ accounts, dataset, status }) => {
        setUnifiedData(dataset);
        setSavedAccountsList(listLocalAccountIdentifiers());
        setCloudSyncStatus(status);
        setLocalAccount((prevAcc) => {
          if (!prevAcc) return null;
          const updatedAcc = accounts.find((a) => a.uid === prevAcc.uid);
          if (!updatedAcc) {
            logoutLocalAccount();
            setLocalProfile(null);
            return null;
          }
          setLocalProfile(buildProfileFromAccount(updatedAcc));
          return updatedAcc;
        });
      },
      onStatusChange: (status) => {
        setCloudSyncStatus(status);
      },
    });

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void handleForceCloudSync();
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      unsubCloudHub();
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [handleForceCloudSync]);

  // Listen for cross-tab unified database changes
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === UNIFIED_HUB_DB_KEY || e.key === ACCOUNTS_KEY) {
        setUnifiedData(loadUnifiedWorkspace());
        setSavedAccountsList(listLocalAccountIdentifiers());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Firebase Auth & Firestore Subscription
  useEffect(() => {
    let unsubData: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubData) {
        unsubData();
        unsubData = null;
      }

      if (!user) {
        setCloudProfile(null);
        setCloudTeam(null);
        setDataMode('local_account');
        setAuthReady(true);
        setCloudLoading(false);
        return;
      }

      if (!user.emailVerified) {
        setVerifyNotice(
          `Email ${user.email} chưa được xác minh. Vui lòng kiểm tra hộp thư để xác minh trước khi đồng bộ Cloud Firestore (hoặc đăng nhập bằng tài khoản đội tuyển).`,
        );
        setAuthReady(true);
        setCloudLoading(false);
        return;
      }

      setVerifyNotice('');
      setCloudLoading(true);
      setAuthError('');
      try {
        const { profile, team } = await ensureUserAndTeamWorkspace(user);
        setCloudProfile(profile);
        setCloudTeam(team);
        setDataMode('cloud');
        setAuthReady(true);

        unsubData = subscribeTeamWorkspaceData({
          teamId: team.id,
          teamOwnerId: team.ownerId,
          onMembers: setCloudMembers,
          onDrills: setCloudDrills,
          onAimLogs: setCloudAimLogs,
          onScrims: setCloudScrims,
          onAvailabilities: setCloudAvailabilities,
          onTemplates: setCloudTemplates,
          onNotifications: setCloudNotifications,
        });
      } catch (err) {
        setAuthError(
          err instanceof Error
            ? err.message
            : 'Không thể khởi tạo dữ liệu Cloud Firestore.',
        );
      } finally {
        setCloudLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubData) unsubData();
    };
  }, []);

  // Persist changes to the single Unified Team Database
  const updateUnifiedDb = (updater: (prev: HubDataset) => HubDataset) => {
    setUnifiedData((prev) => {
      const next = updater(prev);
      return saveUnifiedWorkspace(next);
    });
    setSavedAccountsList(listLocalAccountIdentifiers());
  };

  // Active resolved state
  const isCloud = dataMode === 'cloud' && cloudTeam !== null && cloudProfile !== null;
  const isLocalAccount = dataMode === 'local_account' && localAccount !== null;
  const isAuthenticated = isCloud || isLocalAccount;
  const userProfile = isCloud ? cloudProfile : isLocalAccount ? localProfile : null;

  const team = isCloud ? cloudTeam : unifiedData.team;
  const members = isCloud ? cloudMembers : unifiedData.members;
  const rawDrills = isCloud ? cloudDrills : unifiedData.drills;
  const drills = isCloud
    ? rawDrills.map((d) => {
        const cachedImg = getLocalProofImage(`drill_${d.id}`);
        return cachedImg && !d.proofImageDataUrl
          ? { ...d, proofImageDataUrl: cachedImg }
          : d;
      })
    : rawDrills;
  const rawAimLogs = isCloud ? cloudAimLogs : unifiedData.aimLogs;
  const aimLogs = isCloud
    ? rawAimLogs.map((l) => {
        const cachedImg = getLocalProofImage(l.id);
        return cachedImg && !l.proofImageDataUrl
          ? { ...l, proofImageDataUrl: cachedImg }
          : l;
      })
    : rawAimLogs;
  const scrims = isCloud ? cloudScrims : unifiedData.scrims;
  const availabilities = isCloud ? cloudAvailabilities : unifiedData.availabilities;
  const templates = isCloud ? cloudTemplates : unifiedData.templates;
  const notifications = isCloud ? cloudNotifications : unifiedData.notifications;

  const currentUserId = isCloud
    ? cloudProfile.uid
    : isLocalAccount
    ? localAccount.uid
    : '';

  const currentMemberName = isCloud
    ? cloudProfile.displayName
    : isLocalAccount
    ? localAccount.displayName
    : '';

  const activeRole: TeamRole = isCloud
    ? members.find((m) => m.uid === cloudProfile.uid)?.teamRole ||
      (cloudTeam.ownerId === cloudProfile.uid ? 'coach' : 'player')
    : isLocalAccount
    ? localAccount.teamRole
    : 'player';

  const todayDateKey = getVNDateKey();
  const activeAccountKey = currentUserId || 'anonymous';

  // Load cached AI Evaluation for current account & today's VN date
  useEffect(() => {
    if (!isAuthenticated) {
      setAiEvaluation(null);
      return;
    }
    const cacheKey = buildDailyAiEvaluationCacheKey(activeAccountKey, todayDateKey);
    try {
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as AiTrainingEvaluation;
        if (cached && cached.date === todayDateKey && Array.isArray(cached.whatToPracticeNext)) {
          setAiEvaluation(cached);
          setAiError('');
          return;
        }
      }
    } catch {
      // ignore invalid cache
    }
    setAiEvaluation(null);
  }, [activeAccountKey, isAuthenticated, todayDateKey]);

  const handleSubmitAiEvaluation = useCallback(
    async (payload: {
      reportedSummary: string;
      durationMin: number;
      accuracyPct?: number;
      headshotPct?: number;
      scoreOrResult?: string;
      proofImageDataUrl?: string;
      proofUploadedAt?: string;
    }) => {
      if (!isAuthenticated) return;
      const cacheKey = buildDailyAiEvaluationCacheKey(activeAccountKey, todayDateKey);
      const aimStats = computeAimAnalytics(aimLogs, todayDateKey);
      const currentMember = members.find((m) => m.uid === currentUserId);
      const evalInput = {
        date: todayDateKey,
        ownerId: currentUserId,
        playerName: currentMemberName || 'Tuyển thủ',
        gameRole: userProfile?.gameRole || currentMember?.gameRole || 'Duelist',
        mainAgent: userProfile?.mainAgent || currentMember?.mainAgent || 'Jett',
        reportedSummary: payload.reportedSummary,
        durationMin: payload.durationMin,
        accuracyPct: payload.accuracyPct,
        headshotPct: payload.headshotPct,
        scoreOrResult: payload.scoreOrResult,
        recentStats: {
          avgAccuracy: aimStats.weekOverWeek.thisWeekAvgAccuracy,
          lastScore:
            aimStats.dailyScoreSeries[aimStats.dailyScoreSeries.length - 1]?.value ??
            aimStats.highScore ??
            0,
          totalSessions: aimLogs.length,
        },
      };

      setAiLoading(true);
      setAiError('');

      // Record a completed TrainingDrill for the player's self-reported Aim session today
      const nowTime = getVNTimeStr();
      const reportedDrill: TrainingDrill = {
        id: createClientId('drill_report'),
        teamId: team.id,
        teamOwnerId: team.ownerId,
        ownerId: currentUserId,
        assignedBy: currentUserId,
        title: `Khai báo tập Aim: ${payload.reportedSummary.slice(0, 65)}`,
        category: 'Aim Training',
        date: todayDateKey,
        startTime: nowTime,
        durationMin: Math.max(5, Math.min(360, Number(payload.durationMin) || 45)),
        goal: payload.scoreOrResult || 'Tự khai báo & đánh giá bằng AI',
        actualResult: [
          payload.scoreOrResult,
          payload.accuracyPct ? `Acc ${payload.accuracyPct}%` : '',
          payload.headshotPct ? `HS ${payload.headshotPct}%` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        description: payload.reportedSummary,
        status: 'completed',
        proofImageDataUrl: payload.proofImageDataUrl,
        proofUploadedAt: payload.proofUploadedAt,
        proofVerified: false,
      };

      if (isCloud) {
        if (reportedDrill.proofImageDataUrl) {
          saveLocalProofImage(`drill_${reportedDrill.id}`, reportedDrill.proofImageDataUrl);
        }
        await saveDrillToFirestore(reportedDrill, true);
      } else {
        updateUnifiedDb((prev) => ({
          ...prev,
          drills: [{ ...reportedDrill, isDemo: false }, ...prev.drills],
        }));
      }

      try {
        const res = await fetch('/api/ai/evaluate-training', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(evalInput),
        });
        const rawText = await res.text();
        const evaluation = parseAiEvaluationResponseSafely(rawText, evalInput);
        setAiEvaluation(evaluation);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(evaluation));
        } catch {
          // ignore storage quota
        }
      } catch {
        const fallbackEval = evaluateAimTrainingSession(evalInput);
        setAiEvaluation(fallbackEval);
        setAiError('');
        try {
          localStorage.setItem(cacheKey, JSON.stringify(fallbackEval));
        } catch {
          // ignore storage quota
        }
      } finally {
        setAiLoading(false);
      }
    },
    [
      activeAccountKey,
      aimLogs,
      currentMemberName,
      currentUserId,
      isAuthenticated,
      isCloud,
      members,
      team.id,
      team.ownerId,
      todayDateKey,
      userProfile?.gameRole,
      userProfile?.mainAgent,
    ],
  );

  // Auth Actions
  const handleAuthSubmit = async (payload: AuthModalSubmitPayload) => {
    setAuthBusy(true);
    setAuthError('');
    try {
      if (payload.useCloudSync && payload.mode === 'login') {
        if (!payload.identifier.includes('@')) {
          throw new Error(
            'Đồng bộ Cloud Firebase yêu cầu nhập địa chỉ Email hợp lệ. Hoặc bỏ chọn đồng bộ Cloud để đăng nhập bằng tài khoản đội tuyển.',
          );
        }
        const cred = await signInWithEmailAndPassword(
          auth,
          payload.identifier.trim(),
          payload.password,
        );
        if (!cred.user.emailVerified) {
          await sendEmailVerification(cred.user);
          setVerifyNotice(
            `Email ${cred.user.email} chưa xác minh. Đã gửi lại link xác minh tới hộp thư của bạn.`,
          );
        }
        return;
      }

      if (payload.useCloudSync && payload.mode === 'register') {
        if (!payload.identifier.includes('@')) {
          throw new Error('Đồng bộ Cloud Firebase yêu cầu địa chỉ Email hợp lệ.');
        }
        const cred = await createUserWithEmailAndPassword(
          auth,
          payload.identifier.trim(),
          payload.password,
        );
        if (payload.displayName?.trim()) {
          await updateProfile(cred.user, {
            displayName: payload.displayName.trim(),
          });
        }
        await sendEmailVerification(cred.user);
        setVerifyNotice(
          `Đã tạo tài khoản Cloud (${cred.user.email}) và gửi email xác minh.`,
        );
        return;
      }

      if (payload.mode === 'register') {
        const { session, dataset } = await registerPlayerWithManagerAuth({
          managerIdentifier: payload.managerIdentifier || '',
          managerPassword: payload.managerPassword || '',
          identifier: payload.identifier,
          password: payload.password,
          displayName: payload.displayName || '',
          riotId: payload.riotId || '',
          gameRole: payload.gameRole || 'Duelist',
          mainAgent: payload.mainAgent || 'Jett',
        });
        setLocalAccount(session.account);
        setLocalProfile(session.profile);
        setUnifiedData(dataset);
        setSavedAccountsList(listLocalAccountIdentifiers());
        setDataMode('local_account');
      } else {
        const { session, dataset } = await loginLocalAccount(
          payload.identifier,
          payload.password,
        );
        setLocalAccount(session.account);
        setLocalProfile(session.profile);
        setUnifiedData(dataset);
        setSavedAccountsList(listLocalAccountIdentifiers());
        setDataMode('local_account');
      }
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/operation-not-allowed') {
        setAuthError(
          'Firebase Console chưa bật phương thức Email/Password. Hãy bỏ tích "Đồng bộ Cloud" để đăng nhập vào hệ thống Database đội tuyển.',
        );
      } else {
        setAuthError(
          err instanceof Error ? err.message : 'Không thể xác thực tài khoản.',
        );
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (isCloud || auth.currentUser) {
      await signOut(auth);
    }
    logoutLocalAccount();
    setLocalAccount(null);
    setLocalProfile(null);
    setVerifyNotice('');
    setAuthError('');
    setDataMode('local_account');
  };

  // Helper to emit a notification into the unified database
  const pushNotification = async (
    type: TeamNotification['type'],
    title: string,
    message: string,
  ) => {
    const notif: TeamNotification = {
      id: createClientId('notif'),
      teamId: team.id,
      teamOwnerId: team.ownerId,
      actorId: currentUserId,
      type,
      title,
      message,
      read: false,
      isDemo: false,
      createdAt: `${getVNDateKey()}T${getVNTimeStr()}:00+07:00`,
    };
    if (isCloud) {
      await saveNotificationToFirestore(notif, true);
    } else {
      updateUnifiedDb((prev) => ({
        ...prev,
        notifications: [notif, ...prev.notifications],
      }));
    }
  };

  // --- Handlers wired to Unified Team Database & Cloud Firestore ---
  const handleSaveDrill = async (drill: TrainingDrill, isNew: boolean) => {
    if (isCloud) {
      saveLocalProofImage(`drill_${drill.id}`, drill.proofImageDataUrl || '');
      await saveDrillToFirestore(drill, isNew);
    } else {
      updateUnifiedDb((prev) => ({
        ...prev,
        drills: isNew
          ? [{ ...drill, isDemo: false }, ...prev.drills]
          : prev.drills.map((d) =>
              d.id === drill.id ? { ...drill, isDemo: false } : d,
            ),
      }));
    }
  };

  const handleVerifyDrillProof = async (drillId: string, verified: boolean) => {
    if (activeRole !== 'coach') return;
    if (isCloud) {
      await verifyDrillProofInFirestore(team.id, drillId, verified);
    } else {
      updateUnifiedDb((prev) => ({
        ...prev,
        drills: prev.drills.map((d) =>
          d.id === drillId ? { ...d, proofVerified: verified } : d,
        ),
      }));
    }
  };

  const handleDeleteDrill = async (drillId: string) => {
    const targetDrill = drills.find((d) => d.id === drillId);
    if (!targetDrill) return;
    // Players cannot delete drills assigned to them by Manager
    if (activeRole !== 'coach' && targetDrill.assignedBy !== currentUserId) {
      return;
    }
    removeLocalProofImage(`drill_${drillId}`);
    if (isCloud) {
      await deleteDrillFromFirestore(team.id, drillId);
    } else {
      updateUnifiedDb((prev) => ({
        ...prev,
        drills: prev.drills.filter((d) => d.id !== drillId),
      }));
    }
  };

  const handleDuplicateDrill = async (drill: TrainingDrill) => {
    const copy: TrainingDrill = {
      ...drill,
      id: createClientId('drill'),
      title: `${drill.title} (Bản sao)`,
      status: 'todo',
      actualResult: '',
      notes: '',
    };
    await handleSaveDrill(copy, true);
  };

  const handleApplyTemplate = async (tpl: TrainingTemplate, targetDate: string) => {
    for (let i = 0; i < tpl.items.length; i++) {
      const item = tpl.items[i];
      const newDrill: TrainingDrill = {
        id: createClientId(`drill_${i}`),
        teamId: team.id,
        teamOwnerId: team.ownerId,
        ownerId: currentUserId,
        assignedBy: currentUserId,
        title: item.title,
        category: item.category,
        date: targetDate,
        startTime: item.startTime,
        durationMin: item.durationMin,
        goal: item.goal || '',
        description: item.description || '',
        status: 'todo',
      };
      await handleSaveDrill(newDrill, true);
    }
  };

  const handleSaveTemplate = async (tpl: TrainingTemplate) => {
    if (isCloud) {
      await saveTemplateToFirestore(tpl, true);
    } else {
      updateUnifiedDb((prev) => ({
        ...prev,
        templates: [tpl, ...prev.templates],
      }));
    }
  };

  const handleSaveAimLog = async (log: AimLog, isNew: boolean) => {
    if (isCloud) {
      saveLocalProofImage(log.id, log.proofImageDataUrl || '');
      await saveAimLogToFirestore(log, isNew);
    } else {
      updateUnifiedDb((prev) => ({
        ...prev,
        aimLogs: isNew
          ? [{ ...log, isDemo: false }, ...prev.aimLogs]
          : prev.aimLogs.map((l) =>
              l.id === log.id ? { ...log, isDemo: false } : l,
            ),
      }));
    }
  };

  const handleVerifyAimProof = async (logId: string, verified: boolean) => {
    if (activeRole !== 'coach') return;
    if (isCloud) {
      await verifyAimProofInFirestore(team.id, logId, verified);
    } else {
      updateUnifiedDb((prev) => ({
        ...prev,
        aimLogs: prev.aimLogs.map((l) =>
          l.id === logId ? { ...l, proofVerified: verified } : l,
        ),
      }));
    }
  };

  const handleDeleteAimLog = async (logId: string) => {
    removeLocalProofImage(logId);
    if (isCloud) {
      await deleteAimLogFromFirestore(team.id, logId);
    } else {
      updateUnifiedDb((prev) => ({
        ...prev,
        aimLogs: prev.aimLogs.filter((l) => l.id !== logId),
      }));
    }
  };

  const handleSaveScrim = async (scrim: Scrim, isNew: boolean) => {
    if (activeRole !== 'coach') return;
    if (isCloud) {
      await saveScrimToFirestore(scrim, isNew);
    } else {
      updateUnifiedDb((prev) => ({
        ...prev,
        scrims: isNew
          ? [{ ...scrim, isDemo: false }, ...prev.scrims]
          : prev.scrims.map((s) => (s.id === scrim.id ? scrim : s)),
      }));
    }
    await pushNotification(
      isNew ? 'scrim_created' : 'scrim_updated',
      isNew ? 'Lịch Scrim mới' : 'Lịch Scrim đã cập nhật',
      `vs ${scrim.opponent} · ${scrim.date} ${scrim.startTime}–${scrim.endTime} (${scrim.status}).`,
    );
  };

  const handleDeleteScrim = async (scrimId: string) => {
    if (activeRole !== 'coach') return;
    if (isCloud) {
      await deleteScrimFromFirestore(team.id, scrimId);
    } else {
      updateUnifiedDb((prev) => ({
        ...prev,
        scrims: prev.scrims.filter((s) => s.id !== scrimId),
      }));
    }
  };

  const handleSaveAvailability = async (slot: AvailabilitySlot, isNew: boolean) => {
    if (isCloud) {
      await saveAvailabilityToFirestore(slot, isNew);
    } else {
      updateUnifiedDb((prev) => ({
        ...prev,
        availabilities: isNew
          ? [{ ...slot, isDemo: false }, ...prev.availabilities]
          : prev.availabilities.map((a) => (a.id === slot.id ? slot : a)),
      }));
    }
    await pushNotification(
      'availability_updated',
      'Cập nhật lịch trống',
      `${slot.memberName} đã đăng ký ${slot.slotType === 'available' ? 'rảnh' : 'bận'} (${slot.date} ${slot.startTime}–${slot.endTime}).`,
    );
  };

  const handleDeleteAvailability = async (slotId: string) => {
    if (isCloud) {
      await deleteAvailabilityFromFirestore(team.id, slotId);
    } else {
      updateUnifiedDb((prev) => ({
        ...prev,
        availabilities: prev.availabilities.filter((a) => a.id !== slotId),
      }));
    }
  };

  // Strictly Manager-only player creation into Unified Database
  const handleAddManagedPlayer = async (input: CreateManagedPlayerInput) => {
    if (activeRole !== 'coach') {
      throw new Error('Chỉ tài khoản có quyền Manager mới được phép thêm tuyển thủ.');
    }
    if (isCloud) {
      const member: TeamMember = {
        uid: `player_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        teamOwnerId: team.ownerId,
        displayName: input.displayName,
        riotId: input.riotId,
        teamRole: 'player',
        gameRole: input.gameRole,
        mainAgent: input.mainAgent,
        scrimStatus: 'ready',
        username: input.identifier,
        managedBy: currentUserId,
        managedByName: currentMemberName,
      };
      await saveTeamMemberToFirestore(team.id, member, true);
    } else {
      const { dataset } = await createManagedPlayerByManager({
        managerUid: currentUserId,
        identifier: input.identifier,
        password: input.password,
        displayName: input.displayName,
        riotId: input.riotId,
        gameRole: input.gameRole,
        mainAgent: input.mainAgent,
      });
      setUnifiedData(dataset);
      setSavedAccountsList(listLocalAccountIdentifiers());
    }
    await pushNotification(
      'drill_assigned',
      'Tuyển thủ mới gia nhập đội',
      `Manager ${currentMemberName} đã thêm tuyển thủ ${input.displayName} (${input.riotId}) vào đội hình.`,
    );
  };

  const handleSaveMember = async (
    member: TeamMember,
    isNew: boolean,
    newPassword?: string,
  ) => {
    if (activeRole !== 'coach') {
      throw new Error('Chỉ quyền Manager mới được phép chỉnh sửa tuyển thủ.');
    }
    if (isCloud) {
      await saveTeamMemberToFirestore(team.id, member, isNew);
    } else {
      const nextDataset = await updateManagedMemberByManager({
        actorUid: currentUserId,
        member,
        newPassword,
      });
      setUnifiedData(nextDataset);
      setSavedAccountsList(listLocalAccountIdentifiers());
    }
  };

  const handleDeleteMember = async (memberUid: string) => {
    if (activeRole !== 'coach') {
      throw new Error('Chỉ quyền Manager mới được phép xóa tuyển thủ.');
    }
    if (memberUid === team.ownerId || memberUid === currentUserId) {
      return;
    }
    if (isCloud) {
      await deleteTeamMemberFromFirestore(team.id, memberUid);
    } else {
      const nextDataset = deleteManagedPlayerByManager({
        actorUid: currentUserId,
        targetUid: memberUid,
      });
      setUnifiedData(nextDataset);
      setSavedAccountsList(listLocalAccountIdentifiers());
    }
  };

  const handleAssignDrill = async (drill: TrainingDrill) => {
    if (activeRole !== 'coach') return;
    await handleSaveDrill(drill, true);
    const targetName =
      members.find((m) => m.uid === drill.ownerId)?.displayName || 'Tuyển thủ';
    await pushNotification(
      'drill_assigned',
      'Bài tập bắt buộc từ Manager',
      `Manager ${currentMemberName} đã giao "${drill.title}" (${drill.durationMin}m) cho ${targetName}.`,
    );
  };

  const handleMarkNotifRead = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target) return;
    if (isCloud) {
      await saveNotificationToFirestore({ ...target, read: true }, false);
    } else {
      updateUnifiedDb((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n,
        ),
      }));
    }
  };

  const handleMarkAllNotifsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (isCloud) {
      await Promise.all(
        unread.map((n) => saveNotificationToFirestore({ ...n, read: true }, false)),
      );
    } else {
      updateUnifiedDb((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => ({ ...n, read: true })),
      }));
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Authentication Gate: When no session is active, render full-page Login / Manager Player Provisioning screen
  if (!isAuthenticated) {
    return (
      <>
        {verifyNotice && (
          <div className="bg-amber-500/20 border-b border-amber-400/40 px-4 py-2.5 text-xs text-amber-100 flex items-center justify-between gap-3">
            <span>{verifyNotice}</span>
            <button
              type="button"
              onClick={() => setVerifyNotice('')}
              className="text-white underline shrink-0"
            >
              Đóng
            </button>
          </div>
        )}
        <AuthModal
          open={true}
          fullPage={true}
          busy={authBusy}
          error={authError}
          cloudSyncStatus={cloudSyncStatus}
          onForceCloudSync={handleForceCloudSync}
          savedAccounts={savedAccountsList}
          onClearError={() => setAuthError('')}
          onSubmit={handleAuthSubmit}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#090B10] text-slate-100 flex">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        team={team}
        dataMode={dataMode}
        activeRole={activeRole}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopHeader
          activeSection={activeSection}
          unreadNotifications={unreadCount}
          onOpenNotifications={() => setNotificationsOpen(true)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          dataMode={dataMode}
          userProfile={userProfile}
          activeRole={activeRole}
          isAdminAccount={Boolean(isLocalAccount && localAccount?.isAdmin)}
          cloudSyncStatus={cloudSyncStatus}
          onForceCloudSync={handleForceCloudSync}
          onSignOut={handleSignOut}
        />

        <main className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto space-y-5">
          {verifyNotice && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-xs text-amber-100 flex items-center justify-between gap-3">
              <span>{verifyNotice}</span>
              <button
                type="button"
                onClick={() => setVerifyNotice('')}
                className="text-white underline shrink-0"
              >
                Đóng
              </button>
            </div>
          )}

          {authError && (
            <div className="p-3.5 rounded-xl bg-[#FF4655]/15 border border-[#FF4655]/40 text-xs text-red-200 flex items-center justify-between gap-3">
              <span>{authError}</span>
              <button
                type="button"
                onClick={() => setAuthError('')}
                className="text-white underline shrink-0"
              >
                Đóng
              </button>
            </div>
          )}

          {cloudLoading && !authReady ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-xl bg-[#121621] border border-white/[0.06] animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              {activeSection === 'dashboard' && (
                <DashboardView
                  team={team}
                  dataMode={dataMode}
                  drills={drills}
                  aimLogs={aimLogs}
                  scrims={scrims}
                  availabilities={availabilities}
                  activeOwnerId={activeRole === 'player' ? currentUserId : undefined}
                  aiEvaluation={aiEvaluation}
                  aiLoading={aiLoading}
                  onNavigate={handleNavigate}
                  onToggleDrillComplete={(drill) =>
                    handleSaveDrill(
                      {
                        ...drill,
                        status: drill.status === 'completed' ? 'todo' : 'completed',
                      },
                      false,
                    )
                  }
                />
              )}

              {activeSection === 'daily-training' && (
                <DailyTrainingView
                  drills={drills}
                  templates={templates}
                  members={members}
                  aimLogs={aimLogs}
                  activeRole={activeRole}
                  currentUserId={currentUserId}
                  dataMode={dataMode}
                  teamId={team.id}
                  teamOwnerId={team.ownerId}
                  activeTab={dailyTab}
                  onTabChange={setDailyTab}
                  aiEvaluation={aiEvaluation}
                  aiLoading={aiLoading}
                  aiError={aiError}
                  onSubmitAiEvaluation={handleSubmitAiEvaluation}
                  onSaveDrill={handleSaveDrill}
                  onVerifyDrillProof={handleVerifyDrillProof}
                  onDeleteDrill={handleDeleteDrill}
                  onDuplicateDrill={handleDuplicateDrill}
                  onApplyTemplate={handleApplyTemplate}
                  onSaveTemplate={handleSaveTemplate}
                  onSaveAimLog={handleSaveAimLog}
                  onVerifyAimProof={handleVerifyAimProof}
                  onDeleteAimLog={handleDeleteAimLog}
                />
              )}

              {activeSection === 'scrim-schedule' && (
                <ScrimScheduleView
                  scrims={scrims}
                  drills={drills}
                  availabilities={availabilities}
                  activeRole={activeRole}
                  currentUserId={currentUserId}
                  teamId={team.id}
                  teamOwnerId={team.ownerId}
                  onSaveScrim={handleSaveScrim}
                  onDeleteScrim={handleDeleteScrim}
                />
              )}

              {activeSection === 'availability' && (
                <AvailabilityView
                  availabilities={availabilities}
                  members={members}
                  currentUserId={currentUserId}
                  currentMemberName={currentMemberName}
                  activeRole={activeRole}
                  dataMode={dataMode}
                  teamId={team.id}
                  teamOwnerId={team.ownerId}
                  onSaveAvailability={handleSaveAvailability}
                  onDeleteAvailability={handleDeleteAvailability}
                  onCreatePlannedScrimFromWindow={async (draft) => {
                    const scrim: Scrim = {
                      id: createClientId('scrim'),
                      teamId: team.id,
                      teamOwnerId: team.ownerId,
                      createdBy: currentUserId,
                      opponent: draft.opponent,
                      date: draft.date,
                      startTime: draft.startTime,
                      endTime: draft.endTime,
                      mapCount: 2,
                      maps: ['Ascent', 'Lotus'],
                      server: 'Singapore',
                      status: 'planned',
                      notes: 'Đề xuất từ khung giờ rảnh chung của đội (chờ xác nhận).',
                    };
                    await handleSaveScrim(scrim, true);
                    setActiveSection('scrim-schedule');
                  }}
                />
              )}

              {activeSection === 'team-management' && (
                <TeamManagementView
                  team={team}
                  members={members}
                  drills={drills}
                  availabilities={availabilities}
                  activeRole={activeRole}
                  currentUserId={currentUserId}
                  currentMemberName={currentMemberName}
                  dataMode={dataMode}
                  onAddManagedPlayer={handleAddManagedPlayer}
                  onSaveMember={handleSaveMember}
                  onDeleteMember={handleDeleteMember}
                  onAssignDrill={handleAssignDrill}
                  onNavigate={setActiveSection}
                />
              )}

              {activeSection === 'performance' && (
                <PerformanceView
                  drills={
                    activeRole === 'player'
                      ? drills.filter((d) => d.ownerId === currentUserId)
                      : drills
                  }
                  aimLogs={
                    activeRole === 'player'
                      ? aimLogs.filter((l) => l.ownerId === currentUserId)
                      : aimLogs
                  }
                  scrims={scrims}
                />
              )}
            </>
          )}
        </main>
      </div>

      <NotificationDrawer
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        onMarkRead={handleMarkNotifRead}
        onMarkAllRead={handleMarkAllNotifsRead}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
