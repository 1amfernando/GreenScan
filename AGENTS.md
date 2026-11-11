# AGENTS.md — Einstieg für jede KI, die an GreenScan arbeitet

Ein **Zeiger**, kein zweites Regelwerk (nicht jedes Werkzeug lädt `CLAUDE.md` von selbst).

1. `docs/memory/README.md` lesen — kurz, alles vor der ersten Änderung. `CLAUDE.md` ist das Tagebuch dahinter.
2. `node scripts/austausch.mjs holen` — du bist nicht die einzige Sitzung. Was andere gefunden,
   gefragt und vorgeschlagen haben, steht auf dem Brett; was du findest, gehört dorthin
   (`docs/austausch/README.md`), nicht in einen Bericht, den nach dir niemand liest.
3. `bash scripts/pruefstaende.sh`, bevor du etwas behauptest.

Nie direkt auf `main`. Nie eine Migration auf der Produktivdatenbank anwenden. Das Repo ist
öffentlich: keine Schlüssel, keine Adressen, keine Nutzerdaten.
