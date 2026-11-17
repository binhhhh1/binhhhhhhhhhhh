import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  ExternalLink,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  VALORANT_MAPS,
  VALORANT_SERVERS,
  type AvailabilitySlot,
  type Scrim,
  type ScrimStatus,
  type TeamRole,
  type TrainingDrill,
} from '../../types/training';
import { detectScrimConflicts } from '../../utils/analytics';
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

type CalendarViewMode = 'daily' | 'weekly' | 'monthly';

interface ScrimScheduleViewProps {
  scrims: Scrim[];
  drills: TrainingDrill[];
  availabilities: AvailabilitySlot[];
  activeRole: TeamRole;
  currentUserId: string;
  teamId: string;
  teamOwnerId: string;
  onSaveScrim: (scrim: Scrim, isNew: boolean) => Promise<void>;
  onDeleteScrim: (scrimId: string) => Promise<void>;
}

const STATUS_LABEL: Record<ScrimStatus, { text: string; cls: string }> = {
  planned: { text: 'Dự kiến', cls: 'text-amber-400' },
  confirmed: { text: 'Đã xác nhận', cls: 'text-emerald-400' },
  live: { text: 'Đang diễn ra', cls: 'text-[#FF4655]' },
  completed: { text: 'Hoàn thành', cls: 'text-sky-400' },
  cancelled: { text: 'Đã hủy', cls: 'text-slate-500' },
};

