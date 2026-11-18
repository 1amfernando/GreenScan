// plan_antwort.mjs — prueft die Antwort der KI an plan-iterate, BEVOR sie einen Plan ersetzt.
//
// Reines ESM ohne Typen (Deno UND Node, Pruefstand scripts/edge/70_reste.js).
//
// Anlass (v33.59, Brett 9d96): plan-iterate las stop_reason nicht — ein bei max_tokens
// abgeschnittener Plan endete im Parse-Fehler, ein zufaellig gueltiges Teil-JSON wurde
// geschrieben. Und das geparste JSON ersetzte `garden_plans.ai_analysis` ohne jeden Blick
// auf seine Form: `recommended_plants: "alles weg"` oder eine nackte Liste waeren der
// neue Plan gewesen, und die App (gsBuildGardenScanResultPreview, _gsSanitizeGardenPlan)
// liest `recommended_plants` als Liste, `site_analysis`/`plan_summary`/`layout_grid` als
// Objekt und `warnings` als Liste.
//
// Vier Zustaende, jeder mit Grund: ok · abgeschnitten · kein_json · struktur.

export const PLAN_ZUSAMMENFASSUNG_MAX = 200;   // wie im Prompt („max 200 Zeichen")

const istObjekt = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

// Der Text des ersten Text-Blocks (Denk-Bloecke hat rufeModell schon entfernt).
function antwortText(daten) {
  const c = daten && Array.isArray(daten.content) ? daten.content : [];
  const b = c.find((x) => x && x.type === 'text' && typeof x.text === 'string');
  return b ? b.text : '';
}

// Die Form, die die App an ai_analysis liest. null = in Ordnung, sonst der Grund.
export function planFormFehler(a) {
  if (!istObjekt(a)) return 'kein Objekt';
  if (!Array.isArray(a.recommended_plants)) return 'recommended_plants ist keine Liste';
  for (let i = 0; i < a.recommended_plants.length; i++) {
    const p = a.recommended_plants[i];
    if (!istObjekt(p) || typeof p.name !== 'string' || !p.name.trim()) return 'Pflanze ' + i + ' ohne Namen';
  }
  for (const k of ['site_analysis', 'plan_summary', 'layout_grid']) {
    if (a[k] != null && !istObjekt(a[k])) return k + ' ist kein Objekt';
  }
  if (a.warnings != null && !Array.isArray(a.warnings)) return 'warnings ist keine Liste';
  return null;
}

export function planAntwortPruefen(daten) {
  // Abgeschnitten heisst unvollstaendig — auch wenn der Rest zufaellig parst.
  if (daten && daten.stop_reason === 'max_tokens') return { zustand: 'abgeschnitten', grund: 'stop_reason max_tokens' };
  const roh = antwortText(daten);
  let a;
  try {
    a = JSON.parse(roh.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, '').trim());
  } catch (_) {
    return { zustand: 'kein_json', grund: 'Antwort ist kein JSON' };
  }
  const f = planFormFehler(a);
  if (f) return { zustand: 'struktur', grund: f };
  const zs = a.change_summary;
  delete a.change_summary;
  const zusammenfassung = typeof zs === 'string' ? zs.slice(0, PLAN_ZUSAMMENFASSUNG_MAX) : '';
  return { zustand: 'ok', analyse: a, zusammenfassung };
}
