import React, { useMemo, useState } from 'react';
import {
  Award,
  Camera,
  CheckCircle2,
  Crosshair,
  ExternalLink,
  ImagePlus,
  Link2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Upload,
  Video,
  X,
} from 'lucide-react';
import {
  AIM_FOCUS_AREAS,
  AIM_PLATFORMS,
  type AimFocusArea,
  type AimLog,
  type AimPlatform,
  type DataSourceMode,
  type TeamRole,
} from '../../types/training';
import {
  captureScreenToDataUrl,
  compressImageFileToDataUrl,
  computeAimProofSummary,
  hasAimProof,
  inferProofType,
  validateProofUrl,
} from '../../utils/aimProof';
import { computeAimAnalytics } from '../../utils/analytics';
import { formatFullVNDate, getVNDateKey } from '../../utils/timezone';
import { AreaLineChart, BarComparisonChart } from '../charts/TrainingCharts';

interface AimTrainingViewProps {
  aimLogs: AimLog[];
  currentUserId: string;
  activeRole: TeamRole;
  dataMode: DataSourceMode;
  teamId: string;
  teamOwnerId: string;
  onSaveAimLog: (log: AimLog, isNew: boolean) => Promise<void>;
  onVerifyAimProof: (logId: string, verified: boolean) => Promise<void>;
  onDeleteAimLog: (logId: string) => Promise<void>;
}

type ProofFilter = 'with_proof' | 'all' | 'missing' | 'verified';

function getSafeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Liên kết ngoài';
  }
}

function getProofBadgeLabel(log: AimLog): string {
  if (log.proofImageDataUrl) return 'Ảnh chụp';
  if (log.proofType === 'video') return 'Video / Clip';
  if (log.proofType === 'screenshot') return 'Link ảnh';
  return 'Link kết quả';
}

