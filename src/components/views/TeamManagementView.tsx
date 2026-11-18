import React, { useState } from 'react';
import {
  Edit3,
  KeyRound,
  Lock,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  DRILL_CATEGORIES,
  GAME_ROLES,
  type AvailabilitySlot,
  type DataSourceMode,
  type DrillCategory,
  type GameRole,
  type NavSection,
  type ScrimMemberStatus,
  type TeamMember,
  type TeamRole,
  type TeamWorkspace,
  type TrainingDrill,
} from '../../types/training';
import { getVNDateKey, getWeekDateKeys } from '../../utils/timezone';

export interface CreateManagedPlayerInput {
  identifier: string;
  password: string;
  displayName: string;
  riotId: string;
  gameRole: GameRole;
  mainAgent: string;
}

interface TeamManagementViewProps {
  team: TeamWorkspace;
  members: TeamMember[];
  drills: TrainingDrill[];
  availabilities: AvailabilitySlot[];
  activeRole: TeamRole;
  currentUserId: string;
  currentMemberName: string;
  dataMode: DataSourceMode;
  onAddManagedPlayer: (input: CreateManagedPlayerInput) => Promise<void>;
  onSaveMember: (
    member: TeamMember,
    isNew: boolean,
    newPassword?: string,
  ) => Promise<void>;
  onDeleteMember: (memberUid: string) => Promise<void>;
  onAssignDrill: (drill: TrainingDrill) => Promise<void>;
  onNavigate: (section: NavSection) => void;
}

const SCRIM_STATUS_LABEL: Record<ScrimMemberStatus, { text: string; cls: string }> = {
  ready: { text: 'Sẵn sàng Scrim', cls: 'text-emerald-400' },
  sub: { text: 'Dự bị', cls: 'text-amber-400' },
  unavailable: { text: 'Tạm vắng', cls: 'text-slate-400' },
};

