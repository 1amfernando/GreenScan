# DISASTER RECOVERY — GreenScan

> **Zweck:** Vollständige Wiederherstellung der App, falls dieser Laptop
> ausfällt, verloren geht oder gestohlen wird. **Nichts Kritisches liegt auf dem
> Laptop** — der Code ist auf GitHub, die Daten in Supabase, das Hosting bei
> Cloudflare, die Zahlungen bei Stripe. Der Laptop ist nur ein Fenster dorthin.
>
> **Stand:** 2026-08-27 (v30.81) · **Halte dieses Dokument aktuell.**
> **Wichtigste Regel:** Wenn Code nicht `git push`-t ist, existiert er nur auf
> diesem Laptop — pushe früh und oft.

---

## 0 · TL;DR — Wenn der Laptop JETZT stirbt

Du verlierst **nichts Wichtiges**, solange gilt:
1. ✅ Der Code ist auf **GitHub** (`github.com/1amfernando/GreenScan`) gepusht.
2. ✅ Die Daten sind in **Supabase** (Cloud, EU-Region, automatische Backups).
3. ✅ Das Live-Hosting läuft bei **Cloudflare Pages** (baut direkt aus GitHub).

Neuer Laptop → GitHub klonen → fertig. Die Live-App unter green-scan.ch läuft
in der Zwischenzeit **ununterbrochen weiter** (sie hängt nicht am Laptop).

Der einzige echte Verlust bei Laptop-Tod: **die Zugangsdaten/Passwörter**, falls
sie nur im Kopf oder lokal gespeichert sind. → Siehe §4 (Passwort-Manager!).

---

## 1 · Wo liegt WAS? (die 4 Säulen)

| Säule | Was | Wo | Backup-Lage |
|---|---|---|---|
| **Code** | `index.html`, `sw.js`, alle Edge-Fns, Migrationen, Docs | GitHub `1amfernando/GreenScan` | Git = verteilt; jeder Clone ist ein Voll-Backup |
| **Daten** | 178 Tabellen (User, Scans, Gärten, Abos, Wissen …) | Supabase Projekt `vowbiueikwrauuceilhc` (EU) | Supabase Auto-Backups (Plan-abhängig: Pro = PITR) |
| **Hosting** | Live-Auslieferung green-scan.ch | Cloudflare Pages | Baut deterministisch aus GitHub — kein separates Backup nötig |
| **Zahlungen** | Kunden, Abos, Webhooks | Stripe (Live-Mode) | Stripe hält alles serverseitig |

**Kernaussage:** 3 der 4 Säulen sind vollständig cloud-basiert und
laptop-unabhängig. Nur der **lokale Arbeits-Clone** des Codes ist am Laptop —
und der ist eine exakte Kopie von GitHub.

---

## 2 · Wiederherstellung auf einem neuen Rechner (Schritt für Schritt)

### 2.1 · Code zurückholen (5 Minuten)
```bash
# 1. Repo klonen — das ist die KOMPLETTE App (kein Build, keine Dependencies)
git clone https://github.com/1amfernando/GreenScan.git
cd GreenScan

# 2. Lokal testen (kein npm, kein Build-Step nötig — reine statische Files)
python3 -m http.server 8000
# → http://localhost:8000 im Browser öffnen
```
Das war's für den Code. `index.html` ist die ganze App (Monolith), `sw.js` der
Service-Worker, `data/plants.v1.js` die Arten-DB. Kein `npm install`.

### 2.2 · GitHub-Zugang wiederherstellen
- Login auf github.com mit deinem Account (`1amfernando`).
- Falls 2FA-Gerät weg: GitHub **Recovery-Codes** nutzen (→ §4, unbedingt sichern!).
- Neues Gerät autorisieren / neuen Personal Access Token erstellen für `git push`.

