package ch.greenscan.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.DocumentsContract;
import android.view.ViewGroup;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Die Huelle. Sie tut genau fuenf Dinge, und jedes davon, weil eine nackte
 * WebView es NICHT von selbst tut:
 *
 * <ol>
 *   <li>Sie liefert die App aus dem Paket aus ({@link AssetServer}).</li>
 *   <li>Sie beantwortet die Berechtigungsfragen der Web-Schicht. Eine WebView
 *       ohne {@code onPermissionRequest} laesst {@code getUserMedia} einfach
 *       ins Leere laufen — der Scanner waere tot, ohne Fehlermeldung.</li>
 *   <li>Sie schickt fremde Adressen nach draussen (Stripe, VAPKO, mailto:)
 *       und behaelt die eigenen drin.</li>
 *   <li>Sie legt den Zurueck-Knopf auf den Verlauf — und damit auf
 *       {@code gsZurueck()}, die seit v33.43 in der App steht.</li>
 *   <li>Sie speichert und druckt, was die App ihr reicht (v33.53): den
 *       Android-Dialog „Speichern unter" und den Druckdialog. Die Datei kommt
 *       ueber Adressen unter dem eigenen Ursprung herein ({@link Export}),
 *       nicht ueber eine Bruecke.</li>
 * </ol>
 *
 * <p>Was sie ausdruecklich NICHT tut: eine Bruecke nach JavaScript aufmachen.
 * Es gibt kein {@code addJavascriptInterface}. Die App braucht keine, und
 * jede waere eine Tuer in die Android-Schicht, die ein eingeschleuster Text
 * (Community, KI-Antwort, Uebersetzung) benutzen koennte.
 */
public class MainActivity extends Activity {

  /** Erkennungszeichen in der Kennung des Browsers — {@code gsLaeuftAlsApp()} liest es. */
  static final String UA_MARKE = "GreenScanApp";

  private WebView web;
  private AssetServer server;

  /** Offene Frage der Web-Schicht nach der Kamera, bis Android geantwortet hat. */
  private PermissionRequest offeneMedienfrage;
  /** Offene Frage der Web-Schicht nach dem Standort. */
  private String offenerOrtUrsprung;
  private GeolocationPermissions.Callback offenerOrtRueckruf;
  /** Offene Dateiauswahl. Wird sie nicht beantwortet, bleibt das Feld fuer immer haengen. */
  private ValueCallback<Uri[]> offeneDateiwahl;

  private static final int ANFRAGE_KAMERA = 71;
  private static final int ANFRAGE_ORT = 72;
  private static final int ANFRAGE_DATEI = 73;
  private static final int ANFRAGE_SPEICHERN = 74;

  /**
   * Der Sammler fuer Export und Drucken — EINER je Prozess, nicht je Activity:
   * dreht jemand das Telefon oder aendert die Schriftgroesse, waehrend der
   * Dialog offen ist, entsteht eine neue Activity, und der Vorgang muss
   * derselbe bleiben. Stirbt der Prozess, liegt die Datei noch in der
   * Spool-Datei, und {@link #onActivityResult} findet sie ueber die Kennung
   * aus {@link #onSaveInstanceState} wieder.
   */
  private static Export.Sammler sammler;

  /** Der Vorgang, dessen Dialog „Speichern unter" gerade offen ist. */
  private String wartetId;
  private long wartetBytes;
  /** Eine Datei, die ankam, waehrend die Activity nicht vorne war. */
  private Export.Datei ausstehend;
  /** Ist die Activity vorne? Einen Dialog oeffnet nur, wer vorne ist (Android 10+). */
  private boolean vorne;
  /** Die Druckansicht — eine eigene, geschlossene WebView (DruckAnsicht.java). */
  private final DruckAnsicht druck = new DruckAnsicht();

