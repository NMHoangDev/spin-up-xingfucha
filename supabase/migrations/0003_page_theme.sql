-- Admin-customizable page design layer for the customer spin page.
-- Two fixed reference canvases match the two existing layout containers in
-- app/PageContent.tsx exactly, so x/y/width/height (all percent) need no
-- extra transform at render time:
--   'header' canvas = the title/decoration box   (320 x 112 css px)
--   'wheel'  canvas = the wheel visual box        (460 x 460 css px, sm breakpoint)
-- This keeps the seed conversion (and every future edit) simple percentage
-- math instead of a merged/offset coordinate space.

create table if not exists page_theme (
  id smallint primary key default 1 check (id = 1),
  background_color text,
  background_image_path text,
  section_background_color text,
  section_background_image_path text,
  spin_button_color text not null default '#d81b21',
  spin_button_text_color text not null default '#f2f6dd',
  spin_button_text text not null default 'Quay ngay',
  reveal_animation text not null default 'box_open'
    check (reveal_animation in ('box_open', 'fireworks', 'curtain')),
  updated_at timestamptz not null default now()
);

create table if not exists page_theme_elements (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('image', 'text', 'wheel_disk', 'pointer')),
  canvas text not null check (canvas in ('header', 'wheel')),
  image_path text,
  text_content text,
  text_color text,
  font_size int,
  x numeric not null default 50,
  y numeric not null default 50,
  width numeric,
  height numeric,
  rotation numeric not null default 0,
  angle_deg numeric,
  distance_px numeric,
  z_index int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_page_theme_elements_canvas on page_theme_elements (canvas);

alter table page_theme enable row level security;
alter table page_theme_elements enable row level security;
