// Community und Marktplatz: haelt die Datenbank Moderation, Sperre, Blockieren,
// Chat, Verkaeufer-Status, Organisationen und Bild-Adressen — oder nur die App?
//
// Grundlage: scripts/rls/30_community.fixture.sql — Tabellen, Funktionen,
// Trigger und Policies im Wortlaut des Live-Stands, live gelesen 10.11.2026
// (nur lesend). Jeder Fall: Angriff VOR der Migration (muss gelingen), Migration
// zweimal, Angriff danach (scheitert), erlaubter Weg der App geht weiter; wo es
// billig ist, eine Gegenprobe mit der entscheidenden Zeile weggelassen.
'use strict';
const fs = require('fs');
const path = require('path');

const MIG = '20261110_sicherheit_community_markt.sql';
const FIXTURE = fs.readFileSync(path.join(__dirname, '30_community.fixture.sql'), 'utf8');
const BAN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SPEICHER = 'https://vowbiueikwrauuceilhc.supabase.co/storage/v1/object/public/';
const L1 = '0a000000-0000-4000-8000-000000000001';   // Inserat von U1
const P1 = '0b000000-0000-4000-8000-000000000001';   // Beitrag von U1
const ORG = '0c000000-0000-4000-8000-000000000001';

function aufbau(h, name) {
  const d = h.neu('community_' + name);
  d.sql(FIXTURE);
  d.sql(`
    insert into auth.users (id, email) values ('${h.U1}','anna@example.invalid'),('${h.U2}','bert@example.invalid'),
      ('${h.U3}','cora@example.invalid'),('${h.ADMIN}','admin@example.invalid'),('${BAN}','bann@example.invalid');
    insert into public.profiles (id, display_name, role, is_admin) values
      ('${h.U1}','Anna','user',false),('${h.U2}','Bert','user',false),('${h.U3}','Cora','user',false),
      ('${h.ADMIN}','Admin','admin',true),('${BAN}','Bann','user',false);
    insert into public.social_posts (id, user_id, author_name, content) values ('${P1}','${h.U1}','Anna','Mein Fund');
    insert into public.marketplace_listings (id, user_id, title) values ('${L1}','${h.U1}','Setzlinge');
  `);
  // service_role umgeht RLS (bypassrls). Im lokalen Cluster kann die Rolle schon
  // OHNE dieses Attribut angelegt sein (Rollen gelten clusterweit) — dann steht
  // eine offene Policy fuer service_role an seiner Stelle, nur in dieser Fixture.
  if (d.sql(`select rolbypassrls::text from pg_roles where rolname='service_role';`) !== 'true') {
    for (const t of ['marketplace_listings', 'marketplace_sellers'])
      d.sql(`create policy gs_test_service_bypass on public.${t} for all to service_role using (true) with check (true);`);
  }
  return d;
}
// Migration zweimal (Idempotenz) — oder eine veraenderte Fassung (Gegenprobe)
function migrieren(h, d, ohne) {
  if (ohne) {
    let t = h.migrationText(MIG);
    for (const s of [].concat(ohne)) {
      if (t.indexOf(s) < 0) throw new Error('Gegenprobe: Zeile nicht gefunden: ' + s.slice(0, 60));
      t = t.split(s).join('');
    }
    const r = d.versuch(t);
    if (!r.ok) throw new Error('Gegenprobe-Migration: ' + r.err.split('\n')[0]);
    return;
  }
  for (const n of [1, 2]) {
    const r = d.migration(MIG);
    if (!r.ok) throw new Error('Migration (' + n + '. Mal): ' + (r.err.split('\n').find(z => /ERROR/.test(z)) || r.err));
  }
}
const zeile = (d, q) => d.sql(q);
function fehler(r) { return r.ok ? '' : (r.err.split('\n').find(z => /ERROR/.test(z)) || r.err).replace(/^.*ERROR:\s*/, ''); }