export function ScrimScheduleView({
  scrims,
  drills,
  availabilities,
  activeRole,
  currentUserId,
  teamId,
  teamOwnerId,
  onSaveScrim,
  onDeleteScrim,
}: ScrimScheduleViewProps) {
  const todayDate = getVNDateKey();
  const [viewMode, setViewMode] = useState<CalendarViewMode>('weekly');
  const [anchorDate, setAnchorDate] = useState<string>(todayDate);
  const [selectedScrim, setSelectedScrim] = useState<Scrim | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingScrim, setEditingScrim] = useState<Scrim | null>(null);
  const [opponent, setOpponent] = useState('');
  const [date, setDate] = useState(todayDate);
  const [startTime, setStartTime] = useState('19:30');
  const [endTime, setEndTime] = useState('21:30');
  const [mapCount, setMapCount] = useState(2);
  const [maps, setMaps] = useState<string[]>(['Ascent', 'Lotus']);
  const [server, setServer] = useState('Singapore');
  const [status, setStatus] = useState<ScrimStatus>('planned');
  const [notes, setNotes] = useState('');
  const [vodUrl, setVodUrl] = useState('');
  const [mapResultsText, setMapResultsText] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const canManageScrim = activeRole === 'coach';

  const formConflicts = useMemo(() => {
    if (!formOpen) return [];
    return detectScrimConflicts({
      candidate: { id: editingScrim?.id, date, startTime, endTime },
      scrims,
      drills,
      availabilities,
    });
  }, [formOpen, editingScrim, date, startTime, endTime, scrims, drills, availabilities]);

  const openCreateModal = (prefillDate?: string) => {
    setEditingScrim(null);
    setOpponent('');
    setDate(prefillDate || anchorDate);
    setStartTime('19:30');
    setEndTime('21:30');
    setMapCount(2);
    setMaps(['Ascent', 'Lotus']);
    setServer('Singapore');
    setStatus('planned');
    setNotes('');
    setVodUrl('');
    setMapResultsText('');
    setFormError('');
    setFormOpen(true);
  };

  const openEditModal = (s: Scrim) => {
    setEditingScrim(s);
    setOpponent(s.opponent);
    setDate(s.date);
    setStartTime(s.startTime);
    setEndTime(s.endTime);
    setMapCount(s.mapCount);
    setMaps(s.maps);
    setServer(s.server);
    setStatus(s.status);
    setNotes(s.notes || '');
    setVodUrl(s.vodUrl || '');
    setMapResultsText(s.mapResultsText || '');
    setFormError('');
    setFormOpen(true);
  };

  const toggleMapSelection = (mapName: string) => {
    setMaps((prev) => {
      if (prev.includes(mapName)) {
        return prev.length > 1 ? prev.filter((m) => m !== mapName) : prev;
      }
      if (prev.length >= 5) return [...prev.slice(1), mapName];
      return [...prev, mapName];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opponent.trim()) {
      setFormError('Vui lòng nhập tên đội đối thủ.');
      return;
    }
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      setFormError('Giờ kết thúc phải sau giờ bắt đầu.');
      return;
    }
    if (maps.length === 0) {
      setFormError('Vui lòng chọn ít nhất 1 map thi đấu.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload: Scrim = {
        id: editingScrim ? editingScrim.id : `scrim_${Date.now()}`,
        teamId,
        teamOwnerId,
        createdBy: editingScrim ? editingScrim.createdBy : currentUserId,
        opponent: opponent.trim(),
        date,
        startTime,
        endTime,
        mapCount: Number(mapCount),
        maps: maps.slice(0, 5),
        server,
        status,
        notes: notes.trim(),
        vodUrl: vodUrl.trim(),
        mapResultsText: mapResultsText.trim(),
      };
      await onSaveScrim(payload, !editingScrim);
      setFormOpen(false);
      if (selectedScrim && selectedScrim.id === payload.id) {
        setSelectedScrim(payload);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không thể lưu lịch Scrim.');
    } finally {
      setSaving(false);
    }
  };

  const stepCalendar = (direction: -1 | 1) => {
    if (viewMode === 'daily') {
      setAnchorDate((d) => addDaysToDateKey(d, direction));
    } else if (viewMode === 'weekly') {
      setAnchorDate((d) => addDaysToDateKey(d, direction * 7));
    } else {
      const [y, m] = anchorDate.split('-').map(Number);
      const nextDate = new Date(Date.UTC(y, m - 1 + direction, 1, 12, 0, 0));
      setAnchorDate(getVNDateKey(nextDate));
    }
  };

  const weekDates = getWeekDateKeys(anchorDate);
  const [yearNum, monthNum] = anchorDate.split('-').map(Number);
  const monthCells = getMonthCalendarCells(yearNum, monthNum);

  const renderScrimCard = (scrim: Scrim) => {
    const conflicts = detectScrimConflicts({
      candidate: scrim,
      scrims,
      drills,
      availabilities,
    });
    const meta = STATUS_LABEL[scrim.status];

    return (
      <div
        key={scrim.id}
        className="bg-[#090B10] border border-white/[0.08] hover:border-white/20 rounded-lg p-3 space-y-2 transition-colors min-w-0"
      >
        <button
          type="button"
          onClick={() => setSelectedScrim(scrim)}
          className="w-full text-left min-w-0 space-y-1 block"
        >
          <div className="flex items-center justify-between gap-1.5 text-[11px] font-mono tabular-nums text-sky-400">
            <span className="whitespace-nowrap">
              {scrim.startTime}–{scrim.endTime}
            </span>
            <span className={`text-[10px] font-sans font-medium truncate ${meta.cls}`}>
              {meta.text}
            </span>
          </div>
          <div className="text-xs font-semibold text-white leading-snug line-clamp-2">
            vs {scrim.opponent}
          </div>
          <div className="text-[11px] text-slate-400 leading-snug truncate">
            {scrim.maps.join(' / ')} · {scrim.server}
          </div>
        </button>

        {conflicts.length > 0 && (
          <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-1.5 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
            <span className="leading-snug break-words">
              {conflicts[0].title} ({conflicts[0].startTime}–{conflicts[0].endTime})
            </span>
          </div>
        )}

        {canManageScrim && (
          <div className="flex items-center justify-end gap-1 pt-1.5 border-t border-white/[0.06]">
            {scrim.status === 'planned' && (
              <button
                type="button"
                onClick={() => onSaveScrim({ ...scrim, status: 'confirmed' }, false)}
                aria-label={`Xác nhận Scrim vs ${scrim.opponent}`}
                title="Xác nhận lịch"
                className="p-1.5 rounded-md text-emerald-400 hover:bg-emerald-500/15"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => openEditModal(scrim)}
              aria-label={`Chỉnh sửa Scrim vs ${scrim.opponent}`}
              title="Chỉnh sửa"
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteScrim(scrim.id)}
              aria-label={`Xóa Scrim vs ${scrim.opponent}`}
              title="Xóa"
              className="p-1.5 rounded-md text-slate-400 hover:text-[#FF4655] hover:bg-white/5"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#090B10] border border-white/10 rounded-lg">
            {(
              [
                { id: 'daily', label: 'Ngày' },
                { id: 'weekly', label: 'Tuần' },
                { id: 'monthly', label: 'Tháng' },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setViewMode(mode.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  viewMode === mode.id
                    ? 'bg-[#FF4655] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => stepCalendar(-1)}
              aria-label="Khoảng thời gian trước"
              className="p-2 rounded-lg bg-[#090B10] border border-white/10 text-slate-300 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setAnchorDate(todayDate)}
              className="px-3 py-2 rounded-lg bg-[#090B10] border border-white/10 text-xs font-mono text-slate-200 hover:border-white/25 whitespace-nowrap"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => stepCalendar(1)}
              aria-label="Khoảng thời gian sau"
              className="p-2 rounded-lg bg-[#090B10] border border-white/10 text-slate-300 hover:text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="text-sm font-medium text-white font-mono tabular-nums">
            {viewMode === 'daily' && formatFullVNDate(anchorDate)}
            {viewMode === 'weekly' &&
              `${formatShortVNDate(weekDates[0])} – ${formatShortVNDate(weekDates[6])}`}
            {viewMode === 'monthly' && `Tháng ${String(monthNum).padStart(2, '0')}/${yearNum}`}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!canManageScrim && (
            <span className="text-xs text-slate-400">
              Vai trò Player: chỉ xem lịch Scrim
            </span>
          )}
          {canManageScrim && (
            <button
              type="button"
              onClick={() => openCreateModal(anchorDate)}
              className="px-4 py-2 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo lịch Scrim</span>
            </button>
          )}
        </div>
      </div>

      {/* Calendar Views */}
      {viewMode === 'daily' && (
        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-base text-white">
              Lịch Scrim ngày {getShortWeekdayVN(anchorDate)} · {formatFullVNDate(anchorDate)}
            </h2>
            {canManageScrim && (
              <button
                type="button"
                onClick={() => openCreateModal(anchorDate)}
                className="text-xs font-medium text-sky-400 hover:text-sky-300"
              >
                + Thêm vào ngày này
              </button>
            )}
          </div>
          {scrims.filter((s) => s.date === anchorDate).length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Không có trận Scrim nào trong ngày {formatFullVNDate(anchorDate)}.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {scrims
                .filter((s) => s.date === anchorDate)
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map(renderScrimCard)}
            </div>
          )}
        </div>
      )}

      {viewMode === 'weekly' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
          {weekDates.map((dk) => {
            const dayScrims = scrims
              .filter((s) => s.date === dk)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));
            const isToday = dk === todayDate;
            return (
              <div
                key={dk}
                className={`bg-[#121621] border rounded-xl p-3.5 flex flex-col gap-3 min-h-[220px] ${
                  isToday ? 'border-[#FF4655]/50' : 'border-white/[0.07]'
                }`}
              >
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <div>
                    <div className="text-xs font-semibold text-white">
                      {getShortWeekdayVN(dk)} · {formatShortVNDate(dk)}
                    </div>
                  </div>
                  {canManageScrim && (
                    <button
                      type="button"
                      onClick={() => openCreateModal(dk)}
                      aria-label={`Thêm Scrim ngày ${formatShortVNDate(dk)}`}
                      className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="space-y-2.5 flex-1">
                  {dayScrims.length === 0 ? (
                    <div className="text-[11px] text-slate-500 pt-2">Trống</div>
                  ) : (
                    dayScrims.map(renderScrimCard)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'monthly' && (
        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
          <div className="grid grid-cols-7 gap-2 text-center text-xs text-slate-400 mb-2">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((w) => (
              <div key={w} className="py-1 font-medium">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {monthCells.map((cell) => {
              const dayScrims = scrims.filter((s) => s.date === cell.dateKey);
              const isToday = cell.dateKey === todayDate;
              return (
                <div
                  key={cell.dateKey}
                  className={`min-h-[92px] rounded-lg p-2 border flex flex-col gap-1 ${
                    isToday
                      ? 'bg-[#FF4655]/10 border-[#FF4655]/50'
                      : cell.inMonth
                      ? 'bg-[#090B10] border-white/[0.07]'
                      : 'bg-[#090B10]/40 border-white/[0.03] opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono tabular-nums text-slate-300">
                      {cell.day}
                    </span>
                    {canManageScrim && cell.inMonth && (
                      <button
                        type="button"
                        onClick={() => openCreateModal(cell.dateKey)}
                        aria-label={`Thêm Scrim ngày ${cell.dateKey}`}
                        className="text-slate-500 hover:text-white"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-1 overflow-hidden">
                    {dayScrims.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedScrim(s)}
                        className="w-full text-left px-1.5 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] text-[11px] text-white truncate"
                      >
                        <span className="font-mono text-sky-400">{s.startTime}</span> {s.opponent}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scrim Detail Modal */}
      {selectedScrim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="scrim-detail-title"
            className="w-full max-w-lg bg-[#121621] border border-white/10 rounded-xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-[#FF4655]" />
                <h2 id="scrim-detail-title" className="font-display font-semibold text-base text-white">
                  Chi tiết Scrim vs {selectedScrim.opponent}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedScrim(null)}
                aria-label="Đóng chi tiết Scrim"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-[#090B10] border border-white/[0.07] rounded-lg p-3.5">
                <div>
                  <span className="text-slate-400">Ngày & Giờ:</span>
                  <div className="text-white font-mono mt-0.5">
                    {formatFullVNDate(selectedScrim.date)} · {selectedScrim.startTime}–
                    {selectedScrim.endTime}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Trạng thái:</span>
                  <div className={`font-semibold mt-0.5 ${STATUS_LABEL[selectedScrim.status].cls}`}>
                    {STATUS_LABEL[selectedScrim.status].text}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Maps ({selectedScrim.mapCount}):</span>
                  <div className="text-white mt-0.5">{selectedScrim.maps.join(', ')}</div>
                </div>
                <div>
                  <span className="text-slate-400">Server:</span>
                  <div className="text-white mt-0.5">{selectedScrim.server}</div>
                </div>
              </div>

              {selectedScrim.mapResultsText && (
                <div>
                  <div className="text-slate-400 mb-1">Kết quả từng map:</div>
                  <div className="p-3 rounded-lg bg-[#090B10] border border-white/[0.07] text-emerald-300 font-mono">
                    {selectedScrim.mapResultsText}
                  </div>
                </div>
              )}

              {selectedScrim.notes && (
                <div>
                  <div className="text-slate-400 mb-1">Ghi chú chiến thuật / Sau trận:</div>
                  <div className="p-3 rounded-lg bg-[#090B10] border border-white/[0.07] text-slate-200 leading-relaxed">
                    {selectedScrim.notes}
                  </div>
                </div>
              )}

              {selectedScrim.vodUrl && (
                <div>
                  <div className="text-slate-400 mb-1">Link VOD:</div>
                  <a
                    href={selectedScrim.vodUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 underline break-all"
                  >
                    <span>{selectedScrim.vodUrl}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/[0.07]">
                {canManageScrim && selectedScrim.status === 'planned' && (
                  <button
                    type="button"
                    onClick={async () => {
                      const updated = { ...selectedScrim, status: 'confirmed' as const };
                      await onSaveScrim(updated, false);
                      setSelectedScrim(updated);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold"
                  >
                    Xác nhận Scrim
                  </button>
                )}
                {canManageScrim && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedScrim;
                      setSelectedScrim(null);
                      openEditModal(target);
                    }}
                    className="px-4 py-2 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] text-white font-semibold"
                  >
                    Sửa / Nhập kết quả & VOD
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Scrim Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="scrim-form-title"
            className="w-full max-w-xl bg-[#121621] border border-white/10 rounded-xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
              <h2 id="scrim-form-title" className="font-display font-semibold text-base text-white">
                {editingScrim ? 'Chỉnh sửa lịch Scrim' : 'Tạo lịch Scrim mới'}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                aria-label="Đóng biểu mẫu Scrim"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-lg bg-[#FF4655]/15 border border-[#FF4655]/40 text-xs text-red-200">
                  {formError}
                </div>
              )}

              {formConflicts.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/40 text-xs text-amber-200 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5 text-amber-300">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Cảnh báo trùng lịch ({formConflicts.length})</span>
                  </div>
                  {formConflicts.map((c) => (
                    <div key={`${c.kind}-${c.id}`}>
                      · {c.title} ({c.startTime}–{c.endTime})
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="scrim-opponent" className="block text-xs font-medium text-slate-300 mb-1">
                    Tên đội đối thủ *
                  </label>
                  <input
                    id="scrim-opponent"
                    type="text"
                    required
                    value={opponent}
                    onChange={(e) => setOpponent(e.target.value)}
                    placeholder="VD: CERBERUS Academy"
                    className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label htmlFor="scrim-status" className="block text-xs font-medium text-slate-300 mb-1">
                    Trạng thái
                  </label>
                  <select
                    id="scrim-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ScrimStatus)}
                    className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="planned">Dự kiến</option>
                    <option value="confirmed">Đã xác nhận</option>
                    <option value="live">Đang diễn ra</option>
                    <option value="completed">Hoàn thành</option>
                    <option value="cancelled">Đã hủy</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="scrim-date" className="block text-xs font-medium text-slate-300 mb-1">
                    Ngày thi đấu
                  </label>
                  <input
                    id="scrim-date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="scrim-start" className="block text-xs font-medium text-slate-300 mb-1">
                    Giờ bắt đầu
                  </label>
                  <input
                    id="scrim-start"
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="scrim-end" className="block text-xs font-medium text-slate-300 mb-1">
                    Giờ kết thúc
                  </label>
                  <input
                    id="scrim-end"
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="scrim-mapcount" className="block text-xs font-medium text-slate-300 mb-1">
                    Số lượng map
                  </label>
                  <input
                    id="scrim-mapcount"
                    type="number"
                    min={1}
                    max={5}
                    value={mapCount}
                    onChange={(e) => setMapCount(Number(e.target.value))}
                    className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="scrim-server" className="block text-xs font-medium text-slate-300 mb-1">
                    Server
                  </label>
                  <select
                    id="scrim-server"
                    value={server}
                    onChange={(e) => setServer(e.target.value)}
                    className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    {VALORANT_SERVERS.map((sv) => (
                      <option key={sv} value={sv}>
                        {sv}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-300 mb-1.5">
                  Map thi đấu (đã chọn: {maps.join(', ')})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {VALORANT_MAPS.map((m) => {
                    const active = maps.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleMapSelection(m)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                          active
                            ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                            : 'bg-[#090B10] border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="scrim-results" className="block text-xs font-medium text-slate-300 mb-1">
                  Kết quả từng map
                </label>
                <input
                  id="scrim-results"
                  type="text"
                  value={mapResultsText}
                  onChange={(e) => setMapResultsText(e.target.value)}
                  placeholder="VD: Ascent 13-8 (Win) · Lotus 10-13 (Loss)"
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label htmlFor="scrim-vod" className="block text-xs font-medium text-slate-300 mb-1">
                  Link VOD
                </label>
                <input
                  id="scrim-vod"
                  type="url"
                  value={vodUrl}
                  onChange={(e) => setVodUrl(e.target.value)}
                  placeholder="https://youtube.com/..."
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label htmlFor="scrim-notes" className="block text-xs font-medium text-slate-300 mb-1">
                  Ghi chú trước / sau trận đấu
                </label>
                <textarea
                  id="scrim-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.07]">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] disabled:opacity-60 text-xs font-semibold text-white"
                >
                  {saving ? 'Đang lưu...' : editingScrim ? 'Lưu cập nhật' : 'Lưu lịch Scrim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
