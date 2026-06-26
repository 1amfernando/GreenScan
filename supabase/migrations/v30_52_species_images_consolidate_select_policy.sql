-- v30.52 (Cowork-Audit §3.3) — angewendet 2026-06-26 via MCP.
-- 2 überlappende permissive SELECT-Policies auf species_images zu EINER konsolidieren
-- (multiple_permissive_policies Perf-WARN; für authenticated wurden beide pro Zeile evaluiert).
-- Verhaltensgleich: anon → nur approved; authenticated → approved ODER eigene.
drop policy if exists "simg read approved" on public.species_images;
drop policy if exists "simg read own" on public.species_images;
create policy "simg_read_approved_or_own" on public.species_images
  for select to anon, authenticated
  using (review_status = 'approved' OR contributed_by = (select auth.uid()));
