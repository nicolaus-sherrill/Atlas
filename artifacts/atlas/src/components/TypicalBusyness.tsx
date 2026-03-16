import { useState, useEffect } from "react";
import { fetchCrowdStatus, getBusynessInfo } from "@/lib/crowd";
import type { HourlyAverage } from "@/lib/crowd";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface TypicalBusynessProps {
  spotId: string;
}

export default function TypicalBusyness({ spotId }: TypicalBusynessProps) {
  const [hourlyData, setHourlyData] = useState<HourlyAverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDay());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCrowdStatus(spotId).then((data) => {
      if (!cancelled && data) {
        setHourlyData(data.hourlyAverages);
      }
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [spotId]);

  if (loading) return null;

  const dayData = hourlyData
    .filter((h) => h.dayOfWeek === selectedDay)
    .sort((a, b) => a.hourOfDay - b.hourOfDay);

  if (dayData.length === 0) return null;

  const maxLevel = 4;

  return (
    <div className="typical-busyness">
      <div className="typical-busyness-header">
        <span className="typical-busyness-title">Typical busyness</span>
        <div className="typical-busyness-days">
          {DAY_NAMES.map((name, i) => (
            <button
              key={i}
              className={`typical-day-btn ${selectedDay === i ? "active" : ""}`}
              onClick={() => setSelectedDay(i)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="typical-busyness-chart">
        {dayData.map((d) => {
          const pct = (d.avgLevel / maxLevel) * 100;
          const info = getBusynessInfo(Math.round(d.avgLevel));
          const hourLabel = d.hourOfDay === 0 ? "12a" :
            d.hourOfDay < 12 ? `${d.hourOfDay}a` :
            d.hourOfDay === 12 ? "12p" :
            `${d.hourOfDay - 12}p`;
          return (
            <div key={d.hourOfDay} className="typical-bar-col" title={`${info.label} (avg ${d.avgLevel})`}>
              <div className="typical-bar-track">
                <div
                  className="typical-bar-fill"
                  style={{ height: `${pct}%`, background: info.color }}
                />
              </div>
              <span className="typical-bar-label">{hourLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
