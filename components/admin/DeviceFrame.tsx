"use client";

import { useEffect, useRef } from "react";

/** Browser-chrome strip + scrollable content well for the theme editor's
 * live preview. Deliberately has no border/shadow/rounded corners of its
 * own — it renders as one seamless region inside the single outer editor
 * shell in `app/admin/(dashboard)/theme/page.tsx`, not a separate floating
 * card next to the settings sidebar. Dark "studio" chrome; the content well
 * itself still renders the real page's own (light) background untouched.
 * Reports the well's actual content-box size (after its own `p-6` padding)
 * so the page can compute a zoom that fits the preview exactly, instead of
 * a fixed zoom that may need scrolling. */
export default function DeviceFrame({
  device,
  children,
  onWellResize,
}: {
  device: "mobile" | "desktop";
  children: React.ReactNode;
  onWellResize?: (size: { width: number; height: number }) => void;
}) {
  const wellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = wellRef.current;
    if (!el || !onWellResize) return;
    const report = () => {
      const style = window.getComputedStyle(el);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      onWellResize({ width: el.clientWidth - padX, height: el.clientHeight - padY });
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onWellResize]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-[#353534] bg-[#1c1b1b] px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <div className="ml-2 flex-1 truncate rounded-md border border-[#353534] bg-[#131313] px-3 py-1 text-xs text-[#8a8785]">
          {device === "mobile" ? "📱 " : "🖥️ "}
          xingfucha-spin-up.vercel.app
        </div>
      </div>
      <div ref={wellRef} className="min-h-0 flex-1 overflow-auto bg-[#0e0e0e] p-6">
        {children}
      </div>
    </div>
  );
}