### 2.3 · Supabase-Zugang (Daten + Backend)
- Login auf **supabase.com** → Projekt `vowbiueikwrauuceilhc`.
- Dort liegen: alle Tabellen-Daten, Auth-User, Storage (Fotos), Edge-Functions
  (deployed), die Secrets/Env-Vars (`ANTHROPIC_API_KEY`, Stripe-Keys, VAPID …).
- **Wichtig:** Die Edge-Function-**Secrets** (Env-Vars im Supabase-Dashboard)
  sind NICHT im Git-Repo (korrekt so). Sie überleben in Supabase — aber wenn du
  Supabase-Zugang verlierst, sind sie weg. → §4.

### 2.4 · Cloudflare Pages (Hosting)
- Login auf **dash.cloudflare.com** → Pages-Projekt (verbunden mit GitHub-Repo).
- Deployt automatisch bei jedem Push auf `main`. Muss nach Laptop-Tod NICHT neu
  eingerichtet werden — läuft weiter. Nur falls das Cloudflare-Konto selbst weg
  ist: Pages-Projekt neu anlegen, GitHub-Repo verbinden, Custom-Domain
  green-scan.ch + greenscan.ch (Mail) neu verknüpfen.

### 2.5 · Stripe (Zahlungen)
- Login auf **dashboard.stripe.com** (Live-Mode).
- Kunden/Abos laufen serverseitig weiter. Webhook-Endpunkt zeigt auf die
  Supabase-Edge-Fn `stripe-webhook` — bleibt gültig solange Supabase steht.

---

## 3 · Zusätzliches Offline-Backup der Daten (empfohlen, monatlich)

Der Code ist durch Git verteilt gesichert. Die **Datenbank** solltest du
zusätzlich regelmässig exportieren, damit du auch bei Supabase-Ausfall/
-Kontoverlust die Nutzerdaten hast:

### 3.1 · DB-Dump ziehen (Supabase CLI)
```bash
# Einmalig: Supabase CLI installieren (https://supabase.com/docs/guides/cli)
supabase login
supabase link --project-ref vowbiueikwrauuceilhc

# Voll-Dump (Schema + Daten) — an sicherem Ort ablegen (externe Platte / Cloud-Drive)
supabase db dump --file greenscan_backup_$(date +%Y%m%d).sql --data-only
supabase db dump --file greenscan_schema_$(date +%Y%m%d).sql   # nur Schema
```
> Alternativ im Dashboard: Project → Database → Backups (Pro-Plan: Point-in-Time
> Recovery aktivieren — höchster Schutz).

### 3.2 · Was ins Offline-Backup gehört
- SQL-Dump (oben).
- Eine **Kopie dieser Datei** + `FULL_STACK_AUDIT_v30.81.md`.
- Die **Secret-Liste** (§4) — verschlüsselt!
- Optional: Storage-Bucket-Export (User-Foto-Uploads) via Supabase Storage.

Ablage: Nicht nur auf DEM Laptop. Mind. an 2 Orten (z.B. externe SSD + ein
verschlüsselter Cloud-Drive-Ordner). Regel: **3-2-1** — 3 Kopien, 2 Medien,
1 ausser Haus.

---

## 4 · Zugangsdaten & Secrets — der EINZIGE echte Single-Point-of-Failure

Der Code ist redundant (Git). Die **Zugänge** sind es nicht. Wenn diese
verloren gehen, ist die App zwar noch live, aber du kommst nicht mehr ran.

### 4.1 · Nutze einen Passwort-Manager (Bitwarden/1Password/…)
Speichere dort — NICHT im Repo, NICHT nur im Kopf:

| Zugang | Wofür | Recovery-Mechanismus sichern? |
|---|---|---|
| **GitHub** (`1amfernando`) | Code | ✅ 2FA-Recovery-Codes ausdrucken |
| **Supabase** | Daten + Backend + alle Server-Secrets | ✅ 2FA-Recovery |
| **Cloudflare** | Hosting + DNS für green-scan.ch | ✅ 2FA-Recovery |
| **Stripe** | Zahlungen (echtes Geld!) | ✅ 2FA-Recovery |
| **Domain-Registrar** | green-scan.ch / greenscan.ch | ✅ Login + Auto-Renew prüfen |
| **E-Mail** (info@greenscan.ch) | Passwort-Resets aller obigen | ✅ Kritisch — hier hängt alles dran |
| **Anthropic Console** | API-Key (falls global) | ✅ |

