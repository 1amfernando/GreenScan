// loeschung_regeln.mjs — was ein Konto-Loeschen alles raeumt (v33.17)
//
// Reines ESM, von Deno (delete-user/index.ts) und Node (scripts/loeschung_check.js)
// importierbar — dieselbe Bauform wie ingest_regeln.mjs: die LISTEN und die
// RECHNUNG stehen hier, die Edge-Function ist nur der Rand darum (Client,
// Aufrufe, Antwort). Wer eine Tabelle mit einer Nutzer-Kennung anlegt oder
// einen Bucket, traegt sie hier ein — der Pruefstand haelt die Listen gegen
// eine datierte Momentaufnahme der Live-Datenbank (docs/loeschung-inventar.json).
//
// Drei Klassen fuer jede Spalte, die auf eine Person zeigt:
//   kaskade  — FK auf auth.users mit ON DELETE CASCADE: faellt mit dem Konto
//   explizit — steht in USER_TABLES und wird VOR dem Konto geloescht (auch dann,
//              wenn die Kaskade sie erreichen wuerde: haelt die auth-Loeschung
//              aus irgendeinem Grund nicht, sind die persoenlichen Daten trotzdem weg)
//   bewusst  — bleibt mit Grund (Beitrag zum Gemeingut, Moderationsbeleg,
//              anonymisierte Zaehlung); die Kennung wird per FK auf NULL gesetzt
//              oder haengt ohne FK in der Luft — beides steht hier mit Namen
// Alles andere ist FEHLT, und der Pruefstand meldet es.

// Tabellen mit einer Nutzer-Spalte, die der Service-Role-Client VOR dem Konto
// leert (`delete … where user_id = uid`). Alphabetisch; die fuenf Geraetetabellen
// gibt es erst nach 20260903_oekosystem_v1_geraete.sql / 20260905_device_daily.sql
// — bis dahin steht „error: relation … does not exist" im Zaehler, sonst nichts.
export const USER_TABLES = [
  'abo_events',
  'ai_queries',
  'ai_usage',              // v33.17: user_id ohne FK — blieb bisher liegen
  'book_ingest_jobs',
  'device_commands',
  'device_daily',
  'device_readings',
  'device_rules',
  'devices',
  'feedback_items',
  'friendships',
  'garden_diary',
  'garden_harvests',
  'garden_plantings',
  'garden_tasks',
  'gardens',
  'launch_offer_usage',
  'marketplace_listings',
  'notifications',
  'plant_diagnoses',
  'post_comments',
  'post_likes',
  'push_subscriptions',
  'quiz_answers',
  'quiz_ranking',
  'scan_corrections',
  'scan_events',
  'sensor_alerts',
  'sensor_devices',
  'sensor_readings',
  'social_posts',
  'species_proposals',
  'species_search_log',    // v33.17: Suchbegriffe, user_id ohne FK — blieben bisher liegen
  'species_watchlist',
  'stripe_subscriptions',
  'user_gardens',
  'user_plants',
  'user_preferences',
  'user_quest_progress',
  'user_scans',
  'user_species',
  'user_submissions',
];

// Storage-Buckets, in denen die App unter `<uid>/…` ablegt (gemessen 10.09.2026:
// scan-images 92, species-images 10, book-pdfs 67 Objekte — ALLE mit uid-Praefix).
// `recipe-photos` steht als Ziel in der App; gibt es den Bucket nicht, meldet
// der Zaehler „error: Bucket not found", sonst nichts.
export const BUCKETS = ['scan-images', 'species-images', 'book-pdfs', 'recipe-photos'];

// Spalten, die mit Grund NICHT geraeumt werden. Schluessel `tabelle.spalte`.
export const BEWUSST = {
  'analytics_events.user_id':          'FK set null — das Ereignis bleibt ohne Kennung (Zaehlung, MAU); kein Inhalt der Person',
  'client_errors.user_id':             'FK set null — der Fehlerbericht bleibt anonym',
  'audit_log.actor_id':                'FK set null — das Protokoll bleibt, ohne Kennung (revDSG: Nachvollziehbarkeit der Loeschung selbst)',
  'app_settings.updated_by':           'FK set null — Systemeinstellung, kein Inhalt der Person',
  'book_ingest_jobs.uploaded_by':      'FK set null; die Zeile selbst geht ueber user_id (USER_TABLES)',
  'book_species_candidates.reviewed_by': 'FK set null — Pruefvermerk am Gemeingut (Artenkandidat)',
  'org_invites.used_by':               'FK set null — Einladung bleibt bei der Organisation',
  'org_members.invited_by':            'FK set null — Mitgliedschaft der ANDEREN Person bleibt',
  'profiles.role_assigned_by':         'FK set null — Rollenvergabe an andere bleibt nachvollziehbar',
  'quiz_battles.opponent_id':          'FK set null — die Runde des Gegners bleibt; als Herausforderer faellt sie (Kaskade)',
  'seasonal_highlights.created_by':    'FK set null — redaktioneller Inhalt (Gemeingut)',
  'seasonal_tips.created_by':          'FK set null — redaktioneller Inhalt (Gemeingut)',
  'species_images.contributed_by':     'FK set null — Bild bleibt bei der Art (Gemeingut), Kennung weg',
  'species_proposals.reviewed_by':     'FK set null — Pruefvermerk; der eigene Vorschlag geht ueber user_id (USER_TABLES)',
  'user_reports.reporter_id':          'kein FK, NOT NULL — Meldung ueber ANDERE bleibt als Moderationsbeleg; die Kennung haengt in der Luft, sie zeigt auf nichts mehr',
  'class_assignments.created_by':      'kein FK, NOT NULL — Unterrichtsinhalt der Organisation, kein Inhalt der Person',
  'org_classes.created_by':            'kein FK, NOT NULL — Klasse der Organisation, kein Inhalt der Person',
  'organizations.created_by':          'RESTRICT, NOT NULL — die Loeschung wird VOR dem ersten Schritt abgelehnt (loeschSperre, 409 org_creator): sonst blieben Konto und Login stehen, NACHDEM Tabellen und Profil weg sind',
};

