-- v26.36 Marketplace Pestizid-frei + Bio-Kennzeichnung (AUFTRAG_CODE_v26.36)
-- Fügt 3 Spalten zu marketplace_listings hinzu für Bio-Zertifikate (Knospe etc)
-- und eigene Aussage Pestizid-frei. Plus 2 Partial-Indexes für Filter-Queries.

alter table marketplace_listings
  add column if not exists organic_certified boolean default false,
  add column if not exists pesticide_free boolean default false,
  add column if not exists certification_label text;

comment on column marketplace_listings.organic_certified is 'v26.36: Bio-zertifiziert mit offiziellem Label';
comment on column marketplace_listings.pesticide_free is 'v26.36: Pestizid-frei eigene Aussage';
comment on column marketplace_listings.certification_label is 'v26.36: Knospe / EU-Bio / Demeter / Naturland etc';

create index if not exists idx_marketplace_listings_organic on marketplace_listings(organic_certified) where organic_certified = true;
create index if not exists idx_marketplace_listings_pestfree on marketplace_listings(pesticide_free) where pesticide_free = true;
