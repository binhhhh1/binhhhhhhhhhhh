import React, { useState } from 'react';

export interface ChartPoint {
  label: string;
  value: number;
  sublabel?: string;
}

export function AreaLineChart({
  data,
  color = '#38BDF8',
  unit = '',
  height = 170,
  emptyLabel = 'Chưa có dữ liệu biểu đồ',
}: {
  data: ChartPoint[];
  color?: string;
  unit?: string;
  height?: number;
  emptyLabel?: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-slate-400 border border-dashed border-white/10 rounded-lg"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  const width = 480;
  const padL = 36;
  const padR = 16;
  const padT = 16;
  const padB = 26;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const span = maxVal - minVal || Math.max(1, maxVal * 0.2);
  const yMin = Math.max(0, minVal - span * 0.15);
  const yMax = maxVal + span * 0.15;

  const points = data.map((d, i) => {
    const x = data.length === 1 ? padL + innerW / 2 : padL + (i / (data.length - 1)) * innerW;
    const y = padT + innerH - ((d.value - yMin) / (yMax - yMin || 1)) * innerH;
    return { x, y, ...d };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`
      : '';

  const gradId = `areaGrad_${color.replace(/[^a-zA-Z0-9]/g, '')}`;
  const gridTicks = [0, 0.5, 1];

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible"
        role="img"
        aria-label="Biểu đồ xu hướng"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {gridTicks.map((ratio) => {
          const y = padT + innerH * (1 - ratio);
          const tickVal = Math.round(yMin + (yMax - yMin) * ratio);
          return (
            <g key={ratio}>
              <line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="3 3"
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-500 text-[10px] font-mono tabular-nums"
              >
                {tickVal >= 1000 ? `${(tickVal / 1000).toFixed(0)}k` : tickVal}
              </text>
            </g>
          );
        })}

        {points.length > 1 && <path d={areaPath} fill={`url(#${gradId})`} />}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p, i) => {
          const isHovered = hoveredIdx === i;
          return (
            <g
              key={`${p.label}-${i}`}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <circle cx={p.x} cy={p.y} r={12} fill="transparent" />
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? 5 : 3.2}
                fill={isHovered ? '#FFFFFF' : color}
                stroke={color}
                strokeWidth="2"
              />
              {(data.length <= 8 || i % 2 === 0 || i === data.length - 1) && (
                <text
                  x={p.x}
                  y={height - 6}
                  textAnchor="middle"
                  className="fill-slate-400 text-[10px] font-mono tabular-nums"
                >
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hoveredIdx !== null && points[hoveredIdx] && (
        <div
          className="pointer-events-none absolute top-1 right-2 bg-[#0D1017] border border-white/15 rounded-md px-2.5 py-1.5 text-xs text-slate-200 shadow-lg"
        >
          <span className="text-slate-400">{points[hoveredIdx].label}</span>
          <span className="mx-1.5 text-slate-600">·</span>
          <span className="font-mono font-semibold tabular-nums text-white">
            {points[hoveredIdx].value.toLocaleString('vi-VN')}
            {unit}
          </span>
        </div>
      )}
    </div>
  );
}

export function BarComparisonChart({
  data,
  color = '#8B5CF6',
  unit = '',
  height = 170,
  emptyLabel = 'Chưa có dữ liệu',
}: {
  data: ChartPoint[];
  color?: string;
  unit?: string;
  height?: number;
  emptyLabel?: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-slate-400 border border-dashed border-white/10 rounded-lg"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  const width = 480;
  const padL = 34;
  const padR = 12;
  const padT = 14;
  const padB = 26;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const maxVal = Math.max(1, ...data.map((d) => d.value));

  const slotW = innerW / data.length;
  const barW = Math.min(34, Math.max(12, slotW * 0.56));

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible"
        role="img"
        aria-label="Biểu đồ cột"
      >
        {[0, 0.5, 1].map((r) => {
          const y = padT + innerH * (1 - r);
          const v = Math.round(maxVal * r * 10) / 10;
          return (
            <g key={r}>
              <line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="3 3"
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-500 text-[10px] font-mono tabular-nums"
              >
                {v}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const barH = (d.value / maxVal) * innerH;
          const x = padL + i * slotW + (slotW - barW) / 2;
          const y = padT + innerH - barH;
          const isHovered = hoveredIdx === i;

          return (
            <g
              key={`${d.label}-${i}`}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <rect
                x={x}
                y={Math.max(padT, y)}
                width={barW}
                height={Math.max(2, barH)}
                rx={4}
                fill={color}
                fillOpacity={isHovered ? 1 : 0.78}
              />
              <text
                x={x + barW / 2}
                y={height - 6}
                textAnchor="middle"
                className="fill-slate-400 text-[10px] font-mono tabular-nums"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hoveredIdx !== null && data[hoveredIdx] && (
        <div className="pointer-events-none absolute top-1 right-2 bg-[#0D1017] border border-white/15 rounded-md px-2.5 py-1.5 text-xs text-slate-200 shadow-lg">
          <span className="text-slate-400">{data[hoveredIdx].label}</span>
          <span className="mx-1.5 text-slate-600">·</span>
          <span className="font-mono font-semibold tabular-nums text-white">
            {data[hoveredIdx].value}
            {unit}
          </span>
        </div>
      )}
    </div>
  );
}
