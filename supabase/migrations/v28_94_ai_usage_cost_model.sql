-- v28.94 Finanz-Analyse Befund #1 (2026-06-10): fn_log_ai_usage berechnet Kosten selbst.
-- Neuer optionaler p_model-Parameter -> wenn p_cost_chf NULL ist, leitet die RPC die
-- CHF-Kosten aus Modell + Tokens ab (Preis-Tabelle EINMALIG hier in der DB = Single
-- Source of Truth). Backward-compatible: Edge-Fns (4-arg, service_role) rufen weiter,
-- p_model defaultet NULL. Neuer Client-Pfad (callAI/callVisionAI) ruft 5-arg mit Modell.
-- Getestet: Haiku 1M in + 1M out -> 0.9 + 4.4 = 5.30 CHF.
DROP FUNCTION IF EXISTS public.fn_log_ai_usage(text, integer, integer, numeric);
CREATE OR REPLACE FUNCTION public.fn_log_ai_usage(
  p_edge_fn text,
  p_tokens_in integer,
  p_tokens_out integer,
  p_cost_chf numeric DEFAULT NULL,
  p_model text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare v_in numeric; v_out numeric; v_cost numeric;
begin
  if p_cost_chf is not null then
    v_cost := p_cost_chf;
  elsif p_model is not null then
    -- CHF pro 1M Token (~ Anthropic-Listenpreise x USD->CHF, konservativ aufgerundet)
    if p_model ilike '%haiku%' then v_in := 0.9;  v_out := 4.4;
    elsif p_model ilike '%opus%' then v_in := 13.5; v_out := 67.5;
    else v_in := 2.7; v_out := 13.2; -- sonnet / unbekannt -> konservativ
    end if;
    v_cost := (coalesce(p_tokens_in,0)::numeric / 1000000.0 * v_in)
            + (coalesce(p_tokens_out,0)::numeric / 1000000.0 * v_out);
  else
    v_cost := 0;
  end if;
  insert into ai_daily_usage (date, edge_fn, total_tokens_in, total_tokens_out, total_cost_chf, call_count, updated_at)
  values (current_date, p_edge_fn, coalesce(p_tokens_in,0), coalesce(p_tokens_out,0), v_cost, 1, now())
  on conflict (date, edge_fn) do update set
    total_tokens_in  = ai_daily_usage.total_tokens_in  + excluded.total_tokens_in,
    total_tokens_out = ai_daily_usage.total_tokens_out + excluded.total_tokens_out,
    total_cost_chf   = ai_daily_usage.total_cost_chf   + v_cost,
    call_count       = ai_daily_usage.call_count + 1,
    updated_at       = now();
end;
$function$;
REVOKE ALL ON FUNCTION public.fn_log_ai_usage(text,integer,integer,numeric,text) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_log_ai_usage(text,integer,integer,numeric,text) TO authenticated, service_role;