module.exports = [
  {
    name: 'Moderation · Beitrag: der Autor blendet einen vom Admin versteckten Beitrag NICHT wieder ein und faelscht keine Zaehler/Autor',
    lauf: async (h) => {
      const angriff = (d) => {
        d.als(h.ADMIN, `select public.fn_admin_moderate('post','${P1}','hide');`);
        const r = d.als(h.U1, `update public.social_posts set is_archived=false, likes=9999, comments_count=500, is_featured=true,
                               author_name='GreenScan Team', created_at='2099-01-01' where id='${P1}';`);
        return { r, z: zeile(d, `select is_archived::text||'|'||likes||'|'||is_featured::text||'|'||author_name||'|'||(created_at>now())::text from public.social_posts where id='${P1}';`) };
      };
      const d = aufbau(h, 'mod_post');
      try {
        const vor = angriff(d);
        if (vor.z !== 'false|9999|true|GreenScan Team|true') return { ok: false, warum: 'Angriff gelingt VOR der Migration nicht — Fall misst nichts: ' + vor.z };
        d.sql(`update public.social_posts set likes=0, comments_count=0, is_featured=false, author_name='Anna', created_at=now() where id='${P1}';`);
        migrieren(h, d);
        const nach = angriff(d);
        if (nach.z !== 'true|0|false|Anna|false') return { ok: false, warum: 'nach der Migration: ' + nach.z + ' ' + fehler(nach.r) };
        // erlaubte Wege: Text aendern, Like (RPC), Kommentar zaehlt (Trigger), Admin blendet ein, neuer Beitrag
        const txt = d.als(h.U1, `with u as (update public.social_posts set content='Korrigiert' where id='${P1}' returning 1) select count(*) from u;`);
        const like = d.als(h.U2, `select public.toggle_post_like('${P1}','${h.U2}')->>'likes';`);
        const kom = d.als(h.U2, `insert into public.post_comments (post_id, user_id, author_name, content, created_at) values ('${P1}','${h.U2}','Bert','Schoen','2099-01-01');`);
        const kom2 = d.als(h.U1, `insert into public.post_comments (post_id, user_id, author_name, content) values ('${P1}','${h.U1}','Anna','Danke');`);
        const ein = d.als(h.ADMIN, `select public.fn_admin_moderate('post','${P1}','unhide')->>'ok';`);
        const neu = d.als(h.U2, `insert into public.social_posts (user_id, author_name, content, likes, is_featured) values ('${h.U2}','Bert','Hallo',777,true) returning likes||'|'||is_featured::text;`);
        const z = zeile(d, `select content||'|'||likes||'|'||comments_count||'|'||is_archived::text from public.social_posts where id='${P1}';`);
        const kz = zeile(d, `select (max(created_at) < now() + interval '1 minute')::text from public.post_comments;`);
        if (txt.out !== '1' || like.out !== '1' || !kom.ok || !kom2.ok || ein.out !== 'true' || neu.out !== '0|false' || z !== 'Korrigiert|1|2|false' || kz !== 'true')
          return { ok: false, warum: 'erlaubter Weg: ' + JSON.stringify({ txt: txt.out || fehler(txt), like: like.out || fehler(like), kom: fehler(kom), kom2: fehler(kom2), ein: ein.out, neu: neu.out || fehler(neu), z, kz }) };
        // Gegenprobe: ohne den Waechter auf social_posts gelingt der Angriff wieder
        const g = aufbau(h, 'mod_post_g');
        try {
          migrieren(h, g, ['CREATE TRIGGER trg_gs_beitrag_waechter BEFORE INSERT OR UPDATE ON public.social_posts\n  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_beitrag_waechter();']);
          const gg = angriff(g);
          if (gg.z.indexOf('false|9999') !== 0) return { ok: false, warum: 'Gegenprobe blieb gruen: ' + gg.z };
        } finally { g.weg(); }
        return { ok: true, info: 'vorher: wieder sichtbar, 9999 Likes, „GreenScan Team", 2099 · nachher: still gehalten (0 Wirkung, kein Fehler) · Text, Like-RPC, Kommentarzaehler (auch fremder Beitrag), Admin-Einblenden gehen · Gegenprobe rot' };
      } finally { d.weg(); }
    },
  },
  {
    name: 'Moderation · Inserat: der Eigentuemer holt ein verstecktes Inserat NICHT zurueck, faelscht weder Aufrufe/Meldungen noch das Datum',
    lauf: async (h) => {
      const angriff = (d) => {
        d.als(h.ADMIN, `select public.fn_admin_moderate('listing','${L1}','hide');`);
        const r = d.als(h.U1, `update public.marketplace_listings set moderation_status=null, reports=0, views=5000, created_at='2099-01-01' where id='${L1}';`);
        return { r, z: zeile(d, `select coalesce(moderation_status,'-')||'|'||views||'|'||(created_at<now())::text from public.marketplace_listings where id='${L1}';`) };
      };
      const d = aufbau(h, 'mod_inserat');
      try {
        const vor = angriff(d);
        if (vor.z !== '-|5000|false') return { ok: false, warum: 'Angriff gelingt VOR der Migration nicht: ' + vor.z };
        d.sql(`update public.marketplace_listings set created_at=now(), views=0 where id='${L1}';`);
        migrieren(h, d);
        const nach = angriff(d);
        if (nach.z !== 'hidden|0|true') return { ok: false, warum: 'nach der Migration: ' + nach.z + ' ' + fehler(nach.r) };
        // Folge-Feed: ein verstecktes Inserat erscheint nicht bei Folgenden
        d.sql(`insert into public.user_follows values ('${h.U3}','${h.U1}');`);
        const feed = d.als(h.U3, `select count(*) from public.fn_following_feed(30) where kind='listing';`);
        // erlaubt: Bio-PATCH (wie die App), Status ueber RPC, Aufruf zaehlt (RPC), service_role-Insert
        const bio = d.als(h.U1, `with u as (update public.marketplace_listings set organic_certified=true, certification_label='Knospe' where id='${L1}' returning 1) select count(*) from u;`);
        const st = d.als(h.U1, `select public.fn_marketplace_set_status('${L1}','sold')->>'ok';`);
        const vw = d.als(h.U2, `select public.fn_mkt_increment_views('${L1}');`);
        const svc = d.als(null, `insert into public.marketplace_listings (user_id, title, status, views, reports) values ('${h.U2}','Publish','active',0,0) returning 1;`, { rolle: 'service_role' });
        const ins = d.als(h.U2, `insert into public.marketplace_listings (user_id, title, views, reports, moderation_status) values ('${h.U2}','Direkt',800,0,null) returning views;`);
        const z = zeile(d, `select organic_certified::text||'|'||status||'|'||views from public.marketplace_listings where id='${L1}';`);
        if (feed.out !== '0' || bio.out !== '1' || st.out !== 'true' || !vw.ok || svc.out !== '1' || ins.out !== '0' || z !== 'true|sold|1')
          return { ok: false, warum: 'erlaubter Weg: ' + JSON.stringify({ feed: feed.out || fehler(feed), bio: bio.out || fehler(bio), st: st.out, vw: fehler(vw), svc: svc.out || fehler(svc), ins: ins.out || fehler(ins), z }) };
        return { ok: true, info: 'vorher: wieder oeffentlich, 5000 Aufrufe, Datum 2099 · nachher gehalten · Feed ohne verstecktes Inserat · Bio-PATCH, Status-RPC, Aufruf-RPC, service_role gehen' };
      } finally { d.weg(); }
    },
  },
  {
    name: 'Sperre · ein gesperrtes Konto bearbeitet nicht, inseriert nicht, chattet nicht, setzt keine oeffentlichen Funde und keine Anfragen',
    lauf: async (h) => {
      const angriffe = (d) => ({
        bearbeiten: d.als(BAN, `with u as (update public.social_posts set content='Spam' where user_id='${BAN}' returning 1) select count(*) from u;`),
        inserat: d.als(BAN, `insert into public.marketplace_listings (user_id, title) values ('${BAN}','Spam');`),
        chat: d.als(BAN, `insert into public.marketplace_messages (listing_id, buyer_id, seller_id, sender_id, message) values ('${L1}','${BAN}','${h.U1}','${BAN}','Spam');`),
        fund: d.als(BAN, `insert into public.map_user_finds (user_id, species_name, lat, lng, is_private) values ('${BAN}','Spam',47,8,false);`),
        anfrage: d.als(BAN, `insert into public.friendships (user_id, friend_id) values ('${BAN}','${h.U3}');`),
      });
      const durch = (a) => Object.keys(a).filter(k => a[k].ok && a[k].out !== '0');
      const vorbereiten = (d) => d.sql(`insert into public.social_posts (user_id, author_name, content) values ('${BAN}','Bann','alt');
                                        update public.profiles set role='banned' where id='${BAN}';`);
      const d = aufbau(h, 'sperre');
      try {
        vorbereiten(d);
        const vor = durch(angriffe(d));
        if (vor.length !== 5) return { ok: false, warum: 'VOR der Migration gingen nur ' + vor.join(',') + ' durch — Fall misst nicht alles' };
        d.sql(`delete from public.marketplace_listings where user_id='${BAN}'; delete from public.marketplace_messages; delete from public.map_user_finds; delete from public.friendships;
               update public.social_posts set content='alt' where user_id='${BAN}';`);
        migrieren(h, d);
        const nach = durch(angriffe(d));
        if (nach.length) return { ok: false, warum: 'nach der Migration geht noch durch: ' + nach.join(',') };
        const privat = d.als(BAN, `insert into public.map_user_finds (user_id, species_name, lat, lng, is_private) values ('${BAN}','Privat',47,8,true) returning 1;`);
        const admin = d.als(h.ADMIN, `select public.fn_admin_moderate('post',(select id from public.social_posts where user_id='${BAN}'),'hide')->>'ok';`);
        const normal = d.als(h.U2, `insert into public.marketplace_listings (user_id, title) values ('${h.U2}','Ok');
          insert into public.marketplace_messages (listing_id, buyer_id, seller_id, sender_id, message) values ('${L1}','${h.U2}','${h.U1}','${h.U2}','Hallo');
          insert into public.map_user_finds (user_id, species_name, lat, lng, is_private) values ('${h.U2}','Ok',47,8,false);
          insert into public.friendships (user_id, friend_id) values ('${h.U2}','${h.U3}'); select 1;`);
        if (privat.out !== '1' || admin.out !== 'true' || normal.out !== '1')
          return { ok: false, warum: 'erlaubter Weg: ' + JSON.stringify({ privat: privat.out || fehler(privat), admin: admin.out || fehler(admin), normal: normal.out || fehler(normal) }) };
        const g = aufbau(h, 'sperre_g');
        try {
          vorbereiten(g);
          migrieren(h, g, ["CREATE TRIGGER trg_gs_sperre BEFORE INSERT OR UPDATE ON public.marketplace_listings\n  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_sperre('user_id');"]);
          if (durch(angriffe(g)).indexOf('inserat') < 0) return { ok: false, warum: 'Gegenprobe blieb gruen' };
        } finally { g.weg(); }
        return { ok: true, info: 'vorher 5/5 durch · nachher 0/5 (Fehler „User is banned") · privater Fund, Admin-Verstecken, normales Konto gehen · Gegenprobe rot' };
      } finally { d.weg(); }
    },
  },
  {
    // v33.59 (Schlusspruefung c2#2): die Sperre hing nur am direkten PATCH. Der Weg, den die App fuer den
    // Status nimmt (rpc/fn_marketplace_set_status, SECURITY DEFINER), laeuft als Eigentuemer — fn_gs_sperre
    // sieht dort current_user = postgres und laesst durch. Ein Gesperrter holte ein archiviertes Inserat zurueck.
    name: 'Sperre · Inserat-Status: ein gesperrtes Konto holt sein archiviertes Inserat ueber fn_marketplace_set_status NICHT zurueck (Antwort ok:false mit Satz) — der normale Eigentuemer schon, der Admin versteckt weiter',
    lauf: async (h) => {
      const LB = '0a000000-0000-4000-8000-0000000000b1';
      const vorbereiten = (d) => d.sql(`insert into public.marketplace_listings (id, user_id, title, status) values ('${LB}','${BAN}','Altes Inserat','archived');
                                        update public.marketplace_listings set status='archived' where id='${L1}';
                                        update public.profiles set role='banned' where id='${BAN}';`);
      const status = (d, id) => d.sql(`select status from public.marketplace_listings where id='${id}';`);
      const angriff = (d) => d.als(BAN, `select public.fn_marketplace_set_status('${LB}','active')::text;`);
      const d = aufbau(h, 'sperre_status');
      try {
        vorbereiten(d);
        const vor = angriff(d);
        if (status(d, LB) !== 'active') return { ok: false, warum: 'VOR der Migration holt der Gesperrte das Inserat nicht zurueck — Fall misst nichts: ' + (vor.out || fehler(vor)) };
        d.sql(`update public.marketplace_listings set status='archived' where id='${LB}';`);
        migrieren(h, d);
        const nach = angriff(d);
        let j = null; try { j = JSON.parse(nach.out); } catch (_) {}
        if (status(d, LB) !== 'archived') return { ok: false, warum: 'nach der Migration: Status ' + status(d, LB) + ' · ' + (nach.out || fehler(nach)) };
        if (!j || j.ok !== false || j.code !== 'banned' || !/gesperrt/i.test(String(j.error || ''))) return { ok: false, warum: 'Antwortform: ' + (nach.out || fehler(nach)) + ' (erwartet ok:false, code banned, ein Satz in error)' };
        const eigen = d.als(h.U1, `select (public.fn_marketplace_set_status('${L1}','active')->>'ok');`);
        const fremd = d.als(h.U2, `select (public.fn_marketplace_set_status('${L1}','sold')->>'error');`);
        const admin = d.als(h.ADMIN, `select public.fn_admin_moderate('listing','${LB}','hide')->>'ok';`);
        if (eigen.out !== 'true' || status(d, L1) !== 'active' || fremd.out !== 'forbidden' || admin.out !== 'true')
          return { ok: false, warum: 'erlaubte Wege: ' + JSON.stringify({ eigen: eigen.out || fehler(eigen), fremd: fremd.out || fehler(fremd), admin: admin.out || fehler(admin) }) };
        const g = aufbau(h, 'sperre_status_g');
        try {
          vorbereiten(g);
          migrieren(h, g, ["  IF public.fn_user_role(v_uid) = 'banned' THEN\n    RETURN jsonb_build_object('ok', false, 'code', 'banned',\n      'error', 'Dein Konto ist gesperrt – Inserate lassen sich nicht mehr ändern.');\n  END IF;\n"]);
          g.als(BAN, `select public.fn_marketplace_set_status('${LB}','active');`);
          if (status(g, LB) !== 'active') return { ok: false, warum: 'Gegenprobe ohne die Sperrzeile blieb gruen' };
        } finally { g.weg(); }
        return { ok: true, info: 'vorher: archiviert → active durch den Gesperrten · nachher: bleibt archived, Antwort ' + nach.out + ' · Eigentuemer setzt active, Fremder forbidden, Admin versteckt · Gegenprobe rot' };
      } finally { d.weg(); }
    },
  },
  {
    name: 'Blockieren · der Blockierte folgt nicht, kommentiert nicht, schreibt keine Nachricht und keine Anfrage an den Blockierenden',
    lauf: async (h) => {
      const angriffe = (d) => ({
        folgen: d.als(h.U2, `insert into public.user_follows (follower_id, followed_id) values ('${h.U2}','${h.U1}');`),
        kommentar: d.als(h.U2, `insert into public.post_comments (post_id, user_id, author_name, content) values ('${P1}','${h.U2}','Bert','Hallo');`),
        chat: d.als(h.U2, `insert into public.marketplace_messages (listing_id, buyer_id, seller_id, sender_id, message) values ('${L1}','${h.U2}','${h.U1}','${h.U2}','Hallo');`),
        anfrage: d.als(h.U2, `insert into public.friendships (user_id, friend_id) values ('${h.U2}','${h.U1}');`),
      });
      const durch = (a) => Object.keys(a).filter(k => a[k].ok);
      const d = aufbau(h, 'block');
      try {
        d.sql(`insert into public.user_blocks (blocker_id, blocked_id) values ('${h.U1}','${h.U2}');`);
        const vor = durch(angriffe(d));
        if (vor.length !== 4) return { ok: false, warum: 'VOR der Migration gingen nur ' + vor.join(',') + ' durch' };
        d.sql(`delete from public.user_follows; delete from public.post_comments; delete from public.marketplace_messages; delete from public.friendships;`);
        migrieren(h, d);
        const a = angriffe(d);
        const nach = durch(a);
        if (nach.length) return { ok: false, warum: 'nach der Migration geht noch durch: ' + nach.join(',') };
        const grund = fehler(a.folgen);
        // erlaubt: ein Dritter tut alles; fn_follow_toggle meldet weiter blocked_by_target; Blockieren raeumt Anfragen
        const dritter = d.als(h.U3, `insert into public.post_comments (post_id, user_id, author_name, content) values ('${P1}','${h.U3}','Cora','Hallo');
          insert into public.marketplace_messages (listing_id, buyer_id, seller_id, sender_id, message) values ('${L1}','${h.U3}','${h.U1}','${h.U3}','Hallo');
          insert into public.friendships (user_id, friend_id) values ('${h.U3}','${h.U1}'); select public.fn_follow_toggle('${h.U1}')->>'action';`);
        const rpc = d.als(h.U2, `select public.fn_follow_toggle('${h.U1}')->>'error';`);
        const block = d.als(h.U1, `select public.fn_block_toggle('${h.U3}')->>'action';`);
        const rest = zeile(d, `select (select count(*) from public.friendships)||'|'||(select count(*) from public.user_follows);`);
        if (dritter.out !== 'followed' || rpc.out !== 'blocked_by_target' || block.out !== 'blocked' || rest !== '0|0')
          return { ok: false, warum: 'erlaubter Weg: ' + JSON.stringify({ dritter: dritter.out || fehler(dritter), rpc: rpc.out || fehler(rpc), block: block.out, rest }) };
        return { ok: true, info: 'vorher 4/4 durch · nachher 0/4 („' + grund + '") · Dritter geht, RPC unveraendert, Blockieren raeumt Folgen UND Anfragen' };
      } finally { d.weg(); }
    },
  },
  {
    name: 'Marktplatz-Chat · niemand schreibt sich als „Verkaeufer" in einen fremden Posteingang, niemand schreibt die Nachricht des Gegenuebers um',
    lauf: async (h) => {
      const angriffe = (d) => {
        // (a) U2 zieht U3 in einen Chat zu U1s Inserat und gibt sich als Verkaeufer aus
        const fremd = d.als(h.U2, `insert into public.marketplace_messages (listing_id, buyer_id, seller_id, sender_id, message) values ('${L1}','${h.U3}','${h.U2}','${h.U2}','Bitte per TWINT');`);
        // (b) U2 als Kaeufer an einen Unbeteiligten (U3) als „Verkaeufer"
        const unbet = d.als(h.U2, `insert into public.marketplace_messages (listing_id, buyer_id, seller_id, sender_id, message) values ('${L1}','${h.U2}','${h.U3}','${h.U2}','Spam');`);
        // (c) der Verkaeufer U1 schreibt die Nachricht des Kaeufers U3 um
        const um = d.als(h.U1, `with u as (update public.marketplace_messages set message='Bereits bezahlt', sender_id='${h.U1}' where sender_id='${h.U3}' returning 1) select count(*) from u;`);
        // (d) U3 rueckdatiert seine Nachricht und markiert sie selbst als gelesen
        const datum = d.als(h.U3, `insert into public.marketplace_messages (listing_id, buyer_id, seller_id, sender_id, message, created_at, read_at) values ('${L1}','${h.U3}','${h.U1}','${h.U3}','Rueckdatiert','2001-01-01','2001-01-01') returning 1;`);
        return { fremd, unbet, um, datum };
      };
      const d = aufbau(h, 'chat');
      try {
        d.sql(`insert into public.marketplace_messages (listing_id, buyer_id, seller_id, sender_id, message) values ('${L1}','${h.U3}','${h.U1}','${h.U3}','Ich zahle 50');`);
        const vor = angriffe(d);
        if (!vor.fremd.ok || !vor.unbet.ok || vor.um.out !== '1' || vor.datum.out !== '1') return { ok: false, warum: 'Angriff VOR der Migration: ' + JSON.stringify({ fremd: fehler(vor.fremd), unbet: fehler(vor.unbet), um: vor.um.out || fehler(vor.um), datum: vor.datum.out || fehler(vor.datum) }) };
        d.sql(`delete from public.marketplace_messages; insert into public.marketplace_messages (listing_id, buyer_id, seller_id, sender_id, message) values ('${L1}','${h.U3}','${h.U1}','${h.U3}','Ich zahle 50');`);
        migrieren(h, d);
        const nach = angriffe(d);
        const text = zeile(d, `select message from public.marketplace_messages where sender_id='${h.U3}';`);
        if (nach.fremd.ok || nach.unbet.ok || nach.um.ok || nach.datum.ok || text !== 'Ich zahle 50') return { ok: false, warum: 'nach der Migration: ' + JSON.stringify({ fremd: nach.fremd.ok, unbet: nach.unbet.ok, um: nach.um.out, datum: nach.datum.ok, text }) };
        // Wer sich fuer welches Inserat interessiert, erfaehrt nur, wer beteiligt ist
        const neugier = d.als(h.U2, `select public.fn_mkt_kaeufer_hat_begonnen('${L1}','${h.U3}')::text;`);
        if (neugier.out !== 'false') return { ok: false, warum: 'Unbeteiligter erfaehrt, dass U3 an L1 geschrieben hat: ' + (neugier.out || fehler(neugier)) };
        // erlaubt: Verkaeufer antwortet, Kaeufer schreibt weiter (auch wenn verkauft), gelesen-Marke per RPC; Verkaeufer beginnt keinen Chat
        const antwort = d.als(h.U1, `insert into public.marketplace_messages (listing_id, buyer_id, seller_id, sender_id, message) values ('${L1}','${h.U3}','${h.U1}','${h.U1}','Gerne') returning 1;`);
        d.sql(`update public.marketplace_listings set status='sold' where id='${L1}';`);
        const weiter = d.als(h.U3, `insert into public.marketplace_messages (listing_id, buyer_id, seller_id, sender_id, message) values ('${L1}','${h.U3}','${h.U1}','${h.U3}','Danke') returning 1;`);
        const gelesen = d.als(h.U1, `select public.fn_mkt_chat_mark_read('${L1}','${h.U3}');`);
        const eigen = d.als(h.U3, `select public.fn_mkt_chat_mark_read('${L1}','${h.U3}');`);
        const beginnt = d.als(h.U1, `insert into public.marketplace_messages (listing_id, buyer_id, seller_id, sender_id, message) values ('${L1}','${h.U2}','${h.U1}','${h.U1}','Kauf doch');`);
        if (antwort.out !== '1' || weiter.out !== '1' || gelesen.out !== '2' || eigen.out !== '1' || beginnt.ok)
          return { ok: false, warum: 'erlaubter Weg: ' + JSON.stringify({ antwort: antwort.out || fehler(antwort), weiter: weiter.out || fehler(weiter), gelesen: gelesen.out || fehler(gelesen), eigen: eigen.out || fehler(eigen), beginnt: beginnt.ok }) };
        const g = aufbau(h, 'chat_g');
        try {
          g.sql(`insert into public.marketplace_messages (listing_id, buyer_id, seller_id, sender_id, message) values ('${L1}','${h.U3}','${h.U1}','${h.U3}','Ich zahle 50');`);
          // beide Riegel heraus: die Bindung an den Eigentuemer UND die Auskunftssperre
          // der Hilfsfunktion (sie haelt den falschen „Verkaeufer" sonst ebenfalls auf)
          migrieren(h, g, ['    AND seller_id = public.fn_mkt_listing_owner(listing_id)\n',
            '(SELECT auth.uid()) IN (p_buyer_id, (SELECT l.user_id FROM public.marketplace_listings l WHERE l.id = p_listing_id))\n     AND ']);
          if (!angriffe(g).fremd.ok) return { ok: false, warum: 'Gegenprobe blieb gruen' };
        } finally { g.weg(); }
        return { ok: true, info: 'vorher: fremder „Verkaeufer" und Unbeteiligter angenommen, Kaeufernachricht umgeschrieben, Nachricht rueckdatiert und selbst als gelesen markiert · nachher alle vier abgewiesen, keine Auskunft an Unbeteiligte (Policy bzw. „' + fehler(nach.um) + '") · Antworten, Weiterschreiben nach Verkauf, Gelesen-RPC gehen · Gegenprobe rot' };
      } finally { d.weg(); }
    },
  },
  {
    name: 'Verkaeufer-Konto · Connect-Status und stripe_account_id sind nur fuer service_role schreibbar',
    lauf: async (h) => {
      const angriffe = (d) => ({
        anlegen: d.als(h.U2, `insert into public.marketplace_sellers (user_id, status, charges_enabled, payouts_enabled) values ('${h.U2}','active',true,true);`),
        konto: d.als(h.U1, `with u as (update public.marketplace_sellers set stripe_account_id='acct_FREMD', charges_enabled=true where user_id='${h.U1}' returning 1) select count(*) from u;`),
        loeschen: d.als(h.U1, `with u as (delete from public.marketplace_sellers where user_id='${h.U1}' returning 1) select count(*) from u;`),
      });
      const d = aufbau(h, 'seller');
      try {
        const saat = `insert into public.marketplace_sellers (user_id, stripe_account_id) values ('${h.U1}','acct_EIGEN') on conflict do nothing;`;
        d.sql(saat);
        const vor = angriffe(d);
        if (!vor.anlegen.ok || vor.konto.out !== '1' || vor.loeschen.out !== '1') return { ok: false, warum: 'Angriff VOR der Migration: ' + JSON.stringify(vor) };
        d.sql(`delete from public.marketplace_sellers; ` + saat);
        migrieren(h, d);
        const nach = angriffe(d);
        if (nach.anlegen.ok || nach.konto.ok || nach.loeschen.ok) return { ok: false, warum: 'nach der Migration: ' + JSON.stringify({ a: nach.anlegen.ok, k: nach.konto.out, l: nach.loeschen.out }) };
        const lesen = d.als(h.U1, `select stripe_account_id from public.marketplace_sellers;`);
        const svc = d.als(null, `update public.marketplace_sellers set charges_enabled=true, status='active' where user_id='${h.U1}' returning 1;`, { rolle: 'service_role' });
        if (lesen.out !== 'acct_EIGEN' || svc.out !== '1') return { ok: false, warum: 'erlaubter Weg: ' + JSON.stringify({ lesen: lesen.out || fehler(lesen), svc: svc.out || fehler(svc) }) };
        return { ok: true, info: 'vorher: aktiv ohne Onboarding, fremde acct_-ID, Loeschen · nachher „' + fehler(nach.konto) + '" · eigene Zeile lesbar, Webhook (service_role) schreibt' };
      } finally { d.weg(); }
    },
  },
  {
    name: 'Meldungen · user_reports nur ueber fn_report (Rate-Limit), nicht direkt',
    lauf: async (h) => {
      const d = aufbau(h, 'reports');
      try {
        const direkt = () => d.als(h.U2, `insert into public.user_reports (reporter_id, target_type, target_ref, reason) select '${h.U2}','listing','x'||g,'Fuelltext' from generate_series(1,30) g; select count(*) from public.user_reports;`, {});
        const vor = direkt();
        const vz = zeile(d, `select count(*) from public.user_reports;`);
        if (!vor.ok || vz !== '30') return { ok: false, warum: 'Angriff VOR der Migration: ' + (fehler(vor) || vz) };
        d.sql(`delete from public.user_reports;`);
        migrieren(h, d);
        const nach = direkt();
        const rpc = d.als(h.U2, `select public.fn_report('listing','${L1}','Betrug')->>'ok';`);
        const z = zeile(d, `select count(*) from public.user_reports;`);
        if (nach.ok || rpc.out !== 'true' || z !== '1') return { ok: false, warum: JSON.stringify({ nach: nach.ok, rpc: rpc.out || fehler(rpc), z }) };
        return { ok: true, info: 'vorher 30 direkte Meldungen · nachher „' + fehler(nach) + '" · fn_report legt an' };
      } finally { d.weg(); }
    },
  },
  {
    name: 'Organisationen · Owner aendert per PATCH weder Grenzen noch Status noch Kennung; Logo/Website wie in fn_org_update',
    lauf: async (h) => {
      const angriff = (d) => ({
        grenze: d.als(h.U1, `update public.organizations set max_members=100000, is_active=true, slug='neu-slug', created_by='${h.U3}' where id='${ORG}';`),
        logo: d.als(h.U1, `update public.organizations set logo_url='javascript:alert(1)' where id='${ORG}';`),
      });
      const d = aufbau(h, 'org');
      try {
        const saat = `insert into public.organizations (id, slug, name, org_type, created_by, is_active) values ('${ORG}','schule-x','Schule X','school','${h.U1}',false) on conflict do nothing;
                      insert into public.org_members (org_id, user_id, role) values ('${ORG}','${h.U1}','owner') on conflict do nothing;`;
        d.sql(saat);
        const vor = angriff(d);
        const vz = zeile(d, `select max_members||'|'||slug||'|'||coalesce(logo_url,'-') from public.organizations;`);
        if (vz !== '100000|neu-slug|javascript:alert(1)') return { ok: false, warum: 'Angriff VOR der Migration: ' + vz + ' ' + fehler(vor.grenze) };
        d.sql(`delete from public.org_members; delete from public.organizations; ` + saat);
        migrieren(h, d);
        const nach = angriff(d);
        const nz = zeile(d, `select max_members||'|'||slug||'|'||is_active::text||'|'||coalesce(logo_url,'-') from public.organizations;`);
        if (nz !== '1000|schule-x|false|-' || nach.logo.ok) return { ok: false, warum: 'nach der Migration: ' + nz + ' logo=' + nach.logo.ok };
        const rpc = d.als(h.U1, `select public.fn_org_update('${ORG}','Schule Y','Bio','https://schule.example/logo.png','https://schule.example','#2d8a2d')->>'ok';`);
        const name = d.als(h.U1, `with u as (update public.organizations set bio='Neu' where id='${ORG}' returning 1) select count(*) from u;`);
        if (rpc.out !== 'true' || name.out !== '1') return { ok: false, warum: 'erlaubter Weg: ' + JSON.stringify({ rpc: rpc.out || fehler(rpc), name: name.out || fehler(name) }) };
        return { ok: true, info: 'vorher: 100000 Plaetze, neue Kennung, javascript:-Logo · nachher gehalten bzw. „' + fehler(nach.logo) + '" · fn_org_update und Bio-PATCH gehen' };
      } finally { d.weg(); }
    },
  },
  {
    name: 'Rezepte/Heilmittel · ein Experte schreibt, aendert und loescht nicht mehr — nur Admins',
    lauf: async (h) => {
      const angriffe = (d) => ({
        ins: d.als(h.U2, `insert into public.recipes (slug, title, emoji) values ('boese','Boese','<img src=x onerror=1>');`),
        upd: d.als(h.U2, `with u as (update public.remedies set dosage='10x taeglich' returning 1) select count(*) from u;`),
        del: d.als(h.U2, `with u as (delete from public.recipes where slug='echt' returning 1) select count(*) from u;`),
      });
      const durch = (a) => Object.keys(a).filter(k => a[k].ok && a[k].out !== '0');
      const saat = `insert into public.recipes (slug, title) values ('echt','Echt') on conflict do nothing; insert into public.remedies (slug, title, dosage) values ('tee','Tee','1 Tasse') on conflict do nothing;`;
      const d = aufbau(h, 'rezepte');
      try {
        d.sql(`update public.profiles set is_expert=true where id='${h.U2}'; ` + saat);
        const vor = durch(angriffe(d));
        if (vor.length !== 3) return { ok: false, warum: 'VOR der Migration nur ' + vor.join(',') };
        d.sql(`delete from public.recipes; delete from public.remedies; ` + saat);
        migrieren(h, d);
        const nach = durch(angriffe(d));
        const admin = d.als(h.ADMIN, `insert into public.recipes (slug, title) values ('admin','Vom Admin') returning 1;`);
        const lesen = d.als(null, `select count(*) from public.recipes;`, { rolle: 'anon' });
        if (nach.length || admin.out !== '1' || lesen.out !== '2') return { ok: false, warum: JSON.stringify({ nach, admin: admin.out || fehler(admin), lesen: lesen.out }) };
        return { ok: true, info: 'vorher 3/3 (Anlegen mit Skript-Emoji, Dosierung aendern, Loeschen) · nachher 0/3 · Admin legt an, anon liest' };
      } finally { d.weg(); }
    },
  },
  {
    name: 'Bild-Adressen · neue Bilder aus Nutzerhand nur aus dem eigenen Speicher; alte Werte blockieren keine anderen Updates',
    lauf: async (h) => {
      const BOESE = 'https://tracker.example/p.png';
      const angriffe = (d) => ({
        beitrag: d.als(h.U1, `insert into public.social_posts (user_id, author_name, content, photo_url) values ('${h.U1}','Anna','x','${BOESE}');`),
        fund: d.als(h.U1, `insert into public.map_user_finds (user_id, species_name, lat, lng, is_private, photo_url) values ('${h.U1}','x',47,8,false,'${BOESE}');`),
        inserat: d.als(h.U1, `update public.marketplace_listings set photo_urls=array['${SPEICHER}marketplace-photos/a.jpg','${BOESE}'] where id='${L1}';`),
        avatar: d.als(h.U1, `update public.profiles set avatar_url='${BOESE}' where id='${h.U1}';`),
        quote: d.als(h.U1, `insert into public.social_posts (user_id, author_name, content, photo_url) values ('${h.U1}','Anna','x','${SPEICHER}post-images/a.jpg" onerror="x');`),
      });
      const durch = (a) => Object.keys(a).filter(k => a[k].ok);
      const d = aufbau(h, 'bild');
      try {
        const vor = durch(angriffe(d));
        if (vor.length !== 5) return { ok: false, warum: 'VOR der Migration nur ' + vor.join(',') };
        // ein ALTER fremder Avatar bleibt stehen — und darf andere Updates nicht blockieren
        d.sql(`delete from public.social_posts where photo_url is not null; delete from public.map_user_finds; update public.marketplace_listings set photo_urls=null;
               update public.profiles set avatar_url=null where id='${h.U1}'; update public.profiles set avatar_url='https://alt.example/a.png' where id='${h.U3}';`);
        migrieren(h, d);
        const nach = durch(angriffe(d));
        if (nach.length) return { ok: false, warum: 'nach der Migration geht noch durch: ' + nach.join(',') };
        const gut = d.als(h.U1, `insert into public.social_posts (user_id, author_name, content, photo_url) values ('${h.U1}','Anna','x','${SPEICHER}post-images/${h.U1}/1.jpg');
          insert into public.map_user_finds (user_id, species_name, lat, lng, is_private, photo_url) values ('${h.U1}','x',47,8,false,null);
          update public.marketplace_listings set photo_urls=array['${SPEICHER}marketplace-photos/a.jpg'], photo_url='' where id='${L1}'; select 1;`);
        const alt = d.als(h.U3, `with u as (update public.profiles set display_name='Cora B.' where id='${h.U3}' returning 1) select count(*) from u;`);
        const svc = d.als(null, `update public.marketplace_listings set photo_url='https://anderes-projekt.supabase.co/x.jpg' where id='${L1}' returning 1;`, { rolle: 'service_role' });
        if (gut.out !== '1' || alt.out !== '1' || svc.out !== '1') return { ok: false, warum: 'erlaubter Weg: ' + JSON.stringify({ gut: gut.out || fehler(gut), alt: alt.out || fehler(alt), svc: svc.out || fehler(svc) }) };
        const g = aufbau(h, 'bild_g');
        try {
          migrieren(h, g, ["CREATE TRIGGER trg_gs_bild BEFORE INSERT OR UPDATE ON public.social_posts\n  FOR EACH ROW EXECUTE FUNCTION public.fn_gs_bild_pruefen('photo_url');"]);
          if (!angriffe(g).beitrag.ok) return { ok: false, warum: 'Gegenprobe blieb gruen' };
        } finally { g.weg(); }
        return { ok: true, info: 'vorher 5/5 fremde Hosts bzw. Anfuehrungszeichen angenommen · nachher 0/5 („' + fehler(angriffe(d).fund) + '") · Speicher-URL, NULL, leer gehen; alter fremder Avatar blockiert kein Namens-Update · Gegenprobe rot' };
      } finally { d.weg(); }
    },
  },
  {
    // v33.59: der Waechter hielt author_name beim UPDATE, beim INSERT war er frei —
    // ein Beitrag als „GreenScan Team", mit Zeilenumbruch, Bidi-Zeichen, 500 Zeichen.
    name: 'Anzeigename · ein Beitrag/Kommentar/Profil gibt sich NICHT als Team aus (Ersatzzeichen, Steuerzeichen, Laenge) — gewaehlte Namen bleiben, Admin darf',
    lauf: async (h) => {
      // Signup-Weg wie live (fn_handle_new_user, Wortlaut 10.11.2026) — sonst kaeme ein
      // reservierter Name ueber raw_user_meta_data am Profil-Waechter vorbei.
      const SIGNUP = `
        CREATE OR REPLACE FUNCTION public.fn_handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $function$
        begin
          insert into public.profiles (id, email, display_name, avatar_emoji)
          values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), '🌿')
          on conflict (id) do update set email = coalesce(public.profiles.email, excluded.email);
          return new;
        end; $function$;
        CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();`;
      const NEU1 = '0d000000-0000-4000-8000-000000000001', NEU2 = '0d000000-0000-4000-8000-000000000002';
      // [Inhalt, geschickter Name, erwarteter Name nach der Migration]
      const BOESE = [
        ['b01', `'GreenScan Team'`, 'Bert'],
        ['b02', `'G r e e n - S c a n'`, 'Bert'],
        ['b03', `'Gr33nSc4n'`, 'Bert'],
        ['b04', `E'Gree\\u200BnScan'`, 'Bert'],                 // Null-Breite
        ['b05', `E'\\u0410dmin'`, 'Bert'],                       // kyrillisches А
        ['b06', `'ADM1N'`, 'Bert'],
        ['b07', `'Moderator'`, 'Bert'],
        ['b08', `'Support-Team'`, 'Bert'],
        ['b09', `'Offiziell'`, 'Bert'],
        ['b10', `'  '`, 'Bert'],                                 // leer → Profil
        ['b11', `E'Anna\\nBerta\\u202E\\t x'`, 'Anna Berta x'],  // Umbruch, Bidi, Tab
        ['b12', `repeat('Langer Name ', 40)`, 'Langer Name Langer Name Langer Name Lang'],
        // Gegenpruefung: Vollbreite, mathematisch fett, Kapitaelchen, drei Listenwoerter, Ziffer als Zierrat
        ['b13', `'ＧｒｅｅｎＳｃａｎ Ｔｅａｍ'`, 'Bert'],
        ['b14', `'𝐆𝐫𝐞𝐞𝐧𝐒𝐜𝐚𝐧'`, 'Bert'],
        ['b15', `'ɢʀᴇᴇɴꜱᴄᴀɴ'`, 'Bert'],
        ['b16', `'Offizieller Support'`, 'Bert'],
        ['b17', `'GS Team'`, 'Bert'],
        ['b18', `'Admin1'`, 'Bert'],
      ];
      const GUT = [
        ['g1', `'Greta'`], ['g2', `'Teamgeist Thun'`], ['g3', `'Administratorin Anna'`],
        ['g4', `'Zoë d''Alpi 🌻'`], ['g5', `'Systemgarten Süd'`], ['g6', `'Das Gartenteam'`], ['g7', `'Max Admin'`], ['g8', `'Anna 🧑‍🌾'`],
      ];
      const angriff = (d) => {
        const r = [];
        for (const [c, n] of BOESE.concat(GUT))
          r.push(d.als(h.U2, `insert into public.social_posts (user_id, author_name, author_avatar, content) values ('${h.U2}', ${n}, '🌿', '${c}');`));
        r.push(d.als(h.U2, `insert into public.post_comments (post_id, user_id, author_name, author_avatar, content) values ('${P1}','${h.U2}','Moderator','<img src=x onerror=alert(1)>','k1');`));
        r.push(d.als(h.U2, `insert into public.post_comments (post_id, user_id, author_name, author_avatar, content) values ('${P1}','${h.U2}','Bert','👨‍👩‍👧','k2');`));
        r.push(d.als(h.U2, `insert into public.social_posts (user_id, author_name, author_avatar, content) values ('${h.U2}','Bert','AAAAAAAAAAAAAAAAAAAAAAAA','a1');`));
        r.push(d.als(h.U2, `insert into public.social_posts (user_id, author_name, author_avatar, content) values ('${h.U2}','Bert','🌻','a2');`));
        r.push(d.als(h.U2, `insert into public.social_posts (user_id, author_name, author_avatar, content) values ('${h.U2}','Bert','АДМИН','a3');`));
        r.push(d.als(h.U3, `update public.profiles set display_name='Moderator' where id='${h.U3}';`));
        r.push(d.als(h.U3, `insert into public.social_posts (user_id, author_name, content) values ('${h.U3}','GreenScan','c1');`));
        r.push(d.als(h.ADMIN, `insert into public.social_posts (user_id, author_name, content) values ('${h.ADMIN}','GreenScan Team','x1');`));
        r.push(d.als(h.ADMIN, `update public.profiles set display_name='GreenScan Support' where id='${h.ADMIN}';`));
        r.push(d.versuch(`insert into auth.users (id, email, raw_user_meta_data) values ('${NEU1}','x@example.invalid','{"display_name":"GreenScan Team"}'),('${NEU2}','admin@example.invalid','{}');`));
        const fehl = r.filter(x => !x.ok).map(fehler);
        const posts = zeile(d, `select string_agg(content||'='||author_name, '|' order by content) from public.social_posts where content ~ '^[bg][0-9]';`);
        const rest = zeile(d, `select string_agg(content||'='||author_name||'='||coalesce(author_avatar,'-'), '|' order by content) from (
            select content, author_name, author_avatar from public.social_posts where content ~ '^[acx][0-9]'
            union all select content, author_name, author_avatar from public.post_comments where content ~ '^k[0-9]') t;`);
        const prof = zeile(d, `select string_agg(coalesce(display_name,'-'), '|' order by id) from public.profiles where id in ('${h.U3}','${h.ADMIN}','${NEU1}','${NEU2}');`);
        return { fehl, posts, rest, prof };
      };
      const sollPosts = BOESE.map(([c, , s]) => c + '=' + s).concat(GUT.map(([c, n]) => c + '=' + (n === `'Zoë d''Alpi 🌻'` ? "Zoë d'Alpi 🌻" : n.slice(1, -1)))).join('|');
      const sollRest = 'a1=Bert=🌿|a2=Bert=🌻|a3=Bert=🌿|c1=Cora=🌿|k1=Bert=🌿|k2=Bert=👨‍👩‍👧|x1=GreenScan Team=🌿';
      const d = aufbau(h, 'name');
      try {
        d.sql(SIGNUP);
        const vor = angriff(d);
        if (vor.fehl.length) return { ok: false, warum: 'Aufbau VOR der Migration: ' + vor.fehl.join(' / ') };
        if (vor.posts.indexOf('b01=GreenScan Team') < 0 || vor.rest.indexOf('k1=Moderator=<img') < 0 || vor.prof.indexOf('Moderator') < 0 || vor.prof.indexOf('GreenScan Team') < 0)
          return { ok: false, warum: 'Angriff gelingt VOR der Migration nicht — Fall misst nichts: ' + JSON.stringify(vor) };
        d.sql(`delete from public.post_comments; delete from public.social_posts where id <> '${P1}'; delete from public.profiles where id in ('${NEU1}','${NEU2}'); delete from auth.users where id in ('${NEU1}','${NEU2}');
               update public.profiles set display_name='Cora' where id='${h.U3}'; update public.profiles set display_name='Admin' where id='${h.ADMIN}';`);
        migrieren(h, d);
        const nach = angriff(d);
        const name = { [h.U3]: 'Cora', [h.ADMIN]: 'GreenScan Support', [NEU1]: 'Naturfreund', [NEU2]: 'Naturfreund' };
        const sollProf = [h.U3, h.ADMIN, NEU1, NEU2].sort().map(i => name[i]).join('|');   // wie „order by id"
        if (nach.fehl.length || nach.posts !== sollPosts || nach.rest !== sollRest || nach.prof !== sollProf)
          return { ok: false, warum: 'nach der Migration: ' + JSON.stringify({ fehl: nach.fehl, posts: nach.posts === sollPosts ? 'ok' : nach.posts, rest: nach.rest, prof: nach.prof, sollProf }) };
        // ein Profilname, der schon reserviert IST (Altbestand), ist kein Rueckfall
        d.sql(`update public.profiles set display_name='GreenScan' where id='${h.U1}';`);
        const alt = d.als(h.U1, `insert into public.social_posts (user_id, author_name, content) values ('${h.U1}','Team','z1') returning author_name;`);
        if (alt.out !== 'Naturfreund') return { ok: false, warum: 'Altbestand im Profil: ' + (alt.out || fehler(alt)) };
        // der Weg der App (sbSaveProfile: POST mit merge-duplicates = Upsert) — reserviert bleibt beim alten, gewaehlt geht durch
        const ups = (n) => d.als(h.U2, `insert into public.profiles (id, display_name) values ('${h.U2}', '${n}') on conflict (id) do update set display_name = excluded.display_name returning display_name;`);
        const u1 = ups('GreenScan Team'), u2 = ups("Bertha O''Neill");
        if (u1.out !== 'Bert' || u2.out !== "Bertha O'Neill") return { ok: false, warum: 'Upsert der App: ' + JSON.stringify({ u1: u1.out || fehler(u1), u2: u2.out || fehler(u2) }) };
        // Gegenprobe: ohne die Reservierung im Beitrags-Waechter geht „GreenScan Team" wieder durch
        const g = aufbau(h, 'name_g');
        try {
          migrieren(h, g, ['      NEW.author_name   := public.fn_gs_name_oeffentlich(NEW.author_name, NEW.user_id, v_frei);\n']);
          const gg = g.als(h.U2, `insert into public.social_posts (user_id, author_name, content) values ('${h.U2}','GreenScan Team','b01') returning author_name;`);
          if (gg.out !== 'GreenScan Team') return { ok: false, warum: 'Gegenprobe blieb gruen: ' + (gg.out || fehler(gg)) };
        } finally { g.weg(); }
        return { ok: true, info: 'vorher: „GreenScan Team", „Moderator", <img>-Avatar, Signup „GreenScan Team" angenommen · nachher ' + BOESE.length + '/' + BOESE.length + ' Beitragsnamen ersetzt bzw. gesaeubert (Ersatzzeichen 0/1/3/4, Null-Breite, Kyrillisch, Steuerzeichen, 40 Zeichen), Kommentar und Profil-PATCH ebenso, Signup → Naturfreund · ' + GUT.length + ' gewaehlte Namen unveraendert, Emoji-Avatare bleiben, Admin darf · Gegenprobe rot' };
      } finally { d.weg(); }
    },
  },
  {
    name: 'Abo-Altlast · gs_abo_can_use und profiles.abo_* (nicht nachstellbar — die Spalten gibt es live nicht; EXECUTE trotzdem zu)',
    lauf: async (h) => {
      const d = aufbau(h, 'abo');
      try {
        const patch = d.als(h.U2, `update public.profiles set abo_status='active' where id='${h.U2}';`);
        const vor = d.als(h.U2, `select public.gs_abo_can_use('${h.U1}','scan');`);
        if (patch.ok || !/abo_status/.test(fehler(patch)) || vor.ok || !/abo_status/.test(fehler(vor)))
          return { ok: false, warum: 'Erwartet: Spalte fehlt (wie live) — ' + JSON.stringify({ patch: fehler(patch), vor: fehler(vor) }) };
        migrieren(h, d);
        const nach = d.als(h.U2, `select public.gs_abo_can_use('${h.U1}','scan');`);
        if (nach.ok || !/permission denied/.test(fehler(nach))) return { ok: false, warum: 'nach der Migration: ' + fehler(nach) };
        return { ok: true, info: 'vorher: PATCH und Aufruf scheitern an der fehlenden Spalte (kein Angriff moeglich) · nachher: „' + fehler(nach) + '"' };
      } finally { d.weg(); }
    },
  },
];
