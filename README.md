<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Xing Fu Cha — Vòng quay may mắn

## Chạy local

**Yêu cầu:** Node.js 20+

1. Cài dependencies: `npm install`
2. Điền `.env.local` (xem mục Supabase bên dưới)
3. Chạy: `npm run dev`

## Supabase (bắt buộc — toàn bộ dữ liệu quay/quà/khách hàng/admin)

App dùng Supabase (Postgres + Auth + Storage) làm backend duy nhất cho luồng quay.

Env cần thiết trong `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (bí mật, chỉ dùng server-side)

Thiết lập schema (chạy 1 lần trong Supabase Dashboard → SQL Editor, theo đúng thứ tự):
1. `supabase/migrations/0001_init.sql` — bảng dữ liệu (stores, prizes, wheel_faces, wheel_slices, campaign_settings, spins) + hàm `fn_spin`/`fn_redeem_voucher`.
2. `supabase/migrations/0002_analytics.sql` — hàm tổng hợp số liệu cho trang admin (`fn_admin_analytics`).
3. `supabase/seed.sql` — 11 cửa hàng, 4 quà mặc định, 1 mặt vòng quay mặc định, cấu hình chương trình mặc định.

Storage: cần 1 bucket public tên `wheel-faces` (dùng để lưu ảnh mặt vòng quay admin tải lên).

Tài khoản admin: tạo trong Supabase Dashboard → Authentication → Users (email/password) để đăng nhập `/admin`.

## Kiến trúc

- `/` — trang khách quay, nhận `?store=<mã cửa hàng>` trên URL để gắn nhãn cửa hàng cho lượt quay. Gọi `POST /api/spin` (chọn quà theo trọng số, ghi DB) và `GET /api/wheel/active` (ảnh + vị trí ô đang dùng). Nếu admin bật "Kho quà", khách còn dùng `GET /api/wallet` + `POST /api/voucher/redeem` để xem/dùng quà sau.
- `/admin` — quản trị (yêu cầu đăng nhập qua Supabase Auth, được bảo vệ bởi `middleware.ts`): điều kiện chương trình, danh sách quà, mặt vòng quay (upload ảnh + công cụ chia ô/gán quà bằng kéo-thả), danh sách cửa hàng, dashboard số liệu (ngày/tuần/tháng, biểu đồ, xuất Excel).
- Trò chơi "Topping Catch" (`/api/leaderboard`, `components/game/ToppingCatchGame.tsx`) là tính năng riêng, vẫn dùng MySQL (`MYSQL_*` trong `.env.local`), không liên quan tới vòng quay.
