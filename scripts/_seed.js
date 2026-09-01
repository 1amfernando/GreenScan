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
  set('gs_ernte_log', [{ id:'e1', plant:'Tomate', amount:420, unit:'g', ts:now-3*D }]);
  set('gs_confirmed_species', ['Taraxacum officinale','Boletus edulis']);
  set('gs_wissen_read', ['alpen-1','voegel-2']);
  set('gs_last_active_day_iso', new Date(now).toISOString().slice(0,10));
} catch(e){} };
