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

export const DEFAULT_DISK = { x: 16.3, y: 6.87, width: 67.4, height: 67.4 };
export const DEFAULT_POINTER_SIZE = 17.4;
/** How far past the rim the "Mép vòng quay" preset parks the pointer, in the
 * same percent-of-canvas unit as `distancePx`. */
export const POINTER_EDGE_DISTANCE = 8;

type DiskBox = Pick<PageThemeElement, "x" | "y" | "width" | "height">;
type PointerPlacementInput = Pick<
  PageThemeElement,
  "angleDeg" | "distancePx" | "width" | "height" | "rotation"
>;

export function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Resolves where the pointer sits relative to the wheel disk. Everything
 * that cares about the pointer — the render, the win-landing math, the admin
 * previews — goes through this, so they can't drift apart. */
function pointerPlacement(disk: DiskBox | undefined, pointer: PointerPlacementInput) {
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
  // Distance from the wheel's center to the pointer box's own center.
  const r = radius + distance;
  const width = pointer.width ?? DEFAULT_POINTER_SIZE;
  const height = pointer.height ?? DEFAULT_POINTER_SIZE;
  return {
    centerX,
    centerY,
    radius,
    r,
    angle,
    width,
    height,
    pointerCenterX: centerX + r * Math.sin(rad),
    pointerCenterY: centerY - r * Math.cos(rad),
    /** True once the badge is parked on the hub rather than somewhere out on
     * the wheel. Its own half-height is the natural cut-off: inside that the
     * artwork covers the center point itself, so where it sits stops saying
     * anything about a direction. */
    onHub: Math.abs(r) < height / 2,
  };
}

/** The pointer's position is derived from the wheel disk's box + the
 * pointer's angle/distance (not raw x/y) — see the plan's rotation-safety
 * rationale. `distancePx` is stored as percent-of-wheel-canvas-width despite
 * the column name, so this stays correct across the 420/460px breakpoints
 * without a runtime size measurement. */
export function computePointerBoxStyle(
  disk: DiskBox | undefined,
  pointer: PointerPlacementInput & Pick<PageThemeElement, "zIndex">,
): CSSProperties {
  const { pointerCenterX, pointerCenterY, width, height } = pointerPlacement(disk, pointer);
  return {
    position: "absolute",
    left: `${pointerCenterX - width / 2}%`,
    top: `${pointerCenterY - height / 2}%`,
    width: `${width}%`,
    height: `${height}%`,
    zIndex: pointer.zIndex,
    // Rotates the arrow image itself in place (around its own center) —
    // independent of angleDeg, which instead moves the pointer's position
    // around the wheel's rim.
    transform: pointer.rotation ? `rotate(${pointer.rotation}deg)` : undefined,
  };
}

/** Screen angle (0-360, clockwise from top) that the pointer visually points
 * at — the single source of truth for "which ô did the customer watch stop
 * under the arrow", so the spin animation has to land the winning slice
 * exactly here.
 *
 * Which field carries that direction depends on where the badge sits:
 *  - Out on the wheel it reads as a rim marker, so its position around the
 *    wheel (`angleDeg`) is what people follow.
 *  - On the hub its position is just "the middle" and says nothing; the only
 *    remaining cue is which way the artwork is turned, so `rotation` decides
 *    (the tip is drawn at the top of the image, i.e. rotation 0 = straight
 *    up = the ô at 0°).
 *
 * Reading `angleDeg` in both cases is what made a hub-mounted pointer land
 * the wheel one ô away from the arrow. */
export function pointerReadingAngleDeg(
  disk: DiskBox | undefined,
  pointer: PointerPlacementInput,
): number {
  const { onHub } = pointerPlacement(disk, pointer);
  return normalizeAngle(onHub ? pointer.rotation : (pointer.angleDeg ?? 0));
}

export type PointerPositionMode = "edge" | "center";

/** Which preset the pointer is currently parked at — shared so both admin
 * screens highlight the same button and agree with
 * `pointerReadingAngleDeg` about what counts as "on the hub". */
export function pointerPositionMode(
  disk: DiskBox | undefined,
  pointer: PointerPlacementInput,
): PointerPositionMode | "custom" {
  const { onHub } = pointerPlacement(disk, pointer);
  if (onHub) return "center";
  if (Math.round(pointer.distancePx ?? -15) === POINTER_EDGE_DISTANCE) return "edge";
  return "custom";
}

/** Distance + rotation for each position preset. The rotation is derived from
 * `angleDeg` so the tip keeps pointing at the same ô whichever position you
 * pick: at the rim it has to turn back inward (angle + 180), on the hub it
 * points outward along the angle itself. That's what makes moving the pointer
 * genuinely leave the winning ô alone. */
export function pointerPositionPreset(
  mode: PointerPositionMode,
  disk: DiskBox | undefined,
  pointer: PointerPlacementInput,
): { distancePx: number; rotation: number } {
  const { radius } = pointerPlacement(disk, pointer);
  const angle = normalizeAngle(pointer.angleDeg ?? 0);
  return mode === "edge"
    ? { distancePx: POINTER_EDGE_DISTANCE, rotation: normalizeAngle(angle + 180) }
    : { distancePx: -radius, rotation: angle };
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
