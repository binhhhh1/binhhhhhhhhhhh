import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type {
  AimLog,
  AvailabilitySlot,
  Scrim,
  TeamMember,
  TeamNotification,
  TeamWorkspace,
  TrainingDrill,
  TrainingTemplate,
  UserProfile,
} from '../types/training';
import { db, handleFirestoreError, OperationType } from './firebase';

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || `id_${Date.now()}`;
}

function clampStr(val: string | undefined, maxLen: number): string {
  return (val ?? '').trim().slice(0, maxLen);
}

export function createClientId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return sanitizeId(`${prefix}_${Date.now()}_${rand}`);
}

export async function ensureUserAndTeamWorkspace(user: User): Promise<{
  profile: UserProfile;
  team: TeamWorkspace;
}> {
  const uid = sanitizeId(user.uid);
  const userPath = `users/${uid}`;

  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data() as UserProfile;
      let activeTeamId = data.activeTeamId;

      if (activeTeamId) {
        const teamSnap = await getDoc(doc(db, 'teams', activeTeamId));
        if (teamSnap.exists()) {
          return {
            profile: data,
            team: teamSnap.data() as TeamWorkspace,
          };
        }
      }

      // Check if user owns a team already
      const q = query(collection(db, 'teams'), where('ownerId', '==', uid));
      const ownedTeams = await getDocs(q);
      if (!ownedTeams.empty) {
        const teamDoc = ownedTeams.docs[0].data() as TeamWorkspace;
        await updateDoc(userRef, {
          activeTeamId: teamDoc.id,
          updatedAt: serverTimestamp(),
        });
        return {
          profile: { ...data, activeTeamId: teamDoc.id },
          team: teamDoc,
        };
      }
    }

    // Create fresh personal team workspace atomically using writeBatch
    const teamId = sanitizeId(`team_${uid.slice(0, 20)}`);
    const displayName = clampStr(user.displayName || user.email?.split('@')[0] || 'Player', 80);
    const riotId = clampStr(`${displayName.replace(/\s+/g, '')}#VN1`, 40);
    const batch = writeBatch(db);

    const teamData = {
      id: teamId,
      name: clampStr(`${displayName} Squad`, 80),
      tag: 'VTH',
      ownerId: uid,
      weeklyGoalHours: 20,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const memberData = {
      uid,
      teamOwnerId: uid,
      displayName,
      riotId,
      teamRole: 'coach',
      gameRole: 'Flex',
      mainAgent: 'Omen',
      scrimStatus: 'ready',
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const profileData = {
      uid,
      email: clampStr(user.email || '', 254),
      displayName,
      riotId,
      gameRole: 'Flex',
      mainAgent: 'Omen',
      activeTeamId: teamId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    batch.set(doc(db, 'teams', teamId), teamData);
    batch.set(doc(db, 'teams', teamId, 'members', uid), memberData);
    batch.set(userRef, profileData);
    await batch.commit();

    return {
      profile: {
        uid,
        email: profileData.email,
        displayName,
        riotId,
        gameRole: 'Flex',
        mainAgent: 'Omen',
        activeTeamId: teamId,
      },
      team: {
        id: teamId,
        name: teamData.name,
        tag: teamData.tag,
        ownerId: uid,
        weeklyGoalHours: 20,
      },
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export function subscribeTeamWorkspaceData(params: {
  teamId: string;
  teamOwnerId: string;
  onMembers: (items: TeamMember[]) => void;
  onDrills: (items: TrainingDrill[]) => void;
  onAimLogs: (items: AimLog[]) => void;
  onScrims: (items: Scrim[]) => void;
  onAvailabilities: (items: AvailabilitySlot[]) => void;
  onTemplates: (items: TrainingTemplate[]) => void;
  onNotifications: (items: TeamNotification[]) => void;
}): Unsubscribe {
  const {
    teamId,
    teamOwnerId,
    onMembers,
    onDrills,
    onAimLogs,
    onScrims,
    onAvailabilities,
    onTemplates,
    onNotifications,
  } = params;

  const base = `teams/${teamId}`;
  const unsubs: Unsubscribe[] = [];

  const listen = <T>(
    sub: string,
    cb: (items: T[]) => void,
  ) => {
    const path = `${base}/${sub}`;
    const q = query(collection(db, 'teams', teamId, sub), where('teamOwnerId', '==', teamOwnerId));
    const u = onSnapshot(
      q,
      (snap) => {
        cb(snap.docs.map((d) => d.data() as T));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      },
    );
    unsubs.push(u);
  };

  listen<TeamMember>('members', onMembers);
  listen<TrainingDrill>('drills', onDrills);
  listen<AimLog>('aimLogs', onAimLogs);
  listen<Scrim>('scrims', onScrims);
  listen<AvailabilitySlot>('availabilities', onAvailabilities);
  listen<TrainingTemplate>('templates', onTemplates);
  listen<TeamNotification>('notifications', onNotifications);

  return () => {
    for (const u of unsubs) u();
  };
}

// --- CRUD Helpers with Blueprint Payload Validation ---
export async function saveDrillToFirestore(
  drill: TrainingDrill,
  isNew: boolean,
): Promise<void> {
  const safeTeamId = sanitizeId(drill.teamId);
  const safeDrillId = sanitizeId(drill.id);
  const path = `teams/${safeTeamId}/drills/${safeDrillId}`;
  try {
    const ref = doc(db, 'teams', safeTeamId, 'drills', safeDrillId);
    const proofUrl = clampStr(drill.proofUrl, 500);
    const proofNote = clampStr(drill.proofNote, 200);
    if (isNew) {
      await setDoc(ref, {
        id: safeDrillId,
        teamId: safeTeamId,
        teamOwnerId: sanitizeId(drill.teamOwnerId),
        ownerId: sanitizeId(drill.ownerId),
        assignedBy: sanitizeId(drill.assignedBy),
        title: clampStr(drill.title, 120),
        category: drill.category,
        date: drill.date,
        startTime: drill.startTime,
        durationMin: Math.max(5, Math.min(480, Number(drill.durationMin) || 30)),
        goal: clampStr(drill.goal, 200),
        description: clampStr(drill.description, 600),
        status: drill.status,
        actualResult: clampStr(drill.actualResult, 200),
        notes: clampStr(drill.notes, 500),
        proofUrl,
        proofNote,
        proofVerified: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ownerId: sanitizeId(drill.ownerId),
        title: clampStr(drill.title, 120),
        category: drill.category,
        date: drill.date,
        startTime: drill.startTime,
        durationMin: Math.max(5, Math.min(480, Number(drill.durationMin) || 30)),
        goal: clampStr(drill.goal, 200),
        description: clampStr(drill.description, 600),
        status: drill.status,
        actualResult: clampStr(drill.actualResult, 200),
        notes: clampStr(drill.notes, 500),
        proofUrl,
        proofNote,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function verifyDrillProofInFirestore(
  teamId: string,
  drillId: string,
  verified: boolean,
): Promise<void> {
  const safeTeamId = sanitizeId(teamId);
  const safeDrillId = sanitizeId(drillId);
  const path = `teams/${safeTeamId}/drills/${safeDrillId}`;
  try {
    await updateDoc(doc(db, 'teams', safeTeamId, 'drills', safeDrillId), {
      proofVerified: verified,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteDrillFromFirestore(teamId: string, drillId: string): Promise<void> {
  const path = `teams/${teamId}/drills/${drillId}`;
  try {
    await deleteDoc(doc(db, 'teams', teamId, 'drills', drillId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveAimLogToFirestore(log: AimLog, isNew: boolean): Promise<void> {
  const safeTeamId = sanitizeId(log.teamId);
  const safeLogId = sanitizeId(log.id);
  const path = `teams/${safeTeamId}/aimLogs/${safeLogId}`;
  try {
    const ref = doc(db, 'teams', safeTeamId, 'aimLogs', safeLogId);
    const proofUrl = clampStr(log.proofUrl, 500);
    const proofNote = clampStr(log.proofNote, 200);
    const proofTypeField = log.proofType ? { proofType: log.proofType } : {};

    if (isNew) {
      await setDoc(ref, {
        id: safeLogId,
        teamId: safeTeamId,
        teamOwnerId: sanitizeId(log.teamOwnerId),
        ownerId: sanitizeId(log.ownerId),
        date: log.date,
        exerciseName: clampStr(log.exerciseName, 100),
        platform: log.platform,
        focusArea: log.focusArea,
        durationMin: Math.max(1, Math.min(360, Number(log.durationMin) || 15)),
        score: Math.max(0, Math.min(10000000, Number(log.score) || 0)),
        accuracy: Math.max(0, Math.min(100, Number(log.accuracy) || 0)),
        notes: clampStr(log.notes, 400),
        proofUrl,
        proofNote,
        proofVerified: false,
        ...proofTypeField,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        date: log.date,
        exerciseName: clampStr(log.exerciseName, 100),
        platform: log.platform,
        focusArea: log.focusArea,
        durationMin: Math.max(1, Math.min(360, Number(log.durationMin) || 15)),
        score: Math.max(0, Math.min(10000000, Number(log.score) || 0)),
        accuracy: Math.max(0, Math.min(100, Number(log.accuracy) || 0)),
        notes: clampStr(log.notes, 400),
        proofUrl,
        proofNote,
        ...proofTypeField,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function verifyAimProofInFirestore(
  teamId: string,
  logId: string,
  verified: boolean,
): Promise<void> {
  const safeTeamId = sanitizeId(teamId);
  const safeLogId = sanitizeId(logId);
  const path = `teams/${safeTeamId}/aimLogs/${safeLogId}`;
  try {
    await updateDoc(doc(db, 'teams', safeTeamId, 'aimLogs', safeLogId), {
      proofVerified: verified,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAimLogFromFirestore(teamId: string, logId: string): Promise<void> {
  const path = `teams/${teamId}/aimLogs/${logId}`;
  try {
    await deleteDoc(doc(db, 'teams', teamId, 'aimLogs', logId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveScrimToFirestore(scrim: Scrim, isNew: boolean): Promise<void> {
  const path = `teams/${scrim.teamId}/scrims/${scrim.id}`;
  const cleanMaps = (scrim.maps.length > 0 ? scrim.maps : ['Ascent']).slice(0, 5).map((m) => clampStr(m, 30));
  try {
    const ref = doc(db, 'teams', scrim.teamId, 'scrims', sanitizeId(scrim.id));
    if (isNew) {
      await setDoc(ref, {
        id: sanitizeId(scrim.id),
        teamId: sanitizeId(scrim.teamId),
        teamOwnerId: sanitizeId(scrim.teamOwnerId),
        createdBy: sanitizeId(scrim.createdBy),
        opponent: clampStr(scrim.opponent, 80),
        date: scrim.date,
        startTime: scrim.startTime,
        endTime: scrim.endTime,
        mapCount: Math.max(1, Math.min(5, Number(scrim.mapCount) || 2)),
        maps: cleanMaps,
        server: clampStr(scrim.server, 40),
        status: scrim.status,
        notes: clampStr(scrim.notes, 600),
        vodUrl: clampStr(scrim.vodUrl, 300),
        mapResultsText: clampStr(scrim.mapResultsText, 400),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        opponent: clampStr(scrim.opponent, 80),
        date: scrim.date,
        startTime: scrim.startTime,
        endTime: scrim.endTime,
        mapCount: Math.max(1, Math.min(5, Number(scrim.mapCount) || 2)),
        maps: cleanMaps,
        server: clampStr(scrim.server, 40),
        status: scrim.status,
        notes: clampStr(scrim.notes, 600),
        vodUrl: clampStr(scrim.vodUrl, 300),
        mapResultsText: clampStr(scrim.mapResultsText, 400),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteScrimFromFirestore(teamId: string, scrimId: string): Promise<void> {
  const path = `teams/${teamId}/scrims/${scrimId}`;
  try {
    await deleteDoc(doc(db, 'teams', teamId, 'scrims', scrimId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveAvailabilityToFirestore(
  slot: AvailabilitySlot,
  isNew: boolean,
): Promise<void> {
  const path = `teams/${slot.teamId}/availabilities/${slot.id}`;
  try {
    const ref = doc(db, 'teams', slot.teamId, 'availabilities', sanitizeId(slot.id));
    if (isNew) {
      await setDoc(ref, {
        id: sanitizeId(slot.id),
        teamId: sanitizeId(slot.teamId),
        teamOwnerId: sanitizeId(slot.teamOwnerId),
        ownerId: sanitizeId(slot.ownerId),
        memberName: clampStr(slot.memberName, 80),
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotType: slot.slotType,
        notes: clampStr(slot.notes, 300),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        memberName: clampStr(slot.memberName, 80),
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotType: slot.slotType,
        notes: clampStr(slot.notes, 300),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteAvailabilityFromFirestore(
  teamId: string,
  slotId: string,
): Promise<void> {
  const path = `teams/${teamId}/availabilities/${slotId}`;
  try {
    await deleteDoc(doc(db, 'teams', teamId, 'availabilities', slotId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveTemplateToFirestore(
  tpl: TrainingTemplate,
  isNew: boolean,
): Promise<void> {
  const path = `teams/${tpl.teamId}/templates/${tpl.id}`;
  try {
    const ref = doc(db, 'teams', tpl.teamId, 'templates', sanitizeId(tpl.id));
    const items = tpl.items.slice(0, 15).map((item) => ({
      title: clampStr(item.title, 120),
      category: item.category,
      startTime: item.startTime,
      durationMin: Math.max(5, Math.min(480, Number(item.durationMin) || 30)),
      goal: clampStr(item.goal, 200),
      description: clampStr(item.description, 400),
    }));
    if (isNew) {
      await setDoc(ref, {
        id: sanitizeId(tpl.id),
        teamId: sanitizeId(tpl.teamId),
        teamOwnerId: sanitizeId(tpl.teamOwnerId),
        ownerId: sanitizeId(tpl.ownerId),
        name: clampStr(tpl.name, 100),
        description: clampStr(tpl.description, 300),
        items,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        name: clampStr(tpl.name, 100),
        description: clampStr(tpl.description, 300),
        items,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function saveTeamMemberToFirestore(
  teamId: string,
  member: TeamMember,
  isNew: boolean,
): Promise<void> {
  const path = `teams/${teamId}/members/${member.uid}`;
  try {
    const ref = doc(db, 'teams', teamId, 'members', sanitizeId(member.uid));
    if (isNew) {
      await setDoc(ref, {
        uid: sanitizeId(member.uid),
        teamOwnerId: sanitizeId(member.teamOwnerId),
        displayName: clampStr(member.displayName, 80),
        riotId: clampStr(member.riotId, 40),
        teamRole: member.teamRole,
        gameRole: member.gameRole,
        mainAgent: clampStr(member.mainAgent, 40),
        scrimStatus: member.scrimStatus,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName: clampStr(member.displayName, 80),
        riotId: clampStr(member.riotId, 40),
        teamRole: member.teamRole,
        gameRole: member.gameRole,
        mainAgent: clampStr(member.mainAgent, 40),
        scrimStatus: member.scrimStatus,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteTeamMemberFromFirestore(
  teamId: string,
  memberUid: string,
): Promise<void> {
  const safeTeamId = sanitizeId(teamId);
  const safeMemberUid = sanitizeId(memberUid);
  const path = `teams/${safeTeamId}/members/${safeMemberUid}`;
  try {
    await deleteDoc(doc(db, 'teams', safeTeamId, 'members', safeMemberUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveNotificationToFirestore(
  notif: TeamNotification,
  isNew: boolean,
): Promise<void> {
  const path = `teams/${notif.teamId}/notifications/${notif.id}`;
  try {
    const ref = doc(db, 'teams', notif.teamId, 'notifications', sanitizeId(notif.id));
    if (isNew) {
      await setDoc(ref, {
        id: sanitizeId(notif.id),
        teamId: sanitizeId(notif.teamId),
        teamOwnerId: sanitizeId(notif.teamOwnerId),
        actorId: sanitizeId(notif.actorId),
        type: notif.type,
        title: clampStr(notif.title, 120),
        message: clampStr(notif.message, 300),
        read: notif.read,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        read: notif.read,
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}
