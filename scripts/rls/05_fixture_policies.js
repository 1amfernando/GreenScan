// Fixture gegen Live-Stand: steht in jeder nachgespielten Tabelle JEDE Live-Policy?
// (v33.59, Schlusspruefung c2#1)
//
// Anlass: feedback_votes_update_own (UPDATE, roles=public — anon durfte jede
// 'anon:%'-Stimme umschreiben) fehlte in der Fixture von 40_konto.js. Der Fall
// „besitzerlose Zeilen" war gruen, weil es die Policy, an der die Reparatur
// vorbeiging, im Nachbau gar nicht gab. Eine Policy, die der Nachbau nicht kennt,
// kann keine Migration als Luecke zeigen — PERMISSIVE-Policies werden ODER-verknuepft.
//
// Dieser Fall liest jede Fall-Gruppe unter scripts/rls/ (NN_name.js plus die
// gleichnamigen NN_*.sql), sammelt die Tabellen, die sie anlegt
// (`create table public.X`), und die Policies, die sie darauf anlegt, und haelt
// beides gegen live_policies.json (pg_policies, datiert). Jede Live-Policy einer
// nachgespielten Tabelle steht in der Fixture — mit demselben Befehl — ODER in
// BEWUSST_NICHT_NACHGESPIELT mit Grund. Eine Gruppe, die eine Tabelle ohne jede
// Policy anlegt, gilt als „Policies egal fuer diesen Fall" nur, wenn sie dort steht.
// Die Gegenprobe ist eingebaut: die UPDATE-Policy von feedback_votes aus dem
// Nachbau gestrichen → der Fall muss sie melden.
'use strict';
const fs = require('fs');
const path = require('path');

const LIVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'live_policies.json'), 'utf8'));

// Schluessel: '<gruppe>:<tabelle>:<policy>' oder '<gruppe>:<tabelle>:*' (die ganze Tabelle).
// Jeder Eintrag braucht einen Grund, der sagt, warum die Luecke den Fall NICHT entwertet.
const BEWUSST_NICHT_NACHGESPIELT = {
  '10:*': 'Gruppe q1 prueft SECURITY-DEFINER-Funktionen (Rumpf, ACL) — die laufen als Eigentuemer an RLS vorbei; die Tabellen sind Traeger, ihre Policies nicht Gegenstand',
  '20:quests:*': 'Quest-Katalog: gelesen und gezaehlt nur aus SECURITY-DEFINER-Funktionen (fn_quest_track_*); Pflege nur Admin',
  '20:user_scans:*': 'nur Ausloeser fuer den Quest-Trigger; die Live-Policies von user_scans spielt 40_konto im Wortlaut nach',
  '40:app_settings:*': 'nur Traeger fuer admin_emails, gelesen von is_admin_user() als Eigentuemer',
  '40:social_posts:*': 'der Fall fn_is_role liest nur (anon zaehlt oeffentliche Beitraege); die Schreibwege auf social_posts spielt 30_community im Wortlaut nach',
  '50:ai_usage:*': 'Hilfstabelle der Reproduktion (alte Bauform des ai-proxy, als service_role) — kein Weg aus Nutzerhand',
  '60:profiles:*': 'nur Rollentraeger fuer fn_role_at_least, gelesen als Eigentuemer',
};
// Umgekehrt: eine Policy im Nachbau, die es live NICHT gibt, ist eine Annahme — sie steht hier mit Grund.
const NUR_IM_NACHBAU = {
  '00:notiz:notiz_own': 'Probe-Tabelle des Laeufers (gibt es live nicht) — prueft das Grundgeruest, nicht den Live-Stand',
};

const benutzt = new Set();
function bewusst(gruppe, tab, name) {
  for (const k of [gruppe + ':*', gruppe + ':' + tab + ':*', gruppe + ':' + tab + ':' + name]) {
    if (BEWUSST_NICHT_NACHGESPIELT[k]) { benutzt.add(k); return BEWUSST_NICHT_NACHGESPIELT[k]; }
  }
  return null;
}

// Liest Tabellen und Policies einer Gruppe aus ihrem Quelltext.
function lies(text) {
  const tabellen = new Set();
  const policies = {};   // tabelle -> [{name, cmd}]
  for (const m of text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)\s*\(/g)) tabellen.add(m[1].toLowerCase());
  // Nur kleingeschrieben: die Nachbauten schreiben `create policy` (wie pg_dump), die Faelle zitieren
  // fuer ihre Gegenproben Zeilen der MIGRATION (`CREATE POLICY …`) — die sind nicht der Live-Stand.
  // Gefunden beim Bau: die zitierte neue UPDATE-Policy verdeckte die eigene Gegenprobe.
  for (const m of text.matchAll(/create\s+policy\s+(?:"([^"]+)"|(\w+))\s+on\s+public\.(\w+)([\s\S]*?);/g)) {
    const name = (m[1] || m[2]).toLowerCase(), tab = m[3].toLowerCase(), rest = m[4];
    const f = rest.match(/\bfor\s+(select|insert|update|delete|all)\b/i);
    (policies[tab] = policies[tab] || []).push({ name, cmd: f ? f[1].toUpperCase() : 'ALL' });
  }
  return { tabellen, policies };
}

