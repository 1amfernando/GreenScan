# AGENTS.md — Einstieg für jede KI, die an GreenScan arbeitet

Diese Datei ist ein **Zeiger**, kein zweites Regelwerk. Sie existiert, weil
nicht jedes Werkzeug `CLAUDE.md` von selbst lädt.

1. **Lies `docs/memory/README.md`** — zehn kurze Dateien, rund 25 Minuten,
   alles, was du vor der ersten Änderung wissen musst. `CLAUDE.md` ist das
   ausführliche Tagebuch dahinter.
2. **Lies das Brett, bevor du anfängst**, und sag, woran du sitzt:

   ```bash
   node scripts/austausch.js holen        # was andere Sitzungen gefunden, gefragt, vorgeschlagen haben
   node scripts/austausch.js neu anspruch --titel "…" --bereich "…"   # dann committen und pushen
   ```

   Du bist nicht die einzige Sitzung. Was du findest, fragst oder offen lässt,
   gehört aufs Brett (`docs/austausch/README.md`) — nicht in den Fliesstext
   eines Berichts, den nach dir niemand liest.
3. **Fahr die Prüfstände, bevor du etwas behauptest:**
   `bash scripts/pruefstaende.sh` (`docs/memory/04-pruefstaende.md`).

Nie direkt auf `main`. Nie eine Migration auf der Produktivdatenbank anwenden.
Das Repo ist öffentlich: keine Schlüssel, keine Adressen, keine Nutzerdaten.