export function AimTrainingView({
  aimLogs,
  currentUserId,
  activeRole,
  dataMode,
  teamId,
  teamOwnerId,
  onSaveAimLog,
  onVerifyAimProof,
  onDeleteAimLog,
}: AimTrainingViewProps) {
  const todayDate = getVNDateKey();

  const [platformFilter, setPlatformFilter] = useState<string>('ALL');
  const [proofFilter, setProofFilter] = useState<ProofFilter>('with_proof');
  const [date, setDate] = useState(todayDate);
  const [exerciseName, setExerciseName] = useState('');
  const [platform, setPlatform] = useState<AimPlatform>('Aimlabs');
  const [focusArea, setFocusArea] = useState<AimFocusArea>('Micro Adjustment');
  const [durationMin, setDurationMin] = useState(25);
  const [score, setScore] = useState(90000);
  const [accuracy, setAccuracy] = useState(92);
  const [notes, setNotes] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [proofImageDataUrl, setProofImageDataUrl] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [proofProcessing, setProofProcessing] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Proof Modal / Lightbox state
  const [modalLog, setModalLog] = useState<AimLog | null>(null);
  const [modalProofUrl, setModalProofUrl] = useState('');
  const [modalProofImage, setModalProofImage] = useState('');
  const [modalProofNote, setModalProofNote] = useState('');
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState('');
  const [confirmClearProofId, setConfirmClearProofId] = useState<string | null>(null);

  const visibleLogs = useMemo(() => {
    return aimLogs
      .filter((l) => (platformFilter === 'ALL' ? true : l.platform === platformFilter))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [aimLogs, platformFilter]);

  const analytics = useMemo(
    () => computeAimAnalytics(visibleLogs, todayDate),
    [visibleLogs, todayDate],
  );

  const proofSummary = useMemo(
    () => computeAimProofSummary(visibleLogs),
    [visibleLogs],
  );

  const filteredProofLogs = useMemo(() => {
    return visibleLogs.filter((log) => {
      const hasProof = hasAimProof(log);
      if (proofFilter === 'with_proof') return hasProof;
      if (proofFilter === 'missing') return !hasProof;
      if (proofFilter === 'verified') return hasProof && Boolean(log.proofVerified);
      return true;
    });
  }, [visibleLogs, proofFilter]);

  const handleFileForCreate = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setProofProcessing(true);
    try {
      const compressed = await compressImageFileToDataUrl(file);
      setProofImageDataUrl(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xử lý ảnh bằng chứng.');
    } finally {
      setProofProcessing(false);
    }
  };

  const handlePasteForCreate = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (file) {
      e.preventDefault();
      await handleFileForCreate(file);
    }
  };

  const handleScreenCaptureForCreate = async () => {
    setError('');
    setProofProcessing(true);
    try {
      const captured = await captureScreenToDataUrl();
      setProofImageDataUrl(captured);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể chụp màn hình.');
    } finally {
      setProofProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exerciseName.trim()) {
      setError('Vui lòng nhập tên bài tập Aim.');
      return;
    }
    if (score < 0 || accuracy < 0 || accuracy > 100 || durationMin < 1) {
      setError('Vui lòng kiểm tra điểm số, độ chính xác (0–100%) và thời gian tập.');
      return;
    }
    const urlCheck = validateProofUrl(proofUrl);
    if (!urlCheck.valid) {
      setError(urlCheck.error || 'Link bằng chứng không hợp lệ.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      const inferredType = inferProofType(
        urlCheck.normalized,
        Boolean(proofImageDataUrl),
      );
      const payload: AimLog = {
        id: `aim_${Date.now()}`,
        teamId,
        teamOwnerId,
        ownerId: currentUserId,
        date,
        exerciseName: exerciseName.trim(),
        platform,
        focusArea,
        durationMin: Number(durationMin),
        score: Number(score),
        accuracy: Number(accuracy),
        notes: notes.trim(),
        ...(urlCheck.normalized ? { proofUrl: urlCheck.normalized } : {}),
        ...(proofImageDataUrl ? { proofImageDataUrl } : {}),
        ...(inferredType ? { proofType: inferredType } : {}),
        ...(proofNote.trim() ? { proofNote: proofNote.trim().slice(0, 200) } : {}),
        proofVerified: false,
      };
      await onSaveAimLog(payload, true);
      setExerciseName('');
      setNotes('');
      setProofUrl('');
      setProofImageDataUrl('');
      setProofNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu kết quả Aim.');
    } finally {
      setSaving(false);
    }
  };

  const openProofModal = (log: AimLog) => {
    setModalLog(log);
    setModalProofUrl(log.proofUrl || '');
    setModalProofImage(log.proofImageDataUrl || '');
    setModalProofNote(log.proofNote || '');
    setModalError('');
  };

  const handleModalFileUpload = async (file: File | undefined) => {
    if (!file) return;
    setModalError('');
    setProofProcessing(true);
    try {
      const compressed = await compressImageFileToDataUrl(file);
      setModalProofImage(compressed);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Không thể xử lý ảnh bằng chứng.');
    } finally {
      setProofProcessing(false);
    }
  };

  const handleModalPaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (file) {
      e.preventDefault();
      await handleModalFileUpload(file);
    }
  };

  const handleModalScreenCapture = async () => {
    setModalError('');
    setProofProcessing(true);
    try {
      const captured = await captureScreenToDataUrl();
      setModalProofImage(captured);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Không thể chụp màn hình.');
    } finally {
      setProofProcessing(false);
    }
  };

  const handleSaveModalProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalLog) return;
    const urlCheck = validateProofUrl(modalProofUrl);
    if (!urlCheck.valid) {
      setModalError(urlCheck.error || 'Link bằng chứng không hợp lệ.');
      return;
    }

    setModalBusy(true);
    setModalError('');
    try {
      const inferredType = inferProofType(
        urlCheck.normalized,
        Boolean(modalProofImage),
      );
      const updated: AimLog = {
        ...modalLog,
        proofUrl: urlCheck.normalized,
        proofImageDataUrl: modalProofImage,
        proofNote: modalProofNote.trim().slice(0, 200),
        proofType: inferredType,
      };
      await onSaveAimLog(updated, false);
      setModalLog(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Không thể cập nhật bằng chứng.');
    } finally {
      setModalBusy(false);
    }
  };

  const handleClearProof = async (log: AimLog) => {
    setConfirmClearProofId(null);
    await onSaveAimLog(
      {
        ...log,
        proofUrl: '',
        proofImageDataUrl: '',
        proofNote: '',
        proofType: undefined,
        proofVerified: false,
      },
      false,
    );
    if (modalLog?.id === log.id) {
      setModalLog(null);
    }
  };

  const wow = analytics.weekOverWeek;

  return (
    <div className="space-y-6">
      {/* Top KPIs & Week-over-Week */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-violet-400" />
            <span>High Score tổng</span>
          </div>
          <div className="mt-1.5 font-display text-2xl font-bold text-white font-mono tabular-nums">
            {analytics.highScore !== null ? analytics.highScore.toLocaleString('vi-VN') : '--'}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {analytics.personalBests.length} bài tập đã ghi nhận
          </div>
        </div>

        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
          <div className="text-xs text-slate-400">Điểm TB tuần này</div>
          <div className="mt-1.5 font-display text-2xl font-bold text-white font-mono tabular-nums">
            {wow.thisWeekAvgScore > 0 ? wow.thisWeekAvgScore.toLocaleString('vi-VN') : '--'}
          </div>
          <div className="mt-1 text-xs font-mono tabular-nums">
            {wow.scoreDeltaPct !== null ? (
              <span className={wow.scoreDeltaPct >= 0 ? 'text-emerald-400' : 'text-[#FF4655]'}>
                {wow.scoreDeltaPct >= 0 ? '+' : ''}
                {wow.scoreDeltaPct}% vs tuần trước
              </span>
            ) : (
              <span className="text-slate-500">Tuần trước: {wow.lastWeekAvgScore || '--'}</span>
            )}
          </div>
        </div>

        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
          <div className="text-xs text-slate-400">Accuracy TB tuần này</div>
          <div className="mt-1.5 font-display text-2xl font-bold text-sky-400 font-mono tabular-nums">
            {wow.thisWeekAvgAccuracy > 0 ? `${wow.thisWeekAvgAccuracy}%` : '--'}
          </div>
          <div className="mt-1 text-xs font-mono tabular-nums">
            {wow.accuracyDelta !== null ? (
              <span className={wow.accuracyDelta >= 0 ? 'text-emerald-400' : 'text-[#FF4655]'}>
                {wow.accuracyDelta >= 0 ? '+' : ''}
                {wow.accuracyDelta}% vs tuần trước
              </span>
            ) : (
              <span className="text-slate-500">Tuần trước: {wow.lastWeekAvgAccuracy || '--'}%</span>
            )}
          </div>
        </div>

        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Thời lượng tuần này</span>
          </div>
          <div className="mt-1.5 font-display text-2xl font-bold text-white font-mono tabular-nums">
            {wow.thisWeekMinutes} phút
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {wow.thisWeekSessions} buổi (Tuần trước: {wow.lastWeekMinutes}p)
          </div>
        </div>
      </div>

      {/* Platform Filter + Manual Entry Form + Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Manual Entry Form */}
        <form
          onSubmit={handleSubmit}
          onPaste={handlePasteForCreate}
          className="lg:col-span-4 bg-[#121621] border border-white/[0.07] rounded-xl p-5 space-y-4 self-start"
        >
          <div>
            <h2 className="font-display font-semibold text-base text-white flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-[#FF4655]" />
              <span>Nhập kết quả Aim thủ công</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Ghi nhận kết quả thực tế từ Aimlabs, Kovaak&apos;s, Range hoặc Deathmatch.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-[#FF4655]/15 border border-[#FF4655]/40 text-xs text-red-200">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="aim-exercise" className="block text-xs font-medium text-slate-300 mb-1">
              Tên bài tập *
            </label>
            <input
              id="aim-exercise"
              type="text"
              required
              value={exerciseName}
              onChange={(e) => setExerciseName(e.target.value)}
              placeholder="VD: VT Sixshot, Hard Bots 30"
              className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="aim-platform" className="block text-xs font-medium text-slate-300 mb-1">
                Nền tảng
              </label>
              <select
                id="aim-platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as AimPlatform)}
                className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              >
                {AIM_PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="aim-focus" className="block text-xs font-medium text-slate-300 mb-1">
                Kỹ năng trọng tâm
              </label>
              <select
                id="aim-focus"
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value as AimFocusArea)}
                className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              >
                {AIM_FOCUS_AREAS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="aim-date" className="block text-xs font-medium text-slate-300 mb-1">
                Ngày tập
              </label>
              <input
                id="aim-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label htmlFor="aim-duration" className="block text-xs font-medium text-slate-300 mb-1">
                Thời gian (phút)
              </label>
              <input
                id="aim-duration"
                type="number"
                min={1}
                max={360}
                required
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="aim-score" className="block text-xs font-medium text-slate-300 mb-1">
                Điểm số
              </label>
              <input
                id="aim-score"
                type="number"
                min={0}
                required
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
                className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono"
              />
            </div>
            <div>
              <label htmlFor="aim-acc" className="block text-xs font-medium text-slate-300 mb-1">
                Accuracy (%)
              </label>
              <input
                id="aim-acc"
                type="number"
                min={0}
                max={100}
                step="0.1"
                required
                value={accuracy}
                onChange={(e) => setAccuracy(Number(e.target.value))}
                className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="aim-notes" className="block text-xs font-medium text-slate-300 mb-1">
              Ghi chú
            </label>
            <input
              id="aim-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cảm giác chuột, DPI, ghi chú tốc độ..."
              className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
            />
          </div>

          {/* Proof attachment section */}
          <div className="pt-2 border-t border-white/[0.07] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-sky-400" />
                <span>Bằng chứng đã tập Aim</span>
              </span>
              <span className="text-[11px] text-slate-500">Ảnh hoặc Link</span>
            </div>

            {proofImageDataUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-white/10 bg-[#090B10]">
                <img
                  src={proofImageDataUrl}
                  alt="Xem trước ảnh bằng chứng tập Aim"
                  className="w-full h-28 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setProofImageDataUrl('')}
                  aria-label="Xóa ảnh bằng chứng"
                  className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/75 text-white hover:bg-[#FF4655] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={proofProcessing}
                  onClick={() => void handleScreenCaptureForCreate()}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-sky-400/35 bg-sky-500/10 hover:bg-sky-500/20 text-xs font-medium text-sky-300 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5 shrink-0" />
                  <span>{proofProcessing ? 'Đang xử lý...' : 'Chụp màn hình'}</span>
                </button>
                <label
                  htmlFor="aim-proof-file"
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-dashed border-white/15 bg-[#090B10] hover:border-sky-400/50 text-xs text-slate-300 cursor-pointer transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>Chọn ảnh / Ctrl+V</span>
                  <input
                    id="aim-proof-file"
                    type="file"
                    accept="image/*"
                    aria-label="Tải ảnh bằng chứng đã tập Aim"
                    onChange={(e) => {
                      void handleFileForCreate(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                    className="sr-only"
                  />
                </label>
              </div>
            )}

            <div>
              <label htmlFor="aim-proof-url" className="block text-[11px] text-slate-400 mb-1">
                Link bằng chứng (Medal.tv / YouTube / Ảnh / Aimlabs)
              </label>
              <input
                id="aim-proof-url"
                type="url"
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                placeholder="https://medal.tv/... hoặc link ảnh"
                className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
              />
            </div>

            <div>
              <label htmlFor="aim-proof-note" className="block text-[11px] text-slate-400 mb-1">
                Mô tả bằng chứng (tuỳ chọn)
              </label>
              <input
                id="aim-proof-note"
                type="text"
                maxLength={200}
                value={proofNote}
                onChange={(e) => setProofNote(e.target.value)}
                placeholder="VD: Ảnh scoreboard cuối buổi / Clip 30s"
                className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || proofProcessing}
            className="w-full py-2.5 px-4 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{saving ? 'Đang lưu...' : 'Ghi nhận kết quả Aim'}</span>
          </button>
        </form>

        {/* Charts Area */}
        <div className="lg:col-span-8 min-w-0 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-[#121621] border border-white/[0.07] rounded-lg overflow-x-auto max-w-full">
              {['ALL', ...AIM_PLATFORMS].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatformFilter(p)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    platformFilter === p
                      ? 'bg-[#FF4655] text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p === 'ALL' ? 'Tất cả nền tảng' : p}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-5">
              <h3 className="font-display font-semibold text-sm text-white mb-3">
                Điểm Aim theo ngày
              </h3>
              <AreaLineChart data={analytics.dailyScoreSeries} color="#8B5CF6" height={170} />
            </div>

            <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-5">
              <h3 className="font-display font-semibold text-sm text-white mb-3">
                Accuracy trung bình theo tuần (%)
              </h3>
              <BarComparisonChart
                data={analytics.weeklyAccuracySeries}
                color="#38BDF8"
                unit="%"
                height={170}
              />
            </div>
          </div>

          <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-5">
            <h3 className="font-display font-semibold text-sm text-white mb-3">
              Thời gian Aim Training trong tuần (phút/ngày)
            </h3>
            <BarComparisonChart
              data={analytics.dailyDurationSeries}
              color="#10B981"
              unit="p"
              height={160}
            />
          </div>
        </div>
      </div>

      {/* Aim Proof Locker / Evidence Gallery */}
      <section
        aria-labelledby="aim-proof-locker-heading"
        className="bg-[#121621] border border-white/[0.07] rounded-xl p-5 space-y-4"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3
              id="aim-proof-locker-heading"
              className="font-display font-semibold text-base text-white flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              <span>Kho bằng chứng đã tập Aim</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Lưu ảnh chụp màn hình hoặc link clip/kết quả cho từng buổi tập để bản thân và Coach kiểm chứng ({proofSummary.withProofCount}/{proofSummary.totalSessions} buổi có bằng chứng · {proofSummary.verifiedCount} đã duyệt).
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-[#090B10] border border-white/[0.07] rounded-lg overflow-x-auto max-w-full self-start">
            {(
              [
                ['with_proof', `Có bằng chứng (${proofSummary.withProofCount})`],
                ['missing', `Chưa có (${proofSummary.missingProofCount})`],
                ['verified', `Đã duyệt (${proofSummary.verifiedCount})`],
                ['all', `Tất cả (${visibleLogs.length})`],
              ] as Array<[ProofFilter, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setProofFilter(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  proofFilter === key
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredProofLogs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-[#090B10]/60 py-8 px-4 text-center space-y-2">
            <p className="text-xs text-slate-400">
              {proofFilter === 'with_proof'
                ? 'Chưa có buổi tập nào đính kèm bằng chứng trong bộ lọc này.'
                : proofFilter === 'verified'
                ? 'Chưa có bằng chứng nào được Coach xác nhận duyệt.'
                : 'Không có buổi tập nào phù hợp bộ lọc bằng chứng.'}
            </p>
            {proofFilter === 'with_proof' && visibleLogs.length > 0 && (
              <button
                type="button"
                onClick={() => setProofFilter('missing')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-sky-400 font-medium transition-colors"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                <span>Xem các buổi chưa có bằng chứng để bổ sung</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProofLogs.map((log) => {
              const hasProof = hasAimProof(log);
              const confirmingClear = confirmClearProofId === log.id;
              return (
                <div
                  key={log.id}
                  className="bg-[#090B10] border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-3">
                    {hasProof ? (
                      log.proofImageDataUrl ? (
                        <button
                          type="button"
                          onClick={() => openProofModal(log)}
                          aria-label={`Xem ảnh bằng chứng '${log.exerciseName}'`}
                          className="w-full rounded-lg overflow-hidden border border-white/10 bg-[#121621] block group text-left"
                        >
                          <img
                            src={log.proofImageDataUrl}
                            alt={`Bằng chứng tập ${log.exerciseName}`}
                            className="w-full h-36 object-cover group-hover:opacity-90 transition-opacity"
                          />
                        </button>
                      ) : (
                        <div className="rounded-lg border border-white/10 bg-[#121621] p-3 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-400/25 flex items-center justify-center shrink-0">
                            {log.proofType === 'video' ? (
                              <Video className="w-4 h-4 text-sky-400" />
                            ) : (
                              <Link2 className="w-4 h-4 text-sky-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-white truncate">
                              {getProofBadgeLabel(log)} · {getSafeHostname(log.proofUrl || '')}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate font-mono">
                              {log.proofUrl}
                            </div>
                          </div>
                        </div>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => openProofModal(log)}
                        className="w-full h-24 rounded-lg border border-dashed border-white/15 hover:border-sky-400/50 bg-[#121621]/50 flex flex-col items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-sky-300 transition-colors"
                      >
                        <ImagePlus className="w-4 h-4" />
                        <span>Chưa có bằng chứng · Nhấn để tải lên</span>
                      </button>
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {log.exerciseName}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {formatFullVNDate(log.date)} · {log.platform}
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums shrink-0">
                        <div className="text-xs font-bold text-violet-400">
                          {log.score.toLocaleString('vi-VN')}
                        </div>
                        <div className="text-[11px] text-sky-400">{log.accuracy}% acc</div>
                      </div>
                    </div>

                    {log.proofNote && (
                      <p className="text-xs text-slate-300 bg-white/[0.03] border border-white/[0.05] rounded-lg px-2.5 py-1.5">
                        {log.proofNote}
                      </p>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {hasProof && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                            log.proofVerified
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
                              : 'bg-amber-500/10 text-amber-300 border border-amber-400/20'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{log.proofVerified ? 'Đã duyệt' : 'Chờ duyệt'}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {hasProof && log.proofUrl && (
                        <a
                          href={log.proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Mở link bằng chứng của '${log.exerciseName}'`}
                          className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[11px] text-sky-300 inline-flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Mở link</span>
                        </a>
                      )}

                      {hasProof && activeRole === 'coach' && (
                        <button
                          type="button"
                          onClick={() => void onVerifyAimProof(log.id, !log.proofVerified)}
                          className="px-2 py-1 rounded-md bg-white/5 hover:bg-emerald-500/20 text-[11px] text-emerald-300 transition-colors"
                        >
                          {log.proofVerified ? 'Bỏ duyệt' : 'Duyệt'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openProofModal(log)}
                        aria-label={`${hasProof ? 'Sửa bằng chứng' : 'Lưu bằng chứng'} '${log.exerciseName}'`}
                        className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[11px] text-slate-200 inline-flex items-center gap-1 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>{hasProof ? 'Xem / Sửa' : 'Thêm'}</span>
                      </button>

                      {hasProof &&
                        (confirmingClear ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void handleClearProof(log)}
                              className="px-2 py-1 rounded-md bg-[#FF4655] text-white text-[11px] font-medium"
                            >
                              Gỡ
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmClearProofId(null)}
                              className="px-2 py-1 rounded-md bg-white/10 text-slate-300 text-[11px]"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmClearProofId(log.id)}
                            aria-label={`Gỡ bằng chứng '${log.exerciseName}'`}
                            className="p-1 rounded-md text-slate-400 hover:text-[#FF4655] hover:bg-white/5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Personal Bests & Session History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 min-w-0 bg-[#121621] border border-white/[0.07] rounded-xl p-5">
          <h3 className="font-display font-semibold text-base text-white mb-3">
            Personal Best theo bài tập
          </h3>
          {analytics.personalBests.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              Chưa có Personal Best nào được ghi nhận.
            </p>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {analytics.personalBests.map((pb) => (
                <div key={pb.exerciseName} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{pb.exerciseName}</div>
                    <div className="text-xs text-slate-400">
                      {pb.platform} · {pb.sessions} lần tập · {formatFullVNDate(pb.date)}
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="text-sm font-bold text-violet-400">
                      {pb.bestScore.toLocaleString('vi-VN')}
                    </div>
                    <div className="text-xs text-slate-400">{pb.bestAccuracy}% acc</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 min-w-0 bg-[#121621] border border-white/[0.07] rounded-xl p-5">
          <h3 className="font-display font-semibold text-base text-white mb-3">
            Lịch sử buổi tập Aim ({visibleLogs.length})
          </h3>
          {visibleLogs.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              Chưa có dữ liệu buổi tập nào. Hãy nhập kết quả thủ công ở cột bên trái.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] text-slate-400">
                    <th className="py-2 pr-3 font-medium">Ngày</th>
                    <th className="py-2 pr-3 font-medium">Bài tập</th>
                    <th className="py-2 pr-3 font-medium">Nền tảng / Nhóm</th>
                    <th className="py-2 pr-3 text-right font-medium">Điểm</th>
                    <th className="py-2 pr-3 text-right font-medium">Acc</th>
                    <th className="py-2 pr-3 font-medium">Bằng chứng</th>
                    <th className="py-2 text-right font-medium">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {visibleLogs.map((log) => {
                    const hasProof = hasAimProof(log);
                    return (
                      <tr key={log.id} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                          {formatFullVNDate(log.date)}
                        </td>
                        <td className="py-2.5 pr-3 text-white font-medium">{log.exerciseName}</td>
                        <td className="py-2.5 pr-3 text-slate-300">
                          {log.platform} · {log.focusArea}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-violet-300 font-semibold">
                          {log.score.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-sky-400">
                          {log.accuracy}%
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap">
                          {hasProof ? (
                            <button
                              type="button"
                              onClick={() => openProofModal(log)}
                              aria-label={`Xem bằng chứng '${log.exerciseName}' ngày ${log.date}`}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                log.proofVerified
                                  ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                                  : 'bg-sky-500/15 text-sky-300 hover:bg-sky-500/25'
                              }`}
                            >
                              {log.proofVerified ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <Camera className="w-3 h-3" />
                              )}
                              <span>{getProofBadgeLabel(log)}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openProofModal(log)}
                              aria-label={`Lưu bằng chứng cho '${log.exerciseName}' ngày ${log.date}`}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] transition-colors"
                            >
                              <ImagePlus className="w-3 h-3 text-sky-400" />
                              <span>Lưu bằng chứng</span>
                            </button>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => onDeleteAimLog(log.id)}
                            aria-label={`Xóa kết quả '${log.exerciseName}' ngày ${log.date}`}
                            className="p-1.5 rounded-md text-slate-400 hover:text-[#FF4655] hover:bg-white/5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Proof Viewer & Editor Modal */}
      {modalLog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="aim-proof-modal-title"
          onPaste={handleModalPaste}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-[#121621] border border-white/10 rounded-2xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="aim-proof-modal-title"
                  className="font-display font-semibold text-base text-white flex items-center gap-2"
                >
                  <Camera className="w-4 h-4 text-sky-400" />
                  <span>Bằng chứng đã tập Aim</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {modalLog.exerciseName} · {formatFullVNDate(modalLog.date)} ·{' '}
                  <span className="font-mono text-violet-300">
                    {modalLog.score.toLocaleString('vi-VN')}
                  </span>{' '}
                  ({modalLog.accuracy}%)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalLog(null)}
                aria-label="Đóng cửa sổ bằng chứng"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-lg bg-[#FF4655]/15 border border-[#FF4655]/40 text-xs text-red-200">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveModalProof} className="space-y-3.5">
              {modalProofImage ? (
                <div className="space-y-2">
                  <div className="relative rounded-xl overflow-hidden border border-white/10 bg-[#090B10]">
                    <img
                      src={modalProofImage}
                      alt={`Ảnh bằng chứng ${modalLog.exerciseName}`}
                      className="w-full max-h-64 object-contain mx-auto"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="modal-proof-file"
                      className="text-xs text-sky-400 hover:text-sky-300 cursor-pointer"
                    >
                      Đổi ảnh khác
                      <input
                        id="modal-proof-file"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          void handleModalFileUpload(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                        className="sr-only"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setModalProofImage('')}
                      className="text-xs text-[#FF4655] hover:underline"
                    >
                      Xóa ảnh này
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={proofProcessing}
                      onClick={() => void handleModalScreenCapture()}
                      className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border border-sky-400/35 bg-sky-500/10 hover:bg-sky-500/20 text-xs font-semibold text-sky-300 transition-colors"
                    >
                      <Camera className="w-4 h-4 shrink-0" />
                      <span>{proofProcessing ? 'Đang chụp...' : 'Chụp màn hình ngay'}</span>
                    </button>
                    <label
                      htmlFor="modal-proof-file"
                      className="flex flex-col items-center justify-center gap-1 px-4 py-3 rounded-xl border border-dashed border-white/15 bg-[#090B10] hover:border-sky-400/50 text-xs text-slate-300 cursor-pointer transition-colors text-center"
                    >
                      <Upload className="w-4 h-4 text-sky-400" />
                      <span>
                        {proofProcessing
                          ? 'Đang xử lý ảnh...'
                          : 'Chọn ảnh hoặc dán Ctrl+V'}
                      </span>
                      <input
                        id="modal-proof-file"
                        type="file"
                        accept="image/*"
                        aria-label="Chọn file ảnh bằng chứng"
                        onChange={(e) => {
                          void handleModalFileUpload(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                        className="sr-only"
                      />
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-500 text-center">
                    Hỗ trợ chụp trực tiếp cửa sổ game/Aimlabs, chọn PNG/JPG/WebP hoặc dán ảnh Ctrl+V.
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="modal-proof-url"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Link bằng chứng (Ảnh / Video clip / Aimlabs)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="modal-proof-url"
                    type="url"
                    value={modalProofUrl}
                    onChange={(e) => setModalProofUrl(e.target.value)}
                    placeholder="https://medal.tv/... hoặc https://imgur.com/..."
                    className="flex-1 bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                  />
                  {modalProofUrl.trim() && validateProofUrl(modalProofUrl).valid && (
                    <a
                      href={validateProofUrl(modalProofUrl).normalized}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Mở link bằng chứng trong tab mới"
                      className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sky-300 text-xs inline-flex items-center gap-1 shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Mở</span>
                    </a>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="modal-proof-note"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Ghi chú bằng chứng
                </label>
                <input
                  id="modal-proof-note"
                  type="text"
                  maxLength={200}
                  value={modalProofNote}
                  onChange={(e) => setModalProofNote(e.target.value)}
                  placeholder="VD: Đã chụp bảng điểm cuối phiên tập 30 phút"
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              {dataMode === 'cloud' && (
                <p className="text-[11px] text-slate-400">
                  Lưu ý: Ảnh tải từ máy được lưu cục bộ trên trình duyệt này; hãy dán thêm Link ảnh/video nếu muốn xem trên thiết bị khác.
                </p>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08]">
                <div className="flex items-center gap-2">
                  {hasAimProof(modalLog) && activeRole === 'coach' && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = !modalLog.proofVerified;
                        void onVerifyAimProof(modalLog.id, next);
                        setModalLog({ ...modalLog, proofVerified: next });
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                        modalLog.proofVerified
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                          : 'bg-white/5 hover:bg-emerald-500/15 text-slate-200'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{modalLog.proofVerified ? 'Đã duyệt' : 'Duyệt bằng chứng'}</span>
                    </button>
                  )}

                  {hasAimProof(modalLog) && (
                    <button
                      type="button"
                      onClick={() => void handleClearProof(modalLog)}
                      className="px-3 py-2 rounded-lg bg-white/5 hover:bg-[#FF4655]/20 text-xs text-red-300 transition-colors"
                    >
                      Gỡ bằng chứng
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setModalLog(null)}
                    className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={modalBusy || proofProcessing}
                    className="px-4 py-2 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] disabled:opacity-60 text-xs font-semibold text-white transition-colors"
                  >
                    {modalBusy ? 'Đang lưu...' : 'Lưu bằng chứng'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
