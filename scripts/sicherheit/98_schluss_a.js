// Gruppe r1a — Schlusspruefung Client I (v33.59): kleine Regressionen und Naehte,
// die die Sicherheitsreparaturen selbst mitgebracht haben. Jeder Fall faehrt die
// ECHTE Funktion und misst, was danach dasteht — in beiden Richtungen.
'use strict';

module.exports = [
  {
    name: 'Startangebot · selbst genutzt sagt „bereits genutzt", voll sagt „Ausverkauft", frei sagt nichts — der Knopf ist in beiden Nein-Faellen gesperrt',
    lauf: async (seite) => {
      const r = await seite.evaluate(async () => {
        const alt = window.sbFetch;
        const zeige = async (antwort) => {
          window.sbFetch = async (p) => (String(p).indexOf('launch_offer_available') >= 0 ? { data: antwort, error: null } : { data: null, error: null });
          try {
            try { if (typeof closeAllModals === 'function') closeAllModals(); } catch (e) {}
            gsShowAboScreen();
            let n0 = null;
            for (let i = 0; i < 30; i++) {
              await new Promise(res => setTimeout(res, 50));
              const n = document.getElementById('abo-launch-note');
              if (n && n0 === null) n0 = n.textContent;
              if (n && n.textContent !== n0) break;
            }
            await new Promise(res => setTimeout(res, 150));
            const n = document.getElementById('abo-launch-note');
            const card = document.getElementById('abo-lifetime-card');
            const btn = card && card.querySelector('button[onclick*="pro_lifetime"]');
            return { note: n ? n.textContent.trim() : null, gesperrt: btn ? !!btn.disabled : null };
          } finally { window.sbFetch = alt; }
        };
        const out = {
          genutzt: await zeige({ available: false, logged_in: true, claimed: 7 }),
          voll: await zeige({ available: false, logged_in: true, claimed: 100 }),
          frei: await zeige({ available: true, logged_in: true, claimed: 3 }),
        };
        try { if (typeof closeAllModals === 'function') closeAllModals(); } catch (e) {}
        return out;
      });
      if (!r.genutzt.note || !/bereits genutzt/.test(r.genutzt.note) || /Ausverkauft/.test(r.genutzt.note))
        return { ok: false, warum: 'claimed 7, schon genutzt → ' + JSON.stringify(r.genutzt.note) + ' (erwartet „bereits genutzt")' };
      if (r.genutzt.gesperrt !== true) return { ok: false, warum: 'schon genutzt: Knopf nicht gesperrt' };
      if (!r.voll.note || !/Ausverkauft/.test(r.voll.note) || r.voll.gesperrt !== true)
        return { ok: false, warum: 'claimed 100 → ' + JSON.stringify(r.voll) };
      if (/Ausverkauft|bereits genutzt/.test(r.frei.note || '') || r.frei.gesperrt !== false)
        return { ok: false, warum: 'frei → ' + JSON.stringify(r.frei) };
      return { ok: true, info: '7/100 + genutzt → „' + r.genutzt.note + '" · 100/100 → „' + r.voll.note + '" · frei → „' + r.frei.note + '"' };
    },
  },
  {
    name: 'Scan-Verlauf · eine freie Kategorie mit & steht EINMAL escapet da (nicht „&amp;"), eine boese bleibt Text, eine bekannte wird uebersetzt',
    lauf: async (seite, h) => {
      const lies = async (kat) => seite.evaluate((kat) => {
        localStorage.setItem('gs_confirmed_species', '[]');
        localStorage.setItem('gs_scan_history', JSON.stringify([{ name: 'Testpflanze Rea', latin: 'Testus', category: kat, ts: Date.now() }]));
        gsScanHistoryOpen('h_0');
        const m = document.getElementById('scan-detail-modal');
        const chip = m && Array.from(m.querySelectorAll('div')).find(d => /bg-success-soft/.test(d.getAttribute('style') || '') && d.children.length === 0);
        const t = chip ? chip.textContent : null;
        const fremd = m ? m.querySelectorAll('img[src="x"], img[onerror]').length : -1;
        if (typeof closeScanDetail === 'function') closeScanDetail();
        return { t, fremd };
      }, kat);
      const amp = await lies('Obst & Beeren');
      const boese = await lies(h.BOESE);
      await h.warte(350);
      const pw = await h.pwned();
      const gut = await lies('pilz');
      if (amp.t !== 'Obst & Beeren') return { ok: false, warum: '„Obst & Beeren" erscheint als ' + JSON.stringify(amp.t) };
      if (boese.t !== h.BOESE || boese.fremd !== 0 || pw !== null) return { ok: false, warum: 'boese Kategorie: ' + JSON.stringify(boese) + ' pwned=' + pw };
      if (gut.t !== 'Pilz') return { ok: false, warum: 'bekannte Kategorie „pilz" → ' + JSON.stringify(gut.t) };
      return { ok: true, info: '„Obst & Beeren" · boese als Text · pilz → Pilz' };
    },
  },
  {
    name: 'Altbestand gs_confirmed_species · ein Eintrag mit Auszeichnung (vor v33.59 ungesiebt) kommt nicht in DB und rendert in Liste und Detail als Text — ein guter Alt-Eintrag bleibt sichtbar',
    lauf: async (seite, h) => {
      const r = await seite.evaluate((boese) => {
        localStorage.setItem('gs_scan_history', '[]');
        localStorage.setItem('gs_confirmed_species', JSON.stringify([
          { id: 'SCAN_1', name: 'Alt ' + boese, lat: 'Boesus ' + boese, emoji: boese, scannedAt: new Date().toISOString(), confidence: 97 },
          { id: 'SCAN_2', name: "Echter Ehrenpreis (Tom's)", lat: 'Veronica officinalis', emoji: '🔬', scannedAt: new Date().toISOString(), confidence: 96 },
        ]));
        const inDb = (window.DB || []).some(s => s && /Boesus|Alt <img/.test(String(s.name) + String(s.lat)));
        openScanHistoryFull();
        renderScanHistFull();
        const liste = document.getElementById('scan-history-list');
        const listeTxt = liste ? liste.textContent : '';
        const listeFremd = liste ? liste.querySelectorAll('img[src="x"], img[onerror]').length : -1;
        gsScanHistoryOpen('c_0');
        const m = document.getElementById('scan-detail-modal');
        const detFremd = m ? m.querySelectorAll('img[src="x"], img[onerror]').length : -1;
        const detTxt = m ? m.textContent : '';
        if (typeof closeScanDetail === 'function') closeScanDetail();
        try { closeScanHistoryFull(); } catch (e) {}
        return { inDb, listeTxt, listeFremd, detFremd, detTxt };
      }, h.BOESE);
      await h.warte(350);
      const pw = await h.pwned();
      if (r.inDb) return { ok: false, warum: 'der Alt-Eintrag steht in DB' };
      if (pw !== null || r.listeFremd !== 0 || r.detFremd !== 0) return { ok: false, warum: 'Auszeichnung lief: ' + JSON.stringify({ pw, l: r.listeFremd, d: r.detFremd }) };
      if (r.listeTxt.indexOf('Alt ' + h.BOESE) < 0 || r.detTxt.indexOf('Alt ' + h.BOESE) < 0) return { ok: false, warum: 'boeser Name nicht als Text sichtbar' };
      if (r.listeTxt.indexOf("Echter Ehrenpreis (Tom's)") < 0) return { ok: false, warum: 'guter Alt-Eintrag fehlt in der Liste' };
      return { ok: true, info: 'nicht in DB · Liste und Detail zeigen den Namen als Text · guter Eintrag sichtbar' };
    },
  },
  {
    name: '_gsCssUrl · ein data:image-Foto (;base64) laedt als Bild UND erscheint im echten Tagebuch-Kopf — ein Wert mit \' " ( ) \\ Leerraum verlaesst url(\'…\') nicht',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async () => {
        const cv = document.createElement('canvas'); cv.width = 4; cv.height = 3;
        const cx = cv.getContext('2d'); cx.fillStyle = '#ff0000'; cx.fillRect(0, 0, 4, 3);
        const roh = cv.toDataURL('image/jpeg');
        const css = _gsCssUrl(roh);
        const laedt = await new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth); i.onerror = () => res(0); i.src = css; });
        // echtes openPlantDiary mit einem Foto als data:-Adresse
        const p = myPlants[0];
        const altFoto = p.photo;
        p.photo = roh;
        let bg = null, heroLaedt = 0;
        try {
          openPlantDiary(p.id);
          await new Promise(res => setTimeout(res, 200));
          // die Kurzform traegt var(--surface2) — dann sind die Langformen in .style leer; gelesen wird der berechnete Wert
          const hero = Array.from(document.querySelectorAll('div')).find(d => /data:image\/jpeg/.test(d.getAttribute('style') || '') && /height:200px/.test(d.getAttribute('style') || ''));
          bg = hero ? getComputedStyle(hero).backgroundImage : null;
          if (bg && !/data:image\/jpeg/.test(bg)) bg = null;
          if (bg) {
            const u = bg.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
            heroLaedt = await new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth); i.onerror = () => res(0); i.src = u; });
          }
        } finally {
          p.photo = altFoto;
          try { closeModal && document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id)); } catch (e) {}
          document.querySelectorAll('.gs-dyn-overlay').forEach(o => o.remove());
        }
        // Gegenrichtung
        const boese = [
          "data:image/png;base64,AAAA') ; background:url('https://boese.example/a.png",
          'https://xyzcompany.supabase.co/a.png") ; background:url("https://boese.example/b.png',
          'https://xyzcompany.supabase.co/a.png\\27 ) ;x:url(https://boese.example/c.png)',
          'https://xyzcompany.supabase.co/a b.png\n;background:red',
          // der Wert steht in einem HTML-ATTRIBUT: der HTML-Parser macht aus &#39; &#41; &#40; die Zeichen,
          // die der Helfer kodiert hat — und _gsFremdBild laesst & # ; in einer Speicheradresse durch
          _gsFremdBild(SB_URL_DEFAULT + '/storage/v1/object/public/x/a.png&#39;&#41;;background-image:url&#40;&#39;https://boese.example/d.png'),
          'https://xyzcompany.supabase.co/a.png&apos;&rpar;;background-image:url&lpar;&apos;https://boese.example/e.png',
        ];
        const aus = boese.map(b => _gsCssUrl(b));
        // gelesen wird, was der HTML-Parser aus dem Attribut macht — nicht der Text davor
        const dek = aus.map(a => { const t = document.createElement('textarea'); t.innerHTML = a; return t.value; });
        const unsauber = dek.filter(a => /['"()\\\s]/.test(a));
        if (!aus[4]) unsauber.push('Vorbedingung: _gsFremdBild hat die Speicheradresse mit &#39; abgewiesen — der Fall misst nichts');
        const box = document.createElement('div');
        box.innerHTML = aus.map(a => '<div style="width:10px;height:10px;background-image:url(\'' + a + '\');"></div>').join('');
        document.body.appendChild(box);
        await new Promise(res => setTimeout(res, 200));
        box.remove();
        return { nBoese: aus.length, css: css.slice(0, 40), laedt, bg: bg ? bg.slice(0, 50) : null, heroLaedt, unsauber, aus: aus.map(a => a.slice(0, 80)) };
      });
      // gemessen wird der HOST: eine einzige, kodierte Adresse darf „boese.example" im Pfad tragen
      const fremd = h.anfragen().filter(u => { try { return new URL(u).hostname === 'boese.example'; } catch (e) { return false; } });
      if (!r.laedt) return { ok: false, warum: '_gsCssUrl(data:image/jpeg;base64,…) laedt nicht als Bild: ' + r.css };
      if (!r.bg || !r.heroLaedt) return { ok: false, warum: 'Tagebuch-Kopf ohne ladbares Foto: ' + JSON.stringify(r.bg) };
      if (r.unsauber.length) return { ok: false, warum: 'Ausbruchszeichen ueberlebt: ' + JSON.stringify(r.unsauber) };
      if (fremd.length) return { ok: false, warum: 'fremde Anfragen: ' + JSON.stringify(fremd) };
      return { ok: true, info: 'data:-Foto laedt (' + r.laedt + ' px) · Tagebuch-Kopf zeigt es · ' + r.nBoese + ' boese Werte (auch &#39;/&apos; nach dem HTML-Parser) bleiben in url(), 0 fremde Anfragen' };
    },
  },
  {
    name: 'Lichtmessung · verweigerte Kamera: Toast und Statuszeile sagen einen Satz, nicht die englische Ausnahme',
    lauf: async (seite) => {
      const r = await seite.evaluate(async () => {
        const altGum = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
        const altToast = window.showProfileToast;
        const toasts = [];
        window.showProfileToast = function (m) { toasts.push(String(m)); };
        const md = navigator.mediaDevices;
        const stub = async () => { throw new DOMException('Permission denied by system', 'NotAllowedError'); };
        try { Object.defineProperty(md, 'getUserMedia', { value: stub, configurable: true, writable: true }); } catch (e) { md.getUserMedia = stub; }
        let el = document.getElementById('pp-lux-text'), neu = false;
        if (!el) { el = document.createElement('div'); el.id = 'pp-lux-text'; document.body.appendChild(el); neu = true; }
        try { await gsPPmeasureLuxInline(); }
        finally {
          window.showProfileToast = altToast;
          try { Object.defineProperty(md, 'getUserMedia', { value: altGum, configurable: true, writable: true }); } catch (e) { md.getUserMedia = altGum; }
        }
        const zeile = el.textContent;
        if (neu) el.remove();
        // eine DOMException darf ohne Meldung kommen — dann nicht „Unbekannter Fehler"
        const leer = _gsFehlerText(new DOMException('', 'NotAllowedError'));
        return { toasts, zeile, leer };
      });
      const t = r.toasts.find(x => /Lichtmessung/.test(x));
      if (!t) return { ok: false, warum: 'kein Toast: ' + JSON.stringify(r.toasts) };
      if (/Permission|denied|NotAllowed|Server/i.test(t)) return { ok: false, warum: 'Toast zeigt die rohe Ausnahme: ' + JSON.stringify(t) };
      if (/Permission|denied|NotAllowed|Server/i.test(r.zeile)) return { ok: false, warum: 'Statuszeile roh oder falscher Satz: ' + JSON.stringify(r.zeile) };
      if (!/Zugriff nicht erlaubt/.test(r.leer)) return { ok: false, warum: 'NotAllowedError ohne Meldung → ' + JSON.stringify(r.leer) };
      return { ok: true, info: 'Toast „' + t + '" · ohne Meldung ebenso' };
    },
  },
  {
    name: 'Plan-Sieb · „KW 12", „20-30", „5-8" werden zur fuehrenden Zahl (Zeitplan zeigt KW 12) — Auszeichnung und Text ohne Zahl fallen weiter weg',
    lauf: async (seite, h) => {
      const r = await seite.evaluate((boese) => {
        const plan = {
          plants: [
            { name: 'Karotte', count: '20-30', spacing_cm: '5-8', depth_cm: '1,5 cm' },
            { name: 'Boese', count: boese, spacing_cm: '<b>5</b>', w_m: 'viel' },
          ],
          timeline: [{ week: 'KW 12', action: 'Säen' }, { week: 'kw14', action: 'Pikieren' }, { week: boese, action: 'x' }],
        };
        _gsPlanTypSieb(plan);
        let html = '';
        try { const r = gsPPrenderPlan(plan, {}); html = typeof r === 'string' ? r : ''; } catch (e) { html = 'FEHLER ' + e.message; }
        return { p0: plan.plants[0], p1: plan.plants[1], t: plan.timeline.map(x => x.week), kw12: /KW 12</.test(html), hatHtml: html.length > 0, fehler: /^FEHLER/.test(html) ? html : '' };
      }, h.BOESE);
      if (r.p0.count !== 20 || r.p0.spacing_cm !== 5 || r.p0.depth_cm !== 1.5) return { ok: false, warum: 'Karotte nach dem Sieb: ' + JSON.stringify(r.p0) };
      if (r.t[0] !== 12 || r.t[1] !== 14 || r.t[2] !== undefined) return { ok: false, warum: 'Wochen nach dem Sieb: ' + JSON.stringify(r.t) };
      if ('count' in r.p1 || 'spacing_cm' in r.p1 || 'w_m' in r.p1) return { ok: false, warum: 'Auszeichnung/Text ohne Zahl ueberlebt: ' + JSON.stringify(r.p1) };
      if (r.fehler) return { ok: false, warum: r.fehler };
      if (r.hatHtml && !r.kw12) return { ok: false, warum: 'Zeitplan zeigt nicht „KW 12"' };
      return { ok: true, info: 'KW 12 → 12 · 20-30 → 20 · 5-8 → 5 · „1,5 cm" → 1.5 · <b>5</b>/boese/„viel" fallen weg' + (r.hatHtml ? ' · Zeitplan „KW 12"' : '') };
    },
  },
  {
    name: 'Ops-Cockpit · der Normalzustand 0 steht als „0" da (escHtml(0) war leer) — Text aus dem Digest bleibt Text',
    lauf: async (seite, h) => {
      const r = await seite.evaluate((boese) => {
        const html = _gsAdminOpsCockpitHtml({
          overall: 'ok', cron_active: 0, cron_failed_24h: 0, events_warn_24h: 0, events_error_24h: 0,
          integrity: { total_storage_objects: 0, species_images_orphan_files: 0, restore_integrity_failures: 0, snapshot_loss_warnings: 0 },
          finance: { est_mrr_chf: 0, ai_cost_chf_30d: 0, coverage_ratio_mrr_over_ai: 0, total_users: boese },
          security: { client_errors_24h: 0, client_errors_7d: 0, rate_limit_windows_24h: 0, audit_sensitive_actions_24h: 0 },
        });
        const d = document.createElement('div'); d.innerHTML = html; document.body.appendChild(d);
        const t = d.textContent.replace(/\s+/g, ' ');
        const fremd = d.querySelectorAll('img[src="x"], img[onerror]').length;
        d.remove();
        return { t, fremd };
      }, h.BOESE);
      await h.warte(350);
      const pw = await h.pwned();
      const soll = ['0 aktive Hintergrund-Jobs', '0 Fehlläufe 24h', '0 Warnungen / 0 Fehler', 'Speicher: 0 Dateien', 'Orphans 0', 'Datenverlust 0', 'MRR 0 CHF', 'Fehler 24h 0', 'sens. Admin 0', 'Deckung 0×'];
      const fehlt = soll.filter(s => r.t.indexOf(s) < 0);
      if (fehlt.length) return { ok: false, warum: 'fehlt: ' + JSON.stringify(fehlt) + ' in ' + JSON.stringify(r.t.slice(0, 260)) };
      if (r.fremd || pw !== null || r.t.indexOf(h.BOESE) < 0) return { ok: false, warum: 'Digest-Text nicht als Text: ' + JSON.stringify({ f: r.fremd, pw }) };
      return { ok: true, info: soll.length + ' Nullwerte sichtbar · Text aus dem Digest als Text' };
    },
  },
  {
    name: 'Arten-Vorschlag · ein nicht pruefbares Foto kostet EINE Rueckfrage (vorher zwei) — KI-Zweifel eine, KI-Ja keine',
    lauf: async (seite) => {
      const r = await seite.evaluate(async () => {
        const alt = { v: window._gsVerifySpeciesImage, c: window.gsConfirmModal, t: window._gsAdmTun, s: window.gsAdmSektionNeu, q: window._gsAdminPropQueue };
        const out = {};
        try {
          window._gsAdminPropQueue = [{ id: 'prop-1', name: 'Bärlauch', latin: 'Allium ursinum', data: { photo_url: 'https://upload.wikimedia.org/a.jpg' } }];
          window._gsAdmTun = async () => ({ state: 'ok', daten: { inserted: true } });
          window.gsAdmSektionNeu = async () => {};
          for (const [k, urteil] of [['nicht_pruefbar', null], ['zweifel', false], ['ja', true]]) {
            let n = 0; const titel = [];
            window._gsVerifySpeciesImage = async () => urteil;
            window.gsConfirmModal = async (o) => { n++; titel.push(o && o.title); return true; };
            await gsAdminReviewSpeciesProposal('prop-1', true);
            out[k] = { n, titel };
          }
        } finally {
          window._gsVerifySpeciesImage = alt.v; window.gsConfirmModal = alt.c; window._gsAdmTun = alt.t; window.gsAdmSektionNeu = alt.s; window._gsAdminPropQueue = alt.q;
        }
        return out;
      });
      if (r.nicht_pruefbar.n !== 1) return { ok: false, warum: 'nicht pruefbar: ' + r.nicht_pruefbar.n + ' Rueckfragen ' + JSON.stringify(r.nicht_pruefbar.titel) };
      if (r.zweifel.n !== 1) return { ok: false, warum: 'KI-Zweifel: ' + r.zweifel.n + ' Rueckfragen' };
      if (r.ja.n !== 0) return { ok: false, warum: 'KI-Ja: ' + r.ja.n + ' Rueckfragen' };
      return { ok: true, info: 'null → 1 (' + r.nicht_pruefbar.titel[0] + ') · false → 1 · true → 0' };
    },
  },
  {
    name: 'Arten-Vorschlag · „die App wuerde verwerfen" steht genau dann da, wenn _gsArtEingang die Art wirklich verwirft',
    lauf: async (seite, h) => {
      const r = await seite.evaluate((boese) => {
        const lang = 'Pflanze'.repeat(15); // 105 Zeichen
        const faelle = [
          { id: 'a', name: 'Bärlauch', latin: 'Allium ursinum', family: 'Amaryllidaceae', data: { ai_summary: '<b>fett</b> Beschreibung' } },
          { id: 'b', name: lang, latin: 'Longus', family: 'X', data: {} },
          { id: 'c', name: 'Name "zitiert"', latin: 'Quotus', family: 'X', data: {} },
          { id: 'd', name: 'Ok', latin: 'Boesus ' + boese, family: 'X', data: {} },
          { id: 'e', name: 'P'.repeat(130), latin: 'Y', family: 'X', data: {} },
          { id: 'f', name: "Echter Ehrenpreis (Tom's)", latin: 'Veronica officinalis', family: 'Plantaginaceae', data: { ai_summary: 'Blau' } },
        ];
        return faelle.map(p => {
          const d = document.createElement('div'); d.innerHTML = _gsAdminSpeciesProposalHtml([p]);
          const t = d.textContent;
          return { id: p.id, verwerfen: /verwerfen/.test(t), stopp: /⛔/.test(t), app: _gsArtEingang({ name: p.name, lat: p.latin, fam: p.family }) === null,
            fremd: d.querySelectorAll('img[src="x"], img[onerror]').length };
        });
      }, h.BOESE);
      const falsch = r.filter(x => x.verwerfen !== x.app || x.stopp !== x.app || x.fremd);
      if (falsch.length) return { ok: false, warum: 'Anzeige und Regel weichen ab: ' + JSON.stringify(falsch) };
      const ver = r.filter(x => x.app).map(x => x.id).join(',');
      return { ok: true, info: 'verworfen (⛔ + Satz): ' + ver + ' · Beschreibung mit <b>, Name 105 Zeichen, guter Name: kein ⛔' };
    },
  },
  {
    name: 'Baumplaner · ein Slug mit \' & wird angetippt und gefunden (vorher zweimal _gsOcStr) — ein boeser Slug laeuft nicht',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async (oc) => {
        const TPx = window._gsTP;
        const alt = { specs: TPx.specs, rules: TPx.rules, mat: TPx.materials, f: TPx._filter, sel: TPx.sel, pick: window._gsTPpick };
        const slugs = ["o'brien-a&b", 'eiche-quercus', oc];
        const ankunft = [];
        try {
          // tpRenderList liegt in einer IIFE: der Weg hinein ist der echte Oeffner und das echte Suchfeld
          TPx.specs = slugs.map((s, i) => ({ slug: s, category: 'laubbaum', scientific_name: 'Testus ' + i, common_name_de: 'Testbaum ' + i }));
          TPx.rules = {}; TPx.materials = [];
          await window.gsOpenTreePlanner();
          const such = document.getElementById('tp-search');
          such.value = 'testbaum';
          window._gsTPfilter();
          // was im onclick ankommt, wird gemessen — gefunden wird mit derselben Regel wie _gsTPpick (x.slug === slug)
          window._gsTPpick = function (s) { ankunft.push({ s, gefunden: TPx.specs.filter(x => x.slug === s).length }); };
          Array.from(document.querySelectorAll('#tp-list [onclick*="_gsTPpick"]')).forEach(el => el.click());
        } finally {
          const scr = document.getElementById('tree-planner-screen'); if (scr) scr.remove();
          TPx.specs = alt.specs; TPx.rules = alt.rules; TPx.materials = alt.mat; TPx._filter = alt.f; TPx.sel = alt.sel; window._gsTPpick = alt.pick;
        }
        return ankunft;
      }, h.OC);
      await h.warte(100);
      const pw = await h.pwned();
      if (pw !== null) return { ok: false, warum: 'boeser Slug lief' };
      const soll = ["o'brien-a&b", 'eiche-quercus', h.OC];
      if (JSON.stringify(r.map(x => x.s)) !== JSON.stringify(soll) || r.some(x => x.gefunden !== 1)) return { ok: false, warum: 'im onclick angekommen: ' + JSON.stringify(r) + ' (erwartet ' + JSON.stringify(soll) + ')' };
      return { ok: true, info: 'drei Klicks, drei richtige Baeume — auch o\'brien-a&b und der boese Slug als Wert' };
    },
  },
];
