import ch.greenscan.app.Export;
import ch.greenscan.app.Geteilt;
import java.io.*;
import java.util.*;

/**
 * Faehrt die ECHTE Klasse Geteilt (v33.56) gegen Grenzfaelle — je Regel ein
 * guter und ein schlechter Fall. Ausgabe: `schluessel \t wert`, eine Zeile je
 * Fall; apk_check haelt die Werte gegen die Erwartung.
 *
 * Die Uhr ist gestellt (eine Zahl, die der Fahrer weiterdreht), die Quelle
 * eine Attrappe — Android braucht dafuer niemand: die Abfolge (Quelle pruefen,
 * mit Deckel kopieren, Typ an den Bytes, ablegen oder Grund) steht in
 * Geteilt.annehmen, nicht im Rand.
 */
public class GeteiltFahrer {
  static PrintStream out;
  static void p(String k, Object v) { out.println(k + "\t" + String.valueOf(v)); }

  static final byte[] JPEG = jpeg(2000);
  static byte[] jpeg(int n) {
    byte[] b = new byte[n];
    b[0] = (byte) 0xFF; b[1] = (byte) 0xD8; b[2] = (byte) 0xFF; b[3] = (byte) 0xE0;
    for (int i = 4; i < n; i++) b[i] = (byte) (i * 31);
    return b;
  }
  static byte[] kopf(int... v) { byte[] b = new byte[32]; for (int i = 0; i < v.length; i++) b[i] = (byte) v[i]; return b; }
  static byte[] ascii(String s, int laenge) { byte[] b = new byte[laenge]; byte[] a = s.getBytes(); System.arraycopy(a, 0, b, 0, Math.min(a.length, laenge)); return b; }

  /** Eine Uhr, die der Fahrer stellt. */
  static final class Uhr implements Geteilt.Uhr {
    long t = 1000;
    public long jetzt() { return t; }
  }

  /** Ein Strom, der sich merkt, ob er geschlossen wurde. */
  static final class Strom extends ByteArrayInputStream {
    boolean zu;
    Strom(byte[] b) { super(b); }
    @Override public void close() throws IOException { zu = true; super.close(); }
  }
  /** Ein Strom, der nach n Bytes wirft. */
  static final class WirftNach extends InputStream {
    int n; boolean zu; final Throwable was;
    WirftNach(int n, Throwable was) { this.n = n; this.was = was; }
    @Override public int read() throws IOException {
      if (n-- <= 0) { if (was instanceof IOException) throw (IOException) was; if (was instanceof Error) throw (Error) was; throw (RuntimeException) was; }
      return 7;
    }
    @Override public void close() { zu = true; }
  }
  /** Liefert jeweils hoechstens `schritt` Bytes — wie ein Rohr. */
  static final class Tropfen extends InputStream {
    final byte[] b; int i; final int schritt;
    Tropfen(byte[] b, int schritt) { this.b = b; this.schritt = schritt; }
    @Override public int read() { return i < b.length ? (b[i++] & 0xFF) : -1; }
    @Override public int read(byte[] z, int off, int len) {
      if (i >= b.length) return -1;
      int n = Math.min(Math.min(len, schritt), b.length - i);
      System.arraycopy(b, i, z, off, n); i += n; return n;
    }
  }

  static Map<String, String> kopfzeilen(String marke, String origin, String referer) {
    Map<String, String> m = new LinkedHashMap<String, String>();
    if (marke != null) m.put("X-GS-Huelle", marke);
    if (origin != null) m.put("Origin", origin);
    if (referer != null) m.put("Referer", referer);
    return m;
  }
  static String kurz(Geteilt.Antwort a) {
    if (a.daten != null) return a.status + " bytes " + a.typ + " " + a.daten.length + " x" + a.anzahl + " n" + a.nummer;
    return a.status + " " + a.json();
  }

