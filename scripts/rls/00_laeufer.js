// Der Laeufer selbst: laeuft eine Policy im nachgebauten Geruest so, wie man es von Supabase kennt?
'use strict';
module.exports = [
  {
    name: 'Laeufer · Grundgeruest: auth.uid() folgt dem Nutzer, RLS trennt zwei Konten, eine UPDATE-Abweisung liefert 0 Zeilen ohne Fehler, anon sieht nichts',
    lauf: async (h) => {
      const d = h.neu('laeufer');
      try {
        d.sql(`create table public.notiz (id serial primary key, user_id uuid not null, text text);
               alter table public.notiz enable row level security;
               create policy notiz_own on public.notiz for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);`);
        const a = d.als(h.U1, `insert into public.notiz (user_id, text) values ('${h.U1}', 'meins') returning id;`);
        if (!a.ok || a.out !== '1') return { ok: false, warum: 'eigener INSERT scheitert: ' + (a.err || a.out) };
        const fremd = d.als(h.U2, `insert into public.notiz (user_id, text) values ('${h.U1}', 'untergeschoben');`);
        if (fremd.ok) return { ok: false, warum: 'INSERT mit fremder user_id ging durch' };
        const liest = d.als(h.U2, `select count(*) from public.notiz;`);
        const upd = d.als(h.U2, `with u as (update public.notiz set text = 'x' where id = 1 returning 1) select count(*) from u;`);
        const anon = d.als(null, `select count(*) from public.notiz;`);
        const uid = d.als(h.U1, `select auth.uid(), auth.role();`);
        if (liest.out !== '0' || upd.out !== '0' || !upd.ok) return { ok: false, warum: 'RLS trennt nicht wie erwartet: ' + JSON.stringify({ liest, upd }) };
        if (anon.out !== '0') return { ok: false, warum: 'anon sieht Zeilen: ' + anon.out };
        if (uid.out !== h.U1 + '\tauthenticated') return { ok: false, warum: 'auth.uid()/auth.role(): ' + uid.out };
        return { ok: true, info: 'eigener INSERT ja · fremde user_id abgewiesen · fremdes UPDATE: 0 Zeilen, kein Fehler · anon 0 · auth.uid() stimmt' };
      } finally { d.weg(); }
    },
  },
];
