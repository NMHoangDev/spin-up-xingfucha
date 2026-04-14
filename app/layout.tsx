import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";
import Providers from "@/components/providers";
import FirebaseInit from "@/components/firebase-init";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin", "vietnamese"],
  variable: "--font-plus-jakarta-sans",
});

export const metadata: Metadata = {
  title: "XingFuCha Spin & Win",
  description:
    "A gamified landing page for XingFuCha beverage brand featuring a spin-the-wheel reward system.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={plusJakartaSans.variable}>
      <body suppressHydrationWarning className="font-sans">
        <FirebaseInit />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
