"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  Monitor,
  Save,
  Smartphone,
  Trash2,
  Type,
  Wand2,
} from "lucide-react";
import ThemeCanvasEditor, {
  PREVIEW_PAGE_HEIGHT,
  previewWidthFor,
} from "@/components/admin/ThemeCanvasEditor";
import DeviceFrame from "@/components/admin/DeviceFrame";
import RevealAnimation, {
  REVEAL_ANIMATION_OPTIONS,
  type RevealAnimationVariant,
} from "@/components/spin/RevealAnimation";
import { elementLabel } from "@/lib/theme/geometry";

type PageTheme = {
  backgroundColor: string | null;
  backgroundImagePath: string | null;
  sectionBackgroundColor: string | null;
  sectionBackgroundImagePath: string | null;
  spinButtonColor: string;
  spinButtonTextColor: string;
  spinButtonText: string;
  revealAnimation: RevealAnimationVariant;
};

type ThemeElement = {
  id: string;
  kind: "image" | "text" | "wheel_disk" | "pointer";
  canvas: "header" | "wheel";
  imagePath: string | null;
  textContent: string | null;
  textColor: string | null;
  fontSize: number | null;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  rotation: number;
  angleDeg: number | null;
  distancePx: number | null;
  zIndex: number;
  isVisible: boolean;
};

const ZOOM_STEPS = [0.5, 0.75, 1, 1.5];

const DARK_INPUT =
  "h-9 w-full rounded-lg border border-[#353534] bg-[#131313] px-2 text-sm text-[#e5e2e1] placeholder:text-[#5b5856] focus:border-[#d81b21] focus:outline-none";
const DARK_BUTTON =
  "w-full rounded-lg border border-[#353534] bg-[#131313] px-3 py-1.5 text-sm text-[#c8c5c4] hover:border-[#d81b21]/50 hover:text-[#e5e2e1] transition-colors";
