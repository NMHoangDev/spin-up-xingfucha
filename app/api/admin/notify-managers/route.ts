import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/gmail";

export const dynamic = "force-dynamic";

type StoreRow = { code: string; name: string; manager_email: string };

function formatDateTime(iso: string | null): string {
  if (!iso) return "Không giới hạn";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatVnd(amount: number): string {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

function buildEmailHtml(input: {
  stores: { code: string; name: string; link: string; qrCid: string }[];
  startsAt: string | null;
  endsAt: string | null;
  minInvoiceAmount: number | null;
  maxSpinsPerCustomerPerDay: number;
  walletEnabled: boolean;
  prizeLabels: string[];
}): string {
  const storeRows = input.stores
    .map(
      (s) => `
        <tr>
          <td style="padding:8px 12px;border:1px solid #eee;font-weight:600;">${s.name} (${s.code})</td>
          <td style="padding:8px 12px;border:1px solid #eee;">
            <a href="${s.link}" style="color:#d81b21;">${s.link}</a>
          </td>
          <td style="padding:8px 12px;border:1px solid #eee;text-align:center;">
            <div style="font-weight:700;font-size:13px;color:#111827;margin-bottom:6px;">${s.name} (${s.code})</div>
            <a href="${s.link}"><img src="cid:${s.qrCid}" alt="Mã QR ${s.name}" width="120" height="120" style="display:block;margin:0 auto;" /></a>
            <div style="font-size:11px;color:#999;margin-top:4px;">Chạm giữ / bấm phải để lưu ảnh</div>
          </td>
        </tr>`,
    )
    .join("");

  const conditionItems = [
    `Thời gian chương trình: <strong>${formatDateTime(input.startsAt)}</strong> đến <strong>${formatDateTime(input.endsAt)}</strong>`,
    `Số lượt quay tối đa: <strong>${input.maxSpinsPerCustomerPerDay} lượt/khách/ngày</strong>`,
    input.minInvoiceAmount != null
      ? `Hoá đơn tối thiểu để quay: <strong>${formatVnd(input.minInvoiceAmount)}</strong>`
      : null,
    input.walletEnabled
      ? "Quà trúng được lưu vào kho quà, khách tự vào dùng sau (không nhận ngay)."
      : "Khách nhận quà ngay sau khi quay (không qua kho quà).",
  ].filter(Boolean);

  const prizeItems = input.prizeLabels.map((label) => `<li>${label}</li>`).join("");

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#333;">
    <h2 style="color:#d81b21;">Thông tin chương trình Vòng quay may mắn — Xing Fu Cha</h2>
    <p>Chào anh/chị quản lý,</p>
    <p>Dưới đây là đường link vòng quay may mắn cho (các) cửa hàng anh/chị phụ trách, cùng thời gian và điều kiện áp dụng hiện tại:</p>
    <table style="border-collapse:collapse;width:100%;margin:12px 0;">
      <thead>
        <tr>
          <th style="padding:8px 12px;border:1px solid #eee;text-align:left;background:#fafafa;">Cửa hàng</th>
          <th style="padding:8px 12px;border:1px solid #eee;text-align:left;background:#fafafa;">Link vòng quay</th>
          <th style="padding:8px 12px;border:1px solid #eee;text-align:center;background:#fafafa;">Mã QR</th>
        </tr>
      </thead>
      <tbody>${storeRows}</tbody>
    </table>
    <h3 style="color:#8f111a;">Thời gian &amp; điều kiện</h3>
    <ul>${conditionItems.map((item) => `<li>${item}</li>`).join("")}</ul>
    <h3 style="color:#8f111a;">Các phần quà đang áp dụng</h3>
    <ul>${prizeItems || "<li>Chưa có quà nào đang bật.</li>"}</ul>
    <p style="margin-top:24px;color:#888;font-size:12px;">
      Email được gửi tự động từ hệ thống quản trị Vòng quay may mắn Xing Fu Cha.
    </p>
  </div>`;
}

export async function POST(request: Request) {
  const supabase = createSupabaseServiceClient();

  const [{ data: storeRows, error: storesError }, { data: settingsRow, error: settingsError }, { data: prizeRows, error: prizesError }] =
    await Promise.all([
      supabase.from("stores").select("code, name, manager_email").not("manager_email", "is", null),
      supabase.from("campaign_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("prizes").select("label").eq("is_active", true).order("sort_order", { ascending: true }),
    ]);

  if (storesError) return NextResponse.json({ error: storesError.message }, { status: 500 });
  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 });
  if (prizesError) return NextResponse.json({ error: prizesError.message }, { status: 500 });
  if (!settingsRow) return NextResponse.json({ error: "campaign_not_configured" }, { status: 400 });

  const origin = new URL(request.url).origin;
  const prizeLabels = (prizeRows ?? []).map((p) => p.label as string);

  const eligibleStores = (storeRows ?? []).filter(
    (s): s is StoreRow => typeof s.manager_email === "string" && s.manager_email.trim() !== "",
  );

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const groups = new Map<string, { code: string; name: string; link: string; qrCid: string }[]>();
  const invalidStores: { code: string; name: string; managerEmail: string }[] = [];

  for (const store of eligibleStores) {
    const managerEmail = store.manager_email.trim();
    const addresses = managerEmail.split(/[,;]/).map((a) => a.trim());
    if (addresses.some((a) => !emailRegex.test(a))) {
      invalidStores.push({ code: store.code, name: store.name, managerEmail });
      continue;
    }
    const list = groups.get(managerEmail) ?? [];
    list.push({
      code: store.code,
      name: store.name,
      link: `${origin}/?store=${encodeURIComponent(store.code)}`,
      qrCid: `qr-${store.code}@xingfucha`,
    });
    groups.set(managerEmail, list);
  }

  const allStoreCodesWithManager = new Set(eligibleStores.map((s) => s.code));
  const { data: allStores } = await supabase.from("stores").select("code, name");
  const skippedNoManager = (allStores ?? [])
    .filter((s) => !allStoreCodesWithManager.has(s.code))
    .map((s) => ({ code: s.code, name: s.name }));

  const sent: string[] = [];
  const failed: { managerEmail: string; error: string }[] = [];

  for (const [managerEmail, stores] of groups) {
    const html = buildEmailHtml({
      stores,
      startsAt: settingsRow.starts_at,
      endsAt: settingsRow.ends_at,
      minInvoiceAmount: settingsRow.min_invoice_amount === null ? null : Number(settingsRow.min_invoice_amount),
      maxSpinsPerCustomerPerDay: settingsRow.max_spins_per_customer_per_day,
      walletEnabled: settingsRow.wallet_enabled,
      prizeLabels,
    });
    const storeNames = stores.map((s) => s.name).join(", ");
    try {
      const attachments = await Promise.all(
        stores.map(async (s) => ({
          filename: `QR-${s.code}.png`,
          content: await QRCode.toBuffer(s.link, { width: 240, margin: 1 }),
          cid: s.qrCid,
          contentType: "image/png",
        })),
      );
      await sendEmail({
        to: managerEmail,
        subject: `[Xing Fu Cha] Thông tin vòng quay may mắn — ${storeNames}`,
        html,
        attachments,
      });
      sent.push(managerEmail);
    } catch (error) {
      failed.push({
        managerEmail,
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  return NextResponse.json({
    sentCount: sent.length,
    sent,
    failed,
    skippedNoManager,
    invalidStores,
  });
}
