import ch.greenscan.app.Export;
import java.io.File;
import java.io.FileOutputStream;
import java.net.URLEncoder;
import java.nio.file.Files;
import java.util.*;

/** Faehrt die ECHTE Export-Klasse gegen Grenzfaelle. Ausgabe: Schluessel \t Wert je Zeile. */
public class ExportFahrer {
  static StringBuilder out = new StringBuilder();
  static void z(String k, Object v) {
    String s = v == null ? "NULL" : String.valueOf(v);
    StringBuilder esc = new StringBuilder();
    for (int i = 0; i < s.length(); i++) {
      char c = s.charAt(i);
      if (c < 0x20 || c >= 0x7f) esc.append(String.format("\\u%04x", (int) c)); else esc.append(c);
    }
    out.append(k).append('\t').append(esc).append('\n');
  }
  static String b64(byte[] b) { return Base64.getUrlEncoder().withoutPadding().encodeToString(b); }
  static String enc(String s) throws Exception { return URLEncoder.encode(s, "UTF-8").replace("+", "%20"); }
  static String q(String... kv) throws Exception {
    StringBuilder b = new StringBuilder();
    for (int i = 0; i < kv.length; i += 2) { if (b.length() > 0) b.append('&'); b.append(enc(kv[i])).append('=').append(enc(kv[i + 1])); }
    return b.toString();
  }
  static Map<String, String> kopf(String... kv) {
    Map<String, String> m = new LinkedHashMap<String, String>();
    for (int i = 0; i < kv.length; i += 2) m.put(kv[i], kv[i + 1]);
    return m;
  }
  static String a(Export.Antwort x) { return x.status + " " + (x.ok ? "ok" : x.grund); }
  static String kAus(Export.Antwort x) { return x.k; }

