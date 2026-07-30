"use client";

import { useEffect, useState } from "react";

type Prize = {
  id: string;
  label: string;
  isActive: boolean;
};

type AssignmentStatus = "pending" | "fulfilled" | "cancelled";

type Assignment = {
  id: string;
  phone: string;
  prizeId: string;
  prizeLabel: string | null;
  prizeCode: string | null;
  status: AssignmentStatus;
  note: string | null;
  existingCustomerName: string | null;
  spinId: string | null;
  fulfilledStoreCode: string | null;
  fulfilledCustomerName: string | null;
  createdAt: string;
  fulfilledAt: string | null;
};

const STATUS_LABEL: Record<AssignmentStatus, string> = {
  pending: "Đang chờ",
  fulfilled: "Đã trúng",
  cancelled: "Đã huỷ",
};

const STATUS_CLASS: Record<AssignmentStatus, string> = {
  pending: "border-yellow-200 bg-yellow-50 text-yellow-700",
  fulfilled: "border-green-200 bg-green-50 text-green-700",
  cancelled: "border-gray-200 bg-gray-50 text-gray-500",
};

function formatDate(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("vi-VN");
  } catch {
    return iso;
  }
}

export default function AssignGiftPage() {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [phone, setPhone] = useState("");
  const [prizeId, setPrizeId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadPrizes() {
    try {
      const res = await fetch("/api/admin/prizes");
      const json = await res.json();
      const items: Prize[] = json.items ?? [];
      setPrizes(items);
      if (!prizeId && items.length > 0) setPrizeId(items[0].id);
    } catch {
      /* best effort */
    }
  }

  async function loadAssignments() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/assignments");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Không tải được danh sách chỉ định.");
      setAssignments(json.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Không tải được danh sách chỉ định.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPrizes();
    void loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createAssignment(event: React.FormEvent) {
    event.preventDefault();
    if (!phone.trim() || !prizeId) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), prizeId, note: note.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Chỉ định quà thất bại.");

      const prizeLabel = prizes.find((p) => p.id === prizeId)?.label ?? "quà đã chọn";
      setNotice(
        json.isExistingCustomer
          ? `Đã chỉ định "${prizeLabel}" cho SĐT ${json.phone} — khách này đã từng quay trước đây (tên: ${json.existingCustomerName ?? "?"}). Lần quay tiếp theo của số này sẽ trúng ngay quà này.`
          : `Đã chỉ định "${prizeLabel}" cho SĐT ${json.phone} — đây là số mới, chưa từng quay. Khi số này quay lần đầu sẽ trúng ngay quà này.`,
      );
      setPhone("");
      setNote("");
      await loadAssignments();
    } catch (e: any) {
      setError(e?.message ?? "Chỉ định quà thất bại.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelAssignment(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/assignments/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Huỷ thất bại.");
      await loadAssignments();
    } catch (e: any) {
      setError(e?.message ?? "Huỷ thất bại.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Chỉ định quà</h1>
        <p className="mt-1 text-sm text-gray-600">
          Chỉ định trước một phần quà cho một số điện thoại cụ thể. Nếu số này
          đã từng quay (đã có trong hệ thống), quà sẽ được gắn đúng vào số đó;
          nếu là số mới thì sẽ được lưu lại khi khách quay lần đầu. Lần quay
          tiếp theo của số điện thoại này sẽ trúng ngay phần quà đã chọn, bất
          kể tỉ trọng/giới hạn của quà đó. Chỉ định chỉ có hiệu lực{" "}
          <strong>đúng một lần</strong> — ngay khi khách trúng, trạng thái
          chuyển sang &quot;Đã trúng&quot; và số này sẽ không tự trúng lại quà
          đó ở các lượt quay sau, trừ khi bạn chỉ định lại từ đầu.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {notice}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">Chỉ định mới</h2>
        <form onSubmit={createAssignment} className="mt-3 grid gap-3 md:grid-cols-4 md:items-end">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Số điện thoại</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="h-10 w-full rounded-lg border border-gray-300 px-3"
              placeholder="09xxxxxxxx"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Phần quà</label>
            <select
              value={prizeId}
              onChange={(e) => setPrizeId(e.target.value)}
              required
              className="h-10 w-full rounded-lg border border-gray-300 px-3"
            >
              {prizes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {!p.isActive ? " (đang tắt)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Ghi chú (tuỳ chọn)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 px-3"
              placeholder="Lý do chỉ định..."
            />
          </div>
          <button
            type="submit"
            disabled={saving || !phone.trim() || !prizeId}
            className="h-10 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Chỉ định"}
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">SĐT</th>
                <th className="px-4 py-3 text-left">Quà chỉ định</th>
                <th className="px-4 py-3 text-left">Khách hàng</th>
                <th className="px-4 py-3 text-left">Trạng thái</th>
                <th className="px-4 py-3 text-left">Ngày chỉ định</th>
                <th className="px-4 py-3 text-left">Ngày trúng</th>
                <th className="px-4 py-3 text-left">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    Đang tải...
                  </td>
                </tr>
              )}
              {!loading && assignments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    Chưa có chỉ định nào.
                  </td>
                </tr>
              )}
              {assignments.map((a) => (
                <tr key={a.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-gray-700">{a.phone}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {a.prizeLabel ?? "(quà đã bị xoá)"}
                    {a.note && (
                      <div className="text-xs text-gray-400">{a.note}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {a.status === "fulfilled"
                      ? (a.fulfilledCustomerName ?? "-")
                      : a.existingCustomerName
                        ? `Khách cũ: ${a.existingCustomerName}`
                        : "Khách mới"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-1 ${STATUS_CLASS[a.status]}`}
                    >
                      {STATUS_LABEL[a.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{formatDate(a.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {a.status === "fulfilled"
                      ? `${formatDate(a.fulfilledAt)}${a.fulfilledStoreCode ? ` (${a.fulfilledStoreCode})` : ""}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {a.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => void cancelAssignment(a.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50"
                      >
                        Huỷ
                      </button>
                    )}
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
