-- DVBZ Exchange · Erweiterung 002: Punkte-Abgleich aus dem Vertriebscontrolling und Launch-Schalter
-- Nach schema.sql und seed.sql im SQL Editor ausführen. Mehrfach ausführbar.
-- Der Abgleich-Schlüssel wird NICHT hier gesetzt (Repo ist öffentlich), sondern separat:
--   insert into private_config (key, value) values ('sync_token', '<zufälliger Wert>')
--   on conflict (key) do update set value = excluded.value;

-- Name, unter dem die Person im Vertriebscontrolling steht (falls abweichend)
alter table public.participants add column if not exists sheet_name text;

-- Nur für Server-Funktionen lesbar: Abgleich-Schlüssel
create table if not exists public.private_config (
  key   text primary key,
  value text not null
);
alter table public.private_config enable row level security;
revoke all on public.private_config from anon, authenticated;

-- Letzter bekannter Monatsstand je Person, damit nur der Zuwachs gebucht wird
create table if not exists public.metric_snapshots (
  participant_id text not null references public.participants(id) on delete cascade,
  period         text not null,               -- z. B. 2026-11
  submitted      numeric not null default 0,  -- Anträge eingereicht
  closings       numeric not null default 0,  -- Abschlüsse
  referrals      numeric not null default 0,  -- Weiterempfehlungen
  updated_at     timestamptz not null default now(),
  primary key (participant_id, period)
);
alter table public.metric_snapshots enable row level security;
revoke all on public.metric_snapshots from anon, authenticated;
grant select on public.metric_snapshots to authenticated;
drop policy if exists ms_read on public.metric_snapshots;
create policy ms_read on public.metric_snapshots for select to authenticated using (true);

-- Punkteschlüssel und Launch-Schalter (anpassbar über settings)
insert into public.settings (id, value) values
  ('points', '{"submitted": 1, "closings": 3, "referrals": 2}'::jsonb)
on conflict (id) do nothing;
update public.settings set value = value || '{"signupOpen": false}'::jsonb
 where id = 'shop' and not (value ? 'signupOpen');

-- Anmeldung: nur hinterlegte E-Mails, und vor dem Launch nur das Back Office
create or replace function public.gate_signup() returns trigger
language plpgsql security definer set search_path = public as $$
declare v participants%rowtype;
begin
  select * into v from participants where lower(email) = lower(new.email) and active limit 1;
  if not found then
    raise exception 'Diese E-Mail ist nicht freigeschaltet.';
  end if;
  if not v.is_admin and coalesce((select (value ->> 'signupOpen')::boolean from settings where id = 'shop'), false) is not true then
    raise exception 'Der Shop ist noch nicht freigeschaltet.';
  end if;
  return new;
end $$;

-- Name aus dem Sheet vereinheitlichen: "Adrian Wiemer - DVBZ " -> "adrian wiemer"
create or replace function public.norm_name(t text) returns text
language sql immutable as $$
  select lower(regexp_replace(regexp_replace(trim(coalesce(t, '')), '\s*-\s*DVBZ\s*$', '', 'i'), '\s+', ' ', 'g'))
$$;

-- Abgleich: wird vom Google-Sheet-Skript mit dem öffentlichen Schlüssel + Abgleich-Schlüssel aufgerufen.
-- p_rows: [{"name": "...", "submitted": 68, "closings": 22, "referrals": 8}, ...] = Monatsstände (kumuliert)
-- p_baseline = true: nur Stände merken, nichts buchen (Startpunkt beim Launch)
create or replace function public.sync_metrics(p_token text, p_period text, p_rows jsonb, p_baseline boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  w       jsonb := coalesce((select value from settings where id = 'points'), '{"submitted":1,"closings":3,"referrals":2}');
  r       jsonb;
  pid     text;
  prev    metric_snapshots%rowtype;
  s_new   numeric; c_new numeric; f_new numeric;
  d_s     numeric; d_c numeric; d_f numeric;
  pts     integer;
  booked  integer := 0;
  total   integer := 0;
  missing jsonb := '[]'::jsonb;
  parts   text[];
begin
  if p_token is null or p_token is distinct from (select value from private_config where key = 'sync_token') then
    raise exception 'Abgleich-Schlüssel ungültig.';
  end if;
  if p_period !~ '^\d{4}-\d{2}$' then raise exception 'Periode muss JJJJ-MM sein.'; end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    select id into pid from participants
     where active and (norm_name(sheet_name) = norm_name(r ->> 'name') or norm_name(name) = norm_name(r ->> 'name'))
     limit 1;
    if pid is null then
      if norm_name(r ->> 'name') <> '' then missing := missing || to_jsonb(r ->> 'name'); end if;
      continue;
    end if;

    s_new := coalesce(nullif(r ->> 'submitted', '')::numeric, 0);
    c_new := coalesce(nullif(r ->> 'closings', '')::numeric, 0);
    f_new := coalesce(nullif(r ->> 'referrals', '')::numeric, 0);

    select * into prev from metric_snapshots where participant_id = pid and period = p_period;
    if not found then prev.submitted := 0; prev.closings := 0; prev.referrals := 0; end if;

    d_s := s_new - prev.submitted; d_c := c_new - prev.closings; d_f := f_new - prev.referrals;
    pts := round(d_s * (w ->> 'submitted')::numeric + d_c * (w ->> 'closings')::numeric + d_f * (w ->> 'referrals')::numeric);

    if not p_baseline and pts <> 0 then
      parts := array[]::text[];
      if d_s <> 0 then parts := parts || (case when d_s > 0 then '+' else '' end || trim(to_char(d_s, 'FM999990.##')) || ' Anträge'); end if;
      if d_c <> 0 then parts := parts || (case when d_c > 0 then '+' else '' end || trim(to_char(d_c, 'FM999990.##')) || ' Abschlüsse'); end if;
      if d_f <> 0 then parts := parts || (case when d_f > 0 then '+' else '' end || trim(to_char(d_f, 'FM999990.##')) || ' Empfehlungen'); end if;
      insert into ledger (participant_id, delta, reason, created_by)
      values (pid, pts, 'Vertrieb ' || p_period || ': ' || array_to_string(parts, ', '), null);
      booked := booked + 1; total := total + pts;
    end if;

    insert into metric_snapshots (participant_id, period, submitted, closings, referrals, updated_at)
    values (pid, p_period, s_new, c_new, f_new, now())
    on conflict (participant_id, period) do update
      set submitted = excluded.submitted, closings = excluded.closings, referrals = excluded.referrals, updated_at = now();
    pid := null;
  end loop;

  return jsonb_build_object('period', p_period, 'baseline', p_baseline, 'bookings', booked, 'points', total, 'unmatched', missing);
end $$;

revoke all on function public.sync_metrics(text, text, jsonb, boolean) from public;
grant execute on function public.sync_metrics(text, text, jsonb, boolean) to anon, authenticated;
revoke all on function public.norm_name(text) from public, anon;
