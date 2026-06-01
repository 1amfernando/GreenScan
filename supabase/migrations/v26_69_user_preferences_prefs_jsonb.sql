-- v26.69 Universal-Save Audit: user_preferences.prefs jsonb für freie Toggle-Storage
-- Vorher: savePref('homeWeather', true) konnte nicht in Cloud syncen
-- (Spalte fehlte, plus Alias-Bug gsPrefsPush vs gsPrefsPushNow).
-- Jetzt: alle Settings-Toggles landen in user_preferences.prefs jsonb.

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.user_preferences.prefs IS
  'v26.69: Freie Toggle-Storage für arbitrary savePref-Keys (homeWeather, showMoon, pestTips, etc). Strukturierte Felder (language, region, units, reminders_enabled) bleiben separate Columns.';

-- Sicherheits-Check: user_preferences hat RLS aktiv
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='user_preferences' AND n.nspname='public' AND c.relrowsecurity=true
  ) THEN
    ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
