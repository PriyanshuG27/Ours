"use client";

import { useMemo } from "react";
import { EnergyLog } from "@/types/app.types";
import { useSpaceStore } from "@/store/space.store";

type EnergyGraphProps = {
  logs: EnergyLog[];
};

function getDailyAverage(log: EnergyLog | undefined): number | null {
  if (!log) return null;
  let sum = 0;
  let count = 0;
  if (log.morning_level) {
    sum += log.morning_level;
    count++;
  }
  if (log.night_level) {
    sum += log.night_level;
    count++;
  }
  return count > 0 ? sum / count : null;
}

export function EnergyGraph({ logs }: EnergyGraphProps) {
  const userId = useSpaceStore((state) => state.userId);
  const partnerId = useSpaceStore((state) => state.partnerId);
  const partnerName = useSpaceStore((state) => state.partnerName);

  const { dates, myPoints, partnerPoints } = useMemo(() => {
    // Get last 7 days
    const today = new Date();
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      last7Days.push(d.toISOString().split("T")[0]);
    }

    const myLogsMap = new Map(
      logs.filter((l) => l.user_id === userId).map((l) => [l.date, l])
    );
    const partnerLogsMap = new Map(
      logs.filter((l) => l.user_id === partnerId).map((l) => [l.date, l])
    );

    const mPoints = last7Days.map((date) =>
      getDailyAverage(myLogsMap.get(date))
    );
    const pPoints = last7Days.map((date) =>
      getDailyAverage(partnerLogsMap.get(date))
    );

    return { dates: last7Days, myPoints: mPoints, partnerPoints: pPoints };
  }, [logs, userId, partnerId]);

  // Coordinates
  const width = 300;
  const height = 100;
  const xStep = width / 6;

  function toY(level: number) {
    // level 1 => 90, level 5 => 10
    return 90 - (level - 1) * 20;
  }

  function renderLine(points: (number | null)[], color: string) {
    const segments: string[] = [];
    let currentSegment: string[] = [];

    points.forEach((val, i) => {
      if (val !== null) {
        const x = i * xStep;
        const y = toY(val);
        currentSegment.push(`${x},${y}`);
      } else {
        if (currentSegment.length > 0) {
          segments.push(currentSegment.join(" "));
          currentSegment = [];
        }
      }
    });
    if (currentSegment.length > 0) {
      segments.push(currentSegment.join(" "));
    }

    return (
      <>
        {segments.map((pointsStr, idx) => (
          <polyline
            key={idx}
            points={pointsStr}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {points.map((val, i) => {
          if (val === null) return null;
          return (
            <circle
              key={i}
              cx={i * xStep}
              cy={toY(val)}
              r="4"
              fill={color}
              stroke="#18181b"
              strokeWidth="2"
            />
          );
        })}
      </>
    );
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-medium text-white">Energy Pulse</h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-violet-500" />
            <span className="text-zinc-400">You</span>
          </div>
          {partnerId && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-zinc-400">{partnerName || "Partner"}</span>
            </div>
          )}
        </div>
      </div>

      <div className="relative w-full aspect-[3/1] max-w-sm mx-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
        >
          {/* Grid lines */}
          {[1, 2, 3, 4, 5].map((level) => (
            <line
              key={level}
              x1="0"
              y1={toY(level)}
              x2={width}
              y2={toY(level)}
              stroke="#27272a"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          ))}

          {/* Lines */}
          {partnerId && renderLine(partnerPoints, "#10b981")}
          {renderLine(myPoints, "#8b5cf6")}
        </svg>

        {/* X-axis labels (days) */}
        <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-[10px] text-zinc-500 font-medium px-[2px]">
          {dates.map((d, i) => {
            const dateObj = new Date(d);
            const dayName = dateObj.toLocaleDateString("en-US", {
              weekday: "short",
            });
            return <span key={i}>{dayName}</span>;
          })}
        </div>
      </div>
    </div>
  );
}
