import type { CSSProperties } from "react";
import type { PageThemeElement } from "@/lib/db/types";

/** Shared by the customer page and the admin canvas editor, so both agree on
 * exactly how percent-based element data turns into pixels. */
export function themeElementBoxStyle(element: PageThemeElement): CSSProperties {
  return {
    position: "absolute",
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: element.width != null ? `${element.width}%` : undefined,
    height: element.height != null ? `${element.height}%` : undefined,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.zIndex,
  };
}

const DEFAULT_DISK = { x: 16.3, y: 6.87, width: 67.4, height: 67.4 };

/** The pointer's position is derived from the wheel disk's box + the
 * pointer's angle/distance (not raw x/y) — see the plan's rotation-safety
 * rationale. `distancePx` is stored as percent-of-wheel-canvas-width despite
 * the column name, so this stays correct across the 420/460px breakpoints
 * without a runtime size measurement. */
export function computePointerBoxStyle(
  disk: Pick<PageThemeElement, "x" | "y" | "width" | "height"> | undefined,
  pointer: Pick<PageThemeElement, "angleDeg" | "distancePx" | "width" | "height" | "zIndex">,
): CSSProperties {
  const dx = disk?.x ?? DEFAULT_DISK.x;
  const dy = disk?.y ?? DEFAULT_DISK.y;
  const dw = disk?.width ?? DEFAULT_DISK.width;
  const dh = disk?.height ?? DEFAULT_DISK.height;
  const centerX = dx + dw / 2;
  const centerY = dy + dh / 2;
  const radius = dw / 2;
  const angle = pointer.angleDeg ?? 0;
  // -150 was the original fallback here and is what caused the pointer to
  // land past the disk's center (radius ~34 + (-150) ⇒ deep negative
  // radius, wrapping to the opposite side) — kept only as a last-resort
  // default since the one real pointer row always has an explicit value;
  // -15 sits just inside the rim, matching the intended "slightly overlaps
  // the wheel" look.
  const distance = pointer.distancePx ?? -15;
  const rad = (angle * Math.PI) / 180;
  const r = radius + distance;
  const pointerCenterX = centerX + r * Math.sin(rad);
  const pointerCenterY = centerY - r * Math.cos(rad);
  const width = pointer.width ?? 17.4;
  const height = pointer.height ?? 17.4;
  return {
    position: "absolute",
    left: `${pointerCenterX - width / 2}%`,
    top: `${pointerCenterY - height / 2}%`,
    width: `${width}%`,
    height: `${height}%`,
    zIndex: pointer.zIndex,
  };
}

export function elementLabel(element: PageThemeElement): string {
  const place = element.canvas === "header" ? "tiêu đề" : "vòng quay";
  if (element.kind === "wheel_disk") return "🎡 Vòng quay (đĩa xoay)";
  if (element.kind === "pointer") return "📍 Mũi tên";
  if (element.kind === "text") return `🔤 ${element.textContent?.trim() || "(chữ trống)"} · ${place}`;
  const filename = element.imagePath?.split("/").pop()?.split("?")[0] ?? "hình ảnh";
  return `🖼️ ${decodeURIComponent(filename)} · ${place}`;
}

/** Angle (0-360, clockwise from top) of a point relative to the wheel disk's
 * center — used by the admin editor's "drag the pointer around the wheel"
 * handle. `rect`/`point` are both in the same pixel coordinate space (e.g.
 * both relative to the canvas container). */
export function angleFromDiskCenter(
  disk: { centerX: number; centerY: number },
  point: { x: number; y: number },
): number {
  const dx = point.x - disk.centerX;
  const dy = point.y - disk.centerY;
  let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}
