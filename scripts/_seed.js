/**
 * _seed.js — gemeinsame Beispieldaten fuer alle Pruefstaende.
 *
 * Lag bis v31.45 nur in render_check.js. Der Verdrahtungs-Pruefstand
 * brauchte dieselben Daten; zweimal dasselbe zu pflegen laeuft
 * zwangslaeufig auseinander. Wird per page.addInitScript(...) in die
 * Seite gereicht, laeuft also IM Browser — kein require darin.
 */
// Der Gast-Modus ist KEIN Weg hinein: er wurde in v25.33 abgeschaltet
// (gsActivateGuestMode ist ein leerer Rumpf), der Zweig in gsCheckOnboarding
// ist tot. Was die App-Huelle verdeckt, ist der Login-Flash-Guard: ohne
// gs_sb_token setzt er html.gs-preauth und damit
//   #app{display:none!important} + #gs-onboarding{display:block!important}
// Also einen Token setzen — dann greift der Guard gar nicht erst. Dazu ein
// wenig Beispieldaten, sonst zeigen die Tabs nur Leerzustaende.
module.exports = () => { try {
  const D = 86400000, now = 1756684800000;   // fest, damit Laeufe vergleichbar bleiben
  const set = (k, v) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  set('gs_sb_token', 'pruefstand-kein-echter-token');   // nur gegen den Flash-Guard
  set('gs_sb_expires', String(now + 30*D));
  set('gs_consent', { analytics:false });
  set('gs_lang', 'de');
  set('gs_sb_display_name', 'Testnutzerin');
  set('gs_user_location', { lat:47.3769, lon:8.5417, name:'Zürich', canton:'ZH', country:'CH', zip:'8001' });
  set('gs_home_weather_loc', { lat:47.3769, lon:8.5417, name:'Zürich' });
  // v31.46: lag bis hierher unter 'myPlants' — die App liest aber
  // 'ps_myplants' (index.html: var myPlants = safeGetItem('ps_myplants', [])).
  // Die Pruefstaende haben deshalb seit v31.30 IMMER eine leere Pflanzenliste
  // vermessen: Leerzustand statt Karten, kein Pflegeplan, keine Aufgaben.
  // Aufgefallen erst, als ein Versuch myPlants[0] lesen wollte und undefined bekam.
  set('ps_myplants', [
    { id:'p1', name:'Basilikum', species:'Ocimum basilicum', emoji:'🌿', added:now-20*D, lastWatered:now-4*D, waterEvery:3, location:'Küchenfenster' },
    { id:'p2', name:'Monstera',  species:'Monstera deliciosa', emoji:'🪴', added:now-90*D, lastWatered:now-1*D, waterEvery:7, location:'Wohnzimmer' },
    { id:'p3', name:'Tomate',    species:'Solanum lycopersicum', emoji:'🍅', added:now-45*D, lastWatered:now-2*D, waterEvery:2, location:'Balkon' }
  ]);
  set('gs_gardens', [{ id:'g1', name:'Balkon Süd', size_m2:6, type:'balkon', created:now-60*D }]);
  set('gs_scan_history', [
    { id:'s1', name:'Löwenzahn', latin:'Taraxacum officinale', ts:now-2*D, confidence:0.94, kind:'plant' },
    { id:'s2', name:'Steinpilz', latin:'Boletus edulis',       ts:now-9*D, confidence:0.88, kind:'fungus' }
  ]);
  // v31.98: `ts` ist im Ernte-Log ein ISO-STRING — so schreibt es die App an
  // allen vier Stellen (gsErnteAdd u.a.). Hier stand eine Zahl, und
  // `openErnteTracking` starb an `e.ts.slice(0,10)`. Dieselbe Lehre wie
  // v31.46: Beispieldaten gegen index.html pruefen, nicht gegen den Namen.
  set('gs_ernte_log', [{ id:'e1', plant:'Tomate', amount:420, unit:'g', ts:new Date(now-3*D).toISOString() }]);
  set('gs_confirmed_species', ['Taraxacum officinale','Boletus edulis']);
  set('gs_wissen_read', ['alpen-1','voegel-2']);
  set('gs_last_active_day_iso', new Date(now).toISOString().slice(0,10));
} catch(e){} };

