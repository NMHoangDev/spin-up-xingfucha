"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatDayLabel(day: string) {
  const [, m, d] = day.split("-");
  return `${d}/${m}`;
}

export function DailyBarChart({
  data,
}: {
  data: { date: string; count: number }[];
}) {
  const chartData = data.map((d) => ({ ...d, label: formatDayLabel(d.date) }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={32} />
        <Tooltip
          labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
          formatter={(value: any) => [value, "Lượt quay"] as [number, string]}
        />
        <Bar dataKey="count" fill="#d81b21" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StoreBarChart({
  data,
}: {
  data: { storeCode: string; storeName: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(260, data.length * 34)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
        <YAxis
          type="category"
          dataKey="storeCode"
          width={70}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          labelFormatter={(_, payload) => payload?.[0]?.payload?.storeName ?? ""}
          formatter={(value: any) => [value, "Lượt quay"] as [number, string]}
        />
        <Bar dataKey="count" fill="#b45309" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PrizeBarChart({
  data,
}: {
  data: { prizeId: string; label: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(260, data.length * 34)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
        <YAxis
          type="category"
          dataKey="label"
          width={140}
          tick={{ fontSize: 12 }}
        />
        <Tooltip formatter={(value: any) => [value, "Lượt quay"] as [number, string]} />
        <Bar dataKey="count" fill="#4d7c0f" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
