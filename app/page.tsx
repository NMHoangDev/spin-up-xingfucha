"use client";

import { useEffect, useState, Suspense } from "react";
import PageContent from "./PageContent";

export default function Page() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!mounted) return null;

  return (
    <Suspense fallback={null}>
      <PageContent />
    </Suspense>
  );
}
