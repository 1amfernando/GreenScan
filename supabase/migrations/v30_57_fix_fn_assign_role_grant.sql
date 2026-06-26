-- v30.57: fn_assign_role hatte KEINEN authenticated-EXECUTE-Grant (nur service_role/postgres)
-- → Admin (authenticated) bekam "permission denied for function fn_assign_role" beim Rollen-Ändern
-- (Mitarbeiter/Experte/Status). Einzige admin-RPC der Klasse ohne den Grant (alle fn_admin_* hatten ihn).
-- Die Funktion ist intern admin-gated (_caller_role='admin') → Grant an authenticated ist sicher (HL#13).
-- Angewendet 2026-06-26 via MCP.
revoke execute on function public.fn_assign_role(uuid, text, text) from anon;
grant execute on function public.fn_assign_role(uuid, text, text) to authenticated;
