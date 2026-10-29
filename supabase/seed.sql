-- DVBZ Exchange · Startdaten (nach schema.sql ausführen). Mehrfach ausführbar.

insert into public.catalog (id, sku, name, label, points, stock, sold, limited, active, sort, type, color, back, front, photo, photo_pos, print, alt) values
  ('100-gefoerdert', '100G', '100 % Gefördert', 'CLOSERS CLUB', 400, null, 0, false, true, 6, 'Oversize-Shirt', 'Grey', '100%|Gefördert', 'Rücken', 'img/100G-look.jpg', '22% 40%', 'img/100G-print.jpg', '100 % Gefördert, Shirt in Grey'),
  ('addicted-to-the-pain', 'ATTP', 'Addicted to the pain', 'OLD MONEY', 700, null, 0, false, true, 14, 'Hoodie', 'Forest', 'Addicted|to the pain', 'Rücken', null, null, 'img/ATTP-print.jpg', 'Addicted to the pain, Hoodie in Forest'),
  ('anything-closed', 'CLSD', 'Anything closed today?', 'OLD MONEY', 400, null, 0, false, true, 19, 'Oversize-Shirt', 'Grey', 'Anything|closed today?', 'Rücken', null, null, 'img/CLSD-print.jpg', 'Anything closed today?, Shirt in Grey'),
  ('bgs-salary', 'BGS', 'Building God-lvl Salary', 'OLD MONEY', 700, null, 0, false, true, 22, 'Hoodie', 'Forest', 'Building|God-lvl|Salary', 'Rücken', null, null, 'img/BGS-print.jpg', 'Building God-lvl Salary, Hoodie in Forest'),
  ('bloodline', 'BLOOD', 'First Millionaire of my Bloodline', 'OLD MONEY', 700, null, 0, false, true, 11, 'Hoodie', 'Forest', 'First|Millionaire', 'Rücken', 'img/BLOOD-look.jpg', '50% 45%', 'img/BLOOD-print.jpg', 'First Millionaire of my Bloodline, Hoodie in Forest'),
  ('caviar', 'CVR', 'Eat some crap, eat caviar', 'OLD MONEY', 400, null, 0, false, true, 23, 'Oversize-Shirt', 'Midnight', 'Eat caviar', 'Rücken', null, null, 'img/CVR-print.jpg', 'Eat some crap, eat caviar, Shirt in Midnight'),
  ('dear-person', 'DEAR', 'Dear person behind me', 'OLD MONEY', 400, null, 0, false, true, 15, 'Oversize-Shirt', 'Ivory', 'Dear person|behind me', 'Rücken', 'img/DEAR-look.jpg', '50% 45%', 'img/DEAR-print.jpg', 'Dear person behind me, Shirt in Ivory'),
  ('du-verkaufst-bis-zuletzt', 'DOC', 'Department of Closing', 'CLOSERS CLUB', 700, null, 0, false, true, 7, 'Hoodie', 'Forest', 'DVBZ|Department|of Closing', 'Brust', 'img/DOC-look.jpg', '22% 40%', 'img/DOC-print.jpg', 'Department of Closing, Hoodie in Forest'),
  ('dvbz-geld', 'BMAF', 'Bildungsmafia', 'BILDUNGSMAFIA', 700, null, 0, false, true, 4, 'Hoodie', 'Navy', 'Bildungsmafia', 'Rücken', 'img/BMAF-look.jpg', '22% 40%', 'img/BMAF-print.jpg', 'Bildungsmafia, Hoodie in Navy'),
  ('einwand-abgelehnt', 'EAB', 'Einwand? Abgelehnt.', 'CLOSERS CLUB', 400, null, 0, false, true, 5, 'Oversize-Shirt', 'Ivory', 'Einwand?|Abgelehnt.', 'Rücken', 'img/EAB-look.jpg', '22% 40%', 'img/EAB-print.jpg', 'Einwand? Abgelehnt., Shirt in Ivory'),
  ('heaven-sent', 'HVNS', 'Heaven Sent', 'HEAVEN SENT', 1000, 20, 0, true, true, 8, 'Hoodie', 'Dust', 'Heaven|Sent', 'Rücken', 'img/HVNS-look.jpg', '22% 40%', 'img/HVNS-print.jpg', 'Heaven Sent, Hoodie in Dust'),
  ('holy-money', 'HOLY', 'In the name of the Holy Money', 'OLD MONEY', 400, null, 0, false, true, 9, 'Oversize-Shirt', 'Ivory', 'Holy|Money', 'Rücken', 'img/HOLY-look.jpg', '50% 45%', 'img/HOLY-print.jpg', 'In the name of the Holy Money, Shirt in Ivory'),
  ('keine-rolle', 'DSDK', 'Das spielt doch keine', 'CLOSERS CLUB', 400, null, 0, false, true, 1, 'Oversize-Shirt', 'Ivory', 'Das spielt|doch keine ⌚', 'Rücken', 'img/DSDK-look.jpg', '24% 40%', 'img/DSDK-print.jpg', 'Das spielt doch keine, Shirt in Ivory'),
  ('king-of-afa', 'KOAFA', 'King of AfA', 'HEAVEN SENT', 1000, 20, 0, true, true, 2, 'Hoodie', 'Forest', 'King|of AfA', 'Rücken', 'img/KOAFA-look.jpg', '22% 40%', 'img/KOAFA-print.jpg', 'King of AfA, Hoodie in Forest'),
  ('make-money', 'MMNF', 'Make money, not friends.', 'OLD MONEY', 400, null, 0, false, true, 10, 'Oversize-Shirt', 'Midnight', 'Make money,|not friends.', 'Rücken', null, null, 'img/MMNF-print.jpg', 'Make money, not friends., Shirt in Midnight'),
  ('not-the-same', 'NTS', 'We''re not the same.', 'OLD MONEY', 400, null, 0, false, true, 17, 'Oversize-Shirt', 'Ivory', 'We''re not|the same.', 'Rücken', 'img/NTS-look.jpg', '50% 45%', 'img/NTS-print.jpg', 'We''re not the same., Shirt in Ivory'),
  ('nothing-ventured', 'NVNG', 'Nothing ventured, nothing gained', 'OLD MONEY', 700, null, 0, false, true, 16, 'Hoodie', 'Navy', 'Nothing|ventured', 'Rücken', null, null, 'img/NVNG-print.jpg', 'Nothing ventured, nothing gained, Hoodie in Navy'),
  ('pronouns', 'MONEY', 'My pronouns: Mon/ey', 'OLD MONEY', 300, null, 0, false, true, 20, 'Oversize-Shirt', 'Ivory', 'Mon/ey', 'Brust', null, null, 'img/MONEY-print.jpg', 'My pronouns: Mon/ey, Shirt in Ivory'),
  ('red-flag', 'RFLG', 'My red flag? I work in sales.', 'OLD MONEY', 300, null, 0, false, true, 18, 'Oversize-Shirt', 'Ivory', 'My red flag?', 'Brust', null, null, 'img/RFLG-print.jpg', 'My red flag? I work in sales., Shirt in Ivory'),
  ('sozialgeld-millionaer', 'SGM', 'Sozialgeld-Millionär', 'MEMBERS CLUB', 400, null, 0, false, true, 3, 'Oversize-Shirt', 'Ivory', 'Sozialgeld-|Millionär', 'Brust', 'img/SGM-look.jpg', '25% 40%', 'img/SGM-print.jpg', 'Sozialgeld-Millionär, Shirt in Ivory'),
  ('stop-screwing', 'SSYO', 'Stop screwing yourself over', 'OLD MONEY', 400, null, 0, false, true, 13, 'Oversize-Shirt', 'Grey', 'Stop screwing|yourself over', 'Rücken', null, null, 'img/SSYO-print.jpg', 'Stop screwing yourself over, Shirt in Grey'),
  ('stormed-the-castle', 'CSTL', 'Stormed the castle', 'OLD MONEY', 400, null, 0, false, true, 21, 'Oversize-Shirt', 'Espresso', 'Stormed|the castle', 'Rücken', null, null, 'img/CSTL-print.jpg', 'Stormed the castle, Shirt in Espresso'),
  ('whoever-you-blame', 'WYB', 'Whoever you blame', 'OLD MONEY', 400, null, 0, false, true, 12, 'Oversize-Shirt', 'Ivory', 'Whoever|you blame', 'Rücken', null, null, 'img/WYB-print.jpg', 'Whoever you blame, Shirt in Ivory'),
  ('zero-dollar', 'ZERO', 'Being nice costs you $0', 'OLD MONEY', 400, null, 0, false, true, 24, 'Oversize-Shirt', 'Ivory', 'Being nice|costs $0', 'Rücken', null, null, 'img/ZERO-print.jpg', 'Being nice costs you $0, Shirt in Ivory')
