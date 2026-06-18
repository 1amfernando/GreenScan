-- v29.58 — Kuratierte Agronomie-Referenz für gängige CH-Gartenkulturen (Mischkultur + Aussaat/Ernte +
-- Fruchtfolge-Familie). Erdet den KI-Gartenplaner: bisher waren species.companion_plants/sow_months/
-- harvest_months 0/2837 befüllt → Companion/Fruchtfolge/Timing waren prompt-only (LLM-geraten). Diese
-- Tabelle liefert geprüfte Standard-Werte (FiBL/Bioterra Mischkultur-Tabelle — dokumentiertes, NICHT
-- sicherheitskritisches Gartenwissen) als Referenz in den Planer-Prompt (gsPPbuildAgronomyRef →
-- userPrompt). anon+authenticated lesbar. Verifiziert: 25 Kulturen, anon-Read OK, alle mit Companions.
create table if not exists public.garden_crop_agronomy (
  id uuid primary key default gen_random_uuid(),
  crop text unique not null,
  latin text,
  family text,
  companion_good text[] default '{}',
  companion_bad  text[] default '{}',
  sow_months int[] default '{}',
  harvest_months int[] default '{}',
  frost_hardy text,
  soil_ph text,
  spacing_cm int,
  difficulty text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.garden_crop_agronomy enable row level security;
drop policy if exists garden_crop_agronomy_read on public.garden_crop_agronomy;
create policy garden_crop_agronomy_read on public.garden_crop_agronomy for select to anon, authenticated using (active = true);

insert into public.garden_crop_agronomy (crop, latin, family, companion_good, companion_bad, sow_months, harvest_months, frost_hardy, soil_ph, spacing_cm, difficulty, notes) values
 ('Tomate','Solanum lycopersicum','Nachtschattengewächse','{Basilikum,Petersilie,Karotte,Knoblauch,Kapuzinerkresse,Salat}','{Kartoffel,Fenchel,Erbse,Gurke}','{2,3}','{7,8,9,10}','frostempfindlich','6.0-7.0',60,'mittel','Vorziehen ab Februar, auspflanzen nach Eisheiligen; ausgeizen.'),
 ('Kartoffel','Solanum tuberosum','Nachtschattengewächse','{Bohne,Kohl,Spinat,Kapuzinerkresse,Mais}','{Tomate,Gurke,Kürbis,Sellerie,Sonnenblume}','{4,5}','{7,8,9}','bedingt','5.5-6.5',35,'leicht','Vorkeimen, anhäufeln; nicht nach Tomaten (gleiche Familie).'),
 ('Karotte','Daucus carota','Doldenblütler','{Zwiebel,Lauch,Knoblauch,Salat,Radieschen,Tomate}','{Dill,Pastinake}','{3,4,5,6}','{6,7,8,9,10}','winterhart','6.0-6.8',5,'mittel','Zwiebel als Nachbar vertreibt die Möhrenfliege; lockerer Boden.'),
 ('Zwiebel','Allium cepa','Lauchgewächse','{Karotte,Randen,Salat,Erdbeere}','{Bohne,Erbse,Kohl}','{3,4}','{7,8}','bedingt','6.0-7.0',12,'leicht','Steckzwiebeln einfacher als Aussaat.'),
 ('Knoblauch','Allium sativum','Lauchgewächse','{Karotte,Erdbeere,Tomate,Himbeere}','{Bohne,Erbse,Kohl}','{10,11}','{6,7}','winterhart','6.0-7.0',12,'leicht','Herbstpflanzung für beste Ernte.'),
 ('Lauch','Allium porrum','Lauchgewächse','{Karotte,Sellerie,Zwiebel,Tomate}','{Bohne,Erbse,Randen}','{2,3}','{9,10,11,12,1,2}','winterhart','6.5-7.5',15,'mittel','Tief pflanzen für viel Weiss; winterfest.'),
 ('Buschbohne','Phaseolus vulgaris','Hülsenfrüchte','{Bohnenkraut,Karotte,Gurke,Kohl,Salat,Sellerie}','{Zwiebel,Knoblauch,Lauch,Erbse,Fenchel}','{5,6}','{7,8,9}','frostempfindlich','6.0-7.0',8,'leicht','Stickstoffsammler; nicht vor Mitte Mai säen.'),
 ('Erbse','Pisum sativum','Hülsenfrüchte','{Karotte,Gurke,Radieschen,Salat,Kohlrabi}','{Bohne,Zwiebel,Knoblauch,Lauch,Tomate}','{3,4}','{6,7}','bedingt','6.0-7.0',5,'leicht','Frühe Aussaat möglich; Rankgitter.'),
 ('Gurke','Cucumis sativus','Kürbisgewächse','{Bohne,Dill,Salat,Kohl,Erbse,Sellerie}','{Tomate,Kartoffel,Radieschen}','{4,5}','{7,8,9}','frostempfindlich','6.0-7.0',40,'mittel','Wärmebedürftig; gleichmässig giessen.'),
 ('Zucchini','Cucurbita pepo','Kürbisgewächse','{Bohne,Mais,Kapuzinerkresse}','{Kartoffel,Gurke}','{4,5}','{6,7,8,9}','frostempfindlich','6.0-7.0',90,'leicht','Braucht viel Platz; nach Eisheiligen.'),
 ('Kürbis','Cucurbita maxima','Kürbisgewächse','{Bohne,Mais,Kapuzinerkresse}','{Kartoffel,Gurke}','{4,5}','{9,10}','frostempfindlich','6.0-7.0',120,'leicht','Sehr platzhungrig; vor Frost ernten.'),
 ('Salat','Lactuca sativa','Korbblütler','{Karotte,Radieschen,Erdbeere,Gurke,Zwiebel,Kohl}','{Petersilie}','{3,4,5,6,7,8}','{5,6,7,8,9,10}','bedingt','6.0-7.0',25,'leicht','Alle 3 Wochen nachsäen für laufende Ernte.'),
 ('Radieschen','Raphanus sativus','Kreuzblütler','{Karotte,Salat,Erbse,Spinat,Tomate,Kapuzinerkresse}','{Gurke}','{3,4,5,6,7,8}','{4,5,6,7,8,9}','bedingt','6.0-7.0',5,'leicht','3-4 Wochen bis Ernte; ideal für Anfänger.'),
 ('Spinat','Spinacia oleracea','Gänsefussgewächse','{Erdbeere,Kohl,Radieschen,Bohne,Tomate}','{Randen,Mangold}','{3,4,8,9}','{4,5,9,10,11}','winterhart','6.5-7.5',10,'leicht','Frühling + Herbst; schiesst im Hochsommer.'),
 ('Randen','Beta vulgaris','Gänsefussgewächse','{Zwiebel,Salat,Kohlrabi,Buschbohne}','{Stangenbohne,Spinat,Mangold}','{4,5,6}','{8,9,10}','bedingt','6.0-7.0',10,'leicht','Rote Bete; gut lagerfähig.'),
 ('Mangold','Beta vulgaris','Gänsefussgewächse','{Karotte,Radieschen,Kohl,Buschbohne}','{Randen,Spinat}','{4,5,6}','{7,8,9,10,11}','bedingt','6.0-7.0',25,'leicht','Schnittweise ernten; lange Erntezeit.'),
 ('Weisskohl','Brassica oleracea','Kreuzblütler','{Sellerie,Bohne,Erbse,Spinat,Salat,Tomate,Dill,Kapuzinerkresse}','{Zwiebel,Knoblauch,Erdbeere}','{3,4,5}','{9,10,11}','winterhart','6.5-7.5',50,'mittel','Starkzehrer; Fruchtfolge gegen Kohlhernie beachten.'),
 ('Brokkoli','Brassica oleracea','Kreuzblütler','{Sellerie,Bohne,Salat,Spinat,Dill,Kapuzinerkresse}','{Zwiebel,Knoblauch,Erdbeere,Tomate}','{3,4,6}','{6,9,10}','bedingt','6.5-7.5',45,'mittel','Haupt- und Seitenröschen ernten.'),
 ('Kohlrabi','Brassica oleracea','Kreuzblütler','{Salat,Spinat,Erbse,Randen,Sellerie}','{Stangenbohne,Tomate,Paprika}','{3,4,5,6,7}','{5,6,7,8,9,10}','bedingt','6.5-7.5',30,'leicht','Schnell; nicht zu spät ernten (holzig).'),
 ('Sellerie','Apium graveolens','Doldenblütler','{Kohl,Bohne,Lauch,Tomate,Gurke}','{Kartoffel,Mais,Salat}','{2,3}','{10,11}','bedingt','6.5-7.5',40,'anspruchsvoll','Lange Kulturzeit; gleichmässig feucht halten.'),
 ('Paprika','Capsicum annuum','Nachtschattengewächse','{Basilikum,Tomate,Karotte,Zwiebel}','{Bohne,Fenchel,Kohlrabi}','{2,3}','{7,8,9,10}','frostempfindlich','6.0-7.0',40,'mittel','Lange Voranzucht (12 Wochen); sehr wärmebedürftig.'),
 ('Basilikum','Ocimum basilicum','Lippenblütler','{Tomate,Paprika,Gurke}','{}','{3,4}','{6,7,8,9}','frostempfindlich','6.0-7.0',20,'leicht','Klassischer Tomatenpartner; kein kaltes Wasser.'),
 ('Erdbeere','Fragaria','Rosengewächse','{Knoblauch,Zwiebel,Spinat,Salat,Borretsch}','{Kohl}','{8,9}','{6,7}','winterhart','5.5-6.5',30,'leicht','Pflanzung im Spätsommer für Ernte im Folgejahr.'),
 ('Mais','Zea mays','Süssgräser','{Bohne,Kürbis,Gurke,Kartoffel}','{Randen,Sellerie}','{5}','{8,9,10}','frostempfindlich','6.0-7.0',40,'leicht','Milpa-Beet (Mais-Bohne-Kürbis) klassisch.'),
 ('Fenchel','Foeniculum vulgare','Doldenblütler','{Salat}','{Tomate,Bohne,Erbse,Kümmel}','{6,7}','{9,10,11}','bedingt','6.0-7.0',30,'mittel','Schlechter Nachbar für viele — eher separat setzen.')
on conflict (crop) do nothing;
