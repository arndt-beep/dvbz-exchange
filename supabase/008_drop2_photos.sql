-- DVBZ Exchange · Erweiterung 008: ChatGPT-Shopbilder (Drop 2) als Hauptbilder. Mehrfach ausführbar.
update public.catalog set photo = 'img/' || sku || '-look.jpg', photo_pos = '50% 50%'
 where sku in ('MMNF', 'WYB', 'SSYO', 'ATTP', 'NVNG', 'RFLG', 'CLSD', 'MONEY', 'CSTL', 'BGS', 'CVR', 'ZERO');
select sku, photo from public.catalog where photo like '%-look.jpg' order by sort;
