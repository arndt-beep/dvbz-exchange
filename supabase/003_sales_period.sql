-- DVBZ Exchange · Erweiterung 003: Vertriebsmonat
-- Der Vertriebsmonat läuft etwa von der letzten Woche des Vormonats bis zur vorletzten Woche des Monats.
-- Sobald der Abgleich ein neueres Auswertungsblatt sieht, beginnt ein neuer Vertriebsmonat:
-- settings.shop.salesPeriod = 'JJJJ-MM', settings.shop.salesPeriodStart = Zeitpunkt des ersten Abgleichs.
-- "Top Broker" zählt alle Punkte seit salesPeriodStart. Mehrfach ausführbar.

create or replace function public.note_sales_period(p_period text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update settings
     set value = value || jsonb_build_object('salesPeriod', p_period, 'salesPeriodStart', now())
   where id = 'shop'
     and coalesce(value ->> 'salesPeriod', '') < p_period;
end $$;
revoke all on function public.note_sales_period(text) from public, anon, authenticated;

-- sync_metrics merkt sich den neuesten Vertriebsmonat (Rest unverändert aus 002)
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
