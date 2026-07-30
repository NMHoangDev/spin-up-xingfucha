import ExcelJS from "exceljs";
import { renderHorizontalBarChart, renderVerticalBarChart } from "./render-chart";

export type ExportSpinRow = {
  name: string;
  phone: string;
  storeCode: string;
  storeName: string;
  rewardLabel: string;
  rewardCode: string | null;
  status: "used" | "unused";
  voucherUsableFrom: string | null;
  voucherExpiresAt: string | null;
  usedAt: string | null;
  invoiceAmount: number | null;
  createdAt: string;
};

export type ExportAnalytics = {
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

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF111827" },
};
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFE5E7EB" } },
  bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
  left: { style: "thin", color: { argb: "FFE5E7EB" } },
  right: { style: "thin", color: { argb: "FFE5E7EB" } },
};

function widthFor(values: string[], header: string, min = 12, max = 42) {
  const longest = values.reduce((m, v) => Math.max(m, (v ?? "").length), header.length);
  return Math.min(max, Math.max(min, longest + 2));
}

function statusLabel(row: ExportSpinRow): string {
  if (!row.voucherUsableFrom && !row.voucherExpiresAt && row.status === "used") {
    return "Dùng ngay";
  }
  return row.status === "used" ? "Đã dùng" : "Chưa dùng";
}

