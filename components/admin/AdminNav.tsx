"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin/conditions", label: "Điều kiện" },
  { href: "/admin/prizes", label: "Quà tặng" },
  { href: "/admin/assign", label: "Chỉ định quà" },
  { href: "/admin/wheel", label: "Vòng quay" },
  { href: "/admin/theme", label: "Giao diện" },
  { href: "/admin/stores", label: "Cửa hàng" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1">
      {LINKS.map((link) => {
        const active =
          link.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-gray-900 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
