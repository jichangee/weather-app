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

function getBgGradient(): string {
  const h = new Date().getHours();
  if (h < 6 || h >= 20) return "from-slate-900 via-blue-950 to-indigo-950";
  if (h < 8) return "from-orange-400 via-pink-500 to-purple-700";
  if (h < 17) return "from-sky-400 via-blue-500 to-indigo-600";
  return "from-orange-500 via-rose-600 to-purple-700";
}

// ─── Components ───────────────────────────────────────────────────────────────

function WeatherIcon({ icon, className = "" }: { icon: string; className?: string }) {
  return <i className={`qi-${icon} ${className}`} />;
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
  const bg = getBgGradient();

  return (
    <div className="min-h-screen relative overflow-hidden select-none">
      <div className={`fixed inset-0 bg-gradient-to-b ${bg} -z-10`} />
      <div className="fixed inset-0 -z-10"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.08) 0%, transparent 70%)" }} />

      <div className="flex flex-col items-center px-4 pb-12">

        {/* Location header */}
        <div className="w-full max-w-md pt-16 pb-2 text-center text-white">
          {loading ? (
            <p className="text-sm opacity-50 animate-pulse">获取位置中…</p>
          ) : geoError ? (
            <p className="text-sm text-red-300">{geoError}</p>
          ) : (
            <p className="text-lg font-semibold tracking-wide">
              {city ? `📍 ${city}` : ""}
            </p>
          )}
        </div>

        {/* Hero - current weather */}
        {now ? (
          <div className="w-full max-w-md text-center text-white mt-1 mb-10 animate-fadein">
            <WeatherIcon icon={now.icon} className="weather-icon-hero drop-shadow-2xl" />
            <div className="temp-hero font-extralight leading-none tracking-tighter tabular-nums">
              {now.temp}°
            </div>
            <div className="text-2xl font-light mt-2 opacity-90">{now.text}</div>
            <div className="text-sm opacity-55 mt-2.5 flex items-center justify-center gap-2">
              <span>体感 {now.feelsLike}°</span>
              <span className="opacity-40">·</span>
              <span>{now.windDir} {now.windScale}级</span>
            </div>
            {isRaining && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/15 border border-white/20 text-sm backdrop-blur-sm">
                <span>🌧</span>
                <span>{rain?.summary}</span>
              </div>
            )}
          </div>
        ) : dataLoading ? (
          <div className="w-full max-w-md text-center text-white mt-8 mb-10">
            <div className="text-sm opacity-40 animate-pulse">天气数据加载中…</div>
          </div>
        ) : null}

        {dataError && (
          <div className="glass-card w-full max-w-md p-4 text-center text-white/60 text-sm mb-4">
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
                    <span className="text-xs text-white/55">{item.label}</span>
                    <WeatherIcon icon={item.icon} className="text-[26px]" />
                    {item.type === "hour" ? (
                      <span className="text-sm font-semibold text-white tabular-nums">{item.temp}°</span>
                    ) : (
                      <span className="text-xs text-amber-300 font-medium">{item.text}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily forecast */}
          {weatherDaily && (
            <div className="glass-card p-4 animate-fadein-slow">
              <p className="card-label">7 天天气</p>
              <div className="divide-y divide-white/10">
                {weatherDaily.daily.map((d, i) => (
                  <div key={i} className="flex items-center py-3 text-white gap-3">
                    <span className="w-10 text-sm shrink-0">{getDayLabel(d.fxDate, i)}</span>
                    <WeatherIcon icon={d.iconDay} className="text-xl shrink-0" />
                    <span className="text-sm opacity-65 flex-1 truncate">{d.textDay}</span>
                    <span className="text-sm tabular-nums shrink-0">
                      <span className="opacity-45">{d.tempMin}°</span>
                      <span className="mx-1 opacity-25">/</span>
                      <span>{d.tempMax}°</span>
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
                      <WeatherIcon icon="100" className="text-2xl text-amber-300" />
                      <p className="text-[11px] text-white/45 mt-1.5">日出</p>
                      <p className="text-sm font-semibold text-white tabular-nums">{timePart(sunToday.sunrise)}</p>
                    </div>
                    <div className="w-px bg-white/15 self-stretch mx-1" />
                    <div className="text-center">
                      <WeatherIcon icon="150" className="text-2xl text-orange-400" />
                      <p className="text-[11px] text-white/45 mt-1.5">日落</p>
                      <p className="text-sm font-semibold text-white tabular-nums">{timePart(sunToday.sunset)}</p>
                    </div>
                  </div>
                </div>
              )}

              {now && (
                <div className="glass-card p-4 animate-fadein-slow">
                  <p className="card-label">湿度 · 能见度</p>
                  <div className="flex justify-around mt-1">
                    <div className="text-center">
                      <p className="text-xl font-semibold text-white tabular-nums">{now.humidity}<span className="text-sm font-normal">%</span></p>
                      <p className="text-[11px] text-white/45 mt-1.5">湿度</p>
                    </div>
                    <div className="w-px bg-white/15 self-stretch mx-1" />
                    <div className="text-center">
                      <p className="text-xl font-semibold text-white tabular-nums">{now.vis}</p>
                      <p className="text-[11px] text-white/45 mt-1.5">能见度 km</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="text-[11px] text-white/25 mt-8 tracking-wide">
          数据来源：和风天气 QWeather
        </footer>
      </div>

      <style>{`
        .animate-fadein { animation: fadein 0.7s ease-out both; }
        .animate-fadein-slow { animation: fadein 1.1s ease-out both; }
        @keyframes fadein {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: none; }
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.13);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.22);
        }
        .card-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.45);
          margin-bottom: 12px;
        }
        .weather-icon-hero { font-size: 72px; display: block; }
        .temp-hero { font-size: clamp(80px, 22vw, 104px); }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
