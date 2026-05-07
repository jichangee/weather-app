# Daily Weather Trend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 7-day weather list with a compact SVG trend chart that shows high temperatures above, low temperatures below, and weather icons between them.

**Architecture:** Keep the change inside `app/page.tsx`, matching the existing single-file component pattern. Add a `DailyTrendChart` component beside `TempLineChart`; it consumes existing `DailyItem[]` and has no data-fetching responsibility.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS utility classes, QWeather icon font classes.

---

### Task 1: Add Daily Trend Chart Component

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add `DailyTrendChart` after `TempLineChart`**

```tsx
function DailyTrendChart({ daily }: { daily: DailyItem[] }) {
  const data = daily.slice(0, 7);
  if (data.length < 2) return null;

  const highs = data.map((d) => Number(d.tempMax));
  const lows = data.map((d) => Number(d.tempMin));
  const allTemps = [...highs, ...lows];
  const minT = Math.min(...allTemps) - 1;
  const maxT = Math.max(...allTemps) + 1;
  const range = Math.max(1, maxT - minT);

  const W = 420, H = 190;
  const pL = 24, pR = 24;
  const topY = 64, bottomY = 146;
  const chartH = bottomY - topY;
  const cW = W - pL - pR;

  const px = (i: number) => pL + (i / (data.length - 1)) * cW;
  const py = (t: number) => topY + (1 - (t - minT) / range) * chartH;
  const highPts = highs.map((t, i) => [px(i), py(t)] as [number, number]);
  const lowPts = lows.map((t, i) => [px(i), py(t)] as [number, number]);

  const pathFrom = (pts: Array<[number, number]>) =>
    pts
      .map(([x, y], i) => {
        if (i === 0) return `M${x.toFixed(1)},${y.toFixed(1)}`;
        const [px0, py0] = pts[i - 1];
        const cx = ((px0 + x) / 2).toFixed(1);
        return `C${cx},${py0.toFixed(1)} ${cx},${y.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <div className="overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: "block" }}>
        <path d={pathFrom(highPts)} fill="none" stroke="rgba(255,205,120,0.9)" strokeWidth="2" strokeLinecap="round" />
        <path d={pathFrom(lowPts)} fill="none" stroke="rgba(120,180,255,0.82)" strokeWidth="2" strokeLinecap="round" />
        {data.map((d, i) => {
          const x = px(i);
          const anchor = i === 0 ? "start" : i === data.length - 1 ? "end" : "middle";
          return (
            <g key={d.fxDate}>
              <text x={x} y="16" textAnchor={anchor} fontSize="11" fill="rgba(255,255,255,0.45)" fontWeight="600">
                {getDayLabel(d.fxDate, i)}
              </text>
              <circle cx={highPts[i][0]} cy={highPts[i][1]} r="3" fill="rgba(255,220,150,0.95)" />
              <text x={x} y={highPts[i][1] - 9} textAnchor={anchor} fontSize="13" fill="rgba(255,235,190,0.9)" fontWeight="600">
                {d.tempMax}°
              </text>
              <foreignObject x={x - 12} y="86" width="24" height="24">
                <div className="flex h-6 w-6 items-center justify-center text-[22px] text-white/75">
                  <WeatherIcon icon={d.iconDay} />
                </div>
              </foreignObject>
              <circle cx={lowPts[i][0]} cy={lowPts[i][1]} r="3" fill="rgba(160,205,255,0.95)" />
              <text x={x} y={lowPts[i][1] + 18} textAnchor={anchor} fontSize="13" fill="rgba(205,230,255,0.82)" fontWeight="600">
                {d.tempMin}°
              </text>
              <text x={x} y="184" textAnchor={anchor} fontSize="10" fill="rgba(255,255,255,0.34)">
                {d.textDay}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Replace the 7-day list with the chart**

```tsx
{/* Daily forecast */}
{weatherDaily && (
  <div className="glass-card px-4 pt-4 pb-3 animate-fadein-slow">
    <p className="card-label">7 天天气</p>
    <DailyTrendChart daily={weatherDaily.daily} />
  </div>
)}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build completes successfully with no TypeScript errors.

- [ ] **Step 4: Commit implementation**

```bash
git add app/page.tsx docs/superpowers/plans/2026-05-07-daily-weather-trend.md
git commit -m "feat: show daily weather as trend chart"
```
