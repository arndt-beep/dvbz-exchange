-- DVBZ Exchange · Erweiterung 006: Printful-Mockups als Hauptbilder für Caps und Socke. Mehrfach ausführbar.
update public.catalog set photo = 'img/' || sku || '-look.jpg', photo_pos = '50% 50%'
 where sku in ('CAP-MAIS', 'CAP-CLUB', 'CAP-BGS', 'CAP-BMAF', 'SOCK-TENNIS');
select sku, photo, print from public.catalog where sku like 'CAP-%' or sku like 'SOCK-%' order by sort;
