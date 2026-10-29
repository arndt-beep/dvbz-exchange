-- DVBZ Exchange · Erweiterung 005: Caps (gestickt) und Tennis-Socke. Mehrfach ausführbar.
insert into public.catalog (id, sku, name, label, points, stock, sold, limited, active, sort, type, color, back, front, photo, photo_pos, print, alt) values
  ('cap-maison',   'CAP-MAIS',    'Maison Cap',          'LA MAISON',     350, null, 0, false, true, 25, 'Cap',    'Moss',  'Maison|DVBZ',    'Stick vorne', null, null, 'img/CAP-MAIS-print.jpg',    'Moss-Cap mit goldenem Säulen-Signet und Schriftzug Maison DVBZ'),
  ('cap-closers',  'CAP-CLUB',    'Closers Club Cap',    'CLOSERS CLUB',  350, null, 0, false, true, 26, 'Cap',    'Ivory', 'Closers|Club',   'Stick vorne', null, null, 'img/CAP-CLUB-print.jpg',    'Ivory-Cap mit Schriftzug Closers Club in Navy'),
  ('cap-bgs',      'CAP-BGS',     'BGS Cap',             'OLD MONEY',     350, null, 0, false, true, 27, 'Cap',    'Moss',  'BGS',            'Stick vorne', null, null, 'img/CAP-BGS-print.jpg',     'Moss-Cap mit BGS in Gold'),
  ('cap-bildung',  'CAP-BMAF',    'Bildungsmafia Cap',   'BILDUNGSMAFIA', 350, null, 0, false, true, 28, 'Cap',    'Moss',  'Bildungsmafia',  'Stick vorne', null, null, 'img/CAP-BMAF-print.jpg',    'Moss-Cap mit Bildungsmafia-Schriftzug in Weiß'),
  ('sock-tennis',  'SOCK-TENNIS', 'Maison Tennis Socks', 'LA MAISON',     200, null, 0, false, true, 29, 'Socken', 'Creme', 'Maison|DVBZ',    'rundum',      null, null, 'img/SOCK-TENNIS-print.jpg', 'Cremefarbene Tennissocke mit grünen Ringeln und Maison-DVBZ-Signet')
on conflict (id) do nothing;
