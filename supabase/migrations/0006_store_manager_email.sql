-- Lets the admin record which manager(s) to notify for each store. A single
-- manager overseeing several stores just gets the same email value on each
-- of those store rows — "Thông báo đến các quản lý" groups by this value so
-- that manager gets one consolidated email instead of one per store.
-- Comma/semicolon-separated addresses are supported per store for the rare
-- case a store has more than one manager to notify.

alter table stores
  add column if not exists manager_email text;
