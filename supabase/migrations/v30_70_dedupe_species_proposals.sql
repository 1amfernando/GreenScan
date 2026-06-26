-- v30.70: doppelte species_proposals entfernen + künftige verhindern. Angewendet 2026-06-27 via MCP.
-- Bisher erzeugte jeder Scan einer nicht-in-DB-Art eine neue Zeile; Prefer:resolution=ignore-duplicates
-- (Frontend gsScanPersistToCloud) war wirkungslos, weil KEIN Unique-Constraint existierte → Zamioculcas ×4,
-- Rosa sp. ×3. Zusammen mit dem v30.70-Matcher-Fix (in-DB-Arten erzeugen gar keine Vorschläge mehr) hält
-- das die Vorschlags-Queue sauber. Nur PENDING-Zeilen betroffen; je normalisiertem Schlüssel (latin sonst
-- name) bleibt die ÄLTESTE. Verifiziert: 20→15 pending, 0 verbleibende Dups, Index aktiv.

delete from public.species_proposals a
using public.species_proposals b
where a.review_status='pending' and b.review_status='pending'
  and lower(coalesce(nullif(a.latin,''), a.name)) = lower(coalesce(nullif(b.latin,''), b.name))
  and (a.created_at, a.id) > (b.created_at, b.id);

create unique index if not exists uq_species_proposals_pending_key
  on public.species_proposals (lower(coalesce(nullif(latin,''), name)))
  where review_status='pending';
