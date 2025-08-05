"use client";
import { useEffect, useState } from "react";

const HOST = process.env.NEXT_PUBLIC_QWEATHER_HOST;
const QWEATHER_KEY = process.env.NEXT_PUBLIC_QWEATHER_KEY;

async function fetchQWeather(type: string, lat: number, lon: number) {
  let url = "";
  const loc = `${lon},${lat}`;
  switch (type) {
    case "now":
      url = `${HOST}/v7/weather/now?location=${loc}&key=${QWEATHER_KEY}`;
      break;
    case "hourly":
      url = `${HOST}/v7/weather/24h?location=${loc}&key=${QWEATHER_KEY}`;
      break;
    case "daily":
      url = `${HOST}/v7/weather/7d?location=${loc}&key=${QWEATHER_KEY}`;
      break;
    case "rain":
      url = `${HOST}/v7/minutely/5m?location=${loc}&key=${QWEATHER_KEY}`;
      break;
    case "city":
      url = `${HOST}/geo/v2/city/lookup?location=${loc}&key=${QWEATHER_KEY}`;
      break;
    default:
      return null;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("天气数据获取失败");
  return res.json();
}

function formatTime(str: string) {
  if (!str) return "";
  return str.replace(/T/, " ").replace(/:00\+08:00$/, "");
}

function WeatherIcon({ icon, size = 40, alt = "" }: { icon: string, size?: number, alt?: string }) {
  return (
    <i className={`qi-${icon}`} style={{ fontSize: size }}></i>
  );
}

export default function Home() {
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [city, setCity] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 天气数据
  const [weatherNow, setWeatherNow] = useState<any>(null);
  const [weatherHourly, setWeatherHourly] = useState<any>(null);
  const [weatherDaily, setWeatherDaily] = useState<any>(null);
  const [rain, setRain] = useState<any>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("当前浏览器不支持定位功能");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLoading(false);
      },
      (err) => {
        setError("定位失败: " + err.message);
        setLoading(false);
      }
    );
  }, []);

  // 获取城市名
  useEffect(() => {
    if (location) {
      fetchQWeather("city", location.lat, location.lon)
        .then((data) => {
          if (data && data.code === "200" && data.location && data.location[0]) {
            setCity(data.location[0].name);
          } else {
            setCity("");
          }
        })
        .catch(() => setCity(""));
    }
  }, [location]);

  // 获取天气
  useEffect(() => {
    if (location) {
      setWeatherError(null);
      Promise.all([
        fetchQWeather("rain", location.lat, location.lon),
        fetchQWeather("now", location.lat, location.lon),
        fetchQWeather("hourly", location.lat, location.lon),
        fetchQWeather("daily", location.lat, location.lon),
      ])
        .then(([rainData, nowData, hourlyData, dailyData]) => {
          setRain(rainData);
          setWeatherNow(nowData);
          setWeatherHourly(hourlyData);
          setWeatherDaily(dailyData);
        })
        .catch((e) => {
          setWeatherError("天气数据获取失败: " + e.message);
        });
    }
  }, [location]);

  return (
    <div className="flex flex-col items-center min-h-screen bg-[#f8f8f8] text-[#222] p-4">
      <h1 className="text-2xl font-semibold mb-2 mt-8 tracking-tight animate-fadein">和风天气</h1>
      <div className="text-base text-gray-600 mb-4 animate-fadein-slow">{city && <span>📍{city}</span>}</div>
      <div className="w-full max-w-md flex flex-col gap-4">
        {/* 定位与错误 */}
        {(loading || error) && <div className="rounded-2xl bg-white shadow p-4 text-center transition-all duration-500 animate-fadein">
          {loading && <div>正在获取定位信息…</div>}
          {error && <div className="text-red-500">{error}</div>}
        </div>}
        {/* 天气错误 */}
        {weatherError && (
          <div className="rounded-2xl bg-white shadow p-4 text-center text-red-500 animate-fadein">{weatherError}</div>
        )}
        {/* 降水 */}
        {rain && rain.code === "200" && (
          <div className="rounded-2xl bg-white shadow p-4 flex flex-col gap-1 animate-fadein-slow">
            <div className="font-semibold text-lg mb-1 flex items-center gap-2">
              <span>降水</span>
              <span className="text-blue-400 animate-bounce">☔</span>
            </div>
            <div className="text-sm text-gray-600">{rain.summary}</div>
            <div className="text-xs text-gray-400 mt-1">更新时间：{formatTime(rain.updateTime)}</div>
          </div>
        )}
        {/* 实时天气 */}
        {weatherNow && weatherNow.code === "200" && (
          <div className="rounded-2xl bg-white shadow p-4 flex flex-col gap-1 items-center animate-fadein">
            <div className="font-semibold text-lg mb-1">实时天气</div>
            <div className="flex items-end gap-2">
              <WeatherIcon icon={weatherNow.now.icon} size={56} alt={weatherNow.now.text} />
              <span className="text-4xl font-bold animate-fadein">{weatherNow.now.temp}°</span>
              <span className="text-base text-gray-500">{weatherNow.now.text}</span>
            </div>
            <div className="text-sm text-gray-600 mt-1">体感温度 {weatherNow.now.feelsLike}°，{weatherNow.now.windDir} {weatherNow.now.windScale}级</div>
            <div className="text-xs text-gray-400 mt-1">更新时间：{formatTime(weatherNow.updateTime)}</div>
          </div>
        )}
        {/* 逐小时预报 */}
        {weatherHourly && weatherHourly.code === "200" && (
          <div className="rounded-2xl bg-white shadow p-4 animate-fadein-slow">
            <div className="font-semibold text-lg mb-2">24小时预报</div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {weatherHourly.hourly.slice(0, 24).map((h: any, i: number) => (
                <div key={i} className="flex flex-col items-center min-w-[56px] transition-transform duration-300 hover:scale-110">
                  <div className="text-xs text-gray-500 mb-1">{h.fxTime.slice(11, 16)}</div>
                  <WeatherIcon icon={h.icon} size={32} alt={h.text} />
                  <div className="text-base font-semibold">{h.temp}°</div>
                  <div className="text-xs text-gray-500">{h.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* 每日天气 */}
        {weatherDaily && weatherDaily.code === "200" && (
          <div className="rounded-2xl bg-white shadow p-4 animate-fadein">
            <div className="font-semibold text-lg mb-2">7天天气</div>
            <div className="flex flex-col gap-2">
              {weatherDaily.daily.map((d: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm px-2 py-1 rounded-lg hover:bg-gray-50 transition group">
                  <span className="w-16 text-gray-500">{d.fxDate.slice(5)}</span>
                  <span className="flex-1 text-gray-700 flex items-center gap-2">
                    <WeatherIcon icon={d.iconDay} size={28} alt={d.textDay} />
                    {d.textDay}
                  </span>
                  <span className="w-16 text-right text-gray-700">{d.tempMin}°~{d.tempMax}°</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <footer className="text-xs text-gray-400 mt-8 mb-2 animate-fadein-slow">数据来源：和风天气 QWeather</footer>
      {/* 动画样式 */}
      <style>{`
        .animate-fadein { animation: fadein 0.8s; }
        .animate-fadein-slow { animation: fadein 1.5s; }
        @keyframes fadein { from { opacity: 0; transform: translateY(24px);} to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}
