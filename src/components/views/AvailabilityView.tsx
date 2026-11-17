import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit3,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import type {
  AvailabilitySlot,
  DataSourceMode,
  Scrim,
  TeamMember,
  TeamRole,
} from '../../types/training';
import { computeTeamAvailabilityOverlap } from '../../utils/analytics';
import {
  formatFullVNDate,
  formatShortVNDate,
  getMonthCalendarCells,
  getShortWeekdayVN,
  getVNDateKey,
  getWeekDateKeys,
  timeToMinutes,
} from '../../utils/timezone';

interface AvailabilityViewProps {
  availabilities: AvailabilitySlot[];
  members: TeamMember[];
  currentUserId: string;
  currentMemberName: string;
  activeRole: TeamRole;
  dataMode: DataSourceMode;
  teamId: string;
  teamOwnerId: string;
  onSaveAvailability: (slot: AvailabilitySlot, isNew: boolean) => Promise<void>;
  onDeleteAvailability: (slotId: string) => Promise<void>;
  onCreatePlannedScrimFromWindow?: (draft: {
    date: string;
    startTime: string;
    endTime: string;
    opponent: string;
  }) => Promise<void>;
}

export function AvailabilityView({
  availabilities,
  members,
  currentUserId,
  currentMemberName,
  activeRole,
  dataMode,
  teamId,
  teamOwnerId,
  onSaveAvailability,
  onDeleteAvailability,
  onCreatePlannedScrimFromWindow,
}: AvailabilityViewProps) {
  const todayDate = getVNDateKey();
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

  // Registration form
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlot | null>(null);
  const [slotOwnerId, setSlotOwnerId] = useState<string>(currentUserId);
  const [slotDate, setSlotDate] = useState<string>(todayDate);
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('22:30');
  const [slotType, setSlotType] = useState<'available' | 'busy'>('available');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Scrim draft confirmation prompt (never auto-confirms without explicit user submit)
  const [scrimWindowDraft, setScrimWindowDraft] = useState<{
    startTime: string;
    endTime: string;
  } | null>(null);
  const [draftOpponent, setDraftOpponent] = useState('');

  const effectiveMembers: TeamMember[] = useMemo(() => {
    if (members.length > 0) return members;
    return [
      {
        uid: currentUserId,
        teamOwnerId,
        displayName: currentMemberName,
        riotId: currentMemberName,
        teamRole: activeRole,
        gameRole: 'Flex',
        mainAgent: 'Omen',
        scrimStatus: 'ready',
      },
    ];
  }, [members, currentUserId, teamOwnerId, currentMemberName, activeRole]);

  const analysis = useMemo(
    () =>
      computeTeamAvailabilityOverlap({
        members: effectiveMembers,
        availabilities,
        date: selectedDate,
      }),
    [effectiveMembers, availabilities, selectedDate],
  );

  const weekKeys = getWeekDateKeys(selectedDate);
  const [yearNum, monthNum] = selectedDate.split('-').map(Number);
  const monthCells = getMonthCalendarCells(yearNum, monthNum);

  const dayUserSlots = useMemo(
    () =>
      availabilities
        .filter((a) => a.date === selectedDate)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [availabilities, selectedDate],
  );

  const startEditSlot = (slot: AvailabilitySlot) => {
    setEditingSlot(slot);
    setSlotOwnerId(slot.ownerId);
    setSlotDate(slot.date);
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setSlotType(slot.slotType);
    setNotes(slot.notes || '');
    setError('');
  };

  const resetForm = () => {
    setEditingSlot(null);
    setSlotOwnerId(currentUserId);
    setSlotDate(selectedDate);
    setStartTime('19:00');
    setEndTime('22:30');
    setSlotType('available');
    setNotes('');
    setError('');
  };

  const handleSubmitSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      setError('Giờ kết thúc phải lớn hơn giờ bắt đầu.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const targetOwner = activeRole === 'coach' ? slotOwnerId : currentUserId;
      const memberObj = effectiveMembers.find((m) => m.uid === targetOwner);
      const payload: AvailabilitySlot = {
        id: editingSlot ? editingSlot.id : `avail_${Date.now()}`,
        teamId,
        teamOwnerId,
        ownerId: targetOwner,
        memberName: memberObj?.displayName || currentMemberName,
        date: slotDate,
        startTime,
        endTime,
        slotType,
        notes: notes.trim(),
      };
      await onSaveAvailability(payload, !editingSlot);
      setSelectedDate(slotDate);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu lịch trống.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls + Mini Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Registration Form & Month Calendar */}
        <div className="lg:col-span-4 space-y-5">
          {/* Calendar Picker */}
          <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold text-sm text-white">
                Lịch trống tháng {String(monthNum).padStart(2, '0')}/{yearNum}
              </h2>
              <div className="flex items-center gap-1 p-0.5 bg-[#090B10] border border-white/10 rounded-md">
                <button
                  type="button"
                  onClick={() => setViewMode('day')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium ${
                    viewMode === 'day' ? 'bg-[#FF4655] text-white' : 'text-slate-400'
                  }`}
                >
                  Ngày
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('week')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium ${
                    viewMode === 'week' ? 'bg-[#FF4655] text-white' : 'text-slate-400'
                  }`}
                >
                  Tuần
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500 mb-1">
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthCells.map((cell) => {
                const isSelected = cell.dateKey === selectedDate;
                const count = availabilities.filter(
                  (a) => a.date === cell.dateKey && a.slotType === 'available',
                ).length;
                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    onClick={() => {
                      setSelectedDate(cell.dateKey);
                      setSlotDate(cell.dateKey);
                    }}
                    className={`h-9 rounded-md text-xs font-mono tabular-nums flex flex-col items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-[#FF4655] text-white font-semibold'
                        : cell.inMonth
                        ? 'text-slate-200 hover:bg-white/[0.06]'
                        : 'text-slate-600'
                    }`}
                  >
                    <span>{cell.day}</span>
                    {count > 0 && !isSelected && (
                      <span className="w-1.5 h-0.5 bg-emerald-400 rounded-full mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Add / Edit Slot Form */}
          <form
            onSubmit={handleSubmitSlot}
            className="bg-[#121621] border border-white/[0.07] rounded-xl p-5 space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-sm text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-400" />
                <span>{editingSlot ? 'Sửa khung giờ' : 'Đăng ký lịch rảnh / bận'}</span>
              </h3>
              {editingSlot && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Hủy sửa
                </button>
              )}
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-[#FF4655]/15 border border-[#FF4655]/40 text-xs text-red-200">
                {error}
              </div>
            )}

            {activeRole === 'coach' && effectiveMembers.length > 1 && (
              <div>
                <label htmlFor="av-member" className="block text-xs font-medium text-slate-300 mb-1">
                  Thành viên
                </label>
                <select
                  id="av-member"
                  value={slotOwnerId}
                  onChange={(e) => setSlotOwnerId(e.target.value)}
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                >
                  {effectiveMembers.map((m) => (
                    <option key={m.uid} value={m.uid}>
                      {m.displayName} ({m.gameRole})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="av-date" className="block text-xs font-medium text-slate-300 mb-1">
                Ngày
              </label>
              <input
                id="av-date"
                type="date"
                required
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="av-start" className="block text-xs font-medium text-slate-300 mb-1">
                  Từ giờ
                </label>
                <input
                  id="av-start"
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor="av-end" className="block text-xs font-medium text-slate-300 mb-1">
                  Đến giờ
                </label>
                <input
                  id="av-end"
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-slate-300 mb-1.5">Loại khung giờ</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSlotType('available')}
                  className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                    slotType === 'available'
                      ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                      : 'bg-[#090B10] border-white/10 text-slate-400'
                  }`}
                >
                  Có thể Scrim (Rảnh)
                </button>
                <button
                  type="button"
                  onClick={() => setSlotType('busy')}
                  className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                    slotType === 'busy'
                      ? 'bg-[#FF4655]/20 border-[#FF4655]/60 text-red-200'
                      : 'bg-[#090B10] border-white/10 text-slate-400'
                  }`}
                >
                  Đánh dấu bận
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="av-notes" className="block text-xs font-medium text-slate-300 mb-1">
                Ghi chú cá nhân
              </label>
              <input
                id="av-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="VD: Sẵn sàng BO3 hoặc bận lịch học..."
                className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{saving ? 'Đang lưu...' : editingSlot ? 'Cập nhật khung giờ' : 'Thêm khung giờ'}</span>
            </button>
          </form>
        </div>

        {/* Right: Team Overlap Finder + Day/Week Matrix */}
        <div className="lg:col-span-8 space-y-5">
          {/* Conflict Alert if a member has overlapping available + busy */}
          {analysis.memberConflicts.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/35 rounded-xl p-4 space-y-1.5">
              <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Cảnh báo thành viên trùng lịch ngày {formatFullVNDate(selectedDate)}</span>
              </div>
              {analysis.memberConflicts.map((c, idx) => (
                <div key={idx} className="text-xs text-amber-100">
                  · {c.memberName}: {c.startTime}–{c.endTime} ({c.reason})
                </div>
              ))}
            </div>
          )}

          {/* Best Recommended Scrim Windows */}
          <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-display font-semibold text-base text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>
                    Đề xuất khung giờ Scrim tối ưu · {getShortWeekdayVN(selectedDate)}{' '}
                    {formatFullVNDate(selectedDate)}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {dataMode === 'demo'
                    ? 'Đang tính giao điểm lịch rảnh từ dữ liệu Demo của đội hình 6 thành viên.'
                    : 'Tự động tìm khung giờ tất cả thành viên đều rảnh. Luôn cần xác nhận thủ công.'}
                </p>
              </div>
            </div>

            {analysis.recommendedWindows.length === 0 ? (
              <div className="p-4 rounded-lg bg-[#090B10] border border-dashed border-white/10 text-xs text-slate-400">
                Chưa tìm thấy khung giờ chung (&ge; 60 phút) trong ngày này. Hãy đăng ký thêm khung
                giờ rảnh của các thành viên.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analysis.recommendedWindows.map((win, idx) => (
                  <div
                    key={`${win.startTime}-${idx}`}
                    className="bg-[#090B10] border border-white/[0.08] rounded-lg p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-mono font-semibold text-white tabular-nums whitespace-nowrap">
                        {win.startTime} – {win.endTime}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums whitespace-nowrap">
                        {win.durationMin} phút ·{' '}
                        <span
                          className={
                            win.allAvailable ? 'text-emerald-400 font-medium' : 'text-amber-400'
                          }
                        >
                          {win.minAvailableCount}/{win.totalMembers} rảnh
                        </span>
                      </div>
                    </div>
                    {activeRole === 'coach' && onCreatePlannedScrimFromWindow && (
                      <button
                        type="button"
                        onClick={() => {
                          setScrimWindowDraft({
                            startTime: win.startTime,
                            endTime: win.endTime,
                          });
                          setDraftOpponent('');
                        }}
                        className="px-3 py-1.5 rounded-md bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-sky-300 text-xs font-medium whitespace-nowrap"
                      >
                        Đề xuất Scrim
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {scrimWindowDraft && onCreatePlannedScrimFromWindow && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!draftOpponent.trim()) return;
                  await onCreatePlannedScrimFromWindow({
                    date: selectedDate,
                    startTime: scrimWindowDraft.startTime,
                    endTime: scrimWindowDraft.endTime,
                    opponent: draftOpponent.trim(),
                  });
                  setScrimWindowDraft(null);
                  setDraftOpponent('');
                }}
                className="p-3.5 rounded-lg bg-[#090B10] border border-sky-400/40 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="text-xs text-slate-200 whitespace-nowrap font-mono">
                  Tạo Scrim Dự kiến ({scrimWindowDraft.startTime}–{scrimWindowDraft.endTime}):
                </div>
                <input
                  type="text"
                  required
                  value={draftOpponent}
                  onChange={(e) => setDraftOpponent(e.target.value)}
                  placeholder="Nhập tên đội đối thủ..."
                  className="flex-1 bg-[#121621] border border-white/10 rounded-md px-3 py-1.5 text-xs text-white"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-md bg-[#FF4655] text-white text-xs font-semibold"
                  >
                    Tạo trạng thái Dự kiến
                  </button>
                  <button
                    type="button"
                    onClick={() => setScrimWindowDraft(null)}
                    className="px-2.5 py-1.5 rounded-md bg-white/5 text-slate-300 text-xs"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Day / Week Availability View */}
          {viewMode === 'day' ? (
            <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-5 space-y-4">
              <h3 className="font-display font-semibold text-sm text-white">
                Chi tiết theo khung giờ (12:00 – 23:30) · Số thành viên rảnh
              </h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {analysis.slots
                  .filter((s) => s.startMin >= 12 * 60)
                  .map((slot) => {
                    const ratio =
                      slot.totalMembers > 0 ? slot.availableCount / slot.totalMembers : 0;
                    const isAll = slot.totalMembers > 0 && slot.availableCount === slot.totalMembers;
                    return (
                      <div
                        key={slot.startTime}
                        title={`Rảnh: ${slot.availableMembers
                          .map((m) => m.displayName)
                          .join(', ')}`}
                        className={`p-2 rounded-lg border text-center ${
                          isAll
                            ? 'bg-emerald-500/15 border-emerald-400/50'
                            : ratio >= 0.5
                            ? 'bg-sky-500/10 border-sky-400/30'
                            : 'bg-[#090B10] border-white/[0.06]'
                        }`}
                      >
                        <div className="text-[11px] font-mono tabular-nums text-slate-300">
                          {slot.startTime}
                        </div>
                        <div
                          className={`text-xs font-mono font-bold tabular-nums mt-0.5 ${
                            isAll
                              ? 'text-emerald-400'
                              : ratio >= 0.5
                              ? 'text-sky-300'
                              : 'text-slate-500'
                          }`}
                        >
                          {slot.availableCount}/{slot.totalMembers}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Member Slots List for Selected Date */}
              <div className="pt-4 border-t border-white/[0.06]">
                <h4 className="text-xs font-semibold text-slate-300 mb-3">
                  Các khung giờ đã đăng ký trong ngày ({dayUserSlots.length})
                </h4>
                {dayUserSlots.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    Chưa có khung giờ nào được đăng ký cho ngày {formatFullVNDate(selectedDate)}.
                  </p>
                ) : (
                  <div className="divide-y divide-white/[0.06]">
                    {dayUserSlots.map((slot) => {
                      const canEdit = activeRole === 'coach' || slot.ownerId === currentUserId;
                      return (
                        <div
                          key={slot.id}
                          className="py-2.5 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-medium text-white">{slot.memberName}</span>
                              <span aria-hidden="true" className="text-slate-600">·</span>
                              <span className="font-mono tabular-nums text-sky-400">
                                {slot.startTime} – {slot.endTime}
                              </span>
                              <span aria-hidden="true" className="text-slate-600">·</span>
                              <span
                                className={
                                  slot.slotType === 'available'
                                    ? 'text-emerald-400 font-medium'
                                    : 'text-[#FF4655] font-medium'
                                }
                              >
                                {slot.slotType === 'available' ? 'Rảnh' : 'Bận'}
                              </span>
                            </div>
                            {slot.notes && (
                              <div className="text-xs text-slate-400 mt-0.5">{slot.notes}</div>
                            )}
                          </div>

                          {canEdit && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => startEditSlot(slot)}
                                aria-label={`Sửa khung giờ của ${slot.memberName}`}
                                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteAvailability(slot.id)}
                                aria-label={`Xóa khung giờ ${slot.startTime} của ${slot.memberName}`}
                                className="p-1.5 rounded-md text-slate-400 hover:text-[#FF4655] hover:bg-white/5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-5 space-y-4">
              <h3 className="font-display font-semibold text-sm text-white">
                Tổng quan lịch trống tuần ({formatShortVNDate(weekKeys[0])} –{' '}
                {formatShortVNDate(weekKeys[6])})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {weekKeys.map((dk) => {
                  const dayAnalysis = computeTeamAvailabilityOverlap({
                    members: effectiveMembers,
                    availabilities,
                    date: dk,
                  });
                  const best = dayAnalysis.allFreeWindows[0];
                  return (
                    <button
                      key={dk}
                      type="button"
                      onClick={() => {
                        setSelectedDate(dk);
                        setSlotDate(dk);
                        setViewMode('day');
                      }}
                      className={`p-3.5 rounded-lg border text-left transition-colors ${
                        dk === selectedDate
                          ? 'bg-[#FF4655]/10 border-[#FF4655]/50'
                          : 'bg-[#090B10] border-white/[0.07] hover:border-white/20'
                      }`}
                    >
                      <div className="text-xs font-semibold text-white">
                        {getShortWeekdayVN(dk)} · {formatShortVNDate(dk)}
                      </div>
                      <div className="mt-2 text-xs font-mono tabular-nums">
                        {best ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              Full đội: {best.startTime}–{best.endTime}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-500">Chưa đủ full đội</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
