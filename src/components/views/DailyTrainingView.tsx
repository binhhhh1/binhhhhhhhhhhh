import React, { useMemo, useState } from 'react';
import {
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Crosshair,
  Edit3,
  ExternalLink,
  Layers,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  DRILL_CATEGORIES,
  type AiDailyPlan,
  type AimLog,
  type DataSourceMode,
  type DrillCategory,
  type DrillStatus,
  type GeneratedDailyDrill,
  type TeamMember,
  type TeamRole,
  type TrainingDrill,
  type TrainingTemplate,
} from '../../types/training';
import { DEFAULT_AI_FOCUS_AREAS, toTrainingDrill } from '../../utils/aiDrills';
import {
  captureScreenToDataUrl,
  compressImageFileToDataUrl,
  hasAimProof,
  validateProofUrl,
} from '../../utils/aimProof';
import { formatFullVNDate, getVNDateKey } from '../../utils/timezone';
import { AimTrainingView } from './AimTrainingView';

export type DailyTrainingTab = 'drills' | 'aim';

interface DailyTrainingViewProps {
  drills: TrainingDrill[];
  templates: TrainingTemplate[];
  members: TeamMember[];
  aimLogs: AimLog[];
  activeRole: TeamRole;
  currentUserId: string;
  dataMode: DataSourceMode;
  teamId: string;
  teamOwnerId: string;
  activeTab?: DailyTrainingTab;
  onTabChange?: (tab: DailyTrainingTab) => void;
  aiPlan: AiDailyPlan | null;
  aiLoading: boolean;
  aiError: string;
  onGenerateAiPlan: (options: {
    focusAreas: string[];
    durationBudgetMin: number;
    force?: boolean;
  }) => Promise<void>;
  onSaveDrill: (drill: TrainingDrill, isNew: boolean) => Promise<void>;
  onVerifyDrillProof: (drillId: string, verified: boolean) => Promise<void>;
  onDeleteDrill: (drillId: string) => Promise<void>;
  onDuplicateDrill: (drill: TrainingDrill) => Promise<void>;
  onApplyTemplate: (template: TrainingTemplate, targetDate: string) => Promise<void>;
  onSaveTemplate: (template: TrainingTemplate) => Promise<void>;
  onSaveAimLog: (log: AimLog, isNew: boolean) => Promise<void>;
  onVerifyAimProof: (logId: string, verified: boolean) => Promise<void>;
  onDeleteAimLog: (logId: string) => Promise<void>;
}

const STATUS_META: Record<DrillStatus, { label: string; colorClass: string }> = {
  todo: { label: 'Chưa thực hiện', colorClass: 'text-slate-300' },
  in_progress: { label: 'Đang thực hiện', colorClass: 'text-sky-400' },
  completed: { label: 'Hoàn thành', colorClass: 'text-emerald-400' },
  skipped: { label: 'Bỏ qua', colorClass: 'text-amber-400' },
};

