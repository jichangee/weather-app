"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface NowWeather {
  icon: string;
  text: string;
  temp: string;
  feelsLike: string;
  windDir: string;
  windScale: string;
  humidity: string;
  vis: string;
}

interface HourlyItem {
  fxTime: string;
  icon: string;
  temp: string;
  text: string;
}

interface DailyItem {
  fxDate: string;
  iconDay: string;
  textDay: string;
  tempMin: string;
  tempMax: string;
}

interface NowResponse {
  code: string;
  updateTime: string;
  now: NowWeather;
}

interface HourlyResponse {
  code: string;
  hourly: HourlyItem[];
}

interface DailyResponse {
  code: string;
  daily: DailyItem[];
}

interface RainResponse {
  code: string;
  updateTime: string;
  summary: string;
}

interface SunResponse {
  code: string;
  sunrise: string;
  sunset: string;
}

interface CityResponse {
  code: string;
  location: Array<{ name: string }>;
}

// ─── API ─────────────────────────────────────────────────────────────────────

const HOST = process.env.NEXT_PUBLIC_QWEATHER_HOST;
const KEY = process.env.NEXT_PUBLIC_QWEATHER_KEY;

async function fetchApi<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ key: KEY!, ...params });
  const res = await fetch(`${HOST}${path}?${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function dateCode(offset = 0): string {
  return new Date(Date.now() + offset * 86_400_000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
}

function timePart(isoStr: string): string {
  return isoStr?.slice(11, 16) ?? "";
}

function getDayLabel(dateStr: string, index: number): string {
  if (index === 0) return "今天";
  if (index === 1) return "明天";
  const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return days[new Date(dateStr).getDay()];
}

function getBgColors(): { from: string; to: string } {
  const h = new Date().getHours();
  if (h < 6 || h >= 21) return { from: "#080e18", to: "#0f1a2e" };   // 夜：深邃墨蓝
  if (h < 8)            return { from: "#16112a", to: "#2a1f45" };   // 晨曦：暗紫
  if (h < 17)           return { from: "#0c1e35", to: "#1a3558" };   // 白天：深海蓝
  return                       { from: "#14101f", to: "#261832" };   // 黄昏：暗紫蓝
}

function getWeatherScene(now?: NowWeather | null): "rain" | "sunny" | "default" {
  if (!now) return "default";
  const text = now.text ?? "";
  const icon = now.icon ?? "";
  if (/雨|雷|暴雨|阵雨|小雨|中雨|大雨/.test(text) || /^3\d{2}$/.test(icon)) return "rain";
  if (text.includes("晴") || icon === "100" || icon === "150") return "sunny";
  return "default";
}

const GEO_CACHE_KEY = "weather-geo";
const GEO_CACHE_TTL_MS = 30 * 60 * 1000;

type GeoPoint = { lat: number; lon: number };

function readCachedLocation(): GeoPoint | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as GeoPoint & { savedAt?: number };
    if (
      typeof data.lat !== "number" ||
      typeof data.lon !== "number" ||
      typeof data.savedAt !== "number"
    ) {
      return null;
    }
    if (Date.now() - data.savedAt > GEO_CACHE_TTL_MS) return null;
    if (Math.abs(data.lat) > 90 || Math.abs(data.lon) > 180) return null;
    return { lat: data.lat, lon: data.lon };
  } catch {
    return null;
  }
}

function saveCachedLocation(loc: GeoPoint): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      GEO_CACHE_KEY,
      JSON.stringify({ ...loc, savedAt: Date.now() })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

// ─── Components ───────────────────────────────────────────────────────────────

function WeatherIcon({ icon, className = "" }: { icon: string; className?: string }) {
  return <i className={`qi-${icon} ${className}`} />;
}

function TempLineChart({ hourly }: { hourly: HourlyItem[] }) {
  const data = hourly.slice(0, 24);
  if (data.length < 2) return null;

  const temps = data.map((h) => Number(h.temp));
  const minT = Math.min(...temps) - 1;
  const maxT = Math.max(...temps) + 1;
  const range = maxT - minT;

  const W = 420, H = 112;
  const pL = 14, pR = 14, pT = 28, pB = 26;
  const cW = W - pL - pR;
  const cH = H - pT - pB;

  const px = (i: number) => pL + (i / (data.length - 1)) * cW;
  const py = (t: number) => pT + (1 - (t - minT) / range) * cH;
  const pts = temps.map((t, i) => [px(i), py(t)] as [number, number]);

  const linePath = pts
    .map(([x, y], i) => {
      if (i === 0) return `M${x.toFixed(1)},${y.toFixed(1)}`;
      const [px0, py0] = pts[i - 1];
      const cx = ((px0 + x) / 2).toFixed(1);
      return `C${cx},${py0.toFixed(1)} ${cx},${y.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPath = `${linePath} L${pts[pts.length - 1][0].toFixed(1)},${H - pB} L${pL},${H - pB}Z`;

  // Evenly spread 6 labeled points
  const step = Math.floor((data.length - 1) / 5);
  const labelSet = new Set(Array.from({ length: 6 }, (_, i) => Math.min(i * step, data.length - 1)));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: "block" }}>
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(120,180,255,0.28)" />
          <stop offset="100%" stopColor="rgba(120,180,255,0)" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path d={areaPath} fill="url(#tg)" />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke="rgba(150,200,255,0.85)"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Points and labels */}
      {pts.map(([x, y], i) => {
        const show = labelSet.has(i);
        const anchor = i === 0 ? "start" : i === data.length - 1 ? "end" : "middle";
        return (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r={show ? 3.5 : 2}
              fill={show ? "rgba(180,220,255,0.95)" : "rgba(150,200,255,0.4)"}
            />
            {show && (
              <>
                <text
                  x={x}
                  y={y - 9}
                  textAnchor={anchor}
                  fontSize="13"
                  fill="rgba(220,240,255,0.88)"
                  fontWeight="600"
                >
                  {temps[i]}°
                </text>
                <text
                  x={x}
                  y={H - 5}
                  textAnchor={anchor}
                  fontSize="11"
                  fill="rgba(255,255,255,0.35)"
                >
                  {timePart(data[i].fxTime)}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function DailyTrendChart({ daily }: { daily: DailyItem[] }) {
  const data = daily.slice(0, 7);
  if (data.length < 2) return null;

  const highs = data.map((d) => Number(d.tempMax));
  const lows = data.map((d) => Number(d.tempMin));
  const highMin = Math.min(...highs);
  const highMax = Math.max(...highs);
  const lowMin = Math.min(...lows);
  const lowMax = Math.max(...lows);
  const highRange = Math.max(1, highMax - highMin);
  const lowRange = Math.max(1, lowMax - lowMin);

  const W = 420, H = 232;
  const pL = 24, pR = 24;
  const cW = W - pL - pR;
  const highTop = 44, highBottom = 82;
  const lowTop = 116, lowBottom = 150;
  const iconY = 184;

  const px = (i: number) => pL + (i / (data.length - 1)) * cW;
  const highY = (t: number) => highTop + (1 - (t - highMin) / highRange) * (highBottom - highTop);
  const lowY = (t: number) => lowTop + (1 - (t - lowMin) / lowRange) * (lowBottom - lowTop);
  const highPts = highs.map((t, i) => [px(i), highY(t)] as [number, number]);
  const lowPts = lows.map((t, i) => [px(i), lowY(t)] as [number, number]);

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
        <path
          d={pathFrom(highPts)}
          fill="none"
          stroke="rgba(255,205,120,0.9)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d={pathFrom(lowPts)}
          fill="none"
          stroke="rgba(120,180,255,0.82)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {data.map((d, i) => {
          const x = px(i);
          const anchor = i === 0 ? "start" : i === data.length - 1 ? "end" : "middle";
          const weatherX = Math.min(W - 24, Math.max(24, x));
          return (
            <g key={d.fxDate}>
              <text
                x={x}
                y="16"
                textAnchor={anchor}
                fontSize="11"
                fill="rgba(255,255,255,0.45)"
                fontWeight="600"
              >
                {getDayLabel(d.fxDate, i)}
              </text>

              <circle cx={highPts[i][0]} cy={highPts[i][1]} r="3" fill="rgba(255,220,150,0.95)" />
              <text
                x={x}
                y={highPts[i][1] - 9}
                textAnchor={anchor}
                fontSize="13"
                fill="rgba(255,235,190,0.9)"
                fontWeight="600"
              >
                {d.tempMax}°
              </text>

              <circle cx={lowPts[i][0]} cy={lowPts[i][1]} r="3" fill="rgba(160,205,255,0.95)" />
              <text
                x={x}
                y={lowPts[i][1] + 18}
                textAnchor={anchor}
                fontSize="13"
                fill="rgba(205,230,255,0.82)"
                fontWeight="600"
              >
                {d.tempMin}°
              </text>

              <foreignObject x={weatherX - 13} y={iconY} width="26" height="26">
                <div className="flex h-[26px] w-[26px] items-center justify-center text-[23px] text-white/75">
                  <WeatherIcon icon={d.iconDay} />
                </div>
              </foreignObject>

              <text x={weatherX} y="228" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.34)">
                {d.textDay}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [city, setCity] = useState("");
  const [weatherNow, setWeatherNow] = useState<NowResponse | null>(null);
  const [weatherHourly, setWeatherHourly] = useState<HourlyResponse | null>(null);
  const [weatherDaily, setWeatherDaily] = useState<DailyResponse | null>(null);
  const [rain, setRain] = useState<RainResponse | null>(null);
  const [sunToday, setSunToday] = useState<SunResponse | null>(null);
  const [sunTomorrow, setSunTomorrow] = useState<SunResponse | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullOffset, setPullOffset] = useState(0);
  const [pullDragging, setPullDragging] = useState(false);

  const pullContainerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const pullOffsetRef = useRef(0);
  const ignorePullRef = useRef(false);
  const pullStateRef = useRef({
    location: null as { lat: number; lon: number } | null,
    refreshing: false,
    dataLoading: false,
  });

  const loadWeather = useCallback(
    async (loc: { lat: number; lon: number }, mode: "initial" | "refresh") => {
      const locStr = `${loc.lon},${loc.lat}`;
      setDataError(null);
      if (mode === "initial") setDataLoading(true);
      else setRefreshing(true);

      try {
        fetchApi<CityResponse>("/geo/v2/city/lookup", { location: locStr })
          .then((d) => setCity(d?.location?.[0]?.name ?? ""))
          .catch(() => setCity(""));

        const [r, now, hourly, daily, sun0, sun1] = await Promise.all([
          fetchApi<RainResponse>("/v7/minutely/5m", { location: locStr }),
          fetchApi<NowResponse>("/v7/weather/now", { location: locStr }),
          fetchApi<HourlyResponse>("/v7/weather/24h", { location: locStr }),
          fetchApi<DailyResponse>("/v7/weather/7d", { location: locStr }),
          fetchApi<SunResponse>("/v7/astronomy/sun", { location: locStr, date: dateCode(0) }),
          fetchApi<SunResponse>("/v7/astronomy/sun", { location: locStr, date: dateCode(1) }),
        ]);

        if (r?.code === "200") setRain(r);
        if (now?.code === "200") setWeatherNow(now);
        if (hourly?.code === "200") setWeatherHourly(hourly);
        if (daily?.code === "200") setWeatherDaily(daily);
        if (sun0?.code === "200") setSunToday(sun0);
        if (sun1?.code === "200") setSunTomorrow(sun1);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setDataError("数据获取失败: " + msg);
      } finally {
        setDataLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    pullStateRef.current = { location, refreshing, dataLoading };
  }, [location, refreshing, dataLoading]);

  useEffect(() => {
    const cached = readCachedLocation();
    if (cached) {
      setLocation(cached);
      setLoading(false);
      return;
    }

    if (!navigator.geolocation) {
      setGeoError("浏览器不支持定位");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const loc = { lat: coords.latitude, lon: coords.longitude };
        saveCachedLocation(loc);
        setLocation(loc);
        setLoading(false);
      },
      ({ message }) => {
        setGeoError(`定位失败: ${message}`);
        setLoading(false);
      }
    );
  }, []);

  useEffect(() => {
    if (!location) return;
    void loadWeather(location, "initial");
  }, [location, loadWeather]);

  const PULL_MAX = 96;
  const PULL_RESIST = 0.45;
  const PULL_TRIGGER = 52;

  useEffect(() => {
    const el = pullContainerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      ignorePullRef.current = window.scrollY > 4;
      touchStartY.current = e.touches[0]?.clientY ?? 0;
      setPullDragging(true);
    };

    const onTouchMove = (e: TouchEvent) => {
      const { location: loc, refreshing: ref, dataLoading: loading } = pullStateRef.current;
      if (ignorePullRef.current) return;
      if (window.scrollY > 4) {
        ignorePullRef.current = true;
        pullOffsetRef.current = 0;
        setPullOffset(0);
        return;
      }
      const dy = (e.touches[0]?.clientY ?? 0) - touchStartY.current;
      if (dy > 0 && loc && !ref && !loading) {
        e.preventDefault();
        const next = Math.min(PULL_MAX, dy * PULL_RESIST);
        pullOffsetRef.current = next;
        setPullOffset(next);
      } else if (dy <= 0) {
        pullOffsetRef.current = 0;
        setPullOffset(0);
      }
    };

    const endPull = () => {
      setPullDragging(false);
      const po = pullOffsetRef.current;
      const { location: loc, refreshing: ref, dataLoading: loading } = pullStateRef.current;
      if (!ignorePullRef.current && po > PULL_TRIGGER && loc && !ref && !loading) {
        void loadWeather(loc, "refresh");
      }
      pullOffsetRef.current = 0;
      setPullOffset(0);
      ignorePullRef.current = false;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", endPull);
    el.addEventListener("touchcancel", endPull);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", endPull);
      el.removeEventListener("touchcancel", endPull);
    };
  }, [loadWeather]);

  const hourlyTimeline = useMemo(() => {
    if (!weatherHourly?.hourly) return [];

    type TimelineItem = {
      type: "hour" | "sunrise" | "sunset";
      label: string;
      icon: string;
      temp?: string;
      text: string;
      ts: number;
    };

    const items: TimelineItem[] = weatherHourly.hourly.slice(0, 24).map((h) => ({
      type: "hour",
      label: timePart(h.fxTime),
      icon: h.icon,
      temp: h.temp,
      text: h.text,
      ts: new Date(h.fxTime).getTime(),
    }));

    if (sunToday?.sunset) {
      items.push({
        type: "sunset",
        label: timePart(sunToday.sunset),
        icon: "150",
        text: "日落",
        ts: new Date(sunToday.sunset).getTime(),
      });
    }

    if (sunTomorrow?.sunrise) {
      items.push({
        type: "sunrise",
        label: timePart(sunTomorrow.sunrise),
        icon: "100",
        text: "日出",
        ts: new Date(sunTomorrow.sunrise).getTime(),
      });
    }

    return items.sort((a, b) => a.ts - b.ts);
  }, [weatherHourly, sunToday, sunTomorrow]);

  const isRaining = rain?.summary && rain.summary !== "未来两小时无降水";
  const now = weatherNow?.now;
  const bgColors = getBgColors();
  const weatherScene = getWeatherScene(now);

  const pullTransition = pullDragging ? "none" : "transform 0.22s cubic-bezier(0.2, 0.85, 0.25, 1)";

  return (
    <div className="min-h-screen relative overflow-hidden select-none">
      {/* Soft dark background */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: `linear-gradient(to bottom, ${bgColors.from}, ${bgColors.to})`,
        }}
      />
      {weatherScene === "rain" && (
        <>
          <div className="weather-rain-sheen fixed inset-x-0 top-0 h-[42vh] -z-10 pointer-events-none" />
          <div className="weather-rain-lines fixed inset-x-0 top-0 h-[46vh] -z-10 pointer-events-none" />
        </>
      )}
      {weatherScene === "sunny" && (
        <>
          <div className="weather-sun-glow fixed inset-x-0 top-0 h-[42vh] -z-10 pointer-events-none" />
          <div className="weather-sun-rays fixed inset-x-0 top-0 h-[48vh] -z-10 pointer-events-none" />
        </>
      )}
      {/* Subtle top glow */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(100,160,255,0.06) 0%, transparent 70%)",
        }}
      />

      {(pullOffset > 10 || refreshing) && (
        <div
          className="fixed left-0 right-0 z-30 flex justify-center pointer-events-none pt-[max(10px,env(safe-area-inset-top))] text-[11px] tracking-wide text-white/45"
          style={{ opacity: refreshing ? 0.95 : Math.min(1, pullOffset / PULL_TRIGGER) }}
        >
          {refreshing ? (
            <span className="animate-pulse">正在刷新…</span>
          ) : pullOffset >= PULL_TRIGGER ? (
            <span className="text-white/55">松手刷新</span>
          ) : (
            <span>下拉刷新</span>
          )}
        </div>
      )}

      <div
        ref={pullContainerRef}
        className="min-h-screen"
        style={{
          transform: `translateY(${pullOffset}px)`,
          transition: pullTransition,
        }}
      >
      <div className="flex flex-col items-center px-4 pb-12">

        {/* Location */}
        <div className="w-full max-w-md pt-16 pb-2 text-center text-white">
          {loading ? (
            <p className="text-sm opacity-40 animate-pulse">获取位置中…</p>
          ) : geoError ? (
            <p className="text-sm text-red-400/80">{geoError}</p>
          ) : (
            <p className="text-base font-medium opacity-70 tracking-wide">
              {city ? `📍 ${city}` : ""}
            </p>
          )}
        </div>

        {/* Hero */}
        {now ? (
          <div className="w-full max-w-md text-center text-white mt-2 mb-10 animate-fadein">
            <WeatherIcon icon={now.icon} className="weather-icon-hero opacity-90" />
            <div className="temp-hero font-extralight leading-none tracking-tighter tabular-nums">
              {now.temp}°
            </div>
            <div className="text-xl font-light mt-2 opacity-75">{now.text}</div>
            <div className="text-sm opacity-40 mt-2 flex items-center justify-center gap-2">
              <span>体感 {now.feelsLike}°</span>
              <span>·</span>
              <span>{now.windDir} {now.windScale}级</span>
            </div>
            {isRaining && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm"
                style={{ background: "rgba(100,160,255,0.15)", border: "1px solid rgba(100,160,255,0.25)" }}>
                <span>🌧</span>
                <span className="opacity-80">{rain?.summary}</span>
              </div>
            )}
          </div>
        ) : dataLoading ? (
          <div className="w-full max-w-md text-center text-white/30 text-sm mt-8 mb-10 animate-pulse">
            天气数据加载中…
          </div>
        ) : null}

        {dataError && (
          <div className="glass-card w-full max-w-md p-4 text-center text-white/50 text-sm mb-4">
            {dataError}
          </div>
        )}

        <div className="w-full max-w-md flex flex-col gap-3">

          {/* Temperature trend chart */}
          {weatherHourly && (
            <div className="glass-card px-4 pt-4 pb-3 animate-fadein-slow">
              <p className="card-label">气温趋势</p>
              <TempLineChart hourly={weatherHourly.hourly} />
            </div>
          )}

          {/* Daily forecast */}
          {weatherDaily && (
            <div className="glass-card px-4 pt-4 pb-3 animate-fadein-slow">
              <p className="card-label">7 天天气</p>
              <DailyTrendChart daily={weatherDaily.daily} />
            </div>
          )}

          {/* Sun & Details grid */}
          {(sunToday || now) && (
            <div className="grid grid-cols-2 gap-3">
              {sunToday && (
                <div className="glass-card p-4 animate-fadein-slow">
                  <p className="card-label">日出 · 日落</p>
                  <div className="flex justify-around mt-1">
                    <div className="text-center">
                      <WeatherIcon icon="100" className="text-2xl text-amber-400/70" />
                      <p className="text-[11px] text-white/35 mt-1.5">日出</p>
                      <p className="text-sm font-semibold text-white/80 tabular-nums">{timePart(sunToday.sunrise)}</p>
                    </div>
                    <div className="w-px self-stretch mx-1" style={{ background: "rgba(255,255,255,0.1)" }} />
                    <div className="text-center">
                      <WeatherIcon icon="150" className="text-2xl text-orange-400/70" />
                      <p className="text-[11px] text-white/35 mt-1.5">日落</p>
                      <p className="text-sm font-semibold text-white/80 tabular-nums">{timePart(sunToday.sunset)}</p>
                    </div>
                  </div>
                </div>
              )}

              {now && (
                <div className="glass-card p-4 animate-fadein-slow">
                  <p className="card-label">湿度 · 能见度</p>
                  <div className="flex justify-around mt-1">
                    <div className="text-center">
                      <p className="text-xl font-semibold text-white/80 tabular-nums">
                        {now.humidity}<span className="text-sm font-normal">%</span>
                      </p>
                      <p className="text-[11px] text-white/35 mt-1.5">湿度</p>
                    </div>
                    <div className="w-px self-stretch mx-1" style={{ background: "rgba(255,255,255,0.1)" }} />
                    <div className="text-center">
                      <p className="text-xl font-semibold text-white/80 tabular-nums">{now.vis}</p>
                      <p className="text-[11px] text-white/35 mt-1.5">能见度 km</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="text-[11px] text-white/20 mt-8 tracking-wide">
          数据来源：和风天气 QWeather
        </footer>
      </div>
      </div>

      <style>{`
        .animate-fadein      { animation: fadein 0.7s ease-out both; }
        .animate-fadein-slow { animation: fadein 1.1s ease-out both; }
        @keyframes fadein {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: none; }
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.07);
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.11);
        }
        .card-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.35);
          margin-bottom: 12px;
        }
        .weather-icon-hero { font-size: 68px; display: block; }
        .temp-hero { font-size: clamp(80px, 22vw, 100px); }
        .weather-rain-sheen {
          background:
            radial-gradient(ellipse 80% 52% at 50% 0%, rgba(90,145,210,0.26) 0%, rgba(60,110,180,0.08) 46%, transparent 76%),
            linear-gradient(to bottom, rgba(20,45,75,0.36), transparent);
        }
        .weather-rain-lines {
          opacity: 0.62;
          background-image:
            repeating-linear-gradient(108deg, transparent 0 18px, rgba(190,220,255,0.18) 18px 19px, transparent 19px 34px),
            repeating-linear-gradient(108deg, transparent 0 42px, rgba(120,175,235,0.12) 42px 43px, transparent 43px 64px);
          background-size: 120px 180px, 180px 240px;
          animation: rain-drift 0.9s linear infinite;
          mask-image: linear-gradient(to bottom, black 0%, black 54%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, black 0%, black 54%, transparent 100%);
        }
        .weather-sun-glow {
          background:
            radial-gradient(circle at 50% 0%, rgba(255,220,130,0.34) 0%, rgba(255,185,90,0.16) 30%, transparent 62%),
            radial-gradient(ellipse 72% 48% at 50% 6%, rgba(120,190,255,0.16) 0%, transparent 72%);
        }
        .weather-sun-rays {
          opacity: 0.72;
          background:
            conic-gradient(from 205deg at 50% -18%, transparent 0deg, rgba(255,225,150,0.18) 10deg, transparent 22deg, transparent 38deg, rgba(255,235,175,0.12) 50deg, transparent 64deg, transparent 360deg);
          animation: sun-breathe 6s ease-in-out infinite alternate;
          mask-image: linear-gradient(to bottom, black 0%, rgba(0,0,0,0.75) 48%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, black 0%, rgba(0,0,0,0.75) 48%, transparent 100%);
        }
        @keyframes rain-drift {
          from { background-position: 0 0, 0 0; }
          to { background-position: -42px 118px, -58px 156px; }
        }
        @keyframes sun-breathe {
          from { opacity: 0.52; transform: translateY(-4px) scale(0.98); }
          to { opacity: 0.82; transform: translateY(0) scale(1.02); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
