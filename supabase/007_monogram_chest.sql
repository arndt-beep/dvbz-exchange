-- DVBZ Exchange · Erweiterung 007: Brust-Monogramm bei zehn Rückendruck-Teilen. Mehrfach ausführbar.
update public.catalog set front = 'Rücken + Monogramm Brust'
 where sku in ('HOLY', 'NTS', 'MMNF', 'KOAFA', 'BLOOD', 'ATTP', 'BGS', 'HVNS', 'BMAF', 'NVNG');
select count(*) as mit_monogramm from public.catalog where front = 'Rücken + Monogramm Brust';