export function DailyTrainingView({
  drills,
  templates,
  members,
  aimLogs,
  activeRole,
  currentUserId,
  dataMode,
  teamId,
  teamOwnerId,
  activeTab,
  onTabChange,
  aiPlan,
  aiLoading,
  aiError,
  onGenerateAiPlan,
  onSaveDrill,
  onVerifyDrillProof,
  onDeleteDrill,
  onDuplicateDrill,
  onApplyTemplate,
  onSaveTemplate,
  onSaveAimLog,
  onVerifyAimProof,
  onDeleteAimLog,
}: DailyTrainingViewProps) {
  const todayDate = getVNDateKey();
  const [internalTab, setInternalTab] = useState<DailyTrainingTab>('drills');
  const currentTab = activeTab ?? internalTab;
  const switchTab = (tab: DailyTrainingTab) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  const [aiFocusAreas, setAiFocusAreas] = useState<string[]>([
    'Tracking',
    'Flicking',
    'Micro Adjustment',
    'Crosshair Placement',
  ]);
  const [aiBudgetMin, setAiBudgetMin] = useState<number>(90);
  const [addingAllAi, setAddingAllAi] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);
  const [showAllDates, setShowAllDates] = useState<boolean>(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDrill, setEditingDrill] = useState<TrainingDrill | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DrillCategory>('Aim Training');
  const [date, setDate] = useState(todayDate);
  const [startTime, setStartTime] = useState('14:00');
  const [durationMin, setDurationMin] = useState(45);
  const [ownerId, setOwnerId] = useState(currentUserId);
  const [goal, setGoal] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<DrillStatus>('todo');
  const [actualResult, setActualResult] = useState('');
  const [notes, setNotes] = useState('');
  const [proofImageDataUrl, setProofImageDataUrl] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [proofProcessing, setProofProcessing] = useState(false);

  // Quick Screenshot Proof Modal state
  const [proofModalDrill, setProofModalDrill] = useState<TrainingDrill | null>(null);
  const [quickProofImage, setQuickProofImage] = useState('');
  const [quickProofUrl, setQuickProofUrl] = useState('');
  const [quickProofNote, setQuickProofNote] = useState('');
  const [quickMarkDone, setQuickMarkDone] = useState(true);
  const [quickProofError, setQuickProofError] = useState('');
  const [quickProofBusy, setQuickProofBusy] = useState(false);

  const filteredDrills = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return drills
      .filter((d) => {
        if (!showAllDates && d.date !== selectedDate) return false;
        if (categoryFilter !== 'ALL' && d.category !== categoryFilter) return false;
        if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
        if (
          q &&
          !d.title.toLowerCase().includes(q) &&
          !d.category.toLowerCase().includes(q) &&
          !(d.goal || '').toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) =>
        a.date !== b.date
          ? b.date.localeCompare(a.date)
          : a.startTime.localeCompare(b.startTime),
      );
  }, [drills, showAllDates, selectedDate, categoryFilter, statusFilter, searchQuery]);

  const openAddModal = () => {
    setEditingDrill(null);
    setTitle('');
    setCategory('Aim Training');
    setDate(selectedDate || todayDate);
    setStartTime('14:00');
    setDurationMin(45);
    setOwnerId(currentUserId);
    setGoal('');
    setDescription('');
    setStatus('todo');
    setActualResult('');
    setNotes('');
    setProofImageDataUrl('');
    setProofUrl('');
    setProofNote('');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (d: TrainingDrill) => {
    setEditingDrill(d);
    setTitle(d.title);
    setCategory(d.category);
    setDate(d.date);
    setStartTime(d.startTime);
    setDurationMin(d.durationMin);
    setOwnerId(d.ownerId);
    setGoal(d.goal || '');
    setDescription(d.description || '');
    setStatus(d.status);
    setActualResult(d.actualResult || '');
    setNotes(d.notes || '');
    setProofImageDataUrl(d.proofImageDataUrl || '');
    setProofUrl(d.proofUrl || '');
    setProofNote(d.proofNote || '');
    setFormError('');
    setModalOpen(true);
  };

  const handleDrillFormFile = async (file: File | undefined) => {
    if (!file) return;
    setFormError('');
    setProofProcessing(true);
    try {
      const compressed = await compressImageFileToDataUrl(file);
      setProofImageDataUrl(compressed);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không thể xử lý ảnh kết quả.');
    } finally {
      setProofProcessing(false);
    }
  };

  const handleDrillFormScreenCapture = async () => {
    setFormError('');
    setProofProcessing(true);
    try {
      const captured = await captureScreenToDataUrl();
      setProofImageDataUrl(captured);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không thể chụp màn hình.');
    } finally {
      setProofProcessing(false);
    }
  };

  const handleDrillFormPaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (file) {
      e.preventDefault();
      await handleDrillFormFile(file);
    }
  };

  const openQuickProofModal = (d: TrainingDrill) => {
    setProofModalDrill(d);
    setQuickProofImage(d.proofImageDataUrl || '');
    setQuickProofUrl(d.proofUrl || '');
    setQuickProofNote(d.proofNote || '');
    setQuickMarkDone(d.status !== 'completed');
    setQuickProofError('');
  };

  const handleQuickProofFile = async (file: File | undefined) => {
    if (!file) return;
    setQuickProofError('');
    setProofProcessing(true);
    try {
      const compressed = await compressImageFileToDataUrl(file);
      setQuickProofImage(compressed);
    } catch (err) {
      setQuickProofError(err instanceof Error ? err.message : 'Không thể xử lý ảnh kết quả.');
    } finally {
      setProofProcessing(false);
    }
  };

  const handleQuickProofScreenCapture = async () => {
    setQuickProofError('');
    setProofProcessing(true);
    try {
      const captured = await captureScreenToDataUrl();
      setQuickProofImage(captured);
    } catch (err) {
      setQuickProofError(err instanceof Error ? err.message : 'Không thể chụp màn hình.');
    } finally {
      setProofProcessing(false);
    }
  };

  const handleQuickProofPaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (file) {
      e.preventDefault();
      await handleQuickProofFile(file);
    }
  };

  const handleSaveQuickProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofModalDrill) return;
    const urlCheck = validateProofUrl(quickProofUrl);
    if (!urlCheck.valid) {
      setQuickProofError(urlCheck.error || 'Link bằng chứng không hợp lệ.');
      return;
    }
    setQuickProofBusy(true);
    setQuickProofError('');
    try {
      const hasAttachment = Boolean(quickProofImage || urlCheck.normalized);
      const nextStatus: DrillStatus =
        hasAttachment && quickMarkDone ? 'completed' : proofModalDrill.status;
      await onSaveDrill(
        {
          ...proofModalDrill,
          status: nextStatus,
          proofImageDataUrl: quickProofImage,
          proofUrl: urlCheck.normalized,
          proofNote: quickProofNote.trim().slice(0, 200),
        },
        false,
      );
      setProofModalDrill(null);
    } catch (err) {
      setQuickProofError(err instanceof Error ? err.message : 'Không thể lưu ảnh kết quả.');
    } finally {
      setQuickProofBusy(false);
    }
  };

  const handleClearQuickProof = async () => {
    if (!proofModalDrill) return;
    setQuickProofBusy(true);
    try {
      await onSaveDrill(
        {
          ...proofModalDrill,
          proofImageDataUrl: '',
          proofUrl: '',
          proofNote: '',
          proofVerified: false,
        },
        false,
      );
      setProofModalDrill(null);
    } finally {
      setQuickProofBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Vui lòng nhập tên bài tập.');
      return;
    }
    if (durationMin < 5 || durationMin > 480) {
      setFormError('Thời lượng dự kiến phải từ 5 đến 480 phút.');
      return;
    }
    const urlCheck = validateProofUrl(proofUrl);
    if (!urlCheck.valid) {
      setFormError(urlCheck.error || 'Link bằng chứng không hợp lệ.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload: TrainingDrill = {
        id: editingDrill ? editingDrill.id : `drill_${Date.now()}`,
        teamId,
        teamOwnerId,
        ownerId: activeRole === 'coach' ? ownerId : currentUserId,
        assignedBy: editingDrill ? editingDrill.assignedBy : currentUserId,
        title: title.trim(),
        category,
        date,
        startTime,
        durationMin: Number(durationMin),
        goal: goal.trim(),
        description: description.trim(),
        status,
        actualResult: actualResult.trim(),
        notes: notes.trim(),
        proofImageDataUrl,
        proofUrl: urlCheck.normalized,
        proofNote: proofNote.trim().slice(0, 200),
        proofVerified: editingDrill?.proofVerified ?? false,
      };
      await onSaveDrill(payload, !editingDrill);
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không thể lưu bài tập.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTemplateFromDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) return;
    const dayDrills = drills.filter((d) => d.date === selectedDate);
    if (dayDrills.length === 0) return;

    const newTpl: TrainingTemplate = {
      id: `tpl_${Date.now()}`,
      teamId,
      teamOwnerId,
      ownerId: currentUserId,
      name: templateName.trim(),
      description: templateDesc.trim() || `Template tạo từ lịch ngày ${formatFullVNDate(selectedDate)}`,
      items: dayDrills.slice(0, 15).map((d) => ({
        title: d.title,
        category: d.category,
        startTime: d.startTime,
        durationMin: d.durationMin,
        goal: d.goal,
        description: d.description,
      })),
    };
    await onSaveTemplate(newTpl);
    setTemplateName('');
    setTemplateDesc('');
  };

  const getMemberName = (uid: string) =>
    members.find((m) => m.uid === uid)?.displayName || 'Cá nhân';

  const totalDayMinutes = filteredDrills.reduce((s, d) => s + d.durationMin, 0);
  const completedCount = filteredDrills.filter((d) => d.status === 'completed').length;
  const drillWithProofCount = filteredDrills.filter((d) => hasAimProof(d)).length;

  const targetPlanDate = selectedDate || todayDate;
  const existingTitlesOnTargetDate = useMemo(() => {
    const set = new Set<string>();
    for (const d of drills) {
      if (d.date === targetPlanDate) {
        set.add(d.title.trim().toLowerCase());
      }
    }
    return set;
  }, [drills, targetPlanDate]);

  const toggleAiFocus = (focus: string) => {
    setAiFocusAreas((prev) => {
      if (prev.includes(focus)) {
        return prev.length > 1 ? prev.filter((f) => f !== focus) : prev;
      }
      return [...prev, focus];
    });
  };

  const handleAddSingleAiDrill = async (item: GeneratedDailyDrill) => {
    const drill = toTrainingDrill(item, {
      id: `drill_ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: targetPlanDate,
      teamId,
      teamOwnerId,
      ownerId: currentUserId,
      assignedBy: currentUserId,
    });
    await onSaveDrill(drill, true);
  };

  const handleAddAllAiDrills = async () => {
    if (!aiPlan || aiPlan.drills.length === 0) return;
    setAddingAllAi(true);
    try {
      for (let i = 0; i < aiPlan.drills.length; i++) {
        const item = aiPlan.drills[i];
        if (existingTitlesOnTargetDate.has(item.title.trim().toLowerCase())) {
          continue;
        }
        const drill = toTrainingDrill(item, {
          id: `drill_ai_${Date.now()}_${i}`,
          date: targetPlanDate,
          teamId,
          teamOwnerId,
          ownerId: currentUserId,
          assignedBy: currentUserId,
        });
        await onSaveDrill(drill, true);
      }
    } finally {
      setAddingAllAi(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Merged Daily Training & Aim Training Sub-navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#121621] border border-white/[0.07] rounded-xl p-3">
        <div
          role="tablist"
          aria-label="Phân hệ Daily Training và Aim Training"
          className="grid grid-cols-2 sm:inline-flex items-center gap-1.5 p-1 rounded-lg bg-[#090B10] border border-white/[0.07] w-full sm:w-auto sm:self-start"
        >
          <button
            type="button"
            role="tab"
            aria-selected={currentTab === 'drills'}
            onClick={() => switchTab('drills')}
            className={`px-2.5 sm:px-3.5 py-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 sm:gap-2 transition-colors min-w-0 ${
              currentTab === 'drills'
                ? 'bg-[#FF4655] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Lịch tập hằng ngày</span>
            <span className="font-mono text-[11px] opacity-80 shrink-0">({drills.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={currentTab === 'aim'}
            onClick={() => switchTab('aim')}
            className={`px-2.5 sm:px-3.5 py-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 sm:gap-2 transition-colors min-w-0 ${
              currentTab === 'aim'
                ? 'bg-[#FF4655] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Aim &amp; Kết quả</span>
            <span className="font-mono text-[11px] opacity-80 shrink-0">({aimLogs.length})</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-2 px-1">
          <Camera className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span>
            {currentTab === 'drills'
              ? 'Hỗ trợ chụp màn hình trực tiếp, dán Ctrl+V hoặc tải ảnh kết quả chứng minh từng bài tập.'
              : 'Ghi nhận điểm Aim, biểu đồ tiến bộ và kho ảnh bằng chứng tập luyện.'}
          </span>
        </div>
      </div>

      {currentTab === 'aim' ? (
        <AimTrainingView
          aimLogs={aimLogs}
          currentUserId={currentUserId}
          activeRole={activeRole}
          dataMode={dataMode}
          teamId={teamId}
          teamOwnerId={teamOwnerId}
          onSaveAimLog={onSaveAimLog}
          onVerifyAimProof={onVerifyAimProof}
          onDeleteAimLog={onDeleteAimLog}
        />
      ) : (
        <>
      {/* Action Toolbar */}
      <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label htmlFor="daily-date-filter" className="sr-only">
                Chọn ngày luyện tập
              </label>
              <input
                id="daily-date-filter"
                type="date"
                value={selectedDate}
                disabled={showAllDates}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono tabular-nums disabled:opacity-40"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAllDates((v) => !v)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                showAllDates
                  ? 'bg-sky-500/15 border-sky-400/40 text-sky-300'
                  : 'bg-[#090B10] border-white/10 text-slate-300 hover:border-white/25'
              }`}
            >
              {showAllDates ? 'Đang xem tất cả ngày' : 'Xem tất cả ngày'}
            </button>

            <div className="text-xs text-slate-400 font-mono tabular-nums pl-1">
              {filteredDrills.length} bài tập · {completedCount} hoàn thành ·{' '}
              {(totalDayMinutes / 60).toFixed(1)}h dự kiến ·{' '}
              <span className="text-sky-400">{drillWithProofCount} có ảnh chứng minh</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setTemplateModalOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Layers className="w-3.5 h-3.5 text-violet-400" />
              <span>Template ({templates.length})</span>
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="px-4 py-2 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm bài tập</span>
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/[0.06]">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên bài tập hoặc mục tiêu..."
              aria-label="Tìm kiếm bài tập"
              className="w-full bg-[#090B10] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
            />
          </div>

          <div>
            <label htmlFor="drill-category-filter" className="sr-only">
              Lọc theo loại bài tập
            </label>
            <select
              id="drill-category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
            >
              <option value="ALL">Tất cả 13 nhóm bài tập</option>
              {DRILL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="drill-status-filter" className="sr-only">
              Lọc theo trạng thái
            </label>
            <select
              id="drill-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
            >
              <option value="ALL">Mọi trạng thái</option>
              <option value="todo">Chưa thực hiện</option>
              <option value="in_progress">Đang thực hiện</option>
              <option value="completed">Hoàn thành</option>
              <option value="skipped">Bỏ qua</option>
            </select>
          </div>
        </div>
      </div>

      {/* AI Daily Drill Generator Panel */}
      <section
        aria-label="AI Coach bài tập Tracking và Flick hằng ngày"
        className="bg-[#121621] border border-violet-500/25 rounded-xl p-4 lg:p-5 space-y-4"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-violet-500/15 text-violet-300 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-sm sm:text-base text-white">
                AI Coach — Giáo án Tracking & Flick hằng ngày
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Tự động đề xuất bài tập mới mỗi ngày theo ngày {formatFullVNDate(todayDate)} · Có thể chọn kỹ năng ưu tiên và thêm thẳng vào lịch.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label htmlFor="ai-duration-budget" className="sr-only">
              Tổng thời lượng giáo án AI
            </label>
            <select
              id="ai-duration-budget"
              value={aiBudgetMin}
              onChange={(e) => setAiBudgetMin(Number(e.target.value))}
              className="bg-[#090B10] border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white font-mono"
            >
              <option value={60}>60 phút</option>
              <option value={90}>90 phút</option>
              <option value={120}>120 phút</option>
              <option value={150}>150 phút</option>
            </select>

            <button
              type="button"
              disabled={aiLoading}
              onClick={() =>
                void onGenerateAiPlan({
                  focusAreas: aiFocusAreas,
                  durationBudgetMin: aiBudgetMin,
                  force: true,
                })
              }
              className="px-3.5 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 disabled:opacity-60 text-slate-950 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              {aiLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>{aiLoading ? 'Đang tạo giáo án...' : 'Tạo giáo án AI'}</span>
            </button>

            {aiPlan && aiPlan.drills.length > 0 && (
              <button
                type="button"
                disabled={addingAllAi}
                onClick={() => void handleAddAllAiDrills()}
                className="px-3.5 py-2 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{addingAllAi ? 'Đang thêm...' : 'Thêm tất cả vào lịch'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Focus area selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-400 mr-1">Trọng tâm:</span>
          {DEFAULT_AI_FOCUS_AREAS.map((focus) => {
            const active = aiFocusAreas.includes(focus);
            return (
              <button
                key={focus}
                type="button"
                onClick={() => toggleAiFocus(focus)}
                aria-pressed={active}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-sky-500/15 border-sky-400/40 text-sky-300'
                    : 'bg-[#090B10] border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                {focus}
              </button>
            );
          })}
        </div>

        {aiError && (
          <div className="p-3 rounded-lg bg-[#FF4655]/15 border border-[#FF4655]/40 text-xs text-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>{aiError}</span>
            <button
              type="button"
              onClick={() =>
                void onGenerateAiPlan({
                  focusAreas: aiFocusAreas,
                  durationBudgetMin: aiBudgetMin,
                  force: true,
                })
              }
              className="px-3 py-1 rounded-md bg-white/10 hover:bg-white/15 text-white font-medium self-start sm:self-auto shrink-0"
            >
              Thử lại
            </button>
          </div>
        )}

        {aiLoading && !aiPlan && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="h-24 rounded-lg bg-[#090B10] border border-white/[0.06] animate-pulse"
              />
            ))}
          </div>
        )}

        {aiPlan && aiPlan.drills.length > 0 && (
          <div className="space-y-3">
            {aiPlan.coachNote && (
              <div className="text-xs text-slate-300 bg-[#090B10] border border-white/[0.06] rounded-lg px-3 py-2">
                <span className="text-violet-300 font-semibold">Ghi chú Coach AI: </span>
                {aiPlan.coachNote}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {aiPlan.drills.map((item) => {
                const alreadyAdded = existingTitlesOnTargetDate.has(
                  item.title.trim().toLowerCase(),
                );
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-lg bg-[#090B10] border border-white/[0.08] flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
                        <span className="text-violet-300 font-semibold">{item.focusTag}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-sky-400">{item.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {item.startTime} ({item.durationMin}p)
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-white">{item.title}</div>
                      {item.goal && (
                        <div className="text-xs text-emerald-400">Mục tiêu: {item.goal}</div>
                      )}
                      {item.description && (
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end pt-2 border-t border-white/[0.06]">
                      <button
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => void handleAddSingleAiDrill(item)}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                          alreadyAdded
                            ? 'bg-emerald-500/15 text-emerald-400 cursor-default'
                            : 'bg-white/[0.06] hover:bg-[#FF4655] text-slate-200 hover:text-white'
                        }`}
                      >
                        {alreadyAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Đã có trong lịch</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Thêm vào ngày {formatFullVNDate(targetPlanDate)}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Drills List */}
      <div className="bg-[#121621] border border-white/[0.07] rounded-xl overflow-hidden">
        {filteredDrills.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-slate-300">
              Không có bài tập nào khớp bộ lọc cho ngày{' '}
              <span className="font-mono">{formatFullVNDate(selectedDate)}</span>.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={openAddModal}
                className="px-4 py-2 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] text-white text-xs font-semibold"
              >
                Tạo bài tập mới
              </button>
              <button
                type="button"
                onClick={() => setTemplateModalOpen(true)}
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium"
              >
                Áp dụng Template
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {filteredDrills.map((drill) => {
              const isDone = drill.status === 'completed';
              const meta = STATUS_META[drill.status];
              const hasProof = hasAimProof(drill);
              return (
                <div
                  key={drill.id}
                  className="p-4 lg:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        onSaveDrill(
                          { ...drill, status: isDone ? 'todo' : 'completed' },
                          false,
                        )
                      }
                      aria-label={`Đổi trạng thái hoàn thành cho '${drill.title}'`}
                      className={`mt-0.5 p-1.5 rounded-lg transition-colors shrink-0 ${
                        isDone
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-white/[0.04] text-slate-400 hover:text-white'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                        <span className="text-sky-400 font-medium">{drill.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {formatFullVNDate(drill.date)} {drill.startTime} ({drill.durationMin} phút)
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className={meta.colorClass}>{meta.label}</span>
                        {members.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{getMemberName(drill.ownerId)}</span>
                          </>
                        )}
                      </div>

                      <div
                        className={`text-sm font-semibold ${
                          isDone ? 'line-through text-slate-400' : 'text-white'
                        }`}
                      >
                        {drill.title}
                      </div>

                      {drill.goal && (
                        <div className="text-xs text-slate-300">Mục tiêu: {drill.goal}</div>
                      )}
                      {drill.actualResult && (
                        <div className="text-xs text-emerald-400 font-mono tabular-nums">
                          Kết quả: {drill.actualResult}
                        </div>
                      )}
                      {drill.notes && (
                        <div className="text-xs text-slate-400">Ghi chú: {drill.notes}</div>
                      )}

                      {hasProof && (
                        <div className="pt-1.5 flex flex-wrap items-center gap-2.5">
                          {drill.proofImageDataUrl && (
                            <button
                              type="button"
                              onClick={() => openQuickProofModal(drill)}
                              aria-label={`Xem ảnh kết quả của '${drill.title}'`}
                              className="rounded-lg overflow-hidden border border-sky-400/35 hover:border-sky-400 transition-colors shrink-0"
                            >
                              <img
                                src={drill.proofImageDataUrl}
                                alt={`Ảnh chứng minh ${drill.title}`}
                                className="w-16 h-10 object-cover"
                              />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openQuickProofModal(drill)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                              drill.proofVerified
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
                                : 'bg-sky-500/15 text-sky-300 border border-sky-400/30'
                            }`}
                          >
                            <Camera className="w-3 h-3" />
                            <span>
                              {drill.proofVerified
                                ? 'Ảnh chứng minh (Đã duyệt)'
                                : drill.proofImageDataUrl
                                ? 'Đã lưu ảnh kết quả'
                                : 'Đã gắn link chứng minh'}
                            </span>
                          </button>
                          {drill.proofNote && (
                            <span className="text-[11px] text-slate-400">{drill.proofNote}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end lg:self-center">
                    <button
                      type="button"
                      onClick={() => openQuickProofModal(drill)}
                      aria-label={`Chụp hoặc lưu ảnh chứng minh cho '${drill.title}'`}
                      title="Chụp / Lưu ảnh chứng minh kết quả"
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                        hasProof
                          ? 'bg-sky-500/15 text-sky-300 hover:bg-sky-500/25'
                          : 'bg-white/[0.05] text-slate-200 hover:bg-sky-500/20 hover:text-sky-300'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{hasProof ? 'Ảnh KQ' : 'Chụp / Lưu ảnh KQ'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicateDrill(drill)}
                      aria-label={`Nhân bản '${drill.title}'`}
                      title="Nhân bản bài tập"
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(drill)}
                      aria-label={`Chỉnh sửa '${drill.title}'`}
                      title="Chỉnh sửa"
                      className="p-2 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-white/5 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteDrill(drill.id)}
                      aria-label={`Xóa '${drill.title}'`}
                      title="Xóa"
                      className="p-2 rounded-lg text-slate-400 hover:text-[#FF4655] hover:bg-white/5 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Drill Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
          onPaste={handleDrillFormPaste}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="drill-modal-title"
            className="w-full max-w-xl bg-[#121621] border border-white/10 rounded-xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
              <h2 id="drill-modal-title" className="font-display font-semibold text-base text-white">
                {editingDrill ? 'Chỉnh sửa bài tập' : 'Thêm bài tập mới'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Đóng biểu mẫu bài tập"
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

              <div>
                <label htmlFor="drill-title" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Tên bài tập *
                </label>
                <input
                  id="drill-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: VT Sixshot & Micro Flick 30 phút"
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="drill-category" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Loại bài tập
                  </label>
                  <select
                    id="drill-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as DrillCategory)}
                    className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    {DRILL_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="drill-status" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Trạng thái
                  </label>
                  <select
                    id="drill-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as DrillStatus)}
                    className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="todo">Chưa thực hiện</option>
                    <option value="in_progress">Đang thực hiện</option>
                    <option value="completed">Hoàn thành</option>
                    <option value="skipped">Bỏ qua</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="drill-date" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Ngày thực hiện
                  </label>
                  <input
                    id="drill-date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="drill-start" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Giờ bắt đầu
                  </label>
                  <input
                    id="drill-start"
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="drill-duration" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Thời lượng (phút)
                  </label>
                  <input
                    id="drill-duration"
                    type="number"
                    min={5}
                    max={480}
                    required
                    value={durationMin}
                    onChange={(e) => setDurationMin(Number(e.target.value))}
                    className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                </div>
              </div>

              {activeRole === 'coach' && members.length > 0 && (
                <div>
                  <label htmlFor="drill-assignee" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Giao cho tuyển thủ
                  </label>
                  <select
                    id="drill-assignee"
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    {members.map((m) => (
                      <option key={m.uid} value={m.uid}>
                        {m.displayName} ({m.riotId} · {m.gameRole})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="drill-goal" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Mục tiêu bài tập
                </label>
                <input
                  id="drill-goal"
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="VD: >= 92% accuracy hoặc 35% HS rate"
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label htmlFor="drill-desc" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Mô tả chi tiết
                </label>
                <textarea
                  id="drill-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="drill-result" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Kết quả thực tế
                  </label>
                  <input
                    id="drill-result"
                    type="text"
                    value={actualResult}
                    onChange={(e) => setActualResult(e.target.value)}
                    placeholder="VD: 94.5% accuracy · 95,200 pts"
                    className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label htmlFor="drill-notes" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Ghi chú sau khi tập
                  </label>
                  <input
                    id="drill-notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Nhận xét kỹ thuật..."
                    className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              {/* Screenshot proof section inside Drill Add/Edit Modal */}
              <div className="pt-3 border-t border-white/[0.07] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-sky-400" />
                    <span>Ảnh màn hình kết quả chứng minh đã luyện tập</span>
                  </span>
                  <span className="text-[11px] text-slate-500">Chụp / Tải / Ctrl+V</span>
                </div>

                {proofImageDataUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-white/10 bg-[#090B10]">
                    <img
                      src={proofImageDataUrl}
                      alt="Xem trước ảnh kết quả luyện tập"
                      className="w-full max-h-44 object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setProofImageDataUrl('')}
                      aria-label="Xóa ảnh kết quả bài tập"
                      className="absolute top-2 right-2 p-1 rounded-md bg-black/75 text-white hover:bg-[#FF4655]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={proofProcessing}
                      onClick={() => void handleDrillFormScreenCapture()}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-sky-400/35 bg-sky-500/10 hover:bg-sky-500/20 text-xs font-medium text-sky-300 transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{proofProcessing ? 'Đang chụp...' : 'Chụp màn hình'}</span>
                    </button>
                    <label
                      htmlFor="drill-proof-file"
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-dashed border-white/15 bg-[#090B10] hover:border-sky-400/50 text-xs text-slate-300 cursor-pointer transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 text-sky-400" />
                      <span>Chọn ảnh hoặc Ctrl+V</span>
                      <input
                        id="drill-proof-file"
                        type="file"
                        accept="image/*"
                        aria-label="Chọn ảnh kết quả chứng minh bài tập"
                        onChange={(e) => {
                          void handleDrillFormFile(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                        className="sr-only"
                      />
                    </label>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="drill-proof-url" className="block text-[11px] text-slate-400 mb-1">
                      Link kết quả / clip (tuỳ chọn)
                    </label>
                    <input
                      id="drill-proof-url"
                      type="url"
                      value={proofUrl}
                      onChange={(e) => setProofUrl(e.target.value)}
                      placeholder="https://medal.tv/..."
                      className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="drill-proof-note" className="block text-[11px] text-slate-400 mb-1">
                      Ghi chú ảnh kết quả
                    </label>
                    <input
                      id="drill-proof-note"
                      type="text"
                      maxLength={200}
                      value={proofNote}
                      onChange={(e) => setProofNote(e.target.value)}
                      placeholder="VD: Ảnh scoreboard sau 3 trận DM"
                      className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.07]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving || proofProcessing}
                  className="px-5 py-2 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] disabled:opacity-60 text-xs font-semibold text-white"
                >
                  {saving ? 'Đang lưu...' : editingDrill ? 'Lưu thay đổi' : 'Tạo bài tập'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Screenshot Proof Capture & Viewer Modal for Daily Drill */}
      {proofModalDrill && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="drill-proof-modal-title"
          onPaste={handleQuickProofPaste}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-[#121621] border border-white/10 rounded-2xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="drill-proof-modal-title"
                  className="font-display font-semibold text-base text-white flex items-center gap-2"
                >
                  <Camera className="w-4 h-4 text-sky-400" />
                  <span>Chụp / Lưu ảnh kết quả luyện tập</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {proofModalDrill.title} · {formatFullVNDate(proofModalDrill.date)} ({proofModalDrill.startTime})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProofModalDrill(null)}
                aria-label="Đóng hộp thoại ảnh kết quả"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {quickProofError && (
              <div className="p-3 rounded-lg bg-[#FF4655]/15 border border-[#FF4655]/40 text-xs text-red-200">
                {quickProofError}
              </div>
            )}

            <form onSubmit={handleSaveQuickProof} className="space-y-3.5">
              {quickProofImage ? (
                <div className="space-y-2">
                  <div className="relative rounded-xl overflow-hidden border border-white/10 bg-[#090B10]">
                    <img
                      src={quickProofImage}
                      alt={`Ảnh kết quả ${proofModalDrill.title}`}
                      className="w-full max-h-64 object-contain mx-auto"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={proofProcessing}
                        onClick={() => void handleQuickProofScreenCapture()}
                        className="text-xs text-sky-400 hover:text-sky-300 inline-flex items-center gap-1"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Chụp lại màn hình</span>
                      </button>
                      <label
                        htmlFor="quick-drill-proof-file"
                        className="text-xs text-slate-300 hover:text-white cursor-pointer"
                      >
                        Đổi ảnh từ máy
                        <input
                          id="quick-drill-proof-file"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            void handleQuickProofFile(e.target.files?.[0]);
                            e.target.value = '';
                          }}
                          className="sr-only"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuickProofImage('')}
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
                      onClick={() => void handleQuickProofScreenCapture()}
                      className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border border-sky-400/35 bg-sky-500/10 hover:bg-sky-500/20 text-xs font-semibold text-sky-300 transition-colors"
                    >
                      <Camera className="w-4 h-4 shrink-0" />
                      <span>{proofProcessing ? 'Đang chụp...' : 'Chụp màn hình ngay'}</span>
                    </button>
                    <label
                      htmlFor="quick-drill-proof-file"
                      className="flex flex-col items-center justify-center gap-1 px-4 py-3 rounded-xl border border-dashed border-white/15 bg-[#090B10] hover:border-sky-400/50 text-xs text-slate-300 cursor-pointer transition-colors text-center"
                    >
                      <Upload className="w-4 h-4 text-sky-400" />
                      <span>
                        {proofProcessing ? 'Đang xử lý ảnh...' : 'Chọn ảnh hoặc Ctrl+V'}
                      </span>
                      <input
                        id="quick-drill-proof-file"
                        type="file"
                        accept="image/*"
                        aria-label="Chọn file ảnh chứng minh bài tập"
                        onChange={(e) => {
                          void handleQuickProofFile(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                        className="sr-only"
                      />
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-500 text-center">
                    Chụp màn hình kết thúc bài tập, dán Ctrl+V hoặc chọn ảnh PNG/JPG/WebP từ máy.
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="quick-drill-proof-url"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Link kết quả / Video clip (tuỳ chọn)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="quick-drill-proof-url"
                    type="url"
                    value={quickProofUrl}
                    onChange={(e) => setQuickProofUrl(e.target.value)}
                    placeholder="https://medal.tv/... hoặc link ảnh"
                    className="flex-1 bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                  />
                  {quickProofUrl.trim() && validateProofUrl(quickProofUrl).valid && (
                    <a
                      href={validateProofUrl(quickProofUrl).normalized}
                      target="_blank"
                      rel="noopener noreferrer"
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
                  htmlFor="quick-drill-proof-note"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Ghi chú kết quả
                </label>
                <input
                  id="quick-drill-proof-note"
                  type="text"
                  maxLength={200}
                  value={quickProofNote}
                  onChange={(e) => setQuickProofNote(e.target.value)}
                  placeholder="VD: Đạt 38/40 điểm trong 30 phút"
                  className="w-full bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              {proofModalDrill.status !== 'completed' && (
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={quickMarkDone}
                    onChange={(e) => setQuickMarkDone(e.target.checked)}
                    className="rounded border-white/20 bg-[#090B10]"
                  />
                  <span>Tự động đánh dấu hoàn thành bài tập sau khi lưu ảnh</span>
                </label>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08]">
                <div className="flex items-center gap-2">
                  {hasAimProof(proofModalDrill) && activeRole === 'coach' && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = !proofModalDrill.proofVerified;
                        void onVerifyDrillProof(proofModalDrill.id, next);
                        setProofModalDrill({ ...proofModalDrill, proofVerified: next });
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                        proofModalDrill.proofVerified
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                          : 'bg-white/5 hover:bg-emerald-500/15 text-slate-200'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{proofModalDrill.proofVerified ? 'Đã duyệt' : 'Duyệt ảnh'}</span>
                    </button>
                  )}

                  {hasAimProof(proofModalDrill) && (
                    <button
                      type="button"
                      disabled={quickProofBusy}
                      onClick={() => void handleClearQuickProof()}
                      className="px-3 py-2 rounded-lg bg-white/5 hover:bg-[#FF4655]/20 text-xs text-red-300 transition-colors"
                    >
                      Gỡ ảnh
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setProofModalDrill(null)}
                    className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={quickProofBusy || proofProcessing}
                    className="px-4 py-2 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] disabled:opacity-60 text-xs font-semibold text-white transition-colors"
                  >
                    {quickProofBusy ? 'Đang lưu...' : 'Lưu ảnh kết quả'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Daily Template Modal */}
      {templateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-modal-title"
            className="w-full max-w-2xl bg-[#121621] border border-white/10 rounded-xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
              <h2 id="template-modal-title" className="font-display font-semibold text-base text-white">
                Template luyện tập theo ngày
              </h2>
              <button
                type="button"
                onClick={() => setTemplateModalOpen(false)}
                aria-label="Đóng quản lý template"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto">
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-300">
                  Áp dụng Template cho ngày {formatFullVNDate(selectedDate)}
                </h3>
                {templates.length === 0 ? (
                  <p className="text-xs text-slate-400">Chưa có template nào.</p>
                ) : (
                  <div className="space-y-2.5">
                    {templates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="p-3.5 rounded-lg bg-[#090B10] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-sm font-medium text-white">{tpl.name}</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {tpl.items.length} bài tập · {tpl.description}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await onApplyTemplate(tpl, selectedDate);
                            setTemplateModalOpen(false);
                          }}
                          className="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold whitespace-nowrap shrink-0"
                        >
                          Áp dụng vào ngày này
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form
                onSubmit={handleCreateTemplateFromDay}
                className="pt-4 border-t border-white/[0.07] space-y-3"
              >
                <h3 className="text-xs font-semibold text-slate-300">
                  Lưu lịch ngày {formatFullVNDate(selectedDate)} thành Template mới
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Tên template (VD: Initiator Prep)"
                    className="bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={templateDesc}
                    onChange={(e) => setTemplateDesc(e.target.value)}
                    placeholder="Mô tả ngắn..."
                    className="bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={drills.filter((d) => d.date === selectedDate).length === 0}
                  className="px-4 py-2 rounded-lg bg-[#FF4655] hover:bg-[#e53c4a] disabled:opacity-40 text-xs font-semibold text-white"
                >
                  Lưu thành Template
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
