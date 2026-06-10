-- v29.08 (Bug-Sweep Fix 4/4): sensor_alerts INSERT-Policy
-- sensor_alerts hatte RLS aktiv, aber NUR SELECT+UPDATE-Policy (keine INSERT) →
-- jeder authenticated-INSERT (gsShFireAlert Cloud-Log) wurde silent als 42501/403
-- abgelehnt → Sensor-Alarm-Historie wurde für reale (Nicht-Demo-)Sensoren NIE
-- persistiert (Toast/Notification erschienen, Tabelle blieb leer).
-- HL#6: (SELECT auth.uid())-Wrap für Skalierung. Verifiziert als authenticated-JWT:
-- eigene user_id INSERT ok, fremde user_id korrekt abgelehnt.
CREATE POLICY sensor_alerts_insert_own ON public.sensor_alerts
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
