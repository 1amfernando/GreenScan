-- v29.50b — mushroom_register Phase-0 Daten-Hygiene (backend-only, KEIN App-v-Bump).
--
-- Aus task_a8692b11 (Pilz-DB). SICHERHEIT: KEINE Essbarkeits-/VAPKO-Daten per LLM erfunden — nur
-- Datenintegrität: (1) widersprüchlich+garbled Xerocomellus entfernen, (2) Duplikate GLEICHER
-- Essbarkeit auf die datenreichste/korrekt-benannte Zeile mergen, (3) garbled Anzeige-Namen
-- korrigieren (Klassifizierung UNVERÄNDERT), (4) UNIQUE-Index gegen Re-Dups.
--
-- Befund: 45 Zeilen, nur ~33 distinct scientific_name → 9 Dup-Gruppen. 8 stimmten in der Essbarkeit
-- überein (sicher mergebar), nur Xerocomellus chrysenteron widersprach (giftig vs speisepilz_jung).
-- Verifiziert NACH Migration: 32 Zeilen, 0 Dup-Gruppen, alle tödlichen Arten erhalten + toedlich/giftig
-- (Amanita phalloides "Grüner Knollenblätterpilz", Amanita virosa "Kegelhütiger Knollenblätterpilz",
-- Cortinarius orellanus, Gyromitra, Pantherpilz, Fliegenpilz) — KEINE Giftart wurde essbar.
--
-- OFFEN (NICHT hier, braucht VAPKO/SwissFungi-Quellen, task_a8692b11): Item 5 (7 fehlende Kantone mit
-- ECHTEN VAPKO-Kontrollstellen) + Item 6 (Ausbau ~150 Arten + Verwechsler-Paare). Pilz-Essbarkeits-
-- und VAPKO-Kontaktdaten dürfen NICHT per LLM generiert werden (Fehlbestimmung kann tödlich sein).

-- (1) Xerocomellus chrysenteron (Genus vertippt 'Xerocomellas', Namen vermischt, Essbarkeit
--     widersprüchlich) → konservativ KOMPLETT entfernen; Scanner defaultet auf "im Zweifel VAPKO".
delete from public.mushroom_register where left(id::text,8) in ('01af8642','7e70c959');

-- (2) Duplikate gleicher Essbarkeit mergen (datenreichste/korrekt-benannte Zeile behalten):
delete from public.mushroom_register where left(id::text,8) in (
  'e630a10d',                          -- Agaricus arvensis  (behalten: 04c8a9ba)
  '55fae9c6','01d3a29b','7a3de028',    -- Agaricus campestris (behalten: 93b0ad9c "Wiesen-Champignon")
  '9b69d1d4',                          -- Amanita muscaria vapko4 (behalten: 44916898, vapko5 = vorsichtiger)
  'a706e6d5',                          -- Amanita pantherina vapko3 (behalten: 88696a38, vapko5 = vorsichtiger)
  '60ea6e1b','55906bb1',               -- Amanita phalloides (behalten: b552ea08 "Grüner Knollenblätterpilz")
  'a3889f29',                          -- Amanita virosa (behalten: 00849843)
  '893a1b86',                          -- Cantharellus cibarius (behalten: 95be88ed)
  '41867ca0'                           -- Morchella esculenta (behalten: d7a06e40)
);

-- (3) Garbled Anzeige-Namen korrigieren (Essbarkeit/vapko_klasse UNVERÄNDERT):
update public.mushroom_register set common_name_de = 'Kegelhütiger Knollenblätterpilz'
  where left(id::text,8) = '00849843';   -- A. virosa, war fälschlich "Weißer Fliegenpilz"
update public.mushroom_register set common_name_de = 'Schaf-Champignon (Anis-Egerling)'
  where left(id::text,8) = '04c8a9ba';   -- A. arvensis, war "Rotfüsschen"
update public.mushroom_register set common_name_de = 'Speise-Morchel'
  where left(id::text,8) = 'd7a06e40';   -- war "Morchel"

-- (4) UNIQUE-Index (case/whitespace-robust) gegen erneute Duplikate:
create unique index if not exists mushroom_register_sci_uniq
  on public.mushroom_register (lower(trim(scientific_name)));
