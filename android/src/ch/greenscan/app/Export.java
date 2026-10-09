package ch.greenscan.app;

import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Die RECHNUNG hinter Export und Drucken in der Huelle — ohne eine einzige
 * Android-Abhaengigkeit, aus demselben Grund wie {@link Pfade}: hier laeuft
 * kein Android, und eine Regel, die man nicht AUSFUEHREN kann, hat man nicht
 * geprueft (v33.41). `apk_check.js` uebersetzt diese Klasse und faehrt sie
 * gegen echte Faelle; {@link AssetServer} und {@link MainActivity} sind nur
 * der Rand darum.
 *
 * <p><b>Der Kanal.</b> Eine nackte WebView hat keinen Weg, eine Datei aus dem
 * Arbeitsspeicher auf das Geraet zu bringen ({@code blob:} erreicht nicht
 * einmal einen DownloadListener), und {@code window.print()} tut nichts.
 * Eine JavaScript-Bruecke ({@code addJavascriptInterface}) waere der uebliche
 * Ausweg — und genau den gibt es hier bewusst nicht (apk_check R2). Statt
 * dessen schickt die Seite die Datei in Teilen per {@code fetch} an Adressen
 * unter dem EIGENEN Ursprung, die nur die Huelle beantwortet:
 *
 * <pre>
 *   GET /__huelle/datei/start?id=…&amp;ziel=speichern|drucken&amp;name=…&amp;typ=…&amp;bytes=…&amp;teile=…
 *   GET /__huelle/datei/teil?id=…&amp;i=…&amp;d=&lt;base64url&gt;
 *   GET /__huelle/datei/fertig?id=…
 * </pre>
 *
 * <p>Das ist eine Einbahnstrasse mit genau EINER Wirkung: die Huelle zeigt den
 * Android-Dialog „Speichern unter" oder den Druckdialog. Den Ort waehlt die
 * Person, nicht die Seite; es gibt keinen Lesezugriff, keinen Pfad, kein
 * Objekt, das man aus der Seite heraus aufrufen koennte.
 *
 * <p>Wer eine Regel aendert, aendert sie hier und im Fall — nie im Rand.
 */
public final class Export {

  private Export() {}

  /** Wurzel des Kanals im Pfad — alles darunter beantwortet {@link #beantworte}. */
  public static final String WURZEL = "/__huelle/datei/";

  /** Die Kopfzeile, die jede Anfrage tragen muss — siehe {@link #beantworte}. */
  public static final String KOPF = "X-GS-Huelle";
  public static final String KOPF_WERT = "datei";

  /** Deckel fuer eine Datei. Das groesste heutige Ziel ist das Backup (localStorage, ≤ 5 MB). */
  public static final long MAX_BYTES = 32L * 1024 * 1024;
  /**
   * Deckel fuer ein Druck-Dokument. Klein, weil alle WebViews einer App sich
   * EINEN Renderer teilen: laeuft er beim Umbrechen eines riesigen Dokuments
   * ueber, stirbt die App mit — und der Rueckruf, mit dem man das ueberlebt
   * ({@code onRenderProcessGone}), kommt erst mit API 26, also nicht in
   * android.jar 23. Die heutigen Druck-Dokumente sind wenige hundert KB.
   */
  public static final long MAX_DRUCK_BYTES = 8L * 1024 * 1024;
  /** Deckel fuer die Zahl der Teile — 32 MiB in Teilen zu 192 KiB sind 171. */
  public static final int MAX_TEILE = 256;
  /** Deckel fuer EINEN Teil nach dem Dekodieren. */
  public static final int MAX_TEIL_BYTES = 512 * 1024;
  /** Ein Name ist hoechstens so lang (Zeichen, ohne Endung). */
  public static final int MAX_NAME = 80;

  /** Ein Vorgang, der so lange nichts mehr gehoert hat, darf verdraengt werden. */
  public static final long SAMMELN_VERWAIST_MS = 60L * 1000;
  /** Ein uebergebener Vorgang (Dialog offen) gilt nach so langer Zeit als verloren. */
  public static final long DIALOG_VERWAIST_MS = 10L * 60 * 1000;

  // ------------------------------------------------------------- Katalog

