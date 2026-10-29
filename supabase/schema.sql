-- DVBZ Exchange · Supabase-Schema
-- Einmal im Supabase-Dashboard unter "SQL Editor" ausführen, danach seed.sql.
-- Grundsätze:
--   * Nur angemeldete Broker sehen etwas. Anmelden kann sich nur, wessen E-Mail im Back Office hinterlegt ist.
--   * Einlösen, Stornieren und Statuswechsel laufen über Funktionen, die Punkte und Bestand auf dem Server prüfen.
--   * Punkte buchen, Broker und Titel pflegen darf nur das Back Office (is_admin).

-- ---------- Tabellen ----------
create table if not exists public.participants (
  id         text primary key default gen_random_uuid()::text,
  name       text not null,
  team       text,
  email      text unique,
  user_id    uuid unique references auth.users(id) on delete set null,
  is_admin   boolean not null default false,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.catalog (
  id        text primary key default gen_random_uuid()::text,
  sku       text,
  name      text not null,
  label     text,
  points    integer not null check (points >= 0),
  stock     integer check (stock >= 0),
  sold      integer not null default 0,
  limited   boolean not null default false,
  active    boolean not null default true,
  sort      integer not null default 99,
  type      text,
  color     text,
  back      text,
  front     text,
  photo     text,
  photo_pos text,
  print     text,
  alt       text
);

create table if not exists public.challenges (
  id     text primary key default gen_random_uuid()::text,
  name   text not null,
  points integer not null,
  active boolean not null default true
);

create table if not exists public.ledger (
  id             uuid primary key default gen_random_uuid(),
  participant_id text not null references public.participants(id) on delete cascade,
  delta          integer not null,
  reason         text,
  order_id       uuid,
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid()
);
create index if not exists ledger_participant on public.ledger (participant_id);

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  participant_id  text not null references public.participants(id) on delete cascade,
  item_id         text not null references public.catalog(id),
  item_name       text not null,
  points          integer not null,
  size            text,
  note            text,
  status          text not null default 'offen'
                  check (status in ('offen', 'freigegeben', 'bestellt', 'geliefert', 'abgelehnt')),
  created_at      timestamptz not null default now(),
  freigegeben_at  timestamptz,
  bestellt_at     timestamptz,
  geliefert_at    timestamptz,
  abgelehnt_at    timestamptz
);
create index if not exists orders_participant on public.orders (participant_id);

create table if not exists public.settings (
  id    text primary key,
  value jsonb not null default '{}'::jsonb
);

-- ---------- Hilfsfunktionen ----------
create or replace function public.my_pid() returns text
language sql stable security definer set search_path = public as $$
  select id from participants where user_id = auth.uid() and active limit 1
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from participants where user_id = auth.uid() and active limit 1), false)
$$;

create or replace function public.available_points(p text) returns integer
language sql stable security definer set search_path = public as $$
  select (coalesce((select sum(delta) from ledger where participant_id = p), 0)
        - coalesce((select sum(points) from orders where participant_id = p and status = 'offen'), 0))::integer
$$;

-- ---------- Anmeldung nur für hinterlegte E-Mails ----------
create or replace function public.gate_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from participants where lower(email) = lower(new.email) and active) then
    raise exception 'Diese E-Mail ist nicht freigeschaltet.';
  end if;
  return new;
end $$;

create or replace function public.link_participant() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update participants set user_id = new.id
   where lower(email) = lower(new.email) and user_id is null;
  return new;
end $$;

drop trigger if exists dvbz_gate_signup on auth.users;
create trigger dvbz_gate_signup before insert on auth.users
  for each row execute function public.gate_signup();
drop trigger if exists dvbz_link_participant on auth.users;
create trigger dvbz_link_participant after insert on auth.users
  for each row execute function public.link_participant();

-- Falls die E-Mail erst nach dem ersten Login hinterlegt oder geändert wurde
create or replace function public.link_me() returns text
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(auth.jwt() ->> 'email');
begin
  if auth.uid() is null then return null; end if;
  update participants set user_id = auth.uid()
   where lower(email) = v_email and user_id is null
     and not exists (select 1 from participants where user_id = auth.uid());
  return my_pid();
end $$;

