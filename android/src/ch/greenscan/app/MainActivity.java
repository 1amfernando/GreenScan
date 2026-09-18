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

/**
 * Die Huelle. Sie tut genau vier Dinge, und jedes davon, weil eine nackte
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

  @Override
  protected void onCreate(Bundle zustand) {
    super.onCreate(zustand);

    server = new AssetServer(getAssets());

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
        return server.beantworte(anfrage.getUrl());
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
    if (web != null) {
      try { web.evaluateJavascript("window.gsHuellePause && window.gsHuellePause();", null); } catch (Throwable ignored) {}
      web.onPause();
    }
    super.onPause();
  }

  @Override
  protected void onResume() { super.onResume(); if (web != null) web.onResume(); }

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
