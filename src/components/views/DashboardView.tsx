import React from 'react';
import {
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Crosshair,
  Flame,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
  Trophy,
} from 'lucide-react';
import type {
  AiDailyPlan,
  AimLog,
  AvailabilitySlot,
  DataSourceMode,
  NavSection,
  Scrim,
  TeamWorkspace,
  TrainingDrill,
} from '../../types/training';
import {
  computeAimAnalytics,
  computeDashboardMetrics,
  computePerformanceReport,
} from '../../utils/analytics';
import {
  formatShortVNDate,
  getMonthCalendarCells,
  getShortWeekdayVN,
  getVNDateKey,
  getVNTimeStr,
  timeToMinutes,
} from '../../utils/timezone';
import { AreaLineChart, BarComparisonChart } from '../charts/TrainingCharts';

interface DashboardViewProps {
  team: TeamWorkspace;
  dataMode: DataSourceMode;
  drills: TrainingDrill[];
  aimLogs: AimLog[];
  scrims: Scrim[];
  availabilities: AvailabilitySlot[];
  activeOwnerId?: string;
  aiPlan?: AiDailyPlan | null;
  aiLoading?: boolean;
  onOpenAuthModal?: () => void;
  onNavigate: (section: NavSection, dailyTab?: 'drills' | 'aim') => void;
  onToggleDrillComplete: (drill: TrainingDrill) => void;
  onResetDemo?: () => void;
  onClearDemo?: () => void;
}

const STATUS_LABELS: Record<TrainingDrill['status'], string> = {
  todo: 'Chưa thực hiện',
  in_progress: 'Đang thực hiện',
  completed: 'Hoàn thành',
  skipped: 'Bỏ qua',
};

