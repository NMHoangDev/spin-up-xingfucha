"use client";

import { useEffect, useRef } from "react";

/** Detects a new deployment while a customer has this tab open in the
 * background (switched apps, locked their phone, etc.) and reloads once
 * they come back to it — so they never spin against stale JS after a fix
 * ships. Silent by design: reload only happens when the tab regains focus,
 * never mid-interaction. */
export default function VersionWatcher() {
  const versionRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchVersion(): Promise<string | null> {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const json = await res.json();
        return typeof json.version === "string" ? json.version : null;
      } catch {
        return null;
      }
    }

    (async () => {
      const initial = await fetchVersion();
      if (!cancelled) versionRef.current = initial;
    })();

    async function checkAndReload() {
      if (document.visibilityState !== "visible") return;
      const current = await fetchVersion();
      if (!current) return;
      // No baseline yet — the load-time fetch raced us or failed outright
      // (offline on a phone is routine). Adopt this reading as the baseline
      // instead of returning, otherwise a single failed first fetch would
      // leave the ref null and this watcher dead for the whole session.
      if (!versionRef.current) {
        versionRef.current = current;
        return;
      }
      if (current !== versionRef.current) window.location.reload();
    }

    // `focus` covers the cases visibilitychange misses — desktop window
    // switching, and browsers that keep a backgrounded tab "visible".
    document.addEventListener("visibilitychange", checkAndReload);
    window.addEventListener("focus", checkAndReload);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", checkAndReload);
      window.removeEventListener("focus", checkAndReload);
    };
  }, []);

  return null;
}
