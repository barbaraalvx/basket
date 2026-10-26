-- Optional wholesale price: applies when the bought quantity reaches wholesale_min_qty

alter table public.items
  add column wholesale_price numeric(10, 2) check (wholesale_price >= 0),
  add column wholesale_min_qty numeric check (wholesale_min_qty > 0);
