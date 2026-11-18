// Lieferkette: woher holen die Edge-Functions ihren fremden Code? (v33.59,
// Sicherheitspruefung 10.11.2026, lieferkette #1 / edge-stripe #14)
//
// Gemessen am 10.11.2026: 7× `npm:stripe@17`, 24× `jsr:@supabase/supabase-js@2`,
// 23× `jsr:@supabase/functions-js/edge-runtime.d.ts` (ganz ohne Version) und
// `https://esm.sh/stripe@18?target=denonext` — jede Auslieferung zog, was an dem
// Tag die neueste 17.x / 2.x / 18.x war, auch in den Functions mit dem
// Stripe-Geheimnis und dem Service-Role-Schluessel. Ein Lockfile gibt es nicht
// (ohne Deno hier nicht erzeugbar). Die Regel deshalb: jede Angabe nennt eine
// EXAKTE Version (MAJOR.MINOR.PATCH), und ein Paket hat ueberall DIESELBE —
// sonst laufen zwei Functions mit zwei verschiedenen Stripe-Bibliotheken.
//
// Gelesen wird jede Import-Angabe (statisch, `import "…"`, `import(…)`,
// `export … from`) in supabase/functions/**/*.{ts,mjs,js}, ohne Kommentare.
'use strict';
const fs = require('fs');
const path = require('path');

// Bewusste Abweichung von „ein Paket, eine Version" — mit Grund, je Datei.
// stripe-create-connect-account gibt KEINE apiVersion an und spricht damit die
// Standard-API-Version seiner Bibliothek (18.x: „basil", 17.x: „acacia"); ein
// Wechsel auf 17.7.0 aenderte still die Stripe-API dieser Function. Sie bleibt
// auf 18, aber exakt.
const AUSNAHMEN = {
  stripe: { 'stripe-create-connect-account/index.ts': { version: '18.5.0', grund: 'ohne apiVersion — die Hauptversion bestimmt die Stripe-API' } },
};
// Quellen, die eine Version in der Adresse tragen und deren Form wir lesen koennen.
// Alles andere (eine fremde https-Adresse) ist rot: wir wissen nicht, ob sie festliegt.
const EXAKT = /^\d+\.\d+\.\d+$/;

// spec → { quelle, paket, version, exakt, grund }
function lies(spec) {
  let m;
  if ((m = /^npm:((?:@[^/@]+\/)?[^/@]+)(?:@([^/]+))?(\/.*)?$/.exec(spec))) return mach('npm', m[1], m[2]);
  if ((m = /^jsr:(@[^/@]+\/[^/@]+)(?:@([^/]+))?(\/.*)?$/.exec(spec))) return mach('jsr', m[1], m[2]);
  if ((m = /^https:\/\/esm\.sh\/(?:v\d+\/)?((?:@[^/@?]+\/)?[^/@?]+)(?:@([^/?]+))?([/?].*)?$/.exec(spec))) return mach('esm.sh', m[1], m[2]);
  if ((m = /^https:\/\/deno\.land\/std(?:@([^/]+))?\/.*$/.exec(spec))) return mach('deno.land', 'deno-std', m[1]);
  if ((m = /^https:\/\/deno\.land\/x\/([^/@]+)(?:@([^/]+))?\/.*$/.exec(spec))) return mach('deno.land/x', m[1], m[2]);
  return { quelle: '?', paket: spec, version: null, exakt: false, grund: 'unbekannte Quelle — Version nicht lesbar' };
  function mach(quelle, paket, version) {
    const exakt = !!version && EXAKT.test(version);
    return { quelle, paket, version: version || null, exakt, grund: exakt ? '' : (version ? 'Bereich „' + version + '" statt MAJOR.MINOR.PATCH' : 'ohne Version') };
  }
}

