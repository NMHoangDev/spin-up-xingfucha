-- Xing Fu Cha spin wheel — starter data
-- Run this once, after 0001_init.sql, in the Supabase SQL editor.
-- Safe to re-run (idempotent via ON CONFLICT DO NOTHING / DO UPDATE).

-- 11 stores provided by the business.
insert into stores (code, name) values
  ('107NGT', '107 Ngô Gia Tự'),
  ('130LĐ', '130 Lê Độ'),
  ('167VTD', '167 Văn Tiến Dũng'),
  ('180LTN', '180 Lê Thanh Nghị'),
  ('185HVN', '185 Huỳnh Văn Nghệ'),
  ('216TNT', '216 Trần Nhân Tông'),
  ('285PDP', '285 Phan Đình Phùng, Quảng Ngãi'),
  ('30NTN', '30 Ngô Thì Nhậm'),
  ('40PNX', '40 Phạm Như Xương'),
  ('892TCV', '892 Trần Cao Vân'),
  ('DT605', 'Đường tỉnh 605, Hòa Tiến')
on conflict (code) do nothing;

-- Starter prizes — same 4 rewards the app already used (lib/rewards/rewards.ts),
-- now DB-driven and admin-editable. Fixed ids so the seed wheel face below can
-- reference them directly and the seed stays idempotent.
insert into prizes (id, label, code, weight, is_active, sort_order) values
  ('10000000-0000-0000-0000-000000000001', '1 Topping bất kỳ', 'TOPPING', 25, true, 0),
  ('10000000-0000-0000-0000-000000000002', '1 Trà sữa bất kỳ (M)', 'TRA-SUA-M', 25, true, 1),
  ('10000000-0000-0000-0000-000000000003', '1 Nước dừa bất kỳ (L)', 'NUOCDUA-L', 25, true, 2),
  ('10000000-0000-0000-0000-000000000004', '1 Trà trái cây bất kỳ (L)', 'TRA-TRAI-CAY-L', 25, true, 3)
on conflict (id) do nothing;

-- Default wheel face — reuses the existing public/images/vongtron.webp artwork
-- (already baked with 4 even quarters) so the app works immediately without
-- requiring the admin to upload/calibrate anything on day one.
insert into wheel_faces (id, name, image_path, slice_count, is_active) values
  ('20000000-0000-0000-0000-000000000001', 'Vòng quay mặc định (4 quà)', '/images/vongtron.webp', 4, true)
on conflict (id) do nothing;

-- Slice centers match the existing client rotation formula exactly:
-- center = index * (360/4) + (360/4)/2 = index*90 + 45.
insert into wheel_slices (wheel_face_id, slot_index, start_angle, end_angle, prize_id) values
  ('20000000-0000-0000-0000-000000000001', 0, 0,   90,  '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000001', 1, 90,  180, '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000001', 2, 180, 270, '10000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000001', 3, 270, 360, '10000000-0000-0000-0000-000000000004')
on conflict (wheel_face_id, slot_index) do nothing;

-- Default campaign settings: wallet (kho quà) ON by default — matches the
-- app's current live behaviour — open-ended campaign (no start/end date until
-- the admin sets one), 3 spins/customer/day, 3 voucher-uses/day, vouchers
-- valid 30 days from win time (no activation delay) until the admin
-- configures a fixed calendar window instead.
insert into campaign_settings (
  id, active_wheel_face_id, starts_at, ends_at, max_spins_per_customer_per_day,
  wallet_enabled, voucher_usable_from, voucher_expires_at,
  voucher_activation_delay_minutes, voucher_validity_days, max_voucher_uses_per_day
) values (
  1, '20000000-0000-0000-0000-000000000001', null, null, 3,
  true, null, null,
  0, 30, 3
)
on conflict (id) do update set
  active_wheel_face_id = excluded.active_wheel_face_id
  where campaign_settings.active_wheel_face_id is null;