-- ---------- Einlösen und Order-Status ----------
create or replace function public.redeem(p_item text, p_size text, p_note text default null, p_participant text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_pid  text;
  v_item catalog%rowtype;
  v_open integer;
  v_id   uuid;
begin
  if p_participant is not null then
    if not is_admin() then raise exception 'Nur das Back Office darf für andere ordern.'; end if;
    v_pid := p_participant;
  else
    v_pid := my_pid();
    if v_pid is null then raise exception 'Dein Depot ist noch nicht verknüpft.'; end if;
  end if;

  select * into v_item from catalog where id = p_item and active for update;
  if not found then raise exception 'Dieser Titel ist nicht im Handel.'; end if;

  if v_item.stock is not null then
    select count(*) into v_open from orders where item_id = p_item and status = 'offen';
    if v_item.stock - v_item.sold - v_open <= 0 then raise exception 'Ausverkauft.'; end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('dvbz-depot-' || v_pid));
  if available_points(v_pid) < v_item.points then raise exception 'Nicht genug freie Punkte.'; end if;

  insert into orders (participant_id, item_id, item_name, points, size, note)
  values (v_pid, v_item.id, v_item.name, v_item.points, left(coalesce(p_size, '–'), 12),
          left(coalesce(case when p_participant is not null then 'vom Back Office angelegt' else p_note end, ''), 140))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.cancel_order(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from orders
   where id = p_order and status = 'offen'
     and (participant_id = my_pid() or is_admin());
  if not found then raise exception 'Order kann nicht mehr storniert werden.'; end if;
end $$;

create or replace function public.set_order_status(p_order uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare v orders%rowtype;
begin
  if not is_admin() then raise exception 'Nur das Back Office.'; end if;
  select * into v from orders where id = p_order for update;
  if not found then raise exception 'Order nicht gefunden.'; end if;
  if not (
       (v.status = 'offen'       and p_status in ('freigegeben', 'abgelehnt'))
    or (v.status = 'freigegeben' and p_status = 'bestellt')
    or (v.status = 'bestellt'    and p_status = 'geliefert')
  ) then
    raise exception 'Statuswechsel % → % ist nicht erlaubt.', v.status, p_status;
  end if;

  if p_status = 'freigegeben' then
    insert into ledger (participant_id, delta, reason, order_id)
    values (v.participant_id, -abs(v.points), 'Order: ' || v.item_name || ' (' || coalesce(v.size, '–') || ')', v.id);
    update catalog set sold = sold + 1 where id = v.item_id;
  end if;

  update orders set
    status         = p_status,
    freigegeben_at = case when p_status = 'freigegeben' then now() else freigegeben_at end,
    bestellt_at    = case when p_status = 'bestellt'    then now() else bestellt_at end,
    geliefert_at   = case when p_status = 'geliefert'   then now() else geliefert_at end,
    abgelehnt_at   = case when p_status = 'abgelehnt'   then now() else abgelehnt_at end
  where id = p_order;
end $$;

create or replace function public.mark_ordered(p_orders uuid[]) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not is_admin() then raise exception 'Nur das Back Office.'; end if;
  update orders set status = 'bestellt', bestellt_at = now()
   where id = any(p_orders) and status = 'freigegeben';
  get diagnostics n = row_count;
  return n;
end $$;

-- E-Mails sieht nur das Back Office
create or replace function public.admin_participants()
returns table (id text, email text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Nur das Back Office.'; end if;
  return query select p.id, p.email from participants p;
end $$;

-- ---------- Zugriffsrechte ----------
alter table public.participants enable row level security;
alter table public.catalog      enable row level security;
alter table public.challenges   enable row level security;
alter table public.ledger       enable row level security;
alter table public.orders       enable row level security;
alter table public.settings     enable row level security;

revoke all on public.participants, public.catalog, public.challenges, public.ledger, public.orders, public.settings from anon;
revoke all on public.participants, public.catalog, public.challenges, public.ledger, public.orders, public.settings from authenticated;

-- Broker: alle sehen Name und Team, E-Mail nur über admin_participants()
grant select (id, name, team, user_id, is_admin, active, created_at) on public.participants to authenticated;
grant insert, update, delete on public.participants to authenticated;
-- Lesen für alle Angemeldeten, Schreiben nur Back Office (über Policies)
grant select, insert, update, delete on public.catalog, public.challenges, public.ledger, public.settings to authenticated;
-- Orders entstehen und ändern sich nur über die Funktionen oben; das Back Office darf zusätzlich löschen
grant select, delete on public.orders to authenticated;

drop policy if exists p_read on public.participants;
drop policy if exists p_admin on public.participants;
create policy p_read  on public.participants for select to authenticated using (true);
create policy p_admin on public.participants for all    to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists c_read on public.catalog;
drop policy if exists c_admin on public.catalog;
create policy c_read  on public.catalog for select to authenticated using (true);
create policy c_admin on public.catalog for all    to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists ch_read on public.challenges;
drop policy if exists ch_admin on public.challenges;
create policy ch_read  on public.challenges for select to authenticated using (true);
create policy ch_admin on public.challenges for all    to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists s_read on public.settings;
drop policy if exists s_admin on public.settings;
create policy s_read  on public.settings for select to authenticated using (true);
create policy s_admin on public.settings for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- Kontobewegungen sind teamweit sichtbar (Laufband, Rangliste), buchen darf nur das Back Office
drop policy if exists l_read on public.ledger;
drop policy if exists l_admin on public.ledger;
create policy l_read  on public.ledger for select to authenticated using (true);
create policy l_admin on public.ledger for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- Orders: eigene sehen, das Back Office alle
drop policy if exists o_read on public.orders;
drop policy if exists o_admin_delete on public.orders;
create policy o_read         on public.orders for select to authenticated using (participant_id = public.my_pid() or public.is_admin());
create policy o_admin_delete on public.orders for delete to authenticated using (public.is_admin());

revoke all on function public.redeem(text, text, text, text), public.cancel_order(uuid), public.set_order_status(uuid, text),
  public.mark_ordered(uuid[]), public.admin_participants(), public.link_me(), public.available_points(text) from public, anon;
grant execute on function public.redeem(text, text, text, text), public.cancel_order(uuid), public.set_order_status(uuid, text),
  public.mark_ordered(uuid[]), public.admin_participants(), public.link_me(), public.available_points(text),
  public.my_pid(), public.is_admin() to authenticated;

-- ---------- Live-Aktualisierung ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.catalog, public.participants, public.ledger,
        public.orders, public.challenges, public.settings;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
