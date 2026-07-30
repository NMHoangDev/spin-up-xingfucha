-- Lets the admin hide/show a page_theme_element without deleting it — the
-- "Lớp" list in /admin/theme shows a tick per element (green = visible,
-- grey = hidden); the public /api/theme/active endpoint only ever returns
-- visible elements, so a hidden element never reaches the real customer
-- page regardless of what the admin canvas preview shows selected.

alter table page_theme_elements
  add column if not exists is_visible boolean not null default true;