// ── v31.77: ein Musterplan fuer den KI-Planer ────────────────────────────
// Damit `contrast_check.js` auch messen kann, was in einem FENSTER steckt.
// Bis hierher galt die Grenze aus CLAUDE.md §7.1: „beide vermessen, was auf
// den elf Bildschirmen sichtbar ist. Was in einem geschlossenen Fenster
// steckt, sehen sie nicht." Genau dort lag „Plan speichern" mit 2,70:1.
//
// Die Werte sind bewusst so gewaehlt, dass moeglichst viele Abschnitte
// entstehen: Pruefungstafel, Jahr, Luecken, Ernte, Aufwand, Pflanzenliste
// mit Begruendungen, Mischkultur, Zeitplan, Pflege, Schaedlinge, Schritte.
module.exports.MUSTERPLAN = {
  summary: 'Ein Musterplan für den Prüfstand — sonnige Lage, lehmiger Boden, Mischkultur mit Fruchtfolge.',
  climateZone: 'CH-H4',
  bed: { width_m: 4, length_m: 3, shape_used: 'Rechteckig' },
  plants: [
    { name:'Tomate', latin:'Solanum lycopersicum', family:'Nachtschatten', icon:'🍅', color:'e53935',
      count:4, spacing_cm:60, depth_cm:2, x_m:0, y_m:0, w_m:1.6, h_m:1.2, yield_kg:6, yield_unit:'kg',
      sow_date:'2026-04-05', harvest_from:'2026-07-15', harvest_to:'2026-09-30', water_l_per_week:24,
      light:'sonne', difficulty:'mittel', note:'Robuste Freilandsorte, wenig Krautfäule.' },
    { name:'Kohlrabi', latin:'Brassica oleracea', family:'Kreuzblütler', icon:'🥬', color:'7cb342',
      count:6, spacing_cm:30, depth_cm:1, x_m:2.2, y_m:0, w_m:1.6, h_m:0.9, yield_kg:2, yield_unit:'kg',
      sow_date:'2026-04-01', harvest_from:'2026-06-15', harvest_to:'2026-07-10', water_l_per_week:8,
      light:'halbschatten', difficulty:'leicht', note:'Schnelle Vorkultur, macht früh Platz.' },
    { name:'Buschbohne', latin:'Phaseolus vulgaris', family:'Hülsenfrüchtler', icon:'🫘', color:'8bc34a',
      count:20, spacing_cm:30, depth_cm:3, x_m:0, y_m:1.6, w_m:2.4, h_m:1.3, yield_kg:3, yield_unit:'kg',
      sow_date:'2026-05-15', harvest_from:'2026-07-25', harvest_to:'2026-09-05', water_l_per_week:12,
      light:'sonne', difficulty:'leicht', note:'Sammelt Stickstoff für die Nachkultur.' },
  ],
  mixedCulture: { good:['Tomate & Basilikum','Bohne & Bohnenkraut'], bad:['Bohne & Zwiebel'], score:78,
                  explanation:'Gute Kombination, nur die Kreuzblütler stehen etwas eng.' },
  cropRotation: { after:['Feldsalat','Spinat'], avoid_next_year:['Kreuzblütler'], note:'Drei Jahre Pause je Familie.' },
  timeline: [ {week:14, action:'Vorkultur ansetzen', who:'Tomate', moon_phase:'günstig'},
              {week:20, action:'Auspflanzen', who:'Tomate', moon_phase:'ok'},
              {week:30, action:'Erste Ernte', who:'Buschbohne', moon_phase:'ok'} ],
  careSchedule: [ {freq:'täglich', task:'giessen', months:'06-08'},
                  {freq:'wöchentlich', task:'ausgeizen und jäten', months:'05-09'},
                  {freq:'monatlich', task:'nachdüngen', months:'04-09'} ],
  tips: ['Mulchen hält den Boden feucht.','Morgens giessen, nicht abends.','Bohnen erst nach den Eisheiligen.'],
  pitfalls: ['Zu eng gepflanzt','Über die Blätter gegossen','Fruchtfolge vergessen'],
  harvest: { first_date:'2026-06-15', peak_window:'Juli–August', est_kg_total:11, est_value_chf:54 },
  waterPlan: { total_l_per_week:44, best_time:'morgens 6–8 Uhr', rain_deduction:true, kc_note:'Im Juli ein Drittel mehr.' },
  fertilizer: [ {month:'04', type:'Kompost', amount_per_m2:'2 kg', n_p_k:'3-1-2'} ],
  biodiversity: { score:62, hint:'Eine Reihe Ringelblumen an den Rand.', pollinators:['Ringelblume','Borretsch'] },
  pestControl: [ {pest:'Schnecken', affects:['Kohlrabi'], prevention:'Absammeln am Abend',
                  treatment:'Schafwolle als Barriere', companion_repellent:'Bohnenkraut'} ],
  stepByStep: [ {step:1, title:'Beet umgraben', duration_min:45, tools:['Grabgabel'], details:'Handbreit tief lockern.'},
                {step:2, title:'Kompost einarbeiten', duration_min:20, tools:['Rechen'], details:'Zwei Kilo je Quadratmeter.'},
                {step:3, title:'Pflanzen setzen', duration_min:30, tools:['Pflanzholz'], details:'Nach dem Plan von links.'} ],
};

// Die gepruefte Agronomie-Referenz kommt sonst aus Supabase — im Pruefstand
// gibt es kein Netz. Diese sechs Zeilen reichen, damit alle Regeln greifen.
module.exports.AGRONOMIE = [
  { crop:'Tomate',     family:'Nachtschatten',     sow_months:[3,4],       harvest_months:[7,8,9],     spacing_cm:60,  frost_hardy:'frostempfindlich' },
  { crop:'Kohlrabi',   family:'Kreuzblütler',      sow_months:[3,4,7],     harvest_months:[6,7,9],     spacing_cm:30,  frost_hardy:'bedingt winterhart' },
  { crop:'Buschbohne', family:'Hülsenfrüchtler',   sow_months:[5,6],       harvest_months:[7,8,9],     spacing_cm:30,  frost_hardy:'frostempfindlich' },
  { crop:'Feldsalat',  family:'Baldriangewächse',  sow_months:[8,9],       harvest_months:[10,11],     spacing_cm:10,  frost_hardy:'winterhart' },
  { crop:'Spinat',     family:'Fuchsschwanz',      sow_months:[3,8,9],     harvest_months:[5,10,11],   spacing_cm:10,  frost_hardy:'winterhart' },
  { crop:'Radieschen', family:'Kreuzblütler',      sow_months:[3,4,5,8,9], harvest_months:[4,5,6,9,10], spacing_cm:5,  frost_hardy:'bedingt winterhart' },
];
