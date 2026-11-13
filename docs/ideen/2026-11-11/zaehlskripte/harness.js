const __GS_WURZEL = require('path').resolve(__dirname, '..', '..', '..', '..');   // die Wurzel des Repos (nachgetragen am 11.11.2026: vorher ein fester Pfad der Arbeitsumgebung)
// Laedt Artenliste + die ECHTEN Hilfsfunktionen aus index.html in eine Sandbox (nur lesen).
const fs = require('fs'), vm = require('vm');
const REPO = __GS_WURZEL;
const html = fs.readFileSync(REPO + '/index.html', 'utf8');
function quelle(decl, auf, zu) {
  const i = html.indexOf(decl);
  if (i < 0) throw new Error('nicht gefunden: ' + decl);
  let j = html.indexOf(auf, i + decl.length - 1), depth = 0, k = j, inS = null, esc = false, inRe = false;
  for (; k < html.length; k++) {
    const c = html[k];
    if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === inS) inS = null; continue; }
    if (c === '"' || c === "'" || c === '`') { inS = c; continue; }
    if (c === '/' && html[k + 1] === '/') { k = html.indexOf('\n', k); continue; }
    if (c === '/' && html[k + 1] === '*') { k = html.indexOf('*/', k) + 1; continue; }
    if (c === '/' ) { // Regex-Literal grob ueberspringen: nach ( , = : [ ! & | ? { } ; oder return
      let p = k - 1; while (p >= 0 && /\s/.test(html[p])) p--;
      const vor = html[p];
      if ('(,=:[!&|?{};'.includes(vor) || /return$/.test(html.slice(Math.max(0, p - 5), p + 1))) {
        let q = k + 1, cls = false;
        for (; q < html.length; q++) { const d = html[q]; if (d === '\\') { q++; continue; } if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) break; else if (d === '\n') break; }
        k = q; continue;
      }
    }
    if (c === auf) depth++; else if (c === zu) { depth--; if (depth === 0) break; }
  }
  return html.slice(i, k + 1);
}
const fn = n => quelle('\nfunction ' + n + '(', '{', '}');
const va = (n, a, z) => quelle('\nvar ' + n + ' = ', a, z) + ';';
const ctx = { window: {}, console: { warn() {}, log() {} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(REPO + '/data/plants.v1.js', 'utf8'), ctx);
vm.runInContext('var DB = window.DB;', ctx);
const teile = [
  va('_GS_MON_WORT', '{', '}'), va('_GS_JAHRESZEIT', '{', '}'), fn('gsSaisonMonate'),
  va('GS_BLUEHT_NICHT', '{', '}'), fn('gsBlueht'),
  fn('_gsNormLat'), fn('_gsNormLatVoll'), fn('_gsHatQualifier'), fn('_gsLatIndex'), fn('_gsArtGruppe'), fn('gsIstEssbar'),
  'var _gsAnzeigeMemo = null, _gsAnzeigeMemoN = 0;', fn('_gsArtAnzeige'), fn('_gsVorsichtigste'),
  fn('_gsLinaNorm'), fn('_gsArtenTreffer'), fn('_gsHoehenbandAus'), fn('_gsHoehenband'),
];
module.exports = { ctx, html, quelle, fn, va, teile, REPO, laden() { teile.forEach(t => vm.runInContext(t, ctx)); return ctx; } };
if (require.main === module) {
  try { module.exports.laden(); console.log('geladen. DB:', ctx.DB.length, '· gsSaisonMonate("Apr–Jun") =', JSON.stringify(vm.runInContext('gsSaisonMonate("Apr–Jun")', ctx)), '· _gsArtenTreffer("Maiglöckchen, Herbstzeitlose").zahl =', vm.runInContext('_gsArtenTreffer("Maiglöckchen, Herbstzeitlose").zahl', ctx)); }
  catch (e) { console.log('FEHLER', e.message); }
}
