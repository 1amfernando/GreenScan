-- v30.13: letzter unindexed FK aus dem alten 14er-Backlog (G5-Performance-Audit).
-- species_images.contributed_by → Index (Tabelle aktuell ~0 Zeilen, regulärer CREATE INDEX instant).
create index if not exists idx_species_images_contributed_by
  on public.species_images (contributed_by);