  @Override
  protected void onCreate(Bundle zustand) {
    super.onCreate(zustand);

    File ablage = new File(getCacheDir(), "huelle-export");
    if (sammler == null) sammler = new Export.Sammler(ablage);
    if (zustand != null) {
      wartetId = zustand.getString("gs_export_id");
      wartetBytes = zustand.getLong("gs_export_bytes", 0);
    }
    // Was niemand mehr abholt, geht — ausser der Datei, auf deren Dialog
    // gerade gewartet wird (auch ueber einen Prozesstod hinweg).
    try {
      Export.aufraeumen(ablage, wartetId != null ? wartetId : sammler.offeneId(), System.currentTimeMillis());
    } catch (Throwable ignored) {}

    server = new AssetServer(getAssets(), sammler);
    server.setDateiZiel(new AssetServer.DateiZiel() {
      @Override public void uebergeben(final Export.Datei d) {
        // Kommt auf einem Hintergrund-Faden an (shouldInterceptRequest) —
        // Dialoge und WebViews gibt es nur auf dem UI-Faden.
        runOnUiThread(new Runnable() { @Override public void run() { anbieten(d); } });
      }
    });

    web = new WebView(this);
    web.setLayoutParams(new ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    setContentView(web);

    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);          // localStorage — daran haengt in dieser App alles
    s.setDatabaseEnabled(true);
    s.setGeolocationEnabled(true);
    s.setLoadWithOverviewMode(false);
    s.setUseWideViewPort(false);
    s.setSupportZoom(false);
    s.setBuiltInZoomControls(false);
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setJavaScriptCanOpenWindowsAutomatically(true);
    s.setSupportMultipleWindows(false);

    // Die App liegt im Paket und wird ueber shouldInterceptRequest ausgeliefert.
    // Einen Weg ueber file:// oder content:// braucht sie dafuer NICHT — und
    // jeder davon waere ein Weg, an dem ein eingeschleustes Dokument an die
    // Dateien des Geraets kaeme.
    s.setAllowFileAccess(false);
    s.setAllowContentAccess(false);
    s.setAllowFileAccessFromFileURLs(false);
    s.setAllowUniversalAccessFromFileURLs(false);
    s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

    // So erkennt die Web-Schicht die Huelle: gsLaeuftAlsApp() sucht diese Marke.
    // Eine Kennung, keine Bruecke — sie kann nichts ausloesen.
    s.setUserAgentString(s.getUserAgentString() + " " + UA_MARKE + "/" + BuildInfo.VERSION);

    web.setWebViewClient(new WebViewClient() {
      @Override
      public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest anfrage) {
        return server.beantworte(anfrage.getUrl(), anfrage.getMethod(), anfrage.isForMainFrame(),
            anfrage.getRequestHeaders());
      }

      /**
       * Bewusst die aeltere Fassung mit der Zeichenkette: die neuere
       * ({@code WebResourceRequest}) gibt es erst ab API 24, und ihre
       * Vorgabe-Umsetzung ruft genau diese hier. Eine Regel, beide Wege.
       */
      @Override
      public boolean shouldOverrideUrlLoading(WebView v, String url) {
        Uri u = Uri.parse(url);
        if (AssetServer.imUrsprung(u)) return false;   // bleibt in der App
        nachDraussen(u);
        return true;
      }
    });

    web.setWebChromeClient(new WebChromeClient() {

      /** Kamera und Mikrofon. Ohne diese Methode passiert bei getUserMedia NICHTS. */
      @Override
      public void onPermissionRequest(final PermissionRequest anfrage) {
        boolean willKamera = false;
        String[] res = anfrage.getResources();
        for (int i = 0; i < res.length; i++) {
          if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res[i])) willKamera = true;
        }
        if (!willKamera) { anfrage.deny(); return; }

        if (hatRecht(Manifest.permission.CAMERA)) {
          anfrage.grant(new String[]{ PermissionRequest.RESOURCE_VIDEO_CAPTURE });
        } else {
          offeneMedienfrage = anfrage;
          frage(new String[]{ Manifest.permission.CAMERA }, ANFRAGE_KAMERA);
        }
      }

      @Override
      public void onPermissionRequestCanceled(PermissionRequest anfrage) {
        if (offeneMedienfrage == anfrage) offeneMedienfrage = null;
      }

