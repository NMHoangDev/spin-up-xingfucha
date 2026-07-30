"use client";

import { useEffect, useRef, useState } from "react";
import type { PageThemeElement } from "@/lib/db/types";
import { angleFromDiskCenter, computePointerBoxStyle, themeElementBoxStyle } from "@/lib/theme/geometry";

type ThemeLike = {
  backgroundColor: string | null;
  sectionBackgroundColor: string | null;
  sectionBackgroundImagePath: string | null;
  spinButtonColor: string;
  spinButtonTextColor: string;
  spinButtonText: string;
};

type Props = {
  theme: ThemeLike;
  wheelFaceImage?: string | null;
  elements: PageThemeElement[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<PageThemeElement>) => void;
  /** "mobile" shows the page near its natural width (edge-to-edge, like a
   * phone); "desktop" widens the surrounding viewport so the same
   * centered card is shown with more background around it — matching how
   * app/PageContent.tsx actually behaves (it's always `max-w-[440px]
   * mx-auto`, only the visible page width around it changes). */
  device: "mobile" | "desktop";
  zoom: number;
};

type CanvasKind = "header" | "wheel";

type DragState =
  | { type: "move"; canvas: CanvasKind; id: string; startClientX: number; startClientY: number; startX: number; startY: number; rectWidth: number; rectHeight: number }
  | { type: "resize"; canvas: CanvasKind; id: string; startClientX: number; startClientY: number; startWidth: number; startHeight: number; rectWidth: number; rectHeight: number }
  | { type: "rotate"; canvas: CanvasKind; id: string; centerX: number; centerY: number; startAngle: number; startRotation: number }
  | { type: "pointer-angle"; id: string; rectLeft: number; rectTop: number; rectWidth: number; rectHeight: number };

// Mirrors app/PageContent.tsx's real layout exactly (the two containers that
// hold the title/decorations and the wheel visual, plus the section's own
// padding/gap around them), so this editor shows one true-to-life composed
// preview instead of two disconnected boxes.
const HEADER_W = 320;
const HEADER_H = 112;
const WHEEL_W = 460;
const WHEEL_H = 460;
const PAD_X = 16;
const PAD_TOP = 28;
const GAP = 8;
const PAD_BOTTOM = 24;
const SECTION_W = WHEEL_W + PAD_X * 2;
const SECTION_H = PAD_TOP + HEADER_H + GAP + WHEEL_H + PAD_BOTTOM;
const HEADER_OFFSET = { x: (SECTION_W - HEADER_W) / 2, y: PAD_TOP };
const WHEEL_OFFSET = { x: (SECTION_W - WHEEL_W) / 2, y: PAD_TOP + HEADER_H + GAP };
const BUTTON_GAP = 24;
const BUTTON_H = 64;
const OUTER_PAD_Y = 24;
const MOBILE_VIEWPORT_W = SECTION_W + 48;
const DESKTOP_VIEWPORT_W = 1100;
export const PREVIEW_PAGE_HEIGHT = SECTION_H + BUTTON_GAP + BUTTON_H + OUTER_PAD_Y * 2;

/** Un-zoomed preview pixel size for a device — shared with the editor page
 * so it can compute a "fit to available space" zoom instead of a fixed one. */
export function previewWidthFor(device: "mobile" | "desktop") {
  return device === "mobile" ? MOBILE_VIEWPORT_W : DESKTOP_VIEWPORT_W;
}

/** Live position/size/rotation while a gesture is in progress lives in local
 * React state (merged onto the element for render), throttled to one update
 * per animation frame — smooth without ever letting the DOM and state
 * diverge. `onChange` (the persisted commit) fires exactly once, on
 * pointer-up. */