const DARK_CARD = "rounded-xl border border-[#353534] bg-[#201f1f] p-3.5";

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch("/api/admin/theme/upload", {
    method: "POST",
    body: formData,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Tải ảnh thất bại.");
  return json.path;
}

export default function ThemeDesignerPage() {
  const [theme, setTheme] = useState<PageTheme | null>(null);
  const [elements, setElements] = useState<ThemeElement[]>([]);
  const [wheelFaceImage, setWheelFaceImage] = useState<string | null>(null);
  const [wheelSliceCount, setWheelSliceCount] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [previewVariant, setPreviewVariant] = useState<RevealAnimationVariant | null>(null);
  const [addTarget, setAddTarget] = useState<"header" | "wheel">("wheel");
  const [tab, setTab] = useState<"general" | "elements">("elements");
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [zoom, setZoom] = useState(1);
  const [useFit, setUseFit] = useState(true);
  const [wellSize, setWellSize] = useState({ width: 0, height: 0 });

  // Whenever the device toggle changes, snap back to "fit" so the newly
  // selected viewport is always shown in full — never behind a manual zoom
  // level chosen for the other device.
  useEffect(() => {
    setUseFit(true);
  }, [device]);

  const fitZoom = useMemo(() => {
    const contentW = previewWidthFor(device);
    const contentH = PREVIEW_PAGE_HEIGHT;
    if (wellSize.width <= 0 || wellSize.height <= 0) return 1;
    const z = Math.min(wellSize.width / contentW, wellSize.height / contentH, 1.4);
    return Math.max(0.3, Math.round(z * 100) / 100);
  }, [wellSize, device]);

  const effectiveZoom = useFit ? fitZoom : zoom;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [themeRes, elementsRes, wheelRes] = await Promise.all([
        fetch("/api/admin/theme"),
        fetch("/api/admin/theme/elements"),
        fetch("/api/wheel/active"),
      ]);
      const themeJson = await themeRes.json();
      const elementsJson = await elementsRes.json();
      const wheelJson = await wheelRes.json();
      if (!themeRes.ok) throw new Error(themeJson.error ?? "Không tải được giao diện.");
      setWheelFaceImage(wheelJson?.wheelFace?.imagePath ?? null);
      setWheelSliceCount(wheelJson?.wheelFace?.sliceCount ?? null);
      setTheme(themeJson);
      setElements(elementsJson.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Không tải được giao diện.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!previewVariant) return;
    const timer = window.setTimeout(() => setPreviewVariant(null), 6500);
    return () => window.clearTimeout(timer);
  }, [previewVariant]);

  function updateElementLocal(id: string, patch: Partial<ThemeElement>) {
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    setSaved(false);
  }

  /** Persists immediately (unlike updateElementLocal, which only stages a
   * change for the batched "Lưu tất cả") — used for actions that behave
   * like a toggle/reorder switch rather than a draft edit. */
  async function patchElementNow(id: string, patch: Partial<ThemeElement>): Promise<ThemeElement> {
    const res = await fetch(`/api/admin/theme/elements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Cập nhật thất bại.");
    return json as ThemeElement;
  }

  async function toggleVisible(element: ThemeElement) {
    setError(null);
    try {
      const updated = await patchElementNow(element.id, { isVisible: !element.isVisible });
      setElements((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    } catch (e: any) {
      setError(e?.message ?? "Cập nhật thất bại.");
    }
  }

  /** direction -1 = bring forward (toward the front of the stacking order,
   * i.e. up the Lớp list); +1 = send backward. Swaps zIndex with whichever
   * neighbor is adjacent in the current front-to-back sort, same pattern as
   * the up/down reorder arrows on the Quà tặng page. */
  async function moveLayer(element: ThemeElement, direction: -1 | 1) {
    const sorted = [...elements].sort((a, b) => b.zIndex - a.zIndex);
    const idx = sorted.findIndex((e) => e.id === element.id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    setError(null);
    try {
      const [updatedA, updatedB] = await Promise.all([
        patchElementNow(a.id, { zIndex: b.zIndex }),
        patchElementNow(b.id, { zIndex: a.zIndex }),
      ]);
      setElements((prev) =>
        prev.map((e) => {
          if (e.id === updatedA.id) return updatedA;
          if (e.id === updatedB.id) return updatedB;
          return e;
        }),
      );
    } catch (e: any) {
      setError(e?.message ?? "Cập nhật thất bại.");
    }
  }

  async function addElement(canvas: "header" | "wheel", kind: "image" | "text") {
    setError(null);
    try {
      let imagePath: string | null = null;
      if (kind === "image") {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        const file = await new Promise<File | null>((resolve) => {
          input.onchange = () => resolve(input.files?.[0] ?? null);
          input.click();
        });
        if (!file) return;
        imagePath = await uploadImage(file);
      }
      const res = await fetch("/api/admin/theme/elements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          canvas,
          imagePath,
          textContent: kind === "text" ? "Chữ mới" : undefined,
          textColor: "#8f111a",
          fontSize: 20,
          x: 30,
          y: 30,
          width: kind === "text" ? 40 : 20,
          height: kind === "text" ? 15 : 20,
          rotation: 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Thêm thất bại.");
      setElements((prev) => [...prev, json]);
      setSelectedId(json.id);
      setTab("elements");
    } catch (e: any) {
      setError(e?.message ?? "Thêm thất bại.");
    }
  }

  async function deleteSelected() {
    const target = elements.find((e) => e.id === selectedId);
    if (!target) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/theme/elements/${target.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Xoá thất bại.");
      setElements((prev) => prev.filter((e) => e.id !== target.id));
      setSelectedId(null);
    } catch (e: any) {
      setError(e?.message ?? "Xoá thất bại.");
    }
  }

  async function replaceSelectedImage() {
    const target = elements.find((e) => e.id === selectedId);
    if (!target) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    const file = await new Promise<File | null>((resolve) => {
      input.onchange = () => resolve(input.files?.[0] ?? null);
      input.click();
    });
    if (!file) return;
    try {
      const path = await uploadImage(file);
      updateElementLocal(target.id, { imagePath: path });
    } catch (e: any) {
      setError(e?.message ?? "Tải ảnh thất bại.");
    }
  }

  async function saveAll() {
    if (!theme) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await fetch("/api/admin/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(theme),
      });
      await Promise.all(
        elements.map((element) =>
          fetch(`/api/admin/theme/elements/${element.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(element),
          }),
        ),
      );
      setSaved(true);
    } catch (e: any) {
      setError(e?.message ?? "Lưu thất bại.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadThemeImage(field: "backgroundImagePath" | "sectionBackgroundImagePath") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    const file = await new Promise<File | null>((resolve) => {
      input.onchange = () => resolve(input.files?.[0] ?? null);
      input.click();
    });
    if (!file || !theme) return;
    try {
      const path = await uploadImage(file);
      setTheme({ ...theme, [field]: path });
      setSaved(false);
    } catch (e: any) {
      setError(e?.message ?? "Tải ảnh thất bại.");
    }
  }

  if (loading) return <div className="text-sm text-gray-500">Đang tải...</div>;
  if (!theme) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error ?? "Chưa có cấu hình giao diện."}
      </div>
    );
  }

  const selected = elements.find((e) => e.id === selectedId) ?? null;
  const layers = [...elements].sort((a, b) => b.zIndex - a.zIndex);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Giao diện</h1>
          <p className="mt-1 text-sm text-gray-600">
            Bên trong là bản xem trước đúng như trang thật, cập nhật ngay khi
            bạn sửa — vòng quay và tỉ lệ trúng thưởng không bị ảnh hưởng.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-sm text-green-700">Đã lưu.</span>}
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="flex h-10 items-center gap-1.5 rounded-full border border-gray-300 px-4 text-sm font-medium text-gray-700"
          >
            <ExternalLink size={14} /> Mở trang thật
          </a>
          <button
            type="button"
            onClick={() => void saveAll()}
            disabled={saving}
            className="flex h-10 items-center gap-1.5 rounded-full bg-gray-900 px-5 text-sm font-medium text-white disabled:opacity-50"
          >
            <Save size={14} /> {saving ? "Đang lưu..." : "Lưu tất cả"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Studio shell — dark "design tool" workspace: component/settings
          panel · live canvas (real page, edited in place) · properties
          panel, matching a classic 3-pane visual editor layout. */}
      <div className="overflow-hidden rounded-2xl border border-[#353534] bg-[#131313] shadow-2xl">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#353534] bg-[#1c1b1b] px-4 py-2">
          <div className="flex gap-1 rounded-lg border border-[#2a2a2a] bg-[#131313] p-1">
            <button
              type="button"
              onClick={() => setDevice("mobile")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${device === "mobile" ? "bg-[#d81b21] text-white" : "text-[#8a8785] hover:text-[#e5e2e1]"}`}
            >
              <Smartphone size={14} /> Mobile
            </button>
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${device === "desktop" ? "bg-[#d81b21] text-white" : "text-[#8a8785] hover:text-[#e5e2e1]"}`}
            >
              <Monitor size={14} /> Desktop
            </button>
          </div>
          <span className="ml-2 hidden text-[11px] uppercase tracking-widest text-[#5b5856] md:inline">
            Xem trước trực tiếp
          </span>
          <div className="ml-auto flex gap-1">
            <button
              type="button"
              onClick={() => setUseFit(true)}
              title="Tự động thu phóng để vừa khung hình, không cần cuộn"
              className={`h-7 rounded-md px-2 text-xs font-medium transition-colors ${
                useFit ? "bg-[#d81b21] text-white" : "border border-[#353534] bg-[#131313] text-[#8a8785]"
              }`}
            >
              Vừa khung {useFit ? `(${Math.round(fitZoom * 100)}%)` : ""}
            </button>
            {ZOOM_STEPS.map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => {
                  setZoom(z);
                  setUseFit(false);
                }}
                className={`h-7 rounded-md px-2 text-xs font-medium transition-colors ${
                  !useFit && zoom === z ? "bg-[#d81b21] text-white" : "border border-[#353534] bg-[#131313] text-[#8a8785]"
                }`}
              >
                {Math.round(z * 100)}%
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col xl:h-[calc(100vh_-_230px)] xl:min-h-[520px] xl:flex-row">
          {/* ── Left: add elements + layers, or page-level settings ──────── */}
          <aside className="flex w-full shrink-0 flex-col border-b border-[#353534] bg-[#1c1b1b] xl:w-[240px] xl:border-b-0 xl:border-r">
            <div className="flex border-b border-[#353534]">
              <button
                type="button"
                onClick={() => setTab("elements")}
                className={`flex-1 border-b-2 py-3 text-[11px] font-bold uppercase tracking-wide transition-colors ${tab === "elements" ? "border-[#d81b21] text-[#ff8a83]" : "border-transparent text-[#8a8785] hover:text-[#e5e2e1]"}`}
              >
                Cấu phần
              </button>
              <button
                type="button"
                onClick={() => setTab("general")}
                className={`flex-1 border-b-2 py-3 text-[11px] font-bold uppercase tracking-wide transition-colors ${tab === "general" ? "border-[#d81b21] text-[#ff8a83]" : "border-transparent text-[#8a8785] hover:text-[#e5e2e1]"}`}
              >
                Cấu hình
              </button>
            </div>

            <div className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#131313]/40 px-4 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#8a8785]">
                Trạng thái
              </span>
              <span
                className={`flex items-center gap-1 text-[10px] font-bold ${saved ? "text-green-400" : "text-amber-400"}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${saved ? "bg-green-400" : "animate-pulse bg-amber-400"}`}
                />
                {saved ? "Đã lưu" : "Có thay đổi chưa lưu"}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto">
            {tab === "elements" && (
              <div className="space-y-5 p-3.5">
                <div>
                  <h4 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#8a8785]">
                    Thêm phần tử
                  </h4>
                  <select
                    value={addTarget}
                    onChange={(e) => setAddTarget(e.target.value as "header" | "wheel")}
                    className={`${DARK_INPUT} mb-2`}
                  >
                    <option value="header">Vào tiêu đề</option>
                    <option value="wheel">Vào vòng quay</option>
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void addElement(addTarget, "image")}
                      className="group flex flex-col items-center gap-2 rounded-lg border border-[#353534] bg-[#201f1f] p-2.5 transition-colors hover:border-[#d81b21]/50 hover:bg-[#2a2a2a]"
                    >
                      <ImageIcon size={20} className="text-[#ff8a83] transition-transform group-hover:scale-110" />
                      <span className="text-[11px] text-[#c8c5c4]">Hình ảnh</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void addElement(addTarget, "text")}
                      className="group flex flex-col items-center gap-2 rounded-lg border border-[#353534] bg-[#201f1f] p-2.5 transition-colors hover:border-[#d81b21]/50 hover:bg-[#2a2a2a]"
                    >
                      <Type size={20} className="text-[#ff8a83] transition-transform group-hover:scale-110" />
                      <span className="text-[11px] text-[#c8c5c4]">Văn bản</span>
                    </button>
                  </div>
                </div>

                <div className="border-t border-[#2a2a2a] pt-4">
                  <h4 className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#8a8785]">
                    <Layers size={12} /> Lớp ({elements.length})
                  </h4>
                  <div className="space-y-1">
                    {layers.map((element, idx) => (
                      <div
                        key={element.id}
                        className={`flex items-center gap-1 rounded-lg pr-1 transition-colors ${
                          selectedId === element.id ? "bg-[#d81b21]" : "hover:bg-[#2a2a2a]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => void toggleVisible(element)}
                          title={element.isVisible ? "Đang hiện — bấm để ẩn" : "Đang ẩn — bấm để hiện"}
                          className="shrink-0 p-1.5"
                        >
                          <CheckCircle2
                            size={15}
                            className={element.isVisible ? "text-green-400" : "text-gray-600"}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedId(element.id)}
                          className={`min-w-0 flex-1 truncate py-2 text-left text-[12px] ${
                            selectedId === element.id ? "text-white" : "text-[#c8c5c4]"
                          }`}
                        >
                          {elementLabel(element)}
                        </button>
                        <button
                          type="button"
                          onClick={() => void moveLayer(element, -1)}
                          disabled={idx === 0}
                          title="Đưa lên trên (tăng layer)"
                          className={`shrink-0 rounded p-1 disabled:opacity-20 ${selectedId === element.id ? "text-white" : "text-[#8a8785] hover:text-[#e5e2e1]"}`}
                        >
                          <ChevronUp size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void moveLayer(element, 1)}
                          disabled={idx === layers.length - 1}
                          title="Đưa xuống dưới (lùi layer)"
                          className={`shrink-0 rounded p-1 disabled:opacity-20 ${selectedId === element.id ? "text-white" : "text-[#8a8785] hover:text-[#e5e2e1]"}`}
                        >
                          <ChevronDown size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === "general" && (
              <div className="space-y-4 p-3.5">
                <section className={DARK_CARD}>
                  <h2 className="text-sm font-semibold text-[#e5e2e1]">Nền</h2>
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-[#a19d9c]">Màu nền trang</label>
                      <input
                        type="color"
                        value={theme.backgroundColor ?? "#f7ead1"}
                        onChange={(e) => {
                          setTheme({ ...theme, backgroundColor: e.target.value });
                          setSaved(false);
                        }}
                        className="h-9 w-16 rounded border border-[#353534] bg-[#131313]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void uploadThemeImage("backgroundImagePath")}
                      className={DARK_BUTTON}
                    >
                      Đổi ảnh nền trang
                    </button>
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-[#a19d9c]">Màu nền khối vòng quay</label>
                      <input
                        type="color"
                        value={theme.sectionBackgroundColor ?? "#fff8dc"}
                        onChange={(e) => {
                          setTheme({ ...theme, sectionBackgroundColor: e.target.value });
                          setSaved(false);
                        }}
                        className="h-9 w-16 rounded border border-[#353534] bg-[#131313]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void uploadThemeImage("sectionBackgroundImagePath")}
                      className={DARK_BUTTON}
                    >
                      Đổi ảnh nền khối vòng quay
                    </button>
                  </div>
                </section>

                <section className={DARK_CARD}>
                  <h2 className="text-sm font-semibold text-[#e5e2e1]">Nút &quot;Quay ngay&quot;</h2>
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-[#a19d9c]">Màu nút</label>
                      <input
                        type="color"
                        value={theme.spinButtonColor}
                        onChange={(e) => {
                          setTheme({ ...theme, spinButtonColor: e.target.value });
                          setSaved(false);
                        }}
                        className="h-9 w-16 rounded border border-[#353534] bg-[#131313]"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-[#a19d9c]">Màu chữ</label>
                      <input
                        type="color"
                        value={theme.spinButtonTextColor}
                        onChange={(e) => {
                          setTheme({ ...theme, spinButtonTextColor: e.target.value });
                          setSaved(false);
                        }}
                        className="h-9 w-16 rounded border border-[#353534] bg-[#131313]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm text-[#a19d9c]">Chữ trên nút</label>
                      <input
                        value={theme.spinButtonText}
                        onChange={(e) => {
                          setTheme({ ...theme, spinButtonText: e.target.value });
                          setSaved(false);
                        }}
                        className={DARK_INPUT}
                      />
                    </div>
                  </div>
                </section>

                <section className={DARK_CARD}>
                  <h2 className="text-sm font-semibold text-[#e5e2e1]">Hiệu ứng mở quà</h2>
                  <div className="mt-3 space-y-2">
                    {REVEAL_ANIMATION_OPTIONS.map((opt) => (
                      <div
                        key={opt.value}
                        className={`flex items-center justify-between rounded-lg border p-2.5 ${
                          theme.revealAnimation === opt.value
                            ? "border-[#d81b21] bg-[#d81b21]/10"
                            : "border-[#353534]"
                        }`}
                      >
                        <span className="text-sm font-medium text-[#e5e2e1]">{opt.label}</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setTheme({ ...theme, revealAnimation: opt.value });
                              setSaved(false);
                            }}
                            className="rounded-md bg-[#d81b21] px-2 py-1 text-xs text-white"
                          >
                            {theme.revealAnimation === opt.value ? "Đang chọn" : "Chọn"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewVariant(opt.value)}
                            className="rounded-md border border-[#353534] px-2 py-1 text-xs text-[#c8c5c4]"
                          >
                            Xem
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
            </div>
          </aside>

          {/* ── Center: live preview (this IS the real page, edited in place) */}
          <div className="flex min-w-0 flex-1 flex-col border-b border-[#353534] xl:border-b-0 xl:border-r">
            <DeviceFrame device={device} onWellResize={setWellSize}>
              <ThemeCanvasEditor
                theme={theme}
                wheelFaceImage={wheelFaceImage}
                elements={elements}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onChange={updateElementLocal}
                device={device}
                zoom={effectiveZoom}
              />
            </DeviceFrame>
            <p
              className="shrink-0 truncate border-t border-[#2a2a2a] bg-[#1c1b1b] px-4 py-1.5 text-[10px] text-[#8a8785]"
              title="Rê chuột vào một phần tử để hiện tay cầm kéo ngay (không cần bấm chọn trước) · kéo thân phần tử để di chuyển · kéo tay cầm đỏ để phóng to/thu nhỏ · tay cầm xanh để xoay · kéo mũi tên quanh vòng tròn để đổi hướng."
            >
              💡 Rê chuột để hiện tay cầm kéo · kéo thân để di chuyển · tay cầm đỏ = resize · xanh = xoay · kéo mũi tên quanh vòng để đổi hướng
            </p>
          </div>

          {/* ── Right: properties of the selected element ─────────────────── */}
          <aside className="flex w-full shrink-0 flex-col bg-[#1c1b1b] xl:w-[288px]">
            <div className="shrink-0 border-b border-[#353534] p-3.5">
              <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#e5e2e1]">
                <Wand2 size={16} className="text-[#ff8a83]" /> Chỉnh sửa trực quan
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5">
              {!selected && (
                <p className="py-10 text-center text-[12px] leading-5 text-[#8a8785]">
                  Chọn một phần tử trên canvas hoặc trong danh sách Lớp để
                  chỉnh sửa.
                </p>
              )}

              {selected && (
                <section className={DARK_CARD}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-[#e5e2e1]">
                      {selected.kind === "wheel_disk"
                        ? "Vòng quay"
                        : selected.kind === "pointer"
                          ? "Mũi tên"
                          : "Phần tử"}
                    </h2>
                    {selected.kind !== "wheel_disk" && selected.kind !== "pointer" && (
                      <button
                        type="button"
                        onClick={() => void deleteSelected()}
                        className="flex items-center gap-1 rounded-md border border-red-900/50 px-2 py-1 text-xs text-red-400 hover:bg-red-950/40"
                      >
                        <Trash2 size={12} /> Xoá
                      </button>
                    )}
                  </div>

                  {selected.kind === "wheel_disk" && (
                    <p className="mt-3 rounded-lg bg-amber-950/40 p-2.5 text-xs leading-5 text-amber-200">
                      Mặt vòng quay hiện có <strong>{wheelSliceCount ?? "?"} ô</strong>. Số ô
                      không giới hạn ở 4 — vào <strong>Quà tặng</strong> để bật thêm quà, rồi
                      sang <strong>Vòng quay → Chỉnh vị trí</strong> để chia lại ô theo đúng
                      số quà đang bật. Ở đây chỉ chỉnh vị trí/kích thước hiển thị của đĩa
                      quay, không đổi số ô.
                    </p>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {selected.kind !== "pointer" && (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs text-[#a19d9c]">X (%)</label>
                          <input
                            type="number"
                            value={Math.round(selected.x)}
                            onChange={(e) => updateElementLocal(selected.id, { x: Number(e.target.value) })}
                            className={DARK_INPUT}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-[#a19d9c]">Y (%)</label>
                          <input
                            type="number"
                            value={Math.round(selected.y)}
                            onChange={(e) => updateElementLocal(selected.id, { y: Number(e.target.value) })}
                            className={DARK_INPUT}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-[#a19d9c]">Rộng (%)</label>
                          <input
                            type="number"
                            value={Math.round(selected.width ?? 0)}
                            onChange={(e) => updateElementLocal(selected.id, { width: Number(e.target.value) })}
                            className={DARK_INPUT}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-[#a19d9c]">Cao (%)</label>
                          <input
                            type="number"
                            value={Math.round(selected.height ?? 0)}
                            onChange={(e) => updateElementLocal(selected.id, { height: Number(e.target.value) })}
                            className={DARK_INPUT}
                          />
                        </div>
                      </>
                    )}
                    {selected.kind !== "wheel_disk" && selected.kind !== "pointer" && (
                      <div className="col-span-2 space-y-1">
                        <label className="text-xs text-[#a19d9c]">Xoay (độ)</label>
                        <input
                          type="number"
                          value={Math.round(selected.rotation)}
                          onChange={(e) => updateElementLocal(selected.id, { rotation: Number(e.target.value) })}
                          className={DARK_INPUT}
                        />
                      </div>
                    )}
                    {selected.kind === "pointer" && (
                      <>
                        <div className="col-span-2 space-y-1">
                          <label className="text-xs text-[#a19d9c]">Góc quanh vòng quay (độ)</label>
                          <input
                            type="number"
                            value={Math.round(selected.angleDeg ?? 0)}
                            onChange={(e) => updateElementLocal(selected.id, { angleDeg: Number(e.target.value) })}
                            className={DARK_INPUT}
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <label className="text-xs text-[#a19d9c]">
                            Khoảng cách (% bán kính, âm = lấn vào trong)
                          </label>
                          <input
                            type="number"
                            value={Math.round(selected.distancePx ?? -15)}
                            onChange={(e) => updateElementLocal(selected.id, { distancePx: Number(e.target.value) })}
                            className={DARK_INPUT}
                          />
                          <p className="text-[10px] leading-4 text-[#5b5856]">
                            Gợi ý: để mũi tên nằm sát viền vòng quay (không bị
                            lọt vào giữa hoặc bắn ra phía đối diện), dùng
                            khoảng <strong>−15 đến +15</strong> — quan sát
                            canvas bên trái khi gõ số để chỉnh cho đúng mắt.
                          </p>
                        </div>
                        <div className="col-span-2 space-y-1">
                          <label className="text-xs text-[#a19d9c]">Kích thước (%)</label>
                          <input
                            type="number"
                            value={Math.round(selected.width ?? 17.4)}
                            onChange={(e) =>
                              updateElementLocal(selected.id, {
                                width: Number(e.target.value),
                                height: Number(e.target.value),
                              })
                            }
                            className={DARK_INPUT}
                          />
                        </div>
                      </>
                    )}
                    {selected.kind === "text" && (
                      <>
                        <div className="col-span-2 space-y-1">
                          <label className="text-xs text-[#a19d9c]">Nội dung</label>
                          <input
                            value={selected.textContent ?? ""}
                            onChange={(e) => updateElementLocal(selected.id, { textContent: e.target.value })}
                            className={DARK_INPUT}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-[#a19d9c]">Màu chữ</label>
                          <input
                            type="color"
                            value={selected.textColor ?? "#8f111a"}
                            onChange={(e) => updateElementLocal(selected.id, { textColor: e.target.value })}
                            className="h-9 w-full rounded border border-[#353534] bg-[#131313]"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-[#a19d9c]">Cỡ chữ (px)</label>
                          <input
                            type="number"
                            value={selected.fontSize ?? 16}
                            onChange={(e) => updateElementLocal(selected.id, { fontSize: Number(e.target.value) })}
                            className={DARK_INPUT}
                          />
                        </div>
                      </>
                    )}
                    {(selected.kind === "image" || selected.kind === "pointer") && (
                      <div className="col-span-2 space-y-1">
                        <button
                          type="button"
                          onClick={() => void replaceSelectedImage()}
                          className={DARK_BUTTON}
                        >
                          Đổi ảnh
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          </aside>
        </div>
      </div>

      {previewVariant && <RevealAnimation variant={previewVariant} playing={true} />}
    </div>
  );
}