  public static void main(String[] args) throws Exception {
    out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
    final String PAKET = "ch.greenscan.app";

    // ---------------------------------------------------------- G1 Quelle
    p("Q:content", Geteilt.quelleOk("content", "com.android.providers.media.documents", PAKET));
    p("Q:CONTENT", Geteilt.quelleOk("CONTENT", "media", PAKET));
    p("Q:file", Geteilt.quelleOk("file", "", PAKET));
    p("Q:file_eigen", Geteilt.quelleOk("file", null, PAKET));
    // file://localhost/… hat eine Autoritaet — hier haelt NUR die Schema-Regel.
    p("Q:file_localhost", Geteilt.quelleOk("file", "localhost", PAKET));
    p("Q:http", Geteilt.quelleOk("https", "green-scan.ch", PAKET));
    p("Q:eigen", Geteilt.quelleOk("content", "ch.greenscan.app", PAKET));
    p("Q:eigen_gross", Geteilt.quelleOk("content", "CH.GreenScan.App", PAKET));
    p("Q:eigen_unter", Geteilt.quelleOk("content", "ch.greenscan.app.fileprovider", PAKET));
    p("Q:aehnlich", Geteilt.quelleOk("content", "ch.greenscan.apps", PAKET));
    p("Q:at", Geteilt.quelleOk("content", "evil@media", PAKET));
    p("Q:leer", Geteilt.quelleOk("content", "  ", PAKET));
    p("Q:null", Geteilt.quelleOk(null, "media", PAKET));
    p("Q:null_aut", Geteilt.quelleOk("content", null, PAKET));

    // ------------------------------------------------------------- G2 Typ
    p("T:jpeg", Geteilt.typ(JPEG, JPEG.length));
    p("T:png", Geteilt.typ(kopf(0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13), 32));
    p("T:png_kaputt", Geteilt.typ(kopf(0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x00, 0, 0, 0, 13), 32));
    p("T:gif", Geteilt.typ(ascii("GIF89a", 32), 32));
    p("T:webp", Geteilt.typ(ascii("RIFF\0\0\0\0WEBPVP8 ", 32), 32));
    p("T:wav", Geteilt.typ(ascii("RIFF\0\0\0\0WAVEfmt ", 32), 32));
    p("T:heic", Geteilt.typ(ascii("\0\0\0\u0018ftypheic", 32), 32));
    p("T:mif1", Geteilt.typ(ascii("\0\0\0\u0018ftypmif1", 32), 32));
    p("T:avif", Geteilt.typ(ascii("\0\0\0\u0018ftypavif", 32), 32));
    p("T:mp4", Geteilt.typ(ascii("\0\0\0\u0018ftypisom", 32), 32));
    p("T:kurz", Geteilt.typ(new byte[] { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF }, 3));
    p("T:n_kurz", Geteilt.typ(JPEG, 11));
    p("T:html", Geteilt.typ(ascii("<!doctype html><title>", 32), 32));
    p("T:null", Geteilt.typ(null, 0));

    // ---------------------------------------------------------- G3 Kopie
    p("K:genau", Geteilt.kopieren(new ByteArrayInputStream(new byte[100]), 100).length);
    try { Geteilt.kopieren(new ByteArrayInputStream(new byte[101]), 100); p("K:eins_zu_viel", "kein Fehler"); }
    catch (Geteilt.ZuGross e) { p("K:eins_zu_viel", "ZuGross"); }
    byte[] gross = new byte[3 * 1024 * 1024 + 17];
    new Random(5).nextBytes(gross);
    byte[] tropf = Geteilt.kopieren(new Tropfen(gross, 1013), Geteilt.MAX_BYTES);
    p("K:tropfen_gleich", Arrays.equals(gross, tropf));
    try { Geteilt.kopieren(new WirftNach(50, new IOException("weg")), 1000); p("K:wirft", "kein Fehler"); }
    catch (Geteilt.ZuGross e) { p("K:wirft", "ZuGross"); }
    catch (IOException e) { p("K:wirft", "IOException"); }
    try { Geteilt.kopieren(null, 1000); p("K:null", "kein Fehler"); } catch (IOException e) { p("K:null", "IOException"); }
    p("K:max", Geteilt.MAX_BYTES);

    // ------------------------------------------- G4 Fach: Nummern, Faeden
    Uhr u = new Uhr();
    Geteilt.Fach f = new Geteilt.Fach();
    p("F:anfang", f.zustand(u.t) + " " + kurz(f.holen(u.t)));
    int a = f.kommt(u.t);
    p("F:kommt", f.zustand(u.t) + " " + kurz(f.holen(u.t)));
    int b = f.kommt(u.t);                                 // ein zweites Teilen, bevor das erste fertig ist
    p("F:a_spaet", f.ablegen(a, JPEG, 1, u.t));           // das alte ueberschreibt das neue nicht
    p("F:b", f.ablegen(b, JPEG, 3, u.t) + " " + kurz(f.holen(u.t)));
    p("F:laufend_null", f.laufend());
    // KOPIEN_MAX: zwei laufen, das dritte wird abgewiesen — und es wird nichts gelesen
    Geteilt.Fach g = new Geteilt.Fach();
    int g1 = g.kommt(u.t), g2 = g.kommt(u.t), g3 = g.kommt(u.t);
    p("F:dritte", g3 + " " + g.zustand(u.t) + " " + kurz(g.holen(u.t)));
    g.ablegen(g1, JPEG, 1, u.t); g.fehler(g2, "gross", u.t);
    p("F:danach_laufend", g.laufend() + " " + g.zustand(u.t));
    int g4 = g.kommt(u.t);
    p("F:wieder_frei", (g4 > 0) + " " + g.laufend());
    g.ablegen(g4, JPEG, 1, u.t);
    // heic / kein Bild beim Ablegen
    Geteilt.Fach h = new Geteilt.Fach();
    h.ablegen(h.kommt(u.t), ascii("\0\0\0\u0018ftypheic", 32), 1, u.t);
    p("F:heic", kurz(h.holen(u.t)));
    h.ablegen(h.kommt(u.t), ascii("Hallo Welt, kein Bild", 32), 1, u.t);
    p("F:kein_bild", kurz(h.holen(u.t)));
    h.fehler(h.kommt(u.t), "<script>", u.t);
    p("F:grund_fremd", kurz(h.holen(u.t)));
    // Faeden: 400 Teilen gleichzeitig auf 8 Faeden — am Ende laeuft nichts, und das Fach ist in EINEM Zustand
    final Geteilt.Fach fx = new Geteilt.Fach();
    final Uhr ux = new Uhr();
    Thread[] faeden = new Thread[8];
    final int[] ausnahmen = { 0 };
    for (int t = 0; t < faeden.length; t++) {
      final int nr = t;
      faeden[t] = new Thread(new Runnable() { public void run() {
        for (int i = 0; i < 50; i++) {
          try {
            int n = fx.kommt(ux.jetzt());
            if (n == 0) continue;
            if ((i + nr) % 3 == 0) fx.fehler(n, "fehler", ux.jetzt()); else fx.ablegen(n, JPEG, 1, ux.jetzt());
          } catch (Throwable e) { synchronized (ausnahmen) { ausnahmen[0]++; } }
        }
      } });
      faeden[t].start();
    }
    for (Thread t : faeden) t.join();
    String zx = fx.zustand(ux.t);
    p("F:faeden", fx.laufend() + " " + ausnahmen[0] + " " + (zx.equals("bereit") || zx.equals("fehler")));

    // ------------------------------------------------- G5 Fristen, zwei Schritte
    Geteilt.Fach z = new Geteilt.Fach();
    u.t = 1000;
    int zn = z.kommt(u.t);
    u.t += Geteilt.KOMMT_MAX_MS;
    p("Z:kommt_grenze", z.zustand(u.t));
    u.t += 1;
    p("Z:kommt_zu_lang", kurz(z.holen(u.t)));
    p("Z:spaet_ablegen", z.ablegen(zn, JPEG, 1, u.t));   // die Kopie, die doch noch fertig wird, kommt nicht mehr an
    p("Z:laufend", z.laufend());
    z.quittieren(u.t, 0);
    int zb = z.kommt(u.t); z.ablegen(zb, JPEG, 1, u.t);
    u.t += Geteilt.FRIST_MS - 1;
    p("Z:holen1", kurz(z.holen(u.t)));                   // holen verbraucht NICHT …
    p("Z:holen2", kurz(z.holen(u.t)));
    u.t += Geteilt.FRIST_MS - 1;                          // … und gezeigt heisst frisch: 2× (Frist - 1) seit dem Ablegen
    p("Z:frisch", z.zustand(u.t));
    u.t += Geteilt.FRIST_MS + 1;
    p("Z:weg", kurz(z.holen(u.t)));
    p("Z:weg_bleibt", kurz(z.holen(u.t)));               // „weg" bleibt stehen, bis die Seite es gesagt hat
    u.t += Geteilt.FRIST_MS + 1;
    p("Z:weg_dann_nichts", kurz(z.holen(u.t)));
    int zr = z.kommt(u.t); z.ablegen(zr, JPEG, 1, u.t);
    u.t -= 5;                                             // die Uhr laeuft rueckwaerts
    p("Z:rueckwaerts", kurz(z.holen(u.t)));
    // quittieren: nur das gezeigte Foto
    Geteilt.Fach q = new Geteilt.Fach();
    int q1 = q.kommt(u.t); q.ablegen(q1, JPEG, 1, u.t);
    int q2 = q.kommt(u.t); q.ablegen(q2, jpeg(77), 1, u.t);
    p("Z:quitt_alt", kurz(q.quittieren(u.t, q1)) + " " + kurz(q.holen(u.t)));
    p("Z:quitt_neu", kurz(q.quittieren(u.t, q2)) + " " + q.zustand(u.t));
    int q3 = q.kommt(u.t);
    p("Z:quitt_alles_waehrend_kopie", kurz(q.quittieren(u.t, 0)) + " " + q.zustand(u.t));
    p("Z:kopie_nach_abmelden", q.ablegen(q3, JPEG, 1, u.t) + " " + q.zustand(u.t) + " " + q.laufend());
    q.fehler(q.kommt(u.t), "gross", u.t);
    p("Z:fehler_bleibt_bis_quittiert", kurz(q.holen(u.t)) + " | " + kurz(q.holen(u.t)));
    q.quittieren(u.t, q.nummer());
    p("Z:fehler_quittiert", kurz(q.holen(u.t)));

    // --------------------------------------------------------- G6 Weiche
    Geteilt.Fach w = new Geteilt.Fach();
    w.ablegen(w.kommt(u.t), JPEG, 2, u.t);
    Map<String, String> gut = kopfzeilen("geteilt", "https://green-scan.ch", "https://green-scan.ch/?source=app");
    String H = Geteilt.WURZEL;
    p("W:gut", kurz(Geteilt.beantworte(w, "GET", false, H + "holen", null, gut, u.t)));
    p("W:ohne_origin", kurz(Geteilt.beantworte(w, "GET", false, H + "holen", null, kopfzeilen("geteilt", null, null), u.t)));
    p("W:haupt", kurz(Geteilt.beantworte(w, "GET", true, H + "holen", null, gut, u.t)));
    p("W:post", kurz(Geteilt.beantworte(w, "POST", false, H + "holen", null, gut, u.t)));
    p("W:ohne_kopf", kurz(Geteilt.beantworte(w, "GET", false, H + "holen", null, kopfzeilen(null, "https://green-scan.ch", null), u.t)));
    p("W:kopf_datei", kurz(Geteilt.beantworte(w, "GET", false, H + "holen", null, kopfzeilen("datei", null, null), u.t)));
    p("W:kopf_gross", kurz(Geteilt.beantworte(w, "GET", false, H + "holen", null, kopfzeilen("GETEILT", null, null), u.t)));
    p("W:origin_null", kurz(Geteilt.beantworte(w, "GET", false, H + "holen", null, kopfzeilen("geteilt", "null", null), u.t)));
    p("W:origin_fremd", kurz(Geteilt.beantworte(w, "GET", false, H + "holen", null, kopfzeilen("geteilt", "https://boese.example", null), u.t)));
    p("W:referer_fremd", kurz(Geteilt.beantworte(w, "GET", false, H + "holen", null, kopfzeilen("geteilt", null, "https://green-scan.ch.boese.example/"), u.t)));
    p("W:pfad", kurz(Geteilt.beantworte(w, "GET", false, H + "alles", null, gut, u.t)));
    p("W:pfad_fremd", kurz(Geteilt.beantworte(w, "GET", false, "/__huelle/datei/start", null, gut, u.t)));
    p("W:null_fach", kurz(Geteilt.beantworte(null, "GET", false, H + "holen", null, gut, u.t)));
    p("W:null_kopf", kurz(Geteilt.beantworte(w, "GET", false, H + "holen", null, null, u.t)));
    p("W:quitt_kaputt", kurz(Geteilt.beantworte(w, "GET", false, H + "quittieren", "n=1;drop", gut, u.t)) + " " + w.zustand(u.t));
    p("W:quitt_falsch", kurz(Geteilt.beantworte(w, "GET", false, H + "quittieren", "n=999", gut, u.t)) + " " + w.zustand(u.t));
    p("W:quitt_richtig", kurz(Geteilt.beantworte(w, "GET", false, H + "quittieren", "n=" + w.nummer(), gut, u.t)) + " " + w.zustand(u.t));
    // Der Wert des einen Wegs gilt nie fuer den anderen — auch nicht am Export-Kanal.
    Export.Antwort ex = Export.beantworte(new Export.Sammler(new File(System.getProperty("java.io.tmpdir"))), "GET", false,
        "/__huelle/datei/start", "id=abcdefgh12345678&ziel=speichern&name=a.txt&typ=text%2Fplain&bytes=1&teile=1&quelle=app",
        kopfzeilen("geteilt", null, null), u.t);
    p("W:export_mit_geteilt", ex.status + " " + ex.json());
    // Unsinn: 3000 zufaellige Anfragen — keine Ausnahme, nie die Bytes ohne die richtige Kopfzeile
    Random r = new Random(11);
    String[] meth = { "GET", "POST", "get", "PUT", null, "" };
    String[] pf = { H + "holen", H + "quittieren", H, H + "../datei/start", "/__huelle/geteilt", H + "holen/", null, H + "holen?x" };
    String[] mk = { "geteilt", "datei", null, "", "geteilt ", "GETEILT" };
    String[] qy = { null, "n=1", "n=", "n=-3", "n=99999999999", "&&", "n=1&n=2" };
    int geworfen = 0, bytesOhneKopf = 0;
    for (int i = 0; i < 3000; i++) {
      Geteilt.Fach ff = new Geteilt.Fach();
      ff.ablegen(ff.kommt(u.t), JPEG, 1, u.t);
      try {
        String m = mk[r.nextInt(mk.length)];
        Geteilt.Antwort an = Geteilt.beantworte(ff, meth[r.nextInt(meth.length)], r.nextBoolean(), pf[r.nextInt(pf.length)],
            qy[r.nextInt(qy.length)], kopfzeilen(m, r.nextBoolean() ? "https://green-scan.ch" : null, null), u.t);
        if (an.daten != null && !"geteilt".equals(m)) bytesOhneKopf++;
      } catch (Throwable t) { geworfen++; }
    }
    p("W:unsinn", geworfen + " " + bytesOhneKopf);

    // ---------------------------------------------------- G7 Annehmen
    Geteilt.Fach an = new Geteilt.Fach();
    final Strom s1 = new Strom(JPEG);
    p("A:gut", Geteilt.annehmen(an, "content", "media", true, PAKET, 4, new Geteilt.Oeffner() {
      public InputStream oeffnen() { return s1; } }, u) + " " + kurz(an.holen(u.t)) + " zu=" + s1.zu);
    p("A:ohne_uri", Geteilt.annehmen(an, null, null, false, PAKET, 1, null, u) + " " + kurz(an.holen(u.t)));
    final int[] geoeffnet = { 0 };
    Geteilt.Oeffner zaehler = new Geteilt.Oeffner() { public InputStream oeffnen() { geoeffnet[0]++; return new Strom(JPEG); } };
    p("A:file", Geteilt.annehmen(an, "file", "", true, PAKET, 1, zaehler, u) + " " + kurz(an.holen(u.t)) + " geoeffnet=" + geoeffnet[0]);
    p("A:eigen", Geteilt.annehmen(an, "content", PAKET + ".provider", true, PAKET, 1, zaehler, u) + " " + kurz(an.holen(u.t)) + " geoeffnet=" + geoeffnet[0]);
    p("A:security", Geteilt.annehmen(an, "content", "media", true, PAKET, 1, new Geteilt.Oeffner() {
      public InputStream oeffnen() { throw new SecurityException("keine Leseerlaubnis"); } }, u) + " " + kurz(an.holen(u.t)));
    final WirftNach oom = new WirftNach(40, new OutOfMemoryError("voll"));
    p("A:oom", Geteilt.annehmen(an, "content", "media", true, PAKET, 1, new Geteilt.Oeffner() {
      public InputStream oeffnen() { return oom; } }, u) + " " + kurz(an.holen(u.t)) + " zu=" + oom.zu);
    final WirftNach rt = new WirftNach(40, new IllegalStateException("kaputt"));
    p("A:runtime", Geteilt.annehmen(an, "content", "media", true, PAKET, 1, new Geteilt.Oeffner() {
      public InputStream oeffnen() { return rt; } }, u) + " " + kurz(an.holen(u.t)) + " zu=" + rt.zu);
    p("A:null_strom", Geteilt.annehmen(an, "content", "media", true, PAKET, 1, new Geteilt.Oeffner() {
      public InputStream oeffnen() { return null; } }, u) + " " + kurz(an.holen(u.t)));
    final Strom gr = new Strom(new byte[(int) Geteilt.MAX_BYTES + 1]);
    p("A:gross", Geteilt.annehmen(an, "content", "media", true, PAKET, 1, new Geteilt.Oeffner() {
      public InputStream oeffnen() { return gr; } }, u) + " " + kurz(an.holen(u.t)) + " zu=" + gr.zu);
    p("A:heic", Geteilt.annehmen(an, "content", "media", true, PAKET, 1, new Geteilt.Oeffner() {
      public InputStream oeffnen() { return new Strom(ascii("\0\0\0\u0018ftypheic", 64)); } }, u) + " " + kurz(an.holen(u.t)));
    p("A:laufend", an.laufend());
    p("A:gescheitert", Geteilt.annehmenGescheitert(an, u) + " " + kurz(an.holen(u.t)) + " " + an.laufend());
    p("A:null_fach", Geteilt.annehmen(null, "content", "media", true, PAKET, 1, zaehler, u));

    // -------------------------------------------- G8 Welche Absicht zaehlt
    final int AUS_DER_LISTE = 0x00100000;   // Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY
    p("S:send", Geteilt.sollAnnehmen(false, 0, "android.intent.action.SEND", AUS_DER_LISTE));
    p("S:multiple", Geteilt.sollAnnehmen(false, 0x10000000, "android.intent.action.SEND_MULTIPLE", AUS_DER_LISTE));
    p("S:main", Geteilt.sollAnnehmen(false, 0, "android.intent.action.MAIN", AUS_DER_LISTE));
    p("S:view", Geteilt.sollAnnehmen(false, 0, "android.intent.action.VIEW", AUS_DER_LISTE));
    p("S:null", Geteilt.sollAnnehmen(false, 0, null, AUS_DER_LISTE));
    p("S:wiederhergestellt", Geteilt.sollAnnehmen(true, 0, "android.intent.action.SEND", AUS_DER_LISTE));
    p("S:aus_der_liste", Geteilt.sollAnnehmen(false, AUS_DER_LISTE | 0x10000000, "android.intent.action.SEND", AUS_DER_LISTE));

    // ------------------------------------------------- G9 Rueckruf, Antwort
    p("R:rueckruf", Geteilt.rueckruf());
    p("R:json_ok", Geteilt.beantworte(q, "GET", false, H + "quittieren", null, gut, u.t).json());
  }
}
