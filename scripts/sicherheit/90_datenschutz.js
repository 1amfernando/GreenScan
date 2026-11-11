// Gruppe w1 — Datenschutz (v33.59). Was verlaesst das Geraet, und was steht
// danach fuer ALLE lesbar da? Die Foto-Buckets sind ueber die Adresse
// oeffentlich, Community-Beitraege und freigegebene Funde sind ohne Konto
// lesbar. Jeder Fall faehrt die ECHTE Funktion und misst, was sie hinausschickt
// (gestelltes _gsFetch / sbFetch) — und den guten Fall daneben.
'use strict';
const fs = require('fs');
const path = require('path');
const { baueJpegMitExif } = require('../_exifjpeg.js');

// Das APP1-Segment eines echten EXIF-Blocks mit GPS (ohne SOI/EOI).
const APP1 = Array.from(baueJpegMitExif({ datum: '2026:07:14 09:33:12', lat: 46.8182, lng: 8.2275 })).slice(2, -2);
// Ein JPEG, das NUR aus Metadaten besteht — kein Dekoder kann es lesen.
const NUR_META = Array.from(baueJpegMitExif({ datum: '2026:07:14 09:33:12', lat: 46.8182, lng: 8.2275 }));

// Werkzeug in der Seite: ein echtes Kamerabild (Canvas → JPEG) mit
// eingesetztem GPS-EXIF, Fang aller Speicher-Uploads, Byte-Pruefungen.
async function werkzeug(seite) {
  await seite.evaluate(([app1, nurMeta]) => {
    const W = window.__ds = {};
    W.u8 = (b64) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
    W.b64 = (u) => { let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
    W.exif = (u) => { for (let i = 0; i + 5 < u.length; i++) if (u[i] === 0x45 && u[i + 1] === 0x78 && u[i + 2] === 0x69 && u[i + 3] === 0x66 && u[i + 4] === 0 && u[i + 5] === 0) return true; return false; };
    W.bild = async (u) => { try { const b = await createImageBitmap(new Blob([u])); return b.width + 'x' + b.height; } catch (e) { return null; } };
    const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30;
    const cx = cv.getContext('2d'); cx.fillStyle = '#3a7'; cx.fillRect(0, 0, 40, 30); cx.fillStyle = '#c33'; cx.fillRect(5, 5, 10, 10);
    const sauber = W.u8(cv.toDataURL('image/jpeg', 0.9).split(',')[1]);
    W.sauberB64 = W.b64(sauber);
    const mit = new Uint8Array(sauber.length + app1.length);
    mit.set(sauber.subarray(0, 2), 0); mit.set(app1, 2); mit.set(sauber.subarray(2), 2 + app1.length);
    W.exifB64 = W.b64(mit);
    W.nurMetaB64 = W.b64(new Uint8Array(nurMeta));
    W.datei = (b64, name) => new File([W.u8(b64)], name || 'IMG_0001.jpg', { type: 'image/jpeg' });
    W.hoch = [];
    W.echtFetch = W.echtFetch || window._gsFetch;
    window._gsFetch = async (url, init) => {
      if (/\/storage\/v1\/object\//.test(String(url))) {
        let b = init && init.body;
        if (b && typeof b.arrayBuffer === 'function') b = new Uint8Array(await b.arrayBuffer());
        W.hoch.push({ url: String(url), body: b instanceof Uint8Array ? b : null });
      }
      return { ok: true, status: 200, text: async () => '', json: async () => ({}) };
    };
    window._gsFreshToken = async () => 'pruef.stand.token';
    W.pruefe = async () => Promise.all(W.hoch.map(async (h) => ({ url: h.url.replace(/^.*\/object\//, ''), exif: h.body ? W.exif(h.body) : null, bild: h.body ? await W.bild(h.body) : null, n: h.body ? h.body.length : 0, b64: h.body ? W.b64(h.body) : '' })));
  }, [APP1, NUR_META]);
}

module.exports = [
  {
    name: 'EXIF · gsUploadImage (Community-Foto, Scan, Warteschlange): ein Kamerafoto mit GPS geht OHNE Exif hinaus, bleibt ein lesbares JPEG; ein sauberes geht unveraendert; ein unlesbares wird NICHT roh hochgeladen',
    lauf: async (seite) => {
      await werkzeug(seite);
      const r = await seite.evaluate(async () => {
        const W = window.__ds;
        const vorher = { exif: W.exif(W.u8(W.exifB64)), bild: await W.bild(W.u8(W.exifB64)) };
        const u1 = await gsUploadImage(W.exifB64, 'post-images', 'jpg');
        const u2 = await gsUploadImage(W.sauberB64, 'post-images', 'jpg');
        const nHoch = W.hoch.length;
        const u3 = await gsUploadImage(W.nurMetaB64, 'post-images', 'jpg');
        const p = await W.pruefe();
        return { vorher, u: [!!u1, !!u2, u3], nHoch, nNach: W.hoch.length, p: p.map(x => ({ exif: x.exif, bild: x.bild })), gleich: p[1] && p[1].b64 === W.sauberB64 };
      });
      if (!r.vorher.exif || r.vorher.bild !== '40x30') return { ok: false, warum: 'Testbild falsch hergestellt: ' + JSON.stringify(r.vorher) };
      if (!r.u[0] || !r.u[1]) return { ok: false, warum: 'Upload schlug fehl: ' + JSON.stringify(r.u) };
      if (r.p[0].exif) return { ok: false, warum: 'hochgeladene Bytes tragen das Exif-Segment (GPS) noch' };
      if (r.p[0].bild !== '40x30') return { ok: false, warum: 'neu kodiertes Bild unlesbar: ' + r.p[0].bild };
      if (!r.gleich) return { ok: false, warum: 'ein sauberes Canvas-JPEG wurde veraendert' };
      if (r.u[2] !== null || r.nNach !== r.nHoch) return { ok: false, warum: 'unlesbares Bild mit Metadaten trotzdem hochgeladen (' + JSON.stringify(r.u[2]) + ')' };
      return { ok: true, info: 'GPS-JPEG → ohne Exif, 40x30 lesbar · sauberes Canvas-JPEG byte-gleich · unlesbares: null, 0 Uploads' };
    },
  },
  {
    name: 'EXIF · PNG und WebP: ein sauberes Canvas-Bild bleibt byte-gleich; ein PNG mit eXIf-/tEXt-Block wird neu kodiert und verliert ihn',
    lauf: async (seite) => {
      await werkzeug(seite);
      const r = await seite.evaluate(async () => {
        const W = window.__ds;
        const cv = document.createElement('canvas'); cv.width = 20; cv.height = 10; cv.getContext('2d').fillRect(0, 0, 5, 5);
        const png = cv.toDataURL('image/png').split(',')[1], webp = cv.toDataURL('image/webp', 0.9).split(',')[1];
        // eXIf-Block hinter IHDR einsetzen (8 Signatur + 25 IHDR)
        const u = W.u8(png);
        const nutz = new TextEncoder().encode('GPS 46.8182 8.2275');
        const blk = new Uint8Array(12 + nutz.length);
        blk.set([0, 0, 0, nutz.length], 0); blk.set([0x65, 0x58, 0x49, 0x66], 4); blk.set(nutz, 8);   // CRC egal: Dekoder warnen nur
        const mit = new Uint8Array(u.length + blk.length); mit.set(u.subarray(0, 33), 0); mit.set(blk, 33); mit.set(u.subarray(33), 33 + blk.length);
        const a = await _gsBildOhneMeta(png), b = await _gsBildOhneMeta(webp), c = await _gsBildOhneMeta(W.b64(mit));
        const cu = c ? W.u8(c.b64) : null;
        const txt = cu ? String.fromCharCode.apply(null, cu) : '';
        return { a: a && a.b64 === png && !a.neu, b: b && b.b64 === webp && !b.neu, c: c && c.neu && txt.indexOf('46.8182') < 0 && (await W.bild(cu)) === '20x10' };
      });
      if (!r.a || !r.b) return { ok: false, warum: 'sauberes Canvas-Bild veraendert: ' + JSON.stringify(r) };
      if (!r.c) return { ok: false, warum: 'PNG mit eXIf nicht bereinigt: ' + JSON.stringify(r) };
      return { ok: true, info: 'Canvas-PNG und -WebP byte-gleich · PNG mit eXIf → neu kodiert, ohne Block, 20x10' };
    },
  },
  {
    name: 'EXIF · gsUploadPhotoToBucket (Fundort, Pflanze, Tagebuch): ohne Exif hinaus; unlesbar → Fehler statt roher Bytes',
    lauf: async (seite) => {
      await werkzeug(seite);
      const r = await seite.evaluate(async () => {
        const W = window.__ds;
        const url = await gsUploadPhotoToBucket('map-find-photos', W.exifB64);
        let fehler = null;
        try { await gsUploadPhotoToBucket('map-find-photos', W.nurMetaB64); } catch (e) { fehler = e.message; }
        return { url: !!url, p: await W.pruefe(), fehler };
      });
      if (!r.url || r.p.length !== 1) return { ok: false, warum: 'Upload: ' + JSON.stringify({ url: r.url, n: r.p.length }) };
      if (r.p[0].exif) return { ok: false, warum: 'map-find-photos bekommt das Exif-Segment (GPS)' };
      if (r.p[0].bild !== '40x30') return { ok: false, warum: 'Bild unlesbar: ' + r.p[0].bild };
      if (!r.fehler) return { ok: false, warum: 'unlesbares Bild ohne Fehler (roh hochgeladen?)' };
      return { ok: true, info: 'ohne Exif, 40x30 · unlesbar: „' + r.fehler + '", 0 rohe Bytes' };
    },
  },
  {
    name: 'EXIF · die Warteschlange (gsQueuePhoto → gsFlushPhotoQueue) laedt ohne Exif hoch',
    lauf: async (seite) => {
      await werkzeug(seite);
      const r = await seite.evaluate(async () => {
        const W = window.__ds;
        const ref = await gsQueuePhoto('map-find-photos', W.exifB64, { kind: 'marker', ref: 'ds-' + Date.now() });
        if (!ref) return { warum: 'gsQueuePhoto lieferte nichts' };
        window._gsPhotoFlushing = false;
        await gsFlushPhotoQueue();
        return { p: await W.pruefe() };
      });
      if (r.warum) return { ok: false, warum: r.warum };
      const meins = r.p.filter(x => /map-find-photos/.test(x.url));
      if (!meins.length) return { ok: false, warum: 'kein Upload aus der Warteschlange: ' + JSON.stringify(r.p.map(x => x.url)) };
      if (meins.some(x => x.exif)) return { ok: false, warum: 'die Warteschlange laedt das Exif-Segment hoch' };
      return { ok: true, info: meins.length + ' Upload(s), ohne Exif' };
    },
  },
  {
    name: 'EXIF · die Foto-Waehler (Community-Fenster, Feed-Zeile, Fundort) halten fuer den Upload kein rohes Kamerafoto',
    lauf: async (seite) => {
      await werkzeug(seite);
      const r = await seite.evaluate(async () => {
        const W = window.__ds;
        const leer = (b) => b.indexOf('base64,') >= 0 ? b.slice(b.indexOf('base64,') + 7) : b;
        const out = {};
        igPhotoData = null; loadIgPhoto({ files: [W.datei(W.exifB64)] });
        inlinePhotoData = null; loadInlinePhoto({ files: [W.datei(W.exifB64)] });
        window._gsPendingPinPhotoB64 = null; _gsPinPhotoPick({ files: [W.datei(W.exifB64)], value: '' });
        for (let i = 0; i < 40 && (!igPhotoData || !inlinePhotoData || !window._gsPendingPinPhotoB64); i++) await new Promise(r => setTimeout(r, 50));
        for (const [k, v] of [['ig', igPhotoData], ['inline', inlinePhotoData], ['pin', window._gsPendingPinPhotoB64]]) {
          if (!v) { out[k] = 'leer'; continue; }
          const u = W.u8(leer(v));
          out[k] = { exif: W.exif(u), bild: await W.bild(u) };
        }
        return out;
      });
      const schlecht = Object.keys(r).filter(k => r[k] === 'leer' || r[k].exif || !r[k].bild);
      if (schlecht.length) return { ok: false, warum: 'roh oder leer: ' + JSON.stringify(r) };
      return { ok: true, info: 'ig · inline · pin: neu kodiert, ohne Exif, lesbar' };
    },
  },
  {
    name: 'EXIF · callVisionAI (KI-Bestimmung): das Bild geht ohne Exif an den KI-Dienst; ein lesbares GIF wird neu kodiert, nur ein unlesbares Format bleibt unberuehrt',
    lauf: async (seite) => {
      await werkzeug(seite);
      const r = await seite.evaluate(async () => {
        const W = window.__ds;
        const echt = { cfg: window.getApiConfig, an: window._gsAiAnfrage };
        const bodies = [];
        window.getApiConfig = () => ({ provider: 'anthropic', key: 'sk-ant-test', source: 'user' });
        window._gsAiAnfrage = async (_t, body) => { bodies.push(JSON.parse(body)); return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'ok' }] }) }; };
        try {
          await callVisionAI(W.exifB64, 'image/jpeg', 'Was ist das?', [{ b64: W.exifB64, mt: 'image/jpeg' }], { maxTokens: 20 });
          await callVisionAI('AAAA', 'image/jpeg', 'x', null, { maxTokens: 20 });
          // Gegenpruefung: ein lesbares GIF (kein JPEG/PNG/WebP) mit Kommentar-Block traegt Text mit
          const gif = [0x47,0x49,0x46,0x38,0x39,0x61,1,0,1,0,0x80,0,0,0,0,0,0xFF,0xFF,0xFF];
          const kom = Array.from(new TextEncoder().encode('GPS 46.8182 8.2275'));
          const gifU = new Uint8Array(gif.concat([0x21,0xFE,kom.length], kom, [0, 0x2C,0,0,0,0,1,0,1,0,0, 2,2,0x44,1,0, 0x3B]));
          await callVisionAI(W.b64(gifU), 'image/gif', 'x', null, { maxTokens: 20 });
        } catch (e) { return { warum: 'callVisionAI wirft: ' + e.message }; }
        finally { window.getApiConfig = echt.cfg; window._gsAiAnfrage = echt.an; }
        const bilder = bodies[0].messages[0].content.filter(c => c.type === 'image').map(c => W.u8(c.source.data));
        const g = bodies[2].messages[0].content[0].source;
        const gU = W.u8(g.data);
        return { n: bilder.length, exif: bilder.map(W.exif), bild: await Promise.all(bilder.map(W.bild)), aaaa: bodies[1].messages[0].content[0].source.data,
          gif: { text: String.fromCharCode.apply(null, gU).indexOf('46.8182') >= 0, bild: await W.bild(gU), mt: g.media_type } };
      });
      if (r.warum) return { ok: false, warum: r.warum };
      if (r.gif.text || r.gif.bild !== '1x1' || r.gif.mt !== 'image/jpeg') return { ok: false, warum: 'lesbares GIF mit Kommentar-Block geht unveraendert an den KI-Dienst: ' + JSON.stringify(r.gif) };
      if (r.n !== 2) return { ok: false, warum: r.n + ' Bilder statt 2' };
      if (r.exif.some(x => x)) return { ok: false, warum: 'Exif geht an den KI-Dienst: ' + JSON.stringify(r.exif) };
      if (r.bild.some(x => x !== '40x30')) return { ok: false, warum: 'Bild unlesbar: ' + JSON.stringify(r.bild) };
      if (r.aaaa !== 'AAAA') return { ok: false, warum: 'unbekanntes Format veraendert: ' + r.aaaa };
      return { ok: true, info: 'Haupt- und Zusatzbild ohne Exif, lesbar · GIF mit Kommentar → JPEG ohne Text · unlesbares Format unveraendert' };
    },
  },
  {
    name: 'Funde · „Fuer Community freigeben" schickt den Ort gerundet (~1 km), die genaue Stelle bleibt lokal; 0 Zeilen sind kein Erfolg; zurueck auf privat bringt die genaue Stelle',
    lauf: async (seite) => {
      const r = await seite.evaluate(async () => {
        const echt = window.sbFetch;
        const rufe = [];
        let antwort = 'ok';
        window.sbFetch = async (p, o) => { rufe.push({ p, o, body: o && o.body ? JSON.parse(o.body) : null }); return antwort === 'ok' ? { data: [{ id: 'c-1' }], error: null } : { data: [], error: null }; };
        localStorage.setItem('greenscan_markers', JSON.stringify([{ id: 'm1', cloud_id: 'c-1', lat: 46.818234, lng: 8.227561, name: 'Frauenschuh', cat: 'pflanze', date: Date.now() }]));
        try {
          const a = await gsMapFinds.togglePrivacy('c-1', true);
          antwort = 'leer';
          const b = await gsMapFinds.togglePrivacy('c-1', true);
          antwort = 'ok';
          const c = await gsMapFinds.togglePrivacy('c-1', false);
          const lokal = JSON.parse(localStorage.getItem('greenscan_markers'))[0];
          // v33.59: die Freigabe liest die Zeile zuerst (Ort und Foto) — gezaehlt werden die PATCHes.
          return { a, b, c, rufe: rufe.filter(x => x.o && x.o.method === 'PATCH').map(x => ({ prefer: (x.o.headers || {}).Prefer, body: x.body })), lokal };
        } finally { window.sbFetch = echt; }
      });
      const auf = r.rufe[0] && r.rufe[0].body;
      if (!r.a) return { ok: false, warum: 'Freigabe meldet keinen Erfolg' };
      if (!auf || auf.is_private !== false) return { ok: false, warum: 'PATCH ohne is_private:false: ' + JSON.stringify(auf) };
      if (auf.lat !== 46.82 || auf.lng !== 8.23) return { ok: false, warum: 'Ort nicht gerundet: ' + JSON.stringify({ lat: auf.lat, lng: auf.lng }) };
      if (r.rufe[0].prefer !== 'return=representation') return { ok: false, warum: 'PATCH mit ' + r.rufe[0].prefer + ' — eine Ablehnung bleibt unsichtbar' };
      if (r.b !== false) return { ok: false, warum: '0 Zeilen als Erfolg gemeldet' };
      const zu = r.rufe[2] && r.rufe[2].body;
      if (!zu || zu.is_private !== true || zu.lat !== 46.818234 || zu.lng !== 8.227561) return { ok: false, warum: 'zurueck auf privat ohne genaue Stelle: ' + JSON.stringify(zu) };
      if (r.lokal.lat !== 46.818234 || r.lokal.lng !== 8.227561) return { ok: false, warum: 'lokale Stelle veraendert: ' + JSON.stringify(r.lokal) };
      return { ok: true, info: 'frei: 46.82 / 8.23 · lokal 46.818234 / 8.227561 · 0 Zeilen → false · privat: genaue Stelle zurueck' };
    },
  },
  {
    name: 'Funde · der Schalter SAGT vor der Freigabe, was oeffentlich wird (Rundung und Foto-Adresse); „Nein" schickt nichts',
    lauf: async (seite) => {
      const r = await seite.evaluate(async () => {
        const echt = { c: window.gsConfirmModal, s: window.sbFetch };
        const fragen = []; const rufe = [];
        let ja = false;
        window.gsConfirmModal = async (t, o) => { fragen.push(String(t) + ' ' + JSON.stringify(o || {})); return ja; };
        window.sbFetch = async (p, o) => { if (o && o.method === 'PATCH') rufe.push(p); return { data: [{ id: 'c-2', lat: 46.512345, lng: 7.512345 }], error: null }; };
        window._gsMyFindsRows = [{ id: 'c-2', is_private: true, lat: 46.5, lng: 7.5 }];
        try {
          await _gsMyFindTogglePub(0, null);
          const nachNein = rufe.length;
          ja = true;
          await _gsMyFindTogglePub(0, null);
          const nachJa = rufe.length;
          // zurueck auf privat fragt nicht
          const fragenVor = fragen.length;
          await _gsMyFindTogglePub(0, null);
          return { fragen, nachNein, nachJa, privatFragt: fragen.length !== fragenVor, oeff: window._gsMyFindsRows[0].is_private };
        } finally { window.gsConfirmModal = echt.c; window.sbFetch = echt.s; }
      });
      if (!r.fragen.length) return { ok: false, warum: 'keine Rueckfrage vor der Freigabe' };
      const t = r.fragen[0];
      if (!/1\s*km/.test(t) || !/Foto/.test(t) || !/alle/.test(t)) return { ok: false, warum: 'Rueckfrage sagt nicht, was oeffentlich wird: ' + t.slice(0, 160) };
      if (r.nachNein !== 0) return { ok: false, warum: '„Nein" hat trotzdem geschrieben' };
      if (r.nachJa !== 1) return { ok: false, warum: '„Ja" schrieb ' + r.nachJa + '×' };
      if (r.privatFragt) return { ok: false, warum: 'zurueck auf privat fragt unnoetig' };
      return { ok: true, info: 'Rueckfrage nennt ~1 km und die Foto-Adresse · Nein: 0 Anfragen · Ja: 1 · privat: ohne Rueckfrage' };
    },
  },
  {
    name: 'Autorname · Beitrag (Fenster, Feed-Zeile, Instagram-Fenster), Kommentar und Rangliste schicken nie die E-Mail oder ihren lokalen Teil — ein gewaehlter Name bleibt',
    lauf: async (seite) => {
      const r = await seite.evaluate(async () => {
        const echt = { s: window.sbFetch, u: window.gsUploadImage };
        const namen = [];
        window.sbFetch = async (p, o) => {
          const b = o && o.body ? JSON.parse(o.body) : {};
          if (/social_posts|post_comments/.test(p) && o && o.method === 'POST') namen.push(b.author_name);
          if (/fn_quiz_leaderboard_upsert/.test(p)) namen.push(b.p_display_name === null ? '(null)' : b.p_display_name);
          return { data: [Object.assign({ id: 'srv-1' }, b)], error: null };
        };
        window.gsUploadImage = async () => null;
        const fall = async (dn, social) => {
          localStorage.setItem('gs_sb_email', 'vreni.muster@example.ch');
          if (dn === null) localStorage.removeItem('gs_sb_display_name'); else localStorage.setItem('gs_sb_display_name', dn);
          if (social === null) localStorage.removeItem('gs_social_name'); else localStorage.setItem('gs_social_name', social);
          try { socialUserName = social || ''; } catch (_) {}
          try { _sbProfile = { display_name: dn, avatar_emoji: '🌿' }; } catch (_) {}
          namen.length = 0;
          // 1 Fenster
          document.getElementById('post-text').value = 'Hallo';
          await submitPost();
          // 2 Feed-Zeile
          inlinePhotoData = null; document.getElementById('inline-post-text').value = 'Hallo';
          await submitInlinePost();
          // 3 Instagram-Fenster
          const ia = document.getElementById('ig-author'); if (ia) ia.value = '';
          igPhotoData = null; document.getElementById('ig-text').value = 'Hallo';
          await submitIgPost();
          // 4 Kommentar
          currentCommentPostId = 'srv-1'; document.getElementById('new-comment-input').value = 'Hi';
          await addComment();
          // 5 Rangliste (entprellt)
          dqPushLeaderboardDebounced({ correct: 1, total: 1, streak: 1, bestStreak: 1 });
          for (let i = 0; i < 40 && namen.length < 5; i++) await new Promise(r => setTimeout(r, 100));
          return namen.slice();
        };
        try {
          return {
            email: await fall(null, null),
            lokal: await fall('vreni.muster', 'vreni.muster'),
            voll: await fall('vreni.muster@example.ch', null),
            gut: await fall("Vreni's Garten 🌿", null),
          };
        } finally { window.sbFetch = echt.s; window.gsUploadImage = echt.u; }
      });
      // '(null)' an der Rangliste ist auch ein Leck: der Server nimmt dann profiles.display_name,
      // und das ist bei Altkonten der lokale Teil der E-Mail (fn_handle_new_user).
      const leck = (l) => l.filter(n => /@|vreni\.muster|^\(null\)$/i.test(String(n)));
      for (const k of ['email', 'lokal', 'voll']) {
        if (r[k].length < 5) return { ok: false, warum: k + ': nur ' + r[k].length + ' Namen gesehen ' + JSON.stringify(r[k]) };
        if (leck(r[k]).length) return { ok: false, warum: k + ': oeffentlicher Name aus der E-Mail ' + JSON.stringify(r[k]) };
      }
      if (r.gut.slice(0, 4).some(n => n !== "Vreni's Garten 🌿")) return { ok: false, warum: 'gewaehlter Name verloren: ' + JSON.stringify(r.gut) };
      return { ok: true, info: '3 Lagen × 5 Wege: 0× E-Mail/lokaler Teil · gewaehlter Name unveraendert ' + JSON.stringify(r.email) };
    },
  },
  {
    name: 'Autorname · Registrierung ohne Namen schickt nicht den lokalen Teil der E-Mail als Anzeigenamen; die Anmeldung legt ihn nicht als Namen ab',
    lauf: async (seite) => {
      const r = await seite.evaluate(async () => {
        const echt = window._gsFetch; const bodies = [];
        window._gsFetch = async (url, init) => { if (/\/auth\/v1\/signup/.test(String(url))) bodies.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => ({ user: { id: 'u' } }), text: async () => '' }; };
        try { await sbRegister('vreni.muster@example.ch', 'geheim12345', ''); } catch (_) {}
        try { await sbRegister('anna@example.ch', 'geheim12345', 'Anna B.'); } catch (_) {}
        window._gsFetch = echt;
        // Anmeldung ohne Metadaten
        const vorher = localStorage.getItem('gs_sb_display_name');
        localStorage.removeItem('gs_sb_display_name');
        try { sbSaveSession({ access_token: 'a.b.c', expires_in: 3600, user: { id: '00000000-0000-4000-8000-000000000001', email: 'vreni.muster@example.ch', user_metadata: {} } }); } catch (_) {}
        const nachLogin = localStorage.getItem('gs_sb_display_name');
        if (vorher !== null) localStorage.setItem('gs_sb_display_name', vorher);
        return { ohne: bodies[0] && bodies[0].data, mit: bodies[1] && bodies[1].data, nachLogin };
      });
      if (!r.ohne || !r.mit) return { ok: false, warum: 'Registrierung nicht gesehen: ' + JSON.stringify(r) };
      if (/vreni|@/i.test(String(r.ohne.display_name))) return { ok: false, warum: 'Registrierung ohne Namen schickt ' + JSON.stringify(r.ohne.display_name) };
      if (r.mit.display_name !== 'Anna B.') return { ok: false, warum: 'gewaehlter Name verloren: ' + JSON.stringify(r.mit) };
      if (/vreni|@/i.test(String(r.nachLogin))) return { ok: false, warum: 'Anmeldung legt ' + JSON.stringify(r.nachLogin) + ' als Namen ab' };
      return { ok: true, info: 'ohne Namen: ' + JSON.stringify(r.ohne.display_name) + ' · „Anna B." bleibt · Anmeldung ohne Metadaten: ' + JSON.stringify(r.nachLogin) };
    },
  },
  {
    name: 'Texte · privacy.html und die Datenschutzerklaerung in der App sagen, was der Code tut: Fotos ueber ihre Adresse abrufbar, Nutzungsdaten pseudonym, Standort an den KI-Dienst',
    lauf: async (seite) => {
      const roh = fs.readFileSync(path.resolve(__dirname, '..', '..', 'privacy.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
      const ds = await seite.evaluate(() => { openLegalModal('datenschutz'); showLegalTab('datenschutz'); const t = document.getElementById('legal-content').textContent; try { closeModal('modal-rechtlich'); } catch (_) {} return t.replace(/\s+/g, ' '); });
      const f = [];
      for (const [n, t] of [['privacy.html', roh], ['App', ds]]) {
        if (/privaten Bereich/.test(t)) f.push(n + ': „privaten Bereich"');
        if (/Tagebuch, Messwerte: in deinem Konto, nur für dich lesbar/.test(t)) f.push(n + ': „nur für dich lesbar" ohne Einschraenkung auf die Eintraege');
        if (/[Aa]nonyme Nutzungs/.test(t)) f.push(n + ': „anonyme Nutzungsdaten"');
        if (!/pseudonym/i.test(t)) f.push(n + ': „pseudonym" fehlt');
        if (!/Adresse[^.]*(abrufbar|sehen|öffnen)/.test(t)) f.push(n + ': Foto-Adresse oeffentlich nicht gesagt');
        if (!/Anthropic[^.]*Standort|Standort[^.]*Anthropic/.test(t)) f.push(n + ': Standort an Anthropic nicht genannt');
        for (const d of ['Supabase', 'Anthropic', 'Open-Meteo', 'Nominatim', 'swisstopo', 'Wikipedia', 'Stripe']) if (t.indexOf(d) < 0) f.push(n + ': Empfaenger ' + d + ' fehlt');
      }
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'beide Fassungen: Foto-Adresse, pseudonym, Standort an Anthropic, 7 Empfaenger' };
    },
  },
];
