package ch.greenscan.app;

/**
 * Die RECHNUNG hinter der Auslieferung aus dem Paket — ohne eine einzige
 * Android-Abhaengigkeit.
 *
 * <p>Warum getrennt: hier laeuft kein Android, und eine Regel, die man nicht
 * AUSFUEHREN kann, hat man nicht geprueft (v33.41). Genau dieselbe Aufteilung
 * wie bei den Edge-Functions — die Rechnung in einem Modul, das jeder
 * ausfuehren kann (`_shared/ingest_regeln.mjs`), und die Function ist nur der
 * duenne Rand darum. {@link AssetServer} ist hier der Rand; `apk_check.js`
 * uebersetzt DIESE Klasse und faehrt sie gegen echte Faelle.
 *
 * <p>Wer eine Regel aendert, aendert sie hier und im Fall — nie im Rand.
 */
public final class Pfade {

  private Pfade() {}

  /**
   * Macht aus dem Pfad einer Adresse den Pfad im Paket — oder {@code null},
   * wenn er aus dem Paket herausfuehrt.
   *
   * <p>Drei Regeln, und jede hat einen Grund:
   * <ul>
   *   <li>Die Abfrage faellt weg. Im Netz sind {@code plants.v1.js?v=1} und
   *       {@code plants.v1.js} zwei Zwischenspeicher-Eintraege — im Paket ist
   *       es EINE Datei. (Im Service Worker ist es bewusst andersherum.)</li>
   *   <li>Leer wird {@code index.html}. Die App startet auf {@code /?source=app}.</li>
   *   <li>Kein {@code ..}, kein Backslash, kein Nullbyte — und zwar auch
   *       NACH dem Dekodieren, sonst kommt {@code %2e%2e%2f} durch.</li>
   * </ul>
   */
  /** Der Ursprung, unter dem die App laeuft — derselbe wie im Web. */
  public static final String ORIGIN = "https://green-scan.ch";
  public static final String HOST = "green-scan.ch";

  /**
   * Gehoert eine Adresse zu unserem Ursprung?
   *
   * <p>Das ist die Weiche zwischen „aus dem Paket" und „ins Netz" — und sie
   * muss fuer DREI Arten von Adressen richtig entscheiden:
   * <ul>
   *   <li>{@code https://green-scan.ch/…} → aus dem Paket.</li>
   *   <li>{@code https://…supabase.co}, die KI, das Wetter, Kartenkacheln →
   *       ins Netz.</li>
   *   <li>{@code blob:} und {@code data:} → die WebView macht das SELBST.
   *       Der Scanner baut aus jedem Foto eine {@code blob:}-Adresse; wuerde
   *       sie hier abgefangen, saehe man kein einziges aufgenommenes Bild.
   *       Achtung auf die Form: bei {@code blob:https://green-scan.ch/uuid}
   *       ist das Schema {@code blob}, nicht {@code https} — wer nur auf den
   *       Wirt prueft, faengt genau diese Adressen ein.</li>
   * </ul>
   */
  public static boolean imUrsprung(String schema, String wirt) {
    if (schema == null || wirt == null) return false;
    return "https".equalsIgnoreCase(schema) && HOST.equalsIgnoreCase(wirt);
  }

  public static String normieren(String pfad) {
    if (pfad == null || pfad.length() == 0) pfad = "/";
    int frage = pfad.indexOf('?');
    if (frage >= 0) pfad = pfad.substring(0, frage);
    int raute = pfad.indexOf('#');
    if (raute >= 0) pfad = pfad.substring(0, raute);
    while (pfad.startsWith("/")) pfad = pfad.substring(1);
    if (pfad.length() == 0) pfad = "index.html";

    if (!sauber(pfad)) return null;
    String dek = prozentDekodieren(pfad);
    if (dek == null) return null;
    if (!sauber(dek)) return null;
    // Doppelt kodiert (%252e%252e) — noch einmal ansehen, dann ist Schluss.
    String dek2 = prozentDekodieren(dek);
    if (dek2 == null || !sauber(dek2)) return null;
    return dek;
  }

  private static boolean sauber(String p) {
    if (p.indexOf("..") >= 0) return false;
    if (p.indexOf('\\') >= 0) return false;
    if (p.indexOf('\0') >= 0) return false;
    if (p.startsWith("/")) return false;
    return true;
  }

