-- DVBZ Exchange · Erweiterung 010: Shirts laufen auf dem Oversize-Modell AS Colour 5082 (Faded-Farben). Mehrfach ausführbar.
update public.catalog set color = 'Bone'   where type = 'Oversize-Shirt' and color = 'Ivory';
update public.catalog set color = 'Indigo' where type = 'Oversize-Shirt' and color = 'Midnight';
update public.catalog set color = 'Coal'   where sku = 'CSTL';
update public.catalog set color = 'Black', photo = 'img/DSDK-rolex-look.jpg', photo_pos = '50% 40%', print = 'img/DSDK-rolex-print.jpg'
 where sku = 'DSDK';
update public.catalog set alt = name || ', Oversize-Shirt in ' || color where type = 'Oversize-Shirt';
select string_agg(sku || '=' || color, ' ' order by color, sku) as shirts from public.catalog where type = 'Oversize-Shirt';