### 4.2 · Server-Secrets (liegen NUR in Supabase Env-Vars, NICHT in Git)
Diese sind nirgends im Code (korrekt — Sicherheit). Notiere im Passwort-Manager
WO sie liegen (Supabase Dashboard → Edge Functions → Secrets), damit du sie im
Notfall neu setzen/rotieren kannst:
- `ANTHROPIC_API_KEY` (KI-Scanner, Lina, Garten-Planer)
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
- VAPID-Keys (Push-Notifications: Public + **Private**)
- Diverse `app_settings`-Secrets (Admin-Secrets für Setup-Fns)

> ⚠️ **Sicherheits-Fund aus dem Audit (P1-2):** In der Git-History steckt noch
> ein altes (rotiertes) `ADMIN_SECRET` und in `AUFTRAG_v25.4_...md:270` ein
> `whsec_`-Prefix. Falls das Repo je public wird: History bereinigen + die
> betroffenen Secrets rotieren. Details in `FULL_STACK_AUDIT_v30.81.md §1/§2`.

---

## 5 · Team-Kontinuität (Bus-Faktor)

Falls DU ausfällst (nicht nur der Laptop): Mindestens eine zweite Vertrauens-
person sollte **Zugang zum Passwort-Manager-Notfall-Kit** haben (Bitwarden
Emergency Access / 1Password Recovery Kit). Sonst ist die App bei Verlust deiner
Zugänge nicht mehr wartbar, obwohl sie technisch weiterläuft.

Die AI-Agenten (Code + Cowork) brauchen zum Weiterarbeiten nur:
- GitHub-Repo-Zugang (Code)
- Supabase-Projekt-Zugang (DB + Edge-Fns)
Beides steht im Passwort-Manager (§4).

---

## 6 · Schnell-Checkliste „Ist mein Notfall-Setup vollständig?"

- [ ] Aktueller Stand ist auf GitHub gepusht (kein uncommitteter Code am Laptop).
- [ ] GitHub / Supabase / Cloudflare / Stripe / Registrar / E-Mail: je Login +
      2FA-Recovery-Codes im Passwort-Manager.
- [ ] Monatlicher Supabase-DB-Dump an 2 Orten (§3), zuletzt: __________ (Datum eintragen).
- [ ] Server-Secret-Liste im Passwort-Manager (WO sie liegen), verschlüsselt.
- [ ] Eine zweite Person hat Emergency-Access zum Passwort-Manager (§5).
- [ ] Domain-Auto-Renew für green-scan.ch aktiv (sonst läuft die Domain aus!).
- [ ] Diese Datei + `FULL_STACK_AUDIT_v30.81.md` liegen auch im Offline-Backup.

---

## 7 · Kontakte / Ankerpunkte

- **Repo:** https://github.com/1amfernando/GreenScan
- **Live:** https://green-scan.ch/ (kanonisch, mit Bindestrich)
- **Supabase-Projekt:** `vowbiueikwrauuceilhc` (EU-Region)
- **Onboarding für neue Agenten:** `CLAUDE.md` · **Status:** `STATUS.md` ·
  **Architektur:** `BACKEND_FRONTEND_MAP_v26.76.md`
- **Notruf-Info in der App:** Tox Info Suisse **145** (Pilz-/Vergiftungsnotfall)

---

*Dieses Dokument liegt bewusst IM Repo (GitHub) — damit es genau dann verfügbar
ist, wenn der Laptop weg ist: von jedem Gerät über github.com abrufbar. Halte
es bei jeder Infrastruktur-Änderung aktuell.*
