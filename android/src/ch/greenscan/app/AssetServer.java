package ch.greenscan.app;

import android.content.res.AssetManager;
import android.net.Uri;
import android.os.SystemClock;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.BufferedReader;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Liefert die App AUS DEM PAKET aus — unter dem ECHTEN Ursprung
 * {@code https://green-scan.ch}.
 *
 * <p>Warum der echte Ursprung und nicht {@code file://} oder ein erfundener
 * Name: an einem Ursprung haengt in dieser App fast alles — der localStorage
 * mit allen Pflanzen, Gaerten und Einstellungen, die CORS-Antwort von
 * Supabase, die Rueckkehradressen der Anmeldung, Stripe. Mit dem echten
 * Ursprung ist am Backend NICHTS zu aendern, und der Speicher der App bleibt
 * ueber jedes Update hinweg derselbe.
 *
 * <p>Was er NICHT heisst: dass App und Browser sich einen Speicher teilen.
 * Eine WebView hat ihre eigene Ablage, auch bei gleichem Ursprung. Wer die
 * App installiert, meldet sich an und bekommt seine Daten aus der Cloud —
 * dieselbe Support-Frage wie bei der zweiten Auslieferung (CLAUDE.md §2.1).
 *
 * <p>DIE REGEL, die dieses ganze Stueck traegt: fuer eine Adresse INNERHALB
 * des Ursprungs wird nie {@code null} zurueckgegeben. {@code null} heisst in
 * einer WebView „hol es aus dem Netz" — und damit waere die App wieder eine
 * Webseite in einer Huelle, die ohne Empfang leer bleibt und im schlimmsten
 * Fall eine Datei aus dem Netz UEBER die Datei aus dem Paket legt. Was das
 * Paket nicht kennt, bekommt eine 404 aus dem Paket. Alles AUSSERHALB des
 * Ursprungs (Supabase, KI, Wetter, Kartenkacheln) gibt {@code null} — das
 * soll und muss ins Netz.
 */
final class AssetServer {

  /** Der Ursprung, unter dem die App laeuft — derselbe wie im Web. */
  static final String ORIGIN = Pfade.ORIGIN;
  static final String HOST = Pfade.HOST;

  /** Wurzel der mitgelieferten Dateien im Paket. */
  private static final String WURZEL = "www";

  private final AssetManager assets;
  /** Kopfzeilen aus dem mitgelieferten `_headers` — eine Quelle fuer Web und App. */
  private final Map<String, String> kopfzeilen;

  AssetServer(AssetManager assets, Export.Sammler sammler) {
    this.assets = assets;
    this.kopfzeilen = kopfzeilenLesen(assets);
    this.sammler = sammler;
  }

  /** Gehoert die Adresse zu unserem Ursprung? — die Regel steht in {@link Pfade}. */
  static boolean imUrsprung(Uri u) {
    if (u == null) return false;
    return Pfade.imUrsprung(u.getScheme(), u.getHost());
  }

  /**
   * Wohin eine fertig eingesammelte Datei geht — {@link MainActivity} setzt
   * das Ziel und oeffnet den Dialog. Der Kanal selbst steht in {@link Export}.
   */
  interface DateiZiel { void uebergeben(Export.Datei d); }

  private volatile DateiZiel dateiZiel;
  private final Export.Sammler sammler;

  void setDateiZiel(DateiZiel z) { this.dateiZiel = z; }
  Export.Sammler sammler() { return sammler; }

  /**
   * Beantwortet eine Anfrage. {@code null} NUR fuer fremde Urspruenge.
   *
   * <p>Die Adressen unter {@link Export#WURZEL} sind der Kanal fuer Export und
   * Drucken (v33.53) — sie werden VOR der Suche im Paket beantwortet und
   * bekommen nie {@code null}: auch eine abgewiesene Anfrage ist eine Antwort
   * aus der Huelle, keine Einladung, es im Netz zu versuchen.
   */
  WebResourceResponse beantworte(Uri u, String methode, boolean hauptRahmen, Map<String, String> kopfzeilenDerAnfrage) {
    if (!imUrsprung(u)) return null;      // fremd -> ins Netz, so soll es sein

    String roh = u.getEncodedPath();
    if (roh != null && roh.startsWith(Export.WURZEL)) {
      return kanal(Export.beantworte(sammler, methode, hauptRahmen, roh, u.getEncodedQuery(),
          kopfzeilenDerAnfrage, SystemClock.elapsedRealtime()));   // monoton: eine verstellte Uhr blockiert nichts
    }

    String pfad = pfadNormieren(u.getPath());
    if (pfad == null) return vierNullVier();   // Pfad wollte aus dem Paket heraus

    InputStream in = oeffne(pfad);
    if (in == null) return vierNullVier();     // im Paket nicht vorhanden

    Map<String, String> kopf = new LinkedHashMap<String, String>(kopfzeilen);
    // Eine Datei aus dem Paket ist genau so alt wie das Paket. Sie darf nicht
    // von einem alten Zwischenspeicher der WebView ueberlebt werden, wenn eine
    // neue Fassung installiert wird.
    kopf.put("Cache-Control", "no-cache");
    return new WebResourceResponse(mimeTyp(pfad), "UTF-8", 200, "OK", kopf, in);
  }

  /** Der Pfad im Paket, oder {@code null} — die Regel steht in {@link Pfade}. */
  static String pfadNormieren(String pfad) {
    return Pfade.normieren(pfad);
  }

  private InputStream oeffne(String pfad) {
    try {
      return assets.open(WURZEL + "/" + pfad, AssetManager.ACCESS_STREAMING);
    } catch (IOException e) {
      return null;
    }
  }

  /**
   * Die Antwort des Kanals. Traegt sie eine fertige Datei, geht die an
   * {@link MainActivity} — ist dort (noch) niemand, wird der Vorgang sofort
   * abgeschlossen und die Seite bekommt ein Nein, statt auf einen Dialog zu
   * warten, den es nie geben wird.
   */
  private WebResourceResponse kanal(Export.Antwort a) {
    if (a.datei != null) {
      DateiZiel z = dateiZiel;
      try {
        if (z == null) throw new IllegalStateException("kein Ziel");
        z.uebergeben(a.datei);
      } catch (Throwable t) {
        // Nie eine Ausnahme auf diesem Faden — sie beendete die ganze App.
        sammler.abschliessen(a.datei.id);
        a = Export.nein("huelle");
      }
    }
    byte[] rumpf;
    try { rumpf = a.json().getBytes("UTF-8"); } catch (java.io.UnsupportedEncodingException e) { rumpf = new byte[0]; }
    Map<String, String> kopf = new HashMap<String, String>();
    kopf.put("Cache-Control", "no-store");
    kopf.put("X-Content-Type-Options", "nosniff");
    String text = a.status == 200 ? "OK" : a.status == 403 ? "Forbidden" : a.status == 405 ? "Method Not Allowed" : "Not Found";
    return new WebResourceResponse("application/json", "UTF-8", a.status, text, kopf, new ByteArrayInputStream(rumpf));
  }

  /**
   * Die Antwort auf „gibt es im Paket nicht". Bewusst eine ECHTE Antwort und
   * kein {@code null} — siehe Klassenkommentar.
   */
  private WebResourceResponse vierNullVier() {
    byte[] leer = new byte[0];
    Map<String, String> kopf = new HashMap<String, String>();
    kopf.put("Cache-Control", "no-store");
    return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
        kopf, new ByteArrayInputStream(leer));
  }

  /**
   * Liest die Kopfzeilen aus dem mitgelieferten `_headers`.
   *
   * <p>Ein gefaehrlicher Unterschied zwischen Web und App waere sonst
   * ausgerechnet die CSP: sie kommt im Web vom Hoster (`_headers`), und eine
   * WebView bekommt keinen Hoster. Ohne diese Zeilen liefe die App im Paket
   * OHNE Content-Security-Policy — schwaecher als im Browser, und niemand
   * wuerde es merken. Gelesen wird der Abschnitt `/*`; Zeilen fuer einzelne
   * Pfade (noindex fuer docs/ und Freunde) sind hier ohne Bedeutung, weil
   * diese Verzeichnisse gar nicht im Paket liegen.
   */
  private static Map<String, String> kopfzeilenLesen(AssetManager assets) {
    StringBuilder b = new StringBuilder();
    BufferedReader r = null;
    try {
      r = new BufferedReader(new InputStreamReader(assets.open(WURZEL + "/_headers"), "UTF-8"));
      String z;
      while ((z = r.readLine()) != null) b.append(z).append('\n');
    } catch (IOException e) {
      // Kein Rueckfall auf „gar keine Kopfzeilen": lieber eine harte,
      // mitgelieferte Mindestregel als stillschweigend ohne CSP laufen.
      Map<String, String> not = new LinkedHashMap<String, String>();
      not.put("Content-Security-Policy", "default-src 'self' https: data: blob:; frame-ancestors 'none'; base-uri 'self'");
      not.put("X-Content-Type-Options", "nosniff");
      return not;
    } finally {
      if (r != null) try { r.close(); } catch (IOException ignored) {}
    }
    return Pfade.kopfzeilen(b.toString());
  }

  /** Inhaltstyp nach Endung — die Liste steht in {@link Pfade}. */
  static String mimeTyp(String pfad) {
    return Pfade.mimeTyp(pfad);
  }
}
