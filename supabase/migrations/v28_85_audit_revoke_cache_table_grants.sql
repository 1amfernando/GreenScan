-- v28-Audit Sprint D: überbreite anon/authenticated-Grants auf 4 service-role-only Cache/Queue-Tabellen
-- zurückgenommen (RLS=on + 0 Policies → bereits Default-Deny; FULL-Grants waren Schema-Footgun).
-- Kein Frontend-Zugriff (verifiziert), Befüllung via service_role-Edge-Fns. Zero-Impact-Härtung.
REVOKE ALL ON public.book_ocr_pages        FROM anon, authenticated;
REVOKE ALL ON public.species_import_queue   FROM anon, authenticated;
REVOKE ALL ON public.species_search_cache   FROM anon, authenticated;
REVOKE ALL ON public.weather_forecast_cache FROM anon, authenticated;
