package ch.greenscan.app;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.Map;

/**
 * Die RECHNUNG hinter „Teilen → GreenScan" in der Huelle (v33.56) — ohne eine
 * einzige Android-Abhaengigkeit, aus demselben Grund wie {@link Pfade} und
 * {@link Export}: hier laeuft kein Android, und eine Regel, die man nicht
 * AUSFUEHREN kann, hat man nicht geprueft (v33.41). `apk_check.js` uebersetzt
 * diese Klasse und faehrt sie gegen echte Faelle; {@link MainActivity} und
 * {@link AssetServer} sind nur der Rand darum.
 *
 * <p><b>Der Weg.</b> Eine andere App schickt ein Foto per {@code ACTION_SEND}.
 * Die Huelle prueft die Quelle ({@link #quelleOk}), kopiert die Bytes mit
 * Deckel ({@link #kopieren}) in EIN Fach im Arbeitsspeicher und stoesst die
 * Seite an ({@link #rueckruf} — ein fester Text ohne Daten). Die Seite holt
 * das Foto selbst ab: {@code GET /__huelle/geteilt/holen}, mit denselben
 * Riegeln wie der Export-Kanal — und QUITTIERT es, wenn sie fertig ist
 * ({@code GET /__huelle/geteilt/quittieren}). Zwei Schritte statt „einmal
 * abholen": so laeuft in der Huelle DIESELBE Logik wie in der PWA (die
 * Vorschau kommt wieder, wenn die App sie selbst schliesst; das Foto bleibt
 * bis zum Ergebnis) — dort ist es der Cache-Eintrag, hier das Fach.
 *
 * <p>Es gibt keine Bruecke und keinen Lesezugriff auf Dateien: die Seite
 * bekommt genau die Bytes, die die Person geteilt hat, und sonst nichts.
 */
public final class Geteilt {

  private Geteilt() {}

  /** Wurzel im Pfad — alles darunter beantwortet {@link #beantworte}. */
  public static final String WURZEL = "/__huelle/geteilt/";
  /** Wert der Kopfzeile {@link Export#KOPF} fuer diesen Weg — NICHT der des Export-Kanals. */
  public static final String KOPF_WERT = "geteilt";
  /** = GS_GETEILT_MAX in index.html, = GETEILT_MAX in sw.js. */
  public static final long MAX_BYTES = 15L * 1024 * 1024;
  /** Wie lange ein abgelegtes Foto abgeholt werden kann (= GS_GETEILT_FRISCH_MS). */
  public static final long FRIST_MS = 10L * 60 * 1000;
  /** Wie lange eine Kopie „kommt", bevor sie als gescheitert gilt (eine Quelle, die nie endet). */
  public static final long KOMMT_MAX_MS = 60L * 1000;
  /**
   * Hoechstens so viele Kopien gleichzeitig. Ein Lesen, das nie zurueckkommt,
   * laesst sich nicht abbrechen — ohne Deckel haeufte eine fremde App mit
   * einer Quelle, die nie endet, Faeden und Speicher an.
   */
  public static final int KOPIEN_MAX = 2;

  // ------------------------------------------------------------- Quelle

