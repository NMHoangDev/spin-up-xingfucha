"use client";

import { useEffect, useMemo, useState } from "react";
import { DailyBarChart, StoreBarChart, PrizeBarChart } from "@/components/admin/Charts";

type Store = { code: string; name: string; active: boolean };
type Analytics = {
  kpis: {
    totalSpins: number;
    uniqueCustomers: number;
    spinsToday: number;
    spinsThisWeek: number;
    spinsThisMonth: number;
  };
  byDay: { date: string; count: number }[];
  byStore: { storeCode: string; storeName: string; count: number }[];
  byPrize: { prizeId: string; label: string; count: number }[];
};

type SpinRow = {
  id: string;
  storeCode: string;
  name: string;
  phone: string;
  rewardLabel: string;
  rewardCode: string | null;
  status: "used" | "unused";
  voucherUsableFrom: string | null;
  voucherExpiresAt: string | null;
  usedAt: string | null;
  invoiceAmount: number | null;
  createdAt: string;
};

type Preset = "today" | "7d" | "month" | "custom";

function formatVnd(amount: number | null) {
  if (amount == null) return "-";
  return `${amount.toLocaleString("vi-VN")}đ`;
}

function toDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function presetRange(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  if (preset === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { from: start.toISOString(), to };
  }
  if (preset === "7d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to };
  }
  if (preset === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: start.toISOString(), to };
  }
  return { from: presetRange("today").from, to };
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("vi-VN");
  } catch {
    return iso;
  }
}