  /** Prozent-Dekodierung ohne Android. {@code null} bei kaputter Kodierung. */
  static String prozentDekodieren(String s) {
    if (s.indexOf('%') < 0) return s;
    StringBuilder b = new StringBuilder(s.length());
    for (int i = 0; i < s.length(); i++) {
      char c = s.charAt(i);
      if (c != '%') { b.append(c); continue; }
      if (i + 2 >= s.length()) return null;
      int hi = hex(s.charAt(i + 1));
      int lo = hex(s.charAt(i + 2));
      if (hi < 0 || lo < 0) return null;
      b.append((char) ((hi << 4) | lo));
      i += 2;
    }
    return b.toString();
  }

  private static int hex(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
  }

  /**
   * Inhaltstyp nach Endung. Bewusst eine kurze, GESCHLOSSENE Liste: was das
   * Paket nicht kennt, bekommt {@code application/octet-stream} statt eines
   * geratenen Typs. Ein falsch geratener Typ ist schlimmer als ein
   * unbekannter, weil {@code X-Content-Type-Options: nosniff} ihn festnagelt.
   */
  public static String mimeTyp(String pfad) {
    String p = pfad.toLowerCase(java.util.Locale.ROOT);
    if (p.endsWith(".html") || p.endsWith(".htm")) return "text/html";
    if (p.endsWith(".mjs") || p.endsWith(".js")) return "text/javascript";
    if (p.endsWith(".css")) return "text/css";
    if (p.endsWith(".json")) return "application/json";
    if (p.endsWith(".webmanifest")) return "application/manifest+json";
    if (p.endsWith(".png")) return "image/png";
    if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
    if (p.endsWith(".webp")) return "image/webp";
    if (p.endsWith(".gif")) return "image/gif";
    if (p.endsWith(".svg")) return "image/svg+xml";
    if (p.endsWith(".ico")) return "image/x-icon";
    if (p.endsWith(".woff2")) return "font/woff2";
    if (p.endsWith(".woff")) return "font/woff";
    if (p.endsWith(".ttf")) return "font/ttf";
    if (p.endsWith(".txt")) return "text/plain";
    if (p.endsWith(".xml")) return "application/xml";
    return "application/octet-stream";
  }

  /**
   * Liest die Kopfzeilen aus dem Abschnitt {@code /*} von {@code _headers} —
   * dieselbe Datei, die im Web der Hoster auswertet.
   *
   * <p>Ohne das liefe die App im Paket OHNE Content-Security-Policy: die CSP
   * kommt im Web vom Hoster, und eine WebView hat keinen. Sie waere damit
   * SCHWAECHER als im Browser, und niemand wuerde es merken.
   *
   * @return Zeilen als {@code Name: Wert}, in der Reihenfolge der Datei
   */
  public static java.util.LinkedHashMap<String, String> kopfzeilen(String inhalt) {
    java.util.LinkedHashMap<String, String> m = new java.util.LinkedHashMap<String, String>();
    if (inhalt == null) return m;
    String[] zeilen = inhalt.split("\n", -1);
    boolean drin = false;
    for (int i = 0; i < zeilen.length; i++) {
      String z = zeilen[i];
      if (z.trim().length() == 0) continue;
      if (z.trim().startsWith("#")) continue;
      boolean eingerueckt = z.startsWith(" ") || z.startsWith("\t");
      if (!eingerueckt) { drin = "/*".equals(z.trim()); continue; }
      if (!drin) continue;
      int dp = z.indexOf(':');
      if (dp <= 0) continue;
      String name = z.substring(0, dp).trim();
      String wert = z.substring(dp + 1).trim();
      if (name.length() == 0 || wert.length() == 0) continue;
      // HSTS ist eine Anweisung an einen Browser UEBER EINEN ECHTEN SERVER.
      // In einer Huelle, die ihre Dateien aus dem Paket nimmt, ist sie
      // bedeutungslos — sie wegzulassen ist ehrlicher als sie zu behaupten.
      if ("Strict-Transport-Security".equalsIgnoreCase(name)) continue;
      m.put(name, wert);
    }
    return m;
  }
}