      /** Standort. Ohne diese Methode liefert navigator.geolocation nie etwas. */
      @Override
      public void onGeolocationPermissionsShowPrompt(String ursprung,
          GeolocationPermissions.Callback rueckruf) {
        if (hatRecht(Manifest.permission.ACCESS_FINE_LOCATION)
            || hatRecht(Manifest.permission.ACCESS_COARSE_LOCATION)) {
          // `false` beim Merken: ueber den Standort entscheidet Android, nicht
          // ein zweiter Speicher in der WebView. Wo zwei Stellen dieselbe Frage
          // beantworten, gewinnt die, die sie beantworten DARF.
          rueckruf.invoke(ursprung, true, false);
          return;
        }
        offenerOrtUrsprung = ursprung;
        offenerOrtRueckruf = rueckruf;
        frage(new String[]{ Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION }, ANFRAGE_ORT);
      }

      /** Ein {@code <input type="file">}. Ohne diese Methode tut das Feld nichts. */
      @Override
      public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> rueckruf,
          FileChooserParams p) {
        if (offeneDateiwahl != null) offeneDateiwahl.onReceiveValue(null);
        offeneDateiwahl = rueckruf;
        try {
          startActivityForResult(p.createIntent(), ANFRAGE_DATEI);
          return true;
        } catch (ActivityNotFoundException e) {
          // Kein stilles Haengenbleiben: das Feld bekommt seine Absage.
          offeneDateiwahl = null;
          rueckruf.onReceiveValue(null);
          return false;
        }
      }
    });

    netzBeobachten();

    if (zustand == null) {
      // `source=app` statt `source=pwa`: dieselbe Datei, aber die Herkunft ist
      // in der Statistik unterscheidbar.
      web.loadUrl(AssetServer.ORIGIN + "/?source=app");
    } else {
      web.restoreState(zustand);
    }
  }

  /**
   * Der Zurueck-Knopf.
   *
   * <p>Er geht bewusst NICHT an einer eigenen Regel entlang, sondern an den
   * Verlauf. Die App legt seit v33.43 genau EINEN Verlaufseintrag an, solange
   * es etwas zu schliessen gibt ({@code _gsHistSync}); {@code goBack()} loest
   * {@code popstate} aus, und darauf nimmt {@code gsZurueck()} die oberste
   * Schicht ab. Gibt es nichts zu schliessen, gibt es keinen Eintrag,
   * {@code canGoBack()} ist falsch — und der Knopf verlaesst die App, wie er
   * es in jeder Android-App tut.
   *
   * <p>Zwei Regeln fuer dieselbe Frage waeren hier der teure Fehler: eine
   * Huelle, die selbst entscheidet, was „oben" liegt, weiss nichts von den
   * neun Vollbild-Fenstern in {@code GS_VOLLBILD_OVERLAYS}.
   */
  @Override
  public void onBackPressed() {
    if (web != null && web.canGoBack()) { web.goBack(); return; }
    super.onBackPressed();
  }

  @Override
  protected void onSaveInstanceState(Bundle b) {
    super.onSaveInstanceState(b);
    if (web != null) web.saveState(b);
    if (wartetId != null) {
      b.putString("gs_export_id", wartetId);
      b.putLong("gs_export_bytes", wartetBytes);
    }
  }

  /**
   * Beim Verlassen: der App sagen, dass sie sichern soll.
   *
   * Eine WebView feuert beim Beenden der Activity WEDER {@code pagehide} NOCH
   * {@code beforeunload} — genau die zwei Ereignisse, an denen in dieser App
   * fuenf Stellen haengen, darunter der Cloud-Abgleich ({@code flushNow}) und
   * die XP-Buchung. Ohne diesen Anstoss geht die letzte Aenderung verloren,
   * sobald jemand die App wegwischt: lautlos, und genau dort, wo es weh tut.
   *
   * Gerufen wird die EINE Funktion, die die App dafuer bereitstellt; sie loest
   * intern {@code pagehide} aus, damit es kein zweiter Weg neben den fuenf
   * vorhandenen wird.
   */
  @Override
  protected void onPause() {
    vorne = false;
    if (web != null) {
      try { web.evaluateJavascript("window.gsHuellePause && window.gsHuellePause();", null); } catch (Throwable ignored) {}
      web.onPause();
    }
    super.onPause();
  }

  @Override
  protected void onResume() {
    super.onResume();
    vorne = true;
    if (web != null) web.onResume();
    if (ausstehend != null) { Export.Datei d = ausstehend; ausstehend = null; anbieten(d); }
  }

  /**
   * Der Netzzustand.
   *
   * {@code navigator.onLine} und die Ereignisse {@code online}/{@code offline}
   * werden in einer WebView NICHT von selbst gepflegt — sie folgen dem, was der
   * Wirt mit {@link WebView#setNetworkAvailable} sagt. Diese App wird im Wald
   * benutzt; dreissig Stellen fragen {@code navigator.onLine}, und die
   * Warteschlange fuer offline angelegte Eintraege haengt daran. Ein Wert, der
   * dauerhaft auf „online" steht, heisst: die App versucht es, scheitert, und
   * zeigt einen Fehler, wo sie „📵 Offline gespeichert" sagen sollte.
   *
   * {@code registerNetworkCallback} gibt es seit API 21 —
   * {@code registerDefaultNetworkCallback} erst ab 24 und damit nicht in
   * android.jar 23.
   */
  private void netzBeobachten() {
    try {
      final ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
      if (cm == null) return;
      netzMelden(cm.getActiveNetworkInfo() != null && cm.getActiveNetworkInfo().isConnected());
      NetworkRequest anfrage = new NetworkRequest.Builder()
          .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET).build();
      cm.registerNetworkCallback(anfrage, new ConnectivityManager.NetworkCallback() {
        @Override public void onAvailable(Network n) { netzMelden(true); }
        @Override public void onLost(Network n) {
          // „Ein Netz ist weg" ist nicht „kein Netz" — beim Wechsel von WLAN
          // auf Mobilfunk faellt EINES weg, waehrend das andere schon da ist.
          boolean da = false;
          try {
            ConnectivityManager c2 = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            da = c2 != null && c2.getActiveNetworkInfo() != null && c2.getActiveNetworkInfo().isConnected();
          } catch (Throwable ignored) {}
          netzMelden(da);
        }
      });
    } catch (Throwable ignored) {}
  }

  private void netzMelden(final boolean da) {
    if (web == null) return;
    web.post(new Runnable() {
      @Override public void run() {
        try { web.setNetworkAvailable(da); } catch (Throwable ignored) {}
      }
    });
  }

  // ---------------------------------------------------------------- Helfer

  private boolean hatRecht(String recht) {
    return checkSelfPermission(recht) == PackageManager.PERMISSION_GRANTED;
  }

  private void frage(String[] rechte, int kennung) {
    requestPermissions(rechte, kennung);
  }

  /**
   * Fremde Adressen gehen nach draussen — der Browser, die Mail-App, das
   * Telefon. {@code resolveActivity} wird bewusst nicht gefragt: ab
   * targetSdk 30 sieht eine App fremde Anwendungen nur noch mit einem
   * {@code <queries>}-Eintrag, und eine Sichtpruefung, die dann `null` liefert,
   * verschluckt einen Link, den das Geraet sehr wohl oeffnen koennte.
   */
  private void nachDraussen(Uri u) {
    try {
      Intent i = new Intent(Intent.ACTION_VIEW, u);
      i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      startActivity(i);
    } catch (ActivityNotFoundException e) {
      Toast.makeText(this, getString(R.string.kein_ziel), Toast.LENGTH_SHORT).show();
    }
  }

  // ------------------------------------------------- Export und Drucken

  /**
   * Eine fertig eingesammelte Datei anbieten: „Speichern unter" oder Drucken.
   * Nur auf dem UI-Faden, und nur, wenn die Activity vorne ist — ab Android 10
   * verwirft das System einen Dialog aus dem Hintergrund still, und der
   * Vorgang stuende fuer immer auf „wartet".
   */
  private void anbieten(Export.Datei d) {
    if (!vorne) { ausstehend = d; return; }
    if ("drucken".equals(d.ziel)) { drucken(d); return; }
    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
    i.addCategory(Intent.CATEGORY_OPENABLE);
    i.setType(d.typ);
    i.putExtra(Intent.EXTRA_TITLE, d.name);
    wartetId = d.id;
    wartetBytes = d.bytes;
    try {
      startActivityForResult(i, ANFRAGE_SPEICHERN);
    } catch (ActivityNotFoundException e) {
      wartetId = null; wartetBytes = 0;
      abschluss(d.id, "fehler");
    }
  }

  /**
   * Schreibt die Spool-Datei in das Dokument, das der Dialog angelegt hat.
   *
   * <p>Fehlt die Spool-Datei oder hat sie die falsche Laenge (Prozess
   * gestorben, Speicher geraeumt), wird das angelegte Dokument wieder
   * GELOESCHT: eine leere Datei unter dem Namen „Backup" sieht gespeichert aus
   * und ist es nicht. Geschrieben wird mit {@code "wt"} — beim ERSETZEN einer
   * vorhandenen Datei kuerzt {@code "w"} bei manchen Anbietern nicht, und der
   * Rest der alten Datei bliebe hinten stehen.
   */
  private String schreiben(Uri ziel, File spool, long bytes) {
    if (!Export.spoolPasst(spool, bytes)) { dokumentLoeschen(ziel); return "fehler"; }
    InputStream in = null;
    OutputStream out = null;
    try {
      try { out = getContentResolver().openOutputStream(ziel, "wt"); }
      catch (IllegalArgumentException | UnsupportedOperationException | IOException e) { out = null; }
      if (out == null) out = getContentResolver().openOutputStream(ziel, "w");
      if (out == null) { dokumentLoeschen(ziel); return "fehler"; }
      in = new FileInputStream(spool);
      byte[] puffer = new byte[64 * 1024];
      long geschrieben = 0;
      int n;
      while ((n = in.read(puffer)) > 0) { out.write(puffer, 0, n); geschrieben += n; }
      out.flush();
      if (geschrieben != bytes) { schliessen(out); out = null; dokumentLoeschen(ziel); return "fehler"; }
      return "gespeichert";
    } catch (Throwable e) {
      schliessen(out); out = null;
      dokumentLoeschen(ziel);
      return "fehler";
    } finally {
      schliessen(in);
      schliessen(out);
    }
  }

  private void dokumentLoeschen(Uri u) {
    try { DocumentsContract.deleteDocument(getContentResolver(), u); } catch (Throwable ignored) {}
  }

  private static void schliessen(java.io.Closeable c) {
    if (c != null) try { c.close(); } catch (Throwable ignored) {}
  }

  /**
   * Das Ergebnis an die Seite melden — mit einer Kennung und einem Zustand,
   * die {@link Export#rueckruf} vorher geprueft hat. Antwortet die Seite mit
   * {@code false} (sie wurde neu geladen, niemand wartet mehr), sagt es die
   * Huelle selbst: sonst erfaehrt niemand, ob die Datei angekommen ist.
   */
  private void abschluss(final String id, final String zustand) {
    if (sammler != null) sammler.abschliessen(id);
    final String js = Export.rueckruf(id, zustand);
    if (js == null || web == null) return;
    web.post(new Runnable() {
      @Override public void run() {
        try {
          web.evaluateJavascript(js, new ValueCallback<String>() {
            @Override public void onReceiveValue(String antwort) {
              if ("true".equals(antwort)) return;
              if ("druck_offen".equals(zustand)) return;     // der Druckdialog steht ohnehin vorne
              int text = "gespeichert".equals(zustand) ? R.string.export_gespeichert
                                                       : R.string.export_nicht_gespeichert;
              Toast.makeText(MainActivity.this, getString(text), Toast.LENGTH_LONG).show();
            }
          });
        } catch (Throwable ignored) {}
      }
    });
  }

  /** Drucken geht durch die eigene Druckansicht — die Regeln stehen dort. */
  private void drucken(final Export.Datei d) {
    String titel = d.name.replaceAll("(?i)\\.html?$", "");
    druck.starten(this, lesen(d.spool), titel, new DruckAnsicht.Ende() {
      @Override public void ergebnis(String zustand) { abschluss(d.id, zustand); }
    });
  }

  /** Liest die Spool-Datei als UTF-8 — oder {@code null}. Drucken ist auf MAX_DRUCK_BYTES gedeckelt. */
  private static String lesen(File f) {
    if (f == null || !f.isFile() || f.length() > Export.MAX_DRUCK_BYTES) return null;
    InputStream in = null;
    try {
      in = new FileInputStream(f);
      byte[] b = new byte[(int) f.length()];
      int o = 0, n;
      while (o < b.length && (n = in.read(b, o, b.length - o)) > 0) o += n;
      if (o != b.length) return null;
      return new String(b, "UTF-8");
    } catch (IOException e) {
      return null;
    } finally {
      schliessen(in);
    }
  }

  @Override
  public void onRequestPermissionsResult(int kennung, String[] rechte, int[] ergebnis) {
    boolean ja = false;
    for (int i = 0; i < ergebnis.length; i++) {
      if (ergebnis[i] == PackageManager.PERMISSION_GRANTED) ja = true;
    }
    if (kennung == ANFRAGE_KAMERA) {
      if (offeneMedienfrage != null) {
        if (ja) offeneMedienfrage.grant(new String[]{ PermissionRequest.RESOURCE_VIDEO_CAPTURE });
        else offeneMedienfrage.deny();
        offeneMedienfrage = null;
      }
    } else if (kennung == ANFRAGE_ORT) {
      if (offenerOrtRueckruf != null) {
        offenerOrtRueckruf.invoke(offenerOrtUrsprung, ja, false);
        offenerOrtRueckruf = null;
        offenerOrtUrsprung = null;
      }
    } else {
      super.onRequestPermissionsResult(kennung, rechte, ergebnis);
    }
  }

  @Override
  protected void onActivityResult(int kennung, int ergebnis, Intent daten) {
    if (kennung == ANFRAGE_SPEICHERN) {
      final String id = wartetId;
      final long bytes = wartetBytes;
      wartetId = null;
      wartetBytes = 0;
      final Uri ziel = (ergebnis == Activity.RESULT_OK && daten != null) ? daten.getData() : null;
      if (id == null) {
        // Ein Ergebnis ohne Vorgang: die Kennung ist verloren. Was der Dialog
        // angelegt hat, ist leer — und wird wieder geloescht.
        if (ziel != null) dokumentLoeschen(ziel);
        return;
      }
      if (ziel == null) { abschluss(id, "abgebrochen"); return; }
      final File spool = new File(new File(getCacheDir(), "huelle-export"), Export.spoolName(id));
      // Schreiben auf einem eigenen Faden: ein Cloud-Anbieter (Drive) kann
      // blockieren, und auf dem UI-Faden waere das nach 5 s ein ANR.
      new Thread(new Runnable() {
        @Override public void run() { abschluss(id, schreiben(ziel, spool, bytes)); }
      }).start();
      return;
    }
    if (kennung == ANFRAGE_DATEI) {
      if (offeneDateiwahl == null) return;
      // Auch ein Abbruch wird beantwortet — sonst wartet das Feld fuer immer
      // und laesst sich kein zweites Mal oeffnen.
      Uri[] gewaehlt = (ergebnis == Activity.RESULT_OK)
          ? WebChromeClient.FileChooserParams.parseResult(ergebnis, daten)
          : null;
      offeneDateiwahl.onReceiveValue(gewaehlt);
      offeneDateiwahl = null;
      return;
    }
    super.onActivityResult(kennung, ergebnis, daten);
  }
}