export async function buildSpinReportWorkbook(params: {
  analytics: ExportAnalytics;
  rows: ExportSpinRow[];
  rangeLabel: string;
  storeLabel: string;
}): Promise<ExcelJS.Buffer> {
  const { analytics, rows, rangeLabel, storeLabel } = params;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Xing Fu Cha Spin Admin";
  workbook.created = new Date();

  // ── Sheet 1: Tổng quan ──────────────────────────────────────────────
  const overview = workbook.addWorksheet("Tổng quan", {
    views: [{ showGridLines: false }],
  });
  overview.getColumn(1).width = 3;
  overview.getColumn(2).width = 34;
  overview.getColumn(3).width = 16;

  overview.mergeCells("B2:F2");
  const titleCell = overview.getCell("B2");
  titleCell.value = "BÁO CÁO VÒNG QUAY MAY MẮN — XING FU CHA";
  titleCell.font = { bold: true, size: 16, color: { argb: "FF8F111A" } };

  overview.mergeCells("B3:F3");
  const subtitleCell = overview.getCell("B3");
  subtitleCell.value = `Khoảng thời gian: ${rangeLabel}  ·  Cửa hàng: ${storeLabel}  ·  Xuất lúc: ${new Date().toLocaleString("vi-VN")}`;
  subtitleCell.font = { italic: true, size: 11, color: { argb: "FF6B7280" } };

  let r = 5;
  overview.getCell(`B${r}`).value = "CHỈ SỐ TỔNG QUAN";
  overview.getCell(`B${r}`).font = { bold: true, size: 12 };
  r += 1;

  const kpiRows: [string, number][] = [
    ["Tổng lượt quay (trong khoảng đã chọn)", analytics.kpis.totalSpins],
    ["Khách hàng riêng biệt", analytics.kpis.uniqueCustomers],
    ["Lượt quay hôm nay", analytics.kpis.spinsToday],
    ["Lượt quay tuần này", analytics.kpis.spinsThisWeek],
    ["Lượt quay tháng này", analytics.kpis.spinsThisMonth],
  ];
  for (const [label, value] of kpiRows) {
    const labelCell = overview.getCell(`B${r}`);
    const valueCell = overview.getCell(`C${r}`);
    labelCell.value = label;
    valueCell.value = value;
    valueCell.font = { bold: true };
    valueCell.alignment = { horizontal: "right" };
    labelCell.border = { bottom: { style: "hair", color: { argb: "FFE5E7EB" } } };
    valueCell.border = { bottom: { style: "hair", color: { argb: "FFE5E7EB" } } };
    r += 1;
  }

  r += 2;
  const dayChart = renderVerticalBarChart({
    title: "Lượt quay theo ngày",
    labels: analytics.byDay.map((d) => d.date.slice(5)),
    values: analytics.byDay.map((d) => d.count),
  });
  overview.addImage(
    workbook.addImage({ buffer: dayChart.buffer as any, extension: "png" }),
    { tl: { col: 1, row: r - 1 }, ext: { width: dayChart.width, height: dayChart.height } },
  );
  r += Math.ceil(dayChart.height / 20) + 2;

  const storeChart = renderHorizontalBarChart({
    title: "Lượt quay theo cửa hàng",
    labels: analytics.byStore.map((s) => `${s.storeCode} — ${s.storeName}`),
    values: analytics.byStore.map((s) => s.count),
    color: "#b45309",
  });
  overview.addImage(
    workbook.addImage({ buffer: storeChart.buffer as any, extension: "png" }),
    { tl: { col: 1, row: r - 1 }, ext: { width: storeChart.width, height: storeChart.height } },
  );
  r += Math.ceil(storeChart.height / 20) + 2;

  const prizeChart = renderHorizontalBarChart({
    title: "Lượt quay theo quà tặng",
    labels: analytics.byPrize.map((p) => p.label),
    values: analytics.byPrize.map((p) => p.count),
    color: "#4d7c0f",
  });
  overview.addImage(
    workbook.addImage({ buffer: prizeChart.buffer as any, extension: "png" }),
    { tl: { col: 1, row: r - 1 }, ext: { width: prizeChart.width, height: prizeChart.height } },
  );

  // ── Sheet 2: Chi tiết ───────────────────────────────────────────────
  const detail = workbook.addWorksheet("Chi tiết", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const dateFmt = "dd/mm/yyyy hh:mm";
  detail.columns = [
    { header: "Tên", key: "name", width: widthFor(rows.map((r) => r.name), "Tên") },
    { header: "Số điện thoại", key: "phone", width: widthFor(rows.map((r) => r.phone), "Số điện thoại") },
    {
      header: "Cửa hàng",
      key: "store",
      width: widthFor(rows.map((r) => `${r.storeCode} — ${r.storeName}`), "Cửa hàng"),
    },
    { header: "Quà", key: "reward", width: widthFor(rows.map((r) => r.rewardLabel), "Quà") },
    { header: "Mã quà", key: "code", width: widthFor(rows.map((r) => r.rewardCode ?? ""), "Mã quà") },
    { header: "Số tiền hoá đơn (VNĐ)", key: "invoiceAmount", width: 22 },
    { header: "Thời gian quay", key: "createdAt", width: 20 },
    { header: "Trạng thái", key: "status", width: 14 },
    { header: "Dùng được từ", key: "usableFrom", width: 20 },
    { header: "Hết hạn", key: "expiresAt", width: 20 },
    { header: "Đã dùng lúc", key: "usedAt", width: 20 },
  ];

  const headerRow = detail.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = THIN_BORDER;
  });
  headerRow.height = 22;

  for (const row of rows) {
    const excelRow = detail.addRow({
      name: row.name,
      phone: row.phone,
      store: `${row.storeCode} — ${row.storeName}`,
      reward: row.rewardLabel,
      code: row.rewardCode ?? "",
      invoiceAmount: row.invoiceAmount ?? "",
      createdAt: new Date(row.createdAt),
      status: statusLabel(row),
      usableFrom: row.voucherUsableFrom ? new Date(row.voucherUsableFrom) : "",
      expiresAt: row.voucherExpiresAt ? new Date(row.voucherExpiresAt) : "",
      usedAt: row.usedAt ? new Date(row.usedAt) : "",
    });
    excelRow.eachCell((cell) => {
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: "middle", wrapText: false };
    });
    ["createdAt", "usableFrom", "expiresAt", "usedAt"].forEach((key) => {
      const cell = excelRow.getCell(key);
      if (cell.value instanceof Date) cell.numFmt = dateFmt;
    });
    if (typeof row.invoiceAmount === "number") {
      excelRow.getCell("invoiceAmount").numFmt = '#,##0"đ"';
    }
  }

  detail.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: detail.columns.length },
  };

  return workbook.xlsx.writeBuffer();
}