  /**
   * Der GESCHLOSSENE Katalog: Typ → Endung. Was hier nicht steht, wird
   * abgelehnt, nicht geraten — dieselbe Haltung wie {@link Pfade#mimeTyp}.
   * Er enthaelt genau das, was die Export-Stellen der App heute erzeugen.
   */
  private static final Map<String, String> KATALOG = new LinkedHashMap<String, String>();
  static {
    KATALOG.put("application/json", "json");       // Backup, Archiv
    KATALOG.put("application/gpx+xml", "gpx");     // GPS-Track
    KATALOG.put("text/csv", "csv");                // Pflanzen, Tagebuch, Messwerte
    KATALOG.put("image/png", "png");               // 3D-Plan-Foto
    KATALOG.put("image/jpeg", "jpg");
    KATALOG.put("text/html", "html");              // Gartenplan als Dokument
    KATALOG.put("text/plain", "txt");
  }

  /** Zweite Endung, die fuer denselben Typ gilt — sonst wuerde aus plan.jpeg ein plan.jpeg.jpg. */
  private static final Map<String, String> AUCH = new LinkedHashMap<String, String>();
  static {
    AUCH.put("image/jpeg", "jpeg");
    AUCH.put("text/html", "htm");
  }

  /**
   * Normiert einen Typ ({@code "Text/CSV; charset=utf-8"} → {@code "text/csv"})
   * und gibt ihn nur zurueck, wenn er fuer dieses Ziel erlaubt ist. Drucken
   * nimmt NUR {@code text/html}: gedruckt wird ein Dokument, das die Huelle in
   * einer eigenen WebView ohne JavaScript und ohne Netz aufbaut.
   */
  public static String typFuer(String typ, String ziel) {
    if (typ == null || !zielOk(ziel)) return null;
    String t = typ;
    int semi = t.indexOf(';');
    if (semi >= 0) t = t.substring(0, semi);
    t = t.trim().toLowerCase(Locale.ROOT);
    if (!KATALOG.containsKey(t)) return null;
    if ("drucken".equals(ziel) && !"text/html".equals(t)) return null;
    return t;
  }

  public static String endung(String typ) {
    String e = KATALOG.get(typ);
    return e == null ? "bin" : e;
  }

  public static boolean zielOk(String z) {
    return "speichern".equals(z) || "drucken".equals(z);
  }

  /**
   * Eine Kennung sieht so aus: 8–32 Zeichen aus a–z und 0–9. Sie wird
   * spaeter in einen JavaScript-Aufruf eingesetzt ({@code evaluateJavascript})
   * — deshalb ist die Form die Pruefung, nicht ein Escaping danach.
   */
  public static boolean idOk(String id) {
    if (id == null) return false;
    int n = id.length();
    if (n < 8 || n > 32) return false;
    for (int i = 0; i < n; i++) {
      char c = id.charAt(i);
      if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9'))) return false;
    }
    return true;
  }

  /**
   * Die Zustaende, die die Huelle der Seite zurueckmeldet — eine geschlossene
   * Liste, weil der Wert in einen JavaScript-Aufruf eingesetzt wird.
   */
  public static boolean zustandOk(String z) {
    return "gespeichert".equals(z) || "abgebrochen".equals(z)
        || "fehler".equals(z) || "druck_offen".equals(z);
  }

  /**
   * Der JavaScript-Aufruf, mit dem die Huelle das Ergebnis meldet — oder
   * {@code null}, wenn Kennung oder Zustand nicht die erwartete Form haben.
   * Beide werden NICHT escaped, sondern abgewiesen: was die Form nicht hat,
   * kommt gar nicht erst in eine Zeichenkette, die ausgefuehrt wird.
   */
  public static String rueckruf(String id, String zustand) {
    if (!idOk(id) || !zustandOk(zustand)) return null;
    return "window.gsHuelleDateiErgebnis && window.gsHuelleDateiErgebnis('" + id + "','" + zustand + "');";
  }

  // --------------------------------------------------------------- Name