const SCRIM_STATUS_LABELS: Record<Scrim['status'], string> = {
  planned: 'Dự kiến',
  confirmed: 'Đã xác nhận',
  live: 'Đang diễn ra',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

export function DashboardView({
  team,
  dataMode,
  drills,
  aimLogs,
  scrims,
  availabilities,
  activeOwnerId,
  aiPlan,
  aiLoading,
  onOpenAuthModal,
  onNavigate,
  onToggleDrillComplete,
  onResetDemo,
  onClearDemo,
}: DashboardViewProps) {
  const todayDate = getVNDateKey();
  const nowMinutes = timeToMinutes(getVNTimeStr());

  const metrics = computeDashboardMetrics({
    drills,
    scrims,
    aimLogs,
    availabilities,
    weeklyGoalHours: team.weeklyGoalHours,
    todayDate,
    nowMinutes,
    activeOwnerId,
  });

  const aimSummary = computeAimAnalytics(
    activeOwnerId ? aimLogs.filter((a) => a.ownerId === activeOwnerId) : aimLogs,
    todayDate,
  );

  const weeklyReport = computePerformanceReport({
    period: 'weekly',
    drills: activeOwnerId ? drills.filter((d) => d.ownerId === activeOwnerId) : drills,
    aimLogs: activeOwnerId ? aimLogs.filter((a) => a.ownerId === activeOwnerId) : aimLogs,
    scrims,
    anchorDate: todayDate,
  });

  const todayTasks = (activeOwnerId ? drills.filter((d) => d.ownerId === activeOwnerId) : drills)
    .filter((d) => d.date === todayDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const upcomingScrims = scrims
    .filter((s) => s.status !== 'cancelled' && s.status !== 'completed' && s.date >= todayDate)
    .sort((a, b) =>
      a.date !== b.date ? a.date.localeCompare(b.date) : a.startTime.localeCompare(b.startTime),
    )
    .slice(0, 4);

  const [yearNum, monthNum] = todayDate.split('-').map(Number);
  const calendarCells = getMonthCalendarCells(yearNum, monthNum);
  const scrimDates = new Set(scrims.filter((s) => s.status !== 'cancelled').map((s) => s.date));
  const drillDates = new Set(drills.map((d) => d.date));

  const freeHoursLabel = `${Math.floor(metrics.remainingFreeMinutesToday / 60)}h ${
    metrics.remainingFreeMinutesToday % 60
  }m`;

  const todayCompletionPct =
    todayTasks.length > 0
      ? Math.round((metrics.todayCompletedDrills / todayTasks.length) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Data Source Notice Banner */}
      <div className="bg-[#121621] border border-white/[0.08] rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs text-slate-300 leading-relaxed">
          {dataMode === 'demo' ? (
            <>
              <span className="font-semibold text-amber-400">Dữ liệu Demo trải nghiệm</span>
              <span className="mx-2 text-slate-600">·</span>
              <span>
                Bạn có thể tự tạo tài khoản riêng hoặc đăng nhập ở góc phải để tách riêng lịch luyện tập của bạn.
              </span>
            </>
          ) : dataMode === 'local_account' ? (
            <>
              <span className="font-semibold text-sky-400">Tài khoản cá nhân đang hoạt động</span>
              <span className="mx-2 text-slate-600">·</span>
              <span>
                Dữ liệu luyện tập của {team.name} được lưu riêng trên trình duyệt theo múi giờ Asia/Ho_Chi_Minh.
              </span>
            </>
          ) : (
            <>
              <span className="font-semibold text-emerald-400">Cloud Firestore đang hoạt động</span>
              <span className="mx-2 text-slate-600">·</span>
              <span>
                Đang hiển thị dữ liệu thực tế của đội {team.name} ({team.tag}) theo múi giờ
                Asia/Ho_Chi_Minh.
              </span>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {dataMode === 'demo' && onOpenAuthModal && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="px-3 py-1.5 rounded-lg bg-[#FF4655]/15 hover:bg-[#FF4655]/25 border border-[#FF4655]/30 text-xs font-medium text-white transition-colors whitespace-nowrap"
            >
              Tạo tài khoản riêng
            </button>
          )}
          {dataMode === 'demo' && onResetDemo && onClearDemo && (
            <>
              <button
                type="button"
                onClick={onResetDemo}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi phục mẫu</span>
              </button>
              <button
                type="button"
                onClick={onClearDemo}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-[#FF4655]/20 text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa mẫu & Tự nhập</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* AI Daily Coach Banner */}
      <div className="bg-[#121621] border border-violet-500/25 rounded-xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-violet-500/15 text-violet-300 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white">
              AI Coach — Giáo án Tracking & Flick hôm nay
            </div>
            <div className="text-xs text-slate-400 mt-0.5 truncate">
              {aiLoading
                ? 'Đang tạo giáo án bài tập Tracking, Flicking & Micro Adjustment cho hôm nay...'
                : aiPlan && aiPlan.date === todayDate
                ? `${aiPlan.drills.length} bài tập gợi ý (${aiPlan.focusAreas.join(' · ')}) — ${aiPlan.coachNote}`
                : 'Mở Daily Training để xem và thêm các bài tập Tracking, Flick do AI đề xuất mỗi ngày.'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('daily-training')}
          className="px-3.5 py-2 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/30 text-xs font-semibold text-violet-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
        >
          <span>Xem giáo án AI</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 8 Core KPI Metrics Grid */}
      <section aria-label="Chỉ số luyện tập cốt lõi" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
          <div className="text-xs text-slate-400">Giờ tập hôm nay</div>
          <div className="mt-1.5 font-display text-2xl font-bold text-white font-mono tabular-nums">
            {metrics.todayTrainingHours}h
          </div>
          <div className="mt-1 text-xs text-slate-500">Hoàn thành & Scrim</div>
        </div>

        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
          <div className="text-xs text-slate-400">Bài tập hôm nay</div>
          <div className="mt-1.5 font-display text-2xl font-bold text-white font-mono tabular-nums">
            <span className="text-emerald-400">{metrics.todayCompletedDrills}</span>
            <span className="text-slate-600 mx-1">/</span>
            <span className="text-slate-300">
              {metrics.todayCompletedDrills + metrics.todayIncompleteDrills}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {metrics.todayIncompleteDrills} chưa hoàn thành
          </div>
        </div>

        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
          <div className="text-xs text-slate-400">Lịch Scrim tiếp theo</div>
          <div className="mt-1.5 font-display text-base font-semibold text-white truncate">
            {metrics.nextScrim ? `vs ${metrics.nextScrim.opponent}` : 'Chưa có lịch'}
          </div>
          <div className="mt-1 text-xs text-sky-400 font-mono tabular-nums">
            {metrics.nextScrim
              ? `${formatShortVNDate(metrics.nextScrim.date)} · ${metrics.nextScrim.startTime}`
              : 'Mở Scrim Schedule'}
          </div>
        </div>

        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
          <div className="text-xs text-slate-400">Thời gian trống hôm nay</div>
          <div className="mt-1.5 font-display text-2xl font-bold text-white font-mono tabular-nums">
            {freeHoursLabel}
          </div>
          <div className="mt-1 text-xs text-slate-500">Tính đến 23:30 ICT</div>
        </div>

        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-[#FF4655]" />
            <span>Streak liên tục</span>
          </div>
          <div className="mt-1.5 font-display text-2xl font-bold text-white font-mono tabular-nums">
            {metrics.streakDays} ngày
          </div>
          <div className="mt-1 text-xs text-slate-500">Duy trì mỗi ngày</div>
        </div>

        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
          <div className="text-xs text-slate-400">Tổng giờ tập tuần</div>
          <div className="mt-1.5 font-display text-2xl font-bold text-white font-mono tabular-nums">
            {metrics.weeklyTrainingHours}h
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Mục tiêu {team.weeklyGoalHours}h/tuần
          </div>
        </div>

        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
          <div className="text-xs text-slate-400">Hoàn thành mục tiêu tuần</div>
          <div className="mt-1.5 font-display text-2xl font-bold text-sky-400 font-mono tabular-nums">
            {metrics.weeklyGoalPct}%
          </div>
          <div className="mt-2 h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-400 rounded-full transition-all"
              style={{ width: `${metrics.weeklyGoalPct}%` }}
            />
          </div>
        </div>

        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-violet-400" />
            <span>Aim Personal Best</span>
          </div>
          <div className="mt-1.5 font-display text-2xl font-bold text-white font-mono tabular-nums">
            {metrics.personalBestScore !== null
              ? metrics.personalBestScore.toLocaleString('vi-VN')
              : '--'}
          </div>
          <div className="mt-1 text-xs text-slate-500">Kỷ lục cá nhân cao nhất</div>
        </div>
      </section>

      {/* 6 Interactive Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Widget 1: Today's Training Progress */}
        <div className="lg:col-span-5 bg-[#121621] border border-white/[0.07] hover:border-white/15 rounded-xl p-5 flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display font-semibold text-base text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-[#FF4655]" />
                <span>Today&apos;s Training Progress</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('daily-training')}
                className="text-xs font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1 whitespace-nowrap"
              >
                <span>Mở Daily Training</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-5 flex items-end justify-between">
              <div>
                <div className="text-3xl font-display font-bold text-white font-mono tabular-nums">
                  {todayCompletionPct}%
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {metrics.todayCompletedDrills} xong · {metrics.todayIncompleteDrills} còn lại
                </div>
              </div>
              <div className="text-right font-mono tabular-nums text-xs text-slate-300">
                <div>{metrics.todayTrainingHours}h đã tập</div>
                <div className="text-slate-500">{freeHoursLabel} trống</div>
              </div>
            </div>

            <div className="mt-3 h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#FF4655] rounded-full transition-all"
                style={{ width: `${todayCompletionPct}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('daily-training')}
            className="mt-5 w-full py-2.5 px-4 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-slate-200 transition-colors text-center"
          >
            Quản lý lịch tập hôm nay
          </button>
        </div>

        {/* Widget 2: Upcoming Scrims */}
        <div className="lg:col-span-7 bg-[#121621] border border-white/[0.07] hover:border-white/15 rounded-xl p-5 flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display font-semibold text-base text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-400" />
                <span>Upcoming Scrims</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('scrim-schedule')}
                className="text-xs font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1 whitespace-nowrap"
              >
                <span>Mở Scrim Schedule</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-4 divide-y divide-white/[0.06]">
              {upcomingScrims.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Chưa có lịch Scrim sắp tới. Nhấn &ldquo;Mở Scrim Schedule&rdquo; để tạo lịch mới.
                </div>
              ) : (
                upcomingScrims.map((scrim) => (
                  <button
                    key={scrim.id}
                    type="button"
                    onClick={() => onNavigate('scrim-schedule')}
                    className="w-full py-2.5 flex items-center justify-between gap-3 text-left hover:bg-white/[0.02] px-2 -mx-2 rounded-lg transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        vs {scrim.opponent}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {scrim.maps.join(' / ')} · {scrim.server}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono tabular-nums text-slate-200">
                        {formatShortVNDate(scrim.date)} · {scrim.startTime}–{scrim.endTime}
                      </div>
                      <div
                        className={`text-[11px] font-medium mt-0.5 ${
                          scrim.status === 'confirmed'
                            ? 'text-emerald-400'
                            : scrim.status === 'live'
                            ? 'text-[#FF4655]'
                            : 'text-amber-400'
                        }`}
                      >
                        {SCRIM_STATUS_LABELS[scrim.status]}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Widget 3: Daily Aim Score */}
        <div className="lg:col-span-6 bg-[#121621] border border-white/[0.07] hover:border-white/15 rounded-xl p-5 transition-colors">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display font-semibold text-base text-white flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-violet-400" />
                <span>Daily Aim Score</span>
              </h2>
              <div className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
                {metrics.dailyAimScore !== null
                  ? `Điểm gần nhất: ${metrics.dailyAimScore.toLocaleString('vi-VN')}`
                  : 'Chưa ghi nhận điểm Aim'}
                {metrics.dailyAimDeltaPct !== null && (
                  <span
                    className={`ml-2 ${
                      metrics.dailyAimDeltaPct >= 0 ? 'text-emerald-400' : 'text-[#FF4655]'
                    }`}
                  >
                    ({metrics.dailyAimDeltaPct >= 0 ? '+' : ''}
                    {metrics.dailyAimDeltaPct}%)
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('daily-training', 'aim')}
              className="text-xs font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1 whitespace-nowrap"
            >
              <span>Mở trong Daily Training</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <AreaLineChart
            data={aimSummary.dailyScoreSeries}
            color="#8B5CF6"
            height={165}
            emptyLabel="Nhập kết quả Aim đầu tiên để xem biểu đồ"
          />
        </div>

        {/* Widget 4: Weekly Performance */}
        <div className="lg:col-span-6 bg-[#121621] border border-white/[0.07] hover:border-white/15 rounded-xl p-5 transition-colors">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display font-semibold text-base text-white">
                Weekly Performance
              </h2>
              <div className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
                {weeklyReport.totalTrainingHours}h tổng tuần · {weeklyReport.completionRate}% hoàn
                thành
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('performance')}
              className="text-xs font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1 whitespace-nowrap"
            >
              <span>Xem báo cáo</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <BarComparisonChart
            data={weeklyReport.trainingHoursSeries}
            color="#38BDF8"
            unit="h"
            height={165}
          />
        </div>

        {/* Widget 5: Training Calendar */}
        <div className="lg:col-span-5 bg-[#121621] border border-white/[0.07] hover:border-white/15 rounded-xl p-5 transition-colors">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-display font-semibold text-base text-white">
              Training Calendar
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('availability')}
              className="text-xs font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1 whitespace-nowrap"
            >
              <span>Mở Lịch trống</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-xs text-slate-400 mb-2 font-mono tabular-nums">
            Tháng {String(monthNum).padStart(2, '0')}/{yearNum} ·{' '}
            <span className="text-[#FF4655]">Scrim</span> /{' '}
            <span className="text-sky-400">Bài tập</span>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500 mb-1">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell) => {
              const isToday = cell.dateKey === todayDate;
              const hasScrim = scrimDates.has(cell.dateKey);
              const hasDrill = drillDates.has(cell.dateKey);
              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() =>
                    onNavigate(hasScrim ? 'scrim-schedule' : 'daily-training')
                  }
                  className={`h-9 rounded-md text-xs font-mono tabular-nums flex flex-col items-center justify-center transition-colors ${
                    isToday
                      ? 'bg-[#FF4655]/20 text-white border border-[#FF4655]/60 font-semibold'
                      : cell.inMonth
                      ? 'text-slate-200 hover:bg-white/[0.06] border border-transparent'
                      : 'text-slate-600 border border-transparent'
                  }`}
                >
                  <span>{cell.day}</span>
                  {(hasScrim || hasDrill) && (
                    <span className="flex gap-1 mt-0.5">
                      {hasScrim && <span className="w-1.5 h-0.5 bg-[#FF4655] rounded-full" />}
                      {hasDrill && <span className="w-1.5 h-0.5 bg-sky-400 rounded-full" />}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Widget 6: Today's Tasks */}
        <div className="lg:col-span-7 bg-[#121621] border border-white/[0.07] hover:border-white/15 rounded-xl p-5 transition-colors">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-display font-semibold text-base text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Today&apos;s Tasks ({getShortWeekdayVN(todayDate)} · {formatShortVNDate(todayDate)})</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('daily-training')}
              className="text-xs font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1 whitespace-nowrap"
            >
              <span>Tất cả bài tập</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-white/[0.06]">
            {todayTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Hôm nay chưa có bài tập nào. Nhấn &ldquo;Tất cả bài tập&rdquo; để thêm bài tập mới.
              </div>
            ) : (
              todayTasks.map((drill) => {
                const isDone = drill.status === 'completed';
                return (
                  <div
                    key={drill.id}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => onToggleDrillComplete(drill)}
                        aria-label={`Đánh dấu hoàn thành '${drill.title}'`}
                        className={`p-1 rounded-md transition-colors shrink-0 ${
                          isDone
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <div className="min-w-0">
                        <div
                          className={`text-sm font-medium truncate ${
                            isDone ? 'line-through text-slate-500' : 'text-white'
                          }`}
                        >
                          {drill.title}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {drill.category} · {STATUS_LABELS[drill.status]}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs font-mono tabular-nums text-slate-300 shrink-0">
                      {drill.startTime} · {drill.durationMin}m
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
