-- Abono inicial (pago de contado) de un deseo en cuotas: el resto se financia.
alter table public.wishlist_items
  add column initial_payment numeric(12, 2) not null default 0
  check (initial_payment >= 0);

alter table public.wishlist_items
  add constraint wishlist_initial_lt_price
  check (initial_payment <= price);
