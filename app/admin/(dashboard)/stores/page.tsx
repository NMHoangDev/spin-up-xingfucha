"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Store = { code: string; name: string; active: boolean; managerEmail: string | null };

function storeLink(code: string): string {
  return `${window.location.origin}/?store=${encodeURIComponent(code)}`;
}

/** Composes a printable PNG — store name on top, QR code below — so a stack
 * of downloaded files stays easy to tell apart at a glance. */
async function downloadStoreQr(store: Store) {
  const qrDataUrl = await QRCode.toDataURL(storeLink(store.code), {
    width: 480,
    margin: 1,
  });
  const qrImg = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImg.onload = () => resolve();
    qrImg.onerror = () => reject(new Error("Không tạo được mã QR."));
    qrImg.src = qrDataUrl;
  });

  const padding = 32;
  const titleHeight = 64;
  const qrSize = qrImg.width;
  const canvas = document.createElement("canvas");
  canvas.width = qrSize + padding * 2;
  canvas.height = qrSize + titleHeight + padding * 2;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ tạo ảnh.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111827";
  ctx.font = "bold 28px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    store.name,
    canvas.width / 2,
    padding + titleHeight / 2,
    canvas.width - padding * 2,
  );
  ctx.drawImage(qrImg, padding, padding + titleHeight, qrSize, qrSize);

  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `QR-${store.code}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "" });
  const [creating, setCreating] = useState(false);
  const [qrPreviews, setQrPreviews] = useState<Record<string, string>>({});
  const [downloadingCode, setDownloadingCode] = useState<string | null>(null);

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

  const storeCodes = stores.map((s) => s.code).join(",");
  useEffect(() => {
    if (!storeCodes) return;
    let cancelled = false;
    (async () => {
      const codes = storeCodes.split(",");
      const entries = await Promise.all(
        codes.map(async (code) => {
          const dataUrl = await QRCode.toDataURL(storeLink(code), {
            width: 72,
            margin: 0,
          });
          return [code, dataUrl] as const;
        }),
      );
      if (!cancelled) setQrPreviews(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [storeCodes]);

  async function handleDownloadQr(store: Store) {
    setError(null);
    setDownloadingCode(store.code);
    try {
      await downloadStoreQr(store);
    } catch (e: any) {
      setError(e?.message ?? "Tải mã QR thất bại.");
    } finally {
      setDownloadingCode(null);
    }
  }

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
              <th className="px-4 py-3 text-left">Mã QR</th>
              <th className="px-4 py-3 text-left">Email quản lý</th>
              <th className="px-4 py-3 text-left">Đang hoạt động</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  Đang tải...
                </td>
              </tr>
            )}
            {!loading && stores.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
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
                  <div className="flex items-center gap-2">
                    {qrPreviews[s.code] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrPreviews[s.code]}
                        alt={`Mã QR ${s.name}`}
                        className="h-9 w-9 rounded border border-gray-200"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded border border-gray-200 bg-gray-50" />
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDownloadQr(s)}
                      disabled={downloadingCode === s.code}
                      className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {downloadingCode === s.code ? "Đang tạo..." : "Tải QR"}
                    </button>
                  </div>
                </td>
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
