import { createCanvas } from "@napi-rs/canvas";

const COLOR = {
  grid: "#e5e7eb",
  text: "#374151",
  title: "#111827",
};

export function renderVerticalBarChart(params: {
  title: string;
  labels: string[];
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}): { buffer: Buffer; width: number; height: number } {
  const width = params.width ?? 900;
  const height = params.height ?? 420;
  const color = params.color ?? "#d81b21";
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = COLOR.title;
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(params.title, 24, 32);

  const padding = { top: 60, right: 30, bottom: 76, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const n = params.labels.length;
  const maxValue = Math.max(1, ...params.values, 0);

  const gridLines = 4;
  ctx.strokeStyle = COLOR.grid;
  ctx.fillStyle = COLOR.text;
  ctx.font = "12px sans-serif";
  ctx.textAlign = "right";
  for (let i = 0; i <= gridLines; i++) {
    const v = Math.round((maxValue * i) / gridLines);
    const y = padding.top + chartHeight - (chartHeight * i) / gridLines;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillText(String(v), padding.left - 8, y + 4);
  }

  if (n > 0) {
    const barGap = 10;
    const barWidth = Math.max(6, (chartWidth - barGap * (n - 1)) / n);

    params.values.forEach((value, i) => {
      const barHeight = maxValue > 0 ? (value / maxValue) * chartHeight : 0;
      const x = padding.left + i * (barWidth + barGap);
      const y = padding.top + chartHeight - barHeight;

      ctx.fillStyle = color;
      ctx.fillRect(x, y, barWidth, barHeight);

      ctx.fillStyle = COLOR.text;
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      if (value > 0) ctx.fillText(String(value), x + barWidth / 2, y - 6);

      ctx.save();
      ctx.translate(x + barWidth / 2, padding.top + chartHeight + 18);
      const label = params.labels[i];
      if (n > 10) {
        ctx.rotate(-Math.PI / 4);
        ctx.textAlign = "right";
      } else {
        ctx.textAlign = "center";
      }
      ctx.fillText(label, 0, 0);
      ctx.restore();
    });
  }

  ctx.strokeStyle = COLOR.text;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + chartHeight);
  ctx.lineTo(width - padding.right, padding.top + chartHeight);
  ctx.stroke();

  return { buffer: canvas.toBuffer("image/png"), width, height };
}

export function renderHorizontalBarChart(params: {
  title: string;
  labels: string[];
  values: number[];
  width?: number;
  color?: string;
}): { buffer: Buffer; width: number; height: number } {
  const width = params.width ?? 900;
  const rowHeight = 32;
  const padding = { top: 60, right: 60, bottom: 24, left: 190 };
  const n = params.labels.length;
  const height = padding.top + padding.bottom + Math.max(1, n) * rowHeight;
  const color = params.color ?? "#b45309";
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = COLOR.title;
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(params.title, 24, 32);

  const chartWidth = width - padding.left - padding.right;
  const maxValue = Math.max(1, ...params.values, 0);

  params.labels.forEach((label, i) => {
    const value = params.values[i];
    const y = padding.top + i * rowHeight;
    const barW = maxValue > 0 ? (value / maxValue) * chartWidth : 0;

    ctx.fillStyle = COLOR.text;
    ctx.font = "13px sans-serif";
    ctx.textAlign = "right";
    let displayLabel = label;
    while (
      ctx.measureText(displayLabel).width > padding.left - 16 &&
      displayLabel.length > 3
    ) {
      displayLabel = displayLabel.slice(0, -2) + "…";
    }
    ctx.fillText(displayLabel, padding.left - 12, y + rowHeight / 2 + 4);

    ctx.fillStyle = color;
    ctx.fillRect(padding.left, y + 6, barW, rowHeight - 12);

    ctx.fillStyle = COLOR.text;
    ctx.textAlign = "left";
    ctx.font = "12px sans-serif";
    ctx.fillText(String(value), padding.left + barW + 8, y + rowHeight / 2 + 4);
  });

  return { buffer: canvas.toBuffer("image/png"), width, height };
}
