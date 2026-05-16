import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TrendPoint = {
  cpu: number;
  disk: number;
  memory: number;
  time: string;
};

function round(value: number) {
  return String(Math.round(value * 100) / 100);
}

export default function MetricTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="chart-panel">
      <ResponsiveContainer height={220} width="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis dataKey="time" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
          <Tooltip formatter={(value) => `${round(Number(value))}%`} />
          <Line
            dataKey="cpu"
            dot={false}
            name="CPU"
            stroke="#2563eb"
            strokeWidth={2}
            type="monotone"
          />
          <Line
            dataKey="memory"
            dot={false}
            name="Memory"
            stroke="#047857"
            strokeWidth={2}
            type="monotone"
          />
          <Line
            dataKey="disk"
            dot={false}
            name="Disk"
            stroke="#b45309"
            strokeWidth={2}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
