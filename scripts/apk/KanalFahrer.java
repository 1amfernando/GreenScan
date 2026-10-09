import ch.greenscan.app.Export;
import java.io.*;
import java.util.*;

/**
 * Die Huelle, soweit sie ohne Android laufen kann: ein ECHTER Export.Sammler,
 * Zeile fuer Zeile von apk_check gefuettert. Was die Seite an /__huelle/datei/
 * schickt, geht unveraendert hier hinein — keine Nachbildung in JavaScript.
 *
 *   REQ \t methode \t pfad \t abfrage \t haupt(0/1) \t marke \t origin \t referer
 *       → status \t json \t (id|ziel|name|typ|bytes|spoolpfad  oder  -)
 *   END \t id            → true|false            (Sammler.abschliessen)
 *   CB  \t id \t zustand → js | NULL             (Export.rueckruf)
 * "-" steht fuer „fehlt".
 */
public class KanalFahrer {
  public static void main(String[] a) throws Exception {
    Export.Sammler s = new Export.Sammler(new File(a[0]));
    BufferedReader in = new BufferedReader(new InputStreamReader(System.in, "UTF-8"));
    PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
    long null0 = System.nanoTime();
    String z;
    while ((z = in.readLine()) != null) {
      String[] f = z.split("\t", -1);
      try {
        if ("REQ".equals(f[0])) {
          Map<String, String> kopf = new LinkedHashMap<String, String>();
          if (!"-".equals(f[5])) kopf.put("X-GS-Huelle", f[5]);
          if (!"-".equals(f[6])) kopf.put("Origin", f[6]);
          if (!"-".equals(f[7])) kopf.put("Referer", f[7]);
          long jetzt = (System.nanoTime() - null0) / 1000000L;
          Export.Antwort r = Export.beantworte(s, f[1], "1".equals(f[4]), f[2], "-".equals(f[3]) ? null : f[3], kopf, jetzt);
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
        } else {
          out.println("??");
        }
      } catch (Throwable t) {
        out.println("AUSNAHME\t" + t);
      }
    }
  }
}