// Ersteller einer Organisation koennen ihr Konto nicht loeschen, solange die
// Organisation ihnen gehoert — `organizations.created_by` ist NOT NULL mit
// ON DELETE RESTRICT. Die Sperre greift VOR dem ersten Loeschschritt; die
// Antwort nennt die Organisationen beim Namen, damit die App es sagen kann.
export function loeschSperre(organisationen) {
  const liste = Array.isArray(organisationen) ? organisationen.filter(o => o && (o.name || o.id)) : [];
  if (!liste.length) return { gesperrt: false };
  return { gesperrt: true, status: 409, error: 'org_creator',
           organizations: liste.map(o => String(o.name || o.id)) };
}

// Aus einer `storage.list(uid)`-Antwort die vollen Pfade zum Entfernen.
// Ordner-Eintraege (id null) werden uebersprungen — die App legt flach unter
// `<uid>/<datei>` ab; ein Unterordner waere ein Zeichen, dass jemand die Ablage
// geaendert hat, und den meldet der Pruefstand ueber die Momentaufnahme.
export function speicherPfade(uid, eintraege) {
  const u = String(uid || '');
  if (!u) return [];
  return (Array.isArray(eintraege) ? eintraege : [])
    .filter(e => e && e.name && e.id !== null && e.id !== undefined)
    .map(e => u + '/' + String(e.name));
}

// Klassifiziert jede Nutzer-Spalte der Momentaufnahme. `inventar.spalten`:
// [{tabelle, spalte, fk: 'c'|'n'|'r'|null}]. Rueckgabe: [{tabelle, spalte, klasse, grund}].
export function klassifiziere(inventar) {
  const spalten = (inventar && Array.isArray(inventar.spalten)) ? inventar.spalten : [];
  const explizit = new Set(USER_TABLES);
  return spalten.map(s => {
    const key = s.tabelle + '.' + s.spalte;
    if (BEWUSST[key]) return { tabelle: s.tabelle, spalte: s.spalte, klasse: 'bewusst', grund: BEWUSST[key] };
    if (s.tabelle === 'profiles' && s.spalte === 'id') return { tabelle: s.tabelle, spalte: s.spalte, klasse: 'explizit', grund: 'Schritt 2 der Edge-Function (id = uid)' };
    if (explizit.has(s.tabelle) && s.spalte === 'user_id') return { tabelle: s.tabelle, spalte: s.spalte, klasse: 'explizit', grund: 'USER_TABLES' };
    if (s.fk === 'c') return { tabelle: s.tabelle, spalte: s.spalte, klasse: 'kaskade', grund: 'FK auth.users ON DELETE CASCADE' };
    return { tabelle: s.tabelle, spalte: s.spalte, klasse: 'FEHLT', grund: s.fk === 'n' ? 'set null ohne Begruendung' : s.fk === 'r' ? 'RESTRICT ohne Sperre' : 'kein FK, nicht in USER_TABLES, nicht in BEWUSST' };
  });
}

// Die Meldung, die die App bei einer Sperre bekommt. `sbFetch` reicht von einer
// Nicht-2xx-Antwort NUR `message` und `status` weiter (index.html, sbFetch) —
// deshalb reisen die Namen der Organisationen IN der Meldung, mit festem
// Praefix, das die App erkennt (GS_LOESCH_SPERRE in gsExecuteDeleteAccount).
export const SPERRE_PRAEFIX = 'org_creator: ';
export function sperreMeldung(sperre) {
  if (!sperre || !sperre.gesperrt) return '';
  return SPERRE_PRAEFIX + (sperre.organizations || []).join(', ');
}