  /**
   * Darf die Huelle von dieser Adresse lesen? Nur {@code content://} mit einer
   * Autoritaet, die nicht zur eigenen App gehoert.
   *
   * <p>{@code file://} NIE: eine fremde App koennte sonst
   * {@code file:///data/data/ch.greenscan.app/…} schicken — die Huelle laese
   * ihre EIGENEN privaten Dateien und zeigte sie als „Foto" (und schickte sie
   * auf Antippen an die KI). Mit {@code content://} liest sie nur, was ein
   * fremder Anbieter ausdruecklich herausgibt.
   */
  public static boolean quelleOk(String schema, String autoritaet, String eigenesPaket) {
    if (schema == null || !"content".equals(schema.toLowerCase(Locale.ROOT))) return false;
    if (autoritaet == null) return false;
    String a = autoritaet.trim().toLowerCase(Locale.ROOT);
    if (a.length() == 0 || a.indexOf('@') >= 0) return false;
    if (eigenesPaket != null) {
      String p = eigenesPaket.toLowerCase(Locale.ROOT);
      if (a.equals(p) || a.startsWith(p + ".")) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- Typ

  /**
   * Welches Bild ist das wirklich? Dieselbe Regel wie {@code _gsBildTyp} in
   * index.html: der Typ, den die sendende App angibt, ist eine Angabe — die
   * ersten Bytes sind die Datei. Rueckgabe: ein Bildtyp, {@code "heic"}
   * (eigener Satz) oder {@code null}.
   */
  public static String typ(byte[] b, int n) {
    if (b == null || n < 12 || b.length < 12) return null;
    if ((b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return "image/jpeg";
    if ((b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G'
        && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A) return "image/png";
    if (b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8') return "image/gif";
    if (b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
        && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "image/webp";
    if (b[4] == 'f' && b[5] == 't' && b[6] == 'y' && b[7] == 'p') {
      String marke = new String(b, 8, 4, java.nio.charset.StandardCharsets.ISO_8859_1);
      if (marke.matches("heic|heix|hevc|hevx|heim|heis|mif1|msf1")) return "heic";
    }
    return null;
  }

  // ------------------------------------------------------------- Kopie

  /** Die Quelle ist groesser als {@link #MAX_BYTES}. */
  public static final class ZuGross extends IOException {
    public ZuGross() { super("zu gross"); }
  }

  /**
   * Liest hoechstens {@code max} Bytes. Gezaehlt wird SELBST: Groesse und
   * Typ, die ein Anbieter nennt, sind Angaben, keine Masse.
   */
  public static byte[] kopieren(InputStream in, long max) throws IOException {
    if (in == null) throw new IOException("keine Quelle");
    ByteArrayOutputStream out = new ByteArrayOutputStream(64 * 1024);
    byte[] puffer = new byte[64 * 1024];
    long gesamt = 0;
    int r;
    while ((r = in.read(puffer)) != -1) {
      gesamt += r;
      if (gesamt > max) throw new ZuGross();
      out.write(puffer, 0, r);
    }
    return out.toByteArray();
  }

  // -------------------------------------------------------------- Fach

  /**
   * Die Zustaende des Fachs. Achtung auf die Namen: {@code LEER} heisst „nichts
   * geteilt" und wird der Seite als Grund {@code nichts} gemeldet — der Grund
   * {@code leer} heisst wie in der PWA „ein Teilen kam an, aber ohne Foto".
   * Zwei Bedeutungen fuer ein Wort meldeten sonst bei JEDEM Start „kein Foto
   * angekommen" (Entwurfspruefung v33.56).
   */
  public static final String LEER = "leer", KOMMT = "kommt", BEREIT = "bereit", FEHLER = "fehler";

  /**
   * EIN Platz fuer EIN geteiltes Foto, je Prozess. Ein neues Teilen ersetzt
   * ein altes — jedes bekommt eine Nummer ({@link #kommt}), und eine Kopie,
   * die zu spaet fertig wird, ueberschreibt kein neueres Foto.
   *
   * <p>Abgeholt wird EINMAL ({@link #holen}): danach ist das Fach leer. Ein
   * Fehler wird ebenfalls genau einmal gemeldet. Die Uhr kommt als Parameter
   * herein (monoton, vom Rand) — der Pruefstand stellt sie.
   */
  public static final class Fach {
    private String zustand = LEER;
    private String grund;
    private byte[] daten;
    private String typ;
    private int anzahl;
    private long seit;
    private int nummer;
    private int laufend;

    /**
     * Ein Teilen beginnt. Gibt die Nummer zurueck, unter der es abgelegt wird —
     * oder 0, wenn schon {@link #KOPIEN_MAX} Kopien laufen (dann ist das Fach
     * im Zustand {@code fehler}/{@code beschaeftigt}, und es wird nichts gelesen).
     * Zu JEDEM {@code kommt} mit Nummer gehoert genau ein {@link #ablegen} oder
     * {@link #fehler} — der Rand ruft es im {@code finally}.
     */
    public synchronized int kommt(long jetzt) {
      if (laufend >= KOPIEN_MAX) {
        nummer++;
        fehlerIntern("beschaeftigt", jetzt);
        return 0;
      }
      laufend++;
      nummer++;
      zustand = KOMMT; grund = null; daten = null; typ = null; anzahl = 0; seit = jetzt;
      return nummer;
    }

    /** Wie viele Kopien gerade laufen (fuer den Pruefstand). */
    public synchronized int laufend() { return laufend; }

    /** Legt die Bytes ab — nur, wenn {@code n} noch das neueste Teilen ist. */
    public synchronized boolean ablegen(int n, byte[] d, int wieviele, long jetzt) {
      if (n > 0 && laufend > 0) laufend--;
      if (n != nummer || !KOMMT.equals(zustand)) return false;
      String t = d == null ? null : typ(d, d.length);
      if ("heic".equals(t)) return fehlerIntern("heic", jetzt);
      if (t == null) return fehlerIntern("kein_bild", jetzt);
      zustand = BEREIT; daten = d; typ = t; anzahl = Math.max(1, wieviele); seit = jetzt;
      return true;
    }

    /** Das Teilen {@code n} ist gescheitert ({@code gross} · {@code quelle} · {@code fehler}). */
    public synchronized boolean fehler(int n, String g, long jetzt) {
      if (n > 0 && laufend > 0) laufend--;
      if (n != nummer || !KOMMT.equals(zustand)) return false;
      return fehlerIntern(g, jetzt);
    }

    private boolean fehlerIntern(String g, long jetzt) {
      zustand = FEHLER; grund = grundOk(g) ? g : "fehler"; daten = null; typ = null; anzahl = 0; seit = jetzt;
      return true;
    }

    public synchronized String zustand(long jetzt) { ablaufen(jetzt); return zustand; }

    /**
     * Abholen, OHNE zu verbrauchen: BEREIT liefert die Bytes (und die Frist
     * beginnt neu — gezeigt heisst frisch), FEHLER den Grund. Erst
     * {@link #quittieren} leert das Fach.
     */
    public synchronized Antwort holen(long jetzt) {
      ablaufen(jetzt);
      if (BEREIT.equals(zustand)) {
        seit = jetzt;
        return new Antwort(200, true, null, daten, typ, anzahl);
      }
      if (FEHLER.equals(zustand)) return nein(grund);
      return nein(KOMMT.equals(zustand) ? KOMMT : "nichts");
    }

    /** Die Seite ist fertig (bestimmt, verworfen, Grund gesagt): das Fach wird leer. */
    public synchronized Antwort quittieren(long jetzt) {
      ablaufen(jetzt);
      if (BEREIT.equals(zustand) || FEHLER.equals(zustand)) {
        zustand = LEER; grund = null; daten = null; typ = null; anzahl = 0;
      }
      return new Antwort(200, true, null, null, null, 0);
    }

    private void ablaufen(long jetzt) {
      long alter = jetzt - seit;
      if (BEREIT.equals(zustand) && (alter < 0 || alter > FRIST_MS)) { zustand = FEHLER; grund = "weg"; daten = null; }
      else if (KOMMT.equals(zustand) && (alter < 0 || alter > KOMMT_MAX_MS)) { zustand = FEHLER; grund = "fehler"; }
      else if (FEHLER.equals(zustand) && (alter < 0 || alter > FRIST_MS)) { zustand = LEER; grund = null; }
    }
  }

  /** Die Gruende, die die Seite kennt — eine geschlossene Liste. */
  static boolean grundOk(String g) {
    return g != null && g.matches("nichts|leer|kommt|gross|kein_bild|heic|quelle|beschaeftigt|fehler|weg|methode|herkunft|pfad");
  }

  // ----------------------------------------------------------- Antwort

  /** Antwort auf {@code holen}: entweder die Bytes oder ein Grund. */
  public static final class Antwort {
    public final int status;
    public final boolean ok;
    public final String grund;
    public final byte[] daten;
    public final String typ;
    public final int anzahl;
    Antwort(int status, boolean ok, String grund, byte[] daten, String typ, int anzahl) {
      this.status = status; this.ok = ok; this.grund = grund; this.daten = daten; this.typ = typ; this.anzahl = anzahl;
    }
    public String json() {
      return ok ? "{\"huelle\":1,\"ok\":true}" : "{\"huelle\":1,\"ok\":false,\"grund\":\"" + (grundOk(grund) ? grund : "fehler") + "\"}";
    }
  }

  static Antwort nein(String g) { return new Antwort(200, false, g, null, null, 0); }
  static Antwort http(int status, String g) { return new Antwort(status, false, g, null, null, 0); }

  /**
   * Beantwortet eine Anfrage an {@link #WURZEL}. Wirft NIE — eine Ausnahme auf
   * dem Faden von {@code shouldInterceptRequest} beendete die ganze App.
   *
   * <p>Dieselben Riegel wie der Export-Kanal ({@link Export#beantworte}): nur
   * {@code GET}, nie der Hauptrahmen, die Kopfzeile {@code X-GS-Huelle} mit
   * GENAU dem Wert {@link #KOPF_WERT} (der Wert des Export-Kanals gilt hier
   * nicht), {@code Origin}/{@code Referer} nur vom eigenen Ursprung.
   */
  public static Antwort beantworte(Fach f, String methode, boolean hauptRahmen, String pfad,
                                   Map<String, String> kopf, long jetzt) {
    try {
      if (f == null) return nein("fehler");
      if (pfad == null || !pfad.startsWith(WURZEL)) return http(404, "pfad");
      if (!"GET".equalsIgnoreCase(methode)) return http(405, "methode");
      if (hauptRahmen) return http(403, "herkunft");
      if (!Export.kopfOk(kopf, KOPF_WERT)) return http(403, "herkunft");
      String schritt = pfad.substring(WURZEL.length());
      if ("holen".equals(schritt)) return f.holen(jetzt);
      if ("quittieren".equals(schritt)) return f.quittieren(jetzt);
      return http(404, "pfad");
    } catch (Throwable t) {
      return nein("fehler");
    }
  }

  // ---------------------------------------------------------- Abfolge

  /** Oeffnet die geteilte Adresse — der Rand reicht ContentResolver herein, der Pruefstand eine Attrappe. */
  public interface Oeffner { InputStream oeffnen() throws Exception; }

  /**
   * Soll die Huelle diese Absicht annehmen? NUR {@code SEND}/{@code SEND_MULTIPLE},
   * nie eine wiederhergestellte Activity ({@code zustand != null}) und nie ein
   * Start aus der Liste der letzten Apps — Android liefert dort die ALTE
   * Absicht noch einmal ({@code FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY}), und
   * dasselbe Foto kaeme jedes Mal wieder.
   */
  public static boolean sollAnnehmen(boolean wiederhergestellt, int flags, String aktion, int flagAusDerListe) {
    if (wiederhergestellt) return false;
    if ((flags & flagAusDerListe) != 0) return false;
    return "android.intent.action.SEND".equals(aktion) || "android.intent.action.SEND_MULTIPLE".equals(aktion);
  }

  /**
   * Die ganze Annahme eines geteilten Fotos — EINE Stelle, vom Rand auf einem
   * Hintergrund-Faden gerufen und vom Pruefstand mit Attrappen gefahren.
   * Wirft NIE und laesst das Fach nie in {@code kommt}: jede Ausnahme (auch
   * {@code SecurityException} eines Anbieters ohne Leserecht, ein
   * {@code OutOfMemoryError}) endet in {@link Fach#fehler}.
   *
   * @param uri    {@code null}, wenn das Teilen gar keine Adresse trug (→ {@code leer})
   * @return der Zustand des Fachs danach
   */
  public static String annehmen(Fach f, String schema, String autoritaet, boolean uri, String eigenesPaket,
                                int anzahl, Oeffner o, Uhr uhr) {
    if (f == null) return FEHLER;
    int n = f.kommt(uhr.jetzt());
    if (n == 0) return f.zustand(uhr.jetzt());               // schon KOPIEN_MAX unterwegs
    InputStream in = null;
    try {
      if (!uri) { f.fehler(n, "leer", uhr.jetzt()); return f.zustand(uhr.jetzt()); }
      if (!quelleOk(schema, autoritaet, eigenesPaket)) { f.fehler(n, "quelle", uhr.jetzt()); return f.zustand(uhr.jetzt()); }
      in = o.oeffnen();
      byte[] d = kopieren(in, MAX_BYTES);
      f.ablegen(n, d, anzahl, uhr.jetzt());
    } catch (ZuGross e) {
      f.fehler(n, "gross", uhr.jetzt());
    } catch (Throwable t) {
      f.fehler(n, "fehler", uhr.jetzt());
    } finally {
      if (in != null) try { in.close(); } catch (Throwable ignored) {}
    }
    return f.zustand(uhr.jetzt());
  }

  /**
   * Das Teilen liess sich gar nicht erst auspacken (Extras aus fremder Hand
   * werfen beim Entpacken, z. B. {@code BadParcelableException}). Auch das ist
   * ein Teilen, das die Seite erfahren soll — als {@code fehler}, nie als Stille.
   */
  public static String annehmenGescheitert(Fach f, Uhr uhr) {
    if (f == null) return FEHLER;
    int n = f.kommt(uhr.jetzt());
    if (n != 0) f.fehler(n, "fehler", uhr.jetzt());
    return f.zustand(uhr.jetzt());
  }

  /** Die Uhr — monoton im Rand ({@code SystemClock.elapsedRealtime}), gestellt im Pruefstand. */
  public interface Uhr { long jetzt(); }

  /**
   * Der Anstoss an die Seite. Ein FESTER Text ohne Daten — was die Seite
   * braucht, holt sie sich selbst ueber {@link #beantworte}.
   */
  public static String rueckruf() {
    return "window.gsHuelleGeteilt && window.gsHuelleGeteilt();";
  }
}