function gruppen() {
  const alle = fs.readdirSync(__dirname);
  const g = {};
  for (const f of alle) {
    const m = f.match(/^(\d\d)_.*\.(js|sql)$/);
    if (!m || f === path.basename(__filename)) continue;
    (g[m[1]] = g[m[1]] || []).push(f);
  }
  return g;
}

function vergleiche(gruppe, text) {
  const { tabellen, policies } = lies(text);
  const fehlt = [], falsch = [], erklaert = [];
  for (const tab of tabellen) {
    const live = (LIVE.tabellen[tab] || []);
    const nach = policies[tab] || [];
    for (const p of live) {
      const n = p.name.toLowerCase();
      const da = nach.find(x => x.name === n);
      const grund = bewusst(gruppe, tab, n);
      if (da && da.cmd !== p.cmd) falsch.push(gruppe + ':' + tab + '.' + p.name + ' live ' + p.cmd + ', Nachbau ' + da.cmd);
      else if (!da && grund) erklaert.push(tab + '.' + p.name);
      else if (!da) fehlt.push(gruppe + ':' + tab + '.' + p.name + ' (' + p.cmd + ', roles=' + p.roles + ')');
    }
  }
  const erfunden = [];
  for (const tab of tabellen) {
    const live = (LIVE.tabellen[tab] || []).map(p => p.name.toLowerCase());
    for (const p of (policies[tab] || [])) {
      if (live.indexOf(p.name) >= 0 || bewusst(gruppe, tab, p.name)) continue;
      const k = gruppe + ':' + tab + ':' + p.name;
      if (NUR_IM_NACHBAU[k]) { benutzt.add('N' + k); continue; }
      erfunden.push(gruppe + ':' + tab + '.' + p.name + ' (' + p.cmd + ')');
    }
  }
  return { tabellen: tabellen.size, fehlt, falsch, erklaert, erfunden };
}

module.exports = [
  {
    name: 'Fixtures · jede Live-Policy einer nachgespielten Tabelle steht im Nachbau (gleicher Befehl) oder mit Grund in BEWUSST_NICHT_NACHGESPIELT — Gegenprobe: die UPDATE-Policy von feedback_votes gestrichen wird gemeldet',
    lauf: async () => {
      const g = gruppen();
      let tabs = 0, erklaert = 0;
      const fehlt = [], falsch = [], erfunden = [], texte = {};
      for (const [nr, dateien] of Object.entries(g)) {
        const text = dateien.map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
        texte[nr] = text;
        const r = vergleiche(nr, text);
        tabs += r.tabellen; erklaert += r.erklaert.length; fehlt.push(...r.fehlt); falsch.push(...r.falsch); erfunden.push(...r.erfunden);
      }
      if (tabs < 40) return { ok: false, warum: 'nur ' + tabs + ' nachgespielte Tabellen gefunden — der Leser sieht nichts' };
      // Ein Eintrag ohne Wirkung ist eine Ausrede, die niemand mehr braucht — er faellt auf.
      const tot = Object.keys(BEWUSST_NICHT_NACHGESPIELT).filter(k => !benutzt.has(k))
        .concat(Object.keys(NUR_IM_NACHBAU).filter(k => !benutzt.has('N' + k)));
      if (tot.length) return { ok: false, warum: 'BEWUSST_NICHT_NACHGESPIELT ohne Wirkung (Policy steht inzwischen im Nachbau oder die Tabelle nicht mehr): ' + tot.join(', ') };
      if (erfunden.length) return { ok: false, warum: erfunden.length + ' Policies im Nachbau, die es live nicht gibt (Name aus live_policies.json oder Grund in NUR_IM_NACHBAU): ' + erfunden.join(' · ') };
      if (fehlt.length || falsch.length) return { ok: false, warum: (fehlt.length ? fehlt.length + ' Live-Policies fehlen im Nachbau: ' + fehlt.join(' · ') : '') + (falsch.length ? ' · anderer Befehl: ' + falsch.join(' · ') : '') };
      // Gegenprobe: genau die Zeile, deren Fehlen den Fund verdeckt hat
      const z = /create policy feedback_votes_update_own on public\.feedback_votes[^;]*;/i;
      if (!z.test(texte['40'] || '')) return { ok: false, warum: 'Gegenprobe: die UPDATE-Policy steht nicht in der Fixture von 40_konto.js' };
      const gp = vergleiche('40', texte['40'].replace(z, ''));
      if (!gp.fehlt.some(x => /feedback_votes\.feedback_votes_update_own/.test(x))) return { ok: false, warum: 'Gegenprobe bleibt gruen: ' + JSON.stringify(gp.fehlt) };
      // Und eine Live-Tabelle, die es nicht gibt, darf nicht still als „ohne Policy" durchgehen
      const unbekannt = Object.keys(LIVE.tabellen).length;
      if (unbekannt < 150) return { ok: false, warum: 'live_policies.json fuehrt nur ' + unbekannt + ' Tabellen' };
      return { ok: true, info: Object.keys(g).length + ' Gruppen · ' + tabs + ' nachgespielte Tabellen · jede Live-Policy im Nachbau, ' + erklaert + ' mit Grund ausgelassen · Live-Stand ' + LIVE.stand + ' · Gegenprobe (feedback_votes_update_own gestrichen) gemeldet' };
    },
  },
];