export function TeamManagementView({
  team,
  members,
  drills,
  availabilities,
  activeRole,
  currentUserId,
  currentMemberName,
  dataMode,
  onAddManagedPlayer,
  onSaveMember,
  onDeleteMember,
  onAssignDrill,
  onNavigate,
}: TeamManagementViewProps) {
  const todayDate = getVNDateKey();
  const weekSet = new Set(getWeekDateKeys(todayDate));
  // Strictly only Manager/Coach role can add, edit, or delete players
  const canManageRoster = activeRole === 'coach';

  const playerMembers = members.filter((m) => m.teamRole === 'player');
  const managerMembers = members.filter((m) => m.teamRole === 'coach');

  // Add Managed Player form (Manager Only)
  const [showAddMember, setShowAddMember] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRiotId, setNewRiotId] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('123456');
  const [newGameRole, setNewGameRole] = useState<GameRole>('Duelist');
  const [newAgent, setNewAgent] = useState('Jett');
  const [rosterBusy, setRosterBusy] = useState(false);
  const [rosterError, setRosterError] = useState('');
  const [rosterSuccess, setRosterSuccess] = useState('');
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);

  // Edit Player / Reset Password Modal (Manager Only)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editName, setEditName] = useState('');
  const [editRiotId, setEditRiotId] = useState('');
  const [editGameRole, setEditGameRole] = useState<GameRole>('Duelist');
  const [editAgent, setEditAgent] = useState('Jett');
  const [editScrimStatus, setEditScrimStatus] = useState<ScrimMemberStatus>('ready');
  const [editNewPassword, setEditNewPassword] = useState('');

  // Assign drill form (Manager Only)
  const [assignTargetUid, setAssignTargetUid] = useState(
    playerMembers[0]?.uid || 'ALL_PLAYERS',
  );
  const [drillTitle, setDrillTitle] = useState('');
  const [drillCategory, setDrillCategory] = useState<DrillCategory>('Crosshair Placement');
  const [drillTime, setDrillTime] = useState('15:00');
  const [drillDuration, setDrillDuration] = useState(45);
  const [drillGoal, setDrillGoal] = useState('');
  const [assignMessage, setAssignMessage] = useState('');

  const resolvedAssignTargetUid =
    assignTargetUid === 'ALL_PLAYERS' ||
    playerMembers.some((m) => m.uid === assignTargetUid)
      ? assignTargetUid
      : playerMembers[0]?.uid || currentUserId;

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageRoster) {
      setRosterError('Chỉ tài khoản có quyền Manager mới được phép thêm tuyển thủ.');
      return;
    }
    if (!newName.trim() || !newRiotId.trim()) return;

    const autoUsername =
      newUsername.trim() ||
      newRiotId
        .split('#')[0]
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '') ||
      `player_${Date.now().toString(36).slice(-4)}`;

    setRosterBusy(true);
    setRosterError('');
    setRosterSuccess('');
    try {
      await onAddManagedPlayer({
        identifier: autoUsername,
        password: newPassword.trim() || '123456',
        displayName: newName.trim(),
        riotId: newRiotId.trim(),
        gameRole: newGameRole,
        mainAgent: newAgent.trim() || 'Jett',
      });
      setRosterSuccess(
        `Đã thêm tuyển thủ "${newName.trim()}" (${newRiotId.trim()}) trực thuộc quyền quản lý của ${currentMemberName}. Tài khoản đăng nhập: ${autoUsername} / Mật khẩu: ${newPassword.trim() || '123456'}.`,
      );
      setNewName('');
      setNewRiotId('');
      setNewUsername('');
      setNewPassword('123456');
      setNewAgent('Jett');
      setNewGameRole('Duelist');
      setShowAddMember(false);
    } catch (err) {
      setRosterError(err instanceof Error ? err.message : 'Không thể thêm tuyển thủ.');
    } finally {
      setRosterBusy(false);
    }
  };

  const openEditPlayerModal = (m: TeamMember) => {
    if (!canManageRoster) return;
    setEditingMember(m);
    setEditName(m.displayName);
    setEditRiotId(m.riotId);
    setEditGameRole(m.gameRole);
    setEditAgent(m.mainAgent);
    setEditScrimStatus(m.scrimStatus);
    setEditNewPassword('');
    setRosterError('');
  };

  const handleSaveEditedPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !canManageRoster) return;
    setRosterBusy(true);
    setRosterError('');
    setRosterSuccess('');
    try {
      await onSaveMember(
        {
          ...editingMember,
          displayName: editName.trim() || editingMember.displayName,
          riotId: editRiotId.trim() || editingMember.riotId,
          gameRole: editGameRole,
          mainAgent: editAgent.trim() || editingMember.mainAgent,
          scrimStatus: editScrimStatus,
        },
        false,
        editNewPassword.trim() || undefined,
      );
      setRosterSuccess(
        `Đã cập nhật thông tin kiểm soát tuyển thủ ${editName.trim()}${
          editNewPassword.trim() ? ' và đặt lại mật khẩu mới' : ''
        }.`,
      );
      setEditingMember(null);
    } catch (err) {
      setRosterError(
        err instanceof Error ? err.message : 'Không thể cập nhật tuyển thủ.',
      );
    } finally {
      setRosterBusy(false);
    }
  };

  const handleConfirmDeleteMember = async (memberUid: string) => {
    if (!canManageRoster) return;
    setRosterBusy(true);
    setRosterError('');
    setRosterSuccess('');
    try {
      await onDeleteMember(memberUid);
      setConfirmDeleteUid(null);
      setRosterSuccess('Đã xóa tuyển thủ và thu hồi tài khoản khỏi cơ sở dữ liệu đội.');
    } catch (err) {
      setRosterError(err instanceof Error ? err.message : 'Không thể xóa tuyển thủ.');
    } finally {
      setRosterBusy(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageRoster || !drillTitle.trim()) return;

    const targets =
      resolvedAssignTargetUid === 'ALL_PLAYERS'
        ? playerMembers
        : members.filter((m) => m.uid === resolvedAssignTargetUid);

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const payload: TrainingDrill = {
        id: `drill_${Date.now()}_${i}`,
        teamId: team.id,
        teamOwnerId: team.ownerId,
        ownerId: target.uid,
        assignedBy: currentUserId,
        title: drillTitle.trim(),
        category: drillCategory,
        date: todayDate,
        startTime: drillTime,
        durationMin: Number(drillDuration),
        goal: drillGoal.trim(),
        status: 'todo',
      };
      await onAssignDrill(payload);
    }

    setDrillTitle('');
    setDrillGoal('');
    setAssignMessage(
      resolvedAssignTargetUid === 'ALL_PLAYERS'
        ? `Đã giao bài tập cho toàn bộ ${targets.length} tuyển thủ dưới quyền kiểm soát.`
        : `Đã giao bài tập thành công cho tuyển thủ ${targets[0]?.displayName || ''}.`,
    );
    window.setTimeout(() => setAssignMessage(''), 3500);
  };

  const myAssignedDrills = drills.filter(
    (d) => d.ownerId === currentUserId && d.date >= todayDate,
  );
  const myMemberRecord = members.find((m) => m.uid === currentUserId);

  return (
    <div className="space-y-6">
      {/* Role & Unified Database Summary Bar */}
      <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="px-2 py-0.5 rounded bg-[#FF4655]/15 border border-[#FF4655]/30 text-[#FF4655] font-semibold">
              {canManageRoster ? 'Quyền Kiểm Soát Manager' : 'Chế độ Tuyển thủ (Trực thuộc Manager)'}
            </span>
            <span>·</span>
            <span className="text-emerald-400 font-medium">
              Database hợp nhất ({dataMode === 'cloud' ? 'Cloud Firestore' : 'Unified Team DB'})
            </span>
          </div>
          <h2 className="font-display font-bold text-lg text-white mt-1.5">
            {team.name} ({team.tag}) · {playerMembers.length} Tuyển thủ &amp;{' '}
            {managerMembers.length} Manager
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {canManageRoster
              ? 'Chỉ tài khoản Manager mới được phép thêm/xóa tuyển thủ, cấp hoặc đặt lại mật khẩu, phân công vai trò và giao bài tập bắt buộc cho từng tuyển thủ.'
              : `Bạn đang trực thuộc quyền quản lý của Ban Huấn Luyện (${myMemberRecord?.managedByName || 'Manager Binh / Admin Noti'}). Chỉ Manager mới có quyền thêm hoặc chỉnh sửa danh sách tuyển thủ.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {canManageRoster ? (
            <button
              type="button"
              onClick={() => {
                setRosterError('');
                setRosterSuccess('');
                setShowAddMember((v) => !v);
              }}
              className="px-4 py-2.5 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm tuyển thủ (Quyền Manager)</span>
            </button>
          ) : (
            <div className="px-3.5 py-2 rounded-lg bg-[#090B10] border border-white/10 text-xs text-slate-300 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Chỉ Manager mới được thêm tuyển thủ</span>
            </div>
          )}
        </div>
      </div>

      {rosterError && (
        <div className="p-3.5 rounded-xl bg-[#FF4655]/15 border border-[#FF4655]/40 text-xs text-red-200 flex items-center justify-between gap-3">
          <span>{rosterError}</span>
          <button
            type="button"
            onClick={() => setRosterError('')}
            className="text-white underline shrink-0"
          >
            Đóng
          </button>
        </div>
      )}

      {rosterSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-200 flex items-center justify-between gap-3">
          <span>{rosterSuccess}</span>
          <button
            type="button"
            onClick={() => setRosterSuccess('')}
            className="text-white underline shrink-0"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Add Roster Member Form (Strictly Manager Only) */}
      {canManageRoster && showAddMember && (
        <form
          onSubmit={handleAddMember}
          className="bg-[#121621] border border-[#FF4655]/35 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-semibold text-sm text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#FF4655]" />
                <span>Thêm Tuyển Thủ Mới &amp; Cấp Tài Khoản Đăng Nhập</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Tuyển thủ sau khi tạo sẽ thuộc quyền kiểm soát của{' '}
                <strong className="text-white">{currentMemberName}</strong> và dùng chung cơ sở dữ liệu toàn đội.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddMember(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Tên tuyển thủ *
              </label>
              <input
                type="text"
                required
                aria-label="Tên player"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="VD: Nguyễn Văn A"
                className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Riot ID *
              </label>
              <input
                type="text"
                required
                aria-label="Riot ID player"
                value={newRiotId}
                onChange={(e) => setNewRiotId(e.target.value)}
                placeholder="VD: TenZ#VN1"
                className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Tên đăng nhập (Username) cấp cho tuyển thủ
              </label>
              <input
                type="text"
                aria-label="Tên đăng nhập tuyển thủ"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Để trống sẽ tự tạo theo Riot ID"
                className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Mật khẩu đăng nhập * (&ge; 6 ký tự)
              </label>
              <input
                type="text"
                required
                minLength={6}
                aria-label="Mật khẩu tuyển thủ"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="123456"
                className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Role trong game
              </label>
              <select
                aria-label="Role trong game"
                value={newGameRole}
                onChange={(e) => setNewGameRole(e.target.value as GameRole)}
                className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              >
                {GAME_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Agent chính
              </label>
              <input
                type="text"
                aria-label="Agent chính"
                value={newAgent}
                onChange={(e) => setNewAgent(e.target.value)}
                placeholder="Agent chính (VD: Jett)"
                className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
            <span className="text-[11px] text-slate-400">
              Vai trò mặc định: <strong className="text-sky-400">Tuyển thủ (Player)</strong> · Trực thuộc quyền kiểm soát của{' '}
              <strong className="text-white">{currentMemberName}</strong>
            </span>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddMember(false)}
                className="px-3.5 py-2 rounded-lg bg-white/5 text-xs text-slate-300"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={rosterBusy}
                className="px-4 py-2 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] disabled:opacity-60 text-white text-xs font-semibold"
              >
                {rosterBusy ? 'Đang lưu...' : 'Lưu & Cấp tài khoản Tuyển thủ'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Edit Player Modal (Manager Control) */}
      {canManageRoster && editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <form
            onSubmit={handleSaveEditedPlayer}
            className="w-full max-w-md bg-[#121621] border border-white/10 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
              <div>
                <h3 className="font-display font-semibold text-base text-white">
                  Kiểm soát &amp; Chỉnh sửa Tuyển thủ
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Tài khoản: {editingMember.username || editingMember.uid}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Tên tuyển thủ *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Riot ID *</label>
                <input
                  type="text"
                  required
                  value={editRiotId}
                  onChange={(e) => setEditRiotId(e.target.value)}
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Role In-game</label>
                  <select
                    value={editGameRole}
                    onChange={(e) => setEditGameRole(e.target.value as GameRole)}
                    className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    {GAME_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Main Agent</label>
                  <input
                    type="text"
                    value={editAgent}
                    onChange={(e) => setEditAgent(e.target.value)}
                    className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Trạng thái tham gia Scrim
                </label>
                <select
                  value={editScrimStatus}
                  onChange={(e) => setEditScrimStatus(e.target.value as ScrimMemberStatus)}
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="ready">Sẵn sàng Scrim</option>
                  <option value="sub">Dự bị</option>
                  <option value="unavailable">Tạm vắng</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Đặt lại mật khẩu mới cho tuyển thủ (Tùy chọn)</span>
                </label>
                <input
                  type="text"
                  minLength={6}
                  value={editNewPassword}
                  onChange={(e) => setEditNewPassword(e.target.value)}
                  placeholder="Để trống nếu giữ nguyên mật khẩu hiện tại"
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.07]">
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="px-3.5 py-2 rounded-lg bg-white/5 text-xs text-slate-300"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={rosterBusy}
                className="px-4 py-2 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] disabled:opacity-60 text-white text-xs font-semibold"
              >
                {rosterBusy ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ban Huấn Luyện / Manager Oversight Bar (Consistent across all accounts) */}
      <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Shield className="w-4 h-4 text-[#FF4655]" />
            <span>
              Ban Huấn Luyện &amp; Quản Lý Đội ({managerMembers.length} Manager / Admin — Chỉ quản lý &amp; giao nhiệm vụ, không tính vào lịch trống Scrim)
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Đồng nhất 100% trên mọi tài khoản trong đội
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {managerMembers.map((mgr) => (
            <div
              key={mgr.uid}
              className="p-3 rounded-lg bg-[#090B10] border border-white/[0.07] flex items-center justify-between gap-3"
            >
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <span>{mgr.displayName}</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#FF4655]/15 border border-[#FF4655]/30 text-[10px] text-[#FF4655] font-mono">
                    @{mgr.username || mgr.uid}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {mgr.riotId} · Quyền điều phối &amp; giao bài tập toàn đội
                </div>
              </div>
              <span className="text-[11px] font-semibold text-emerald-400 shrink-0">
                Manager / Coach
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Competing Players Roster Table */}
      <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h3 className="font-display font-semibold text-base text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-400" />
            <span>
              Danh sách Tuyển thủ Thi đấu trực thuộc Manager &amp; Tiến độ tuần ({playerMembers.length} Tuyển thủ)
            </span>
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('availability')}
            className="text-xs font-medium text-sky-400 hover:text-sky-300 self-start sm:self-auto"
          >
            Xem lịch trống từng tuyển thủ
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] text-slate-400">
                <th className="py-2.5 pr-4 font-medium">Tuyển thủ / Riot ID</th>
                <th className="py-2.5 pr-4 font-medium">Tài khoản</th>
                <th className="py-2.5 pr-4 font-medium">Quyền &amp; Quản lý</th>
                <th className="py-2.5 pr-4 font-medium">Role &amp; Agent</th>
                <th className="py-2.5 pr-4 text-right font-medium">Giờ tập tuần</th>
                <th className="py-2.5 pr-4 text-right font-medium">Bài tập xong</th>
                <th className="py-2.5 pr-4 text-right font-medium">Khung giờ rảnh Scrim</th>
                <th className={`py-2.5 ${canManageRoster ? 'pr-4' : ''} text-right font-medium`}>
                  Trạng thái Scrim
                </th>
                {canManageRoster && (
                  <th className="py-2.5 text-right font-medium">Kiểm soát (Manager)</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {playerMembers.map((m) => {
                const mDrills = drills.filter(
                  (d) => d.ownerId === m.uid && weekSet.has(d.date),
                );
                const doneCount = mDrills.filter((d) => d.status === 'completed').length;
                const weekHours = Number(
                  (
                    mDrills
                      .filter((d) => d.status === 'completed')
                      .reduce((s, d) => s + d.durationMin, 0) / 60
                  ).toFixed(1),
                );
                const availCount = availabilities.filter(
                  (a) => a.ownerId === m.uid && a.slotType === 'available',
                ).length;
                const statusMeta = SCRIM_STATUS_LABEL[m.scrimStatus];
                const canChangeStatus = canManageRoster;
                const canDeleteThisMember =
                  canManageRoster &&
                  m.teamRole === 'player' &&
                  m.uid !== team.ownerId &&
                  m.uid !== currentUserId;
                const isConfirmingDelete = confirmDeleteUid === m.uid;

                return (
                  <tr key={m.uid} className="hover:bg-white/[0.02]">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-white">{m.displayName}</div>
                      <div className="font-mono text-[11px] text-slate-400">{m.riotId}</div>
                    </td>
                    <td className="py-3 pr-4 font-mono text-slate-300">
                      {m.username ? `@${m.username}` : m.uid.slice(0, 10)}
                    </td>
                    <td className="py-3 pr-4">
                      <div>
                        <div className="text-sky-400 font-medium">Tuyển thủ (Player)</div>
                        <div className="text-[11px] text-slate-400">
                          Quản lý bởi: {m.managedByName || 'Manager Binh'}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-200">
                      {m.gameRole} · {m.mainAgent}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-white">
                      {weekHours}h
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-slate-300">
                      {doneCount}/{mDrills.length}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-sky-400">
                      {availCount} slot
                    </td>
                    <td className={`py-3 ${canManageRoster ? 'pr-4' : ''} text-right`}>
                      {canChangeStatus ? (
                        <select
                          aria-label={`Trạng thái Scrim của ${m.displayName}`}
                          value={m.scrimStatus}
                          onChange={(e) =>
                            void onSaveMember(
                              { ...m, scrimStatus: e.target.value as ScrimMemberStatus },
                              false,
                            )
                          }
                          className={`bg-[#090B10] border border-white/10 rounded-md px-2 py-1 text-xs ${statusMeta.cls}`}
                        >
                          <option value="ready">Sẵn sàng Scrim</option>
                          <option value="sub">Dự bị</option>
                          <option value="unavailable">Tạm vắng</option>
                        </select>
                      ) : (
                        <span className={statusMeta.cls}>{statusMeta.text}</span>
                      )}
                    </td>
                    {canManageRoster && (
                      <td className="py-3 text-right whitespace-nowrap">
                        {isConfirmingDelete ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={rosterBusy}
                              onClick={() => void handleConfirmDeleteMember(m.uid)}
                              className="px-2 py-1 rounded bg-[#FF4655] hover:bg-[#e53c4a] text-white text-[11px] font-semibold"
                            >
                              Xác nhận xóa
                            </button>
                            <button
                              type="button"
                              disabled={rosterBusy}
                              onClick={() => setConfirmDeleteUid(null)}
                              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 text-[11px]"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditPlayerModal(m)}
                              aria-label={`Chỉnh sửa tuyển thủ ${m.displayName}`}
                              title="Sửa hồ sơ & Đặt lại mật khẩu"
                              className="px-2 py-1 rounded-md bg-white/[0.05] hover:bg-white/[0.12] text-slate-200 text-[11px] inline-flex items-center gap-1 transition-colors"
                            >
                              <Edit3 className="w-3 h-3 text-sky-400" />
                              <span>Sửa / MK</span>
                            </button>
                            {canDeleteThisMember && (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteUid(m.uid)}
                                aria-label={`Xóa player ${m.displayName}`}
                                title="Xóa tuyển thủ"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-[#FF4655] hover:bg-white/5 transition-colors inline-flex items-center"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role-Specific Workspace */}
      {canManageRoster ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleAssignSubmit}
            className="lg:col-span-6 bg-[#121621] border border-white/[0.07] rounded-xl p-5 space-y-4"
          >
            <h3 className="font-display font-semibold text-base text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#FF4655]" />
              <span>Giao bài tập bắt buộc cho Tuyển thủ (Manager Control)</span>
            </h3>

            {assignMessage && (
              <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-300">
                {assignMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="assign-player" className="block text-xs text-slate-300 mb-1">
                  Chọn tuyển thủ nhận bài tập
                </label>
                <select
                  id="assign-player"
                  value={resolvedAssignTargetUid}
                  onChange={(e) => setAssignTargetUid(e.target.value)}
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="ALL_PLAYERS">
                    Tất cả tuyển thủ trong đội ({playerMembers.length} players)
                  </option>
                  {playerMembers.map((m) => (
                    <option key={m.uid} value={m.uid}>
                      {m.displayName} ({m.riotId} · {m.gameRole})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="assign-cat" className="block text-xs text-slate-300 mb-1">
                  Nhóm bài tập
                </label>
                <select
                  id="assign-cat"
                  value={drillCategory}
                  onChange={(e) => setDrillCategory(e.target.value as DrillCategory)}
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                >
                  {DRILL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="assign-title" className="block text-xs text-slate-300 mb-1">
                Tên bài tập giao *
              </label>
              <input
                id="assign-title"
                type="text"
                required
                value={drillTitle}
                onChange={(e) => setDrillTitle(e.target.value)}
                placeholder="VD: Ôn lại bài retake site B Lotus"
                className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="assign-time" className="block text-xs text-slate-300 mb-1">
                  Giờ bắt đầu hôm nay
                </label>
                <input
                  id="assign-time"
                  type="time"
                  value={drillTime}
                  onChange={(e) => setDrillTime(e.target.value)}
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor="assign-dur" className="block text-xs text-slate-300 mb-1">
                  Thời lượng (phút)
                </label>
                <input
                  id="assign-dur"
                  type="number"
                  min={5}
                  max={480}
                  value={drillDuration}
                  onChange={(e) => setDrillDuration(Number(e.target.value))}
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label htmlFor="assign-goal" className="block text-xs text-slate-300 mb-1">
                Mục tiêu cụ thể (Tuyển thủ phải nộp ảnh bằng chứng)
              </label>
              <input
                id="assign-goal"
                type="text"
                value={drillGoal}
                onChange={(e) => setDrillGoal(e.target.value)}
                placeholder="Ghi chú yêu cầu kỹ thuật của Manager..."
                className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2.5 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] text-white text-xs font-semibold"
            >
              Giao bài tập ngay
            </button>
          </form>

          <div className="lg:col-span-6 bg-[#121621] border border-white/[0.07] rounded-xl p-5 space-y-4">
            <h3 className="font-display font-semibold text-base text-white">
              Điều phối &amp; Kiểm soát Tuyển thủ (Manager)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Toàn bộ tuyển thủ đều nằm trong cùng một cơ sở dữ liệu đội tuyển và chịu sự giám sát trực tiếp của Manager: từ lịch tập cá nhân, bằng chứng ảnh chụp màn hình cho đến lịch Scrim.
            </p>
            <div className="grid grid-cols-1 gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('scrim-schedule')}
                className="p-4 rounded-lg bg-[#090B10] border border-white/[0.08] hover:border-white/20 text-left transition-colors"
              >
                <div className="text-sm font-semibold text-white">Tạo lịch Scrim chung</div>
                <div className="text-xs text-slate-400 mt-1">
                  Đặt lịch BO2/BO3 và kiểm tra trùng giờ tự động
                </div>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('availability')}
                className="p-4 rounded-lg bg-[#090B10] border border-white/[0.08] hover:border-white/20 text-left transition-colors"
              >
                <div className="text-sm font-semibold text-white">Tìm giờ trống cả đội</div>
                <div className="text-xs text-slate-400 mt-1">
                  Đối chiếu khung giờ rảnh để chốt lịch Scrim tối ưu
                </div>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('daily-training')}
                className="p-4 rounded-lg bg-[#090B10] border border-white/[0.08] hover:border-white/20 text-left transition-colors"
              >
                <div className="text-sm font-semibold text-white">Kiểm duyệt bài tập &amp; Đánh giá AI</div>
                <div className="text-xs text-slate-400 mt-1">
                  Kiểm tra trạng thái bài tập, nhận xét AI và duyệt ảnh bằng chứng của từng tuyển thủ
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-semibold text-base text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-sky-400" />
                <span>Nhiệm vụ Manager giao cho bạn ({myAssignedDrills.length})</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Hoàn thành bài tập và tải ảnh chụp màn hình kết quả trong Daily Training để Manager duyệt.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('daily-training')}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white"
              >
                Cập nhật tiến độ &amp; Nộp ảnh
              </button>
              <button
                type="button"
                onClick={() => onNavigate('availability')}
                className="px-3 py-1.5 rounded-lg bg-sky-500 text-slate-950 text-xs font-semibold"
              >
                Đăng ký lịch rảnh
              </button>
            </div>
          </div>
          {myAssignedDrills.length === 0 ? (
            <p className="text-xs text-slate-400 py-4">
              Chưa có nhiệm vụ mới từ Manager. Bạn có thể mở Daily Training để luyện tập giáo án AI hôm nay.
            </p>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {myAssignedDrills.map((d) => (
                <div key={d.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="text-sm font-medium text-white">{d.title}</div>
                    <div className="text-slate-400">
                      {d.category} · {d.date} {d.startTime} ({d.durationMin}m)
                    </div>
                  </div>
                  <span className="font-mono text-sky-400">{d.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
