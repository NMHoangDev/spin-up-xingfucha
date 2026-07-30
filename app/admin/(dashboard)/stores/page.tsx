"use client";

import { useEffect, useState } from "react";

type Store = { code: string; name: string; active: boolean; managerEmail: string | null };

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "" });
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stores");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Không tải được danh sách cửa hàng.");
      setStores(json.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Không tải được danh sách cửa hàng.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggleActive(code: string, active: boolean) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/stores/${encodeURIComponent(code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Cập nhật thất bại.");
      setStores((prev) => prev.map((s) => (s.code === code ? json : s)));
    } catch (e: any) {
      setError(e?.message ?? "Cập nhật thất bại.");
    }
  }

  async function updateManagerEmail(code: string, managerEmail: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/stores/${encodeURIComponent(code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerEmail: managerEmail || null }),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(
          json.error === "invalid_email"
            ? "Email không hợp lệ (nhiều email cách nhau bằng dấu phẩy)."
            : (json.error ?? "Cập nhật thất bại."),
        );
      setStores((prev) => prev.map((s) => (s.code === code ? json : s)));
    } catch (e: any) {
      setError(e?.message ?? "Cập nhật thất bại.");
      await load();
    }
  }

  async function createStore(event: React.FormEvent) {
    event.preventDefault();
    if (!form.code.trim() || !form.name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Thêm cửa hàng thất bại.");
      setForm({ code: "", name: "" });
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Thêm cửa hàng thất bại.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Cửa hàng</h1>
        <p className="mt-1 text-sm text-gray-600">
          Mỗi cửa hàng dùng chung một cấu hình vòng quay/điều kiện — mã cửa
          hàng gắn theo đường link quay (?store=MÃ) để gắn nhãn lượt quay khi
          báo cáo. Nhập email quản lý để dùng nút &quot;Thông báo đến các quản
          lý&quot; ở Tổng quan — nhiều cửa hàng cùng email sẽ được gộp vào 1
          email cho đúng người quản lý.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">Thêm cửa hàng</h2>
        <form onSubmit={createStore} className="mt-3 flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Mã cửa hàng</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
              className="h-10 rounded-lg border border-gray-300 px-3"
              placeholder="107NGT"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Tên/địa chỉ</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="h-10 w-72 rounded-lg border border-gray-300 px-3"
              placeholder="107 Ngô Gia Tự"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="h-10 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {creating ? "Đang thêm..." : "Thêm"}
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-4 py-3 text-left">Mã</th>
              <th className="px-4 py-3 text-left">Tên/địa chỉ</th>
              <th className="px-4 py-3 text-left">Link quay</th>
              <th className="px-4 py-3 text-left">Email quản lý</th>
              <th className="px-4 py-3 text-left">Đang hoạt động</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  Đang tải...
                </td>
              </tr>
            )}
            {!loading && stores.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  Chưa có cửa hàng nào.
                </td>
              </tr>
            )}
            {stores.map((s) => (
              <tr key={s.code} className="border-t border-gray-100">
                <td className="px-4 py-3 font-mono font-medium text-gray-900">
                  {s.code}
                </td>
                <td className="px-4 py-3 text-gray-700">{s.name}</td>
                <td className="px-4 py-3 text-gray-500">{`/?store=${s.code}`}</td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    defaultValue={s.managerEmail ?? ""}
                    placeholder="quanly@gmail.com"
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value !== (s.managerEmail ?? "")) void updateManagerEmail(s.code, value);
                    }}
                    className="w-full min-w-[200px] rounded border border-transparent px-2 py-1 hover:border-gray-200 focus:border-gray-400"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={s.active}
                    onChange={(e) => void toggleActive(s.code, e.target.checked)}
                    className="h-5 w-5"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