  public static void main(String[] args) throws Exception {
    File dir = new File(args[0]);

    // ---- N: Dateinamen
    String lang = ""; for (int i = 0; i < 200; i++) lang += "x";
    String[][] namen = {
      {"GreenScan-Backup-2026-10-09.json", "application/json"},
      {"../../etc/passwd", "text/plain"},
      {"a/b\\c.csv", "text/csv"},
      {".versteckt.json", "application/json"},
      {"", "image/png"},
      {null, "image/png"},
      {"bericht.html", "text/csv"},
      {"plan.jpeg", "image/jpeg"},
      {"Pflanzen Liste.csv", "text/csv"},
      {"‮gpj.exe", "image/jpeg"},
      {lang, "text/plain"},
      {"...", "text/plain"},
      {"a\u0000b.txt", "text/plain"},
      {"greenscan-plan-2026-10-09.HTML", "text/html"},
    };
    for (int i = 0; i < namen.length; i++) z("N:" + i, Export.nameSaeubern(namen[i][0], namen[i][1]));

    // ---- T: Typen
    String[][] typen = {
      {"text/csv;charset=utf-8;", "speichern"}, {"Application/GPX+XML", "speichern"}, {"text/html", "drucken"},
      {"text/csv", "drucken"}, {"application/octet-stream", "speichern"}, {"image/svg+xml", "speichern"},
      {"text/csv", "loeschen"}, {null, "speichern"}, {"image/png", "speichern"}, {"application/json", "speichern"},
    };
    for (int i = 0; i < typen.length; i++) z("T:" + i, Export.typFuer(typen[i][0], typen[i][1]));

    // ---- B: base64url
    Random r = new Random(7);
    int rundOk = 0;
    for (int n = 0; n < 300; n++) {
      byte[] b = new byte[r.nextInt(70)]; r.nextBytes(b);
      byte[] z2 = Export.base64urlDekodieren(b64(b));
      if (z2 != null && Arrays.equals(b, z2)) rundOk++;
    }
    z("B:rund", rundOk);
    String[] b64fall = { "+/+/", "ab+c", "ab/c", "ab c", "A", "AA", "AB", "AAA=", "AA==", "AA===", "AAAA", "QUJD", "" };
    for (int i = 0; i < b64fall.length; i++) {
      byte[] d = Export.base64urlDekodieren(b64fall[i]);
      z("B:" + b64fall[i], d == null ? "NULL" : String.valueOf(d.length));
    }

    // ---- U: UTF-8 und Abfrage
    z("U:ue", Export.utf8Dekodieren("%C3%BC"));
    z("U:ff", Export.utf8Dekodieren("%FF"));
    z("U:prozent", Export.utf8Dekodieren("100%25%20Bio"));
    z("U:roh", Export.utf8Dekodieren("ü"));
    z("U:plus", Export.utf8Dekodieren("a+b"));
    z("U:doppelt", Export.abfrage("a=1&a=2") == null ? "NULL" : "map");
    z("U:kaputt", Export.abfrage("x=%ZZ") == null ? "NULL" : "map");

    // ---- S: Sammler, der gute Weg ueber mehrere Teile
    Export.Sammler s = new Export.Sammler(new File(dir, "s1"));
    byte[] daten = new byte[700000];
    for (int i = 0; i < daten.length; i++) daten[i] = (byte) (i * 31 + (i >> 8));
    int TEIL = 192 * 1024;
    int teile = (daten.length + TEIL - 1) / TEIL;
    Export.Antwort st = s.start("abcdefgh12345678", "speichern", "x.json", "application/json", daten.length, teile, 1000);
    z("S:start", a(st));
    z("S:kform", st.k != null && st.k.matches("[0-9a-f]{32}"));
    z("S:json_start", st.json());
    String k = st.k;
    boolean alleOk = true;
    for (int i = 0; i < teile; i++) {
      byte[] stueck = Arrays.copyOfRange(daten, i * TEIL, Math.min(daten.length, (i + 1) * TEIL));
      Export.Antwort t = s.teil("abcdefgh12345678", k, i, b64(stueck), 1000 + i);
      if (!t.ok) { alleOk = false; z("S:teilfehler" + i, a(t)); }
    }
    z("S:teile_ok", alleOk);
    Export.Antwort f = s.fertig("abcdefgh12345678", k, 2000);
    z("S:fertig", a(f));
    z("S:zustand_nach_fertig", s.zustand());
    z("S:datei_name", f.datei == null ? "NULL" : f.datei.name);
    z("S:datei_typ", f.datei == null ? "NULL" : f.datei.typ);
    z("S:gleich", f.datei != null && Arrays.equals(Files.readAllBytes(f.datei.spool.toPath()), daten));
    z("S:fertig2", a(s.fertig("abcdefgh12345678", k, 2001)));
    z("S:teil_nach_fertig", a(s.teil("abcdefgh12345678", k, 0, b64(new byte[]{1}), 2001)));
    File spool = f.datei == null ? null : f.datei.spool;
    z("S:abschliessen", s.abschliessen("abcdefgh12345678"));
    z("S:spool_weg", spool != null && !spool.exists());
    z("S:zustand_frei", s.zustand());

    // ---- F: Fehlerfaelle
    Export.Sammler e = new Export.Sammler(new File(dir, "s2"));
    Export.Antwort e1 = e.start("fehler0000000001", "speichern", "a.txt", "text/plain", 6, 2, 0);
    z("F:falscher_k", a(e.teil("fehler0000000001", "0123456789abcdef0123456789abcdef", 0, b64("abc".getBytes("UTF-8")), 1)));
    z("F:ohne_k", a(e.teil("fehler0000000001", null, 0, b64("abc".getBytes("UTF-8")), 1)));
    z("F:reihenfolge", a(e.teil("fehler0000000001", e1.k, 1, b64("abc".getBytes("UTF-8")), 1)));
    z("F:zustand_bleibt", e.zustand());
    z("F:teil0", a(e.teil("fehler0000000001", e1.k, 0, b64("abc".getBytes("UTF-8")), 1)));
    z("F:doppelt", a(e.teil("fehler0000000001", e1.k, 0, b64("abc".getBytes("UTF-8")), 1)));
    z("F:fehlt", a(e.fertig("fehler0000000001", e1.k, 2)));
    z("F:fehlt_frei", e.zustand());
    z("F:fehlt_spool", new File(new File(dir, "s2"), "fehler0000000001.part").exists());
    Export.Antwort e2 = e.start("fehler0000000002", "speichern", "a.txt", "text/plain", 3, 1, 10);
    z("F:zu_lang", a(e.teil("fehler0000000002", e2.k, 0, b64("abcd".getBytes("UTF-8")), 11)));
    z("F:zu_lang_frei", e.zustand());
    Export.Antwort e3 = e.start("fehler0000000012", "speichern", "a.txt", "text/plain", 3, 1, 12);
    z("F:kaputt_kodiert", a(e.teil("fehler0000000012", e3.k, 0, "a+b/", 13)));
    z("F:kaputt_bleibt", e.zustand());
    e.abschliessen("fehler0000000012");
    z("F:zu_gross_speichern", a(e.start("fehler0000000003", "speichern", "a.json", "application/json", Export.MAX_BYTES + 1, 256, 20)));
    z("F:zu_gross_drucken", a(e.start("fehler0000000004", "drucken", "a.html", "text/html", Export.MAX_DRUCK_BYTES + 1, 256, 20)));
    z("F:drucken_max_ok", a(new Export.Sammler(new File(dir, "s2b")).start("fehler0000000005", "drucken", "a.html", "text/html", Export.MAX_DRUCK_BYTES, 64, 20)));
    z("F:teile_null", a(e.start("fehler0000000006", "speichern", "a.txt", "text/plain", 10, 0, 20)));
    z("F:teile_zuviel", a(e.start("fehler0000000007", "speichern", "a.txt", "text/plain", 10, 257, 20)));
    z("F:teile_tragen_nicht", a(e.start("fehler0000000008", "speichern", "a.txt", "text/plain", 3L * Export.MAX_TEIL_BYTES, 2, 20)));
    z("F:id", a(e.start("ABC", "speichern", "a.txt", "text/plain", 10, 1, 20)));
    z("F:ziel", a(e.start("fehler0000000009", "teilen", "a.txt", "text/plain", 10, 1, 20)));
    z("F:typ", a(e.start("fehler0000000010", "speichern", "a.svg", "image/svg+xml", 10, 1, 20)));
    z("F:drucken_csv", a(e.start("fehler0000000011", "drucken", "a.csv", "text/csv", 10, 1, 20)));

    // ---- V: Verdraengung und Uhr
    Export.Sammler v = new Export.Sammler(new File(dir, "s3"));
    Export.Antwort va = v.start("verdraengt000001", "speichern", "a.txt", "text/plain", 4, 1, 0);
    z("V:b_bei_60000", a(v.start("verdraengt000002", "speichern", "b.txt", "text/plain", 4, 1, Export.SAMMELN_VERWAIST_MS)));
    Export.Antwort vb = v.start("verdraengt000002", "speichern", "b.txt", "text/plain", 4, 1, Export.SAMMELN_VERWAIST_MS + 1);
    z("V:b_bei_60001", a(vb));
    z("V:a_spool_weg", !new File(new File(dir, "s3"), "verdraengt000001.part").exists());
    z("V:a_teil", a(v.teil("verdraengt000001", va.k, 0, b64("abcd".getBytes("UTF-8")), 60002)));
    z("V:a_abschliessen", v.abschliessen("verdraengt000001"));
    z("V:b_lebt", v.zustand() + "/" + v.offeneId());
    v.teil("verdraengt000002", vb.k, 0, b64("abcd".getBytes("UTF-8")), 70000);
    z("V:b_fertig", a(v.fertig("verdraengt000002", vb.k, 70000)));
    z("V:c_wartet_60001", a(v.start("verdraengt000003", "speichern", "c.txt", "text/plain", 4, 1, 70000 + Export.SAMMELN_VERWAIST_MS + 1)));
    z("V:c_wartet_600000", a(v.start("verdraengt000003", "speichern", "c.txt", "text/plain", 4, 1, 70000 + Export.DIALOG_VERWAIST_MS)));
    z("V:c_wartet_600001", a(v.start("verdraengt000003", "speichern", "c.txt", "text/plain", 4, 1, 70000 + Export.DIALOG_VERWAIST_MS + 1)));
    Export.Sammler u = new Export.Sammler(new File(dir, "s4"));
    u.start("uhrzurueck000001", "speichern", "a.txt", "text/plain", 4, 1, 1000);
    z("V:uhr_zurueck_sammeln", a(u.start("uhrzurueck000002", "speichern", "a.txt", "text/plain", 4, 1, 500)));
    Export.Antwort uw = u.start("uhrzurueck000003", "speichern", "a.txt", "text/plain", 4, 1, 2000);
    u.teil("uhrzurueck000003", uw.k, 0, b64("abcd".getBytes("UTF-8")), 2000);
    u.fertig("uhrzurueck000003", uw.k, 2000);
    z("V:uhr_zurueck_wartet", a(u.start("uhrzurueck000004", "speichern", "a.txt", "text/plain", 4, 1, 1500)));

    // ---- A: Aufraeumen
    File d2 = new File(dir, "aufr"); d2.mkdirs();
    long jetzt = System.currentTimeMillis();
    String[][] dateien = { {"jung0000aaaa.part", "1000"}, {"alt00000aaaa.part", "120000"}, {"keep0000aaaa.part", "120000"}, {"andere.txt", "1000"} };
    for (String[] dd : dateien) {
      File ff = new File(d2, dd[0]); new FileOutputStream(ff).close();
      ff.setLastModified(jetzt - Long.parseLong(dd[1]));
    }
    z("A:geloescht", Export.aufraeumen(d2, "keep0000aaaa", jetzt));
    String[] uebrig = d2.list(); Arrays.sort(uebrig);
    z("A:uebrig", String.join(",", uebrig));

    // ---- W: die Weiche (beantworte)
    Export.Sammler w = new Export.Sammler(new File(dir, "s5"));
    String pS = Export.WURZEL + "start";
    String qS = q("id", "weiche0000000001", "ziel", "speichern", "name", "probe.txt", "typ", "text/plain", "bytes", "3", "teile", "1");
    Map<String, String> gut = kopf("X-GS-Huelle", "datei");
    z("W:haupt", a(Export.beantworte(w, "GET", true, pS, qS, gut, 1)));
    z("W:ohne_kopf", a(Export.beantworte(w, "GET", false, pS, qS, kopf(), 1)));
    z("W:kopf_gross", a(Export.beantworte(w, "GET", false, pS, qS, kopf("X-GS-Huelle", "Datei"), 1)));
    z("W:referer_fremd", a(Export.beantworte(w, "GET", false, pS, qS, kopf("X-GS-Huelle", "datei", "Referer", "https://green-scan.ch.evil.example/"), 1)));
    z("W:origin_null", a(Export.beantworte(w, "GET", false, pS, qS, kopf("X-GS-Huelle", "datei", "Origin", "null"), 1)));
    z("W:post", a(Export.beantworte(w, "POST", false, pS, qS, gut, 1)));
    z("W:options", a(Export.beantworte(w, "OPTIONS", false, pS, qS, gut, 1)));
    z("W:pfad", a(Export.beantworte(w, "GET", false, Export.WURZEL + "gibtsnicht", qS, gut, 1)));
    z("W:null_kopf", a(Export.beantworte(w, "GET", false, pS, qS, null, 1)));
    z("W:null_sammler", a(Export.beantworte(null, "GET", false, pS, qS, gut, 1)));
    Export.Antwort w1 = Export.beantworte(w, "GET", false, pS, qS, kopf("x-gs-huelle", "datei", "Referer", "https://green-scan.ch/?source=app", "Origin", "https://green-scan.ch"), 1);
    z("W:gut", a(w1));
    Export.Antwort w2 = Export.beantworte(w, "GET", false, Export.WURZEL + "teil", q("id", "weiche0000000001", "k", w1.k == null ? "" : w1.k, "i", "0", "d", b64("abc".getBytes("UTF-8"))), kopf("X-GS-Huelle", "datei", "Referer", "https://green-scan.ch"), 2);
    z("W:teil", a(w2));
    Export.Antwort w3 = Export.beantworte(w, "GET", false, Export.WURZEL + "fertig", q("id", "weiche0000000001", "k", w1.k == null ? "" : w1.k), gut, 3);
    z("W:fertig", a(w3) + (w3.datei == null ? " ohne Datei" : " mit Datei " + w3.datei.name));
    // Unsinn darf NIE werfen
    Random rz = new Random(11);
    String alphabet = "abc%&=?/\\ü\u0000+-_.0123456789ZZ%C3%FF";
    int geworfen = 0, statusFremd = 0;
    Export.Sammler wz = new Export.Sammler(new File(dir, "s6"));
    for (int n = 0; n < 3000; n++) {
      StringBuilder pz = new StringBuilder(Export.WURZEL), qz = new StringBuilder();
      String[] schritte = {"start", "teil", "fertig", "", "x"};
      pz.append(schritte[rz.nextInt(schritte.length)]);
      int len = rz.nextInt(80);
      for (int i = 0; i < len; i++) qz.append(alphabet.charAt(rz.nextInt(alphabet.length())));
      try {
        Export.Antwort x = Export.beantworte(wz, rz.nextBoolean() ? "GET" : "PUT", rz.nextInt(10) == 0, pz.toString(), rz.nextInt(8) == 0 ? null : qz.toString(), rz.nextInt(5) == 0 ? null : gut, n);
        if (x.status != 200 && x.status != 403 && x.status != 404 && x.status != 405) statusFremd++;
      } catch (Throwable t) { geworfen++; }
    }
    z("W:unsinn_geworfen", geworfen);
    z("W:unsinn_status_fremd", statusFremd);

    // ---- R: der Rueckruf
    z("R:gut", Export.rueckruf("abcdefgh12345678", "gespeichert"));
    z("R:id_boese", Export.rueckruf("x');alert(1);//", "gespeichert"));
    z("R:zustand_boese", Export.rueckruf("abcdefgh12345678", "gespeichert');alert(1);//"));
    z("R:zustand_fremd", Export.rueckruf("abcdefgh12345678", "erfolg"));

    // ---- J: die Antwort wiederholt nie, was die Seite geschickt hat
    Export.Sammler j = new Export.Sammler(new File(dir, "s7"));
    Export.Antwort jb = j.start("echo000000000001", "speichern", "\"},{\"boese\":1,\"x\":\"", "text/plain", 3, 1, 1);
    z("J:start", jb.json().indexOf("boese") < 0);
    Export.Antwort jt = Export.beantworte(j, "GET", false, Export.WURZEL + "start", q("id", "echo000000000002", "ziel", "speichern", "name", "a", "typ", "text/<script>", "bytes", "3", "teile", "1"), gut, 1);
    z("J:typ", jt.json());
    z("K:verschieden", !new Export.Sammler(new File(dir, "s8")).start("kkkkkkkk00000001", "speichern", "a", "text/plain", 3, 1, 1).k
        .equals(new Export.Sammler(new File(dir, "s9")).start("kkkkkkkk00000001", "speichern", "a", "text/plain", 3, 1, 1).k));

    System.out.print(out);
  }
}
