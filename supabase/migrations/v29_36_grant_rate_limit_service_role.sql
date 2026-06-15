-- v29.36: KI-Edge-Functions (service_role) sollen fn_check_rate_limit aufrufen können
-- (für serverseitiges Rate-Limiting des Pflanzen-Doktors / künftiger AI-Edge-Fns). Idempotent.
GRANT EXECUTE ON FUNCTION public.fn_check_rate_limit(text, text, integer) TO service_role, authenticated;