on conflict (id) do nothing;

insert into public.participants (id, name, team, email, is_admin) values
  ('gideon-arndt', 'Gideon Arndt', 'Back Office', 'arndt@vertriebsbildungszentrum.de', true),
  ('adrian-wiemer', 'Adrian Wiemer', 'DVBZ', null, false),
  ('artur-martirosian', 'Artur Martirosian', 'DVBZ', null, false),
  ('daniel-diener', 'Daniel Diener', 'DVBZ', null, false),
  ('david-wengler', 'David Wengler', 'Groessig', null, false),
  ('felix-brade', 'Felix Brade', 'DVBZ', null, false),
  ('florian-koellmer', 'Florian Köllmer', 'DVBZ', null, false),
  ('hannes-werner', 'Hannes Werner', 'Groessig', null, false),
  ('jander-schwarz', 'Jander Schwarz', 'DVBZ', null, false),
  ('jannek-dittes', 'Jannek Dittes', 'DVBZ', null, false),
  ('jennifer-lehmann', 'Jennifer Lehmann', 'DVBZ', null, false),
  ('leander-barske', 'Leander Barske', 'DVBZ', null, false),
  ('lukas-sosinka', 'Lukas Sosinka', 'Groessig', null, false),
  ('maik-helm', 'Maik Helm', 'DVBZ', null, false),
  ('marc-aurel-haeussler', 'Marc-Aurel Häußler', 'DVBZ', null, false),
  ('marc-poeppel', 'Marc Pöppel', 'DVBZ', null, false),
  ('marian-pohl', 'Marian Pohl', 'DVBZ', null, false),
  ('mark-zlotin', 'Mark Zlotin', 'Groessig', null, false),
  ('max-rudert', 'Max Rudert', 'DVBZ', null, false),
  ('niklas-huebner', 'Niklas Hübner', 'Groessig', null, false),
  ('rafael-najafov', 'Rafael Najafov', 'DVBZ', null, false),
  ('samuel-lang', 'Samuel Lang', 'Groessig', null, false),
  ('stephan-mannl', 'Stephan Mannl', 'DVBZ', null, false),
  ('tom-ranft', 'Tom Ranft', 'Groessig', null, false)
on conflict (id) do nothing;

insert into public.challenges (id, name, points) values
  ('abschluss', 'Abschluss / Anmeldung', 50),
  ('30-calls', '30 Calls an einem Tag', 100),
  ('wochenziel', 'Wochenziel erreicht', 150),
  ('empfehlung', 'Weiterempfehlung mit Abschluss', 200),
  ('top-closer', 'Top-Closer des Monats', 500)
on conflict (id) do nothing;

insert into public.settings (id, value) values ('shop', '{"dropName": "Drop I & II · Old Money, New Provision"}'::jsonb)
on conflict (id) do nothing;