  /**
   * Macht aus dem Namen, den die Seite vorschlaegt, einen Dateinamen fuer den
   * Dialog „Speichern unter".
   *
   * <p>Eine ERLAUBTE Liste statt einer verbotenen: nur {@code A–Z a–z 0–9 . _ -},
   * alles andere wird zu {@code -}. Eine Verbotsliste vergisst immer etwas —
   * die Zeichen fuer die Schreibrichtung etwa, mit denen „gpj.exe" im Dialog
   * wie „exe.jpg" aussieht. Alle Export-Stellen der App bauen ihre Namen
   * ohnehin aus einem festen Wort und einem Datum. Kein Punkt am Anfang
   * (versteckte Datei), hoechstens {@link #MAX_NAME} Zeichen, und die Endung
   * kommt aus dem KATALOG — sonst stuende eine CSV als „bericht.html" da.
   * Den Ort waehlt die Person im Dialog; ein Pfad im Namen fuehrt nirgends hin.
   */
  public static String nameSaeubern(String name, String typ) {
    String ext = endung(typ);
    String auch = AUCH.get(typ);
    StringBuilder b = new StringBuilder();
    if (name != null) {
      for (int i = 0; i < name.length(); i++) {
        char c = name.charAt(i);
        boolean erlaubt = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')
            || c == '.' || c == '_' || c == '-';
        b.append(erlaubt ? c : '-');
      }
    }
    String s = b.toString().replaceAll("-{2,}", "-");
    // Endung abtrennen, wenn sie zum Typ passt — sie kommt am Ende sauber wieder dran.
    String klein = s.toLowerCase(Locale.ROOT);
    if (klein.endsWith("." + ext)) s = s.substring(0, s.length() - ext.length() - 1);
    else if (auch != null && klein.endsWith("." + auch)) s = s.substring(0, s.length() - auch.length() - 1);
    s = s.replaceAll("^[.\\-]+", "").replaceAll("[.\\-]+$", "");
    if (s.length() > MAX_NAME) s = s.substring(0, MAX_NAME).replaceAll("[.\\-]+$", "");
    if (s.length() == 0) s = "greenscan-export";
    return s + "." + ext;
  }

  // ------------------------------------------------------------ Dekodieren

  /**
   * base64url (RFC 4648 §5), mit oder ohne Auffuellung. {@code null} bei
   * jedem Zeichen ausserhalb des Alphabets und bei einer unmoeglichen Laenge.
   * Das Standard-Alphabet ({@code +}, {@code /}) wird bewusst NICHT
   * angenommen: in einer Abfrage waere {@code +} je nach Leser ein Leerzeichen.
   */
  public static byte[] base64urlDekodieren(String s) {
    if (s == null) return null;
    int n = s.length();
    while (n > 0 && s.charAt(n - 1) == '=') n--;
    if (s.length() - n > 2) return null;
    if (n % 4 == 1) return null;
    int voll = n / 4, rest = n % 4;
    int laenge = voll * 3 + (rest == 0 ? 0 : rest - 1);
    byte[] out = new byte[laenge];
    int o = 0, i = 0;
    while (i + 4 <= n) {
      int a = w(s.charAt(i)), b2 = w(s.charAt(i + 1)), c = w(s.charAt(i + 2)), d = w(s.charAt(i + 3));
      if ((a | b2 | c | d) < 0) return null;
      int v = (a << 18) | (b2 << 12) | (c << 6) | d;
      out[o++] = (byte) (v >> 16); out[o++] = (byte) (v >> 8); out[o++] = (byte) v;
      i += 4;
    }
    if (rest == 2) {
      int a = w(s.charAt(i)), b2 = w(s.charAt(i + 1));
      if ((a | b2) < 0) return null;
      if ((b2 & 0x0f) != 0) return null;              // ungenutzte Bits muessen 0 sein
      out[o++] = (byte) ((a << 2) | (b2 >> 4));
    } else if (rest == 3) {
      int a = w(s.charAt(i)), b2 = w(s.charAt(i + 1)), c = w(s.charAt(i + 2));
      if ((a | b2 | c) < 0) return null;
      if ((c & 0x03) != 0) return null;
      int v = (a << 10) | (b2 << 4) | (c >> 2);
      out[o++] = (byte) (v >> 8); out[o++] = (byte) v;
    }
    return out;
  }

