-- v29.62 — Pilz-DB (task_a8692b11 Item 5): 7 fehlende Kantone mit ECHTEN VAPKO-Kontrollstellen.
-- Kontakte web-recherchiert + aus OFFIZIELLEN .ch-Behördenquellen verifiziert (appenzell.org,
-- herisau.ch, stadt.sg.ch, stadt-schaffhausen.ch, frauenfeld.ch, stadtzug.ch); NICHTS geraten.
-- Uri: keine dedizierte Stelle offiziell verifizierbar → null + Verweis auf VAPKO-Verzeichnis
-- (Sicherheitsregel: lieber null als erfinden). Tox Info Suisse 145 (Vergiftungsnotfall) bestätigt.
-- (1) Saubere autoritative Tabelle vapko_control_stations + (2) 7 Patches, damit der bestehende
-- Mushroom-Season-Frontend-Pfad (region_canton_codes-Overlap) die echten Kontakte sofort surfaced.
-- Nach Migration: alle 26 Kantone abgedeckt; vapko_control_stations 7 Zeilen (6 verified). Backend-only.

create table if not exists public.vapko_control_stations (
  canton_code text primary key,
  region_name text,
  station text,
  phone text,
  url text,
  verified boolean not null default false,
  note text,
  source text,
  created_at timestamptz not null default now()
);
alter table public.vapko_control_stations enable row level security;
drop policy if exists vapko_control_stations_read on public.vapko_control_stations;
create policy vapko_control_stations_read on public.vapko_control_stations for select to anon, authenticated using (true);

insert into public.vapko_control_stations (canton_code, region_name, station, phone, url, verified, note, source) values
 ('AI','Appenzell Innerrhoden','Amtliche Pilzkontrollstelle Bezirk Appenzell (Pilzverein Appenzell), Marktgasse 10a, 9050 Appenzell','079 781 66 16','https://www.appenzell.org/dienstleistungen/22984', true, 'Saison Sa/Mo 17-19h. Im Zweifel offizielles VAPKO-Verzeichnis nutzen. Vergiftungsnotfall: Tox Info Suisse 145.','appenzell.org (offiziell)'),
 ('AR','Appenzell Ausserrhoden','Pilzkontrolle Gemeinde Herisau (weitere Gemeindestellen z.B. Teufen)','078 687 73 62','https://www.herisau.ch/dienstleistungen/1567', true, 'Kommunal organisiert, Kontrolle nach tel. Vereinbarung. Weitere AR-Stellen via VAPKO-Verzeichnis. Vergiftungsnotfall: Tox Info Suisse 145.','herisau.ch (offiziell)'),
 ('SG','St. Gallen','Amtliche Pilzkontrolle Stadt St. Gallen, Botanischer Garten, Stephanshornstrasse 4, 9016 St. Gallen','071 288 15 30','https://www.stadt.sg.ch/home/raum-umwelt/natur/botanischer-garten.html', true, 'Saison Aug-Okt ohne Anmeldung, sonst tel. Anmeldung. Vergiftungsnotfall: Tox Info Suisse 145.','stadt.sg.ch (offiziell)'),
 ('SH','Schaffhausen','Amtliche Pilzkontrolle Stadt Schaffhausen, Freizeitanlage Dreispitz, 8207 Schaffhausen-Herblingen','052 672 67 83','https://www.stadt-schaffhausen.ch/dienste/89048', true, 'Saison Mo/Do/Sa 17-18h (1.9.-30.10.). Weitere Kontrollpersonen im Kanton auf der Seite. Vergiftungsnotfall: Tox Info Suisse 145.','stadt-schaffhausen.ch (offiziell)'),
 ('TG','Thurgau','Pilzkontrolle Stadt Frauenfeld (weitere kommunale Stellen: Weinfelden, Arbon, Amriswil)','079 782 45 44','https://www.frauenfeld.ch/gesellschaft-gesundheit/gesundheit/pilzkontrolle.html/701', true, 'Kontrolle nur nach tel. Anmeldung, kostenlos. Weitere TG-Stellen via VAPKO-Verzeichnis. Vergiftungsnotfall: Tox Info Suisse 145.','frauenfeld.ch (offiziell)'),
 ('ZG','Zug','Pilzkontrolle Stadt Zug (Werkhof, Göblistrasse 7, 6300 Zug) — koordiniert für alle Zuger Gemeinden','058 728 97 10','https://www.stadtzug.ch/pilze/1745', true, 'Saison Anf. Aug-Ende Okt, Mo/Mi 18:30-20h, Sa 17-19h. Vergiftungsnotfall: Tox Info Suisse 145.','stadtzug.ch / zg.ch (offiziell)'),
 ('UR','Uri', null, null, 'https://www.vapko.ch/de/eine-pilzkontrollstelle-finden', false, 'Keine dedizierte kantonale Stelle offiziell verifizierbar — nächste Kontrollstelle über das offizielle VAPKO-Verzeichnis suchen. Vergiftungsnotfall: Tox Info Suisse 145.','vapko.ch (Verzeichnis)')
on conflict (canton_code) do update set
  region_name=excluded.region_name, station=excluded.station, phone=excluded.phone, url=excluded.url,
  verified=excluded.verified, note=excluded.note, source=excluded.source;

