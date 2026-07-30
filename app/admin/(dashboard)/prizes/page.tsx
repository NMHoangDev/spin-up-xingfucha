"use client";

import { useEffect, useState } from "react";

type Prize = {
  id: string;
  label: string;
  code: string | null;
  weight: number;
  dailyLimit: number | null;
  totalLimit: number | null;
  isActive: boolean;
  sortOrder: number;
};

const EMPTY_FORM = {
  label: "",
  code: "",
  weight: 25,
  dailyLimit: "" as number | "",
  totalLimit: "" as number | "",
};

export default function PrizesPage() {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/prizes");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Không tải được danh sách quà.");
      setPrizes(json.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Không tải được danh sách quà.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function updatePrize(id: string, patch: Partial<Prize>) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/prizes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Cập nhật thất bại.");
      setPrizes((prev) => prev.map((p) => (p.id === id ? json : p)));
    } catch (e: any) {
      setError(e?.message ?? "Cập nhật thất bại.");
    }
  }

  async function deletePrize(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/prizes/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Xoá thất bại.");
      setPrizes((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      setError(e?.message ?? "Xoá thất bại.");
    }
  }

  async function move(id: string, direction: -1 | 1) {
    const idx = prizes.findIndex((p) => p.id === id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= prizes.length) return;
    const a = prizes[idx];
    const b = prizes[swapIdx];
    await Promise.all([
      updatePrize(a.id, { sortOrder: b.sortOrder }),
      updatePrize(b.id, { sortOrder: a.sortOrder }),
    ]);
    await load();
  }

  async function createPrize(event: React.FormEvent) {
    event.preventDefault();
    if (!form.label.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/prizes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: form.label,
          code: form.code || null,
          weight: Number(form.weight) || 0,
          dailyLimit: form.dailyLimit === "" ? null : Number(form.dailyLimit),
          totalLimit: form.totalLimit === "" ? null : Number(form.totalLimit),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Tạo quà thất bại.");
      setForm(EMPTY_FORM);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Tạo quà thất bại.");
    } finally {
      setCreating(false);
    }
  }

  const activeCount = prizes.filter((p) => p.isActive).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Quà tặng</h1>
        <p className="mt-1 text-sm text-gray-600">
          Số quà đang bật ({activeCount}) quyết định số ô trên mặt vòng quay —
          sau khi thêm/bớt quà, vào mục Vòng quay để chia lại ô tương ứng.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">Thêm quà mới</h2>
        <form
          onSubmit={createPrize}
          className="mt-3 grid gap-3 md:grid-cols-5 md:items-end"
        >
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-gray-700">Tên quà</label>
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              required
              className="h-10 w-full rounded-lg border border-gray-300 px-3"
              placeholder="1 Trà sữa bất kỳ (M)"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Mã (code)</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="h-10 w-full rounded-lg border border-gray-300 px-3"
              placeholder="TRA-SUA-M"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Tỉ trọng</label>
            <input
              type="number"
              min={0}
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
              className="h-10 w-full rounded-lg border border-gray-300 px-3"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="h-10 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {creating ? "Đang thêm..." : "Thêm quà"}
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">Thứ tự</th>
                <th className="px-4 py-3 text-left">Tên quà</th>
                <th className="px-4 py-3 text-left">Mã</th>
                <th className="px-4 py-3 text-left">Tỉ trọng</th>
                <th className="px-4 py-3 text-left">Giới hạn/ngày</th>
                <th className="px-4 py-3 text-left">Giới hạn tổng</th>
                <th className="px-4 py-3 text-left">Bật</th>
                <th className="px-4 py-3 text-left">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                    Đang tải...
                  </td>
                </tr>
              )}
              {!loading && prizes.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                    Chưa có quà nào.
                  </td>
                </tr>
              )}
              {prizes.map((p, idx) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => void move(p.id, -1)}
                        disabled={idx === 0}
                        className="rounded border border-gray-300 px-2 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => void move(p.id, 1)}
                        disabled={idx === prizes.length - 1}
                        className="rounded border border-gray-300 px-2 disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      defaultValue={p.label}
                      onBlur={(e) =>
                        e.target.value !== p.label &&
                        void updatePrize(p.id, { label: e.target.value })
                      }
                      className="w-full min-w-[160px] rounded border border-transparent px-2 py-1 hover:border-gray-200 focus:border-gray-400"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      defaultValue={p.code ?? ""}
                      onBlur={(e) =>
                        e.target.value !== (p.code ?? "") &&
                        void updatePrize(p.id, { code: e.target.value || null })
                      }
                      className="w-full min-w-[120px] rounded border border-transparent px-2 py-1 hover:border-gray-200 focus:border-gray-400"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      defaultValue={p.weight}
                      onBlur={(e) =>
                        Number(e.target.value) !== p.weight &&
                        void updatePrize(p.id, { weight: Number(e.target.value) })
                      }
                      className="w-20 rounded border border-transparent px-2 py-1 hover:border-gray-200 focus:border-gray-400"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      defaultValue={p.dailyLimit ?? ""}
                      placeholder="Không giới hạn"
                      onBlur={(e) => {
                        const v = e.target.value === "" ? null : Number(e.target.value);
                        if (v !== p.dailyLimit) void updatePrize(p.id, { dailyLimit: v });
                      }}
                      className="w-28 rounded border border-transparent px-2 py-1 hover:border-gray-200 focus:border-gray-400"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      defaultValue={p.totalLimit ?? ""}
                      placeholder="Không giới hạn"
                      onBlur={(e) => {
                        const v = e.target.value === "" ? null : Number(e.target.value);
                        if (v !== p.totalLimit) void updatePrize(p.id, { totalLimit: v });
                      }}
                      className="w-28 rounded border border-transparent px-2 py-1 hover:border-gray-200 focus:border-gray-400"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={p.isActive}
                      onChange={(e) => void updatePrize(p.id, { isActive: e.target.checked })}
                      className="h-5 w-5"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void deletePrize(p.id)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50"
                    >
                      Xoá
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
