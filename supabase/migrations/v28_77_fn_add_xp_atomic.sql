-- v28.77 FIX-6b Phase A: atomarer XP-Increment als Single-Source-Mechanismus.
-- profiles.xp wird ab v28.77 NUR noch von dieser Funktion geschrieben (Frontend gsAddXP
-- spiegelt jeden Gewinn debounced hierher; profileAddXp delegiert an gsAddXP; der Login-
-- Streak-Bonus laeuft ebenfalls hierdurch). Behebt den Lost-Update-Race des frueheren
-- read-modify-write via sbSaveProfile({xp}). Speist Leaderboards (v_xp_leaderboard_*),
-- v_my_friends.xp, v_admin_users.xp, v_user_search.xp + Cross-Device-XP.
-- Level-Schwellen = PROFILE_XP_TABLE (Frontend profileGetLevel) -> profiles.level bleibt konsistent.
-- HL#13: REVOKE FROM PUBLIC,anon + GRANT TO authenticated.
CREATE OR REPLACE FUNCTION public.fn_add_xp(p_amount integer)
RETURNS TABLE(xp integer, level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_xp    integer;
  v_level integer := 1;
  v_table integer[] := ARRAY[0,100,250,450,700,1000,1400,1900,2500,3200,4000,5000,6200,7600,9200,11000,13000,15500,18500,22000];
  i       integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  -- Anti-Abuse-Clamp: negativ -> 0, absurd hoch -> 50000 (erlaubt Boot-Sync-Erst-Migration).
  IF p_amount IS NULL OR p_amount < 0 THEN p_amount := 0; END IF;
  IF p_amount > 50000 THEN p_amount := 50000; END IF;

  IF p_amount = 0 THEN
    SELECT COALESCE(p.xp,0) INTO v_xp FROM public.profiles p WHERE p.id = v_uid;
  ELSE
    UPDATE public.profiles p
       SET xp = COALESCE(p.xp,0) + p_amount
     WHERE p.id = v_uid
     RETURNING p.xp INTO v_xp;
  END IF;

  IF v_xp IS NULL THEN v_xp := 0; END IF;

  -- Level aus Schwellen ableiten (1..20), identisch zu Frontend profileGetLevel.
  FOR i IN REVERSE array_length(v_table,1)..1 LOOP
    IF v_xp >= v_table[i] THEN v_level := i; EXIT; END IF;
  END LOOP;

  IF p_amount > 0 THEN
    UPDATE public.profiles p SET level = v_level WHERE p.id = v_uid;
  ELSE
    SELECT COALESCE(p.level, v_level) INTO v_level FROM public.profiles p WHERE p.id = v_uid;
  END IF;

  RETURN QUERY SELECT v_xp AS xp, v_level AS level;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_add_xp(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_add_xp(integer) TO authenticated;
