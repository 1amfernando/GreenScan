// k2 · Marktplatz, Karte, Startseite „Live-Marktplatz", Bilder fremder Nutzer (v33.59).
// Jeder Fall rendert die ECHTE Funktion mit einem feindlichen Wert und misst die
// Wirkung (window.__pwned, berechneter Stil, gerenderte Bildquellen, Speicher) —
// und daneben einen gutartigen Wert, der weiter ankommen muss.
'use strict';

const FREMD = '99999999-9999-4999-8999-999999999999';

module.exports = [
  {
    name: 'Marktplatz-Galerie · ein `&#39;` in photo_urls beendet keinen JS-String mehr, ein fremder Host faellt weg, die Vorschau wechselt weiter',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async () => {
        const base = SB_URL_DEFAULT + '/storage/v1/object/public/marketplace-photos/u1/';
        const imgs = [base + '1.jpg', 'https://bilder.example/2.jpg?x=&#39;;window.__pwned=1;//', base + '3-b_c.jpg?v=1&w=2', base + '4.jpg'];
        gsMarketShowDetail({ id: '11111111-1111-4111-8111-111111111111', title: 'Galerie', desc: 'd', images: imgs, price: 5, priceMode: 'fix', status: 'active', cat: 'samen' });
        await new Promise(res => setTimeout(res, 150));
        const main = document.getElementById('mklist-main-img');
        if (!main) return { main: false };
        const thumbs = Array.from(main.parentElement.querySelectorAll('img')).filter(i => i !== main);
        const srcs = thumbs.map(i => i.getAttribute('src'));
        const nachKlick = [];
        thumbs.forEach(t => { try { t.click(); } catch (e) {} nachKlick.push(main.getAttribute('src')); });
        try { closeModal('detail-modal'); } catch (e) {}
        return { main: true, haupt: main.getAttribute('src'), srcs, nachKlick, base };
      });
      await h.warte(350);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief beim Antippen einer Vorschau (__pwned=' + p + ')' };
      if (!r.main) return { ok: false, warum: 'Galerie nicht gerendert' };
      if (r.srcs.some(s => /bilder\.example/.test(s)) || /bilder\.example/.test(r.haupt)) return { ok: false, warum: 'fremder Host gerendert: ' + JSON.stringify(r.srcs) };
      const soll = [r.base + '1.jpg', r.base + '3-b_c.jpg?v=1&w=2', r.base + '4.jpg'];
      if (JSON.stringify(r.srcs) !== JSON.stringify(soll)) return { ok: false, warum: 'Vorschaubilder aus dem eigenen Speicher fehlen: ' + JSON.stringify(r.srcs) };
      if (JSON.stringify(r.nachKlick) !== JSON.stringify(soll)) return { ok: false, warum: 'Vorschau wechselt das grosse Bild nicht: ' + JSON.stringify(r.nachKlick) };
      return { ok: true, info: '0 Code · fremder Host weg · 3 Speicher-Bilder (eins mit & in der Abfrage) wechseln das grosse Bild' };
    },
  },
  {
    name: 'Startseite „Live-Marktplatz" · eine Bild-Adresse mit angehaengtem CSS legt keine Flaeche ueber die App, ein fremder Host wird nicht geladen, ein Speicher-Bild bleibt',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async () => {
        const base = SB_URL_DEFAULT + '/storage/v1/object/public/marketplace-photos/u1/';
        const boese = base + "a.png');position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483647;background-image:url('https://evil.example/pixel.png";
        const alt = window.sbFetch;
        window._gsMktHomeCache = null;
        window.sbFetch = async () => ({ error: null, data: [
          { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Gut', category: 'samen', photo_urls: [base + 'g.jpg'] },
          { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Boese', category: 'samen', photo_urls: [boese] },
          // v33.59 (Austausch-Runde, klassen-b1): ECHTE Markt-Kategorien — 'pflanzen' kannte keine Tabelle
          { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Fremd', category: 'samen', photo_url: 'https://evil.example/f.jpg' },
          { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', title: 'Prototyp', category: 'constructor' },
        ] });
        try { await gsHomeRenderTopPicks(); } finally { window.sbFetch = alt; window._gsMktHomeCache = null; }
        const list = document.getElementById('home-mkt-live-list');
        const zeilen = list ? Array.from(list.children) : [];
        return zeilen.map(z => {
          const th = z.firstElementChild; const cs = getComputedStyle(th);
          return { pos: cs.position, z: cs.zIndex, bg: cs.backgroundImage, txt: th.textContent };
        });
      });
      const a = h.anfragen().filter(u => /evil\.example/.test(u));
      if (r.length !== 4) return { ok: false, warum: 'vier Zeilen erwartet: ' + JSON.stringify(r) };
      if (r.some(z => z.pos !== 'static')) return { ok: false, warum: 'Vorschau ist nicht mehr statisch: ' + JSON.stringify(r) };
      if (r.some(z => /evil\.example/.test(z.bg)) || a.length) return { ok: false, warum: 'fremder Host angefragt: ' + JSON.stringify({ r, a }) };
      if (!/storage\/v1\/object\/public\/marketplace-photos\/u1\/g\.jpg/.test(r[0].bg)) return { ok: false, warum: 'Speicher-Bild fehlt: ' + r[0].bg };
      if (r[1].bg !== 'none' && !/a\.png/.test(r[1].bg)) return { ok: false, warum: 'unerwarteter Hintergrund: ' + r[1].bg };
      if (r[2].bg !== 'none' || !r[2].txt) return { ok: false, warum: 'fremdes Bild ohne Platzhalter: ' + JSON.stringify(r[2]) };
      // Die Markt-Kategorie wird in der MARKT-Tabelle nachgeschlagen (_catEmoji), nicht in der der Arten.
      if (r[2].txt.trim() !== '🌰') return { ok: false, warum: 'Kategorie „samen" zeigt „' + r[2].txt.trim() + '" statt 🌰 — falsche Tabelle' };
      if (/function|native code|\[object/.test(r[3].txt) || !r[3].txt.trim()) return { ok: false, warum: 'Kategorie „constructor" zeigt: ' + r[3].txt.slice(0, 60) };
      return { ok: true, info: '4 Zeilen statisch · 0 Anfragen an evil.example · Speicher-Bild da · fremdes → 🌰 (samen) · constructor → „' + r[3].txt.trim() + '"' };
    },
  },
  {
    name: 'Karte · fremde oeffentliche Funde landen nicht in greenscan_markers/„Meine Funde", schon uebernommene werden geraeumt, eigene bleiben — und kein Popup fuehrt Code aus',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async (FREMD) => {
        // gsLoadLeaflet laedt '/assets/leaflet.js' — unter file:// zeigt das ins Wurzelverzeichnis.
        if (typeof L === 'undefined') await new Promise(res => { const s = document.createElement('script'); s.src = 'assets/leaflet.js'; s.onload = res; s.onerror = res; document.head.appendChild(s); });
        if (typeof L === 'undefined') return { fehler: 'Leaflet nicht geladen' };
        const me = gsStore.get('gs_sb_uid', null);
        const iso = new Date().toISOString();
        const base = SB_URL_DEFAULT + '/storage/v1/object/public/map-find-photos/';
        const boese = 'https://bilder.example/p.jpg" onerror="window.__pwned=1';
        // Bestand wie bis v33.56: der fremde Fund f1 wurde schon als eigener uebernommen.
        localStorage.setItem('greenscan_markers', JSON.stringify([
          { id: 'cloud_f1', cloud_id: 'f1', lat: 47, lng: 8, name: 'Fremd alt', note: '', cat: 'pilz', photo_url: boese, date: Date.now(), is_private: false },
          { id: 'lokal1', lat: 47.1, lng: 8.1, name: "Eigen lokal d'Or", note: 'n', cat: 'pflanze', photo_url: base + me + '/a.jpg', date: Date.now() },
          { id: 'cloud_e1', cloud_id: 'e1', lat: 47.2, lng: 8.2, name: 'Eigen cloud', cat: 'pilz', photo_url: null, date: Date.now() },
          { id: 'cloud_x1', cloud_id: 'x1', lat: 47.3, lng: 8.3, name: 'Unbekannt', cat: 'pilz', date: Date.now() },
          // Gegenpruefung: ein EIGENER Eintrag ohne cloud_id mit praeparierter Adresse (Backup, alte Fassung)
          // geht durch den eigenen Zweig von _gsFundFoto — nur dieser Popup misst ihn.
          { id: 'lokal2', lat: 47.15, lng: 8.15, name: 'Eigen alt', cat: 'pflanze', photo_url: 'data:image/png;base64,AAAA" onerror="window.__pwned=3', date: Date.now() },
        ]));
        const rows = [
          { id: 'f1', user_id: FREMD, species_name: 'Fremd alt', category: 'pilz', lat: 47, lng: 8, photo_url: boese, is_private: false, found_at: iso },
          { id: 'f2', user_id: FREMD, species_name: 'Fremd <b>neu</b>', note: '<img src=x onerror="window.__pwned=2">', category: 'pilz', lat: 47.4, lng: 8.4, photo_url: 'https://bilder.example/q.jpg', is_private: false, found_at: iso },
          { id: 'f3', user_id: FREMD, species_name: 'Fremd gut', category: 'baum', lat: 47.5, lng: 8.5, photo_url: base + FREMD + '/z.jpg', is_private: false, found_at: iso },
          { id: 'e1', user_id: me, species_name: 'Eigen cloud', category: 'pilz', lat: 47.2, lng: 8.2, is_private: true, found_at: iso },
          { id: 'e2', user_id: me, species_name: 'Eigen neu', category: 'pilz', lat: 47.6, lng: 8.6, photo_url: base + me + '/b.jpg', is_private: true, found_at: iso },
        ];
        const alt = window.sbFetch;
        window.sbFetch = async (p) => {
          if (/map_user_finds/.test(p)) return { error: null, data: /user_id=eq\./.test(p) ? rows.filter(x => x.user_id === me) : rows };
          return { error: null, data: [] };
        };
        try {
          // Sichtbar, sonst laedt ein loading="lazy"-Bild nie und ein onerror feuert nie.
          try { switchTab('map'); } catch (e) {}
          await new Promise(res => setTimeout(res, 300));
          if (!gsMap) gsCreateMap();
          await new Promise(res => setTimeout(res, 300));
          await gsRefreshMarkers();
          await new Promise(res => setTimeout(res, 200));
          const popups = [];
          for (const o of _gsMarkerLayers) {
            try { o.layer.openPopup(); } catch (e) {}
            await new Promise(res => setTimeout(res, 120));
            const pe = o.layer.getPopup() && o.layer.getPopup().getElement();
            const el = pe && pe.querySelector('.leaflet-popup-content');
            if (el) popups.push({ text: el.textContent, imgs: Array.from(el.querySelectorAll('img')).map(i => i.getAttribute('src')), kinder: el.querySelectorAll('b img, span img').length });
            try { o.layer.closePopup(); } catch (e) {}
          }
          const ls = JSON.parse(localStorage.getItem('greenscan_markers') || '[]');
          const liste = await gsMapFinds.list();
          // Gegenpruefung: EIN Pull auf leerem Speicher und leerer Karte — sonst raeumt der zweite Pull
          // (gsRefreshMarkers loest zwei aus) wieder weg, was der erste faelschlich abgelegt hat.
          const ebenen = _gsMarkerLayers.length;
          _gsMarkerLayers.forEach(o => { try { gsMap.removeLayer(o.layer); } catch (e) {} });
          _gsMarkerLayers = [];
          localStorage.setItem('greenscan_markers', '[]');
          await gsLoadMarkersFromCloud();
          const einPull = JSON.parse(localStorage.getItem('greenscan_markers') || '[]').map(m => m.cloud_id || m.id).sort();
          try { switchTab('home'); } catch (e) {}
          return {
            me, base, popups,
            lsIds: ls.map(m => m.cloud_id || m.id).sort(),
            liste: liste.map(f => f.species_name).sort(),
            ebenen, einPull,
            fremdImSpeicher: JSON.stringify(ls).indexOf(FREMD) >= 0 || JSON.stringify(ls).indexOf('bilder.example') >= 0,
          };
        } finally { window.sbFetch = alt; }
      }, FREMD);
      await h.warte(400);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief in einem Karten-Popup (__pwned=' + p + ')' };
      if (r.fehler) return { ok: false, warum: r.fehler };
      const ids = JSON.stringify(r.lsIds);
      if (r.lsIds.some(x => /^f\d$/.test(x)) || r.fremdImSpeicher) return { ok: false, warum: 'fremde Funde im eigenen Speicher: ' + ids };
      if (JSON.stringify(r.einPull) !== '["e1","e2"]') return { ok: false, warum: 'ein einzelner Pull legt ab: ' + JSON.stringify(r.einPull) + ' (erwartet nur e1, e2)' };
      for (const soll of ['e1', 'e2', 'lokal1', 'lokal2', 'x1']) if (r.lsIds.indexOf(soll) < 0) return { ok: false, warum: 'eigener Fund verloren (' + soll + '): ' + ids };
      if (r.liste.some(n => /Fremd/.test(n))) return { ok: false, warum: '„Meine Funde" zeigt fremde: ' + JSON.stringify(r.liste) };
      const alleImgs = [].concat(...r.popups.map(x => x.imgs));
      if (alleImgs.some(s => /bilder\.example/.test(s))) return { ok: false, warum: 'fremder Host im Popup: ' + JSON.stringify(alleImgs) };
      for (const soll of [r.base + r.me + '/a.jpg', r.base + r.me + '/b.jpg', r.base + FREMD + '/z.jpg']) if (alleImgs.indexOf(soll) < 0) return { ok: false, warum: 'Bild fehlt im Popup: ' + soll + ' · ' + JSON.stringify(alleImgs) };
      if (!r.popups.some(x => x.text.indexOf('Fremd <b>neu</b>') >= 0 && x.text.indexOf('<img src=x') >= 0)) return { ok: false, warum: 'Name/Notiz nicht als Text: ' + JSON.stringify(r.popups.map(x => x.text)) };
      if (r.ebenen !== 8) return { ok: false, warum: '8 Marker erwartet (5 eigene aus dem Speicher, 1 neuer eigener, 3 fremde als Schicht, f1 ersetzt), gesehen ' + r.ebenen };
      if (!r.popups.some(x => x.text.indexOf('Eigen alt') >= 0 && x.imgs.length === 1 && /^data:image\/png;base64,AAAA" onerror=/.test(x.imgs[0]))) return { ok: false, warum: 'eigener Popup mit praeparierter Adresse nicht als Wert gerendert: ' + JSON.stringify(r.popups.filter(x => x.text.indexOf('Eigen alt') >= 0)) };
      return { ok: true, info: 'Speicher ' + ids + ' · ein Pull: ' + JSON.stringify(r.einPull) + ' · Meine Funde ' + r.liste.length + ' (0 fremde) · 8 Marker · 0 Code · fremder Host weg' };
    },
  },
  {
    name: 'Sammlung · nur EIGENE Kartenfunde werden eingesammelt, die oeffentlichen Funde anderer nicht',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async () => {
        const me = gsStore.get('gs_sb_uid', null);
        // zwei Arten, die sonst in keiner Quelle der Beispieldaten stehen
        const frei = DB.filter(sp => sp && sp.name && _gsSmartMatchDB(sp.name) === sp).slice(-40);
        const fremdSp = frei[0], eigenSp = frei[1];
        if (!fremdSp || !eigenSp) return { fehler: 'keine Arten gefunden' };
        const alt = window.sbFetch; let pfad = null;
        window.sbFetch = async (p) => {
          if (/map_user_finds/.test(p)) {
            pfad = p;
            const rows = [{ id: 'f9', user_id: '99999999-9999-4999-8999-999999999999', species_name: fremdSp.name }, { id: 'e9', user_id: me, species_name: eigenSp.name }];
            const m = /user_id=eq\.([^&]+)/.exec(p);
            return { error: null, data: m ? rows.filter(x => x.user_id === decodeURIComponent(m[1])) : rows };
          }
          return { error: null, data: [] };
        };
        let items;
        try { items = await window._gsCollGatherSourceItems(); } finally { window.sbFetch = alt; }
        const refs = (items || []).map(it => it.ref);
        return { pfad, fremd: refs.indexOf(String(fremdSp.id)) >= 0, eigen: refs.indexOf(String(eigenSp.id)) >= 0 };
      });
      if (r.fehler) return { ok: false, warum: r.fehler };
      if (!r.pfad) return { ok: false, warum: 'map_user_finds nicht abgefragt' };
      if (r.fremd) return { ok: false, warum: 'fremder Fund in der eigenen Sammlung (Abfrage ' + r.pfad + ')' };
      if (!r.eigen) return { ok: false, warum: 'eigener Fund fehlt in der Sammlung (Abfrage ' + r.pfad + ')' };
      return { ok: true, info: 'Abfrage mit user_id · eigener Fund da · fremder nicht' };
    },
  },
  {
    name: 'Bilder fremder Nutzer · Feed, Verifizier-Fenster, Avatar, Marktplatz-Liste und Arten-Fotos laden nur den eigenen Speicher; ein fremder Host faellt weg (Avatar → Emoji)',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async () => {
        const iso = new Date().toISOString();
        const gut = SB_URL_DEFAULT + '/storage/v1/object/public/post-images/u-y/x.jpg';
        socialPosts = [
          { id: 'q1', user_id: 'u-x', type: 'fund', author_name: 'A', content: 't', created_at: iso, photo_url: 'https://zaehlpixel.example/p.png' },
          { id: 'q2', user_id: 'u-y', type: 'fund', author_name: 'B', content: 'u', created_at: iso, photo_url: gut },
        ];
        currentSocialFilter = 'all';
        renderSocialFeed();
        await new Promise(res => setTimeout(res, 200));
        const feed = document.getElementById('social-feed');
        const b1 = Array.from(feed.querySelectorAll('#post-q1 img')).map(i => i.getAttribute('src'));
        const b2 = Array.from(feed.querySelectorAll('#post-q2 img')).map(i => i.getAttribute('src'));
        // Verifizier-Fenster
        let v1 = null, v2 = null;
        try {
          gsOpenVerifyModal('q1'); await new Promise(res => setTimeout(res, 50));
          let m = document.getElementById('verify-post-modal'); v1 = m ? Array.from(m.querySelectorAll('img')).map(i => i.getAttribute('src')) : null; if (m) m.remove();
          gsOpenVerifyModal('q2'); await new Promise(res => setTimeout(res, 50));
          m = document.getElementById('verify-post-modal'); v2 = m ? Array.from(m.querySelectorAll('img')).map(i => i.getAttribute('src')) : null; if (m) m.remove();
        } catch (e) { v1 = 'Ausnahme ' + e.message; }
        const d = document.createElement('div');
        d.innerHTML = _gsAvatarHtml({ avatar_url: 'https://zaehlpixel.example/a.png', avatar_emoji: '🦊' }) + '|' + _gsAvatarHtml({ avatar_url: SB_URL_DEFAULT + '/storage/v1/object/public/avatars/u/a.png' }) + '|' + _gsAvatarHtml({ avatar_url: 'x" onerror="window.__pwned=1', avatar_emoji: '<b>' });
        const av = Array.from(d.querySelectorAll('img')).map(i => i.getAttribute('src'));
        // Marktplatz-Liste (renderMarket, erstes Bild je Inserat)
        const mAlt = window._gsMarket;
        window._gsMarket = [
          { id: 'mk-fremd', title: 'Fremd', cat: 'produkte', status: 'active', images: ['https://zaehlpixel.example/m.png'], createdAt: 2 },
          { id: 'mk-gut', title: 'Gut', cat: 'produkte', status: 'active', images: [gut], createdAt: 1 },
        ];
        let mk = null;
        try {
          renderMarket();
          const le = document.getElementById('market-listings');
          mk = le ? Array.from(le.querySelectorAll('.mk-card img')).map(i => i.getAttribute('src')) : null;
        } catch (e) { mk = 'Ausnahme ' + e.message; } finally { window._gsMarket = mAlt; }
        // Arten-Community-Fotos (fn_species_images: Haupt- und Vorschaubild)
        const sAlt = window.sbFetch;
        const c = document.createElement('div'); c.id = 'gp-k2-sp'; document.body.appendChild(c);
        window.sbFetch = async () => ({ error: null, data: [
          { url: 'https://zaehlpixel.example/s.png', is_primary: true, attribution: 'x' },
          { url: gut, is_primary: false },
        ] });
        let sp = null;
        try { await gsLoadSpeciesImage('gp-k2-art', null, 'gp-k2-sp'); sp = Array.from(c.querySelectorAll('img')).map(i => i.getAttribute('src')); }
        catch (e) { sp = 'Ausnahme ' + e.message; } finally { window.sbFetch = sAlt; c.remove(); }
        return { b1, b2, v1, v2, gut, av, avText: d.textContent, avB: d.querySelectorAll('b').length, mk, sp };
      });
      await h.warte(350);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (r.b1.length) return { ok: false, warum: 'Feed laedt fremden Host: ' + JSON.stringify(r.b1) };
      if (r.b2.length !== 1 || r.b2[0] !== r.gut) return { ok: false, warum: 'Feed: Speicher-Bild fehlt: ' + JSON.stringify(r.b2) };
      if (!Array.isArray(r.v1) || r.v1.length) return { ok: false, warum: 'Verifizier-Fenster laedt fremden Host: ' + JSON.stringify(r.v1) };
      if (!Array.isArray(r.v2) || r.v2.length !== 1 || r.v2[0] !== r.gut) return { ok: false, warum: 'Verifizier-Fenster: Speicher-Bild fehlt: ' + JSON.stringify(r.v2) };
      if (r.av.length !== 1 || !/avatars\/u\/a\.png$/.test(r.av[0])) return { ok: false, warum: 'Avatar: ' + JSON.stringify(r.av) };
      if (r.avText.indexOf('🦊') < 0 || r.avB) return { ok: false, warum: 'Avatar-Rueckfall: ' + JSON.stringify(r.avText) };
      if (!Array.isArray(r.mk) || JSON.stringify(r.mk) !== JSON.stringify([r.gut])) return { ok: false, warum: 'Marktplatz-Liste: ' + JSON.stringify(r.mk) };
      if (!Array.isArray(r.sp) || r.sp.some(u => !u || /zaehlpixel/.test(u)) || r.sp.indexOf(r.gut) < 0) return { ok: false, warum: 'Arten-Community-Fotos: ' + JSON.stringify(r.sp) };
      return { ok: true, info: 'Feed 0/1 · Verifizieren 0/1 · Avatar: fremd → 🦊, Speicher → Bild, <b> bleibt Text · Marktplatz-Liste 0/1 · Arten-Fotos ohne fremden Host' };
    },
  },
  {
    name: 'Alter Marktplatz-Pool · das Verkaeufer-Emoji (profiles.avatar_emoji) steht als Text, nicht als HTML',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async (boese) => {
        const id = 'LEGACY-1';
        marketListings.push({ id, type: 'free', title: 'Alt', desc: 'd', seller: 'S', sellerAvatar: boese, region: 'ZH', tags: [], shipping: ['local'] });
        try { openListingDetail(id); } catch (e) { return { fehler: e.message }; }
        await new Promise(res => setTimeout(res, 100));
        const body = document.getElementById('listing-detail-body');
        const av = body && body.querySelector('.post-avatar');
        const out = { imgs: av ? av.querySelectorAll('img').length : -1, txt: av ? av.textContent : null };
        const i = marketListings.findIndex(x => x.id === id); if (i >= 0) marketListings.splice(i, 1);
        try { closeModal('listing-detail-modal'); } catch (e) {}
        return out;
      }, h.BOESE);
      await h.warte(350);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (r.fehler) return { ok: false, warum: r.fehler };
      if (r.imgs !== 0) return { ok: false, warum: 'Verkaeufer-Emoji als HTML: ' + JSON.stringify(r) };
      if (!r.txt) return { ok: false, warum: 'kein Emoji/Rueckfall sichtbar' };
      return { ok: true, info: 'Avatar-Feld: 0 Elemente, Text „' + r.txt + '"' };
    },
  },
  {
    name: '_gsOcArg (Saatkalender, Quiz, Saison) · ein `&#39;` im Wert beendet den JS-String nicht mehr, ein Name mit Apostroph kommt unveraendert an',
    lauf: async (seite, h) => {
      const r = await seite.evaluate((ocq) => {
        const werte = [ocq, "Lowenzahn d'Or", 'a\\b', 'Zeile\n2', 'a&amp;b'];
        window.__got = [];
        window.__nimm = function (v) { window.__got.push(v); };
        const d = document.createElement('div'); document.body.appendChild(d);
        d.innerHTML = werte.map(w => '<button onclick="__nimm(\'' + _gsOcArg(w) + '\')">x</button>').join('');
        Array.from(d.querySelectorAll('button')).forEach(b => { try { b.click(); } catch (e) {} });
        const ok = werte.map((w, i) => window.__got[i] === w);
        d.remove(); delete window.__got; delete window.__nimm;
        return { ok, n: werte.length };
      }, h.OCQ);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (r.ok.some(x => !x)) return { ok: false, warum: 'Wert kam veraendert an: ' + JSON.stringify(r.ok) };
      return { ok: true, info: r.n + ' Werte unveraendert durch beide Parser · 0 Code' };
    },
  },
];