export default function AdminDashboardPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [preset, setPreset] = useState<Preset>("7d");
  const [customFrom, setCustomFrom] = useState(toDateInput(new Date()));
  const [customTo, setCustomTo] = useState(toDateInput(new Date()));

  const range = useMemo(() => {
    if (preset === "custom") {
      const from = new Date(`${customFrom}T00:00:00`).toISOString();
      const to = new Date(`${customTo}T23:59:59`).toISOString();
      return { from, to };
    }
    return presetRange(preset);
  }, [preset, customFrom, customTo]);

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<SpinRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [loadingRows, setLoadingRows] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetch("/api/admin/stores")
      .then((r) => r.json())
      .then((json) => setStores(json.items ?? []))
      .catch(() => setStores([]));
  }, []);

  const storesParam = selectedStores.length > 0 ? selectedStores.join(",") : "";

  async function loadAnalytics() {
    setLoadingAnalytics(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to });
      if (storesParam) params.set("stores", storesParam);
      const res = await fetch(`/api/admin/analytics?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Không tải được số liệu.");
      setAnalytics(json);
    } catch (e: any) {
      setError(e?.message ?? "Không tải được số liệu.");
    } finally {
      setLoadingAnalytics(false);
    }
  }

  async function loadRows() {
    setLoadingRows(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search,
        from: range.from,
        to: range.to,
      });
      if (storesParam) params.set("stores", storesParam);
      const res = await fetch(`/api/admin/spins?${params.toString()}`);
      const json = await res.json();
      setRows(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch {
      /* best effort */
    } finally {
      setLoadingRows(false);
    }
  }

  useEffect(() => {
    void loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, storesParam]);

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, storesParam, page]);

  function toggleStore(code: string) {
    setSelectedStores((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
    setPage(1);
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to });
      if (storesParam) params.set("stores", storesParam);
      const res = await fetch(`/api/admin/export?${params.toString()}`);
      if (!res.ok) throw new Error("Export thất bại.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bao-cao-vong-quay.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message ?? "Export thất bại.");
    } finally {
      setExporting(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tổng quan</h1>
          <p className="mt-1 text-sm text-gray-600">
            Số liệu khách hàng quay theo ngày, tuần, tháng — lọc theo cửa hàng.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void exportExcel()}
          disabled={exporting}
          className="h-10 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium disabled:opacity-50"
        >
          {exporting ? "Đang xuất..." : "Xuất Excel"}
        </button>
      </div>

      <section className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex gap-1">
          {(
            [
              { key: "today", label: "Hôm nay" },
              { key: "7d", label: "7 ngày qua" },
              { key: "month", label: "Tháng này" },
              { key: "custom", label: "Tuỳ chỉnh" },
            ] as const
          ).map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setPreset(p.key);
                setPage(1);
              }}
              className={`h-9 rounded-lg px-3 text-sm font-medium ${
                preset === p.key
                  ? "bg-gray-900 text-white"
                  : "border border-gray-300 text-gray-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 rounded-lg border border-gray-300 px-2 text-sm"
            />
            <span className="text-sm text-gray-500">đến</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-9 rounded-lg border border-gray-300 px-2 text-sm"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500">Cửa hàng:</span>
          <button
            type="button"
            onClick={() => setSelectedStores([])}
            className={`h-8 rounded-full px-3 text-xs font-medium ${
              selectedStores.length === 0
                ? "bg-gray-900 text-white"
                : "border border-gray-300 text-gray-700"
            }`}
          >
            Tất cả
          </button>
          {stores.map((s) => (
            <button
              key={s.code}
              type="button"
              onClick={() => toggleStore(s.code)}
              className={`h-8 rounded-full px-3 text-xs font-medium ${
                selectedStores.includes(s.code)
                  ? "bg-gray-900 text-white"
                  : "border border-gray-300 text-gray-700"
              }`}
              title={s.name}
            >
              {s.code}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: "Tổng lượt quay (đã lọc)", value: analytics?.kpis.totalSpins },
          { label: "Khách hàng riêng biệt", value: analytics?.kpis.uniqueCustomers },
          { label: "Hôm nay", value: analytics?.kpis.spinsToday },
          { label: "Tuần này", value: analytics?.kpis.spinsThisWeek },
          { label: "Tháng này", value: analytics?.kpis.spinsThisMonth },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {loadingAnalytics ? "-" : (k.value ?? 0)}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Lượt quay theo ngày</h2>
          {analytics && <DailyBarChart data={analytics.byDay} />}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Theo cửa hàng</h2>
          {analytics && <StoreBarChart data={analytics.byStore} />}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-900">Theo quà tặng</h2>
          {analytics && <PrizeBarChart data={analytics.byPrize} />}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-900">Danh sách lượt quay</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                void loadRows();
              }
            }}
            placeholder="Tìm theo tên hoặc SĐT"
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">Tên</th>
                <th className="px-4 py-3 text-left">SĐT</th>
                <th className="px-4 py-3 text-left">Cửa hàng</th>
                <th className="px-4 py-3 text-left">Quà</th>
                <th className="px-4 py-3 text-left">Hoá đơn</th>
                <th className="px-4 py-3 text-left">Thời gian</th>
                <th className="px-4 py-3 text-left">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {loadingRows && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    Đang tải...
                  </td>
                </tr>
              )}
              {!loadingRows && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    Không có dữ liệu.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-3 text-gray-700">{r.phone}</td>
                  <td className="px-4 py-3 font-mono text-gray-700">{r.storeCode}</td>
                  <td className="px-4 py-3 text-gray-700">{r.rewardLabel}</td>
                  <td className="px-4 py-3 text-gray-700">{formatVnd(r.invoiceAmount)}</td>
                  <td className="px-4 py-3 text-gray-700">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        r.status === "used"
                          ? "inline-flex items-center rounded-md border border-green-200 bg-green-50 px-2 py-1 text-green-700"
                          : "inline-flex items-center rounded-md border border-yellow-200 bg-yellow-50 px-2 py-1 text-yellow-700"
                      }
                    >
                      {r.status === "used" ? "Đã dùng" : "Chưa dùng"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-gray-200 p-4">
          <div className="text-sm text-gray-600">
            Tổng: <span className="font-medium text-gray-900">{total}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="h-9 rounded-lg border border-gray-300 px-3 disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Trước
            </button>
            <div className="text-sm text-gray-700">
              Trang {page} / {pageCount}
            </div>
            <button
              className="h-9 rounded-lg border border-gray-300 px-3 disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
            >
              Sau
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
