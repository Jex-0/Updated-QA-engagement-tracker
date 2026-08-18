import { Fragment, useMemo, useState } from "react";
import { fmtDate, fmtDuration, rollingAverage } from "../lib/format";
import { DAY_MS } from "../lib/records";

/* ------------------------------ LineChart ----------------------------- */

interface LineChartProps {
  data: number[];
  labels?: string[];
  height?: number;
  showRolling?: boolean;
  yMax?: number;
}

export function LineChart({ data, labels, height = 220, showRolling = true, yMax = 100 }: LineChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = height;
  const PAD = { top: 18, right: 16, bottom: 30, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const { points, areaPath, linePath, rollingPath, xLabels } = useMemo(() => {
    const roll = rollingAverage(data, 7);
    const n = data.length;
    const xOf = (i: number) => (n <= 1 ? PAD.left + chartW / 2 : PAD.left + (i / (n - 1)) * chartW);
    const yOf = (v: number) => PAD.top + chartH - (Math.max(0, Math.min(yMax, v)) / yMax) * chartH;
    const pts = data.map((v, i) => ({ x: xOf(i), y: yOf(v) }));
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area = `${line} L${pts[pts.length - 1]?.x ?? PAD.left},${PAD.top + chartH} L${pts[0]?.x ?? PAD.left},${PAD.top + chartH} Z`;
    const rollPts = roll.map((v, i) => ({ x: xOf(i), y: yOf(v) }));
    const rollLine = rollPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const step = Math.max(1, Math.ceil(n / 8));
    const xLabels = (labels ?? []).filter((_, i) => i % step === 0 || i === n - 1);
    return { points: pts, areaPath: area, linePath: line, rollingPath: rollLine, xLabels };
  }, [data, labels, yMax, chartW, chartH]);

  if (data.length === 0) {
    return <div className="chart-empty-inline">No data for the selected period.</div>;
  }

  const nearest = (clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left;
    const scale = rect.width / W;
    let best = 0;
    let bestD = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x * scale - x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };

  return (
    <div className="line-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Engagement score trend"
        onMouseMove={(e) => setHover(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((g) => {
          const y = PAD.top + chartH - (g / yMax) * chartH;
          return (
            <g key={g}>
              <line x1={PAD.left} x2={PAD.left + chartW} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth="1" strokeDasharray={g === 0 ? "0" : "4 4"} />
              <text x={PAD.left - 6} y={y + 3.5} textAnchor="end" fontSize="10" fill="var(--text-muted)">
                {g}
              </text>
            </g>
          );
        })}
        <path d={areaPath} fill="url(#areaGrad)" />
        {showRolling && data.length >= 7 && <path d={rollingPath} fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="6 4" />}
        <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={hover === i ? 6 : 4} fill={hover === i ? "var(--accent)" : "var(--surface)"} stroke="var(--primary)" strokeWidth="2.5" />
        ))}
        {hover != null && points[hover] ? (
          <g>
            <line x1={points[hover].x} x2={points[hover].x} y1={PAD.top} y2={PAD.top + chartH} stroke="var(--primary)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <text x={points[hover].x} y={points[hover].y - 10} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text)">
              {data[hover]}%
            </text>
          </g>
        ) : null}
        {xLabels.map((lbl, i) => {
          const idx = (labels ?? []).indexOf(lbl);
          return (
            <text key={i} x={points[idx]?.x ?? PAD.left} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
              {lbl}
            </text>
          );
        })}
      </svg>
      <div className="chart-legend-row">
        <span><i className="legend-swatch" style={{ background: "var(--primary)" }} /> Score</span>
        {showRolling && data.length >= 7 ? (
          <span><i className="legend-swatch dash" style={{ borderColor: "var(--accent)" }} /> 7-call average</span>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------ Sparkline ----------------------------- */

export function Sparkline({ data, width = 110, height = 34 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return <span className="sparkline-empty">—</span>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 4) + 2;
    const y = height - 3 - ((v - min) / span) * (height - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={pts.join(" ")} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* -------------------------------- Heatmap ----------------------------- */

export interface HeatmapCell {
  label: string;
  values: (number | null)[];
}

export function Heatmap({ rows, columns }: { rows: HeatmapCell[]; columns: string[] }) {
  const cell = (v: number | null): string => {
    if (v == null) return "var(--surface-2)";
    if (v >= 80) return "var(--heat-high)";
    if (v >= 50) return "var(--heat-mid)";
    return "var(--heat-low)";
  };
  return (
    <div className="heatmap">
      <div className="heatmap-grid" style={{ gridTemplateColumns: `minmax(110px, 1.4fr) repeat(${columns.length}, 1fr)` }}>
        <div />
        {columns.map((c) => (
          <div key={c} className="heatmap-col-label" title={c}>
            {c}
          </div>
        ))}
        {rows.map((row) => (
          <Fragment key={row.label}>
            <div className="heatmap-row-label" title={row.label}>
              {row.label}
            </div>
            {row.values.map((v, i) => (
              <div
                key={i}
                className="heatmap-cell"
                style={{ background: cell(v) }}
                title={v == null ? `${row.label} · no engagement` : `${row.label} · ${columns[i] ?? i} — ${v}%`}
              />
            ))}
          </Fragment>
        ))}
      </div>
      <div className="heatmap-legend">
        <span>Low</span>
        <i style={{ background: "var(--heat-low)" }} />
        <i style={{ background: "var(--heat-mid)" }} />
        <i style={{ background: "var(--heat-high)" }} />
        <span>High</span>
        <span className="heatmap-note">Hover a cell for the score</span>
      </div>
    </div>
  );
}



/* ------------------------------- Bars --------------------------------- */

export function Bars({ items, max }: { items: { label: string; value: number; sub?: string }[]; max?: number }) {
  const cap = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="bars">
      {items.map((it) => (
        <div key={it.label} className="bar-row">
          <span className="bar-label" title={it.label}>
            {it.label}
          </span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.max(2, (it.value / cap) * 100)}%` }} />
          </div>
          <span className="bar-value">
            {it.value}
            {it.sub ? <small>{it.sub}</small> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

/* --------------------------- Trend indicator -------------------------- */

export function TrendBadge({ current, previous, suffix = "%" }: { current: number; previous: number; suffix?: string }) {
  const diff = current - previous;
  if (previous === 0 && current === 0) return <span className="trend flat">—</span>;
  const cls = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "●";
  return (
    <span className={`trend ${cls}`} title={`Previous period: ${previous}${suffix}`}>
      {arrow} {Math.abs(diff)}
      {suffix}
    </span>
  );
}

/* ------------------------------ Sparkline label helper ------------------ */

export function dayLabels(days: number, endTs: number): string[] {
  return Array.from({ length: days }, (_, i) => fmtDate(endTs - (days - 1 - i) * DAY_MS).slice(0, 6));
}

export function durationLabel(sec: number): string {
  return fmtDuration(sec);
}