// Import-Angaben eines Quelltexts (ohne Kommentare). Relative Pfade zaehlen nicht.
function angaben(text) {
  const aus = [];
  const re = /\b(?:from|import)\s*\(?\s*(["'`])([^"'`]+)\1/g;
  let m;
  while ((m = re.exec(text))) {
    const spec = m[2];
    if (/^(npm|jsr|node):|^https?:\/\//.test(spec) && !/^node:/.test(spec)) aus.push(spec);
  }
  return aus;
}

function dateien(fnRoot) {
  const aus = [];
  (function lauf(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) lauf(p);
      else if (/\.(ts|mjs|js)$/.test(e.name)) aus.push(p);
    }
  })(fnRoot);
  return aus.sort();
}

function inventar(h) {
  const root = path.join(h.repo, 'supabase', 'functions');
  const liste = [];
  for (const p of dateien(root)) {
    const rel = path.relative(root, p).split(path.sep).join('/');
    for (const spec of angaben(h.ohneKommentare(fs.readFileSync(p, 'utf8')))) liste.push(Object.assign({ datei: rel, spec }, lies(spec)));
  }
  return liste;
}

// (b) ein Paket, eine Version (ueber alle Quellen — esm.sh/@supabase/supabase-js
// und jsr:@supabase/supabase-js sind dasselbe Paket), Ausnahmen namentlich.
function versionen(liste) {
  const je = {};
  for (const a of liste) {
    if (!a.exakt) continue;
    const aus = AUSNAHMEN[a.paket] && AUSNAHMEN[a.paket][a.datei];
    if (aus && aus.version === a.version) continue;
    (je[a.paket] = je[a.paket] || {})[a.version + ' (' + a.quelle + ')'] = (je[a.paket][a.version + ' (' + a.quelle + ')'] || 0) + 1;
  }
  return Object.keys(je).filter(k => Object.keys(je[k]).length > 1).map(k => k + ': ' + Object.keys(je[k]).map(v => v + ' ×' + je[k][v]).join(' / '));
}

module.exports = [
  {
    name: 'Lieferkette · jede Import-Angabe nennt eine exakte Version',
    lauf: async (h) => {
      const liste = inventar(h);
      if (liste.length < 40) return { ok: false, warum: 'nur ' + liste.length + ' Angaben gefunden — liest der Fall ueberhaupt?' };
      const rot = liste.filter(a => !a.exakt);
      if (rot.length) {
        const zus = {};
        for (const a of rot) zus[a.spec + ' — ' + a.grund] = (zus[a.spec + ' — ' + a.grund] || 0) + 1;
        return { ok: false, warum: rot.length + ' von ' + liste.length + ' Angaben schweben: ' + Object.keys(zus).map(k => zus[k] + '× ' + k).join(' · ') };
      }
      const pakete = {};
      for (const a of liste) pakete[a.paket + '@' + a.version] = 1;
      return { ok: true, info: liste.length + ' Angaben in ' + new Set(liste.map(a => a.datei)).size + ' Dateien, alle exakt: ' + Object.keys(pakete).sort().join(', ') };
    },
  },
  {
    name: 'Lieferkette · ein Paket hat ueberall dieselbe Version (Ausnahmen mit Grund)',
    lauf: async (h) => {
      const liste = inventar(h);
      const zwei = versionen(liste);
      if (zwei.length) return { ok: false, warum: 'mehrere Versionen: ' + zwei.join(' · ') };
      // Eine Ausnahme, die es im Code nicht mehr gibt, ist eine Behauptung.
      for (const p of Object.keys(AUSNAHMEN)) for (const d of Object.keys(AUSNAHMEN[p])) {
        const a = liste.find(x => x.paket === p && x.datei === d);
        if (!a) return { ok: false, warum: 'Ausnahme ' + p + ' in ' + d + ' ist ueberholt (kein Import mehr)' };
        if (a.version !== AUSNAHMEN[p][d].version) return { ok: false, warum: 'Ausnahme ' + p + ' in ' + d + ' nennt ' + AUSNAHMEN[p][d].version + ', der Code ' + a.spec };
      }
      return { ok: true, info: 'Ausnahmen: ' + Object.keys(AUSNAHMEN).map(p => Object.keys(AUSNAHMEN[p]).map(d => p + '@' + AUSNAHMEN[p][d].version + ' in ' + d.split('/')[0]).join(', ')).join('; ') };
    },
  },
  {
    name: 'Lieferkette · Gegenrichtung: schwebend ist rot, exakt ist gruen (konstruierte Texte)',
    lauf: async (h) => {
      const schwebend = [
        'import Stripe from "npm:stripe@17";',
        'import { createClient } from "jsr:@supabase/supabase-js@2";',
        'import Stripe from "https://esm.sh/stripe@18?target=denonext";',
        'import "jsr:@supabase/functions-js/edge-runtime.d.ts";',
        "import webpush from 'npm:web-push@^3.6.7';",
        'import { serve } from "https://deno.land/std/http/server.ts";',
        'import x from "https://deno.land/x/oak@v12/mod.ts";',
        'const m = await import("npm:stripe");',
        'import y from "https://cdn.example.org/lib.js";',
      ];
      const exakt = [
        'import Stripe from "npm:stripe@17.7.0";',
        'import { createClient } from "jsr:@supabase/supabase-js@2.119.0";',
        'import Stripe from "https://esm.sh/stripe@18.5.0?target=denonext";',
        'import "jsr:@supabase/functions-js@2.119.0/edge-runtime.d.ts";',
        'import { serve } from "https://deno.land/std@0.224.0/http/server.ts";',
        'import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";',
      ];
      const falsch = [];
      for (const t of schwebend) {
        const a = angaben(h.ohneKommentare(t));
        if (a.length !== 1) falsch.push('nicht gefunden: ' + t);
        else if (lies(a[0]).exakt) falsch.push('als exakt durchgewunken: ' + t);
      }
      for (const t of exakt) {
        const a = angaben(h.ohneKommentare(t));
        if (a.length !== 1) falsch.push('nicht gefunden: ' + t);
        else if (!lies(a[0]).exakt) falsch.push('als schwebend gemeldet: ' + t + ' (' + lies(a[0]).grund + ')');
      }
      // Kommentare zaehlen nicht, relative Pfade auch nicht.
      if (angaben(h.ohneKommentare('// import Stripe from "npm:stripe@17";\nimport { a } from "../_shared/x.mjs";')).length) falsch.push('Kommentar oder relativer Pfad gezaehlt');
      // Paket ueber Quellen hinweg: zwei Versionen von supabase-js muessen auffallen.
      const zwei = versionen([
        Object.assign({ datei: 'a/index.ts', spec: 's1' }, lies('jsr:@supabase/supabase-js@2.119.0')),
        Object.assign({ datei: 'b/index.ts', spec: 's2' }, lies('https://esm.sh/@supabase/supabase-js@2.39.0')),
      ]);
      if (zwei.length !== 1) falsch.push('zwei supabase-js-Versionen nicht erkannt');
      // Die Ausnahme gilt nur fuer IHRE Datei und IHRE Version.
      const fremd = versionen([
        Object.assign({ datei: 'stripe-checkout/index.ts', spec: 's1' }, lies('npm:stripe@17.7.0')),
        Object.assign({ datei: 'stripe-portal/index.ts', spec: 's2' }, lies('npm:stripe@18.5.0')),
      ]);
      if (fremd.length !== 1) falsch.push('Ausnahme greift in einer fremden Datei');
      return falsch.length ? { ok: false, warum: falsch.join(' · ') } : { ok: true, info: schwebend.length + ' schwebend rot, ' + exakt.length + ' exakt gruen' };
    },
  },
];
