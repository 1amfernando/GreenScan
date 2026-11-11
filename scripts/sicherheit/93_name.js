// Gruppe n3 — der oeffentliche Name (v33.59). Der Server (20261110_sicherheit_community_markt.sql,
// 1a/1c) saeubert profiles.display_name und ersetzt einen Betreiber-Namen; die App merkte
// bis dahin den GESCHICKTEN Namen und sagte „✅ Name aktualisiert!". Der Fall faehrt das
// echte profEditName mit gestelltem sbFetch, das antwortet wie PostgREST nach der Migration.
'use strict';

async function nameAendern(seite, eingabe, antwort) {
  return seite.evaluate(async ([eingabe, antwort]) => {
    const alt = { f: window.sbFetch, p: window.gsPromptModal, t: window.showProfileToast };
    const toasts = [];
    let geschickt = null;
    window.sbFetch = async function (pfad, o) {
      if (pfad.indexOf('/rest/v1/profiles') === 0 && o && o.method === 'POST') {
        geschickt = JSON.parse(o.body).display_name;
        return { data: [{ id: 'u', display_name: antwort }], error: null };
      }
      return { data: [], error: null };
    };
    window.gsPromptModal = async function () { return eingabe; };
    window.showProfileToast = function (m) { toasts.push(typeof m === 'string' ? m : JSON.stringify(m)); };
    try { localStorage.setItem('gs_sb_uid', '11111111-1111-4111-8111-111111111111'); } catch (e) {}
    try { await window.profEditName(); }
    catch (e) { toasts.push('AUSNAHME ' + e.message); }
    finally { window.sbFetch = alt.f; window.gsPromptModal = alt.p; window.showProfileToast = alt.t; }
    return { geschickt, gemerkt: localStorage.getItem('gs_sb_display_name'), toasts, profil: (typeof _sbProfile !== 'undefined' && _sbProfile) ? _sbProfile.display_name : null };
  }, [eingabe, antwort]);
}

module.exports = [
  {
    name: 'Profilname · die App merkt und meldet den Namen, den der Server GESPEICHERT hat (Betreiber-Name ersetzt) — ein frei gewaehlter bleibt',
    lauf: async (seite, h) => {
      const boese = await nameAendern(seite, 'GreenScan Team', 'Bert');
      const gut = await nameAendern(seite, "Zoë d'Alpi 🌻", "Zoë d'Alpi 🌻");
      const fehler = [];
      if (boese.geschickt !== 'GreenScan Team') fehler.push('geschickt: ' + boese.geschickt);
      if (boese.gemerkt !== 'Bert') fehler.push('gemerkt: ' + boese.gemerkt);
      if (boese.profil !== 'Bert') fehler.push('_sbProfile: ' + boese.profil);
      if (!boese.toasts.some(t => /Bert/.test(t) && /reserviert/.test(t)) || boese.toasts.some(t => /aktualisiert/.test(t)))
        fehler.push('Meldung (Team): ' + JSON.stringify(boese.toasts));
      if (gut.gemerkt !== "Zoë d'Alpi 🌻" || !gut.toasts.some(t => /Name aktualisiert/.test(t)) || gut.toasts.some(t => /reserviert/.test(t)))
        fehler.push('gewaehlter Name: ' + JSON.stringify(gut));
      if (fehler.length) return { ok: false, warum: fehler.join(' · ') };
      return { ok: true, info: 'Server ersetzt „GreenScan Team" durch „Bert" → gemerkt „Bert", Meldung nennt ihn · „Zoë d\'Alpi 🌻" bleibt, „✅ Name aktualisiert!"' };
    },
  },
];