-- Default page theme + layout elements — reproduces today's hardcoded
-- PageContent.tsx layout exactly (same images, positions, rotations,
-- pointer at angle 0° = top, matching the existing rotation formula), so
-- nothing visually changes until an admin edits something in /admin/theme.
insert into page_theme (
  id, background_color, background_image_path,
  section_background_color, section_background_image_path,
  spin_button_color, spin_button_text_color, spin_button_text, reveal_animation
) values (
  1, '#f7ead1', '/images/background.webp',
  null, '/images/nenchosectionvongquay.webp',
  '#d81b21', '#f2f6dd', 'Quay ngay', 'box_open'
)
on conflict (id) do nothing;

-- Header canvas (320 x 112 css px) — title text + the 4 small decorations
-- orbiting it.
insert into page_theme_elements (
  id, kind, canvas, image_path, text_content, text_color, font_size,
  x, y, width, height, rotation, z_index
) values
  ('30000000-0000-0000-0000-000000000001', 'text', 'header', null,
   'Vòng Xing May Mắn', '#8f111a', 30,
   0, 0, 100, 100, 0, 1),
  ('30000000-0000-0000-0000-000000000002', 'image', 'header', '/images/vuongmien.webp', null, null, null,
   -7.5, 0, 15, 42.9, 0, 1),
  ('30000000-0000-0000-0000-000000000003', 'image', 'header', '/images/blinkicon.webp', null, null, null,
   -6.25, 44.6, 9.4, 26.8, 0, 1),
  ('30000000-0000-0000-0000-000000000004', 'image', 'header', '/images/hopquafull.webp', null, null, null,
   87.5, 28.6, 22.5, 64.3, 20, 1),
  ('30000000-0000-0000-0000-000000000005', 'image', 'header', '/images/blink2.webp', null, null, null,
   72.5, -35.7, 22.5, 64.3, 20, 1)
on conflict (id) do nothing;

-- Wheel canvas (460 x 460 css px, sm breakpoint) — frame, the wheel-disk /
-- pointer placeholders (position-only; their own artwork+angle stay governed
-- by /admin/wheel and the pointer's angle_deg respectively), and the 5 side
-- decorations.
insert into page_theme_elements (
  id, kind, canvas, image_path, x, y, width, height, rotation, angle_deg, distance_px, z_index
) values
  ('30000000-0000-0000-0000-000000000010', 'image', 'wheel', '/images/khungvongquay.webp',
   0, 0, 100, 100, 0, null, null, 0),
  ('30000000-0000-0000-0000-000000000011', 'wheel_disk', 'wheel', null,
   16.3, 6.87, 67.4, 67.4, 0, null, null, 1),
  ('30000000-0000-0000-0000-000000000012', 'pointer', 'wheel', '/images/muiten.webp',
   50, 50, 17.4, 17.4, 0, 0, -150, 2),
  ('30000000-0000-0000-0000-000000000013', 'image', 'wheel', '/images/tui3gang.webp',
   -15.2, 80.4, 21.7, 21.7, -15, null, null, 3),
  ('30000000-0000-0000-0000-000000000014', 'image', 'wheel', '/images/quat.webp',
   2.2, 84.8, 19.6, 19.6, 20, null, null, 4),
  ('30000000-0000-0000-0000-000000000015', 'image', 'wheel', '/images/binhnuoc.webp',
   -5.4, 83.7, 19.6, 19.6, 4, null, null, 5),
  ('30000000-0000-0000-0000-000000000016', 'image', 'wheel', '/images/iconnguongmo.webp',
   69.6, 76.1, 39.1, 39.1, 0, null, null, 6),
  ('30000000-0000-0000-0000-000000000017', 'image', 'wheel', '/images/HopQua.webp',
   -8.7, 83.7, 33.7, 33.7, 10, null, null, 7)
on conflict (id) do nothing;
