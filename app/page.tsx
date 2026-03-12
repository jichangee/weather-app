"use client";
import { useEffect, useState, useMemo } from "react";

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

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("浏览器不支持定位");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ lat: coords.latitude, lon: coords.longitude });
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
    const loc = `${location.lon},${location.lat}`;
    setDataError(null);
    setDataLoading(true);

    fetchApi<CityResponse>("/geo/v2/city/lookup", { location: loc })
      .then((d) => setCity(d?.location?.[0]?.name ?? ""))
      .catch(() => setCity(""));

    Promise.all([
      fetchApi<RainResponse>("/v7/minutely/5m", { location: loc }),
      fetchApi<NowResponse>("/v7/weather/now", { location: loc }),
      fetchApi<HourlyResponse>("/v7/weather/24h", { location: loc }),
      fetchApi<DailyResponse>("/v7/weather/7d", { location: loc }),
      fetchApi<SunResponse>("/v7/astronomy/sun", { location: loc, date: dateCode(0) }),
      fetchApi<SunResponse>("/v7/astronomy/sun", { location: loc, date: dateCode(1) }),
    ])
      .then(([r, now, hourly, daily, sun0, sun1]) => {
        if (r?.code === "200") setRain(r);
        if (now?.code === "200") setWeatherNow(now);
        if (hourly?.code === "200") setWeatherHourly(hourly);
        if (daily?.code === "200") setWeatherDaily(daily);
        if (sun0?.code === "200") setSunToday(sun0);
        if (sun1?.code === "200") setSunTomorrow(sun1);
      })
      .catch((e: Error) => setDataError("数据获取失败: " + e.message))
      .finally(() => setDataLoading(false));
  }, [location]);

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

  return (
    <div className="min-h-screen relative overflow-hidden select-none">
      {/* Soft dark background */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: `linear-gradient(to bottom, ${bgColors.from}, ${bgColors.to})`,
        }}
      />
      {/* Subtle top glow */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(100,160,255,0.06) 0%, transparent 70%)",
        }}
      />

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

          {/* Hourly forecast */}
          {weatherHourly && (
            <div className="glass-card p-4 animate-fadein">
              <p className="card-label">每小时预报</p>
              <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
                {hourlyTimeline.map((item, i) => (
                  <div key={i} className="flex flex-col items-center min-w-[52px] gap-1.5">
                    <span className="text-xs text-white/40">{item.label}</span>
                    <WeatherIcon icon={item.icon} className="text-[24px] opacity-85" />
                    {item.type === "hour" ? (
                      <span className="text-sm font-semibold text-white/85 tabular-nums">{item.temp}°</span>
                    ) : (
                      <span className="text-xs text-amber-400/80 font-medium">{item.text}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Temperature trend chart */}
          {weatherHourly && (
            <div className="glass-card px-4 pt-4 pb-3 animate-fadein-slow">
              <p className="card-label">气温趋势</p>
              <TempLineChart hourly={weatherHourly.hourly} />
            </div>
          )}

          {/* Daily forecast */}
          {weatherDaily && (
            <div className="glass-card p-4 animate-fadein-slow">
              <p className="card-label">7 天天气</p>
              <div className="divide-y divide-white/8">
                {weatherDaily.daily.map((d, i) => (
                  <div key={i} className="flex items-center py-3 text-white gap-3">
                    <span className="w-10 text-sm opacity-70 shrink-0">{getDayLabel(d.fxDate, i)}</span>
                    <WeatherIcon icon={d.iconDay} className="text-xl opacity-80 shrink-0" />
                    <span className="text-sm opacity-50 flex-1 truncate">{d.textDay}</span>
                    <span className="text-sm tabular-nums shrink-0">
                      <span className="opacity-35">{d.tempMin}°</span>
                      <span className="mx-1 opacity-20">/</span>
                      <span className="opacity-75">{d.tempMax}°</span>
                    </span>
                  </div>
                ))}
              </div>
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
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
