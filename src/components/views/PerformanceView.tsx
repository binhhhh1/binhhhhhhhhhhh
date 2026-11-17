import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import type { AimLog, Scrim, TrainingDrill } from '../../types/training';
import {
  computePerformanceReport,
  generatePerformanceCsv,
  type ReportPeriod,
} from '../../utils/analytics';
import { formatFullVNDate, getVNDateKey } from '../../utils/timezone';
import { AreaLineChart, BarComparisonChart } from '../charts/TrainingCharts';

interface PerformanceViewProps {
  drills: TrainingDrill[];
  aimLogs: AimLog[];
  scrims: Scrim[];
}

export function PerformanceView({ drills, aimLogs, scrims }: PerformanceViewProps) {
  const todayDate = getVNDateKey();
  const [period, setPeriod] = useState<ReportPeriod>('weekly');
  const [anchorDate, setAnchorDate] = useState<string>(todayDate);
  const [exportStatus, setExportStatus] = useState<string>('');

  const report = useMemo(
    () =>
      computePerformanceReport({
        period,
        drills,
        aimLogs,
        scrims,
        anchorDate,
      }),
    [period, drills, aimLogs, scrims, anchorDate],
  );

  const handleExportCsv = () => {
    const csv = generatePerformanceCsv(report);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `valorant-training-${period}-${anchorDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportStatus(`Đã xuất báo cáo CSV (${link.download})`);
    window.setTimeout(() => setExportStatus(''), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Period Switcher + CSV Export */}
      <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#090B10] border border-white/10 rounded-lg">
            {(
              [
                { id: 'daily', label: 'Theo Ngày' },
                { id: 'weekly', label: 'Theo Tuần' },
                { id: 'monthly', label: 'Theo Tháng' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  period === p.id ? 'bg-[#FF4655] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="perf-anchor-date" className="sr-only">
              Ngày mốc thống kê
            </label>
            <input
              id="perf-anchor-date"
              type="date"
              value={anchorDate}
              onChange={(e) => setAnchorDate(e.target.value)}
              className="bg-[#090B10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono"
            />
          </div>

          <span className="text-xs text-slate-300 font-medium">{report.periodLabel}</span>
        </div>

        <div className="flex items-center gap-3">
          {exportStatus && (
            <span className="text-xs text-emerald-400">{exportStatus}</span>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất báo cáo CSV</span>
          </button>
        </div>
      </div>

      {/* 7 Performance KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
          <div className="text-[11px] text-slate-400">Tổng giờ tập</div>
          <div className="mt-1 font-display text-xl font-bold text-white font-mono tabular-nums">
            {report.totalTrainingHours}h
          </div>
        </div>
        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
          <div className="text-[11px] text-slate-400">Bài tập hoàn thành</div>
          <div className="mt-1 font-display text-xl font-bold text-emerald-400 font-mono tabular-nums">
            {report.completedDrills}/{report.totalDrills}
          </div>
        </div>
        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
          <div className="text-[11px] text-slate-400">Tỷ lệ hoàn thành</div>
          <div className="mt-1 font-display text-xl font-bold text-sky-400 font-mono tabular-nums">
            {report.completionRate}%
          </div>
        </div>
        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
          <div className="text-[11px] text-slate-400">Giờ Aim Training</div>
          <div className="mt-1 font-display text-xl font-bold text-violet-400 font-mono tabular-nums">
            {report.aimTrainingHours}h
          </div>
        </div>
        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
          <div className="text-[11px] text-slate-400">Trận Deathmatch</div>
          <div className="mt-1 font-display text-xl font-bold text-white font-mono tabular-nums">
            {report.deathmatchCount}
          </div>
        </div>
        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
          <div className="text-[11px] text-slate-400">Số buổi Scrim</div>
          <div className="mt-1 font-display text-xl font-bold text-[#FF4655] font-mono tabular-nums">
            {report.scrimCount}
          </div>
        </div>
        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-4">
          <div className="text-[11px] text-slate-400">Buổi VOD Review</div>
          <div className="mt-1 font-display text-xl font-bold text-white font-mono tabular-nums">
            {report.vodReviewCount}
          </div>
        </div>
      </div>

      {/* 3 Charts + Scrim History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-5">
          <h2 className="font-display font-semibold text-sm text-white mb-3">
            Training Hours (Giờ)
          </h2>
          <BarComparisonChart
            data={report.trainingHoursSeries}
            color="#38BDF8"
            unit="h"
            height={170}
          />
        </div>

        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-5">
          <h2 className="font-display font-semibold text-sm text-white mb-3">
            Aim Score Progress
          </h2>
          <AreaLineChart
            data={report.aimProgressSeries.filter((p) => p.value > 0)}
            color="#8B5CF6"
            height={170}
            emptyLabel="Chưa có dữ liệu Aim trong giai đoạn này"
          />
        </div>

        <div className="bg-[#121621] border border-white/[0.07] rounded-xl p-5">
          <h2 className="font-display font-semibold text-sm text-white mb-3">
            Training Completion Rate (%)
          </h2>
          <BarComparisonChart
            data={report.completionRateSeries}
            color="#10B981"
            unit="%"
            height={170}
          />
        </div>
      </div>

      {/* Progress Evaluation Table & Scrim History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-[#121621] border border-white/[0.07] rounded-xl p-5">
          <h3 className="font-display font-semibold text-base text-white mb-3">
            Bảng tổng hợp tiến độ thực tế
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-slate-400">
                  <th className="py-2 pr-3 font-medium">Mốc thời gian</th>
                  <th className="py-2 pr-3 text-right font-medium">Hoàn thành</th>
                  <th className="py-2 pr-3 text-right font-medium">Tỷ lệ</th>
                  <th className="py-2 pr-3 text-right font-medium">Giờ tập</th>
                  <th className="py-2 pr-3 text-right font-medium">Aim TB</th>
                  <th className="py-2 text-right font-medium">Scrim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {report.evaluationRows.map((row) => (
                  <tr key={row.label} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-3 font-mono text-slate-200">{row.label}</td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-slate-300">
                      {row.drillsCompleted}/{row.drillsTotal}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-emerald-400">
                      {row.completionRate}%
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-sky-400">
                      {row.trainingHours}h
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-violet-300">
                      {row.avgAimScore !== null
                        ? row.avgAimScore.toLocaleString('vi-VN')
                        : '--'}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-white">
                      {row.scrimCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#121621] border border-white/[0.07] rounded-xl p-5">
          <h3 className="font-display font-semibold text-base text-white mb-3">
            Scrim History ({report.scrimHistory.length})
          </h3>
          {report.scrimHistory.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              Không có buổi Scrim nào trong giai đoạn đã chọn.
            </p>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {report.scrimHistory.map((s) => (
                <div key={s.id} className="py-2.5 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">vs {s.opponent}</span>
                    <span className="font-mono tabular-nums text-slate-400">
                      {formatFullVNDate(s.date)}
                    </span>
                  </div>
                  <div className="text-slate-400">
                    {s.maps.join(' / ')} · {s.server} · {s.status}
                  </div>
                  {s.mapResultsText && (
                    <div className="font-mono text-emerald-400">{s.mapResultsText}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
