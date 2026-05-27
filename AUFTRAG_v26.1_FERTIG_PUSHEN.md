# AUFTRAG v26.1 — FERTIG, NUR NOCH PUSHEN

> **Cowork-Status 2026-05-19:** Code-Edits für v26.1 sind in `index.html`, `sw.js` und `_headers` fertig gemacht (3 modified files, staged), aber Sandbox kann nicht committen wegen `.git/index.lock` (Permission). Fernando oder Code muss commit + push lokal/CI-seitig ausführen.

---

## 🎯 Was v26.1 löst (User-Sicht)

1. **Karte nicht mehr grau:** Wenn Swisstopo nicht erreichbar ist, switcht der Code nach 5 Tile-Fehlern in 10s automatisch auf OSM. Vorher: graue Map mit blauem Punkt forever.
2. **Karten-Wahl persistiert:** Wer Satellit oder Wanderwege bevorzugt, sieht sie beim nächsten Öffnen sofort wieder (`localStorage.gs_map_layer`).
3. **Update-News einfach erklärt:** „Was ist neu"-Modal + About-Changelog bevorzugen `user_items` (ohne technisches `bold:`-Präfix). Code-Kauderwelsch nur noch für Devs unter `items`.

---

## 📝 Geänderte Dateien

| Datei | Vorher | Nachher | Diff-Stat |
|---|---|---|---|
| `index.html` | v25.38 | v26.1 | +117 / -16 (Map-Helper, gsSetLayer, gsRenderAboutChangelog, _gsWhatsNewInit, GS_RELEASES + v26.1-Entry + retrofit v25.38, meta app-version) |
| `sw.js` | gs-v25.38 | gs-v26.1 | +2 / -1 (Top-Comment + VERSION) |
| `_headers` | v25.38 | v26.1 | +1 / -1 (CSP connect-src: wmts.geo.admin.ch + arcgisonline + opentopomap + fastly.net + *.geo.admin.ch) |

---

## ✅ Verify (lokal bereits gelaufen)

```
7/7 inline-scripts node --check OK
GS_VERSION = 'v26.1' (1 Treffer, Z.46076)
sw.js VERSION = 'gs-v26.1'
_headers Header v26.1
meta app-version = 26.1.20260519
_gsAddLayerWithFallback: 3 Call-Sites (Init + Switch + Recursion-Fallback)
user_items / user_summary: v26.1 + v25.38 retro-gefüllt
```

---

## 🚀 Commit + Push (Fernando oder Code)

```bash
cd ~/Documents/Claude\ wichtige\ dateien/local-agent-mode-sessions/repo-clone

# Lock-File ist vom Sandbox stehen geblieben, lokal entfernen:
rm -f .git/index.lock

# Falls Files noch nicht im Index (sollten sein, da Sandbox `git add` lief):
git add index.html sw.js _headers

git commit -m "v26.1: 🗺️ Karten-Reparatur + nutzerfreundliche Release-Notes

Karten-Fix nach Fernando-Report 'graue Map + blauer Punkt':
- _gsAddLayerWithFallback: tileerror-Watcher mit Auto-Fallback Swisstopo→OSM
  nach 5 Fehlern innerhalb 10s. crossOrigin:true + keepBuffer:2 defaults.
- gsSetLayer persistiert User-Wahl in localStorage (Key gs_map_layer).
- gsCreateMap liest saved layer beim Init und stellt Button-Active sync.
- CSP connect-src um wmts.geo.admin.ch + *.geo.admin.ch + arcgisonline +
  *.tile.opentopomap.org + *.fastly.net erweitert.

User-friendly Release-Notes (v26.2 vorgezogen):
- GS_RELEASES: optional user_summary + user_items (ohne 'bold').
- gsRenderAboutChangelog + Whats-new-Modal bevorzugen user_items.
- v26.1 + v25.38 retro-gefüllt mit nutzerfreundlichen Beschreibungen.

Version-Sync: GS_VERSION→v26.1, sw.js→gs-v26.1, _headers→v26.1,
meta app-version→26.1.20260519.

Verify: 7/7 inline-scripts node --check OK."

git push origin main

# Tag setzen (v26.0 wurde lokal in Sandbox getaggt aber nicht gepusht):
git tag -a v26.0 -m "v26.0 Pre-Release-stable — Pro-only Restructure, KI-Doctor, Trial-7d" 2>/dev/null || true
git tag -a v26.1 -m "v26.1 Karten-Reparatur + user-friendly Release-Notes"
git push origin v26.0 v26.1
```

Cloudflare Pages baut automatisch nach Push auf `main`. ~2 Min Live.

---

## 🧪 Smoke-Test nach Deploy (Fernando ODER Code)

```bash
# 1. Version live?
curl -s https://green-scan.ch/ | grep -oE "GS_VERSION = '[^']*'"
# erwartet: v26.1

# 2. SW gebumped?
curl -s https://green-scan.ch/sw.js | grep "VERSION ="
# erwartet: gs-v26.1

# 3. CSP enthält wmts?
curl -sI https://green-scan.ch/ | grep -oE "wmts\.geo\.admin\.ch"
# erwartet: 1 Treffer
```

Browser:
- Hard-Refresh → SW-Update-Banner → klick → reload.
- Map-Tab öffnen → Swisstopo sollte sichtbar sein. Falls Tile-Errors: nach ~10s automatisch OSM → Toast „Karte über Standard-Layer geladen".
- Layer wechseln (z.B. Satellit) → App schließen → wieder öffnen → Map-Tab → muss Satellit sein.
- Settings → „About" / „Was ist neu" → v26.1-Eintrag muss in einfacher Sprache stehen (kein `<b>...:</b>` Präfix mehr für user_items).

---

## 📅 Nächste autonome Sprints (Code arbeitet selbst durch)

Siehe `AUFTRAG_v26.x_ROADMAP_AUTONOM.md` für Details:
- **v26.3** A11y — aria-labels für Top-100 Icon-only Buttons
- **v26.4** Maxlength + Z-Index-Tokens
- **v26.5** Console-Cleanup + Lazy-Split
- **v26.6** Marketplace-Connect-Frontend (Backend Edge-Fn wartet aus Cowork)
- **v26.7** Trial-End-Reminder
- **v26.8** i18n Pass-3
- **v26.9** AR-View MVP (optional)
- **v26.10** Memory-Files konsolidieren

---

**Stand:** 2026-05-19 · v26.1 fertig zum Pushen · Sandbox-Lock blockiert direkten Push (Cowork-Constraint) · Fernando/Code: ein `git commit + push` reicht.
