export interface LineChartPoint {
  label: string;
  value: number;
}

interface Props {
  points: LineChartPoint[];
  color?: string;
  height?: number;
}

const WIDTH = 600;

export function LineChart({ points, color = "#2563eb", height = 140 }: Props) {
  if (points.length === 0) return null;

  const values = points.map((p) => p.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;
  const padding = 8;
  const usableHeight = height - padding * 2;
  const stepX = points.length > 1 ? WIDTH / (points.length - 1) : 0;

  function xAt(i: number): number {
    return points.length > 1 ? i * stepX : WIDTH / 2;
  }
  function yAt(value: number): number {
    return padding + usableHeight - ((value - min) / range) * usableHeight;
  }

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yAt(p.value).toFixed(2)}`)
    .join(" ");
  const zeroY = yAt(0);
  const showZeroLine = min < 0 && max > 0;
  const midIndex = Math.floor((points.length - 1) / 2);

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        style={{ width: "100%", height: `${height}px`, display: "block" }}
        preserveAspectRatio="none"
      >
        {showZeroLine && (
          <line x1={0} y1={zeroY} x2={WIDTH} y2={zeroY} stroke="var(--border)" strokeDasharray="4 4" />
        )}
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} />
        {points.map((p, i) => (
          <circle key={i} cx={xAt(i)} cy={yAt(p.value)} r={i === points.length - 1 ? 4 : 2.5} fill={color} />
        ))}
      </svg>
      {points.length > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
          <span>{points[0]!.label}</span>
          {points.length > 2 && <span>{points[midIndex]!.label}</span>}
          <span>{points[points.length - 1]!.label}</span>
        </div>
      )}
    </div>
  );
}
