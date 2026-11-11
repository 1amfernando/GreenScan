// Startangebot (v33.59): launch_offer_available liefert ein OBJEKT — die App las nur ein boolean
// und zeigte darum nie „Ausverkauft". Gemessen am Abo-Bildschirm mit gestelltem Server.
'use strict';
module.exports = [
  {
    name: 'Startangebot · {available:false} vom Server ergibt „Ausverkauft" und einen gesperrten Knopf — {available:true} nicht, Fehler und alte boolean-Antwort wie zuvor',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async () => {
        const alt = window.sbFetch;
        const frage = async (antwort) => {
          window.sbFetch = async (p) => (String(p).indexOf('launch_offer_available') >= 0 ? antwort : { data: null, error: null });
          try { return await gsCheckLaunchAvailable(); } finally { window.sbFetch = alt; }
        };
        const werte = {
          voll: await frage({ data: { available: false, logged_in: true, claimed: 100 }, error: null }),
          frei: await frage({ data: { available: true, logged_in: true, claimed: 3 }, error: null }),
          bool: await frage({ data: false, error: null }),
          fehler: await frage({ data: null, error: { message: 'x', status: 500 } }),
          kaputt: await frage({ data: { available: 'ja' }, error: null }),
        };
        // Bildschirm: mit „voll" den Abo-Bildschirm rendern und lesen
        window.sbFetch = async (p) => (String(p).indexOf('launch_offer_available') >= 0
          ? { data: { available: false, logged_in: true, claimed: 100 }, error: null } : { data: null, error: null });
        let note = null, gesperrt = null;
        try {
          gsShowAboScreen();
          for (let i = 0; i < 40; i++) {
            await new Promise(res => setTimeout(res, 50));
            const n = document.getElementById('abo-launch-note');
            if (n && /Ausverkauft/.test(n.textContent)) break;
          }
          const n = document.getElementById('abo-launch-note');
          const card = document.getElementById('abo-lifetime-card');
          const btn = card && card.querySelector('button[onclick*="pro_lifetime"]');
          note = n ? n.textContent : null; gesperrt = btn ? !!btn.disabled : null;
        } finally { window.sbFetch = alt; }
        try { if (typeof closeAllModals === 'function') closeAllModals(); } catch (e) {}
        return { werte, note, gesperrt };
      });
      const w = r.werte;
      if (w.voll !== false) return { ok: false, warum: '{available:false} ergibt ' + JSON.stringify(w.voll) + ' (erwartet false)' };
      if (w.frei !== true) return { ok: false, warum: '{available:true} ergibt ' + JSON.stringify(w.frei) };
      if (w.bool !== false) return { ok: false, warum: 'alte boolean-Antwort false ergibt ' + JSON.stringify(w.bool) };
      if (w.fehler !== true || w.kaputt !== true) return { ok: false, warum: 'Fehler/unlesbar sollte beim alten Rueckfall bleiben: ' + JSON.stringify(w) };
      if (!r.note || !/Ausverkauft/.test(r.note)) return { ok: false, warum: 'Bildschirm sagt nicht „Ausverkauft": ' + JSON.stringify(r.note) };
      if (r.gesperrt !== true) return { ok: false, warum: 'Lifetime-Knopf nicht gesperrt: ' + JSON.stringify(r.gesperrt) };
      return { ok: true, info: 'voll → false + „' + r.note.trim() + '" + Knopf gesperrt · frei → true · boolean false → false · Fehler/unlesbar → true (wie zuvor)' };
    },
  },
];
