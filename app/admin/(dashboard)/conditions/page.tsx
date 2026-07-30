"use client";

import { useEffect, useState } from "react";

type Settings = {
  activeWheelFaceId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  maxSpinsPerCustomerPerDay: number;
  walletEnabled: boolean;
  voucherUsableFrom: string | null;
  voucherExpiresAt: string | null;
  voucherActivationDelayMinutes: number | null;
  voucherValidityDays: number | null;
  maxVoucherUsesPerDay: number;
  minInvoiceAmount: number | null;
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

export default function ConditionsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Không tải được cấu hình.");
      setSettings(json);
    } catch (e: any) {
      setError(e?.message ?? "Không tải được cấu hình.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: settings.startsAt,
          endsAt: settings.endsAt,
          maxSpinsPerCustomerPerDay: settings.maxSpinsPerCustomerPerDay,
          walletEnabled: settings.walletEnabled,
          voucherUsableFrom: settings.voucherUsableFrom,
          voucherExpiresAt: settings.voucherExpiresAt,
          voucherActivationDelayMinutes: settings.voucherActivationDelayMinutes,
          voucherValidityDays: settings.voucherValidityDays,
          maxVoucherUsesPerDay: settings.maxVoucherUsesPerDay,
          minInvoiceAmount: settings.minInvoiceAmount,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Lưu thất bại.");
      setSettings(json);
      setSaved(true);
    } catch (e: any) {
      setError(e?.message ?? "Lưu thất bại.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Đang tải...</div>;
  }
  if (!settings) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error ?? "Chưa có cấu hình."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Điều kiện chương trình</h1>
        <p className="mt-1 text-sm text-gray-600">
          Thời gian áp dụng, giới hạn lượt quay và điều kiện dùng quà.
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">
          Thời gian chương trình
        </h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Bắt đầu (để trống = không giới hạn)
            </label>
            <input
              type="datetime-local"
              value={toLocalInput(settings.startsAt)}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  startsAt: fromLocalInput(e.target.value),
                })
              }
              className="h-10 w-full rounded-lg border border-gray-300 px-3"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Kết thúc (để trống = không giới hạn)
            </label>
            <input
              type="datetime-local"
              value={toLocalInput(settings.endsAt)}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  endsAt: fromLocalInput(e.target.value),
                })
              }
              className="h-10 w-full rounded-lg border border-gray-300 px-3"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">Giới hạn lượt quay</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Số lượt quay tối đa / khách / ngày
            </label>
            <input
              type="number"
              min={1}
              value={settings.maxSpinsPerCustomerPerDay}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  maxSpinsPerCustomerPerDay: Math.max(1, Number(e.target.value) || 1),
                })
              }
              className="h-10 w-full rounded-lg border border-gray-300 px-3"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">Điều kiện hoá đơn</h2>
        <p className="mt-1 text-sm text-gray-600">
          Khách chỉ được quay khi nhập số tiền hoá đơn từ mức này trở lên. Để
          trống nếu không yêu cầu hoá đơn.
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Hoá đơn tối thiểu (VNĐ)
            </label>
            <input
              type="number"
              min={0}
              step={1000}
              placeholder="Để trống = không yêu cầu"
              value={settings.minInvoiceAmount ?? ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  minInvoiceAmount:
                    e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                })
              }
              className="h-10 w-full rounded-lg border border-gray-300 px-3"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Kho quà (ví thưởng)
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Bật: khách quay xong lưu vào kho quà, dùng theo điều kiện thời
              gian bên dưới. Tắt: khách quay xong nhận quà ngay, không có kho
              quà.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={settings.walletEnabled}
              onChange={(e) =>
                setSettings({ ...settings, walletEnabled: e.target.checked })
              }
              className="h-5 w-5"
            />
            <span className="text-sm font-medium text-gray-700">
              {settings.walletEnabled ? "Đang bật" : "Đang tắt"}
            </span>
          </label>
        </div>

        {settings.walletEnabled && (
          <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">
                Cách 1 — Khoảng thời gian cố định (áp dụng cho mọi voucher trong
                chương trình)
              </h3>
              <div className="mt-2 grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Dùng được từ
                  </label>
                  <input
                    type="datetime-local"
                    value={toLocalInput(settings.voucherUsableFrom)}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        voucherUsableFrom: fromLocalInput(e.target.value),
                      })
                    }
                    className="h-10 w-full rounded-lg border border-gray-300 px-3"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Hết hạn lúc
                  </label>
                  <input
                    type="datetime-local"
                    value={toLocalInput(settings.voucherExpiresAt)}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        voucherExpiresAt: fromLocalInput(e.target.value),
                      })
                    }
                    className="h-10 w-full rounded-lg border border-gray-300 px-3"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-800">
                Cách 2 — Tính theo thời điểm trúng thưởng (chỉ áp dụng khi Cách
                1 để trống)
              </h3>
              <div className="mt-2 grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Trễ kích hoạt (phút)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={settings.voucherActivationDelayMinutes ?? 0}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        voucherActivationDelayMinutes: Math.max(
                          0,
                          Number(e.target.value) || 0,
                        ),
                      })
                    }
                    className="h-10 w-full rounded-lg border border-gray-300 px-3"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Hiệu lực (số ngày)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={settings.voucherValidityDays ?? 30}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        voucherValidityDays: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className="h-10 w-full rounded-lg border border-gray-300 px-3"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Số voucher tối đa được dùng / khách / ngày
                </label>
                <input
                  type="number"
                  min={1}
                  value={settings.maxVoucherUsesPerDay}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maxVoucherUsesPerDay: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  className="h-10 w-full rounded-lg border border-gray-300 px-3"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {saved && !error && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Đã lưu cấu hình.
        </div>
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="h-10 rounded-lg bg-gray-900 px-5 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Đang lưu..." : "Lưu cấu hình"}
      </button>
    </div>
  );
}
