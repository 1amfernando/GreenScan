import ch.greenscan.app.Export;
import ch.greenscan.app.Geteilt;
import java.io.*;
import java.util.*;

/**
 * Die Huelle, soweit sie ohne Android laufen kann: ein ECHTER Export.Sammler
 * und (seit v33.56) ein ECHTES Geteilt.Fach, Zeile fuer Zeile von apk_check
 * gefuettert. Was die Seite an /__huelle/ schickt, geht unveraendert hier
 * hinein — keine Nachbildung in JavaScript.
 *
 *   REQ \t methode \t pfad \t abfrage \t haupt(0/1) \t marke \t origin \t referer
 *       → status \t json \t (id|ziel|name|typ|bytes|spoolpfad  oder  -)
 *   END \t id            → true|false            (Sammler.abschliessen)
 *   CB  \t id \t zustand → js | NULL             (Export.rueckruf)
 *
 *   REQG \t methode \t pfad \t abfrage \t haupt \t marke \t origin \t referer
 *       → status \t mime \t Name:Wert|Name:Wert \t base64(Rumpf)
 *         (Geteilt.beantworte; Typ und Kopfzeilen aus Geteilt.Antwort — dieselben,
 *          die AssetServer setzt, keine Nachbildung)
 *   TEILEN \t schema \t autoritaet \t uri(0/1) \t anzahl \t base64|-
 *       → zustand            (Geteilt.annehmen, wie der Faden der Huelle)
 *   LANGSAM \t ms \t base64  → gestartet   (dieselbe Annahme auf einem Faden;
 *       die Quelle braucht ms Millisekunden, bevor sie Bytes liefert)
 *   UHR \t ms            → neuer Versatz  (die monotone Uhr springt vor)
 *   ZUSTAND              → zustand \t nummer \t laufend
 *   ANSTOSS              → js            (Geteilt.rueckruf)
 * "-" steht fuer „fehlt".
 */
public class KanalFahrer {
  static final long null0 = System.nanoTime();
  static volatile long versatz = 0;
  static long jetzt() { return (System.nanoTime() - null0) / 1000000L + versatz; }
  static final Geteilt.Uhr UHR = new Geteilt.Uhr() { public long jetzt() { return KanalFahrer.jetzt(); } };

  static Map<String, String> kopf(String[] f) {
    Map<String, String> kopf = new LinkedHashMap<String, String>();
    if (!"-".equals(f[5])) kopf.put("X-GS-Huelle", f[5]);
    if (!"-".equals(f[6])) kopf.put("Origin", f[6]);
    if (!"-".equals(f[7])) kopf.put("Referer", f[7]);
    return kopf;
  }

  public static void main(String[] a) throws Exception {
    Export.Sammler s = new Export.Sammler(new File(a[0]));
    final Geteilt.Fach fach = new Geteilt.Fach();
    BufferedReader in = new BufferedReader(new InputStreamReader(System.in, "UTF-8"));
    PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
    String z;
    while ((z = in.readLine()) != null) {
      String[] f = z.split("\t", -1);
      try {
        if ("REQ".equals(f[0])) {
          Export.Antwort r = Export.beantworte(s, f[1], "1".equals(f[4]), f[2], "-".equals(f[3]) ? null : f[3], kopf(f), jetzt());
          String d = "-";
          if (r.datei != null) {
            Export.Datei x = r.datei;
            d = x.id + "|" + x.ziel + "|" + x.name + "|" + x.typ + "|" + x.bytes + "|" + x.spool.getAbsolutePath();
          }
          out.println(r.status + "\t" + r.json() + "\t" + d);
        } else if ("END".equals(f[0])) {
          out.println(String.valueOf(s.abschliessen(f[1])));
        } else if ("CB".equals(f[0])) {
          String js = Export.rueckruf(f[1], f[2]);
          out.println(js == null ? "NULL" : js);
        } else if ("REQG".equals(f[0])) {
          Geteilt.Antwort r = Geteilt.beantworte(fach, f[1], "1".equals(f[4]), f[2], "-".equals(f[3]) ? null : f[3], kopf(f), jetzt());
          StringBuilder k = new StringBuilder();
          for (Map.Entry<String, String> e : r.kopfzeilen().entrySet()) {
            if (k.length() > 0) k.append('|');
            k.append(e.getKey()).append(':').append(e.getValue());
          }
          byte[] rumpf = r.foto() ? r.daten : r.json().getBytes("UTF-8");
          out.println(r.status + "\t" + r.mime() + "\t" + k + "\t" + Base64.getEncoder().encodeToString(rumpf));
        } else if ("TEILEN".equals(f[0])) {
          final byte[] d = "-".equals(f[5]) ? new byte[0] : Base64.getDecoder().decode(f[5]);
          String zu = Geteilt.annehmen(fach, fach.kommt(jetzt()), "-".equals(f[1]) ? null : f[1], "-".equals(f[2]) ? null : f[2], "1".equals(f[3]),
              "ch.greenscan.app", Integer.parseInt(f[4]), new Geteilt.Oeffner() {
                public InputStream oeffnen() { return new ByteArrayInputStream(d); } }, UHR);
          out.println(zu);
        } else if ("LANGSAM".equals(f[0])) {
          final long ms = Long.parseLong(f[1]);
          final byte[] d = Base64.getDecoder().decode(f[2]);
          final int n = fach.kommt(jetzt());                 // wie der Rand: die Nummer auf DIESEM Faden
          new Thread(new Runnable() { public void run() {
            Geteilt.annehmen(fach, n, "content", "media", true, "ch.greenscan.app", 1, new Geteilt.Oeffner() {
              public InputStream oeffnen() throws Exception { Thread.sleep(ms); return new ByteArrayInputStream(d); } }, UHR);
          } }).start();
          out.println("gestartet");
        } else if ("UHR".equals(f[0])) {
          versatz += Long.parseLong(f[1]);
          out.println(String.valueOf(versatz));
        } else if ("ZUSTAND".equals(f[0])) {
          out.println(fach.zustand(jetzt()) + "\t" + fach.nummer() + "\t" + fach.laufend());
        } else if ("ANSTOSS".equals(f[0])) {
          out.println(Geteilt.rueckruf());
        } else {
          out.println("??");
        }
      } catch (Throwable t) {
        out.println("AUSNAHME\t" + t);
      }
    }
  }
}
