"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Prize = { id: string; label: string; isActive: boolean; sortOrder: number };
type SliceApi = {
  slotIndex: number;
  startAngle: number;
  endAngle: number;
  prizeId: string | null;
};
type ThemeElement = {
  id: string;
  kind: "image" | "text" | "wheel_disk" | "pointer";
  width: number | null;
  distancePx: number | null;
};

const POINTER_EDGE_DISTANCE_PX = 8;
const DEFAULT_DISK_WIDTH = 67.4;

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 10;
const MIN_SLICES = 2;
const MAX_SLICES = 20;
const DEFAULT_SLICE_COUNT = 4;

function evenBoundaries(count: number) {
  const sliceAngle = 360 / count;
  return Array.from({ length: count }, (_, i) => i * sliceAngle);
}

function toXY(angleDeg: number, r = RADIUS) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + r * Math.sin(rad), y: CENTER - r * Math.cos(rad) };
}

function angleFromPoint(clientX: number, clientY: number, rect: DOMRect) {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

export default function WheelCalibrator({
  wheelFaceId,
}: {
  wheelFaceId: string;
}) {
  const [name, setName] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [boundaries, setBoundaries] = useState<number[]>([]);
  const [slicePrizes, setSlicePrizes] = useState<(string | null)[]>([]);
  const [testRotation, setTestRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pointerElement, setPointerElement] = useState<ThemeElement | null>(null);
  const [diskElement, setDiskElement] = useState<ThemeElement | null>(null);
  const [pointerUpdating, setPointerUpdating] = useState(false);
  const [pointerError, setPointerError] = useState<string | null>(null);
  const draggingRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  /** The pointer/disk are shared across every wheel face (not per-face), so
   * this loads once and is independent of `load()`/`wheelFaceId` below. */
  async function loadPointerElement() {
    try {
      const res = await fetch("/api/admin/theme/elements");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Không tải được vị trí mũi tên.");
      const items: ThemeElement[] = json.items ?? [];
      setPointerElement(items.find((e) => e.kind === "pointer") ?? null);
      setDiskElement(items.find((e) => e.kind === "wheel_disk") ?? null);
    } catch (e: any) {
      setPointerError(e?.message ?? "Không tải được vị trí mũi tên.");
    }
  }

  useEffect(() => {
    void loadPointerElement();
  }, []);

  const wheelRadius = (diskElement?.width ?? DEFAULT_DISK_WIDTH) / 2;
  const pointerCenterDistancePx = -wheelRadius;
  const pointerMode: "edge" | "center" | "custom" =
    pointerElement == null
      ? "edge"
      : Math.round(pointerElement.distancePx ?? -15) === POINTER_EDGE_DISTANCE_PX
        ? "edge"
        : Math.round(pointerElement.distancePx ?? -15) === Math.round(pointerCenterDistancePx)
          ? "center"
          : "custom";

  async function setPointerMode(mode: "edge" | "center") {
    if (!pointerElement) return;
    setPointerError(null);
    setPointerUpdating(true);
    const distancePx = mode === "edge" ? POINTER_EDGE_DISTANCE_PX : pointerCenterDistancePx;
    try {
      const res = await fetch(`/api/admin/theme/elements/${pointerElement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ distancePx }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Cập nhật thất bại.");
      setPointerElement(json);
    } catch (e: any) {
      setPointerError(e?.message ?? "Cập nhật thất bại.");
    } finally {
      setPointerUpdating(false);
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [faceRes, prizesRes] = await Promise.all([
        fetch(`/api/admin/wheel-faces/${wheelFaceId}`),
        fetch("/api/admin/prizes"),
      ]);
      const face = await faceRes.json();
      const prizesJson = await prizesRes.json();
      if (!faceRes.ok) throw new Error(face.error ?? "Không tải được.");
      const activePrizes: Prize[] = (prizesJson.items ?? []).filter(
        (p: Prize) => p.isActive,
      );
      setPrizes(activePrizes);
      setName(face.name);
      setImagePath(face.imagePath);
      setIsActive(face.isActive);
      const slices: SliceApi[] = face.slices ?? [];
      if (slices.length > 0) {
        setBoundaries(slices.map((s) => s.startAngle));
        setSlicePrizes(slices.map((s) => s.prizeId));
      } else {
        // No slices saved yet — start from the standard 4 ô, cycling
        // through active prizes if there are any (or unassigned if not).
        setBoundaries(evenBoundaries(DEFAULT_SLICE_COUNT));
        setSlicePrizes(
          Array.from({ length: DEFAULT_SLICE_COUNT }, (_, i) =>
            activePrizes.length > 0 ? activePrizes[i % activePrizes.length].id : null,
          ),
        );
      }
    } catch (e: any) {
      setError(e?.message ?? "Không tải được.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wheelFaceId]);

  const n = boundaries.length;
  const [sliceCountInput, setSliceCountInput] = useState(String(n || DEFAULT_SLICE_COUNT));
  useEffect(() => {
    setSliceCountInput(String(n || DEFAULT_SLICE_COUNT));
  }, [n]);

  const unmappedActivePrizes = prizes.filter((p) => !slicePrizes.includes(p.id));

  /** Re-splits into `count` even ô — dragging fine-tunes angles afterward.
   * Existing slot→quà assignments are kept where the index still exists;
   * new slots cycle through the active-prize list so nothing starts empty
   * unless there are no active prizes at all. */
  function setSliceCount(count: number) {
    const clamped = Math.max(MIN_SLICES, Math.min(MAX_SLICES, Math.round(count)));
    if (!Number.isFinite(clamped) || clamped === n) return;
    setBoundaries(evenBoundaries(clamped));
    setSlicePrizes(
      Array.from({ length: clamped }, (_, i) => {
        if (i < slicePrizes.length) return slicePrizes[i];
        return prizes.length > 0 ? prizes[i % prizes.length].id : null;
      }),
    );
    setSaved(false);
  }

  function commitSliceCountInput() {
    const parsed = Number(sliceCountInput);
    if (Number.isFinite(parsed)) setSliceCount(parsed);
    else setSliceCountInput(String(n || DEFAULT_SLICE_COUNT));
  }

  function regenerateEven() {
    const activeN = prizes.length;
    if (activeN === 0) {
      setBoundaries([]);
      setSlicePrizes([]);
      return;
    }
    setBoundaries(evenBoundaries(activeN));
    setSlicePrizes(prizes.map((p) => p.id));
    setSaved(false);
  }

  function handlePointerDown(index: number, event: React.PointerEvent) {
    if (index === 0) return;
    draggingRef.current = index;
    (event.target as Element).setPointerCapture(event.pointerId);
    setTestRotation(0);
  }

  function handlePointerMove(event: React.PointerEvent) {
    const index = draggingRef.current;
    if (index === null || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let angle = angleFromPoint(event.clientX, event.clientY, rect);
    const prev = boundaries[index - 1];
    const next = index + 1 < boundaries.length ? boundaries[index + 1] : 360;
    const MIN_GAP = 2;
    angle = Math.max(prev + MIN_GAP, Math.min(next - MIN_GAP, angle));
    setBoundaries((current) => {
      const copy = [...current];
      copy[index] = Math.round(angle * 10) / 10;
      return copy;
    });
    setSaved(false);
  }

  function handlePointerUp() {
    draggingRef.current = null;
  }

  const slices = useMemo(
    () =>
      boundaries.map((start, i) => ({
        slotIndex: i,
        startAngle: start,
        endAngle: i + 1 < boundaries.length ? boundaries[i + 1] : 360,
        prizeId: slicePrizes[i] ?? null,
      })),
    [boundaries, slicePrizes],
  );

  const pointerOriginalAngle = (((360 - testRotation) % 360) + 360) % 360;
  const activeSliceIndex = slices.findIndex(
    (s) =>
      pointerOriginalAngle >= s.startAngle && pointerOriginalAngle < s.endAngle,
  );
  const activeSlicePrizeLabel =
    activeSliceIndex >= 0
      ? (prizes.find((p) => p.id === slices[activeSliceIndex].prizeId)
          ?.label ?? "(chưa gán quà)")
      : "-";

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/wheel-faces/${wheelFaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slices }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Lưu thất bại.");
      setSaved(true);
    } catch (e: any) {
      setError(e?.message ?? "Lưu thất bại.");
    } finally {
      setSaving(false);
    }
  }

  async function activate() {
    setError(null);
    try {
      const res = await fetch(`/api/admin/wheel-faces/${wheelFaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activate: true }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Thất bại.");
      setIsActive(true);
    } catch (e: any) {
      setError(e?.message ?? "Thất bại.");
    }
  }

  if (loading) return <div className="text-sm text-gray-500">Đang tải...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{name}</h1>
          <p className="text-sm text-gray-600">
            {n} ô · {prizes.length} quà đang bật
            {isActive && (
              <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                Đang sử dụng
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-gray-300 px-1">
            <span className="pl-1 text-sm text-gray-600">Số ô</span>
            <button
              type="button"
              onClick={() => setSliceCount(n - 1)}
              disabled={n <= MIN_SLICES}
              className="h-9 w-8 text-lg text-gray-700 disabled:opacity-30"
              title="Bớt ô"
            >
              −
            </button>
            <input
              type="number"
              min={MIN_SLICES}
              max={MAX_SLICES}
              value={sliceCountInput}
              onChange={(e) => setSliceCountInput(e.target.value)}
              onBlur={commitSliceCountInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="h-9 w-12 rounded border border-transparent px-1 text-center text-sm hover:border-gray-200 focus:border-gray-400"
            />
            <button
              type="button"
              onClick={() => setSliceCount(n + 1)}
              disabled={n >= MAX_SLICES}
              className="h-9 w-8 text-lg text-gray-700 disabled:opacity-30"
              title="Thêm ô"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={regenerateEven}
            disabled={prizes.length === 0}
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm disabled:opacity-30"
          >
            Chia đều theo {prizes.length} quà
          </button>
          {!isActive && (
            <button
              type="button"
              onClick={() => void activate()}
              className="h-9 rounded-lg bg-gray-900 px-3 text-sm text-white"
            >
              Đặt làm mặc định
            </button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-3">
        <h2 className="text-sm font-semibold text-gray-900">Vị trí mũi tên</h2>
        <p className="mt-1 text-sm text-gray-600">
          Áp dụng cho mũi tên thật trên trang khách quay (không riêng mặt vòng
          quay này). Đổi vị trí không ảnh hưởng đến việc xác định ô trúng khi
          quay — vẫn chính xác như khi ở mép vòng.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void setPointerMode("edge")}
            disabled={pointerUpdating || !pointerElement}
            className={`h-9 rounded-lg border px-3 text-sm font-medium disabled:opacity-50 ${
              pointerMode === "edge"
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 text-gray-700"
            }`}
          >
            Mép vòng quay
          </button>
          <button
            type="button"
            onClick={() => void setPointerMode("center")}
            disabled={pointerUpdating || !pointerElement}
            className={`h-9 rounded-lg border px-3 text-sm font-medium disabled:opacity-50 ${
              pointerMode === "center"
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 text-gray-700"
            }`}
          >
            Giữa vòng quay
          </button>
          {pointerUpdating && (
            <span className="self-center text-sm text-gray-500">Đang lưu...</span>
          )}
        </div>
        {pointerError && (
          <p className="mt-2 text-sm text-red-700">{pointerError}</p>
        )}
      </div>

      {unmappedActivePrizes.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Quà sau chưa được gán vào ô nào:{" "}
          <strong>{unmappedActivePrizes.map((p) => p.label).join(", ")}</strong>.
          {isActive
            ? " Vì mặt vòng quay này đang được dùng, khách quay trúng (những) quà này sẽ bị lỗi — hãy gán vào ít nhất 1 ô rồi lưu lại."
            : " Gán mỗi quà vào ít nhất 1 ô trước khi đặt mặt vòng quay này làm mặc định."}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col items-center gap-4">
          <div
            style={{ width: SIZE, height: SIZE, position: "relative" }}
            ref={containerRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: -6,
                transform: "translateX(-50%)",
                zIndex: 20,
                width: 0,
                height: 0,
                borderLeft: "10px solid transparent",
                borderRight: "10px solid transparent",
                borderTop: "16px solid #d81b21",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                overflow: "hidden",
                transform: `rotate(${testRotation}deg)`,
                transition:
                  draggingRef.current === null ? "transform 0.15s" : "none",
                border: "2px solid #f3cf8c",
                background: "#fff8dc",
              }}
            >
              {imagePath && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePath}
                  alt={name}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              )}
              <svg
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              >
                <line
                  x1={CENTER}
                  y1={CENTER}
                  x2={CENTER}
                  y2={CENTER - RADIUS}
                  stroke="white"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
                {boundaries.map((angle, i) => {
                  if (i === 0) return null;
                  const p = toXY(angle);
                  return (
                    <g key={i}>
                      <line
                        x1={CENTER}
                        y1={CENTER}
                        x2={p.x}
                        y2={p.y}
                        stroke="white"
                        strokeWidth={2}
                      />
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={9}
                        fill="#d81b21"
                        stroke="white"
                        strokeWidth={2}
                        style={{ cursor: "grab", touchAction: "none" }}
                        onPointerDown={(e) => handlePointerDown(i, e)}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
          <div className="w-full max-w-xs space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Thử quay (kéo để xem dừng ở góc này thì trúng ô nào)
            </label>
            <input
              type="range"
              min={0}
              max={360}
              value={testRotation}
              onChange={(e) => setTestRotation(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-sm text-gray-700">
              Ô đang ở vị trí mũi tên:{" "}
              <span className="font-semibold">
                {activeSliceIndex >= 0
                  ? `Ô ${activeSliceIndex + 1} — ${activeSlicePrizeLabel}`
                  : "-"}
              </span>
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">
            Gán quà cho từng ô
          </h2>
          {slices.length === 0 && (
            <p className="text-sm text-gray-500">
              Chưa có ô nào — dùng bộ đếm &quot;Số ô&quot; phía trên để tạo ô.
            </p>
          )}
          <div className="space-y-2">
            {slices.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-gray-200 p-2"
              >
                <span className="w-28 shrink-0 text-sm text-gray-600">
                  Ô {i + 1} ({s.startAngle.toFixed(0)}°–{s.endAngle.toFixed(0)}°)
                </span>
                <select
                  value={s.prizeId ?? ""}
                  onChange={(e) => {
                    const next = [...slicePrizes];
                    next[i] = e.target.value || null;
                    setSlicePrizes(next);
                    setSaved(false);
                  }}
                  className="h-9 flex-1 rounded-lg border border-gray-300 px-2 text-sm"
                >
                  <option value="">-- chọn quà --</option>
                  {prizes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {saved && !error && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              Đã lưu vị trí ô.
            </div>
          )}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || slices.length === 0}
            className="h-10 rounded-lg bg-gray-900 px-5 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Lưu vị trí ô"}
          </button>
        </div>
      </div>
    </div>
  );
}
