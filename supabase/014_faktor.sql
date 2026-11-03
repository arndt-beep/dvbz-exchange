-- DVBZ Exchange · Erweiterung 014: Faktor pro Broker
-- Wer im alten Groessig-HubSpot arbeitet (Bestandskunden), bekommt Vertriebspunkte ×0,5.
-- Neue Leute bekommen in den ersten 3 Monaten ab Startdatum ×1,5, danach automatisch ×1.
-- Bruchteile werden pro Broker mitgeführt (carry) und beim nächsten Abgleich gutgeschrieben.
-- Gilt nur für neue Buchungen; bisherige Punkte bleiben. Mehrfach ausführbar.

alter table public.participants add column if not exists hubspot boolean not null default false;
alter table public.participants add column if not exists start_date date;
alter table public.metric_snapshots add column if not exists carry numeric not null default 0;
grant select (hubspot, start_date) on public.participants to authenticated;

-- Faktoren stehen in settings.points (hubspot, rookie, rookieMonths) und lassen sich dort ändern
update public.settings
   set value = value || '{"hubspot":0.5,"rookie":1.5,"rookieMonths":3}'::jsonb
 where id = 'points' and not (value ? 'hubspot');
insert into public.settings (id, value)
values ('points', '{"submitted":1,"closings":3,"referrals":2,"hubspot":0.5,"rookie":1.5,"rookieMonths":3}')
on conflict (id) do nothing;

create or replace function public.point_factor(p_pid text, p_day date default current_date)
returns numeric
language sql stable security definer set search_path = public as $$
  select case
    when p.hubspot then coalesce((w.value ->> 'hubspot')::numeric, 0.5)
    when p.start_date is not null
     and p_day < (p.start_date + make_interval(months => coalesce((w.value ->> 'rookieMonths')::int, 3)))::date
      then coalesce((w.value ->> 'rookie')::numeric, 1.5)
    else 1
  end
  from participants p
  left join settings w on w.id = 'points'
  where p.id = p_pid
$$;
grant execute on function public.point_factor(text, date) to authenticated;

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
  fac     numeric;
  raw     numeric;
  carry   numeric;
  pts     integer;
  booked  integer := 0;
  total   integer := 0;
  missing jsonb := '[]'::jsonb;
  parts   text[];
  live    boolean := coalesce((select (value ->> 'signupOpen')::boolean from settings where id = 'shop'), false);
begin
  if p_token is null or p_token is distinct from (select value from private_config where key = 'sync_token') then
    raise exception 'Abgleich-Schlüssel ungültig.';
  end if;
  if p_period !~ '^\d{4}-\d{2}$' then raise exception 'Periode muss JJJJ-MM sein.'; end if;
  perform note_sales_period(p_period);
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
    if not found then prev.submitted := 0; prev.closings := 0; prev.referrals := 0; prev.carry := 0; end if;
    d_s := s_new - prev.submitted; d_c := c_new - prev.closings; d_f := f_new - prev.referrals;
    raw := d_s * (w ->> 'submitted')::numeric + d_c * (w ->> 'closings')::numeric + d_f * (w ->> 'referrals')::numeric;
    fac := coalesce(point_factor(pid), 1);
    carry := coalesce(prev.carry, 0);
    pts := 0;
    if live and not p_baseline then
      carry := raw * fac + carry;
      pts := trunc(carry);
      carry := carry - pts;
    end if;
    if pts <> 0 then
      parts := array[]::text[];
      if d_s <> 0 then parts := parts || (case when d_s > 0 then '+' else '' end || trim(to_char(d_s, 'FM999990.##')) || ' Anträge'); end if;
      if d_c <> 0 then parts := parts || (case when d_c > 0 then '+' else '' end || trim(to_char(d_c, 'FM999990.##')) || ' Abschlüsse'); end if;
      if d_f <> 0 then parts := parts || (case when d_f > 0 then '+' else '' end || trim(to_char(d_f, 'FM999990.##')) || ' Empfehlungen'); end if;
      insert into ledger (participant_id, delta, reason, created_by)
      values (pid, pts, 'Vertrieb ' || p_period || ': ' || array_to_string(parts, ', ')
                        || case when fac <> 1 then ' · Faktor ×' || replace(case when fac::text like '%.%' then rtrim(rtrim(fac::text, '0'), '.') else fac::text end, '.', ',') else '' end, null);
      booked := booked + 1; total := total + pts;
    end if;
    insert into metric_snapshots (participant_id, period, submitted, closings, referrals, carry, updated_at)
    values (pid, p_period, s_new, c_new, f_new, carry, now())
    on conflict (participant_id, period) do update
      set submitted = excluded.submitted, closings = excluded.closings, referrals = excluded.referrals,
          carry = excluded.carry, updated_at = now();
    pid := null;
  end loop;
  return jsonb_build_object('period', p_period, 'baseline', p_baseline or not live, 'bookings', booked, 'points', total, 'unmatched', missing);
end $$;
revoke all on function public.sync_metrics(text, text, jsonb, boolean) from public;
grant execute on function public.sync_metrics(text, text, jsonb, boolean) to anon, authenticated;

insert into public.challenges (id, name, points)
values ('bester-hunter', 'Bester Hunter des Monats', 150)
on conflict (id) do nothing;
