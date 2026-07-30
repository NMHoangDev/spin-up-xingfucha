"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type WheelFace = {
  id: string;
  name: string;
  imagePath: string;
  sliceCount: number;
  isActive: boolean;
};

export default function WheelFacesPage() {
  const [faces, setFaces] = useState<WheelFace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/wheel-faces");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Không tải được danh sách.");
      setFaces(json.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Không tải được danh sách.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("image", file);
      const res = await fetch("/api/admin/wheel-faces", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Tải ảnh thất bại.");
      setName("");
      setFile(null);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Tải ảnh thất bại.");
    } finally {
      setUploading(false);
    }
  }

  async function activate(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/wheel-faces/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activate: true }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Thất bại.");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Thất bại.");
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/wheel-faces/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Xoá thất bại.");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Xoá thất bại.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Vòng quay</h1>
        <p className="mt-1 text-sm text-gray-600">
          Tải ảnh mặt vòng quay mới, sau đó vào &quot;Chỉnh vị trí&quot; để
          chia ô và gán quà cho từng ô — hệ thống sẽ biết quay tới đâu là
          trúng quà nào. Mặt vòng quay mới mặc định có 4 ô, vào &quot;Chỉnh vị
          trí&quot; để thêm/bớt ô và kéo chỉnh góc tuỳ ý.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">
          Thêm mặt vòng quay mới
        </h2>

        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-semibold">Thông số ảnh chuẩn cho mặt vòng quay:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Tỉ lệ vuông <strong>1:1</strong> (ví dụ 1000×1000px, tối thiểu 800×800px).</li>
            <li>
              Định dạng <strong>PNG hoặc WebP có nền trong suốt</strong> (alpha) ở
              phần ngoài vòng tròn — hệ thống không tự bo tròn ảnh, vòng tròn
              phải được vẽ sẵn trong file.
            </li>
            <li>Vẽ vòng tròn sát viền khung hình, không chừa lề thừa xung quanh.</li>
            <li>Dung lượng file tối đa <strong>5MB</strong>.</li>
            <li>
              Quy ước góc: <strong>0° là vị trí mũi tên (12 giờ)</strong>, tính
              theo chiều kim đồng hồ — dùng để tham khảo khi chia ô, có thể
              chỉnh lại chính xác sau khi tải lên ở bước &quot;Chỉnh vị
              trí&quot;.
            </li>
            <li>
              Khung viền ngoài và mũi tên hiện tại giữ nguyên, không đổi qua ảnh
              tải lên — chỉ đĩa xoay (mặt vòng quay) này thay đổi.
            </li>
          </ul>
        </div>

        <form onSubmit={upload} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Tên</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-10 w-56 rounded-lg border border-gray-300 px-3"
              placeholder="Vòng quay hè 2026"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Ảnh mặt vòng quay
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
              className="text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="h-10 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {uploading ? "Đang tải..." : "Tải lên"}
          </button>
        </form>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading && <div className="text-sm text-gray-500">Đang tải...</div>}
        {!loading && faces.length === 0 && (
          <div className="text-sm text-gray-500">Chưa có mặt vòng quay nào.</div>
        )}
        {faces.map((f) => (
          <div
            key={f.id}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <div className="relative mx-auto h-40 w-40 overflow-hidden rounded-full border border-gray-100 bg-gray-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.imagePath}
                alt={f.name}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="mt-3 text-center">
              <p className="font-semibold text-gray-900">{f.name}</p>
              <p className="text-sm text-gray-500">{f.sliceCount} ô</p>
              {f.isActive && (
                <span className="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  Đang sử dụng
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Link
                href={`/admin/wheel/${f.id}`}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Chỉnh vị trí
              </Link>
              {!f.isActive && (
                <button
                  type="button"
                  onClick={() => void activate(f.id)}
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm text-white"
                >
                  Đặt làm mặc định
                </button>
              )}
              {!f.isActive && (
                <button
                  type="button"
                  onClick={() => void remove(f.id)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                >
                  Xoá
                </button>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
