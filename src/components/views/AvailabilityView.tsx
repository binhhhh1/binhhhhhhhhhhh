import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  Plus,
  Sparkles,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import type {
  AvailabilitySlot,
  DataSourceMode,
  TeamMember,
  TeamRole,
} from '../../types/training';
import { computeTeamAvailabilityOverlap } from '../../utils/analytics';
import {
  addDaysToDateKey,
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

interface QuickTimePreset {
  id: string;
  label: string;
  subLabel: string;
  startTime: string;
  endTime: string;
  slotType: 'available' | 'busy';
}

const QUICK_TIME_PRESETS: QuickTimePreset[] = [
  {
    id: 'afternoon',
    label: 'Chiều · 14:00–17:00',
    subLabel: 'Rảnh buổi chiều',
    startTime: '14:00',
    endTime: '17:00',
    slotType: 'available',
  },
  {
    id: 'early_evening',
    label: 'Tối sớm · 19:00–22:00',
    subLabel: 'Khung Scrim phổ biến',
    startTime: '19:00',
    endTime: '22:00',
    slotType: 'available',
  },
  {
    id: 'prime_scrim',
    label: 'Prime · 19:30–22:30',
    subLabel: 'Khung Scrim chuẩn',
    startTime: '19:30',
    endTime: '22:30',
    slotType: 'available',
  },
  {
    id: 'late_night',
    label: 'Tối muộn · 20:00–23:00',
    subLabel: 'Scrim muộn',
    startTime: '20:00',
    endTime: '23:00',
    slotType: 'available',
  },
  {
    id: 'busy_evening',
    label: 'Bận tối · 19:00–23:00',
    subLabel: 'Không thể Scrim',
    startTime: '19:00',
    endTime: '23:00',
    slotType: 'busy',
  },
];

const MATRIX_HOURS = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

function shiftMonthDateKey(dateKey: string, deltaMonths: number): string {
  const [y, m] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + deltaMonths, 1, 12, 0, 0));
  const ny = dt.getUTCFullYear();
  const nm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${ny}-${nm}-01`;
}

export function AvailabilityView({
  availabilities,
  members,
  currentUserId,
  currentMemberName,
  activeRole,
  teamId,
  teamOwnerId,
  onSaveAvailability,
  onDeleteAvailability,
  onCreatePlannedScrimFromWindow,
}: AvailabilityViewProps) {
  const todayDate = getVNDateKey();
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);
  const [calendarMonthAnchor, setCalendarMonthAnchor] = useState<string>(todayDate);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

  // Registration form (Players)
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlot | null>(null);
  const [slotDate, setSlotDate] = useState<string>(todayDate);
  const [applyScope, setApplyScope] = useState<'single' | 'week'>('single');
  const [startTime, setStartTime] = useState('19:30');
  const [endTime, setEndTime] = useState('22:30');
  const [slotType, setSlotType] = useState<'available' | 'busy'>('available');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Scrim draft confirmation prompt (Manager)
  const [scrimWindowDraft, setScrimWindowDraft] = useState<{
    date: string;
    startTime: string;
    endTime: string;
  } | null>(null);
  const [draftOpponent, setDraftOpponent] = useState('');

  const playerMembers: TeamMember[] = useMemo(() => {
    const players = members.filter((m) => m.teamRole === 'player');
    if (players.length > 0) return players;
    if (activeRole === 'player') {
      return [
        {
          uid: currentUserId,
          teamOwnerId,
          displayName: currentMemberName,
          riotId: currentMemberName,
          teamRole: 'player',
          gameRole: 'Flex',
          mainAgent: 'Omen',
          scrimStatus: 'ready',
        },
      ];
    }
    return [];
  }, [members, currentUserId, teamOwnerId, currentMemberName, activeRole]);

  const playerUidSet = useMemo(
    () => new Set(playerMembers.map((m) => m.uid)),
    [playerMembers],
  );

  const playerAvailabilities = useMemo(
    () =>
      availabilities.filter(
        (a) => playerUidSet.size === 0 || playerUidSet.has(a.ownerId),
      ),
    [availabilities, playerUidSet],
  );

  const analysis = useMemo(
    () =>
      computeTeamAvailabilityOverlap({
        members: playerMembers,
        availabilities: playerAvailabilities,
        date: selectedDate,
      }),
    [playerMembers, playerAvailabilities, selectedDate],
  );

  const weekKeys = useMemo(() => getWeekDateKeys(selectedDate), [selectedDate]);
  const [yearNum, monthNum] = calendarMonthAnchor.split('-').map(Number);
  const monthCells = useMemo(
    () => getMonthCalendarCells(yearNum, monthNum),
    [yearNum, monthNum],
  );

  const dayUserSlots = useMemo(
    () =>
      playerAvailabilities
        .filter((a) => a.date === selectedDate)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [playerAvailabilities, selectedDate],
  );

  const mySlotsOnSelectedDate = useMemo(
    () => dayUserSlots.filter((s) => s.ownerId === currentUserId),
    [dayUserSlots, currentUserId],
  );

  const submittedPlayerCountToday = useMemo(() => {
    const ids = new Set(dayUserSlots.map((s) => s.ownerId));
    return playerMembers.filter((m) => ids.has(m.uid)).length;
  }, [dayUserSlots, playerMembers]);

  const selectDateAndSyncCalendar = (nextDate: string) => {
    setSelectedDate(nextDate);
    setSlotDate(nextDate);
    setCalendarMonthAnchor(nextDate);
  };

  const applyPreset = (preset: QuickTimePreset) => {
    setStartTime(preset.startTime);
    setEndTime(preset.endTime);
    setSlotType(preset.slotType);
    setError('');
  };

  const startEditSlot = (slot: AvailabilitySlot) => {
    if (activeRole !== 'player') return;
    setEditingSlot(slot);
    setSlotDate(slot.date);
    setApplyScope('single');
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setSlotType(slot.slotType);
    setNotes(slot.notes || '');
    setError('');
    setSuccessMsg('');
  };

  const resetForm = () => {
    setEditingSlot(null);
    setSlotDate(selectedDate);
    setApplyScope('single');
    setStartTime('19:30');
    setEndTime('22:30');
    setSlotType('available');
    setNotes('');
    setError('');
  };

  const handleSubmitSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeRole !== 'player') return;
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      setError('Giờ kết thúc phải lớn hơn giờ bắt đầu.');
      return;
    }
    setError('');
    setSuccessMsg('');
    setSaving(true);
    try {
      const targetOwner = currentUserId;
      const memberObj = playerMembers.find((m) => m.uid === targetOwner);
      const memberDisplay = memberObj?.displayName || currentMemberName;

      if (editingSlot) {
        const payload: AvailabilitySlot = {
          id: editingSlot.id,
          teamId,
          teamOwnerId,
          ownerId: targetOwner,
          memberName: memberDisplay,
          date: slotDate,
          startTime,
          endTime,
          slotType,
          notes: notes.trim(),
        };
        await onSaveAvailability(payload, false);
        setSuccessMsg(`Đã cập nhật khung giờ ${startTime}–${endTime} ngày ${formatShortVNDate(slotDate)}.`);
      } else {
        const targetDates =
          applyScope === 'week' ? getWeekDateKeys(slotDate) : [slotDate];

        for (let i = 0; i < targetDates.length; i++) {
          const dk = targetDates[i];
          const duplicateExists = playerAvailabilities.some(
            (a) =>
              a.ownerId === targetOwner &&
              a.date === dk &&
              a.startTime === startTime &&
              a.endTime === endTime &&
              a.slotType === slotType,
          );
          if (duplicateExists) continue;

          const payload: AvailabilitySlot = {
            id: `avail_${Date.now()}_${i}`,
            teamId,
            teamOwnerId,
            ownerId: targetOwner,
            memberName: memberDisplay,
            date: dk,
            startTime,
            endTime,
            slotType,
            notes: notes.trim(),
          };
          await onSaveAvailability(payload, true);
        }

        setSuccessMsg(
          applyScope === 'week'
            ? `Đã đăng ký nhanh ${startTime}–${endTime} cho cả tuần (${formatShortVNDate(targetDates[0])} – ${formatShortVNDate(targetDates[6])}).`
            : `Đã lưu khung giờ ${startTime}–${endTime} cho ngày ${formatShortVNDate(slotDate)}.`,
        );
      }

      selectDateAndSyncCalendar(slotDate);
      resetForm();
      window.setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu lịch trống.');
    } finally {
      setSaving(false);
    }
  };

  // Compute player-by-hour cell state for the visual timeline matrix
  const getMemberHourStatus = (
    memberUid: string,
    hour: number,
  ): 'available' | 'busy' | 'empty' => {
    const hStart = hour * 60;
    const hEnd = (hour + 1) * 60;
    const slotsForMember = dayUserSlots.filter((s) => s.ownerId === memberUid);

    const hasBusy = slotsForMember.some(
      (s) =>
        s.slotType === 'busy' &&
        timeToMinutes(s.startTime) < hEnd &&
        timeToMinutes(s.endTime) > hStart,
    );
    if (hasBusy) return 'busy';

    const hasAvail = slotsForMember.some(
      (s) =>
        s.slotType === 'available' &&
        timeToMinutes(s.startTime) < hEnd &&
        timeToMinutes(s.endTime) > hStart,
    );
    return hasAvail ? 'available' : 'empty';
  };

  const bestWindow = analysis.allFreeWindows[0] || analysis.recommendedWindows[0] || null;

  return (
    <div className="space-y-5">
      {/* Top Hero Controls & Quick Summary Strip */}
      <div className="bg-[#121621] border border-white/[0.08] rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-[#090B10] border border-white/10 rounded-lg p-1">
            <button
              type="button"
              onClick={() => selectDateAndSyncCalendar(addDaysToDateKey(selectedDate, -1))}
              aria-label="Ngày trước"
              className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/[0.07] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => selectDateAndSyncCalendar(todayDate)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                selectedDate === todayDate
                  ? 'bg-[#FF4655] text-white'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.07]'
              }`}
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => selectDateAndSyncCalendar(addDaysToDateKey(selectedDate, 1))}
              aria-label="Ngày tiếp theo"
              className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/[0.07] transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div>
            <div className="text-sm sm:text-base font-display font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#FF4655] shrink-0" />
              <span>
                {getShortWeekdayVN(selectedDate)} · {formatFullVNDate(selectedDate)}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
              <span>
                Đã khai báo:{' '}
                <strong className="text-white font-mono">
                  {submittedPlayerCountToday}/{playerMembers.length}
                </strong>{' '}
                tuyển thủ
              </span>
              <span aria-hidden="true">·</span>
              {bestWindow ? (
                <span className="text-emerald-400 font-medium font-mono">
                  Giờ chung tốt nhất: {bestWindow.startTime}–{bestWindow.endTime} (
                  {bestWindow.minAvailableCount}/{bestWindow.totalMembers} rảnh)
                </span>
              ) : (
                <span className="text-amber-300">Chưa có khung giờ chung &ge; 60 phút</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="inline-flex items-center gap-1 p-1 bg-[#090B10] border border-white/10 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('day')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                viewMode === 'day'
                  ? 'bg-[#FF4655] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Xem theo Ngày
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                viewMode === 'week'
                  ? 'bg-[#FF4655] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Xem cả Tuần (T2–CN)
            </button>
          </div>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Month Picker + Quick Registration / Manager Roster Status */}
        <div className="lg:col-span-4 space-y-5">
          {/* Interactive Month Calendar */}
          <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold text-sm text-white">
                Tháng {String(monthNum).padStart(2, '0')}/{yearNum}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setCalendarMonthAnchor((prev) => shiftMonthDateKey(prev, -1))
                  }
                  aria-label="Tháng trước"
                  className="p-1.5 rounded-md bg-[#090B10] border border-white/10 text-slate-300 hover:text-white"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCalendarMonthAnchor((prev) => shiftMonthDateKey(prev, 1))
                  }
                  aria-label="Tháng sau"
                  className="p-1.5 rounded-md bg-[#090B10] border border-white/10 text-slate-300 hover:text-white"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500 mb-1.5 font-medium">
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthCells.map((cell) => {
                const isSelected = cell.dateKey === selectedDate;
                const isToday = cell.dateKey === todayDate;
                const daySlots = playerAvailabilities.filter(
                  (a) => a.date === cell.dateKey,
                );
                const availPlayerCount = new Set(
                  daySlots
                    .filter((s) => s.slotType === 'available')
                    .map((s) => s.ownerId),
                ).size;
                const myFilled =
                  activeRole === 'player' &&
                  daySlots.some((s) => s.ownerId === currentUserId);

                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    onClick={() => selectDateAndSyncCalendar(cell.dateKey)}
                    className={`h-10 rounded-lg text-xs font-mono tabular-nums flex flex-col items-center justify-center transition-colors relative border ${
                      isSelected
                        ? 'bg-[#FF4655] border-[#FF4655] text-white font-bold shadow-sm'
                        : isToday
                        ? 'bg-sky-500/10 border-sky-400/50 text-sky-300 font-semibold'
                        : cell.inMonth
                        ? 'bg-[#090B10]/60 border-transparent text-slate-200 hover:bg-white/[0.06] hover:border-white/10'
                        : 'border-transparent text-slate-600'
                    }`}
                  >
                    <span>{cell.day}</span>
                    {availPlayerCount > 0 && !isSelected && (
                      <span
                        className={`w-3.5 h-1 rounded-full mt-0.5 ${
                          myFilled
                            ? 'bg-sky-400'
                            : availPlayerCount >= playerMembers.length &&
                              playerMembers.length > 0
                            ? 'bg-emerald-400'
                            : 'bg-emerald-400/60'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-1 rounded-full bg-emerald-400" />
                Có lịch rảnh
              </span>
              {activeRole === 'player' && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-1 rounded-full bg-sky-400" />
                  Bạn đã điền
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded border border-sky-400/60 bg-sky-500/15" />
                Hôm nay
              </span>
            </div>
          </div>

          {activeRole === 'player' ? (
            /* Player: Easy Quick-Register Card */
            <form
              onSubmit={handleSubmitSlot}
              className="bg-[#121621] border border-white/[0.08] rounded-xl p-4 sm:p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-display font-semibold text-sm text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-sky-400" />
                    <span>
                      {editingSlot ? 'Cập nhật khung giờ' : 'Đăng ký nhanh lịch trống'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Chọn mẫu giờ bên dưới hoặc chỉnh tay để lưu ngay.
                  </p>
                </div>
                {editingSlot && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs text-slate-400 hover:text-white underline shrink-0"
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
              {successMsg && (
                <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-200">
                  {successMsg}
                </div>
              )}

              {/* 1-Click Presets */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-sky-400" />
                  <span>1-Click Chọn nhanh khung giờ:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {QUICK_TIME_PRESETS.map((preset) => {
                    const isActive =
                      startTime === preset.startTime &&
                      endTime === preset.endTime &&
                      slotType === preset.slotType;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className={`px-2.5 py-2 rounded-lg border text-left transition-colors ${
                          isActive
                            ? preset.slotType === 'available'
                              ? 'bg-emerald-500/15 border-emerald-400/60 text-emerald-200'
                              : 'bg-[#FF4655]/15 border-[#FF4655]/60 text-red-200'
                            : 'bg-[#090B10] border-white/10 text-slate-300 hover:border-white/25'
                        }`}
                      >
                        <div className="text-[11px] font-mono font-semibold truncate">
                          {preset.label}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {preset.subLabel}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date + Scope */}
              <div className="space-y-2.5 pt-2 border-t border-white/[0.06]">
                <div>
                  <label htmlFor="av-date" className="block text-xs font-medium text-slate-300 mb-1">
                    Ngày áp dụng
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

                {!editingSlot && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setApplyScope('single')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border transition-colors ${
                        applyScope === 'single'
                          ? 'bg-sky-500/15 border-sky-400/60 text-sky-300'
                          : 'bg-[#090B10] border-white/10 text-slate-400'
                      }`}
                    >
                      Chỉ ngày {formatShortVNDate(slotDate)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setApplyScope('week')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border transition-colors ${
                        applyScope === 'week'
                          ? 'bg-sky-500/15 border-sky-400/60 text-sky-300'
                          : 'bg-[#090B10] border-white/10 text-slate-400'
                      }`}
                    >
                      Cả tuần (T2–CN)
                    </button>
                  </div>
                )}
              </div>

              {/* Time Range */}
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

              {/* Status Toggle */}
              <div>
                <div className="text-xs font-medium text-slate-300 mb-1.5">Trạng thái</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSlotType('available')}
                    className={`py-2 rounded-lg text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                      slotType === 'available'
                        ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                        : 'bg-[#090B10] border-white/10 text-slate-400'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Rảnh (Scrim)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotType('busy')}
                    className={`py-2 rounded-lg text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                      slotType === 'busy'
                        ? 'bg-[#FF4655]/20 border-[#FF4655]/60 text-red-200'
                        : 'bg-[#090B10] border-white/10 text-slate-400'
                    }`}
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Bận</span>
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="av-notes" className="block text-xs font-medium text-slate-300 mb-1">
                  Ghi chú (tùy chọn)
                </label>
                <input
                  id="av-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="VD: Sẵn sàng BO3 hoặc bận lịch học..."
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {saving
                    ? 'Đang lưu...'
                    : editingSlot
                    ? 'Cập nhật khung giờ'
                    : applyScope === 'week'
                    ? 'Áp dụng cho cả tuần (T2–CN)'
                    : 'Lưu lịch trống'}
                </span>
              </button>

              {/* My Slots Today Quick Summary */}
              {mySlotsOnSelectedDate.length > 0 && (
                <div className="pt-3 border-t border-white/[0.06] space-y-2">
                  <div className="text-[11px] font-semibold text-slate-300">
                    Lịch của bạn ngày {formatShortVNDate(selectedDate)}:
                  </div>
                  <div className="space-y-1.5">
                    {mySlotsOnSelectedDate.map((s) => (
                      <div
                        key={s.id}
                        className="px-2.5 py-2 rounded-lg bg-[#090B10] border border-white/[0.07] flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              s.slotType === 'available' ? 'bg-emerald-400' : 'bg-[#FF4655]'
                            }`}
                          />
                          <span className="font-mono text-white">
                            {s.startTime}–{s.endTime}
                          </span>
                          <span
                            className={`text-[11px] ${
                              s.slotType === 'available' ? 'text-emerald-400' : 'text-red-300'
                            }`}
                          >
                            {s.slotType === 'available' ? 'Rảnh' : 'Bận'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEditSlot(s)}
                            aria-label="Sửa khung giờ"
                            className="p-1 rounded text-slate-400 hover:text-white"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeleteAvailability(s.id)}
                            aria-label="Xóa khung giờ"
                            className="p-1 rounded text-slate-400 hover:text-[#FF4655]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          ) : (
            /* Manager / Admin Only: Clean Roster Availability Oversight Card */
            <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4 sm:p-5 space-y-3.5">
              <div>
                <div className="text-[11px] font-semibold text-[#FF4655] uppercase tracking-wider">
                  Giám sát của Manager
                </div>
                <h3 className="font-display font-semibold text-sm text-white mt-0.5">
                  Trạng thái lịch Tuyển thủ ({formatShortVNDate(selectedDate)})
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Manager chỉ kiểm tra tổng hợp giờ rảnh của {playerMembers.length} tuyển thủ và chốt lịch Scrim — không điền lịch trống cá nhân.
                </p>
              </div>

              <div className="pt-2 border-t border-white/[0.06] space-y-2">
                {playerMembers.map((pm) => {
                  const pmSlots = dayUserSlots.filter((s) => s.ownerId === pm.uid);
                  const availSlots = pmSlots.filter((s) => s.slotType === 'available');
                  const busySlots = pmSlots.filter((s) => s.slotType === 'busy');
                  return (
                    <div
                      key={pm.uid}
                      className="p-2.5 rounded-lg bg-[#090B10] border border-white/[0.06] space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate">
                            {pm.displayName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono truncate">
                            {pm.riotId} · {pm.gameRole}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-medium shrink-0 ${
                            availSlots.length > 0
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : busySlots.length > 0
                              ? 'bg-[#FF4655]/15 text-red-300 border border-[#FF4655]/30'
                              : 'bg-white/[0.05] text-slate-400 border border-white/10'
                          }`}
                        >
                          {availSlots.length > 0
                            ? 'Đã báo rảnh'
                            : busySlots.length > 0
                            ? 'Báo bận'
                            : 'Chưa điền'}
                        </span>
                      </div>
                      {pmSlots.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {pmSlots.map((s) => (
                            <span
                              key={s.id}
                              className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                                s.slotType === 'available'
                                  ? 'bg-emerald-500/10 text-emerald-300'
                                  : 'bg-[#FF4655]/10 text-red-300'
                              }`}
                            >
                              {s.startTime}–{s.endTime}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Optimal Windows + Visual Player×Hour Timeline OR Week Overview */}
        <div className="lg:col-span-8 space-y-5">
          {/* Conflict Alert */}
          {analysis.memberConflicts.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/35 rounded-xl p-4 space-y-1.5">
              <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Cảnh báo trùng lịch Rảnh / Bận ngày {formatFullVNDate(selectedDate)}</span>
              </div>
              {analysis.memberConflicts.map((c, idx) => (
                <div key={idx} className="text-xs text-amber-100">
                  · {c.memberName}: {c.startTime}–{c.endTime} ({c.reason})
                </div>
              ))}
            </div>
          )}

          {/* Recommended Scrim Windows */}
          <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-display font-semibold text-base text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>
                    Khung giờ Scrim tối ưu · {getShortWeekdayVN(selectedDate)}{' '}
                    {formatFullVNDate(selectedDate)}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tự động đối chiếu {playerMembers.length} Tuyển thủ để tìm khoảng thời gian (&ge; 60 phút) có nhiều người rảnh nhất.
                </p>
              </div>
            </div>

            {analysis.recommendedWindows.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#090B10] border border-dashed border-white/10 text-xs text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>
                  Chưa có khung giờ chung (&ge; 60 phút) cho ngày {formatShortVNDate(selectedDate)}.
                </span>
                {activeRole === 'player' && (
                  <button
                    type="button"
                    onClick={() => applyPreset(QUICK_TIME_PRESETS[2])}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-medium self-start sm:self-auto"
                  >
                    + Điền nhanh 19:30–22:30
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analysis.recommendedWindows.map((win, idx) => {
                  const pct =
                    win.totalMembers > 0
                      ? Math.round((win.minAvailableCount / win.totalMembers) * 100)
                      : 0;
                  return (
                    <div
                      key={`${win.startTime}-${idx}`}
                      className={`bg-[#090B10] border rounded-xl p-3.5 space-y-2.5 ${
                        win.allAvailable
                          ? 'border-emerald-500/40'
                          : 'border-white/[0.08]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-mono font-bold text-white tabular-nums">
                            {win.startTime} – {win.endTime}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
                            {win.durationMin} phút ·{' '}
                            <span
                              className={
                                win.allAvailable
                                  ? 'text-emerald-400 font-semibold'
                                  : 'text-amber-300 font-semibold'
                              }
                            >
                              {win.minAvailableCount}/{win.totalMembers} tuyển thủ rảnh
                            </span>
                          </div>
                        </div>

                        {activeRole === 'coach' && onCreatePlannedScrimFromWindow && (
                          <button
                            type="button"
                            onClick={() => {
                              setScrimWindowDraft({
                                date: selectedDate,
                                startTime: win.startTime,
                                endTime: win.endTime,
                              });
                              setDraftOpponent('');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] text-white text-xs font-semibold whitespace-nowrap transition-colors"
                          >
                            Chốt Scrim
                          </button>
                        )}
                      </div>

                      <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            win.allAvailable ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {scrimWindowDraft && onCreatePlannedScrimFromWindow && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!draftOpponent.trim()) return;
                  await onCreatePlannedScrimFromWindow({
                    date: scrimWindowDraft.date,
                    startTime: scrimWindowDraft.startTime,
                    endTime: scrimWindowDraft.endTime,
                    opponent: draftOpponent.trim(),
                  });
                  setScrimWindowDraft(null);
                  setDraftOpponent('');
                }}
                className="p-3.5 rounded-xl bg-[#090B10] border border-sky-400/40 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="text-xs text-slate-200 whitespace-nowrap font-mono">
                  Scrim {formatShortVNDate(scrimWindowDraft.date)} ({scrimWindowDraft.startTime}–
                  {scrimWindowDraft.endTime}):
                </div>
                <input
                  type="text"
                  required
                  value={draftOpponent}
                  onChange={(e) => setDraftOpponent(e.target.value)}
                  placeholder="Nhập tên đội đối thủ..."
                  className="flex-1 bg-[#121621] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-[#FF4655] text-white text-xs font-semibold"
                  >
                    Tạo lịch Scrim
                  </button>
                  <button
                    type="button"
                    onClick={() => setScrimWindowDraft(null)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 text-slate-300 text-xs"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            )}
          </div>

          {viewMode === 'day' ? (
            /* Visual Player-by-Hour Matrix + Clean Slot List */
            <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-display font-semibold text-sm text-white">
                    Bảng trực quan theo Tuyển thủ &amp; Giờ (13:00 – 23:59)
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Nhìn nhanh từng tuyển thủ rảnh hay bận ở mỗi khung giờ trong ngày.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 shrink-0">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-400/60" />
                    Rảnh
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-[#FF4655]/30 border border-[#FF4655]/60" />
                    Bận
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-[#090B10] border border-white/10" />
                    Chưa điền
                  </span>
                </div>
              </div>

              {playerMembers.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  Chưa có tuyển thủ nào trong đội.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] border-separate border-spacing-1">
                    <thead>
                      <tr>
                        <th className="text-left text-[11px] font-semibold text-slate-400 pb-1.5 pr-2 w-40">
                          Tuyển thủ
                        </th>
                        {MATRIX_HOURS.map((h) => (
                          <th
                            key={h}
                            className="text-center text-[11px] font-mono text-slate-400 pb-1.5 font-normal"
                          >
                            {h}h
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {playerMembers.map((pm) => (
                        <tr key={pm.uid}>
                          <td className="pr-2 py-1">
                            <div className="text-xs font-medium text-white truncate max-w-[150px]">
                              {pm.displayName}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono truncate">
                              {pm.riotId}
                            </div>
                          </td>
                          {MATRIX_HOURS.map((h) => {
                            const status = getMemberHourStatus(pm.uid, h);
                            return (
                              <td key={h} className="p-0">
                                <div
                                  title={`${pm.displayName} · ${String(h).padStart(2, '0')}:00–${String(h + 1).padStart(2, '0')}:00 (${
                                    status === 'available'
                                      ? 'Rảnh'
                                      : status === 'busy'
                                      ? 'Bận'
                                      : 'Chưa khai báo'
                                  })`}
                                  className={`h-8 rounded-md border flex items-center justify-center text-[10px] font-mono transition-colors ${
                                    status === 'available'
                                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                                      : status === 'busy'
                                      ? 'bg-[#FF4655]/20 border-[#FF4655]/50 text-red-300'
                                      : 'bg-[#090B10] border-white/[0.06] text-slate-600'
                                  }`}
                                >
                                  {status === 'available'
                                    ? '✓'
                                    : status === 'busy'
                                    ? '✕'
                                    : '·'}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="pt-2 pr-2 text-[11px] font-semibold text-slate-300">
                          Tổng rảnh
                        </td>
                        {MATRIX_HOURS.map((h) => {
                          const availCount = playerMembers.filter(
                            (pm) => getMemberHourStatus(pm.uid, h) === 'available',
                          ).length;
                          const isFull =
                            playerMembers.length > 0 && availCount === playerMembers.length;
                          return (
                            <td key={h} className="pt-2 text-center">
                              <span
                                className={`inline-block w-full py-1 rounded text-[11px] font-mono font-bold tabular-nums ${
                                  isFull
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : availCount > 0
                                    ? 'text-sky-300'
                                    : 'text-slate-600'
                                }`}
                              >
                                {availCount}/{playerMembers.length}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Registered Slots List */}
              <div className="pt-4 border-t border-white/[0.06] space-y-3">
                <h4 className="text-xs font-semibold text-slate-300">
                  Danh sách chi tiết đã đăng ký ({dayUserSlots.length})
                </h4>
                {dayUserSlots.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center bg-[#090B10] rounded-lg border border-dashed border-white/10">
                    Chưa có khung giờ nào được đăng ký cho ngày {formatFullVNDate(selectedDate)}.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {dayUserSlots.map((slot) => {
                      const canEditSlot =
                        activeRole === 'player' && slot.ownerId === currentUserId;
                      const canDeleteSlot =
                        activeRole === 'coach' || slot.ownerId === currentUserId;
                      return (
                        <div
                          key={slot.id}
                          className="p-3 rounded-lg bg-[#090B10] border border-white/[0.07] flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-semibold text-white truncate">
                                {slot.memberName}
                              </span>
                              <span className="font-mono tabular-nums text-sky-400">
                                {slot.startTime}–{slot.endTime}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  slot.slotType === 'available'
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-[#FF4655]/15 text-red-300'
                                }`}
                              >
                                {slot.slotType === 'available' ? 'Rảnh' : 'Bận'}
                              </span>
                            </div>
                            {slot.notes && (
                              <div className="text-[11px] text-slate-400 mt-1 truncate">
                                {slot.notes}
                              </div>
                            )}
                          </div>

                          {(canEditSlot || canDeleteSlot) && (
                            <div className="flex items-center gap-1 shrink-0">
                              {canEditSlot && (
                                <button
                                  type="button"
                                  onClick={() => startEditSlot(slot)}
                                  aria-label={`Sửa khung giờ của ${slot.memberName}`}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canDeleteSlot && (
                                <button
                                  type="button"
                                  onClick={() => void onDeleteAvailability(slot.id)}
                                  aria-label={`Xóa khung giờ ${slot.startTime} của ${slot.memberName}`}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-[#FF4655] hover:bg-white/5"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
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
            /* Rich 7-Day Week Overview */
            <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-display font-semibold text-sm text-white">
                    Tổng quan cả tuần ({formatShortVNDate(weekKeys[0])} –{' '}
                    {formatShortVNDate(weekKeys[6])})
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Bấm vào một ngày để xem chi tiết từng giờ hoặc chốt lịch Scrim.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {weekKeys.map((dk) => {
                  const dayAnalysis = computeTeamAvailabilityOverlap({
                    members: playerMembers,
                    availabilities: playerAvailabilities,
                    date: dk,
                  });
                  const bestFull = dayAnalysis.allFreeWindows[0];
                  const bestAny = dayAnalysis.recommendedWindows[0];
                  const daySlots = playerAvailabilities.filter((a) => a.date === dk);
                  const filledCount = new Set(daySlots.map((s) => s.ownerId)).size;

                  return (
                    <div
                      key={dk}
                      className={`p-3.5 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        dk === selectedDate
                          ? 'bg-[#FF4655]/10 border-[#FF4655]/45'
                          : 'bg-[#090B10] border-white/[0.07] hover:border-white/20'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          selectDateAndSyncCalendar(dk);
                          setViewMode('day');
                        }}
                        className="text-left flex-1 min-w-0 space-y-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">
                            {getShortWeekdayVN(dk)} · {formatShortVNDate(dk)}
                          </span>
                          {dk === todayDate && (
                            <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-semibold">
                              Hôm nay
                            </span>
                          )}
                          <span className="text-[11px] font-mono text-slate-400">
                            · {filledCount}/{playerMembers.length} đã khai báo
                          </span>
                        </div>
                        <div className="text-xs font-mono tabular-nums">
                          {bestFull ? (
                            <span className="text-emerald-400 inline-flex items-center gap-1.5 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                Full đội ({playerMembers.length}/{playerMembers.length}):{' '}
                                {bestFull.startTime}–{bestFull.endTime}
                              </span>
                            </span>
                          ) : bestAny ? (
                            <span className="text-amber-300">
                              Tốt nhất ({bestAny.minAvailableCount}/{bestAny.totalMembers} rảnh):{' '}
                              {bestAny.startTime}–{bestAny.endTime}
                            </span>
                          ) : (
                            <span className="text-slate-500">Chưa đủ dữ liệu khung giờ rảnh</span>
                          )}
                        </div>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        {activeRole === 'coach' && bestAny && onCreatePlannedScrimFromWindow && (
                          <button
                            type="button"
                            onClick={() => {
                              selectDateAndSyncCalendar(dk);
                              setScrimWindowDraft({
                                date: dk,
                                startTime: bestAny.startTime,
                                endTime: bestAny.endTime,
                              });
                              setDraftOpponent('');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] text-white text-xs font-semibold whitespace-nowrap"
                          >
                            Chốt Scrim
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            selectDateAndSyncCalendar(dk);
                            setViewMode('day');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs text-slate-200 whitespace-nowrap"
                        >
                          Chi tiết
                        </button>
                      </div>
                    </div>
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