insert into public.mushroom_seasonal_patches
  (slug, region_canton_codes, altitude_m_min, altitude_m_max, forest_type, typical_mushrooms, best_months, weather_trigger, difficulty_to_find, notes, vapko_kontrollstelle, vapko_phone, vapko_link, source) values
 ('kanton_sg', ARRAY['SG']::text[], 400, 1200, 'mischwald', ARRAY['Steinpilz','Eierschwamm (Pfifferling)','Maronenröhrling','Parasol','Trompetenpfifferling']::text[], ARRAY[8,9,10]::int[], '2-3 Tage nach Regen, mild', 'mittel', 'St. Galler Mittelland & Voralpen (Buche/Fichte). Funde VOR dem Verzehr bei der amtlichen Pilzkontrolle prüfen lassen. Vergiftungsnotfall: Tox Info Suisse 145.', 'Amtliche Pilzkontrolle Stadt St. Gallen (Botanischer Garten)', '071 288 15 30', 'https://www.vapko.ch/de/eine-pilzkontrollstelle-finden', 'stadt.sg.ch (offiziell) / VAPKO'),
 ('kanton_tg', ARRAY['TG']::text[], 350, 900, 'mischwald', ARRAY['Steinpilz','Eierschwamm (Pfifferling)','Maronenröhrling','Parasol','Hallimasch']::text[], ARRAY[8,9,10]::int[], '2-3 Tage nach Regen, mild', 'mittel', 'Thurgauer Hügelland (Laub-/Mischwald). Kontrolle nur nach tel. Anmeldung. Vergiftungsnotfall: Tox Info Suisse 145.', 'Pilzkontrolle Stadt Frauenfeld', '079 782 45 44', 'https://www.vapko.ch/de/eine-pilzkontrollstelle-finden', 'frauenfeld.ch (offiziell) / VAPKO'),
 ('kanton_sh', ARRAY['SH']::text[], 400, 900, 'laubwald', ARRAY['Steinpilz','Eierschwamm (Pfifferling)','Maronenröhrling','Semmelstoppelpilz','Parasol']::text[], ARRAY[8,9,10]::int[], '2-3 Tage nach Regen, mild', 'mittel', 'Region Randen/Klettgau (Buchen-/Eichenwald). Saison Mo/Do/Sa 17-18h (1.9.-30.10.). Vergiftungsnotfall: Tox Info Suisse 145.', 'Amtliche Pilzkontrolle Stadt Schaffhausen', '052 672 67 83', 'https://www.vapko.ch/de/eine-pilzkontrollstelle-finden', 'stadt-schaffhausen.ch (offiziell) / VAPKO'),
 ('kanton_zg', ARRAY['ZG']::text[], 400, 1000, 'mischwald', ARRAY['Steinpilz','Eierschwamm (Pfifferling)','Maronenröhrling','Parasol','Trompetenpfifferling']::text[], ARRAY[8,9,10]::int[], '2-3 Tage nach Regen, mild', 'mittel', 'Zugerland & Voralpen. Saison Mo/Mi 18:30-20h, Sa 17-19h. Vergiftungsnotfall: Tox Info Suisse 145.', 'Pilzkontrolle Stadt Zug (für alle Zuger Gemeinden)', '058 728 97 10', 'https://www.vapko.ch/de/eine-pilzkontrollstelle-finden', 'stadtzug.ch (offiziell) / VAPKO'),
 ('kanton_ar', ARRAY['AR']::text[], 600, 1300, 'mischwald', ARRAY['Steinpilz','Eierschwamm (Pfifferling)','Maronenröhrling','Edelreizker','Parasol']::text[], ARRAY[8,9,10]::int[], '2-3 Tage nach Regen, mild', 'mittel', 'Appenzeller Voralpen. Kommunal organisiert (z.B. Herisau, Teufen), Kontrolle nach Vereinbarung. Vergiftungsnotfall: Tox Info Suisse 145.', 'Pilzkontrolle Gemeinde Herisau', '078 687 73 62', 'https://www.vapko.ch/de/eine-pilzkontrollstelle-finden', 'herisau.ch (offiziell) / VAPKO'),
 ('kanton_ai', ARRAY['AI']::text[], 700, 1500, 'mischwald', ARRAY['Steinpilz','Eierschwamm (Pfifferling)','Edelreizker','Maronenröhrling','Parasol']::text[], ARRAY[8,9,10]::int[], '2-3 Tage nach Regen, mild', 'mittel', 'Alpstein-Region (Bergmischwald). Amtliche Pilzkontrolle Bezirk Appenzell, Saison Sa/Mo 17-19h. Vergiftungsnotfall: Tox Info Suisse 145.', 'Amtliche Pilzkontrollstelle Bezirk Appenzell (Pilzverein)', '079 781 66 16', 'https://www.vapko.ch/de/eine-pilzkontrollstelle-finden', 'appenzell.org (offiziell) / VAPKO'),
 ('kanton_ur', ARRAY['UR']::text[], 600, 1800, 'nadelwald', ARRAY['Steinpilz','Eierschwamm (Pfifferling)','Edelreizker','Mönchskopf']::text[], ARRAY[8,9,10]::int[], '2-3 Tage nach Regen, mild', 'mittel', 'Urner Alpentäler (Bergnadelwald). Keine dedizierte kantonale Kontrollstelle verifiziert — nächste Stelle über das offizielle VAPKO-Verzeichnis suchen. Vergiftungsnotfall: Tox Info Suisse 145.', 'Nächste Stelle via VAPKO-Verzeichnis', null, 'https://www.vapko.ch/de/eine-pilzkontrollstelle-finden', 'vapko.ch (Verzeichnis)')
on conflict (slug) do nothing;
