import React, { useState } from 'react';
import { Plus, Shield, Trash2, UserCheck, Users } from 'lucide-react';
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

interface TeamManagementViewProps {
  team: TeamWorkspace;
  members: TeamMember[];
  drills: TrainingDrill[];
  availabilities: AvailabilitySlot[];
  activeRole: TeamRole;
  currentUserId: string;
  dataMode: DataSourceMode;
  onSwitchPreviewRole?: (role: TeamRole) => void;
  onSaveMember: (member: TeamMember, isNew: boolean) => Promise<void>;
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
  dataMode,
  onSwitchPreviewRole,
  onSaveMember,
  onDeleteMember,
  onAssignDrill,
  onNavigate,
}: TeamManagementViewProps) {
  const todayDate = getVNDateKey();
  const weekSet = new Set(getWeekDateKeys(todayDate));
  const canManageRoster = activeRole === 'coach' || team.ownerId === currentUserId;

  // Add member form (Coach/Manager or Workspace Owner)
  const [showAddMember, setShowAddMember] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRiotId, setNewRiotId] = useState('');
  const [newGameRole, setNewGameRole] = useState<GameRole>('Duelist');
  const [newAgent, setNewAgent] = useState('Jett');
  const [newTeamRole, setNewTeamRole] = useState<TeamRole>('player');
  const [rosterBusy, setRosterBusy] = useState(false);
  const [rosterError, setRosterError] = useState('');
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);

  // Assign drill form (Coach/Manager)
  const [assignTargetUid, setAssignTargetUid] = useState(
    members.find((m) => m.teamRole === 'player')?.uid || currentUserId,
  );
  const [drillTitle, setDrillTitle] = useState('');
  const [drillCategory, setDrillCategory] = useState<DrillCategory>('Crosshair Placement');
  const [drillTime, setDrillTime] = useState('15:00');
  const [drillDuration, setDrillDuration] = useState(45);
  const [drillGoal, setDrillGoal] = useState('');
  const [assignMessage, setAssignMessage] = useState('');

  const resolvedAssignTargetUid = members.some((m) => m.uid === assignTargetUid)
    ? assignTargetUid
    : members[0]?.uid || currentUserId;

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newRiotId.trim()) return;
    setRosterBusy(true);
    setRosterError('');
    try {
      const member: TeamMember = {
        uid: `member_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        teamOwnerId: team.ownerId,
        displayName: newName.trim().slice(0, 80),
        riotId: newRiotId.trim().slice(0, 40),
        teamRole: newTeamRole,
        gameRole: newGameRole,
        mainAgent: (newAgent.trim() || 'Flex').slice(0, 40),
        scrimStatus: 'ready',
      };
      await onSaveMember(member, true);
      setNewName('');
      setNewRiotId('');
      setNewAgent('Jett');
      setNewGameRole('Duelist');
      setNewTeamRole('player');
      setShowAddMember(false);
    } catch (err) {
      setRosterError(err instanceof Error ? err.message : 'Không thể thêm player.');
    } finally {
      setRosterBusy(false);
    }
  };

  const handleConfirmDeleteMember = async (memberUid: string) => {
    setRosterBusy(true);
    setRosterError('');
    try {
      await onDeleteMember(memberUid);
      setConfirmDeleteUid(null);
    } catch (err) {
      setRosterError(err instanceof Error ? err.message : 'Không thể xóa player.');
    } finally {
      setRosterBusy(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drillTitle.trim()) return;
    const payload: TrainingDrill = {
      id: `drill_${Date.now()}`,
      teamId: team.id,
      teamOwnerId: team.ownerId,
      ownerId: resolvedAssignTargetUid,
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
    setDrillTitle('');
    setDrillGoal('');
    setAssignMessage('Đã giao bài tập thành công cho tuyển thủ.');
    window.setTimeout(() => setAssignMessage(''), 3000);
  };

  const myAssignedDrills = drills.filter(
    (d) => d.ownerId === currentUserId && d.date >= todayDate,
  );

  return (
    <div className="space-y-6">
      {/* Role & Team Summary Bar */}
      <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-400">Đội tuyển & Phân quyền</div>
          <h2 className="font-display font-bold text-lg text-white mt-0.5">
            {team.name} ({team.tag}) · {members.length} thành viên
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {dataMode === 'demo'
              ? 'Bạn có thể chuyển đổi nhanh giữa quyền Coach/Manager và Player, hoặc thêm/xóa player trong đội hình.'
              : dataMode === 'local_account'
              ? 'Quản lý danh sách player trong đội hình của bạn và đồng bộ trực tiếp vào tài khoản riêng.'
              : 'Quyền hạn được kiểm soát trực tiếp qua Firebase Auth & Firestore Security Rules.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {dataMode === 'demo' && onSwitchPreviewRole && (
            <div className="flex items-center gap-1 p-1 bg-[#090B10] border border-white/10 rounded-lg">
              <button
                type="button"
                onClick={() => onSwitchPreviewRole('coach')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                  activeRole === 'coach' ? 'bg-[#FF4655] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Coach / Manager
              </button>
              <button
                type="button"
                onClick={() => onSwitchPreviewRole('player')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                  activeRole === 'player' ? 'bg-sky-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Player View
              </button>
            </div>
          )}

          {canManageRoster && (
            <button
              type="button"
              onClick={() => {
                setRosterError('');
                setShowAddMember((v) => !v);
              }}
              className="px-4 py-2 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm player</span>
            </button>
          )}
        </div>
      </div>

      {rosterError && (
        <div className="p-3 rounded-lg bg-[#FF4655]/15 border border-[#FF4655]/40 text-xs text-red-200 flex items-center justify-between gap-3">
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

      {/* Add Roster Member Form */}
      {canManageRoster && showAddMember && (
        <form
          onSubmit={handleAddMember}
          className="bg-[#121621] border border-white/[0.08] rounded-xl p-5 space-y-4"
        >
          <h3 className="font-display font-semibold text-sm text-white">
            Thêm player vào đội hình
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              type="text"
              required
              aria-label="Tên player"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tên tuyển thủ"
              className="bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
            />
            <input
              type="text"
              required
              aria-label="Riot ID player"
              value={newRiotId}
              onChange={(e) => setNewRiotId(e.target.value)}
              placeholder="Riot ID (VD: TenZ#VN1)"
              className="bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
            />
            <select
              aria-label="Role trong game"
              value={newGameRole}
              onChange={(e) => setNewGameRole(e.target.value as GameRole)}
              className="bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
            >
              {GAME_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              type="text"
              aria-label="Agent chính"
              value={newAgent}
              onChange={(e) => setNewAgent(e.target.value)}
              placeholder="Agent chính (VD: Jett)"
              className="bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
            />
            <select
              aria-label="Vai trò trong đội"
              value={newTeamRole}
              onChange={(e) => setNewTeamRole(e.target.value as TeamRole)}
              className="bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
            >
              <option value="player">Player</option>
              <option value="coach">Coach / Manager</option>
            </select>
          </div>
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
              {rosterBusy ? 'Đang lưu...' : 'Lưu player'}
            </button>
          </div>
        </form>
      )}

      {/* Team Roster Table */}
      <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-base text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-400" />
            <span>Đội hình & Tiến độ luyện tập tuần</span>
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('availability')}
            className="text-xs font-medium text-sky-400 hover:text-sky-300"
          >
            Xem lịch trống từng thành viên
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] text-slate-400">
                <th className="py-2.5 pr-4 font-medium">Thành viên / Riot ID</th>
                <th className="py-2.5 pr-4 font-medium">Quyền</th>
                <th className="py-2.5 pr-4 font-medium">Role & Agent</th>
                <th className="py-2.5 pr-4 text-right font-medium">Giờ tập tuần</th>
                <th className="py-2.5 pr-4 text-right font-medium">Bài tập xong</th>
                <th className="py-2.5 pr-4 text-right font-medium">Khung giờ rảnh</th>
                <th className={`py-2.5 ${canManageRoster ? 'pr-4' : ''} text-right font-medium`}>
                  Trạng thái Scrim
                </th>
                {canManageRoster && (
                  <th className="py-2.5 text-right font-medium">Thao tác</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {members.map((m) => {
                const mDrills = drills.filter((d) => d.ownerId === m.uid && weekSet.has(d.date));
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
                const canChangeStatus = canManageRoster || m.uid === currentUserId;
                const canDeleteThisMember =
                  canManageRoster && m.uid !== team.ownerId && m.uid !== currentUserId;
                const isConfirmingDelete = confirmDeleteUid === m.uid;

                return (
                  <tr key={m.uid} className="hover:bg-white/[0.02]">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-white">{m.displayName}</div>
                      <div className="font-mono text-[11px] text-slate-400">{m.riotId}</div>
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {m.teamRole === 'coach' ? 'Coach / Manager' : 'Player'}
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
                            onSaveMember(
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
                        {canDeleteThisMember ? (
                          isConfirmingDelete ? (
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
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteUid(m.uid)}
                              aria-label={`Xóa player ${m.displayName}`}
                              title="Xóa player"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[#FF4655] hover:bg-white/5 transition-colors inline-flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        ) : (
                          <span className="text-[11px] text-slate-500">
                            {m.uid === team.ownerId ? 'Chủ đội' : 'Bạn'}
                          </span>
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
      {activeRole === 'coach' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleAssignSubmit}
            className="lg:col-span-6 bg-[#121621] border border-white/[0.07] rounded-xl p-5 space-y-4"
          >
            <h3 className="font-display font-semibold text-base text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#FF4655]" />
              <span>Giao bài tập cho thành viên (Coach / Manager)</span>
            </h3>

            {assignMessage && (
              <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-300">
                {assignMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="assign-player" className="block text-xs text-slate-300 mb-1">
                  Chọn tuyển thủ
                </label>
                <select
                  id="assign-player"
                  value={resolvedAssignTargetUid}
                  onChange={(e) => setAssignTargetUid(e.target.value)}
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                >
                  {members.map((m) => (
                    <option key={m.uid} value={m.uid}>
                      {m.displayName} ({m.gameRole})
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
                Mục tiêu cụ thể
              </label>
              <input
                id="assign-goal"
                type="text"
                value={drillGoal}
                onChange={(e) => setDrillGoal(e.target.value)}
                placeholder="Ghi chú yêu cầu kỹ thuật của Coach..."
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
              Điều phối nhanh cho Coach / Manager
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Quản lý toàn bộ quy trình vận hành đội tuyển từ theo dõi giáo án cá nhân đến chốt lịch
              Scrim dựa trên lịch trống của cả đội.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
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
                onClick={() => onNavigate('performance')}
                className="p-4 rounded-lg bg-[#090B10] border border-white/[0.08] hover:border-white/20 text-left transition-colors"
              >
                <div className="text-sm font-semibold text-white">Báo cáo toàn đội</div>
                <div className="text-xs text-slate-400 mt-1">
                  Xem tổng giờ tập, tỷ lệ hoàn thành & xuất CSV
                </div>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('daily-training')}
                className="p-4 rounded-lg bg-[#090B10] border border-white/[0.08] hover:border-white/20 text-left transition-colors"
              >
                <div className="text-sm font-semibold text-white">Lịch tập toàn đội</div>
                <div className="text-xs text-slate-400 mt-1">
                  Kiểm tra trạng thái bài tập của từng tuyển thủ
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-base text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-sky-400" />
              <span>Nhiệm vụ được giao cho bạn ({myAssignedDrills.length})</span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('daily-training')}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white"
              >
                Cập nhật tiến độ
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
              Chưa có nhiệm vụ mới từ Coach. Bạn có thể tự tạo bài tập trong Daily Training.
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