export default function ThemeCanvasEditor({
  theme,
  wheelFaceImage,
  elements,
  selectedId,
  onSelect,
  onChange,
  device,
  zoom,
}: Props) {
  const headerBoxRef = useRef<HTMLDivElement | null>(null);
  const wheelBoxRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragRef = useRef<DragState | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ id: string; patch: Partial<PageThemeElement> } | null>(null);
  const [live, setLive] = useState<{ id: string; patch: Partial<PageThemeElement> } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const liveElements = elements.map((e) => (live && live.id === e.id ? { ...e, ...live.patch } : e));
  const headerElements = liveElements.filter((e) => e.canvas === "header");
  const wheelElements = liveElements.filter((e) => e.canvas === "wheel");
  const diskElement = wheelElements.find((e) => e.kind === "wheel_disk");
  const pointerElement = wheelElements.find((e) => e.kind === "pointer");

  function orderForPaint(list: PageThemeElement[]) {
    return [...list].sort((a, b) => {
      const aTop = a.id === selectedId || a.id === hoveredId ? 1 : 0;
      const bTop = b.id === selectedId || b.id === hoveredId ? 1 : 0;
      return aTop - bTop || a.zIndex - b.zIndex;
    });
  }

  function scheduleLive(id: string, patch: Partial<PageThemeElement>) {
    pendingRef.current = { id, patch };
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingRef.current) setLive(pendingRef.current);
    });
  }

  function commit(id: string, patch: Partial<PageThemeElement>) {
    setLive(null);
    pendingRef.current = null;
    onChange(id, patch);
  }

  function boxRefFor(canvas: CanvasKind) {
    return canvas === "header" ? headerBoxRef.current : wheelBoxRef.current;
  }

  function startMove(event: React.PointerEvent, element: PageThemeElement) {
    event.stopPropagation();
    onSelect(element.id);
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    const rect = boxRefFor(element.canvas)?.getBoundingClientRect();
    dragRef.current = {
      type: "move",
      canvas: element.canvas,
      id: element.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: element.x,
      startY: element.y,
      rectWidth: rect?.width || 1,
      rectHeight: rect?.height || 1,
    };
  }

  function startResize(event: React.PointerEvent, element: PageThemeElement) {
    event.stopPropagation();
    onSelect(element.id);
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    const rect = boxRefFor(element.canvas)?.getBoundingClientRect();
    dragRef.current = {
      type: "resize",
      canvas: element.canvas,
      id: element.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWidth: element.width ?? 20,
      startHeight: element.height ?? 20,
      rectWidth: rect?.width || 1,
      rectHeight: rect?.height || 1,
    };
  }

  function startRotate(event: React.PointerEvent, element: PageThemeElement) {
    event.stopPropagation();
    onSelect(element.id);
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    const rect = nodeRefs.current[element.id]?.getBoundingClientRect();
    const centerX = rect ? rect.left + rect.width / 2 : event.clientX;
    const centerY = rect ? rect.top + rect.height / 2 : event.clientY;
    const startAngle =
      (Math.atan2(event.clientX - centerX, -(event.clientY - centerY)) * 180) / Math.PI;
    dragRef.current = {
      type: "rotate",
      canvas: element.canvas,
      id: element.id,
      centerX,
      centerY,
      startAngle,
      startRotation: element.rotation,
    };
  }

  function startPointerAngle(event: React.PointerEvent) {
    if (!pointerElement) return;
    event.stopPropagation();
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    const rect = wheelBoxRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      type: "pointer-angle",
      id: pointerElement.id,
      rectLeft: rect.left,
      rectTop: rect.top,
      rectWidth: rect.width,
      rectHeight: rect.height,
    };
  }

  // Every gesture's container rect is measured exactly once, at pointer-down
  // (cached on dragRef), rather than re-measured on every pointermove. All
  // deltas below are computed against that one fixed baseline plus the
  // gesture's own start values — never against the previous animation
  // frame's output — so a gesture can't drift/compound even across many
  // rAF-throttled updates.
  function handleMove(event: React.PointerEvent) {
    const state = dragRef.current;
    if (!state) return;

    if (state.type === "pointer-angle") {
      const dx = diskElement?.x ?? 16.3;
      const dy = diskElement?.y ?? 6.87;
      const dw = diskElement?.width ?? 67.4;
      const dh = diskElement?.height ?? 67.4;
      const angle = angleFromDiskCenter(
        {
          centerX: state.rectLeft + (state.rectWidth * (dx + dw / 2)) / 100,
          centerY: state.rectTop + (state.rectHeight * (dy + dh / 2)) / 100,
        },
        { x: event.clientX, y: event.clientY },
      );
      scheduleLive(state.id, { angleDeg: Math.round(angle) });
      return;
    }

    if (state.type === "move") {
      const dxPct = ((event.clientX - state.startClientX) / state.rectWidth) * 100;
      const dyPct = ((event.clientY - state.startClientY) / state.rectHeight) * 100;
      scheduleLive(state.id, { x: state.startX + dxPct, y: state.startY + dyPct });
    } else if (state.type === "resize") {
      const dxPct = ((event.clientX - state.startClientX) / state.rectWidth) * 100;
      const dyPct = ((event.clientY - state.startClientY) / state.rectHeight) * 100;
      scheduleLive(state.id, {
        width: Math.max(4, state.startWidth + dxPct),
        height: Math.max(4, state.startHeight + dyPct),
      });
    } else if (state.type === "rotate") {
      const angle =
        (Math.atan2(event.clientX - state.centerX, -(event.clientY - state.centerY)) * 180) /
        Math.PI;
      scheduleLive(state.id, {
        rotation: Math.round(state.startRotation + (angle - state.startAngle)),
      });
    }
  }

  function handleUp() {
    const state = dragRef.current;
    dragRef.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (!state) return;
    const finalPatch = pendingRef.current?.id === state.id ? pendingRef.current.patch : null;
    if (finalPatch) commit(state.id, finalPatch);
    else setLive(null);
  }

  function renderHandles(element: PageThemeElement, includeRotate: boolean) {
    const handleSize = 22 / zoom;
    return (
      <>
        <div
          onPointerDown={(e) => startResize(e, element)}
          className="absolute cursor-nwse-resize rounded-full border-2 border-white bg-[#d81b21] shadow"
          style={{ width: handleSize, height: handleSize, bottom: -handleSize / 2, right: -handleSize / 2, touchAction: "none" }}
          title="Kéo để phóng to/thu nhỏ"
        />
        {includeRotate && (
          <div
            onPointerDown={(e) => startRotate(e, element)}
            className="absolute cursor-grab rounded-full border-2 border-white bg-[#4d7c0f] shadow"
            style={{ width: handleSize, height: handleSize, top: -handleSize * 1.8, left: `calc(50% - ${handleSize / 2}px)`, touchAction: "none" }}
            title="Kéo để xoay"
          />
        )}
      </>
    );
  }

  function renderDecor(element: PageThemeElement) {
    const isSelected = selectedId === element.id;
    const isHovered = hoveredId === element.id;
    return (
      <div
        key={element.id}
        ref={(node) => {
          nodeRefs.current[element.id] = node;
        }}
        onPointerDown={(e) => startMove(e, element)}
        onPointerEnter={() => setHoveredId(element.id)}
        onPointerLeave={() => setHoveredId((id) => (id === element.id ? null : id))}
        className="cursor-move"
        style={{
          ...themeElementBoxStyle(element),
          outline: isSelected ? "2px solid #d81b21" : isHovered ? "2px dashed rgba(216,27,33,0.6)" : undefined,
          outlineOffset: 2,
          color: element.textColor ?? undefined,
          fontSize: element.fontSize ? `${element.fontSize}px` : undefined,
          fontWeight: element.kind === "text" ? 900 : undefined,
          display: element.kind === "text" ? "flex" : undefined,
          alignItems: element.kind === "text" ? "center" : undefined,
          justifyContent: element.kind === "text" ? "center" : undefined,
          textAlign: element.kind === "text" ? "center" : undefined,
          touchAction: "none",
        }}
      >
        {element.kind === "text" ? (
          element.textContent
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={element.imagePath ?? ""} alt="" className="pointer-events-none h-full w-full object-contain" draggable={false} />
        )}
        {(isSelected || isHovered) && renderHandles(element, true)}
      </div>
    );
  }

  const viewportW = previewWidthFor(device);
  const pageH = PREVIEW_PAGE_HEIGHT;

  return (
    <div style={{ width: viewportW * zoom, height: pageH * zoom }} className="relative mx-auto">
      <div
        className="absolute left-0 top-0 flex select-none flex-col items-center overflow-visible"
        style={{
          width: viewportW,
          height: pageH,
          transform: `scale(${zoom})`,
          transformOrigin: "top left",
          backgroundColor: theme.backgroundColor ?? "#f7ead1",
          paddingTop: OUTER_PAD_Y,
          paddingBottom: OUTER_PAD_Y,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onSelect(null);
        }}
      >
        {/* Section card — matches the real <section> wrapper exactly */}
        <div
          className="relative overflow-visible rounded-[34px] shadow-[0_24px_48px_rgba(120,24,30,0.12)]"
          style={{
            width: SECTION_W,
            height: SECTION_H,
            backgroundColor: theme.sectionBackgroundColor ?? "#fff8dc",
            backgroundImage: theme.sectionBackgroundImagePath ? `url('${theme.sectionBackgroundImagePath}')` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Header sub-box */}
          <div
            ref={headerBoxRef}
            className="absolute overflow-visible"
            style={{ left: HEADER_OFFSET.x, top: HEADER_OFFSET.y, width: HEADER_W, height: HEADER_H, touchAction: "none" }}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerCancel={handleUp}
          >
            {orderForPaint(headerElements).map(renderDecor)}
          </div>

          {/* Wheel sub-box */}
          <div
            ref={wheelBoxRef}
            className="absolute overflow-visible"
            style={{ left: WHEEL_OFFSET.x, top: WHEEL_OFFSET.y, width: WHEEL_W, height: WHEEL_H, touchAction: "none" }}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerCancel={handleUp}
          >
            {orderForPaint(wheelElements).map((element) => {
              const isSelected = selectedId === element.id;
              const isHovered = hoveredId === element.id;

              if (element.kind === "wheel_disk") {
                return (
                  <div
                    key={element.id}
                    ref={(node) => {
                      nodeRefs.current[element.id] = node;
                    }}
                    onPointerDown={(e) => startMove(e, element)}
                    onPointerEnter={() => setHoveredId(element.id)}
                    onPointerLeave={() => setHoveredId((id) => (id === element.id ? null : id))}
                    className={`cursor-move overflow-hidden rounded-full border-2 ${
                      isSelected ? "border-[#d81b21]" : isHovered ? "border-[#d81b21]/60" : "border-dashed border-[#d81b21]/40"
                    }`}
                    style={{ ...themeElementBoxStyle(element), touchAction: "none" }}
                  >
                    {wheelFaceImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={wheelFaceImage} alt="Mặt vòng quay" className="pointer-events-none h-full w-full object-contain" draggable={false} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#d81b21]/10 text-xs font-bold text-[#8f111a]">
                        Vòng quay
                      </div>
                    )}
                    {(isSelected || isHovered) && renderHandles(element, false)}
                  </div>
                );
              }

              if (element.kind === "pointer") {
                return (
                  <div
                    key={element.id}
                    onPointerDown={startPointerAngle}
                    className="flex cursor-grab items-center justify-center rounded-full border-2 border-[#d81b21] bg-white text-lg shadow"
                    style={{ ...computePointerBoxStyle(diskElement, element), touchAction: "none" }}
                    title="Kéo quanh vòng quay để đổi vị trí mũi tên"
                  >
                    ▼
                  </div>
                );
              }

              return renderDecor(element);
            })}
          </div>
        </div>

        {/* Button preview — position matches the real page, color/text live */}
        <div
          className="mt-6 flex items-center justify-center rounded-[24px] border-2 border-white text-xl font-black shadow-[0_8px_0_rgb(139,25,32)]"
          style={{
            width: SECTION_W,
            height: BUTTON_H,
            backgroundColor: theme.spinButtonColor,
            color: theme.spinButtonTextColor,
          }}
        >
          {theme.spinButtonText || "Quay ngay"}
        </div>
      </div>
    </div>
  );
}
