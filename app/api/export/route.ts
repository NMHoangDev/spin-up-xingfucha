import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TITLE = "TỔNG HỢP SỐ LƯỢNG QUAY SPIN UP TẠI XING FUCHA";

type SpinResult = {
  name?: unknown;
  phone?: unknown;
  rewardLabel?: unknown;
  rewardCode?: unknown;
  spinCount?: unknown;
  createdAt?: unknown;
};

type UserAggregate = {
  name: string;
  phone: string;
  totalSpins: number;
  rewards: Map<string, number>;
};

function normalizeString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizePhone(v: unknown): string {
  return normalizeString(v);
}

function normalizeSpinCount(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

function addToMap(map: Map<string, number>, key: string, inc: number) {
  map.set(key, (map.get(key) ?? 0) + inc);
}

function rewardSummary(rewards: Map<string, number>): string {
  const entries = Array.from(rewards.entries());
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries.map(([label, count]) => `${label} (${count})`).join(", ");
}

async function fetchAllSpinResults(): Promise<SpinResult[]> {
  const db = getDb();
  const snap = await db.collection("spin_results").get();
  return snap.docs.map((d: any) => d.data() as SpinResult);
}

function aggregateSpinResults(docs: SpinResult[]) {
  const byPhone = new Map<string, UserAggregate>();
  const globalRewards = new Map<string, number>();

  let totalSpins = 0;

  for (const d of docs) {
    const phone = normalizePhone(d.phone);
    if (!phone) continue;

    const name = normalizeString(d.name);
    const rewardLabel = normalizeString(d.rewardLabel) || "(Unknown)";
    const spins = normalizeSpinCount(d.spinCount);

    totalSpins += spins;

    let agg = byPhone.get(phone);
    if (!agg) {
      agg = {
        name: name || "",
        phone,
        totalSpins: 0,
        rewards: new Map(),
      };
      byPhone.set(phone, agg);
    }

    if (!agg.name && name) agg.name = name;
    agg.totalSpins += spins;

    addToMap(agg.rewards, rewardLabel, spins);
    addToMap(globalRewards, rewardLabel, spins);
  }

  const users = Array.from(byPhone.values());
  users.sort((a, b) => a.phone.localeCompare(b.phone));

  const items = Array.from(globalRewards.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const totalCustomers = byPhone.size;
  const totalItems = items.reduce((s, it) => s + it.count, 0);

  return { users, items, summary: { totalCustomers, totalSpins, totalItems } };
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF3F4F6" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    };
  });
}

function styleBodyRow(row: ExcelJS.Row) {
  row.alignment = { vertical: "top", horizontal: "left", wrapText: true };
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    };
  });
}

async function buildWorkbook() {
  const docs = await fetchAllSpinResults();
  const { users, items, summary } = aggregateSpinResults(docs);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Spin Report");

  ws.columns = [
    { key: "name", width: 28 },
    { key: "phone", width: 18 },
    { key: "spins", width: 12 },
    { key: "items", width: 60 },
  ];

  // Title
  ws.mergeCells("A1:D1");
  const titleCell = ws.getCell("A1");
  titleCell.value = TITLE;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 28;

  // Table 1 header
  const headerRowIndex = 3;
  const headerRow = ws.getRow(headerRowIndex);
  headerRow.values = [
    "Tên khách hàng",
    "Số điện thoại",
    "Số lần quay",
    "Item nhận được",
  ];
  styleHeaderRow(headerRow);

  // Table 1 body
  let rowIndex = headerRowIndex + 1;
  for (const u of users) {
    const r = ws.getRow(rowIndex++);
    r.values = [u.name, u.phone, u.totalSpins, rewardSummary(u.rewards)];
    styleBodyRow(r);
  }

  // Summary block
  rowIndex += 1;

  const summaryHeader = ws.getRow(rowIndex++);
  summaryHeader.values = [
    "Tổng khách hàng",
    "Tổng lượt quay",
    "Tổng item đã tặng",
  ];
  summaryHeader.font = { bold: true };
  summaryHeader.alignment = { vertical: "middle", horizontal: "center" };

  const summaryRow = ws.getRow(rowIndex++);
  summaryRow.values = [
    summary.totalCustomers,
    summary.totalSpins,
    summary.totalItems,
  ];
  summaryRow.alignment = { vertical: "middle", horizontal: "center" };

  // Keep summary in A-C, leave D blank
  ws.getCell(`D${summaryHeader.number}`).value = "";
  ws.getCell(`D${summaryRow.number}`).value = "";

  // Table 2
  rowIndex += 2;
  const table2Header = ws.getRow(rowIndex++);
  table2Header.values = ["Tên item", "Số lượng"];
  table2Header.font = { bold: true };
  table2Header.alignment = { vertical: "middle", horizontal: "center" };

  for (const it of items) {
    const r = ws.getRow(rowIndex++);
    r.values = [it.label, it.count];
    r.alignment = { vertical: "middle", horizontal: "left" };
  }

  // Make sure rows are committed
  ws.eachRow((r) => r.commit());

  return wb;
}

export async function GET() {
  try {
    const wb = await buildWorkbook();
    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(Buffer.from(buffer as ArrayBuffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=spin-report.xlsx",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Failed to export", detail },
      { status: 500 },
    );
  }
}
