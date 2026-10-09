package ch.greenscan.app;

import android.app.Activity;
import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintJob;
import android.print.PrintManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.util.HashMap;

/**
 * Die Druckansicht — eine EIGENE WebView, nicht die der App (v33.53).
 *
 * <p>Warum eine eigene: die App-WebView zu drucken druckte die Oberflaeche
 * statt des Dokuments, und waehrend der Umwandlung darf sie nicht gezeichnet
 * werden (Android-Doku zu {@code createPrintDocumentAdapter}). Und
 * {@code window.print()} tut in einer WebView ohnehin nichts.
 *
 * <p>Was gedruckt wird, kann Text aus fremder Hand enthalten (KI-Antworten im
 * Gartenplan). Deshalb laeuft die Ansicht als geschlossener Kasten — und zwar
 * in einer eigenen Klasse, damit `apk_check` genau DIESE Einstellungen prueft
 * und nicht die gleichnamigen der App-WebView mitzaehlt:
 * <ul>
 *   <li>kein JavaScript, kein DOM-Speicher, kein Standort;</li>
 *   <li>kein Netz ({@code setBlockNetworkLoads}) — und dazu beantwortet sie
 *       JEDE Unteranfrage selbst mit einer leeren Antwort, ausser
 *       {@code data:} (eingebettete Bilder). Nie die App, nie der Kanal;</li>
 *   <li>kein Datei- und kein Inhaltszugriff (Inhaltszugriff ist sonst AN);</li>
 *   <li>sie navigiert nirgendwohin — auch ein {@code <meta http-equiv="refresh">}
 *       geht ins Leere, und das wirkt auch ohne JavaScript;</li>
 *   <li>Grundadresse {@code null}: das Dokument ist NICHT im Ursprung der App;</li>
 *   <li>gedruckt wird erst, wenn das Dokument steht, und genau EINMAL.</li>
 * </ul>
 */
final class DruckAnsicht {

  /** Ruft genau einmal: {@code druck_offen} oder {@code fehler}. */
  interface Ende { void ergebnis(String zustand); }

  private WebView web;

  /** Auf dem UI-Faden rufen, mit der ACTIVITY als Kontext (nur sie darf drucken). */
  void starten(final Activity activity, String html, final String titel, final Ende ende) {
    final PrintManager pm = (PrintManager) activity.getSystemService(Context.PRINT_SERVICE);
    if (html == null || pm == null) { ende.ergebnis("fehler"); return; }
    wegraeumen();
    final WebView w = new WebView(activity);
    WebSettings s = w.getSettings();
    s.setJavaScriptEnabled(false);
    s.setBlockNetworkLoads(true);
    s.setAllowFileAccess(false);
    s.setAllowContentAccess(false);
    s.setAllowFileAccessFromFileURLs(false);
    s.setAllowUniversalAccessFromFileURLs(false);
    s.setDomStorageEnabled(false);
    s.setDatabaseEnabled(false);
    s.setGeolocationEnabled(false);
    web = w;   // feste Referenz — sonst raeumt die Speicherbereinigung sie vor dem Druck ab
    w.setWebViewClient(new WebViewClient() {
      private boolean gedruckt;

      @Override public boolean shouldOverrideUrlLoading(WebView v, String url) { return true; }

      @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
        Uri u = r.getUrl();
        if (u != null && "data".equalsIgnoreCase(u.getScheme())) return null;
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
            new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
      }

      @Override public void onPageFinished(WebView v, String url) {
        if (gedruckt) return;
        gedruckt = true;
        PrintJob job = null;
        try {
          PrintDocumentAdapter innen = v.createPrintDocumentAdapter(titel);
          job = pm.print(titel, new Huelle(innen),
              new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
        } catch (RuntimeException e) {
          job = null;
        }
        if (job == null) { wegraeumen(); ende.ergebnis("fehler"); }
        else ende.ergebnis("druck_offen");
      }
    });
    w.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
  }

  void wegraeumen() {
    if (web != null) { try { web.destroy(); } catch (Throwable ignored) {} web = null; }
  }

  /** Reicht alles an den Adapter der Ansicht weiter — und raeumt sie danach ab. */
  private final class Huelle extends PrintDocumentAdapter {
    private final PrintDocumentAdapter innen;
    Huelle(PrintDocumentAdapter innen) { this.innen = innen; }
    @Override public void onStart() { innen.onStart(); }
    @Override public void onLayout(PrintAttributes alt, PrintAttributes neu, CancellationSignal abbruch,
                                   LayoutResultCallback rueckruf, Bundle extras) {
      innen.onLayout(alt, neu, abbruch, rueckruf, extras);
    }
    @Override public void onWrite(PageRange[] seiten, ParcelFileDescriptor ziel, CancellationSignal abbruch,
                                  WriteResultCallback rueckruf) {
      innen.onWrite(seiten, ziel, abbruch, rueckruf);
    }
    @Override public void onFinish() {
      try { innen.onFinish(); } finally { wegraeumen(); }
    }
  }
}