  private static int w(char c) {
    if (c >= 'A' && c <= 'Z') return c - 'A';
    if (c >= 'a' && c <= 'z') return c - 'a' + 26;
    if (c >= '0' && c <= '9') return c - '0' + 52;
    if (c == '-') return 62;
    if (c == '_') return 63;
    return -1;
  }

  /**
   * Prozent-Dekodierung als UTF-8 ({@code %C3%A4} → ä). {@link Pfade} dekodiert
   * Byte fuer Byte und darf das, weil Paketpfade ASCII sind — ein Dateiname
   * wie „Übersicht" ist es nicht. {@code null} bei kaputter Kodierung oder
   * ungueltigem UTF-8. {@code +} bleibt ein Plus.
   */
  public static String utf8Dekodieren(String s) {
    if (s == null) return null;
    // Roh ausserhalb ASCII kodiert kein Browser — auch ohne ein einziges %
    // nicht. Eine Regel fuer beide Faelle (der erste Lauf liess „ü" ohne %
    // durch und wies es mit % daneben ab).
    for (int i = 0; i < s.length(); i++) if (s.charAt(i) >= 0x80) return null;
    if (s.indexOf('%') < 0) return s;
    ByteBuffer bb = ByteBuffer.allocate(s.length());
    for (int i = 0; i < s.length(); i++) {
      char c = s.charAt(i);
      if (c == '%') {
        if (i + 2 >= s.length()) return null;
        int hi = hex(s.charAt(i + 1)), lo = hex(s.charAt(i + 2));
        if (hi < 0 || lo < 0) return null;
        bb.put((byte) ((hi << 4) | lo));
        i += 2;
      } else if (c < 0x80) {
        bb.put((byte) c);
      } else {
        return null;                                   // roh ausserhalb ASCII: so kodiert der Browser nicht
      }
    }
    bb.flip();
    CharsetDecoder dec = StandardCharsets.UTF_8.newDecoder()
        .onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT);
    try {
      CharBuffer cb = dec.decode(bb);
      return cb.toString();
    } catch (CharacterCodingException e) {
      return null;
    }
  }

  private static int hex(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
  }

  /** Zerlegt eine (noch kodierte) Abfrage. Ein Schluessel, der doppelt kommt, macht sie ungueltig. */
  public static Map<String, String> abfrage(String roh) {
    Map<String, String> m = new LinkedHashMap<String, String>();
    if (roh == null || roh.length() == 0) return m;
    String[] paare = roh.split("&", -1);
    for (int i = 0; i < paare.length; i++) {
      String p = paare[i];
      if (p.length() == 0) continue;
      int eq = p.indexOf('=');
      String k = utf8Dekodieren(eq < 0 ? p : p.substring(0, eq));
      String v = utf8Dekodieren(eq < 0 ? "" : p.substring(eq + 1));
      if (k == null || v == null) return null;
      if (m.containsKey(k)) return null;
      m.put(k, v);
    }
    return m;
  }

  // ------------------------------------------------------------- Ergebnis

  /**
   * Eine fertig eingesammelte Datei — das Einzige, was den Rand erreicht.
   * Sie liegt NICHT im Arbeitsspeicher, sondern in einer Spool-Datei: stirbt
   * die Activity oder der Prozess, waehrend der Dialog „Speichern unter"
   * offen ist, findet die naechste Instanz die Bytes dort wieder — oder weiss,
   * dass sie fehlen (siehe {@link #spoolPasst}).
   */
  public static final class Datei {
    public final String id, ziel, name, typ;
    public final long bytes;
    public final java.io.File spool;
    Datei(String id, String ziel, String name, String typ, long bytes, java.io.File spool) {
      this.id = id; this.ziel = ziel; this.name = name; this.typ = typ; this.bytes = bytes; this.spool = spool;
    }
  }

  /**
   * Antwort auf eine Anfrage. {@code status} ist der HTTP-Status, {@code json}
   * der Rumpf. Der Rumpf enthaelt NIE etwas von dem, was die Seite geschickt
   * hat — nur {@code ok}, die Marke {@code huelle} und einen Grund aus einer
   * festen Liste. Die Marke unterscheidet eine Antwort der Huelle von allem,
   * was sonst unter dieser Adresse ankommen koennte (im Web: die Startseite
   * als Rueckfall des Hosters) — die Seite nimmt nur Antworten MIT Marke.
   */
  public static final class Antwort {
    public final int status;
    public final boolean ok;
    public final String grund;
    public final Datei datei;
    /** Nur in der Antwort auf {@code start}: der Schluessel fuer diesen Vorgang (32 Hex-Zeichen). */
    public final String k;
    Antwort(int status, boolean ok, String grund, Datei datei, String k) {
      this.status = status; this.ok = ok; this.grund = grund; this.datei = datei; this.k = k;
    }
    public String json() {
      if (!ok) return "{\"huelle\":1,\"ok\":false,\"grund\":\"" + grund + "\"}";
      return k == null ? "{\"huelle\":1,\"ok\":true}" : "{\"huelle\":1,\"ok\":true,\"k\":\"" + k + "\"}";
    }
  }

  static Antwort ja() { return new Antwort(200, true, null, null, null); }
  static Antwort nein(String grund) { return new Antwort(200, false, grund, null, null); }
  static Antwort http(int status, String grund) { return new Antwort(status, false, grund, null, null); }

  // ------------------------------------------------------------- Spool

  /** Name der Spool-Datei zu einer Kennung — die Kennung ist geprueft, also ein sicherer Name. */
  public static String spoolName(String id) { return idOk(id) ? id + ".part" : null; }

  /**
   * Passt die Spool-Datei noch zu dem, was erwartet wurde? Der Rand fragt das,
   * BEVOR er in die vom Dialog angelegte Datei schreibt. Fehlt sie oder hat sie
   * die falsche Laenge, wird die angelegte Datei wieder geloescht — eine leere
   * Datei unter dem Namen „Backup" waere eine Zusage ohne Ware.
   */
  public static boolean spoolPasst(java.io.File spool, long bytes) {
    return spool != null && spool.isFile() && bytes > 0 && spool.length() == bytes;
  }

  /**
   * Raeumt Spool-Dateien weg, die niemand mehr abholt (Prozess gestorben,
   * Seite neu geladen). Behalten wird nur {@code behalten} — der Vorgang,
   * auf dessen Dialog gerade gewartet wird. Gibt die Zahl der geloeschten
   * Dateien zurueck.
   */
  public static int aufraeumen(java.io.File dir, String behalten, long jetzt) {
    if (dir == null || !dir.isDirectory()) return 0;
    java.io.File[] alle = dir.listFiles();
    if (alle == null) return 0;
    String keep = spoolName(behalten);
    int n = 0;
    for (int i = 0; i < alle.length; i++) {
      java.io.File f = alle[i];
      if (!f.isFile()) continue;
      if (keep != null && keep.equals(f.getName())) continue;
      if (jetzt - f.lastModified() < SAMMELN_VERWAIST_MS && f.getName().endsWith(".part")) continue;
      if (f.delete()) n++;
    }
    return n;
  }

  // -------------------------------------------------------------- Sammler

  /** Die drei Zustaende eines Vorgangs. */
  public static final String FREI = "frei", SAMMELN = "sammeln", WARTET = "wartet";

  /**
   * Sammelt EINE Datei zur Zeit, Teil fuer Teil in eine Spool-Datei.
   *
   * <p>Drei Zustaende, ausdruecklich: {@link #FREI} · {@link #SAMMELN} ·
   * {@link #WARTET} (der Dialog ist offen). Ein zweiter Vorgang wird
   * abgewiesen ({@code beschaeftigt}) — sonst stuenden zwei Dialoge
   * uebereinander, und die Bytes des einen landeten in der Datei des anderen.
   * Verdraengt werden darf NUR ein Vorgang, der beim Sammeln stehen blieb
   * (Seite neu geladen); ein wartender endet nur durch das Ergebnis des
   * Dialogs ({@link #abschliessen}) — oder nach {@link #DIALOG_VERWAIST_MS},
   * wenn der Dialog nie geantwortet hat.
   *
   * <p>Die Teile kommen in REIHENFOLGE (die Seite schickt sie nacheinander);
   * ein Teil ausser der Reihe ist ein Fehler, keine Umsortierung.
   *
   * <p>Die Uhr kommt als Parameter herein ({@code jetzt}) — der Pruefstand
   * stellt sie, statt zu warten. Jede Methode ist {@code synchronized}:
   * {@code shouldInterceptRequest} laeuft auf mehreren Hintergrund-Faeden.
   */
  public static final class Sammler {
    private final java.io.File dir;
    private String zustand = FREI;
    private String id, ziel, name, typ;
    private long bytes, zuletzt, summe;
    private int teile, angekommen;
    private java.io.File spool;
    private String schluessel;
    private final java.security.SecureRandom zufall = new java.security.SecureRandom();

    /** @param dir Verzeichnis fuer die Spool-Dateien (in der Huelle: {@code getCacheDir()/huelle-export}) */
    public Sammler(java.io.File dir) { this.dir = dir; }

    /**
     * Prueft den Schluessel des Vorgangs. Er kommt NUR in der Antwort auf
     * {@code start} vor — und eine Antwort kann nur lesen, wer die Anfrage
     * mit {@code fetch} gestellt hat. Ein {@code <img>}, ein Stylesheet oder
     * eine fremde Seite koennen eine Anfrage AUSLOESEN, aber ihre Antwort nie
     * lesen; ohne Schluessel kommen sie ueber {@code start} nicht hinaus.
     * Verglichen wird in gleichbleibender Zeit.
     */
    private boolean schluesselOk(String k) {
      if (schluessel == null || k == null || k.length() != schluessel.length()) return false;
      int d = 0;
      for (int i = 0; i < k.length(); i++) d |= k.charAt(i) ^ schluessel.charAt(i);
      return d == 0;
    }

    public synchronized String zustand() { return zustand; }
    public synchronized String offeneId() { return id; }

    public synchronized boolean frei(long jetzt) {
      if (FREI.equals(zustand)) return true;
      // Eine Uhr, die rueckwaerts laeuft: ein SAMMELNDER Vorgang gilt dann als
      // verwaist, ein WARTENDER nie — dessen Dialog ist vielleicht noch offen.
      // (Der Rand reicht eine monotone Uhr herein; das hier ist die Absicherung.)
      if (jetzt < zuletzt) return SAMMELN.equals(zustand);
      long grenze = WARTET.equals(zustand) ? DIALOG_VERWAIST_MS : SAMMELN_VERWAIST_MS;
      return jetzt - zuletzt > grenze;
    }

    public synchronized Antwort start(String id, String ziel, String name, String typ,
                                      long bytes, int teile, long jetzt) {
      if (!idOk(id)) return nein("id");
      if (!zielOk(ziel)) return nein("ziel");
      String t = typFuer(typ, ziel);
      if (t == null) return nein("typ");
      long deckel = "drucken".equals(ziel) ? MAX_DRUCK_BYTES : MAX_BYTES;
      if (bytes < 1 || bytes > deckel) return nein("zu_gross");
      if (teile < 1 || teile > MAX_TEILE) return nein("teile");
      // Jeder Teil traegt hoechstens MAX_TEIL_BYTES — mehr Bytes als das kann
      // diese Zahl von Teilen gar nicht tragen.
      if (bytes > (long) teile * MAX_TEIL_BYTES) return nein("teile");
      if (!frei(jetzt)) return nein("beschaeftigt");
      verwerfen();
      java.io.File f = new java.io.File(dir, spoolName(id));
      try {
        if (!dir.isDirectory() && !dir.mkdirs()) return nein("ablage");
        new java.io.FileOutputStream(f, false).close();      // anlegen bzw. leeren
      } catch (java.io.IOException e) {
        return nein("ablage");
      }
      this.zustand = SAMMELN;
      this.id = id; this.ziel = ziel; this.typ = t;
      this.name = nameSaeubern(name, t);
      this.bytes = bytes; this.teile = teile; this.angekommen = 0; this.summe = 0;
      this.spool = f;
      this.zuletzt = jetzt;
      byte[] roh = new byte[16];
      zufall.nextBytes(roh);
      StringBuilder hx = new StringBuilder(32);
      for (int j = 0; j < roh.length; j++) hx.append(String.format(Locale.ROOT, "%02x", roh[j] & 0xff));
      this.schluessel = hx.toString();
      return new Antwort(200, true, null, null, this.schluessel);
    }

    public synchronized Antwort teil(String id, String k, int i, String b64, long jetzt) {
      if (!SAMMELN.equals(zustand) || this.id == null || !this.id.equals(id)) return nein("id");
      if (!schluesselOk(k)) return nein("schluessel");
      if (b64 == null || b64.length() > (MAX_TEIL_BYTES / 3 + 1) * 4) { verwerfen(); return nein("zu_gross"); }
      if (i != angekommen) return nein("teil");          // in Reihenfolge, jeder genau einmal
      byte[] roh = base64urlDekodieren(b64);
      if (roh == null || roh.length == 0) return nein("kodierung");
      if (roh.length > MAX_TEIL_BYTES) { verwerfen(); return nein("zu_gross"); }
      if (summe + roh.length > bytes) { verwerfen(); return nein("laenge"); }
      java.io.FileOutputStream o = null;
      try {
        o = new java.io.FileOutputStream(spool, true);
        o.write(roh);
      } catch (java.io.IOException e) {
        verwerfen(); return nein("ablage");
      } finally {
        if (o != null) try { o.close(); } catch (java.io.IOException ignored) {}
      }
      summe += roh.length;
      angekommen++;
      zuletzt = jetzt;
      return ja();
    }

    /**
     * Prueft Vollstaendigkeit und Laenge und gibt die Datei heraus. Danach
     * WARTET der Vorgang, bis der Rand {@link #abschliessen} ruft — so lange
     * ist der Dialog offen, und ein zweiter Vorgang wartet. Ein zweites
     * {@code fertig} fuer denselben Vorgang wird abgewiesen: es gibt genau
     * EINEN Dialog je Datei.
     */
    public synchronized Antwort fertig(String id, String k, long jetzt) {
      if (!SAMMELN.equals(zustand) || this.id == null || !this.id.equals(id)) return nein("id");
      if (!schluesselOk(k)) return nein("schluessel");
      if (angekommen != teile) { verwerfen(); return nein("unvollstaendig"); }
      if (summe != bytes || !spoolPasst(spool, bytes)) { verwerfen(); return nein("laenge"); }
      zustand = WARTET;
      zuletzt = jetzt;
      return new Antwort(200, true, null, new Datei(this.id, ziel, name, typ, bytes, spool), null);
    }

    /**
     * Der Dialog ist zu (gespeichert, abgebrochen, gedruckt, gescheitert).
     * Nur fuer DIESEN Vorgang — ein spaetes Ergebnis eines verdraengten
     * Vorgangs raeumt nicht den neuen ab. Die Spool-Datei geht mit.
     */
    public synchronized boolean abschliessen(String id) {
      if (this.id == null || !this.id.equals(id)) return false;
      verwerfen();
      return true;
    }

    private void verwerfen() {
      if (spool != null) { try { spool.delete(); } catch (Throwable ignored) {} }
      zustand = FREI;
      id = null; ziel = null; name = null; typ = null; spool = null; schluessel = null;
      bytes = 0; summe = 0; teile = 0; angekommen = 0;
    }
  }

  // ------------------------------------------------------------- Weiche

  /**
   * Beantwortet eine Anfrage an {@link #WURZEL}. Rein: kein Android, kein
   * Dialog — gibt die {@link Antwort} zurueck, und wenn sie eine {@link Datei}
   * traegt, oeffnet der Rand den Dialog.
   *
   * <p>Vier Riegel, bevor irgendetwas gesammelt wird. Sie gibt es, weil
   * {@code shouldInterceptRequest} JEDE Anfrage sieht — auch ein
   * {@code <img src="/__huelle/datei/start?…">} aus eingeschleustem Text oder
   * einen Link, der den ganzen Rahmen dorthin navigiert:
   * <ul>
   *   <li>nur {@code GET} (ein {@code OPTIONS} einer fremden Seite bekommt 405
   *       und KEINE CORS-Kopfzeilen — der Vorflug scheitert);</li>
   *   <li>nie fuer den Hauptrahmen — eine Navigation ist kein Export;</li>
   *   <li>die Kopfzeile {@link #KOPF} muss da sein: ein Bild, ein Skript, ein
   *       Stylesheet koennen keine eigenen Kopfzeilen setzen, eine fremde
   *       Seite nicht ohne erfolgreichen Vorflug, und {@code no-cors} kennt
   *       keine;</li>
   *   <li>kommt eine {@code Origin}- oder {@code Referer}-Zeile mit, muss sie
   *       zum eigenen Ursprung gehoeren.</li>
   * </ul>
   *
   * @param pfad    der KODIERTE Pfad der Adresse (beginnt mit {@link #WURZEL})
   * @param abfrage die KODIERTE Abfrage ohne {@code ?}
   * @param kopf    die Kopfzeilen der Anfrage (Gross-/Kleinschreibung egal)
   */
  public static Antwort beantworte(Sammler s, String methode, boolean hauptRahmen, String pfad,
                                   String abfrage, Map<String, String> kopf, long jetzt) {
    // Eine Ausnahme auf dem Faden von shouldInterceptRequest beendet die
    // GANZE App — und ausloesen koennte sie jede Anfrage. Deshalb wirft diese
    // Funktion nie; auch ein Fehler ist eine Antwort.
    try {
      return beantworteRoh(s, methode, hauptRahmen, pfad, abfrage, kopf, jetzt);
    } catch (Throwable t) {
      return nein("fehler");
    }
  }

  private static Antwort beantworteRoh(Sammler s, String methode, boolean hauptRahmen, String pfad,
                                       String abfrage, Map<String, String> kopf, long jetzt) {
    if (s == null) return nein("huelle");
    if (pfad == null || !pfad.startsWith(WURZEL)) return http(404, "pfad");
    if (!"GET".equalsIgnoreCase(methode)) return http(405, "methode");
    if (hauptRahmen) return http(403, "herkunft");
    if (!kopfOk(kopf)) return http(403, "herkunft");
    Map<String, String> q = abfrage(abfrage);
    if (q == null) return nein("abfrage");
    String schritt = pfad.substring(WURZEL.length());
    if ("start".equals(schritt)) {
      long bytes = zahl(q.get("bytes"));
      long teile = zahl(q.get("teile"));
      if (bytes < 0 || teile < 0 || teile > Integer.MAX_VALUE) return nein("zahl");
      return s.start(q.get("id"), q.get("ziel"), q.get("name"), q.get("typ"), bytes, (int) teile, jetzt);
    }
    if ("teil".equals(schritt)) {
      long i = zahl(q.get("i"));
      if (i < 0 || i > Integer.MAX_VALUE) return nein("zahl");
      return s.teil(q.get("id"), q.get("k"), (int) i, q.get("d"), jetzt);
    }
    if ("fertig".equals(schritt)) return s.fertig(q.get("id"), q.get("k"), jetzt);
    return http(404, "pfad");
  }

  /** Eine nicht-negative Dezimalzahl ohne Vorzeichen und ohne Fuehrungsnullen-Tricks, sonst -1. */
  static long zahl(String z) {
    if (z == null || z.length() == 0 || z.length() > 12) return -1;
    long v = 0;
    for (int i = 0; i < z.length(); i++) {
      char c = z.charAt(i);
      if (c < '0' || c > '9') return -1;
      v = v * 10 + (c - '0');
    }
    return v;
  }

  static boolean kopfOk(Map<String, String> kopf) {
    if (kopf == null) return false;
    String marke = null, origin = null, referer = null;
    for (Map.Entry<String, String> e : kopf.entrySet()) {
      if (e.getKey() == null) continue;
      String k = e.getKey().toLowerCase(Locale.ROOT);
      if (k.equals(KOPF.toLowerCase(Locale.ROOT))) marke = e.getValue();
      else if (k.equals("origin")) origin = e.getValue();
      else if (k.equals("referer")) referer = e.getValue();
    }
    if (!KOPF_WERT.equals(marke)) return false;
    if (origin != null && !Pfade.ORIGIN.equalsIgnoreCase(origin.trim())) return false;
    if (referer != null) {
      String r = referer.trim();
      if (!(r.equalsIgnoreCase(Pfade.ORIGIN) || r.regionMatches(true, 0, Pfade.ORIGIN + "/", 0, Pfade.ORIGIN.length() + 1))) return false;
    }
    return true;
  }
}
