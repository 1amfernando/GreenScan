/* GreenScan — Release-Archiv (v31.36)
 *
 * Warum diese Datei existiert: GS_RELEASES stand vollstaendig in index.html und
 * war dort 787 KB gross — 14 % der ganzen Datei. Jeder Nutzer lud und parste
 * 383 Changelog-Eintraege bei JEDEM Kaltstart, obwohl die App beim Start nur
 * GS_RELEASES[0] braucht (der „Was ist neu"-Dialog). Die vollstaendige Liste
 * sieht man nur, wenn man im Ueber-Modal den Changelog oeffnet.
 *
 * Die neuesten 12 Eintraege bleiben in index.html — damit funktioniert der
 * Dialog und die juengste Historie ohne Nachladen. Alles Aeltere steht hier und
 * wird per gsLoadReleaseArchive() geholt, wenn der Changelog geoeffnet wird.
 * Der Service Worker cacht die Datei mit (SHELL_URLS), also klappt das auch
 * offline.
 *
 * Dasselbe Vorgehen wie bei data/plants.v1.js seit v25.10.
 *
 * NICHT von Hand pflegen: neue Eintraege kommen oben in index.html dazu
 * (siehe CLAUDE.md §3.1). Wenn die Inline-Liste zu lang wird, wandern die
 * aeltesten hierher — ans ANFANG des Arrays, die Reihenfolge ist neu → alt.
 */
window.GS_RELEASES_ARCHIVE = [
  {
    v: 'v31.63', date: '01.09.2026',
    headline: '\ud83e\udd1d Mischkultur wird jetzt gemessen \u2014 nach Abstand, nicht nach Anwesenheit',
    summary: 'Es gab schon einen roten Schimmer f\u00fcr sich nicht vertragende Pflanzen. Der pr\u00fcfte aber nur, OB ein Gegenspieler im Plan vorkommt \u2014 nicht, wie weit die beiden auseinanderstehen. Zwei Streithähne an entgegengesetzten Enden eines 10-Meter-Gartens leuchteten beide rot.',
    user_summary: '\ud83e\udd1d Der Planer setzt sich nicht vertragende Pflanzen jetzt auseinander \u2014 und wenn im Beet wirklich kein Platz daf\u00fcr ist, sagt er dir, welche zwei zu nah stehen und wie nah.',
    user_items: [
      {emoji:'\ud83d\udccf', bold:'N\u00e4he ist der Punkt, nicht Anwesenheit:', text:' Mischkultur wirkt \u00fcber Wurzelkonkurrenz und Ausd\u00fcnstungen \u2014 also \u00fcber Entfernung. Der alte Schimmer sagte nichts \u00fcber deine Anordnung, nur \u00fcber deine Artenliste: wer die Pflanzen auseinanderzog, sah genau dasselbe Rot. Jetzt wird der Abstand zwischen den Pflanzfl\u00e4chen gerechnet, nicht Mittelpunkt zu Mittelpunkt \u2014 eine breite Pflanze reicht weiter.'},
      {emoji:'\ud83c\udf31', bold:'Der Planer weicht von sich aus aus:', text:' Beim Setzen sucht er zuerst eine Stelle, die BEIDES erf\u00fcllt: passendes Licht und kein Gegenspieler daneben. Nachgespielt: Tomate 10 cm neben der Kartoffel \u2192 auf einen Meter Abstand verschoben. Findet er nichts, wird die Pflanze trotzdem gesetzt \u2014 nur eben mit Hinweis. Eine Pflanze wegzulassen w\u00e4re die schlechtere Antwort.'},
      {emoji:'\ud83d\udcc9', bold:'Halber Meter, bei kritischen Paaren ein ganzer:', text:' Zwei Schwellen, weil nicht jede schlechte Nachbarschaft gleich schwer wiegt. Und der Abstand steht in der Meldung \u2014 ohne ihn w\u00e4re es wieder nur eine Behauptung.'},
      {emoji:'\ud83e\uddee', bold:'Eine Regel f\u00fcr beide Seiten:', text:' Der erste Anlauf hatte zwei: der Platzierer rechnete mit rohen Kommazahlen, die Pr\u00fcfung danach mit gerundeten. Ergebnis \u2014 der Planer setzte eine Pflanze bewusst auf genau 1,00 m und beklagte anschliessend genau diesen Abstand. Jetzt fragen beide dieselbe Funktion.'},
    ],
  },
  {
    v: 'v31.62', date: '01.09.2026',
    headline: '\u2600\ufe0f Der Planer plant ins gemessene Licht \u2014 und sagt es, wenn etwas nicht passt',
    summary: 'Der Planer war seit v31.58 angewiesen, Sonnenpflanzen nicht in den Schatten zu setzen. Die KI hielt sich daran \u2014 und der Platzierer warf es hinterher weg. Jetzt bleibt eine gute Platzierung stehen, eine schlechte wird ins passende Licht gelegt, und was nirgends passt, wird benannt.',
    user_summary: '\u2600\ufe0f Neue Pflanzen landen in der Lichtzone, die dein Garten-Scan tats\u00e4chlich gemessen hat \u2014 und wenn kein Platz mehr im richtigen Licht ist, sagt der Plan das, statt es zu verschweigen.',
    user_items: [
      {emoji:'\ud83d\udd0e', bold:'Ein Auftrag, der nie ankam:', text:' Der Planer bekam die Anweisung „Sonnenpflanzen nicht in den Schatten" \u2014 aber danach ordnete er jede neue Pflanze von links oben her neu an. Am laufenden Programm nachgestellt: die KI legte die Tomate in die Sonnenecke bei 3,0/2,2 m, der Platzierer schob sie auf 1,2/0. Die \u00dcberlegung war da, das Ergebnis nicht.'},
      {emoji:'\u2600\ufe0f', bold:'Jetzt in drei Stufen:', text:' Eine gute Platzierung der KI bleibt, wo sie ist. Eine schlechte wird in eine Zone mit dem passenden Licht gelegt \u2014 gemessen an deinem Scan, nicht geraten. Und wenn dort nichts mehr frei ist, steht die Pflanze trotzdem im Plan, aber mit einem Hinweis, welche und warum.'},
      {emoji:'\ud83e\udd1d', bold:'Halbschatten ist kein Vorwurf:', text:' Gemeldet werden nur die zwei echten Fehler \u2014 Sonnenpflanze im Schatten und Schattenpflanze in der prallen Sonne. Alles dazwischen vertr\u00e4gt sich. Strenger zu sein hiesse, Warnungen zu erfinden.'},
      {emoji:'\ud83e\uddea', bold:'Sechs Durchg\u00e4nge nachgespielt:', text:' Richtige Platzierung bleibt \u00b7 falsche wandert in die Sonne \u00b7 volle Sonnenzone meldet den Konflikt mit Namen und Grund \u00b7 ohne bekannten Lichtbedarf wird nichts bewertet \u00b7 planst du eine ANDERE Fl\u00e4che als die gescannte, gelten die Zonen gar nicht (sie l\u00e4gen sonst auf dem falschen Rechteck) \u00b7 und ohne Scan bleibt alles wie zuvor.'},
    ],
  },
  {
    v: 'v31.61', date: '01.09.2026',
    headline: '\ud83d\udccd Du siehst jetzt im Foto, WELCHE Pflanze die KI meint',
    summary: 'Der Garten-Scan sagte bisher nur, WAS er erkannt hat. Jetzt zeigt er auf dem eigenen Foto, WO — nummerierte Marker, und ein Tipp darauf f\u00fchrt zur passenden Zeile. Ohne das ist jede Korrektur ein Ratespiel.',
    user_summary: '\ud83d\udccd Dein Scan-Foto tr\u00e4gt jetzt nummerierte Marker \u2014 tipp einen an und du landest bei der Pflanze, die dort steht.',
    user_items: [
      {emoji:'\ud83d\udccd', bold:'Vom Bild zur Zeile:', text:' Eine Liste sagt dir, dass die KI eine Tomate gesehen hat. Sie sagt dir nicht, WELCHE der drei Pflanzen im Bild sie damit meint \u2014 und ohne das kann man nichts korrigieren. Jeder Marker tr\u00e4gt eine Nummer, dieselbe Nummer steht an der Zeile, und ein Tipp springt hin und hebt sie hervor.'},
      {emoji:'\ud83e\udd37', bold:'Und wo sie es nicht wei\u00df, markiert sie nichts:', text:' Kann die KI bei einer Pflanze nicht sagen, wo im Bild sie steht, bekommt die Zeile keine Nummer \u2014 und darunter steht, wie viele das betrifft. Ein geratener Marker zeigt auf die falsche Pflanze, und das ist schlimmer als gar keiner.'},
      {emoji:'\ud83d\udc41\ufe0f', bold:'Lesbar auf jedem Foto:', text:' Die Marker liegen auf deinem Bild, und welcher Anzeigemodus eingestellt ist, sagt nichts dar\u00fcber, wie hell das Foto darunter ist. Wei\u00dfe Ziffer auf dunkelgr\u00fcner Scheibe (7,9:1) mit wei\u00dfem Ring \u2014 auf einem dunklen Foto tr\u00e4gt der Ring (21:1), wo die Scheibe allein zu wenig w\u00e4re.'},
      {emoji:'\ud83d\udd12', bold:'Nachgewiesen statt angenommen:', text:' Eine Koordinate ausserhalb des Bildes wird verworfen statt an den Rand geklemmt. Ein Foto, das kein Foto ist, wird gar nicht erst angezeigt \u2014 dann bleibt die Liste eine Liste. Und \u00e4ltere Scans, die noch keine Bildpositionen haben, funktionieren unver\u00e4ndert weiter.'},
    ],
  },
  {
    v: 'v31.60', date: '01.09.2026',
    headline: '\u270f\ufe0f Den Garten-Scan korrigieren \u2014 und das Erkannte in deine Pflege \u00fcbernehmen',
    summary: 'Bisher war die Erkennung eine Anzeige: was die KI falsch benannte, blieb falsch, und was sie richtig erkannte, musstest du trotzdem von Hand anlegen. Jetzt hat jede Zeile drei Kn\u00f6pfe \u2014 und ein Knopf darunter macht aus dem Erkannten echte Pflanzen mit Giess- und Pflegeplan.',
    user_summary: '\u270f\ufe0f Jede erkannte Pflanze l\u00e4sst sich umbenennen, best\u00e4tigen oder entfernen \u2014 und mit einem Knopf wandert der ganze Scan in \u201eMeine Pflanzen\u201c, samt Aufgaben.',
    user_items: [
      {emoji:'\u270f\ufe0f', bold:'Umbenennen, best\u00e4tigen, entfernen:', text:' Eine Erkennung, die man korrigieren kann, muss nicht perfekt sein \u2014 und keine Bilderkennung ist perfekt. Beim Umbenennen sucht die App den Namen in der Artendatenbank und holt sich lateinischen Namen und Symbol dazu. Was du best\u00e4tigst, zeigt statt einer Prozentzahl \u201e\u2713 von dir\u201c: das ist die st\u00e4rkere Aussage, weil sie sagt, woher die Sicherheit kommt.'},
      {emoji:'\ud83c\udf31', bold:'Vom Scan in die Pflege:', text:' Ein Knopf legt alle erkannten Pflanzen in \u201eMeine Pflanzen\u201c an \u2014 mit vollem Aufgabenplan (Giessen, D\u00fcngen, Umtopfen, Schneiden \u2026), mit Beet und Lichtzone in der Notiz. Der Giess-Rhythmus kommt aus dem Wasserbedarf der Art, nicht aus einem Standardwert. Bereits vorhandene Namen werden \u00fcbersprungen, ein zweiter Druck legt also nichts doppelt an.'},
      {emoji:'\u26a0\ufe0f', bold:'Unsicheres wird als unsicher gezeigt:', text:' Steht \u00fcber einer Erkennung eine niedrige Zahl, sagt ein Hinweis oben, wie viele das betrifft \u2014 bevor du \u00fcbernimmst. Eine App, die 30 % Sicherheit genauso darstellt wie 95 %, l\u00fcgt durch Weglassen.'},
      {emoji:'\ud83d\udd2c', bold:'Durchgespielt statt behauptet:', text:' Vier erkannte Pflanzen, zw\u00f6lf Korrekturkn\u00f6pfe: entfernen, best\u00e4tigen, umbenennen, \u00fcbernehmen, nochmal \u00fcbernehmen \u2014 die \u00fcbernommene Pflanze tr\u00e4gt danach acht Aufgaben, und der zweite Durchgang legt keine Dopplung an. Alle Farben von Hand nachgerechnet (5,1 bis 10,4:1), weil der Pr\u00fcfstand in Dialoge nicht hineinsieht.'},
    ],
  },
  {
    v: 'v31.59', date: '01.09.2026',
    headline: '\ud83d\udc41\ufe0f Im 3D-Modell siehst du jetzt, was schon da steht und was der Vorschlag ist',
    summary: 'Seit Planer V3 enthält ein Plan beides: Pflanzen aus deinem Garten-Scan und neu vorgeschlagene. Im Modell sahen sie identisch aus. Jetzt ist der Bestand blass und neutral, jeder Vorschlag trägt einen Ring.',
    user_summary: '\ud83d\udc41\ufe0f Im 3D-Modell ist Bestand jetzt von Vorschlag unterscheidbar \u2014 blass heisst „steht schon da", mit Ring heisst „das wäre neu".',
    user_items: [
      {emoji:'\ud83d\udc41\ufe0f', bold:'Blass gegen Ring:', text:' Was aus deinem Scan kommt, liegt neutral und zur\u00fcckhaltend da. Was der Planer vorschl\u00e4gt, bekommt einen gr\u00fcnen Ring und eine kr\u00e4ftigere Fl\u00e4che. Ein Plan, bei dem man das nicht sieht, ist die H\u00e4lfte wert.'},
      {emoji:'\ud83d\udcd6', bold:'Mit Legende \u2014 aber nur wenn n\u00f6tig:', text:' Ohne Garten-Scan gibt es nichts zu unterscheiden, und eine Legende f\u00fcr eine Unterscheidung, die es nicht gibt, verwirrt mehr als sie hilft. Sie erscheint deshalb nur, wenn der Plan wirklich Bestand enth\u00e4lt.'},
      {emoji:'\ud83d\udd2c', bold:'Am Modell nachgemessen:', text:' Bei zwei vorhandenen und zwei neuen Pflanzen baut der Renderer genau zwei Ringe, zwei blasse und zwei kr\u00e4ftige Fl\u00e4chen \u2014 gez\u00e4hlt an dem, was er tats\u00e4chlich konstruiert, nicht an dem, was er behauptet.'},
    ],
  },
  {
    v: 'v31.58', date: '01.09.2026',
    headline: '\ud83e\udde0 Planer V3 \u2014 er plant jetzt IN deinen Garten, nicht auf ein leeres Rechteck',
    summary: 'Der KI-Planer kennt ab sofort deinen gescannten Bestand: Pflanzen mit Koordinaten, Beete und Lichtzonen in Metern. Vorhandenes bleibt stehen, Neues wird in die L\u00fccken gesetzt \u2014 mit \u00dcberschneidungspr\u00fcfung. Dazu ein Farbfehler, der 95 Stellen betraf.',
    user_summary: '\ud83e\udde0 Wer seinen Garten gescannt hat, muss nichts mehr eintippen \u2014 der Planer kennt Fl\u00e4che, Licht und was schon da steht, und plant darum herum.',
    user_items: [
      {emoji:'\ud83d\udccf', bold:'Nichts mehr doppelt eintippen:', text:' Fl\u00e4che und Lichtverh\u00e4ltnisse kommen aus dem Garten-Scan. Ein Hinweis zeigt dir, was \u00fcbernommen wurde \u2014 eine stille Vorbelegung, die man nicht erkl\u00e4ren kann, w\u00e4re schlimmer als ein leeres Feld.'},
      {emoji:'\ud83c\udf3f', bold:'Vorhandenes bleibt, wo es steht:', text:' Der Planer ordnete bisher ALLE Pflanzen in saubere Reihen \u2014 richtig auf leerer Fl\u00e4che, falsch sobald echte Koordinaten da sind. Eine Tomate, die an der Wand steht, steht dort. Neues wird in die freien L\u00fccken gesetzt, in 10-cm-Schritten, mit Abstandspr\u00fcfung. Gemessen: 0 \u00dcberschneidungen.'},
      {emoji:'\u26a0\ufe0f', bold:'Und wenn nichts mehr passt, sagt er es:', text:' Was neben dem Bestand keinen Platz mehr findet, wird als solches gemeldet statt \u00fcberlappend hingelegt. Ein Plan, der behauptet, alles passe, w\u00e4re kein Plan.'},
      {emoji:'\ud83c\udfa8', bold:'Ein Farbfehler an 95 Stellen:', text:' Beim Bauen einer neuen Warnmeldung fiel auf, dass das Warn-Orange der App auf JEDEM Untergrund unter der Lesbarkeitsschwelle lag \u2014 3,4 bis 3,8:1 statt 4,5. 36 davon in Warnfeldern. Der Kontrast-Pr\u00fcfstand hatte nichts gemeldet: die Stellen sitzen fast alle in Dialogen, und er misst nur, was gerade sichtbar ist. An der Wurzel behoben, jetzt 5,0 bis 5,6:1 \u2014 auch in gedruckten Pl\u00e4nen.'},
    ],
  },
  {
    v: 'v31.57', date: '01.09.2026',
    headline: '\ud83c\udf31 Der Garten-Zwilling \u2014 ein Foto, und deine Beete stehen als 3D-Modell da',
    summary: 'Neu: ein Scan, der den BESTAND erkennt statt Pflanzen zu empfehlen. Aus einem Foto werden Pflanzen, Beete und Lichtzonen mit Meter-Koordinaten. Der Gartenüberblick zeigt endlich echte Zahlen, und das 3D-Modell entsteht aus denselben Daten.',
    user_summary: '\ud83c\udf31 Fotografiere deinen Garten \u2014 GreenScan erkennt Pflanzen, Beete und Lichtzonen und baut daraus ein 3D-Modell. „Mein Garten" zeigt ab jetzt, was wirklich bei dir steht.',
    user_items: [
      {emoji:'\ud83d\udcf7', bold:'Ein Foto gen\u00fcgt:', text:' Die Erkennung liefert Pflanzen mit Namen, Position und Gr\u00f6sse, dazu Beete und Lichtzonen (Sonne, Halbschatten, Schatten). Jede Pflanze bekommt einen Vertrauenswert \u2014 was unsicher war, siehst du auch als unsicher.'},
      {emoji:'\ud83e\uddca', bold:'Und daraus wird ein 3D-Modell:', text:' Massst\u00e4blich, drehbar, mit deinen Beeten. Kein neuer Programmteil daf\u00fcr: der Zwilling hat bewusst dieselbe Datenform wie ein Planer-Plan, also zeichnet ihn der 3D-Renderer, den es l\u00e4ngst gibt. Geladen wird er erst beim \u00d6ffnen \u2014 der Start der App bleibt gleich schnell.'},
      {emoji:'\ud83d\udd22', bold:'Der Gartenüberblick zeigt endlich Echtes:', text:' „Pflegezonen" und „Lichtzonen" standen schon in Fernandos Vorlage \u2014 v31.17 hat sie damals bewusst WEGGELASSEN, weil es diese Zahlen in der App nicht gab und erfundene Zahlen eine L\u00fcge gewesen w\u00e4ren. Diese Begr\u00fcndung war richtig. Jetzt liefert der Zwilling sie, und nur deshalb sind die Kacheln zur\u00fcck. Ohne Scan zeigt der \u00dcberblick weiterhin nur, was es ohne ihn gibt.'},
      {emoji:'\ud83d\udee1\ufe0f', bold:'Was die Erkennung NICHT darf:', text:' Alles, was von der KI kommt, wird geklemmt und gepr\u00fcft, bevor es angezeigt wird. Am laufenden Programm mit einem Angriffs-String getestet: kein Element erzeugt, kein Skript ausgef\u00fchrt, keine Meldung. Zus\u00e4tzlich wird so ein „Name" gar nicht erst \u00fcbernommen \u2014 was spitze Klammern enth\u00e4lt, kam nicht aus einer Bilderkennung.'},
      {emoji:'\ud83c\udfa8', bold:'Zwei Farbfehler von Hand gefunden:', text:' Der gr\u00fcne Hauptknopf w\u00e4re im Dunkelmodus wei\u00df auf Hellgr\u00fcn gewesen \u2014 1,64:1, praktisch unlesbar. Der Kontrast-Pr\u00fcfstand h\u00e4tte das nie gefunden, weil er nur misst, was gerade sichtbar ist. Nachgerechnet und behoben, bevor es das erste Mal ausgeliefert wird.'},
    ],
  },
  {
    v: 'v31.56', date: '01.09.2026',
    headline: '\ud83c\udfc6 Startseite neu geordnet \u2014 Inserate, Rangliste, dann Quiz',
    summary: 'Vier Wünsche von Fernando: die Quiz-Rangliste über das Täglich-Quiz, die aktiven Inserate über die Rangliste, der XP-Balken raus (er steht im Mehr-Tab), und mehr Luft zwischen Gartenwetter und den vier Werkzeugen.',
    user_summary: '\ud83c\udfc6 Auf der Startseite kommen jetzt zuerst die Inserate, dann die Rangliste, dann das Quiz. Der XP-Balken ist weg \u2014 den siehst du weiterhin unter „Mehr".',
    user_items: [
      {emoji:'\ud83d\uded2', bold:'Neue Reihenfolge:', text:' Wetter \u2192 Heute zu tun \u2192 Zahlen \u2192 Wochen\u00fcbersicht \u2192 \ud83d\uded2 Aktive Inserate \u2192 \ud83c\udfc6 Quiz-Rangliste \u2192 \ud83c\udfaf T\u00e4glich-Quiz. Gemessen statt gehofft: die drei Karten sitzen b\u00fcndig bei 16px Rand wie zuvor.'},
      {emoji:'\ud83d\udcca', bold:'XP-Balken von der Startseite entfernt:', text:' Er bleibt unter „Mehr". Wichtig war dabei die zweite H\u00e4lfte: die Funktion, die ihn f\u00fcllt, bediente beide Balken \u00fcber eine Liste. H\u00e4tte ich nur das Sichtbare entfernt, w\u00e4ren f\u00fcnf Zugriffe auf nicht mehr vorhandene Elemente zur\u00fcckgeblieben \u2014 genau die stille Sorte Rest, die dieser Meilenstein gerade auf null gebracht hat.'},
      {emoji:'\ud83d\udccf', bold:'Luft im Garten:', text:' Zwischen Wetterkarte und den Werkzeugen S\u00e4en/Tagebuch/Ernte/Garten standen nur 24px, was als ein Klotz gelesen wurde. Jetzt 39px mit einer feinen Trennlinie darin \u2014 getrennt, ohne eine weitere Karte einzuf\u00fchren.'},
    ],
  },
  {
    v: 'v31.55', date: '01.09.2026',
    headline: '\ud83d\udd12 Backend abgesichert \u2014 und der Verdrahtungs-Meilenstein steht auf null',
    summary: 'Zwei offene Schreib-Endpunkte auf die Artendatenbank stillgelegt, drei Sicherheitsl\u00fccken in der Datenbank geschlossen, die Standard-Rechte geh\u00e4rtet. Dazu der letzte Rest der Verdrahtungs-Liste: 42 offene Nachschlagungen \u2192 0.',
    user_summary: '\ud83d\udd12 Ein offenes Fenster zur Artendatenbank ist zu, drei Datenbank-L\u00fccken sind geschlossen. Niemand ist hindurchgegangen \u2014 das habe ich nachgepr\u00fcft, bevor ich es gemeldet habe.',
    user_items: [
      {emoji:'\ud83d\udeaa', bold:'Das offene Fenster ist zu:', text:' Zwei Server-Funktionen konnten die Artendatenbank ohne Anmeldung \u00fcberschreiben \u2014 gesch\u00fctzt nur durch ein Passwort, das im \u00f6ffentlichen Quelltext stand. Beide liefern jetzt „nicht mehr verf\u00fcgbar". Gepr\u00fcft: 2\u2019838 Arten unver\u00e4ndert, eine einzige neue Zeile in 90 Tagen \u2014 es ist niemand hindurchgegangen.'},
      {emoji:'\ud83d\udd75\ufe0f', bold:'Wer wer ist, war ohne Anmeldung abfragbar:', text:' Zu jeder Nutzerkennung, die \u00f6ffentlich im Feed steht, liess sich die Berechtigungsstufe erfragen. Vorher gemessen: „ja". Jetzt: „nein" \u2014 und das Gast-St\u00f6bern funktioniert unver\u00e4ndert (Arten, Rezepte, Wissen, Feed alle weiter lesbar).'},
      {emoji:'\ud83c\udfc6', bold:'Beim Quiz entschied der Client, was richtig ist:', text:' Und daran h\u00e4ngt ein Jahr Pro gratis f\u00fcr die Jahresbesten. Jetzt leitet der Server die Bewertung selbst aus der Frage ab; nachtr\u00e4gliches \u00c4ndern und L\u00f6schen ist gesperrt.'},
      {emoji:'\ud83d\udcca', bold:'Aufrufz\u00e4hler im Marktplatz waren beliebig hochtreibbar:', text:' Zehn Versuche ohne Anmeldung, gemessen: Z\u00e4hler bleibt bei 6.'},
      {emoji:'\ud83c\udf29\ufe0f', bold:'Die Unwetter-Karte kommt NICHT zur\u00fcck:', text:' Ich wollte sie schon bauen \u2014 und fand dann in der Startseite den Vermerk von v29.78: „Home-Unwetter-Card entfernt (Fernando: unn\u00f6tig im Home)." Also keine vergessene Arbeit, sondern eine getroffene Entscheidung. Nur die 150 Zeilen Code dahinter sind jetzt auch weg. Deine pers\u00f6nlichen Wetter-Warnungen per Push und in der Inbox bleiben unber\u00fchrt.'},
    ],
  },
  {
    v: 'v31.54', date: '01.09.2026',
    headline: '\ud83c\udf3f Was in der Artendatenbank steckt \u2014 und der Meilenstein von 42 auf 7',
    summary: 'Letzte Welle des Verdrahtungs-Meilensteins. Die Aufschl\u00fcsselung der 4\u2019337 Arten nach Kategorien wurde bei jedem Aufruf berechnet und in ein Element geschrieben, das es nicht gab. Dazu die letzten Reste zweier abgel\u00f6ster Funktionen.',
    user_summary: '\ud83c\udf3f Auf der Mehr-Seite steht jetzt, wie sich die 4\u2019337 Arten aufteilen \u2014 2\u2019226 Wildpflanzen, 636 Pilze, 431 B\u00e4ume und so weiter. Die Zahlen wurden immer berechnet, nur nirgends angezeigt.',
    user_items: [
      {emoji:'\ud83c\udf3f', bold:'Die Aufschl\u00fcsselung ist sichtbar:', text:' Wildpflanzen 2\u2019226 \u00b7 Pilze 636 \u00b7 B\u00e4ume & Str\u00e4ucher 431 \u00b7 Kr\u00e4uter 388 \u00b7 Hauspflanzen 286 \u00b7 Flechten 118 \u00b7 Moose 115 \u00b7 Algen 97 \u00b7 Gem\u00fcse 40. Zugeklappt auf der Mehr-Seite, damit sie niemandem im Weg steht.'},
      {emoji:'\ud83d\udc7e', bold:'Ein Spiel, das es zweimal gab:', text:' Beim Wechsel auf den Farm-Reiter baute die App jedes Mal ein Arcade-Spiel auf einer Zeichenfl\u00e4che auf \u2014 den BlattF\u00e4nger in seiner alten Fassung. Heute ist der Farm-Bildschirm ein Rasterspiel und enth\u00e4lt gar keine Zeichenfl\u00e4che mehr. Der Aufbau lief also bei jedem Besuch ins Leere.'},
      {emoji:'\ud83d\udee0\ufe0f', bold:'Ich habe dabei die App kurz zerbrochen:', text:' Beim Entfernen des Spiel-Codes blieb eine Klammer stehen \u2014 damit war das gesamte Programm nicht mehr lesbar und die App h\u00e4tte gar nicht mehr gestartet. Der Pr\u00fcfstand meldete es sofort („Unexpected token"), also ist es nie ausgeliefert worden. Genau daf\u00fcr ist er da.'},
      {emoji:'\ud83c\udfaf', bold:'Der Meilenstein steht bei 7 von 42:', text:' Sechs davon sind die Wetterwarnungs-Karte, die auf eine Entscheidung wartet; der siebte ist gepr\u00fcft harmlos. Alles andere ist entweder angeschlossen oder belegt entfernt.'},
      {emoji:'\ud83d\udd0d', bold:'Und der Pr\u00fcfstand meldet keinen Falschalarm mehr:', text:' Er hat drei Stellen bem\u00e4ngelt, die vorbildlich geschrieben sind \u2014 Rueckfallketten der Form „nimm A, sonst B, sonst C". Er erkennt sie jetzt. Ein Pr\u00fcfstand, der an gutem Code meckert, wird ignoriert, und dann findet er auch die echten Fehler nicht mehr.'},
    ],
  },
  {
    v: 'v31.53', date: '01.09.2026',
    headline: '\ud83e\udd16 Dein KI-Tageskontingent ist endlich zu sehen \u2014 vorher erfuhrst du davon erst beim Anschlagen',
    summary: 'Gratis-Nutzer haben 15 KI-Aufrufe pro Tag. Die Anzeige daf\u00fcr steht seit v26.65 fertig im Code und f\u00fcllt zwei Elemente, die es nie gab. Wer sein Kontingent verbrauchte, erfuhr davon zum ersten Mal in dem Moment, in dem er blockiert wurde.',
    user_summary: '\ud83e\udd16 In den Einstellungen steht jetzt, wie viele KI-Aufrufe du heute noch hast. Bisher merktest du es erst, wenn keine mehr da waren.',
    user_items: [
      {emoji:'\ud83e\udd16', bold:'Das Kontingent steht in den Einstellungen:', text:' „✅ 0 / 15 Calls heute · 15 \u00fcbrig", bei drei oder weniger in Orange, bei null in Rot. Gemessen f\u00fcr alle drei Zust\u00e4nde. Die Zeile bleibt verborgen, wenn du Pro hast oder einen eigenen Schl\u00fcssel nutzt \u2014 dann gibt es kein Limit anzuzeigen.'},
      {emoji:'\u26a0\ufe0f', bold:'Warum das mehr als Kosmetik ist:', text:' Der einzige Hinweis auf das Limit war bisher die Absage selbst („\ud83d\udeab Tageslimit erreicht \u2014 heute 15/15 verbraucht"). Man konnte nicht einteilen, was man nicht sehen konnte.'},
      {emoji:'\ud83c\udfa8', bold:'Und die Farbe stimmte auch nicht:', text:' Der Warnton war #e65100 \u2014 auf der weissen Karte 3,79:1 und damit unter der Lesbarkeitsschwelle. Nachgerechnet und auf 5,60:1 gebracht, bevor die Zeile das erste Mal \u00fcberhaupt sichtbar wird. Der Kontrast-Pr\u00fcfstand h\u00e4tte sie nicht gefunden: was es nicht gibt, kann er nicht messen.'},
      {emoji:'\ud83e\uddf9', bold:'Drei weitere Reste aufgel\u00f6st:', text:' Ein Men\u00fc-Eintrag zum Admin-Panel (das \u00fcber zwei andere Wege erreichbar ist), eine zweite Artenzahl-Anzeige (die Zahl steht in vier anderen Elementen) und ein Abzeichen f\u00fcr Duplikate (die Pr\u00fcfung l\u00e4uft ohnehin beim Start und r\u00e4umt selbst auf).'},
    ],
  },
  {
    v: 'v31.52', date: '01.09.2026',
    headline: '\ud83c\udff7\ufe0f Der Beitragstyp wurde beim Absenden weggeworfen',
    summary: 'Im Beitrags-Fenster las das Absenden ein Feld namens post-category. Das gibt es nicht \u2014 das Auswahlfeld hei\u00dft post-type. Der Ausdruck fiel deshalb IMMER auf „fund" zur\u00fcck: Showcase, Hilfe, Tipp, Frage und Rarit\u00e4t wurden alle als dasselbe gespeichert.',
    user_summary: '\ud83c\udff7\ufe0f Wenn du im Beitrags-Fenster einen Typ w\u00e4hlst, wird er jetzt auch gespeichert. Und „Status" hat endlich eine eigene Auswahl \u2014 vorher blieb das Feld dabei leer.',
    user_items: [
      {emoji:'\ud83c\udff7\ufe0f', bold:'Der gew\u00e4hlte Typ kommt an:', text:' Gemessen f\u00fcr alle sechs Einstiege: Showcase → showcase, Hilfe → help, Tipp → tip, Frage → question, Foto → showcase, Status → fund. Vorher lieferte dieselbe Kette ausnahmslos „fund".'},
      {emoji:'\ud83d\udd0d', bold:'Warum es lange nicht auffiel:', text:' Der Hauptweg ist der schnelle Composer oben im Community-Bereich, und der macht es richtig. Durch das Fenster ist bisher kein Beitrag gegangen \u2014 nachgesehen in der Datenbank: drei Beitr\u00e4ge, alle korrekt. Der Weg stand trotzdem offen.'},
      {emoji:'\u26a0\ufe0f', bold:'Der naheliegende Fix w\u00e4re falsch gewesen:', text:' Einfach das richtige Feld lesen h\u00e4tte „Status" kaputt gemacht \u2014 die Datenbank l\u00e4sst diesen Wert gar nicht zu und h\u00e4tte den Beitrag abgewiesen. Jetzt gibt es EINE Umrechnung f\u00fcr beide Wege, die nur g\u00fcltige Werte herausl\u00e4sst.'},
      {emoji:'\ud83d\udcac', bold:'„Status" hatte gar keine Auswahl:', text:' Wer \u00fcber „💬 Status" einstieg, sah ein Auswahlfeld ohne Auswahl \u2014 die Option fehlte schlicht. Beim Messen aufgefallen, jetzt vorhanden.'},
      {emoji:'\u23f3', bold:'Und der Absende-Knopf meldet sich:', text:' Er zeigt w\u00e4hrend des Sendens „Poste …" und sperrt sich gegen Doppeltippen. Der Code daf\u00fcr war da; dem Knopf fehlte nur seine Kennung.'},
    ],
  },
  {
    v: 'v31.51', date: '01.09.2026',
    headline: '\ud83c\udf31 Drei von vier Bodenarten haben ihre Warnungen nie ausgeliefert',
    summary: 'Das Auswahlfeld im Gartenformular speichert englische Werte (sand, loam, clay, humus). Die Bodenkunde dahinter arbeitet mit deutschen Schl\u00fcsseln (sandig, lehmig, tonig, humusreich). Die Zuordnung fragte, ob der gespeicherte Wert den Schl\u00fcssel ENTH\u00c4LT — und „sand" enth\u00e4lt nicht „sandig".',
    user_summary: '\ud83c\udf31 Wer Sand-, Lehm- oder Tonboden eingestellt hatte, bekam bei seinen Pflanzen nie die passende Boden-Warnung. Nur „Humus" funktionierte, und das aus Versehen.',
    user_items: [
      {emoji:'\ud83c\udf31', bold:'Der Boden-Rat kommt wieder an:', text:' Bei Tomaten auf Sandboden zeigt die App jetzt wieder die Warnung samt konkreter Abhilfe. Gemessen: dieselbe Karte war vorher 1\u2019220 Zeichen lang (die allgemeine Fassung), jetzt 2\u2019228 \u2014 rund tausend Zeichen Rat, die drei von vier Nutzern still vorenthalten wurden. Bei Tonboden dasselbe.'},
      {emoji:'\ud83d\udd11', bold:'Woran es lag:', text:' Zwei Namenswelten f\u00fcr dieselbe Sache. Der einzige Treffer war „humus" \u2014 weil dieses eine Wort zuf\u00e4llig in „humusreich" vorkommt. Jetzt gibt es EINE Zuordnung, die beide Schreibweisen kennt, alte gespeicherte Daten eingeschlossen. Deine bestehenden G\u00e4rten musst du nicht anfassen.'},
      {emoji:'\ud83d\udcd8', bold:'Und der Boden erkl\u00e4rt sich jetzt beim W\u00e4hlen:', text:' Unter dem Auswahlfeld steht ab sofort, was der gew\u00e4hlte Boden ausmacht, wof\u00fcr er gut ist und was man verbessern kann. Der Text daf\u00fcr lag seit Langem fertig im Code \u2014 es fehlten das Anzeigefeld und der Ausl\u00f6ser am Auswahlfeld.'},
      {emoji:'\ud83d\udd0d', bold:'Ein Fehler, den kein Pr\u00fcfstand gefunden h\u00e4tte:', text:' Die neue Infobox h\u00e4tte Warntext mit 3,46:1 Kontrast bekommen \u2014 unter der Lesbarkeitsschwelle. Der Kontrast-Pr\u00fcfstand misst nur, was auf den Bildschirmen sichtbar ist, und diese Box steckt in einem Fenster. Von Hand nachgerechnet und auf 5,11:1 gesetzt, bevor sie das erste Mal ausgeliefert wird.'},
    ],
  },
  {
    v: 'v31.50', date: '01.09.2026',
    headline: '\ud83e\uddf9 Neun tote Funktionen entfernt \u2014 und eine Begr\u00fcndung gerettet, die niemand mehr zu sehen bekam',
    summary: 'Zweite Welle des Meilensteins „Alles verdrahtet": die Funde, die sich beim Nachsehen als Reste entfernter Oberfl\u00e4chen erwiesen haben, sind jetzt weg. 41 offene Nachschlagungen \u2192 26.',
    user_summary: '\ud83d\udcf7 Wenn die App nach der Kamera fragt, steht jetzt wieder dabei WOF\u00dcR \u2014 dieser Satz existierte im Code, kam aber seit dem Umbau nirgends mehr an.',
    user_items: [
      {emoji:'\ud83d\udcf7', bold:'Die Kamera-Frage erkl\u00e4rt sich wieder:', text:' Die App fragte die Kamera-Erlaubnis nackt an \u2014 nur die Browser-Abfrage, ohne ein Wort dazu. Dabei gaben die aufrufenden Stellen seit jeher eine Begr\u00fcndung mit („GreenScan braucht Kamera-Zugriff um Arten direkt zu bestimmen"); sie ging beim Entfernen des alten Dialogs still verloren. Jetzt kommt sie kurz vor der Abfrage. Wer weiss, warum gefragt wird, entscheidet anders.'},
      {emoji:'\ud83e\uddf9', bold:'Neun Funktionen ohne Aufrufer entfernt:', text:' Reste von Oberfl\u00e4chen, die es nicht mehr gibt \u2014 die „Pflanze des Tages", ein zweiter \u00d6ffner f\u00fcrs Beitrags-Fenster, eine \u00fcberholte Zweitfassung des Magic-Link-Logins, die beiden Kn\u00f6pfe des alten Kamera-Dialogs. Rund 215 Zeilen.'},
      {emoji:'\ud83d\udd12', bold:'Eine davon war ein Risiko:', text:' Ein verstecktes Entwickler-Formular liess URL und Schl\u00fcssel einer BELIEBIGEN Datenbank eintragen \u2014 die App h\u00e4tte danach deine Daten woanders hingeschickt. Ohne Aufrufer, aber der Code lag ausgeliefert bei jedem mit. So etwas geh\u00f6rt nicht in eine ver\u00f6ffentlichte App.'},
      {emoji:'\ud83d\udcda', bold:'6,8 KB Dokumentation, die niemand lesen konnte:', text:' Eine Liste von acht historischen Fehlern lag als Programmcode in der App und wurde von jedem Telefon bei jedem Start mitgeladen \u2014 sichtbar war sie nirgends, gelesen hat sie eine Funktion ohne Aufrufer, zuletzt gepflegt im M\u00e4rz. Sie ist vollst\u00e4ndig ins Repo umgezogen (docs/FEHLER-LOG.md), wo sie auffindbar ist und keinen Nutzer etwas kostet.'},
    ],
  },
  {
    v: 'v31.49', date: '01.09.2026',
    headline: '\ud83d\udce1 GPS im Gartenformular \u2014 und der Garten-Standort \u00fcberschreibt nicht mehr deinen eigenen',
    summary: 'Beim Anlegen eines Gartens musste man die Adresse abtippen. Die GPS-Funktion daf\u00fcr gab es seit Langem, sie hatte nur keinen Knopf \u2014 und ein Meldefeld stand daneben, dauerhaft verborgen, weil es genau f\u00fcr diese R\u00fcckmeldung gebaut worden war.',
    user_summary: '\ud83d\udce1 Beim Garten anlegen gibt es jetzt einen GPS-Knopf. Und ein Fehler, der dabei deinen pers\u00f6nlichen Standort \u00fcberschrieben h\u00e4tte, ist behoben.',
    user_items: [
      {emoji:'\ud83d\udce1', bold:'GPS beim Garten anlegen:', text:' Ein Tipp auf den Knopf neben dem Standortfeld, und der Ort steht drin. Vorher war Abtippen der einzige Weg \u2014 obwohl die Funktion dafuer fertig im Code lag, ohne Aufrufer.'},
      {emoji:'\u26a0\ufe0f', bold:'Der Fehler, der dabei zutage kam:', text:' Die Funktion war eine verungl\u00fcckte Kopie aus dem Standort-Fenster. Sie las zwar die Felder des Gartenformulars, schrieb aber in die eines ganz anderen \u2014 und rief saveUserLocation. Der Standort EINES Gartens h\u00e4tte damit deinen pers\u00f6nlichen Standort \u00fcberschrieben. Wer einen Balkon in Bern eintr\u00e4gt, wohnt deswegen nicht dort. Gepr\u00fcft: Garten „Bern", Nutzer-Standort bleibt „Z\u00fcrich".'},
      {emoji:'\ud83d\udd0d', bold:'Vier Funde, die sich beim Nachsehen aufl\u00f6sten:', text:' „Pflanze des Tages" wurde ausdr\u00fccklich entfernt, nur ein Rest blieb stehen. Der Magic-Link-Login existiert bereits im Onboarding \u2014 die zweite Fassung im Profil war \u00fcberfl\u00fcssig, nicht fehlend. Ein Beitrags-Fenster hatte zwei \u00d6ffner, einer davon ohne Aufrufer. Nicht jeder Fund ist ein fehlendes Feature; manchmal ist er ein Doppel.'},
    ],
  },
  {
    v: 'v31.48', date: '01.09.2026',
    headline: '\ud83e\udded Drei Men\u00fc-Eintr\u00e4ge, die nirgendwohin f\u00fchrten',
    summary: 'Die 40 Eintr\u00e4ge der Men\u00fc-Suche tragen ihre Aktion als Text in einer Liste \u2014 nicht als onclick am Element. Der Verdrahtungs-Pr\u00fcfstand sah sie deshalb nicht. Beim ersten gezielten Durchgang waren drei davon kaputt: sie sprangen auf einen Bildschirm und tippten dort auf ein Element, das es nicht gibt.',
    user_summary: '\ud83e\udded Bl\u00fchkalender, Scan-Historie und Lichtmesser-Kalibrierung waren \u00fcber die Men\u00fc-Suche nicht erreichbar \u2014 tippen, und es passierte nichts. Jetzt \u00f6ffnen alle drei.',
    user_items: [
      {emoji:'\ud83d\udcc5', bold:'Bl\u00fchkalender:', text:' sprang auf die Startseite und suchte dort ein Element, das es nicht gibt. Der Kalender liegt als Kachel „\ud83c\udf3b Blumen" im Garten-Reiter. Jetzt \u00f6ffnet er direkt \u2014 gepr\u00fcft: „September \u00b7 4 bl\u00fchende Arten".'},
      {emoji:'\ud83d\udcdc', bold:'Scan-Historie:', text:' sprang auf „Meine Pflanzen" und wollte dort einen Reiter antippen, den es dort nicht gibt. Die Historie ist ein eigenes Fenster. Gepr\u00fcft: „4 Scans \u00b7 3 Arten \u00b7 2 in DB".'},
      {emoji:'\ud83c\udf3e', bold:'Lichtmesser kalibrieren:', text:' \u00f6ffnete den Lichtmesser und tippte 400 ms sp\u00e4ter auf einen Kalibrier-Knopf, den es nicht gibt. Jetzt direkt \u2014 und wenn noch keine Messung vorliegt, sagt die App das auch, statt stumm zu bleiben.'},
      {emoji:'\ud83d\udd0d', bold:'Damit es nicht wiederkommt:', text:' Der Pr\u00fcfstand geht die Men\u00fc-Liste jetzt bei jedem Lauf durch \u2014 alle 40 Eintr\u00e4ge, Funktion und angesprochenes Element. Solche Aktionen stehen in einem Feld statt am Knopf; ohne eigene Pr\u00fcfung f\u00e4llt dort nie etwas auf.'},
    ],
  },
  {
    v: 'v31.47', date: '01.09.2026',
    headline: '\ud83d\udcd6 Zehn Garten-Artikel, die seit v28.57 niemand sehen konnte',
    summary: 'Die Garten-Bibliothek ist vollst\u00e4ndig: zehn geschriebene Artikel, zehn Kategorien, ein fertiges Detail-Fenster, sogar eine eigene Stilregel. Nur die Liste hatte kein Zuhause \u2014 renderGardenLibrary schreibt in ein Element, das nirgends stand, und kehrte deshalb bei jedem Wechsel auf den Garten-Reiter in der zweiten Zeile um.',
    user_summary: '\ud83d\udcd6 Zehn Garten-Grundlagen von Boden bis Wildbienen sind jetzt zu lesen \u2014 mit Suche und Kategorien. Sie lagen die ganze Zeit fertig in der App.',
    user_items: [
      {emoji:'\ud83d\udcd6', bold:'Die Garten-Bibliothek ist da:', text:' Boden verstehen, richtig giessen, d\u00fcngen, Blattl\u00e4use natürlich bekämpfen, Kompost, Schweizer Aussaatkalender, Hochbeet, Wildbienen, Balkongarten, Ernte und Lagerung. Zu finden im Garten-Reiter unter „\ud83d\udcda Wissen & Werkzeuge".'},
      {emoji:'\ud83d\udd0e', bold:'Mit Suche und Kategorien:', text:' Beides waren immer schon Parameter der Zeichenfunktion \u2014 nur hatte sie nie eine Bedienung. Jetzt filtern zehn Kategorie-Chips, und das Suchfeld durchsucht Titel und Kurzfassung.'},
      {emoji:'\ud83d\udeaa', bold:'Warum als Fenster und nicht auf der Seite:', text:' Der Garten-Bildschirm ist ohnehin lang. Pflanzendoktor, Krankheits-Lexikon und Erntekalender sind alle Fenster \u2014 die Bibliothek f\u00fcgt sich damit ein, statt die Seite noch einmal zu verl\u00e4ngern.'},
      {emoji:'\ud83d\udd0d', bold:'Auch der Pr\u00fcfstand hat dazugelernt:', text:' Er meldete „Farbe ge\u00e4ndert: 3", ohne zu sagen welche \u2014 eine Zahl, die man nur glauben oder ignorieren kann, und beides ist falsch. Jetzt nennt er die Stellen. In diesem Fall waren es die drei Pfeile in der Werkzeug-Gruppe: der neue Knopf sitzt vorne, also verschob sich jeder Schl\u00fcssel um eins und jedes Element trug die Farbe seines Nachbarn. Nachgesehen statt weggewunken.'},
    ],
  },
  {
    v: 'v31.46', date: '01.09.2026',
    headline: '\ud83e\udea6 Der Pflanzenfriedhof hatte einen Eingang, aber keinen Ausgang',
    summary: 'Auf jeder Pflanzenkarte steht ein Knopf „\ud83e\udea6 Pflanzenfriedhof". Er fragt nach der Todesursache, verschiebt die Pflanze \u2014 und danach war sie fort. renderCemetery schreibt in ein Element namens cemetery-list, das es nirgends gibt, und die einzige Funktion, die es h\u00e4tte anzeigen k\u00f6nnen, hatte keinen Aufrufer.',
    user_summary: '\ud83e\udea6 Verabschiedete Pflanzen waren unwiederbringlich weg \u2014 jetzt gibt es den Friedhof wirklich, mit Weg zur\u00fcck. Und der Pflanzendoktor fragt nicht mehr jedes Mal neu nach der Kamera.',
    user_items: [
      {emoji:'\ud83e\udea6', bold:'Verabschiedete Pflanzen sind wieder da:', text:' Der Knopf auf der Pflanzenkarte hat die Pflanze immer korrekt verschoben \u2014 gespeichert war sie also die ganze Zeit. Nur ansehen konnte man sie nicht: die Ansicht schrieb in ein Element, das es nicht gibt, und der einzige Weg dorthin war eine Funktion, die niemand aufrief. Jetzt steht oben auf „Meine Pflanzen" ein Eingang \u2014 und zwar nur dann, wenn es dort etwas zu sehen gibt. Wiederherstellen geht mit einem Tipp.'},
      {emoji:'\ud83d\udcac', bold:'Und die App sagt jetzt, wohin sie geht:', text:' Bisher verschwand die Pflanze kommentarlos aus der Liste. Das f\u00fchlt sich an wie ein Datenverlust, auch wenn es keiner war. Jetzt kommt eine kurze R\u00fcckmeldung mit dem Hinweis, wo sie zu finden ist.'},
      {emoji:'\ud83d\udcf7', bold:'Kamera-Erlaubnis ging bei jedem Neustart verloren:', text:' F\u00fcnf Stellen merken sich die Erlaubnis, vier schreiben „granted" \u2014 eine schrieb „1". Wer die Kamera im Scanner erlaubte, wurde vom Pflanzendoktor beim n\u00e4chsten Start wieder gefragt. Jemand hatte das fr\u00fcher schon bemerkt und einen Notbehelf eingebaut, der genau diesen einen Wert abfing; behoben war es damit nicht. Jetzt an der Wurzel \u2014 und bestehende Installationen m\u00fcssen nichts neu erlauben.'},
      {emoji:'\u26a0\ufe0f', bold:'Eine Umschaltung, die Schaden angerichtet h\u00e4tte:', text:' switchPlantsTab war tot, aber h\u00e4tte sie je jemand aufgerufen, h\u00e4tte ihre erste Zeile die Reiter im Marktplatz (Aktiv / Gewonnen / Gekauft) abger\u00e4umt \u2014 die tragen inzwischen dieselbe Klasse. Entfernt.'},
      {emoji:'\ud83d\udd2c', bold:'Der Pr\u00fcfstand hat sich selbst im Weg gestanden:', text:' Er meldete die Community-Suche als kaputt \u2014 falscher Alarm, das Element entsteht \u00fcber eine Variable statt \u00fcber ein festes id=. Wichtiger: die Beispieldaten aller Pr\u00fcfst\u00e4nde lagen unter dem falschen Schl\u00fcssel. Seit v31.30 wurde immer eine LEERE Pflanzenliste vermessen \u2014 Leerzustand statt Karten. Aufgefallen, als ein Versuch die erste Pflanze lesen wollte und nichts bekam. Genau deshalb war der Friedhof so lange unentdeckt.'},
    ],
  },
  {
    v: 'v31.45', date: '01.09.2026',
    headline: '\ud83d\udd0c Ein Pr\u00fcfstand f\u00fcr die Verdrahtung \u2014 und ein Abzeichen, das seit einem Jahr ins Leere zielte',
    summary: 'Alle bisherigen Pr\u00fcfst\u00e4nde messen, wie die App AUSSIEHT. Keiner pr\u00fcfte, ob das Angetippte auch ankommt. Der neue scripts/wiring_check.js l\u00f6st beide Richtungen auf: 301 Knopf-Aufrufe gegen die tats\u00e4chlich vorhandenen Funktionen, und 1\u2019010 Element-Nachschlagungen gegen die ids, die es wirklich gibt.',
    user_summary: '\ud83d\udd0c Der Lichtmesser zeigte beim erneuten \u00d6ffnen die alte Messung. F\u00e4llige Pflege ist jetzt am Pflanzen-Reiter zu sehen. Und 220 Zeilen f\u00fcr eine Funktion, die es l\u00e4ngst nicht mehr gab, sind weg.',
    user_items: [
      {emoji:'\ud83d\udca1', bold:'Lichtmesser zeigte die alte Zahl:', text:' Beim erneuten \u00d6ffnen sollte die Anzeige zur\u00fccksetzen \u2014 sie griff dabei auf lux-val und ersatzweise lux-n zu. Beide gibt es nicht, das Element hei\u00dft lux-value. Die Absicherung \u201eif(lvEl)\u201c verschluckte es lautlos, und so stand die Zahl der vorigen Messung noch da, w\u00e4hrend die Kategorie daneben schon leer war \u2014 mitsamt ihrer alten Farbe. Jetzt setzt es sauber zur\u00fcck.'},
      {emoji:'\ud83d\udd34', bold:'F\u00e4llige Pflege ist wieder sichtbar:', text:' Ein rotes Abzeichen am Pflanzen-Reiter zeigt, wie viele Aufgaben \u00fcberf\u00e4llig sind. Die Z\u00e4hlfunktion gab es seit v30.34 \u2014 sie zielte auf einen Garten-Reiter, den die Leiste gar nicht hat, und hatte ausserdem keinen einzigen Aufrufer. Jetzt h\u00e4ngt sie am Speicherpunkt f\u00fcr Pflanzen, also stimmt sie immer.'},
      {emoji:'\ud83e\uddf9', bold:'220 Zeilen f\u00fcr eine entfernte Funktion:', text:' Ein „Raum-Lichtscan\u201c in f\u00fcnf Schritten lag noch vollst\u00e4ndig im Code \u2014 ohne Knopf, ohne Oberfl\u00e4che, und mit f\u00fcnf Variablen, die nirgends angelegt werden. Er h\u00e4tte beim ersten Zugriff abgebrochen. Die 10-Punkte-Pro-Messung daneben ist die richtige Nachfolgerin und funktioniert.'},
      {emoji:'\u2696\ufe0f', bold:'Was ich bewusst NICHT umgeh\u00e4ngt habe:', text:' In dieser Insel lag eine sorgf\u00e4ltige Lux-Berechnung mit Gamma-Korrektur. Verlockend, den laufenden Lichtmesser darauf zu zeigen \u2014 aber der ist gegen seine eigene Helligkeits-Skala kalibriert, und deine gespeicherte Kalibrierung w\u00e4re damit still ung\u00fcltig geworden. Genauer aussehen und falscher rechnen ist kein Fortschritt.'},
      {emoji:'\ud83d\udd0d', bold:'Der Pr\u00fcfstand hat sich zweimal selbst korrigiert:', text:' Erst meldete er acht Fehler, die keine waren \u2014 verkettete Aufrufe und CSS-Funktionen. Dann verschluckte er elf echte, weil eine Zeile accept=\u201cimage/*\u201c enth\u00e4lt: das /* steht in einer Zeichenkette und schliesst nie, also galt der halbe Rest der Datei als Kommentar. Zu wenig zu melden ist schlimmer als zu viel \u2014 das Zuviel f\u00e4llt auf.'},
      {emoji:'\ud83c\udfaf', bold:'Zum sechsten Mal dasselbe Muster \u2014 diesmal bei mir:', text:' Ich schrieb eine Regel f\u00fcr das neue Abzeichen und mass danach eine andere Farbe als die geschriebene. Die Klasse gab es schon, weiter unten, als Rest einer 2026 entfernten Men\u00fc-Badge. Genau der Fehler, den ich in v31.33 zweiundf\u00fcnfzigmal aufger\u00e4umt habe. Jetzt eine Regel statt zwei.'},
    ],
  },
  {
    v: 'v31.44', date: '01.09.2026',
    headline: '\ud83c\udff7\ufe0f 22 Karten trugen ein Etikett mit der Aufschrift „undefined"',
    summary: 'Beim Durchsehen aller Seiten nach der Optik-Umstellung fiel im Heilmittel-Bereich ein Chip auf, auf dem w\u00f6rtlich „undefined" stand. Die Spur f\u00fchrte zu f\u00fcnf Kategorien, die von den Daten benutzt werden, aber in keiner Zuordnungstabelle stehen \u2014 und zu einem R\u00fcckfall ohne Beschriftung.',
    user_summary: '\ud83c\udff7\ufe0f 22 Rezept- und Heilmittel-Karten zeigten statt einer Kategorie das Wort „undefined". Jetzt steht dort, was drin ist.',
    user_items: [
      { emoji: '\ud83c\udff7\ufe0f', text: '„Fermentiert", „Salat", „Backen", „\u00d6lauszug" und „Inhalation" fehlten komplett' },
      { emoji: '\ud83d\udee1\ufe0f', text: 'Unbekannte Kategorien zeigen jetzt gar nichts statt „undefined"' },
    ],
    items: [
      {emoji:'\ud83c\udff7\ufe0f', bold:'F\u00fcnf fehlende Kategorien:', text:' die Daten nutzen fermentation (4 Rezepte), salat (2), backen (13) sowie oel (1 Heilmittel) und inhalation (2). Keine davon stand in RECIPE_CATS bzw. REMEDY_CATS. Zusammen 22 Karten. Die Tabellen enthielten stattdessen ferment und gebaeck \u2014 \u00e4hnliche Namen, die nie zugeordnet wurden.'},
      {emoji:'\ud83d\udee1\ufe0f', bold:'Die eigentliche Ursache:', text:' der R\u00fcckfall in der Listenansicht war {emoji, bg, color} \u2014 OHNE label. Bei einer unbekannten Kategorie landete catInfo.label als das Wort „undefined" im Chip. Der R\u00fcckfall in der Detailansicht hatte label:\'\' und war deshalb unauff\u00e4llig. Jetzt beide gleich.'},
      {emoji:'\ud83e\udde9', bold:'Zwei Fehler, die sich gegenseitig verdeckten:', text:' die Kategorie ferment trug color:#e65100 auf bg:#fff3e0 \u2014 3,46:1, also unter AA. Mein Kontrast-Pr\u00fcfstand konnte das nicht finden, WEIL kein Rezept diese Kategorie benutzt und der Chip nie gerendert wird. Beim Erg\u00e4nzen von fermentation w\u00e4re der schlechte Wert mitgekommen; jetzt sind beide auf #bf360c (5,11:1).'},
    ],
    verify: [
      {emoji:'\u2705', bold:'Verify:', text:' „undefined"-Chips in Rezepten und Heilmitteln: 22 \u2192 0 \u00b7 gegengepr\u00fcft, dass KEINE von den Daten benutzte Kategorie mehr in den Tabellen fehlt (beide Listen leer) \u00b7 alle neuen Farbpaare vorher gerechnet: 4,78 bis 6,08:1 \u00b7 Kontrast weiterhin 0 unter AA in beiden Modi \u00b7 keine JS-Fehler \u00b7 9/9 Inline-Scripts node --check OK \u00b7 GS_VERSION=v31.44 \u00b7 sw.js gs-v31.44 \u00b7 _headers v31.44 \u00b7 meta=31.44.20260901.'},
    ],
  },
  {
    v: 'v31.43', date: '01.09.2026',
    headline: '\u2728 Auch die Kopfleiste hell \u2014 die App ist jetzt durchgehend ruhig',
    summary: 'Nach Startseite, Navigationsleiste und allen \u00fcbrigen Bildschirmen war die Kopfzeile das letzte dunkle Element. Jetzt kippt auch sie mit dem Modus. Dabei kam ein dunkelgr\u00fcnes Band zum Vorschein, das jahrelang unsichtbar war \u2014 weil es immer von etwas Dunklem verdeckt wurde.',
    user_summary: '\u2728 Die App ist jetzt von oben bis unten hell und ruhig \u2014 Kopfzeile, Inhalt und Leiste sprechen dieselbe Sprache.',
    user_items: [
      { emoji: '\u2728', text: 'Kopfleiste hell statt dunkelgr\u00fcn \u2014 passend zum Rest' },
      { emoji: '\ud83d\udd0d', text: 'Ein dunkles Band unter der Leiste beseitigt, das vorher niemand sehen konnte' },
    ],
    items: [
      {emoji:'\u2728', bold:'Dieselbe Behandlung wie die Navigationsleiste:', text:' die Kopfzeile stand auf --fill-dark, also in BEIDEN Modi dunkelgr\u00fcn. Genau deshalb brauchte sie feste #fff-Werte fuer Titel und Symbole \u2014 samt einem `color:#ffffff !important` und zwei Dunkelmodus-\u00dcberschreibungen. Jetzt --card/--border: sie kippt selbst, die Schrift nutzt --g-dark, die Symbole --text. Alle drei Sonderregeln sind weg.'},
      {emoji:'\ud83d\udd0d', bold:'Der Fund beim Hinsehen:', text:' nach der Umstellung zeigte sich ein dunkelgr\u00fcnes Band zwischen Kopfleiste und Inhalt. Ursache: body und #app standen ebenfalls auf --fill-dark. Solange Kopf- UND Navigationsleiste dunkel waren, hat man diesen Hintergrund nie gesehen \u2014 er war immer verdeckt. Erst als beide hell wurden, kam er zum Vorschein. Beide folgen jetzt --g-bg.'},
      {emoji:'\ud83d\udd14', bold:'Kleinigkeit mit Wirkung:', text:' der Ring um den Glocken-Z\u00e4hler war var(--g-dark) \u2014 passend, solange die Leiste dunkel war. Jetzt --card, also immer in Leistenfarbe.'},
    ],
    verify: [
      {emoji:'\u2705', bold:'Verify:', text:' Kopfleiste in beiden Modi gerendert und angesehen \u2014 im Dunkelmodus zeigt der Knopf korrekt die Sonne statt des Monds \u00b7 Kontrast 0 unter AA in beiden Modi \u00b7 Antippfl\u00e4chen 0 unter 24\u00d724 \u00b7 Vorher/Nachher: 132 Farb\u00e4nderungen (die Leiste, quer \u00fcber elf Tabs), 0 Radius- und 0 Schriftgr\u00f6ssen\u00e4nderungen; von den 17 Gr\u00f6ssen\u00e4nderungen sind elf die Kopfleiste selbst (38\u219239px durch den neuen 1px-Rahmen) und sechs der bekannte dritte Chip im Wissens-Hero \u00b7 keine JS-Fehler \u00b7 9/9 Inline-Scripts node --check OK \u00b7 GS_VERSION=v31.43 \u00b7 sw.js gs-v31.43 \u00b7 _headers v31.43 \u00b7 meta=31.43.20260901.'},
    ],
  },
  {
    v: 'v31.42', date: '01.09.2026',
    headline: '\ud83c\udf19 Kopfleiste mit Strich-Symbolen \u2014 und ein Emoji, das sich zweimal zur\u00fcckschlich',
    summary: 'Nach der Navigationsleiste jetzt die Kopfzeile: Mond, Glocke und Men\u00fc sind gezeichnete Symbole statt Emoji. Beim Nachsehen fiel auf, dass zwei Stellen im Code das Mond-Symbol per textContent wieder durch ein Emoji ersetzten \u2014 im Bild war die Glocke schon ein Symbol, der Mond noch gelb.',
    user_summary: '\ud83c\udf19 Die Symbole oben rechts sind jetzt gezeichnet statt Emoji \u2014 sie sehen auf jedem Ger\u00e4t gleich aus und passen zur Leiste unten.',
    user_items: [
      { emoji: '\ud83c\udf19', text: 'Mond, Glocke und Men\u00fc als Strich-Symbole' },
      { emoji: '\ud83d\udd27', text: 'Zwei Stellen, die das Symbol wieder durch ein Emoji ersetzten, umgeh\u00e4ngt' },
    ],
    items: [
      {emoji:'\ud83c\udf19', bold:'Drei neue Symbole:', text:' Mond, Schl\u00fcssel und Men\u00fc im Stil des vorhandenen Satzes gezeichnet (24\u00d724, Strichst\u00e4rke 1,75, runde Enden) und in assets/icons/ abgelegt. Glocke und Sonne gab es bereits. Alle inline eingesetzt, damit sie \u00fcber currentColor die Knopf-Farbe erben.'},
      {emoji:'\ud83d\udd27', bold:'Der Fund beim Hinsehen:', text:' im gerenderten Bild waren Glocke und Men\u00fc Symbole, der Mond aber weiter ein gelbes Emoji. Ursache: initDark() und der Umschalter in den Einstellungen setzen beide btn.textContent = on ? \'☀️\' : \'🌙\' und haben das Markup ueberschrieben. Beide nutzen jetzt innerHTML mit den Symbolen \u2014 und die sind EINMAL als GS_ICON_MOON/GS_ICON_SUN definiert, damit es nicht ein drittes Mal auseinanderl\u00e4uft.'},
    ],
    verify: [
      {emoji:'\u2705', bold:'Verify:', text:' Kopfleiste in beiden Modi gerendert und angesehen \u00b7 in beiden Modi tr\u00e4gt der Knopf ein SVG und in der ganzen Kopfleiste ist kein Emoji mehr \u00fcbrig (programmatisch gepr\u00fcft) \u00b7 keine JS-Fehler \u00b7 Kontrast 0 unter AA in beiden Modi \u00b7 Antippfl\u00e4chen 0 unter 24\u00d724 \u00b7 9/9 Inline-Scripts node --check OK \u00b7 GS_VERSION=v31.42 \u00b7 sw.js gs-v31.42 \u00b7 _headers v31.42 \u00b7 meta=31.42.20260901.'},
    ],
  },
  {
    v: 'v31.41', date: '01.09.2026',
    headline: '\ud83c\udfa8 Alle Bildschirme hell \u2014 dieselbe Sprache wie die Startseite',
    summary: 'Vierzehn Bildschirme hatten dunkle Volltoene als Fl\u00e4che \u2014 Garten gr\u00fcn, Rezepte braun, Heilmittel blau, Einstellungen schiefer. Die Startseite ist seit v31.37 hell. Jetzt sind es alle, wie in Fernandos Vorlage: eine ruhige helle Fl\u00e4che mit Karten darauf.',
    user_summary: '\ud83c\udfa8 Alle Seiten sehen jetzt aus wie die Startseite \u2014 hell und ruhig statt jede in einer anderen dunklen Farbe.',
    user_items: [
      { emoji: '\ud83c\udfa8', text: 'Garten, Wissen, Rezepte, Heilmittel, Marktplatz und acht weitere Seiten sind hell' },
      { emoji: '\ud83e\uddf9', text: 'Zwei Sonderfarb-Token entfernt, die es nur wegen der dunklen Fl\u00e4chen gab' },
    ],
    items: [
      {emoji:'\ud83c\udfa8', bold:'Zum VIERTEN Mal dasselbe Muster:', text:' die hellen Fassungen waren teils l\u00e4ngst geschrieben. Zeile ~1249 definiert f\u00fcr Rezepte und Heilmittel warme helle Verl\u00e4ufe — \u00fcberstimmt von einem Block mit vierzehn !important-Dunkelfarben am Dateiende. Genau wie bei .hero in v31.37, dem Icon-Satz in v31.38 und displayLuxResult in v31.40: die richtige Arbeit war da und nicht angeschlossen.'},
      {emoji:'\ud83e\uddf9', bold:'Zwei Token wieder abgeschafft:', text:' --on-canvas und --on-canvas-2 kamen in v31.32 dazu, WEIL die Leinw\u00e4nde dunkel waren und Text darauf helle Farben brauchte. Auf hellen Fl\u00e4chen w\u00e4ren sie jetzt genau die Falle, gegen die sie erfunden wurden: hell auf hell. Der Pr\u00fcfstand hat das sofort gezeigt — acht Stellen bei 1,03 bis 1,09:1. Alle 14 Verwendungen zurueck auf --text und --muted, die Token entfernt.'},
      {emoji:'\ud83d\udd0d', bold:'Die Reihenfolge war wichtig:', text:' erst die Leinw\u00e4nde umgestellt, dann gemessen, dann repariert. H\u00e4tte ich beides gleichzeitig gemacht, w\u00e4re nicht belegt, dass genau diese acht Stellen betroffen sind — und warum.'},
    ],
    verify: [
      {emoji:'\u2705', bold:'Verify:', text:' Kontrast nach der Umstellung: 8 Stellen unter AA (alle exakt die --on-canvas-Stellen) \u2192 nach der Korrektur 0 + 0 in beiden Modi \u00b7 Antippfl\u00e4chen 0 unter 24\u00d724 \u00b7 Garten und Community gerendert und angesehen \u00b7 Vorher/Nachher: 32 Farb\u00e4nderungen (die Leinw\u00e4nde), 0 Radius-, 0 Schriftgr\u00f6ssen\u00e4nderungen; die 6 Gr\u00f6ssen\u00e4nderungen sind der bekannte dritte Chip im Wissens-Hero, der erscheint sobald die Arten-Datenbank geladen ist \u00b7 keine JS-Fehler \u00b7 9/9 Inline-Scripts node --check OK \u00b7 GS_VERSION=v31.41 \u00b7 sw.js gs-v31.41 \u00b7 _headers v31.41 \u00b7 meta=31.41.20260901.'},
    ],
  },
  {
    v: 'v31.40', date: '01.09.2026',
    headline: '\ud83d\udca1 Der Lichtmesser war komplett kaputt \u2014 gefunden beim Verdrahtungs-Check',
    summary: 'Fernando wollte einen Funktionscheck der Ein- und Ausg\u00e4nge. Ich habe alle 1\u2019012 im Code angesprochenen Elemente gegen die tats\u00e4chlich vorhandenen gepr\u00fcft: 44 Funktionen greifen auf Elemente zu, die es nirgends gibt. Die meisten sind abgesichert und tun still nichts. Eine war es nicht \u2014 und st\u00fcrzte ab.',
    user_summary: '\ud83d\udca1 Die Lichtmessung zeigte nie ein Ergebnis \u2014 der Knopf blieb einfach h\u00e4ngen. Jetzt funktioniert sie wieder.',
    user_items: [
      { emoji: '\ud83d\udca1', text: 'Lichtmessung repariert \u2014 Lux-Wert, Kategorie und Pflanzen-Empfehlungen erscheinen wieder' },
      { emoji: '\ud83e\uddf9', text: '45 Zeilen kaputter Altcode entfernt' },
    ],
    items: [
      {emoji:'\ud83d\udd0e', bold:'Der Verdrahtungs-Check:', text:' 1\u2019012 im Code angesprochene Element-Kennungen gegen alle irgendwo erzeugten gepr\u00fcft. 75 werden nirgends erzeugt; sie verteilen sich auf 44 Funktionen. 16 davon haben \u00fcberhaupt keinen Aufrufer (toter Code), 28 laufen wirklich \u2014 aber alle bis auf eine pr\u00fcfen vorher auf null und tun dann still nichts. Zur Laufzeit: 0 doppelte ids, 0 JS-Fehler.'},
      {emoji:'\ud83d\udca1', bold:'Die eine Ausnahme:', text:' showLuxResult griff ungeschuetzt zu — document.getElementById(\'lux-val\').textContent = … Die Elemente heissen aber lux-value, lux-marker und lux-plants. Am laufenden Programm nachgewiesen: TypeError in der ersten Zeile, danach lief nichts mehr. Der Lux-Wert blieb 0, das Ergebnis blieb verborgen, die Kategorie hing auf „Messung startet…", und die Zeilen NACH dem Aufruf (Knopf zuruecksetzen) wurden nie erreicht.'},
      {emoji:'\u2705', bold:'Die L\u00f6sung lag daneben:', text:' displayLuxResult macht dasselbe richtig \u2014 korrekte ids, sauber abgesichert, und wird von zwei anderen Stellen benutzt. Nur dieser eine Aufrufer wurde beim Umbau nicht umgeh\u00e4ngt. Jetzt umgeh\u00e4ngt, die alte Fassung entfernt. Dasselbe Muster wie die helle Kopfzeile in v31.37 und der Icon-Satz in v31.38: die richtige Arbeit war fertig und nicht angeschlossen.'},
      {emoji:'\ud83c\udf29\ufe0f', bold:'Ein Fund zum Entscheiden, nicht zum Reparieren:', text:' die Wetter-Warnkarte in der App (rund 130 Zeilen, drei Funktionen) hat kein Element im Dokument, und ihr Lader hat null Aufrufer. Das klingt schlimmer als es ist: Migration, Edge-Function und Cron existieren, die Warnungen erreichen Nutzer also \u00fcber Push und Posteingang. Nur die Karte IN der App wurde nie gebaut. Entweder bauen oder entfernen \u2014 das ist eine Produktentscheidung, keine Aufr\u00e4umarbeit.'},
    ],
    verify: [
      {emoji:'\u2705', bold:'Verify:', text:' Lichtmessung vorher/nachher am laufenden Programm: vorher TypeError, Wert 0, Ergebnis verborgen, Knopf h\u00e4ngt \u2014 nachher 26\u2019554 Lux, Ergebnis sichtbar, Kategorie „🔥 Volle Sonne", Knopf auf „Erneut messen" \u00b7 keine Aufrufe von showLuxResult mehr \u00fcbrig \u00b7 zur Laufzeit 0 doppelte ids \u00fcber alle elf Tabs \u00b7 keine JS-Fehler \u00b7 Kontrast 0 unter AA in beiden Modi \u00b7 Antippfl\u00e4chen 0 unter 24\u00d724 \u00b7 9/9 Inline-Scripts node --check OK \u00b7 GS_VERSION=v31.40 \u00b7 sw.js gs-v31.40 \u00b7 _headers v31.40 \u00b7 meta=31.40.20260901.'},
    ],
  },
  {
    v: 'v31.39', date: '01.09.2026',
    headline: '\ud83e\udded Startseite neu geordnet \u2014 erst wissen, dann tun',
    summary: 'Der Tagesplan stand an sechster Stelle, hinter Kennzahlen und Marktplatz. Fernandos Vorlage folgt einer anderen Logik: erst was ich wissen muss, dann was ich tun soll. Genau so ist die Startseite jetzt sortiert \u2014 ohne dass ein Baustein wegf\u00e4llt.',
    user_summary: '\ud83e\udded Die Startseite zeigt jetzt zuerst das Wetter und dann, was heute ansteht. Fortschritt, Kennzahlen und alles Weitere folgen darunter.',
    user_items: [
      { emoji: '\ud83e\udded', text: 'Wetter und Tagesplan stehen jetzt oben \u2014 vorher an f\u00fcnfter und sechster Stelle' },
      { emoji: '\ud83d\udce6', text: 'Kein Baustein entf\u00e4llt, nur die Reihenfolge \u00e4ndert sich' },
    ],
    items: [
      {emoji:'\ud83e\udded', bold:'Vorher \u2192 nachher:', text:' XP \u00b7 Kennzahlen \u00b7 Marktplatz \u00b7 Wetter \u00b7 Tagesplan \u00b7 Quiz \u00b7 Tagesinfo wird zu Wetter \u00b7 Tagesplan \u00b7 Fortschritt \u00b7 Kennzahlen \u00b7 Tagesinfo \u00b7 Marktplatz \u00b7 Quiz. Begr\u00fcndung aus der Vorlage: das Wetter entscheidet, was heute im Garten geht \u2014 also geh\u00f6rt es nach oben; direkt danach die Aufgaben. Fortschritt, Lesestoff und Entdeckung sind wichtig, aber nicht dringend.'},
      {emoji:'\ud83d\udd0c', bold:'Verdrahtung gepr\u00fcft, bevor umgeordnet wurde:', text:' zwei Stellen im Code h\u00e4ngen an DOM-Reihenfolge. gsBuildWidgetStack (baut aus vier Karten den wischbaren Stapel) sucht per id und verschiebt die Karten selbst \u2014 ordnungsunabh\u00e4ngig. gsMoreFeedbackFirst betrifft einen anderen Bildschirm. Am laufenden Programm best\u00e4tigt: Stapel baut sich (4 Folien, 4 Punkte), Tagesplan f\u00fcllt sich, jede id genau einmal, keine JS-Fehler.'},
      {emoji:'\u26a0\ufe0f', bold:'Wo mein Vergleichswerkzeug hier NICHT hilft:', text:' es paart Elemente \u00fcber einen Schl\u00fcssel aus DOM-Pfad, id, Klasse und Text. Eine Umordnung \u00e4ndert genau diesen Pfad \u2014 also paart es zwangsl\u00e4ufig falsch. Es meldete eine Schriftgr\u00f6ssen\u00e4nderung von 12px an einem 🌱; nachgemessen sind alle vier 🌱-Elemente in beiden St\u00e4nden identisch, nur ihre Position ist eine andere. Diese Grenze steht jetzt in CLAUDE.md §7.1, samt dem, was stattdessen tr\u00e4gt.'},
    ],
    verify: [
      {emoji:'\u2705', bold:'Verify:', text:' Reihenfolge im DOM ausgelesen und best\u00e4tigt \u00b7 alle 13 gepr\u00fcften ids genau einmal vorhanden, keine fehlt \u00b7 gsBuildWidgetStack gebaut (4 Folien, 4 Punkte), Tagesplan mit 3 Eintr\u00e4gen gef\u00fcllt, 5 Nav-Icons, Edelweiss vorhanden \u00b7 keine JS-Fehler \u00b7 Kontrast 0 unter AA in beiden Modi \u00b7 Antippfl\u00e4chen 0 unter 24\u00d724 \u00b7 die eine gemeldete Schrift\u00e4nderung als Fehlpaarung nachgewiesen \u00b7 9/9 Inline-Scripts node --check OK \u00b7 GS_VERSION=v31.39 \u00b7 sw.js gs-v31.39 \u00b7 _headers v31.39 \u00b7 meta=31.39.20260901.'},
    ],
  },
  {
    v: 'v31.38', date: '01.09.2026',
    headline: '\ud83e\udded Neue Navigationsleiste \u2014 hell, mit Strich-Icons und dem Edelweiss',
    summary: 'Nach Fernandos Vorlage: helle Fl\u00e4che statt dunkelgr\u00fcnem Balken, gezeichnete Strich-Icons statt Emoji, kleine Beschriftungen in Normalschreibung. Der Mittelknopf tr\u00e4gt jetzt das Edelweiss aus dem App-Icon. Der Icon-Satz lag \u00fcbrigens schon im Repo \u2014 er war nur nie eingebaut.',
    user_summary: '\ud83e\udded Die untere Leiste ist hell und ruhig, mit gezeichneten Symbolen statt Emoji. Der Home-Knopf in der Mitte tr\u00e4gt das Edelweiss.',
    user_items: [
      { emoji: '\ud83e\udded', text: 'Helle Leiste, gezeichnete Symbole, Beschriftungen in Normalschreibung' },
      { emoji: '\ud83c\udf3c', text: 'Edelweiss im Mittelknopf \u2014 dieselbe Blume wie im App-Icon' },
    ],
    items: [
      {emoji:'\ud83c\udfa8', bold:'Der Icon-Satz lag schon da:', text:' assets/icons/ enth\u00e4lt 23 eigene Strich-Symbole mit eigenem README \u2014 und darin steht genau die Begr\u00fcndung, die Fernando jetzt genannt hat: Emoji sehen auf jeder Plattform anders aus, lassen sich nicht einf\u00e4rben und tragen f\u00fcr Screenreader nichts bei. Gebaut, dokumentiert, nie eingebaut. Die Leiste benutzte weiter Emoji. Jetzt inline eingesetzt, damit sie \u00fcber currentColor mit dem Modus mitgehen und keine zus\u00e4tzlichen Anfragen kosten.'},
      {emoji:'\ud83c\udf3c', bold:'Das Edelweiss:', text:' dieselbe Geometrie wie icons/icon.svg \u2014 zw\u00f6lf Bl\u00fctenbl\u00e4tter in zwei Lagen, sieben goldene R\u00f6hrenbl\u00fcten. Fuer 30 px mit flachen Farben statt Verl\u00e4ufen: bei der Gr\u00f6sse tr\u00e4gt ein Verlauf nichts und kostet nur Bytes.'},
      {emoji:'\ud83c\udf17', bold:'Die Leiste kippt jetzt selbst:', text:' sie war in BEIDEN Modi dunkelgr\u00fcn (--fill-dark), weshalb die Beschriftungen in v31.27 feste Farbwerte brauchten. Jetzt --card und --border, also hell im Hell- und dunkel im Dunkelmodus \u2014 und die Beschriftungen k\u00f6nnen wieder --muted und --g-dark nutzen. Drei Dunkelmodus-\u00dcberschreibungen sind dadurch \u00fcberfl\u00fcssig geworden; eine davon h\u00e4tte den Ring um den Mittelknopf im Dunkelmodus HELLgr\u00fcn gemacht.'},
      {emoji:'\u26a0\ufe0f', bold:'Ein Fallstrick auf dem Weg:', text:' die Beschriftung des Mittelknopfs stand auf color:#fff \u2014 auf der neuen hellen Leiste weiss auf weiss. Genau dieselbe Falle wie beim Wetter-Trenner in v31.28: was auf dunklem Grund richtig war, verschwindet auf hellem.'},
      {emoji:'\ud83d\udd2c', bold:'Und wieder das Werkzeug:', text:' der Vorher/Nachher-Vergleich meldete eine Gr\u00f6ssen\u00e4nderung an einem SVG, das es vorher gar nicht gab. Ursache: Elemente ohne id, Klasse und Text teilten sich den Schl\u00fcssel „SVG|||", und der Vergleich paarte zwei verschiedene Elemente. render_check.js baut den Schl\u00fcssel jetzt aus einem kurzen DOM-Pfad \u2014 vergleichbare Elemente stiegen dadurch von 1\u2019388 auf 1\u2019792.'},
    ],
    verify: [
      {emoji:'\u2705', bold:'Verify:', text:' Kontrast 0 Stellen unter AA in beiden Modi \u00b7 Antippfl\u00e4chen 0 unter 24\u00d724 \u00b7 Leiste in beiden Modi gerendert und angesehen \u00b7 Vorher/Nachher: alle 46 Gr\u00f6ssen\u00e4nderungen sind Leisten-Beschriftungen (plus der Wissens-Hero, dessen Chip-Umbruch aus v31.37 stammt), gr\u00f6sste Schriftbewegung +0,5px \u00b7 Selbstvergleich der Datei 0/0/0/0 bei 2\u2019860 Elementen \u00b7 keine JS-Fehler \u00b7 9/9 Inline-Scripts node --check OK \u00b7 GS_VERSION=v31.38 \u00b7 sw.js gs-v31.38 \u00b7 _headers v31.38 \u00b7 meta=31.38.20260901.'},
    ],
  },
  {
    v: 'v31.37', date: '01.09.2026',
    headline: '\ud83d\udc41\ufe0f Die Kopfzeile der Startseite war praktisch unsichtbar \u2014 1,32:1',
    summary: 'Fernando: „bei der Home-Seite kann man kaum lesen was oben steht." Er hatte recht, und mein Kontrast-Pr\u00fcfstand war blind daf\u00fcr: er \u00fcbersprang Text auf Farbverl\u00e4ufen, weil er ihn nicht als EINE Farbe messen konnte. Genau dort lag der schlimmste Fall der App. Der Pr\u00fcfstand misst jetzt pixelgenau \u2014 und was er dann fand, ist behoben.',
    user_summary: '\ud83d\udc41\ufe0f Die \u00dcberschrift oben auf der Startseite ist wieder lesbar \u2014 sie war dunkelgr\u00fcn auf dunkelgr\u00fcn. Dazu 20 weitere schlecht lesbare Stellen quer durch die App.',
    user_items: [
      { emoji: '\ud83d\udc41\ufe0f', text: '„Natur entdecken" von 1,3:1 auf lesbar \u2014 die Kopfzeile ist jetzt hell statt dunkel' },
      { emoji: '\ud83c\udfa8', text: 'Wissen, Rezepte, Heilmittel, Pflanzen: Text auf get\u00f6nten Fl\u00e4chen korrigiert' },
    ],
    items: [
      {emoji:'\ud83d\udd0e', bold:'Die Ursache war ein halber Umbau:', text:' die Regel `#screen-home .hero{background:var(--g-bg);color:var(--text)}` steht seit L\u00e4ngerem im Code \u2014 eine HELLE Kopfzeile, samt Dunkelmodus-Variante, fertig ausformuliert. Sie wurde von einer `.hero`-Regel am Dateiende mit !important \u00fcberstimmt (dunkelgr\u00fcner Verlauf, weisse Schrift). Die Kindregeln f\u00fcr Titel und Untertitel waren aber ebenfalls f\u00fcr HELL geschrieben, ohne !important, und deshalb wirksam: dunkelgr\u00fcner Text auf dunklem Verlauf. Zwei H\u00e4lften eines Umbaus, die sich nie getroffen haben. `class="hero"` kommt in der ganzen App GENAU EINMAL vor, also betraf die Sperre nichts anderes \u2014 sie ist entfernt, zusammen mit drei weiteren .hero-Regeln, die nie gewirkt haben.'},
      {emoji:'\ud83d\udd2c', bold:'Der Pr\u00fcfstand kann jetzt Verl\u00e4ufe:', text:' contrast_check.js las die Hintergrundfarbe bisher aus getComputedStyle und \u00fcbersprang alles mit background-image. Jetzt wird die Seite zweimal aufgenommen \u2014 einmal normal, einmal mit color:transparent \u2014 und unter jeder Textstelle der echte Pixel-Median gelesen. Damit sind Verl\u00e4ufe, Bilder und halbtransparente Schichten automatisch richtig ber\u00fccksichtigt.'},
      {emoji:'\ud83c\udfa8', bold:'21 weitere Stellen:', text:' Z\u00e4hler-Chips und Intro-Karten in Wissen/Rezepte/Heilmittel waren 10-%-T\u00f6nungen \u00fcber dunkler Leinwand mit Text f\u00fcr helle Fl\u00e4chen (1,05 bis 1,59:1) \u2014 jetzt richtige Karten. Die Pillen im Wissens-Hero und die Kennzahl-K\u00e4sten bei den Pflanzen nutzten WEISSE Transparenz \u00fcber Gr\u00fcn, was den Untergrund aufhellt und weissen Text durchfallen l\u00e4sst \u2014 jetzt dunkle. Zwei fest verdrahtete rgba(255,255,255,.96)-Fl\u00e4chen blieben im Dunkelmodus weiss.'},
      {emoji:'\ud83d\udd22', bold:'41\u00d7 #2d8a2d:', text:' dieser Gr\u00fcnton scheitert in BEIDE Richtungen mit 4,39:1 \u2014 als Fl\u00e4che mit weisser Schrift und als Schrift auf Weiss. Das Token hatte ich in v31.32 schon gezogen, die 41 fest verdrahteten Vorkommen nicht. Jetzt alle auf #1f6b2f (6,56:1).'},
      {emoji:'\ud83e\udde9', bold:'Nebenbei ein Umbruch-Fehler:', text:' im Wissens-Hero kommt ein dritter Chip dazu, sobald die Arten-Datenbank geladen ist. Drei passten nicht nebeneinander und brachen INNERHALB um \u2014 „🍂 / Herbst" auf zwei Zeilen. Jetzt rutscht bei Bedarf ein ganzer Chip in die n\u00e4chste Zeile.'},
    ],
    verify: [
      {emoji:'\u2705', bold:'Verify:', text:' Kontrast pixelgenau \u00fcber neun Tabs in beiden Modi: 28 + 12 \u2192 0 + 0 \u00b7 zwei Falschmeldungs-Klassen im Pr\u00fcfstand selbst beseitigt (Text hinter der fixierten Navigationsleiste; deaktivierte Bedienelemente, die WCAG ausdr\u00fccklich ausnimmt) \u00b7 die gemeldete Gr\u00f6ssen\u00e4nderung an den Wissens-Chips direkt nachgemessen und als ECHT best\u00e4tigt \u2014 Ursache war der dritte Chip, nicht meine \u00c4nderung; trotzdem behoben \u00b7 Antippfl\u00e4chen weiterhin 0 unter 24\u00d724 \u00b7 keine JS-Fehler \u00b7 9/9 Inline-Scripts node --check OK \u00b7 GS_VERSION=v31.37 \u00b7 sw.js gs-v31.37 \u00b7 _headers v31.37 \u00b7 meta=31.37.20260901.'},
    ],
  },
  {
    v: 'v31.36', date: '01.09.2026',
    headline: '\ud83d\udce6 787 KB Changelog, die jeder bei jedem Start mitlud',
    summary: 'Die Versionshistorie stand vollst\u00e4ndig in der Hauptdatei: 383 Eintr\u00e4ge, 787 KB, 14 Prozent der ganzen App. Geladen und geparst bei jedem Kaltstart \u2014 obwohl beim Start nur der neueste Eintrag gebraucht wird und die volle Liste nur sieht, wer den Changelog \u00f6ffnet. Jetzt bleiben die neuesten zw\u00f6lf drin, der Rest wird bei Bedarf geholt.',
    user_summary: '\ud83d\udce6 Die App ist beim Start rund 630 KB leichter. Der Changelog zeigt weiterhin die vollst\u00e4ndige Historie \u2014 er l\u00e4dt sie jetzt beim \u00d6ffnen nach.',
    user_items: [
      { emoji: '\ud83d\udce6', text: 'Hauptdatei 5,50 \u2192 4,87 MB; beim ersten Besuch 260 KB weniger \u00fcbertragen' },
      { emoji: '\u26a1', text: 'Start auf dem Telefon rund 145ms schneller' },
    ],
    items: [
      {emoji:'\ud83d\udcca', bold:'Was gemessen wurde:', text:' GS_RELEASES war mit 787 KB der gr\u00f6sste Einzelblock in index.html (14 %). Danach kommen DEFAULT_RECIPES (297 KB), WEEKLY_SEASONAL_FACTS (148 KB) und GS_I18N_JS_STRINGS (83 KB) \u2014 die werden aber tats\u00e4chlich beim Start gebraucht, der Changelog nicht.'},
      {emoji:'\ud83d\udce6', bold:'Die Aufteilung:', text:' die neuesten 12 Eintr\u00e4ge (32 KB) bleiben inline \u2014 damit funktioniert der \u201eWas ist neu\u201c-Dialog und die j\u00fcngste Historie ohne Nachladen. Die 371 \u00e4lteren (753 KB) stehen in data/releases.v1.js und werden per gsLoadReleaseArchive() geholt, wenn der Changelog ge\u00f6ffnet wird. Dasselbe Vorgehen wie bei data/plants.v1.js seit v25.10.'},
      {emoji:'\ud83d\udeab', bold:'Bewusst NICHT vor-gecacht:', text:' der Service Worker holt das Archiv nicht beim Installieren. Sonst l\u00fcde jeder 778 KB f\u00fcr einen Bildschirm, den die meisten nie \u00f6ffnen \u2014 damit w\u00e4re der halbe Gewinn wieder weg. Es f\u00e4llt unter die Standard-Strategie und ist ab dem ersten \u00d6ffnen auch offline da.'},
      {emoji:'\ud83d\udcac', bold:'Der Offline-Fall ist sichtbar:', text:' wer offline ist und den Changelog noch nie ge\u00f6ffnet hat, sieht die zw\u00f6lf vorhandenen Eintr\u00e4ge UND einen Hinweis, dass die \u00e4lteren einmal eine Verbindung brauchen. Eine Kurzliste stillschweigend als vollst\u00e4ndig auszugeben w\u00e4re die schlechtere L\u00f6sung.'},
      {emoji:'\ud83e\uddea', bold:'Was das NICHT bringt:', text:' die Parse-Zeit sank nur um rund 70ms, obwohl 630 KB verschwunden sind. Grund: entfernt wurden DATEN, und Datenliterale sind fuer die JavaScript-Maschine viel billiger als Code. Der messbare Gewinn kommt aus DOMContentLoaded (rund 145ms) und aus den 260 KB, die beim Erstbesuch gar nicht mehr \u00fcbertragen werden.'},
    ],
    verify: [
      {emoji:'\u2705', bold:'Verify:', text:' Beim Start wird NICHTS nachgeladen (Netzwerk-Mitschnitt) \u00b7 GS_RELEASES[0].v = v31.36 = GS_VERSION, der Dialog erscheint also \u00b7 Changelog ge\u00f6ffnet: erst 12 Eintr\u00e4ge sofort, dann 383 nach dem Nachladen \u00b7 Archiv blockiert: 12 Eintr\u00e4ge plus Hinweis, keine JS-Fehler \u00b7 zwei Doppell\u00e4ufe 4x gedrosselt: DOMContentLoaded 1\u2019568\u21921\u2019424ms und 1\u2019591\u21921\u2019445ms \u00b7 index.html 5,50\u21924,87 MB \u00b7 9/9 Inline-Scripts und data/releases.v1.js node --check OK \u00b7 GS_VERSION=v31.36 \u00b7 sw.js gs-v31.36 \u00b7 _headers v31.36 \u00b7 meta=31.36.20260901.'},
    ],
  },
  {
    v: 'v31.35', date: '01.09.2026',
    headline: '\u26a1 Beim Start wurde eine Sekunde lang dasselbe immer wieder durchsucht',
    summary: 'Drei Hintergrund-Beobachter durchsuchten bei JEDER DOM-\u00c4nderung das gesamte Dokument neu \u2014 und beim Start baut die App dutzende Bausteine nacheinander auf. Auf einem Mittelklasse-Telefon waren das 1\u2019127 Millisekunden verschenkte Arbeit. Jetzt wird nur noch das Neue durchsucht, und das geb\u00fcndelt.',
    user_summary: '\u26a1 Die App startet auf dem Telefon sp\u00fcrbar williger \u2014 rund eine Sekunde weniger Rechenarbeit, in der vorher kein Fingertipp ankam.',
    user_items: [
      { emoji: '\u26a1', text: 'App-Rechenzeit beim Start auf dem Telefon: 1\u2019548ms \u2192 421ms' },
      { emoji: '\u2705', text: 'Nachgemessen: die Beobachter leisten exakt dasselbe wie vorher' },
    ],
    items: [
      {emoji:'\ud83d\udd0e', bold:'Der Fund:', text:' drei MutationObserver (Auto-ARIA, Auto-Maxlength, Auto-Lazy) beobachteten document.body mit subtree:true und riefen bei jeder Mutation labelize(document) bzw. applyTo(document) bzw. patch(document) \u2014 also je ein querySelectorAll \u00fcber alle 4\u2019486 Knoten. Beim Start ergab das allein 743ms querySelectorAll.'},
      {emoji:'\u26a1', bold:'Die L\u00f6sung:', text:' die eingef\u00fcgten Teilb\u00e4ume sammeln und in EINEM Durchgang abarbeiten, wenn der Hauptstrang frei ist (requestIdleCallback mit Frist). Notbremse bei \u00fcber 300 Wurzeln: dann ist ein Durchgang \u00fcber das ganze Dokument billiger. Alle drei Funktionen pr\u00fcfen jetzt zus\u00e4tzlich die Wurzel selbst \u2014 querySelectorAll findet nur Nachkommen, ein einzeln eingef\u00fcgter Knopf w\u00e4re sonst durchgerutscht.'},
      {emoji:'\ud83d\udcc9', bold:'Ergebnis (4x gedrosselt, Mittelklasse-Telefon):', text:' App-JavaScript 1\u2019548ms \u2192 421ms. DOMContentLoaded 1\u2019683 \u2192 1\u2019470ms. Die drei querySelectorAll-Posten (269 + 261 + 177ms) und labelize (71ms) sind vollst\u00e4ndig aus der Messung verschwunden.'},
      {emoji:'\ud83e\uddf1', bold:'Was NICHT besser wurde \u2014 und warum:', text:' die l\u00e4ngste Einzelblockade sank nur von 782 auf 710ms. Sie besteht n\u00e4mlich nicht aus App-Code, sondern aus dem Parsen der 5,7-MB-Datei (2\u2019633ms). Das ist eine Eigenschaft des Monolithen und liesse sich nur durch Aufteilen \u00e4ndern \u2014 eine Architektur-Entscheidung, keine Aufr\u00e4umarbeit.'},
    ],
    verify: [
      {emoji:'\u2705', bold:'Verify:', text:' Beide St\u00e4nde mit demselben Skript gemessen (scripts/perf_check.js, neu im Repo) \u00b7 Verhaltens-Gegenprobe \u00fcber alle elf Tabs: 199 aria-labels, 65 maxlength, 7 loading-Attribute \u2014 in beiden St\u00e4nden IDENTISCH, also gleiche Wirkung bei einem Drittel der Arbeit \u00b7 Vorher/Nachher am laufenden Programm: 1\u2019522 vergleichbare Elemente, 0 \u00c4nderungen an Radius, Schriftgr\u00f6sse, Gr\u00f6sse und Farbe \u00b7 Kontrast 0 unter AA, Antippfl\u00e4chen 0 unter 24\u00d724 \u00b7 keine JS-Fehler \u00b7 9/9 Inline-Scripts node --check OK \u00b7 GS_VERSION=v31.35 \u00b7 sw.js gs-v31.35 \u00b7 _headers v31.35 \u00b7 meta=31.35.20260901.'},
    ],
  },
  {
    v: 'v31.34', date: '01.09.2026',
    headline: '\ud83d\udc46 43 zu kleine Antippfl\u00e4chen \u2014 die kleinste war 8\u00d78 Pixel',
    summary: 'Die Punkte unter den Tageskarten waren acht Pixel gross und lagen vierzehn Pixel auseinander. Die Suchfelder waren nur 18 Pixel hoch, obwohl die Leiste drumherum 37 aussieht \u2014 wer den Rand antippte, traf nichts. Beides und einiges mehr ist behoben, ohne dass sich die Optik \u00e4ndert.',
    user_summary: '\ud83d\udc46 Kleine Schaltfl\u00e4chen lassen sich jetzt zuverl\u00e4ssig treffen \u2014 die Karussell-Punkte, die Suchfelder, die Karten-Filter. Sichtbar bleibt fast alles gleich.',
    user_items: [
      { emoji: '\ud83d\udc46', text: 'Karussell-Punkte: Trefferfl\u00e4che neunmal so gross, der Punkt sieht gleich aus' },
      { emoji: '\ud83d\udd0d', text: 'Suchfelder reagieren jetzt auf die ganze sichtbare Leiste, nicht nur auf die Mitte' },
    ],
    items: [
      {emoji:'\ud83d\udc46', bold:'Karussell-Punkte:', text:' 8\u00d78px, 14px Abstand von Mitte zu Mitte. WCAG 2.5.8 verlangt 24\u00d724, und die Ausnahme f\u00fcr kleinere Ziele greift nur, wenn ein 24px-Kreis kein anderes Ziel ber\u00fchrt \u2014 bei 14px Abstand also nicht. Der Knopf ist jetzt 24\u00d724, der sichtbare Punkt sitzt als ::before darin. Die Leiste wurde dadurch 2px h\u00f6her.'},
      {emoji:'\ud83d\udd0d', bold:'Suchfelder:', text:' das Eingabefeld war 18px hoch, die Leiste drumherum 37px \u2014 deren 9px Polsterung geh\u00f6rte nicht zum Feld. Wer oben oder unten antippte, l\u00f6ste nichts aus. Das Feld reicht jetzt per padding und ausgleichendem negativem margin in die Polsterung hinein: gleiche H\u00f6he, doppelte Trefferfl\u00e4che. Betrifft Arten-, Pflanzen-, Marktplatz- und Rezeptsuche sowie die beiden Preisfelder.'},
      {emoji:'\ud83c\udf3f', bold:'Weitere:', text:' 42 Pflanzen-Chips in der Trachten-\u00dcbersicht (18px \u2192 24px hoch), f\u00fcnf Kategorie-Chips auf der Karte (21 \u2192 25px) und der Knopf \u201e+ Hinzuf\u00fcgen\u201c im Garten (22 \u2192 26px).'},
      {emoji:'\ud83d\udd2c', bold:'Drittes Pr\u00fcfwerkzeug:', text:' scripts/touch_check.js misst jede Antippfl\u00e4che \u00fcber alle elf Tabs. Es meldet bewusst keine Container, die selbst bedienbare Elemente enthalten \u2014 sonst z\u00e4hlt man doppelt.'},
    ],
    verify: [
      {emoji:'\u2705', bold:'Verify:', text:' Antippfl\u00e4chen unter 24\u00d724: 43 \u2192 0 \u00b7 Vorher/Nachher am laufenden Programm: 1\u2019522 vergleichbare Elemente, 77 Gr\u00f6ssen\u00e4nderungen (genau die vergr\u00f6sserten Ziele), 0 Radius\u00e4nderungen, 0 Schriftgr\u00f6ssen\u00e4nderungen und 1 Farb\u00e4nderung \u2014 die nachgepr\u00fcft der Punkt-Knopf selbst ist, dessen Farbe ins ::before gewandert ist \u00b7 abgeschnittener Inhalt 17 \u2192 17, aus dem Bildschirm ragend 0 \u2192 0 \u00b7 Kontrast weiterhin 0 unter AA in beiden Modi \u00b7 alle 7\u2019081 onclick-Ziele l\u00f6sen zu echten Funktionen auf \u00b7 keine JS-Fehler \u00b7 9/9 Inline-Scripts node --check OK \u00b7 GS_VERSION=v31.34 \u00b7 sw.js gs-v31.34 \u00b7 _headers v31.34 \u00b7 meta=31.34.20260901.'},
    ],
  },
  {
    v: 'v31.33', date: '01.09.2026',
    headline: '\ud83e\uddf9 52 Stilregeln, die seit Jahren wirkungslos im Code standen',
    summary: 'An 22 Stellen war dieselbe Klasse zweimal beschrieben \u2014 einmal oben im Dokument, einmal weiter unten aus einem sp\u00e4teren Umbau. Bei gleicher Spezifit\u00e4t gewinnt die sp\u00e4tere, die fr\u00fchere galt also nie. Wer die obere las, las etwas, das nicht stimmt. Entfernt; sichtbar \u00e4ndert sich nichts, und das ist nachgemessen.',
    user_summary: '\ud83e\uddf9 Aufr\u00e4umen im Unterbau: nichts sieht anders aus, aber der Code beschreibt jetzt, was die App tats\u00e4chlich tut.',
    user_items: [
      { emoji: '\ud83e\uddf9', text: '52 Stilregeln entfernt, die ohnehin nie gewirkt haben' },
      { emoji: '\u2705', text: 'Nachgemessen: an 1\u2019520 Elementen \u00e4ndert sich nichts \u2014 keine Farbe, keine Gr\u00f6sse' },
    ],
    items: [
      {emoji:'\ud83e\uddf9', bold:'Das Muster:', text:' 22 Klassen waren zweimal deklariert \u2014 die urspr\u00fcngliche Regel um Zeile 400 bis 1500, eine zweite aus einem sp\u00e4teren Umbau um Zeile 81\u2019000 bis 82\u2019700. Gleiche Spezifit\u00e4t, gleicher Selektor: die sp\u00e4tere gewinnt immer. Betroffen unter anderem .modal-close-btn (acht widersprechende Angaben, darunter position sticky gegen absolute), .sec (f\u00fcnf), .settings-group-title, .stats-grid, .post-avatar, .td. Aufgefallen ist mir das in v31.31 bei .recipe-card-desc; die Suche danach fand 52 weitere.'},
      {emoji:'\ud83d\udd0e', bold:'Vorsichtig abgegrenzt:', text:' verglichen wurden nur Regeln mit exakt EINEM Klassen-Selektor, beide ausserhalb von @media/@supports und beide ohne !important \u2014 nur dann gilt zwingend, dass die sp\u00e4tere gewinnt. Alles andere blieb unangetastet.'},
      {emoji:'\ud83d\udd2c', bold:'Der Pr\u00fcfstand wurde dabei genauer:', text:' er meldete 1 bzw. 2 Gr\u00f6ssen\u00e4nderungen, jedes Mal woanders. Ursache war er selbst: er mass mit getBoundingClientRect(), und das liefert die GEDREHTE H\u00fclle. Ein Ladekreisel (14\u00d714px, dauerhaft rotierend) ergibt darin je nach Winkel 14 bis 20px. Jetzt offsetWidth/Height \u2014 die Layout-Box, unabh\u00e4ngig von Transformationen. Damit sind zwei aufeinanderfolgende L\u00e4ufe identisch.'},
    ],
    verify: [
      {emoji:'\u2705', bold:'Verify:', text:' Vorher/Nachher am laufenden Programm, zweimal hintereinander mit gleichem Ergebnis: 1\u2019520 vergleichbare Elemente, 0 \u00c4nderungen an Radius, Schriftgr\u00f6sse, GR\u00d6SSE und Farbe \u00b7 verbleibende stille Konflikte 52 \u2192 0 \u00b7 keine leere Regel zur\u00fcckgeblieben \u00b7 Kontrast weiterhin 0 Stellen unter AA in beiden Modi \u00b7 keine JS-Fehler \u00b7 9/9 Inline-Scripts node --check OK \u00b7 GS_VERSION=v31.33 \u00b7 sw.js gs-v31.33 \u00b7 _headers v31.33 \u00b7 meta=31.33.20260901.'},
    ],
  },
  {
    v: 'v31.32', date: '01.09.2026',
    headline: '\ud83d\udc41\ufe0f 291 schlecht lesbare Textstellen \u2014 und warum meine Farbarbeit seit v31.20 nie ankam',
    summary: 'Der neue Kontrast-Pr\u00fcfstand fand 270 Textstellen im Hell- und 21 im Dunkelmodus unter dem Lesbarkeits-Mindestwert. Die Hauptursache war eine einzige Zeile JavaScript, die meine gepr\u00fcften Farbwerte zur Laufzeit \u00fcberschrieb. Jetzt sind es null in beiden Modi.',
    user_summary: '\ud83d\udc41\ufe0f Grauer Hilfstext, \u00dcberschriften auf farbigen Fl\u00e4chen und Filter-Kn\u00f6pfe sind jetzt \u00fcberall klar lesbar \u2014 in beiden Modi. Und die Wetterkachel im Garten sieht endlich aus wie der Rest.',
    user_items: [
      { emoji: '\ud83d\udc41\ufe0f', text: 'Grauer Hilfstext war 3,5:1 statt der n\u00f6tigen 4,5:1 \u2014 jetzt 6,9:1' },
      { emoji: '\ud83c\udf19', text: 'Im Dunkelmodus war Text ohne eigene Farbe schwarz auf dunkel' },
      { emoji: '\ud83c\udf24\ufe0f', text: 'Die Wetterkachel im Garten war als Einzige noch knallblau' },
    ],
    items: [
      {emoji:'\ud83d\udd0e', bold:'Die Ursache:', text:' applyThemeColors() schrieb --text/--text2/--muted/--border per setProperty auf documentElement \u2014 ein Inline-Stil, der JEDE :root-Regel schl\u00e4gt. --muted war dadurch #888888 (3,54:1 auf Weiss) statt der gepr\u00fcften Werte. Der Kommentar dar\u00fcber behauptete "always readable on light backgrounds". Betroffen war nur der Hellmodus: der Dunkelmodus definiert seine Token auf body.dark, und ein Wert auf body sticht den geerbten von html. Die vier Aufrufe sind entfernt, alte Inline-Werte werden aktiv zur\u00fcckgenommen.'},
      {emoji:'\ud83c\udfa8', bold:'Zwei Themen fielen durch:', text:' die Hauptfarbe des Standard-Themas Gr\u00fcn war #1f6b2f = 4,39:1 auf Weiss, Orange #e65100 = 3,79:1. Beide dienen als Textfarbe UND als Knopf-Hintergrund, der Wert gilt also in beide Richtungen. Neu #1f6b2f (6,56:1) und #bf360c (5,60:1).'},
      {emoji:'\ud83c\udf19', bold:'body hatte nie eine Schriftfarbe:', text:' sie war damit in beiden Modi Schwarz (der Vorgabewert). Alles ohne eigene Farbe erbte Schwarz \u2014 im Dunkelmodus schwarz auf dunkel. Zw\u00f6lf Stellen auf einen Schlag behoben.'},
      {emoji:'\ud83d\uddbc\ufe0f', bold:'Text auf farbigen Bildschirmen:', text:' vierzehn Bildschirme haben in beiden Modi eine dunkle Leinwand. Text direkt darauf nutzte --text/--muted \u2014 Token f\u00fcr HELLE Fl\u00e4chen, Ergebnis 1,01:1 bis 2,86:1. Neue Token --on-canvas / --on-canvas-2, gegen alle acht Leinwandfarben gerechnet. Meinen ersten Versuch, das \u00fcber eine gemeinsame Regel auf den Leinwaenden zu l\u00f6sen, habe ich VERWORFEN: gemessen wurde es davon schlechter (22 auf 33 Stellen).'},
      {emoji:'\ud83c\udf24\ufe0f', bold:'Nachtrag zu v31.28:', text:' die Wetterkachel im Garten blieb damals stehen \u2014 umgestellt wurde nur die auf der Startseite. Jetzt dasselbe Material; die drei von JavaScript beschriebenen IDs unver\u00e4ndert.'},
    ],
    verify: [
      {emoji:'\u2705', bold:'Verify:', text:' Kontrast-Pr\u00fcfstand \u00fcber neun Tabs in beiden Modi: 270 + 21 \u2192 0 + 0 \u00b7 Vorher/Nachher am laufenden Programm: 1\u2019522 vergleichbare Elemente, 1\u2019002 Farb\u00e4nderungen und 0 \u00c4nderungen an Radius, Schriftgr\u00f6sse und GR\u00d6SSE \u2014 genau das Profil einer reinen Farb\u00e4nderung \u00b7 abgeschnittener Inhalt 17 \u2192 17, aus dem Bildschirm ragend 0 \u2192 0 \u00b7 keine JS-Fehler \u00b7 9/9 Inline-Scripts node --check OK \u00b7 GS_VERSION=v31.32 \u00b7 sw.js gs-v31.32 \u00b7 _headers v31.32 \u00b7 meta=31.32.20260901.'},
    ],
  },
  {
    v: 'v31.31', date: '01.09.2026',
    headline: '\ud83d\udd24 Eine Typo-Skala \u2014 und 1\u2019387 Halbpixel-Schriftgr\u00f6ssen weniger',
    summary: 'Die App hatte 4\u2019739 Schriftgr\u00f6ssen in 53 Varianten, darunter 1\u2019387 Halbpixel-Werte wie 11.5px oder 12.5px. Das entscheidet niemand \u2014 das bleibt beim Nachjustieren \u00fcbrig. Sieben Textgr\u00f6ssen lagen innerhalb von 6px. Jetzt sieben Stufen \u00fcber den ganzen Bereich, jede mit einem Zweck.',
    user_summary: '\ud83d\udd24 Schriftgr\u00f6ssen folgen jetzt einer Skala statt 53 Einzelwerten. Kleine Texte sind an einigen Stellen etwas gr\u00f6sser und damit besser lesbar.',
    user_items: [
      { emoji: '\ud83d\udd24', text: 'Schriftgr\u00f6ssen: 53 Varianten \u2192 7 Stufen, keine Bewegung gr\u00f6sser als 2px' },
      { emoji: '\ud83d\udc41\ufe0f', text: 'Winzige 7,5\u20138,5px-Texte sind jetzt 10px \u2014 unter 9px liest das niemand' },
    ],
    items: [
      {emoji:'\ud83d\udd24', bold:'Die Skala:', text:' --fs-xs 10px (Marker, Fussnoten) \u00b7 --fs-sm 12px (Kleintext, Badges) \u00b7 --fs-md 14px (Fliesstext, Listen, Kn\u00f6pfe) \u00b7 --fs-lg 16px (Karten-Titel) \u00b7 --fs-xl 20px (Abschnitts-Titel) \u00b7 --fs-2xl 24px (Seiten-Titel) \u00b7 --fs-3xl 28px und --fs-4xl 32px (Kennzahlen, Hero). \u00dcber 34px bleibt alles unangetastet \u2014 das sind Hero-Ziffern und Emoji-Gr\u00f6ssen.'},
      {emoji:'\ud83d\udcd0', bold:'Bewegung:', text:' von 4\u2019739 Angaben blieben 1\u2019362 exakt gleich, 3\u2019185 r\u00fcckten auf ihre Stufe, 139 blieben unber\u00fchrt. Gr\u00f6sste Bewegung \u00b12px \u2014 Ausnahme sind sechs winzige Stellen (7,5\u20138,5px \u2192 10px), und das ist eine Verbesserung, kein Risiko. Meine erste Zuordnung h\u00e4tte 28px auf 32px und 36px auf 32px geschoben (\u00b14px); oberes Ende aufgeteilt und neu gerechnet.'},
      {emoji:'\ud83e\uddf9', bold:'Doppelte Regel gefunden:', text:' .recipe-card-desc war ZWEIMAL deklariert \u2014 einmal mit 12.5px, Zeilenh\u00f6he 1.5 und Umbruch, einmal mit 11.5px, 1.4 und einzeiliger Ellipsis. Gleiche Spezifit\u00e4t, also gewann die zweite; die erste war tot. Zusammengef\u00fchrt. Dasselbe Muster wie bei den Nav-Beschriftungen in v31.27.'},
      {emoji:'\ud83d\udd2c', bold:'Zwei neue Pr\u00fcfwerkzeuge:', text:' render_check.js misst jetzt auch \u00dcberlauf \u2014 abgeschnittener Inhalt und Elemente, die aus dem Bildschirm ragen. Der erste Anlauf meldete 72 Chip-Leisten als Fehler, die absichtlich hinausragen; verworfen und die Pr\u00fcfung verengt, bis 0 Falschalarme blieben. Neu dazu: contrast_check.js misst den WCAG-Kontrast jeder Textstelle in beiden Modi.'},
    ],
    verify: [
      {emoji:'\u2705', bold:'Verify:', text:' Vorher/Nachher am laufenden Programm: 1\u2019520 vergleichbare Elemente, 666 Schriftgr\u00f6ssen ge\u00e4ndert, 0 Farb\u00e4nderungen, 0 Radius\u00e4nderungen \u00b7 abgeschnittener Inhalt 17 \u2192 17 (die vorhandenen \u00dcberl\u00e4ufe wurden eher kleiner), aus dem Bildschirm ragend 0 \u2192 0 \u00b7 Ellipsis-Pr\u00fcfung \u00fcber 83 einzeilige Texte: 6 k\u00fcrzen neu (Zutaten-Vorschau in Rezeptkarten, +0,5px), 0 verlieren mehr als eine Zeile \u2014 das ist der Preis und er steht hier, statt verschwiegen zu werden \u00b7 keine JS-Fehler \u00b7 9/9 Inline-Scripts node --check OK \u00b7 GS_VERSION=v31.31 \u00b7 sw.js gs-v31.31 \u00b7 _headers v31.31 \u00b7 meta=31.31.20260901.'},
    ],
  },
  {
    v: 'v31.30', date: '01.09.2026',
    headline: '\ud83d\udd2c Ein Pr\u00fcfstand, der die App wirklich aufbaut',
    summary: 'Bei den letzten optischen \u00c4nderungen konnte ich nur ein Dutzend Elemente am laufenden Programm nachmessen \u2014 ohne Anmeldung blieb die App im Onboarding stecken. Jetzt sind es 2\u2019596 Elemente \u00fcber elf Tabs. Beim Bauen kam heraus, warum: nicht der Gast-Modus, sondern ein Schutz gegen Aufblitzen h\u00e4lt die App-H\u00fclle zur\u00fcck. Und der Gast-Zweig daneben war seit v25.33 tot.',
    user_summary: '\ud83d\udd2c Werkzeug f\u00fcr mich, nicht f\u00fcr dich: optische \u00c4nderungen lassen sich ab jetzt an der echten App nachmessen statt an einer Handvoll Elemente. Sichtbar \u00e4ndert sich nichts.',
    user_items: [
      { emoji: '\ud83d\udd2c', text: 'Optische \u00c4nderungen sind ab jetzt \u00fcberpr\u00fcfbar \u2014 2\u2019596 statt 11 Elemente' },
      { emoji: '\ud83e\uddf9', text: 'Ein alter Gast-Modus-Schl\u00fcssel wird beim n\u00e4chsten Start entsorgt' },
    ],
    items: [
      {emoji:'\ud83d\udd2c', bold:'scripts/render_check.js:', text:' l\u00e4dt index.html ohne Netz, baut jeden der elf Tabs auf und vermisst jedes sichtbare Element (Radius, Schriftgr\u00f6sse, Gr\u00f6sse, Farbe). Mit zwei Dateien als Argument vergleicht er zwei St\u00e4nde und meldet getrennt, was sich an Radius, Schrift, GR\u00d6SSE (also Layout) und Farbe ge\u00e4ndert hat.'},
      {emoji:'\ud83d\udd0d', bold:'Warum es vorher nicht ging:', text:' nicht die fehlende Anmeldung, sondern der Login-Flash-Guard \u2014 ohne gs_sb_token setzt er html.gs-preauth und damit #app{display:none!important}. Der Pr\u00fcfstand setzt deshalb einen Token. Auf dem Weg dorthin hatte ich einen eigenen Denkfehler: mein Regel-Sucher pr\u00fcfte if (r.cssRules), und das ist seit CSS Nesting bei JEDER Style-Regel wahr \u2014 er hat nie eine Regel angesehen und meldete \u201ekeine Regel gefunden\u201c.'},
      {emoji:'\ud83e\uddf9', bold:'Toter Gast-Zweig entfernt:', text:' gsCheckOnboarding hatte eine Ausnahme \u201eGast kehrt zur\u00fcck \u2192 kein Onboarding\u201c. Die tat seit v25.33 nichts, weil dort der Demo-Modus abgeschaltet und gsActivateGuestMode auf einen leeren Rumpf gesetzt wurde. Kein Nutzer war dadurch ausgesperrt \u2014 nachgemessen, der Alt-Gast landete im selben Zustand wie jeder Abgemeldete. Der Zweig log nur im Kommentar. Der Schl\u00fcssel gs_guest_mode wird jetzt einmalig entsorgt.'},
      {emoji:'\u2705', bold:'v31.29 nachtr\u00e4glich belegt:', text:' die Radien-Skala aus der Vorversion mit dem neuen Pr\u00fcfstand gegengerechnet: 1\u2019524 vergleichbare Elemente, 316 Radien ge\u00e4ndert, gr\u00f6sste Bewegung 2px \u2014 und 0 Schriftgr\u00f6ssen, 0 Gr\u00f6ssen\u00e4nderungen, 0 Farb\u00e4nderungen. Genau das Profil, das eine reine Radius-\u00c4nderung haben muss.'},
    ],
    verify: [
      {emoji:'\u2705', bold:'Verify:', text:' Pr\u00fcfstand auf der aktuellen index.html: Onboarding blockiert nicht, keine JS-Fehler, 2\u2019596 Elemente \u00fcber 11 Tabs \u00b7 Entfernung des toten Zweigs gegen den Vorstand vermessen: 1\u2019524 vergleichbare Elemente, 0 Unterschiede in Radius, Schrift, Gr\u00f6sse und Farbe \u00b7 Alt-Gast-Fall vorher/nachher gepr\u00fcft: gleicher Zustand wie ein neuer Nutzer, Schl\u00fcssel entsorgt \u00b7 9/9 Inline-Scripts node --check OK \u00b7 GS_VERSION=v31.30 \u00b7 sw.js gs-v31.30 \u00b7 _headers v31.30 \u00b7 meta=31.30.20260901.'},
    ],
  },
  {
    v: 'v31.29', date: '01.09.2026',
    headline: '\u25a2 Eine Radien-Skala statt 55 Einzelentscheidungen',
    summary: 'Die App hatte 2\u2019286 Angaben f\u00fcr abgerundete Ecken in 55 verschiedenen Werten \u2014 von 2px bis 28px in Einerschritten. 9px neben 10px neben 11px, ohne dass das jemand so entschieden h\u00e4tte. Jetzt ein 4px-Raster mit sechs benannten Stufen. Beim Umbau kam ein Fehler ans Licht, der \u00e4lter ist als diese \u00c4nderung: Export und Druck erzeugen eigenst\u00e4ndige Dokumente, in denen die Farb-Token der App gar nicht gelten.',
    user_summary: '\u25a2 Abgerundete Ecken folgen jetzt \u00fcberall demselben Raster \u2014 vorher gab es 55 leicht verschiedene Werte. Und der PDF-Export bekommt seine Farben zur\u00fcck.',
    user_items: [
      { emoji: '\u25a2', text: 'Ecken-Rundungen: 55 Varianten \u2192 6 Stufen, kein Wert bewegt sich mehr als 2px' },
      { emoji: '\ud83d\udcc4', text: 'PDF-Export und Druck zeigten seit v31.20 falsche Farben \u2014 behoben' },
    ],
    items: [
      {emoji:'\u25a2', bold:'Skala statt Streuung:', text:' --r-xs 4px (Marker, Balken) \u00b7 --r-sm 8px (Badges, Tags) \u00b7 --r-md 12px (Kn\u00f6pfe, Eingabefelder) \u00b7 --r-lg 16px (Karten) \u00b7 --r-xl 22px (Modale, Sheets) \u00b7 --r-pill 999px. Kreise bleiben 50%, weil das sich selbst erkl\u00e4rt. 2\u2019188 Stellen nutzen jetzt Token; 11 Werte (26/27/28px) blieben bewusst stehen, weil sie zu weit von jeder Stufe liegen, um sie stillschweigend zu verschieben.'},
      {emoji:'\ud83d\udcd0', bold:'Wie weit sich etwas bewegt:', text:' von 2\u2019481 Einzelwerten blieben 790 exakt gleich, 1\u2019398 r\u00fcckten auf ihre Stufe, 293 blieben unber\u00fchrt (50%, 0, inherit). Gr\u00f6sste Bewegung \u00b12px \u2014 mit genau einer Ausnahme: das Onboarding-Logo (80\u00d780px) ging von 19px auf 22px. Im Browser nachgemessen, nicht gesch\u00e4tzt.'},
      {emoji:'\ud83d\udcc4', bold:'Der \u00e4ltere Fehler:', text:' Der Garten-Plan-Export (Blob) und der Garten-Scan-Druck (iframe) bauen eigenst\u00e4ndige HTML-Dokumente. Die kennen das :root der App nicht \u2014 var(--c-success) & Co. l\u00f6sten sich dort zu nichts auf. Seit der Farb-Welle in v31.20 druckte der Export also schwarze Schrift auf transparenten Fl\u00e4chen. Mit den Radien w\u00e4re derselbe Fehler noch einmal dazugekommen. Beide Dokumente bekommen jetzt \u00fcber GS_DOC_TOKENS ihre eigenen Werte \u2014 die hellen, weil Gedrucktes nicht dem App-Modus folgt.'},
    ],
    verify: [
      {emoji:'\u2705', bold:'Verify:', text:' Beide erzeugten Dokumente im Browser gerendert und jedes Token gegen getComputedStyle gepr\u00fcft \u2014 --r-sm\u21928px, --c-success\u2192rgb(46,125,50), --c-success-d\u2192rgb(27,94,32), --bg-success-soft\u2192rgb(232,245,233) \u00b7 App vorher/nachher geladen: tats\u00e4chlich gerenderte Radien-Varianten 38 \u2192 19, keine JS-Fehler in beiden \u00b7 kein Element wechselt die Form (keine neue Pille, keine verlorene) \u2014 Abdeckung dabei nur 11 vergleichbare Elemente, weil die App ohne Anmeldung nicht mehr aufbaut \u00b7 9/9 Inline-Scripts node --check OK \u00b7 GS_VERSION=v31.29 \u00b7 sw.js gs-v31.29 \u00b7 _headers v31.29 \u00b7 meta=31.29.20260901.'},
    ],
  },
  {
    v: 'v31.28', date: '01.09.2026',
    headline: '🌤️ Die Wetterkarte passt jetzt zum Rest der Startseite',
    summary: 'Das Wetter-Widget war der letzte laute Block auf der Startseite: kräftiger Blau-Verlauf mit weisser Schrift, während daneben alles auf heller Karte mit ruhigem Rahmen sitzt. Es hat jetzt dasselbe Material wie jede andere Karte — Farbe nur noch dort, wo sie etwas aussagt: bei der Sturmwarnung.',
    user_summary: '🌤️ Die Wetterkarte auf der Startseite sieht aus wie alles andere — ruhig statt knallblau. Und die 4-Tage-Vorschau zeigt jetzt immer dasselbe, egal wie die App geladen hat.',
    user_items: [
      { emoji: '🌤️', text: 'Wetterkarte in Karten-Optik statt blauem Verlauf — Farbe bleibt der Warnung vorbehalten' },
      { emoji: '📅', text: 'Vorschau zeigte je nach Ladeweg 3 oder 4 Tage — jetzt immer 4' },
      { emoji: '👁️', text: 'Ein Ladeweg hätte die Vorschau weiss auf weiss gezeichnet — behoben, bevor es jemand sah' },
    ],
    items: [
      {emoji:'🌤️', bold:'Ein Material für alle Karten:', text:' das Widget nutzte linear-gradient(135deg,#0d47a1,#1565c0) mit weisser Schrift. Jetzt --card / --border / --elev-1 wie jede andere Karte. Alle zehn von JavaScript beschriebenen IDs (hw-icon, hw-temp, hw-desc, hw-wind, hw-humidity, hw-uv, hw-warning, hw-warning-text, hw-forecast, home-weather-widget) unverändert — je genau einmal im Dokument geprüft.'},
      {emoji:'👁️', bold:'Zwei Wege, zwei Ergebnisse:', text:' die 3-Tages-Vorschau wurde an zwei Stellen unabhängig gerendert. loadHomeWeather() (Live-Abruf beim Start) schrieb color:#fff und rgba(255,255,255,.7) fest — auf der neuen hellen Karte unsichtbar — und zeigte 4 Spalten; gsApplyWeatherToWidget() (Cache-Treffer) zeigte 3 mit geerbter Farbe. Beide gehen jetzt durch _gsWxForecastHtml().'},
      {emoji:'📏', bold:'Trenner nur zwischen den Spalten:', text:' der eine Weg zeichnete border-right auf jede Spalte, also auch hinter der letzten; der andere schob ein Trenner-<div> dazwischen. Jetzt .gs-wx-day + .gs-wx-day{border-left} — eine Regel, kein Rest.'},
      {emoji:'🔤', bold:'Wochentage aus der Übersetzung:', text:' der Cache-Weg hatte die Kürzel als deutsches Array fest im Code (So,Mo,Di…), der Live-Weg las sie aus gsI18n. Beide lesen jetzt gsI18n — die Vorschau ist damit auch in den anderen Sprachen richtig beschriftet.'},
    ],
    verify: [
      {emoji:'✅', bold:'Verify:', text:' Kontrast der Vorschau in beiden Modi gerechnet (Tagesname 7,11:1 hell / 7,76:1 dunkel, Min-Temperatur 4,95:1 / 6,08:1 — alle über AA 4,5:1) · Helper-Quelle direkt aus index.html in einen Playwright-Prüfstand geladen und in drei Zuständen gerendert (hell, dunkel, hell mit Warnung), keine JS-Fehler · 10/10 IDs je genau einmal · 9/9 Inline-Scripts node --check OK · GS_VERSION=v31.28 · sw.js gs-v31.28 · _headers v31.28 · meta=31.28.20260901.'},
    ],
  },
  {
    v: 'v31.27', date: '01.09.2026',
    headline: '🧭 Die untere Navigation war im Hellmodus kaum lesbar',
    summary: 'Die Navigationsleiste ist in beiden Modi dunkelgrün — ihre Beschriftung nutzte aber Farb-Token für helle Flächen. Im Hellmodus ergab das 1,86:1 für den aktiven und 2,28:1 für die übrigen Reiter. Im Dunkelmodus hatte das jemand dreimal überschrieben, im Hellmodus nie.',
    user_summary: '🧭 Die Beschriftungen der unteren Navigation sind wieder klar lesbar — im Hellmodus waren sie fast unsichtbar.',
    user_items: [
      { emoji: '🧭', text: 'Reiter-Beschriftungen im Hellmodus von 1,9:1 auf 7,4:1' },
      { emoji: '🧹', text: 'Vier widersprüchliche Farbregeln für dieselben Reiter entfernt — jetzt eine' },
    ],
    items: [
      {emoji:'🧭', bold:'Dunkle Fläche, helle Token:', text:' .tabs nutzt --fill-dark (in beiden Modi dunkel), .tab aber --muted und --g-main. Die stimmen nur für helle Flächen. Feste Werte (#9db89d / #a5d6a7) gegen beide Leisten-Hintergründe gerechnet: 5,7–8,8:1.'},
      {emoji:'🧹', bold:'Eine Quelle statt fünf:', text:' es gab vier body.dark-Überschreibungen für dieselben zwei Zustände, teils widersprüchlich, plus eine doppelte Basisregel. Alle entfernt — die Fläche ist in beiden Modi dieselbe, also braucht sie auch nur eine Farbe.'},
      {emoji:'✅', bold:'Nicht gebaut:', text:' der runde grüne Mittelknopf aus den Entwürfen existiert seit v26.86. Drittes Mal in dieser Runde, dass Nachsehen vor Doppelarbeit bewahrt hat.'},
    ],
  },
  {
    v: 'v31.26', date: '01.09.2026',
    headline: '🌗 Jeder Hauptknopf war im Dunkelmodus blass — 146 Flächen',
    summary: 'Nach drei Einzelfunden habe ich das Muster systematisch gesucht: Farb-Token, die im Dunkelmodus heller werden (richtig für Schrift), wurden an 146 Stellen als Fläche mit weisser Schrift benutzt. Jeder Hauptknopf, jeder aktive Chip, jeder aktive Reiter lag dort bei 2,4:1. Fläche und Schrift sind jetzt getrennte Rollen.',
    user_summary: '🌗 Knöpfe, Chips und Reiter sind im Dunkelmodus wieder klar lesbar — vorher waren sie blassgrün mit weisser Schrift.',
    user_items: [
      { emoji: '🔘', text: '146 Flächen im Dunkelmodus korrigiert — Knöpfe, Chips, Reiter, Kopfleiste' },
      { emoji: '👁️', text: 'Weisse Schrift auf Grün: von 2,4:1 auf 5,7:1' },
      { emoji: '🔒', text: 'Hellmodus unverändert — die neuen Token tragen exakt die alten Werte' },
    ],
    items: [
      {emoji:'🔍', bold:'Systematisch statt zufällig:', text:' alle Token verglichen, deren Helligkeit sich zwischen Hell- und Dunkelmodus umkehrt (29 Stück — das ist für eine Textfarbe richtig), und geprüft, welche davon als Fläche dienen. Ergebnis: 146 Stellen, davon 124 mit weisser Schrift.'},
      {emoji:'🎭', bold:'Rollen getrennt:', text:' --fill-brand, --fill-dark, --fill-violet, --fill-warn sind Flächen und bleiben im Dunkelmodus dunkel. --g-main und Co. bleiben Schrift und werden hell. Ein Token kann nicht beides.'},
      {emoji:'🐛', bold:'Nebenbefund:', text:' --c-warn-d als Fläche mit weisser Schrift schaffte auch im HELLmodus nur 3,79:1. --fill-warn ist deshalb bewusst dunkler (5,75:1) — der einzige Wert, der sich im Hellmodus ändert.'},
      {emoji:'🟢', bold:'Live-Punkt:', text:' heller Puls-Hintergrund mit --c-info-d als Text — im Dunkelmodus hell auf hell. Jetzt fest dunkler Text (7,4:1).'},
    ],
  },
  {
    v: 'v31.25', date: '01.09.2026',
    headline: '🌾 Ruhige Kopfzone — und die Kopfleiste war nachts unlesbar',
    summary: 'Die Startseite beginnt jetzt hell und ruhig: kleine Gruss-Zeile mit Blatt, darunter „Dein Garten" in Serifen, darunter was heute gilt. Das Grün erscheint als Karte, nicht mehr als breites Band. Beim Rendern fiel ein echter Fehler auf: die Kopfleiste der App war im Dunkelmodus hellgrün mit weisser Schrift.',
    user_summary: '🌾 Die Startseite beginnt ruhig und hell — und die Kopfleiste ist im Dunkelmodus endlich lesbar.',
    user_items: [
      { emoji: '🌾', text: 'Helle, ruhige Kopfzone statt grünem Band — wie in den Entwürfen' },
      { emoji: '🌙', text: 'Kopfleiste im Dunkelmodus war hellgrün mit weisser Schrift — behoben' },
      { emoji: '🍃', text: 'Gruss mit Namen und Blatt-Symbol, darunter „Dein Garten" in Serifen' },
    ],
    items: [
      {emoji:'🐛', bold:'Kopfleiste im Dunkelmodus:', text:' body.dark .topbar setzte var(--g-dark) — und --g-dark ist im Dunkelmodus HELLGRÜN (#a5d6a7), weil sich die Skala umkehrt. Titel und alle Knöpfe sind aber fest weiss. Ergebnis: 1,64:1, praktisch unsichtbar. Jetzt #122212 → 16,6:1.'},
      {emoji:'🌾', bold:'Nur die Startseite:', text:' .hero wird von mehreren Bildschirmen benutzt; die helle Kopfzone gilt gezielt für #screen-home. Ein globaler Eingriff wäre hier nicht prüfbar gewesen.'},
      {emoji:'🔔', bold:'Keine zweite Glocke:', text:' die Entwürfe zeigen eine Glocke neben dem Gruss — die gibt es in der Kopfleiste bereits. Eine zweite hätte genau die Doppelung erzeugt, die eine App zusammengesetzt wirken lässt.'},
    ],
  },
  {
    v: 'v31.24', date: '01.09.2026',
    headline: '🤍 Hochwertig und einfach — warme Flächen, „Heute zu tun"',
    summary: 'Die Startseite folgt jetzt den neuen Entwürfen: eine warme Creme-Fläche statt grünstichigem Weiss, ein tieferes Waldgrün, und „Heute zu tun" als EINE Karte mit Kästchen zum Abhaken. Die Prioritäts-Plaketten sind weg — was bleibt, ist eine Zeile, die sagt was ansteht, und ein Kästchen, das es erledigt.',
    user_summary: '🤍 Ruhigere, wärmere Oberfläche — und „Heute zu tun" hakst du jetzt einfach ab.',
    user_items: [
      { emoji: '☑️', text: 'Aufgaben mit einem Tipp abhaken — die Zeile klappt sanft zu' },
      { emoji: '🤍', text: 'Warme Creme-Fläche statt grünstichigem Weiss' },
      { emoji: '🌲', text: 'Tieferes Waldgrün — eleganter und endlich gut lesbar' },
      { emoji: '✂️', text: 'Weniger auf der Seite: keine Prioritäts-Plaketten, keine zweite Hervorhebung' },
    ],
    items: [
      {emoji:'🎨', bold:'Palette:', text:' --g-bg #eef7ee → #f4f1ea, --surface2 → #f7f4ee, --border → #e3ded3 (warm-neutral statt grün). --g-main #1f6b2f → #1f6b2f: lag als Text bei 4,0:1 und war damit schon vorher unter der Lesbarkeitsschwelle; jetzt 5,8:1 auf Creme und 6,6:1 mit weisser Schrift darauf.'},
      {emoji:'☑️', bold:'Abhaken:', text:' Kästchen füllt sich, Zeile klappt zu, dann erledigt gsNcDoneTask → gsQuickDone. Weiterhin genau eine Erledigt-Logik. Bei „Bewegung reduzieren" entfällt der Übergang, die Reihenfolge bleibt.'},
      {emoji:'✂️', bold:'Weniger:', text:' Prioritäts-Plaketten und die separate „Nächster Schritt"-Karte aus v31.16 entfernt. Beide Entwürfe zeigen sie nicht — und „sehr simpel" heisst weglassen, bis nur das übrig ist, was man antippt.'},
    ],
  },
  // ── Aeltere Eintraege: data/releases.v1.js (v31.36) ──────────────────────
  // Die Liste stand hier vollstaendig und war 787 KB gross — 14 % von
  // index.html, geparst bei jedem Kaltstart, obwohl beim Start nur [0]
  // gebraucht wird. Die 371 aelteren Eintraege liegen jetzt im Archiv und
  // werden nachgeladen, wenn der Changelog im Ueber-Modal geoeffnet wird.
  // Zum Lesen der VOLLEN Liste immer gsAllReleases() benutzen, nicht
  // GS_RELEASES direkt.
  {
    v: 'v31.23', date: '01.09.2026',
    headline: '🎚️ Bewegung — drei Stufen statt 85 Varianten',
    summary: 'Alle Übergänge laufen jetzt in drei abgestimmten Geschwindigkeiten. Und: wer im Betriebssystem „Bewegung reduzieren" gewählt hat, bekam dreizehn Bildläufe trotzdem animiert — der JS-Parameter hat Vorrang vor der CSS-Regel. Das ist behoben.',
    user_summary: '🎚️ Übergänge fühlen sich einheitlich an — und „Bewegung reduzieren" wird jetzt überall respektiert.',
    user_items: [
      { emoji: '🎚️', text: 'Drei abgestimmte Geschwindigkeiten statt acht zufälliger Dauern' },
      { emoji: '♿', text: '„Bewegung reduzieren" gilt jetzt auch für gleitende Bildläufe' },
    ],
    items: [
      {emoji:'✅', bold:'Was schon da war:', text:' die globale reduced-motion-Regel existiert seit v24.43 und deckt alle CSS-Animationen und -Übergänge ab. Ich wollte sie hinzufügen und habe vorher nachgesehen — das wäre doppelte Arbeit gewesen.'},
      {emoji:'♿', bold:'Die echte Lücke:', text:' 13× scrollIntoView({behavior:"smooth"}). Der JS-Parameter hat laut Spezifikation Vorrang vor scroll-behavior aus CSS, die globale Regel greift dort also nicht. Neuer Helfer gsScrollBehavior() fragt die Einstellung ab.'},
      {emoji:'🎚️', bold:'190 von 194 Übergängen auf Token:', text:' --dur-fast (.12s) / --dur (.18s) / --dur-slow (.3s). Die vier Ausnahmen sind „none" und die .01ms aus dem reduced-motion-Block.'},
    ],
  },
  {
    v: 'v31.22', date: '01.09.2026',
    headline: '✨ Oberflächen aus einem Guss — Tiefe und Glas',
    summary: 'Die App benutzte 133 verschiedene Schatten und 10 verschiedene Glas-Unschärfen. Das ist keine Gestaltung, das ist Rauschen — und der Grund, warum sie zusammengesetzt statt aus einem Guss wirkte. Jetzt vier Höhenstufen und drei Unschärfen für alles, mit eigenen Werten für den Dunkelmodus.',
    user_summary: '✨ Karten, Dialoge und die schwebenden Glas-Kacheln folgen jetzt einer gemeinsamen Bildsprache statt jeder für sich.',
    user_items: [
      { emoji: '🃏', text: 'Vier klare Höhenstufen: Zeile, Karte, hervorgehoben, Dialog' },
      { emoji: '🔮', text: 'Alle Glas-Effekte in drei abgestimmten Stärken statt zehn' },
      { emoji: '🌗', text: 'Im Dunkelmodus eigene, tiefere Schatten — ein 7-%-Schatten ist auf dunklem Grund unsichtbar' },
    ],
    items: [
      {emoji:'📏', bold:'Gemessen statt geschätzt:', text:' 2287 Radien in 58 Varianten, 237 Schatten in 133 Varianten, 192 Übergänge in 85 Varianten. Angefasst wurden Schatten und Glas — beides begrenzt und prüfbar.'},
      {emoji:'🔮', bold:'74/74 Glas-Effekte:', text:' blur(3–14px) auf drei Token (--blur-sm/md/lg) abgebildet; die häufigsten Werte bleiben unverändert.'},
      {emoji:'🃏', bold:'119 Schatten umgestellt:', text:' Token-Anteil bei box-shadow von 73 auf 195 von 238. Bewusst NICHT angefasst: 13 mehrschichtige Puls-Animationen, 4 Inset-Schatten und die Fokus-Ringe (0 0 0 3px) — das sind keine Höhen.'},
      {emoji:'🐛', bold:'Eigener Fehler:', text:' der erste Lauf ersetzte nur 3 Schatten. Mein Schutz gegen mehrschichtige Werte prüfte auf Kommas — und jedes rgba() enthält Kommas. Jetzt werden Klammern zuerst entfernt.'},
    ],
  },
  {
    v: 'v31.21', date: '01.09.2026',
    headline: '🌗 Dunkelmodus, zweite Welle — 184 weitere Stellen',
    summary: 'Weiter beim Farbsystem: sechs neue Flächen-Familien (Violett, Indigo, Limette, Rosa, Braun, neutrale Panel-Fläche) mit je eigenem Dunkel-Wert. Dabei kam ein echter Lesbarkeits-Fehler ans Licht: die neutralen Diagnose-Flächen blieben im Dunkelmodus weiss — und der helle Text darauf war praktisch unsichtbar.',
    user_summary: '🌗 Zweite Welle im Dunkelmodus: 184 weitere Flächen sitzen jetzt richtig — darunter ein Abschnitt, der nachts unlesbar war.',
    user_items: [
      { emoji: '🌗', text: '184 weitere Flächen und Beschriftungen im Dunkelmodus korrigiert' },
      { emoji: '👁️', text: 'Die neutralen Diagnose-Flächen waren nachts weiss mit hellem Text — jetzt lesbar' },
      { emoji: '🔒', text: 'Hellmodus wieder unverändert: jeder neue Token trägt exakt den ersetzten Wert' },
    ],
    items: [
      {emoji:'📐', bold:'Farbabstand statt Bauchgefühl:', text:' vor dem Zusammenlegen von Tönen den CIE76-Abstand gerechnet. Nur #f0f7ee lag unter der Wahrnehmungsschwelle (ΔE 1,98). Alles andere hätte das HELLE Design sichtbar verändert — deshalb bekam jeder Ton einen eigenen Token statt einer Zusammenlegung.'},
      {emoji:'🎨', bold:'11 neue Token:', text:' --surface-neutral, --bg-violet/indigo/lime/pink/brown-soft plus die passenden Textfarben. Jeder Dunkel-Wert gegen den eigenen Tint UND gegen die Karte durchgerechnet; alle 18 vorkommenden Kombinationen liegen über 4,5:1.'},
      {emoji:'🚫', bold:'#fff bewusst NICHT angefasst:', text:' unter den 25 Stellen sind weisse Knöpfe auf farbigen Bannern, ein SVG für den PDF-Export und die Raster-Linien des Scanners. Ein pauschales Ersetzen hätte die kaputtgemacht — das braucht Einzelfall-Prüfung, keine Tabelle.'},
      {emoji:'📉', bold:'Bilanz:', text:' hartkodierte helle Hintergründe 474 → 225 → 111. Der Rest sind Einzelfälle (7×, 6×, 5× …) und die 25 #fff.'},
    ],
  },
  {
    v: 'v31.20', date: '01.09.2026',
    headline: '🌗 Dunkelmodus — 523 Stellen leuchteten nicht mehr',
    summary: 'Die App hat seit Langem ein durchdachtes Farbsystem mit passenden Dunkel-Varianten. An 523 Stellen wurde es umgangen und der helle Wert direkt hineingeschrieben — jede davon leuchtete nachts wie ein Scheinwerfer. Alle auf das System umgestellt. Im Hellmodus ändert sich dabei kein einziges Pixel, weil die Token exakt dieselben Werte liefern.',
    user_summary: '🌗 Der Dunkelmodus ist jetzt wirklich dunkel — 523 helle Flächen, die nachts blendeten, sitzen jetzt im System.',
    user_items: [
      { emoji: '🌗', text: '523 grelle Flächen im Dunkelmodus behoben — Hinweise, Warnungen, Abzeichen, Diagnosen' },
      { emoji: '👁️', text: 'Jede Text-auf-Fläche-Kombination erreicht jetzt den Lesbarkeits-Standard (4,5:1)' },
      { emoji: '🔒', text: 'Im Hellmodus ändert sich nichts — dieselben Farbwerte wie vorher' },
    ],
    items: [
      {emoji:'🔁', bold:'523 Ersetzungen:', text:' 249 Hintergründe und 274 Textfarben auf die vorhandenen Token (--bg-*-soft, --c-*). Nachgewiesen: alle 18 Token lösen im Hellmodus exakt auf den ersetzten Hexwert auf — 0 Abweichungen, der Hellmodus ist pixelgleich.'},
      {emoji:'👁️', bold:'Sechs Token-Werte korrigiert:', text:' --c-danger-d lag im Dunkelmodus bei 2,2:1, --c-info-d bei 2,2:1, --c-brown bei 3,5:1. Ein reines Umstellen hätte das Leuchten behoben und dafür unlesbaren Text erzeugt. Alle 12 tatsächlich vorkommenden Kombinationen jetzt ≥ 4,5:1 (vorher schlechtester Wert 2,2:1).'},
      {emoji:'🔘', bold:'Füllung ≠ Textfarbe:', text:' vier gefüllte Knöpfe nutzten eine TEXT-Farbe als Hintergrund. Wird die im Dunkelmodus hell, ist weisse Schrift darauf unlesbar. Eigene Klassen .gs-btn-info/.gs-btn-ok mit eigener Dunkel-Regel.'},
      {emoji:'📋', bold:'Rest offen:', text:' 225 helle Hintergründe ohne Token-Zwilling (u.a. #f0f7ee, #f9fafb, #ede7f6, #fce4ec). Die brauchen neue Token — eigene Welle, kein Schnellschuss.'},
    ],
  },
  {
    v: 'v31.19', date: '01.09.2026',
    headline: '📷 Garten-Foto-Analyse zeigt, was gerade passiert',
    summary: 'Beim Erstellen des 3D-Gartenmodells aus Fotos stand bisher eine einzige Zeile — für die ganze Dauer der KI-Analyse über bis zu vier Bilder. Jetzt siehst du die Stufen: Fotos lesen, Grundstück schätzen, Beete und Zonen zuordnen, 3D-Modell aufbauen. Der Balken schätzt die Dauer und läuft bewusst nur bis 90 % — fertig ist es, wenn das Ergebnis wirklich da ist.',
    user_summary: '📷 Beim Foto-zu-3D-Modell siehst du jetzt, welcher Schritt gerade läuft, statt nur „bitte warten".',
    user_items: [
      { emoji: '🪜', text: 'Vier Stufen statt einer Zeile — du siehst, woran die KI gerade arbeitet' },
      { emoji: '⏳', text: 'Der Balken schätzt die Dauer und bleibt bei 90 %, bis das Ergebnis da ist' },
    ],
    items: [
      {emoji:'🪜', bold:'tpStartProgress():', text:' vier Stufen mit Zeitachse, alle 600 ms neu gezeichnet, gestoppt in jedem Ausgang der Analyse (Erfolg wie Fehler).'},
      {emoji:'🚫', bold:'Kein erfundener Fortschritt:', text:' ein Vision-Aufruf liefert keine Fortschrittsmeldung. Der Balken ist ausdrücklich eine Zeit-Schätzung und hält bei 90 %; ein Balken, der 100 % behauptet, während noch gewartet wird, wäre gelogen.'},
    ],
  },
  {
    v: 'v31.18', date: '01.09.2026',
    headline: '🩺 Pflanzendoktor — Ursachen mit Wahrscheinlichkeit, dann zu Lina',
    summary: 'Das Diagnose-Ergebnis zeigt die möglichen Ursachen jetzt als eine Liste mit Balken und Prozentwerten, statt einer grossen Diagnose und grauen Restposten darunter. Neu darunter: „Zu Lina wechseln" — der Knopf stellt deiner Coachin genau die Frage, die nach jeder Diagnose kommt: und was mache ich jetzt konkret?',
    user_summary: '🩺 Diagnose zeigt alle Ursachen mit Wahrscheinlichkeit — und du kannst direkt zu Lina wechseln.',
    user_items: [
      { emoji: '📊', text: 'Alle möglichen Ursachen mit Balken und Prozent, nach Wahrscheinlichkeit sortiert' },
      { emoji: '🌿', text: '„Zu Lina wechseln" — sie bekommt die Diagnose mit und antwortet sofort' },
      { emoji: '🌗', text: 'Dringlichkeits-Band und „Profi rufen"-Hinweis leuchten im Dunkelmodus nicht mehr' },
    ],
    items: [
      {emoji:'📊', bold:'Echte Werte:', text:' die Edge-Function plant-doctor-diagnose liefert je Hypothese ein confidence zwischen 0 und 1. Hier wird nichts geschätzt — die Prozentzahlen kommen aus der Diagnose selbst.'},
      {emoji:'🌿', bold:'gsDoctorToLina():', text:' öffnet Lina und schreibt die Frage ins normale Eingabefeld, gsLinaSend() übernimmt. Damit gelten dieselben Regeln wie für jede andere Nachricht — Konversation anlegen, in coach_messages speichern, Quota zählen, Verlauf mitschicken. Kein zweiter Sendeweg.'},
      {emoji:'🌗', bold:'Dunkelmodus:', text:' das Dringlichkeits-Band und der „Profi rufen"-Kasten hatten ihre Farben fest verdrahtet (#fff8e1, #fff3e0) und leuchteten nachts. Jetzt CSS-Klassen mit body.dark-Varianten.'},
    ],
  },
  {
    v: 'v31.17', date: '31.08.2026',
    headline: '🌻 Mein Garten — Überblick in vier Kacheln',
    summary: 'Der Garten-Bildschirm beginnt jetzt mit einem Überblick: Pflanzen in Pflege, angelegte Beete, gespeicherte Pläne — und der nächste Schritt, den ein Tippen erledigt. Darunter ein Knopf zum Pflegeplan. Jede Kachel führt dorthin, wo ihre Zahl herkommt.',
    user_summary: '🌻 „Mein Garten" zeigt oben auf einen Blick, wo du stehst — und was als Nächstes dran ist.',
    user_items: [
      { emoji: '🔢', text: 'Pflanzen, Beete und Pläne als Zahlen — jede Kachel führt zur passenden Liste' },
      { emoji: '➡️', text: 'Nächster Schritt direkt in der Übersicht, antippen erledigt ihn' },
      { emoji: '🌗', text: 'Funktioniert in Hell und Dunkel gleichermassen' },
    ],
    items: [
      {emoji:'🔢', bold:'gsRenderGardenOverview():', text:' liest ps_myplants, gs_gardens und gs_garden_plans frisch aus dem Speicher (nicht aus den globalen Variablen — die sind nach einem Cloud-Pull veraltet) sowie gsGetDueTasks für den nächsten Schritt.'},
      {emoji:'🚫', bold:'Keine erfundenen Zahlen:', text:' die Entwürfe zeigen „Pflegezonen" und „Lichtzonen" aus dem Sensor-Produkt. Dafür gibt es in dieser App keine Entsprechung — statt Kacheln mit Fantasiewerten stehen dort Zahlen, die es wirklich gibt.'},
      {emoji:'🎯', bold:'Ziele geprüft:', text:' die Pläne-Kachel ruft gsPlansOpen (mit Rückfall auf gsPPopenSavedPlans), die Beete-Kachel scrollt zur Liste auf demselben Bildschirm. Kein Klick ins Leere.'},
    ],
  },
  {
    v: 'v31.16', date: '31.08.2026',
    headline: '🌅 Startseite — Dein Tagesplan',
    summary: 'Die Startseite beantwortet jetzt die Frage, wegen der man die App überhaupt öffnet: Was ist heute zu tun? Oben steht die Begrüssung mit deinem Namen, darunter „Dein Tagesplan" mit bis zu drei Aufgaben nach Dringlichkeit — und ganz unten genau ein hervorgehobener nächster Schritt, den ein Tippen erledigt. Die Aufgaben gab es längst, sie standen nur auf dem Pflanzen-Tab und in der Glocke, nicht dort, wo man zuerst hinschaut.',
    user_summary: '🌅 Die Startseite zeigt dir jetzt sofort, was heute ansteht — und erledigt es mit einem Tippen.',
    user_items: [
      { emoji: '📋', text: '„Dein Tagesplan" mit Priorität Hoch / Mittel / Niedrig' },
      { emoji: '➡️', text: 'Ein hervorgehobener nächster Schritt — antippen und erledigt' },
      { emoji: '👋', text: 'Begrüssung mit deinem Namen als Überschrift statt einer Zeile, die jeden Tag gleich war' },
      { emoji: '🌿', text: 'Der Untertitel sagt, was gerade gilt: offene Aufgaben, demnächst Fälliges oder die Saison' },
    ],
    items: [
      {emoji:'📋', bold:'gsRenderDayPlan():', text:' liest gsGetDueTasks() (Pflanze, Aufgabe, Tage bis fällig) — dieselbe Quelle wie Notizzettel und Glocke. Erledigen läuft über gsNcDoneTask → gsQuickDone, es gibt also weiterhin genau eine Erledigt-Logik.'},
      {emoji:'🔁', bold:'Gezeichnet in initHomeBoard:', text:' läuft beim Boot, beim Tab-Wechsel und nach dem Login. Zusätzlich nach jedem Erledigen und am Ende von renderMyPlants, damit der Plan nach einem Cloud-Pull nicht „keine Pflanze" behauptet.'},
      {emoji:'🎨', bold:'Nur Token-Farben:', text:' die Karten nutzen --card/--surface2/--border und funktionieren dadurch in Hell und Dunkel; beides gerendert und geprüft.'},
      {emoji:'✏️', bold:'Verben statt Anzeigenamen:', text:' ein pauschales toLowerCase() auf „Schädlinge prüfen" ergab „Basilikum schädlinge prüfen". Jetzt eine kleine Verb-Tabelle je Aufgabenart.'},
    ],
  },
  {
    v: 'v31.15', date: '31.08.2026',
    headline: '🏆 Quiz-Rangliste — du standest mit 0 drin',
    summary: 'Wer noch nicht in der Cloud-Rangliste stand — neu angemeldet, Übertragung fehlgeschlagen oder ausserhalb der Top 50 —, sah sich selbst mit 0 richtigen Antworten und 0 Prozent, obwohl der eigene Stand längst gespeichert war. Die Zahl rechts hiess ausserdem „Punkte 2026", war aber die Anzahl richtiger Antworten insgesamt. Beides berichtigt, und die beste Serie steht jetzt in der Liste.',
    user_summary: '🏆 Die Rangliste zeigt deinen echten Stand statt einer Null — und dazu deine beste Serie.',
    user_items: [
      { emoji: '🏆', text: 'Dein eigener Eintrag zeigt deinen wirklichen Stand, auch ausserhalb der Top 50' },
      { emoji: '🔥', text: 'Beste Serie („x in Folge") wird angezeigt — die Zahl kam schon immer mit, nur sah sie niemand' },
      { emoji: '🏷️', text: 'Ehrliche Beschriftung: „richtig gesamt" statt „Punkte 2026"' },
    ],
    items: [
      {emoji:'🏆', bold:'localEntry las Phantom-Felder:', text:' stats.yearPoints/yearCorrect/yearTotal werden von niemandem geschrieben — einziger Schreiber war dqShowResult, eine Funktion ohne Aufrufstelle. Jetzt dieselben Felder, die die echten Antwort-Handler pflegen, und dieselbe Währung wie die Cloud-Zeilen.'},
      {emoji:'🏷️', bold:'Beschriftung:', text:' quiz_leaderboard hat weder Punkte-Spalte noch Jahresbezug; die Überschrift sagte selbst „gesamt". Die Zahl stand zudem identisch nochmal in der Zeile darunter.'},
      {emoji:'📅', bold:'dqDayKey():', text:' vier Stellen rechneten den Quiz-Tag unabhängig voneinander aus. Jetzt eine Funktion — mit dem ausdrücklichen Hinweis, dass sie UTC bleiben MUSS, solange fn_get_daily_quiz mit current_date rotiert (sonst liesse sich dieselbe Frage zweimal beantworten).'},
    ],
  },
  {
    v: 'v31.14', date: '31.08.2026',
    headline: '🔥 Streaks — sie verschwanden beim zweiten Gerät',
    summary: 'Wer sich auf einem zweiten Gerät anmeldete, verlor seine Tages-Serie: der Abgleich schrieb die vier zusammengehörenden Werte einzeln, und ein Gerät ohne Serie leerte dabei die Prüfsumme — beim nächsten Lesen galt der Datensatz als manipuliert und wurde auf 0 gesetzt. Auch der Login-Streak fiel auf 1, weil nur die Zahl übertragen wurde, nicht der zugehörige Tag. Und die App rechnete an drei Stellen mit zwei verschiedenen Tagesgrenzen.',
    user_summary: '🔥 Deine Tages-Serie überlebt jetzt den Wechsel auf ein anderes Gerät — und der Tag wechselt um Mitternacht, nicht um zwei Uhr morgens.',
    user_items: [
      { emoji: '🔥', text: 'Die Serie verschwindet nicht mehr, wenn du dich auf einem zweiten Gerät anmeldest' },
      { emoji: '📱', text: 'Der weiter fortgeschrittene Stand gewinnt — aktiv auf irgendeinem Gerät zählt' },
      { emoji: '🕛', text: 'Der Tag wechselt um Mitternacht Ortszeit, nicht um 01:00/02:00 Uhr' },
    ],
    items: [
      {emoji:'🔥', bold:'Streak als ein Datensatz:', text:' gs_streak, gs_last_active_day_iso, gs_streak_stamp und gs_streak_sig werden nur noch gemeinsam übernommen. Ein Gerät ohne Streak schickte streak=null (übersprungen) mit sig="" (geschrieben) — die Prüfsumme passte nicht mehr und gsGetStreak setzte auf 0.'},
      {emoji:'📈', bold:'Weiter-fortgeschritten gewinnt:', text:' späterer Tag, bei gleichem Tag der höhere Wert. Bleibt lokal stehen, wird die Cloud über das bestehende Repair-Signal nachgezogen.'},
      {emoji:'🔑', bold:'gs_last_login im State-Blob:', text:' bisher wurde nur gs_login_streak übertragen. Gerät B bekam die Zahl ohne den Tag, sah beim Start eine Lücke, setzte auf 1 und schob die 1 zurück.'},
      {emoji:'🕛', bold:'Eine Tagesgrenze:', text:' gsCheckLoginStreak und checkAndUpdateStreak nutzen jetzt _gsDayKey/_gsDayDiff (Ortszeit) statt toISOString (UTC). In der Schweiz begann der neue Tag sonst um 01:00 bzw. 02:00 Uhr.'},
    ],
  },
  {
    v: 'v31.13', date: '31.08.2026',
    headline: '📰 „Was ist neu" zeigte seit über hundert Updates dasselbe',
    summary: 'Der Dialog nach einem Update setzte die neue Versionsnummer als Überschrift, darunter aber immer den obersten Listen-Eintrag — und der stand seit Juni auf v30.03. Über hundert Updates lang las jeder Nutzer dieselben alten Notizen unter einer neuen Nummer. Die fehlenden Versionen sind nachgetragen, und der Dialog bleibt künftig lieber aus, als etwas Falsches zu zeigen.',
    user_summary: '📰 Der „Was ist neu"-Dialog zeigte seit Juni immer dieselben Notizen. Nachgetragen und abgesichert.',
    user_items: [
      { emoji: '📰', text: 'Alle fehlenden Versionen seit Juni sind nachgetragen' },
      { emoji: '🚫', text: 'Passt der Eintrag nicht zur laufenden Version, bleibt der Dialog aus — statt Falsches zu zeigen' },
      { emoji: '📖', text: 'Im Über-Modal heisst der Block nur noch „Aktuelle Version", wenn er es auch ist' },
    ],
    items: [
      {emoji:'🚫', bold:'Abgleich statt Vertrauen:', text:' showWhatsNew vergleicht GS_RELEASES[0].v mit GS_VERSION und bricht sonst ab — ohne gs_seen_version zu stempeln, damit der Eintrag später noch ankommt. Konsole sagt, was fehlt.'},
      {emoji:'📖', bold:'gsRenderAboutChangelog:', text:' der Highlight-Block heisst „Letzter dokumentierter Eintrag", wenn er nicht der laufenden Version entspricht.'},
      {emoji:'📰', bold:'Sechs Einträge nachgetragen:', text:' v31.09–v31.12 einzeln, v30.92–v31.08 und v30.04–v30.91 als Sammel-Einträge mit Verweis auf STATUS.md.'},
    ],
  },
  {
    v: 'v31.12', date: '31.08.2026',
    headline: '🗺️ Karte & Tracking — Aufzeichnung fortsetzen',
    summary: 'Die GPS-Aufzeichnung kann jetzt tatsächlich fortgesetzt werden, wenn sie unterbrochen wurde — bisher blieb nur „speichern" oder „verwerfen". Dazu: die Karte läuft beim Wandern mit, ein Punkt zeigt die aktuelle Position, ungenaue erste Ortungen verbiegen die Linie nicht mehr, und lange Touren werden nicht mehr vorne abgeschnitten.',
    user_summary: '🗺️ Unterbrochene Tracks lassen sich fortsetzen. Die Karte läuft beim Wandern mit, und lange Touren bleiben vollständig.',
    user_items: [
      { emoji: '▶️', text: 'Unterbrochene Aufzeichnung fortsetzen — statt nur speichern oder verwerfen' },
      { emoji: '🧭', text: 'Die Karte läuft mit und zeigt deine aktuelle Position; verschiebst du selbst, lässt sie dich in Ruhe' },
      { emoji: '📏', text: 'Lange Touren bleiben ganz — vorher begann eine Sechs-Stunden-Wanderung in der Mitte' },
      { emoji: '📡', text: 'Schwaches GPS steht jetzt in der Statuszeile, statt wie eine Pause auszusehen' },
      { emoji: '🏅', text: 'Wander-Abzeichen zählen wieder korrekt — ab Track 31 liefen sie rückwärts' },
    ],
    items: [
      {emoji:'▶️', bold:'Wiederherstellung mit drei Wegen:', text:' Fortsetzen (hängt an denselben Track an), als beendet speichern, verwerfen. Wegtippen heisst „später entscheiden". Altersgrenze 30 min → 24 h.'},
      {emoji:'🔁', bold:'Wach-Timer statt totem watchId-Test:', text:' der Wiederanlauf prüfte eine Bedingung, die nie wahr werden konnte. Jetzt entscheidet der Zeitpunkt des letzten Fixes.'},
      {emoji:'💾', bold:'Zeitbasiertes Sichern:', text:' vorher „alle 10 Punkte" — wer stillstand, wurde nie gesichert. Dazu visibilitychange und pagehide.'},
      {emoji:'📐', bold:'Ausdünnen statt Abschneiden:', text:' erster und letzter Punkt bleiben immer erhalten, die Form der Tour auch.'},
      {emoji:'🏅', bold:'Monotone Zähler:', text:' track_count/track_distance_km lasen die gedeckelte Liste und schrieben den kleineren Wert auf dem Server fest.'},
    ],
  },
  {
    v: 'v31.11', date: '31.08.2026',
    headline: '⚙️ Einstellungen — ein Datenschutz-Schalter zeigte falsch',
    summary: 'Der Schalter „Erfolge im Community-Feed zeigen" las einen rein lokalen Wert und nicht den Server. Auf einem neuen Gerät stand er dadurch auf „an", auch wenn man sich anderswo bewusst abgemeldet hatte. Bei einer Datenschutz-Einstellung ist ein falsch angezeigter Zustand das eigentliche Problem.',
    user_summary: '⚙️ Der Schalter für Erfolge im Community-Feed zeigt jetzt auf jedem Gerät deinen echten Stand.',
    user_items: [
      { emoji: '🔒', text: 'Datenschutz-Schalter zeigt auf jedem Gerät den wirklich gültigen Zustand' },
      { emoji: '🧹', text: 'Sieben Einstellungs-Einträge entfernt, deren Schalter es gar nicht mehr gab' },
    ],
    items: [
      {emoji:'🔒', bold:'opt_in_achievement_feed:', text:' wurde nur geschrieben, nie zurückgelesen. sbLoadProfile spiegelt den Server-Wert jetzt in Vorliebe und Checkbox.'},
      {emoji:'🧹', bold:'toggleMap aufgeräumt:', text:' 12 → 5 Einträge; die entfernten Schalter existieren im DOM nicht mehr, Push-Kategorien laufen über gs_push_settings.'},
    ],
  },
  {
    v: 'v31.10', date: '31.08.2026',
    headline: '🎨 Eigenes Icon-Set — 23 Symbole',
    summary: 'Ein eigenes, einheitliches Symbol-Set unter assets/icons: 23 SVGs, zusammen rund 7 KB, alle 24×24 mit gleicher Strichstärke. Sie erben die Textfarbe, passen sich also automatisch an Hell- und Dunkelmodus an.',
    user_summary: '🎨 Ein eigenes Symbol-Set — einheitlich, winzig, und es passt sich automatisch an Hell- und Dunkelmodus an.',
    user_items: [
      { emoji: '🎨', text: '23 eigene Symbole statt zusammengesuchter Emojis' },
      { emoji: '🌗', text: 'Sie übernehmen die Textfarbe — hell wie dunkel richtig' },
    ],
    items: [
      {emoji:'🎨', bold:'assets/icons:', text:' 23 SVGs, 24×24, Strichstärke 1.75, currentColor, ~7 KB gesamt, mit README und Vorschau-Seite.'},
    ],
  },
  {
    v: 'v31.09', date: '31.08.2026',
    headline: '💬 Community — Kommentare liken, teilen, benachrichtigen',
    summary: 'Kommentare lassen sich jetzt liken und disliken, Beiträge und Kommentare teilen. Und Likes erscheinen als Benachrichtigung — bisher erfuhr man schlicht nie, dass jemand reagiert hat.',
    user_summary: '💬 Kommentare liken und disliken, Beiträge teilen — und du erfährst endlich, wenn jemand dein Ding mag.',
    user_items: [
      { emoji: '👍', text: 'Kommentare liken und disliken' },
      { emoji: '🔗', text: 'Beiträge und Kommentare teilen' },
      { emoji: '🔔', text: 'Likes kommen als Benachrichtigung an — überall' },
    ],
    items: [
      {emoji:'👍', bold:'comment_reactions:', text:' eigene Tabelle mit RLS, Reaktions-Leiste je Kommentar, Verfügbarkeits-Flag falls die Migration noch nicht läuft.'},
      {emoji:'🔔', bold:'fn_notify_post_like / fn_notify_comment_like:', text:' Likes erzeugen serverseitig eine Benachrichtigung.'},
    ],
  },
  {
    v: 'v30.92 – v31.08', date: '08/2026',
    headline: '🛡️ Deine Daten gehen nicht mehr verloren',
    summary: 'Siebzehn Releases an einem Thema: Datenhaltung. Abmelden und wieder anmelden löschte das Konto auf allen Geräten. Das Cloud-Backup war da, nur nicht erreichbar. Der Speicher verschluckte Fehler, sodass bei vollem Speicher das Anmelden still fehlschlug. Der Sync verglich Geräte- gegen Server-Uhr. Fotos lagen im knappen 5-MB-Speicher. Rotierende Listen warfen alte Einträge weg. Alles behoben und nachgeprüft.',
    user_summary: '🛡️ Siebzehn Releases zu einem Thema: deine Daten bleiben, wo sie hingehören — auf jedem Gerät.',
    user_items: [
      { emoji: '🔐', text: 'Abmelden und wieder anmelden löscht nichts mehr' },
      { emoji: '☁️', text: 'Das Cloud-Backup ist jetzt auch wirklich erreichbar' },
      { emoji: '📷', text: 'Fotos liegen sicher und gehen beim Hochladen nicht mehr verloren' },
      { emoji: '📦', text: 'Alte Einträge wandern ins Archiv statt ins Nichts — mit Export' },
      { emoji: '🛡️', text: 'Mehrere Sicherheitslücken geschlossen (Rollen, Quiz-Antworten, Marktplatz-Chat)' },
    ],
    items: [
      {emoji:'📚', bold:'Sammel-Eintrag:', text:' fasst v30.92 bis v31.08 zusammen. Die vollständige Sprint-Historie steht in STATUS.md, Sektion 0.'},
    ],
  },
  {
    v: 'v30.04 – v30.91', date: '06–08/2026',
    headline: '📚 Sammel-Eintrag — Wissen, Quiz, Benachrichtigungen, Härtung',
    summary: 'Diese Versionen wurden seinerzeit nur in STATUS.md dokumentiert und fehlten hier. Schwerpunkte: Ausbau des Wissens-Bereichs, mehr Quiz-Fragen mit Bildern, ein eigener Platz für Benachrichtigungen und Mitteilungen, Übersetzungen, sowie laufende Absicherung von Backend und Datenschutz.',
    user_summary: '📚 Nachgetragen: Wissen ausgebaut, Quiz erweitert, Benachrichtigungen mit eigenem Platz, viel Absicherung im Hintergrund.',
    user_items: [
      { emoji: '📖', text: 'Wissens-Bereich ausgebaut' },
      { emoji: '🧠', text: 'Mehr Quiz-Fragen, teils mit Bildern' },
      { emoji: '🔔', text: 'Benachrichtigungen und Mitteilungen haben einen eigenen Platz bekommen' },
    ],
    items: [
      {emoji:'📚', bold:'Sammel-Eintrag:', text:' diese Versionen fehlten in GS_RELEASES. Details je Release in STATUS.md, Sektion 0.'},
    ],
  },
  {
    v: 'v30.03', date: '21.06.2026',
    headline: '💾 Pläne speichern — zuverlässig, mit „Meine Pläne"',
    summary: 'Großer Fix: KI-Garten- und Baum-Pläne verschwinden nicht mehr. Jeder Plan wird automatisch gespeichert (auf dem Gerät immer, in der Cloud wenn eingeloggt) und erscheint unter „Meine Pläne" — auf allen Geräten, mit Stern-Favoriten und Löschen. Der Baum-Planer ist zudem schöner und schlägt dir jetzt passende Bäume für deinen Standort vor.',
    user_summary: '💾 Pläne verschwinden nicht mehr — alles landet zuverlässig in „Meine Pläne". Baum-Planer mit Standort-Empfehlungen.',
    user_items: [
      { emoji: '💾', text: 'Auto-Speichern aller Pläne (Gerät + Cloud) + „Meine Pläne"-Liste' },
      { emoji: '⭐', text: 'Favoriten, Löschen, geräteübergreifend' },
      { emoji: '🌟', text: 'Baum-Planer schlägt passende Bäume für deinen Standort vor' },
    ],
    items: [
      {emoji:'💾', bold:'Unified Persistenz (gsPlans):', text:' eine robuste Speicher-Schicht ersetzt die zerfaserten Alt-Systeme. localStorage IMMER zuerst (nie verlierbar) + Cloud garden_plans (eingeloggt). „Meine Pläne" liest alle Quellen inkl. Legacy, lädt je Typ (Garten/Baum) korrekt zurück.'},
      {emoji:'🌳', bold:'Baum-Planer v30.03:', text:' Auto-Save + Speichern-Button + Meine-Pläne, Standort-Fit-Empfehlungen (deterministischer Score) + Fit-Badge, schönere Liste.'},
    ],
  },
  {
    v: 'v30.02', date: '20.06.2026',
    headline: '📷 Baum-Planer: aus Fotos einen 3D-Plan',
    summary: 'Welle 2 des Baum-Pflanz-Planers: fotografiere deinen Garten (1–4 Bilder) — die KI schätzt Grundstücksgrösse, Grenzen, Himmelsrichtung und vorhandene Bäume/Gebäude und baut daraus eine 3D-Szene, die du danach korrigierst. Dann platzierst du deinen Wunschbaum wie gewohnt mit allen Berechnungen.',
    user_summary: '📷 Neu: Garten fotografieren → die KI schätzt Grundstück & Umgebung und baut einen 3D-Plan, den du anpasst.',
    user_items: [
      { emoji: '📷', text: 'Foto(s) → KI-Schätzung von Grösse, Grenzen & vorhandenen Bäumen' },
      { emoji: '🧊', text: '3D-Szene aus dem Foto — frei anpassbar' },
    ],
    items: [
      {emoji:'📷', bold:'Bild→3D (Welle 2):', text:' callVisionAI schätzt aus 1–4 Gartenfotos Plot-Masse/Himmelsrichtung/Hang/Boden + vorhandene Objekte (Baum/Gebäude/Weg/Hecke/Zaun) mit ungefährer Position → strukturierte Szene.'},
      {emoji:'🔧', bold:'Anpassbar:', text:' Schätzung füllt die Standort-Felder + zeigt eine 3D-Vorschau der erkannten Umgebung; alles editierbar, klar als KI-Schätzung gekennzeichnet.'},
    ],
  },
  {
    v: 'v30.01', date: '20.06.2026',
    headline: '🌳 Neuer Baum-Pflanz-Planer',
    summary: 'Der KI-Planer kann jetzt auch Bäume & Gehölze: wähle deinen Standort und einen von 76 häufigen Schweizer Pflanzbäumen — die App berechnet Grenzabstand, Pflanzloch, Pfahl, Verbissschutz, Mulch und Bewässerung, zeigt eine Material-Stückliste mit Kosten, eine Schritt-für-Schritt-Anleitung und ein 3D-Modell mit Wuchs-Vorschau und Grenzabstand-Check. Inkl. Gift- und Bestäubungs-Hinweisen.',
    user_summary: '🌳 Neu: Baum-Pflanz-Planer mit Grenzabstand, Zaun/Material/Kosten, Pflanz-Anleitung und 3D-Wuchsvorschau.',
    user_items: [
      { emoji: '🌳', text: '76 Schweizer Pflanzbäume mit vollem Steckbrief' },
      { emoji: '📏', text: 'Grenzabstand, Pflanzloch, Pfahl, Mulch & Kosten — alles berechnet' },
      { emoji: '🧊', text: '3D-Vorschau mit Wuchs-Slider & Grenzabstand-Check' },
    ],
    items: [
      {emoji:'🌳', bold:'Baum-Pflanz-Modus:', text:' 76 häufige CH-Pflanzbäume (Obst/Hecke/Hausbaum/Beeren/Zier/Wild/Nadel), autoritativ recherchiert + sicherheitsgeprüft (Giftigkeit/Wurzelrisiko).'},
      {emoji:'📐', bold:'Alles mitberechnet:', text:' Grenzabstand (CH-Faustregel + Disclaimer), Pflanzloch, Substrat, Pfahl, Verbissschutz, Mulch, Bewässerung — Material-Stückliste mit CHF-Spanne.'},
      {emoji:'🧊', bold:'3D + Wuchs-Vorschau:', text:' drehbares 3D-Modell, Slider von heute bis Endgrösse, roter/grüner Grenzabstand-Ring.'},
    ],
  },
  {
    v: 'v29.82', date: '19.06.2026',
    headline: '🌍 Saison-Pilz-Bereich jetzt in allen 5 Sprachen',
    summary: 'Der neue Saison-Pilz-Bereich spricht jetzt vollständig deine App-Sprache (DE/EN/ES/FR/IT) — auch die Bedien-Texte wie „Saison-Pilze in deiner Region", die Verwechsler-Warnung und der VAPKO-Hinweis. Damit ist der ganze Pilz-Bereich durchgängig mehrsprachig.',
    user_summary: '🌍 Der Saison-Pilz-Bereich ist jetzt komplett auf DE/EN/ES/FR/IT (inkl. Sicherheits-Hinweise).',
    user_items: [
      { emoji: '🌍', text: 'Bedien-Texte des Pilz-Bereichs in 5 Sprachen' },
      { emoji: '☠️', text: '„Tödlicher Doppelgänger" & VAPKO-Hinweis übersetzt' },
    ],
    items: [
      {emoji:'🌍', bold:'12 neue Chrome-Strings × 4 Sprachen:', text:' der Saison-Pilz-Vollbild-Bereich nutzt jetzt durchgängig die App-Sprache. Sicherheits-Texte treu übersetzt.'},
    ],
  },
  {
    v: 'v29.81', date: '19.06.2026',
    headline: '🍄 Neuer Saison-Pilz-Bereich — gross, regional & mit Wachstums-Wissen',
    summary: 'Der regionale Saison-Pilz-Teil ist zu einem eigenen, grossen Bereich ausgebaut: Öffne ihn über die „Saison-Pilze in deiner Region"-Karte und du siehst alle für deine Region & Höhenlage sammelbaren Pilze als übersichtliche Karten — mit Anfänger-Ampel, Lebensraum, Verwechsler-Warnung (☠️ bei tödlichen Doppelgängern direkt sichtbar) und neu: Wachstums-Wissen für 54 Speisepilze (wann sie wachsen, nach welchem Wetter, wo genau suchen — recherchiert und faktengeprüft). Tippe einen Pilz für den vollen Steckbrief. Im Zweifel immer zur VAPKO-Pilzkontrolle.',
    user_summary: '🍄 Neuer grosser Saison-Pilz-Bereich pro Region: Karten mit Ampel, Verwechsler-Warnung & Wachstums-Wissen (wann/wo welcher Pilz).',
    user_items: [
      { emoji: '🗺️', text: 'Eigener Bereich mit allen Pilzen deiner Region & Höhe' },
      { emoji: '⏱️', text: 'Wachstums-Wissen: wann & nach welchem Wetter, wo suchen' },
      { emoji: '☠️', text: 'Tödliche Doppelgänger direkt auf der Karte markiert' },
      { emoji: '🚦', text: 'Anfänger-Ampel + Tap für vollen Steckbrief' },
    ],
    items: [
      {emoji:'🍄', bold:'Vollbild-Saison-Pilz-Bereich:', text:' region-aware (Höhenband, Monat), reiche Karten je Pilz (Ampel, Name, VAPKO, jetzt-in-Saison, Lebensraum, Mykorrhiza-Partner, inline Verwechsler-Gefahr), tap → voller Steckbrief.'},
      {emoji:'⏱️', bold:'Wachstums-Wissen (54 Speisepilze):', text:' wann sie fruchten, nach welchem Wetter, konkreter Suchort — recherchiert aus mykologischen Quellen + Faktencheck. Erscheint je Pilz auf der Karte.'},
      {emoji:'🔒', bold:'Sicherheit:', text:' tödliche Doppelgänger sind direkt markiert; jeder Fund vor dem Essen zur VAPKO-Pilzkontrolle, Notruf 145.'},
    ],
  },
  {
    v: 'v29.80', date: '19.06.2026',
    headline: '📸 Scan-Foto wird gespeichert — sieh, wie es aussah',
    summary: 'Ab jetzt wird das Foto, das beim Scannen zur Analyse genutzt wird, zusammen mit dem Scan im Verlauf gespeichert. So kannst du in der Scan-Historie immer nachsehen, wie die Pflanze beim Scan ausgesehen hat — bisher gab es dort nur ein winziges Vorschaubild. Funktioniert für Kamera- und Galerie-Scans, speicherschonend (die letzten Scans behalten das volle Foto).',
    user_summary: '📸 Das Scan-Foto wird jetzt im Verlauf gespeichert — in der Scan-Historie siehst du, wie die Pflanze aussah.',
    user_items: [
      { emoji: '📸', text: 'Analyse-Foto wird beim Scan mitgespeichert' },
      { emoji: '🔍', text: 'In der Scan-Historie als grösseres Bild ansehbar' },
      { emoji: '💾', text: 'Speicherschonend: die jüngsten Scans behalten das Foto' },
    ],
    items: [
      {emoji:'📸', bold:'Foto im Verlauf:', text:' je Scan ein Medium-Foto (~480px) im lokalen Verlauf (zusätzlich zum Cloud-Foto bei eingeloggten Nutzern). Kamera- und Galerie-Scans abgedeckt.'},
      {emoji:'💾', bold:'Speicher-schonend (HL#10):', text:' das Foto bleibt auf den 24 jüngsten Scans; bei Speicher-Engpass werden zuerst Fotos abgeworfen, die Verlauf-Daten bleiben immer erhalten.'},
      {emoji:'📝', bold:'Hinweis:', text:' gilt für den Pflanzen-Scanner; Pilz-/Doktor-Scans folgen separat.'},
    ],
  },
  {
    v: 'v29.79', date: '19.06.2026',
    headline: '⚡ Admin-Panel: kein Einfrieren mehr beim Öffnen',
    summary: 'Behoben: Beim Öffnen des Admin-Panels schien die App ein paar Sekunden „einzufrieren" — weil erst alle Daten geladen wurden, bevor überhaupt etwas erschien. Jetzt zeigt sich sofort ein Lade-Hinweis, und das Panel erscheint, sobald die Daten da sind. (Nur für Admins relevant.)',
    user_summary: '⚡ Admin-Panel friert beim Öffnen nicht mehr ein — sofortiger Lade-Hinweis statt Sekunden ohne Reaktion.',
    user_items: [
      { emoji: '⚡', text: 'Admin-Panel öffnet mit sofortigem Lade-Hinweis' },
      { emoji: '🧊', text: 'Kein gefühltes Einfrieren mehr beim Laden' },
    ],
    items: [
      {emoji:'⚡', bold:'Freeze-Fix:', text:' openAdminPanel zeigte das Fenster erst NACH 13 parallelen Daten-Abrufen (+ grossem Render) → beim Klick passierte sekundenlang nichts. Jetzt erscheint sofort ein Lade-Modal, das durch das fertige Panel ersetzt wird.'},
      {emoji:'ℹ️', bold:'Hinweis:', text:' der XP-Balken selbst öffnet das leichte Profil (mit Sofort-Skeleton) — das schwere Fenster war das Admin-Panel.'},
    ],
  },
  {
    v: 'v29.78', date: '19.06.2026',
    headline: '🌦️ Home aufgeräumt: Unwetter-Card raus + Wetter lädt zuverlässig',
    summary: 'Zwei Verbesserungen am Home-Wetter: Die rote Unwetter-Warn-Card im Home ist entfernt (auf Wunsch — die Wetter-Warnungen kommen weiterhin als Push-Benachrichtigung). Und der nervige Wetter-Fehler beim ersten Öffnen ist behoben: Bisher erschien oft kurz „Wetter nicht verfügbar" und man musste neu laden — jetzt versucht die App den Abruf automatisch mehrfach, sodass Standort und Wetter direkt erscheinen.',
    user_summary: '🌦️ Unwetter-Card im Home entfernt + „Wetter nicht verfügbar"-Fehler beim Start behoben (kein Neuladen mehr nötig).',
    user_items: [
      { emoji: '🧹', text: 'Unwetter-Warn-Card aus dem Home entfernt' },
      { emoji: '🔁', text: 'Wetter lädt jetzt zuverlässig beim ersten Öffnen (Auto-Retry)' },
      { emoji: '🔔', text: 'Wetter-Warnungen kommen weiterhin als Push' },
    ],
    items: [
      {emoji:'🧹', bold:'Unwetter-Card entfernt:', text:' das #weather-alert-card im Home + die Loader-Calls raus. Die Wetter-Warnungen-Inbox + Push-Alerts bleiben unabhängig erhalten.'},
      {emoji:'🔁', bold:'Wetter-Erst-Load-Fix:', text:' der Forecast-Abruf hatte keinen Retry — ein transienter Fehler beim Start zeigte sofort „Wetter nicht verfügbar". Jetzt 3 Versuche mit Backoff, Fehler erst danach.'},
    ],
  },
  {
    v: 'v29.77', date: '19.06.2026',
    headline: '🌼 Startbildschirm & Shortcuts im neuen Look',
    summary: 'Passend zum neuen Edelweiss-App-Icon (v29.76) sind jetzt auch der Startbildschirm (Splash-Screen) und die Schnellzugriff-Symbole erneuert. Der Startbildschirm zeigt das Edelweiss mit „GreenScan" und „Schweizer Pflanzen & Natur" auf Forest-Grün — und behebt ein altes Anzeige-Problem, bei dem statt des Logos ein leeres Kästchen erschien. Die vier Schnellzugriffe (langes Tippen aufs App-Icon) zeigen jetzt klare Symbole: 🔍 Scannen, 🌱 Garten, ❓ Tagesfrage, 📚 Wissen.',
    user_summary: '🌼 Startbildschirm & App-Schnellzugriffe im neuen Edelweiss-Look (altes leeres Logo-Kästchen behoben).',
    user_items: [
      { emoji: '🖼️', text: 'Startbildschirm mit Edelweiss + „GreenScan" (alle Geräte)' },
      { emoji: '⚡', text: 'Schnellzugriffe mit klaren Symbolen: 🔍 🌱 ❓ 📚' },
      { emoji: '🐛', text: 'Altes leeres Logo-Kästchen auf dem Startbildschirm behoben' },
    ],
    items: [
      {emoji:'🖼️', bold:'11 Startbildschirme:', text:' Forest-Gradient + Edelweiss + Titel + Tagline, in jeder exakten Geräte-Auflösung (iPhone & iPad). Behebt den alten Tofu-Kästchen-Bug (Emoji-Logo wurde nie gerendert).'},
      {emoji:'⚡', bold:'4 Schnellzugriff-Icons:', text:' Scanner 🔍 / Garten 🌱 / Tagesfrage ❓ / Wissen 📚 auf Forest-Tile passend zum App-Icon (waren ebenfalls leere Kästchen).'},
      {emoji:'⚙️', bold:'Drop-in:', text:' manifest & Startbild-Verweise unverändert — reine Asset-Ersetzung. Icon-Familie jetzt komplett konsistent (Icon + Splash + Shortcuts).'},
    ],
  },
  {
    v: 'v29.76', date: '19.06.2026',
    headline: '🌼 Neues App-Icon — das Edelweiss',
    summary: 'GreenScan hat ein neues App-Icon: ein weisses Edelweiss mit goldenem Zentrum auf dunkelgrünem Forest-Hintergrund — die Schweizer Alpenblume als Markenzeichen. Das Icon erscheint auf dem Home-Screen, im Browser-Tab und beim App-Start in allen Grössen (inkl. randloser Android-Variante). Falls dein Home-Screen noch das alte Icon zeigt: App einmal neu installieren — Handys cachen Icons hartnäckig.',
    user_summary: '🌼 Neues App-Icon: das Edelweiss (weisse Alpenblume auf Forest-Grün) auf Home-Screen, Tab und Splash-Screen.',
    user_items: [
      { emoji: '🌼', text: 'Edelweiss-Markenzeichen — weisse Alpenblume, goldenes Zentrum' },
      { emoji: '📱', text: 'Alle Grössen: Home-Screen, Tab, randlose Android-Kachel' },
      { emoji: '🔄', text: 'Home-Screen zeigt altes Icon? App neu installieren' },
    ],
    items: [
      {emoji:'🌼', bold:'Edelweiss-Icon:', text:' weisses Edelweiss mit goldenem Zentrum auf Forest-Gradient. Komplettes Set ersetzt (any + maskable + Apple-Touch + Favicons), exakte Pixelgrössen, Edelweiss in der Safe-Zone für randlose Masken.'},
      {emoji:'⚙️', bold:'Drop-in:', text:' manifest & <head> waren bereits korrekt verdrahtet — reine Asset-Ersetzung, kein Code-Change. Service-Worker-Bump bustet den Icon-Cache.'},
      {emoji:'🔄', bold:'Hinweis:', text:' iOS/Android cachen Home-Screen-Icons hartnäckig — bei altem Icon die PWA einmal neu installieren.'},
    ],
  },
  {
    v: 'v29.75', date: '19.06.2026',
    headline: '🍄 Pilz-Scanner-Resultat & Gefahren-Warnung in deiner Sprache',
    summary: 'Jetzt spricht auch der Scan→Resultat-Flow deine App-Sprache: Wenn du einen Pilz fotografierst, erscheinen der Name, die Vergiftungs-Symptome, der Notfall-Hinweis und die Verwechsler-Unterschiede auf DE/EN/ES/FR/IT — inklusive der roten Lebensgefahr-Vollbild-Warnung, die bei einem giftigen Treffer sofort aufpoppt. Damit ist der gesamte Pilz-Weg von der Aufnahme bis zum Steckbrief mehrsprachig. (Die individuell von der KI pro Scan erzeugte Begründung bleibt vorerst Deutsch.)',
    user_summary: '🍄 Pilz-Scan-Resultat & Lebensgefahr-Warnung jetzt auf DE/EN/ES/FR/IT — der ganze Scan-Weg ist mehrsprachig.',
    user_items: [
      { emoji: '📸', text: 'Scan-Resultat (Name, Symptome, Notfall) in deiner Sprache' },
      { emoji: '☠️', text: 'Rote Lebensgefahr-Warnung mit übersetztem Namen & Hinweis' },
      { emoji: '🔀', text: 'Verwechsler-Unterschiede im Scan-Resultat übersetzt' },
      { emoji: '🇨🇭', text: 'FR & IT als Schweizer Landessprachen abgedeckt' },
    ],
    items: [
      {emoji:'📸', bold:'Scan-Resultat lokalisiert:', text:' gsMushroomRenderResult mergt jetzt die übersetzte Prosa (Symptome/Notfall/Zubereitung) + Verwechsler-Differenzen der aktiven Sprache; Pilzname via _gsMushName. Nutzt die safety-geprüften Daten aus v29.73/74 — kein neuer Inhalt.'},
      {emoji:'☠️', bold:'Lebensgefahr-Overlay:', text:' das rote Vollbild-Overlay zeigt den Pilznamen sofort in deiner Sprache (ohne Verzögerung), Warntext + Notruf 145 bereits übersetzt.'},
      {emoji:'📝', bold:'Grenze:', text:' die pro Scan von der KI erzeugten Texte (Begründung, Sicherheits-Einschätzung) bleiben vorerst Deutsch — ihre Übersetzung braucht ein Update der Scan-Funktion im Backend.'},
      {emoji:'✅', bold:'Verify:', text:' Preview FR (Knollenblätterpilz-Scan): Overlay „Amanite phalloïde / MORTEL", Resultat „Tempête gastro-intestinale", Notfall 145 + Silibinin, „Classe VAPKO". 7/7 node --check + sw.js OK.'},
    ],
  },
  {
    v: 'v29.74', date: '19.06.2026',
    headline: '🍄 Verwechsler-Texte in 5 Sprachen — Steckbrief jetzt komplett mehrsprachig',
    summary: 'Die letzte deutschsprachige Lücke im Pilz-Steckbrief ist geschlossen: Die Verwechsler-Texte — wie du einen Speisepilz von seinem (oft tödlichen) Doppelgänger unterscheidest — sind jetzt auf DE/EN/ES/FR/IT verfügbar. Damit ist der gesamte Pilz-Steckbrief mehrsprachig (Namen, Etiketten, Beschreibungen und Verwechsler-Hinweise). Diese Unterscheidungs-Texte sind besonders sicherheitskritisch, daher wurde gezielt geprüft, dass die Zuordnung (welcher Pilz welches Merkmal hat) beim Übersetzen niemals vertauscht wird. Zusätzlich wurde das Backend mit dem Sicherheits-Advisor durchgecheckt und eine versehentlich offene Trigger-Funktion bereinigt.',
    user_summary: '🍄 Die Verwechsler-Unterscheidungs-Texte sind jetzt auf DE/EN/ES/FR/IT — der Pilz-Steckbrief ist damit vollständig mehrsprachig.',
    user_items: [
      { emoji: '🔀', text: 'Verwechsler-Texte (Speisepilz vs. Doppelgänger) in 5 Sprachen' },
      { emoji: '🛡️', text: 'Zuordnung der Merkmale geprüft — beim Übersetzen nie vertauscht' },
      { emoji: '✅', text: 'Pilz-Steckbrief jetzt komplett mehrsprachig (Namen + Texte + Verwechsler)' },
      { emoji: '🔒', text: 'Backend-Security-Check + Trigger-Funktion bereinigt' },
    ],
    items: [
      {emoji:'🔀', bold:'184 Verwechsler-Übersetzungen:', text:' 6 Differenz-Felder (Aussehen/Geruch/Habitat/Sporen/Profi-Tipp/Merkmale) × 46 Paare × EN/ES/FR/IT in neuer Tabelle mushroom_lookalikes_i18n. Async-Merge in die Verwechsler-Box (DE-Fallback je Feld).'},
      {emoji:'🛡️', bold:'Zuordnungs-Sicherheit:', text:' adversarialer Verify prüfte gezielt, dass die Merkmal-Zuordnung nie invertiert wird (Austernpilz↔Galerina Sporée weiß vs. braun, Perlpilz rötet↔Panther rötet nie). 0 Lücken, lat. Namen/VAPKO/145 erhalten.'},
      {emoji:'🔒', bold:'Backend-Check:', text:' Supabase-Security-Advisor (147 Lints) durchgegangen — meiste by-design; korrekt erkannt, dass die anon-Rollen-Helfer RLS-erforderlich sind (Revoke hätte den Gast-Modus gebrochen). Eine offene Trigger-Funktion (fn_force_author_role) bereinigt.'},
      {emoji:'✅', bold:'Steckbrief komplett:', text:' v29.72 Namen+Etiketten · v29.73 Beschreibungs-Prosa · v29.74 Verwechsler-Texte — alles DE/EN/ES/FR/IT.'},
    ],
  },
  {
    v: 'v29.73', date: '18.06.2026',
    headline: '🍄 Pilz-Steckbrief-Texte in 5 Sprachen + Notruf-Sicherheitsfix',
    summary: 'Jetzt sprechen auch die ausführlichen Pilz-Steckbrief-Texte deine App-Sprache: Erkennungsmerkmale, Vergiftungs-Symptome, Notfall-Hinweise, Zubereitung und Kultur-Notizen aller Pilze sind auf DE/EN/ES/FR/IT verfügbar — wichtig für die französisch- und italienischsprachige Schweiz. Die medizinischen Texte wurden mehrstufig sicherheitsgeprüft (Latenzzeiten, Organe, Notfall-Schritte, Notrufnummern, lateinische Namen exakt erhalten). Dabei kam ein echter Fehler ans Licht: vier der tödlichsten Pilze nannten versehentlich die falsche Notrufnummer (144 statt der Vergiftungs-Nummer 145) — das ist jetzt überall korrigiert, auch in der deutschen App.',
    user_summary: '🍄 Die kompletten Pilz-Steckbrief-Texte (Merkmale, Symptome, Notfall, Zubereitung) sind jetzt auf DE/EN/ES/FR/IT — plus ein Notrufnummer-Sicherheitsfix.',
    user_items: [
      { emoji: '📖', text: 'Erkennungsmerkmale & Vergiftungs-Symptome aller Pilze übersetzt' },
      { emoji: '🆘', text: 'Notfall-Hinweise mit korrekter Tox-Info-Nummer 145' },
      { emoji: '🛡️', text: 'Medizinische Texte mehrstufig sicherheitsgeprüft (0 Lücken)' },
      { emoji: '🇨🇭', text: 'FR & IT als Schweizer Landessprachen abgedeckt' },
    ],
    items: [
      {emoji:'📚', bold:'340 Steckbrief-Texte:', text:' 5 Prosa-Felder (Merkmale, Symptome, Notfall, Zubereitung, Kultur) × 85 Pilze × EN/ES/FR/IT in neuer Tabelle mushroom_register_i18n. Async _gsMergeMushI18n mergt die aktive Sprache in beide Steckbrief-Pfade (DE-Fallback je Feld).'},
      {emoji:'🆘', bold:'Notrufnummer-Sicherheitsfix:', text:' der Übersetzungs-Pass deckte auf, dass 4 tödliche Pilze (Knollenblätterpilz, Panther, Fliegenpilz, Orellanus) fälschlich „144 Tox-Info" nannten — Tox Info Suisse ist 145. In DE + allen Sprachen korrigiert.'},
      {emoji:'🛡️', bold:'Mehrstufige Sicherheit:', text:' adversarialer Safety-Verify gegen die DE-Originale (Latenzfenster/Organe/Notfall-Schritte/145/144/Silibinin/lat. Namen erhalten) + Daten-Audit, das 25-37 fehlende Symptom-/Notfall-Übersetzungen fand und nachfüllte → 0 Lücken.'},
      {emoji:'📝', bold:'Nächster Schritt:', text:' die Verwechsler-Differenz-Texte folgen in einem weiteren geprüften Durchgang.'},
    ],
  },
  {
    v: 'v29.72', date: '18.06.2026',
    headline: '🍄 Pilz-Steckbrief: Namen & Etiketten in 5 Sprachen',
    summary: 'Der Pilz-Steckbrief spricht jetzt auch für die französisch- und italienischsprachige Schweiz die richtige Sprache: Pilznamen erscheinen in deiner App-Sprache (z. B. „Amanite phalloïde", „Cèpe", „Bolet jaune"), und alle Etiketten — Essbarkeits-Warnungen, Abschnitts-Titel (Habitat, Erkennen, Symptome, Notfall …), die Verwechsler-Box und der VAPKO-Sicherheitshinweis — sind auf DE/EN/ES/FR/IT übersetzt. Der wissenschaftliche (lateinische) Name bleibt immer sichtbar als sicherer Anker, und der Notruf 145 bleibt antippbar. Die ausführlichen Beschreibungstexte folgen in einem späteren, sorgfältig geprüften Schritt auf Deutsch.',
    user_summary: '🍄 Pilz-Steckbriefe zeigen Namen & Etiketten jetzt in deiner App-Sprache (DE/EN/ES/FR/IT) — wichtig für die Romandie & das Tessin.',
    user_items: [
      { emoji: '🏷️', text: 'Pilznamen in deiner Sprache (Latein bleibt als Anker sichtbar)' },
      { emoji: '⚠️', text: 'Essbarkeits- & Gefahren-Warnungen + VAPKO-Hinweis übersetzt' },
      { emoji: '🔀', text: 'Verwechsler-Box: Doppelgänger mit echtem Namen statt Code' },
      { emoji: '🇨🇭', text: 'FR & IT als Schweizer Landessprachen abgedeckt' },
    ],
    items: [
      {emoji:'🏷️', bold:'Lokalisierte Namen:', text:' neuer _gsMushName-Helper nutzt common_name_fr/it aus der DB (alle 85 Pilze), wissenschaftlicher Name bleibt als sprachunabhängiger Anker. Verwechsler-Doppelgänger zeigen jetzt den echten lokalisierten Namen (z. B. „Bolet jaune") statt des nackten DB-Slugs.'},
      {emoji:'🗣️', bold:'108 Etiketten-Übersetzungen:', text:' 27 Steckbrief-Labels × EN/ES/FR/IT (Essbarkeits-Pillen, Abschnitts-Titel, Verwechsler-Box, VAPKO-Footer). Sicherheits-Phrasen via adversarial-safety-Workflow geprüft — „MORTEL · NE PAS CONSOMMER", 145 & VAPKO überall erhalten.'},
      {emoji:'📝', bold:'Bewusste Grenze:', text:' die ausführlichen Beschreibungstexte (Merkmale, Symptome, Verwechsler-Details) bleiben vorerst Deutsch — ihre sichere Übersetzung folgt als eigener, sorgfältig geprüfter Schritt.'},
      {emoji:'✅', bold:'Verify:', text:' Preview FR: „Amanite phalloïde" + „MORTEL · NE PAS CONSOMMER" + Toxines/Urgence/Symptômes + VAPKO-FR; „Cèpe" + „Champignon comestible"; Verwechsler „RISQUE DE CONFUSION" + „Bolet jaune". 7/7 node --check + sw.js OK.'},
    ],
  },
  {
    v: 'v29.71', date: '18.06.2026',
    headline: '📚 Lern-Inhalte komplett auf 5 Sprachen',
    summary: 'Die ausführlichen Lern-Inhalte selbst sprechen jetzt alle App-Sprachen: alle 16 Lernkarten (7 Pilze + 9 Garten) — Titel, Texte, Merkpunkte, Praxis-Tipps und Sicherheitshinweise — sind nun auf Deutsch, Englisch, Spanisch, Französisch und Italienisch verfügbar. Sicherheitskritische Pilz-Inhalte (Knollenblätterpilz-Warnungen, VAPKO-Pflicht, Notruf 145) wurden dabei adversarial gegengeprüft, damit beim Übersetzen keine lebenswichtige Nuance verloren geht. Lateinische Artnamen und Schweizer Institutionen (VAPKO, SwissFungi, FiBL) bleiben unverändert.',
    user_summary: '📚 Die kompletten Lern-Inhalte (alle 16 Karten: Pilze & Garten) sind jetzt auf DE/EN/ES/FR/IT — nicht mehr nur die Bedienoberfläche.',
    user_items: [
      { emoji: '🍄', text: '7 Pilz-Lernkarten vollständig übersetzt (inkl. Sicherheits-Hinweise)' },
      { emoji: '🌱', text: '9 Garten-Lernkarten vollständig übersetzt' },
      { emoji: '🛡️', text: 'Sicherheits-Nuancen adversarial geprüft — keine verlorene Warnung beim Übersetzen' },
      { emoji: '🇨🇭', text: 'FR & IT als Schweizer Landessprachen abgedeckt' },
    ],
    items: [
      {emoji:'📚', bold:'64 Karten-Übersetzungen:', text:' 16 Lernkarten × EN/ES/FR/IT in neuer Tabelle nature_learning_cards_i18n (Titel/Body/Merkpunkte/Tipp/Sicherheits-Hinweis), anon-lesbar, Schreibrechte revoked.'},
      {emoji:'🛡️', bold:'Sicherheits-Verify:', text:' translate+adversarial-safety-Workflow, 0 unsichere Korrekturen nötig: Knollenblätterpilz-NICHT-Ausschluss (Galerina), VAPKO-Pflicht, Tox-145, „Eisheilige" erhalten; lat. Artnamen + VAPKO/SwissFungi/FiBL/Bioterra untranslated.'},
      {emoji:'🔧', bold:'Loader-Fix:', text:' gsLoadLearningCards mergt jetzt die Übersetzung der aktiven Sprache; 4× gsI18n.current→getLang() korrigiert (Latent-Bug: Datum-/Wetter-/Monats-Locale defaulteten still auf Deutsch).'},
      {emoji:'✅', bold:'Verify:', text:' Preview FR/IT/ES end-to-end: „Les champignons mortels…", „Compost — oro dagli scarti", „La esporada". 7/7 node --check + sw.js OK.'},
    ],
  },
  {
    v: 'v29.70', date: '18.06.2026',
    headline: '🌍 Pilz- & Garten-Lern-UI auf 5 Sprachen',
    summary: 'Die neuen Pilz- und Garten-Lern-Funktionen sprechen jetzt alle App-Sprachen: Deutsch, Englisch, Spanisch, Französisch und Italienisch. Wichtig für die Schweiz — Französisch und Italienisch sind Landessprachen (Romandie, Tessin). Übersetzt sind die Anfänger-Ampel-Stufen, der Pilz-Sammelkalender, die Region-Tipps, der „🎓 Lernen"-Bereich, alle Sicherheits- und VAPKO-Hinweise sowie die Monatsnamen. Die ausführlichen Lektions-Inhalte und Pilz-Steckbriefe bleiben vorerst auf Deutsch.',
    user_summary: '🌍 Die Pilz- & Garten-Lern-UI (Anfänger-Ampel, Sammelkalender, „Lernen"-Bereich, Sicherheits-Hinweise) ist jetzt auf DE/EN/ES/FR/IT verfügbar.',
    user_items: [
      { emoji: '🚦', text: 'Anfänger-Ampel & Sicherheits-/VAPKO-Hinweise in 5 Sprachen' },
      { emoji: '🍄', text: 'Pilz-Sammelkalender + Region-Tipps übersetzt (inkl. lokalisierte Monatsnamen)' },
      { emoji: '🎓', text: '„Lernen"-Bereich (Pilze & Garten) mit übersetzter Chrome' },
      { emoji: '🇨🇭', text: 'FR & IT als Schweizer Landessprachen abgedeckt' },
    ],
    items: [
      {emoji:'🌍', bold:'38 neue i18n-Keys:', text:' GS_BEGINNER_AMPEL-Labels, Steckbrief-Badge (inkl. „tödlicher Doppelgänger"), Region-Box, Pilz-Sammelkalender (Titel/Legende/VAPKO-Box), Lern-Hub + Lernkarten-Chrome (Header/Intro/Sicherheit/Tipp/Quellen/Notfall) via _t()/gsI18n.t verdrahtet; Monatsnamen via toLocaleString lokalisiert.'},
      {emoji:'🗣️', bold:'136 Übersetzungen geseedet (i18n_translations):', text:' 34 Phrasen × EN/ES/FR/IT, kuratiert + sicherheitsbewusst (Ampel-Stufen, VAPKO-Pflicht, Notruf 145), source_hash via digest, idempotent.'},
      {emoji:'📝', bold:'Grenze:', text:' DB-Inhalte (Lektions-Bodies, Pilznamen, Verwechsler-Texte) bleiben DE — eine sichere, separate Übersetzung dieser sicherheitskritischen Inhalte folgt später.'},
      {emoji:'✅', bold:'Verify:', text:' Preview FR end-to-end: Ampel „Adapté aux débutants", Hub „Apprendre la nature", VAPKO „Avant de manger : contrôle des champignons VAPKO", Notfall „Urgence empoisonnement". 7/7 node --check + sw.js OK.'},
    ],
  },
  {
    v: 'v29.68', date: '18.06.2026',
    headline: '🌱 Garten-Lernkarten + Sicherheits-Härtung der Pilz-Ampel',
    summary: 'Zwei Dinge: mehr lernen und sicherer lernen. NEU lernst du auch deinen Garten — 9 geerdete Einsteiger-Lektionen (Standort, Boden, Mischkultur, Fruchtfolge, Aussaat, Giessen, Kompost, natürlicher Pflanzenschutz, Biodiversität) erscheinen im Saisonkalender, und ein neuer „🎓 Lernen"-Bereich (über die Suche) bündelt Pilze + Garten an einem Ort. Quellen u.a. FiBL, Bioterra, Agroscope, ProSpecieRara. WICHTIG für die Sicherheit: Eine interne Prüfung hat einen Fehler in der Anfänger-Ampel gefunden und behoben — einige lamellige Speisepilze mit gefährlichem Doppelgänger (z.B. Champignons, Nelkenschwindling) wurden fälschlich grün („anfänger-geeignet") angezeigt. Neu sind nur Pilze ohne tödlichen Doppelgänger grün (vor allem Röhrlinge); alles andere ist mindestens gelb. Ausserdem zeigt das Region-Pilz-Widget jetzt im ganzen Mittelland die richtige Region.',
    user_summary: '🌱 Neue Garten-Lernkarten + ein „🎓 Lernen"-Bereich (Pilze & Garten). Plus ein wichtiger Sicherheits-Fix der Anfänger-Ampel und genauere Regionserkennung.',
    user_items: [
      { emoji: '🌱', text: '9 Garten-Einsteiger-Lektionen im Saisonkalender (FiBL/Bioterra/ProSpecieRara)' },
      { emoji: '🎓', text: 'Neuer „Lernen"-Bereich bündelt Pilze + Garten (über die Suche)' },
      { emoji: '🚦', text: 'Sicherheits-Fix: nur Pilze ohne tödlichen Doppelgänger sind grün' },
      { emoji: '📍', text: 'Region-Erkennung im Mittelland korrigiert (richtige Gemeinde/Kanton)' },
    ],
    items: [
      {emoji:'🚦', bold:'P0-Sicherheits-Fix (Anfänger-Ampel):', text:' Die View v_mushroom_beginner stufte lamellige Speisepilze mit realem tödlichem Doppelgänger als „anfaenger" ein, weil das Verwechsler-Paar fehlte. Neu hymenophor-basiert konservativ: 🟢 nur bei eindeutigem Hymenophor ohne tödlichen Doppelgänger (Röhren/Poren + kursgeprüfte Leisten/Stacheln/Glucke/Judasohr). Lamellen, Morchel-Waben (Lorchel) und Bovist-Gleba (Amanita-Ei) → mind. 🟡. anfaenger 35→20.'},
      {emoji:'📍', bold:'P1-Fix (Standortauflösung):', text:' gsResolveChRegions lud nur 80 Gemeinden der Bounding-Box ohne Sortierung → in dichten Mittelland-Boxen (bis 431) wurde die nächste Gemeinde abgeschnitten (Zürich→Zollikon, Aarau→Lostorf, falscher Kanton). Cap auf 500 erhöht + Cache aktiviert.'},
      {emoji:'🌱', bold:'Garten-Curriculum:', text:' 9 Lektionen via Research-+Faktencheck-Workflow (FiBL/Bioterra/Agroscope/ProSpecieRara/BAFU), mission-konform (torffrei, keine Chemie, Biodiversität), ehrlich zur Mischkultur-Unsicherheit. Im Saisonkalender + neuem gsOpenLearnHub (Tabs Pilze/Garten, über Menü-Suche „Lernen").'},
      {emoji:'🛡️', bold:'Weitere Review-Fixes:', text:' Write-Grants auf 6 Referenztabellen entzogen (HL#13-Härtung); 🟢-Emoji-Kollision in der dunklen Box behoben (Saison jetzt „· jetzt"); Tap-Targets der Chips auf 34px (iOS); .modal 90dvh (iOS-Toolbar); Steckbrief-Matcher deterministisch; Leerzustand statt nacktem „—".'},
      {emoji:'✅', bold:'Verify:', text:' Champignon/Morchel jetzt 🟡 (nicht mehr 🟢), Steinpilz 🟢; Zürich→Zürich/ZH/408 m; Cache-Treffer; Hub lädt 7 Pilz + 9 Garten. 7/7 node --check + sw.js OK. 11 von 16 Review-Funden bestätigt+gefixt (P0/P1/2×P2/restl. P3).'},
    ],
  },
  {
    v: 'v29.67', date: '18.06.2026',
    headline: '🎓 Pilze sicher lernen + Anfänger-Ampel + tappbare Steckbriefe',
    summary: 'Die Pilz-Funktionen werden lernfreundlich: In den Region-Pilz-Boxen kannst du jetzt jeden Pilz antippen und bekommst einen vollständigen Steckbrief (Erkennen, Merkmale, Verwechsler-Risiko, Zubereitung). Jeder Pilz trägt eine Anfänger-Ampel — 🟢 anfänger-geeignet, 🟡 für Fortgeschrittene, 🔴 giftig/Vorsicht — automatisch hergeleitet aus geprüfter Essbarkeit und Verwechslergefahr (tödlich verwechselbare Arten sind nie grün). Neu gibt es ausserdem ein kleines Lern-Curriculum „Pilze sicher lernen" mit 7 kurzen Lektionen (Röhrlinge vs. Lamellen, Sporenabdruck, die tödlichen Arten, gute Einsteiger-Pilze, häufige Fehler, Sammelregeln, VAPKO) — recherchiert und mehrfach sicherheitsgeprüft an VAPKO, SwissFungi und Tox Info Suisse. Und im Hintergrund kennt die App jetzt für über 1000 Gemeinden die genaue Region.',
    user_summary: '🎓 Tippe einen Pilz für den Steckbrief, sieh die Anfänger-Ampel (🟢/🟡/🔴) und lerne in 7 kurzen, sicherheitsgeprüften Lektionen sicheres Sammeln.',
    user_items: [
      { emoji: '👆', text: 'Jeden Region-Pilz antippen → voller Steckbrief (Erkennen, Verwechsler, Küche)' },
      { emoji: '🚦', text: 'Anfänger-Ampel 🟢/🟡/🔴 — tödlich verwechselbare Arten sind nie grün' },
      { emoji: '🎓', text: '7 Lektionen „Pilze sicher lernen" (VAPKO/SwissFungi/Tox Info geprüft)' },
      { emoji: '📍', text: 'Über 1000 Gemeinden kennen jetzt ihre genaue Region' },
    ],
    items: [
      {emoji:'🚦', bold:'Anfänger-Ampel (v_mushroom_beginner):', text:' Deterministische DB-View — leitet je Pilz aus geprüfter edibility + schlimmster Verwechslergefahr (mushroom_lookalikes) eine Stufe ab (anfaenger/fortgeschritten/gefahr/ungeniessbar). KEIN LLM, sichere Fehlerrichtung: ein Speisepilz mit tödlichem Doppelgänger (z.B. Parasol) ist nie „anfaenger". Chips im Sammelkalender sind entsprechend gefärbt.'},
      {emoji:'👆', bold:'Tappbare Steckbriefe (gsOpenMushroomLearnCard):', text:' Pilz-Chips in Pilz-Scanner-Box & Regional-Kalender öffnen das bestehende reiche Detail (Merkmale, bidirektionale Verwechsler aus mushroom_lookalikes, Zubereitung) mit Ampel-Badge oben. HL#12-sicher (data-mush + Delegation statt onclick-Escapes).'},
      {emoji:'🎓', bold:'Lern-Curriculum (nature_learning_cards):', text:' 7 Anfänger-Lektionen via Research-+adversarial-Verify-Workflow. Der Sicherheits-Pass fing lebenswichtige False-Safe-Signale (z.B. „brauner Sporenabdruck schliesst Knollenblätterpilz aus" ist wegen Galerina tödlich falsch; Parasol-jung vs. Knollenblätterpilz-Lücke). Essbarkeit nur aus autoritativen Quellen, je Karte VAPKO-Pflicht + Tox 145.'},
      {emoji:'📍', bold:'region_slug-Backfill:', text:' 1007/2164 Gemeinden via pro-Kanton-Workflow geografisch ihrer ch_region zugeordnet (konservativ NULL bei Unsicherheit). Spot-checks korrekt (Zermatt→Mattertal, St. Moritz→Oberengadin, Bern→NULL).'},
      {emoji:'✅', bold:'Verify:', text:' Preview end-to-end: Steinpilz=🟢 + Verwechsler + VAPKO, Parasol=🟡 + Todesgefahr-Doppelgänger; 7 Lektionen + 145-Footer; Sammelkalender mit 62 tappbaren Ampel-Chips. 7/7 node --check + sw.js OK.'},
    ],
  },
  {
    v: 'v29.66', date: '18.06.2026',
    headline: '🍄 Regional-Kalender: jetzt mit Pilz-Sammelkalender',
    summary: 'Der Regional-Kalender wurde für Pilzsammler massiv ausgebaut: Wenn du deine Region wählst, erscheint neu ein kompletter Pilz-Sammelkalender — welche Speisepilze in den Wäldern deiner Region gut sammelbar sind, in welcher Landschaft (Kalk-Buchenwald, Fichten-Bergwald, Kastanienselven …), dazu konkrete Sammel-Tipps pro Region. Eine 12-Monats-Übersicht zeigt, wann welcher Pilz Saison hat (der aktuelle Monat ist aufgeklappt). Und die zuständige VAPKO-Pilzkontrollstelle deines Kantons steht direkt dabei. Alle Pilzdaten stammen aus dem kuratierten Register (nie geraten) — und immer gilt: jeden Fund vor dem Essen kontrollieren lassen.',
    user_summary: '🍄 Der Regional-Kalender hat jetzt einen Pilz-Sammelkalender: region-typische Speisepilze, Landschaft & Sammel-Tipps, eine 12-Monats-Saison-Übersicht und die VAPKO-Kontrollstelle deines Kantons.',
    user_items: [
      { emoji: '🍄', text: 'Region-typische Speisepilze + wo (Landschaft) sie wachsen' },
      { emoji: '📅', text: '12-Monats-Übersicht: wann welcher Pilz Saison hat' },
      { emoji: '🧺', text: 'Konkrete Sammel-Tipps pro Region' },
      { emoji: '🔒', text: 'VAPKO-Pilzkontrollstelle deines Kantons + Notfall 145' },
    ],
    items: [
      {emoji:'🍄', bold:'Pilz-Sammelkalender (gsRenderRegionalMushrooms):', text:' Additiv unter dem bestehenden Garten-Regional-Kalender. Matched die ch_regions der gewählten Zone (Kanton-Overlap + Höhenband, repräsentativste zuerst via Höhenmitten-Distanz) und zeigt pro Region (bis 3) Landschaft, good_mushrooms-Chips (🟢 = aktueller Monat in Saison), foraging_notes und highlights.'},
      {emoji:'📅', bold:'12-Monats-Verfügbarkeit:', text:' Kreuzt die good_mushrooms der Regionen mit mushroom_register.season_months → pro Monat aufklappbar, welche Speisepilze sammelbar sind (mit Essbarkeits-Emoji + VAPKO-Klasse). Aktueller Monat offen + hervorgehoben.'},
      {emoji:'🔒', bold:'VAPKO + Sicherheit:', text:' VAPKO-Kontrollstellen der Zonen-Kantone (vapko_control_stations) mit Telefon-Link, plus Tox Info Suisse 145. Essbarkeit nur aus kuratiertem mushroom_register (nie LLM); jede Box mit Pflicht-Hinweis „vor dem Essen kontrollieren lassen".'},
      {emoji:'✅', bold:'Verify:', text:' Im Preview 3 Zonen end-to-end: Mittelland → Fricktal/Berner Seeland/Zürcher Weinland, Tessin → Malcantone/Mendrisiotto/Misox, Graubünden → Surselva/Misox/Prättigau — je 12-Monats-Akkordeon + VAPKO + 145, Saison-Marker korrekt (Eierschwamm/Morchel grün im Juni, Steinpilz nicht). 7/7 node --check + sw.js OK.'},
    ],
  },
  {
    v: 'v29.65', date: '18.06.2026',
    headline: '🍄 Pilz-Scanner: was wächst HIER gut?',
    summary: 'Das Saison-Pilz-Widget auf dem Start zeigt jetzt eine neue Schweiz-Geo-Datenbank: Es erkennt deine Region (über deinen Standort → nächste Gemeinde → Kanton & Höhenlage) und nennt die Pilze, die genau dort gut sammelbar sind. Was gerade Saison hat, ist grün markiert. Dahinter steckt eine neue Datenbank mit allen 26 Kantonen, 2164 Gemeinden (mit Höhe) und 72 Schweizer Regionen — mit geprüften Angaben aus amtlichen Quellen. Wie immer gilt: jeden Fund vor dem Essen bei einer VAPKO-Pilzkontrolle prüfen lassen.',
    user_summary: '🍄 Das Pilz-Widget zeigt jetzt region-genau, welche Pilze bei dir gut sammelbar sind (🟢 = jetzt in Saison) — gestützt auf eine neue Schweiz-Datenbank mit Kantonen, Regionen und Dörfern.',
    user_items: [
      { emoji: '📍', text: 'Erkennt deine Region aus deinem Standort (Gemeinde · Kanton · Höhenlage)' },
      { emoji: '🍄', text: 'Nennt die in deiner Region gut sammelbaren Pilze' },
      { emoji: '🟢', text: 'Markiert, was gerade Saison hat' },
      { emoji: '🔒', text: 'Immer mit VAPKO-Hinweis — Sicherheit vor allem' },
    ],
    items: [
      {emoji:'🇨🇭', bold:'Neue Schweiz-Geo-DB (backend):', text:' 3 anon-lesbare Tabellen — ch_cantons (26, mit Fläche/Einwohner/Beitrittsjahr), ch_municipalities (2164 Gemeinden mit Höhe, Koordinaten, Kanton — Quelle Wikidata/BFS/swisstopo), ch_regions (72 traditionelle Regionen wie Sarganserland, Rheintal, Goms, Maggiatal, Lavaux — mit Höhenband, Landschaft, region-typischen Speisepilzen und Sammel-Hinweisen, web-recherchiert mit Quellenangabe).'},
      {emoji:'🍄', bold:'Regionale Pilz-Box (gsAttachRegionMushrooms):', text:' Additiv im Saison-Pilz-Widget. Löst die ch_region des Users auf (1. Standort → nächste Gemeinde → Kanton + Höhe → Region nach Höhenband; 2. Fallback regional_garden_calendars-Kontext) und zeigt deren good_mushrooms. Markiert via mushroom_register.season_months, was im aktuellen Monat in Saison ist (🟢, zuerst sortiert). Defensiv + idempotent, bricht das bestehende Widget nie.'},
      {emoji:'🔒', bold:'Sicherheit:', text:' Pilz-Essbarkeit kommt ausschliesslich aus dem kuratierten mushroom_register (autoritativ, nie LLM-geraten); jede Region-Box trägt den VAPKO-Pflicht-Hinweis. good_mushrooms sind vollständig register-konsistent.'},
      {emoji:'✅', bold:'Verify:', text:' Geo-DB anon-lesbar verifiziert (26/2164/72, CH-Pop 8’653’507, Per-Kanton plausibel BE 336/VD 300/ZH 160). Im Preview end-to-end: Standort Sargans → SG → 483 m → Regionen Linthgebiet & Fürstenland mit korrekten Pilzen + Saison-Markern. 7/7 node --check + sw.js OK.'},
    ],
  },
  {
    v: 'v29.61', date: '18.06.2026',
    headline: '📄 Gartenplaner: echtes PDF statt HTML-Download',
    summary: 'Der PDF-Export des Gartenplaners erzeugt jetzt am Computer ein echtes PDF über den Druckdialog deines Browsers („Als PDF speichern"), statt eine HTML-Datei herunterzuladen, die du erst selbst öffnen und drucken musstest. Am Handy bleibt das native Teilen-Menü (Speichern/Drucken/Mailen). Ausserdem stützt sich der Planer jetzt auf 112 statt 25 geprüfte Kulturen (FiBL/Bioterra-Mischkultur) — auch der Saisonkalender zeigt mehr Mischkultur-Nachbarn.',
    user_summary: '📄 Gartenplaner-PDF: am Computer echtes PDF via Druckdialog statt HTML-Download. Plus 112 geprüfte Kulturen (statt 25) für Planer & Saison-Mischkultur.',
    user_items: [
      { emoji: '📄', text: 'Echtes PDF am Computer (Druckdialog → „Als PDF speichern")' },
      { emoji: '📱', text: 'Am Handy weiter natives Teilen (Speichern/Drucken/Mailen)' },
      { emoji: '🌱', text: '112 statt 25 geprüfte Kulturen für Planer-Grounding & Mischkultur' },
    ],
    items: [
      {emoji:'📄', bold:'Echtes PDF (gsPPexportPDF):', text:' Desktop öffnet den Plan in einem neuen Fenster und ruft window.print() auf → der Browser bietet direkt „Als PDF speichern" (kein neues Lib, keine CSP-Erweiterung). Mobile behält die Web-Share-API; bei Popup-Blocker sauberer Fallback auf den bisherigen HTML-Download.'},
      {emoji:'🌐', bold:'112 geprüfte Kulturen (v29.60, backend):', text:' garden_crop_agronomy von 25 auf 112 web-recherchierte Kulturen ausgebaut (FiBL/Sativa Rheinau/Bioterra/ProSpecieRara/Agroscope, mit Quellen & Confidence). Wirkt sofort in Planer-Grounding & Saisonkalender-Mischkultur.'},
      {emoji:'✅', bold:'Verify:', text:' node-check 7/7 + sw.js OK. PDF-Export ist auth-/KI-gated → nicht im Headless-Preview auslösbar; Standard-window.open+print-Muster mit Fallback. Agronomie live geprüft (112 Zeilen, Planer-Ref 16,9k Zeichen, Saison-Treffer 19→28). v-Bump 5-fach v29.59 nach v29.61.'},
    ]
  },
  {
    v: 'v29.59', date: '18.06.2026',
    headline: '🤝 Saisonkalender zeigt jetzt Mischkultur-Nachbarn',
    summary: 'Im Saisonkalender erscheinen beim Aufklappen einer Pflanze jetzt geprüfte Mischkultur-Hinweise: welche Nachbarn gut zusammenpassen und welche du meiden solltest (FiBL/Bioterra-Standard). So planst du direkt beim „Was hat Saison" auch gleich gute Beet-Nachbarschaften.',
    user_summary: '🤝 Saisonkalender-Details zeigen jetzt gute & zu meidende Beet-Nachbarn (Mischkultur, FiBL/Bioterra).',
    user_items: [
      { emoji: '🤝', text: 'Gute Nachbarn & zu meidende Kombinationen pro Pflanze im Saison-Detail' },
      { emoji: '📚', text: 'Geprüfte Mischkultur-Daten (FiBL/Bioterra) statt Schätzung' },
    ],
    items: [
      {emoji:'🤝', bold:'Mischkultur im Saisonkalender:', text:' renderSeasonList baut eine Lookup-Map aus garden_crop_agronomy (v29.58); das Item-Detail zeigt 🤝 Gute Nachbarn / ⛔ Meiden für gängige Kulturen. initSeasonCalendar lädt die Agronomie und rendert mit Hinweisen neu.'},
      {emoji:'🐛', bold:'Normalisierer-Fix:', text:' _norm strippte „en/n" → „Tomaten" (tomat) matchte „Tomate" (tomate) nicht; jetzt auch trailing „e" → Plural/Singular treffen sich (verbessert auch das ⭐-„dein Anbau"-Matching).'},
      {emoji:'✅', bold:'Verify:', text:' Live geprüft — Tomate zeigt 🤝 Basilikum + ⛔ Kartoffel, Karotte 🤝 Zwiebel, 19 Treffer, 0 Console-Fehler. 3 i18n-Keys EN/ES/FR/IT geseedet. 7/7 node --check + sw.js OK. v-Bump 5-fach v29.58 nach v29.59.'},
    ]
  },
  {
    v: 'v29.58', date: '18.06.2026',
    headline: '🌱 KI-Gartenplaner intelligenter — auf geprüften Daten',
    summary: 'Der KI-Gartenplaner stützt sich jetzt auf eine geprüfte Agronomie-Referenz (FiBL/Bioterra-Standard) für 25 gängige Schweizer Gartenkulturen, statt Mischkultur, Fruchtfolge und Aussaat-/Erntezeiten frei zu schätzen. So sind „gute & schlechte Nachbarn", die Fruchtfolge-Familie und das Timing für die häufigen Gemüse jetzt faktenbasiert statt geraten.',
    user_summary: '🌱 KI-Gartenplaner nutzt jetzt geprüfte Mischkultur- & Timing-Daten (FiBL/Bioterra) für 25 gängige Kulturen — fundierter statt geschätzt.',
    user_items: [
      { emoji: '🤝', text: 'Geprüfte gute/schlechte Nachbarn (Mischkultur) statt KI-Schätzung' },
      { emoji: '♻️', text: 'Korrekte Fruchtfolge-Familien & Aussaat-/Erntezeiten' },
      { emoji: '📚', text: 'Neue Datenbank-Referenz aus FiBL/Bioterra-Standard (25 Kulturen)' },
    ],
    items: [
      {emoji:'📚', bold:'Neue Tabelle garden_crop_agronomy (Migration v29_58):', text:' 25 gängige CH-Kulturen mit geprüften Werten aus der FiBL/Bioterra-Mischkultur-Tabelle — companion_good/bad, sow_months, harvest_months, Fruchtfolge-Familie, Frosthärte, Abstand. anon+authenticated lesbar.'},
      {emoji:'🧪', bold:'Planer-Grounding:', text:' gsPPloadAgronomy() + gsPPbuildAgronomyRef() speisen eine „GEPRÜFTE AGRONOMIE-REFERENZ" in den PRO-Planer-Prompt ein — die KI muss für gelistete Kulturen genau diese Werte für Mischkultur, Fruchtfolge und Timing verwenden, statt zu raten (species-Agronomie-Spalten waren 0 befüllt → bisher reine Prompt-Schätzung).'},
      {emoji:'✅', bold:'Verify:', text:' Live geprüft — 25 Zeilen via anon-Lesezugriff geladen, Referenz-Block (4243 Zeichen) korrekt gebaut, 0 Console-Fehler. 7/7 node --check + sw.js OK. v-Bump 5-fach v29.57 nach v29.58.'},
    ]
  },
  {
    v: 'v29.57', date: '18.06.2026',
    headline: '🔒 Login-Stabilität: Schluss mit zufälligen Abmeldungen',
    summary: 'Wir haben einen Fehler behoben, der dazu führen konnte, dass man beim App-Start unerwartet abgemeldet wurde: Wenn mehrere Anfragen gleichzeitig den Anmelde-Token erneuerten, hob sich das gegenseitig auf. Jetzt läuft die Token-Erneuerung gebündelt und sicher. Ausserdem wird der Token aus Passwort-Reset-Links sofort aus der Adresszeile entfernt.',
    user_summary: '🔒 Behebt zufällige Abmeldungen beim App-Start (Token-Erneuerung gebündelt) + Passwort-Reset-Token wird sofort aus der URL entfernt.',
    user_items: [
      { emoji: '🔄', text: 'Keine zufälligen Abmeldungen mehr durch gleichzeitige Token-Erneuerung' },
      { emoji: '🛡️', text: 'Passwort-Reset-Token wird sofort aus URL & Verlauf entfernt' },
      { emoji: '✅', text: 'Abmeldung nur noch wenn die Sitzung wirklich abgelaufen ist' },
    ],
    items: [
      {emoji:'🔄', bold:'Token-Refresh-Race behoben:', text:' Beim Start laden mehrere Anfragen parallel (Profil, Sync, Streak) — lief der Anmelde-Token aus, erneuerten ihn alle gleichzeitig mit demselben Einmal-Token; der zweite scheiterte (400) und löste eine Abmeldung aus. Neuer geteilter Refresh-Mutex (_gsRefreshShared): alle Erneuerungen laufen durch EINE Anfrage, parallele warten auf dasselbe Ergebnis. Abmeldung nur noch wenn der Token danach wirklich noch abgelaufen ist (race-sicher).'},
      {emoji:'🛡️', bold:'Recovery-Token-Härtung:', text:' Der Zugangs-Token aus Passwort-Reset-Links wird jetzt sofort aus URL & Browser-Verlauf entfernt (vorher erst nach erfolgreichem Wechsel) + Gültigkeits-Sanity-Check.'},
      {emoji:'✅', bold:'Verify:', text:' Live geprüft — 5 parallele Refreshes → nur 1 Netzwerk-Aufruf (Bündelung), 6. nach Freigabe → neuer Aufruf; 400 + frischer Token → KEINE Abmeldung, 400 + abgelaufen → Abmeldung. 0 Console-Fehler. Offen (Roadmap): HttpOnly-Cookies, server-seitiges Rate-Limit, „Leaked Password Protection". 7/7 node --check + sw.js OK. v-Bump 5-fach v29.56 nach v29.57.'},
    ]
  },
  {
    v: 'v29.56', date: '18.06.2026',
    headline: '🔐 Login rundum erneuert — eleganter, schneller, sicherer',
    summary: 'Der Login-Bildschirm wurde komplett überarbeitet: ein ruhiger animierter Natur-Hintergrund, sanfte Übergänge, ein rotierendes Highlights-Karussell, das zeigt was GreenScan kann, und durchgehend sichtbare Tastatur-Fokus-Ringe. Im Hintergrund haben wir einen Bug behoben, der dazu führte, dass bei neuen Konten die E-Mail-Adresse nicht gespeichert wurde, und Lade-Zustände, Doppelklick-Schutz & Barrierefreiheit verbessert.',
    user_summary: '🔐 Neuer, eleganter Login: animierter Hintergrund, sanfte Übergänge, rotierende Highlights, bessere Barrierefreiheit — plus E-Mail-Speicher-Bug bei neuen Konten behoben.',
    user_items: [
      { emoji: '✨', text: 'Eleganterer Login mit ruhigem animiertem Hintergrund & sanften Übergängen' },
      { emoji: '🎠', text: 'Rotierende Highlights zeigen, was du mit GreenScan alles machen kannst' },
      { emoji: '♿', text: 'Sichtbarer Fokus, Lade-Spinner, Doppelklick-Schutz & Screenreader-Hinweise' },
    ],
    items: [
      {emoji:'🐛', bold:'Backend-Bug behoben (Migration v29_56):', text:' Zwei doppelte Datenbank-Trigger beim Konto-Anlegen führten dazu, dass die E-Mail-Adresse neuer Nutzer nicht im Profil gespeichert wurde (6 von 11 betroffen). Auf einen sauberen Trigger konsolidiert + bestehende Profile nachgefüllt. Verifiziert: 0 fehlende E-Mails.'},
      {emoji:'🎨', bold:'Login-Redesign + „etwas Cooles":', text:' Animierter botanischer Hintergrund (driftende Glühpunkte + aufsteigende Blätter, respektiert „Bewegung reduzieren"), weiche View-Übergänge, weicheres Logo, neues DB-gestütztes Highlights-Karussell (Tabelle onboarding_highlights, anon-lesbar, EN/ES/FR/IT übersetzt).'},
      {emoji:'♿', bold:'Barrierefreiheit & Politur:', text:' Sichtbare Tastatur-Fokus-Ringe (WCAG 2.4.7), bessere Kontraste, grössere Tap-Ziele, Button-Lade-Spinner, weiches Caps-Lock-Ein/Ausblenden, Fehler-Boxen mit aria-live. Doppel-Submit-Schutz + Fix eines Fehler-Farb-Bugs.'},
      {emoji:'✅', bold:'Verify:', text:' 3-Agenten-Audit (Look/a11y, Flow/Übergänge, Core/Security). Live im Preview geprüft: botanischer Hintergrund, rotierendes Karussell (6 Items/Dots, DB-Load OK), View-Übergang, Focus-Regel im Stylesheet, 0 Console-Fehler. Auth-Core-Härtung (Token-Refresh-Race, Redirect-Stripping, Token-Expiry) folgt in v29.57. 7/7 node --check + sw.js OK. v-Bump 5-fach v29.55 nach v29.56.'},
    ]
  },
  {
    v: 'v29.55', date: '18.06.2026',
    headline: '📅 Saisonkalender: regional, persönlich & „warum jetzt"',
    summary: 'Der Saisonkalender ist jetzt auf deine Schweizer Region zugeschnitten: Wähle deine Region und du siehst Frostdaten, Wachstumssaison und die konkreten Garten-Aufgaben für deinen Monat (aus AGFF/Bioterra-Daten). Jede Pflanze zeigt zudem ein „warum jetzt"-Signal (erste Ernte, letzte Aussaat-Chance …), und was du selbst anbaust wird mit ⭐ markiert und nach oben sortiert.',
    user_summary: '📅 Saisonkalender jetzt regional (Frost, Wachstumssaison, Monats-Aufgaben deiner Region), mit „warum jetzt"-Signalen und ⭐ für deine eigenen Pflanzen.',
    user_items: [
      { emoji: '📍', text: 'Regionaler Kontext: Frostdaten, Wachstumssaison & Monats-Aufgaben für deine CH-Region' },
      { emoji: '⏳', text: '„Warum jetzt": erste/volle/letzte Ernte, letzte Aussaat- & Pflanz-Chance' },
      { emoji: '⭐', text: 'Eigene Pflanzen werden markiert und zuerst angezeigt' },
    ],
    items: [
      {emoji:'📍', bold:'Regionaler Kontext (gsRenderSeasonRegionPanel):', text:' Über der Saison-Liste erscheint nun ein Panel mit deiner Region — Klima-Chips (Höhe, letzter Frost, Wachstumssaison-Tage, Niederschlag), die autoritativen Monats-Aufgaben deiner Region (regional_garden_calendars, Quelle AGFF/Bioterra, inkl. Winter), sowie gut geeignete und schwierige Kulturen. Ohne gewählte Region: sanfte Einladung „Region wählen" (kein Druck, kein Upsell).'},
      {emoji:'⏳', bold:'„Warum jetzt" + eigener Anbau:', text:' Jedes Item zeigt ein aus den echten Saison-Fenstern berechnetes Signal (Erste/Volle/Letzte Ernte, Letzte Aussaat-/Pflanz-Chance, Sammelzeit — nichts erfunden). Pflanzen aus „Meine Pflanzen" bekommen ⭐ „dein Anbau", einen Rahmen und werden in jeder Gruppe zuerst gelistet. Plus Frost-/Eisheiligen-Hinweis je nach Region und Monat.'},
      {emoji:'✅', bold:'Verify:', text:' Live im Preview geprüft — Kein-Region-Einladung, Region Mittelland (Klima-Chips + Mai-Aufgaben „Eisheilige 11-15.5 beachten!"), ⭐-Markierung + Sortierung, „warum jetzt"-Signale, 0 Console-Fehler. 24 neue i18n-Keys + EN/ES/FR/IT geseedet (Migration v29_55). 7/7 node --check + sw.js OK. v-Bump 5-fach v29.54 nach v29.55.'},
    ]
  },
  {
    v: 'v29.54', date: '18.06.2026',
    headline: '📄 KI-Gartenplaner: PDF-Export jetzt vollständig',
    summary: 'Der PDF-Export des KI-Gartenplaners enthält jetzt ALLE Inhalte, die die KI erstellt: eine Schritt-für-Schritt-Anleitung, einen Zeitplan nach Kalenderwoche (mit Mondphasen), einen Pflegeplan, die Mischkultur (welche Pflanzen sich vertragen), biologischen Pflanzenschutz mit Begleitpflanzen und eine Biodiversitäts-Bewertung. Bisher fehlten diese sechs Abschnitte im PDF — der Plan war damit nur halb so nützlich.',
    user_summary: '📄 Gartenplaner-PDF jetzt komplett: Schritt-für-Schritt, Zeitplan mit Mondphasen, Pflegeplan, Mischkultur, biologischer Pflanzenschutz & Biodiversität.',
    user_items: [
      { emoji: '🔨', text: 'Schritt-für-Schritt-Anleitung mit Dauer & Werkzeug im PDF' },
      { emoji: '📅', text: 'Zeitplan nach Kalenderwoche inkl. Mondphasen' },
      { emoji: '🤝', text: 'Mischkultur, biologischer Pflanzenschutz & Biodiversität jetzt enthalten' },
    ],
    items: [
      {emoji:'📄', bold:'PDF-Export vervollständigt (gsPPexportPDF):', text:' Die KI generiert in PRO sechs reiche Sektionen (stepByStep, timeline, careSchedule, mixedCulture, pestControl, biodiversity), die der PDF-Builder bisher komplett weggelassen hat. Jetzt alle eingefügt: Schritt-für-Schritt (nach Schritt sortiert, Dauer/Werkzeug/Details), Zeitplan-Tabelle (nach KW sortiert, Mondphasen-Mapping günstig/meiden/ok), Pflegeplan, Mischkultur-Box (Score + gute/schlechte Nachbarn), Pflanzenschutz-Tabelle (biologisch, mit Begleitpflanze), Biodiversitäts-Box (Score + Bestäuberpflanzen).'},
      {emoji:'🛡️', bold:'Robust gebaut:', text:' Alle Sektionen via Präsenz-Guards (kein Crash bei fehlenden Feldern), alle Texte esc()-escaped (XSS-sicher), Sortierungen auf slice()-Kopie (mutiert das Plan-Objekt nicht).'},
      {emoji:'✅', bold:'Verify:', text:' 9 isolierte Render-Assertions bestehen (Sortierung aufsteigend, XSS-Escaping bei Sortennamen, Mondphasen-Icons, Scores, Begleitpflanze, Bestäuber). OFFEN (Batch 3 Rest): echte-PDF-Ausgabe statt .html-Download, KI-Grounding (species-Spalten 0 befüllt). 7/7 node --check + sw.js OK. v-Bump 5-fach v29.53 nach v29.54.'},
    ]
  },
  {
    v: 'v29.53', date: '18.06.2026',
    headline: '🏆 Quiz-Jahres-Top-3 gewinnen 1 Jahr Pro gratis',
    summary: 'Neu: Die drei besten Spieler der jährlichen Quiz-Rangliste erhalten am Jahresende automatisch 1 Jahr Pro gratis — ganz ohne Bezahlung, als Dankeschön fürs Mitmachen. Die Rangliste zeigt das jetzt ehrlich an (vorher stand dort kein echtes Reward). Die Freischaltung läuft automatisch am 31.12. und gilt 12 Monate.',
    user_summary: '🏆 Quiz-Jahres-Top-3 erhalten am 31.12. automatisch 1 Jahr Pro gratis (echtes Reward, automatische Freischaltung).',
    user_items: [
      { emoji: '🏆', text: 'Top 3 der Jahres-Quiz-Rangliste: 1 Jahr Pro gratis' },
      { emoji: '🎁', text: 'Automatische Freischaltung am Jahresende (31.12.), 12 Monate gültig' },
      { emoji: '🌱', text: 'Geschenk fürs Mitmachen — keine Zahlung, mission-konform' },
    ],
    items: [
      {emoji:'🏆', bold:'fn_grant_quiz_top3_pro (Migration v29_53 LIVE):', text:' SECURITY DEFINER, Cron quiz-top3-yearend (31.12. 23:00 UTC) + Admin-Wrapper. Wählt Top-3 aus quiz_leaderboard (nach total_correct, wie das Frontend rankt) → setzt comp_tier=pro + comp_expires_at=now()+1 Jahr (NUR comp_*, tier unberührt → kein Downgrade von lifetime/stripe; lifetime-comp wird nicht überschrieben). v_user_entitlements gibt dann pro für 12 Monate. Loggt nach system_events.'},
      {emoji:'🎯', bold:'Reward-Anzeige ehrlich:', text:' Rangliste zeigt jetzt „👑/🥈/🥉 1 Jahr Pro gratis" + „Top 3 erhalten 1 Jahr Pro gratis 🎁" (vorher entferntes leeres Versprechen v29.48 → jetzt echtes, hinterlegtes Reward).'},
      {emoji:'✅', bold:'Verify:', text:' Grant-Mechanismus reversibel live getestet (comp-pro → v_user_entitlements.tier=pro, lifetime-Skip korrekt); Test fing uuid-Bug bei comp_granted_by ab (→ NULL). Cron aktiv, Privileg-Matrix sauber, KEIN echter Grant vorzeitig ausgeführt. 7/7 node --check + sw.js OK + Preview-Boot grün. v-Bump 5-fach v29.52 nach v29.53.'},
    ]
  },
  {
    v: 'v29.52', date: '18.06.2026',
    headline: '🪴 KI-Gartenplaner: 3D-Pflanzen sauber konstruiert (kein Überlappen mehr)',
    summary: 'Im 3D-Garten-Plan überlappten sich Gemüse/Pflanzen oft oder ragten über den Beet-Rand hinaus — die KI lieferte Koordinaten, die roh und ohne Korrektur gerendert wurden. Jetzt sorgt ein neuer Layout-Schritt dafür, dass alle Pflanzen-Felder sauber ins Beet einpassen, sich nie überlappen und ordentlich in Reihen angeordnet sind — sowohl in der 3D-Ansicht als auch im PDF-Plan. Zusätzlich werden bei dichter Bepflanzung keine Einzelpflanzen mehr verschluckt.',
    user_summary: '🪴 KI-Gartenplaner-3D: Pflanzen werden jetzt sauber, überlappungsfrei und im Beet angeordnet (3D + PDF) — keine ineinander ragenden/herausragenden Gemüse mehr.',
    user_items: [
      { emoji: '🪴', text: '3D-Pflanzen überlappen nicht mehr & bleiben im Beet (sauber in Reihen)' },
      { emoji: '📄', text: 'PDF-Plan nutzt dasselbe saubere Layout' },
      { emoji: '🌱', text: 'Dichte Bepflanzung verschluckt keine Einzelpflanzen mehr' },
    ],
    items: [
      {emoji:'🪴', bold:'Layout-Sanitizer:', text:' neuer _gsSanitizePlannerPlan(plan) clampt jeden Pflanzen-Footprint (x_m/y_m/w_m/h_m) ins Beet [0,width]×[0,length] + Shelf-Packing (Reihen nach Fläche) → garantiert überlappungsfrei + im Beet; bei zu vielen Pflanzen wird die Länge proportional gestaucht (kein Überhang). Läuft EINMAL nach _gsPP.plan=plan → 3D-Inline, 3D-CAD UND PDF-SVG teilen dieselbe saubere Anordnung. Vorher: rohe KI-Koordinaten (weicher „nicht überlappen"-Prompt) → Meshes durchdrangen sich/ragten raus. Live verifiziert (Mock mit Überlappung+ausserhalb → 0 Überlappung, 0 ausserhalb).'},
      {emoji:'🌱', bold:'Kein Pflanzen-Drop:', text:' im count>1-Grid wurde die letzte versetzte Spalte per continue verworfen → jetzt geclampt (alle Exemplare platziert).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check + sw.js OK + Preview-Boot grün; Sanitizer live getestet. v-Bump 5-fach v29.51 nach v29.52. Folge: PDF echte-PDF-Ausgabe + fehlende Sektionen, KI-Grounding (species-Agronomie-Spalten leer).'},
    ]
  },
  {
    v: 'v29.51', date: '17.06.2026',
    headline: '☁️ Großer Sync-Fix: Pläne, Pflanzen & Garten speichern wieder zuverlässig',
    summary: 'Ein gravierender Fehler in der Cloud-Speicherung ist behoben: Nach dem ERSTEN Speichern wurden Garten-Pläne, Pflanzen und Garten-Daten nicht mehr in die Cloud geschrieben — sie blieben nur lokal und gingen auf anderen Geräten / nach Cache-Leeren verloren. Ursache: die Speicher-Anfrage hatte das falsche Konflikt-Ziel, wodurch jeder weitere Speichern-Versuch serverseitig abgewiesen wurde (409). Das betraf insbesondere den KI-Gartenplaner („Pläne lassen sich nicht speichern"). Jetzt wird zuverlässig aktualisiert statt abgewiesen.',
    user_summary: '☁️ Großer Speicher-Fix: KI-Pläne, Pflanzen & Garten landen wieder zuverlässig in der Cloud (vorher nach dem 1. Mal nur lokal) — gilt auf allen Geräten.',
    user_items: [
      { emoji: '💾', text: 'KI-Gartenpläne speichern wieder (war: nach dem 1. Mal abgewiesen)' },
      { emoji: '🌱', text: 'Pflanzen & Garten-Daten syncen wieder zuverlässig in die Cloud' },
      { emoji: '🔁', text: 'Geräteübergreifend & nach Cache-Leeren erhalten' },
    ],
    items: [
      {emoji:'☁️', bold:'P0 Sync-Root-Cause:', text:' user_gardens & user_plants haben id als PK + user_id nur als UNIQUE. Die Upsert-POSTs (_pushBlob Haupt-Sync, gsPPsavePlan, Plan-Löschen) nutzten Prefer:resolution=merge-duplicates OHNE on_conflict → PostgREST löste auf der PK (id) auf, der Body sendet kein id → frische UUID → kein Match → plain INSERT → 409 auf user_id-UNIQUE. Folge: nach dem 1. Insert syncten Pflanzen/Garten/Pläne für wiederkehrende User NIE mehr. Fix: ?on_conflict=user_id an allen 3 Stellen → korrektes UPDATE-on-conflict. Live verifiziert (ON CONFLICT user_id DO UPDATE = kein 409, Daten erhalten). (user_app_state war ok — dort ist user_id die PK.)'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check + sw.js OK + Preview-Boot grün; Upsert-Pfad live gegen die echte UNIQUE-Constraint getestet. v-Bump 5-fach v29.50 nach v29.51.'},
    ]
  },
  {
    v: 'v29.50', date: '17.06.2026',
    headline: '🍄 Pilz-Scanner: Sicherheits-Fixes bei Verwechslern',
    summary: 'Wichtige Sicherheits-Korrekturen am Pilz-Scanner: Im Verwechslungs-Risiko-Kasten wurde die GEFÄHRLICHSTE Stufe (Lebensgefahr) bisher in der HARMLOSESTEN Farbe angezeigt — ein lebensgefährliches Verwechsler-Paar wirkte ungefährlicher als ein bloss „hoch"-Paar. Das ist behoben (stärkstes Warnrot + klares „☠️ LEBENSGEFAHR"-Label). Ausserdem werden Verwechsler-Pilze jetzt mit lesbarem Namen statt technischem Datenbank-Kürzel angezeigt. Und der Regions-Filter der Garten-Wetter-Warnung funktioniert wieder (die Regions-Kürzel passten vorher nicht zusammen).',
    user_summary: '🍄 Pilz-Scanner-Sicherheit: tödliche Verwechsler werden jetzt korrekt im stärksten Warnrot + „☠️ LEBENSGEFAHR" angezeigt (vorher harmlos-oliv), lesbare Namen, Regions-Filter repariert.',
    user_items: [
      { emoji: '☠️', text: 'Lebensgefährliche Pilz-Verwechsler jetzt im stärksten Warnrot (war fälschlich harmlos-oliv)' },
      { emoji: '🍄', text: 'Verwechsler werden mit lesbarem Namen statt DB-Kürzel angezeigt' },
      { emoji: '📍', text: 'Regions-Filter der Wetter-Warnung repariert (Slug-Mismatch)' },
    ],
    items: [
      {emoji:'☠️', bold:'SAFETY — Verwechsler-Farb-Inversion:', text:' die tödlichste Risiko-Stufe „sehr_hoch_lebensgefahr" fehlte im Farb-Mapping (Z.30954) → fiel auf das harmloseste Oliv → ein lebensgefährliches Verwechsler-Paar wirkte SCHWÄCHER als ein „hoch"-Paar. Jetzt stärkstes Schwarz-Rot (#7f0000) + Label „☠️ LEBENSGEFAHR". Verifiziert: alle bekannt-tödlichen Arten (Amanita phalloides/virosa, Cortinarius orellanus, Gyromitra) sind korrekt toedlich/giftig klassifiziert — KEINE Giftart fälschlich essbar.'},
      {emoji:'🍄', bold:'Lesbare Namen:', text:' Verwechsler-Pilz wurde als roher DB-Slug („steinpilz_boletus") gezeigt → jetzt menschenlesbar (Unterstriche raus, Namensfeld bevorzugt).'},
      {emoji:'📍', bold:'Region-Token-Fix:', text:' GS_WA_REGION_TOKENS-Keys (mittelland_basic/wallis/tessin/alpen) matchten die echten Slugs (mittelland/walliserkern/tessin_sued/graubuenden_hoch/basel_rhein) nicht → Wetter-Warnungs-Regionsfilter lief ins Leere. Auf echte Slugs angeglichen.'},
      {emoji:'🛡️', bold:'Datenqualität (für VAPKO-Review geflaggt, NICHT auto-editiert):', text:' mushroom_register hat Duplikate, garbled Namen + eine widersprüchliche Essbarkeit (Xerocomellus chrysenteron) — aber keine Giftart als essbar (kein Kill-Risiko). Mushroom-DB-Ausbau (Arten/Regionen/VAPKO-Kontakte) braucht authoritative Quellen (VAPKO/SwissFungi), wird NICHT per LLM generiert.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check + sw.js OK + Preview-Boot grün. v-Bump 5-fach v29.49 nach v29.50.'},
    ]
  },
  {
    v: 'v29.49', date: '17.06.2026',
    headline: '🏠 Home & Wetter spürbar besser + 💳 Checkout-Feinschliff',
    summary: 'Viele Verbesserungen am Start- und Wetter-Bereich plus Hänger-Fixes: Das Wetter-Fenster lässt sich jetzt sauber nach unten wegwischen (statt versehentlich neu zu laden). Bauernregel & Garten-Wetter-Warnung wechseln nur noch einmal pro Tag (kein neues Sprüchlein mehr beim Antippen). Der Saison-Filter (Gemüse/Obst/Kräuter/Pilze) funktioniert wieder. XP-Profil und „Kauf wiederherstellen" reagieren sofort statt scheinbar zu hängen. Dazu drei Bezahl-Korrekturen (robuster Stripe-Rückkehr-Handler, „Karte aktualisieren" öffnet das Portal, Abo-Karte & Warnbanner zeigen dieselbe Subscription).',
    user_summary: '🏠 Wetter sauber wegwischbar, Bauernregel & Wetter-Warnung nur 1×/Tag, Saison-Filter repariert, XP/Restore reagieren sofort — plus Bezahl-Feinschliff.',
    user_items: [
      { emoji: '👆', text: 'Wetter-Fenster sauber nach unten wegwischbar (kein Reload mehr)' },
      { emoji: '🌾', text: 'Bauernregel & Wetter-Warnung wechseln nur 1×/Tag (kein Re-Roll beim Tippen)' },
      { emoji: '🗓️', text: 'Saison-Filter (Gemüse/Obst/Kräuter/Pilze) repariert' },
      { emoji: '⚡', text: 'XP-Profil & „Kauf wiederherstellen" reagieren sofort (kein Hänger)' },
      { emoji: '💳', text: 'Bezahl-Feinschliff: Portal, Rückkehr-Handler, Abo-Anzeige konsistent' },
    ],
    items: [
      {emoji:'👆', bold:'Wetter-Swipe-Close:', text:' Wisch-nach-unten löste statt Schliessen einen Reload aus — Ursache: dem Wetter-Modal fehlte overscroll-behavior:contain → der Abwärts-Zug kettete zum Dokument → native Pull-to-Refresh. Fix: overscroll-behavior:contain + touchmove non-passive mit preventDefault beim Dismiss-Drag.'},
      {emoji:'🌾', bold:'24h-Rotation (kein Re-Roll):', text:' Bauernregel (gsShowNextWisdom-Tap entfernt — Tages-Seed bleibt) + Garten-Wetter-Warnung (Tap öffnet jetzt die Live-Warnungen statt zu re-rollen; höchste Severity gewinnt, Gleichstand date-stabil) zeigen nur noch alle 24h einen neuen Inhalt.'},
      {emoji:'🗓️', bold:'Saison-Filter:', text:' Chips sendeten gemüse/obst/kräuter/pilze, die Daten-Kategorien heissen aber gemuese/frucht/kraut/pilz → 4 von 5 Filtern zeigten nichts. Slugs angeglichen.'},
      {emoji:'⚡', bold:'Hänger-Fixes:', text:' XP-Balken→Profil zeigte ein leeres Modal bis sbLoadProfile geantwortet hatte (await vor Render) → Sofort-Skeleton. „Kauf wiederherstellen" hatte kein Feedback vor dem await → Sofort-Toast „⏳ Wiederherstelle…".'},
      {emoji:'🔁', bold:'P2 Doppel-Handler:', text:' Eine parse-time-IIFE strippte ?billing= sofort → der billing-Branch in gsHandleAuthRedirect (Boot, +500ms) lief NIE. Auf EINEN Handler konsolidiert: die IIFE (robust, mit Entitlement-Retry-Poll seit v29.48 P1) bleibt aktiv, der tote zweite Branch entfernt.'},
      {emoji:'💳', bold:'P3 Past-due-CTA:', text:' „Karte aktualisieren" rief gsOpenBillingPortal(\'payment_method_update\') — der Arg wurde still verworfen (nur cancel/reactivate gehen als flow_data an stripe-portal v3). Jetzt gsOpenBillingPortal() ohne Arg → Standard-Portal deckt den Karten-Wechsel ab.'},
      {emoji:'🎯', bold:'P3 Current-Sub:', text:' Abo-Karte (gsLoadSubInfo, order=created_at.desc) und Past-due-Banner (order=current_period_end.desc) wählten potenziell verschiedene Sub-Zeilen. Banner liest jetzt dieselbe Quelle (gsLoadSubInfo) → nie divergent.'},
      {emoji:'✅', bold:'Verify:', text:' node --check index.html + sw.js OK + Preview-Boot grün. Stripe-Test-Mode (4242), Live-Code nicht berührt. v-Bump 5-fach v29.48 nach v29.49.'},
    ]
  },
  {
    v: 'v29.48', date: '17.06.2026',
    headline: '🔧 Kern-Flow-Audit: Scanner, Lina, Quiz & Checkout gehärtet',
    summary: 'Ein adversarialer Audit der wichtigsten App-Abläufe hat mehrere echte Probleme aufgedeckt — alle gefixt: Ein Scan mit ungewöhnlicher KI-Antwort verschwendet keinen Gratis-Scan mehr. Lina (der KI-Coach) bewirbt am Tageslimit kein Abo mehr (sie bleibt gratis und verkauft nie). Die Quiz-Rangliste verspricht kein „Gratis-Premium" mehr, das es nie gab — stattdessen ehrliche Ehrenränge. Und zahlende Nutzer auf dem iPhone bleiben nach dem Kauf nicht mehr auf „Gratis" hängen.',
    user_summary: '🔧 Audit-Fixes: Scanner robuster (kein verschwendeter Scan), Lina verkauft nie (Mission), Quiz-Rangliste ehrlich, iPhone-Zahler bleiben nicht auf Free hängen.',
    user_items: [
      { emoji: '🌿', text: 'Lina bleibt gratis & bewirbt nie ein Abo — auch am Tageslimit nicht' },
      { emoji: '📷', text: 'Scanner: ungewöhnliche KI-Antwort verschwendet keinen Gratis-Scan mehr' },
      { emoji: '💳', text: 'iPhone-Zahler werden nach dem Kauf zuverlässig freigeschaltet' },
    ],
    items: [
      {emoji:'🌿', bold:'Lina P1 (Mission):', text:' am Tageslimit feuerte callAI den Pro/Lifetime-Quota-Toast auch für Lina → Mission-Verstoss (Lina darf NIE upsellen). Jetzt für quotaFeature=lina unterdrückt (Lina zeigt ihre eigene warme, verkaufsfreie Bubble). Plus: Doppel-Send-Guard (kein doppelter Quota-Abzug) + dezenter Hinweis wenn Cloud-Speicherung fehlschlägt.'},
      {emoji:'📷', bold:'Scanner P2/P3:', text:' nicht-numerische KI-toxicity (z.B. "hoch"/"3/5") crashte den Scan-Render → falsches „Scan fehlgeschlagen" + verbrauchter Gratis-Scan. toxInfo coerct jetzt numerisch. Plus gsSaveConfirmedScan quota-safe (HL#10) → 95%-Scan landet auch bei vollem Speicher in der History.'},
      {emoji:'🏆', bold:'Quiz P2 (ehrlich):', text:' Jahres-Rangliste versprach Top-3 ein „Premium-Abo gratis", das NIE vergeben wurde (nur Stub) → falsches Versprechen entfernt, ersetzt durch ehrliche Ehrenränge (👑 Jahres-Champion / Vize / Dritter).'},
      {emoji:'💳', bold:'Checkout P1:', text:' Popup-Kauf pollte Entitlements 7×, der Redirect-Pfad (iOS-PWA / popup-blockiert) aber nur 1× → Webhook-Lag ließ Zahler bis App-Neustart auf Free. Jetzt dasselbe Retry-Polling (reines Tier-Refresh, keine Geld-Logik). Weitere Checkout-Edge-Cases (P2/P3) für Fernando geflaggt (Payment-Risiko).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check + sw.js OK + Preview-Boot grün. v-Bump 5-fach v29.47 nach v29.48.'},
    ]
  },
  {
    v: 'v29.47', date: '17.06.2026',
    headline: '📷 Tagebuch-Fotos: sicher gespeichert & jetzt sichtbar',
    summary: 'Fotos im Garten-Tagebuch werden jetzt richtig gespeichert — im sicheren Cloud-Speicher statt als großer Datenblock im Eintrag (das konnte den Browser-Speicher sprengen). Und: dein Tagebuch zeigt das Foto jetzt auch wirklich an (vorher wurde es gespeichert, aber nie angezeigt). Auf allen Geräten verfügbar.',
    user_summary: '📷 Garten-Tagebuch-Fotos landen jetzt im sicheren Cloud-Speicher (kein Speicher-Bloat mehr) UND werden in der Timeline angezeigt (vorher unsichtbar).',
    user_items: [
      { emoji: '📷', text: 'Tagebuch-Foto wird im Eintrag angezeigt (vorher nie gerendert)' },
      { emoji: '☁️', text: 'Foto landet im garden-diary-photos-Bucket statt als base64-Blob' },
      { emoji: '🔄', text: 'Geräteübergreifend (photo_url in garden_diary) + offline-Fallback' },
    ],
    items: [
      {emoji:'📷', bold:'Deferred-TODO erledigt:', text:' gsDiarySubmitEntry legte das Foto als base64 in metadata.photo_b64 (Quota-/Row-Size-Risiko HL#10/#21) — und es wurde NIE gerendert. Jetzt: Upload in garden-diary-photos (owner-folder INSERT-Policy seit v29.40) → opts.photo_url → garden_diary.photo_url (Spalte existiert). Rohes base64 (Prefix-Strip wie Caller 24315), sbIsLoggedIn-Gate, base64-Fallback offline/Gast → kein Foto-Verlust.'},
      {emoji:'🖼️', bold:'Timeline-Render:', text:' openGartenTagebuch zeigt jetzt e.photo_url als Thumbnail (klick → Vollbild). photo_url kommt cross-device via gsGardenSync-Mapping (garden_diary → gs_gartentagebuch). gsHTMLEscape auf die URL.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check + sw.js OK + Preview-Boot grün. Pfad uid/<uuid>.jpg = v29.40-Policy; garden_diary.photo_url-Spalte bestätigt. v-Bump 5-fach v29.46 nach v29.47.'},
    ]
  },
  {
    v: 'v29.46', date: '17.06.2026',
    headline: '✏️ Neu: Inserate bearbeiten (vorher nur löschen/neu)',
    summary: 'Du kannst deine Marktplatz-Inserate jetzt direkt bearbeiten — Titel, Beschreibung, Preis, Kategorie, Region und Kontakt ändern, ohne löschen und neu erstellen zu müssen. Ein „✏️ Inserat bearbeiten"-Knopf erscheint in deinem eigenen Inserat. Sicher gebaut: der Server prüft, dass es wirklich dein Inserat ist, und ändert nur die erlaubten Felder (Status, Verkauft-Markierung und Meldungen bleiben unangetastet).',
    user_summary: '✏️ Marktplatz: Inserate direkt bearbeiten (Titel/Preis/Beschreibung/…) statt löschen & neu — mit „Inserat bearbeiten"-Knopf im eigenen Inserat.',
    user_items: [
      { emoji: '✏️', text: 'Eigene Inserate bearbeiten — Knopf im Inserat-Detail' },
      { emoji: '🔒', text: 'Server prüft Eigentümerschaft + ändert nur erlaubte Felder' },
      { emoji: '🌍', text: 'Edit-Texte auf Deutsch/Englisch/Spanisch' },
    ],
    items: [
      {emoji:'✏️', bold:'editListing fertiggebaut:', text:' war Dead-Code (gs_nl_edit_id wurde gesetzt, aber nie gelesen → saveListing erzeugte ein DUPLIKAT statt Update). Jetzt: saveListing liest gs_nl_edit_id und sendet listing_id an die marketplace-publish-Edge-Fn v4 → server-seitig ownership-geprüftes UPDATE (Whitelist title/desc/category/price/region/contact/price_mode; status/reports/views/user_id/created_at unberührt = sicher per Konstruktion). Kein ungeguardetes direktes PATCH.'},
      {emoji:'🖱️', bold:'UI:', text:' „✏️ Inserat bearbeiten"-Button im Owner-Control-Block (gsMarketShowDetail); editListing füllt das Formular (null-safe), belegt Bio/Pestizid-frei nur wenn vorhanden (leert sie nie versehentlich), beschriftet den Button auf „💾 Änderungen speichern". gs_nl_edit_id wird in openNewListing (frisches Inserat) + nach erfolgreichem Speichern geleert → kein versehentliches Update.'},
      {emoji:'✅', bold:'Verify:', text:' Edit-Flow im Preview end-to-end getestet (Formular-Populate, edit_id-Set, Button-Label, Clear-on-new). Edge-Fn-Vertrag (v4 listing_id-UPDATE, 403 bei Fremd-Inserat) bestätigt. 3 i18n-Keys + 12 Übersetzungen (EN/ES/FR/IT). 7/7 node --check + sw.js OK. v-Bump 5-fach v29.45 nach v29.46.'},
    ]
  },
  {
    v: 'v29.45', date: '17.06.2026',
    headline: '🛡️ Fundament-Härtung: Daten-Sicherheit, Crash-Schutz & Resilienz',
    summary: 'Ein tiefer 4-Säulen-Audit (Boot, Cloud-Sync, Fehler-Resilienz, Vollständigkeit) hat das Fundament der App geprüft — Ergebnis: solide, mit ein paar Härtungs-Punkten, die jetzt alle gefixt sind. Wichtigste: ein beschädigter Browser-Speicher kann die App nicht mehr lahmlegen; der Cloud-Sync schützt deine Daten jetzt auf ALLEN Wegen vor versehentlichem Überschreiben (nicht nur beim manuellen Sync); und ein einzelner kaputter Eintrag kann keine ganze Liste mehr leeren.',
    user_summary: '🛡️ Fundament gehärtet: Crash-Schutz bei beschädigtem Speicher, lückenloser Daten-Sync-Schutz (alle Pfade), robustere Listen — kein Datenverlust.',
    user_items: [
      { emoji: '💥', text: 'Beschädigter Browser-Speicher legt die App nicht mehr lahm' },
      { emoji: '☁️', text: 'Cloud-Sync schützt deine Daten auf allen Wegen vor Überschreiben' },
      { emoji: '🧱', text: 'Ein defekter Eintrag blankt keine ganze Liste mehr' },
    ],
    items: [
      {emoji:'💥', bold:'P1 Crash-Schutz:', text:' farmState las gs_farm mit JSON.parse auf Modul-Ebene — korruptes localStorage hätte das GANZE Haupt-Script (77k Zeilen) getötet → ganze App tot. Jetzt Safe-Parse mit Default-Fallback.'},
      {emoji:'☁️', bold:'P1 Sync-Daten-Sicherheit:', text:' gsSyncUserDataOnLogin (Boot/Login/Visibility-Pull) setzte die v29.28-Race-Guards NICHT (nur gsSyncPullNow tat das) → ein paralleler Push konnte gerade-gepullte Daten re-pushen. Jetzt setzen ALLE Pull-Pfade _gsPullInFlight + _gsSyncPullInProgress (nesting-safe finally). Plus: Account-Wechsel setzt das Suppression-Flag VOR dem Cache-Clear (sonst Clobber der neuen Cloud mit leer) + re-armt den Boot-Race-Guard. Plus: State-Blob (Achievements/Favs/Streak/Quiz) bekam den gleichen Empty/Boot-Race-Guard wie plants/garden.'},
      {emoji:'🧱', bold:'P2/P3 Resilienz:', text:' renderGarden wrappt jede Garten-Karte (Rollback-Anker — ein defektes Objekt blankt nicht die ganze Liste); renderFavs in switchTab try-gecatcht; Karten-Fund-Löschung offline → Tombstone (lebt nicht beim nächsten Pull wieder auf, Retry online).'},
      {emoji:'🧹', bold:'Vollständigkeit:', text:' Bluetooth-Sensor-Texte „(in Kürze)" → „live" korrigiert (Feature ist verdrahtet); repo CLAUDE.md kanonische Domain green-scan.ch. Audit-Fazit: Boot/Sync/Resilienz alle „solide", 0 P0. 7/7 node --check + sw.js OK + Preview-Boot grün. v-Bump 5-fach v29.44 nach v29.45.'},
    ]
  },
  {
    v: 'v29.44', date: '17.06.2026',
    headline: '🐛 App-Qualität: Bug-Fixes aus dem Pre-Launch-Audit',
    summary: 'Ein 4-Agenten-Audit hat den echten App-Code durchsucht und konkrete Fehler gefunden — alle gefixt: Dein Garten aktualisiert sich jetzt sofort, wenn du auf einem anderen Gerät etwas änderst. Mehrere private Daten (Marktplatz-Chats, GPS-Funde, Garten-Standort) werden beim Abmelden zuverlässig gelöscht, damit auf einem geteilten Gerät niemand deine Daten sieht. Und drei Stellen, die nur auf Deutsch angezeigt wurden, sind jetzt auf Englisch & Spanisch übersetzt.',
    user_summary: '🐛 Pre-Launch-Audit-Fixes: Garten-Sync re-rendert sofort, private Daten werden beim Logout gelöscht (geteiltes Gerät), 3 Stellen jetzt EN/ES.',
    user_items: [
      { emoji: '🔄', text: 'Garten aktualisiert sich sofort nach Cross-Device-Sync' },
      { emoji: '🔒', text: 'Private Daten (Chats, GPS-Funde, Standort) beim Logout gelöscht' },
      { emoji: '🌍', text: 'Pflanzen-Tags, Dossier/Sammlung & Marktplatz-Preis jetzt EN/ES' },
    ],
    items: [
      {emoji:'🔄', bold:'Wiring (HL#9):', text:' Cloud-Garten-Sync rief renderGardenList() — existiert nicht → Garten-Liste re-renderte nach Cross-Device-Sync NIE (nur Widgets). Fix: echte Funktion renderGarden(). Plus: Admin-Log-Toast (HL#12 escaped-quote → ReferenceError) repariert + toter initAuth()-Boot-Guard entfernt.'},
      {emoji:'🔒', bold:'Persistenz/Privacy (Stale-Leak):', text:' 10 per-User-Keys fehlten in GS_USER_KEYS → überlebten Logout/User-Switch auf geteiltem Gerät: gs_market_chats (private Chats), greenscan_markers (private GPS-Funde), gs_expert_application (PII Email/Bio/Diplome), gs_soil_profile/gs_pp_garden_location (Garten-Kontext), gs_market_reported/ratings, gs_wissen_read/recipe_favs/recent_searches. Jetzt bei Logout geleert (alle cloud-restored bzw. PII).'},
      {emoji:'🌍', bold:'i18n (DE→EN/ES):', text:' loadMoreList (Arten-Tags + Mehr-laden), gsNewPlantCard (📂 Dossier / 📁 Sammlung), selectListingType (Marktplatz-Preis-Label) waren hartcodiert Deutsch → via _t() + 4 neue Keys in GS_I18N_JS_STRINGS + EN/ES/FR/IT in i18n_translations geseedet.'},
      {emoji:'✅', bold:'Audit-Fazit:', text:' iOS-PWA sauber (alle nativen Dialoge guarded, keepalive-fetch korrekt), 0 Phantom-Handler von 519, Persistenz-Hauptpfade quota-safe. 7/7 node --check + sw.js OK + Preview-Boot grün. v-Bump 5-fach v29.43 nach v29.44.'},
    ]
  },
  {
    v: 'v29.43', date: '17.06.2026',
    headline: '🩺 Ops-Cockpit + Store-Assets + Audit der Hintergrund-Schichten',
    summary: 'Drei Dinge zusammen: (1) Ein neues „Ops-Cockpit" im Admin-Bereich bündelt alle Hintergrund-Wächter (Daten-Integrität, Kostendeckung, Sicherheit, Hintergrund-Jobs) zu EINER Ampel-Übersicht — ein Blick zeigt, ob alles gesund läuft. (2) Die App-Store-Grafiken (Feature-Grafik + Icon) sind erstellt. (3) Ein unabhängiger 3-Agenten-Audit hat alle 9 Hintergrund-Schichten geprüft: 0 echte Fehler, sauber gehärtet. Für normale Nutzer unsichtbar — reine Hintergrund- & Admin-Arbeit.',
    user_summary: '🩺 Neues Admin-Ops-Cockpit (alle Hintergrund-Wächter auf einen Blick) + App-Store-Grafiken erstellt + 9 Schichten unabhängig auditiert (0 Fehler).',
    user_items: [
      { emoji: '🩺', text: 'Ops-Cockpit: Integrität, Kosten, Sicherheit & Jobs in einer Ampel-Übersicht (Admin)' },
      { emoji: '🏪', text: 'App-Store-Grafiken erstellt (Feature-Grafik + Icon)' },
      { emoji: '🔒', text: '9 Hintergrund-Schichten unabhängig auditiert — 0 echte Fehler' },
    ],
    items: [
      {emoji:'🩺', bold:'Schicht 10 — fn_admin_ops_digest() (Migration v29_43 LIVE):', text:' admin-gated, read-only. Liest die jüngsten Snapshots aus system_events (data_integrity/finance/security, KEIN Re-Run → kein Log-Spam) + Cron-Health + 24h-Severity → eine konsolidierte Ampel (🟢/🟡/🔴). Admin-Panel: neue „🩺 Ops-Cockpit"-Karte ganz oben (gsAdminFetchOpsDigest + _gsAdminOpsCockpitHtml). Verifiziert (Admin-JWT): overall=ok, 22 Jobs, MRR 7.90, Integrität 108 Objekte.'},
      {emoji:'🔒', bold:'Audit der Schichten 5–9 (3-Agenten-Workflow):', text:' Security-Red-Team PASS (Privileg-Matrix exakt, Gates feuern, system_events default-deny, kein PII/Secret-Leak, keine Injection), Backend CLEAN (0 ERROR-Advisor, 28/28 Schema-Spalten real, Crons aktiv ohne Kollision, MRR aus Stripe nicht profiles.tier HL#20, 30d-GC bounded), Frontend CLEAN (RPC-Pfade korrekt, kein Off-by-one, kein Phantom, XSS escaped, node-check 7/7). 0 Fixes nötig.'},
      {emoji:'🏪', bold:'Store-Assets:', text:' store-assets/feature-graphic-1024x500.png (Play) + app-store-icon-1024.png (App Store, RGB ohne Alpha) generiert (SVG-Master + qlmanage/Pillow). Screenshots brauchen Test-Login (Auth-Gate).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check + sw.js OK + Preview-Boot grün. v-Bump 5-fach v29.42 nach v29.43.'},
    ]
  },
  {
    v: 'v29.42', date: '17.06.2026',
    headline: '💰 Hintergrund-Schicht 7: Kostendeckung im Blick (Admin)',
    summary: 'GreenScan behält jetzt automatisch im Auge, ob die Kosten gedeckt sind — ganz im Sinne der Mission „Mensch und Natur verbinden, nicht geldgierig, aber kostendeckend". Ein täglicher Hintergrund-Snapshot stellt die wiederkehrenden Einnahmen (echte Abos) den KI-Kosten gegenüber und meldet automatisch, wenn ein Defizit droht oder die App den 5000-Nutzer-Meilenstein erreicht. Für Admins als „💰 Kostendeckung"-Karte sichtbar. Für normale Nutzer ändert sich nichts — reine Hintergrund-Schicht.',
    user_summary: '💰 Neue Hintergrund-Schicht: automatische Kostendeckungs-Überwachung (Einnahmen vs. KI-Kosten) — Admin-Ansicht, mission-konform.',
    user_items: [
      { emoji: '💰', text: 'Tägliche Kostendeckungs-Übersicht (MRR vs. KI-Kosten) für Admins' },
      { emoji: '🎯', text: 'Automatische Warnung bei Defizit-Risiko + 5000-Nutzer-Meilenstein' },
      { emoji: '🌱', text: 'Mission-konform: kostendeckend statt geldgierig, keine Sales-Tricks' },
    ],
    items: [
      {emoji:'💰', bold:'Schicht 7 — fn_finance_snapshot() (Migration v29_42 LIVE):', text:' read-only SECURITY DEFINER, Cron finance-snapshot-daily 04:45 UTC + Admin-On-Demand (fn_admin_finance_snapshot, is_admin_user-gated). Vereint reale AI-Kosten (ai_daily_usage CHF) mit echter MRR (stripe_subscriptions — NICHT profiles.tier, das comp/admin-Grants enthält, HL#20) → Deckungsgrad, aktive Pro/Trial/Lifetime, total Users → loggt nach system_events, severity=warn bei Defizit (AI 30d > MRR, ab 5 CHF) oder 5000-User-Marker (Mission-Trigger). Admin-Panel: neue „💰 Kostendeckung"-Karte. JWT-verifiziert: anon=0, non-admin→admin only. Baseline: 1 echtes Pro-Abo = MRR 7.90 CHF, AI 0.20 CHF/30d, Deckung 40×.'},
      {emoji:'📒', bold:'FINANZ_STRATEGIE_v1.md:', text:' Living-Doc (Mission-Auftrag) um die Automatisierung ergänzt — das monatliche MRR-vs-Infra-Monitoring ist jetzt maschinell gestützt statt manuell.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check + sw.js OK + Preview-Boot grün. Backend: Cron aktiv, system_events geschrieben, Red-Team-Privilegien sauber.'},
    ]
  },
  {
    v: 'v29.41', date: '17.06.2026',
    headline: '🏪 App-Store-Vorbereitung + neue Hintergrund-Schicht (Daten-Integrität)',
    summary: 'Zwei Dinge auf einmal: (1) GreenScan ist jetzt bereit, als echte App in Google Play und den Apple App Store zu gehen — die ganze Technik-Seite (Digital Asset Links, öffentliche Datenschutz-Seite, korrekte Auslieferung) ist vorbereitet, plus eine Schritt-für-Schritt-Anleitung für die Konto-Schritte. (2) Eine weitere Hintergrund-Schicht: ein täglicher Daten-Integritäts-Scan prüft Speicher-Verwaiste, Backup-Stände und Bucket-Größen und schreibt das ins System-Protokoll — die App passt noch besser auf sich selbst auf. Alles im Hintergrund, für normale Nutzer unsichtbar.',
    user_summary: '🏪 Bereit für Google Play & Apple App Store (Technik vorbereitet) + neue Hintergrund-Schicht: täglicher Daten-Integritäts-Scan.',
    user_items: [
      { emoji: '📲', text: 'App-Installation überall: Android, iOS (Home-Bildschirm), Desktop' },
      { emoji: '🏪', text: 'Store-Vorbereitung komplett (Asset-Links, Datenschutz-Seite, Anleitung)' },
      { emoji: '🩺', text: 'Neue Hintergrund-Schicht: täglicher Daten-Integritäts-Scan (Admin)' },
    ],
    items: [
      {emoji:'🩺', bold:'Layer 5 — fn_data_integrity_scan() (Migration v29_41 LIVE):', text:' read-only SECURITY DEFINER, taeglich 04:35 UTC (Cron data-integrity-daily) + Admin-On-Demand-Button (fn_admin_data_integrity, is_admin_user-gated). Zaehlt Storage-Orphans (species-images via storage_path-Mapping), rejected-Backlog, Snapshot-Retention (Cap 6) + Per-Bucket-Objekt-Counts (Kosten-Sicht) → loggt nach system_events (erster echter Writer der v29.31-Tabelle), severity warn bei Anomalien. KEIN DELETE (loeschende Storage-GC folgt, sobald echte Orphans auftreten — species-images aktuell leer). JWT-verifiziert: anon=0, non-admin→admin only, 108 Objekte/0 Orphans.'},
      {emoji:'🏪', bold:'Store-Readiness:', text:' /.well-known/assetlinks.json (Android-TWA Digital Asset Links, package ch.greenscan.app, Platzhalter-Fingerprints) + _headers application/json + _redirects schuetzt /.well-known/* vorm SPA-Fallback. Neue oeffentliche Datenschutz-Seite privacy.html unter /privacy & /datenschutz (Store-Pflicht, ohne Login). Manifest/Icons/Splash/Install-Flow waren bereits store-tauglich. STORE_SUBMISSION_GUIDE.md mit allen Fernando-Schritten (Play 25$ einmalig · App Store 99$/Jahr · Signing-Fingerprint-Falle · Guideline 4.2 · Data-Safety).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check + sw.js OK + Preview-Boot grün. Backend: Cron aktiv, system_events geschrieben, Red-Team-Privilegien sauber.'},
    ]
  },
  {
    v: 'v29.40', date: '16.06.2026',
    headline: '📸 Deine Fotos: jetzt sicher in der Cloud gespeichert',
    summary: 'Die Fotos, die du von deinen Pflanzen und im Garten-Tagebuch machst, werden ab jetzt zuverlässig in deinem privaten Cloud-Speicher abgelegt — nicht mehr nur auf dem Gerät. Das heißt: Sie sind auf allen deinen Geräten verfügbar, gehen beim Cache-Leeren nicht verloren und belegen keinen Browser-Speicher mehr. Bereits vorhandene Fotos, die noch lokal hingen, werden beim nächsten Login automatisch hochgeladen. Deine Fotos bleiben privat — nur du kannst sie auflisten.',
    user_summary: '📸 Deine Pflanzen- & Tagebuch-Fotos werden jetzt sicher in deinem privaten Cloud-Speicher abgelegt — auf allen Geräten verfügbar, kein Datenverlust beim Cache-Leeren.',
    user_items: [
      { emoji: '📸', text: 'Pflanzen- & Garten-Tagebuch-Fotos landen jetzt im robusten Cloud-Speicher' },
      { emoji: '🔄', text: 'Auf allen Geräten verfügbar — und sicher vor Cache-Leeren/Quota' },
      { emoji: '🔒', text: 'Privat: nur du kannst deine Fotos auflisten (Anzeige via sicheres CDN)' },
    ],
    items: [
      {emoji:'🗄️', bold:'Storage-Policies:', text:' user-plant-photos + garden-diary-photos hatten KEINE INSERT-Policy → jeder Upload 403 → Frontend fiel still auf base64-localStorage zurück (fragil, kein Cross-Device, Quota-Risiko). v29_40-Migration: je 3 owner-folder-Policies (INSERT/UPDATE/DELETE, Pattern (storage.foldername(name))[1]=auth.uid(), (SELECT …)-gewrappt). SELECT bewusst ohne Policy = privates Listing (HL#19); Anzeige via public CDN-GET.'},
      {emoji:'🔁', bold:'gsMigrateBase64Photos:', text:' Flag-Key v26_58→v29_40 (läuft einmal erneut, jetzt mit funktionierender Policy) + done-Flag nur bei failed===0 (retry bis alle base64-Fotos in Storage) + erfasst photo UND photoUrl.'},
      {emoji:'✅', bold:'Verify:', text:' JWT-Test: own_folder_upload_ok=true | other_folder_blocked=true. 7/7 node --check + sw.js OK + Preview-Boot grün.'},
    ]
  },
  {
    v: 'v29.39', date: '16.06.2026',
    headline: '🗓️ Neu: „Mein Naturjahr" — deine Natur-Reise auf einen Blick',
    summary: 'Eine neue persönliche Jahres-Übersicht, die deine ganze Natur-Aktivität zu einer schönen Story verbindet: gescannte Arten, Karten-Funde, Garten-Pflanzungen, Ernte-Kilos, Quiz-Streak/-Punkte und Erfolge — plus eine Aktivitäts-Grafik pro Monat und deine Top-Arten des Jahres. Alles aus deinen bereits gespeicherten Daten (kein neues Tracking, funktioniert offline). Zu finden im Menü unter „Meine Welt → Mein Naturjahr".',
    user_summary: '🗓️ Neu: „Mein Naturjahr" — Scans, Funde, Garten, Ernte, Quiz & Erfolge des Jahres in einer schönen Übersicht (Menü → Meine Welt).',
    user_items: [
      { emoji: '🗓️', text: '„Mein Naturjahr": persönliche Jahres-Übersicht deiner Natur-Aktivität' },
      { emoji: '📈', text: 'Aktivitäts-Grafik pro Monat + deine Top-Arten' },
      { emoji: '🔒', text: 'Nur aus deinen vorhandenen Daten — kein neues Tracking, offline' },
    ],
    items: [
      {emoji:'🗓️', bold:'gsOpenNaturjahr():', text:' aggregiert client-seitig aus gs_scan_history (Scans+Arten+Top-5), greenscan_markers (Funde), gs_plantings (Pflanzungen), gs_ernte_log (Ernte-kg), gs_dq_stats (Quiz-Streak/-Punkte), gs_achievements (Erfolge) für das laufende Jahr. 8 Stat-Kacheln + 12-Monats-Aktivitäts-Balken (aktueller Monat hervorgehoben) + Top-Arten-Liste. Defensiv (alle Quellen optional, ts ms ODER ISO), escHtml für Namen, i18n via _t (Deutsch-Fallback).'},
      {emoji:'🧭', bold:'Einstieg:', text:' Menü → „Meine Welt" → 🗓️ Mein Naturjahr (mi-naturjahr). Modal über detail-modal, kein Backend, kein neues Tracking — rein additiv.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check + sw.js OK + Preview-Boot grün (0 Konsolen-Fehler). Live getestet: populiert (Tiles/Monats-Bars/Top-Arten/Quiz korrekt) + Empty-State + Menü-Eintrag vorhanden.'},
    ]
  },
  {
    v: 'v29.38', date: '16.06.2026',
    headline: '🚑 Tägliches Quiz repariert (P0-Hotfix)',
    summary: 'Das Tägliche Quiz lud die Frage nicht mehr und brach mit „keine richtige Antwort markiert" ab — für alle eingeloggten User. Ursache: ein Format-Mismatch zwischen Quiz-Laden und Quiz-Anzeige (die Antworten kamen als reine Texte + Index, die Anzeige erwartete aber Objekte). Behoben: die Anzeige normalisiert jetzt beide Formate. Fragen aus der DB, die 4 Antwort-Optionen, die richtige Antwort, Punkte/Streak und die Rangliste funktionieren wieder wie vorher. (Hinweis: kein Daten-Verlust — die 179 Quiz-Fragen waren immer in der DB; es war reiner Anzeige-Bug, KEIN „Cleanup", der Inhalte gelöscht hat.)',
    user_summary: '🚑 Tägliches Quiz funktioniert wieder — alle Fragen, Antworten, Punkte & Rangliste wie vorher.',
    user_items: [
      { emoji: '🧩', text: 'Quiz-Frage + 4 Antworten laden wieder' },
      { emoji: '🏆', text: 'Punkte, Streak & Rangliste wieder aktiv' },
      { emoji: '🛡️', text: 'Kein Daten-Verlust — war ein reiner Anzeige-Bug' },
    ],
    items: [
      {emoji:'🐛', bold:'Root-Cause:', text:' openDailyQuiz/RPC fn_get_daily_quiz liefert options als String-Array (options.choices) + correct_idx; openDailyQuizFromSupa erwartete aber Objekte {text,is_correct}. correctOpt-Suche fand nichts → früher Return mit Fehler-Toast, bevor die Frage gesetzt wurde. Betraf JEDEN eingeloggten User (RPC-Pfad).'},
      {emoji:'🔧', bold:'Fix:', text:' openDailyQuizFromSupa normalisiert String-Optionen + correct_idx → {text,is_correct,explanation}-Objekte (Objekt-Format weiter unterstützt). Live verifiziert: Frage gesetzt, 4 Antwort-Buttons, richtige Antwort markiert, kein Früh-Abbruch.'},
      {emoji:'🔍', bold:'Diagnose:', text:' DB 179 Quiz-Fragen + Rangliste intakt, RPC liefert gültige Frage, keine Cleanup-Funktion löscht Quiz-Daten — reiner Frontend-Format-Bug.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check + sw.js OK + Preview-Boot grün (0 Konsolen-Fehler).'},
    ]
  },
  {
    v: 'v29.37', date: '16.06.2026',
    headline: '🌐 Garten-Ansicht übersetzt + Detail-Politur + KI-Garten-Planer Rate-Limit',
    summary: 'Abschluss-Politur. (1) Der „Mein Garten"-Voll-Render war als einziger Bereich noch fest deutsch — jetzt durchgängig übersetzbar (EN/ES), konsistent mit den Schwester-Ansichten. (2) Im Arten-Detail brechen lange Lebensraum-/Höhen-Angaben nicht mehr aus dem Raster. (3) Backend: der KI-Garten-Planer hat jetzt — wie der Pflanzen-Doktor — ein serverseitiges Stunden-Limit (Kostenschutz).',
    user_summary: '🌐 „Mein Garten" jetzt voll übersetzbar (EN/ES) + Detail-Politur. KI-Garten-Planer mit Kostenschutz-Limit.',
    user_items: [
      { emoji: '🌐', text: '„Mein Garten" durchgängig übersetzbar (war als einziges noch deutsch)' },
      { emoji: '📐', text: 'Arten-Detail: lange Werte brechen das Raster nicht mehr' },
      { emoji: '🛡️', text: 'KI-Garten-Planer: serverseitiges Stunden-Limit (Kostenschutz)' },
    ],
    items: [
      {emoji:'🌐', bold:'renderGarden i18n:', text:' alle sichtbaren Strings (Standort/Pflanzen-Anzahl/Status/Gepflanzt/Empty-States/Buttons) über _t() mit Deutsch-Fallback — Garten-Voll-Render war der letzte fest-deutsche Renderer. Live verifiziert (Fallback ok, kein undefined).'},
      {emoji:'📐', bold:'Eco/Klassen-Raster Overflow:', text:' .di {min-width:0} + .div2 {overflow-wrap:anywhere} → lange Habitat-/Höhen-Strings im Arten-Detail brechen das 2-Spalten-Raster nicht mehr.'},
      {emoji:'🛡️', bold:'garden-scan-analyze v10 (Backend, mirror-first):', text:' Server-Rate-Limit 20/h/User via fn_check_rate_limit (fail-open). Mirror-first ins Repo, struktur-geprüft, smoke-getestet (OPTIONS 200/no-auth 401), volles Prompt-Schema. Zweite KI-Edge-Fn mit Rate-Limit (nach plant-doctor v5).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check + sw.js OK + Preview-Boot grün (0 Konsolen-Fehler); renderGarden live gerendert. Offene Mini-P3 (Empty-State-Pattern-Angleich, Saison-Tipp-Clamp, doppelte CSS-Def) bewusst als spätere Politur.'},
    ]
  },
  {
    v: 'v29.36', date: '16.06.2026',
    headline: '🛡️ KI-Doktor-Rate-Limit + Audit-Fixes (XSS-Härtung + Politur)',
    summary: 'Zwei Stränge: (A) Der Pflanzen-Doktor (KI) hat jetzt serverseitig ein Stunden-Limit (Kostenschutz) — sauber mirror-first deployed + getestet. (B) Ein Code-Audit der Haupt-Screens fand mehrere Schönheitsfehler + Sicherheitslücken, die alle behoben wurden: u.a. wurden im „Mein Garten"-Bereich Garten- und Pflanzennamen ungeschützt angezeigt (Layout-Bruch + XSS-Risiko bei Sonderzeichen) — jetzt sauber escaped. Dazu ein doppelter Saison-Streifen in der Arten-Detailansicht entfernt, Texte gegen Überlauf abgesichert, und das Arten-Foto reserviert jetzt Platz (kein Layout-Sprung beim Laden).',
    user_summary: '🛡️ KI-Doktor mit Stunden-Limit (Kostenschutz) + viele Politur-/Sicherheits-Fixes in Garten & Arten-Detail.',
    user_items: [
      { emoji: '🩺', text: 'Pflanzen-Doktor: serverseitiges Stunden-Limit (Kostenschutz)' },
      { emoji: '🔒', text: 'Garten: Namen mit Sonderzeichen brechen die Anzeige nicht mehr (XSS-Härtung)' },
      { emoji: '✨', text: 'Doppelter Saison-Streifen entfernt, kein Layout-Sprung beim Bild-Laden' },
    ],
    items: [
      {emoji:'🩺', bold:'plant-doctor-diagnose v5 (mirror-first deployed):', text:' Server-Rate-Limit 30 Diagnosen/Stunde/User via fn_check_rate_limit (Migration v29_36 grant service_role; fail-open). Source erst ins Repo gemirrored, Struktur-geprüft, deployed + smoke-getestet (OPTIONS 200, no-auth 401).'},
      {emoji:'🔒', bold:'XSS/Layout (P1):', text:' renderGarden + refreshGardenWeather escapen jetzt garden.name/location + p.name/variety (waren als einzige Renderer ungeschützt → Layout-Bruch/Stored-XSS); openDetail-Header (name/lat/desc) escaped + min-width:0; _priceLabel escaped den User-Preis. Live verifiziert: <img onerror>/<script> werden neutralisiert.'},
      {emoji:'✨', bold:'Kosmetik (P1/P2):', text:' doppelter Saison-Streifen in openDetail entfernt; Garten-/Pflanz-Karten mit Ellipsis + min-width:0 + Status-Badge flex-shrink:0 (lange Namen brechen die Zeile nicht mehr); #sp-img-Host reserviert 170px → kein Layout-Sprung beim Async-Bild-Laden.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check + sw.js OK + Preview-Boot grün (0 Konsolen-Fehler); Escaping + Render live getestet. (Audit-P3-Reste — i18n im Garten-Voll-Render, Empty-State-Angleich — bewusst als Folge-Politur offen.)'},
    ]
  },
  {
    v: 'v29.35', date: '16.06.2026',
    headline: '✨ Kein Login-Flash mehr + smoothere Übergänge',
    summary: 'Zwei spürbare Politur-Fixes. (1) Login-Flash: Vor dem Login blitzte kurz die App-Startseite auf, bevor das Onboarding drüberkam — weil die App-Oberfläche zuerst gezeichnet wurde und das Onboarding erst per Script danach. Jetzt entscheidet die App schon VOR dem ersten Bild (synchron): kein Konto → App-Oberfläche bleibt verborgen, Onboarding sofort sichtbar. Kein Aufblitzen mehr. (2) Übergänge: Fenster/Dialoge gleiten jetzt sanft auf und wieder zu (vorher sprangen sie hart auf/zu) — inklusive Respekt für „Bewegung reduzieren" (Systemeinstellung).',
    user_summary: '✨ Kein kurzes Aufblitzen der Startseite vor dem Login mehr, und Dialoge öffnen/schliessen jetzt sanft.',
    user_items: [
      { emoji: '🚫', text: 'Login-Flash behoben: keine Startseite mehr vor dem Login sichtbar' },
      { emoji: '🪄', text: 'Dialoge gleiten sanft auf + zu (statt hartem Springen)' },
      { emoji: '♿', text: '„Bewegung reduzieren" wird respektiert (Accessibility)' },
    ],
    items: [
      {emoji:'🚫', bold:'Login-Flash-Guard:', text:' synchroner <head>-Check VOR dem ersten Paint — ohne gs_sb_token wird per Klasse gs-preauth #app versteckt + #gs-onboarding sofort gezeigt (injiziertes <style>). Eingeloggte sehen #app ohne Verzögerung. gsOnboardingHide/Done entfernt die Klasse nach Login. Live verifiziert: kein-Token→app hidden+onboarding; Token→app sofort sichtbar.'},
      {emoji:'🪄', bold:'Modal-Übergänge:', text:' Öffnen (Overlay-Fade + Sheet-Slide-up) + Schliessen (Fade-out) per GPU-Animation (opacity/transform, kein Reflow). closeModal entfernt .open SOFORT (Logik sieht geschlossen) + verzögert display:none um 200ms für den Fade; Reopen-Guard verhindert Verstecken bei Schliessen→sofort-Öffnen (live getestet). Escape-Taste nutzt jetzt auch closeModal.'},
      {emoji:'♿', bold:'prefers-reduced-motion:', text:' Animationen nur bei no-preference; bei „Bewegung reduzieren" wird sofort/ohne Animation geschlossen.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check + sw.js OK + Preview-Boot grün (0 Konsolen-Fehler); Flash-Guard + Modal-Open/Close/Reopen live verifiziert.'},
    ]
  },
  {
    v: 'v29.34', date: '16.06.2026',
    headline: '🛡️ Backend-Upgrade Schicht 4: Missbrauchs-Schutz (Rate-Limiting) + Auto-Aufräumen',
    summary: 'Schicht 4: vorhandene Rate-Limiting-Infrastruktur jetzt verdrahtet + automatisches Aufräumen verwaister Daten. Das Foto-Beitrag-System ist jetzt zusätzlich pro Stunde gedeckelt (Anti-Spam), und das Einlösen von Gutschein-Codes ist gegen Brute-Force/Enumeration geschützt (max. 12 Versuche/Stunde). Ein neuer täglicher Aufräum-Job entfernt abgelehnte Foto-Beiträge + abgelehnte Arten-Vorschläge automatisch. Alles im Hintergrund, additiv.',
    user_summary: '🛡️ Mehr Missbrauchs-Schutz im Hintergrund (Rate-Limits) + täglicher Auto-Aufräum-Job für abgelehnte Daten.',
    user_items: [
      { emoji: '🛡️', text: 'Gutschein-Einlösung gegen Brute-Force geschützt (max. 12/Stunde)' },
      { emoji: '📸', text: 'Foto-Beiträge zusätzlich pro Stunde gedeckelt (Anti-Spam)' },
      { emoji: '🧹', text: 'Täglicher Auto-Aufräum-Job für abgelehnte Beiträge/Vorschläge' },
    ],
    items: [
      {emoji:'🛡️', bold:'Rate-Limiting verdrahtet (Migration v29_34):', text:' fn_check_rate_limit (existierte ungenutzt) jetzt in fn_redeem_voucher (12/h → Anti-Brute-Force, JWT-verifiziert: 13. Versuch → rate_limited) + fn_contribute_species_image (15/h, zusätzlich zu dedupe + 30-pending-Cap). In-RPC PERFORM (DEFINER→DEFINER, kein Grant nötig). Frontend zeigt freundliche „zu schnell"-Meldung.'},
      {emoji:'🧹', bold:'fn_cleanup_orphans + Cron cleanup-orphans-daily (25 4 * * *):', text:' löscht abgelehnte species_images >14d + abgelehnte species_proposals >30d (DB-only; Storage-Datei-GC bräuchte Edge-Fn, deferred — rejected-Dateien sind owner-only gelistet + URL nie publiziert). Verifiziert: GC läuft, Cron aktiv.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check + sw.js OK + Preview-Boot grün (0 Konsolen-Fehler). Voucher-Rate-Limit live als JWT getestet, Test-Daten bereinigt. Additiv → Live-Payment-DB unberührt.'},
    ]
  },
  {
    v: 'v29.33', date: '16.06.2026',
    headline: '🔎 Audit der neuen Schichten — Red-Team bestanden, 3 Schönheitsfehler poliert',
    summary: 'Audit der drei neuen Backend-Schichten (v29.30-32). Der Live-Red-Team-Test der neuen Funktionen war komplett sauber: keine Sicherheits- oder Funktionslücke (anon/Nicht-Admin überall abgewiesen, interne Service-Funktionen nicht von aussen erreichbar, Ereignis-Log default-dicht, 0 Advisor-Fehler). Gefunden + behoben wurden nur drei kleine Schönheitsfehler in den neuen Admin-Ansichten (lange Texte ohne Abschneiden, identische Kachelfarbe) plus eine Least-Privilege-Hygiene aufs Ereignis-Log.',
    user_summary: '🔎 Audit bestanden: keine Funktions-/Sicherheitsfehler, nur 3 kleine kosmetische Politur-Fixes in den Admin-Ansichten.',
    user_items: [
      { emoji: '✅', text: 'Red-Team der neuen Funktionen: keine Lücke (Sicherheit + Funktion sauber)' },
      { emoji: '🎨', text: '3 Schönheitsfehler in den Admin-Ansichten poliert' },
    ],
    items: [
      {emoji:'✅', bold:'Audit-Ergebnis:', text:' Red-Team (echte Rollen-Impersonation) der v29.30-32-Schichten = 0 exploitable Funde — Admin-Fns anon→denied/non-admin→admin-only, Service-Fns (fn_monitor_health/fn_log_system_event) für anon+authenticated REVOKEd, system_events RLS default-deny (Lesen=0, INSERT→RLS-Verstoß), is_admin_user Email-Forge nicht möglich, Advisor 0 ERROR. Wiring sauber (Promise.all-Indizes/Render/Felder, warn-Silencing + debug-Gating brechen keinen Caller).'},
      {emoji:'🎨', bold:'Schönheitsfehler (P3, behoben):', text:' (1) System-Ereignisse-Hauptzeile (source · event) jetzt mit Ellipsis statt Mehrzeilen-Umbruch. (2) Cron-Schedule-Code mit max-width+Ellipsis (drückte sonst den Job-Namen). (3) System-Ereignisse-Kachel eigene Tönung (#eef2ff) statt identisch mit Storage-Diagnostics (#f3f4f6).'},
      {emoji:'🔒', bold:'Hygiene (Migration v29_33, HL#17):', text:' system_events least-privilege — breite Default-Tabellen-Grants für anon/authenticated entzogen (RLS war bereits dicht; defense-in-depth). Verifiziert: keine anon/authenticated-Grants mehr.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check + sw.js OK + Preview-Boot grün (0 Konsolen-Fehler); alle 3 Fixes im gerenderten HTML bestätigt.'},
    ]
  },
  {
    v: 'v29.32', date: '16.06.2026',
    headline: '🕶️ Backend-Upgrade Schicht 3: Hintergrund noch besser versteckt',
    summary: 'Schicht 3: die internen Abläufe der App sind in der veröffentlichten Version jetzt noch unsichtbarer. Schon bisher waren die Entwickler-Logs (log/debug/info) in Produktion stumm — jetzt zusätzlich auch die internen Warn-/Ablauf-Meldungen (z.B. Sync-Schritte). Und der technische Diagnose-Befehl gibt im Normalbetrieb keine internen Details (wie Nutzer-ID oder Sync-Warteschlange) mehr preis. Im Entwickler-Modus (für dich) bleibt alles voll sichtbar — per gs_debug oder gsConsoleRestore().',
    user_summary: '🕶️ Die internen Abläufe sind in der Live-Version noch besser versteckt (Konsole + Diagnose), für dich im Dev-Modus weiterhin voll einsehbar.',
    user_items: [
      { emoji: '🕶️', text: 'Auch interne Warn-/Ablauf-Logs in Produktion stumm (error bleibt für Telemetrie)' },
      { emoji: '🔒', text: 'Diagnose-Befehl gibt im Normalbetrieb keine Internals (Nutzer-ID etc.) preis' },
    ],
    items: [
      {emoji:'🕶️', bold:'_gsConsoleCleanup erweitert:', text:' console.warn wird in Prod zusätzlich zu log/debug/info stillgelegt (versteckt internen Flow wie [gsSync]…). console.error bleibt aktiv (Fehler-Telemetrie). Dev-Escape: ?gs_debug=1 / localStorage gs_debug / gsConsoleRestore() (restored jetzt auch warn).'},
      {emoji:'🔒', bold:'gsCloudSync.debug() gated:', text:' gibt im Prod-Modus (kein _gsDevMode) nur noch {hidden:true, online} zurück statt uid/dirty-Scopes/Queue — Konsolen-Poking enthüllt keine Internals mehr. Im Dev-Mode unverändert voll.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check + sw.js OK + Preview-Boot grün (0 Fehler). Prod-Pfad getestet (_gsDevMode=false → debug() versteckt uid; warn-Original gesichert + restorebar). Reine Frontend-Härtung, keine Funktions-Änderung.'},
    ]
  },
  {
    v: 'v29.31', date: '16.06.2026',
    headline: '🩺 Backend-Upgrade Schicht 2: Selbstüberwachung (Self-Healing-Monitor)',
    summary: 'Schicht 2 des Backend-Upgrades: ein neuer Monitor-Job läuft jede Stunde und überwacht die anderen Hintergrund-Jobs — schlägt ein Job fehl, wird das automatisch in einem strukturierten System-Ereignis-Protokoll festgehalten (statt unbemerkt zu bleiben). Im Admin-Panel gibt es dazu „🩺 System-Ereignisse". Modernes Must-have: die App merkt selbst, wenn im Hintergrund etwas klemmt, und führt Buch darüber. Komplett im Hintergrund, für normale Nutzer unsichtbar, additiv (kein Eingriff in bestehende Abläufe).',
    user_summary: '🩺 Die App überwacht sich jetzt selbst: stündlicher Monitor protokolliert automatisch, falls ein Hintergrund-Job fehlschlägt.',
    user_items: [
      { emoji: '🩺', text: 'Stündlicher Self-Healing-Monitor protokolliert Job-Fehler automatisch' },
      { emoji: '📋', text: 'Admin: „System-Ereignisse" — strukturiertes Ops-Log auf einen Blick' },
    ],
    items: [
      {emoji:'🗄️', bold:'system_events (Migration v29_31 LIVE):', text:' strukturiertes Ops-Log (severity/source/event/detail jsonb), RLS ohne public-Zugriff (nur service_role + SECURITY DEFINER). + fn_log_system_event (internes Primitive für künftige Sicherheits-/Ops-Events).'},
      {emoji:'🩺', bold:'fn_monitor_health + Cron health-monitor-hourly:', text:' läuft stündlich (5 * * * *), scannt cron.job_run_details der letzten 75 Min auf Fehlläufe + protokolliert jeden einmal (dedupe) in system_events; GC der Events >30 Tage. Verifiziert: läuft, Cron aktiv.'},
      {emoji:'📋', bold:'fn_admin_system_events + Admin-Sektion „🩺 System-Ereignisse":', text:' admin-gated (is_admin_user, JWT-verifiziert), letzte 30 Events mit Severity-Icon + relativer Zeit + Detail-Auszug (escaped). REVOKE public/anon.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check + sw.js OK + Preview-Boot grün (0 Konsolen-Fehler). Read-only/additiv für die Anzeige; Monitor läuft service-seitig. Live-Payment-DB unberührt.'},
    ]
  },
  {
    v: 'v29.30', date: '16.06.2026',
    headline: '⚙️ Backend-Upgrade Schicht 1: Hintergrund-Job-Überwachung (Observability)',
    summary: 'Start des schichtweisen Backend-Upgrades. Schicht 1 = Observability: die App hat 17 automatische Hintergrund-Jobs (Backups, Erinnerungen, Wissens-Wachstum, Aufräumen, Push…), aber bisher konnte niemand sehen, ob sie wirklich laufen. Jetzt überwacht ein neuer Cron-Health-Monitor alle Jobs (letzter Lauf, Erfolg/Fehler, Fehler pro 24h) — sichtbar im Admin-Panel als „⚙️ Hintergrund-Jobs" mit Ampel (🟢/🟡/🔴). Modernes Must-have: man sieht sofort, wenn eine Automatisierung klemmt. Read-only, admin-only, additiv — kein Eingriff in bestehende Abläufe.',
    user_summary: '⚙️ Neue Hintergrund-Job-Überwachung (Admin): sofort sichtbar, ob alle 17 Automatik-Jobs laufen.',
    user_items: [
      { emoji: '⚙️', text: 'Cron-Health-Monitor: alle 17 Hintergrund-Jobs mit Ampel-Status (Admin)' },
      { emoji: '🟢', text: 'Letzter Lauf, Erfolg/Fehler, Fehler/24h pro Job auf einen Blick' },
    ],
    items: [
      {emoji:'⚙️', bold:'fn_admin_cron_health (Migration v29_30 LIVE):', text:' SECURITY DEFINER, admin-gated (is_admin_user), liest cron.job + cron.job_run_details (40-Tage-Fenster deckt monatliche Jobs). Liefert pro Job: schedule, last_run, last_status, last_duration_s, runs_24h, fails_24h, healthy. REVOKE public/anon. JWT-verifiziert: admin → 17/17 healthy; non-admin → „admin only".'},
      {emoji:'🖥️', bold:'Admin-Panel-Sektion „⚙️ Hintergrund-Jobs":', text:' Ampel 🟢 gesund / 🟡 unbekannt / 🔴 Fehler, relative Zeit, Schedule, Fehlerzähler + ↻-Refresh. Job-Namen escaped (XSS-safe).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check + sw.js OK + Preview-Boot grün (0 Konsolen-Fehler). Read-only/additiv — Live-Payment-DB unberührt. Nächste Schichten: Rate-Limiting-Verdrahtung, System-Events, Auto-Hygiene.'},
    ]
  },
  {
    v: 'v29.29', date: '15.06.2026',
    headline: '🔒 Voll-Audit + Härtung — Foto-Beiträge & Fundorte privat, Code zukunftssicher',
    summary: 'Eine erneute Sicherheits-Durchsicht über alles, was diese Woche dazukam (Arten-Fotos, Cloud-Sync), mit einem Live-Red-Team gegen die neuen Server-Funktionen. Ergebnis: keine echte Lücke in den Funktionen (alle Angriffe abgewehrt — Fremd-Zugriff, Moderations-Umgehung, Rechte-Eskalation blockiert). Ein Punkt wurde gehärtet: zwei Foto-Speicher (Arten-Foto-Beiträge inkl. noch-nicht-geprüfter, und Karten-Fundort-Fotos) ließen sich von außen auflisten/durchstöbern — das ist jetzt zu (nur noch der Besitzer sieht die Liste; das Anzeigen freigegebener Bilder funktioniert unverändert). Dazu etwas Code-Politur (einheitliches Escaping).',
    user_summary: '🔒 Sicherheits-Audit bestanden: deine Foto-Beiträge und Fundort-Fotos sind jetzt privat (nicht mehr von außen auflistbar).',
    user_items: [
      { emoji: '🛡️', text: 'Red-Team-Audit der neuen Funktionen: alle Angriffe abgewehrt' },
      { emoji: '🔐', text: 'Foto-Beiträge & Fundort-Fotos nicht mehr von außen auflistbar' },
      { emoji: '🧹', text: 'Code-Härtung: einheitliches Escaping (zukunftssicher)' },
    ],
    items: [
      {emoji:'🔐', bold:'P2 Storage-Listing (Migration v29_29 LIVE, HL#19):', text:' species-images (inkl. pending Beiträge) + map-find-photos erlaubten anon-LISTING → fremde/un-moderierte Dateien enumerierbar (red-team-bestätigt). Fix: SELECT-Policy owner-only ((storage.foldername(name))[1]=auth.uid); Bucket bleibt public → CDN-GET bekannter URLs (Anzeige) unverändert. anon-Listing jetzt 0.'},
      {emoji:'🧹', bold:'P3 escHtml-Idiomatik:', text:' gsLoadSpeciesImage nutzt jetzt das kanonische escHtml (& < > ") statt manuellem 1-Zeichen-replace — zukunftssicher gegen Kontext-Wechsel (nicht aktuell exploitierbar, aber Best-Practice).'},
      {emoji:'🧹', bold:'P3 gsToast-Fallback:', text:' alert-Fallback wandelt Objekt-Toasts in Text statt „[object Object]" (unerreichbarer Edge-Case, defensiv).'},
      {emoji:'✅', bold:'Audit-Ergebnis (3-Agenten + Red-Team):', text:' XSS-UGC: kein exploitable Vektor (admin-queue + detail-render sauber escaped). Wiring: alle 18 Session-Funktionen ohne Phantom-Calls/HL#12. Red-Team: anon→privilegierte Fns denied, non-admin self-approve→„admin only", RLS cross-user reads=0, direct INSERT self-approved→RLS-Verstoß, snapshot kann nicht fremden user_id targeten. Advisor 0 ERROR. node-check 7/7. Build clean + origin synchron.'},
    ]
  },
  {
    v: 'v29.28', date: '15.06.2026',
    headline: '🛡️ Cloud-Sync gehärtet — Backup-Schutz + sauberer 2-Wege-Abgleich (Review-Fixes)',
    summary: 'Ein gründlicher Sicherheits-Review des neuen Cloud-Syncs (v29.27) hat vier Schwachstellen gefunden, alle behoben. Die wichtigste: Das häufige Auto-Backup hätte bei nur 3 Backup-Plätzen die wertvollen älteren Sicherungen (Tages-Backup, Vor-Update-Backup) zu schnell verdrängt — genau die, die man nach einem Problem braucht. Jetzt sind 6 Plätze da und die wichtigen Anker-Backups sind dauerhaft geschützt. Außerdem: der periodische Abgleich lädt nicht mehr unnötig die gerade geholten Daten wieder hoch, aktualisiert die Liste nur bei echten Änderungen (kein Scroll-Sprung mehr), und ein manueller Sync wartet jetzt korrekt auf einen laufenden Abgleich.',
    user_summary: '🛡️ Cloud-Sync abgesichert: mehr geschützte Backups, kein unnötiges Hochladen, keine störenden Listen-Sprünge mehr.',
    user_items: [
      { emoji: '💾', text: 'Backups geschützt: 6 Plätze + wichtige Anker-Backups bleiben erhalten' },
      { emoji: '🔁', text: 'Periodischer Abgleich lädt geholte Daten nicht mehr unnötig wieder hoch' },
      { emoji: '🧘', text: 'Listen aktualisieren nur bei echten Änderungen (kein Scroll-Sprung)' },
    ],
    items: [
      {emoji:'💾', bold:'P1 Backup-Retention (Migration v29_28 LIVE):', text:' 3-Slot-Cap hätte den v29.27-3h-Snapshot die daily/pre_migration-Snapshots binnen ~9h verdrängen lassen. Fix: Cap 3→6 + trigger-aware Retention (neuester pre_migration/auto_daily/pre_logout IMMER geschützt) + auto_periodic im CHECK & fn_user_snapshot_create whitelisted (wurde vorher silent zu „manual" coerced). JWT-verifiziert: Label jetzt korrekt „auto_periodic".'},
      {emoji:'🔁', bold:'P2 Re-Push behoben:', text:' Der innere _gsSyncPullInProgress-Block in gsSyncUserDataOnLogin setzte das Flag zu früh auf false → nachfolgende Writebacks (gpx/diary/ernte) markierten dirty → jeder Pull pushte die gerade geholten Daten zurück. Fix: save/restore statt hart-false + gsSyncPullNow setzt das Flag synchron für den GANZEN Pull.'},
      {emoji:'🧘', bold:'P2 Render-Disrupt behoben:', text:' Nach dem Pull wird nur noch re-gerendert, wenn sich die Daten WIRKLICH geändert haben (Signatur-Vergleich) UND der Nutzer nicht tippt / kein Modal offen ist — kein Scroll-Sprung, kein Karten-Kollaps beim 2-Min-Pull.'},
      {emoji:'🔒', bold:'P3 Race + manueller Sync:', text:' Asynchrone Pushes werden während eines Pulls aufgeschoben (beforeunload-Push läuft weiter → kein Datenverlust beim Schliessen). Manueller Backup-Tap wartet jetzt auf einen laufenden Pull, statt veraltete Daten zu sichern.'},
      {emoji:'✅', bold:'Verify:', text:' Adversarialer 2-Agenten-Review → 4 Funde, alle gefixt. Backend-Migration als echter JWT verifiziert. 7/7 node --check + sw.js OK + Preview-Boot grün (v29.28, 0 Konsolen-Fehler).'},
    ]
  },
  {
    v: 'v29.27', date: '15.06.2026',
    headline: '☁️ Cloud-Sync rundum: konstant, automatisch, in beide Richtungen + sichtbarer Status',
    summary: 'Block B der Feature-Welle (Fernando-Punkt 6: „Cloud Backup & Sync konstant + automatisch"). Bisher liefen das Hochladen deiner Daten konstant — aber Änderungen von ANDEREN Geräten kamen erst beim Neustart der App an. Jetzt synchronisiert die App in beide Richtungen, automatisch: sobald du die App in den Vordergrund holst und zusätzlich alle 2 Minuten, werden Änderungen von deinen anderen Geräten geholt. Der Sync-Status ist jetzt live sichtbar („Synchronisiere…", „zuletzt vor X Min", „Offline", „Backup vor X"). Der Backup-/Sync-Knopf in den Einstellungen macht jetzt einen vollen 2-Wege-Sync + Sicherung. Und es wird konstant ein frischer Wiederherstellungspunkt angelegt (alle ~3h statt nur 1×/Tag).',
    user_summary: '☁️ Deine Daten gleichen sich jetzt automatisch in beide Richtungen ab — beim App-Öffnen + alle 2 Min. Live-Status + häufigeres Backup.',
    user_items: [
      { emoji: '🔄', text: '2-Wege-Sync: Änderungen anderer Geräte kommen automatisch (Fokus + alle 2 Min)' },
      { emoji: '👁️', text: 'Sichtbarer Live-Status: „Synchronisiere… / zuletzt vor X / Offline"' },
      { emoji: '💾', text: 'Konstanteres Backup: frischer Wiederherstellungspunkt alle ~3h' },
    ],
    items: [
      {emoji:'🔄', bold:'Periodischer + Fokus-PULL (Kern):', text:' gsSyncPullNow + _gsSetupConstantSync — Pull bei visibilitychange=visible / window.focus / online + alle 2 Min (nur sichtbar), 25s-Cooldown, Concurrency-Guard. LWW-safe (gsSyncUserDataOnLogin schützt lokal-neuere Daten + Empty-Clobber-Guards PERS-12). _gsSyncPullInProgress unterdrückt Re-Push der gepullten Daten. Nach Pull: renderMyPlants/renderGarden (nur wenn KEIN Modal offen → kein Disrupt). Vorher lief PULL nur bei Login/Boot.'},
      {emoji:'👁️', bold:'Live-Status:', text:' gsSyncStatusText um „Synchronisiere…" + „Offline" erweitert; _gsUpdateSyncStatusEl alle 15s + nach jedem Sync. Settings-Zeile „Cloud-Backup & Sync" zeigt den echten Live-Zustand.'},
      {emoji:'💾', bold:'2-Wege-Backup-Button + konstanteres Backup:', text:' gsManualSnapshotBackup macht jetzt flushNow + Pull + Snapshot (echter 2-Wege-Sync per Tap). Auto-Sync legt zusätzlich zum Tages-Snapshot alle ~3h einen auto_periodic-Snapshot an (server-seitig auf 3/User gekappt → rotiert).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check + sw.js OK · Preview-Boot grün (v29.27, 0 Konsolen-Fehler): gsSyncPullNow/_gsSetupConstantSync definiert, Setup läuft + Interval gesetzt, Status-Text korrekt, kein Throw. PUSH-Engine (30s-when-dirty + Events) unverändert beibehalten.'},
    ]
  },
  {
    v: 'v29.26', date: '15.06.2026',
    headline: '📸 Arten-Fotos: echte Bilder im Detail + dein Foto beitragen (Community baut die DB auf)',
    summary: 'Block A der neuen Feature-Welle (Fernando-Punkte 1+2): Die Arten-Detailansicht zeigt jetzt ein echtes Foto statt nur Emoji — bevorzugt ein von der Community beigetragenes (freigegebenes) Bild, sonst ein Wikipedia-Bild als Fallback. Und du kannst selbst beitragen: Beim Öffnen einer Art gibt es „📸 Eigenes Foto zu dieser Art beitragen" — wahlweise dein zuletzt gescanntes Foto oder eines aus der Galerie/Kamera. So bauen wir gemeinsam die Bild-Datenbank auf. Fotos erscheinen erst nach kurzer Prüfung (Moderation) — keine falschen/unscharfen Bilder, Datenschutz gewahrt (Opt-in). Admins haben dafür eine neue „Foto-Beiträge"-Sektion im Admin-Panel.',
    user_summary: '📸 Arten zeigen jetzt echte Fotos — und du kannst dein eigenes Foto beitragen (erscheint nach kurzer Prüfung).',
    user_items: [
      { emoji: '🖼️', text: 'Arten-Detail zeigt echtes Foto (Community-Bild bevorzugt, sonst Wikipedia)' },
      { emoji: '📸', text: '„Eigenes Foto beitragen" — dein Scan-Foto oder aus der Galerie' },
      { emoji: '✅', text: 'Moderiert: Fotos erscheinen erst nach kurzer Prüfung (Opt-in, Datenschutz)' },
    ],
    items: [
      {emoji:'🗄️', bold:'Backend (Migration LIVE, separat committet):', text:' species_images +contributed_by/review_status/scan_confidence/admin_note/reviewed_by/at. RLS: public SELECT nur approved (+own-pending). 4 RPCs (SECURITY DEFINER, search_path-pinned, REVOKE public/anon): fn_species_images (anon+auth) · fn_contribute_species_image (auth, dedupe+spam-cap 30) · fn_admin_species_image_queue + fn_admin_review_species_image (is_admin_user-gated). storage: authenticated-Upload in species-images/<uid>/. HL#16 als echter JWT verifiziert + Advisor 0 ERROR.'},
      {emoji:'🖼️', bold:'gsLoadSpeciesImage:', text:' lädt im Arten-Detail (#sp-img-<id>) zuerst das approved Community-Bild via fn_species_images (mit Attribution), Fallback auf Wikipedia. Belebt den toten wi--Container (HL#9) wieder — vorher zeigte das Detail GAR kein Bild.'},
      {emoji:'📸', bold:'gsContributeSpeciesPhoto:', text:' Button im Arten-Detail → bietet das letzte Scan-Foto an (gsConfirmModal) oder Galerie/Kamera-Picker → gsCompressImage → gsUploadImage(species-images) → fn_contribute_species_image → pending. Login-Pflicht, freundliche Fehler (already/too-many pending).'},
      {emoji:'👑', bold:'Admin-Review:', text:' Neue „📸 Foto-Beiträge (N)"-Sektion im Admin-Panel (gsAdminFetchSpeciesImageQueue/_gsAdminSpeciesImageHtml) mit Thumbnail + ✓ Freigeben(+Hauptbild)/✕ Ablehnen (gsAdminReviewSpeciesImage), per-Sektion-Refresh.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check + sw.js OK · Preview-Boot grün (v29.26, 0 Konsolen-Fehler): alle 6 Funktionen definiert, openDetail rendert Bild-Host + Beitrag-Button, Admin-HTML rendert. Entscheidung Fernando: Opt-in + Moderation.'},
    ]
  },
  {
    v: 'v29.25', date: '15.06.2026',
    headline: '🌳 Garten-Speichern endgültig gefixt — „Garten"-Button landet jetzt WIRKLICH im Garten',
    summary: 'Nachschlag zu v29.24: Ein adversarialer Code-Audit hat die EIGENTLICHE (deterministische) Ursache gefunden, warum Gemüse/Kräuter „nicht im Garten gespeichert" wurden. Der Button „🌳 Garten" auf einer Art öffnete das Hinzufügen-Formular, liess den Standort-Schalter aber auf 🏠 Wohnung stehen — die Pflanze landete dann in „Meine Pflanzen" statt im Garten. Und selbst wer den Garten korrekt wählte, bekam ein leeres Namensfeld (Vorbefüllung schrieb in ein nicht existierendes Feld) → das Speichern brach mit „Bitte Pflanzennamen eingeben" ab. Beide jetzt behoben: der Garten-Button wählt den Garten vor, und der Name wird korrekt übernommen. Plus kleinere Politur an v29.24 (Toast-Dauer, Speicher-Parität, API-Anzeige-Übersetzung, Abo-Refresh-Entdoppelung).',
    user_summary: '🌳 „In Garten" speichert jetzt wirklich in den Garten (nicht versehentlich in „Meine Pflanzen"), und der Name wird automatisch übernommen.',
    user_items: [
      { emoji: '🌳', text: '„Garten"-Button wählt jetzt den Garten vor (vorher landete es in „Meine Pflanzen")' },
      { emoji: '✍️', text: 'Pflanzenname wird automatisch ins Garten-Formular übernommen' },
      { emoji: '✨', text: 'Kleinere Politur an den v29.24-Fixes' },
    ],
    items: [
      {emoji:'🌳', bold:'Bug-3 P1-A (deterministisch):', text:' gsAddSpeciesToGarden öffnete modal-addplant, setzte den mp-location-Toggle aber NIE auf outdoor → sticky auf Wohnung → savePlant-Indoor-Zweig → Pflanze in myPlants statt Garten. Fix: nach openModal wird der outdoor-Radio vorgewählt (change-Event). Ein Button namens „Garten" geht jetzt in den Garten.'},
      {emoji:'✍️', bold:'Bug-3 P1-B (deterministisch):', text:' Der Outdoor-Redirect-Prefill schrieb in getElementById("pl-name") — dieses Feld existiert nicht (echtes Feld: id="plant-name"; Fallback input[name=name] auch nicht vorhanden) → Name kam nach dem Redirect nie an → savePlanting brach mit „Bitte Pflanzennamen eingeben" ab. Fix: korrektes Feld plant-name (+ plant-notes) befüllen, nach openAddPlanting-Reset sequenziert.'},
      {emoji:'⏱️', bold:'P3 Toast-Dauer:', text:' Die Speicher-voll-Fehler-Toasts nutzten gsToast(msg,"error",6000) — die 6000ms wurden verworfen (positionale Form forwardet keine duration). Jetzt Objekt-Form gsToast({body,type,duration:6000}).'},
      {emoji:'🛡️', bold:'P3 Speicher-Parität:', text:' savePlantsToStorage nutzt jetzt gsStore.setJSON (stringify im try/catch) — durchgehend wurf-sicher wie saveGardenData.'},
      {emoji:'🌐', bold:'P3 Item-5 i18n:', text:' data-i18n von der dynamischen API-Status-Zeile entfernt, damit ein Sprachwechsel den Live-Status nicht mit „Wird geprüft…" überschreibt.'},
      {emoji:'🔁', bold:'P3 Bug-4 Entdoppelung:', text:' gsRefreshSubInfoCardRetry hat jetzt einen 2s-De-dupe-Guard — Popup-Close + postMessage(return) feuerten beide (harmlos, aber ~8 redundante GETs in 9s).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check + sw.js OK · Preview-Boot grün (v29.25, 0 Konsolen-Fehler): outdoor-Radio nach „Garten"-Button vorgewählt, Name „Bärlauch" prefilled, plant-name existiert + pl-name weg. Adversarialer 3-Agenten-Audit der v29.24-Fixes: alle correct (high confidence).'},
    ]
  },
  {
    v: 'v29.24', date: '15.06.2026',
    headline: '🐛 3 Fixes: Garten-Speichern · Abo-Kündigung sichtbar · API-Key-Anzeige',
    summary: 'Drei von dir gemeldete Probleme behoben. (1) Pflanzen/Gemüse/Kräuter im Garten speichern: Das Speichern war bei vollem Geräte-Speicher still fehlgeschlagen (eine ungeschützte Speicher-Operation brach den ganzen Vorgang ab) — jetzt speicherfest, plus eine klare Erfolgs-/Fehlermeldung („✅ Im Garten gespeichert"), damit du immer weisst, ob es geklappt hat. (2) Abo kündigen: Nach dem Kündigen im Stripe-Portal hat die App den neuen Status nicht angezeigt — jetzt aktualisiert sich die Abo-Karte automatisch (mit kurzem „wird verarbeitet"-Hinweis), sodass „Endet am …" + „Kündigung zurücknehmen" sofort sichtbar werden. (3) API-Schlüssel-Anzeige (nur Admin) zeigte fälschlich rotes „❌ Kein API Key" — der eigene Schlüssel ist optional, die KI läuft über den Standard-Schlüssel; jetzt ehrlich beschriftet.',
    user_summary: '🐛 Garten-Speichern wieder zuverlässig (mit Bestätigung), Abo-Kündigung wird jetzt sofort angezeigt, und die API-Schlüssel-Anzeige ist ehrlicher.',
    user_items: [
      { emoji: '🌱', text: 'Garten: Pflanzen/Gemüse/Kräuter speichern zuverlässig + klare Bestätigung' },
      { emoji: '✅', text: 'Kündigung wird sofort sichtbar („Endet am …" statt scheinbar nichts)' },
      { emoji: '🔑', text: 'Kein falscher „Kein API Key"-Fehler mehr (eigener Schlüssel ist optional)' },
    ],
    items: [
      {emoji:'🌱', bold:'Bug-3 Garten-Save (HL#10):', text:' saveGardenData nutzte raw localStorage.setItem(gs_gardens) OHNE try/catch → bei vollem Speicher (QuotaExceededError) brach die Funktion ab, plantings wurden nie persistiert + Cloud-markDirty lief nie → silent „nicht gespeichert". Fix: beide Writes quota-safe via gsStore.setJSON (wirft nicht) + unabhängig + doppel-defensiv markDirty(garden). Plus Erfolgs-/Fehler-Toast in savePlanting UND savePlant (vorher KEIN Feedback). savePlantsToStorage gibt jetzt true/false zurück.'},
      {emoji:'✅', bold:'Bug-4 Abo-Kündigung-Anzeige:', text:' Nach Stripe-Portal-Cancel rief der Popup-Close/Return nur gsLoadEntitlements() (Tier) — die Abo-Karte #abo-sub-info-host-inline wurde NIE neu gerendert → Kündigung unsichtbar. Fix: gsRefreshSubInfoCard() + Retry-Polling (0/2/5/9s) gegen Webhook-Lag, eingehängt in Popup-Close + billing=return + postMessage(result=return, vorher ignoriert). Plus „Kündigung wird verarbeitet"-Hinweis-Toast.'},
      {emoji:'🔑', bold:'Item-5 API-Key-Status:', text:' Admin-only-Row settings-api-status zeigte rotes „❌ Kein API Key" wenn kein PERSÖNLICHER ps_api_key gesetzt — Fehlalarm, denn die KI läuft über den globalen Schlüssel. Jetzt neutral „🌐 Standard-Schlüssel aktiv · eigener optional" (muted statt rot). Eigener Key bleibt optionales Power-User-Feature.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check + sw.js OK · Preview-Boot grün (v29.24, 0 Konsolen-Fehler): saveGardenData→true+persistiert, savePlantsToStorage→boolean, gsRefreshSubInfoCard rendert (946 Z. Free-Card), api-row admin-only bestätigt.'},
    ]
  },
  {
    v: 'v29.23', date: '14.06.2026',
    headline: '✅ Checkout robuster + SEO/Launch-Feinschliff',
    summary: 'Zahlungs-Checkout abgesichert: Stripe zeigt jetzt automatisch alle aktivierten Methoden (Karte immer, TWINT für CHF sobald im Dashboard aktiviert) — eine nicht-aktivierte Methode kann den Checkout nicht mehr blockieren (früher brach der ganze CHF-Checkout ab, wenn TWINT fehlte). Bei Abos wird die Karte auch während der Gratis-Testphase hinterlegt, damit die Verlängerung nahtlos läuft. Dazu Launch-Readiness-Durchsicht: Sitemap, robots.txt und die Installations-Anleitung zeigten versehentlich auf die falsche Domain (greenscan.ch statt green-scan.ch) — korrigiert; zusätzlich eine explizite Canonical-URL ergänzt, damit Suchmaschinen klar eine Adresse sehen.',
    user_summary: '✅ Bezahlen robuster: alle aktiven Zahlungsmethoden erscheinen automatisch. Plus SEO-Korrekturen für den Launch.',
    user_items: [
      { emoji: '💳', text: 'Checkout zeigt automatisch alle aktivierten Zahlungsmethoden (Karte, TWINT…)' },
      { emoji: '🔁', text: 'Abo-Karte auch im Trial hinterlegt → nahtlose Verlängerung' },
      { emoji: '🔎', text: 'Suchmaschinen-Adresse vereinheitlicht (green-scan.ch)' },
    ],
    items: [
      {emoji:'💳', bold:'Checkout:', text:' stripe-checkout v8 deployed — automatic_payment_methods statt expliziter [card,twint]-Liste. Inaktive Methode bricht Checkout nicht mehr ab; aktivierte erscheinen ohne Code-Change. payment_method_collection=always für Abos (Karte im Trial hinterlegt). Source ins Repo gespiegelt.'},
      {emoji:'🔎', bold:'SEO L-1:', text:' sitemap.xml (7×) + robots.txt + install.html (3×) nutzten falsch greenscan.ch statt canonical green-scan.ch (og:url/hreflang/Stripe). Cross-Domain-Sitemap → Google verwirft Einträge. Korrigiert. Kontakt-Mails (separate Mail-Domain) bewusst unangetastet.'},
      {emoji:'🔎', bold:'SEO L-2:', text:' explizites <link rel="canonical" href="https://green-scan.ch/"> ergänzt (vorher nur hreflang).'},
      {emoji:'🩺', bold:'Launch-Check:', text:' Manifest, SW-Precache+offline, Onboarding, Consent (revDSG), Error-Telemetrie (window error+unhandledrejection→client_errors), _headers CSP/HSTS verifiziert — alle solide. 7/7 node --check + sw.js OK.'},
    ]
  },
  {
    v: 'v29.22', date: '14.06.2026',
    headline: '⚙️ Einstellungen: „Mein Plan" in die Abo-Karte',
    summary: 'Kleiner Struktur-Feinschliff: Die Zeile „Mein Plan" (dein Tarif + heutige Frei-Kontingente) war in der Datenschutz-Gruppe versteckt — sie steht jetzt logisch in der Abo & Premium-Karte oben bei den anderen Abo-Zeilen. Ein zusammenhängender Abo-Block statt verstreut.',
    user_summary: '⚙️ „Mein Plan" steht jetzt oben bei den Abo-Einstellungen, nicht mehr versteckt unter Datenschutz.',
    user_items: [
      { emoji: '💎', text: '„Mein Plan" in die Abo & Premium-Karte verschoben' },
    ],
    items: [
      {emoji:'⚙️', bold:'SET-05:', text:' settings-myplan-row aus der Datenschutz-Gruppe in die Abo-Karte (nach der Plan-Zeile) verschoben — Abo-bezogene Einstellungen jetzt an einem Ort. Reines Verschieben (Handler unverändert). 7/7 node --check + sw.js OK. Abschluss des Settings-Audits.'},
    ]
  },
  {
    v: 'v29.21', date: '14.06.2026',
    headline: '⚙️ Einstellungen aufgeräumt + ehrlicher gemacht',
    summary: 'Settings-Voll-Audit umgesetzt: 7 Schalter, die NICHTS taten (sie schrieben in einen ungelesenen Speicher), wurden entfernt — 6 Benachrichtigungs-Toggles, die das echte Smart-Push-Panel doppelten, plus ein wirkungsloser „Sicherheits-Warnungen"-Schalter (Giftwarnung ist jetzt fest an, statt scheinbar abschaltbar). Der „Scan-Verlauf speichern"-Schalter funktioniert jetzt WIRKLICH (respektiert dein Opt-out, Datenschutz). Dazu etwas Code-Hygiene (toter API-Key-Helfer entfernt) und die zwei in v29.20 ergänzten Admin-Guards auf admin-only eingeengt.',
    user_summary: '⚙️ Einstellungen ehrlicher: tote Schalter raus, „Scan-Verlauf speichern" funktioniert jetzt echt, Giftwarnung ist fest an.',
    user_items: [
      { emoji: '🧹', text: 'Einstellungen: 7 wirkungslose Schalter entfernt (Doppel zum Smart-Push)' },
      { emoji: '🔒', text: '„Scan-Verlauf speichern" respektiert jetzt dein Opt-out (Datenschutz)' },
    ],
    items: [
      {emoji:'🧹', bold:'SET-01/04 (tote Toggles raus):', text:' Giess-Erinnerungen, Wetter-Warnungen, Marktplatz-Alerts, Community-Nachrichten, Ernte-Benachrichtigungen, Schädlings-Tipps — alle schrieben nur in userPrefs, das nirgends gelesen wird; das echte Smart-Push-Panel darunter steuert diese Kategorien real. Entfernt → keine Fake-Schalter mehr.'},
      {emoji:'🛡️', bold:'SET-02 (Sicherheit fest an):', text:' Toggle „Sicherheits-Warnungen" war wirkungslos → entfernt; Giftwarnung beim Scannen ist nicht abschaltbar (Sicherheit).'},
      {emoji:'🔒', bold:'SET-03 (Scan-Verlauf verdrahtet):', text:' „Scan-Verlauf speichern"-Toggle steuert jetzt wirklich, ob Scans gemerkt werden (gsAddScanHistory respektiert das Opt-out) — vorher tat der Schalter nichts (nDSG).'},
      {emoji:'🧼', bold:'Hygiene:', text:' leerer Schriftgrößen-Kommentar raus; toter API-Key-Helfer _gsAdminSetGlobalApiKey_legacyStub entfernt; Admin-Guards (Buch-Einlesen/KI-Kosten) auf admin-only eingeengt (deine E-2-Entscheidung). 7/7 node --check + sw.js OK.'},
    ]
  },
  {
    v: 'v29.20', date: '14.06.2026',
    headline: '🛠️ Fernando-Fixes: Kommentar-Zähler · Moderation-Löschen · Admin-Schutz',
    summary: 'Mehrere von Fernando gemeldete Fixes (6-Agenten-Audit): (1) Community-Kommentar-Button zeigt jetzt die Kommentar-Anzahl (wie bei Likes) — las das falsche DB-Feld. (2) Admin→Moderation→Löschen wirkt jetzt SOFORT + dauerhaft im Marktplatz/Feed — vorher löschte die DB korrekt, aber der lokale Cache holte das gelöschte Inserat wieder zurück. (3) „Buch hochladen" + KI-Kosten sind jetzt admin-geschützt (waren für normale Nutzer über die Suche erreichbar). (4) Globaler-API-Key-Speichern (Admin) funktioniert wieder (fehlender DB-Grant). Abo/Pro/Lifetime-Freischaltung wurde end-to-end als robust verifiziert.',
    user_summary: '🛠️ Kommentar-Anzahl wird angezeigt · gelöschte Inhalte verschwinden wirklich · Admin-Funktionen sind vor normalen Nutzern geschützt.',
    user_items: [
      { emoji: '💬', text: 'Community: Anzahl Kommentare steht jetzt am Kommentar-Button' },
      { emoji: '🗑️', text: 'Admin-Moderation: Gelöschtes verschwindet sofort + dauerhaft' },
    ],
    items: [
      {emoji:'💬', bold:'A-1/A-2 Kommentar-Zähler:', text:' renderSocialFeed las p.comment_count, das DB/View-Feld heisst comments_count (mit s) → Zähler war immer 0. Gefixt + optimistisches Hochzählen nach dem Posten.'},
      {emoji:'🗑️', bold:'B-MOD Moderation-Löschen:', text:' Backend löschte korrekt (als JWT verifiziert), aber loadMarketFromSupabase merge-te das gelöschte Inserat aus dem LS-Cache WIEDER ein → merged=cloud (saveListing schreibt seit v25.30 nur Cloud). + gsAdminModerate zieht die Quelle nach jeder Aktion frisch.'},
      {emoji:'🔐', bold:'E-1/E-3 Admin-Schutz:', text:' openBookIngest (über Schnellsuche erreichbar) + openTokenCostModal bekamen internen Admin/Mitarbeiter-Guard. Normale Nutzer erreichen sie nicht mehr.'},
      {emoji:'🔑', bold:'D5 Admin-Key-Speichern:', text:' fn_set_global_api_key fehlte der authenticated-Grant → Admin-Button war tot. Grant erteilt (RPC self-guarded; Nicht-Admin weiter abgelehnt, JWT-verifiziert).'},
      {emoji:'✅', bold:'F Abo robust:', text:' v_user_entitlements + alle FE-Gates als JWT verifiziert (comp/free/lifetime), Quota honoriert comp. Keine Fixes nötig. 7/7 node --check + sw.js OK.'},
    ]
  },
  {
    v: 'v29.19', date: '14.06.2026',
    headline: '🔒 Privacy: GPS-Track-Verlauf bei Abmeldung leeren',
    summary: 'Audit-Durchgang 2 (Wiring · Persistenz · i18n): Wiring (alle Buttons) und i18n bestätigt sauber, ein echter Privacy-Fund behoben — auf einem geteilten Gerät blieben persönliche GPS-Track-Aufzeichnungen + Community-Anzeigename nach dem Abmelden erhalten und waren für den nächsten Nutzer sichtbar. Beide werden jetzt bei Logout/Konto-Wechsel mitgelöscht.',
    user_summary: '🔒 Persönliche GPS-Tracks + Anzeigename werden beim Abmelden zuverlässig entfernt (kein Übertrag auf den nächsten Nutzer auf geteilten Geräten).',
    user_items: [
      { emoji: '🔒', text: 'GPS-Track-Verlauf + Anzeigename werden bei Abmeldung/Konto-Wechsel geleert' },
    ],
    items: [
      {emoji:'🔒', bold:'Stale-Leak-Fix:', text:' gs_gpx_tracks (persönliche GPS-Track-Historie) + gs_social_name in GS_USER_KEYS aufgenommen → gsClearUserDataKeys (Logout + User-Switch) entfernt sie. Vorher überlebten sie auf demselben Gerät zum nächsten Nutzer.'},
      {emoji:'✅', bold:'Audit-2 sonst sauber:', text:' Deterministischer app-weiter onclick-Phantom-Sweep = 0 tote/kaputte Buttons. i18n-Stichprobe (Farm-Spiel u.a.) korrekt verdrahtet (_farmT/gsI18n). Speicher-Pfade gehärtet. 7/7 node --check + sw.js OK.'},
    ]
  },
  {
    v: 'v29.18', date: '13.06.2026',
    headline: '🔧 Full-Stack-Audit: 3 stille Bugs + Datenverlust-Fix',
    summary: 'Frischer mehrdimensionaler Code-Audit (Duplikate · Bug-Risiken · Schema/Daten-Konsistenz) fand 8 bestätigte Probleme — die wichtigsten: (1) Garten-Tagebuch-Einträge wurden NIE in der Cloud gespeichert (DB-Regel verbot alle Tagebuch-Kategorien des Frontends). (2) Offline angelegte Karten-Funde wurden beim Login nie hochgeladen (fehlende User-Kennung) → verloren bei Cache-Löschen. (3) Im Farm-Spiel funktionierte kein einziger „Ressource kaufen"-Knopf. Plus: Live-GPS-Marker folgte der Position nicht, Marktplatz-Kontakt-Kopieren brach bei Sonderzeichen, Garten-Plan-Speichern zeigte bei Cloud-Fehler eine irreführende Meldung. Alle gefixt + verifiziert.',
    user_summary: '🔧 Stille Fehler behoben: Garten-Tagebuch speichert wieder, Offline-Funde gehen nicht verloren, Farm-Shop-Käufe funktionieren, Live-GPS-Marker folgt.',
    user_items: [
      { emoji: '📔', text: 'Garten-Tagebuch-Einträge werden wieder zuverlässig gespeichert' },
      { emoji: '📍', text: 'Offline angelegte Funde syncen jetzt beim Login (kein Verlust mehr)' },
      { emoji: '🛒', text: 'Farm-Shop: Ressourcen-Kauf-Buttons funktionieren wieder' },
    ],
    items: [
      {emoji:'📔', bold:'SCHEMA-01 (P1, Datenverlust):', text:' garden_diary_tag_check verbot ALLE Frontend-Tagebuch-Tags (general/pest/harvest…), DB erlaubte nur saat/pflanz/… → jeder Eintrag scheiterte silent (23514), garden_diary=0 Zeilen. Fix: CHECK auf FE-Vokabular erweitert (Migration). Als JWT verifiziert.'},
      {emoji:'📍', bold:'SCHEMA-02 (P1, Datenverlust):', text:' Offline-Funde-Nachzieh-Upload (_uploadLocalOnly) ließ user_id weg (NOT NULL + RLS) → 400 silent → Funde gingen bei Cache-Clear verloren (v27.01-Bug im Nebenpfad). Fix: user_id ergänzt.'},
      {emoji:'🛒', bold:'BUG-1 (P1) + 5 weitere:', text:' Farm-Shop buyResource JSON-in-onclick (HL#12, " → &quot;); Live-GPS-Marker gsMapRefreshUserLocation→gsSetUserMarker (HL#9-Phantom, 2 Sites); Kontakt-Kopieren via State-Bridge (HL#12); Plan-Save Cloud-Fehler ehrliche Meldung; tote Phantom-Refresh-Hooks + Kamera-Fallbacks bereinigt. 7/7 node --check + sw.js OK.'},
    ]
  },
  {
    v: 'v29.17', date: '12.06.2026',
    headline: '🛡️ Moderation: User-Archiv von Admin-Hide getrennt',
    summary: 'Feinschliff der Admin-Moderation: Bisher wurde ein vom NUTZER selbst archiviertes/verkauftes Inserat im Moderations-Feed fälschlich als „versteckt" angezeigt — und ein Admin-„Einblenden" hätte es ungewollt wieder öffentlich gemacht. Jetzt ist die Admin-Moderation (moderation_status) sauber vom Nutzer-Lebenszyklus (aktiv/archiviert/verkauft) getrennt: Admin-Verstecken blendet ein Inserat öffentlich aus (auch in der Suche, und der Nutzer kann es nicht durch Re-Aktivieren umgehen), ohne den Nutzer-Status zu verändern. User-archivierte/verkaufte Inserate zeigen ihr echtes Label und haben keinen Republish-Knopf.',
    user_summary: '🛡️ (Admin) Moderation sauberer: vom Nutzer archivierte/verkaufte Inserate werden nicht mehr als „versteckt" verwechselt.',
    user_items: [
      { emoji: '🛡️', text: '(Admin) Inserat-Verstecken getrennt von Nutzer-Archiv/Verkauf' },
    ],
    items: [
      {emoji:'🛡️', bold:'Moderation orthogonal (Migration):', text:' marketplace_listings.moderation_status getrennt vom Lifecycle-status. fn_admin_moderate Inserat-hide setzt nur moderation_status=hidden (status unberührt); Sichtbarkeit schliesst hidden aus in RLS marketplace_select_active UND fn_marketplace_search (DEFINER) → Admin-Hide öffentlich + suchunsichtbar, vom Nutzer nicht durch Re-Aktivieren umgehbar; Owner sieht eigenes weiter. fn_admin_moderation_feed zeigt Inserat-status nur als hidden bei Admin-Moderation, sonst echten Lifecycle. Als echter JWT 8/8 verifiziert.'},
      {emoji:'✅', bold:'Feed-Frontend:', text:' Admin-versteckt → „VERSTECKT" + Einblenden; user-archiviert/verkauft → neutrales Label (ARCHIVIERT/VERKAUFT/RESERVIERT) + nur Verstecken/Löschen (kein Republish). 7/7 node --check + sw.js OK.'},
    ]
  },
  {
    v: 'v29.16', date: '12.06.2026',
    headline: '💎 Pro/Lifetime-Vergabe schaltet Features zuverlässig frei',
    summary: 'Fernando-Report: „Wenn ich jemandem Pro umschalte, muss das erkannt werden und die Funktionen freischalten." Wurzel (4-Agenten-Diagnose): Admin-Tier-Vergabe UND Gutschein-Einlösung setzten nur profiles.tier — aber die Entitlement-Quelle (v_user_entitlements) gab Pro/Lifetime nur bei aktivem Stripe-Abo ODER is_lifetime frei. Folge: admin-/gutschein-vergebenes Pro/Lifetime blieb komplett funktionslos (4 reale Konten betroffen). Zusätzlich latenter Bug auch für echte Zahler entdeckt (View las profiles.tier statt des Stripe-Abo-Tiers). Fix: neuer Stripe-unabhängiger „Comp-Grant"-Pfad — Admin/Gutschein setzen comp_tier, die View schaltet damit sofort frei; echtes Stripe liest jetzt den Abo-Tier; Kündigung sperrt weiter; kein Self-Grant möglich (Spalten-Guard). Die 4 bestehenden Konten wurden migriert und haben ihre Features zurück.',
    user_summary: '💎 (Admin) Pro/Lifetime verschenken funktioniert jetzt zuverlässig — Features schalten beim Nutzer frei (Kaltstart, Vordergrund-Wechsel oder „Kauf wiederherstellen").',
    user_items: [
      { emoji: '💎', text: '(Admin) Tier-Vergabe + Gutschein schalten Pro/Lifetime-Features wirklich frei' },
      { emoji: '🔄', text: 'Frischer Tier kommt beim nächsten App-Öffnen/Vordergrund-Wechsel an' },
    ],
    items: [
      {emoji:'🔑', bold:'Comp-Grant-Pfad (Backend, Migration):', text:' profiles.comp_tier/comp_expires_at als 3., Stripe-unabhängige Entitlement-Quelle. v_user_entitlements neu: effektiver Tier = Lifetime > aktives Stripe-Abo (liest jetzt sub.tier, behebt Latent-Zahler-Bug) > gültiger Comp > free. fn_admin_set_tier + fn_redeem_voucher setzen comp_tier (free→geleert). comp_tier/_expires_at im HL#18-Guard (kein Self-Grant). Backfill der 4 gestrandeten Konten. Als echter JWT verifiziert: Admin-Grant→unlock, free→lock, Voucher→unlock, echtes Stripe→unverändert, Kündigung→free, Lifetime→voll, abgelaufener Comp→free, Self-Grant→blockiert. Server-Quota (fn_quota_peek) honoriert comp ebenfalls.'},
      {emoji:'🔄', bold:'Frontend-Zuverlässigkeit:', text:' Entitlements werden jetzt auch beim Vordergrund-Wechsel nachgeladen (vorher nur Kaltstart/Login) → frisch vergebener Tier kommt ohne Neustart an. Voucher-Tier + Pro-Gate case-insensitiv gehärtet. Admin-Tier-Toast korrigiert (comp wird NICHT von Stripe überschrieben). 7/7 node --check + sw.js OK.'},
    ]
  },
  {
    v: 'v29.15', date: '12.06.2026',
    headline: '🔧 Admin-Panel stabilisiert (Moderation · Gutscheine · Aktionen)',
    summary: 'Fernando meldete: Admin-Panel-Sektionen „Moderation", „Gutscheine" und „Letzte Admin-Aktionen" instabil/funktionieren nicht. Ursache (Backend war intakt, alles im Frontend): (1) nach jeder Aktion wurde das GANZE Panel neu aufgebaut (8 Server-Abfragen, Scroll springt hoch, Eingaben weg) → jetzt wird nur die betroffene Sektion neu geladen; (2) Admin-Sichtbarkeit hing an 3 widersprüchlichen Pfaden (mal sichtbar, mal nicht) → eine einzige Quelle (gsIsAdmin, Rolle ODER E-Mail); (3) abgelaufene Sitzung zeigte stumm leere Sektionen → jetzt klare „Sitzung abgelaufen"-Meldung; (4) Audit-Log war kryptisch (rohe Codes/UUIDs) → lesbar (Klartext + relative Zeit); (5) Gutschein-Codes mit Apostroph machten den An/Aus-Knopf unklickbar → behoben.',
    user_summary: '🔧 (Admin) Panel stabiler: Moderation/Gutscheine laden nur ihre Sektion neu, lesbares Audit-Log, klare Sitzungs-Meldung.',
    user_items: [
      { emoji: '🔧', text: '(Admin) Moderation & Gutscheine: Aktionen ohne Panel-Neuaufbau, kein Scroll-Sprung' },
      { emoji: '📜', text: '(Admin) „Letzte Admin-Aktionen" jetzt im Klartext + relative Zeit' },
    ],
    items: [
      {emoji:'🔧', bold:'Per-Sektion-Refresh:', text:' Backend (alle 6 RPCs) war als echter Admin-JWT verifiziert intakt — der Bug lag im Frontend. gsAdminModerate/CreateVoucher/ToggleVoucher riefen pauschal openAdminPanel() (8 sequentielle RPCs, Scroll-Reset, Eingabe-Verlust). Neu: _gsAdminRefreshSection() lädt nur die betroffene Sektion (Container-id), Fallback auf Voll-Render. openAdminPanel lädt die 8 Sektionen jetzt parallel (Promise.all).'},
      {emoji:'👁️', bold:'Sichtbarkeit + Session + Lesbarkeit:', text:' Admin-Sichtbarkeit auf Single-Source gsIsAdmin() (beide Login-Pfade nutzten nur E-Mail-Whitelist → Race/„mal weg"). openAdminPanel prüft jetzt _gsFreshToken → klare „Sitzung abgelaufen"-Meldung statt leerer Sektionen. Audit-Log: Action-Codes → DE-Klartext + relative Zeit + sprechende Zusammenfassung. Gutschein-Toggle via data-Attribute (Apostroph-Codes, HL#12). 7/7 node --check + sw.js OK.'},
    ]
  },
  {
    v: 'v29.14', date: '11.06.2026',
    headline: '🧠 Admin: Wissens-DB-Editor (Admin-Ausbau abgeschlossen)',
    summary: 'Admin-Ausbau (4 von 4 — fertig): Wissens-Inhalte (Heilmittel, Rezepte, Folklore, Garten-Techniken, „Wusstest-du") können jetzt direkt im Admin-Panel angelegt, bearbeitet, freigegeben/versteckt und gelöscht werden — ohne Edge-Funktion oder Bulk-Generator. Alles server-seitig admin-gesichert und audit-protokolliert. Damit ist Fernandos Admin-Ausbau („mehr sehen, einstellen, machen — unsichtbar für Nutzer") komplett.',
    user_summary: '🧠 (Admin) Neuer Wissens-Editor: Heilmittel/Rezepte/Folklore/Garten-Tipps/Fakten anlegen & freigeben.',
    user_items: [
      { emoji: '🧠', text: 'Admin-Panel: Wissens-Inhalte direkt anlegen/bearbeiten/freigeben/löschen' },
    ],
    items: [
      {emoji:'🧠', bold:'Generischer Editor:', text:' fn_admin_knowledge_list/_save/_set_published/_delete (DEFINER + is_admin_user()-Gate + audit) über eine SERVER-SEITIGE Tabellen-Whitelist (5 Wissens-Tabellen) + Spalten-Config (Text=description bzw. body, Publish=is_published bzw. is_active) mit format/%I-Quoting (kein client-gesteuerter Tabellenname). category optional (leer→NULL, CHECK-konform; ungültige Kategorie → freundlicher Fehler). Publish-Umschaltung schreibt nur die Flag (kein Text-Rewrite).'},
      {emoji:'✅', bold:'Panel-Editor + Abschluss:', text:' Tabellen-Picker + Formular (Titel/Inhalt/Kategorie-Vorschläge/Freigeben) + Liste mit Bearbeiten/Freigeben/Löschen (alles escaped). Als echter Admin/Non-Admin-JWT verifiziert (forbidden/invalid_table/invalid_category abgefangen, create/list/update/publish/delete korrekt). ⇒ ADMIN-AUSBAU 4/4 KOMPLETT (Moderation · Nutzer-Detail · Gutscheine · Wissens-Editor). 7/7 node --check + sw.js OK.'},
    ]
  },
  {
    v: 'v29.13', date: '11.06.2026',
    headline: '🎟️ Gutscheine: Pro/Lifetime verschenken + sichere Einlösung',
    summary: 'Admin-Ausbau (3 von 4): Im Admin-Panel können jetzt Gutschein-Codes erstellt werden, die Pro oder Lifetime freischalten (mit optionalem Maximal-Limit und Ablaufdatum, ein-/ausschaltbar) — ideal, um treue Early-Adopter zu belohnen. Nutzer lösen Codes über Einstellungen → „Gutschein einlösen" ein. Die Einlösung läuft komplett server-seitig: Codes werden nie an die App geliefert, Doppel-Einlösung ist ausgeschlossen, das Tier wird sofort gesetzt. (Schließt zugleich eine Sicherheitslücke aus dem letzten Audit.)',
    user_summary: '🎟️ Gutschein-Codes für Pro/Lifetime — Admin erstellt, Nutzer lösen via Einstellungen sicher ein.',
    user_items: [
      { emoji: '🎟️', text: 'Einstellungen → Abo: „Gutschein einlösen" schaltet Pro/Lifetime frei' },
      { emoji: '👑', text: '(Admin) Gutscheine erstellen/verwalten im Admin-Panel' },
    ],
    items: [
      {emoji:'🎟️', bold:'Server-sichere Einlösung:', text:' fn_redeem_voucher(code) DEFINER — validiert (aktiv/Ablauf/Limit/nicht-schon-eingelöst), schreibt Einlösung (Trigger zählt used_count, KEIN Doppel-Increment), setzt profiles.tier. Codes werden NIE an den Client geliefert (vouchers-SELECT admin-only). gsRedeemVoucher auf RPC umgestellt + Settings-Zeile „Gutschein einlösen" (i18n DE/EN/ES/FR/IT).'},
      {emoji:'👑', bold:'Admin-Verwaltung:', text:' fn_admin_create_voucher/_vouchers_list/_voucher_toggle (DEFINER, is_admin_user-gated, audit) + Panel-Sektion (Code/Tier/Limit/Tage → Erstellen, Liste mit Nutzung + An/Aus). Voller Lebenszyklus als echter JWT verifiziert (create/redeem/doppelt→already_redeemed/exhausted/toggle, used_count exakt). 7/7 node --check + sw.js OK. Admin-Ausbau 3/4 (danach Wissens-Editor).'},
    ]
  },
  {
    v: 'v29.12', date: '11.06.2026',
    headline: '👤 Admin: Nutzer-Detailansicht (Profil · Abo · Aktivität · Aktionen)',
    summary: 'Admin-Ausbau (2 von 4): Im Admin-Panel öffnet ein ℹ️-Button pro Nutzer eine Detailansicht — alles über die Person an einem Ort: Tier, Stripe-Abo-Status & Laufzeit, Level/XP/Streak, Quiz-ELO, Aktivitäts-Zähler (Scans/Funde/Posts/Inserate/Ernten/Follower) und wichtige Daten. Plus direkte Aktionen: Tier setzen/schenken (Free/Pro/Lifetime) und sperren/entsperren. Server-seitig admin-gesichert, unsichtbar für Nutzer.',
    user_summary: '👤 (Admin) Neue Nutzer-Detailansicht mit allen Infos + Tier-/Sperr-Aktionen an einem Ort.',
    user_items: [
      { emoji: '👤', text: 'Admin-Panel: ℹ️ pro Nutzer → volle Detailansicht (Abo, Aktivität) + Tier schenken/sperren' },
    ],
    items: [
      {emoji:'👤', bold:'fn_admin_user_detail(uuid):', text:' DEFINER + is_admin_user()-Gate, liefert Profil (inkl. email, Tier, Rolle, Level/XP/Streak/ELO, Daten) + neuestes Stripe-Abo (status/tier/Laufzeit/Trial/Kündigung) + Aktivitäts-Zähler (Funde/Posts/Inserate/Ernten/Follower/Following). Read-only; Aktionen via fn_admin_set_tier/fn_assign_role.'},
      {emoji:'✅', bold:'Panel:', text:' ℹ️-Button pro Nutzer-Zeile → Detail-Modal (alles escaped) mit Tier-Buttons (schenken) + Sperren/Entsperren, refresht Liste. Als echter Admin-JWT verifiziert (non-admin→forbidden, Profil+6 Counts+email, unbekannt→user_not_found). 7/7 node --check + sw.js OK. Admin-Ausbau 2/4 (danach Gutscheine, Wissens-Editor).'},
    ]
  },
  {
    v: 'v29.11', date: '11.06.2026',
    headline: '🛡️ Admin: Content-Moderation (Posts/Inserate/Kommentare)',
    summary: 'Admin-Ausbau (1 von 4): Im Admin-Panel gibt es jetzt einen Moderations-Bereich, der die neuesten Community-Posts, Marktplatz-Inserate und Kommentare zeigt — mit Verstecken/Einblenden/Löschen direkt aus der Liste. Alles server-seitig admin-gesichert (RPC mit Admin-Prüfung), audit-protokolliert und für normale Nutzer unsichtbar.',
    user_summary: '🛡️ (Admin) Neuer Moderations-Bereich: Posts/Inserate/Kommentare verstecken/löschen.',
    user_items: [
      { emoji: '🛡️', text: 'Admin-Panel: Posts, Inserate & Kommentare moderieren (verstecken/einblenden/löschen)' },
    ],
    items: [
      {emoji:'🛡️', bold:'Moderations-Sektion:', text:' fn_admin_moderation_feed (vereinheitlichter Feed über social_posts/marketplace_listings/post_comments, zeigt auch versteckte Inhalte) + fn_admin_moderate(type,id,action) — hide/unhide (Post→is_archived, Inserat→status archived/active) bzw. delete (FK-sicher: Kommentare zuerst). SECURITY DEFINER + is_admin_user()-Gate + audit_log, anon-EXECUTE entzogen. Panel-Buttons escaped + Löschen via gsConfirmModal.'},
      {emoji:'✅', bold:'Verifiziert:', text:' als echter Admin-JWT (non-admin→forbidden, Feed nur Admin, hide/unhide/delete korrekt, comment=nur-delete). 7/7 node --check + sw.js OK. Erster von 4 Admin-Ausbau-Schritten (danach Nutzer-Detailansicht, Gutschein-Verwaltung, Wissens-Editor).'},
    ]
  },
  {
    v: 'v29.10', date: '11.06.2026',
    headline: '💳 Abo-Korrektheit + Garten-Datenschutz (Sweep #2 Abschluss)',
    summary: 'Abschluss des zweiten Audits: (1) Beim Geräte-/Konto-Wechsel blieb der alte Abo-Status zwischengespeichert — der nächste (Gratis-)Nutzer auf demselben Gerät hätte kurz fälschlich Pro-Funktionen sehen können. Behoben (Abo-Cache wird bei Logout/Wechsel geleert). (2) Lifetime-Nutzer wurden in einer internen Prüfung fälschlich wie Gratis behandelt — korrigiert (Lifetime hat Vollzugang). (3) Garten/Tagebuch/Ernte konnten beim Hintergrund-Sync aus leeren Server-Tabellen lokal überschrieben werden (Datenverlust-Risiko) — jetzt durch Leer-Schutz + Zusammenführen abgesichert.',
    user_summary: '💳 Abo-Status sauber bei Konto-Wechsel + Lifetime-Vollzugang + Garten/Ernte-Datenverlust-Schutz.',
    user_items: [
      { emoji: '🔁', text: 'Abo-Status wird bei Logout/Konto-Wechsel korrekt zurückgesetzt' },
      { emoji: '🏆', text: 'Lifetime-Nutzer haben überall Vollzugang' },
      { emoji: '🛡️', text: 'Garten, Tagebuch & Ernte werden nicht mehr durch leeren Sync überschrieben' },
    ],
    items: [
      {emoji:'💳', bold:'Stale-Entitlement-Fix:', text:' gs_abo_plan + gs_ent_*-Cache überlebten Logout → nächster Free-User auf demselben Gerät sah stale Pro/Lifetime-Gates (gsIsPaid/gsAboCanUse) bis Entitlements neu luden. Jetzt in GS_USER_KEYS → bei Logout/User-Switch geleert (default free).'},
      {emoji:'🏆', bold:'Lifetime-Gating:', text:' gsAboCanUse(ai_unlimited/offline/export_pro) gab für Lifetime fälschlich false (war pl===\'pro\') → auf pro||lifetime erweitert (v_user_entitlements gibt Lifetime Vollzugang).'},
      {emoji:'🛡️', bold:'Persistenz-Härtung (PERS-12):', text:' gsGardenSync.pullAll überschrieb gardens/plantings/Tagebuch/Ernte unconditional aus leeren Row-Tabellen (live 0 Zeilen) → Empty-Guards (leere Cloud-Antwort klobbert populated local nie). gsSyncUserDataOnLogin-Ernte-Pull: Union-Merge statt blind, damit gerade angelegte, noch nicht gepushte Ernte nicht aus der UI verschwindet. ⇒ Sweep #2 (12 Funde) komplett abgearbeitet. 7/7 node --check + sw.js OK.'},
    ]
  },
  {
    v: 'v29.09', date: '11.06.2026',
    headline: '🔒 Sicherheits-Härtung: 7 XSS-Lücken + 4 Daten-Lecks geschlossen',
    summary: 'Aus einem zweiten, tiefen Sicherheits-Audit (12 bestätigte Funde, 0 Fehlalarme): Sieben Stellen renderten Nutzer-Eingaben (Profil-Avatar/-Name) ungefiltert — ein Angreifer hätte damit fremde Sitzungen kapern können. Behoben. Zusätzlich gaben vier Datenbank-Regeln zu viel preis: E-Mail-Adressen aller Nutzer, Stripe-Zahlungs-IDs, gescannte Arten anderer und Gutschein-Codes waren quer lesbar — alle jetzt streng auf den Eigentümer/Admin beschränkt. Social-Features (Profil-Suche, Feed, Verifizierungs-Badges) wurden als echter Nutzer gegengetestet und funktionieren unverändert.',
    user_summary: '🔒 Wichtige Sicherheits-Härtung: XSS-Lücken geschlossen, E-Mail-/Zahlungs-Daten nicht mehr quer lesbar.',
    user_items: [
      { emoji: '🛡️', text: '7 XSS-Lücken in Community-Feed, Kommentaren, Rangliste & Nutzerlisten geschlossen' },
      { emoji: '📧', text: 'E-Mail-Adressen, Stripe-Zahlungs-IDs & gescannte Arten sind nicht mehr für andere lesbar' },
    ],
    items: [
      {emoji:'🛡️', bold:'7 Stored-XSS-Sinks escaped:', text:' author_avatar (Community-Feed P0, Kommentare P1), display_name (Quiz-Rangliste P1) + avatar_emoji (Freunde/Suche/Discover/Admin-Liste) wurden roh in innerHTML gerendert, während Nachbarfelder bereits escaped waren. Alle via escHtml/esc geschützt. Angreifer-Input via REST-PATCH /profiles war ungeprüft → Session-Diebstahl bei jedem Betrachter.'},
      {emoji:'🔐', bold:'4 RLS-Read-Lecks (Migration):', text:' profiles (E-Mails aller User, sogar anon — P0) → SELECT nur eigene Zeile/Admin, Cross-User-Profile nur über privacy-prüfende RPCs (fn_user_search/_discover/_following_feed/_blocked_list auf SECURITY DEFINER, anon-EXECUTE entzogen). expert_verifications (Stripe-Payment-IDs P1) → sensible Spalten column-level entzogen, Badges intakt. user_species (Scan-Profile P2) + vouchers (Code-Enumeration P3) → eigentümer-/admin-only. Alle als echter authenticated-JWT verifiziert (eigene Daten lesbar, fremde 0, Social-Features intakt).'},
      {emoji:'✅', bold:'Verifiziert:', text:' 11/11 Sicherheits-Checks bestanden, 7/7 node --check + sw.js OK. Quelle: adversarial verifizierter Sweep #2.'},
    ]
  },
  {
    v: 'v29.08', date: '11.06.2026',
    headline: '🔧 Sensor-Alarme + 6 stille Funktions-Fehler behoben (Audit-Abschluss)',
    summary: 'Fix 4/4 — Abschluss des Audits: (1) Sensor-Alarme wurden wegen einer fehlenden Datenbank-Berechtigung nie in der Cloud-Historie gespeichert (jetzt per Migration behoben). (2) Sechs Stellen riefen Funktionen auf, die es gar nicht gab (Tippfehler hinter Sicherheits-Hüllen, die den Fehler still schluckten) — u.a. der Registrierungs-Dialog nach Account-Löschung, die Wetter-Aktualisierung bei Einheiten-Wechsel und ein Stats-Refresh. Alle korrigiert oder ehrlich entfernt.',
    user_summary: '🔧 Sensor-Alarm-Historie speichert wieder + 6 stille Funktions-Fehler behoben (Audit abgeschlossen).',
    user_items: [
      { emoji: '🔔', text: 'Sensor-Alarme landen wieder in der Cloud-Historie' },
      { emoji: '🔁', text: 'Re-Registrierung nach Account-Löschung öffnet jetzt korrekt das Anmelde-Fenster' },
      { emoji: '🌡️', text: 'Garten-Wetter aktualisiert sich beim Wechsel der Einheiten' },
    ],
    items: [
      {emoji:'🔔', bold:'sensor_alerts INSERT-Policy (Migration):', text:' Tabelle hatte RLS aktiv, aber keine INSERT-Policy → jeder Alarm-Log wurde silent (403) abgelehnt. Policy ergänzt (own-user, HL#6-Wrap), als authenticated-JWT verifiziert (eigene ok, fremde abgelehnt). FE war bereits korrekt.'},
      {emoji:'🧩', bold:'6 Phantom-Calls (HL#9):', text:' gsPPloadWeather→gsPPfetchWeather (Planer-Wetter), openProfileModal→openLoginModal (Re-Signup nach Account-Löschung), updateGardenWeather→loadGardenWeather + redundante Wetter-Detail-Zeile entfernt (Einheiten-Wechsel), updateStats→gsUpdateMoreStats (Arten-Stats), sysLog→console.log (Boot-Log). profileTrackPost (2×) + showReviewPrompt waren nie implementiert → tote No-Op-Aufrufe ehrlich entfernt. 7/7 node --check + sw.js OK.'},
      {emoji:'✅', bold:'Audit abgeschlossen:', text:' Alle 17 adversarial bestätigten Funde aus dem 5-Dimensionen-Sweep über v29.05–v29.08 behoben (7×P2, 10×P3). Frontend + Backend + DB konsistent.'},
    ]
  },
  {
    v: 'v29.07', date: '11.06.2026',
    headline: '💾 Stille Speicher-Fehler behoben: Ernte, Scans, Korrekturen & Votes landen jetzt in der Cloud',
    summary: 'Fix 3/4 aus dem Audit — die wichtigste Runde: Vier Speicher-Vorgänge brachen still ab (du sahst „gespeichert!", aber die Daten kamen NIE in der Cloud an): Ernte-Einträge mit Einheit „Stück/Bund", bestätigte Scans, gemeldete Scan-Korrekturen und Feedback-Stimmen. Alle vier senden jetzt das korrekte Datenformat und synchronisieren zuverlässig auf alle Geräte. (Jeder Fix wurde direkt gegen die echte Datenbank als echter Nutzer getestet.)',
    user_summary: '💾 Ernte (Stück/Bund), Scans, Scan-Korrekturen & Feedback-Stimmen werden jetzt zuverlässig gespeichert/synchronisiert.',
    user_items: [
      { emoji: '🧺', text: 'Ernte mit Einheit „Stück/Bund" synct jetzt (vorher still verloren)' },
      { emoji: '📸', text: 'Bestätigte Scans & gemeldete Korrekturen landen jetzt in der Cloud' },
      { emoji: '👍', text: 'Feedback-Stimmen werden gespeichert statt verworfen' },
    ],
    items: [
      {emoji:'🧺', bold:'garden_harvests Einheit:', text:' „Stück/Bund" verletzten den DB-CHECK (g/kg/stk/bund/ml/l) → Ernte synchronisierte nie. Anzeige-Label jetzt vom DB-Wert getrennt (gsErnteUnitDb/Label) + Normalisierung im Cloud-Sync-Chokepoint (deckt ALLE Ernte-Pfade ab, auch Pflanzen-Dossier). Legacy-Einträge robust.'},
      {emoji:'📸', bold:'user_scans + scan_corrections:', text:' addToConfirmed sendete nicht-existente Spalten (description/scanned_at) → 400; gsScanHistoryReportWrong sendete correct_name/scan_ts (existieren nicht) + liess NOT-NULL user_name weg → Korrekturen IMMER verloren trotz „Danke"-Toast. Beide auf reale Spalten + context(jsonb) umgestellt.'},
      {emoji:'👍', bold:'feedback_votes:', text:' Spalte hiess „direction" statt „dir", Wert „none" verletzte CHECK, voter_key verletzte die INSERT-Policy → Votes nie gespeichert. Jetzt dir(up/down), voter_key=auth.uid()/anon:-Präfix, DELETE bei Rücknahme. Alle 4 Fixes als echter authenticated-JWT gegen die Live-DB getestet (INSERT/UPDATE/DELETE OK). 7/7 node --check + sw.js OK.'},
    ]
  },
  {
    v: 'v29.06', date: '11.06.2026',
    headline: '🌍 Sprach-Lücken geschlossen: Menü-Profil, Wetter-Vorhersage, Update-Banner',
    summary: 'Fix 2/4 aus dem Audit: Drei Oberflächen blieben für EN/ES/FR/IT-Nutzer teilweise deutsch — die Menü-Profil-Leiste (Streak „Tage", XP-Hinweis, „Jetzt anmelden"), die 7-Tage-Wetter-Vorhersage (Wochentage, „Heute/Morgen", „Aktualisiert") und der „Neue Version"-Update-Banner. Alle drei jetzt vollständig übersetzt; die Wochentage kommen direkt aus der echten Sprach-Region (immer korrekt).',
    user_summary: '🌍 Menü-Profil, Wetter-Vorhersage & Update-Banner jetzt vollständig in allen Sprachen.',
    user_items: [
      { emoji: '📋', text: 'Menü-Profil-Leiste (Level/Streak/XP) übersetzt' },
      { emoji: '🌤️', text: 'Wetter-Vorhersage: Wochentage & „Heute/Morgen" in deiner Sprache' },
      { emoji: '🆕', text: '„Neue Version"-Banner übersetzt' },
    ],
    items: [
      {emoji:'📋', bold:'updateMenuProfileBar:', text:' Renderer lief zwar im Rerender-Set, gab aber DE-Literale aus (Tag/Tage, „Noch X XP → Lv.", „Jetzt kostenlos anmelden", Sub-Text) → über gsI18n.t geführt (6 Keys). Level-Namen bleiben bewusst DE (kohärentes Rang-System app-weit).'},
      {emoji:'🌤️', bold:'gsRenderWeatherDetail:', text:' Wochentage statt fixem DE-Array jetzt via date.toLocaleDateString mit echter Sprach-Locale (kein Seed nötig, 100% korrekt) + „Heute/Morgen" (forecast_today/tomorrow) + „Aktualisiert" über gsI18n.t; Uhrzeit-Locale dynamisch statt fix de-CH.'},
      {emoji:'🆕', bold:'SW-Update-Banner:', text:' Titel/Text/Buttons/„Sichere…" über gsI18n.t (5 Keys) — war komplett hartcodiert deutsch. 13 neue Keys nach EN/ES/FR/IT geseedet. 7/7 node --check + sw.js OK.'},
    ]
  },
  {
    v: 'v29.05', date: '11.06.2026',
    headline: '🌍 Sprachwechsel-Fix: Abo-Plan-Karte zeigt Pro/Lifetime korrekt',
    summary: 'Aus einem systematischen Mehr-Dimensionen-Audit: Beim Sprachwechsel zeigte die Abo-Karte in den Einstellungen Pro-/Lifetime-Nutzern fälschlich „Gratis-Plan" an — weil die generische Übersetzung den dynamischen Plan-Text überschrieb und nicht neu gesetzt wurde. Behoben. Zusätzlich übersetzen sich Plan-Karte und die Cloud-Sync-Status-Zeile jetzt vollständig in alle Sprachen (DE/EN/ES/FR/IT).',
    user_summary: '🌍 Abo-Karte & Sync-Status wechseln jetzt korrekt die Sprache (Pro/Lifetime wird nicht mehr als Gratis angezeigt).',
    user_items: [
      { emoji: '💎', text: 'Pro/Lifetime-Nutzer sehen nach Sprachwechsel ihren echten Plan statt „Gratis-Plan"' },
      { emoji: '🌍', text: 'Abo-Karte + Cloud-Sync-Status vollständig in DE/EN/ES/FR/IT' },
    ],
    items: [
      {emoji:'💎', bold:'Plan-Karte Sprachwechsel:', text:' gsUpdateSettingsPlanCard ist jetzt im gsI18nRerenderDynamic-Set — vorher überschrieb applyToDOM beim Sprachwechsel die dynamischen Paid-Texte mit dem statischen data-i18n-FREE-Key, ohne dass der Renderer nachlief → Pro/Lifetime erschien als „Gratis-Plan". Strings zusätzlich über gsI18n.t geführt (3 neue Keys).'},
      {emoji:'☁️', bold:'Sync-Status-Zeile:', text:' gsSyncStatusText lokalisiert (9 neue Keys) + _gsUpdateSyncStatusEl ins Rerender-Set — die Zeile „Cloud-Backup & Sync" blieb sonst nach Sprachwechsel deutsch. Alle 12 Keys nach EN/ES/FR/IT geseedet + DB-verifiziert.'},
      {emoji:'🔎', bold:'Quelle:', text:' adversarial verifizierter 5-Dimensionen-Sweep (17 Funde, 0 Falschmeldungen). Dies ist der erste von mehreren Fix-Releases. 7/7 node --check + sw.js OK.'},
    ]
  },
  {
    v: 'v29.04', date: '11.06.2026',
    headline: '🛠️ Kritischer Update-Mechanismus-Fix + Wissens-Offline-Speicher repariert',
    summary: 'Zwei Stabilitäts-Fixes: (1) KRITISCH — eine seit 9 Versionen unbemerkte Fehlerstelle im Service-Worker-Code hätte beim nächsten Update bewirkt, dass die App-Updates, der Offline-Modus und die Push-Benachrichtigungen bei allen Nutzern nicht mehr funktioniert hätten. Rechtzeitig vor dem Aufschalten gefunden und behoben. (2) Der Offline-Speicher hat Heilmittel, alte Natur-/Bauernweisheiten (Folklore) und Garten-Techniken still nie gespeichert (die Abfrage fragte nach Feldern, die es in der Datenbank nicht gibt) — jetzt korrekt verdrahtet und in der Wissens-Suche auffindbar.',
    user_summary: '🛠️ App-Updates & Offline-Modus bleiben zuverlässig + Heilmittel/Folklore/Garten-Tipps wieder offline verfügbar.',
    user_items: [
      { emoji: '🛠️', text: 'App-Updates, Offline-Modus & Push laufen weiter zuverlässig (kritischen Fehler vor dem Aufschalten abgefangen)' },
      { emoji: '📥', text: 'Heilmittel, Folklore & Garten-Techniken wieder offline verfügbar und in der Suche auffindbar' },
    ],
    items: [
      {emoji:'🛠️', bold:'Service-Worker-Syntaxfehler (kritisch):', text:' der v28.95-Changelog enthielt eine Asterisk-Slash-Sequenz, die den Block-Kommentar vorzeitig schloss → sw.js war seit 9 Versionen syntaktisch ungültig → beim nächsten Deploy hätte sich der SW bei keinem User registriert (kein Update-Banner, kein Offline-Cache, kein Push). Nur noch nicht live, weil seit vor v28.95 kein Deploy lief. Behoben; node-Syntax-Check von sw.js jetzt fester Teil des Verify (zuvor wurde nur index.html geprüft).'},
      {emoji:'📥', bold:'gsKnowledgePull Spalten-Fix:', text:' 3 Offline-Cache-Selects referenzierten nicht-existente Spalten (remedies.steps, folk_lore.description, garden_techniques.description) → PostgREST 400, von Promise.allSettled still verschluckt → diese 3 Stores cacheten nie. Fix: reale Spalten + PostgREST-Alias auf description (folk_lore.body, garden_techniques.short_desc/body), remedies.steps→preparation/dosage. Online-Render war nie betroffen (select=* + echte Feld-Reads).'},
      {emoji:'🔎', bold:'REST-Spalten-Sweep:', text:' alle 222 direkten REST-Spalten-Referenzen über 78 Tabellen gegen information_schema geprüft — exakt diese 3 waren falsch, jetzt 0. Bug-Klasse vollständig abgedeckt. 7/7 node --check + sw.js OK.'},
    ]
  },
  {
    v: 'v29.03', date: '10.06.2026',
    headline: '🌍 Sprachwechsel wirkt sofort überall + 4 Fehler behoben',
    summary: 'Wichtige Korrekturen: (1) Beim Sprachwechsel werden jetzt auch Wetter-Anzeige, Tagesgruss, Startseiten-Widgets, Quiz-Karte usw. sofort übersetzt (vorher nur Menü/Buttons — der Rest blieb bis zum Neuladen deutsch). (2) Vier Server-Funktionen, die nach internen Änderungen Fehler warfen, sind behoben — u.a. die Admin-Verwaltung, das Tagesquiz und das Lifetime-Angebot.',
    user_summary: '🌍 Sprachwechsel übersetzt jetzt sofort ALLES (Wetter/Widgets/Grüsse) + 4 Backend-Fehler behoben.',
    user_items: [
      { emoji: '🌍', text: 'Sprachwechsel wirkt sofort auch auf Wetter, Grüsse, Startseiten-Widgets' },
      { emoji: '🩹', text: 'Tagesquiz, Lifetime-Angebot & interne Verwaltung laufen wieder fehlerfrei' },
    ],
    items: [
      {emoji:'🌍', bold:'i18n-Rerender:', text:' gsHandleLangChange ruft nach setLang() neu gsI18nRerenderDynamic() — zentraler Re-Render aller 12 JS-gerenderten Renderer (Wetter inkl. Forecast/Warnung/Tipp, Grüsse, Daily-Card, Saison, Quiz-Card, Pilz-Saison, Bauernregel, Leaderboard, Top-Picks, Menü-/XP-Bar). Vorher übersetzte setLang nur [data-i18n]-DOM.'},
      {emoji:'🐛', bold:'4 RPC-Bugs (Admin-JWT-simuliert getestet):', text:' fn_admin_set_tier (profiles.stripe_customer_id existiert nicht → user_id-Pfad), fn_assign_role (GRANT authenticated fehlte → permission denied beim Rollen-Wechsel), launch_offer_available (Spalte offer_key existiert nicht), fn_get_daily_quiz (STABLE+INSERT → VOLATILE). Voll-Sweep aller 72 FE-RPCs als Admin-JWT: 0 weitere Schema-Fehler. 7/7 node --check.'},
    ]
  },
  {
    v: 'v29.02', date: '10.06.2026',
    headline: '✨ Letzter Audit-Polish: Startseite reagiert noch schneller',
    summary: 'Abschluss des grossen A-Z-Audits: Neue Marktplatz-Inserate erscheinen jetzt sofort auf der Startseite (vorher bis zu 60 Sek. Verzögerung), die Tagesinfo-Karte zeigt einen freundlichen Hinweis statt ewigem „Lade…", und das Wetter-Alert-Widget unterscheidet sauber zwischen „keine Warnungen" und „Verbindungsfehler". Damit ist jeder Punkt aus dem Voll-Audit abgearbeitet.',
    user_summary: '✨ Neue Inserate sofort auf der Startseite + sauberere Tagesinfo- und Wetter-Karten.',
    user_items: [
      { emoji: '🛒', text: 'Dein neues Inserat erscheint sofort auf der Startseite' },
      { emoji: '🌿', text: 'Tagesinfo-Karte: freundlicher Hinweis statt Dauer-„Lade…"' },
      { emoji: '⛈️', text: 'Wetter-Alerts: Verbindungsfehler wird nicht mehr als „keine Warnungen" gecacht' },
    ],
    items: [
      {emoji:'🧹', bold:'A-Z-Abschluss:', text:' HOME-11 _gsMktHomeCache-Invalidierung nach Publish-Success + Sofort-Rerender; HOME-12 _dailyFallback (2 i18n-Keys, EN/ES/FR/IT geseedet) statt silent return false; GARDEN-1 r.error-Check vor Cache (Fehl-Zustand klebte sonst die ganze TTL). HOME-10 verifiziert-verworfen (gsUpdateXPBar bedient home-* UND more-*-Widget bereits zentral, v28.39). ⇒ A-Z-Report 44/44 Findings abgearbeitet (fixed/verworfen-mit-Beleg/dokumentiert-deferred). 7/7 node --check.'},
    ]
  },
  {
    v: 'v29.01', date: '10.06.2026',
    headline: '🔑 KI & Bezahlen: keine Abmelde-Fehler mehr nach 1 Stunde',
    summary: 'A-Z-Audit-Nachzügler (WIRE-1): Sieben Funktionen (Garten-Scan, KI-Planer, Pflanzendoktor, Schädlings-/Pilz-Erkennung, Experten-Check, Verkäufer-Konto) nutzten beim Server-Aufruf den gespeicherten Anmelde-Token, ohne ihn vorher aufzufrischen. Folge: Wer die App länger als 1 Stunde offen hatte, bekam scheinbar grundlos Fehler — bis zum Neuladen. Jetzt wird der Token vor jedem dieser Aufrufe automatisch erneuert.',
    user_summary: '🔑 Kein „bitte neu laden"-Fehler mehr bei Scan/Doktor/Planer nach längerer Nutzung.',
    user_items: [
      { emoji: '🔑', text: 'Anmelde-Token wird vor KI-/Bezahl-Aufrufen automatisch erneuert' },
      { emoji: '🩹', text: 'Betrifft: Garten-Scan, KI-Planer, Pflanzendoktor, Pilz-/Schädlings-Scan, Experten-Check' },
    ],
    items: [
      {emoji:'🔧', bold:'WIRE-1:', text:' 7 Edge-Fn-Call-Sites (stripe-create-connect-account, stripe-expert-checkout, plant-doctor-diagnose, pest-identify, mushroom-identify, garden-scan-analyze, plan-iterate) von gsStore.get(gs_sb_token) auf _gsFreshToken() (v28.02-Helper mit Auto-Refresh) umgestellt — Muster identisch zu stripe-checkout/portal/marketplace-publish. Alle 7 Sites async-verifiziert (node --check fängt await-Fehler). WIRE-2 (Bearer null) durch Ursachen-Fix subsumiert. 7/7 node --check.'},
    ]
  },
  {
    v: 'v29.00', date: '10.06.2026',
    headline: '🩺 Stabilitäts-Telemetrie (interne Fehler-Überwachung)',
    summary: 'GreenScan überwacht jetzt aktiv die eigene Stabilität: Tritt bei dir ein technischer Fehler auf, wird er (anonym auf das Nötigste beschränkt, max. 5 pro Sitzung) intern gemeldet, damit wir ihn beheben können, bevor du ihn überhaupt melden musst. Für dich ändert sich nichts Sichtbares — die App wird dadurch von Version zu Version zuverlässiger.',
    user_summary: '🩺 Interne Fehler-Überwachung: Probleme werden erkannt und behoben, bevor du sie melden musst.',
    user_items: [
      { emoji: '🩺', text: 'Technische Fehler werden automatisch intern gemeldet (datensparsam)' },
    ],
    items: [
      {emoji:'🐛', bold:'Admin Schritt 3:', text:' client_errors-Tabelle (INSERT own-only, SELECT admin-only, Längen-CHECKs) + Report-Hook in persistError (max 5/Session, dedupe per Message, nur eingeloggt, fire-and-forget — nie re-thrown). fn_admin_client_errors (gruppiert message+version, Top 25, users-Count) + 🐛-Panel-Sektion. pg_cron GC 30 Tage. ⇒ Admin-Panel komplett: Metriken·Stripe·Flags·Broadcast·i18n·Errors·Audit·User(Rolle+Tier)·Storage. 7/7 node --check.'},
    ]
  },
  {
    v: 'v28.99', date: '10.06.2026',
    headline: '🛠️ Interne Verwaltung ausgebaut',
    summary: 'Weitere interne Verwaltungs-Werkzeuge für einen stabilen Betrieb (Benachrichtigungs-Verwaltung, Aktivitäts-Protokoll). Für dich als Nutzer ändert sich nichts Sichtbares.',
    user_summary: '🛠️ Interner Verwaltungs-Ausbau (nichts Sichtbares).',
    user_items: [
      { emoji: '🛠️', text: 'Stabilerer Betrieb durch bessere interne Werkzeuge' },
    ],
    items: [
      {emoji:'📣', bold:'Admin Schritt 2:', text:' send-push v2 deployed (Admin-Broadcast: profiles.role=admin server-seitig geprüft, broadcast_admin_only sonst, Cap 500 Subs, per-User-Log; anon-Negativ-Test 401 ✓) + Panel-Sektion Broadcast (gsConfirmModal-Bestätigung, Mission-Hinweis kein Spam). fn_admin_audit_recent (admin-gated, Limit 1-100) + Audit-Log-Viewer im Panel (letzte 15 Aktionen). 7/7 node --check.'},
    ]
  },
  {
    v: 'v28.98', date: '10.06.2026',
    headline: '🔒 Sicherheits-Härtung + interne Verwaltung',
    summary: 'Die Server-Konfiguration wurde härter abgeschottet (Zugriffsrechte enger gefasst) und die interne App-Verwaltung ausgebaut. Für dich als Nutzer ändert sich nichts Sichtbares — die App wird dadurch sicherer und stabiler betreut.',
    user_summary: '🔒 Sicherheits-Härtung der Server-Konfiguration (nichts Sichtbares, aber wichtig).',
    user_items: [
      { emoji: '🔒', text: 'Zugriffsrechte auf Server-Einstellungen enger gefasst' },
    ],
    items: [
      {emoji:'🛡️', bold:'P0-Fix:', text:' app_settings-SELECT-Policy von USING(true) auf 4-Key-Whitelist + flag_* (authenticated) — Secrets sind nicht mehr public-lesbar. Admin-Ausbau: fn_admin_set_tier (Tier-Vergabe + audit_log + Stripe-Warnung), Feature-Flags (fn_admin_flags_list/_set, nur flag_-Prefix), i18n-Coverage-Karte, Maintenance-Banner (flag_maintenance_banner → Live-Banner ohne Deploy, XSS-safe via textContent). Alles hinter is_admin_user, für User unsichtbar. 7/7 node --check.'},
    ]
  },
  {
    v: 'v28.97', date: '10.06.2026',
    headline: '📱 Menü mehrsprachig + intelligenterer Speicher-Sync',
    summary: 'A-Z-Voll-Audit Teil 3: Das Hauptmenü (38 Labels & Sektionen) ist jetzt mehrsprachig. Der Speicher-Sync wurde intelligenter: Region-Auswahl, Push-Vorlieben und Ernte-Jahr wandern jetzt mit aufs nächste Gerät, und ein neuer Schutz verhindert, dass ein frisch eingerichtetes Gerät deine Favoriten/Erfolge mit leeren Listen überschreibt. Im Backend wurden 3 fehlende Tabellen sauber angelegt (Analytics opt-in & Gutschein-System).',
    user_summary: '📱 Menü auf EN/ES/FR/IT + Speicher-Sync intelligenter (Region/Push-Prefs wandern mit, Favoriten-Schutz).',
    user_items: [
      { emoji: '📱', text: 'Hauptmenü komplett übersetzt (38 Labels)' },
      { emoji: '🔄', text: 'Region, Push-Vorlieben & Ernte-Jahr syncen jetzt zwischen Geräten' },
      { emoji: '🛡️', text: 'Neuer Schutz: leere Cloud-Listen überschreiben deine Daten nicht mehr' },
    ],
    items: [
      {emoji:'🛠️', bold:'A-Z Teil 3:', text:' Backend: analytics_events (INSERT own/SELECT admin, consent-gated, MAU-Quelle) + vouchers/voucher_redemptions (+used_count-Trigger) — 3 vom FE referenzierte Tabellen waren 404. Menü: 38 data-i18n-Attribute + 37 Phrasen geseedet (102+46). Persistenz: gs_region/gs_push_settings/gs_ernte_year in STATE_KEYS+Blob+Pull (gs_notif_enabled bewusst NICHT — Browser-Permission ist pro Gerät); PERS-12-Guard: leeres Cloud-Array ersetzt nie nicht-leere lokale Liste (+Repair-Push nach dirty-Clear). PERS-13/14 dokumentiert-deferred (Snapshot-/Boot-Umbau braucht eigenen Test-Sprint). 7/7 node --check.'},
    ]
  },
  {
    v: 'v28.96', date: '10.06.2026',
    headline: '🌦️ Wetter & Startseite jetzt komplett mehrsprachig',
    summary: 'A-Z-Voll-Audit Teil 2: Das Wetter (Bedingungen wie „Gewitter/Nebel/Regenschauer", Sturm-Warnungen, Garten-Tipps, Standort-Texte, Vorhersage-Tage) und die Startseite (Tagesgruss, Saison-Zeilen, Quiz-Karte, Datum) waren noch fest auf Deutsch — jetzt vollständig auf EN/ES/FR/IT. Bonus: Die Vorhersage-Wochentage waren um einen Tag verschoben (So zeigte „Mo") — behoben. Damit sind alle 1443 App-Texte in allen 5 Sprachen abgedeckt (verifiziert).',
    user_summary: '🌦️ Wetter + Startseite (Grüsse, Warnungen, Tipps, Datum) jetzt auf EN/ES/FR/IT — 1443/1443 Texte verifiziert.',
    user_items: [
      { emoji: '🌦️', text: 'Wetter-Bedingungen, Sturm-Warnungen & Garten-Tipps übersetzt' },
      { emoji: '👋', text: 'Tagesgruss, Saison-Zeilen & Datum in deiner Sprache' },
      { emoji: '📅', text: 'Vorhersage-Wochentage waren um 1 Tag verschoben — behoben' },
    ],
    items: [
      {emoji:'🔤', bold:'i18n:', text:' gsWmoText/gsWeatherDescT-Wrapper (42 WMO/Desc-Codes) + Standort/Banner/Warnungen/Garten-Tipps/Grüsse/Saison/Quiz-Karte → 76 neue Keys, EN/ES/FR/IT geseedet (256+8). Daily-Datum via toLocaleDateString(lang). BONUS-Bugfix: forecast days[getDay()] war Mo-Array mit So-Index → (getDay()+6)%7. Voll-Coverage-Verify: 1443/1443 distinkte DE-Strings (Registry 1106 Keys + 376 DOM-Phrasen) × 4 Sprachen = 0 Lücken. 7/7 node --check.'},
    ]
  },
  {
    v: 'v28.95', date: '10.06.2026',
    headline: '🌍 KRITISCH: Übersetzungen luden nur zu 2/3 — behoben',
    summary: 'A-Z-Voll-Audit Teil 1: Der Übersetzungs-Lader holte wegen eines Server-Limits nur 1000 von bis zu 1475 Übersetzungen pro Sprache — bis zu ein Drittel der App blieb für EN/ES/FR/IT-Nutzer zufällig auf Deutsch. Jetzt lädt er ALLE Übersetzungen (seitenweise). Dazu: 26 fehlende FR/IT-Übersetzungen ergänzt, Quiz-Rangliste auf der Startseite aktualisiert sich jetzt sofort nach jeder Antwort, ein toter „Lichtmessung starten"-Link im KI-Planer repariert, Wetter-Zeitzone auf Europe/Zurich korrigiert.',
    user_summary: '🌍 Sprachen laden jetzt zu 100% (vorher Server-Limit) + Start-Rangliste live + Lichtmessung-Link repariert.',
    user_items: [
      { emoji: '🌍', text: 'EN/ES/FR/IT: ALLE Übersetzungen werden geladen (vorher max. 1000)' },
      { emoji: '🏆', text: 'Quiz-Rangliste auf der Startseite aktualisiert sich sofort' },
      { emoji: '☀️', text: 'Lichtmessung-Link im KI-Planer funktioniert wieder' },
    ],
    items: [
      {emoji:'🛠️', bold:'A-Z-Audit Teil 1:', text:' loadFromDb offset-Pagination (Supabase max-rows=1000 cappte limit=2000 still → bis zu 475 Übersetzungen/Sprache fehlten zufällig); 26 lux_*/prof_*-Strings FR/IT nachgeseedet (52) → 1411/1411 Strings × 4 Sprachen voll; HOME-9 dqRefreshLeaderboards resettet _gsFilled-Guard der Home-Card; openLichtmessung→openLightMeter (HL#9-Phantom, typeof-Guard schluckte Tippfehler); timezone Europe/Berlin→Europe/Zurich (2×). Deterministische Checks: 629 onclick-Handler (1 Phantom), 68/68 RPCs ✓, 90/93 Tabellen (3 fehlende → v28.97-Backend). 7/7 node --check.'},
    ]
  },
  {
    v: 'v28.94', date: '10.06.2026',
    headline: '📊 KI-Kosten-Telemetrie (internes Monitoring)',
    summary: 'Aus der Finanz-Analyse: die KI-Aufrufe (Scan, Lina, Doktor) laufen direkt zur KI und wurden bisher nicht für die Kosten-Übersicht erfasst — das interne Cost-Monitoring war blind. Jetzt meldet jeder KI-Aufruf Tokens + berechnete Kosten ans Admin-Dashboard (fire-and-forget, kein Einfluss auf Tempo/Funktion). Keine sichtbare Änderung für dich als User.',
    user_summary: '📊 Internes KI-Kosten-Monitoring vervollständigt (kein sichtbarer App-Effekt).',
    user_items: [
      { emoji: '🛠️', text: 'Reine Backend-/Monitoring-Verbesserung — App-Verhalten unverändert' },
    ],
    items: [
      {emoji:'📊', bold:'Telemetrie:', text:' callAI/callVisionAI rufen jetzt fire-and-forget fn_log_ai_usage mit Anthropic-usage-Tokens + Modell. RPC um p_model erweitert → berechnet CHF-Kosten selbst (Preis-Tabelle als Single-Source in der DB; Haiku/Sonnet/Opus). authenticated-grant (HL#13, kein anon). Schliesst Finanz-Analyse-Befund #1 (ai_daily_usage.total_cost_chf war 0 + User-Scans loggten nicht). 7/7 node --check.'},
    ]
  },
  {
    v: 'v28.93', date: '10.06.2026',
    headline: '🔒 QA-Härtung: Einladungs-Code-Kopieren',
    summary: 'Nach adversarialer QA-Verifikation der letzten Updates: der „Code kopieren"-Button (Org-Einladung) bettete den Code direkt in den Klick-Handler ein (Hard-Lesson #12-Muster) — jetzt über sicheren State-Bridge gelöst, und die Kopier-Bestätigung ist nun ebenfalls mehrsprachig.',
    user_summary: '🔒 Org-Einladungscode-Kopieren gehärtet (HL#12) + Bestätigung mehrsprachig.',
    user_items: [
      { emoji: '📋', text: 'Code-Kopieren robuster & in allen Sprachen' },
    ],
    items: [
      {emoji:'🔒', bold:'HL#12:', text:' gsOrgInviteCreate Copy-Button → State-Bridge (window._gsPendingInviteCopy + window.gsCopyInviteCode) statt Variable im onclick-String. org_code_copied EN/ES/FR/IT geseedet. QA-Pass bestätigt: prompt-async-Konvertierungen, Quota-Wrapper, Logout-Leak-Fix, i18n-Verdrahtung (206/206 DE-Werte 4-Sprach-Coverage) alle sauber; c.id/orgId-onclick = HL#12-sanktioniertes UUID-Muster (kein Bug). 7/7 node --check.'},
    ]
  },
  {
    v: 'v28.92', date: '10.06.2026',
    headline: '🌍 Eingabe-Dialoge jetzt mehrsprachig',
    summary: 'i18n-Abschluss: Die letzten 4 user-seitigen Eingabe-Fenster (Scan-Korrektur melden, Garten-Breite im KI-Planer, Passwort zurücksetzen, Namen ändern) waren noch fest auf Deutsch — jetzt auf Englisch, Spanisch, Französisch und Italienisch. Damit ist der gesamte v28-Audit (Frontend + Backend) abgeschlossen.',
    user_summary: '🌍 Eingabe-Dialoge (Scan-Korrektur, Garten-Breite, Passwort-Reset, Namen ändern) jetzt auf EN/ES/FR/IT.',
    user_items: [
      { emoji: '✏️', text: 'Eingabe-Fenster im Scanner, Garten-Planer & Profil übersetzt' },
    ],
    items: [
      {emoji:'🔤', bold:'i18n:', text:' 9 prompt_*-Keys (Titel/Messages/Validierung von gsScanHistoryReportWrong, gsPPcanvasDone, profForgotPw, profEditName) + EN/ES/FR/IT geseedet (36 fetched). Admin/Dev-Prompts (Feedback-Triage, Sensor-Setup) bewusst DE. 7/7 node --check. ⇒ v28-Voll-Audit komplett.'},
    ]
  },
  {
    v: 'v28.91', date: '10.06.2026',
    headline: '💾 Speicher-Warnung & sauberes Abmelden',
    summary: 'Audit-Robustheit: (1) Wenn der Gerätespeicher voll ist, erscheint jetzt eine klare Warnung („Speicher voll — bitte alte Fotos/Einträge löschen") statt dass ein Speichern still fehlschlägt. (2) Beim Abmelden werden Marktplatz-Chat-Verbindung und Hintergrund-Abfragen sauber beendet (kein Daten-/Verbindungs-Leak mehr).',
    user_summary: '💾 Klare Warnung bei vollem Speicher · sauberes Beenden von Chat-Verbindungen beim Abmelden.',
    user_items: [
      { emoji: '⚠️', text: 'Bei vollem Speicher: sichtbare Warnung statt stillem Daten-Verlust' },
      { emoji: '🔌', text: 'Abmelden beendet Chat-Live-Verbindung & Hintergrund-Polling sauber' },
    ],
    items: [
      {emoji:'💾', bold:'HL#10:', text:' Globaler localStorage.setItem-Wrapper (1 Choke-Point, deckt 305+ Calls) zeigt bei QuotaExceededError einen throttled User-Toast (max 1×/60s, ts-vor-Toast → rekursionssicher). Einzel-Site-Eingriffe unnötig — Wrapper fängt bereits alle Quota-Errors ab (verifiziert).'},
      {emoji:'🔌', bold:'Leak-Fix:', text:' sbLogout stoppt jetzt _gsChat.pollId (5s-Poll) + _gsRealtimeChat.unsubscribe(). Vorher entfernte der Logout nur display:none (nicht .open-Klasse) → Poll+WS liefen mit stale Session weiter. 7/7 node --check.'},
    ]
  },
  {
    v: 'v28.90', date: '10.06.2026',
    headline: '📲 Eingabe-Dialoge iOS-PWA-sicher',
    summary: 'Audit-Härtung (Hard-Lesson #2): Die letzten 7 nativen Eingabe-Fenster (prompt()) — die auf iPhone-Apps im Standalone-Modus die ganze App einfrieren konnten — wurden durch das app-eigene, sichere Eingabe-Modal ersetzt. Betrifft u.a. Scan-Korrektur, Garten-Breite (KI-Planer), Passwort-Reset und Namen ändern.',
    user_summary: '📲 Eingabe-Fenster (Scan-Korrektur, Garten-Breite, Namen ändern …) friert iOS-App nicht mehr ein.',
    user_items: [
      { emoji: '🛡️', text: 'Keine nativen prompt()-Fenster mehr — iOS-PWA bleibt bedienbar' },
      { emoji: '✏️', text: 'Schönere, einheitliche Eingabe-Dialoge mit Abbrechen' },
    ],
    items: [
      {emoji:'🛡️', bold:'HL#2:', text:' 7 native prompt() → gsPromptModal (Promise-API + defensiver Fallback): gsScanHistoryReportWrong, gsFbMarkDone, gsPPcanvasDone, gsDevAddCloudSensor (2×), profForgotPw, profEditName. 2 SYNC-Funktionen zu async umgebaut (nur onclick-Caller, verifiziert). Dead-Code-Audit: gsTrackEvent/gsRedeemVoucher = staged Features mit Backend-Bezug → behalten; _gsAutoSyncInterval-Clear verworfen (innerer sbIsLoggedIn-Guard macht ihn benigne; naives Clear hätte Re-Login-Sync regressiert). 7/7 node --check.'},
    ]
  },
  {
    v: 'v28.89', date: '10.06.2026',
    headline: '🏢 Organisationen jetzt mehrsprachig',
    summary: 'Audit-i18n Sprint 5 (Abschluss): Das Organisationen-Modul (Org erstellen/beitreten, Einladungs-Code, Mitglieder & Rollen, Whitelabel-Bearbeitung) war noch fest auf Deutsch — jetzt vollständig auf Englisch, Spanisch, Französisch und Italienisch. Damit ist der i18n-Audit komplett.',
    user_summary: '🏢 Organisationen (Erstellen/Beitreten/Mitglieder/Branding) jetzt auf EN/ES/FR/IT.',
    user_items: [
      { emoji: '🏫', text: 'Org-Typen, Einladungs-Code & Mitglieder-Verwaltung übersetzt' },
      { emoji: '🎨', text: 'Whitelabel-Bearbeitung (Logo · Farbe · Info) & Onboarding mehrsprachig' },
    ],
    items: [
      {emoji:'🔤', bold:'i18n:', text:' Org-Modul → gemeinsamer _gsOrgT()-Helfer. 74 org_*-Keys (Org-Typen/Buttons/Toasts/Einladungs-Flow/Mitglieder/Edit/Onboarding) + EN/ES/FR/IT geseedet (276 fetched + 20 cache; HTML-Tags <b> in Onboarding-Steps verifiziert erhalten). 7/7 node --check.'},
    ]
  },
  {
    v: 'v28.88', date: '09.06.2026',
    headline: '🎓 Lehrer-Dashboard & Klassen jetzt mehrsprachig',
    summary: 'Audit-i18n Sprint 4: Das Lehrer-Dashboard (Klassen anlegen/beitreten, Klassen-Code, Aufgaben mit Auto-Fortschritt, Schüler-Fortschritt) war noch fest auf Deutsch — jetzt vollständig auf Englisch, Spanisch, Französisch und Italienisch.',
    user_summary: '🎓 Klassen & Aufgaben (Lehrer-Dashboard) jetzt auf EN/ES/FR/IT.',
    user_items: [
      { emoji: '🧑‍🏫', text: 'Klassen erstellen/beitreten, Klassen-Code & Aufgaben-Typen übersetzt' },
      { emoji: '📊', text: 'Schüler- & Klassen-Fortschritt mehrsprachig' },
    ],
    items: [
      {emoji:'🔤', bold:'i18n:', text:' Klassen-/Lehrer-Modul → gemeinsamer _gsClsT()-Helfer. 61 cls_*-Keys (Titel/Buttons/Toasts/Aufgaben-Typen/Empty-States) + EN/ES/FR/IT geseedet (240 fetched + 4 cache). 7/7 node --check.'},
    ]
  },
  {
    v: 'v28.87', date: '09.06.2026',
    headline: '🌍 Community & Profile jetzt mehrsprachig',
    summary: 'Audit-i18n Sprint 3: Der Community-Bereich (fremde Profile ansehen, Folgen/Entfolgen, Blockieren, Melden, Personen-Suche, Feed/Meilensteine-Tabs) war noch fest auf Deutsch — jetzt vollständig auf Englisch, Spanisch, Französisch und Italienisch.',
    user_summary: '🌍 Community & Profile (Folgen/Blockieren/Suche/Statistiken) jetzt auf EN/ES/FR/IT.',
    user_items: [
      { emoji: '👥', text: 'Profil-Ansicht: Statistiken, Rollen, Folgen/Entfolgen übersetzt' },
      { emoji: '🔍', text: 'Community-Hub: Feed/Meilensteine/Suche-Tabs übersetzt' },
    ],
    items: [
      {emoji:'🔤', bold:'i18n:', text:' Community-/Profil-Modul → _gsCommT()-Helfer (profile_view/community_anon wiederverwendet). 37 comm_*-Keys, EN/ES/FR/IT geseedet (144).'},
    ]
  },
  {
    v: 'v28.86', date: '09.06.2026',
    headline: '🌍 Sammlungen jetzt mehrsprachig',
    summary: 'Audit-i18n Sprint 2: Das ganze Sammlungen-Feature (eigene Ordner + automatisch sortierte System-Sammlungen wie „Giftige", „Essbare", „Pilze") war noch fest auf Deutsch — jetzt vollständig auf Englisch, Spanisch, Französisch und Italienisch, inklusive der automatischen Sammlungs-Namen.',
    user_summary: '🌍 Sammlungen (inkl. Auto-Sammlungen wie Giftige/Essbare) jetzt auf EN/ES/FR/IT.',
    user_items: [
      { emoji: '📁', text: 'Sammlungen-Übersicht, Anlegen, Einträge — alles übersetzt' },
      { emoji: '🤖', text: 'Auto-Sammlungs-Namen (Giftige→Toxic/Tóxicas, Pilze→Fungi …) übersetzt' },
    ],
    items: [
      {emoji:'🔤', bold:'i18n:', text:' Sammlungen-Modul → gemeinsamer _gsCollT()-Helfer; System-Namen via _gsCollT(coll_+system_key, dbName) beim Render (kein Schema-Eingriff). 30 Keys, EN/ES/FR/IT geseedet.'},
    ]
  },
  {
    v: 'v28.85', date: '09.06.2026',
    headline: '🌍 Verkäufer-Bereich jetzt mehrsprachig',
    summary: 'Audit-Sprint i18n: Der Marktplatz-Verkäufer-Bereich (Stripe-Connect-Onboarding mit allen Status-Anzeigen) war noch fest auf Deutsch — jetzt vollständig auf Englisch, Spanisch, Französisch und Italienisch übersetzt. Plus: im Backend wurden veraltete Tier-/Sprach-Werte bereinigt und überflüssige Tabellen-Rechte entzogen.',
    user_summary: '🌍 Marktplatz-Verkäufer-Bereich jetzt auf EN/ES/FR/IT (war nur Deutsch).',
    user_items: [
      { emoji: '🏪', text: 'Verkäufer-Onboarding (Stripe Connect) in allen 5 Sprachen' },
      { emoji: '🧹', text: 'Backend-Hygiene: veraltete Tier-/Sprach-Werte + überbreite Rechte bereinigt' },
    ],
    items: [
      {emoji:'🔤', bold:'i18n:', text:' gsMarketplaceOpenSellerScreen → _t() (21 Keys, EN/ES/FR/IT geseedet). Erster von 5 i18n-Sprints des Voll-Audits.'},
      {emoji:'🗄️', bold:'Backend (Sprint D):', text:' profiles.tier→free/pro/lifetime, org→free, gsw raus, 4 Cache-Tabellen anon/auth-Grants entzogen (alle verifiziert).'},
    ]
  },
  {
    v: 'v28.84', date: '09.06.2026',
    headline: '📱 Weitere In-App-Dialoge (Community & Garten)',
    summary: 'Audit-Sprint B fortgesetzt: Die Namens-Eingabe in der Community und die „Todesursache"-Abfrage beim Verschieben einer Pflanze auf den Friedhof nutzen jetzt In-App-Dialoge statt nativer System-Popups.',
    user_summary: '📱 Community-Namen & Pflanzen-Friedhof: In-App-Dialoge statt System-Popups.',
    user_items: [
      { emoji: '✍️', text: 'Community-Namen setzen: sauberer In-App-Dialog' },
      { emoji: '🪦', text: 'Pflanze auf Friedhof verschieben: In-App-Eingabe der Ursache' },
    ],
    items: [
      {emoji:'📱', bold:'HL#2:', text:' showNameInput + moveToCemetery prompt() → gsPromptModal. Verifiziert: api-key/org-leave-confirm waren bereits Modal-primär (kein Eingriff).'},
    ]
  },
  {
    v: 'v28.83', date: '09.06.2026',
    headline: '📱 Keine blockierenden System-Dialoge mehr',
    summary: 'Audit-Sprint B: Drei native Browser-Dialoge, die auf dem iPhone das App-Fenster einfrieren konnten, durch saubere In-App-Dialoge ersetzt — Sensor-Anbindung (iOS), Passwort-Zurücksetzen und „Cache leeren".',
    user_summary: '📱 Sensor-Setup, Passwort-Reset & Cache-Leeren nutzen jetzt In-App-Dialoge statt blockierender System-Popups.',
    user_items: [
      { emoji: '🔧', text: 'Sensor-Anbindung (iOS): In-App-Dialog statt System-Popup' },
      { emoji: '🔑', text: 'Passwort-Zurücksetzen: sauberer Eingabe-Dialog + Längen-Hinweis' },
      { emoji: '🗑️', text: '„Cache leeren": In-App-Bestätigung statt blockierendem confirm()' },
    ],
    items: [
      {emoji:'📱', bold:'HL#2:', text:' 3 vom Audit geflaggte native confirm/prompt (iOS-PWA-Webview-Blocker) → Promise-basierte gsConfirmModal/gsPromptModal. Bewusste Fallback-Branches bleiben.'},
    ]
  },
  {
    v: 'v28.82', date: '09.06.2026',
    headline: '🛠️ Voll-Audit: versteckte Live-Bugs behoben',
    summary: 'Start eines kompletten App-Audits (v28.00 bis heute). Drei reale, bisher unsichtbare Fehler behoben: (1) Beim App-Start konnte ein nativer System-Dialog (unterbrochene GPS-Aufzeichnung) das App-Fenster auf dem iPhone blockieren — jetzt In-App-Dialog. (2) Die Achievement-Vorschau in der XP-Leiste zeigte allen Nutzern fälschlich 0 Scans/Favoriten. (3) Dein Vorname fehlte an mehreren Stellen (Startseiten-Begrüssung, Marktplatz-Verkäufername, Quiz-Rangliste) — wurde aus einem leeren Speicher gelesen.',
    user_summary: '🛠️ Audit-Fixes: kein Start-Blocker mehr, korrekte Scan-/Favoriten-Zahlen, Vorname überall sichtbar.',
    user_items: [
      { emoji: '📱', text: 'Kein nativer Dialog mehr beim App-Start (iPhone-Blocker behoben)' },
      { emoji: '🎯', text: 'XP-Achievements zeigen echte Scan-/Favoriten-Zahlen' },
      { emoji: '👤', text: 'Dein Name erscheint wieder bei Begrüssung, Marktplatz & Quiz-Rangliste' },
    ],
    items: [
      {emoji:'🔍', bold:'Audit:', text:' 9-Agenten-Workflow über v28.00-v28.81, 44 verifizierte Befunde (BE+FE). Sprint A = die HIGH-Live-Bugs.'},
      {emoji:'🐛', bold:'HL#2:', text:' GPX-Recovery-confirm() feuerte 2.5s nach Boot → iOS-PWA-Blocker → gsConfirmModal.'},
      {emoji:'🔑', bold:'Tote Keys:', text:' gs_scan_count/gs_favorites + gs_profile/gs_profile_name (0 Writes) → kanonische Quellen.'},
    ]
  },
  {
    v: 'v28.81', date: '09.06.2026',
    headline: '🌍 Lichtscan & Profil jetzt auch auf EN/ES',
    summary: 'Abschluss der Sprach-Vervollständigung: Der Lichtscan (Lichtstärke-Kategorien + Pflanzen-Empfehlungen) und die Profil-Vollansicht (Statistiken, Streak, Meilensteine, Konto-Einstellungen) waren als letzte Bereiche noch fest auf Deutsch — jetzt vollständig auf Englisch und Spanisch übersetzt.',
    user_summary: '🌍 Lichtscan + Profil sind jetzt ebenfalls auf Englisch & Spanisch.',
    user_items: [
      { emoji: '💡', text: 'Lichtscan: Kategorien (Schatten/Helles Licht…) + Empfehlungen übersetzt' },
      { emoji: '👤', text: 'Profil: Statistik-Labels, Streak, Meilensteine, Konto-Einstellungen übersetzt' },
    ],
    items: [
      {emoji:'🔤', bold:'i18n-Wrap:', text:' showLuxResult + renderProfileLoggedIn/profStatBox/profOpenAvatarPicker auf _t() umgestellt. 31 neue Keys in GS_I18N_JS_STRINGS + EN/ES in i18n_translations geseedet (25 neu + 6 cache).'},
      {emoji:'🌿', bold:'Bewusst DE:', text:' Pflanzen-Eigennamen (Bogenhanf/Monstera…) = botanischer Content (wie Wissens-Daten). Logout-Toast im onclick = HL#12-Schutz.'},
    ]
  },
  {
    v: 'v28.80', date: '09.06.2026',
    headline: '🌍 Englisch & Spanisch funktionieren jetzt wirklich',
    summary: 'Bisher zeigte die App trotz Sprachwahl „English" oder „Español" praktisch alles auf Deutsch — die Übersetzungen fehlten komplett in der Datenbank, und ein Speicher-Filter blockierte Spanisch ganz. Behoben: alle ~1163 App-Texte sind jetzt auf Englisch und Spanisch übersetzt und werden für alle Nutzer sofort geladen. Wer Englisch oder Spanisch wählt, sieht die App ab jetzt vollständig in seiner Sprache.',
    user_summary: '🌍 Englisch & Spanisch sind jetzt vollständig übersetzt (waren vorher fälschlich auf Deutsch).',
    user_items: [
      { emoji: '🇬🇧', text: 'Englische Übersetzung jetzt vollständig (1163 Texte)' },
      { emoji: '🇪🇸', text: 'Spanische Übersetzung jetzt vollständig (war komplett blockiert)' },
      { emoji: '⚡', text: 'Übersetzungen laden sofort für alle — kein Warten, keine zusätzlichen Kosten' },
    ],
    items: [
      {emoji:'🔍', bold:'Befund (3 Ursachen):', text:' EN+ES zur Laufzeit komplett auf DE — (1) i18n_translations 0 en/0 es Zeilen (das DE-Set hat 1163 Strings), (2) CHECK-Constraint blockierte „es" (gsw statt es), (3) loadFromDb gab bei 0 Treffern fälschlich Erfolg → Anthropic-Fallback feuerte nie.'},
      {emoji:'🛠️', bold:'Fix:', text:' CHECK-Migration (es erlaubt) + 1163 Strings EN+ES via i18n-translate-Edge-Fn geseedet (persistent, gratis für alle) + loadFromDb: leeres Bundle → Fallback.'},
      {emoji:'📋', bold:'Hinweis:', text:' „i18n 100%" früherer Sprints meinte nur die DE-String-Abdeckung (Wrapping); die echten EN/ES-Übersetzungen fehlten. Jetzt beides.'},
    ]
  },
  {
    v: 'v28.79', date: '09.06.2026',
    headline: '🌳 3D-Planer: schwarzer Bildschirm + Nachbar-Warnung repariert',
    summary: 'Zwei echte Fehler im 3D-Garten-Planer behoben: (1) Nach mehrmaligem Öffnen/Schliessen blieb die 3D-Ansicht schwarz (der Grafik-Speicher wurde nie freigegeben) — jetzt wird die 3D-Szene beim Schliessen sauber aufgeräumt. (2) Die Warnung vor schlechten Pflanzen-Nachbarn (rotes Leuchten im 3D-Beet) funktionierte nie, weil Gross-/Kleinschreibung nicht zusammenpasste — jetzt leuchten konfliktreiche Nachbarn korrekt rot.',
    user_summary: '🌳 3D-Planer-Fixes: kein schwarzer Bildschirm mehr nach mehrmaligem Öffnen + Nachbar-Konflikt-Warnung (rotes Leuchten) funktioniert wieder.',
    user_items: [
      { emoji: '🖥️', text: '3D-Ansicht bleibt nach mehrmaligem Öffnen/Schliessen nutzbar (kein schwarzer Screen)' },
      { emoji: '🚥', text: 'Schlechte Pflanzen-Nachbarn leuchten im 3D-Beet jetzt korrekt rot' },
      { emoji: '🔋', text: 'Weniger Akku-/CPU-Last (3D-Render-Schleife stoppt beim Schliessen)' },
    ],
    items: [
      {emoji:'🔍', bold:'Verifiziert (Workflow, 5 Agenten):', text:' 3D-Planer Ph.2 war bereits gebaut — Mini-Map ✅, Companion-Glow ✅, GLB bewusst prozedural (kein Rebuild). Adversarialer Bug-Hunter fand 2 reale Bugs.'},
      {emoji:'🩹', bold:'HIGH WebGL-Leak:', text:' 3 Three.js-Szenen wurden beim Modal-Schliessen nie disposed → nach ~16× Context force-lost → schwarz. Fix: zentrale gsDispose3DScenes() in closeModal (Guard: nur wenn kein Modal offen).'},
      {emoji:'🚥', bold:'Companion-Glow Case-Bug:', text:' Query lowercased Namen, DB Title-Case, PostgREST in.() case-sensitiv → 0 Treffer. Fix: Namensfilter raus, alle ~30 Antagonisten-Paare + client-seitig matchen.'},
    ]
  },
  {
    v: 'v28.78', date: '09.06.2026',
    headline: '🎚️ Ein einheitliches Level-System überall',
    summary: 'Dein Level wurde bisher je nach Bildschirm unterschiedlich angezeigt — auf der Startseite ein anderer Name als im Menü oder Profil. Ab jetzt gibt es EINE einheitliche Level-Leiter (20 Stufen) mit denselben Namen, Symbolen und Fortschritt überall: Startseite, Menü, Profil und Rangliste stimmen endlich überein. Durch die feinere 20-Stufen-Leiter steigst du auch häufiger auf. Hinweis: Dein angezeigtes Level/dein Titel kann sich dadurch einmalig ändern.',
    user_summary: '🎚️ Einheitliche Level-Leiter (20 Stufen) — überall derselbe Level, Name & Fortschritt.',
    user_items: [
      { emoji: '🎚️', text: 'Ein Level-System für Startseite, Menü, Profil & Rangliste (20 Stufen)' },
      { emoji: '✨', text: 'Feinere Stufen = häufiger Level-Up' },
      { emoji: 'ℹ️', text: 'Einmalige Änderung deines angezeigten Levels/Titels möglich' },
    ],
    items: [
      {emoji:'🔍', bold:'Befund:', text:' 3 (real 5) divergente Level-Leitern — GS_LEVELS (10), PROFILE_XP_TABLE (20), inline LVL_NAMES (Menü) + tote gsLevelName/LVL_ICONS. Bei 600 XP: "Botaniker" (Home) ≠ "Experte" (Menü) ≠ "Botanik-Lehrling" (Profil).'},
      {emoji:'🎚️', bold:'Vereinheitlicht:', text:' GS_LEVELS = die EINE kanonische Leiter (20 Stufen, = PROFILE-Schwellen, auf denen die DB-profiles.level via fn_add_xp basiert). PROFILE_XP_TABLE/NAMES/ICONS leiten daraus ab; Menü-Bar nutzt sie; tote Leitern entfernt.'},
      {emoji:'📋', bold:'FIX-6b komplett:', text:' Phase A (Zähler-Sync v28.77) + Phase B (Leiter v28.78) = XP & Level jetzt vollständig Single-Source + cross-device.'},
    ]
  },
  {
    v: 'v28.77', date: '09.06.2026',
    headline: '⭐ XP zählt jetzt überall & geräteübergreifend',
    summary: 'Deine Erfahrungspunkte (XP) waren bisher in zwei getrennten Systemen gespeichert — manche Aktionen (Scannen, Favoriten, Wissen lesen) zählten nur lokal auf dem Gerät, andere (Quiz, Login-Serie) nur in der Cloud. Ab jetzt landet JEDE XP in einer einzigen, geräteübergreifenden Quelle: dein Fortschritt folgt dir aufs Handy/den Mac, und die Ranglisten zeigen endlich deine echten Punkte. Level-Namen/-Stufen bleiben unverändert.',
    user_summary: '⭐ Alle XP zählen jetzt zusammen & geräteübergreifend — Ranglisten zeigen deine echten Punkte.',
    user_items: [
      { emoji: '☁️', text: 'XP folgt dir über alle Geräte (Handy ↔ Mac)' },
      { emoji: '🏆', text: 'Ranglisten bekommen jetzt auch Scan-/Favoriten-/Wissens-XP' },
      { emoji: '🔒', text: 'Kein doppeltes Zählen, kein XP-Verlust mehr (auch offline verdiente XP)' },
    ],
    items: [
      {emoji:'🔍', bold:'Befund:', text:' 2 getrennte XP-Zähler (lokal gs_xp ↔ cloud profiles.xp) — gsAddXP-Gewinne (Scan/Fav/Rezept/Daily-Quiz/Licht/Wissen) erreichten Cloud + Leaderboards NIE; profileAddXp/Streak non-atomar (Lost-Update-Race).'},
      {emoji:'⚛️', bold:'Phase A — Single-Source:', text:' RPC fn_add_xp (atomarer Increment, SECURITY DEFINER, anon-revoked, HL#13) + gsAddXP spiegelt debounced in profiles.xp (max-Reconcile → kein Verlust) + profileAddXp/Streak delegieren → profiles.xp wird NUR von fn_add_xp geschrieben.'},
      {emoji:'🔁', bold:'Cross-Device:', text:' gsXpBootSync bei Boot+Login (local>cloud→push, cloud>local→pull). Doppel-Zähl-sicher verifiziert. Leiter-Vereinheitlichung folgt als Phase B.'},
    ]
  },
  {
    v: 'v28.76', date: '09.06.2026',
    headline: '🔬 KI kennt jetzt deine letzten Scans',
    summary: 'Lina (KI-Coach) und der KI-Garten-Planer beziehen jetzt wirklich deine zuletzt gescannten Arten in ihre Antworten ein. Bisher lasen beide aus einem leeren Speicher-Schlüssel und sahen deine Scans nie — die Empfehlungen werden damit treffsicherer und persönlicher.',
    user_summary: '🔬 Lina + KI-Planer berücksichtigen jetzt deine letzten Scans für bessere, persönlichere Tipps.',
    user_items: [
      { emoji: '🤖', text: 'Lina kennt deine zuletzt gescannten Arten → relevantere Antworten' },
      { emoji: '🌱', text: 'KI-Garten-Planer bezieht deine Scan-Historie in Pflanz-Vorschläge ein' },
      { emoji: '🛡️', text: 'Scan-Verlauf jetzt vom Speicher-Integritäts-Check geschützt' },
    ],
    items: [
      {emoji:'🐛', bold:'C2-1 Dual-Key-Bug:', text:' 3 Konsumenten (Lina-Kontext @27006, KI-Planer gsPPbuildUserContext @47229, Integrity-Check @1627) lasen den toten Bare-Key scan_history (NIE geschrieben) statt des kanonischen gs_scan_history/SCAN_HISTORY_KEY → KI-Kontext war immer leer.'},
      {emoji:'✅', bold:'Cloud-Sync verifiziert SOLID:', text:' gsLoadCloudScans-Merge ist union-safe (concat+dedupe per name+ts/60s, bewahrt lokales thumb) — kein Clobber/Race. Map-Funde (map_user_finds) seit v27.01 gehärtet. Audit-Verdacht „Sync-Race" = kein echter Bug.'},
      {emoji:'📋', bold:'Reihenfolge:', text:' Fernando „zuerst 1 dann 2 dann 3" → C2 ✅ · nächst FIX-6b XP-Single-Source · dann neue Feature-Welle.'},
    ]
  },
  {
    v: 'v28.75', date: '09.06.2026',
    headline: '👆 Grössere Tipp-Flächen (Handy-Bedienung)',
    summary: 'Die Zurück- und Schliessen-Knöpfe (und weitere Icon-Knöpfe) haben jetzt eine grössere Tipp-Fläche (mind. 44×44px) — leichter zu treffen auf dem Handy, gemäss Barrierefreiheits-Standard. Die Symbole selbst bleiben gleich gross.',
    user_summary: '👆 Zurück-/Schliessen-Knöpfe sind jetzt leichter antippbar (grössere Tipp-Fläche).',
    user_items: [
      { emoji: '👆', text: 'Zurück- + Schliessen-Knöpfe: Tipp-Fläche min. 44×44px (WCAG 2.5.5)' },
      { emoji: '🎯', text: 'Weniger Fehl-Taps auf dem Handy — Symbol-Grösse unverändert' },
    ],
    items: [
      {emoji:'🔧', bold:'Smart-Fix:', text:' EINE CSS-Regel (min-width/min-height:44px) für .modal-close-btn (64×) + button[aria-label=Zurück/Schliessen] statt 20+ inline-Edits. Kein Layout-Bruch (close=absolute, back=Header-Flex).'},
      {emoji:'📋', bold:'Reihenfolge:', text:' 3 Perf ✅ · 2 Tap-Targets ✅ · nächst 1 = Lina Cross-Device-Gedächtnis (C3).'},
    ]
  },
  {
    v: 'v28.73', date: '09.06.2026',
    headline: '📜 Foto-Wachstums-Verlauf sichtbar',
    summary: 'Deine KI-Wachstums-Analysen (Vorher/Nachher-Fotovergleich) wurden bisher gespeichert, aber nie wieder angezeigt. Jetzt siehst du im Foto-Verlauf (Vergleichs-Modus) eine Liste deiner früheren Analysen mit Zeitraum, Wachstums-% und Kurz-Zusammenfassung.',
    user_summary: '📜 Frühere Foto-Wachstums-Analysen werden jetzt im Foto-Verlauf angezeigt.',
    user_items: [
      { emoji: '📜', text: 'Foto-Verlauf zeigt deine früheren KI-Analysen (Zeitraum, Wachstum-%, Zusammenfassung)' },
      { emoji: '🔄', text: 'Aktualisiert sich automatisch nach einer neuen Analyse' },
    ],
    items: [
      {emoji:'🔧', bold:'gsPhotoDiffLoadHistory:', text:' ruft die bestehende, auth-gesicherte fn_photo_diff_list (own-only) — war write-only (nur create wurde aufgerufen). Frontend-only, kein Backend.'},
      {emoji:'🧪', bold:'HL#14:', text:' fn_photo_diff_list existiert doch (mein früherer "fehlt"-Schluss war ein Query-Artefakt). Q2 (Doktor-Sync) = Falschalarm — synct bereits via State-Blob.'},
    ]
  },
  {
    v: 'v28.72', date: '09.06.2026',
    headline: '🧹 Code-Hygiene (Audit-Aufräumen)',
    summary: 'Kleine interne Aufräumarbeiten aus dem Full-Stack-Audit: ein toter, doppelt definierter Experten-Check wurde entfernt und eine Fehlermeldung sauber abgesichert. Für Nutzer unsichtbar, reine Wartbarkeit.',
    user_summary: '🧹 Internes Code-Aufräumen — keine sichtbare Änderung.',
    user_items: [
      { emoji: '🧹', text: 'Toter doppelter Experten-Check entfernt (HL#9)' },
      { emoji: '🛡️', text: 'Fehlermeldung in der Anzeige abgesichert (escape)' },
    ],
    items: [
      {emoji:'🗑️', bold:'B1:', text:' tote gsIsExpert-Cache-Version (geshadowt von gsRoleAtLeast-Variante) entfernt → gsIsExpert eindeutig. Helfer bleiben (harmlose Orphans).'},
      {emoji:'🛡️', bold:'B9:', text:' Error-Message in innerHTML mit escHtml() geescapt.'},
      {emoji:'⏭️', bold:'Bewusst deferred:', text:' B7 CSP unsafe-eval (braucht Browser-Test wg. pdf.js, near-zero Gewinn) · B8 Tap-Targets (eigener UX-Pass).'},
    ]
  },
  {
    v: 'v28.71', date: '09.06.2026',
    headline: '🛡️ Frontend-Härtung (Defense-in-Depth)',
    summary: 'Zweite Umsetzung aus dem Full-Stack-Audit: drei kleine Sicherheits-Härtungen im Frontend (Foto-Anzeige, Pflanzen-Karten, Sammlungs-Knöpfe) + ein Speicher-Schutz im Ernte-Tracker. Reine Vorsichtsmassnahmen — kein bekanntes Leck, aber strukturell sauber.',
    user_summary: '🛡️ Kleine interne Sicherheits- und Stabilitäts-Härtungen (unsichtbar).',
    user_items: [
      { emoji: '🛡️', text: 'Foto-Anzeige + Knöpfe gegen mögliche Einschleusung gehärtet (Defense-in-Depth)' },
      { emoji: '💾', text: 'Ernte-Tracker fängt vollen Speicher sauber ab' },
    ],
    items: [
      {emoji:'🔧', bold:'A3 (XSS-Best-Practice):', text:' gsNewPlantCard p.photo CSS-url() Scheme-Validierung + breaking-chars raus; p.id/it.id/collection-id in onclick auf [a-zA-Z0-9_-] begrenzt (HL#12-Klasse). Real-Exploit gering (Server-UUIDs/eigene Daten).'},
      {emoji:'💾', bold:'A4 (HL#10):', text:' gsErnteSetYear localStorage.setItem in try/catch.'},
      {emoji:'📋', bold:'Block-G:', text:' A1 ✅ A3/A4 ✅ → v28.72 Hygiene (gsIsExpert-Dead-Code, CSP unsafe-eval, Tap-Targets).'},
    ]
  },
  {
    v: 'v28.70', date: '09.06.2026',
    headline: '🔒 Datenschutz: Feedback-Feed ohne E-Mail-Preisgabe',
    summary: 'Erste Umsetzung aus dem Full-Stack-Audit: Der Community-Feedback-Feed war bisher für alle (auch nicht-eingeloggt) inkl. der E-Mail-Adresse des Verfassers lesbar. Jetzt zeigt der Feed nur noch einen maskierten Nick — keine E-Mail mehr nach aussen. Schweizer Datenschutz (nDSG) sauber. Der Feed bleibt für alle sichtbar.',
    user_summary: '🔒 Community-Feedback zeigt keine E-Mail-Adressen mehr nach aussen (nDSG).',
    user_items: [
      { emoji: '🔒', text: 'Feedback-Feed: nur maskierter Nick statt E-Mail (auch für nicht-eingeloggte)' },
      { emoji: '🛡️', text: 'Experten-Verifikationen nicht mehr ohne Login lesbar (Badges bleiben)' },
    ],
    items: [
      {emoji:'🔧', bold:'PII-Masking-View:', text:' v_feedback_public (security_definer) entfernt author_email aus context + liefert server-seitigen author_nick. Basis-Tabelle SELECT → Owner+Staff. Frontend liest die View.'},
      {emoji:'🧪', bold:'HL#14 ×3:', text:' author_email steckt im context-jsonb (nicht Spalte); garden_harvests-„Orphans" = Falschalarm (v28.15-by-design, Test-Daten) → NICHT gelöscht. Verifikation verhinderte Datenverlust.'},
      {emoji:'📋', bold:'Block-G-Roadmap:', text:' A1 ✅ → v28.71 Frontend-Härtung (XSS-data-attr + setItem) → v28.72 Hygiene (gsIsExpert/CSP/Tap-Targets).'},
    ]
  },
  {
    v: 'v28.69', date: '09.06.2026',
    headline: '⚡ Quick-Wins: Admin-Suche + Key-Test-Schutz',
    summary: 'Zwei kleine, gezielte Verbesserungen: Im Admin-Panel kann man Nutzer jetzt durchsuchen (Name, E-Mail, Rolle), und der Anthropic-Key-Test hat eine kurze Wartezeit bekommen, damit das API-Kontingent nicht versehentlich durch wiederholtes Testen verbraucht wird. Beides nur für Admins.',
    user_summary: '⚡ Admin-Panel: Nutzer-Suche + Schutz des API-Kontingents beim Key-Test (nur Admins).',
    user_items: [
      { emoji: '🔍', text: 'Admin-Panel: Nutzer-Suchfeld (Name/E-Mail/Rolle), client-seitig — skaliert auf viele Nutzer' },
      { emoji: '⏱️', text: 'Key-Test: 10s-Cooldown schützt das Anthropic-API-Kontingent (Mission: Kostendeckung)' },
    ],
    items: [
      {emoji:'🧪', bold:'HL#14 erneut:', text:' Audit-„Quick-Wins" Q1/Q2/Q6 waren ungenau (fn_photo_diff_list/fn_plant_diagnoses_for_plant existieren NICHT; _gsSanitizeGardenPlan-Shape-Mismatch) → nur die echt-sauberen Q3/Q4 umgesetzt.'},
      {emoji:'⏭️', bold:'Deferred:', text:' Q1 Foto-Diff-Verlauf + Q2 Doktor-LS-Cross-Device brauchen direkte Tabellen-Query-Integration (own-only RLS vorhanden) — eigene Version.'},
    ]
  },
  {
    v: 'v28.68', date: '09.06.2026',
    headline: '🧹 Toten Admin-DB-Editor entfernt (Code-Hygiene)',
    summary: 'Aufräum-Release: der alte, seit langem unerreichbare Admin-Arten-Editor (ein verstecktes Doppel-Panel) wurde ersatzlos entfernt — 353 Zeilen toter Code raus. Keine Funktion geht verloren: das aktive Admin-Dashboard (Metriken, Stripe, Rollen — seit v28.67 erreichbar) bleibt vollständig. Reine Wartbarkeit, für Nutzer unsichtbar.',
    user_summary: '🧹 Internes Code-Aufräumen — toter Admin-Editor entfernt, keine sichtbare Änderung.',
    user_items: [
      { emoji: '🧹', text: 'Toter, doppelter Admin-Arten-Editor ersatzlos entfernt (353 Zeilen)' },
      { emoji: '✅', text: 'Aktives Admin-Dashboard (Metriken/Stripe/Rollen) unverändert nutzbar' },
    ],
    items: [
      {emoji:'🗑️', bold:'Entfernt:', text:' openAdminPanel @55979 (shadowed) + closeAdminPanel + 19 adm*-Funktionen + admin-panel-modal-HTML + adm-* CSS.'},
      {emoji:'🛡️', bold:'Sicher gelöscht:', text:' Reference-Mapping vorab — 0 externe Aufrufer. Passwort-Login (toggleAdminMode/openAdminLogin/doAdminLogin) + checkAdminMode (Farm) bleiben. openAdminPanel jetzt eindeutig (1 Definition).'},
      {emoji:'📋', bold:'Block F:', text:' F.1 Audit + F.2 + F.3 + Cleanup ✅ → nächst Quick-Wins (Foto-Diff-Verlauf, Doktor-Sync, Admin-Suche) dann Block G/H.'},
    ]
  },
  {
    v: 'v28.67', date: '09.06.2026',
    headline: '👑 Admin-Dashboard erreichbar + 2 Härtungen',
    summary: 'Beim Aufräumen entdeckt: das Admin-Dashboard (Live-Metriken + Stripe-Übersicht + Rollenverwaltung) hatte gar keinen Knopf zum Öffnen — jetzt gibt es eine eigene Zeile in den Einstellungen (nur für Admins). Plus: der Backup-Import-Dialog nutzt jetzt den App-eigenen Bestätigungs-Dialog (statt des nativen, der in der iOS-App hängen blieb), und das Speichern des Server-Keys fängt vollen Speicher sauber ab.',
    user_summary: '👑 Admin-Dashboard ist jetzt aus den Einstellungen erreichbar (nur Admins) + 2 Stabilitäts-Fixes.',
    user_items: [
      { emoji: '👑', text: 'Neue Einstellungs-Zeile „Admin-Dashboard" → Metriken + Stripe + Rollen' },
      { emoji: '📥', text: 'Backup-Import-Bestätigung iOS-PWA-sicher (gsConfirmModal statt confirm)' },
      { emoji: '💾', text: 'Server-Key-Speichern fängt vollen Speicher mit klarer Meldung ab' },
    ],
    items: [
      {emoji:'🔎', bold:'Cleanup-Fund:', text:' openAdminPanel-Panel (v28.64/65 Metriken+Stripe) war ohne Entry unerreichbar → admin-only-row ergänzt. DB-Editor @55979 (shadowed/tot) → Löschung in v28.68.'},
      {emoji:'🛡️', bold:'HL#2 + HL#10:', text:' importUserData confirm→gsConfirmModal (async onload); gsAdminSaveSbKey setItem in try/catch.'},
      {emoji:'📋', bold:'Bewusst gelassen:', text:' gsIsAdmin-Stub @61490 ist dokumentierte Forward-Declaration — Löschen wäre Risiko für Kosmetik.'},
    ]
  },
  {
    v: 'v28.66', date: '09.06.2026',
    headline: '🪴 Garten-Pläne jetzt in Sammlungen (Block F.3)',
    summary: 'Deine Garten-Pläne (aus dem KI-Planer, Waldgarten und Balkon-Wizard) landen jetzt automatisch in der Sammlung „🪴 Garten-Pläne" — und du kannst sie von dort mit einem Tippen wieder öffnen. Damit sind Pläne genauso auffindbar wie Pflanzen, Arten und Funde.',
    user_summary: '🪴 Garten-Pläne erscheinen automatisch in deinen Sammlungen — antippen öffnet sie wieder.',
    user_items: [
      { emoji: '🪴', text: 'Neue Auto-Sammlung „Garten-Pläne" — KI-Planer + Waldgarten + Balkon-Pläne' },
      { emoji: '👆', text: 'Sammlungs-Einträge sind jetzt antippbar → Plan/Art direkt öffnen' },
      { emoji: '🔄', text: 'Hält sich automatisch aktuell (neuer Plan rein, gelöschter raus)' },
    ],
    items: [
      {emoji:'🔧', bold:'item_type=plan (HL#14):', text:' CHECK-Constraint vor Code geprüft + erweitert (sonst INSERT 400). 9. System-Sammlung sys_plans, Vacuum-Test rule.test(sp,it).'},
      {emoji:'🌱', bold:'1 Eingriff, 3 Tools:', text:' Auto-Trigger im geteilten _gsSaveGardenPlanCloud → KI-Planer + Forest + Balkon profitieren gemeinsam. Manuelle Sammlungen unberührt.'},
      {emoji:'📋', bold:'Block F:', text:' F.1 Audit + F.2 Metriken+Stripe + F.3 Plan-Sammlungen ✅ → nächst Cleanup (DB-Editor löschen).'},
    ]
  },
  {
    v: 'v28.65', date: '09.06.2026',
    headline: '💳 Admin-Stripe-Übersicht (Block F.2)',
    summary: 'Internes Finanz-Monitoring im Admin-Panel: MRR, aktive Abos, Pro-/Lifetime-Zahlen, Preis-Katalog und Webhook-Health auf einen Blick. Damit lässt sich die Kostendeckung direkt in der App im Auge behalten. Rein intern, nur für Admins — keine Verkaufs-Elemente.',
    user_summary: '💳 Admin-Panel zeigt jetzt eine Stripe-Finanz-Übersicht (nur für Admins).',
    user_items: [
      { emoji: '💰', text: 'MRR + ARR, aktive Abos, Pro-/Lifetime-Zahlen, Preis-Katalog' },
      { emoji: '🔔', text: 'Webhook-Health (Fehler/unverarbeitet/letzte Events)' },
      { emoji: '🌱', text: 'Mission-konform: internes Monitoring, kein Sales-UI' },
    ],
    items: [
      {emoji:'🔧', bold:'RPC fn_admin_stripe_overview:', text:' SECURITY DEFINER + is_admin_user()-Gate, REVOKE PUBLIC/anon + GRANT authenticated (HL#13).'},
      {emoji:'🧪', bold:'MRR robust (HL#14):', text:' direkt aus stripe_subscriptions JOIN stripe_prices (v_admin_subscriptions ist leer); monatlich=as-is, jährlich/12, lifetime=0, nur active. Webhook-Tabelle leer → ehrlicher Hinweis statt fake-Daten.'},
      {emoji:'📋', bold:'Block F:', text:' F.2 Metriken ✅ Stripe ✅ → nächst F.3 Plan-Sammlungen → Cleanup.'},
    ]
  },
  {
    v: 'v28.64', date: '09.06.2026',
    headline: '📊 Admin-Live-Metriken (Block F.2 Start)',
    summary: 'Start des grossen App-Verwaltung-Updates: das Admin-Panel zeigt jetzt oben eine Live-Metriken-Sektion mit Echtzeit-Kennzahlen (User-Zahl, aktive Nutzer, Tier-Verteilung Free/Pro/Lifetime, Scan-Volumen, aktive Abos, Webhook-Fehler). Reines internes Monitoring — nur für Admins sichtbar.',
    user_summary: '📊 Admin-Panel hat jetzt Live-Metriken (nur für Admins).',
    user_items: [
      { emoji: '📊', text: 'Live-Metriken: User-Zahl, aktive Nutzer, Tiers, Scans, Abos, Webhook-Fehler' },
      { emoji: '🔒', text: 'Nur für Admins — server-seitig abgesichert (is_admin_user-Gate)' },
    ],
    items: [
      {emoji:'🔧', bold:'RPC fn_admin_metrics:', text:' SECURITY DEFINER + interner is_admin_user()-Gate, REVOKE FROM PUBLIC/anon + GRANT authenticated (HL#13).'},
      {emoji:'🧪', bold:'Schema-ehrlich (HL#14):', text:' scan_events leer → user_scans; last_login NULL → updated_at/Scan-Aktivität; Error-Rate aus scan_events weggelassen (fake-0) → echtes Webhook-Fehler-Signal.'},
      {emoji:'📋', bold:'Block F nach F.1-Audit:', text:' Reihenfolge F.2 Metriken → F.2 Stripe-Tab → F.3 Plan-Sammlungen → Cleanup (DB-Editor löschen).'},
    ]
  },
  {
    v: 'v28.63', date: '09.06.2026',
    headline: '🎮 BlattFänger jetzt mehrsprachig + Admin-Editor-Fix',
    summary: 'Abschluss der App-weiten Übersetzung: das BlattFänger-Garten-Spiel (Felder, Tiere, Gebäude, Shop, Quests, Pflanzen-Namen, Level) wird jetzt komplett mit der Sprache mit-übersetzt. Damit ist die gesamte i18n-Übersetzungs-Roadmap zu 100% durch. Zusätzlich ein über die automatische Code-Prüfung gefundener Bug behoben: die ✏️/🗑️-Knöpfe im Admin-Arten-Editor funktionierten nicht.',
    user_summary: '🎮 Das BlattFänger-Spiel ist jetzt mehrsprachig — die App-weite Übersetzung ist komplett.',
    user_items: [
      { emoji: '🌾', text: 'BlattFänger: Felder, Tiere, Gebäude, Shop, Quests & Pflanzennamen mehrsprachig' },
      { emoji: '🏆', text: 'Level-Namen (Anfänger → Grandmaster) & alle Spiel-Meldungen mehrsprachig' },
      { emoji: '🤖', text: 'EN/FR/IT/ES automatisch via Übersetzungs-Edge-Fn' },
      { emoji: '🔧', text: 'Bugfix: Admin-Arten-Editor Bearbeiten/Löschen-Knöpfe wieder funktionsfähig' },
    ],
    items: [
      {emoji:'🔧', bold:'104 neue Keys:', text:' BlattFänger in 3 Schichten — statisches HTML (12 data-i18n) + dynamische UI (~45 _farmT) + Daten-Objekte (52 via zentrale Helfer).'},
      {emoji:'🐛', bold:'Hard-Lesson #12:', text:' admBuildForm onclick-Escapes ergaben literalen Text statt idx → ReferenceError beim Klick; auf echte Konkatenation gefixt (app-weiter grep: nur 2 Instanzen).'},
      {emoji:'✅', bold:'i18n-Roadmap KOMPLETT:', text:' A+D+C+E+F+B+G+I+H — alle 9 Batches durch. Adversarial via Workflow verifiziert.'},
    ]
  },
  {
    v: 'v28.62', date: '09.06.2026',
    headline: '🌍 Feedback, Hilfe & Lina jetzt mehrsprachig — Übersetzung komplett',
    summary: 'Letzter Teil der grossen Vollübersetzung (Batch I, Teil 3/3): Der Community-Feedback-Bereich, die Hilfe-Seite (FAQ + Notfall-Kontakte) und Lina, dein Garten-Coach, werden jetzt mit der Sprache mit-übersetzt. Damit ist die App-weite Übersetzung abgeschlossen — bei EN/FR/IT/ES wird automatisch alles mitübersetzt.',
    user_summary: '🌍 Feedback-Feed, Hilfe-Seite und Lina sind jetzt mehrsprachig — die Übersetzung ist komplett.',
    user_items: [
      { emoji: '💬', text: 'Community-Feedback: Status-Badges, Statistik-Kacheln, Lade-/Leer-Zustände mehrsprachig' },
      { emoji: '🆘', text: 'Hilfe: alle 6 FAQ + Notfall-Kontakte (144/145/112) mehrsprachig' },
      { emoji: '🌿', text: 'Lina (Garten-Coach): Begrüssung, Eingabe & Hinweise mehrsprachig — bleibt gratis' },
      { emoji: '🤖', text: 'EN/FR/IT/ES automatisch via Übersetzungs-Edge-Fn' },
    ],
    items: [
      {emoji:'🔧', bold:'53 neue Keys:', text:' gsNlRenderPhotos + gsLinaRender/gsLinaSend + renderFeedback + renderSupport/updateApiBanner/updateApiHelp auf gsI18n.t.'},
      {emoji:'🌱', bold:'Mission-konform:', text:' Lina-Quota-Text bleibt ohne Verkaufspitch — nur warme Info.'},
      {emoji:'✅', bold:'398-String-Audit DURCH:', text:' A+D+C+E+F+B+G+I komplett — offen nur noch H_Farm (4 Mini).'},
    ]
  },
  {
    v: 'v28.61', date: '09.06.2026',
    headline: '🌍 Wetter-Detail & Mondkalender jetzt mehrsprachig',
    summary: 'Weiter mit der Vollübersetzung (Batch I, Teil 2/3): Die Wetter-Detailansicht (Garten-Wettertipps, Frost-/Gewitter-/Sturm-Warnungen, Stundenvorhersage), der Mondkalender (14-Tage-Übersicht, Mondtypen) und das Wetter-Warnungen-Panel werden jetzt mit der Sprache mit-übersetzt. Bei EN/FR/IT/ES automatisch.',
    user_summary: '🌍 Wetter-Detail, Mondkalender und Wetter-Warnungen sind jetzt mehrsprachig.',
    user_items: [
      { emoji: '🌤️', text: 'Wetter-Detail: Garten-Tipps + Frost/Gewitter/Sturm-Warnungen mehrsprachig' },
      { emoji: '🌙', text: 'Mondkalender (14 Tage) + Wetter-Warnungen mehrsprachig' },
      { emoji: '🤖', text: 'EN/FR/IT/ES automatisch via Übersetzungs-Edge-Fn' },
    ],
    items: [
      {emoji:'🔧', bold:'28 neue Keys:', text:' openWeatherDetail/gsRenderWeatherDetail + renderMoonWidget/openMoonCalendar + gsWxRender auf gsI18n.t.'},
      {emoji:'♻️', bold:'4 reuse:', text:' unit_days/modal_close/time_vor (moon_today war belegt → moon_widget_today).'},
      {emoji:'📋', bold:'Batch I 2/3:', text:' Profil-Auth ✅ Wetter+Mond ✅ — offen I-3 (Feedback/Support/Lina).'},
    ]
  },
  {
    v: 'v28.60', date: '08.06.2026',
    headline: '🌍 Anmelden & Registrieren jetzt mehrsprachig',
    summary: 'Weiter mit der Vollübersetzung (Batch I, Teil 1/3): Der komplette Anmelde-, Registrierungs- und Passwort-vergessen-Ablauf — inkl. aller Eingabefelder, Knöpfe, Fehlermeldungen und der Bestätigungs-Mail-Anleitung — wird jetzt mit der Sprache mit-übersetzt. Bei EN/FR/IT/ES automatisch.',
    user_summary: '🌍 Login, Registrierung & Passwort-Reset sind jetzt mehrsprachig.',
    user_items: [
      { emoji: '🔑', text: 'Anmelden/Registrieren: Felder, Knöpfe, Fehler, Datenschutz-Hinweis mehrsprachig' },
      { emoji: '📧', text: 'Bestätigungs-Mail-Anleitung + Passwort-Reset mehrsprachig' },
      { emoji: '🤖', text: 'EN/FR/IT/ES automatisch via Übersetzungs-Edge-Fn' },
    ],
    items: [
      {emoji:'🔧', bold:'~40 neue Keys:', text:' renderProfileLogin + profileDoLogin/Register/ForgotPw — inkl. dynamischer Button-Reverts (sonst Revert auf DE nach Fehler).'},
      {emoji:'🧩', bold:'Batch I gesplittet:', text:' I-1 Profil-Auth ✅ — I-2 Wetter+Mond, I-3 Feedback+Support+Lina folgen.'},
      {emoji:'📋', bold:'Deferred:', text:' renderProfileLoggedIn (Vollprofil, war nicht im Audit) als eigener Schritt.'},
    ]
  },
  {
    v: 'v28.59', date: '08.06.2026',
    headline: '🕘 Scan-Verlauf jetzt direkt im Scanner',
    summary: 'Der Scan-Verlauf war bisher nur im „Mehr"-Menü versteckt — jetzt erreichst du ihn mit einem Tipp direkt oben im Scanner (🕘-Knopf), wo er hingehört. Ausserdem zeigt die App nur noch EINE einheitliche Verlaufs-Ansicht (mit Suche, Filter, Statistik & Cloud-Sync) statt zwei verschiedener.',
    user_summary: '🕘 Scan-Verlauf jetzt direkt vom Scanner erreichbar — eine einheitliche Ansicht.',
    user_items: [
      { emoji: '🕘', text: 'Neuer Verlauf-Knopf oben im Scanner' },
      { emoji: '🔎', text: 'Eine Ansicht mit Suche, Filter, Statistik & ☁️-Sync' },
    ],
    items: [
      {emoji:'📷', bold:'Scanner-Top-Bar:', text:' 🕘-Button → openScanHistoryFull direkt vom Kamera-Screen (Mehr-Menü-Eintrag bleibt).'},
      {emoji:'🧹', bold:'Dedup:', text:' alte einfache openScanHistory → 1-Zeilen-Alias auf die reiche openScanHistoryFull (alle Aufrufer teilen eine View).'},
      {emoji:'☁️', bold:'Sync gerettet:', text:' Cloud-Sync-Button aus der alten View in die reiche Stats-Bar übernommen (kein Feature-Verlust).'},
    ]
  },
  {
    v: 'v28.58', date: '08.06.2026',
    headline: '🗂️ Automatische Sammlungen — sortieren sich selbst',
    summary: 'Neu: GreenScan legt automatisch 8 clevere Sammlungen für dich an und hält sie immer aktuell — Giftige, Essbare, Heilpflanzen, Geschützte, Pilze, Bäume, Kräuter und Wildpflanzen. Sobald du eine Pflanze hinzufügst oder eine Art sammelst, landet sie automatisch in der passenden Sammlung. Deine eigenen Sammlungen bleiben davon völlig unberührt.',
    user_summary: '🗂️ 8 automatische Sammlungen (Giftige, Essbare, Pilze…) sortieren sich jetzt von selbst.',
    user_items: [
      { emoji: '🤖', text: '8 Auto-Sammlungen halten sich selbst aktuell — nichts manuell sortieren' },
      { emoji: '🔒', text: 'Deine eigenen Sammlungen bleiben unangetastet' },
      { emoji: '☁️', text: 'Geräteübergreifend synchron' },
    ],
    items: [
      {emoji:'🗄️', bold:'Migration:', text:' user_collections.system_key + partial-unique-Index + View — markiert automatisch verwaltete Sammlungen (verifiziert).'},
      {emoji:'⚙️', bold:'gsCollectionsAutoVacuum:', text:' INSERT neue / DELETE verschwundene / leere wegräumen — fasst NUR System-Sammlungen an (Daten-Sicherheit), single-flight, Opt-out gs_auto_collections.'},
      {emoji:'🧹', bold:'Aufgeräumt:', text:' alte LIVE-Chip-Engine entfernt (von persistenten System-Sammlungen abgelöst — kein Doppel-Code).'},
    ]
  },
  {
    v: 'v28.57', date: '08.06.2026',
    headline: '🌍 Garten-Tagebuch, Waldgarten & Saison-Kalender mehrsprachig',
    summary: 'Vollübersetzung Batch G abgeschlossen: Das Garten-Tagebuch (Eingabe-Felder für Ernte/Schädling/Dünger/Wasser/Symptom), der Waldgarten-Designer (7-Schichten-System, Pläne) und der Saison-Kalender (Erntezeit/Wildsammlung/Auspflanzen/Aussaat) werden jetzt mit der Sprache mit-übersetzt. Bei EN/FR/IT/ES automatisch.',
    user_summary: '🌍 Garten-Tagebuch, Waldgarten-Designer und Saison-Kalender sind jetzt mehrsprachig.',
    user_items: [
      { emoji: '📔', text: 'Garten-Tagebuch-Felder (Ernte/Schädling/Dünger/Wasser) mehrsprachig' },
      { emoji: '🌳', text: 'Waldgarten 7-Schichten + Saison-Kalender mehrsprachig' },
      { emoji: '🤖', text: 'EN/FR/IT/ES automatisch via Übersetzungs-Edge-Fn' },
    ],
    items: [
      {emoji:'🔧', bold:'54 neue Keys:', text:' gsDiaryRenderConditional + gsForestRender/OpenDetail + renderGardenLibrary + renderSeasonList auf gsI18n.t.'},
      {emoji:'⚡', bold:'Live-Detail mitgenommen:', text:' gsForestOpenDetail (war nicht voll im Audit) komplett lokalisiert.'},
      {emoji:'📋', bold:'Audit-Roadmap:', text:' 8/9 Batches ✅ (A/D/C/E/F/B/G) — offen nur noch Profil (I) + Farm (H).'},
    ]
  },
  {
    v: 'v28.56', date: '08.06.2026',
    headline: '🌍 Pflanzungs-Detailseite (Garten) jetzt mehrsprachig',
    summary: 'Weiter mit der Vollübersetzung (Batch G, Teil 1): Die Detailseite einer Garten-Pflanzung — Mondkalender-Empfehlung, Pflanzinfos (Tiefe/Abstand/Saattiefe), Keimung, Mischkultur (gute/schlechte Nachbarn), Fruchtfolge, Wachstums-Fortschritt, Bodeneignung, Notizen — wird jetzt mit der Sprache mit-übersetzt. Bei EN/FR/IT/ES automatisch.',
    user_summary: '🌍 Die Pflanzungs-Detailseite im Garten ist jetzt mehrsprachig.',
    user_items: [
      { emoji: '🌱', text: 'Pflanzinfos, Keimung, Mischkultur, Fruchtfolge mehrsprachig' },
      { emoji: '🌙', text: 'Mondkalender-Empfehlung + Wachstums-Fortschritt mehrsprachig' },
      { emoji: '🤖', text: 'EN/FR/IT/ES automatisch via Übersetzungs-Edge-Fn' },
    ],
    items: [
      {emoji:'🔧', bold:'48 neue Keys:', text:' openPlantingDetail (33 Audit-Strings + Maps) komplett auf gsI18n.t.'},
      {emoji:'♻️', bold:'4 reuse:', text:' unit_plants/unit_days/planting_date_label/water_mid wiederverwendet.'},
      {emoji:'📋', bold:'Audit-Roadmap:', text:' A+D+C+E+F+B + G-1 ✅ — als nächstes G-2 (Diary/Forest/Saison) + Profil.'},
    ]
  },
  {
    v: 'v28.55', date: '08.06.2026',
    headline: '🌍 Wissens-Bereich (Lexikon, Bodentypen, Schädlinge) mehrsprachig',
    summary: 'Weiter mit der Vollübersetzung (Batch B): Der Wissens-Bereich — Lexikon (Fachbegriffe + Statistik), Bodentypen (Vorteile/Nachteile/Verbesserung), Schädlinge & Krankheiten (Erkennung/Massnahmen), Aussaatkalender und Pflanztafel — wird jetzt mit der Sprache mit-übersetzt. Bei EN/FR/IT/ES automatisch.',
    user_summary: '🌍 Der Wissens-Bereich (Lexikon, Bodentypen, Schädlinge, Aussaat, Pflanztafel) ist jetzt mehrsprachig.',
    user_items: [
      { emoji: '📖', text: 'Lexikon + Bodentypen mehrsprachig' },
      { emoji: '🐛', text: 'Schädlinge/Krankheiten + Aussaatkalender + Pflanztafel mehrsprachig' },
      { emoji: '🤖', text: 'EN/FR/IT/ES automatisch via Übersetzungs-Edge-Fn' },
    ],
    items: [
      {emoji:'🔧', bold:'32 neue Keys:', text:' renderBodenTypen/Lexikon/Schaedlinge/Items/Aussaat/Pflanzentafel/BodenInfoCard auf gsI18n.t.'},
      {emoji:'🧱', bold:'Daten getrennt:', text:' BODENTYPEN/terms/GARDEN_KNOWLEDGE-Inhalte bleiben Daten-Objekte (separater Schritt).'},
      {emoji:'📋', bold:'Audit-Roadmap:', text:' Batch A+D+C+E+F+B ✅ — als nächstes Garten (G) + Profil (I).'},
    ]
  },
  {
    v: 'v28.54', date: '08.06.2026',
    headline: '🌍 Scan-Historie & Raum-Lichtscan jetzt mehrsprachig',
    summary: 'Weiter mit der Vollübersetzung (Batch F, Teil 2): Die Scan-Historie (Statistik, Suche, Filter, Detail mit Notiz/Wikipedia/„In DB öffnen") und der Raum-Lichtscan (Lichtkarte, Empfehlungen für hellste/schattigste Plätze) werden jetzt mit der Sprache mit-übersetzt. Bei EN/FR/IT/ES automatisch. Damit ist der ganze Pflanzendoktor-/Scan-Bereich fertig.',
    user_summary: '🌍 Scan-Historie und Raum-Lichtscan sind jetzt mehrsprachig.',
    user_items: [
      { emoji: '📷', text: 'Scan-Historie: Statistik, Suche, Filter, Detail-Ansicht mehrsprachig' },
      { emoji: '💡', text: 'Raum-Lichtscan: Lichtkarte + Pflanzen-Empfehlungen mehrsprachig' },
      { emoji: '🤖', text: 'EN/FR/IT/ES automatisch via Übersetzungs-Edge-Fn' },
    ],
    items: [
      {emoji:'🔧', bold:'39 neue Keys:', text:' renderRoomScanResult + renderScanHistFull + openScanHistoryFull + openScanHistoryDetail auf gsI18n.t.'},
      {emoji:'♻️', bold:'4 reuse:', text:' unit_lux/unit_species/search_no_hits/modal_close wiederverwendet.'},
      {emoji:'📋', bold:'Audit-Roadmap:', text:' Batch A+D+C+E+F ✅ — als nächstes Wissen/Lexikon (B) + Garten (G).'},
    ]
  },
  {
    v: 'v28.53', date: '08.06.2026',
    headline: '🌍 Pflanzendoktor & Pilz-Scanner jetzt mehrsprachig',
    summary: 'Weiter mit der Vollübersetzung (Batch F, Teil 1): Die Schädlings-Diagnose (Schweregrad, Bio-Behandlung, Vorbeugen, natürliche Feinde) und der sicherheitskritische Pilz-Scanner (Essbarkeits-Warnungen TÖDLICH/GIFTIG, Verwechslungs-Risiko, VAPKO-Hinweise, das rote Lebensgefahr-Vollbild) werden jetzt mit der Sprache mit-übersetzt. Bei EN/FR/IT/ES automatisch.',
    user_summary: '🌍 Pflanzendoktor (Schädlinge) und Pilz-Scanner inkl. Gefahren-Warnungen sind jetzt mehrsprachig.',
    user_items: [
      { emoji: '🐛', text: 'Schädlings-Diagnose: Schweregrad, Bio-Behandlung, Vorbeugen mehrsprachig' },
      { emoji: '🍄', text: 'Pilz-Scanner: Essbarkeit, Verwechslungs-Risiko, VAPKO, Gefahren-Vollbild mehrsprachig' },
      { emoji: '🤖', text: 'EN/FR/IT/ES automatisch via Übersetzungs-Edge-Fn' },
    ],
    items: [
      {emoji:'🔧', bold:'43 neue Keys:', text:' gsPestRenderResult + gsMushroomRenderResult + VapkoBox + Lebensgefahr-Overlay auf gsI18n.t.'},
      {emoji:'⚠️', bold:'Sicherheitskritisch sauber:', text:' Auch die roten TÖDLICH/GIFTIG-Warnungen + Tox-145-Notruf mehrsprachig.'},
      {emoji:'📋', bold:'Audit-Roadmap:', text:' Batch A+D+C+E + F-1 ✅ — als nächstes Scan-History (F-2) + Wissen.'},
    ]
  },
  {
    v: 'v28.52', date: '08.06.2026',
    headline: '🌍 Tages-Quiz & Quiz-Battles jetzt mehrsprachig',
    summary: 'Weiter mit der Vollübersetzung (Batch E): Das tägliche Quiz auf der Startseite (Start-Knopf, „Heute schon beantwortet", Countdown, Regeln) und die Quiz-Battles (Liste mit ELO, Sieg/Niederlage/Unentschieden, „Du bist dran", Runden-Anzeige, Ergebnis-Screen) werden jetzt mit der Sprache mit-übersetzt. Bei EN/FR/IT/ES automatisch.',
    user_summary: '🌍 Tägliches Quiz und Quiz-Battles (ELO, Ergebnisse, Runden) sind jetzt mehrsprachig.',
    user_items: [
      { emoji: '🎯', text: 'Tägliches Quiz: Start, Countdown, Regeln mehrsprachig' },
      { emoji: '⚔️', text: 'Quiz-Battles: Liste, Sieg/Niederlage, Runden, Ergebnis mehrsprachig' },
      { emoji: '🤖', text: 'EN/FR/IT/ES automatisch via Übersetzungs-Edge-Fn' },
    ],
    items: [
      {emoji:'🔧', bold:'34 neue Keys:', text:' renderDailyQuizTeaser + gsBattleRenderList/Round/Result auf gsI18n.t.'},
      {emoji:'♻️', bold:'Reuse:', text:' unit_days + confirm_continue (Weiter) wiederverwendet.'},
      {emoji:'📋', bold:'Audit-Roadmap:', text:' Batch A+D+C+E ✅ — als nächstes Doktor/Wissen/Garten (I18N_DYNAMIC_AUDIT.md).'},
    ]
  },
  {
    v: 'v28.51', date: '08.06.2026',
    headline: '🌍 Rezepte & Heilmittel jetzt mehrsprachig',
    summary: 'Weiter mit der Vollübersetzung (Batch C): Die Rezept- und Heilmittel-Karten, die Statistik-Leiste (Favoriten/Zufall), die leeren Zustände und die komplette Detail-Ansicht (Wirkung & Anwendung, Warnhinweis, Zutaten, Zubereitung, Tipps, Speichern/Bearbeiten/Löschen) werden jetzt mit der Sprache mit-übersetzt. Bei EN/FR/IT/ES automatisch.',
    user_summary: '🌍 Rezepte und Heilmittel (Karten, Detail, Zutaten/Zubereitung) sind jetzt mehrsprachig.',
    user_items: [
      { emoji: '🍲', text: 'Rezept-/Heilmittel-Karten + Statistik-Leiste mehrsprachig' },
      { emoji: '📋', text: 'Detail: Wirkung, Warnhinweis, Zutaten, Zubereitung, Tipps mehrsprachig' },
      { emoji: '🤖', text: 'EN/FR/IT/ES automatisch via Übersetzungs-Edge-Fn' },
    ],
    items: [
      {emoji:'🔧', bold:'29 neue Keys:', text:' buildRecipeCard + gsRenderRecipesStatsBar + Lazy-Loader + renderRecipes/Remedies + openRecipeDetail auf gsI18n.t.'},
      {emoji:'⚡', bold:'Audit-übersehen mitgenommen:', text:' gsRenderRecipesStatsBar (war nicht im Audit) zusätzlich lokalisiert.'},
      {emoji:'📋', bold:'Audit-Roadmap:', text:' Batch A+D+C ✅ — als nächstes Quiz/Doktor/Wissen (I18N_DYNAMIC_AUDIT.md).'},
    ]
  },
  {
    v: 'v28.50', date: '08.06.2026',
    headline: '🌍 Marktplatz-Detail, Chat & Käufe jetzt mehrsprachig',
    summary: 'Weiter mit der Vollübersetzung (Batch D): Die Inserat-Detailansicht (Status Aktiv/Reserviert/Verkauft/Archiviert, Anbieter, Kontakt/Bewerten, Auktion/Tausch/Gratis-Sektionen, Versand/Abholung), der Marktplatz-Chat und die „Meine Käufe"-Übersicht (Führend/Überboten/Gewonnen/Gekauft) werden jetzt mit der Sprache mit-übersetzt. Bei EN/FR/IT/ES automatisch.',
    user_summary: '🌍 Inserat-Detail, Marktplatz-Chat und „Meine Käufe" sind jetzt mehrsprachig.',
    user_items: [
      { emoji: '🛒', text: 'Inserat-Detail: Status, Anbieter, Kontakt/Bewerten, Auktion/Tausch/Gratis mehrsprachig' },
      { emoji: '💬', text: 'Marktplatz-Chat + „Meine Käufe" (Führend/Überboten/Gewonnen) mehrsprachig' },
      { emoji: '🤖', text: 'EN/FR/IT/ES automatisch via Übersetzungs-Edge-Fn' },
    ],
    items: [
      {emoji:'🔧', bold:'45 neue Keys:', text:' gsMarketShowDetail + openListingDetail + gsMktSetStatus + renderChatMessages + renderPurchases auf gsI18n.t.'},
      {emoji:'⚡', bold:'Live-Pfad mitgenommen:', text:' gsMarketShowDetail (war nicht im Audit) zusätzlich zum Legacy openListingDetail — keine halbe Sache.'},
      {emoji:'📋', bold:'Audit-Roadmap:', text:' Batch A+D ✅ — als nächstes Rezepte/Quiz/Doktor (I18N_DYNAMIC_AUDIT.md).'},
    ]
  },
  {
    v: 'v28.49', date: '08.06.2026',
    headline: '🌍 Arten-Suchliste, Garten-Übersicht & Friedhof mehrsprachig',
    summary: 'Weiter mit der Vollübersetzung (Batch A der Audit-Roadmap): Die Arten-Suchliste (Trefferanzeige, leerer Zustand, Tag-Badges Giftig/Essbar/Heilpflanze/Geschützt), die Garten-Übersicht (leerer Zustand, Karten, „Pflanze hinzufügen") und der Pflanzenfriedhof (leerer Zustand, Wiederherstellen) werden jetzt mit der Sprache mit-übersetzt. Bei EN/FR/IT/ES automatisch.',
    user_summary: '🌍 Arten-Suchliste, Garten-Übersicht und Pflanzenfriedhof sind jetzt mehrsprachig.',
    user_items: [
      { emoji: '🔍', text: 'Arten-Suchliste: Trefferanzeige, leerer Zustand, Tag-Badges mehrsprachig' },
      { emoji: '🌳', text: 'Garten-Übersicht + Pflanzenfriedhof mehrsprachig' },
      { emoji: '🤖', text: 'EN/FR/IT/ES automatisch via Übersetzungs-Edge-Fn' },
    ],
    items: [
      {emoji:'🔧', bold:'23 neue + 4 reuse Keys:', text:' renderList + gsFavsRenderOutdoor + renderCemetery auf gsI18n.t (tag_*/market_hits wiederverwendet).'},
      {emoji:'🧹', bold:'Toter Code erkannt:', text:' buildPlantCard übersprungen (nie aufgerufen — Live-Pfad ist gsNewPlantCard).'},
      {emoji:'📋', bold:'Audit-Roadmap:', text:' Batch A ✅ — als nächstes Markt-Detail/Rezepte/Quiz (I18N_DYNAMIC_AUDIT.md).'},
    ]
  },
  {
    v: 'v28.48', date: '08.06.2026',
    headline: '🌍 Arten-Detailseite jetzt vollständig mehrsprachig',
    summary: 'Die meistgenutzte Detailseite — die Arten-Ansicht (Beschreibung, Toxizität, Verwendung, Heilwirkung, Lichtbedarf, Giessintervall, Pflege, Verwechslungsgefahr, ähnliche Arten, alle Tags wie Essbar/Giftig/Geschützt und alle Knöpfe) — wird jetzt komplett mit der Sprache mit-übersetzt. Auch die Arten-Kategorien (Gemüse/Wildpflanze/Baum…) greifen damit überall. Bei EN/FR/IT/ES automatisch.',
    user_summary: '🌍 Die Arten-Detailseite ist jetzt komplett mehrsprachig (Tags, Sektionen, Knöpfe).',
    user_items: [
      { emoji: '🔬', text: 'Arten-Detail: Beschreibung, Toxizität, Pflege, Verwechslung, Tags + Knöpfe mehrsprachig' },
      { emoji: '🏷️', text: 'Arten-Kategorien (Gemüse/Wildpflanze/Baum…) überall mehrsprachig' },
      { emoji: '🤖', text: 'EN/FR/IT/ES automatisch via Übersetzungs-Edge-Fn' },
    ],
    items: [
      {emoji:'🔧', bold:'70 gsI18n.t-Keys:', text:' openDetail (~55 Strings) + geteiltes getCatLabel (8 Kategorien) auf gsI18n.t umgestellt + Keys registriert.'},
      {emoji:'🔍', bold:'Erschöpfender Audit:', text:' 9-Agenten-Workflow fand 398 unübersetzte Strings in ~45 weiteren Renders → I18N_DYNAMIC_AUDIT.md als Roadmap.'},
      {emoji:'📋', bold:'Fortschritt:', text:' Karte/Community/Markt/Meine-Pflanzen/Aufgaben/Arten-Detail ✅ — als nächstes Wissen/Rezepte/Markt-Detail.'},
    ]
  },
  {
    v: 'v28.47', date: '08.06.2026',
    headline: '🌍 „Meine Pflanzen" + Aufgaben jetzt mehrsprachig',
    summary: 'Weiter mit der Vollübersetzung: Der Bildschirm „Meine Pflanzen" (leerer Zustand, „Heute fällig"-Karten mit Jetzt/Bald fällig + Erledigt-Knopf, Erinnerungs-Banner) und der Aufgaben-Manager (Aktiv, Zuletzt, Jetzt erledigt) werden jetzt mit der Sprache mit-übersetzt. Die geteilten Fälligkeits-Texte (Jetzt fällig / Morgen fällig / In X Tagen) greifen damit überall — auch auf der Startseite und in den Pflanzen-Karten. Bei EN/FR/IT/ES automatisch.',
    user_summary: '🌍 „Meine Pflanzen" + Aufgaben/Fälligkeiten werden jetzt mit der Sprache mit-übersetzt.',
    user_items: [
      { emoji: '🪴', text: '„Meine Pflanzen": leerer Zustand, Fällig-Karten, Erinnerungs-Banner mehrsprachig' },
      { emoji: '⏰', text: 'Fälligkeits-Texte (Jetzt/Morgen fällig, In X Tagen) überall mehrsprachig' },
      { emoji: '🤖', text: 'EN/FR/IT/ES automatisch via Übersetzungs-Edge-Fn' },
    ],
    items: [
      {emoji:'🔧', bold:'19 gsI18n.t-Keys:', text:' renderMyPlants + openTaskManager + geteiltes getDueLabel (4 Call-Sites) auf gsI18n.t umgestellt + Keys registriert.'},
      {emoji:'⚡', bold:'High-Leverage:', text:' getDueLabel wirkt in Home-Widget, Pflanzen-Karte, Aufgaben-Manager + Detail.'},
      {emoji:'📋', bold:'Fortschritt dyn. Renders:', text:' Pflanzen-Karte/Community/Markt/Meine-Pflanzen ✅ — offen: Arten-Detail + Rezepte.'},
    ]
  },
  {
    v: 'v28.46', date: '08.06.2026',
    headline: '🌍 Marktplatz + Community jetzt mehrsprachig (dynamische Inhalte)',
    summary: 'Weiter mit der dynamischen Übersetzung: Auch die JS-generierten Listen im Marktplatz (Kategorien, Preis-/Status-Badges wie Verkauft/Reserviert/Archiviert, Bio/Pestizid-frei, Zeit-Angaben „vor X Min.", Treffer-Zähler, leere Zustände) und im Community-Feed (Zeit-Labels, Experte/Verifiziert-Badges, Verifizieren/Weitere-laden-Buttons, leerer Feed) werden jetzt mit der Sprache mit-übersetzt. Bei EN/FR/IT/ES automatisch.',
    user_summary: '🌍 Marktplatz- und Community-Texte (Kategorien, Badges, Zeit-Angaben) werden jetzt mit der Sprache mit-übersetzt.',
    user_items: [
      { emoji: '🛒', text: 'Marktplatz: Kategorien, Status-/Preis-Badges, Zeit-Angaben mehrsprachig' },
      { emoji: '🌿', text: 'Community-Feed: Zeit-Labels, Badges, Buttons mehrsprachig' },
      { emoji: '🤖', text: 'EN/FR/IT/ES automatisch via Übersetzungs-Edge-Fn' },
    ],
    items: [
      {emoji:'🔧', bold:'38 gsI18n.t-Keys:', text:' renderSocialFeed + renderMarket + geteilte Helfer (_catLabel/_priceLabel/_timeAgo) auf gsI18n.t umgestellt + Keys in GS_I18N_JS_STRINGS registriert.'},
      {emoji:'⚡', bold:'High-Leverage:', text:' Markt-Helfer wirken auch in Inserat-Detail + anderen Call-Sites.'},
      {emoji:'📋', bold:'Fortschritt dyn. Renders:', text:' Pflanzen-Karte ✅ Community ✅ Markt ✅ — offen: Detail/Meine-Pflanzen/Rezepte.'},
    ]
  },
  {
    v: 'v28.45', date: '07.06.2026',
    headline: '🌍 Pflanzen-Karte jetzt mehrsprachig (dynamische Inhalte)',
    summary: 'Start der dynamischen Übersetzung: Auch JS-generierte Inhalte werden jetzt mehrsprachig — den Anfang macht die Pflanzen-Karte in „Meine Pflanzen" (Wasser/Licht/Hinzugefügt, die Werte Wenig/Mittel/Viel + Schatten/Halbschatten/Sonne, sowie die Buttons KI-Pflegeberatung/Aufgaben/Bearbeiten). Bei EN/FR/IT/ES wird das automatisch übersetzt. Die übrigen dynamischen Listen (Markt, Community) folgen demselben Muster.',
    user_summary: '🌍 Pflanzen-Karten-Texte (Wasser/Licht/Buttons) werden jetzt mit der Sprache mit-übersetzt.',
    user_items: [
      { emoji: '🪴', text: 'Pflanzen-Karte (Labels + Werte + Buttons) mehrsprachig' },
      { emoji: '🤖', text: 'EN/FR/IT/ES automatisch via Übersetzungs-Edge-Fn' },
    ],
    items: [
      {emoji:'🔧', bold:'12 gsI18n.t-Keys:', text:' gsNewPlantCard auf gsI18n.t umgestellt + 12 Keys in GS_I18N_JS_STRINGS registriert (werden vom Edge-Fn gesammelt+übersetzt).'},
      {emoji:'🛡️', bold:'_t-Guard:', text:' bricht den Render nie, falls gsI18n nicht bereit.'},
      {emoji:'📋', bold:'Muster etabliert', text:' für renderMarket/renderSocialFeed/openDetail/renderMyPlants/renderRecipes.'},
    ]
  },
  {
    v: 'v28.44', date: '07.06.2026',
    headline: '🌍 Saisonkalender + KI-Assistent jetzt mehrsprachig',
    summary: 'Nächster Schritt der Vollübersetzung: Der Saisonkalender (Titel, Filter wie Gemüse/Obst/Kräuter, Legende) und der KI-Assistent-Bildschirm (Beispiel-Fragen + Begrüssung) sind jetzt mehrsprachig — bei EN/FR/IT/ES automatisch übersetzt. Scanner, Karte, Saisonkalender und KI-Assistent sind damit fertig.',
    user_summary: '🌍 Saisonkalender + KI-Assistent-Texte werden jetzt mit der Sprache mit-übersetzt.',
    user_items: [
      { emoji: '📅', text: 'Saisonkalender (Filter + Legende) mehrsprachig' },
      { emoji: '🤖', text: 'KI-Assistent (Beispiel-Fragen + Begrüssung) mehrsprachig' },
    ],
    items: [
      {emoji:'🔧', bold:'18 data-i18n-Keys:', text:' Season (12: Titel/Subtitle/6 Filter/4 Legende) + AI (6: 5 Vorschläge + Greeting). Struktur-Fallen (verschachtelte Spans) sauber gewrappt.'},
      {emoji:'⏭️', bold:'Offen:', text:' Rezepte/Heilmittel/Farm/Modals + dynamische Renders (Pflanzen/Markt/Community).'},
    ]
  },
  {
    v: 'v28.43', date: '07.06.2026',
    headline: '🌍 Karten-Screen jetzt mehrsprachig',
    summary: 'Weiter mit der schrittweisen Vollübersetzung: Der Karten-Bildschirm (Titel, Karten-Ebenen wie Swisstopo/Wanderwege/Satellit, Filter wie Pilze/Beeren/Heil) ist jetzt mehrsprachig — bei EN/FR/IT/ES werden diese Texte automatisch übersetzt. Scanner + Karte sind damit fertig; weitere Screens folgen.',
    user_summary: '🌍 Karten-Texte (Ebenen + Filter) werden jetzt mit der Sprache mit-übersetzt.',
    user_items: [
      { emoji: '🗺️', text: 'Karten-Ebenen + Filter mehrsprachig' },
      { emoji: '🤖', text: 'EN/FR/IT/ES automatisch generiert' },
    ],
    items: [
      {emoji:'🔧', bold:'13 data-i18n-Keys:', text:' map_title/subtitle, 6 Layer-Buttons, 5 Filter-Chips mit DE-Fallback.'},
      {emoji:'⏭️', bold:'Dynamisch separat:', text:' Track-Button + Funde-Zähler (JS-Pfad) folgen.'},
    ]
  },
  {
    v: 'v28.42', date: '07.06.2026',
    headline: '🌍 Scanner-Screen jetzt mehrsprachig',
    summary: 'Erster Schritt der schrittweisen Vollübersetzung: Der Scanner-Bildschirm (Lade-Texte, „Hochladen", Tipps, Galerie-Auswahl) ist jetzt mehrsprachig — bei Sprachwechsel auf EN/FR/IT/ES werden diese Texte automatisch übersetzt (kein Deutsch mehr stehengeblieben). Die übrigen Bildschirme folgen demselben Muster Schritt für Schritt.',
    user_summary: '🌍 Scanner-Texte werden jetzt mit der Sprache mit-übersetzt. Weitere Screens folgen.',
    user_items: [
      { emoji: '📸', text: 'Scanner-Texte (Laden/Hochladen/Tipp/Galerie) mehrsprachig' },
      { emoji: '🤖', text: 'EN/FR/IT/ES automatisch generiert (Edge-Fn)' },
    ],
    items: [
      {emoji:'🔧', bold:'7 data-i18n-Keys:', text:' sr_loading_text/sub, btn_upload, sr_tip_center, uz_title/sub, btn_reopen_camera mit DE-Fallback.'},
      {emoji:'🌐', bold:'Auto-Übersetzung:', text:' i18n-translate-Edge-Fn erzeugt EN/FR/IT/ES aus DE-Fallbacks beim ersten Sprachwechsel.'},
      {emoji:'📋', bold:'Muster etabliert', text:' für restliche Screens + dynamische Renders (SETTINGS_I18N_AUDIT.md).'},
    ]
  },
  {
    v: 'v28.41', date: '07.06.2026',
    headline: '🌍 Sprache greift jetzt auch geräteübergreifend sofort',
    summary: 'Wenn du die Sprache auf einem Gerät änderst, wird sie jetzt auch auf deinen anderen Geräten sofort angewendet (vorher erst nach Neuladen). Die Sprach-Umschaltung selbst arbeitet zuverlässig in Echtzeit für die ganze Oberfläche. Wir haben ausserdem die App systematisch auf noch nicht übersetzte Bereiche geprüft und einen klaren Plan, diese Schritt für Schritt sauber nachzuziehen.',
    user_summary: '🌍 Sprachwechsel greift jetzt auch geräteübergreifend sofort. Weitere Bereiche werden Schritt für Schritt vollständig übersetzt.',
    user_items: [
      { emoji: '⚡', text: 'Sprache wird geräteübergreifend sofort angewendet' },
      { emoji: '🔎', text: 'App systematisch auf Übersetzungs-Lücken geprüft' },
    ],
    items: [
      {emoji:'🔧', bold:'Fix:', text:' applyAllPrefs wandte die Sprache nicht an → bei Cross-Device-Pull griff der Wechsel erst nach Reload. Jetzt gsI18n.setLang in applyAllPrefs.'},
      {emoji:'✅', bold:'Mechanismus solide:', text:' setLang→applyToDOM (376 [data-i18n], Echtzeit) + Settings-Persistenz lokal+Cloud.'},
      {emoji:'📋', bold:'Plan:', text:' ~660 hardcodierte DE-Strings (7 Screens + 6 Render-Funktionen) screen-by-screen via i18n-translate. Doku SETTINGS_I18N_AUDIT.md.'},
    ]
  },
  {
    v: 'v28.40', date: '07.06.2026',
    headline: '🌱 KI-Garten-Planer: sauberer Plan, realistische Fläche',
    summary: 'Der KI-Garten-Planer liefert jetzt saubere Pläne: Pflanzen liegen immer innerhalb deiner Beet-Grenzen (vorher landeten manche ausserhalb), und die Flächenausnutzung ist realistisch — nie mehr über 100% (vorher z.B. 123%). Wenn die KI zu viel einplant, wird auf 100% begrenzt und du bekommst einen klaren Hinweis, Stückzahlen zu reduzieren. Gilt auch für bereits gespeicherte Pläne beim erneuten Öffnen.',
    user_summary: '🌱 Garten-Pläne: Pflanzen bleiben im Beet, Flächenausnutzung realistisch (max 100%, Warnung bei Überbelegung).',
    user_items: [
      { emoji: '📐', text: 'Pflanzen immer innerhalb der Beet-Grenzen' },
      { emoji: '✅', text: 'Flächenausnutzung max 100% (kein 123% mehr)' },
    ],
    items: [
      {emoji:'🐛', bold:'Root-Cause:', text:' KI-Prompt erzwang keine Spatial-/Flächen-Grenzen → Pflanzen ausserhalb + Σ-Footprint >100%.'},
      {emoji:'🔧', bold:'Fix:', text:' _gsSanitizeGardenPlan clampt Positionen in [0,W]×[0,D] + berechnet echte Auslastung, deckelt auf 100% + Warnung. Frisch + gespeichert.'},
      {emoji:'🧪', bold:'Verifiziert:', text:' Logiktest (9,12→2,5 · 130%→100%+Warnung). FIX-7b (Edge-Fn-Prompt-Constraints) optional.'},
    ]
  },
  {
    v: 'v28.39', date: '07.06.2026',
    headline: '✨ XP-System: Achievements + zuverlässige Anzeige',
    summary: 'Mehrere XP-Verbesserungen nach einem gründlichen Audit: Die XP-Achievements („100 XP", „500 XP") lösen jetzt korrekt aus (vorher nie). Die XP-Anzeige im Profil-Menü aktualisiert sich jetzt sofort nach einem Punktgewinn statt erst nach Neuladen. Und das XP-Speichern ist robuster bei vollem Gerätespeicher.',
    user_summary: '✨ XP-Achievements lösen wieder aus · Profil-XP aktualisiert sofort · robusteres XP-Speichern.',
    user_items: [
      { emoji: '🏅', text: '„100 XP"- & „500 XP"-Achievements lösen wieder aus' },
      { emoji: '⚡', text: 'Profil-/Mehr-XP-Anzeige aktualisiert sofort' },
    ],
    items: [
      {emoji:'🐛', bold:'Achievements:', text:' gsCheckAchievement las toten Key gs_xp_total → jetzt gsGetXP() (gs_xp).'},
      {emoji:'🛡️', bold:'Quota-safe:', text:' gsAddXP setItem mit try/catch + gsStore (Hard-Lesson #10).'},
      {emoji:'🔌', bold:'Echtzeit-Verdrahtung:', text:' profileAddXp refresht jetzt Menü-/Mehr-/Home-XP-Bar sofort.'},
      {emoji:'📋', bold:'Audit:', text:' 4-Agenten-Workflow fand 2 parallele XP-Systeme → voller Single-Source-Merge als FIX-6b geplant (separat, da Live-XP-Risiko).'},
    ]
  },
  {
    v: 'v28.38', date: '07.06.2026',
    headline: '🏆 Quiz-Rangliste aktualisiert sofort nach der Antwort',
    summary: 'Wenn du eine Quizfrage richtig beantwortest, erscheint dein Punkt jetzt sofort in der Rangliste — vorher wurde die Liste teils mit Verzögerung oder gar nicht aktualisiert. Die Top-5 unter dem Quiz und die volle Rangliste zeigen ab jetzt direkt den aktuellen Stand.',
    user_summary: '🏆 Dein Quiz-Punkt erscheint jetzt sofort in der Rangliste (Top-5 + volle Liste aktualisieren direkt nach dem Antworten).',
    user_items: [
      { emoji: '⚡', text: 'Rangliste aktualisiert direkt nach der Antwort' },
      { emoji: '🥇', text: 'Top-5 + volle Rangliste immer auf aktuellem Stand' },
    ],
    items: [
      {emoji:'🐛', bold:'Root-Cause (Frontend):', text:' Inline-Top-5 lud vor dem 2s-debounced Upsert → alter Stand; kein Refresh nach Upsert.'},
      {emoji:'✅', bold:'Backend ok:', text:' fn_quiz_leaderboard_upsert → _top spiegelt sofort (transaktional verifiziert).'},
      {emoji:'🔧', bold:'Fix:', text:' dqFillInlineLb (wiederverwendbar) + dqRefreshLeaderboards; Debounce 2000→500ms; .then(refresh) nach Upsert.'},
    ]
  },
  {
    v: 'v28.37', date: '07.06.2026',
    headline: '💬 Marktplatz-Chat: Verkäufer direkt anschreiben',
    summary: 'Der „Kontakt aufnehmen"-Button bei einem Inserat öffnet jetzt den echten In-App-Chat (für eingeloggte Nutzer) — bisher führte er nur zu E-Mail/Telefon, der Chat war vom Inserat aus gar nicht startbar. Deine Nachrichten landen sicher beim Verkäufer (und nur dort), Antworten siehst du im 📨-Posteingang. Für Gäste bleibt der E-Mail-/Telefon-Weg.',
    user_summary: '💬 „Kontakt aufnehmen" startet jetzt den echten In-App-Chat mit dem Verkäufer (Gäste: weiterhin E-Mail/Telefon).',
    user_items: [
      { emoji: '💬', text: '„Kontakt aufnehmen" → echter Chat mit dem Verkäufer' },
      { emoji: '📨', text: 'Antworten im Marktplatz-Posteingang' },
    ],
    items: [
      {emoji:'🐛', bold:'Root-Cause:', text:' contactSeller machte nur mailto/tel → openMarketChat wurde nie vom Inserat-Detail aufgerufen (0 Nachrichten je gesendet).'},
      {emoji:'✅', bold:'Backend verifiziert:', text:' marketplace_messages RLS transaktional getestet — Käufer↔Verkäufer ok, Dritte sehen 0. Senden war korrekt verdrahtet.'},
      {emoji:'🔀', bold:'Fix:', text:' contactSeller → openMarketChat bei eingeloggt+Cloud-Inserat; mailto/tel Fallback für Gäste.'},
    ]
  },
  {
    v: 'v28.36', date: '07.06.2026',
    headline: '🔧 Kleine Verbesserungen: Profile, Marktplatz, Fakten',
    summary: 'Drei Verbesserungen: (1) In den Kommentaren kannst du jetzt auf Name/Avatar tippen, um das Profil zu öffnen (wie bei Posts). (2) Der grüne „+"-Button im Marktplatz wurde entfernt — neue Inserate erstellst du weiter oben rechts über „+ Angebot". (3) Beim „Wusstest du?"-Widget gibt es keinen „nächster Fakt"-Knopf mehr — stattdessen erscheint jeden Tag automatisch ein neuer Fakt.',
    user_summary: '🔧 Kommentar-Profile antippbar · grüner Marktplatz-„+"-Button entfernt · „Wusstest du?" zeigt täglich automatisch einen neuen Fakt.',
    user_items: [
      { emoji: '👤', text: 'Kommentar-Name/Avatar → Profil öffnen' },
      { emoji: '🗓️', text: 'Wusstest-du-Fakt wechselt täglich automatisch' },
    ],
    items: [
      {emoji:'💬', bold:'FIX-1:', text:' openComments Autor klickbar (_gsProfileChip/gsOpenProfile, #12-sicher).'},
      {emoji:'🛒', bold:'FIX-3:', text:' market-fab entfernt; Header „+ Angebot" bleibt.'},
      {emoji:'💡', bold:'FIX-5:', text:' gsShowNextDynFact → day-of-year-deterministisch; Button raus; beide Loader umgestellt.'},
    ]
  },
  {
    v: 'v28.35', date: '06.06.2026',
    headline: '💬 Feedback & Ideen jetzt zuoberst',
    summary: 'Im „Mehr"-Bereich erscheint das Feedback- & Ideen-Formular jetzt ganz oben (direkt unter der Kopfzeile) statt ganz unten — dein Feedback ist uns wichtig und soll leicht erreichbar sein. Ausserdem führt der „Feedback geben"-Knopf in der Hilfe jetzt zuverlässig dorthin (vorher tat er nichts).',
    user_summary: '💬 Feedback & Ideen stehen jetzt zuoberst im „Mehr"-Bereich; der „Feedback geben"-Button in der Hilfe funktioniert wieder.',
    user_items: [
      { emoji: '⬆️', text: 'Feedback-Formular zuoberst im Mehr-Screen' },
      { emoji: '🔧', text: '„Feedback geben"-Button in der Hilfe repariert' },
    ],
    items: [
      {emoji:'🔀', bold:'gsMoreFeedbackFirst:', text:' Runtime-DOM-Reorder verschiebt #feedback-section unter den Hero (.screen=display:block → kein CSS-order; HTML-Block-Move zu riskant). Idempotent, graceful, Hook in switchTab(more).'},
      {emoji:'🔧', bold:'gsOpenFAQ-Button:', text:' menuNav(feedback) (toter Screen) → closeModal + menuNav(more).'},
    ]
  },
  {
    v: 'v28.34', date: '06.06.2026',
    headline: '👤 Community: Profil antippen + „Verifizieren" repariert',
    summary: 'Im Community-Feed kannst du jetzt auf den Avatar oder Namen jedes Beitrags tippen, um direkt zum Profil der Person zu gelangen — inklusive Folgen-Button. Ausserdem war der „✅ Verifizieren"-Button (für Experten) kaputt: ein Klick zeigte fälschlich „Post nicht gefunden". Das ist behoben — Experten können Beiträge wieder verifizieren.',
    user_summary: '👤 Avatar/Name im Community-Feed antippen → Profil + Folgen. „Verifizieren"-Button (Experten) repariert.',
    user_items: [
      { emoji: '👤', text: 'Avatar & Name in jedem Post öffnen das Profil (mit Folgen)' },
      { emoji: '✅', text: '„Verifizieren"-Button zeigt nicht mehr fälschlich „Post nicht gefunden"' },
    ],
    items: [
      {emoji:'🐛', bold:'B-020 Verifizieren-404:', text:' gsOpenVerifyModal suchte in window.socialPosts (nie gesetzt) statt in der Modul-Variable socialPosts → immer leer. Korrigiert.'},
      {emoji:'🔗', bold:'B-021 Profil-Klick:', text:' Avatar + Name in renderSocialFeed → gsOpenProfile(user_id) via _gsProfileChip/inline-onclick (Hard-Lesson #12-sicher, nur user_id, stopPropagation). Badges bleiben außerhalb.'},
    ]
  },
  {
    v: 'v28.33', date: '06.06.2026',
    headline: '🔒 Verkaufte Inserate verschwinden — wie bei Tutti',
    summary: 'Verkaufte und archivierte Inserate sind jetzt für andere Nutzer nicht mehr sichtbar — genau wie auf Tutti. Nur du selbst siehst deine eigenen verkauften/archivierten Inserate (in „Meine Inserate"). Im Hintergrund haben wir ausserdem einen versteckten, ernsten Fehler in der Admin-Rechteprüfung behoben, der seit einer früheren Aufräumaktion schlummerte.',
    user_summary: '🔒 Verkaufte + archivierte Inserate sind für andere unsichtbar (nur du siehst deine eigenen). Plus ein wichtiger Backend-Fix.',
    user_items: [
      { emoji: '🔒', text: 'Verkaufte/archivierte Inserate für andere unsichtbar (Tutti-Prinzip)' },
      { emoji: '👤', text: 'Deine eigenen Inserate aller Status bleiben für dich sichtbar' },
    ],
    items: [
      {emoji:'🛡️', bold:'Lifecycle-RLS (B-018):', text:' marketplace_select_active → status IN (active,reserved) OR eigene. Transaktional verifiziert (anon/fremd sehen nur active+reserved; Eigentümer sieht alle eigenen). Frontend versteckt sold zusätzlich.'},
      {emoji:'🚨', bold:'is_admin_user-Fix (kritisch):', text:' Funktion referenzierte gedroppte legacy_profiles → warf bei jedem Aufruf, brach 3 Admin-Policies. Gefixt auf profiles.is_admin + admin_emails. Beim Marktplatz-Pre-Test gefangen, bevor es Schaden anrichtete.'},
      {emoji:'✅', bold:'Security-Advisor 0 ERRORs', text:' · minimale Grants (Hard-Lesson #13).'},
    ]
  },
  {
    v: 'v28.32', date: '06.06.2026',
    headline: '🛒 Marktplatz-Fix: deine Inserate erscheinen sofort',
    summary: 'Wir haben den hartnäckigen Bug gefunden, bei dem neu erstellte oder von anderen veröffentlichte Inserate erst nach einem Neuladen der App auftauchten. Ursache: die App lud die frischen Inserate zwar aus der Cloud, behielt aber im Speicher die alte Liste. Jetzt sind Speicher und Cloud immer synchron — neue Inserate erscheinen sofort, ohne Neuladen. Ausserdem zeigt die Startseite nur noch aktive Inserate, und alte Test-Inserate sind ins Archiv gewandert.',
    user_summary: '🛒 Inserate erscheinen jetzt sofort (kein Neuladen nötig); Startseite zeigt nur aktive Inserate; Test-Inserate archiviert.',
    user_items: [
      { emoji: '✅', text: 'Neue / fremde Inserate sofort sichtbar (Cache-Bug behoben)' },
      { emoji: '🏠', text: 'Startseite zeigt nur aktive Inserate' },
    ],
    items: [
      {emoji:'🐛', bold:'P0-Root-Cause (B-017):', text:' loadMarketFromSupabase schrieb frische Inserate nur in localStorage, nie in window._gsMarket → renderMarket rendert stale Cache. Fix: Memory+LS synchron + nach Publish frischer Cloud-Pull.'},
      {emoji:'📦', bold:'Demo-Archiv:', text:' 2 Test-Inserate → status=archived (mit Backup). Home fragt bereits status=eq.active.'},
      {emoji:'🏆', bold:'Quiz-Rangliste auditiert:', text:' sortiert live (fn_quiz_leaderboard_top), kontinuierlich aktuell — einwandfrei.'},
    ]
  },
  {
    v: 'v28.31', date: '06.06.2026',
    headline: '🧘 Bestätigungs-Fenster statt einfrierender Popups',
    summary: 'Weiter im Dialog-Umbau (Schritt 2 von 3): Überall, wo bisher ein blockierender „OK/Abbrechen"-System-Dialog kam (Löschen-Bestätigungen, Reset-Warnungen, Konto-Aktionen), erscheint jetzt ein sauberes In-App-Fenster im App-Stil — mit klaren Buttons („Löschen" in Rot, „Abbrechen" daneben). Das gefährliche Einfrieren der Home-Screen-App-Version unter iOS bei jeder Bestätigung gehört damit der Vergangenheit an.',
    user_summary: '🧘 21 blockierende Bestätigungs-Popups durch saubere App-Fenster ersetzt — keine eingefrorenen Bildschirme mehr bei Lösch-/Reset-Dialogen.',
    user_items: [
      { emoji: '✅', text: 'Saubere App-Fenster für „Wirklich löschen?"-Bestätigungen' },
      { emoji: '🔴', text: 'Lösch-Buttons jetzt deutlich rot, „Abbrechen" daneben' },
      { emoji: '📱', text: 'iOS-/Home-Screen-Modus fängt nicht mehr ein' },
    ],
    items: [
      {emoji:'🧘', bold:'21× confirm()→await gsConfirmModal:', text:' Marktplatz (mktDelete/reportListing/deleteListing/+12 weitere), Scan-History (gsScanHistDelete/All), KI-Plan-Reset und mehr — alle umgebenden Functions zu async umgestellt. Funktionen liefern korrekt true/false via await.'},
      {emoji:'🧮', bold:'10 verbleibende confirm() bewusst belassen:', text:' 6 sind absichtliche Fallback-Branches (`: confirm()` / `else`) für Edge-Cases ohne Helper, 4 sind deferred Sonderfälle (Z.40461/42061/54015/62189) — eigene Sub-Sweep in v28.32.'},
      {emoji:'🤖', bold:'Skript-verifiziert:', text:' Pattern-Matcher + Diff-Audit pro Stelle, async-Konvertierung vorsichtig (nur Top-Level-Functions, keine Closures verändert). 7/7 node --check. B-013 Batch 2/3.'},
      {emoji:'⏭️', bold:'Nächster Batch v28.32:', text:' prompt() (17 Stellen) → await gsPromptModal — schließt den B-013-Sweep ab.'},
    ]
  },
  {
    v: 'v28.30', date: '06.06.2026',
    headline: '🔔 Sanfte Hinweise statt blockierender Popups',
    summary: 'Weiter im Dialog-Umbau: Überall, wo die App bisher native System-Popups (alert) zeigte — Fehlermeldungen, Validierungs-Hinweise, „kopiert ✓"-Bestätigungen — kommen jetzt einheitliche, sanfte In-App-Hinweise (Toasts), die die App nicht mehr einfrieren. Insgesamt 46 Stellen umgestellt, jeweils mit passender Farbe (rot = Fehler, gelb = Hinweis, grün = Erfolg). Der mehrzeilige API-Key-Test (Einstellungen) erscheint jetzt als sauberes Ergebnis-Fenster statt als Popup.',
    user_summary: '🔔 46 native System-Popups durch sanfte, nicht-blockierende In-App-Hinweise ersetzt (rot/gelb/grün je nach Art).',
    user_items: [
      { emoji: '✅', text: 'Keine einfrierenden System-Popups mehr bei Hinweisen' },
      { emoji: '🎨', text: 'Farbcodierte Toasts: Fehler / Hinweis / Erfolg' },
    ],
    items: [
      {emoji:'🔔', bold:'46× alert()→gsToast:', text:' error (Kamera/Bluetooth/Backup/KI/Passwort), warn (Validierungen + Farm-Spiel), success (Kopier-/Passwort-Bestätigung), info (Rechts-Hinweise/Sensor-Readouts).'},
      {emoji:'🪟', bold:'API-Key-Test als Modal:', text:' mehrzeiliger Report jetzt via _gsNlOpen statt blockierendem alert.'},
      {emoji:'🤖', bold:'Skript-verifiziert:', text:' Match-Count-Assertions (44 Regeln/46 Treffer) — schreibt nur bei exakter Übereinstimmung. node 7/7. B-013 Batch 1/3.'},
    ]
  },
  {
    v: 'v28.29', date: '06.06.2026',
    headline: '🧩 Sauberere Dialoge — kein eingefrorenes Fenster mehr',
    summary: 'Wir härten die App für iOS-/Home-Screen-Nutzung ab: Statt nativer System-Dialoge (die im Home-Screen-Modus die ganze App einfrieren können) kommen überall einheitliche, schöne In-App-Dialoge. In diesem Schritt: ein gemeinsames Eingabe-Fenster (für Umbenennen & Co.) und ein Fix, durch den Bestätigungs-Dialoge wieder ihren vollen Text + die richtigen Buttons (z.B. rotes „Löschen") zeigen — das war an mehreren Stellen unbemerkt verloren gegangen.',
    user_summary: '🧩 Einheitliche In-App-Dialoge statt nativer System-Popups (die auf dem Home-Screen die App einfrieren konnten) — plus korrekte Texte & Buttons in Bestätigungs-Dialogen.',
    user_items: [
      { emoji: '✅', text: 'Bestätigungs-Dialoge zeigen wieder vollen Text + richtige Buttons' },
      { emoji: '⌨️', text: 'Neues iOS-sicheres Eingabe-Fenster (ersetzt native Popups)' },
    ],
    items: [
      {emoji:'🛠️', bold:'gsConfirmModal tolerant:', text:' akzeptiert jetzt {opts}/(str)/(str,str)/(str,obj) + Alias text→message/okText→ok/cancelText→cancel/danger→kind. Korrigiert ~9 falsch-keyed/positional Aufrufer (inkl. Sammlungen-/Ernte-/Fund-Delete) ohne Call-Site-Änderung.'},
      {emoji:'⌨️', bold:'gsPromptModal neu:', text:' Promise<string|null>, Focus-Trap, Esc=Abbruch, multiline-Option — iOS-PWA-safe Ersatz für native prompt(). Mock-DOM 14/14 PASS.'},
      {emoji:'📋', bold:'B-013-Start:', text:' Inventar 60 alert + 44 confirm + 17 prompt native → Sweep batchweise in Folge-Versionen (Hard-Lesson #2).'},
    ]
  },
  {
    v: 'v28.28', date: '06.06.2026',
    headline: '🤖 Auto-Ordner — die App sortiert für dich',
    summary: 'Deine Sammlungen sortieren sich jetzt von selbst: Öffne „Meine Sammlungen" und du siehst oben Auto-Ordner, die die App automatisch aus deinen Pflanzen & gemerkten Arten zusammenstellt — ☠️ Giftige, 🍽️ Essbare, 💊 Heilpflanzen, 🍄 Pilze, 🌳 Bäume, 🌿 Kräuter. Sie werden live berechnet (nichts wird im Hintergrund gespeichert). Gefällt dir ein Auto-Ordner, machst du mit einem Tipp auf „📌 Als feste Sammlung speichern" einen echten, frei bearbeitbaren Ordner daraus.',
    user_summary: '🤖 Auto-Ordner sortieren deine Pflanzen & Arten automatisch nach Giftig/Essbar/Heil/Pilz/Baum/Kraut — auf Wunsch als feste Sammlung speichern.',
    user_items: [
      { emoji: '🤖', text: 'Automatisch sortierte Ordner aus deinen Pflanzen & Arten' },
      { emoji: '📌', text: 'Auto-Ordner mit einem Tipp in eine feste Sammlung umwandeln' },
    ],
    items: [
      {emoji:'🧠', bold:'Smart-Engine:', text:' gsComputeSmartFolders reichert myPlants per Name→DB-Match an + lädt gesammelte Arten (dedup), bucketet nach 6 botanischen Regeln (tox>=4/edible/medicinal + cat pilz/baum/kraut). Read-only, live berechnet — kein Stale-Risiko.'},
      {emoji:'🔗', bold:'Verdrahten:', text:' gsMaterializeSmartFolder erstellt aus einem Auto-Ordner eine echte user_collection + Bulk-Insert (ignore-duplicates). Mitglieder anklickbar → Arten-Detail / Pflanzen-Dossier.'},
      {emoji:'✅', bold:'Client-only:', text:' nutzt v28.24-Tabellen, keine Migration. Bucketing/Dedup/leere-Namen/unmatched gegen Mock-DOM verifiziert (ALL PASS). Schliesst das Ordner-System ab (Dossier+Sammlungen+Auto-Sortierung).'},
    ]
  },
  {
    v: 'v28.27', date: '06.06.2026',
    headline: '📁 Funde & Inserate sammeln — alles an einem Ort',
    summary: 'Sammlungen werden universell: Du kannst jetzt auch deine Karten-Funde und Marktplatz-Inserate in eigene Ordner legen. In „Meine Funde" tippst du auf 📁, im Inserat-Detail ebenfalls — und legst sie z.B. in „Merkliste", „Pilzstellen" oder „Wunschliste". So hast du Pflanzen, Arten, Funde und Inserate alle in derselben Sammlungs-Struktur beisammen.',
    user_summary: '📁 Karten-Funde & Marktplatz-Inserate lassen sich jetzt auch in Sammlungen ablegen.',
    user_items: [
      { emoji: '📍', text: 'Funde aus „Meine Funde" in Sammlungen legen' },
      { emoji: '🛒', text: 'Marktplatz-Inserate merken (z.B. Wunschliste)' },
    ],
    items: [
      {emoji:'✨', bold:'Neu:', text:' gsAddFindToCollection (📁 in gsOpenMyFinds-Liste) + gsAddListingToCollection (📁 in gsMarketShowDetail). item_type find/listing waren bereits im CHECK (v28.24) — reines Frontend, keine Migration.'},
      {emoji:'🛡️', bold:'Stale-Ref-Guard:', text:' Funde mit local_-ID (noch nicht gesynct) werden geblockt mit Hinweis „erst synchronisieren" — verhindert veraltete Sammlungs-Refs nach Cloud-Sync.'},
    ]
  },
  {
    v: 'v28.26', date: '06.06.2026',
    headline: '🔍 Qualitäts-Audit: Pflanzen-Dossier korrigiert',
    summary: 'Nach einer gründlichen Selbst-Prüfung der letzten Updates haben wir einen Genauigkeits-Fehler im neuen Pflanzen-Dossier behoben: die „Scans"-Zahl wurde über den falschen Schlüssel verknüpft und hätte nie korrekt gezählt. Sie wurde entfernt — das Dossier zeigt jetzt nur noch die zuverlässig zugeordneten Inhalte (Ernten, Diagnosen, Foto-Vergleiche). Lieber ehrlich & korrekt als eine falsche Zahl.',
    user_summary: '🔍 Audit-Fix: ungenaue „Scans"-Zahl aus dem Pflanzen-Dossier entfernt — nur noch korrekt verknüpfte Inhalte.',
    user_items: [
      { emoji: '✅', text: 'Dossier zeigt nur zuverlässig zugeordnete Inhalte' },
      { emoji: '🔍', text: 'Kritischer Re-Audit von v28.22–v28.25 (sonst alles sauber)' },
    ],
    items: [
      {emoji:'🐛', bold:'Bug behoben:', text:' scan_events.species_id = Arten-DB-ID (nicht lat/name) → scan_count im Dossier hätte nie korrekt verknüpft. Entfernt (Backend fn_plant_dossier + Frontend-Chip). Dossier behält per plant_local_id sicher verknüpfte Ernten/Diagnosen/Foto-Diffs.'},
      {emoji:'✅', bold:'Audit-Ergebnis:', text:' count-guard, Sammlungen-RLS, Escaping, anon-revoke alle korrekt verifiziert. Nur dieser eine Fehler.'},
    ]
  },
  {
    v: 'v28.25', date: '06.06.2026',
    headline: '📁 Arten in Sammlungen — merken & kategorisieren',
    summary: 'Sammlungen funktionieren jetzt auch für Arten: Öffne eine beliebige Art (aus Suche/Scan) und tippe auf „📁 Zu Sammlung hinzufügen" — leg sie in „Wunschliste", „Giftige", „Essbare" oder einen eigenen Ordner. Die App schlägt dir passend zum Pflanzentyp automatisch ein Symbol vor (☠️ giftig, 🍽️ essbar, 💊 Heilpflanze).',
    user_summary: '📁 Arten lassen sich jetzt in Sammlungen merken (mit automatischem Symbol-Vorschlag).',
    user_items: [
      { emoji: '📁', text: '„Zu Sammlung hinzufügen" in jeder Art' },
      { emoji: '💡', text: 'Automatischer Symbol-Vorschlag (giftig/essbar/Heilpflanze)' },
    ],
    items: [
      {emoji:'📁', bold:'Arten-Sammlungen:', text:' 📁-Button in der Arten-Detailansicht (openDetail) + gsAddSpeciesToCollection (ID-only onclick = Hard-Lesson #12). Backend (v28.24) unterstützt species bereits.'},
      {emoji:'⏭️', bold:'Nächste Schritte:', text:' Funde + Marktplatz-Inserate in Sammlungen, dann rule-basierte Auto-Sortierung.'},
    ]
  },
  {
    v: 'v28.24', date: '06.06.2026',
    headline: '📁 Sammlungen — eigene Ordner für deine Pflanzen & Arten',
    summary: 'Neu: Du kannst jetzt eigene Sammlungen (Ordner) anlegen — z.B. „Wunschliste", „Giftige", „Mein Balkon" — und Pflanzen hineinlegen. Tippe in „Meine Pflanzen" eine Pflanze auf → 📁 Sammlung, und wähle (oder erstelle) einen Ordner. Im Menü unter „📁 Sammlungen" siehst du alle deine Ordner mit Anzahl. Die App schlägt dir sinnvolle Start-Sammlungen vor. Alles wird in der Cloud gespeichert und ist nur für dich sichtbar.',
    user_summary: '📁 Neue Sammlungen: eigene Ordner anlegen & Pflanzen einsortieren (mit Smart-Vorschlägen).',
    user_items: [
      { emoji: '📁', text: 'Eigene Sammlungen/Ordner anlegen' },
      { emoji: '➕', text: 'Pflanzen per 📁-Button in Sammlungen legen' },
      { emoji: '💡', text: 'Smart-Vorschläge (Wunschliste, Giftige, Essbare …)' },
    ],
    items: [
      {emoji:'🗄️', bold:'Backend:', text:' user_collections + user_collection_items (beliebige Item-Typen) mit owner-only RLS + View v_user_collections (item_count). Transaktional verifiziert (Eigentümer-Isolation).'},
      {emoji:'📁', bold:'Frontend:', text:' Sammlungs-Manager (anlegen/öffnen/löschen) + Add-Picker mit Toggle + Smart-Vorschläge. Einstiege: 📁-Button pro Pflanzen-Karte + Menü „Sammlungen".'},
      {emoji:'⏭️', bold:'Nächster Schritt:', text:' weitere Item-Typen (Arten/Funde/Inserate) in Sammlungen + Auto-Sortierung. Eins nach dem anderen.'},
    ]
  },
  {
    v: 'v28.23', date: '06.06.2026',
    headline: '📂 Pflanzen-Dossier — alles zu einer Pflanze an einem Ort',
    summary: 'Neu: Jede Pflanze hat jetzt ein „Dossier". Tippe in „Meine Pflanzen" eine Pflanze auf und dann auf 📂 Dossier — die App sammelt automatisch alles, was zu dieser Pflanze gehört: deine Ernten, Pflanzen-Doktor-Diagnosen, Vorher/Nachher-Foto-Vergleiche, Scans und Tagebuch-Einträge. Du musst nichts manuell zuordnen — die App verknüpft im Hintergrund intelligent über Art und Verlauf. Erster Schritt eines grösseren, sauber aufgebauten Ordnungs-Systems.',
    user_summary: '📂 Neues Pflanzen-Dossier: Ernten, Diagnosen, Foto-Vergleiche, Scans & Tagebuch automatisch pro Pflanze gebündelt.',
    user_items: [
      { emoji: '📂', text: '„Dossier"-Button in jeder Pflanzen-Karte' },
      { emoji: '🔗', text: 'Automatische Verknüpfung — kein manuelles Einsortieren' },
      { emoji: '🧺', text: 'Ernten + Diagnosen + Foto-Diffs + Scans + Tagebuch an einem Ort' },
    ],
    items: [
      {emoji:'🔗', bold:'Intelligente Verdrahtung (Backend):', text:' fn_plant_dossier sammelt serverseitig alles zu einer Pflanze — verknüpft per Pflanzen-ID (direkt) oder Art (fuzzy). SECURITY DEFINER + own-only + 4 Perf-Indizes. Transaktional verifiziert (RLS-isoliert).'},
      {emoji:'📂', bold:'Dossier-Ansicht (Frontend):', text:' gsOpenPlantDossier → Übersichts-Chips + Ernten-/Diagnosen-Liste. 📂-Button pro Pflanzen-Karte.'},
      {emoji:'⏭️', bold:'Nächster Schritt:', text:' Smart-Sammlungen (eigene Ordner + Auto-Vorschläge) → v28.24. Eins nach dem anderen, sauber aufgebaut.'},
    ]
  },
  {
    v: 'v28.22', date: '06.06.2026',
    headline: '🛡️ Deine Daten sicher — Pflanzen gehen nie mehr verloren + Home aufgeräumt',
    summary: 'Wichtiger Schutz gegen Datenverlust: Falls die App nach dem Speichern einer Pflanze sofort neu lädt (oder die Geräte-Uhr ungenau ist), wird deine zuletzt gespeicherte Pflanze jetzt garantiert behalten — eine ältere/kleinere Cloud-Version kann deine lokale, neuere Liste nicht mehr überschreiben. Ausserdem ist die Startseite aufgeräumt: die Kategorien-Kacheln sind weg (Kategorien findest du weiter über die Suche und den Pflanzen-Tab).',
    user_summary: '🛡️ Schutz: zuletzt gespeicherte Pflanze geht nie mehr verloren · 🏠 Home aufgeräumt (Kategorien-Kacheln weg).',
    user_items: [
      { emoji: '🛡️', text: 'Datenverlust-Schutz: neuere lokale Liste wird nie von älterer Cloud überschrieben' },
      { emoji: '🌱', text: 'Zuletzt gespeicherte Pflanze bleibt sicher sichtbar' },
      { emoji: '🏠', text: 'Startseite: Kategorien-Kacheln entfernt' },
    ],
    items: [
      {emoji:'🛡️', bold:'P0 Count-Guard:', text:' Beim Sync ersetzt eine kleinere Cloud-Liste die grössere lokale nie, solange ungepushte Änderungen vorliegen (schützt vor Boot-Race + Geräte-Uhr-Abweichung). Logik 7-fach verifiziert. Doku PERSISTENCE_AUDIT_v28.22.md.'},
      {emoji:'🏠', bold:'Home-Cleanup:', text:' Kategorien-Sektion raus, Zähler-Setter abgesichert. Kategorie-Browsing via Suche/Pflanzen/Wissen.'},
      {emoji:'⏭️', bold:'Nächste Sprints:', text:' Marktplatz-Tutti-Vollausbau (Verkauft-Ordner/E-Mail/Admin-Archiv) → v28.23 · Tools-Bearbeiten-Modus → v28.24.'},
    ]
  },
  {
    v: 'v28.21', date: '04.06.2026',
    headline: '🌿 Community in der Leiste + Home neu: Live-Marktplatz & Wisch-Karten',
    summary: 'Die untere Leiste hat jetzt 🌿 Community statt 🔍 Suche (die Suche erreichst du weiter oben im Menü). Auf der Startseite siehst du neu „🛒 Aktive Inserate · Live" — die neuesten Marktplatz-Angebote in Echtzeit; tippe drauf und du bist im Marktplatz. Und die Tages-Karten (Tagesinfo, Saison-Tipp, Wusstest-du, Bauernregel) sind jetzt zu einem Stapel zusammengefasst, durch den du wie auf dem iPhone seitlich wischst — mit Pünktchen unten und automatischem Weiterblättern.',
    user_summary: '🌿 Community in der Navi-Leiste · 🛒 Live-Marktplatz auf der Startseite · 📱 Wisch-Karten-Stapel (iPhone-Style).',
    user_items: [
      { emoji: '🌿', text: 'Untere Leiste: Community statt Suche (Suche bleibt im Menü)' },
      { emoji: '🛒', text: 'Startseite zeigt aktive Marktplatz-Inserate live' },
      { emoji: '📱', text: 'Tages-Karten als Wisch-Stapel mit Pünktchen' },
    ],
    items: [
      {emoji:'🌿', bold:'Nav-Tausch:', text:' Bottom-Nav 🔍 Suche → 🌿 Community. Suche weiter via Menü-Suche + Mehr-Menü + Universal-Suche.'},
      {emoji:'🛒', bold:'Live-Marktplatz-Karte:', text:' Top-5 aktive Inserate (60s-Cache, Empty/Loading/Error-States), Klick → Marktplatz bzw. Inserat-Detail. Ersetzt „Jetzt gute Zeit für…".'},
      {emoji:'📱', bold:'Swipe-Widget-Stack:', text:' 4 Tages-Karten als iPhone-Style-Stapel (native CSS scroll-snap, Touch+Trackpad), Pagination-Dots, Auto-Rotation (pausiert bei Interaktion), reduced-motion-safe, merkt sich die Karte. Mock-DOM-verifiziert.'},
    ]
  },
  {
    v: 'v28.20', date: '04.06.2026',
    headline: '🌿 Lina ersetzt den alten KI-Chat + Marktplatz-Härtung',
    summary: 'Im Menü öffnet der KI-Eintrag jetzt direkt Lina — deinen freundlichen, kostenlosen Garten-Coach (statt des alten Experten-Chats). Auch in der Suche, Hilfe und FAQ heisst es jetzt überall „Lina". Ausserdem haben wir den Marktplatz weiter abgesichert: Lade-Fehler werden jetzt sichtbar gemeldet statt still verschluckt, und die Datenbank-Sicht hinter den Anzeigen wurde auf den strengeren, datenschutz-konformen Modus umgestellt — damit ist die Datenbank jetzt komplett ohne Sicherheits-Fehler.',
    user_summary: '🌿 Lina ersetzt den alten KI-Chat überall · Marktplatz abgesichert · 0 Datenbank-Sicherheitsfehler.',
    user_items: [
      { emoji: '🌿', text: 'Menü/Suche/Hilfe/FAQ öffnen jetzt Lina (gratis Garten-Coach)' },
      { emoji: '🛒', text: 'Marktplatz: Lade-Fehler werden sichtbar gemeldet' },
      { emoji: '🔒', text: 'Datenbank-Sicherheit: 0 Fehler (letzter behoben)' },
    ],
    items: [
      {emoji:'🌿', bold:'Lina-Replace (7 Stellen):', text:' Menü, Universal-Suche, Help, Feature-Liste, About, Chip, FAQ → gsOpenLina. Alter Elena-Chat bleibt dormant im Code (kein Datenverlust), nur entlinkt.'},
      {emoji:'🛒', bold:'Marktplatz B-012:', text:' Root-Cause war der v27.04-Token-Bug (gefixt v28.10). Härtung: v_marketplace_listings → security_invoker (RLS autoritativ, profiles public-read trägt seller_name) + Lade-Fehler via gsToast. Transaktional verifiziert.'},
      {emoji:'🔒', bold:'Security-Advisor 0 ERRORs:', text:' Der View-Flip war der letzte ERROR. Audit konsolidiert in AUDIT_v28.20.md. Backlog B-013: native-Dialog-Sweep (Hard-Lesson #2).'},
    ]
  },
  {
    v: 'v28.19', date: '04.06.2026',
    headline: '👵 Senioren-Modus — grössere Schrift, grössere Tasten, mehr Kontrast',
    summary: 'Neu in den Einstellungen unter „Darstellung": der Senioren-Modus. Ein Tipp genügt, und Beschriftungen werden grösser, die Bedien-Elemente (Tasten, Schalter) bekommen mehr Fläche zum Antippen, und die graue Hilfstext-Schrift wird kontrastreicher und besser lesbar. GreenScan soll Mensch und Natur verbinden — für jedes Alter. Die Einstellung bleibt gespeichert und gilt auch auf deinen anderen Geräten.',
    user_summary: '👵 Neuer Senioren-Modus (Einstellungen → Darstellung): grössere Schrift & Tasten, mehr Kontrast.',
    user_items: [
      { emoji: '🔠', text: 'Grössere Beschriftungen & besser lesbarer Hilfstext' },
      { emoji: '👆', text: 'Grössere Tasten & Schalter (leichter zu treffen)' },
      { emoji: '🌗', text: 'Mehr Kontrast — auch im Nachtmodus' },
    ],
    items: [
      {emoji:'👵', bold:'Senioren-Modus-Toggle:', text:' applySenior → body.senior, persistent (userPrefs.senior) + geräteübergreifend, Boot-Apply. Mission-treu: Natur für ALLE Altersgruppen.'},
      {emoji:'🎯', bold:'Layout-schonend statt Zoom:', text:' Da die App px-Schriften nutzt, kuratierte Overrides statt riskantem Global-Zoom — Kontrast (--muted), Tap-Targets ≥48px (WCAG 2.5.5), grössere Toggles + Labels.'},
    ]
  },
  {
    v: 'v28.18', date: '04.06.2026',
    headline: '⚡ Performance: schlankere Datenbank-Zugriffsregeln',
    summary: 'Eine unsichtbare, aber wichtige Aufräum-Aktion: Wo die Datenbank bisher mehrere überlappende Zugriffsregeln pro Tabelle prüfen musste, gibt es jetzt jeweils eine zusammengefasste Regel. Das macht Abfragen bei wachsender Nutzerzahl schneller — ohne dass sich am Datenschutz irgendetwas ändert (jede Zusammenfassung wurde nachweislich identisch gehalten und getestet). Keine sichtbare Änderung, nur mehr Tempo unter der Haube.',
    user_summary: '⚡ Datenbank-Zugriffsregeln konsolidiert → schnellere Abfragen bei Skalierung. Datenschutz unverändert.',
    user_items: [
      { emoji: '⚡', text: 'Weniger Regel-Auswertungen pro Abfrage → schneller bei Wachstum' },
      { emoji: '🔒', text: 'Datenschutz/Isolation unverändert (jede Zusammenfassung getestet)' },
    ],
    items: [
      {emoji:'⚡', bold:'13 RLS-Konsolidierungen:', text:' 8 (Tabelle,cmd)-Paare → je 1 OR-gemergte Policy + 5 redundante insert_own gedroppt. Beweisbar semantik-erhaltend, transaktional verifiziert (profiles/marketplace/garden_harvests).'},
      {emoji:'📌', bold:'Bewusst belassen:', text:' admin_write/public_read-Read-Overlap auf Referenz-Tabellen (marginal) + 195 „unused" Indizes (sind FK-/neue Indizes, nur pre-launch ungenutzt — bei Skalierung gebraucht).'},
    ]
  },
  {
    v: 'v28.17', date: '04.06.2026',
    headline: '💬 Marktplatz-Chat in Echtzeit + Ungelesen-Zähler',
    summary: 'Nachrichten im Marktplatz-Chat kommen jetzt in Echtzeit an — du musst nicht mehr warten oder neu laden, die Antwort des anderen erscheint sofort. Und der 📨-Posteingang oben im Marktplatz zeigt jetzt einen roten Zähler mit der Anzahl ungelesener Nachrichten, damit du nichts verpasst. Falls die Echtzeit-Verbindung mal nicht möglich ist, aktualisiert sich der Chat automatisch weiter wie bisher.',
    user_summary: '💬 Marktplatz-Chat in Echtzeit + roter Ungelesen-Zähler auf dem 📨-Posteingang.',
    user_items: [
      { emoji: '⚡', text: 'Neue Nachrichten erscheinen sofort (Echtzeit)' },
      { emoji: '🔴', text: 'Ungelesen-Zähler auf dem Posteingang-Button' },
    ],
    items: [
      {emoji:'⚡', bold:'Echtzeit via WebSocket:', text:' Minimaler Supabase-Realtime-Client (raw WS, Phoenix — kein supabase-js). Strikt additiv: bei Fehler trägt das bisherige 5s-Polling weiter (kein Regress). RLS greift (nur eigene Threads).'},
      {emoji:'🔴', bold:'Ungelesen-Badge:', text:' Gesamt-Zähler auf dem 📨-Button (Summe v_marketplace_conversations.unread_count), aktualisiert beim Marktplatz-Öffnen + nach Lesen.'},
      {emoji:'🗄️', bold:'Backend:', text:' marketplace_messages zur Realtime-Publication (RLS unverändert).'},
    ]
  },
  {
    v: 'v28.16', date: '04.06.2026',
    headline: '📈 Garten-Score-Verlauf — sieh deinen Fortschritt über die Zeit',
    summary: 'Dein Garten-Score (in den Achievements unter „Meine") zeigt jetzt einen Verlauf: eine kleine Balken-Grafik deiner letzten Score-Messungen plus ein Pfeil, ob es seit der ersten Messung auf- oder abwärts ging. So siehst du auf einen Blick, wie sich dein Garten entwickelt. Die Daten werden ohnehin täglich automatisch erfasst — jetzt werden sie auch sichtbar.',
    user_summary: '📈 Neuer Score-Verlauf in den Achievements: Mini-Grafik deiner Garten-Score-Entwicklung + Trend-Pfeil.',
    user_items: [
      { emoji: '📊', text: 'Score-Verlauf als Balken-Sparkline (letzte Messungen)' },
      { emoji: '🎯', text: 'Trend-Pfeil ▲/▼ — auf einen Blick, ob es vorangeht' },
    ],
    items: [
      {emoji:'📈', bold:'Score-Trend-Sparkline:', text:' CSS-Grafik aus garden_score_history (vanilla, kein recharts) in der Garten-Score-Card. Async + fail-safe, blendet sich bei <2 Messpunkten aus. Score-Snapshot wird seit v26.62 täglich automatisch geloggt.'},
      {emoji:'🔍', bold:'Diary-Verifikation:', text:' Das v28.03-„garden_diary 0 Zeilen" geprüft — es ist eine ungenutzte Tabelle; das Tagebuch synct sicher über den Pflanzen-Blob (null-guarded). Kein Bug, bewusst kein Eingriff.'},
    ]
  },
  {
    v: 'v28.15', date: '04.06.2026',
    headline: '🧺 Ernte-Kalender zeigt endlich alle Ernten + reparierte Lösch-Buttons',
    summary: 'Bisher landeten Ernten, die du im Ernte-Tracker erfasst hast, NICHT im Erntekalender (Jahres-Statistik) — der war immer leer, egal wie viel du eingetragen hast. Das ist behoben: Ernte-Tracker, Pflanzen-Detail-Ernte und Erntekalender nutzen jetzt eine gemeinsame Datenquelle. Alte Einträge aus dem früheren separaten Tracker werden automatisch übernommen. Ausserdem haben wir mehrere Lösch- und Aktions-Buttons repariert, die durch einen alten Tippfehler nicht funktionierten (Ernte/Tagebuch/Saatgut löschen, Gebots-Schritte, Saison-Monat).',
    user_summary: '🧺 Erntekalender zeigt jetzt alle Ernten (eine gemeinsame Datenquelle) + reparierte Lösch-/Aktions-Buttons.',
    user_items: [
      { emoji: '📊', text: 'Erntekalender erfasst jetzt alle Ernten — auch die aus dem Ernte-Tracker' },
      { emoji: '🔗', text: 'Eine gemeinsame Ernte-Datenquelle (geräteübergreifend), alte Einträge übernommen' },
      { emoji: '🛠️', text: 'Reparierte Buttons: Ernte/Tagebuch/Saatgut löschen, Gebots-Schritte, Saison-Monat' },
    ],
    items: [
      {emoji:'🧺', bold:'Ernte-Mismatch behoben:', text:' garden_harvests ist jetzt die EINE kanonische Ernte-Tabelle. v_harvest_stats_per_user (Erntekalender) aggregiert sie statt der leeren Alt-Tabelle harvest_log. security_invoker=on → strenge Eigentümer-Isolation (transaktional verifiziert).'},
      {emoji:'🔗', bold:'3 Pfade vereinheitlicht:', text:' Plant-Detail-Ernte, Ernte-Tracker-Widget und der alte Standalone-Tracker schreiben/lesen jetzt dieselbe Quelle. Einmalige, idempotente Migration der Alt-Einträge.'},
      {emoji:'🛠️', bold:'7 Hard-Lesson-#12-Buttons repariert:', text:' onclick mit fehlerhaften JS-Escapes rendere literalen Text → ReferenceError beim Klick. Betroffen: Ernte/Tagebuch/Saatgut-Löschen, Lux-Kalibrierung, Gebots-Schritte, Saison-Monat. Alle restauriert + Stk-Anzeige-Bug im Erntekalender gefixt.'},
    ]
  },
  {
    v: 'v28.14', date: '04.06.2026',
    headline: '⚙️ Aufgeräumte Einstellungen — aufklappbare Gruppen & Suche',
    summary: 'Die Einstellungen sind über die Zeit ziemlich lang geworden. Jetzt sind sie aufgeräumt: Jede der 9 Gruppen lässt sich auf- und zuklappen (Tipp auf den Titel), und ganz oben gibt es eine Suche — tippe z. B. „Nachtmodus", „Push" oder „Sprache" und springst direkt hin. Mit „⇕" klappst du alle Gruppen auf einmal auf oder zu. Welche Gruppen offen sind, merkt sich die App. Nichts wurde versteckt, nur ordentlicher sortiert.',
    user_summary: '⚙️ Einstellungen aufgeräumt: aufklappbare Gruppen + Suchfeld, damit du alles schnell findest.',
    user_items: [
      { emoji: '🔍', text: 'Neue Suche über alle Einstellungen (sticky oben)' },
      { emoji: '📂', text: '9 Gruppen auf-/zuklappbar — Stand wird gemerkt' },
      { emoji: '⇕', text: 'Ein Tipp: alle Gruppen auf einmal auf-/zuklappen' },
    ],
    items: [
      {emoji:'⚙️', bold:'Accordion-Gruppen:', text:' Jeder der 9 Gruppen-Titel ist jetzt ein anklickbarer Header (Chevron). Kollaps-Zustand lokal gemerkt (eigener Key, NICHT in der Cloud-Sync — reiner UI-Zustand). Default: nur „Abo & Premium" offen.'},
      {emoji:'🔍', bold:'Live-Suche:', text:' Filtert Titel + Beschreibung aller Zeilen in Echtzeit, blendet leere Gruppen aus, „keine Treffer"-Hinweis. Admin-Zeilen bleiben für normale Nutzer unsichtbar.'},
      {emoji:'🏷️', bold:'Mission-Korrektur:', text:' Alle verbliebenen „Plus oder Pro"-Texte → „Pro" (Plus gibt es seit v25.38 nicht mehr). Quota-Hinweise nennen zuerst den gratis Weg (eigener Anthropic-Key), dann Pro.'},
    ]
  },
  {
    v: 'v28.13', date: '03.06.2026',
    headline: '🧪 Launch-QA: Stabilität, Tempo & Datenschutz geprüft',
    summary: 'Vor dem grossen Update haben wir die ganze App auf Herz und Nieren geprüft: Datenschutz-Isolation (niemand sieht fremde Daten) transaktional verifiziert, der Datenbank-Sicherheits-Check meldet keine neuen Probleme, und zwei objektive Tempo-/Hygiene-Punkte wurden gefixt (sieben fehlende Datenbank-Indizes für schnellere Abfragen + eine Funktion abgesichert). Keine sichtbare Änderung — die App fühlt sich nur etwas flotter und ist für den Launch geprüft.',
    user_summary: '🧪 Launch-Check bestanden: Datenschutz verifiziert, Datenbank-Abfragen beschleunigt, alles bereit.',
    user_items: [
      { emoji: '🔒', text: 'Datenschutz-Isolation transaktional geprüft (keine fremden Daten sichtbar)' },
      { emoji: '⚡', text: '7 fehlende Datenbank-Indizes ergänzt → schnellere Abfragen' },
      { emoji: '✅', text: 'Sicherheits-Check: keine neuen Probleme' },
    ],
    items: [
      {emoji:'🧪', bold:'Full-App-QA-Sweep:', text:' RLS-Abdeckung 21/21, Privacy-Spot-Check (coach_messages/feature_usage/snapshots/class_submissions = 0 fremde Zeilen), Security-Advisor 0 neue ERRORs. Details in QA_v28.12.md.'},
      {emoji:'⚡', bold:'Perf/Hygiene gefixt:', text:' 7 fehlende FK-Indizes ergänzt (unindexed_foreign_keys → 0) + _gs_parse_ts_flex search_path gepinnt. multiple_permissive_policies-Konsolidierung als eigener Perf-Sprint deferred (kein Blocker).'},
    ]
  },
  {
    v: 'v28.12', date: '03.06.2026',
    headline: '🔔 Mehr hilfreiche Benachrichtigungen — Klassen, Pflanzen-Doktor & Quiz-Duelle',
    summary: 'Drei neue, hilfreiche Benachrichtigungen — alle gratis und einzeln abschaltbar: Schüler:innen werden über neue Klassen-Aufgaben informiert, Lehrkräfte über neue Einreichungen; nach einer Pflanzen-Doktor-Diagnose erinnert dich eine Nachkontrolle nach ~7 Tagen („Wie geht\'s deiner Pflanze?"); und im Quiz-Duell erfährst du, wenn dein Gegner geantwortet hat. Alles respektiert deine Ruhezeiten und die „Stille Tage"-Pause. Du kannst jede Art einzeln im Push-Bereich der Einstellungen ein-/ausschalten.',
    user_summary: '🔔 Neue (gratis, abschaltbare) Benachrichtigungen: Klassen-Aufgaben, Doktor-Nachkontrolle & „Gegner hat geantwortet".',
    user_items: [
      { emoji: '🎓', text: 'Klassen: neue Aufgabe (Schüler:innen) / neue Einreichungen (Lehrkräfte)' },
      { emoji: '🩺', text: 'Pflanzen-Doktor: Nachkontrolle-Erinnerung nach ~7 Tagen' },
      { emoji: '⚔️', text: 'Quiz-Duell: „Dein Gegner hat geantwortet"' },
    ],
    items: [
      {emoji:'🔔', bold:'3 deferred Pushes aktiviert (FREE):', text:' Klassen-Aufgabe/Einreichung (v28.06), Doktor-Follow-up (v26.96), Battle-Antwort (v26.97). Opt-out je Kategorie (3 neue Toggles im Push-Bereich).'},
      {emoji:'🛡️', bold:'Risikoarm gebaut:', text:' Separate Edge-Fn engagement-push-checker (die kritische Frost-Push-Fn bleibt unberührt). Detektion in 4 getesteten SQL-RPCs. Respektiert Ruhezeiten + „Stille Tage" automatisch. Tages-Dedup (kein Spam). Cron alle 3h tagsüber.'},
    ]
  },
  {
    v: 'v28.11', date: '03.06.2026',
    headline: '❓ Bessere Hilfe & FAQ + 🔕 „Stille Tage" für Benachrichtigungen',
    summary: 'Zwei Verbesserungen für mehr Komfort. Die Hilfe-&-FAQ-Seite hat jetzt eine Live-Suche und ist nach Kategorien sortiert (Account, Pflanzen, Garten, Marktplatz, Abo, Privatsphäre, Technisches) mit deutlich mehr Antworten. Beim Feedback hängen wir technische Infos (App-Version, Sprache) automatisch an — du musst nichts selbst eintippen. Und neu kannst du Benachrichtigungen mit einem Klick für 3, 7 oder 14 Tage komplett pausieren („Stille Tage" — perfekt für den Urlaub) und jederzeit wieder aktivieren. Alle Benachrichtigungen bleiben gratis.',
    user_summary: '❓ FAQ mit Suche & Kategorien + 🔕 Benachrichtigungen für den Urlaub pausieren („Stille Tage").',
    user_items: [
      { emoji: '🔎', text: 'Hilfe & FAQ: Live-Suche + Kategorien + mehr Antworten' },
      { emoji: '🔕', text: 'Neu: „Stille Tage" — alle Benachrichtigungen für 3/7/14 Tage pausieren (Urlaub)' },
      { emoji: '💬', text: 'Feedback: App-Version & technische Infos werden automatisch angehängt' },
    ],
    items: [
      {emoji:'❓', bold:'B-010 Hilfe & FAQ:', text:' FAQ mit Live-Suche (filtert Frage+Antwort) + Kategorien (Account/Pflanzen/Garten/Marktplatz/Abo/Privacy/Technisches), 19 Einträge. Feedback-Submit hängt context (Version/UA/Sprache/Plan) automatisch an (war teilweise schon da). Admin-Status läuft über die bestehende KI-Triage (ki_status).'},
      {emoji:'🔕', bold:'B-011 „Stille Tage":', text:' Neues push_subscriptions.pause_until + Settings-Buttons (3/7/14 Tage + „Aktiv"). Enforcement elegant über das bestehende Dedup-Gate fn_push_already_sent_today (bei aktiver Pause → skip ALLE Kategorien in beiden Push-Edge-Fns) — kein riskanter Edge-Fn-Redeploy. Alle Pushes bleiben FREE.'},
      {emoji:'🔜', bold:'Notifications-Audit (Folge-Sprint):', text:' Pflege-Push-Aggregation läuft bereits („N Pflanzen-Aufgaben fällig"), Quiet-Hours aktiv. Offen/empfohlen: Klassen-Pushes für Lehrkräfte, Doktor-Follow-up- & Battle-Pushes aktivieren — als eigener fokussierter Take.'},
    ]
  },
  {
    v: 'v28.10', date: '03.06.2026',
    headline: '🛠️ Marktplatz wieder voll funktionsfähig + Profile überall antippbar + Rezept-Fotos',
    summary: 'Ein Polish-Update mit einem wichtigen Fix: Inserate veröffentlichen ging wegen eines Server-Fehlers nicht mehr — das ist behoben, der Marktplatz funktioniert wieder zuverlässig (mit „✅ veröffentlicht"-Bestätigung). Alte Demo-Inserate wurden aufgeräumt. Ausserdem: In der Quiz-Rangliste, bei Marktplatz-Verkäufern und in Organisations-Mitgliederlisten kannst du jetzt auf den Namen tippen, um das Profil anzusehen (Privatsphäre bleibt geschützt). Und Rezepte & Heilmittel können jetzt Fotos zeigen.',
    user_summary: '🛠️ Marktplatz-Veröffentlichen repariert + Profile per Namen-Tipp öffnen + Fotos bei Rezepten/Heilmitteln.',
    user_items: [
      { emoji: '🛒', text: 'Inserieren funktioniert wieder zuverlässig (Server-Fehler behoben, alte Demo-Inserate entfernt)' },
      { emoji: '👤', text: 'Namen in Rangliste / Marktplatz / Orgs antippen → Profil ansehen (privat bleibt privat)' },
      { emoji: '🖼️', text: 'Rezepte & Heilmittel zeigen jetzt Fotos' },
    ],
    items: [
      {emoji:'🐛', bold:'B-007 (P0) Marktplatz-Token:', text:' Root-Cause „invalid token" lag in der Edge-Fn (createClient(url,userToken)+getUser() ohne Token-Arg → user=null → 401). Fix: marketplace-publish v4 mit sbAdmin.auth.getUser(userToken). + _gsFreshToken gehärtet (kein abgelaufener Token), 4 Demo-Listings archiviert, Marktplatz quota-frei (FREE).'},
      {emoji:'👤', bold:'B-008 Profil-Chips:', text:' Zentraler _gsProfileChip (Name → gsOpenProfile, Privacy server-seitig in fn_profile_view). Verkabelt: Quiz-Rangliste, Marktplatz-Verkäufer, Org-Mitglieder (Feed/Discover waren schon klickbar).'},
      {emoji:'🖼️', bold:'B-009 Rezept-/Heilmittel-Fotos:', text:' photo_urls (additiv) + recipe-photos-Bucket (public-read/admin-write) + Galerie im Detail + Admin-Upload (max 5). FREE-Anzeige für alle.'},
      {emoji:'🔜', bold:'Folgt in v28.11:', text:' Feedback-&-Hilfe-Politur + Benachrichtigungs-Intelligenz (Aggregation, Stille-Tage, Klassen-Pushes).'},
    ]
  },
  {
    v: 'v28.09', date: '03.06.2026',
    headline: '🐛 Last-Polish: KI-Gartenpläne speichern zuverlässig + echte Namen in der Quiz-Rangliste',
    summary: 'Zwei gemeldete Fehler behoben, bevor das grosse Update live geht. (1) Pläne aus dem KI-Gartenplaner — und aus den Balkon-/Waldgarten-Vorlagen — landeten nicht in „Meine Pläne". Ursache: die Speicherung schrieb in nicht mehr existierende Datenbank-Spalten. Jetzt werden alle Pläne zuverlässig gespeichert (Gerät + Cloud, geräteübergreifend) mit klarer „✅ gespeichert"-Bestätigung. (2) Die Tages-Quiz-Rangliste zeigte zufällige Tier-Namen („Pilz-Igel 22") statt des selbst gewählten Profilnamens. Jetzt erscheint überall der echte Anzeigename (sonst „GreenScan-Mitglied"); bestehende Zufallsnamen wurden korrigiert.',
    user_summary: '🐛 Behoben: KI-Gartenpläne werden jetzt zuverlässig gespeichert + Quiz-Rangliste zeigt deinen echten Namen.',
    user_items: [
      { emoji: '🪴', text: 'KI-Gartenpläne (+ Balkon-/Waldgarten-Vorlagen) landen jetzt zuverlässig in „Meine Pläne" — mit Bestätigung' },
      { emoji: '🏆', text: 'Quiz-Rangliste zeigt deinen echten Profilnamen statt zufälligem „Pilz-…"-Namen' },
    ],
    items: [
      {emoji:'🪴', bold:'B-006 (P0) Plan-Save:', text:' Root-Cause = Schema-Drift — Inserts/Reads nutzten nicht-existente Spalten (plan_json/plan_intent/metadata/analysis) ohne user_id → 400 → garden_plans blieb leer. Fix: zentraler `_gsSaveGardenPlanCloud` mit echten Spalten (scan_input/ai_analysis/status) + user_id; client-seitiger Save nach KI-Scan (Edge-Fn persistierte nicht); „Meine Pläne"-Read auf echte Spalten + Mapping; Balkon-/Waldgarten-Adopt repariert; Save-Bestätigungs-Toasts.'},
      {emoji:'🏆', bold:'B-005 (P1) Quiz-Name:', text:' `fn_quiz_leaderboard_top` joint jetzt live `profiles.display_name` (Fallback „GreenScan-Mitglied", nie Random/Email); `fn_quiz_leaderboard_upsert` generiert keinen Zufallsnamen mehr (zieht aus profiles); Bestandsdaten („Pilz-…") einmalig gesynct.'},
    ]
  },
  {
    v: 'v28.08', date: '03.06.2026',
    headline: '🏫 Organisationen mit eigenem Look — Onboarding & Whitelabel',
    summary: 'Der Abschluss des grossen Organisations-Updates: Wer eine Organisation (Schule, Kurs, Verein, Botanischer Garten) leitet, kann ihr jetzt ein eigenes Gesicht geben — Logo, Akzent-Farbe, Kurzbeschreibung und Website. Nach dem Erstellen führt dich eine kleine Anleitung durch die nächsten Schritte (Logo & Farbe setzen, Mitglieder einladen, Klasse erstellen). Alles bleibt komplett kostenlos. Damit ist die Organisations- & Bildungs-Welt von GreenScan rund: Orgs → Klassen → Aufgaben → Lina, alles miteinander verbunden.',
    user_summary: '🏫 Organisationen individuell gestalten (Logo, Farbe, Info) + geführtes Onboarding — gratis.',
    user_items: [
      { emoji: '🎨', text: 'Org-Branding: Logo, Akzent-Farbe, Beschreibung & Website setzen (✏️ in der Org-Ansicht)' },
      { emoji: '🎉', text: 'Geführtes Onboarding nach dem Erstellen — die nächsten Schritte auf einen Blick' },
      { emoji: '🔒', text: 'Nur Owner/Admin können bearbeiten; Eingaben server-seitig geprüft (sichere Farben & Links)' },
    ],
    items: [
      {emoji:'🎨', bold:'Whitelabel:', text:' fn_org_update (owner/admin) für Name/Bio/Logo/Website/Akzent-Farbe — server-validiert (#RRGGBB + http(s), kein Injection-Risiko). Akzent-Balken + Logo + Website-Link in der Org-Ansicht.'},
      {emoji:'🎉', bold:'Onboarding:', text:' Nach dem Erstellen führt eine Next-Steps-Karte zu Branding → Mitglieder einladen → Klasse erstellen.'},
      {emoji:'🏁', bold:'Block v28 komplett:', text:' Multi-Tenant → Tier/Quotas → Lehrer-Dashboard → Lina → Onboarding/Whitelabel. Alle Bildungs-/Org-Features FREE, datenschutzfreundlich, mission-treu (keine Sales-Bremse).'},
    ]
  },
  {
    v: 'v28.07', date: '03.06.2026',
    headline: '🌿 Lina ist da — deine kostenlose Garten- & Natur-Coachin',
    summary: 'Lerne Lina kennen: deine herzliche KI-Coachin für Garten, Pflanzen, Kräuter, Pilze und alles rund um die Natur. Stell ihr einfach deine Fragen im Chat („Wie pflege ich meinen Basilikum?", „Welche Wildkräuter sind jetzt essbar?", „Was kann ich im Juni säen?") — sie antwortet warm, praktisch und auf den Schweizer Kontext bezogen. Lina ist für ALLE komplett gratis und fragt nie nach Geld. Eure Gespräche werden sicher gespeichert und sind nur für dich sichtbar; du kannst sie geräteübergreifend fortsetzen. Du findest Lina in den Einstellungen unter „🌿 Lina — dein Garten-Coach".',
    user_summary: '🌿 Neu: Lina, deine kostenlose Garten- & Natur-Coachin im Chat — warm, praktisch, immer gratis.',
    user_items: [
      { emoji: '🌿', text: 'Lina-Chat: frag alles zu Garten, Pflanzen, Kräutern, Pilzen & Saison (Einstellungen → 🌿 Lina)' },
      { emoji: '💚', text: 'Für alle gratis — Lina fragt nie nach Geld, kein Verkaufsdruck' },
      { emoji: '🔒', text: 'Deine Gespräche sind privat (nur für dich) & werden geräteübergreifend gespeichert' },
    ],
    items: [
      {emoji:'🌿', bold:'Lina (FREE):', text:' Mission-getriebener Garten-Coach (callAI mit Lina-System-Prompt). Der Prompt verbietet jeglichen Verkaufsdruck explizit — Lina nennt nie Preise/Abo, fragt nie nach Geld, bei Giftigkeit immer vorsichtig (sichere Bestimmung, Verwechslungsarten).'},
      {emoji:'🗄️', bold:'Backend:', text:' coach_conversations + coach_messages, RLS own-only (transaktional verifiziert: andere sehen 0). Geräteübergreifend gespeichert. Cleanup-Cron.'},
      {emoji:'🚦', bold:'Faire Quota:', text:' Free 10 Lina-Antworten/Tag (server-seitig via v28.05-Quota, lina-Bucket) — reine API-Kosten-Bremse, KEINE Sales-Bremse. Limit-Meldung bleibt warm + nennt die kostenlose BYO-Key-Alternative.'},
    ]
  },
  {
    v: 'v28.06', date: '03.06.2026',
    headline: '🎓 Lehrer-Dashboard: Klassen, Aufgaben & automatischer Fortschritt',
    summary: 'GreenScan wird klassenzimmer-tauglich — komplett gratis. Lehrkräfte (in einer Organisation: Schule, Kurs, Verein) können Klassen anlegen, Schüler:innen treten mit einem Klassen-Code bei, und Lehrkräfte stellen Aufgaben („Scanne 5 Pflanzen", „Spiele 3 Quiz-Duelle", „Lies einen Wissens-Artikel"). Der Fortschritt aktualisiert sich automatisch aus den ganz normalen App-Aktivitäten der Schüler:innen — niemand muss etwas extra abhaken. Datenschutz steht im Zentrum: Schüler:innen sehen nur ihre eigenen Aufgaben, Lehrkräfte nur die eigenen Klassen, und es werden keine sensiblen Daten preisgegeben (nur Name im Org-Kontext + Erledigt-Quote).',
    user_summary: '🎓 Neu: Klassen + Aufgaben mit automatischem Fortschritt für Schulen, Kurse & Vereine — gratis, datenschutzfreundlich.',
    user_items: [
      { emoji: '🧑‍🏫', text: 'Lehrkräfte: Klassen anlegen + Aufgaben stellen (Einstellungen → 🎓 Klassen)' },
      { emoji: '🎒', text: 'Schüler:innen: mit Klassen-Code beitreten, Aufgaben & eigener Fortschritt auf einen Blick' },
      { emoji: '⚙️', text: 'Fortschritt zählt automatisch (Scannen/Quiz/Lesen) — kein manuelles Abhaken nötig' },
    ],
    items: [
      {emoji:'🎓', bold:'Klassen & Aufgaben:', text:' Baut auf den Organisationen (v28.01) auf. 4 Tabellen (org_classes/class_members/class_assignments/class_submissions) + 7 RPCs. Aufgaben-Typen: Pflanzen scannen, Quiz-Duelle, Artikel lesen, Erfolg freischalten, Manuell.'},
      {emoji:'🔒', bold:'Privacy-zentral:', text:' RLS rekursionsfrei (DEFINER-Helper). Schüler:innen sehen NUR eigene Submissions, Lehrkräfte nur eigene Org-Klassen, Klassen-Code wird Schüler:innen nie gezeigt. Transaktional verifiziert (Fremd-Org/Schüler-Zugriff geblockt, kein Daten-Leak).'},
      {emoji:'⚙️', bold:'Auto-Progress:', text:' fn_class_sync_my_progress berechnet den Fortschritt aus scan_events/quiz_battles/knowledge_progress/user_achievements — monoton steigend, „erledigt" bleibt erhalten.'},
    ]
  },
  {
    v: 'v28.05', date: '03.06.2026',
    headline: '💎 Faire Tageskontingente + neue „Mein Plan"-Übersicht',
    summary: 'GreenScan bekommt ein durchdachtes, faires Tier-System. Die kostenlosen KI-Funktionen (Pflanzen-Scan, Pflanzen-Doktor, Wachstums-Analyse) haben jetzt großzügige Tageskontingente, die zuverlässig serverseitig zählen — als reine Kosten-Bremse für den geteilten KI-Schlüssel, NICHT als Verkaufstrick. Wer mehr möchte, hinterlegt einen eigenen Anthropic-Key (komplett gratis & unbegrenzt) oder unterstützt GreenScan freiwillig mit Pro/Lifetime. Neu in den Einstellungen: „💎 Mein Plan" zeigt deinen Tarif und deine heutigen Kontingente transparent an. Identische Re-Scans und alle Natur-Features bleiben gratis; Lina bleibt für alle frei.',
    user_summary: '💎 Faire, großzügige Tageskontingente für die KI-Funktionen (serverseitig, kein Verkaufsdruck) + neue „Mein Plan"-Übersicht in den Einstellungen.',
    user_items: [
      { emoji: '💎', text: 'Neu: „Mein Plan" in den Einstellungen — Tarif + heutige Frei-Kontingente auf einen Blick' },
      { emoji: '🌿', text: 'Großzügige Tageslimits für Scan/Doktor/Wachstums-Analyse (faire Kosten-Bremse, keine Sales-Masche)' },
      { emoji: '🔑', text: 'Eigener Anthropic-Key = komplett unbegrenzt & gratis (Alternative zu Pro/Lifetime)' },
    ],
    items: [
      {emoji:'💎', bold:'Tier-System + Quotas (Pfad C, additiv):', text:' Server-seitige Per-Feature-Tagesquota (`feature_usage` + `fn_quota_consume`/`peek`) — zählt zuverlässig, nicht durch Cache-Löschen umgehbar. Bestehende `feature_limits`-Config erweitert (kein Parallel-System). Free-Limits großzügig (Scan 15/Tag, Doktor 5, Wachstums-Analyse 3); Pro/Lifetime unbegrenzt.'},
      {emoji:'🌿', bold:'Mission-Leitplanken:', text:' Quota = API-Kosten-Bremse, KEINE Sales-Bremse. Warme Sprache („heute viel entdeckt!"), keine FOMO/Dark-Patterns, Abo mit 2 Klicks kündbar, BYO-Key-Alternative klar genannt. Identische Re-Scans (Cache-Treffer) kosten keine Quota.'},
      {emoji:'⚙️', bold:'Technik:', text:' `gsQuotaPeek` (Gate vor dem Call) + `gsQuotaConsume` (nach Erfolg) in callAI/callVisionAI via `opts.quotaFeature` (rückwärts-kompatibel). Cleanup-Cron. Backend transaktional + Advisor-geprüft (0 neue ERRORs).'},
    ]
  },
  {
    v: 'v28.04', date: '03.06.2026',
    headline: '🧹 Aufgeräumt: nur noch Anthropic-Claude-KI + stabilerer Key',
    summary: 'Ein Stabilitäts- und Aufräum-Update. GreenScan nutzt für alle KI-Funktionen (Scanner, Pflanzen-Doktor, Garten-Planer) jetzt ausschliesslich die Anthropic-Claude-KI — alle alten NVIDIA-Verweise und -Optionen wurden entfernt, was die App einfacher und konsistenter macht. Dabei haben wir auch einen versteckten Fehler behoben, bei dem die App intern noch fälschlich „NVIDIA" als Standard-Anbieter annahm. Die API-Key-Einrichtung, die Hinweise beim Scannen und die FAQ zeigen jetzt durchgehend nur noch Anthropic. Weitere Stabilitäts-Verbesserungen (schnelleres/günstigeres Scannen durch Caching, Key-Status-Anzeige) folgen im nächsten Update.',
    user_summary: '🧹 KI läuft jetzt einheitlich über Anthropic Claude — alle NVIDIA-Reste entfernt, ein versteckter Standard-Anbieter-Fehler behoben, Key-Einrichtung & FAQ vereinheitlicht.',
    user_items: [
      { emoji: '🤖', text: 'Alle KI-Funktionen einheitlich über Anthropic Claude (NVIDIA komplett raus)' },
      { emoji: '🐛', text: 'Versteckter Fehler behoben: App nahm intern noch „NVIDIA" als Standard-Anbieter an' },
      { emoji: '🔑', text: 'API-Key-Einrichtung, Scan-Hinweise & FAQ durchgehend auf Anthropic vereinheitlicht' },
      { emoji: '⚡', text: 'Dasselbe Foto nochmal scannen? Ergebnis kommt jetzt sofort (Cache) — ohne erneuten KI-Aufruf' },
      { emoji: '🔑', text: 'Neue Einstellungs-Zeile „KI-Dienst-Status" zeigt, ob der Schlüssel gültig ist' },
    ],
    items: [
      {emoji:'🤖', bold:'NVIDIA-Removal (Block B):', text:' Der NVIDIA-Code-Pfad war bereits seit v24.18 deaktiviert — übrig waren UI-Reste + ein Default-Bug. Entfernt: Provider-Default `||\'nvidia\'`→`\'anthropic\'`, NVIDIA-Option im Key-Modal, „build.nvidia.com"-Hinweise (Scan-UI + FAQ), updateApiHelp-Branch, Admin-Key-Placeholder, CSP-Eintrag `*.nvidia.com`.'},
      {emoji:'✅', bold:'Verify:', text:' Keine aktiven NVIDIA-Referenzen mehr (nur die Auto-Migration die alte Keys aufräumt + die Versions-Historie bleiben) · CSP NVIDIA-frei · 7/7 node --check OK. _gsClaudeFallbacks bestätigt Anthropic-only.'},
      {emoji:'⚡', bold:'Scan-Cache (Block A):', text:' Wird dasselbe Foto erneut gescannt, kommt das Ergebnis sofort aus dem Cache — ohne erneuten KI-Aufruf (schneller + günstiger). Technik: 64-bit dHash des Bilds, Treffer NUR bei exakt identischem Bild (kein Verwechslungs-Risiko bei einer Giftpflanzen-App), nur bei Einzelbild-Scans, Bild selbst wird NIE gespeichert (nur der Hash + die Bestimmung). Server: scan_cache-Tabelle + fn_scan_cache_put (DEFINER) + 30-Tage-Cleanup.'},
      {emoji:'🔑', bold:'KI-Dienst-Status (Block C):', text:' Neue Einstellungs-Zeile zeigt, ob der zentrale KI-Schlüssel gültig ist (🟢/🟡/🔴) — täglich automatisch geprüft.'},
      {emoji:'🪙', bold:'Token-Optimierung (prompt-caching):', text:' Der grosse, bei jedem Scan identische Experten-Instruktions-Block wird als Anthropic `system` mit cache_control gesendet → ab dem 2. Scan in 5 Min werden ~90% dieser Tokens aus dem Cache bedient (günstiger + schneller), OHNE Qualitätsverlust. Bewusst KEIN Bild-Verkleinern/Prompt-Kürzen — das würde bei einer Giftpflanzen-App die Bestimmungs-Genauigkeit opfern. Live verifiziert (cache_read 5462 Tokens).'},
      {emoji:'🔜', bold:'Folgt in v28.05+:', text:' Durchdachtes Plan-System (Free/Pro/Lifetime) mit fairen Tageslimits, weiterer Marktplatz- & Community-Feinschliff.'},
    ]
  },
  {
    v: 'v28.03', date: '03.06.2026',
    headline: '🔎 Grosser App-Check + Standort-Wahl fürs Wetter + Hilfe-FAQ',
    summary: 'Wir haben die ganze App systematisch durchleuchtet — alle 8 Bereiche (Marktplatz, Community, die KI-Tools, Meine Pflanzen, Mein Garten, Einstellungen, Feedback/Hilfe, Gartenwissen) auf Backend und Frontend geprüft. Ergebnis: keine blockierenden Fehler mehr (0 P0). Direkt umgesetzt: Du kannst jetzt in den Einstellungen wählen, welcher Standort fürs Wetter verwendet wird — automatisch (dein aktueller Ort), dein fixer Garten, oder manuell. Die Karte nutzt weiterhin Live-GPS. Ausserdem gibt es jetzt eine Hilfe- & FAQ-Sektion mit Antworten auf die häufigsten Fragen. Tiefergehende Verbesserungen sind dokumentiert und kommen in den nächsten Updates.',
    user_summary: '🔎 Kompletter App-Check (8 Bereiche, 0 blockierende Fehler) + neue Wetter-Standort-Wahl (auto/Garten/manuell) + Hilfe & FAQ in den Einstellungen.',
    user_items: [
      { emoji: '✅', text: 'Systematischer Audit aller 8 App-Bereiche — keine blockierenden Bugs mehr' },
      { emoji: '🌦️', text: 'Wetter-Standort frei wählbar: Automatisch · Mein Garten · Manuell (Karte bleibt Live-GPS)' },
      { emoji: '❓', text: 'Neue Hilfe- & FAQ-Sektion mit den häufigsten Fragen' },
    ],
    items: [
      {emoji:'🔎', bold:'Phase A — Audit (FULL_APP_AUDIT_v28.03.md):', text:' Alle 8 Bereiche Frontend+Backend dokumentiert mit P0/P1/P2-Findings. Backend-Cross-Check: 23 Tabellen, 3 Views, 10 Kern-RPCs, 5 Crons LIVE. 0 P0 über alle Bereiche.'},
      {emoji:'🌦️', bold:'Standort tri-modal (Quick-Fix B6):', text:' Helper gsGetLocationFor(context) + Settings-Picker „Wetter-Standort". Karte=Live, Mein Garten=fix, Wetter=deine Wahl.'},
      {emoji:'❓', bold:'Hilfe & FAQ (Quick-Fix B7):', text:' 6-Item-FAQ (Daten-Sicherheit, Preise, Karten-Funde, Pflanze hinzufügen, Org beitreten, Feedback) unter Einstellungen.'},
      {emoji:'🏛️', bold:'Hard-Lesson #14 in Aktion:', text:' Ein vermeintlicher Ernte-Bug entpuppte sich beim Code-Check als zwei bewusst getrennte Systeme — statt riskantem Schnell-Fix sauber für später dokumentiert.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · keine DB-Migration · tiefere Verbesserungen für v28.07+ gesammelt. Grösster Audit-Sprint des Projekts.'},
    ]
  },
  {
    v: 'v28.02', date: '03.06.2026',
    headline: '🛠️ Hotfix: Marktplatz-Inserate gehen wieder + aufgeräumte Community',
    summary: 'Wichtige Korrekturen. Der Marktplatz-Bug ist behoben: Beim Erstellen eines Inserats kam „invalid Token" — Ursache war ein abgelaufenes Sitzungs-Token, das nicht automatisch erneuert wurde. Jetzt wird das Token vor dem Veröffentlichen automatisch aufgefrischt; bei wirklich abgelaufener Sitzung kommt eine klare Meldung statt eines kryptischen Fehlers. Der Marktplatz bleibt komplett gratis für alle. Veraltete Demo-/Vorlagen-Inserate sind raus — du siehst nur noch echte Angebote. Ausserdem ist die Community aufgeräumt und privater: kein „Mitglieder entdecken"-Massenverzeichnis mehr, in dem man durch alle Profile blättern kann. Stattdessen ein Folge-Feed mit den Aktivitäten der Leute, denen du folgst, ein Meilensteine-Tab, und eine gezielte Personen-Suche. Profile öffnest du per Klick auf den Avatar im Feed.',
    user_summary: '🛠️ Marktplatz-„invalid Token"-Bug behoben (Token-Auto-Refresh), Demo-Inserate raus, Marktplatz bleibt gratis. Community privater: kein Mitglieder-Verzeichnis mehr — Folge-Feed + gezielte Suche.',
    user_items: [
      { emoji: '🛒', text: 'Marktplatz-Inserate erstellen funktioniert wieder (Token-Auto-Refresh) — gratis für alle' },
      { emoji: '🧹', text: 'Demo-/Vorlagen-Inserate entfernt — nur noch echte Angebote' },
      { emoji: '🔒', text: 'Community privater: kein „Mitglieder entdecken"-Verzeichnis mehr' },
      { emoji: '📰', text: 'Folge-Feed + 🏆 Meilensteine + gezielte 🔍 Personen-Suche; Profil via Avatar-Klick' },
    ],
    items: [
      {emoji:'🐛', bold:'Root-Cause Marktplatz-Bug:', text:' saveListing rief die Edge-Fn marketplace-publish mit einem roh gelesenen, evtl. abgelaufenen Token ohne Refresh (sbFetch refresht intern, der direkte Aufruf nicht). Neuer Helper _gsFreshToken() frischt vor dem Call auf — auch für Stripe-Checkout/Portal eingesetzt. Klare „Sitzung abgelaufen"-Meldung als Fallback.'},
      {emoji:'🆓', bold:'Marktplatz gratis verifiziert:', text:' Kein Abo-Gate auf dem Marktplatz (Free-für-alle bestätigt). Vorlagen/Demo-Listings entfernt.'},
      {emoji:'🔒', bold:'Community-Redesign (Privacy):', text:' „Mitglieder entdecken"-Massenliste raus. Following-Feed als Standard, Meilensteine-Tab, Suche nur explizit (ab 2 Zeichen, kein Durchblättern). Profile nur via Avatar-Klick/Suchtreffer.'},
      {emoji:'💳', bold:'Stripe:', text:' Modell ist Free + Pro + Lifetime (Plus existiert nicht mehr, seit v25.38 entfernt). Checkout/Portal token-robust. Aufräumen veralteter Server-Funktionen als Wartungsaufgabe vermerkt.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js OK · keine DB-Migration (reiner Frontend-Fix). Akut-Hotfix vor dem B2B-Programm.'},
    ]
  },
  {
    v: 'v28.01', date: '03.06.2026',
    headline: '🏢 Organisationen: GreenScan für Schulen, Kurse & Vereine',
    summary: 'Der Start eines grossen neuen Kapitels: GreenScan kann jetzt auch in Gruppen genutzt werden. Du kannst eine Organisation erstellen (Schule, Universität, Kurs, Botanischer Garten, Gemeinschaftsgarten, Verein) oder einer per 8-stelligem Einladungs-Code beitreten. Jede Organisation hat klare Rollen (Inhaber, Admin, Lehrer, Schüler, Betrachter). Deine privaten Pflanzen, Pläne und Funde bleiben dabei strikt getrennt von Org-Inhalten — Datenschutz steht im Zentrum. Du findest alles unter Einstellungen → „🏢 Organisationen". Lehrer-Dashboard, Klassen und Abos folgen in den nächsten Updates.',
    user_summary: '🏢 Erstelle eine Organisation oder tritt per Code bei — mit Rollen (Inhaber/Admin/Lehrer/Schüler) und strikt getrennten privaten Daten. Unter Einstellungen → Organisationen.',
    user_items: [
      { emoji: '🏫', text: 'Organisation erstellen: Schule, Uni, Kurs, Botanischer Garten, Verein' },
      { emoji: '🔑', text: 'Per 8-stelligem Einladungs-Code beitreten (gültig 14 Tage)' },
      { emoji: '👥', text: 'Rollen: Inhaber · Admin · Lehrer · Schüler · Betrachter — mit Rollen-Verwaltung' },
      { emoji: '🔒', text: 'Strikte Datenisolierung: private Daten bleiben getrennt von Org-Inhalten' },
    ],
    items: [
      {emoji:'🗄️', bold:'Backend (Migration v28_01_multitenant_foundation):', text:' 4 Tabellen (organizations, org_members mit 5 Rollen, org_invites mit 14-Tage-Ablauf, org_audit_log) + RLS auf allen + 7 RPCs (create/invite_create/invite_redeem/my_orgs/org_detail/member_set_role/leave) + Public-Directory-Funktion.'},
      {emoji:'🛡️', bold:'Sicherheit & Privacy (4 Spec-Korrekturen):', text:' (1) RLS-Rekursion vermieden via SECURITY-DEFINER-Helper (sonst Postgres-Fehler). (2) Kein Org-Leak: members-only statt „jede aktive Org öffentlich lesbar". (3) Stripe-IDs gar nicht auf der Org-Tabelle (kommen in v28.03 service-role-only). (4) Letzter-Inhaber-Schutz auch gegen direkten DELETE.'},
      {emoji:'✅', bold:'Verify (transaktional, Rollback):', text:' Org erstellen→Inhaber, Invite-Code 8-stellig, Beitreten→Rolle, Mitglieder-Detail leakt KEINE Stripe-ID, Letzter-Inhaber-Verlassen blockiert, Directory sichtbar, Rekursions-Test ohne Fehler. Advisor 0 neue ERRORs · 7/7 node --check OK.'},
      {emoji:'🖥️', bold:'Frontend:', text:' Einstellungen → „🏢 Organisationen": Liste, Neue-Org-Formular, Beitreten-per-Code, Org-Detail mit Mitglieder-Liste + Rollen-Dropdown (für Admin/Inhaber) + Einladungs-Code-Erzeugung + Org-verlassen.'},
      {emoji:'🔜', bold:'Als Nächstes:', text:' v28.02 Lehrer-Dashboard (Klassen + Aufgaben) · v28.03 Org-Abos + Personal-AI-Coach „Lina" · v28.04 Onboarding-Wizard + Whitelabel. Sprint 1/4 — Fernando deployt nach v28.04 GREEN.'},
    ]
  },
  {
    v: 'v27.04', date: '03.06.2026',
    headline: '✨ Politur: Battle fortsetzen, Vorschläge ausblenden & mehr',
    summary: 'Der letzte Feinschliff für die neuen Funktionen. Wichtigste Verbesserung: Wenn die App während eines Quiz-Battles neu lädt oder abstürzt, geht dein Fortschritt nicht mehr verloren — du bekommst beim Start ein „Battle fortsetzen?"-Angebot und machst genau da weiter, wo du warst. Ausserdem kannst du Pflanzen-Vorschläge auf der Startseite jetzt mit einem ✕ ausblenden („nicht interessiert") — dann rücken neue nach. Und wichtige Aktionen geben jetzt spürbares haptisches Feedback.',
    user_summary: '✨ Battle nach Reload fortsetzen, Startseiten-Vorschläge ausblenden (✕ → Rotation) und haptisches Feedback bei wichtigen Aktionen.',
    user_items: [
      { emoji: '⚔️', text: 'Quiz-Battle nach App-Reload/Absturz fortsetzen statt von vorn' },
      { emoji: '✕', text: 'Startseiten-Vorschläge ausblenden („nicht interessiert") → neue rücken nach' },
      { emoji: '📳', text: 'Haptisches Feedback bei Folgen, Blockieren & Backup' },
    ],
    items: [
      {emoji:'⚔️', bold:'Battle-Reload-Resilienz (v26.97):', text:' Der Battle-Fortschritt wird jetzt nach jeder Antwort lokal gesichert (sessionStorage). Reload/Crash → Boot-Banner „Battle fortsetzen?" → weiter bei der aktuellen Runde. Bisher war der Zustand nur im Speicher → verloren bei Reload.'},
      {emoji:'🏠', bold:'Startseiten-Vorschläge (v26.89):', text:' Pro Vorschlag ein ✕-Button („nicht interessiert"); die Liste lädt jetzt mehr Kandidaten und rotiert nach dem Ausblenden. Merkt sich die Auswahl lokal.'},
      {emoji:'📳', bold:'Haptik:', text:' Folgen/Blockieren/Backup geben spürbares Feedback.'},
      {emoji:'🧹', bold:'Backlog abgeschlossen:', text:' Push-Log-Aufräumen (>30 Tage) lief bereits seit v27.01. Follow-up- & Battle-Antwort-OS-Pushes bewusst zurückgestellt (brauchen Server-Cron — die In-App-Hinweise Doktor-Banner & ⚔️-Badge gibt es bereits).'},
      {emoji:'✅', bold:'Verify:', text:' Reiner Frontend-Polish (keine Migration) · 7/7 Inline-Scripts node --check OK · sw.js OK. FINALE des Blocks v27.01→v27.04 — höchste Version, Marker auf v27.04. Fernando: EIN DEPLOY_FULL.command deployt jetzt v27.01-v27.04 gemeinsam live.'},
    ]
  },
  {
    v: 'v27.03', date: '03.06.2026',
    headline: '⚙️ Einstellungen: zuverlässiger gespeichert & geräteübergreifend',
    summary: 'Deine Einstellungen werden jetzt sauberer und schneller gespeichert — und syncen zuverlässig zwischen deinen Geräten. Bisher konnte ein Setting, das du auf dem Handy änderst, eine Änderung auf dem Mac überschreiben (oder umgekehrt), weil immer der ganze Einstellungs-Block ersetzt wurde. Jetzt werden Änderungen einzeln zusammengeführt (Deep-Merge), schneller gespeichert (nach 0,8 statt 2 Sekunden) und bei Verbindungsproblemen bis zu 3× automatisch erneut versucht. Im Hintergrund haben wir ausserdem zwei „stille" Fehler gefunden und behoben, die seit Monaten unbemerkt waren: eine nie aktivierte Text-Absicherung und eine Wetter-Warnungs-Aktualisierung, die bei Standort-Wechsel nie lief.',
    user_summary: '⚙️ Einstellungen speichern jetzt zuverlässiger (Deep-Merge statt Überschreiben), schneller und mit Auto-Retry — plus 2 stille Hintergrund-Bugs behoben.',
    user_items: [
      { emoji: '🔀', text: 'Einstellungen werden geräteübergreifend zusammengeführt statt überschrieben' },
      { emoji: '⚡', text: 'Schnelleres Speichern (0,8 s) + 3× Auto-Retry bei Verbindungsproblemen' },
      { emoji: '🛠️', text: '2 stille Bugs behoben (Text-Escaping + Wetter-Refresh bei Standort-Wechsel)' },
    ],
    items: [
      {emoji:'🏛️', bold:'Architektur-Realität (Hard-Lesson #14):', text:' Spec-Tabelle user_prefs existiert nicht — echte Tabelle user_preferences (structured cols + units jsonb + prefs jsonb). Der bisherige REST-Upsert ERSETZTE den prefs-Blob komplett → Cross-Device-Teil-Edits gingen verloren.'},
      {emoji:'🗄️', bold:'Backend (Migration v27_03_user_prefs_save):', text:' RPC fn_user_prefs_save(jsonb) — upsert mit COALESCE-erhaltenden Spalten + prefs = prefs || patch (atomarer jsonb-DEEP-MERGE). REVOKE anon/PUBLIC + GRANT authenticated. Keine konfliktären neuen Spalten.'},
      {emoji:'🔄', bold:'Frontend:', text:' gsPrefsPushNow nutzt jetzt die Deep-Merge-RPC, Debounce 2000→800 ms, 3× Retry bei Netzwerk-Fehler, Sync-Status-Update. Pull-Pfad unverändert.'},
      {emoji:'🐛', bold:'Hard-Lesson #9 (2 silent Aliases gefixt):', text:' gsHTMLEscape war als Alias dokumentiert aber NIE definiert (8+ Sites nahmen den Fallback) → jetzt definiert. gsBroadcastLocationChange rief gsLoadGardenWeather (echter Name gsLoadGardenWeatherAlerts) → Wetter-Alerts refreshten nie bei Standort-Wechsel → gefixt + Karten-Funde-Refresh ergänzt. 6 weitere Guards als harmlose Fallbacks verifiziert.'},
      {emoji:'✅', bold:'Verify:', text:' Migration angewandt + RPC verifiziert · SETTINGS_AUDIT_v27.03.md im Repo (vollständige Toggle-Karte) · Advisor 0 NEUE ERRORs · 7/7 Inline-Scripts node --check OK. NICHT: Settings-UI-Teardown, Senior-Mode. Sprint 3/4 (v27.01→v27.04).'},
    ]
  },
  {
    v: 'v27.02', date: '03.06.2026',
    headline: '🌿 Community: Profile, Folgen & Privatsphäre-Kontrolle',
    summary: 'GreenScan wird sozial — aber du behältst die volle Kontrolle. Du kannst jetzt die Profile anderer Mitglieder ansehen (Avatar, Bio, Region, Statistiken, Achievement-Vitrine), ihnen folgen und in einem Folge-Feed sehen, was sie freischalten, finden oder anbieten. Über „👥 Mitglieder entdecken" in der Community findest du beliebte Mitglieder und kannst nach Namen suchen. Deine Privatsphäre ist zentral: in den Einstellungen unter „👤 Profil & Privatsphäre" legst du fest, ob dein Profil öffentlich, nur für Follower oder privat ist — und einzeln, ob Pflanzen-Anzahl, Erfolge, Marktplatz-Angebote und öffentliche Funde sichtbar sind. Nie sichtbar: deine Pläne, privaten Funde, Tagebuch, Pflege-Aufgaben, Doktor-Diagnosen und E-Mail. Du kannst Mitglieder blockieren und melden.',
    user_summary: '🌿 Sieh dir Profile an, folge Mitgliedern und steuere per Sichtbarkeits-Einstellungen genau, was andere von dir sehen. Blockieren & Melden inklusive.',
    user_items: [
      { emoji: '👤', text: 'Profile mit Avatar, Bio, Region, Statistiken & Achievement-Vitrine' },
      { emoji: '➕', text: 'Mitgliedern folgen + Folge-Feed (Erfolge · öffentliche Funde · Angebote)' },
      { emoji: '🔒', text: 'Sichtbarkeit: öffentlich / nur Follower / privat + 5 Einzel-Toggles' },
      { emoji: '🚫', text: 'Blockieren & Melden — Blockierte sehen dich nicht mehr (beidseitig)' },
    ],
    items: [
      {emoji:'🗄️', bold:'Backend (Migration v27_02_community):', text:' profiles +9 Spalten (avatar_url, profile_visibility, 4× show_*, opt_in_feed, region, bio_emoji). Tabellen user_follows (RLS read-all + own-write) + user_blocks (owner-only RLS gegen Stalking). 7 RPCs.'},
      {emoji:'🛡️', bold:'Privacy server-seitig (fn_profile_view):', text:' Block-Check beidseitig → kein View. Visibility public/followers_only/private. Statistiken NUR bei Opt-In. Der View gibt NIE E-Mail, Pläne, Tagebuch, private Funde, Pflege-Tasks oder Doktor-Diagnosen zurück. fn_follow_toggle / fn_block_toggle (Block löst Follow beidseitig) / fn_user_search / fn_user_discover / fn_following_feed / fn_blocked_list — alle block-gefiltert.'},
      {emoji:'🏛️', bold:'Architektur-Realität (Hard-Lesson #14):', text:' Spec-Annahmen korrigiert — profiles.bio existierte bereits + avatar_emoji (nicht avatar_url); user_achievements hat achievement_slug + unlocked_at (KEIN tier) → Feed filtert über rarity statt tier; bestehender avatars-Bucket statt neuem.'},
      {emoji:'🖥️', bold:'Frontend:', text:' gsOpenProfile (Privacy-aware Modal), Follow/Block/Report, gsOpenCommunity (🔎 Entdecken mit Suche+Vorschlägen / 📰 Feed) + Entry-Buttons im Community-Screen, gsOpenProfileSettings (Sichtbarkeit + Bio + Region + Toggles + Blocked-Liste) als neue Settings-Row.'},
      {emoji:'✅', bold:'Verify:', text:' Migration angewandt + 9 Spalten/2 Tabellen/4 Policies/7 RPCs verifiziert · Advisor 0 NEUE ERRORs (3 DEFINER-Fns own-only-WARN erwartet) · 7/7 Inline-Scripts node --check OK. NICHT in v27.02: DMs, Posts/Stories, Likes/Kommentare. Sprint 2/4 (v27.01→v27.04) — Fernando deployt EINEN Mega-Deploy nach v27.04 GREEN.'},
    ]
  },
  {
    v: 'v27.01', date: '03.06.2026',
    headline: '💾 Datensicherheit: Nie wieder verlorene Pflanzen, Pläne & Funde',
    summary: 'Der wichtigste Fix dieses Updates: Deine Daten gehen nie wieder durch ein App-Update verloren. Bisher konnten in seltenen Fällen Pflanzen, Pläne oder Funde nach einem Update verschwinden — die Ursache war ein Wettlauf beim Start, bei dem versehentlich „leer" in die Cloud geschrieben wurde. Das ist jetzt mehrfach abgesichert: leere Cloud-Daten überschreiben deine vorhandenen Daten NIE mehr, und vor jedem Update wird automatisch ein vollständiges Cloud-Backup erstellt. Wenn dein Browser-Speicher mal geleert wird, bietet GreenScan dir beim Start an, alles aus dem Backup wiederherzustellen. Zusätzlich gefixt: das Speichern von Karten-Funden in die Cloud — das hat bisher gar nicht funktioniert (es fehlte die Nutzer-Zuordnung), jetzt landen alle Funde zuverlässig in deinem Konto und sind geräteübergreifend da.',
    user_summary: '💾 Deine Daten sind jetzt sicher: automatisches Cloud-Backup vor jedem Update, Wiederherstellen-Funktion bei Speicher-Verlust und der gefixte Funde-Cloud-Speicher (geräteübergreifend).',
    user_items: [
      { emoji: '🛡️', text: 'Pflanzen, Pläne & Funde gehen nach Updates nicht mehr verloren (Empty-Clobber- & Boot-Race-Schutz)' },
      { emoji: '☁️', text: 'Automatisches Cloud-Backup vor jedem Update + täglich — wiederherstellbar per Banner beim Start' },
      { emoji: '📍', text: 'Karten-Funde werden jetzt korrekt in der Cloud gespeichert (war 0 Funde) — geräteübergreifend' },
      { emoji: '⚙️', text: 'Neu in den Einstellungen: „Cloud-Backup & Sync" mit Status + manuellem Sichern' },
    ],
    items: [
      {emoji:'🔍', bold:'Diagnose (9-Agenten-Audit + DB-Pre-Flight):', text:' map_user_finds hatte 0 Zeilen total — Funde wurden NIE in die Cloud gespeichert. user_plants hatte 2 von 4 Zeilen mit leerem Pflanzen-Array — realer, aktiver Datenverlust. Vollständige Save/Pull-Karte aller Domains in PERSISTENCE_MAP_v27.01.md.'},
      {emoji:'📍', bold:'Funde-Cloud-Fix:', text:' gsAddMarker POSTete ohne user_id → RLS-INSERT (with_check user_id=auth.uid()) + NOT-NULL scheiterten lautlos (trotz Erfolgs-Toast). Fix: user_id ins Payload, lat/lng defensiv via Number()/isFinite, Skip wenn keine User-ID. Cross-Device-Pull via gsLoadMarkersFromCloud beim Karten-Öffnen.'},
      {emoji:'🛡️', bold:'Datenverlust-Fix (Defense-in-Depth):', text:' (1) PULL-Empty-Guard: eine leere Cloud-Collection überschreibt populated local NIE mehr — stattdessen wird die Cloud repariert (Re-Push). (2) PUSH-Boot-Race-Guard: window._gsInitialSyncDone verhindert leere plants/garden-Pushes vor dem ersten erfolgreichen Pull (das war die Hauptursache — Boot setzt myPlants=[], ein früher Flush schrieb das in die Cloud).'},
      {emoji:'🗄️', bold:'Backend (Migration v27_01_persistence_safeguard):', text:' Tabelle user_state_snapshots (kompletter User-Content als ein jsonb-Backup, max 3/User, RLS own-only). RPCs fn_user_snapshot_create/list/latest + fn_cleanup_user_snapshots (Hard-Lesson #13: REVOKE anon/PUBLIC + GRANT authenticated; Maintenance-Fns authenticated-revoked). fn_cleanup_old_data v3: + push_send_log (>30 Tage) + Snapshot-Cleanup. User-Content (Pflanzen/Pläne/Funde/Diary/Achievements/Doktor/Foto-Diff/Battles) sakrosankt — nie automatisch gelöscht.'},
      {emoji:'🖥️', bold:'Frontend-Schutznetz:', text:' Snapshot-Engine (gsSnapshotBuildState/Create/Restore), Restore-Banner beim Start (Speicher leer + Cloud-Backup → „💾 Daten wiederherstellen?"), Auto-Sync alle 5 Min + täglicher Snapshot, Pre-Update-Snapshot beim „Neu laden" des Update-Banners (max 2.5s, blockiert nie), neue Settings-Row „Cloud-Backup & Sync" mit Live-Status.'},
      {emoji:'✅', bold:'Verify:', text:' Migration angewandt + Tabelle/4 RPCs/RLS/cleanup-v3 verifiziert · Advisor 0 NEUE ERRORs (einzige ERROR pre-existing v_marketplace_listings) · 7/7 Inline-Scripts node --check OK · sw.js OK. P0-Sprint, erster von 4 (v27.01→v27.04) — 6 Versions-Marker auf v27.01 (Fernando deployt EINEN Mega-Deploy nach v27.04 GREEN).'},
    ]
  },
  {
    v: 'v27.00', date: '02.06.2026',
    headline: '🌦️ Wetter-Warnungen: Frost, Hitze & Sturm rechtzeitig aufs Handy',
    summary: 'GreenScan warnt dich jetzt aktiv vor kritischem Wetter für deinen Garten — alle 3 Stunden prüft der Dienst deinen Standort. Du bekommst eine Push-Benachrichtigung, wenn in den nächsten Stunden Frost (≤ 2°C), Hitze (≥ 30°C) oder Sturm/Starkregen droht. In den Einstellungen wählst du, welche Warnungen du willst (🥶 Frost · 🥵 Hitze · 🌪️ Sturm/Starkregen) und wie viel Vorlauf (2 – 48 Stunden) du haben möchtest. Über „🌦️ Wetter-Warnungen ansehen" öffnest du eine Inbox mit allen aktuellen Warnungen, die du als gesehen markieren oder entfernen kannst. Kritische Lagen (z.B. strenger Frost) erreichen dich auch während der Stille-Zeit.',
    user_summary: '🌦️ Aktiviere Wetter-Warnungen und werde bei Frost, Hitze oder Sturm rechtzeitig erinnert — mit einstellbarem Vorlauf (2 – 48 h) und einer Inbox mit allen aktuellen Warnungen.',
    user_items: [
      { emoji: '🥶', text: 'Frost-, 🥵 Hitze- und 🌪️ Sturm-/Starkregen-Warnungen einzeln einschaltbar' },
      { emoji: '⏱️', text: 'Vorlauf frei wählbar (2 – 48 h) — Standort-Check alle 3 Stunden' },
      { emoji: '📥', text: '„Wetter-Warnungen ansehen": Inbox mit Gesehen/Entfernen — Kritisches auch in der Stille-Zeit' },
    ],
    items: [
      {emoji:'🗄️', bold:'Backend (Migration v27_00_weather_alerts):', text:' push_subscriptions +3 additive Spalten (notify_heat, notify_storm, alert_lead_hours). Neue Inbox-Tabelle weather_alerts (alert_type frost/heat/storm + severity info/warning/critical CHECK, title/body/temps/metric/valid_until/pushed/acknowledged/dismissed; RLS own-only SELECT+UPDATE via (SELECT auth.uid()), service_role INSERT). Shared weather_forecast_cache (grid 0.1°, 3h TTL, RLS ohne Policy → nur service_role). RPCs fn_weather_alert_ack (DEFINER, own-only ack/dismiss) + fn_weather_alerts_unread (Badge-Count) — anon EXECUTE revoked.'},
      {emoji:'🔌', bold:'Edge-Fn weather-alert-checker v1 (NEU) + Cron 0 */3:', text:' Pro Subscription mit GPS-Koordinaten → Open-Meteo (Temperatur/Niederschlag/Böen, forecast_days=2) via Grid-Cache; windowMetrics über die kommenden alert_lead_hours; Schwellen Frost ≤2°C, Hitze ≥30°C, Sturm Böen ≥60 km/h oder Regen ≥12 mm/h (kritisch bei -3°C / 34°C / 90 km/h / 25 mm). Inbox-Row immer (Dedup pro Typ im Fenster), Push nur ausserhalb der Stille-Zeit (Kritisches override) und entkoppelt-dedupt über fn_push_already_sent_today (kein Doppel mit daily-push-checker).'},
      {emoji:'🏛️', bold:'Architektur-Realität (Hard-Lesson #8):', text:' frost_tolerance_c existiert NIRGENDS (weder garden_plantings noch species) → Warnungen sind standort- statt pflanzen-spezifisch. garden_plantings/gardens sind leer (echte Daten in user_gardens.data jsonb), user_prefs existiert nicht (real user_preferences.prefs). Server-Koordinaten kommen aus push_subscriptions.gps_lat/gps_lng (NICHT garden.location=Freitext). daily-push-checker v6 macht bereits Basis-Frost → ergänzt statt ersetzt.'},
      {emoji:'🖥️', bold:'Frontend:', text:' Push-Einstellungen +Toggles 🥵 Hitze / 🌪️ Sturm + Vorlauf-Slider (2 – 48 h). „🌦️ Wetter-Warnungen ansehen"-Button mit ungelesen-Badge. gsOpenWeatherAlerts (Bottom-Sheet, severity-Farben, escaped) + gsWxAck (Gesehen/Entfernen via fn_weather_alert_ack) + gsWxRefreshBadge. Hard-Lesson #12: onclick übergibt nur den Array-Index (window._gsWxAlerts), kein Quote-Escape.'},
      {emoji:'✅', bold:'Verify:', text:' Migration angewandt · 3 Spalten + 2 Tabellen + 2 Policies + 2 RPCs (anon revoked) verifiziert · weather_forecast_cache service-role-only · Cron weather-alert-3h aktiv · Edge-Fn v1 deployed · Advisor ohne neue ERRORs · 7/7 Inline-Scripts node --check OK. FINALE des Mega-Sprints v26.88→v27.00 — höchste Version, daher GS_VERSION/meta/sw.js/_headers jetzt auf v27.00 (gemeinsamer Mega-Deploy durch Fernando).'},
    ]
  },
  {
    v: 'v26.99', date: '02.06.2026',
    headline: '🗓️ Garten-Planer v3: 3-Jahres-Plan, klima-adaptiv & „Was-wäre-wenn"',
    summary: 'Der Garten-Planer denkt jetzt mehrjährig und klima-bewusst. Im Planer legst du in den neuen „🎯 Ambitionen" fest, ob du für 1, 2 oder 3 Jahre planst, welches Schweizer Klima-Szenario (Referenz · wärmer & trockener · feuchtere Sommer) zugrunde liegt und welche Rahmenbedingungen gelten — Budget pro Jahr, Pflege-Stunden pro Woche, Erfahrungsstufe, Bio-only, Permakultur, Haustiere/Kinder. Bei Mehrjahres-Plänen erscheint ein neuer Tab „📆 Mehrjahres" mit Jahres-Reitern, einer Klima-Resilienz-Bewertung, Ernte-Schätzung und einer Mehrjahres-Strategie inkl. Risiken. Mit „🔮 Was-wäre-wenn" rechnest du dieselbe Lage mit anderem Budget, Klima oder Optimismus-Modus durch und siehst die Differenz direkt gegenübergestellt.',
    user_summary: '🗓️ Der Garten-Planer plant jetzt bis zu 3 Jahre voraus, berücksichtigt Schweizer Klima-Szenarien und deine Rahmenbedingungen (Budget, Pflege-Zeit, Erfahrung) — plus ein „Was-wäre-wenn" zum Durchrechnen von Alternativen.',
    user_items: [
      { emoji: '📆', text: '1-, 2- oder 3-Jahres-Plan mit Jahres-Reitern, Resilienz-Score & Ernte-Schätzung' },
      { emoji: '🌡️', text: 'Klima-adaptiv: Referenz, wärmer & trockener oder feuchtere Sommer (CH2018)' },
      { emoji: '🔮', text: '„Was-wäre-wenn": Budget/Klima/Modus ändern und die Differenz sofort sehen' },
    ],
    items: [
      {emoji:'🗄️', bold:'Backend (Migration v26_99_plan_v3):', text:' garden_plans um 6 additive Spalten erweitert (planning_horizon_years 1-3, climate_scenario, constraints jsonb, plan_version, yearly_outputs, what_if_runs) mit CHECK-Constraints. Neue Referenz-Tabelle climate_scenarios_ch (4 CH-Regionen × 3 Szenarien = 12 Seed-Zeilen, CH2018/MeteoSchweiz-orientierte Temp-/Niederschlag-/Frost-Deltas, RLS read-only für authenticated).'},
      {emoji:'🔌', bold:'Edge-Fn garden-scan-analyze v7:', text:' nimmt planning_horizon_years, climate_scenario, constraints und simulation_mode (realistic/optimistic/pessimistic) entgegen (validiert + geklemmt), lädt die passende Klima-Szenario-Zeile (Region fuzzy aus Standort abgeleitet), erweitert das KI-Schema um yearly_outputs[] (Jahr, Pflanzen, Budget/Pflege-Schätzung, Klima-Resilienz-Score, Ertrag) + multi_year_strategy + risks[] und speichert die neuen Spalten beim „als Plan speichern".'},
      {emoji:'🖥️', bold:'Frontend:', text:' Neuer „🎯 Ambitionen"-Abschnitt im Planer (Horizont-/Klima-/Simulations-/Erfahrungs-Segmente via State-Bridge — kein Quote-Escape im onclick, Hard-Lesson #12; Budget/Pflege-Inputs + Bio/Permakultur/Kinder-Checkboxen). Neuer Plan-Tab „📆 Mehrjahres" (nur bei Horizont>1 bzw. vorhandenen yearly_outputs) mit Jahres-Reitern (gsGSPlanYear), Mini-Stats, Resilienz-Balken, Strategie-Karte & Risiken. „🔮 Was-wäre-wenn"-Panel: re-runt die Analyse ohne Speichern mit Overrides (gsGardenScanWhatIfRun) und zeigt eine Δ-Vergleichstabelle (Ertrag/Aufwand); Läufe best-effort in what_if_runs persistiert (max. 20).'},
      {emoji:'🏛️', bold:'Architektur-Realität (Hard-Lesson #8):', text:' Der Planer ist eine Single-Screen-Modal-Flow, kein Multi-Step-Wizard — die in der Spec genannte „Step 3" wurde als Ambitionen-Abschnitt umgesetzt, „Jahres-Sub-Tabs" als zusätzlicher Plan-Tab. Die Edge-Fn wird live betrieben (v7) und bewusst NICHT als TS-Spiegel ins Repo transkribiert (Transkriptions-Fehlerrisiko > Nutzen); die Migration IST gespiegelt (DB-Reproduzierbarkeit).'},
      {emoji:'✅', bold:'Verify:', text:' Migration angewandt + 12 Klima-Zeilen + 6 Spalten + RLS-Policy verifiziert · Edge-Fn als v7 deployed · Advisor ohne neue ERRORs · 7/7 Inline-Scripts node --check OK · GS_VERSION=v26.99 · sw.js gs-v26.99 · _headers v26.99 · meta=26.99.20260602.'},
    ]
  },
  {
    v: 'v26.98', date: '02.06.2026',
    headline: '📸 Foto-Verlauf mit KI-Wachstums-Analyse',
    summary: 'Der Foto-Verlauf deiner Pflanzen kann jetzt mehr: Im „📸 Verlauf" (aus dem Pflanzen-Tagebuch) wählst du zwei beliebige Fotos als Vorher/Nachher aus und lässt sie von der KI vergleichen. Du erhältst eine geschätzte Wachstums-Veränderung in Prozent, die Anzahl neuer Blätter, eine Gesundheits-/Farb-Einschätzung sowie eine kurze Zusammenfassung mit Stärken und möglichen Problemen. Neu ist außerdem ein Zeitraffer-Knopf, der im Einzel-Slider automatisch durch alle Fotos blättert. Eingeloggte Nutzer speichern ihre Analysen geräteübergreifend in ihrem Konto.',
    user_summary: '📸 Im Foto-Verlauf kannst du zwei Fotos vergleichen und von der KI die Wachstums-Veränderung analysieren lassen — plus ein Zeitraffer durch alle Fotos.',
    user_items: [
      { emoji: '🤖', text: 'KI vergleicht zwei Fotos: Wachstum %, neue Blätter, Gesundheit + Zusammenfassung' },
      { emoji: '🗓️', text: 'Vorher/Nachher frei wählbar — beliebige zwei Zeitpunkte vergleichen' },
      { emoji: '⏩', text: 'Zeitraffer-Player blättert automatisch durch den Foto-Verlauf' },
    ],
    items: [
      {emoji:'🗄️', bold:'Backend (2 Migrations):', text:' v26_98_photo_diff legt plant_photo_diffs (RLS own-only, auth.uid() gewrappt, Index user+plant+created_at) + 2 RPCs an: fn_photo_diff_create (DEFINER, days_between server-seitig, plant_id TEXT = jsonb-id) und fn_photo_diff_list (DEFINER, own-only-Filter). v26_98_photo_diff_grants_hardening entzieht anon EXECUTE auf beiden.'},
      {emoji:'🏛️', bold:'Architektur-Realität:', text:' user_plants ist KEIN per-plant-row-Modell (Spec-Annahme), sondern ein per-user jsonb-Blob (data->plants Array). Die in der Spec geplante VIEW v_plant_photo_timeline wäre invalide UND unnötig — alle Fotos liegen client-seitig in myPlants. Daher übersprungen; plant_id ist TEXT, kein FK.'},
      {emoji:'🖥️', bold:'Frontend:', text:' Foto-Timeline (gsBuildPhotoTimelineContent) erweitert: Vorher/Nachher-Dropdowns (frei wählbare A/B-Indizes), „🤖 KI-Wachstums-Analyse"-Button → gsPhotoDiffAnalyze konvertiert beide Fotos via _gsPhotoToB64 (data-URL ODER remote-fetch) und ruft callVisionAI (Foto B als extraImages) mit JSON-Schema-Prompt. Ergebnis-Karten (gsBuildPhotoDiffResult: growth_pct/new_leaves/color_health/summary/highlights/concerns). Zeitraffer-Player (gsPhotoTimelinePlay, 900ms auto-advance). Persist via fn_photo_diff_create (nur eingeloggt, keine data-URLs in DB).'},
      {emoji:'🔌', bold:'Keine neue Edge-Fn:', text:' Bewusst client-seitiges callVisionAI statt separater photo-diff-analyze-Edge-Fn — konsistent mit Scanner/Doktor, nutzt die bestehende einheitliche ai_call-Tagesquota (kein paralleles Monats-Limit).'},
      {emoji:'✅', bold:'Verify:', text:' Advisor ohne neue ERRORs · anon-EXECUTE auf beiden RPCs revoked · RLS ppd_own + 2 Indizes verifiziert · 7/7 Inline-Scripts node --check OK · GS_VERSION=v26.98 · sw.js gs-v26.98 · _headers v26.98 · meta=26.98.20260602.'},
    ]
  },
  {
    v: 'v26.97', date: '02.06.2026',
    headline: '⚔️ Quiz-Battles: 1v1 gegen andere mit ELO-Rangliste',
    summary: 'Das tägliche Quiz bekommt einen Wettkampf-Modus: Über „⚔️ Quiz-Battle" forderst du einen Zufalls-Gegner heraus und spielt 5 Runden Pflanzen-Quiz — asynchron, also jeder antwortet wann er will. Wer mehr Fragen richtig hat, gewinnt ELO-Punkte (Start: 1200) und steigt im Rang. Du siehst deine offenen, laufenden und vergangenen Battles mit Sieg/Niederlage-Bilanz und ELO-Verlauf. Neue Erfolge: „Erster Sieg", „Quiz-Krieger/Champion/Legende" (10/50/200 Siege) sowie ELO-Meilensteine (1300/1500/1800/2200).',
    user_summary: '⚔️ Neuer 1v1-Quiz-Battle-Modus: fordere Zufalls-Gegner über 5 Runden heraus, gewinne ELO-Punkte und steige in der Rangliste — plus neue Battle-Erfolge.',
    user_items: [
      { emoji: '🎲', text: 'Zufalls-Gegner herausfordern — 5 Runden Pflanzen-Quiz, asynchron spielbar' },
      { emoji: '📊', text: 'ELO-Rangliste (Start 1200): Sieg gibt Punkte, Niederlage kostet — fair berechnet' },
      { emoji: '🏆', text: '8 neue Erfolge: Erster Sieg, 10/50/200 Siege + ELO-Stufen 1300–2200' },
    ],
    items: [
      {emoji:'🗄️', bold:'Backend (1 Migration v26_97_quiz_battles):', text:' Tabelle quiz_battles (RLS: Teilnehmer-Read + offene Random-Battles sichtbar, challenger-only INSERT, auth.uid() gewrappt) · profiles +quiz_elo/battles_won/lost/tied · 6 RPCs (DEFINER, anon-revoked): fn_quiz_battle_create + fn_quiz_battle_find_or_create_random (Matchmaker ±250 ELO, FOR UPDATE SKIP LOCKED) + fn_quiz_battle_accept + fn_quiz_battle_submit (wertet 5 Runden, finalisiert bei beiden-fertig) + fn_quiz_battle_list (rollen-relativ) + fn_quiz_battle_get (Fragen OHNE correct_idx = Anti-Cheat) · interne _fn_quiz_battle_finalize (ELO K=32 symmetrisch, ≥100 geklemmt) · 8 achievements_catalog-Stufen · Cron quiz-battles-expire (*/30, abgelaufene → expired).'},
      {emoji:'🏛️', bold:'Architektur-Realität (Hard-Lesson #8):', text:' Es gibt KEINE quiz_questions-Tabelle (Spec-Annahme falsch) — das Tagesquiz generiert Fragen client-seitig via dqBuildQuestion. Daher generiert der Herausforderer die 5 Fragen lokal und reicht sie als jsonb in die Create-RPC. RPCs liefern rollen-relative Daten (your_score/you_won/elo_delta) → das Frontend braucht nie die rohe auth.uid(). updated_at-Spalte ergänzt (Spec-Tabelle hatte sie nicht, RPCs referenzierten sie). Mangels Freundes-System: Random-Matchmaker statt Freund-Challenge.'},
      {emoji:'🖥️', bold:'Frontend:', text:' „⚔️ Quiz-Battle (1v1)"-Button in der Quiz-Karte (mit „du bist dran"-Badge). gsOpenBattles (Liste: Du-bist-dran / Offen / Vergangen) · gsBattleNewRandom (Fragen generieren → Matchmaker → sofort spielen) · gsBattleRenderRound (5 Runden, 30s-Timer + Fortschritts-Bar) · gsBattleSubmit → gsBattleRenderResult (🏆/💔/🤝 + ELO-Delta + Konfetti bei Sieg). Achievement-Hooks gsAchBump(battles_won|quiz_elo, …, p_set=true) idempotent. Hard-Lesson #12: alle dynamischen onclick nur numerische Indizes + State-Bridge (window._gsBattle / _gsBattleList).'},
      {emoji:'🔌', bold:'Bewusst NICHT:', text:' Realtime-WebSocket (rein async), 2v2/Team-Battles, Custom-Quiz, Wagering, sowie Push „dein Gegner hat geantwortet" (würde Edge-Fn-Eingriff erfordern — deferred wie v26.96-Push-Hook; stattdessen ⚔️-Badge in der Quiz-Karte).'},
      {emoji:'✅', bold:'Verify:', text:' Migration angewandt + 8 Funktionen/2 Policies/4 profiles-Spalten/8 Achievement-Stufen/Cron verifiziert · ELO-Logik per Zero-Persistence-Test (RAISE+Rollback): 4:2-Sieg → +16/−16 symmetrisch, Gewinner korrekt · Advisor 0 NEUE ERRORs · 7/7 Inline-Scripts node --check OK. MID-RANGE: KEIN v-Bump — 6 Versions-Marker bleiben v27.00, nur GS_RELEASES-Eintrag + sw.js-Changelog-Note.'},
    ]
  },
  {
    v: 'v26.96', date: '02.06.2026',
    headline: '🩺 Pflanzendoktor v2: Verlauf, Behandlungs-Tracker & Nachfrage nach 7 Tagen',
    summary: 'Der KI-Pflanzendoktor merkt sich jetzt deine Fälle. Nach einer Diagnose dokumentierst du per „💊 Behandlung dokumentieren" was du gemacht hast (umgetopft, Neemöl gesprüht …) und siehst unter „📋 Frühere Diagnosen" den ganzen Verlauf einer Pflanze mit Status (offen, in Behandlung, geheilt, verschlechtert). Die Symptom-Auswahl wird neu aus einer gepflegten Bibliothek geladen (mehr und treffendere Symptome, mehrsprachig). Und nach rund 7 Tagen fragt die App von selbst nach: „Wie geht es deiner Pflanze?" — mit einem Tipp auf 😊 Besser / 😐 Gleich / 😟 Schlimmer hältst du den Heilungsverlauf fest. Die KI bezieht bei Folge-Diagnosen den bisherigen Verlauf derselben Pflanze mit ein.',
    user_summary: '🩺 Der Pflanzendoktor merkt sich jetzt deine Fälle: Behandlungs-Tracker, Diagnose-Verlauf je Pflanze und eine automatische Nachfrage „Wie geht es deiner Pflanze?" nach ~7 Tagen.',
    user_items: [
      { emoji: '💊', text: 'Behandlung dokumentieren — halte fest, was du gegen das Problem getan hast' },
      { emoji: '📋', text: 'Diagnose-Verlauf je Pflanze mit Status (offen · in Behandlung · geheilt · verschlechtert)' },
      { emoji: '🌱', text: 'Automatische Nachfrage nach ~7 Tagen: 😊 Besser / 😐 Gleich / 😟 Schlimmer' },
      { emoji: '🔍', text: 'Mehr & treffendere Symptome aus einer mehrsprachigen Bibliothek' },
    ],
    items: [
      {emoji:'🗄️', bold:'Backend (Migration v26_96_plant_doctor_history):', text:' Rein additiv. plant_doctor_history +species_name +status (open/treating/resolved/worsened/abandoned, CHECK) +followup_due_at +followup_result (better/same/worse/unknown, CHECK) +updated_at; 2 Indizes (user+plant+created, partieller Follow-up-Due-Scan). Neue Tabelle plant_treatment_steps (FK→Diagnose ON DELETE CASCADE, RLS own-only). Neue Tabelle symptom_library (14 Seed-Symptome DE/EN/ES, public read). 5 RPCs: fn_plant_diagnoses_for_plant (Verlauf-Timeline, INVOKER), fn_followup_due (fällige Follow-ups, INVOKER), fn_followup_submit (DEFINER, better→resolved/worse→worsened), fn_treatment_step_add (DEFINER, status open→treating), fn_treatment_steps_for_diagnosis (INVOKER). anon auf den mutierenden RPCs revoked.'},
      {emoji:'🏛️', bold:'Architektur-Realität (Hard-Lesson #8):', text:' Der LIVE-Diagnose-Pfad schreibt bereits nach plant_doctor_history — die in der Spec vorgeschlagene Tabelle plant_diagnoses ist eine verwaiste Experten-Flow-Tabelle (0 Zeilen, inkompatibles Schema). Daher plant_doctor_history additiv erweitert statt eine Parallel-Tabelle zu bauen. user_followup (Alt-Spalte) bleibt unangetastet → die bestehenden Inline-Feedback-Buttons funktionieren weiter.'},
      {emoji:'🔌', bold:'Edge-Fn plant-doctor-diagnose v4:', text:' Speichert species_name + status=open + followup_due_at = now()+7d; akzeptiert plant_name + include_history und lädt bei gesetzter Pflanze die letzten 3 Diagnosen derselben Pflanze als Verlaufs-Kontext in den System-Prompt (Besserung/Verschlechterung erkennen). Bewusst NICHT als TS-Spiegel im Repo (Transkriptions-Fehlerrisiko) — nur die Migration ist gespiegelt.'},
      {emoji:'🖥️', bold:'Frontend:', text:' Symptom-Picker lädt dynamisch aus symptom_library (Fallback: die statischen 8 Chips). gsRunDiagnose reicht plant_name + include_history durch. gsRenderDoctorResult bekommt zwei Buttons: „💊 Behandlung dokumentieren" (gsDoctorAddStep/SaveStep → fn_treatment_step_add) + „📋 Frühere Diagnosen" (gsDoctorShowHistory → fn_plant_diagnoses_for_plant, Status-farbige Timeline). Follow-up-Banner beim Boot (gsDoctorCheckFollowups, 6s nach DOMContentLoaded, Session-Guard pro Tag) → 4-Button-Modal (gsDoctorSubmitFollowup → fn_followup_submit). Hard-Lesson #12: Diagnose-ID via State-Bridge window._gsFollowupDiagId, im onclick nur statische Result-Literale.'},
      {emoji:'✅', bold:'Verify:', text:' Migration angewandt · 5 Spalten + 2 Tabellen + 14 Seed-Symptome + 5 RPCs + Indizes verifiziert · 0 neue Advisor-ERRORs (einzige ERROR v_marketplace_listings ist vorbestehend) · Edge-Fn v4 ACTIVE · 7/7 Inline-Scripts node --check OK. Mid-Range-Sprint: GS_VERSION/meta/sw.js/_headers bleiben auf v27.00 (gemeinsamer Mega-Deploy durch Fernando nach allen 13 Sprints).'},
    ]
  },
  {
    v: 'v26.95', date: '02.06.2026',
    headline: '🏆 Achievements neu: Stufen, Fortschritt, Community-Feed & Teilen',
    summary: 'Die Erfolge-Sammlung ist generalüberholt. Hinter dem 🏆-Widget findest du jetzt zwei Tabs: „🏆 Meine" zeigt alle Achievements nach Kategorie gruppiert (Entdecker, Gärtner, Sammler, Heiler, Weiser, Meilensteine) mit Fortschrittsbalken, Seltenheits-Stufe (gewöhnlich → legendär) und XP-Belohnung — freigeschaltete leuchten farbig, gesperrte zeigen, wie weit du noch bist. Schaltest du eines frei, gibt es Konfetti, einen Toast und automatisch XP. Bis zu fünf Lieblings-Erfolge heftest du per ⭐ in deine Vitrine, und jedes freigeschaltete teilst du per 📤. Der zweite Tab „🌍 Community" zeigt, was andere in den letzten 7 Tagen erreicht haben (ab Stufe „ungewöhnlich"). In den Einstellungen steuerst du, ob deine Erfolge im Feed erscheinen.',
    user_summary: '🏆 Achievements zeigen jetzt Stufen, Fortschrittsbalken und XP — mit Konfetti beim Freischalten, einer ⭐-Vitrine, 📤-Teilen und einem Community-Feed der letzten 7 Tage.',
    user_items: [
      { emoji: '📊', text: 'Alle Erfolge nach Kategorie, mit Fortschrittsbalken, Seltenheit & XP' },
      { emoji: '🎉', text: 'Konfetti + Toast + automatische XP beim Freischalten' },
      { emoji: '🌍', text: 'Community-Feed (7 Tage) · ⭐-Vitrine (max 5) · 📤 Teilen — Feed-Anzeige in Einstellungen abschaltbar' },
    ],
    items: [
      {emoji:'🗄️', bold:'Backend (Migration v26_95_achievements_plus):', text:' Rein additiv auf dem bestehenden flachen achievements_catalog (30 Einträge: condition->>type = Metric, ->>value = Schwelle, rarity = Stufenleiter — kein Tier-Rebuild nötig). profiles +showcase_achievements (text[]) +opt_in_achievement_feed (bool). achievements_catalog +share_template (+generischer Seed). Index idx_user_ach_unlocked. 4 RPCs: fn_achievements_bump (DEFINER, INC/SET pro Metric-Familie, schaltet Stufen idempotent frei, vergibt XP, Capstone master_gardener), fn_achievements_overview (INVOKER, eigener Fortschritt own-only), fn_achievements_feed (DEFINER, 7 Tage/uncommon+/opt-in, anon revoked), fn_achievements_showcase_set (DEFINER, max 5, nur freigeschaltete).'},
      {emoji:'🏛️', bold:'Architektur-Realität (Hard-Lesson #8):', text:' Die Spec-Tabellen (tier_thresholds int[], plural achievements_progress, user_achievements.tier, profiles.full_name/avatar_url/opt_in_feed) existieren NICHT. Real: singular achievement_progress + user_achievements waren beide LEER → das System war faktisch tot. Mehrstufigkeit ist bereits über Metric-Familien + rarity modelliert. Belebt per Bump-Engine statt Rebuild; profiles hat display_name/avatar_emoji.'},
      {emoji:'🖥️', bold:'Frontend:', text:' openAchievementsModal komplett neu — Tabs „🏆 Meine" (Garten-Score-Card + katalog-getriebene Liste, Progress, Seltenheits-Badges, ⭐-Vitrine, 📤-Teilen) + „🌍 Community" (lazy-load Feed). Neue Helfer: gsAchBump (fire-and-forget, Hard-Lesson #10), _gsConfetti (Canvas, respektiert reduced-motion), gsAchUnlockCelebrate, gsAchShare (Web-Share + Clipboard-Fallback), gsAchShowcase. Bump-Calls an echten Erfolgs-Punkten: Pflanze (plant_count SET), Scan (scan_count INC nur bei Neu-Scan), Tagebuch (diary_count SET), Ernte (harvest_count SET), Quiz (quiz_streak SET bei Richtig), Login-Streak (täglich 1×). Hard-Lesson #12: Share/Vitrine-Buttons übergeben nur den Array-Index (window._gsAchOverview), kein Quote-Escape im onclick.'},
      {emoji:'⚙️', bold:'Einstellungen:', text:' Neuer Datenschutz-Toggle „Achievements im Community-Feed zeigen" (gsToggleAchFeed → PATCH profiles.opt_in_achievement_feed, lokal gespiegelt für sofortigen Checkbox-State).'},
      {emoji:'✅', bold:'Verify:', text:' Migration angewandt · 2 profiles-Spalten + share_template + Index + 4 RPCs verifiziert · 3 DEFINER zeigen erwartete own-only-guarded WARN, Overview INVOKER ohne WARN, anon revoked · 0 neue Advisor-ERRORs · 7/7 Inline-Scripts node --check OK. Mid-Range-Sprint: GS_VERSION/meta/sw.js/_headers bleiben auf v27.00 (gemeinsamer Mega-Deploy durch Fernando nach allen 13 Sprints).'},
    ]
  },
  {
    v: 'v26.94', date: '02.06.2026',
    headline: '📚 Gartenwissen: Merken, „Heute neu" & schnellere Suche',
    summary: 'Das Gartenwissen-Portal kann jetzt Lieblings-Einträge merken: Tippe in den Suchergebnissen auf das 🔖-Lesezeichen, und der Eintrag landet unter „🔖 Gespeichert" — geräteübergreifend, weil in deinem Konto gesichert. Neu im Wissens-Kopf: zwei Schnellzugriffe „🆕 Heute neu" (die neuesten Rezepte, Heilmittel, Folklore & Techniken) und „🔖 Gespeichert" (deine Merkliste). Frisch dazugekommene Einträge tragen ein rotes „🆕 NEU"-Abzeichen. Die Suche ist intern auf eine schnellere, lesezeichen-bewusste Variante umgestellt; offline funktioniert sie weiterhin über den lokalen Cache.',
    user_summary: '📚 Im Gartenwissen kannst du Einträge mit 🔖 merken und über „🆕 Heute neu" und „🔖 Gespeichert" schnell wiederfinden. Neue Inhalte sind mit „NEU" markiert.',
    user_items: [
      { emoji: '🔖', text: 'Wissens-Einträge merken — geräteübergreifend in deinem Konto' },
      { emoji: '🆕', text: '„Heute neu" zeigt die frischesten Rezepte, Heilmittel & Techniken' },
      { emoji: '🔍', text: 'Schnellere Suche, weiterhin offline-fähig' },
    ],
    items: [
      {emoji:'🗄️', bold:'Backend (2 Migrations):', text:' v26_94_knowledge_polish legt knowledge_bookmarks + knowledge_progress (Composite-Key source_type+source_id, RLS own-only, auth.uid() gewrappt) an plus 6 RPCs: fn_knowledge_bookmark_toggle, fn_knowledge_bookmarks_list, fn_knowledge_recent („Heute neu", species ausgeschlossen), fn_knowledge_related, fn_knowledge_track_progress, fn_knowledge_search2 (bookmark-aware, is_bookmarked + created_at). v26_94_knowledge_polish_grants_hardening entzieht anon EXECUTE auf den auth-only-Fns.'},
      {emoji:'🏛️', bold:'Architektur-Realität:', text:' Es gibt KEINE Tabelle knowledge_articles (Spec-Annahme). Wissen = VIEW v_knowledge_search (UNION ALL über species/recipes/remedies/folk_lore/garden_techniques). Identität = COMPOSITE (source_type, source_id). Bookmarks/Progress daher auf Composite-Key, kein FK auf Einzeltabelle.'},
      {emoji:'🖥️', bold:'Frontend:', text:' Wissens-Suche nutzt fn_knowledge_search2; geteilter _gsKnResultCard normalisiert Online- UND Offline-Cache-Shape (kind→source_type, snippet→body, score→similarity). 🔖-Toggle als <span> (event.stopPropagation, kein Button-in-Button), nur sichtbar wenn eingeloggt + online. 🆕-NEU-Badge <7 Tage. View-Tracking feuert beim Treffer-Klick (fire-and-forget). Discover-Strip #wissen-discover mit „🆕 Heute neu" + „🔖 Gespeichert". Hard-Lesson #12: source_type/source_id quote-frei → echte Konkatenation im onclick.'},
      {emoji:'✅', bold:'Verify:', text:' Advisor ohne neue ERRORs · anon-EXECUTE auf toggle/track/bookmarks_list revoked · Offline-Hook liest jetzt auch p_q/p_lim · 7/7 Inline-Scripts node --check OK · GS_VERSION=v26.94 · sw.js gs-v26.94 · _headers v26.94 · meta=26.94.20260602.'},
    ]
  },
  {
    v: 'v26.93', date: '02.06.2026',
    headline: '🔔 Push-Benachrichtigungen für Pflege-Aufgaben & Wochen-Rückblick',
    summary: 'GreenScan kann dich jetzt erinnern — auch wenn die App geschlossen ist. Aktiviere die Push-Benachrichtigungen in den Einstellungen, und du bekommst morgens eine Erinnerung, wenn eine Pflege-Aufgabe fällig ist (z.B. „💧 Gießen: Monstera"). Sonntags fasst dir ein Wochen-Rückblick zusammen, was in den nächsten 7 Tagen ansteht. Tippst du auf eine Benachrichtigung, landest du direkt bei deinen Pflanzen. Mit „📨 Test-Push senden" prüfst du sofort, ob alles ankommt. Auf dem iPhone funktionieren Push-Mitteilungen nur, wenn GreenScan über „Zum Home-Bildschirm" installiert ist (iOS 16.4+).',
    user_summary: '🔔 Aktiviere Push-Benachrichtigungen und werde an fällige Pflege-Aufgaben erinnert — plus ein Wochen-Rückblick am Sonntag und ein Test-Knopf zum sofortigen Prüfen.',
    user_items: [
      { emoji: '💧', text: 'Morgens eine Erinnerung, wenn Gießen/Düngen/Umtopfen fällig ist' },
      { emoji: '🗓️', text: 'Sonntags ein Wochen-Rückblick mit den anstehenden Aufgaben' },
      { emoji: '📨', text: '„Test-Push senden" prüft sofort, ob Benachrichtigungen ankommen' },
    ],
    items: [
      {emoji:'🗄️', bold:'Backend (Migration v26_93_plant_tasks_due):', text:' Neuer STABLE-Helper _gs_parse_ts_flex(text) (epoch-ms ≥13 Stellen → /1000, epoch-s, sonst ::timestamptz, exception-safe → NULL). VIEW v_plant_tasks_due (security_invoker) expandiert user_plants.data->plants[].tasks via LATERAL jsonb_each, rechnet next_due_at = last_done + interval_days, liefert is_due_now + task_label (💧 Gießen / 🌿 Düngen / 🔍 Kontrolle / …). RPC fn_plant_task_done(p_plant_id text, p_task_key text) (DEFINER) setzt lastDone per jsonb_set im richtigen Array-Index als ISO-8601-String, REVOKE PUBLIC/anon + GRANT authenticated.'},
      {emoji:'🏛️', bold:'Architektur-Realität (Hard-Lesson #8):', text:' Die komplette Push-Infrastruktur war bereits da — push_subscriptions/push_send_log-Tabellen, VAPID-Keys in app_settings (NICHT als Env-Secret), daily-push-checker (v5) und das ganze v25.26-Push-Frontend. lastDone ist real ein ISO-String, NICHT epoch-ms wie die Spec annahm → der erste View lieferte 0 Zeilen, gefixt via _gs_parse_ts_flex (Dual-Format). Daher gezielt Lücken gefüllt statt neu gebaut.'},
      {emoji:'🔌', bold:'Edge-Functions:', text:' send-push v1 (verify_jwt, self-target via JWT oder Service-Role-Broadcast, 410/404 → Sub-Delete, sonst failure_count++, Erfolg → reset + last_push_sent_at, Log in push_send_log). daily-push-checker v6: neuer plant_tasks-Block (morgens, hourUtc<12, Dedup-Kategorie plant_tasks, einzeln oder gebündelt) + Sonntags-weekly_summary-Block (next_due_at in 7 Tagen), alle Deep-Links auf ?screen= vereinheitlicht.'},
      {emoji:'🖥️', bold:'Frontend:', text:' „📨 Test-Push senden"-Button + gsSendTestPush (prüft Login + aktives Abo, ruft send-push). gsRpcTaskDone spiegelt erledigte Aufgaben best-effort serverseitig (in gsQuickDone + doneTask), damit der Cron exakt weiß, was fällig ist. SW-Push-Handler normalisiert top-level url → data.url (Deep-Link-Fix) + Default-Icon/Badge.'},
      {emoji:'✅', bold:'Verify:', text:' Beide Migrations angewandt · v_plant_tasks_due 6 Zeilen (5 fällig) verifiziert · send-push v1 + daily-push-checker v6 deployed · Advisor ohne neue ERRORs · 7/7 Inline-Scripts node --check OK. Teil des Mega-Sprints v26.88→v27.00 (gemeinsamer Mega-Deploy durch Fernando) — Versions-Marker bleiben auf dem höchsten gebauten Stand (v26.99).'},
    ]
  },
  {
    v: 'v26.92', date: '02.06.2026',
    headline: '🛒 Marktplatz-Politur: Status verwalten, Preisfilter & bessere Suche',
    summary: 'Der Marktplatz wird aufgeräumter und flexibler. Für deine eigenen Inserate gibt es jetzt eine Status-Verwaltung direkt im Inserat: 🟢 Aktiv, 🟡 Reserviert, ✅ Verkauft oder 📦 Archiviert — mit passenden Abzeichen in der Liste, damit Interessenten den Stand sofort sehen. Verkaufte Inserate werden nach 30 Tagen automatisch archiviert. Neu kannst du beim Suchen einen Preis-Bereich (CHF min–max) angeben, und die Volltextsuche findet jetzt auch Inserate, die noch nicht in der Liste geladen waren (serverseitig, deutsch-optimiert). Beim Erstellen sind bis zu 5 Fotos möglich, und du bestimmst per „☆ Haupt" welches Bild das Titelbild wird.',
    user_summary: '🛒 Im Marktplatz verwaltest du den Status deiner Inserate (aktiv/reserviert/verkauft/archiviert), filterst nach Preis, suchst serverseitig im Volltext und lädst bis zu 5 Fotos mit wählbarem Hauptbild hoch.',
    user_items: [
      { emoji: '🏷️', text: 'Eigene Inserate als reserviert/verkauft/archiviert markieren — mit Abzeichen in der Liste' },
      { emoji: '💰', text: 'Preis-Bereich-Filter (CHF min–max) in der Suchleiste' },
      { emoji: '📸', text: 'Bis zu 5 Fotos pro Inserat + „☆ Haupt" zum Festlegen des Titelbilds' },
    ],
    items: [
      {emoji:'🗄️', bold:'Backend (Migration v26_92_marketplace_polish):', text:' marketplace_listings um sold_at erweitert; GIN-FTS-Index idx_marketplace_listings_fts_de (german, title+description). Neue RPCs: fn_marketplace_set_status (owner-only via (SELECT auth.uid()), Status active/reserved/sold/archived, setzt sold_at), fn_marketplace_search (websearch_to_tsquery german + Kategorie/Region/Preis-Range-Filter, nur status=active), fn_marketplace_auto_archive (sold > 30 Tage → archived) — eingehängt als 4. Schritt in fn_cleanup_old_data. View v_marketplace_listings zeigt jetzt active/reserved/sold (für Badges) + sold_at. Edge-Fn marketplace-publish v3: MAX_PHOTOS 3 → 5.'},
      {emoji:'🏛️', bold:'Architektur-Realität (Hard-Lesson #8):', text:' marketplace_listings hat KEINE lat/lng-Spalten (Spec-Annahme falsch) — Distanz bleibt region-basiert (Kanton-Text), kein Haversine. status-Enum kanonisch \'active\' (NICHT \'available\'); photo_urls[], views, status existierten bereits. Seller-Verifikation via profiles.is_expert + display_name (nicht full_name/role). Multi-Foto-Upload + client-seitige Suche/Filter waren bereits vorhanden → nur gezielt erweitert statt neu gebaut.'},
      {emoji:'🖥️', bold:'Frontend:', text:' renderMarket: Status-Badges (🟡/✅/📦), verkaufte/archivierte abgedimmt, archived/reported für Fremde ausgeblendet (eigene bleiben sichtbar), Preis-Range-Filter. Detail-Modal: Status-Chip + Owner-Segment-Steuerung (gsMktSetStatus → RPC, kein Quote-Escape, Hard-Lesson #12). Suche feuert ab 3 Zeichen serverseitig (gsMarketServerSearch, merge + dedup + Race-Token). Erstell-Formular: max. 5 Fotos + „☆ Haupt"-Reorder (gsNlMakeMain).'},
      {emoji:'✅', bold:'Verify:', text:' Migration angewandt · FTS „Tomaten Setzlinge" matcht · set_status liefert not_authenticated ohne Auth · auto_archive=0 · Edge-Fn v3 deployed · 7/7 Inline-Scripts node --check OK. Teil des Mega-Sprints v26.88→v27.00 (gemeinsamer Mega-Deploy durch Fernando) — Versions-Marker bleiben auf dem höchsten gebauten Stand (v26.99).'},
    ]
  },
  {
    v: 'v26.91', date: '02.06.2026',
    headline: '⚡ Schnellere App bei großen Datenmengen',
    summary: 'Reine Performance- und Stabilitäts-Verbesserung im Hintergrund — am Aussehen und an der Bedienung ändert sich nichts. Die Datenbank-Zugriffsregeln (Row Level Security) wurden so umgestellt, dass die Berechtigungsprüfung pro Abfrage nur noch einmal statt einmal pro Datenzeile ausgewertet wird. Für Nutzer mit vielen Pflanzen, Scans, Tagebuch-Einträgen oder Markt-Inseraten heißt das spürbar schnellere Ladezeiten (bei 1\'000+ Einträgen bis zu 50–200× schneller). Es wurden keine Berechtigungen geändert — wer was sehen darf, bleibt exakt gleich.',
    user_summary: '⚡ Die App reagiert schneller, wenn du viele Pflanzen, Scans oder Einträge hast. Rein technische Verbesserung im Hintergrund — Aussehen und Bedienung bleiben gleich.',
    user_items: [
      { emoji: '⚡', text: 'Schnellere Ladezeiten bei großen Datenmengen' },
      { emoji: '🔒', text: 'Keine Änderung an Berechtigungen — alles bleibt so privat wie zuvor' },
    ],
    items: [
      {emoji:'🗄️', bold:'Backend (2 Migrations):', text:' v26_91_rls_wrap_phase2_initplan wrappt auth.uid()/auth.jwt() in 56 RLS-Policies über 33 Tabellen zu (SELECT auth.uid()) (init-plan-Caching, Hard-Lesson #6). v26_91_rls_wrap_phase2_authrole wrappt auth.role() in 3 service-role-only Policies (feature_limits/species_images/species_sources).'},
      {emoji:'🚀', bold:'Wirkung:', text:' Berechtigungsprüfung läuft 1× pro Query statt 1× pro Row — bei 1k+ Rows/User 50–200× schneller. Semantik-erhaltend: identische Truth-Table, keine Zugriffs-Änderung.'},
      {emoji:'✅', bold:'Verify:', text:' Advisor auth_rls_initplan 59 → 0 · 233 Policies total erhalten · 0 ungewrappt verbleibend · 7/7 Inline-Scripts node --check OK · GS_VERSION=v26.91 · sw.js gs-v26.91 · _headers v26.91 · meta=26.91.20260602.'},
    ]
  },
  {
    v: 'v26.90', date: '02.06.2026',
    headline: '🏠🌳 Wohnung & Garten als Umschalter im Pflanzen-Bereich',
    summary: 'Der Pflanzen-Bereich hat jetzt oben einen Umschalter: 🏠 Wohnung zeigt deine Zimmerpflanzen (wie bisher), 🌳 Garten zeigt deine Gärten und Beete direkt auf derselben Seite — du musst nicht mehr ins Menü zu „Mein Garten" wechseln. Jeder Tab zeigt eine Zähler-Plakette mit der Anzahl. Hast du noch keinen Garten, erscheint ein freundlicher Hinweis mit einem großen „Garten anlegen"-Knopf. Welchen Tab du zuletzt offen hattest, merkt sich die App.',
    user_summary: '🏠🌳 Im Pflanzen-Bereich wechselst du jetzt oben zwischen 🏠 Wohnung und 🌳 Garten — beides auf einer Seite, ohne Umweg übers Menü.',
    user_items: [
      { emoji: '🏠', text: 'Wohnung-Tab: deine Zimmerpflanzen wie gewohnt' },
      { emoji: '🌳', text: 'Garten-Tab: Gärten & Beete inline, ein Tipp führt zur vollen Garten-Ansicht' },
      { emoji: '🔢', text: 'Zähler-Plaketten zeigen die Anzahl je Bereich' },
    ],
    items: [
      {emoji:'🏠🌳', bold:'Sub-Tab-Switcher:', text:' Sticky-Leiste #favs-subtabs im Pflanzen-Screen (role=tablist). gsFavsSwitchSub(mode) toggelt #favs-content-indoor (myPlants) ↔ #favs-content-outdoor (gardens/plantings), persistiert den Modus via gsStore (gs_favs_sub_mode), gsHaptic-Feedback.'},
      {emoji:'🌳', bold:'Garten inline:', text:' gsFavsRenderOutdoor() rendert je Garten eine kompakte Karte (echte renderGarden-CSS-Klassen) mit bis zu 5 Beet-Pflanzen, Deep-Link „Alle N in Mein Garten →" (switchTab) und „🌱 Pflanze hinzufügen" (openAddPlanting). Kein Garten → Empty-State mit „Garten anlegen"-CTA. Bewusst nicht-kollabierbar & ohne gexpand-IDs → kein Duplikat-ID-Konflikt mit der vollen Garten-Ansicht.'},
      {emoji:'🔢', bold:'Counts:', text:' gsFavsUpdateSubCounts() hält die Badge-Zahlen (myPlants.length / plantings.length) aktuell — verdrahtet in renderMyPlants, renderGarden & savePlanting. State-Restore über gsFavsInitSub() aus renderFavs.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · GS_VERSION=v26.90 · sw.js gs-v26.90 · _headers v26.90 · meta=26.90.20260602.'},
    ]
  },
  {
    v: 'v26.89', date: '02.06.2026',
    headline: '🌱 Jetzt gute Zeit für… — saisonale Vorschläge auf der Startseite',
    summary: 'Die Startseite zeigt jetzt eine neue Karte „🌱 Jetzt gute Zeit für…" mit bis zu 6 Pflanzen-Vorschlägen, die gerade gut passen — gewichtet nach Beliebtheit (anonymes Popularity-Ranking aus der Pflanzensuche). Ein Klick auf einen Vorschlag öffnet direkt den „Pflanze hinzufügen"-Dialog mit vorbefülltem Namen, Emoji und Kategorie; bei Garten-Arten (Gemüse, Kräuter, Beeren, Bäume …) springt der Standort-Schalter automatisch auf 🌳 Garten/Draußen, sonst auf 🏠 Wohnung. Außerdem sind die Online-Suchvorschläge beim Tippen jetzt direkt mit der Fuzzy-Suche aus v26.88 verdrahtet — Tippfehler-tolerant mit ☁️-Online-Treffern.',
    user_summary: '🌱 Neue Startseiten-Karte „Jetzt gute Zeit für…" mit 6 passenden Vorschlägen — ein Klick füllt den Hinzufügen-Dialog vor und wählt automatisch Wohnung oder Garten.',
    user_items: [
      { emoji: '🌱', text: 'Startseiten-Karte „Jetzt gute Zeit für…" mit bis zu 6 Vorschlägen' },
      { emoji: '👆', text: 'Ein Klick → Dialog vorbefüllt (Name, Emoji, Kategorie) + Standort automatisch' },
      { emoji: '🔥', text: 'Beliebte Arten ranken höher (anonymes Popularity-Ranking)' },
    ],
    items: [
      {emoji:'🌱', bold:'Home-Karte:', text:' Neue Sektion #home-top-picks („Jetzt gute Zeit für…") rendert via gsHomeRenderTopPicks() bis zu 6 Arten aus fn_species_top_picks(p_lim:6) — gewichtet nach species_popularity.pick_count. Beliebte Arten tragen ein 🔥-Badge, sonst die Kategorie.'},
      {emoji:'👆', bold:'1-Klick-Hinzufügen:', text:' gsHomeOpenAddFromPick(idx) öffnet openAddPlant mit vorbefülltem Namen/Emoji/Kategorie. Garten-Kategorien (Gemüse/Kraut/Frucht/Beere/Baum/Strauch/Wildpflanze/Blume) schalten den Standort-Toggle auf Draußen, sonst Wohnung. Pick wird via fn_species_log_pick (2-arg) geloggt.'},
      {emoji:'🔎', bold:'Online-Suche verdrahtet:', text:' Autocomplete nutzt die v26.88-Fuzzy-Suche (_gsRemoteSearch/_gsMergeRemote) — Tippfehler-tolerant mit ☁️-Online-Treffern, lokale DB als Offline-Fallback.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · GS_VERSION=v26.89 · sw.js gs-v26.89 · _headers v26.89 · meta=26.89.20260602.'},
    ]
  },
  {
    v: 'v26.88', date: '02.06.2026',
    headline: '🔎 Tippfehler-tolerante Online-Pflanzensuche',
    summary: 'Die Vorschläge beim Hinzufügen einer Pflanze sind jetzt online viel schlauer: Sie verzeihen Tippfehler und Mehrzahl-Formen (z.B. „tomaten" findet „Fleischtomate", „rosee" findet „Rose") und durchsuchen auch lateinische Namen. Im Hintergrund läuft eine echte Fuzzy-Suche (pg_trgm) über alle Arten der Datenbank, mit 60-Sekunden-Cache für Tempo. Offline bleibt die schnelle lokale Suche wie bisher. Häufig gewählte Arten ranken mit der Zeit höher (Popularity-Ranking) — datenschutzfreundlich nur als anonyme Gesamtzahl, keine Einzel-Suchen werden veröffentlicht.',
    user_summary: '🔎 Online finden die Vorschläge jetzt auch bei Tippfehlern die richtige Pflanze (☁️-Treffer). Offline bleibt die schnelle lokale Suche.',
    user_items: [
      { emoji: '🔡', text: 'Tippfehler-tolerant: „tomaten" → Fleischtomate, „rosee" → Rose' },
      { emoji: '🌐', text: 'Online-Treffer (☁️) mit Vorrang, offline lokale DB als Fallback' },
      { emoji: '⚡', text: 'Schnell dank 60-Sekunden-Cache' },
    ],
    items: [
      {emoji:'🗄️', bold:'Backend:', text:' Migration v26_88_species_search — pg_trgm GIN-Indizes (name+lat), fn_species_search (similarity + word_similarity für Kompositum/Plural, INVOKER), fn_species_log_pick (DEFINER, authenticated-only), fn_species_top_picks. Echtes Schema: species.id=uuid, slug, tox smallint(0-5)→toxic-bool, kein common_name_en/es.'},
      {emoji:'🔒', bold:'Privacy:', text:' species_search_log RLS insert/select-own (privat). Aggregat-Tabelle species_popularity (kein user_id) public-readable. species_search_cache locked (nur service-role). Maintenance-Fns von anon/authenticated revoked (cron-only). 0 neue Security-ERRORs.'},
      {emoji:'☁️', bold:'Edge-Fn species-search v1:', text:' service-role-Wrapper mit 60s-Cache (species_search_cache), CORS, verify_jwt. Frontend _gsRemoteSearch ruft sie (Anon-Key-Bearer-Fallback), _gsMergeRemote merged Online-Treffer mit Vorrang in das Autocomplete-Dropdown.'},
      {emoji:'🧹', bold:'Cron:', text:' species-maintenance-daily 02:15 UTC — fn_refresh_species_popularity (self-heal aus Log) + fn_cleanup_species_search_cache (Cache-Expiry + 90d Log-TTL).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · GS_VERSION=v26.88 · sw.js gs-v26.88 · _headers v26.88 · meta=26.88.20260602.'},
    ]
  },
  {
    v: 'v26.87', date: '02.06.2026',
    headline: '✨ Pflanzen-Vorschläge beim Tippen + klare Wohnung/Garten-Wahl',
    summary: 'Wenn du eine Pflanze hinzufügst, schlägt die App jetzt direkt beim Tippen passende Arten aus der Pflanzen-Datenbank (~4\'342 Arten) vor — mit Emoji, lateinischem Namen, Giftig-Warnung und Kategorie. Ein Klick füllt das ganze Formular vor. Zusätzlich fragt das Formular jetzt zuerst: Soll die Pflanze in die 🏠 Wohnung („Meine Pflanzen") oder in den 🌳 Garten („Mein Garten" mit Beet/Pflege-Plan)? — bei Garten leitet die App automatisch zum passenden Workflow. Pflanzen- und Garten-Karten sind nun smoother (rundere Ecken, weiche Schatten, sanfter Hover-Lift).',
    user_summary: '✨ Tippst du im „Pflanze hinzufügen"-Dialog, kommen sofort Vorschläge — ein Klick und alles ist vorbefüllt. Plus: du wählst zuerst 🏠 Wohnung oder 🌳 Garten, die App leitet dich automatisch richtig.',
    user_items: [
      { emoji: '🔍', text: 'Live-Vorschläge aus 4\'342 Pflanzen während du tippst' },
      { emoji: '🏠🌳', text: 'Klare Wahl: Wohnung („Meine Pflanzen") oder Garten („Mein Garten")' },
      { emoji: '💎', text: 'Layout smoother: rundere Karten, weichere Schatten, sanfter Hover' },
    ],
    items: [
      {emoji:'🔎', bold:'gsPlantSuggest:', text:' debounced 150ms, sucht in window.DB nach Name-Prefix(100)>Contains(80)>Latein-Prefix(60)>Latein-Contains(40)>EN/ES(20), Bonus kürzere Namen. Top-8 Dropdown mit Emoji+Name+Latein+Cat-Tag+Toxisch-Warnung.'},
      {emoji:'🪴', bold:'Wohnung/Garten-Toggle:', text:' Radio-Group in modal-addplant. savePlant() routet bei outdoor → switchTab(garden) + openAddPlanting(firstGardenId) mit Pre-Fill via window._gsPrefillPlanting. Kein Garten? Confirm zum Anlegen.'},
      {emoji:'💎', bold:'Layout-Polish:', text:' .plant-card und .garden-card border-radius 18px, doppelter shadow-layer (.06+.04), cubic-bezier transition 180ms, hover translateY(-1px). Dark-Mode-Anpassung.'},
      {emoji:'⏭️', bold:'Folgt v26.88:', text:' Backend-Edge-Fn species-search mit pg_trgm Fuzzy + Popularity-Ranking (Code-Auftrag in AUFTRAG_CODE_v26.88_SPECIES_SEARCH.md).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · GS_VERSION=v26.87 · sw.js gs-v26.87 · _headers v26.87 · meta=26.87.20260602.'},
    ]
  },
  {
    v: 'v26.86', date: '02.06.2026',
    headline: '🏠 Home zentral + 🌱 Pflanzen direkt aus dem Scan hinzufügen',
    summary: 'Zwei grosse UX-Verbesserungen: Die Haupt-Navigation ist neu sortiert — der Home-Knopf sitzt jetzt mittig und ist deutlich grösser (FAB-Style), so dass er als visueller Anker für „bring mich zurück" funktioniert. Reihenfolge: 📷 Scanner · 🌱 Pflanzen · 🏠 HOME · 🔍 Suche · ⋯ Menü. Zweitens: nach jedem Scan erscheint ein dicker „🌱 Zu meinen Pflanzen hinzufügen"-Button — ein Klick und die erkannte Pflanze landet mit Foto, Name und Pflege-Default in deinem Garten. Auch der Empty-State in „Pflanzen" hat jetzt einen empfohlenen Foto-Scan-Weg.',
    user_summary: '🏠 Der Home-Knopf ist jetzt grösser und mittig — leicht zu finden. 🌱 Nach jedem Scan: 1 Klick und die Pflanze ist mit Foto in deinem Garten.',
    user_items: [
      { emoji: '🏠', text: 'Home-Knopf mittig + grösser (FAB-Style) — der Anker für „nach Hause"' },
      { emoji: '🌱', text: 'Scan → ein Klick → Pflanze in deinem Garten (mit Foto)' },
      { emoji: '📷', text: '„Pflanze scannen"-CTA gross im Empty-State, perfekt für Einsteiger' },
    ],
    items: [
      {emoji:'🎯', bold:'Nav-Anker:', text:' .tab-center Klasse hebt Home mit margin-top:-22px aus der Nav-Bar heraus, 58px Kreis, Grün-Gradient, Box-Shadow 0 4px 14px. Active-State zusätzlich stärker.'},
      {emoji:'🌱', bold:'gsAddScanToMyPlants:', text:' Confidence ≥60 + non-mushroom-Filter → 480x480-Foto in user-plant-photos-Bucket (eingeloggt) oder base64 inline. Default-tasks: water/4d, fertilize/30d, check/14d. Duplikat-Check via Latin-Name/Name+Date.'},
      {emoji:'✨', bold:'Empty-State Senior-Friendly:', text:' renderMyPlants() ohne Pflanzen → grosse CTAs (56px Min-Touch), Scan-Weg „empfohlen"-Badge + sekundärer Manuell-Button.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · GS_VERSION=v26.86 · sw.js gs-v26.86 · _headers v26.86 · meta=26.86.20260602.'},
    ]
  },
  {
    v: 'v26.85', date: '02.06.2026',
    headline: '📋 Funde-Liste zeigt jetzt ALLE Funde (lokal + Cloud)',
    summary: 'Wenn du offline oder nicht eingeloggt einen Pin auf der Karte gespeichert hast, ist er bisher nur lokal gelandet und tauchte in „Meine Funde" nicht auf, sobald du dich einloggtest. Jetzt fliessen lokale und Cloud-Funde zusammen in eine Liste, sortiert nach Datum, und sobald du wieder online + eingeloggt bist, werden deine offline gesammelten Funde automatisch in die Cloud hochgeladen.',
    user_summary: '📋 Egal ob du offline oder eingeloggt warst — alle deine Funde landen jetzt in der Liste. Offline-Funde werden automatisch in die Cloud nachsynchronisiert, sobald du eingeloggt bist.',
    user_items: [
      { emoji: '📋', text: 'Lokale + Cloud-Funde zusammen in einer Liste' },
      { emoji: '☁️', text: 'Auto-Upload offline gesammelter Funde nach Login' },
      { emoji: '💾', text: '„nur lokal"-Badge bis ein Fund in der Cloud ist' },
    ],
    items: [
      {emoji:'🔀', bold:'list()-Merge:', text:' gsMapFinds.list macht jetzt IMMER LS+Cloud-Pull, Dedup via cloud_id, Datums-sortiert. Vorher Entweder-Oder → offline-Funde verschwanden für eingeloggte User.'},
      {emoji:'☁️', bold:'Auto-Upload:', text:' _uploadLocalOnly() läuft im Hintergrund: alle LS-Marker ohne cloud_id werden in map_user_finds gepostet, cloud_id zurück in LS geschrieben. Toast „☁️ X lokale Funde synchronisiert".'},
      {emoji:'🏷️', bold:'Local-Only-Badge:', text:' „💾 nur lokal" (gelblich) im Listen-Eintrag wenn _local_only-Flag → User sieht den Sync-Status.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · GS_VERSION=v26.85 · sw.js gs-v26.85 · _headers v26.85 · meta=26.85.20260602.'},
    ]
  },
  {
    v: 'v26.84', date: '02.06.2026',
    headline: '📍 Karten-Funde Bugfix + 📸 Foto-Feature für Fundorte',
    summary: 'Echte Ursache des seit langem bekannten „Funde werden nicht gespeichert"-Bugs gefunden und behoben: der Speichern-Button im Karten-Popup gab beim Klick falsche String-Werte statt der Koordinaten weiter, dadurch konnte kein Marker korrekt gesetzt oder in die Cloud geschrieben werden. Jetzt landet jeder Pin zuverlässig in localStorage + map_user_finds. Zusätzlich: Du kannst jeden Fund mit einem Foto versehen — entweder direkt beim Speichern (📸 im Popup) oder nachträglich aus der „Meine Funde"-Liste. Marker-Popup und Liste zeigen das Foto als Vorschau.',
    user_summary: '📍 Wenn du auf der Karte einen Fundort speicherst, landet er endlich zuverlässig in „Meine Funde". 📸 Neu: du kannst zu jedem Fund ein Foto hinzufügen — direkt beim Speichern oder nachträglich.',
    user_items: [
      { emoji: '📍', text: 'Fundort-Speichern funktioniert wieder zuverlässig' },
      { emoji: '📸', text: 'Foto direkt beim Speichern hinzufügen (Pin-Popup)' },
      { emoji: '🖼️', text: 'Nachträgliches Foto-Hinzufügen in „Meine Funde"' },
      { emoji: '🌅', text: 'Vorschau-Thumbnail in der Liste & im Marker-Popup' },
    ],
    items: [
      {emoji:'🐛', bold:'Root-Cause:', text:' Pin-Popup-Button hatte onclick="gsAddMarker(\\\' + lat + \\\',\\\' + lng + \\\')" — die \\\' -Escapes im JS-String ergaben in HTML literal `gsAddMarker(\' + lat + \',\' + lng + \')`. Beim Klick rief der Browser das mit zwei String-Args " + lat + " und " + lng + " auf → Number(NaN) → INSERT scheiterte still. Hard-Lesson #12: nie Var-Interpolation per JS-Escape in HTML-onclick; entweder Direkt-Konkatenation oder globaler State.'},
      {emoji:'✅', bold:'Fix:', text:' Map-Klick parkt lat/lng in window._gsPendingPin, Button liest dort. PLUS Defensiv-Check in gsAddMarker: Number(lat/lng) + isFinite-Guard mit klarem Toast statt silent NaN.'},
      {emoji:'📸', bold:'Foto-Feature:', text:' Pin-Popup hat 📸-Input mit Preview; gsAddMarker → gsUploadPhotoToBucket(\'map-find-photos\', b64) → photo_url ins map_user_finds-INSERT. Bucket existiert seit v26.69 (public-read, 10MB Limit).'},
      {emoji:'🖼️', bold:'Anzeige:', text:' Marker-Popups (live + reload + cloud) zeigen Foto 140px max. Meine-Funde-Liste: 46x46 Thumb statt Emoji. _gsBuildFindPopup gemeinsamer Builder.'},
      {emoji:'➕', bold:'Nachrüst-Upload:', text:' _gsMyFindAddPhoto öffnet versteckten File-Picker → Upload → PATCH photo_url → Live-Marker-Popup wird via setPopupContent aktualisiert + Liste neu gerendert. Button erscheint nur bei Funden ohne Foto.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · GS_VERSION=v26.84 · sw.js gs-v26.84 · _headers v26.84 · meta=26.84.20260602.'},
    ]
  },
  {
    v: 'v26.83', date: '02.06.2026',
    headline: '🌱 KI-Garten-Planer Mega-Upgrade: 6 neue Detail-Tabs',
    summary: 'Der KI-Garten-Planer (garden-scan-analyze v6) liefert jetzt MASSIV mehr Daten — die bisher gar nicht angezeigt wurden. Das Plan-Ergebnis hat neu ein 6-Tab-System unter der 2D/3D-Ansicht: Übersicht (Ertrag/Aufwand/Pflanzen-Stats + Grundprinzipien + „Heute starten" + Standort-Analyse), Pflanzen (Detail-Karten mit Pflanzenfamilie, Nährstoff-Bedarf, Wasserzone, Aussaat→Ernte-Timeline, Frosthärte, gute/schlechte Nachbarn), Kalender (52-Wochen-Timeline mit Mondtagen), Fruchtfolge (4-Jahres-Zyklus), Mondphasen (biodynamische Aussaat) und Wasserzonen (Bewässerungs-Plan mit Tortendiagramm). Ältere Pläne ohne diese Daten blenden leere Tabs automatisch aus.',
    user_summary: '🌱 Dein KI-Garten-Plan ist jetzt viel reichhaltiger! Unter der Garten-Ansicht findest du 6 Tabs: 📋 Übersicht (mit Ertrag- & Aufwand-Schätzung), 🌱 Pflanzen (mit Aussaat- & Ernte-Zeiten, Frosthärte, guten Nachbarn), 📅 Kalender (Woche für Woche), 🔄 Fruchtfolge (4-Jahres-Plan), 🌙 Mondphasen (biodynamische Aussaat) und 💧 Wasserzonen (Bewässerungs-Plan).',
    user_items: [
      { emoji: '📋', text: 'Übersicht mit Ertrag-, Aufwand- & Pflanzen-Statistik' },
      { emoji: '🌱', text: 'Pflanzen-Detailkarten: Aussaat→Ernte, Frosthärte, Nachbarn' },
      { emoji: '📅', text: '52-Wochen-Kalender mit Mondtagen' },
      { emoji: '🔄', text: '4-Jahres-Fruchtfolge + 🌙 Mondphasen-Aussaat' },
      { emoji: '💧', text: 'Wasserzonen mit Bewässerungs-Plan & Tortendiagramm' },
    ],
    items: [
      {emoji:'🎨', bold:'6-Tab-UI:', text:' gsBuildGardenScanResultPreview rendert unter dem 2D/3D-Visual gsBuildPlanTabsWrap mit 6 Buildern (Overview/Plants/Calendar/Rotation/Lunar/Water). Tab-State in window._gsGardenScan.planTab, Wechsel via gsGSPlanTab ohne Re-Render des ganzen Modals.'},
      {emoji:'🌱', bold:'v6-Felder genutzt:', text:' plan_summary (headline/yield/effort/principles/start_now), weekly_calendar[52], crop_rotation_4_year, companion_groups; per-Pflanze crop_family/feeder_class/root_depth/water_zone/lunar_phase_optimal/pre_cultivation_indoor_start/sow/transplant/harvest_start-end/days_to_maturity/frost_tolerance_c/companion_pairs/incompatible_plants/succession_after.'},
      {emoji:'🛟', bold:'Graceful Degradation:', text:' Tabs zeigen sich nur wenn Daten vorhanden (Pre-v6-Pläne → nur Übersicht+Pflanzen). _gsPlanEsc behebt escHtml(0)→"" Bug (numerische 0-Werte wie Frosthärte).'},
      {emoji:'💬', bold:'Part C:', text:' Plan-Iterate-Chat (plan-iterate Edge-Fn, 5 Iterationen) war bereits seit v25.14 live — bleibt unter den Tabs erhalten.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · GS_VERSION=v26.83 · sw.js gs-v26.83 · _headers v26.83 · meta=26.83.20260602.'},
    ]
  },
  {
    v: 'v26.82', date: '02.06.2026',
    headline: '🔧 KI-Planer Fehler-Fix + Quiz-Rangliste-Vorschau + stabilere KI',
    summary: 'Der KI-Garten-Planer zeigte fälschlich „Anthropic-API-Key fehlt", auch wenn nur das Tageslimit erreicht war — jetzt korrekt: bei Limit ein Upgrade-Hinweis, sonst neutrale Meldung. Die KI-Schlüssel-Abfrage versucht es beim Start bis zu 3-mal (stabiler gegen Timing-Probleme). Nach jeder Quiz-Antwort siehst du jetzt direkt die Top-5-Rangliste.',
    user_summary: '🔧 Der KI-Garten-Planer zeigt keine verwirrende „Schlüssel fehlt"-Meldung mehr, wenn nur dein Tageslimit erreicht ist. 🏆 Nach jeder Quiz-Antwort siehst du sofort die Top-5-Rangliste.',
    user_items: [
      { emoji: '🔧', text: 'KI-Planer: klare Meldung bei Tageslimit statt „Key fehlt"' },
      { emoji: '🏆', text: 'Quiz: Top-5-Rangliste direkt nach jeder Antwort' },
      { emoji: '⚡', text: 'Stabilere KI beim App-Start (bis zu 3 Versuche)' },
    ],
    items: [
      {emoji:'🔧', bold:'gsPPrun Fehler-Logik:', text:' Quota-Check ZUERST, isAuth-Regex schärfer (^🔑|401|403|invalid.*key) statt jeden „API-Key"-String zu fangen. Bei Quota → gsShowAboScreen-Button. Personal-Key-Button raus (admin-only seit v26.67).'},
      {emoji:'⚡', bold:'callAI Retry:', text:' bis zu 3 Versuche von gsPullGlobalApiKey mit 350-1050ms Backoff gegen Boot-Race-Conditions.'},
      {emoji:'🏆', bold:'dqShowPostAnswerActions:', text:' Top-5-Inline-Rangliste (dq-inline-lb) via dqLoadLeaderboardTop(5) zusätzlich zum „Volle Rangliste"-Button.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · v26.82 (Cowork).'},
    ]
  },
  {
    v: 'v26.81', date: '02.06.2026',
    headline: '🗺️ Karten-Funde zuverlässiger speichern + 🔄 Aktualisieren-Button',
    summary: 'Tiefen-Debug des "gespeicherte Funde erscheinen nicht auf der Karte"-Problems. Root-Cause: Der lokale Speicher-Schritt (localStorage) hatte keinen Fehler-Schutz — war der Browser-Speicher voll, brach der gesamte Speichervorgang stumm ab, sodass weder lokal noch in der Cloud etwas ankam. Jetzt: Fehler-Toasts bei vollem Speicher, expliziter Cloud-Sync mit Status-Rückmeldung, Robustheit gegen fehlende Eingabefelder, Debug-Logs und ein neuer 🔄-Button zum manuellen Neuladen.',
    user_summary: '🗺️ Wenn du einen Fundort auf der Karte speicherst, bekommst du jetzt klare Rückmeldung: "☁️ In Cloud gespeichert" oder einen Hinweis, falls etwas schiefgeht. Mit dem neuen 🔄-Button oben in der Karte lädst du deine Funde jederzeit neu (z.B. um Funde von anderen Geräten zu sehen).',
    user_items: [
      { emoji: '✅', text: 'Klare Rückmeldung beim Speichern (lokal + Cloud)' },
      { emoji: '🔄', text: 'Neuer Aktualisieren-Button in der Karte (Cloud-Sync)' },
      { emoji: '🛟', text: 'Kein stilles Fehlschlagen mehr bei vollem Speicher' },
    ],
    items: [
      {emoji:'🐛', bold:'Root-Cause:', text:' localStorage.setItem(greenscan_markers) hatte kein try/catch → QuotaExceededError warf SILENT → Cloud-POST + updateMapCount + Toast liefen nie → map_user_finds UND LS blieben leer ("beide 0 Zeilen").'},
      {emoji:'☁️', bold:'Cloud-Sync awaited:', text:' map_user_finds-POST von fire-and-forget auf await + Result-Check umgestellt, Status-Toast "☁️ In Cloud gespeichert" bzw. "⚠ Cloud-Sync fehlgeschlagen — nur lokal".'},
      {emoji:'🧱', bold:'DOM-Robustness:', text:' fehlt #gs-pin-name → console.error + Toast statt silent fail; gsMap-Init-Guard. console.log("[v26.81] gsAddMarker called",{lat,lng,name,cat}) für F12-Debug.'},
      {emoji:'🔄', bold:'gsRefreshMarkers:', text:' entfernt alle Layer (gegen Duplikate, da gsLoadMarkers nur das Tracking-Array resettet) + lädt LS + gsLoadMarkersFromCloud neu.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · GS_VERSION=v26.81 · sw.js gs-v26.81 · _headers v26.81 · meta=26.81.20260602.'},
    ]
  },
  {
    v: 'v26.80', date: '02.06.2026',
    headline: '🐛 3 Bug-Fixes: Quiz-Rangliste + KI-Erklärung + Karten-Feedback',
    summary: 'Quiz-Rangliste nutzt jetzt die echte quiz_leaderboard-Tabelle (vorher die alte leere quiz_ranking). KI-Erklärung im Quiz funktioniert wieder für alle (nutzt den globalen Schlüssel via callAI statt des admin-only Personal-Keys). Karten-Speichern gibt Feedback bei leerem Namen.',
    user_summary: '🏆 Die Quiz-Rangliste zeigt wieder echte Platzierungen. 💡 Die "Erkläre mir das"-Funktion im Quiz geht wieder für alle. 🗺️ Beim Karten-Speichern bekommst du einen Hinweis, wenn der Name fehlt.',
    user_items: [
      { emoji: '🏆', text: 'Quiz-Rangliste zeigt wieder echte Platzierungen' },
      { emoji: '💡', text: 'KI-Quiz-Erklärung funktioniert wieder für alle Abos' },
      { emoji: '🗺️', text: 'Karten-Speichern mit Feedback bei leerem Namen' },
    ],
    items: [
      {emoji:'🏆', bold:'openDqRanking:', text:' auf RPC fn_quiz_leaderboard_top(p_limit:50) (quiz_leaderboard v26.72) umgestellt statt leere quiz_ranking. Schema-Mapping {rnk,display_name,total_correct,streak_max,total_attempts}.'},
      {emoji:'💡', bold:'dqAskKIExplain:', text:' nutzt callAI() (Global-Key via getApiConfig + Abo-Quota) statt direkt localStorage.gs_anthropic_key (Personal-Key seit v26.67 admin-only → Normal-User sahen "Key fehlt").'},
      {emoji:'🗺️', bold:'gsAddMarker:', text:' gsToast bei leerem Namen statt silent return.'},
    ]
  },
  {
    v: 'v26.79', date: '02.06.2026',
    headline: '🌳 3D-Planer Phase 3: realistische Pflanzen-Modelle + Wind + Sonne',
    summary: 'Der 3D-Garten-Planer rendert jetzt 8 kategorie-spezifische Pflanzen-Modelle (Baum, Obstbaum, Beere, Gemüse, Kraut, Blume, Hauspflanze) statt einfacher Zylinder, plus organischer Boden, Gras-Büschel, sichtbare Sonne mit Halo und sanfte Wind-Animation.',
    user_summary: '🌳 Dein 3D-Garten sieht jetzt viel echter aus: Bäume mit Kronen, Beeren mit Früchten, Blumen mit Blütenblättern — alles wiegt sich leicht im Wind, mit sichtbarer Sonne am Himmel.',
    user_items: [
      { emoji: '🌳', text: '8 realistische Pflanzen-Modelle statt Zylinder' },
      { emoji: '🍃', text: 'Wind-Animation für Kronen, Blätter & Blüten' },
      { emoji: '☀️', text: 'Sichtbare Sonne + Halo, organischer Boden mit Gras' },
    ],
    items: [
      {emoji:'🌳', bold:'Procedural Plant-Builder:', text:' 8 Kategorie-Modelle (Baum/Obstbaum/Beere/Gemüse/Kraut/Blume/Hauspflanze) mit Crowns, Früchten, Blütenblättern, emissive Berry-Glow.'},
      {emoji:'🍃', bold:'Wind-Sway:', text:' alle Crowns/Leaves/Blossoms mit individueller phase+amplitude, rotation oszilliert mit windT.'},
      {emoji:'☀️', bold:'Sky + Boden:', text:' visible Sun-Disk + Halo (folgt Sun-Hour-Slider), segmentierter Boden mit Vertex-Color + 60 Gras-Tufts. Backend: plant_3d_models + Storage-Bucket für spätere GLB-Assets.'},
    ]
  },
  {
    v: 'v26.78', date: '01.06.2026',
    headline: '🍄 Saison-Pilze Phase 2: Verwechsler-Galerie + Wachstums-Forecast',
    summary: 'Die Pilz-Saison-Karte auf der Startseite warnt jetzt aktiv vor kritischen Doppelgängern (Verwechsler-Galerie mit lebensgefährlichen Verwechslern) und zeigt einen Wachstums-Forecast auf Basis von Niederschlag, Bodentemperatur und Luftfeuchte.',
    user_summary: '🍄 Die Pilz-Saison-Karte zeigt dir jetzt gefährliche Verwechslungspartner mit Unterscheidungsmerkmalen und schätzt anhand des Wetters, wie hoch die Pilz-Wahrscheinlichkeit gerade ist.',
    user_items: [
      { emoji: '⚠️', text: 'Verwechsler-Galerie mit lebensgefährlichen Doppelgängern' },
      { emoji: '📈', text: 'Wachstums-Forecast (Regen + Bodentemp + Luftfeuchte)' },
    ],
    items: [
      {emoji:'⚠️', bold:'Verwechsler-Galerie:', text:' listet kritische Doppelgänger (mushroom_lookalikes.confusion_risk ∈ {sehr_hoch_lebensgefahr, hoch}) mit visual/key/smell/habitat-Unterschieden + pro_tip + VAPKO-Hinweis.'},
      {emoji:'📈', bold:'Wachstums-Forecast:', text:' Open-Meteo 3-Tage-Niederschlag + Boden-6cm-Temp + Luftfeuchte → Score 0-100 mit Color-Code (≥70 grün, 40-70 gelb, <40 grau).'},
    ]
  },
  {
    v: 'v26.77', date: '01.06.2026',
    headline: '🗺 3D-Planer Phase 2: Mini-Map + Companion-Konflikt-Glow',
    summary: 'Der 3D-Garten-Planer bekommt eine 2D-Mini-Map (Top-Down-Übersicht mit Kamera-Pfeil) und markiert antagonistische Pflanzen-Paare mit rotem Konflikt-Glow. Im Backend wurden 7 fehlende Fremdschlüssel-Indexe erstellt (Perf).',
    user_summary: '🗺 Im 3D-Planer siehst du jetzt eine Mini-Karte deines Gartens von oben, und Pflanzen die sich nicht vertragen leuchten rot auf.',
    user_items: [
      { emoji: '🗺', text: '2D-Mini-Map im 3D-Planer mit Kamera-Richtung' },
      { emoji: '🔴', text: 'Rotes Glow bei sich-nicht-vertragenden Pflanzen' },
    ],
    items: [
      {emoji:'🗺', bold:'Mini-Map:', text:' 120×120 Canvas-Overlay, Top-Down-Pflanzen-Positionen + 1m-Raster + Kamera-Pfeil, Re-Render alle 250ms, Toggle-Button 🗺.'},
      {emoji:'🔴', bold:'Konflikt-Glow:', text:' plant_companion_matrix-Lookup, antagonistische Paare (relationship schlecht/kritisch_schlecht) mit emissive 0xd32f2f. '},
      {emoji:'⚡', bold:'Backend-Perf:', text:' 7 unindexed FK-Indexes LIVE (marketplace_messages_sender_id, profiles_role_assigned_by, species_proposals u.a.).'},
    ]
  },
  {
    v: 'v26.75', date: '01.06.2026',
    headline: '💬 Marktplatz-Chat live + 📋 Meine Funde + 🏆 Quiz-Rangliste auf Home',
    summary: 'Frontend-Vervollständigung der v26.70–v26.72-Backends: (1) Marktplatz-Chat ist jetzt ECHT — Nachrichten zwischen Käufer & Verkäufer werden in der Cloud gespeichert (marketplace_messages), gepollt und als gelesen markiert. Neuer 📨-Posteingang im Marktplatz-Header für alle Konversationen. (2) "📋 Meine Funde"-Liste im Karten-Header: alle gespeicherten Fundorte mit Karten-Fokus, Community-Freigabe-Toggle und Löschen. (3) Quiz-Rangliste-Karte auf der Home mit Live-Top-3-Vorschau.',
    user_summary: '💬 Der Marktplatz-Chat funktioniert jetzt richtig: Schreib Verkäufern direkt in der App — deine Nachrichten bleiben gespeichert und der/die andere sieht sie auf jedem Gerät. Oben im Marktplatz findest du den neuen 📨-Posteingang. Auf der Karte zeigt dir "📋 Meine Funde" alle deine gespeicherten Fundorte. Und auf der Startseite siehst du jetzt die Quiz-Rangliste der besten Naturkenner.',
    user_items: [
      { emoji: '💬', text: 'Echter Marktplatz-Chat mit Verkäufern (Cloud, geräteübergreifend)' },
      { emoji: '📨', text: 'Nachrichten-Posteingang für alle deine Marktplatz-Chats' },
      { emoji: '📋', text: '"Meine Funde": Fundorte ansehen, freigeben, löschen' },
      { emoji: '🏆', text: 'Quiz-Rangliste-Karte auf der Startseite mit Top-3-Vorschau' },
    ],
    items: [
      {emoji:'💬', bold:'Marktplatz-Chat backend-verdrahtet:', text:' openMarketChat erkennt eingeloggte User + Cloud-Listing (uuid) + Seller-UID → echter Thread via marketplace_messages (buyer_id/seller_id/sender_id). Käufer öffnet Thread direkt; Verkäufer landet in der gefilterten Konversations-Inbox. _gsChatLoadMessages pollt alle 5s (nur bei offenem Modal, kein Flackern via lastCount-Diff). _gsChatSendBackend POSTet (return=minimal), _gsChatMarkRead ruft fn_mkt_chat_mark_read. Demo-Fallback bleibt für Gast/Demo-Listings.'},
      {emoji:'📨', bold:'Konversations-Inbox:', text:' gsOpenConversations liest v_marketplace_conversations (security_invoker → nur eigene Chats), zeigt Käufer/Verkäufer-Rolle + Unread-Badge + letzte Nachricht. _gsConvOpen springt in den jeweiligen Thread. 📨-Button im Marktplatz-Header.'},
      {emoji:'📋', bold:'Meine-Funde-Screen:', text:' gsOpenMyFinds nutzt window.gsMapFinds.list() (Cloud bevorzugt, LS-Fallback). Pro Eintrag: Karten-Fokus (_gsMyFindFocus → switchTab map + setView z15), Community-Toggle (togglePrivacy 🌍/🔒), Löschen (gsConfirmModal → gsMapFinds.delete + Live-Marker-Removal aus _gsMarkerLayers + updateMapCount). 📋-Button im Karten-Header.'},
      {emoji:'🏆', bold:'Home-Card Quiz-Rangliste:', text:' Statische Karte im Home-Content (öffnet gsOpenQuizLeaderboard). gsHomeFillLeaderboard lädt lazy Top-3 via dqLoadLeaderboardTop(3) (granted für anon) — Medaillen + Name + Correct-Count. Idempotent via _gsFilled, getriggert ~1.5s nach window.load.'},
      {emoji:'🔌', bold:'Kein neues Backend nötig:', text:' Alle Tabellen/Views/RPCs aus v26.70–v26.72 bereits LIVE (marketplace_messages, v_marketplace_conversations, fn_mkt_chat_mark_read, map_user_finds, quiz_leaderboard, fn_quiz_leaderboard_top). Reine Frontend-Verdrahtung.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · GS_VERSION=v26.75 · sw.js gs-v26.75 · _headers v26.75 · meta=26.75.20260601.'},
    ]
  },
  {
    v: 'v26.74', date: '01.06.2026',
    headline: '🌅 KI-Plan 3D mit Sonnen-Slider + Schatten + 4K-Foto-Export (Master #3 Subset)',
    summary: 'Master-Auftrag #3 angefangen mit den 3 wichtigsten Improvements: (1) Sonnen-Slider 4-20h mit Halbkreis-Bogen, Goldene-Stunde-Tönung morgens+abends, dynamische Schatten. (2) Three.js shadowMap PCFSoft mit 1024² Resolution. (3) 4K-Photo-Export (3840×2160 PNG-Download) als Standalone-Button. Mini-Map + Companion-Konflikt-Glow + GLB-Modelle für späteren Sprint.',
    user_summary: '🌅 Der 3D-Garten-Planer ist jetzt deutlich realistischer: Schiebe den Sonnen-Slider und schau, wie Schatten wandern, Lichtfarbe morgens golden und abends rötlich wird. Mit dem 📸-Button exportierst du deinen Plan als 4K-PNG (3840×2160px) zum Drucken/Teilen.',
    user_items: [
      { emoji: '☀', text: 'Sonnen-Slider 04:00 → 20:00 mit Live-Schatten-Bewegung' },
      { emoji: '🌅', text: 'Goldene Stunde morgens (4-8h) + abends (16-20h) — Light-Tönung' },
      { emoji: '🌑', text: 'Echte Schatten dank PCFSoftShadowMap (Pflanze auf Erde)' },
      { emoji: '📸', text: '4K-Foto-Export (3840×2160 PNG) per Button-Klick' },
    ],
    items: [
      {emoji:'🌅', bold:'setSunHour(4-20):', text:' Halbkreis-Bogen: arc=π·(h-4)/16. Sonne wandert Ost→Süd→West. Intensity = 0.35 + sin(arc)·0.85. Golden-Factor: (8-h)/4 wenn h<8, (h-16)/4 wenn h>16. Lichtfarbe r=1, g=1-gold·0.25, b=1-gold·0.55. Ambient + Sky-Background tönen mit.'},
      {emoji:'🌑', bold:'Schatten-Setup:', text:' renderer.shadowMap.enabled=true + PCFSoftShadowMap. sun.castShadow + ortho shadow.camera mit Bounds Math.max(W,D)·1.2. mapSize 1024². Plant-Mesh+Sphere castShadow=true. Ground receiveShadow=true.'},
      {emoji:'📸', bold:'exportPhoto 4K:', text:' preserveDrawingBuffer=true im WebGLRenderer-Init. Bei Export: setSize(3840,2160,false) + pixelRatio=1 + camera.aspect update → render → toDataURL("image/png") → Anchor-Download. Danach Restore auf Bildschirm-Größe.'},
      {emoji:'🎚️', bold:'HTML-Controls in Result-Preview:', text:' Inline-Bar über dem 3D-Host. Sun-Slider input[type=range] 4-20 step 0.5, accent-color #ffa726, Live-Label "HH:MM" updated über gs3DSetSunHour. 4K-Foto-Button rechts vom Slider.'},
      {emoji:'🧰', bold:'Cleanup-Handle API:', text:' window._gsGardenScan3DScene = { dispose, setSunHour(h), exportPhoto() }. Bridges: window.gs3DSetSunHour / gs3DExportPhoto greifen darauf zu (HTML-onclick-safe).'},
      {emoji:'⏭️', bold:'Master-#3 Subset 3/10 done:', text:' Sonnen-Slider + Schatten + 4K-Foto. Verschoben in v26.75+: Mini-Map (2D-Aufsicht oben rechts), Companion-Konflikt-Glow (red Halo bei inkompatiblen Pflanzen), GLB-Pflanzen-Modelle, Pfad-Tool, Beet-Editor, Wachstums-Animation (Tween), AR-Vorschau usdz, Texturen (PBR Wood/Soil).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · GS_VERSION=v26.74 · sw.js gs-v26.74 · _headers v26.74 · meta=26.74.20260601.'},
    ]
  },
  {
    v: 'v26.73', date: '01.06.2026',
    headline: '🗺 Backend-Frontend-Map + Saison-Pilze Live-Counter (Master #4 + #9)',
    summary: 'Master-Auftrag #4: vollständige Backend-Frontend-Matrix mit 122 Tables × 30 Edge-Fns. BACKEND_FRONTEND_MAP_v26.73.md im Repo. 8 Audit-Findings (5 Dead-Code-Edge-Fns, 5 legacy_*-Tables, 1 fehlendes AI-Logging). Master-#9: Saison-Pilze-Card erweitert um Live-Counter aus map_user_finds.',
    user_summary: '🗺 Wartung-Sprint: vollständiger System-Audit (Backend vs Frontend). Plus: die Saison-Pilze-Card auf Home zeigt jetzt anonyme Community-Funde-Counter ("X Pilz-Funde diesen Monat — Top: Steinpilz x4, Pfifferling x3"). Wer seine Funde teilt (is_private=false), hilft anderen Pilzlern.',
    user_items: [
      { emoji: '🗺', text: 'Vollständige Backend↔Frontend-Map im Repo (122 Tables, 30 Edge-Fns)' },
      { emoji: '📊', text: 'plant-doctor AI-Logging nachgerüstet — jetzt Telemetrie für alle 5 KI-Funktionen' },
      { emoji: '🐾', text: 'Saison-Pilze-Card: Community-Counter "X Funde diesen Monat + Top-3 Species"' },
      { emoji: '🧹', text: 'Audit-Findings: 5 Stripe-Setup-Functions sind Dead-Code (Aufräumen in v26.75)' },
    ],
    items: [
      {emoji:'📋', bold:'BACKEND_FRONTEND_MAP_v26.73.md:', text:' Vollständige Matrix Tabelle × Frontend-Modul × Edge-Fn. User-Content (Read/Write/Render-Pfade), Knowledge-Content (Quelle/Modul), Edge-Functions (Verify-JWT/Version/Status). 122 Tables: alle haben RLS. 30 Edge-Fns mit Aufruf-Status.'},
      {emoji:'🐛', bold:'Audit-Finding behoben: plant-doctor-diagnose v2 LIVE:', text:' Single Edge-Fn die fn_log_ai_usage nicht aufrief → Telemetrie war incomplete. Patch fire-and-forget vor success-Return.'},
      {emoji:'⚠️', bold:'Audit-Findings P1 (Cleanup-Backlog):', text:' (1) 5 Stripe-Setup-Time-Functions sind Dead-Code seit v26.40 (stripe-setup-webhook, stripe-restructure-pro-only, stripe-import-fernando-sub, stripe-complete-setup, stripe-final-audit). (2) customer-portal + create-checkout sind Duplikate von stripe-portal + stripe-checkout. (3) 5 legacy_*-Tables zum Sanity-Check vor DROP.'},
      {emoji:'🐾', bold:'gsAttachMushroomLiveCounter (Master-#9):', text:' Idempotent appended an mushroom-season-card. Query map_user_finds WHERE category=pilz AND is_private=false AND found_at>=monatsanfang LIMIT 200. Aggregate: total-Count + Top-3 Species nach Häufigkeit. Empty-State: CTA "Teile deinen ersten Fund". Privacy: nur is_private=false-Funde — User-Anonymität gewahrt.'},
      {emoji:'⏭️', bold:'Naechste Sprints (P2):', text:' v26.74 = Master #3 KI-Pro 3D-Planer Polish (Sonnen-Slider + Konflikte + Mini-Map + 4K-Foto) + Frontend für marketplace_messages-Chat + "Meine Funde"-Sub-Tab + Home-Card Quiz-Leaderboard. v26.75 = Stripe-Cleanup.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · GS_VERSION=v26.73 · sw.js gs-v26.73 · _headers v26.73 · meta=26.73.20260601 · plant-doctor-diagnose v2 LIVE.'},
    ]
  },
  {
    v: 'v26.72', date: '01.06.2026',
    headline: '🏆 Quiz-Rangliste — Top 20 mit eigenem Rang (Master #11)',
    summary: 'Master-Auftrag #11: Globale Quiz-Rangliste über alle User. Backend: quiz_leaderboard-Tabelle + 3 RPCs (top, my_rank, upsert) + pg_cron daily rank-update. Frontend: dqSaveStats triggert UPSERT (debounced 2s) → Cloud. gsOpenQuizLeaderboard zeigt Top-20 + Medaillen + eigener Rang.',
    user_summary: '🏆 Quiz-Rangliste über alle GreenScan-User! Top-20 mit Medaillen (🥇🥈🥉), Streak-Anzeige (🔥) und deinem persönlichen Rang. Display-Name kommt aus deinem Spitznamen — wenn keiner gesetzt: anonym-generiertes "Pilz-Fuchs 42" o.ä.',
    user_items: [
      { emoji: '🥇', text: 'Top-20 mit Medaillen für Top 3' },
      { emoji: '🔥', text: 'Streak-Badge pro User (höchste Antwort-Serie)' },
      { emoji: '🎯', text: 'Eigener Rang am Modal-Ende' },
      { emoji: '🤖', text: 'Anonym-Default: Pilz-<Animal> <Number> wenn kein Nick gesetzt' },
    ],
    items: [
      {emoji:'🗄️', bold:'Migration v26_72_quiz_leaderboard LIVE:', text:' CREATE TABLE quiz_leaderboard PK user_id, display_name, total_correct, total_attempts, streak_current, streak_max, last_active_date, rank_position, updated_at. 3 Indexes (correct/streak/active). RLS: all read + users upsert own.'},
      {emoji:'🔍', bold:'RPC fn_quiz_leaderboard_top(limit):', text:' SECURITY INVOKER, GRANT authenticated+anon. row_number()-Ranking ORDER BY total_correct DESC, streak_max DESC. Clamp 1..100.'},
      {emoji:'👤', bold:'RPC fn_quiz_leaderboard_my_rank:', text:' SECURITY DEFINER mit search_path=public, GRANT authenticated. CTE über alle Rows → eigener Rang.'},
      {emoji:'➕', bold:'RPC fn_quiz_leaderboard_upsert:', text:' SECURITY INVOKER, GRANT authenticated. GREATEST-Merge für correct/attempts/streak_max (kein Backward-Slide bei alten LS-Werten). display_name-Fallback "Pilz-<Animal> <Num>" aus user_id-hashtext.'},
      {emoji:'⏰', bold:'pg_cron quiz-leaderboard-rank:', text:' Täglich 02:00 UTC. UPDATE rank_position via window-function ORDER BY total_correct DESC, streak_max DESC.'},
      {emoji:'🔄', bold:'dqSaveStats triggers dqPushLeaderboardDebounced:', text:' 2s Debounce → RPC-Call mit aktuellen Stats + gs_social_name als optionaler Display-Name.'},
      {emoji:'🎨', bold:'gsOpenQuizLeaderboard Modal:', text:' Top-20 als Liste mit Medaillen 🥇🥈🥉 + Display-Name + ✓ correct-count + 🔥 streak_max-badge. Footer mit "Dein Rang: X." oder "Anmelden um zu erscheinen". dqLoadLeaderboardTop / dqLoadMyRank window-exposed für künftiges Home-Card-Use.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.73 = Master #3 KI-Pro 3D-Planer Polish (Sonnen-Slider + Konflikte + Mini-Map + 4K-Foto).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · GS_VERSION=v26.72 · sw.js gs-v26.72 · _headers v26.72 · meta=26.72.20260601 · Migration + Cron LIVE.'},
    ]
  },
  {
    v: 'v26.71', date: '01.06.2026',
    headline: '🗺️ Karten-Fundpunkte syncen jetzt — Cross-Device + Community-Share (Master #10)',
    summary: 'Master-Auftrag #10: Funde auf der Karte landen jetzt zusätzlich in der Cloud-Tabelle map_user_finds. Verlust beim Cache-Löschen oder Geräte-Wechsel ist Geschichte. Plus optionaler Community-Share via is_private-Flag. Storage-Bucket map-find-photos vorbereitet für Bild-Uploads.',
    user_summary: '🗺️ Deine Karten-Fundpunkte werden jetzt auf alle Geräte synct — speichern auf Mac, sehen auf iPhone. Vorher gingen sie verloren, wenn du den Browser-Cache geleert hast. Plus: künftig kannst du einzelne Funde mit der Community teilen (Heatmap "Wo gibts Steinpilze in der Region?").',
    user_items: [
      { emoji: '☁️', text: 'Cross-Device: Karten-Funde syncen automatisch auf alle Geräte' },
      { emoji: '🔒', text: 'Standard: privat — nur du siehst sie' },
      { emoji: '🌍', text: 'Optional: Community-Share für Heatmap (kommt in v26.72)' },
      { emoji: '📸', text: 'Storage-Bucket bereit für Fund-Fotos (Bild-Upload in v26.71+)' },
    ],
    items: [
      {emoji:'🗄️', bold:'Migration v26_71_map_user_finds LIVE:', text:' CREATE TABLE map_user_finds(user_id FK, species_name, category check(pilz|pflanze|baum|kraut|sonstiges), lat/lng, accuracy_m, altitude_m, found_at, note 1000 chars, photo_url, weather_condition, edible_confirmed, quantity_estimate, is_private default true). 5 Indexes (user+time, geo, species, category+time, community partial). RLS 5 Policies.'},
      {emoji:'🪣', bold:'Storage-Bucket map-find-photos:', text:' Public-read, Folder-Pattern uid/<file>. User darf nur eigenen Folder schreiben/updaten/löschen. Anyone read.'},
      {emoji:'➕', bold:'gsAddMarker erweitert:', text:' POST to map_user_finds zusätzlich zum LS-Save. cloud_id wird zurück in LS-Cache geschrieben für späteres Delete/Update. Cat-Mapping pilz/baum/pflanze/kraut → DB-Enum, Rest → sonstiges.'},
      {emoji:'⬇️', bold:'gsLoadMarkersFromCloud async:', text:' Pullt 500 letzte Funde + rendert die noch nicht-LS-bekannten als Leaflet-Marker mit ☁️-Indicator + Community-Badge wenn !is_private. LS-Cache wird angereichert.'},
      {emoji:'🧰', bold:'Wrapper-API window.gsMapFinds:', text:' .list (Cloud bevorzugt, LS-Fallback), .togglePrivacy(id, makePublic), .delete(id, beide Stellen). Frontend-ready für künftiges "Meine Funde"-Screen.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.72 = Master #11 Quiz-Leaderboard mit Cron-Ranking.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · GS_VERSION=v26.71 · sw.js gs-v26.71 · _headers v26.71 · meta=26.71.20260601 · Migration + Storage-Bucket LIVE.'},
    ]
  },
  {
    v: 'v26.70', date: '01.06.2026',
    headline: '🏪 Marketplace Tutti-Style — Verkaufen ohne Stripe-Zwang (Master #5)',
    summary: 'Master-Auftrag #5: Inserate erstellen jetzt OHNE Pflicht-Stripe-Connect. Online-Bezahlung ist OPTIONAL. Default ist Tutti-Style: Kontakt-Button + private Klärung (TWINT/Cash/etc). Migration v26_70 fügt allow_online_payment + contact_method zu marketplace_listings, plus neue marketplace_messages-Tabelle für In-App-Chat mit RLS. Settings-Eintrag umformuliert. Listing-Form mit Online-Pay-Checkbox. Buy-Button vs Contact-Button basierend auf Listing-Flag.',
    user_summary: '🏪 Du kannst jetzt im Marktplatz verkaufen OHNE dich mit Stripe verbinden zu müssen — wie bei Tutti. Default ist: Käufer kontaktiert dich, ihr klärt Übergabe + Bezahlung privat (TWINT/Cash). Wenn du willst, kannst du optional Online-Bezahlung über Stripe aktivieren (Plus-Feature) damit Käufer direkt in der App zahlen.',
    user_items: [
      { emoji: '🤝', text: 'Default: Tutti-Style — Käufer kontaktiert, private Bezahlung (TWINT/Cash)' },
      { emoji: '💳', text: 'Optional: Online-Bezahlung via Stripe (für wer will, mit Connect-Setup)' },
      { emoji: '💬', text: 'Neuer In-App-Chat zwischen Käufer und Verkäufer' },
      { emoji: '🏷', text: 'Cards zeigen Badge: "💳 Online-Zahlung" oder "🤝 Privat"' },
    ],
    items: [
      {emoji:'🗄️', bold:'Migration v26_70_marketplace_tutti_style LIVE:', text:' ALTER TABLE marketplace_listings ADD allow_online_payment bool default false + contact_method text default \'chat\'. Plus partial Index für allow_online_payment=true.'},
      {emoji:'💬', bold:'Neue Tabelle marketplace_messages:', text:' In-App-Chat zwischen Buyer und Seller. Spalten: listing_id, buyer_id, seller_id, sender_id, message (max 2000 chars), read_at, created_at. 4 Indexes (listing+time, buyer, seller, unread). RLS: User sieht nur Chats wo er Buyer ODER Seller ist. INSERT nur sender_id=own_uid. Update/Delete eingeschränkt.'},
      {emoji:'🔍', bold:'View v_marketplace_conversations:', text:' security_invoker=true. Gruppiert Messages pro listing+buyer mit last_message_at + unread_count. Frontend kann damit Inbox-Liste rendern.'},
      {emoji:'🔁', bold:'RPC fn_mkt_chat_mark_read:', text:' Setzt read_at für alle eingehenden (sender<>own) ungelesenen Messages eines Listing+Buyer-Pair. SECURITY INVOKER, GRANT zu authenticated.'},
      {emoji:'⚙️', bold:'Settings-Row umformuliert:', text:' "Verkäufer-Konto verbinden — Bezahlung über Stripe" → "💳 Online-Bezahlung aktivieren · Optional — Damit Käufer in der App bezahlen können. Sonst funktioniert der Verkauf wie bei Tutti — direkter Kontakt + private Klärung."'},
      {emoji:'☑️', bold:'Listing-Form Checkbox:', text:' Neuer hellgrüner Block "💳 Online-Bezahlung anbieten (optional)" nach Bio/Pestizid-Block. submitListing speichert allow_online_payment + contact_method (=\'chat\').'},
      {emoji:'🎨', bold:'openListingDetail buynow-Pfad:', text:' Bei !allow_online_payment → primärer Button wird "💬 Kontakt aufnehmen" (blauer Gradient) statt "💳 Jetzt kaufen". Plus Tutti-Hint-Box mit "Bezahlung privat (TWINT/Bargeld)" + Badge im Preis-Block (💳 Online-Zahlung vs 🤝 Privat).'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.71 = Master #10 Karten-Fund-Speicher (map_user_finds + Storage-Bucket).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · GS_VERSION=v26.70 · sw.js gs-v26.70 · _headers v26.70 · meta=26.70.20260601 · Migration LIVE.'},
    ]
  },
  {
    v: 'v26.69', date: '01.06.2026',
    headline: '💾 Universal-Save Audit — Settings-Toggles syncen jetzt WIRKLICH (Silent-Bug seit v23.78 gefixt)',
    summary: 'Master-Auftrag Punkt #8 abgearbeitet. Großer Silent-Bug entdeckt: savePref() rief gsPrefsPush — definiert war aber nur gsPrefsPushNow. typeof-Guard schluckte das silent → 25+ Settings-Toggles wurden NIE in user_preferences gespiegelt seit v23.78 (homeWeather, showMoon, pestTips, safetyWarnings, marketNotif, socialNotif, harvestNotif, waterNotif, weatherNotif). Plus Migration v26_69 für prefs jsonb-Spalte (vorher fehlte Schema-Support für arbitrary Toggles). gsPrefsPull merged prefs zurück in userPrefs. Neue Konstante GS_KEEP_ON_LOGOUT als explizite Whitelist-Doku.',
    user_summary: '💾 Deine Settings-Toggles werden jetzt WIRKLICH auf alle Geräte synct. Vorher war das Cross-Device-Sync für Toggles wie "Wetter auf Home zeigen", "Mond-Phase", "Schädlings-Tipps" silent kaputt (Logic-Bug seit 6 Versionen). Du musstest alles auf jedem Gerät neu einstellen. Ab v26.69: einmal eingestellt = überall gleich.',
    user_items: [
      { emoji: '⚙️', text: '25+ Settings-Toggles syncen jetzt zur Cloud (homeWeather, showMoon, pestTips, etc.)' },
      { emoji: '🔄', text: 'Login auf zweitem Gerät: alle Settings übernommen' },
      { emoji: '🛡', text: 'Konto-Switch: alte Settings werden korrekt überschrieben (vorher Mix)' },
      { emoji: '📋', text: 'Logout-Whitelist explizit dokumentiert: was bleibt erhalten' },
    ],
    items: [
      {emoji:'🐛', bold:'Silent-Bug seit v23.78:', text:' savePref() rief gsPrefsPush({key:val}) — definiert war nur gsPrefsPushNow. Der typeof===\'function\'-Guard schluckte den fehlenden Alias silent → kein Cloud-Push, kein Error. Fix: window.gsPrefsPush = gsPrefsPushNow.'},
      {emoji:'🗄️', bold:'Migration v26_69_user_preferences_prefs_jsonb LIVE:', text:' ALTER TABLE user_preferences ADD COLUMN prefs jsonb default \'{}\'. Vorher gab es nur fixe Columns (language/region/units etc) — arbitrary Toggles hätten INSERT-Fehler verursacht.'},
      {emoji:'🧩', bold:'Smart-Mapping in gsPrefsPushNow:', text:' GS_PREFS_KNOWN_COLUMNS-Map trennt strukturierte Felder (language, region, altitude_m, reminders_enabled, push_enabled, email_enabled, digest_freq, units) von free-form Toggles. Strukturierte landen als flache Columns, der Rest im prefs jsonb-Blob. updated_at wird mitgesetzt.'},
      {emoji:'⬇️', bold:'gsPrefsPull merge:', text:' Beim Login wird user_preferences gepullt, prefs jsonb zurück in gs_prefs gemerged, plus userPrefs-Globalvar refresht — Frontend-Code liest weiterhin flach (userPrefs.homeWeather etc).'},
      {emoji:'📋', bold:'GS_KEEP_ON_LOGOUT Konstante:', text:' Explizite Whitelist als Doku — bleibt beim Logout erhalten: gs_dark, gs_theme_color, gs_lang, gs_consent, gs_prefs, gs_user_location, gs_units, gs_sb_url, gs_sb_key. gsClearUserDataKeys löscht nur GS_USER_KEYS (Deny-Liste).'},
      {emoji:'🧪', bold:'Verifizierte Flows:', text:' (1) savePref(\'homeWeather\',true) → gsPrefsPushNow debounced 2s → user_preferences UPSERT mit merge-duplicates. (2) gsPrefsPull beim Login → merged Server-Werte zurück. (3) Konto-Wechsel: gsClearUserDataKeys + gsPrefsPull holt neue. (4) savePlantsToStorage doppel-defensiv (gsPushPlantsNow + markDirty) — Pflanze-Edit ohne Foto syncedauch.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · GS_VERSION=v26.69 · sw.js gs-v26.69 · _headers v26.69 · meta=26.69.20260601 · Migration LIVE.'},
    ]
  },
  {
    v: 'v26.57', date: '28.05.2026',
    headline: '✨ Polish-Bundle — CH-Deutsch · Mein-Garten · Disabled-Guards · 3-Stage-Trial-Reminder',
    summary: 'Fernando-Auftrag Polish: (1) CH-Deutsch ß→ss in 12 echten UI-Stellen (kein Schließen, Maßband, außerhalb, großzügig, Genieße mehr — alles schweizerisch). (2) Mein-Garten Polish: Plant-Cards zeigen jetzt p.photo wenn vorhanden (Bug-Fix seit v23.91), gsFilterPlants sucht jetzt auch in Latin-Namen + Diary-Notes, savePlantsToStorage doppel-defensiv mit markDirty. (3) gsAsyncLock-Helper + 6 kritische Submit-Buttons mit Double-Submit-Schutz — verhindert teure Anthropic-Doppel-Calls + Cloud-Duplikate. (4) daily-push-checker v4 LIVE mit 72h + 24h + 1h Push-Stages für besseren Trial-Conversion-Funnel.',
    user_summary: '✨ Kleine Verbesserungen rundum: deutsche Texte sind jetzt durchgehend schweizerisch (ß→ss), Plant-Fotos werden in der Garten-Liste angezeigt, Such-Funktion findet auch lateinische Namen und Tagebuch-Notizen, Trial-Reminder kommen jetzt schon 3 Tage vor Ende (statt nur 1 Tag).',
    user_items: [
      { emoji: '🇨🇭', text: 'Durchgehend schweizerisch: kein ß mehr im UI-Text' },
      { emoji: '📸', text: 'Plant-Fotos werden jetzt auf der Garten-Card angezeigt' },
      { emoji: '🔍', text: 'Pflanzen-Suche findet auch Latin-Namen + Tagebuch-Notizen' },
      { emoji: '⏰', text: 'Trial-Reminder: 3 Tage + 1 Tag + 1 Stunde vor Ende' },
      { emoji: '🛡', text: 'Double-Submit-Schutz für 6 wichtige Buttons' },
    ],
    items: [
      {emoji:'🇨🇭', bold:'CH-Deutsch ß→ss (12 Stellen):', text:' Weiss/Schliessen/Massband/Masse/ausserhalb/grosszügig/Geniesse/gleichmässig — alles Schweizer-konform.'},
      {emoji:'📸', bold:'Plant-Card-Foto (Bug-Fix):', text:' gsNewPlantCard nutzt p.photo als CSS-background. p.photo wurde seit v23.91 gespeichert aber nicht angezeigt.'},
      {emoji:'🔍', bold:'gsFilterPlants erweitert:', text:' sucht jetzt in Name + Nick + Latin-Name (p.lat) + p.diary[].note + p.diary[].title.'},
      {emoji:'🛡', bold:'gsAsyncLock + 6 Submits geschützt:', text:' gsTbAdd (600ms), gsErnteAdd (600), gsAddDiaryEntry (600), submitListing (1500), gsRunGardenScan (3000 — Anthropic-Cost-Schutz!), gsMarketplaceStartConnect (2000), gsRequestExpertVerification (2000).'},
      {emoji:'⏰', bold:'daily-push-checker v4 LIVE:', text:' 3-Stage Trial-Reminder: 72-73h (3-Tage-Vorwarnung), 24-25h (1-Tag-Vorwarnung), 1-2h (Last-Call). Eigene categories für dedup-safe Multi-Stage. UTM-Tags pro Stage für Conversion-Tracking.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · GS_VERSION=v26.57 OK · sw.js gs-v26.57 OK · Edge-Fn daily-push-checker v4 LIVE deployed.'},
    ]
  },
  {
    v: 'v26.56', date: '28.05.2026',
    headline: '🛡 4 LIVE Edge-Functions ins Repo gepullt — Disaster-Recovery',
    summary: 'Cowork-Sprint v26.56 (autonom, Sprint-Plan v26.56-v26.60 erste Etappe). 4 Edge-Functions die bisher NUR in Supabase deployed waren, sind jetzt im git-Repo versioniert: stripe-checkout v6 (Trial-Cap 7 Tage, TWINT auto-add bei CHF), stripe-portal v3 (flow_data=cancel/reactivate Direct-Flow), stripe-expert-checkout v1 (CHF 0.50 One-Time-Payment für Community-Experten-Verifikation), stripe-admin-extend-webhook v1 (Admin-Tool zum Erweitern des Stripe-Webhook-Endpoints um account.* Events). Wenn das Supabase-Project je verloren ginge, waren diese 4 Functions weg — jetzt rekonstruierbar aus Git-History. Repo-Function-Count: 12 → 16.',
    user_summary: '🛡 Backend-Sicherheit: alle wichtigen Stripe-Funktionen sind jetzt im Code-Repo versioniert. Falls etwas mit dem Server passiert, ist alles wiederherstellbar.',
    user_items: [
      { emoji: '🔒', text: 'Disaster-Recovery: 4 LIVE-Functions sind jetzt im Git versioniert' },
      { emoji: '📦', text: 'Repo-Function-Count: 12 → 16' },
    ],
    items: [
      {emoji:'📥', bold:'stripe-checkout v6 gepullt:', text:' Default-Trial 7 Tage für First-Sub. TWINT/SEPA Auto-Add nach Currency. Anti-Trial-Abuse: nur first sub kriegt trial.'},
      {emoji:'📥', bold:'stripe-portal v3 gepullt:', text:' flow_data-Support für subscription_cancel + subscription_update Direct-Flows. Spart User 2 Klicks.'},
      {emoji:'📥', bold:'stripe-expert-checkout v1 gepullt:', text:' CHF 0.50 One-Time-Payment bei Community-Experten-Verifikation. metadata.kind=expert_verification triggert stripe-webhook fee_paid_chf-Update.'},
      {emoji:'📥', bold:'stripe-admin-extend-webhook v1 gepullt:', text:' Admin-Tool für Webhook-Event-Sync. Aktuell account.updated + account.application.deauthorized hinzufügen. Idempotent — kein Schaden bei Re-Run.'},
      {emoji:'🗑', bold:'7 obsolete Edge-Fns: 410-Gone-Stubs', text:' create-checkout, customer-portal, stripe-restructure-pro-only, stripe-import-fernando-sub, stripe-complete-setup, stripe-final-audit, stripe-setup-webhook — jeder Call gibt jetzt status:410 + {error: "gone"}. Attack-Surface minimiert.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · GS_VERSION=v26.56 OK · sw.js gs-v26.56 OK · _headers v26.56 OK · meta=26.56.20260528 OK · 16 Edge-Functions im Repo.'},
    ]
  },
  {
    v: 'v26.55', date: '27.05.2026',
    headline: '🚨 P0/P1-HOTFIX-Bundle — Lifetime-Bug · Free-Quota-Sync · Dup-ID · Webhook v11 · Past-Due-Banner',
    summary: 'Cowork-Triple-Audit-Findings (Button-Wiring + Stripe + Abo) als Bundle gefixt: Lifetime-Spalten-Drift is_launch_lifetime → is_lifetime (Migration v26_54 LIVE), Free-Quota Frontend 15 vs Backend 5 → beides auf 15, abo-sub-info-host Dup-ID umbenannt, stripe-webhook v11 mit 5 neuen Cases (trial_will_end → Push, charge.failed, dispute, customer.updated, payment_method.attached), globaler Past-Due-Warn-Banner gsCheckPastDueBanner.',
    user_summary: '🚨 5 wichtige Fixes auf einmal: Lifetime-Käufer werden jetzt zuverlässig erkannt, Free-Quota auf 15 KI-Calls/Tag, iOS-PWA-Bug bei Abo-Modal behoben, Trial-Reminder kommt jetzt 3 Tage vor Ende automatisch, und ein orange Warn-Banner falls deine Karte abgelaufen ist.',
    user_items: [
      { emoji: '💎', text: 'Lifetime-Bug gefixt: CHF-45.60-Käufer wurden manchmal als free erkannt' },
      { emoji: '🔄', text: 'KI-Quota für Free-User: jetzt 15/Tag (vorher zählte Backend nur gegen 5)' },
      { emoji: '⏰', text: 'Trial-Reminder kommt jetzt 3 Tage vor Ende automatisch via Webhook' },
      { emoji: '⚠️', text: 'Karte abgelaufen? Orange Warn-Banner mit direktem Update-Button' },
      { emoji: '🛡️', text: '3 Migrations LIVE: Lifetime-Rename + 5 Mein-Garten-Tabellen + 5 Engagement-Tabellen' },
    ],
    items: [
      {emoji:'✅', bold:'Migrations LIVE deployed:', text:' v26_54_lifetime_rename + v26_57_garden_tables + v26_58_user_engagement via Supabase MCP.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · GS_VERSION=v26.55 LIVE auf green-scan.ch.'},
    ]
  },
  {
    v: 'v26.51', date: '27.05.2026',
    headline: '🌱 Mein-Garten Audit: 3 Datenverlust-Fixes — iOS-PWA-Modals + Done-History + Säkalender-Sync',
    summary: 'Cowork-Mein-Garten-Audit (25 Lücken, 3 Quick-Wins). (1) gsTbDelete + gsErnteDelete nutzen jetzt gsConfirmModal statt native confirm() — Hard-Lesson #2 (iOS-PWA-Webview-Blocker bei nativen Alerts) endgültig für Mein-Garten geschlossen. (2) gsQuickDone + gsDoneAllDue schreiben pro Done einen p.diary-Entry mit Action + Timestamp + Source — Done-Verlauf bleibt erhalten und ist Cross-Device-synct via plants-Scope (Cap 200/Pflanze). (3) gs_sae_merkliste + 8 weitere Mein-Garten-Keys (gs_bl_*, gs_tb_*, gs_ernte_unit/view, gs_ernte_log als plants-Scope) in STATE_KEYS-Map + _buildStateBlob + Pull-Pfad stateMap — Säkalender-Merkliste und Sub-Tab-Prefs überleben Geräte-Wechsel.',
    user_summary: '🌱 Mein-Garten-Bereich härter gemacht: deine erledigten Aufgaben (Gießen/Düngen/etc) werden jetzt automatisch im Pflanzen-Tagebuch festgehalten, auch wenn du den Quick-Done-Button benutzt. Deine Säkalender-Merkliste und Ernte-Einstellungen werden zwischen deinen Geräten gesynct. Lösch-Bestätigungen im Tagebuch und Ernte-Tracker nutzen jetzt iOS-PWA-sichere Dialoge statt nativer Alerts.',
    user_items: [
      { emoji: '📔', text: 'Quick-Done schreibt jetzt Diary-Eintrag — Done-History bleibt erhalten' },
      { emoji: '⭐', text: 'Säkalender-Merkliste synct jetzt zwischen Geräten' },
      { emoji: '📱', text: 'Lösch-Bestätigungen jetzt iOS-PWA-safe (kein nativer Alert mehr)' },
      { emoji: '🔄', text: '9 Mein-Garten-Prefs jetzt cross-device-gesynct (Blühkalender, Tagebuch, Ernte)' },
    ],
    items: [
      {emoji:'✅', bold:'Quick-Win 1 — gsConfirmModal in gsTbDelete + gsErnteDelete:', text:' iOS-PWA-Webview-Block-Bug (Hard-Lesson #2) für Tagebuch + Ernte-Tracker behoben. Promise-API mit danger:true für Delete-Konfirms. Pluskick: gsTbDelete pushed jetzt zusätzlich granular via gsCloudSync.pushTbDel(id) gegen garden_diary (Race-Safety zur Blob-Push).'},
      {emoji:'✅', bold:'Quick-Win 2 — gsQuickDone + gsDoneAllDue persistieren Done-History:', text:' Jeder erledigte Task pusht p.diary.unshift({ts,action,title,source}) inkl. TASK_DEFS-Icon. Bulk-Done batched alle gleichzeitig. Cap 200 Einträge pro Pflanze (sonst Blob-Bloat). User-Wunsch "keine Daten dürfen verloren gehen" für Done-Verlauf damit erfüllt.'},
      {emoji:'✅', bold:'Quick-Win 3 — 9 Mein-Garten-Keys in STATE_KEYS:', text:' gs_sae_merkliste, gs_bl_month/tab/bee, gs_tb_filter/search/cat_selected, gs_ernte_unit/view — alle als state-Scope dirty-tracked. _buildStateBlob serialisiert in data.sae_merkliste + data.garten_prefs sub-object. Pull-Pfad stateMap setzt nach Cloud-Pull zurück in localStorage. Plus gs_ernte_log als plants-Scope (lokaler Cache, Cloud-Truth bleibt garden_harvests).'},
      {emoji:'📋', bold:'Audit-Findings:', text:' 25 Lücken dokumentiert in outputs/MEIN_GARTEN_AUDIT_v26.51.md. 3 Datenverlust-Hotspots identifiziert: Plant-Photos als base64 (LS-Quota-Risk), Garten-Diary ohne Foto-Upload, gs_sae_merkliste ohne Sync (heute gefixt).'},
      {emoji:'📦', bold:'Nächste Sprints in Mein-Garten (Backend-Migrations nötig):', text:' v26.52 Plant- + Diary-Fotos in Storage-Bucket (Bucket user-plant-photos + garden-diary-photos, URL statt base64). v26.53 Ernte-Schema-Erweiterung (notes, photo_url, weather, destination, price_chf, buyer). v26.54 Frost-Warnung Server-Cron (fn_check_frost_warnings + frost_history-Tabelle) + Wetter-Cache.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js gs-v26.51 OK · GS_VERSION=v26.51 OK · _headers v26.51 OK · meta=26.51.20260527 OK.'},
    ]
  },
  {
    v: 'v26.50', date: '24.05.2026',
    headline: '📊 ai_daily_usage Edge-Fn-Logging — 5 Edge-Fns gepatched, Admin-Widget zeigt jetzt Live-Daten',
    summary: 'Cowork-Auftrag v26.50 (Trio #4 Sprint 3/3 = Pentagon-Sprint #4 abgeschlossen). 5 Edge-Fns gepatched mit fn_log_ai_usage RPC fire-and-forget vor success-Return. LIVE deployed: pest-identify v2, mushroom-identify v2, garden-scan-analyze v5, plan-iterate v3, knowledge-bulk-gen v11. Token-Cost-Widget aus v26.47 zeigt jetzt echte Live-Daten statt leerem View.',
    user_summary: '📊 Backend-Hardening: jeder Anthropic-Call von 5 Edge-Fns wird jetzt in der ai_daily_usage-Tabelle aufgezeichnet (Tokens In/Out + Call-Count). Das Admin-Widget "KI-Nutzung & Kosten" (v26.47) zeigt damit jetzt echte Live-Daten — heute alle Calls aufgeschlüsselt pro Edge-Fn + 7-Tage-Trend mit echten Kosten in CHF.',
    user_items: [
      { emoji: '🚀', text: '5 Edge-Fns LIVE redeployed: pest-identify v2, mushroom-identify v2, garden-scan-analyze v5, plan-iterate v3, knowledge-bulk-gen v11' },
      { emoji: '📊', text: 'v26.47 Admin-Widget zeigt jetzt echte Live-Daten (statt leerer View)' },
      { emoji: '⚡', text: 'Logging ist fire-and-forget, blockiert die User-Response nicht' },
      { emoji: '🔒', text: 'fn_log_ai_usage RPC ist SECURITY DEFINER — Edge-Fns brauchen keine direkte Tabellen-Write-Permission' },
    ],
    items: [
      {emoji:'🚀', bold:'5 Edge-Fns LIVE redeployed:', text:' pest-identify v2 · mushroom-identify v2 · garden-scan-analyze v5 · plan-iterate v3 · knowledge-bulk-gen v11. Alle nutzen jetzt admin.rpc("fn_log_ai_usage", {p_edge_fn, p_tokens_in, p_tokens_out}) vor dem success-Return.'},
      {emoji:'⚡', bold:'Fire-and-forget Pattern:', text:' try/catch um den RPC-Call, Fehler werden geschluckt damit User-Response nicht blockiert wird. Tokens kommen aus anthropicData.usage (Sonnet) ODER aiJson.usage (Haiku Vision) ODER aiData.usage (Haiku Bulk).'},
      {emoji:'📋', bold:'Logging-Pattern:', text:' await admin.rpc("fn_log_ai_usage", { p_edge_fn: "<name>", p_tokens_in: usage?.input_tokens || 0, p_tokens_out: usage?.output_tokens || 0 }). Cowork-RPC ist SECURITY DEFINER mit UPSERT ON CONFLICT date+edge_fn DO UPDATE SET +=.'},
      {emoji:'📊', bold:'v26.47 Admin-Widget aktiviert:', text:' Settings → KI & Scanner → 📊 KI-Nutzung & Kosten zeigt jetzt echte Live-Daten. v_ai_usage_summary View aggregiert mit pre-computed estimated_cost_usd_haiku, das Widget multipliziert × 0.88 USD→CHF.'},
      {emoji:'📦', bold:'Pentagon-Sprint #4 v26.48-v26.50 abgeschlossen:', text:' 3 Pushes für 3 Sprints in einer Session. 1 neuer Wissen-Sub-Tab (11 total), 1 neues Home-Widget (Weather-Alert mit Pulse), 5 Edge-Fn-Redeploys. Total seit v26.33 heute: 18 Pushes in 4 Sessions.'},
      {emoji:'🌱', bold:'GreenScan-Bilanz:', text:' Voll ausgebaute Schweizer Naturgarten-PWA: 11 Wissen-Sub-Tabs, 5 KI-Plan-Intents, Pilz-Scanner mit 145-Notruf, 3 Home-Widgets (Bauernregel + Saison-Pilze + Wetter-Alert), Marketplace mit Bio-Filter, Forest-Garden 7-Schichten-Designer, Balkon-Wizard, Admin-Token-Dashboard mit Live-Logging.'},
      {emoji:'⏭️', bold:'Naechste:', text:' Stripe Live-Mode-Switch sobald Fernando bereit. DB-Wave-15 falls neue Domains sinnvoll.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js gs-v26.50 OK · GS_VERSION=v26.50 OK · _headers v26.50 OK · meta=26.50.20260524 OK · 5 Edge-Fns LIVE redeployed.'},
    ]
  },
  {
    v: 'v26.49', date: '24.05.2026',
    headline: '⚠ Wetter-Alert-Widget Home — 10 Garten-Warnungen mit MeteoSchweiz-Link (region-aware)',
    summary: 'Cowork-Auftrag v26.49 (Trio #4 Sprint 2/3). Neues #weather-alert-card auf Home über der Mushroom-Saison-Card. Query garden_weather_alerts mit typical_months overlap + Region-Filter heuristisch über GS_WA_REGION_TOKENS-Map. Severity-Sort katastrophal first, dann hours_to_react asc. Pulse-Animation bei katastrophal. Immediate-actions + MeteoSchweiz-Link + Nächste-Toggle. 4h Cache.',
    user_summary: '⚠ Auf der Startseite siehst du jetzt aktuelle Garten-Wetter-Warnungen für deine Region und den aktuellen Monat — z.B. "Spätfrost nach Eisheiligen" mit "React in 6h" + Sofort-Maßnahmen ("Vlies bereit halten"). Bei katastrophalen Warnungen (Hagel-Sturm) pulsiert die Karte. Direkter Link zu MeteoSchweiz-Warnstufen.',
    user_items: [
      { emoji: '⚠', text: '10 Garten-spezifische Wetter-Warnungen: Spätfrost, Hagel, Hitze, Dürre, Starkregen, Sturm, Glatteis-Bruch...' },
      { emoji: '📍', text: 'Region-aware: zeigt nur Warnungen für deine CH-Höhenzone (Mittelland/Voralpen/Wallis/Tessin)' },
      { emoji: '🚨', text: 'Sofort-Maßnahmen prominent bei jeder Warnung ("Vlies bereit halten", "Wasser stoppen"...)' },
      { emoji: '🛰', text: 'Direkter Link zu MeteoSchweiz-Warnstufen + Pulse-Animation bei katastrophal' },
    ],
    items: [
      {emoji:'🎨', bold:'Widget #weather-alert-card:', text:' Position über Mushroom-Saison-Card (höhere Priorität). Severity-Gradient (katastrophal=#b71c1c→#4a0000 + Pulse, hoch=#c62828, mittel=#e65100, gering=#f57c00).'},
      {emoji:'💓', bold:'Pulse-Animation bei katastrophal:', text:' Eigene gs-wa-pulse-keyframe (box-shadow 0px → 14px rgba(183,28,28) 1.5s infinite). Nur bei damage_severity=katastrophal aktiv.'},
      {emoji:'🔍', bold:'Query-Strategie:', text:' GET garden_weather_alerts?typical_months=cs.{currentMonth} (Postgres-Array-Contains). Client-side Region-Filter via GS_WA_REGION_TOKENS-Map: user_region_slug → ["Mittelland","Wallis",...] Substring-Match in typical_regions Text-Array. Fallback: alle Warnungen wenn kein Match.'},
      {emoji:'📊', bold:'Severity-Sort:', text:' sevRank katastrophal=0 < hoch=1 < mittel=2 < gering=3, dann hours_to_react asc (dringend first). User sieht dringendste Warnung zuerst.'},
      {emoji:'🎨', bold:'Render:', text:' Severity-Badge "⚠ HOCH · React in 6h" Header. Playfair-Title mit emoji. Region + erste 4 affected_plants. immediate_actions (Top-3) als dunkle Inline-Box. 2 Buttons: MeteoSchweiz-Link extern (target=_blank) + "Nächste" toggelt mit Fade.'},
      {emoji:'⏰', bold:'4h Cache:', text:' window._gsWeatherAlertCache mit cacheKey aus regionSlug+month — verhindert mehrfaches Reload pro Session.'},
      {emoji:'🚀', bold:'Auto-Load:', text:' gsLoadGardenWeatherAlerts wird 350ms nach Home-Mount aufgerufen (zwischen Wisdom und Mushroom-Season). Silent-fail wenn sbFetch fehlt.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.50 ai_daily_usage 1-Min-Patches in 5 Edge-Fns.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js gs-v26.49 OK · GS_VERSION=v26.49 OK · _headers v26.49 OK · meta=26.49.20260524 OK.'},
    ]
  },
  {
    v: 'v26.48', date: '24.05.2026',
    headline: '🦔 Garten-Besucher Sub-Tab — 12 Nützlinge + Schädlinge mit Schutz-Hinweisen',
    summary: 'Cowork-Auftrag v26.48 (Trio-Sprint #4 Start). 11. Wissen-Sub-Tab "🦔 Besucher" mit 12 garden_visitors_animals aus DB-Wave-14 (Igel, Marienkäfer, Fledermaus, Salamander, Eidechse, Regenwurm etc). Card-Accent farbig nach damage_severity + red_list_status. Detail-Modal mit Rote-Liste-Banner + Nützling-Highlight + beneficial_role als grosse grüne Box. PLUS: v26.47 Token-Cost-Widget wired to v_ai_usage_summary View mit pre-computed Haiku-Cost.',
    user_summary: '🦔 Im Wissen-Tab ist jetzt ein 11. Sub-Tab "🦔 Besucher" mit allen häufigen Schweizer Garten-Tieren — vom Igel über die Fledermaus (frisst 2000 Mücken/Nacht!) bis zur Blindschleiche (5-10 Schnecken/Tag). Nützlinge bekommen grünen Highlight-Banner. Gefährdete Arten (Igel, Hornisse, Salamander, Zauneidechse) werden rot/orange markiert mit Schutz-Hinweisen. Plus: Pro Tier "Was lockt" / "Was vertreibt" / "Unterschlupf bauen" als praktische Anleitung.',
    user_items: [
      { emoji: '🌿', text: '12 CH-Garten-Tiere: Igel, Eichhörnchen, Fledermaus, Marienkäfer, Hornisse, Salamander, Eidechse, Regenwurm...' },
      { emoji: '🐞', text: 'Nützling-Highlight grün mit beneficial_role prominent (z.B. "BESTER Blattlaus-Vertilger")' },
      { emoji: '⚠️', text: 'Gefährdete Arten rot markiert mit conservation_actions als Schutz-Liste' },
      { emoji: '🏠', text: 'Pro Tier: "Was lockt" / "Was vertreibt" / "Unterschlupf bauen" als Handlungsanleitung' },
    ],
    items: [
      {emoji:'🧩', bold:'11. Wave-9 Sub-Tab:', text:' #wissen-nav um "🦔 Besucher" Button erweitert. configs[besucher] table=garden_visitors_animals order=red_list_status,category,common_name_de.'},
      {emoji:'📋', bold:'Filter-Pills:', text:' categoryField=category. Distinct: saeugetier / insekt_nuetzling / insekt_schaedlich / reptil / amphibie / fledermaus / sonstige. Auto-Counts.'},
      {emoji:'🎨', bold:'Card-Accent:', text:' damage_severity hoch/katastrophal=#c62828 (rot), mittel=#e65100 (orange); red_list_status vom Aussterben=#b71c1c, gefährdet=#f9a825 (gelb); sonst Nützling (keiner/sehr_gering/gering)=#2e7d32 (grün).'},
      {emoji:'🎨', bold:'_gsWave9RenderVisitor Detail-Modal:', text:' Header-Gradient nach Status. Bei gefährdet: Rote-Liste-Banner ZUERST. Bei Nützling: grüner "NÜTZLING IM GARTEN"-Banner mit Category-Label. Category-Emoji-Pill + Size + CH-heimisch + protected_status + active_time. active_months. beneficial_role PROMINENT als grosse grüne Box mit Bold-Label. potential_damage als rote/orange Box bei sev>=mittel. habitat_in_garden. food_preferences + what_attracts + what_repels + shelter_recommendations + conservation_actions als List-Sections. observation_tips cyan + Fun-Fact orange.'},
      {emoji:'📊', bold:'v26.47 Token-Cost-Widget Wiring:', text:' Heute + 7-Tage-Trend lesen jetzt aus v_ai_usage_summary View (Cowork-Backend mit pre-computed estimated_cost_usd_haiku). Multiply × 0.88 USD→CHF für CHF-Anzeige. Fallback auf eigene gsEstimateCostCHF wenn View leer (Backwards-Compat falls View nicht deployed). Genauere Werte als die alte Client-Side-Estimate.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.49 Weather-Alert-Widget Home (region+month), v26.50 ai_daily_usage 1-Min-Patches in 5 Edge-Fns.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js gs-v26.48 OK · GS_VERSION=v26.48 OK · _headers v26.48 OK · meta=26.48.20260524 OK.'},
    ]
  },
  {
    v: 'v26.47', date: '24.05.2026',
    headline: '📊 Token-Cost-Widget Admin — Anthropic-Nutzung pro Tag mit 7-Tage-Trend (Pentagon #3 fertig)',
    summary: 'Cowork-Auftrag v26.47 (Sprint 5/5 = Pentagon-Sprint #3 v26.43-v26.47 abgeschlossen). Migration v26_47_ai_daily_usage LIVE applied (composite-PK date+edge_fn + RLS). Cowork ergänzt Edge-Fn-Logging via UPSERT in jeder Anthropic-Call. Admin-only Settings-Row "📊 KI-Nutzung & Kosten". Modal mit Heute-Tab (pro Edge-Fn Tokens/Calls/Cost) + 7-Tage-Trend-Tab (Tages-Total + Mini-Bar-Chart). Anthropic Haiku 4.5 Pricing client-side estimate (USD→CHF).',
    user_summary: '📊 Im Profil/Einstellungen ist jetzt ein Admin-only Widget "KI-Nutzung & Kosten" — zeigt pro Tag alle Anthropic-API-Calls aufgeschlüsselt pro Edge-Fn (garden-scan-analyze, pest-identify, mushroom-identify, etc.) mit geschätzten Kosten in CHF. Plus 7-Tage-Trend-View mit Mini-Balkendiagramm. Nur sichtbar für Admin-Email.',
    user_items: [
      { emoji: '📅', text: 'Heute-Tab: pro Edge-Fn Calls + Tokens In/Out + geschätzte CHF-Kosten' },
      { emoji: '📈', text: '7-Tage-Trend mit Mini-Bar-Chart und Durchschnitts-Tageskosten' },
      { emoji: '🔒', text: 'Nur sichtbar für Admin-Emails (greenscan + fernando.rankwiler1997)' },
      { emoji: '💰', text: 'Kosten geschätzt mit Anthropic Haiku 4.5: $1/Mio In · $5/Mio Out (USD→CHF)' },
    ],
    items: [
      {emoji:'🗄️', bold:'Migration v26_47_ai_daily_usage applied:', text:' CREATE TABLE ai_daily_usage (date date, edge_fn text, total_tokens_in/out int, total_cost_chf numeric, call_count int, updated_at, PRIMARY KEY (date, edge_fn)) + Index date desc + RLS (authenticated select, service_role all). Idempotent.'},
      {emoji:'🔄', bold:'Cowork-Sync:', text:' Cowork ergänzt jetzt UPSERT-Pattern in alle 8 Edge-Fns die Anthropic rufen (garden-scan-analyze, plant-doctor-diagnose, pest-identify, mushroom-identify, knowledge-bulk-gen, i18n-translate, book-ingest, feedback-triage). INSERT ON CONFLICT DO UPDATE SET +=.'},
      {emoji:'⚙️', bold:'Admin-Settings-Row:', text:' "📊 KI-Nutzung & Kosten" in "KI & Scanner"-Sektion. Class admin-only-row → display:none default, sichtbar nach GS_ADMINS.includes(email).'},
      {emoji:'📐', bold:'Modal #modal-token-cost:', text:' Header lila/teal-Gradient. 2 Tabs (📅 Heute · 📈 7-Tage-Trend) als button-toggles. Active-State #00838f bg.'},
      {emoji:'💰', bold:'Heute-Tab:', text:' GET ai_daily_usage?date=eq.<today>. Header-Card Playfair-Total CHF + Calls/Tokens-Sub. Pro Edge-Fn Card mit monospace-slug + CHF-Cost rechts + Calls/⬇Tok-In/⬆Tok-Out Sub.'},
      {emoji:'📈', bold:'7-Tage-Trend-Tab:', text:' GET ai_daily_usage?date=gte.<6daysAgo>. Aggregate pro Tag. Header mit 7d-Total + Ø/Tag. Mini-Bar-Chart pro Tag: linear-gradient #00bcd4→#00838f, Höhe proportional zu max-day-cost. Wochentag + Date + CHF-Cost + Calls.'},
      {emoji:'🧮', bold:'Client-side Cost-Estimate:', text:' gsEstimateCostCHF nutzt Anthropic Haiku 4.5 Pricing ($1/Mio In · $5/Mio Out × 0.88 USD→CHF). Disclaimer-Footer in beiden Tabs.'},
      {emoji:'🧰', bold:'5 neue Functions:', text:' openTokenCostModal / gsTokenCostSwitchTab / gsTokenCostLoadToday / gsTokenCostLoad7d / gsEstimateCostCHF / gsFormatChf.'},
      {emoji:'📦', bold:'Pentagon-Sprint #3 v26.43-v26.47 abgeschlossen:', text:' 5 Pushes für 5 Sprints in einer Session. 2 neue Wissen-Sub-Tabs (8 → 10 total), 1 neuer Garten-Aktion-Button (Forest-Garden), 1 Plan-Picker-Wizard-Inline (Balkon), 1 Admin-Dashboard. 1 Migration applied (ai_daily_usage). 16+ neue Functions. Total seit v26.33 heute: 15 Pushes.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js gs-v26.47 OK · GS_VERSION=v26.47 OK · _headers v26.47 OK · meta=26.47.20260524 OK · Migration applied.'},
    ]
  },
  {
    v: 'v26.46', date: '24.05.2026',
    headline: '🪴 Urban-Balkon-Wizard im KI-Planer — 16 CH-Designs mit Größe + Orientierung-Match',
    summary: 'Cowork-Auftrag v26.46 (Sprint 4/5 von Pentagon #3). KI-Planer Plan-Typ-Picker mit Container-Balkon-Option zeigt nun einen inline Balkon-Wizard: Number-Input m² + Orientation-Select + Match-Button. Query urban_balcony_design via size-Range-Match + Orientation-Filter (Fallback ohne Orientation). 6 inline-Result-Cards, Click öffnet Vollbild-Detail mit allen Eckdaten + recommended_plants + pro_tips. "Vorlage übernehmen" erstellt garden_plan mit template_slug + recommended_plants flat.',
    user_summary: '🪴 Wenn du im KI-Planer "Container-Balkon" wählst, fragt dich die App jetzt deine Balkon-Größe + Himmelsrichtung (Süd/Ost/Nord/...) und matched dazu passende Vorlagen aus 16 vorgefertigten Schweizer Stadtbalkon-Designs — vom 2m² Süd-Klein bis zum 30m² Wintergarten. Mit Container-Anzahl, CHF-Setup-Kosten und kompletter Pflanzliste. "Vorlage übernehmen" erstellt direkt einen Plan.',
    user_items: [
      { emoji: '📐', text: 'Number-Input für m² + Dropdown für 7 Orientierungen (inkl. Wintergarten)' },
      { emoji: '🔍', text: 'Auto-Match aus 16 urban_balcony_design-Vorlagen via size-Range + orientation' },
      { emoji: '💰', text: 'Pro Design: Setup-Kosten CHF + Container-Anzahl + Yield + Pflege min/Woche' },
      { emoji: '✨', text: '"Vorlage übernehmen" erstellt garden_plan mit kompletter Pflanzliste' },
    ],
    items: [
      {emoji:'🎨', bold:'Inline-Wizard im Plan-Typ-Picker:', text:' Bei intent="container" erscheint blauer Wizard-Block unter den 5 Plan-Typ-Buttons mit "🪴 Balkon-Wizard"-Header, m²-Number-Input + Orientation-Select + "🔍 Vorlagen"-Button.'},
      {emoji:'🔍', bold:'gsBalconyWizardSearch:', text:' Query urban_balcony_design WHERE balcony_size_m2_min<=user_size AND balcony_size_m2_max>=user_size + orientation=eq.<picked>. Fallback ohne orientation-Filter wenn 0 Treffer. Cache der Rows für Detail-Klick.'},
      {emoji:'🎴', bold:'Inline-Results:', text:' Bis 6 Card-Items mit Difficulty-Emoji + Size-Range + Orientation + Container + CHF + Yield. Click → gsBalconyTemplateOpen.'},
      {emoji:'🖼️', bold:'gsBalconyTemplateOpen Vollbild-Modal:', text:' Lila→Blau-Gradient-Header. Eckdaten-Pills (CHF + Container + Setup-h + Maintenance min/W + Pet-OK + Kind-OK). Watering/Winter/Wind/Sun-Strategy. recommended_plants als grüne Pills (bis 18). container_types + best_for_swiss_cities. Pro-Tips (grün) + Common-Pitfalls (rot) als Listen.'},
      {emoji:'✨', bold:'gsBalconyAdoptTemplate:', text:' POST /rest/v1/garden_plans mit title="🪴 <name_de>", plan_intent="container_balcony", recommended_plants flat aus jsonb (Array oder Object → normalisiert), metadata.balcony_template_slug/size/orientation. Toast bei Success + closeModal.'},
      {emoji:'🧰', bold:'4 neue Functions:', text:' gsBalconyWizardChanged (Input → metadata-Sync) / gsBalconyWizardSearch (Query + Fallback) / gsBalconyTemplateOpen (Detail-Modal) / gsBalconyAdoptTemplate (Plan-Insert).'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.47 Token-Cost-Widget Admin (Migration + Daily-Dashboard).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js gs-v26.46 OK · GS_VERSION=v26.46 OK · _headers v26.46 OK · meta=26.46.20260524 OK.'},
    ]
  },
  {
    v: 'v26.45', date: '24.05.2026',
    headline: '🪴 Indoor-Pflanzen-Sub-Tab — 20 Zimmer-Klassiker mit Pet-Tox-Warnung prominent',
    summary: 'Cowork-Auftrag v26.45 (Sprint 3/5 von Pentagon #3). 10. Wissen-Sub-Tab "🪴 Zimmer". 20 indoor_houseplants aus DB-Wave-13 (Monstera, Dieffenbachia TOXISCH, Spathiphyllum, Ficus etc.). Card-Accent rot bei toxic_to_pets/toxic_to_children, gruen bei air_purifying, hellgruen bei einfacher difficulty. Detail-Modal mit Pet/Kinder-Tox-Banner ZUERST + Air-Purifying-Banner als Pluspunkt + 2x2-Pflege-Profil (Licht/Wasser/Temp/Feuchte) + Vermehrung + Probleme + Pet-Disclaimer.',
    user_summary: '🪴 Im Wissen-Tab gibt es jetzt einen Sub-Tab "🪴 Zimmer" mit 20 Wohnzimmer-Klassikern. Toxische Pflanzen (Dieffenbachia, Monstera für Tiere/Kinder) werden mit rotem Banner + Tox-Info-145 angezeigt. Pflege-Profil als 2x2-Grid: Licht/Gießen/Temperatur/Luftfeuchte auf einen Blick. Air-Purifying-Pflanzen (NASA-Studie) bekommen einen grünen Bonus-Banner.',
    user_items: [
      { emoji: '🚫', text: 'Pet/Kinder-Tox-Banner rot prominent (Dieffenbachia, Monstera, etc.)' },
      { emoji: '🌬', text: 'Air-Purifying-Banner grün (NASA-Studie: Spathiphyllum, Ficus, Sansevieria)' },
      { emoji: '💡', text: '2x2-Pflege-Profil: Licht · Gießen · Temperatur · Luftfeuchte' },
      { emoji: '✂️', text: 'Pro Pflanze: Vermehrung + Dünger-Schedule + Topf-Material' },
    ],
    items: [
      {emoji:'🧩', bold:'10. Wave-9 Sub-Tab:', text:' #wissen-nav um "🪴 Zimmer" Button erweitert. configs[indoor] table=indoor_houseplants order=difficulty,common_name_de.'},
      {emoji:'📋', bold:'Filter-Pills:', text:' categoryField=light_requirement (Distinct: hell/sonne/halbschatten/schatten). Auto-Counts.'},
      {emoji:'🎨', bold:'Card-Accent:', text:' toxic_to_pets=true OR toxic_to_children=true → #c62828 (rot); air_purifying=true → #2e7d32 (grün); difficulty=einfach → #558b2f.'},
      {emoji:'🚫', bold:'Pet/Kinder-Tox-Banner:', text:' Bei isTox roter Vollbild-Banner ZUERST mit "TOXISCH für Haustiere & Kinder" + pet_warnings als Detail-Text + tel:145.'},
      {emoji:'🌬', bold:'Air-Purifying-Banner:', text:' Bei air_purifying=true und nicht toxic: grüner Bonus-Banner "🌬 LUFT-REINIGEND · NASA-Studie".'},
      {emoji:'🎨', bold:'2x2-Pflege-Profil-Grid:', text:' 💡 Licht (gelb) · 💧 Gießen (cyan) · 🌡 Temp (orange) · 💨 Feuchte (blau). Ranges aus min/max-Spalten.'},
      {emoji:'🪴', bold:'Detail-Layout:', text:' Badges (difficulty + origin_region + growth_speed + mature_size). Description. fertilizer_schedule grün + repotting_frequency braun + preferred_pot_material. propagation_method cyan. common_problems orange + pest_susceptibility rot als List-Sections. Pro-Tips grün. Pet-Disclaimer rot prominent am Ende bei toxic.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.46 Urban-Balkon-Wizard, v26.47 Token-Cost-Widget.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js gs-v26.45 OK · GS_VERSION=v26.45 OK · _headers v26.45 OK · meta=26.45.20260524 OK.'},
    ]
  },
  {
    v: 'v26.44', date: '24.05.2026',
    headline: '🌳 Forest-Garden Designer — 8 Permakultur-Designs mit 7-Schichten-SVG-Diagramm',
    summary: 'Cowork-Auftrag v26.44 (Sprint 2/5). Neuer Garten-Aktion-Button "🌳 Forest-Garden planen". Modal mit 8 forest_garden_design-Vorlagen (DB-Wave-13). Filter-Pills nach design_type. Card-Liste mit difficulty-Emoji + Size + Setup-Years + Yield + CHF. Detail-View mit vertikalem 7-Schichten-SVG-Diagramm (Canopy oben grün → Wurzel unten braun + Pilz-Etage lila), Schicht-Pflanzen als farbige Pills, Eckdaten-Pills, Pro-Tips + Pitfalls, "Plan übernehmen"-Button erstellt garden_plan mit plan_intent=permaculture_hugel.',
    user_summary: '🌳 Im Garten gibt es jetzt einen "Forest-Garden planen"-Button. Du wählst aus 8 Permakultur-Vorlagen (vom kleinen Pilz-Etage-Setup bis zum 300m² Food-Forest) und siehst pro Design ein farbiges 7-Schichten-Diagramm — von der Kronenschicht oben bis zu Wurzelpflanzen unten. "Plan übernehmen" erstellt direkt einen Garten-Plan mit allen Pflanzen.',
    user_items: [
      { emoji: '🌳', text: '8 Designs: Food-Forest, Beerenstrauch-Etage, Wildhecke, Pilz-Etage, Wein-Etage, ...' },
      { emoji: '📐', text: '7-Schichten-SVG-Diagramm pro Design — visuelles Permakultur-Modell' },
      { emoji: '💰', text: 'Pro Design: Setup-Kosten CHF + Yield kg/Jahr + Pflege-Stunden + Maturity-Years' },
      { emoji: '✨', text: '"Plan übernehmen" erstellt direkt einen garden_plan in deinem Garten' },
    ],
    items: [
      {emoji:'🎨', bold:'Garten-Aktion-Button:', text:' "🌳 Forest-Garden planen · 7-Schichten + 8 Vorlagen" mit Gradient #33691e→#1b5e20 neben den 9 anderen Garten-Aktionen.'},
      {emoji:'📐', bold:'Modal #modal-forest-garden:', text:' Intro + Filter-Pills (Distinct design_type) + Card-Liste. Card mit difficulty-Emoji (🟢 einfach / 🟡 mittel / 🔴 fortgeschritten) + Size-Range + Setup-Years + Yield + CHF + Description-Snippet.'},
      {emoji:'🖼️', bold:'7-Schichten-SVG-Diagramm:', text:' Vertikales SVG mit 8 Bändern: Canopy #1b5e20 → Understory #2e7d32 → Shrubs #388e3c → Herbaceous #558b2f → Groundcover #827717 → Rhizosphere #6d4c41 → Vertikal #5d4037 + Pilz-Etage #4a148c. Opacity 0.92 bei Schicht mit Daten, 0.4 bei leerer. Hintergrund-Gradient Himmel→Erde.'},
      {emoji:'🌱', bold:'Pflanzen-Pills pro Schicht:', text:' Jede Schicht mit Label + Beschreibung + alle Pflanzen aus dem jsonb-Feld als gefärbte Pills in der Schicht-Farbe.'},
      {emoji:'🏷️', bold:'Eckdaten-Pills:', text:' 🌾 Yield kg/J + 💰 CHF Setup + ⏱ Maintenance-Stunden + 🌳 Full-Maturity-Years.'},
      {emoji:'💡', bold:'Pro-Tips + Pitfalls:', text:' Grüne Pro-Tips-Box und rote Common-Pitfalls-Box je als Liste.'},
      {emoji:'✨', bold:'gsForestAdoptPlan:', text:' Klick auf "Plan übernehmen" → POST /rest/v1/garden_plans mit title="🌳 <name_de>", plan_intent="permaculture_hugel", recommended_plants flat aus allen 8 Layern, metadata.forest_design_slug. Toast bei Success.'},
      {emoji:'⏰', bold:'30min Cache:', text:' window._gsForestCache — verhindert mehrfaches Fetch beim Modal-Reopen.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.45 Indoor-Pflanzen-Tab, v26.46 Urban-Balkon-Wizard, v26.47 Token-Cost-Widget.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js gs-v26.44 OK · GS_VERSION=v26.44 OK · _headers v26.44 OK · meta=26.44.20260524 OK.'},
    ]
  },
  {
    v: 'v26.43', date: '24.05.2026',
    headline: '🏔️ Alpenpflanzen-Sub-Tab — 12 CH-Alpenklassiker mit Eisenhut-Lebensgefahr-Warnung',
    summary: 'Cowork-Auftrag v26.43 (Sprint 1/5 von Pentagon-Sprint #3). 9. Wissen-Sub-Tab "🏔️ Alpen". 12 alpine_garden_plants aus DB-Wave-13 inkl. Eisenhut (TÖDLICH GIFTIG), Edelweiss (geschützt), Enzian, Soldanelle, Arnika (geschützt). Card-Accent rot bei toxic (Eisenhut), orange bei protected, gelb bei Rote-Liste-Status. Detail-Modal mit Toedlich-Banner + tel:145 ZUERST + Schutz-Banner mit NHG-Hinweis + Höhenband-Badge prominent + Steingarten-Rolle + Companion-Plants.',
    user_summary: '🏔️ Im Wissen-Tab gibt es jetzt einen Sub-Tab "🏔️ Alpen" mit 12 Schweizer Alpenklassikern (Edelweiss, Enzian, Soldanelle, Arnika, …). Eisenhut wird mit roter Lebensgefahr-Warnung + Tox-Info-145 angezeigt. Geschützte Arten haben einen orangen "🔒 GESCHÜTZT"-Banner (Pflücken in CH verboten). Pro Pflanze: Höhenband, Standort, Härtegrad, Garten-Eignung.',
    user_items: [
      { emoji: '⛰', text: 'Höhenband-Badge prominent (z.B. "1500-3400m ü.M.") in der Card-Sub und im Detail' },
      { emoji: '☠️', text: 'Eisenhut: roter Vollbild-Banner "TÖDLICH GIFTIG" + tel:145 Notruf' },
      { emoji: '🔒', text: 'Geschützte Arten (Edelweiss/Arnika): oranger Banner mit NHG-Schutz-Hinweis' },
      { emoji: '🌿', text: 'Steingarten-Rolle + Garten-Eignung pro Pflanze' },
    ],
    items: [
      {emoji:'🧩', bold:'9. Wave-9 Sub-Tab:', text:' #wissen-nav um "🏔️ Alpen" Button erweitert. Dispatch via showWissen("alpen") → gsRenderWissenWave9 → configs[alpen] (table=alpine_garden_plants, order=altitude_m_min,common_name_de).'},
      {emoji:'📋', bold:'Filter-Pills:', text:' categoryField=habitat_type (Distinct: alpenmatte / alpenrasen / felsspalte / bachufer / felsschutt etc.). Auto-Counts.'},
      {emoji:'🎨', bold:'Card-Accent:', text:' warnings indexOf "tödlich" OR slug indexOf "eisenhut" → #b71c1c (rot); protected_species=true → #e65100 (orange); red_list_status gefährdet/verletzlich → #f9a825 (gelb). Card-Sub mit scientific_name + Höhenband + 🔒 bei protected + 🇨🇭 bei native.'},
      {emoji:'☠️', bold:'Toedlich-Banner (_gsWave9RenderAlpine):', text:' Bei isToxic ZUERST roter Vollbild-Banner "☠️ TÖDLICH GIFTIG — alle Pflanzenteile!" mit tel:145-Link.'},
      {emoji:'🔒', bold:'Schutz-Banner:', text:' Bei isProtected oranger Banner "GESCHÜTZT — Pflücken/Ausgraben in CH verboten (NHG)".'},
      {emoji:'🎨', bold:'Detail-Layout:', text:' Höhenband als grosser blauer Badge (#01579b). Badges (CH-heimisch + habitat_type + Rote-Liste-Status + cultivation_difficulty). Eckdaten kompakt (Exposition/Wasser/pH/Boden/Härte-Celsius). Wuchsform (Höhe/Breite/Blütezeit/Farbe). Garten-Eignung grün + Steingarten-Rolle braun. Kultivierungs-Notizen cyan. Companion-Plants (grüne List-Section). Warnungen prominent rot bei toxic, orange sonst. Schutz-Disclaimer lila bei protected.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.44 Forest-Garden Designer mit 7-Schichten-SVG, v26.45 Indoor-Pflanzen-Tab, v26.46 Urban-Balkon-Wizard, v26.47 Token-Cost-Widget.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js gs-v26.43 OK · GS_VERSION=v26.43 OK · _headers v26.43 OK · meta=26.43.20260524 OK.'},
    ]
  },
  {
    v: 'v26.42', date: '23.05.2026',
    headline: '🦜 Vogel-Garten Sub-Tab + Vogel-Garten-Modus im KI-Planer (Pentagon-Sprint #2 fertig)',
    summary: 'Cowork-Auftrag v26.42 (Sprint 5/5 = Pentagon-Sprint #2 v26.38-v26.42 abgeschlossen). 8. Sub-Tab "🦜 Vögel" im Wissen-Tab aktiviert (19 garden_birds_register). Card-Accent nach Rote-Liste-Status (gefährdete rot, verletzlich orange). Detail-Modal mit Lockpflanzen + Futter + Nistkasten + Attracting-Tips + Bedrohungen + Fun-Fact. Plus: KI-Planer Plan-Typ-Picker um 5. Option "🦜 Vogel-Garten" erweitert (bird_friendly intent). Cowork-Ergänzung garden-scan-analyze v4 wird das nutzen.',
    user_summary: '🦜 8. Sub-Tab im Wissen "🦜 Vögel" mit 19 CH-Garten-Vögeln. Gefährdete Arten werden rot markiert. Pro Vogel: welche Pflanzen locken ihn (z.B. Beerensträucher), welches Futterhaus, welche Bedrohungen. Plus: Im KI-Planer kannst du nun "🦜 Vogel-Garten" wählen — die KI empfiehlt dann Hecken, Beerensträucher und Wildkräuter-Ecken statt nur Gemüse.',
    user_items: [
      { emoji: '🦜', text: '19 CH-Garten-Vögel mit Nistkasten-Specs, Lockpflanzen, Saison' },
      { emoji: '⚠️', text: 'Rote-Liste-Status farblich (rot = vom Aussterben, orange = verletzlich)' },
      { emoji: '🌳', text: 'KI-Planer: 5. Plan-Typ "🦜 Vogel-Garten" für vogelfreundliche Gärten' },
      { emoji: '💡', text: 'Pro Vogel: attracting_tips als praktische Bird-Friendly-Garten-Anleitung' },
    ],
    items: [
      {emoji:'🧩', bold:'8. Wave-9 Sub-Tab:', text:' #wissen-nav um "🦜 Vögel" Button erweitert. Dispatch via showWissen("voegel") → gsRenderWissenWave9 → configs[voegel] (table=garden_birds_register, order=status_in_ch,common_name_de).'},
      {emoji:'🎨', bold:'Card-Accent nach Rote-Liste:', text:' "vom aussterben"/"stark gefährdet"=#b71c1c (rot), "verletzlich"/"gefährdet"=#e65100 (orange), "potentiell/nahezu gefährdet"=#f9a825 (gelb). Card-Sub mit scientific_name + size_cm + Rote-Liste-Warnung.'},
      {emoji:'🎨', bold:'_gsWave9RenderBird (in v26.38 enthalten):', text:' Header-Gradient nach Status. Banner bei gefährdet. Status-Badges (📊 Status + 📏 Grösse + ⚖ Gewicht). Aktiv-Monate + Beobachtungs-Zeit + Gesang-Beschreibung. Lockpflanzen (grün) + Futter (gelb) + Futterhaus-Körner (orange) als Listen. Birdhouse-Type-Box (braun) mit Lage. attracting_tips als grüne Bird-Friendly-Garten-Anleitung. Bedrohungen-Liste (rot). Fun-Fact (orange).'},
      {emoji:'🌳', bold:'KI-Planer Plan-Typ-Erweiterung:', text:' intentOptions im gsBuildGardenScanWizard um 5. Option "🦜 Vogel-Garten" ergänzt (bird_friendly intent). Bei Auswahl grüne Hint-Box "KI empfiehlt Hecken, Beerensträucher und Wildkräuter-Ecken — wenig Rasen, viel Vielfalt".'},
      {emoji:'🏷️', bold:'Result-Preview Erweiterung:', text:' intentLabelMap + isBirdFriendly Variable. Plant-Liste mit birdTag forward-compat: pl.bird_tags Array (Backend v4) → "🦜 Lockt: Amsel, Rotkehlchen, Singdrossel" ODER bei isBirdFriendly + pl.attracts_birds/bird_friendly=true → "🦜 Vogel-freundlich".'},
      {emoji:'🤝', bold:'Cowork-Sync:', text:' garden-scan-analyze v4 mit plan_intent="bird_friendly" parallel von Cowork deployed — liest Top-Vögel mit attracting_tips, empfiehlt Hecken/Beerensträucher/Wildkräuter-Ecken.'},
      {emoji:'📦', bold:'Pentagon-Sprint #2 v26.38-v26.42 fertig:', text:' 5 Pushes für 5 Sprints in einer Session: Mushroom-Glossar + Saison-Widget + Companion-View + Wassergarten-Tab + Vogel-Tab/Bird-Friendly. 3 neue Wissen-Sub-Tabs (6→8), 1 Home-Widget, 1 KI-Planer-Plan-Typ-Erweiterung (4→5), 1 Plan-Detail-Erweiterung (Companions), 10+ neue Functions inkl. mushroom-recipe-Modal.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js gs-v26.42 OK · GS_VERSION=v26.42 OK · _headers v26.42 OK · meta=26.42.20260523 OK.'},
    ]
  },
  {
    v: 'v26.41', date: '23.05.2026',
    headline: '💧 Wassergarten-Sub-Tab — 24 Teichpflanzen + Designs aus DB-Wave-12',
    summary: 'Cowork-Auftrag v26.41 (Sprint 4/5). 7. Sub-Tab "💧 Wassergarten" im Wissen-Tab aktiviert (configs + Renderer bereits in v26.38 als forward-compat enthalten). 24 water_features-Einträge (Teichpflanzen + Schwimm-/Unterwasserpflanzen + Teich-Designs + Wassertiere). Filter-Pills nach feature_type. Card-Accent rot bei invasive_in_ch, blau bei teich_design, grün bei swiss_native. Detail-Modal mit Pairing + CH-Recht-Hinweis bei Teich-Designs.',
    user_summary: '💧 Im Wissen-Tab gibt es jetzt einen Sub-Tab "💧 Wassergarten" mit 24 CH-Teichpflanzen, Schwimmpflanzen, Unterwasserpflanzen, Teich-Designs (vom Naturteich bis zum Mini-Balkon-Teich) und Wassertieren. Invasive Pflanzen werden rot markiert mit "⛔ INVASIV in CH". Bei Teich-Designs ein Hinweis zur Bewilligung beim Bauamt.',
    user_items: [
      { emoji: '🌿', text: '24 Wassergarten-Einträge: Teichpflanzen, Schwimmer, Unterwasser, Designs, Tiere' },
      { emoji: '🇨🇭', text: 'CH-heimisch / invasiv Klassifizierung — keine Invasiven mehr versehentlich setzen' },
      { emoji: '🌳', text: 'Teich-Designs vom Naturteich bis Balkon-Mini-Teich mit Kosten + Pflanzliste' },
      { emoji: '🤝', text: 'Best-paired-with / do-not-pair Listen pro Pflanze' },
    ],
    items: [
      {emoji:'🧩', bold:'7. Wave-9 Sub-Tab:', text:' #wissen-nav um "💧 Wassergarten" Button erweitert. Dispatch via showWissen("wasser") → gsRenderWissenWave9 → configs[wasser] (table=water_features, order=feature_type,name_de).'},
      {emoji:'📋', bold:'Filter-Pills:', text:' Distinct feature_type: teichpflanze / schwimmpflanze / unterwasserpflanze / teich_design / wassertier. Auto-Counts pro Type.'},
      {emoji:'🎨', bold:'Card-Accent:', text:' invasive_in_ch=#c62828 (rot), teich_design=#1565c0 (blau), swiss_native=#2e7d32 (grün). Card-Sub mit scientific_name + Tiefe-Range + 🇨🇭-Flag bei native.'},
      {emoji:'⛔', bold:'Invasive-Banner:', text:' Bei invasive_in_ch=true → rotes Top-Banner "⛔ INVASIV in CH — bitte nicht setzen!" im Detail-Modal.'},
      {emoji:'🎨', bold:'_gsWave9RenderWater (in v26.38 enthalten):', text:' Header-Gradient nach Type. Badges (CH-heimisch + Sauerstoff + Wasser-Filtration + Tiere + CHF-Kosten). Wasser-Tiefe + Licht + Hardiness-Zone + Höhe-über-Wasser. Blütezeit + Farbe. best_paired_with (grün) + do_not_pair_with (rot). Kultivierungs-Tipps (cyan) + Warnungen (orange). Bei teich_design: CH-Recht-Hinweis (Gemeinde-Bewilligung).'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.42 Vogel-Garten-Sub-Tab + bird_friendly plan_intent (Cowork garden-scan-analyze v4 wird das nutzen).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js gs-v26.41 OK · GS_VERSION=v26.41 OK · _headers v26.41 OK · meta=26.41.20260523 OK.'},
    ]
  },
  {
    v: 'v26.40', date: '23.05.2026',
    headline: '🤝 Companion-Lookup im KI-Planer — gute & schlechte Nachbarn aus v_companion_lookup (Bonus B-B)',
    summary: 'Cowork-Auftrag v26.40 (Bonus B-B, Sprint 3/5). Im Plan-Detail-Modal (gsGardenScanShowPlant) wird zusätzlich zur v26.24 Pest-Box ein async-Block geladen mit Top-3 "gute Nachbarn" + Top-2 "schlechte Nachbarn" aus v_companion_lookup View. Vereinfacht die alte OR-Logik auf 1 GET-Query pro Pflanze. Render: 2 Boxen (grün + rot) mit partner_lat + Confidence-Badge + reason + effect_on_self. 15min in-Memory-Cache pro species_lat.',
    user_summary: '🤝 Wenn du im KI-Planer eine Pflanze antippst, zeigt dir die App jetzt automatisch ihre "guten Nachbarn" (wie Basilikum bei Tomaten) und "schlechten Nachbarn" (Pflanzen, die nicht direkt daneben sollten). Mit wissenschaftlicher Confidence-Bewertung in Prozent und kurzer Begründung.',
    user_items: [
      { emoji: '🤝', text: 'Top-3 gute Nachbarn pro Pflanze mit Begründung' },
      { emoji: '🚫', text: 'Top-2 schlechte Nachbarn als Warnung (rot)' },
      { emoji: '📊', text: 'Confidence-Badge (Prozent) zeigt wissenschaftliche Belegbarkeit' },
      { emoji: '⚡', text: 'Schneller dank neuer v_companion_lookup View (1 Query statt 2)' },
    ],
    items: [
      {emoji:'🧩', bold:'gsLoadCompanionsForPlanPlant(idx, lat):', text:' Async-Helper triggert nach Modal-Render parallel zu gsLoadPestsForPlanPlant. GET v_companion_lookup?species_lat=eq.<lat>&order=confidence.desc&limit=20.'},
      {emoji:'⚡', bold:'View statt OR-Query:', text:' Cowork hat v_companion_lookup mit pre-computed bidirektionalem Lookup deployed (statt der alten companion_plants_full OR(species_a=X,species_b=X) Logik). 1 Query pro Pflanze statt 2.'},
      {emoji:'🎨', bold:'2-Boxen-Render:', text:' Client-side split nach relationship. Grüne Box "🤝 Gute Nachbarn (Top 3)" mit partner_lat + 🟢-Confidence-Badge + reason + effect_on_self italic. Rote Box "⚠️ Schlechte Nachbarn (nicht direkt daneben)" Top-2 mit 🔴-Confidence-Badge + reason.'},
      {emoji:'📦', bold:'Mount-Slot:', text:' #ai-plant-companions-block-<idx> ZWISCHEN den Pflanzen-Rows und der v26.24 Pest-Box.'},
      {emoji:'⏰', bold:'15min Cache:', text:' window._gsCompanionCache pro species_lat — wenn User mehrere Pflanzen im selben Plan antippt.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.41 Wassergarten-Tab, v26.42 Vogel-Tab + bird_friendly plan_intent.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js gs-v26.40 OK · GS_VERSION=v26.40 OK · _headers v26.40 OK · meta=26.40.20260523 OK.'},
    ]
  },
  {
    v: 'v26.39', date: '23.05.2026',
    headline: '🍄 Saison-Pilze-Widget Home — region-aware mit VAPKO-Telefon (Bonus B-A)',
    summary: 'Cowork-Auftrag v26.39 (Bonus B-A, Sprint 2/5). Neues Home-Widget #mushroom-season-card lila zwischen Bauernregel und Quiz. Query mushroom_seasonal_patches mit best_months overlap currentMonth + region_canton_codes overlap userCantons via gsGetRegionContext (v26.27 API). Day-of-year deterministisch eine Patch pro Tag. 6h in-Memory-Cache pro region+month. Render mit typical_mushrooms-Liste + weather_trigger + VAPKO-Telefon + 2 Action-Buttons.',
    user_summary: '🍄 Auf der Startseite siehst du jetzt täglich: "Saison-Pilze in deiner Region" — z.B. "Mai · Mittelland Mischwald: Steinpilz · Marone · Pfifferling · Parasol". Mit Schwierigkeit-Badge, Wetter-Trigger ("Nach 2-3 Tagen Regen + 15-22°C"), VAPKO-Telefonnummer als 1-Klick-Anruf. Buttons öffnen direkt den Pilz-Scanner oder den Regional-Kalender.',
    user_items: [
      { emoji: '📍', text: 'Region-aware: zeigt typische Pilze für deine CH-Kantone' },
      { emoji: '📅', text: 'Filter nach aktuellem Monat — z.B. im Oktober andere Pilze als im Juli' },
      { emoji: '🌧', text: 'Wetter-Trigger-Hinweis ("Nach 2-3 Tagen Regen + 15-22°C")' },
      { emoji: '☎️', text: 'VAPKO-Telefonnummer als 1-Klick-Anruf direkt im Widget' },
    ],
    items: [
      {emoji:'🎨', bold:'Widget #mushroom-season-card:', text:' Lila Gradient #4a148c→#6a1b9a. Header mit "🍄 Saison-Pilze in deiner Region" + Schwierigkeit-Badge (🎯 einfach/mittel/schwer). Region-Zeile (Monat · regionName · forest_type). Playfair-Liste der Top-5 typical_mushrooms (titlecased). Wetter-Trigger in dunkler Inline-Box. VAPKO-Kontrollstelle + tel-Link. 2 Buttons: Pilz-Scanner (öffnet openMushroomModal) + Region wechseln (openRegionalCalendarModal).'},
      {emoji:'🔍', bold:'Query-Strategie:', text:' /rest/v1/mushroom_seasonal_patches?best_months=cs.{currentMonth}&region_canton_codes=ov.{userCantons}. Cantons aus gsGetRegionContext (v26.27 API) — Fallback wenn keine Region: erste 10 Patches des Monats. Day-of-year deterministisch (day % rows.length) → fix eine Patch pro Tag.'},
      {emoji:'⏰', bold:'6h Cache:', text:' window._gsMushroomSeasonCache mit cacheKey aus cantons+month — verhindert mehrfaches Reload.'},
      {emoji:'🚀', bold:'Auto-Load:', text:' gsLoadTodaysMushroomSeason wird 500ms nach Home-Mount aufgerufen (im selben Block wie gsLoadTodaysWisdom). Silent-fail wenn sbFetch fehlt.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.40 Companion-View, v26.41 Wassergarten-Tab, v26.42 Vogel-Tab + bird_friendly plan_intent.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js gs-v26.39 OK · GS_VERSION=v26.39 OK · _headers v26.39 OK · meta=26.39.20260523 OK.'},
    ]
  },
  {
    v: 'v26.38', date: '23.05.2026',
    headline: '🍄 Pilz-Glossar im Wissen-Tab — 20 CH-Pilze mit Lookalikes + Rezepten',
    summary: 'Cowork-Auftrag v26.38 (Bonus B-C, Sprint 1/5 von Pentagon-Sprint #2). 6. Sub-Tab "🍄 Pilze" im Wissen-Tab als Erweiterung der v26.23 Wave-9-Renderer. mushroom_register sortiert nach edibility ASC (toedlich/giftig zuerst = Warnungen prominent). Card-Accent-Farbe nach Edibility. Detail-Modal mit Lebensgefahr-Banner + tel:145 ZUERST bei toedlich/giftig. Async sub-loads für bidirektionale Lookalikes (mushroom_lookalikes via .or-Query) + Rezepte (mushroom_recipes via primary_mushroom_slugs cs.{slug}). Eigener gsMushroomRecipeOpen-Modal für Rezept-Details.',
    user_summary: '🍄 Im Wissen-Tab gibt es jetzt einen Sub-Tab "🍄 Pilze" — alle 20 CH-Pilze auf einen Blick. Tödliche und giftige werden rot angezeigt und stehen ganz oben (Warnung prominent). Im Detail-Modal siehst du Verwechslungs-Pilze ("Lookalikes") mit Visual/Geruch/Sporen-Unterschieden — und bei Speisepilzen direkt die passenden Rezepte aus der DB.',
    user_items: [
      { emoji: '🍄', text: '20 CH-Pilze sortiert nach Sicherheit (tödliche zuerst, Speisepilze nach unten)' },
      { emoji: '☠️', text: 'Bei tödlich/giftig: roter Header + Tox-Info-145-Banner sofort sichtbar' },
      { emoji: '⚠️', text: 'Lookalikes-Block mit Confusion-Risk-Badge + Visual/Geruch/Sporen-Unterschiede' },
      { emoji: '🍳', text: 'Bei Speisepilzen: passende Rezepte aus der DB (25 Pilz-Rezepte)' },
    ],
    items: [
      {emoji:'🧩', bold:'6. Wave-9 Sub-Tab:', text:' #wissen-nav um "🍄 Pilze" Button erweitert. Dispatch via showWissen("pilze") → gsRenderWissenWave9.'},
      {emoji:'📋', bold:'configs[pilze]:', text:' table=mushroom_register, order=edibility,common_name_de (toedlich → giftig → bedingt_essbar → speisepilz). categoryField=edibility (Filter-Pills nach Sicherheits-Klasse). Card-Sub mit scientific_name + VAPKO-Klasse + erste 2 Habitat-Tags.'},
      {emoji:'🔴', bold:'Card-Accent nach Edibility:', text:' toedlich=#b71c1c, giftig=#e65100, bedingt_essbar/speisepilz_jung=#f9a825, speisepilz=#2e7d32. Border-Left-Accent in Karten.'},
      {emoji:'🎨', bold:'_gsWave9RenderMushroom Detail-Modal:', text:' Header-Gradient nach Edibility (rot/orange/gelb/grün). Lebensgefahr-Banner mit tel:145-Link ZUERST bei toedlich/giftig. Badges (Edibility-Pill + VAPKO + protected_status). Habitat + Symbiose + Saison-Monate + Höhen-Range. Identifying-Features in gelber Highlight-Box. Morph-Kompakt-Zeile (Hut/Lamellen/Sporen/Stiel/Geruch/Geschmack). Bei Gift: toxic_compounds + symptoms_if_toxic + emergency_action in roten Boxen. Bei Speisepilz: cooking_preparation + conservation_methods in grünen Boxen. cultural_notes. VAPKO-Footer immer.'},
      {emoji:'🔁', bold:'Async Lookalikes-Sub-Load:', text:' _gsMushroomLoadDetailExtras query mushroom_lookalikes via .or(edible_slug.eq.,lookalike_slug.eq.) bidirektional. risk-Badge (hoch=#c62828, mittel=#e65100, niedrig=#827717). Pro Lookalike: visual_differences + smell_differences + habitat_differences + spore_print_differences + pro_tip in grünem Inline-Badge.'},
      {emoji:'🍳', bold:'Async Rezepte-Sub-Load:', text:' Nur bei isEdible: query mushroom_recipes?primary_mushroom_slugs=cs.{slug}. Card-Liste mit emoji + title + difficulty + Gesamt-Minuten + 🇨🇭-Marker bei swiss_tradition. Click → gsMushroomRecipeOpen mit eigenem Detail-Modal (Header-Gradient #827717→#558b2f, Zutaten-Liste, nummerierte Steps, Methode/Pairing/Tradition/Region).'},
      {emoji:'🔮', bold:'Forward-Compat:', text:' configs[wasser] + configs[voegel] + _gsWave9RenderWater + _gsWave9RenderBird sind bereits enthalten (Tabs werden in v26.41/v26.42 ergänzt).'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.39 Mushroom-Saison-Widget Home, v26.40 Companion-Lookup-View, v26.41 Wassergarten-Sub-Tab, v26.42 Vogel-Garten + bird_friendly plan_intent.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js gs-v26.38 OK · GS_VERSION=v26.38 OK · _headers v26.38 OK · meta=26.38.20260523 OK.'},
    ]
  },
  {
    v: 'v26.37', date: '23.05.2026',
    headline: '🐝 Pollinator-Garten-Modus — Plan-Typ-Picker im KI-Planer (Bienen, Permakultur, Container)',
    summary: 'Cowork-Auftrag v26.37 (Sprint 5/5 = Pentagon-Sprint v26.33-v26.37 abgeschlossen). KI-Planer-Wizard bekommt 4-Optionen-Plan-Typ-Picker (Selbstversorgung default / Bienen-Garten / Permakultur-Hügel / Container-Balkon). gsRunGardenScan setzt body.metadata.plan_intent — Cowork-Ergänzung garden-scan-analyze v3 wird das nutzen für System-Prompt-Erweiterung (bei pollinator: Top-Bestäuber-Pflanzen aus pollinators.preferred_flowers + ecological_value-Sortierung). Plant-Liste forward-compatible mit 🐝-Tag wenn Backend v3 pl.pollinator_tags liefert.',
    user_summary: '🐝 Beim KI-Planer kannst du jetzt wählen, was für einen Garten du willst: 🥕 Selbstversorgung (Standard), 🐝 Bienen-Garten (KI bevorzugt Bestäuber-Pflanzen), 🌳 Permakultur-Hügel oder 🪴 Container-Balkon. Im Plan-Ergebnis steht dein gewählter Typ als Badge, und bei Bienen-Modus werden Pflanzen mit Hinweis "🐝 Bevorzugt von: Honigbiene, Hummel, Schwebfliege" markiert.',
    user_items: [
      { emoji: '🌳', text: '4 Plan-Typen wählbar — KI passt Pflanzen-Auswahl an deinen Garten-Zweck an' },
      { emoji: '🐝', text: 'Bei "Bienen-Garten" Modus: KI bevorzugt Pflanzen mit hoher ecological_value für Bestäuber' },
      { emoji: '🏷️', text: 'Plan-Result zeigt gewählten Typ als Badge im Header' },
      { emoji: '🐝', text: 'Plant-Liste bekommt Bestäuber-Hinweise bei passenden Pflanzen' },
    ],
    items: [
      {emoji:'🎨', bold:'Plan-Typ-Picker:', text:' 2x2-Grid mit 4 Buttons im KI-Garten-Scan-Wizard (vor GPS-Block). Options: self_sufficiency (🥕 Selbstversorgung default) / pollinator (🐝 Bienen-Garten) / permaculture (🌳 Permakultur-Hügel) / container (🪴 Container-Balkon). Active-State: solid #2e7d32 bg, weiß text.'},
      {emoji:'💡', bold:'Pollinator-Hint:', text:' Bei plan_intent=pollinator zusätzliche gelbe Hint-Box ("KI bevorzugt Pflanzen mit hoher ecological_value für Bestäuber") unter den Buttons.'},
      {emoji:'🚀', bold:'gsRunGardenScan-Wiring:', text:' body.metadata.plan_intent defaultet auf self_sufficiency wenn unset. Backend (garden-scan-analyze v3, Cowork-Ergänzung) liest das und ändert den System-Prompt entsprechend.'},
      {emoji:'🏷️', bold:'Result-Preview Header-Badge:', text:' intentLbl in 4-Map (Emoji + Label) wird als white-on-green pill im Result-Header gezeigt (z.B. "🐝 Bienen-Garten").'},
      {emoji:'🐝', bold:'Plant-Liste Pollinator-Tag:', text:' beeTag-Logik im rp.map: (a) wenn pl.pollinator_tags Array vorhanden (Backend v3) → "🐝 Bevorzugt von: Honigbiene, Hummel, Schwebfliege"; (b) sonst wenn isPollinator + pl.ecological_value >= 7 → "🐝 Hoher Bestäuber-Wert". Forward-compatible für noch nicht deployed garden-scan-analyze v3.'},
      {emoji:'🧰', bold:'gsGardenScanSetIntent:', text:' Window-exposed Setter. Updated window._gsGardenScan.metadata.plan_intent + ruft _gsGardenScanRefresh — re-rendert Wizard mit neuem Active-Button + Hint-Box.'},
      {emoji:'📦', bold:'Pentagon-Sprint v26.33-v26.37 fertig:', text:' 5 Sprints in einer Session: Pilz-Scanner + Tagebuch-UI + Bauernregeln + Pestizid-frei-Filter + Pollinator-Modus. 1 Migration applied, 1 Edge-Fn deployed (mushroom-identify v1), 14+ neue Functions, 4 neue Modals, 4 neue Garten-Aktion-Buttons, 1 Home-Widget.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js gs-v26.37 OK · GS_VERSION=v26.37 OK · _headers v26.37 OK · meta=26.37.20260523 OK.'},
    ]
  },
  {
    v: 'v26.36', date: '23.05.2026',
    headline: '🌱 Marketplace Bio + Pestizid-frei — Migration + Checkboxen + 2 Filter-Pills + Badges',
    summary: 'Cowork-Auftrag v26.36 (Sprint 4/5). Migration v26_36_marketplace_pesticide_free LIVE-applied via Supabase MCP — fügt 3 Spalten zu marketplace_listings hinzu (organic_certified bool, pesticide_free bool, certification_label text) + 2 partial Indexes. Frontend: Bio + Pestizid-frei Checkboxen in beiden Listing-Forms (submitListing + saveListing). Bei Bio-Aktivierung erscheint Cert-Label-Dropdown (6 Optionen: Knospe / EU-Bio / Demeter / Naturland / Bioland / Sonstiges). renderMarket-Cards mit grünem Bio-Badge + orangem Pestizid-frei-Badge. 2 neue Filter-Pills "🌱 Bio-zertifiziert" + "🚫 Pestizid-frei" oberhalb der Listings.',
    user_summary: '🌱 Im Marktplatz kannst du jetzt beim Inserieren angeben "Bio-zertifiziert" (mit Label wie Knospe, EU-Bio, Demeter) oder "Pestizid-frei" (eigene Aussage). Käufer sehen das als grünes/oranges Badge auf der Karte. Plus: 2 neue Filter-Pills um nur Bio oder nur Pestizid-frei zu zeigen.',
    user_items: [
      { emoji: '🌱', text: 'Bio-Zertifizierung mit 6 Labels: Knospe, EU-Bio, Demeter, Naturland, Bioland, Sonstiges' },
      { emoji: '🚫', text: 'Pestizid-frei als zusätzliche eigene Aussage (ohne Zertifikat)' },
      { emoji: '🟢', text: 'Bio-Badge grün auf Listing-Cards: "🌱 Bio (Knospe)"' },
      { emoji: '🔍', text: '2 Filter-Pills im Marktplatz — nur Bio oder nur Pestizid-frei zeigen' },
    ],
    items: [
      {emoji:'🗄️', bold:'Migration v26_36 applied:', text:' ALTER TABLE marketplace_listings ADD organic_certified bool default false + pesticide_free bool default false + certification_label text. Plus 2 partial Indexes (WHERE organic_certified=true / pesticide_free=true). idempotent (IF NOT EXISTS).'},
      {emoji:'☑️', bold:'Checkboxen im submitListing-Form:', text:' Neuer mp-field-Block nach Kontakt mit 2 Checkboxen (Bio grün-rot Hintergrund + Pestizid-frei orange Hintergrund). Bio-Checkbox toggelt #listing-cert-row mit 6-Label-Dropdown. tags Array bekommt "Bio" / "Pestizid-frei" automatisch.'},
      {emoji:'☑️', bold:'Checkboxen im saveListing-Form:', text:' Identische UI im inline-erzeugten nl-* Form. Edge-Fn marketplace-publish kennt die Spalten noch nicht → PATCH-Call nach POST setzt sie nach.'},
      {emoji:'🗺️', bold:'loadMarketFromSupabase:', text:' DB-Schema-Mapping erweitert um organic_certified + pesticide_free + certification_label.'},
      {emoji:'🏷️', bold:'Badges auf Cards:', text:' Bio-Badge #e8f5e9/#1b5e20 "🌱 Bio (Knospe)" mit Cert-Label im Title-Tooltip. Pestizid-frei-Badge #fff8e1/#bf360c "🚫 Pestizid-frei" nur wenn nicht Bio (Bio implies pestfree). Beide in der Meta-Zeile rechts neben verifiedBadge.'},
      {emoji:'🔍', bold:'2 Filter-Pills:', text:' "🌱 Bio-zertifiziert" + "🚫 Pestizid-frei" als pill-buttons in eigener Toolbar oberhalb der Listings. Click toggelt gs_market_filter_organic/_pestfree in localStorage (Persistenz). Active-State: solid grüner/oranger Background. Pestizid-frei-Filter zeigt auch Bio (Bio implies pestfree).'},
      {emoji:'🧰', bold:'gsMarketResetFilter:', text:' Erweitert um die 2 neuen localStorage-Keys (organic + pestfree) — Reset-Button löscht jetzt alles inklusive Bio/Pestizid-Filter.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.37 Pollinator-Garten-Modus im KI-Planer.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js gs-v26.36 OK · GS_VERSION=v26.36 OK · _headers v26.36 OK · meta=26.36.20260523 OK · Migration applied.'},
    ]
  },
  {
    v: 'v26.35', date: '23.05.2026',
    headline: '🌾 Bauernregel des Tages — 20 CH-Sprichwörter mit wissenschaftlichem Modern-Check',
    summary: 'Cowork-Auftrag v26.35 (Sprint 3/5). Neues Home-Widget #wisdom-card zwischen "Wusstest du?" und "Schnell-Quiz". Daily-Rotation aus traditional_garden_wisdom (20 Einträge, Cowork-DB-Wave-11) mit applicable_months-Filter für aktuellen Monat. Day-of-year deterministisch (jeder Tag zeigt fix die gleiche Regel). 12h in-Memory-Cache. Click rotiert zur nächsten Regel mit Fade. Validity-Badge mit 4 Farben (grün/gelb/orange/rot+Mythos-Label) — wissenschaftliche Einordnung jedes Sprichworts.',
    user_summary: '🌾 Auf der Startseite siehst du jetzt täglich eine andere Schweizer Bauernregel — z.B. „Wenn die Birne blüht, kommen die Kartoffeln raus". Mit grünem/gelbem/rotem Badge: ist die Regel wissenschaftlich bestätigt, nur tendenziell richtig, umstritten oder ein widerlegter Mythos? Tipp auf das Widget zeigt die nächste Regel.',
    user_items: [
      { emoji: '📖', text: 'Sprichwort + Bedeutung + moderner wissenschaftlicher Check' },
      { emoji: '🌿', text: 'Passend zum aktuellen Monat — z.B. im Mai Eisheilige-Regeln' },
      { emoji: '🟢', text: '4-Farben-Badge: 🟢 Bestätigt · 🟡 Meistens · 🟠 Umstritten · 🔴 Mythos' },
      { emoji: '👆', text: 'Tippen zeigt die nächste Bauernregel — über den ganzen Tag wechselbar' },
    ],
    items: [
      {emoji:'🎨', bold:'Widget #wisdom-card:', text:' cream-Gradient #f9f5e8→#f5ecd0 mit #c4a572 Border. Header mit Validity-Badge rechts. Saying in Playfair-italic + Region/Dialekt + Bedeutung + Modern-Take in heller Sub-Box mit Left-Border.'},
      {emoji:'📅', bold:'Daily-Rotation:', text:' Query traditional_garden_wisdom?applicable_months=cs.{currentMonth} (Postgres-Array-Contains). Fallback: alle Regeln wenn Monat-Match leer. Sort: validity_rank (bestaetigt→Mythos), dann day-of-year % data.length deterministisch (jeder User sieht heute dieselbe Regel).'},
      {emoji:'⏰', bold:'Cache:', text:' window._gsWisdomCache mit 12h TTL — verhindert mehrfaches Reload pro Session.'},
      {emoji:'👆', bold:'Click-to-rotate:', text:' gsShowNextWisdom inkrementiert idx, Fade-Out 200ms → re-render → Fade-In. Header-Hinweis durch CSS cursor:pointer.'},
      {emoji:'🟢', bold:'Validity-Badge:', text:' 4-Color-Map: wissenschaftlich_bestaetigt (🟢 #c8e6c9/#1b5e20), tendenziell_richtig (🟡 #fff9c4/#827717), umstritten (🟠 #ffe0b2/#bf360c), aberglaube_widerlegt (🔴 #ffcdd2/#b71c1c mit "Mythos"-Label).'},
      {emoji:'🚀', bold:'Auto-Load:', text:' gsLoadTodaysWisdom wird 400ms nach Home-Mount aufgerufen (im selben Block wie gsLoadSupabaseDailyContent). Silent-fail wenn sbFetch fehlt.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.36 Marketplace Pestizid-frei-Filter, v26.37 Pollinator-Garten-Modus.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js gs-v26.35 OK · GS_VERSION=v26.35 OK · _headers v26.35 OK · meta=26.35.20260523 OK.'},
    ]
  },
  {
    v: 'v26.34', date: '23.05.2026',
    headline: '📔 Garten-Tagebuch UI-Form — 11 Typen, Conditional Fields + Saison-Statistik',
    summary: 'Cowork-Auftrag v26.34 (Sprint 2/5). User-Form fuer die 11 entry_types aus v26.32-Migration. Bisher fehlte ein User-Form — Inserts kamen nur aus Pest-Scanner/Düngeplan programmgesteuert. Neuer "📔 Tagebuch-Eintrag"-Button mit 2-Tab-Modal: ➕ Neuer Eintrag mit Type-Picker (2-Spalten-Grid) + Conditional Fields pro Type (Species-Picker / harvest_kg / pest_slug / Dünger / Wasser / Krankheit) + Photo-Upload + Titel/Notiz. 📊 Saison-Statistik Tab via gsDiaryStats: Header-Card mit total, Ernte-Total + Top-5 Pflanzen, Pest-Count, Per-Type-Liste.',
    user_summary: '📔 Du kannst jetzt direkt Tagebuch-Einträge anlegen — mit 11 Typen wie Ernte, Aussaat, Düngung, Schnitt, Bewässerung. Je nach Typ erscheinen die passenden Felder (z.B. Pflanze + kg bei Ernte). Und ein neuer Statistik-Tab zeigt deine Saison-Bilanz: wie viel kg geerntet, von welcher Pflanze, wie viele Schädlinge beobachtet.',
    user_items: [
      { emoji: '🏷️', text: '11 Typen direkt im Picker: Allgemein, Schädling, Krankheit, Ernte, Aussaat, Düngung, Schnitt, Bewässerung, Heilkräuter, Samen, Blüte' },
      { emoji: '🌱', text: 'Pflanzen-Dropdown bei Ernte/Aussaat/Schnitt — aus deinen myPlants' },
      { emoji: '⚖️', text: 'Erntemenge in kg bei Typ "Ernte" → fließt in Saison-Total + Top-5-Pflanzen' },
      { emoji: '📊', text: 'Saison-Stats-Tab: total Einträge, kg geerntet, Schädlings-Beobachtungen, Aufschlüsselung nach Typ' },
    ],
    items: [
      {emoji:'🎨', bold:'Garten-Aktion-Button:', text:' "📔 Tagebuch-Eintrag · 11 Typen + Saison-Stats" mit Gradient #558b2f→#33691e neben den anderen 8 Garten-Aktionen.'},
      {emoji:'📐', bold:'Modal #modal-diary-entry:', text:' 2-Tab-Layout. Tab-Switch via gsDiarySwitchTab — active-State sichtbar via background-Color.'},
      {emoji:'🏷️', bold:'Type-Picker:', text:' 2-Spalten-Grid (11 Buttons) aus GS_DIARY_TYPES-Map. Active-Type hat dunkelgrünen background #33691e. Click → gsDiarySetType → re-render Picker + Conditional Fields.'},
      {emoji:'🧩', bold:'Conditional Fields:', text:' Species-Dropdown aus myPlants bei needsSpecies-Liste (harvest/sowing/medicinal_harvest/seed_collection/pruning/flowering/disease). harvest_kg input bei Ernte. pest_slug input + Pest-Scanner-CTA-Hinweis bei Schädling. fertilizer / water_liter / disease in metadata-jsonb.'},
      {emoji:'📷', bold:'Photo-Upload:', text:' 8 MB cap (gsFileToBase64), Preview-Box, b64 vorerst in metadata.photo_b64 — Storage-Upload kommt in späterem Sprint.'},
      {emoji:'💾', bold:'gsDiarySubmitEntry:', text:' Validiert Titel ODER Notiz, baut opts {entry_type, species_lat, pest_slug, harvest_kg, metadata}, ruft existing gsDiaryAddEntry (v26.32-Helper). Toast "✅ Eintrag gespeichert" + closeModal bei Success.'},
      {emoji:'📊', bold:'Saison-Statistik-Tab:', text:' gsDiaryRenderStats nutzt v26.32 gsDiaryStats-API. Layout: grüne Header-Card mit total-Count + Jahr; Ernte-Card (orange) mit harvest_total_kg + nSp Pflanzen + Top-5-Pflanzen-Tabelle; Pest-Card (braun) bei pest_count > 0; Per-Type-Liste sortiert nach Count desc mit emoji + label + count-Badge.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.35 Bauernregeln-Widget (traditional_garden_wisdom Daily-Rotation), v26.36 Marketplace Pestizid-frei-Filter, v26.37 Pollinator-Garten-Modus.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js gs-v26.34 OK · GS_VERSION=v26.34 OK · _headers v26.34 OK · meta app-version=26.34.20260523 OK.'},
    ]
  },
  {
    v: 'v26.33', date: '23.05.2026',
    headline: '🍄 Pilz-Scanner mit Tox-Info-145-Notruf bei Knollenblätter & Co (sicherheitskritisch)',
    summary: 'Cowork-Auftrag v26.33. Neue Edge-Fn mushroom-identify v1 (verify_jwt:true) mit Anthropic Vision Haiku 4.5 + 20-Pilze-Knowledge-Context aus mushroom_register (5 toedlich, 2 giftig, 13 essbar+bedingt, VAPKO-Klassen). 4. Scan-Modus "🍄 Pilz-Scanner" Garten-Aktion-Button (violetter Gradient). Modal mit Tox-Info-145-Disclaimer + Habitat-Picker (7 Typen) + 8MB Foto-Upload. safetyMap-Rendering aus v_mushroom_safety View. Bidirektionale Lookalikes-Box mit confusion_risk-Badge. VAPKO-Box mit Kontrollstelle + tel-Link aus mushroom_seasonal_patches. Bei edibility ∈ {toedlich,giftig}: ROTER VOLLBILD-Overlay z:99999 mit pulse-Animation + ☠️-Icon + "TÖDLICH GIFTIG"-Headline + ☎️-145-Button + Dismiss. App ist Information, KEINE Garantie — Disclaimer prominent.',
    user_summary: '🍄 NEU: Pilz-Scanner — KI-Identifikation mit verpflichtendem VAPKO-Hinweis. Wenn die KI einen tödlichen oder giftigen Pilz vermutet, blockiert sie sofort den ganzen Bildschirm mit einer Rot-Warnung und der Tox-Info-Schweiz-Nummer 145 (24/7). Bei jeder Identifikation: VAPKO-Kontrollstelle deiner Region mit Telefonnummer. Diese App ersetzt KEINE offizielle Pilzkontrolle.',
    user_items: [
      { emoji: '🍄', text: '4. Scan-Modus neben Pflanze/Schädling — speziell für Pilze (Foto + optional Habitat)' },
      { emoji: '☠️', text: 'Bei Knollenblätter/Pantherpilz: roter Vollbild-Warnscreen mit Tox-Info 145 als 1-Klick-Anruf' },
      { emoji: '🔁', text: 'Verwechslungs-Risiko (Lookalikes) prominent — Pfifferling vs Raukopf, Steinpilz vs Gallenröhrling …' },
      { emoji: '🔒', text: 'VAPKO-Pilzkontrollstelle deiner Region mit direkter Telefonnummer (Pflicht-Hinweis)' },
    ],
    items: [
      {emoji:'🚀', bold:'Edge-Fn mushroom-identify v1:', text:' deployed (verify_jwt:true). Input: image_base64 + media_type + habitat_hint + region_slug. Anthropic-Key via app_settings fallback. System-Prompt mit 20-Pilze-Knowledge-Context (slug, common_name_de, scientific_name, family, vapko_klasse, edibility, key_features). Force vapko_required=true bei confidence<70 ODER toedlich/giftig. Response: {matched_slug, confidence, reasoning, observed_features, alternatives, mushroom (full row), edibility, safety_color, safety_advice, lookalikes (bidirektional), vapko_required, vapko_kontrollstelle, vapko_phone, vapko_link, emergency_hint, tokens}.'},
      {emoji:'🎨', bold:'Modal + Habitat-Picker:', text:' #modal-mushroom mit gelbem 145-Disclaimer-Box ZUERST. Foto-Inputs Kamera/Galerie (8MB cap). Habitat-Picker (Laubwald/Nadelwald/Mischwald/Wiese/Park/Garten/anderes) als optional Hint.'},
      {emoji:'🟥', bold:'gsShowMushroomDangerOverlay:', text:' position:fixed inset:0 z:99999 background:#b71c1c mit eigener gs-mushroom-pulse-keyframe-Animation. 72px ☠️ (toedlich) oder ⚠️ (giftig). 28px Playfair-Headline. KI-Match-Card mit common_name_de + scientific_name italic. NICHT-ESSEN-Warning in rgba(0,0,0,.25)-Box. White-on-red ☎️-145-Button (min-width:240px). "Verstanden — Details anzeigen"-Dismiss-Button. User MUSS aktiv dismissen.'},
      {emoji:'🗺️', bold:'safetyMap aus v_mushroom_safety:', text:' red→🚫 TÖDLICH/GIFTIG, orange→⚠️ NUR JUNG/BEDINGT ESSBAR, yellow→⚠️ Vorsicht, green→✅ Speisepilz. Card-Header mit safety_color background + safety_advice in farbiger Border-Box. Plus symptoms_if_toxic + emergency_action + Bottom-Tox-Info-145-Footer bei toedlich/giftig. cooking_preparation + conservation_methods bei Speisepilz.'},
      {emoji:'🔁', bold:'Lookalikes bidirektional:', text:' j.lookalikes-Array kann matched_slug entweder als edible_slug ODER lookalike_slug enthalten (Logik im Renderer). risk-Badge (hoch=#c62828, mittel=#e65100, niedrig=#827717). Pro Lookalike: visual_differences + smell_differences + spore_print_differences + pro_tip (Profi-Tipp grün).'},
      {emoji:'🔒', bold:'VAPKO-Pflicht-Box:', text:' gsMushroomVapkoBox rendert bei vapko_required ODER vapko_kontrollstelle: Kontrollstelle + Telefonnummer als tel:-Link (Spaces gestrippt) + vapko_link external. Aus mushroom_seasonal_patches pro region_slug aufgelöst.'},
      {emoji:'⚠️', bold:'Confidence < 60:', text:' Statt false-positive → gelbe "UNSICHERE Identifikation"-Box mit reasoning + alternatives + NICHT-essen-Hinweis + VAPKO-Box. Schützt vor KI-Hallucination bei sicherheitskritischer Domain.'},
      {emoji:'📜', bold:'Compliance-Disclaimer:', text:' Footer in jedem Result: "Diese KI ist eine erste Einschätzung. Sie ersetzt KEINE offizielle Pilzkontrolle (VAPKO). Im Zweifel: nie essen." Plus source-Attribution.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.34 Tagebuch-UI-Form (Type-Picker für 11 entry_types), v26.35 Bauernregeln-Widget, v26.36 Marketplace-Pestizid-frei-Filter, v26.37 Pollinator-Garten-Modus.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js gs-v26.33 OK · GS_VERSION=v26.33 OK · _headers v26.33 OK · meta app-version=26.33.20260523 OK · Edge-Fn LIVE.'},
    ]
  },
  {
    v: 'v26.32', date: '23.05.2026',
    headline: '📓 Garten-Tagebuch v2 — kategorisierte Einträge mit 11 Typen + Saison-Stats-API',
    summary: 'Cowork-Auftrag v26.32. Migration v26_32_garden_diary_v2_kategorien LIVE-applied via Supabase MCP — fügt entry_type (check 11 values) + pest_slug (FK plant_pests) + species_lat + harvest_kg + metadata jsonb hinzu. Bug-Fix: bestehende v26.21 Pest-Scanner + v26.29 Düngeplan-Coach Inserts schlugen silent fehl weil sie type+notes Spalten erwarteten die nicht existierten — jetzt korrekt auf entry_type+text+tag. Neue generic gsDiaryAddEntry + gsDiaryStats-Helper.',
    user_summary: '📓 Das Garten-Tagebuch unterscheidet jetzt zwischen 11 Eintrag-Typen: Schädling, Krankheit, Ernte, Aussaat, Düngung, Schnitt, Bewässerung, Heilkräuter, Samen, Blüte, Allgemein. Damit lassen sich saisonale Statistiken erstellen (z.B. "X kg Tomaten geerntet").',
    user_items: [
      { emoji: '🏷️', text: '11 Eintrag-Typen mit eigenen Emoji + Tag (auto-Filter)' },
      { emoji: '🥕', text: 'Ernte-Einträge mit harvest_kg → Saison-Total + pro-Pflanze-Statistik' },
      { emoji: '🪲', text: 'Schädlings-Beobachtungen jetzt referenziert (FK auf plant_pests)' },
      { emoji: '🐛', text: 'Bug-Fix: Pest-Scanner + Düngeplan speichern wieder korrekt (silent fail behoben)' },
    ],
    items: [
      {emoji:'🗄️', bold:'Migration v26_32 applied:', text:' ALTER TABLE garden_diary ADD COLUMN entry_type (default general, check 11 values) + pest_slug (FK plant_pests ON DELETE SET NULL) + species_lat + harvest_kg (numeric) + metadata (jsonb). Plus 2 Indexes (user+type+ts desc, pest_slug).'},
      {emoji:'🛠️', bold:'Bug-Fix existing Inserts:', text:' v26.21 Pest-Scanner gsPestAddToDiary + v26.29 Düngeplan gsFertilizerLogDone hatten type/notes-Spalten die nicht existierten → silent fail. Korrigiert auf existing Schema (ts, emoji, title, text, tag) + neue Spalten (entry_type, pest_slug, species_lat, metadata).'},
      {emoji:'🧰', bold:'gsDiaryAddEntry generic:', text:' Window-exposed Helper fuer kategorisierte Eintraege. opts: {entry_type, species_lat, pest_slug, harvest_kg, title, text, photo_url, garden_id, metadata}. Auto-fuellt emoji+tag aus GS_DIARY_TYPES-Map.'},
      {emoji:'📊', bold:'gsDiaryStats:', text:' Aggregiert pro Jahr: total_entries, per_type-Counts, harvest_total_kg, harvest_per_species, pest_count. Bereit fuer Pflanzen-Detail-Widgets, Garten-Header-Stats, Saison-Modal.'},
      {emoji:'🏷️', bold:'GS_DIARY_TYPES:', text:' Map mit 11 Codes: general/pest_observation/disease/harvest/sowing/fertilization/pruning/watering/medicinal_harvest/seed_collection/flowering. Jeder mit emoji+label+tag.'},
      {emoji:'⏭️', bold:'Naechste:', text:' Frontend Type-Picker UI im Diary-Form (bisher kein User-Form da, nur API-Helper) als Bonus-Sprint. Plus B1 did_you_know_facts + seasonal_tips Bulk-Refill, B2 Marketplace Pestizid-frei-Filter, B3 Pollinator-Garten-Modus.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · sw.js gs-v26.32 OK · Migration applied · 2 Inserts bug-fixed.'},
    ]
  },
  {
    v: 'v26.30', date: '23.05.2026',
    headline: '🌰 Samen ernten & lagern — 5. Wissen-Sub-Tab mit 12 Methoden',
    summary: 'Cowork-Auftrag v26.30. Wissen-Tab bekommt 5. DB-basierten Sub-Tab "🌰 Samen ernten" als Erweiterung der v26.23 Wave-9-Renderer. configs[]-Map um seed_saving_methods erweitert. Neuer _gsWave9RenderSeedSaving Detail-Modal mit WICHTIG-Warning ZUERST (Cucurbita-Kreuzung), Badges (Bestäubung/Isolation/Keimfähigkeit), Ernte-Timing, Reife-Zeichen, Extraktion + Reinigung + Trocknung, Lagerung-Box mit Temp/Feuchte/Behälter, Schweizer Rechtslage + Kulturelle Bedeutung.',
    user_summary: '🌰 Neu im Wissen-Tab: 12 Anleitungen zum Samen-Ernten und -Lagern — von der Tomate bis zur Möhre. Wichtige Kreuzungs-Warnungen bei Kürbisgewächsen ganz oben.',
    user_items: [
      { emoji: '🐝', text: 'Bestäubungs-Typ (selbst vs fremd) + Isolations-Abstand pro Pflanze' },
      { emoji: '🌱', text: 'Keimfähigkeit in Jahren (z.B. Tomate 5+, Möhre 2-3)' },
      { emoji: '🧼', text: 'Schritt-für-Schritt: Reife erkennen, Extraktion, Reinigung, Trocknung, Lagerung' },
      { emoji: '⚠️', text: 'Cucurbita-Kreuzungs-Warnung prominent (Zucchini × Kürbis = ungenießbar)' },
    ],
    items: [
      {emoji:'🧩', bold:'5. Wave-9 Sub-Tab:', text:' #wissen-nav um "🌰 Samen ernten" Button erweitert. Dispatch via showWissen("samen") → gsRenderWissenWave9.'},
      {emoji:'📋', bold:'configs[samen]:', text:' table=seed_saving_methods, order=difficulty+plant_name_de, titleField=plant_name_de, categoryField=difficulty (Filter-Pills nach Anfänger/Mittel/Fortgeschritten). Card-Sub mit pollination_type + isolation_distance_m + viability_years.'},
      {emoji:'🔴', bold:'Card-Accent rot:', text:' Bei Cucurbita-species (Zucchini, Kürbis) ODER warnings enthält "kreuz" → roter Border-Akzent in der Liste.'},
      {emoji:'🎨', bold:'_gsWave9RenderSeedSaving:', text:' WICHTIG-Box rot ZUERST bei warnings. Header-Gradient gelb (Standard) oder orange (Warn). 5 Badges. Block: Ernte-Timing + Reife-Zeichen → Extraktion + Reinigung + Trocknung → Lagerung (Container/Temp/Humidity) → Yield + Sortenstabilität → Schweizer Rechtslage + Kulturelle Bedeutung.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.32 Garten-Tagebuch v2 (Migration + Type-Picker + Filter + Saison-Stats).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · sw.js gs-v26.30 OK · 12 Samen-Methoden DB-ready.'},
    ]
  },
  {
    v: 'v26.29', date: '23.05.2026',
    headline: '🌱 Düngeplan-Coach + 📐 Beet-Layout-Designer (Bundle v26.29 + v26.31)',
    summary: 'Cowork-Aufträge v26.29 + v26.31 als Bundle. 2 neue Garten-Aktion-Buttons: Düngeplan-Coach (fertilization_schedules-UI mit Pflanzen-Picker und Phasen) + Beet-Layout-Designer (10 garden_layouts-Vorlagen mit Filter, Detail-Modal, Rotations-Plan). Beide Modals teilen gemeinsame UI-Patterns (Filter-Pills, Detail-Renderer, gs*-Helper).',
    user_summary: '🌱 Zwei neue Helfer im Garten: Ein Düngeplan-Coach (was wann für welche Pflanze + Bio-Tipps + Schweizer Mengen) und ein Beet-Layout-Designer (10 fertige Vorlagen von Hochbeet bis Mandala-Garten).',
    user_items: [
      { emoji: '🌱', text: 'Düngeplan pro Pflanze in 1-5 Phasen mit Bio + Mineral-Optionen und CHF-Kosten' },
      { emoji: '📐', text: '10 Beet-Vorlagen: Hochbeet, Kräuterspirale, Permakultur, Mandala, Hügelkultur, ...' },
      { emoji: '🌿', text: 'Rotations-Plan (4-Jahres-Cycle Starkzehrer → Schwachzehrer → Gründüngung)' },
      { emoji: '💡', text: 'Pro-Tips + häufige Fehler pro Vorlage' },
      { emoji: '✅', text: '"Düngung erledigt"-Button speichert direkt im Garten-Tagebuch' },
    ],
    items: [
      {emoji:'🌱', bold:'v26.29 Düngeplan-Coach:', text:' Neuer Garten-Aktion-Button. Modal mit Pflanzen-Picker (auto-select bei myPlants-Match). Phasen-Liste mit Phase-Name, NPK-Focus-Badge, Bio-Optionen-Box (grün), Mineral-Optionen-Box (blau), Dosis (g/m² oder ml/l), Frequenz, Application-Method, pH-Consideration, CHF-Kosten, organic_certified-Badge. "Erledigt"-Button → garden_diary INSERT mit type=fertilization + fertilizer_slug + phase.'},
      {emoji:'📐', bold:'v26.31 Beet-Layout-Designer:', text:' Neuer Garten-Aktion-Button. Modal mit Filter-Pills (layout_type-Distinct + 🌱 Anfaenger-Toggle). Card-Liste mit Name, Type, Size, Difficulty, Description-Snippet, Cost-CHF, Setup-Hours. Detail-Modal mit plant_combinations (jsonb array/object), rotation_plan (jsonb), pro_tips (grün), common_pitfalls (rot).'},
      {emoji:'🛢️', bold:'In-Memory-Cache:', text:' 10min fuer fertilization_schedules, 30min fuer garden_layouts. Reduziert DB-Hits bei Re-Open.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.30 Samen-Gewinnung-Wissen (5. Wissen-Sub-Tab). v26.32 Garten-Tagebuch v2 (Migration + Type-Picker).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · sw.js gs-v26.29 OK · fertilization_schedules + garden_layouts beide DB-ready.'},
    ]
  },
  {
    v: 'v26.28', date: '23.05.2026',
    headline: '🗺️ KI-Planer kennt jetzt deine Region — Frost + Boden + Höhenzone als Constraint',
    summary: 'Cowork-Auftrag v26.28. gsRunGardenScan body.metadata bekommt async region_slug (aus v26.27 gsGetRegionContext) + soil_type + soil_ph (aus v26.25 gs_soil_profile). Backend garden-scan-analyze v2 + plan-iterate v2 sind region-aware: laden regional_garden_calendars + injecten last_frost/growing_season/best_vegetables als Constraint im System-Prompt.',
    user_summary: '🗺️ Der KI-Planer berücksichtigt jetzt deine Region und Bodenprofil — Plant nur Pflanzen die in deiner Höhenlage und Bodenart wirklich gedeihen.',
    user_items: [
      { emoji: '❄️', text: 'Frost-Termine deiner Region werden bei Aussaat-Vorschlägen beachtet' },
      { emoji: '🪨', text: 'Boden-Profil (pH + Bodenart aus v26.25) fliesst in Pflanzen-Auswahl' },
      { emoji: '🌱', text: 'Best-Vegetables deiner Höhenzone werden bevorzugt vorgeschlagen' },
      { emoji: '🔄', text: 'Plan-Iteration via Chat ist auch region-aware (automatisch via garden_plans.region_used)' },
    ],
    items: [
      {emoji:'🧩', bold:'metadata.region_slug:', text:' Falls undefined und gsGetRegionContext (v26.27) ein Profil zurueckgibt → slug wird gesetzt. Backward-compatible: explicit metadata.region_slug=null/false respektiert.'},
      {emoji:'🪨', bold:'metadata.soil_type + soil_ph:', text:' Aus localStorage gs_soil_profile (v26.25) Auto-Inject falls noch nicht in metadata. Nutzt soil.type (sandy/loamy/clay/humus) + soil.ph (acid/neutral/alkaline).'},
      {emoji:'⚡', bold:'Async-Injection:', text:' Vor dem POST wird ein await gsGetRegionContext() ausgefuehrt. Keine BLOCKING-Penalty weil Region-Cache 30min.'},
      {emoji:'🔁', bold:'plan-iterate v2:', text:' Liest scan_input.region_used aus garden_plans-Record. Backend macht das automatisch — kein Frontend-Change noetig fuer Iterationen.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.29 Duengeplan-Coach. v26.30 Samen-Gewinnung-Wissen. v26.31 Beet-Layout-Designer. v26.32 Garten-Tagebuch v2.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · sw.js gs-v26.28 OK.'},
    ]
  },
  {
    v: 'v26.27', date: '23.05.2026',
    headline: '🗓️ Regional-Kalender — 7 CH-Höhenzonen mit Monats-Tasks',
    summary: 'Cowork-Auftrag v26.27. Garten-Aktion-Button "🗓️ Regional-Kalender" öffnet Modal mit Picker für 7 CH-Höhenzonen aus regional_garden_calendars (Tessin 200m bis Graubünden 1500m). Wahl persistiert in localStorage gs_region. Render-Layout: aktueller Monat prominent in oranger Box, best_vegetables (grün) + challenging_plants (orange), 12-Monats-Accordion (current open). Plus gsGetRegionContext() API für künftige KI-Planer-Integration.',
    user_summary: '🗓️ Neu: Wähle deine Schweizer Region (Tessin bis Graubünden) — siehst sofort was diesen Monat in deiner Höhenzone zu tun ist. Plus 12-Monats-Übersicht und Aussaat-Tipps.',
    user_items: [
      { emoji: '📍', text: '7 CH-Regionen: Tessin · Basel · Mittelland · Jura · Wallis · Voralpen · Graubünden' },
      { emoji: '🌟', text: 'Aktueller Monat groß und prominent — die wichtigsten Tasks' },
      { emoji: '✅', text: 'Gut geeignete Gemüse + ⚠️ schwierige Pflanzen für deine Höhenlage' },
      { emoji: '🗓️', text: '12-Monats-Übersicht aufklappbar pro Monat' },
      { emoji: '❄️', text: 'Letzter Frost-Termin + Wachstumssaison-Tage spezifisch für deine Zone' },
    ],
    items: [
      {emoji:'🛢️', bold:'gsLoadRegionalCalendars (30min Cache):', text:' GET regional_garden_calendars ORDER BY altitude_m_min. 7 Rows: tessin_sued (200-500m), basel_rhein (240-500m), mittelland (400-700m), walliserkern (500-800m), jura (500-1000m), voralpen (700-1000m), graubuenden_hoch (1000-1500m).'},
      {emoji:'📋', bold:'#modal-region-cal:', text:' Header-Picker oben mit Meta-Zeile (region_name, altitude-range, last_frost_avg, growing_season_days). 7 Optionen plus "— Bitte wählen —".'},
      {emoji:'🌟', bold:'Current-Month-Box:', text:' Erstellt aus january_tasks..december_tasks Array-Feldern. Orange-Gradient-Box mit Emoji + Bullet-Liste der ~5-10 Tasks fuer aktuellen Monat.'},
      {emoji:'✅', bold:'Best/Challenging:', text:' best_vegetables in grüner Box, challenging_plants in oranger Box. CSV-render der Array-Listen.'},
      {emoji:'📅', bold:'12-Monats-Accordion:', text:' <details>-Tags mit Emoji pro Monat (❄️/🌱/🌷/🌸/☀️/🌞/🌻/🍂/🍁/❄️). Current-Month open default, andere collapsed. Task-Count im Summary.'},
      {emoji:'⚡', bold:'gsGetRegionContext() API:', text:' Window-exposed Helper fuer KI-Planer-Integration. Liest localStorage gs_region + Cache, returnt full region-row. Kann von garden-scan-analyze / plan-iterate als Constraint genutzt werden.'},
      {emoji:'💾', bold:'Persistenz:', text:' gs_region als slug in localStorage. Beim openRegionalCalendarModal automatisch vorausgewählt + Render getriggert. Toast "📍 Region gespeichert" bei Change.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.28+ Bonus-Sprints (knowledge-bulk-gen v8 mit Wave-9 Schemas, Marketplace Pestizid-frei-Filter, Garten-Tagebuch Pest+Heilpflanzen-Kategorisierung).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · sw.js gs-v26.27 OK · 7 Regionen verifiziert in DB.'},
    ]
  },
  {
    v: 'v26.26', date: '23.05.2026',
    headline: '🌿 Heilpflanzen-Profile — automatischer Tab im Pflanzen-Detail',
    summary: 'Cowork-Auftrag v26.26. openDetail Pflanzen-Detail-Modal bekommt jetzt async geladenen Heilpflanzen-Block falls Match in medicinal_plants_register. gsLoadMedicinalProfile mountet eine grüne Section am Ende des bestehenden Modals: Badges (Evidenz/CH-heimisch/Geschützt), dann ZUERST prominent rote Kontraindikationen + orange Wechselwirkungen + gelbe Toxizität (rechtssicher), dann Verwendung mit Pflanzenteilen, Wirkstoffen, traditioneller vs evidenzbasierter Anwendung, Zubereitung, Dosierung, Erntezeit, CH-Rechtslage. Disclaimer-Footer.',
    user_summary: '🌿 Tippe auf eine Pflanze die als Heilpflanze gilt → unten erscheint automatisch ein Heilpflanzen-Profil mit allen wichtigen Warnungen (Schwangerschaft, Medikamente) ganz oben.',
    user_items: [
      { emoji: '⛔', text: 'Kontraindikationen ROT und prominent — niemals übersehbar' },
      { emoji: '⚠️', text: 'Wechselwirkungen mit Medikamenten orange markiert' },
      { emoji: '🌱', text: 'Verwendete Pflanzenteile + Wirkstoffe + Anwendungen + Dosierung' },
      { emoji: '📍', text: 'Schweizer Rechtslage + Schutzstatus + beste Erntezeit' },
    ],
    items: [
      {emoji:'🪝', bold:'openDetail-Hook:', text:' Container <div id="medicinal-profile-host-<id>"> wird am Ende des Detail-HTML eingefuegt. gsLoadMedicinalProfile(spId, sp.lat) ruft async DB.'},
      {emoji:'🔍', bold:'DB-Lookup:', text:' GET medicinal_plants_register WHERE scientific_name=eq.<lat> LIMIT 1. Falls kein Match → silent return (keine Section).'},
      {emoji:'🎨', bold:'Section-Render:', text:' Grüner Gradient-Box mit Header "🌿 Als Heilpflanze". Badges (📊 Evidenz, 🇨🇭 CH-heimisch, 🛡️ Geschützt).'},
      {emoji:'⛔', bold:'Warnungen ZUERST:', text:' Kontraindikationen in roter dicker Box (border-2 #c62828). Wechselwirkungen in orange Box. Toxizität in gelber Box. Reihenfolge nach Schwere.'},
      {emoji:'📚', bold:'Verwendung-Listen:', text:' used_parts (grün), primary_compounds (blau), secondary_compounds, traditional_uses (lila), evidence_based_uses (grün), preparation_methods.'},
      {emoji:'💊', bold:'Dosierung + Kontext:', text:' dosage_general (blau), best_harvest_month + timing, swiss_legal_status, conservation_status, cultivation_notes.'},
      {emoji:'⚖️', bold:'Disclaimer:', text:' "Keine medizinische Beratung. Bei Beschwerden Arzt oder Apotheker fragen." + Quelle am Footer.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.27 Regional-Calendar (7 CH-Regionen + Monats-Widget + KI-Planer-Context).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · sw.js gs-v26.26 OK.'},
    ]
  },
  {
    v: 'v26.25', date: '23.05.2026',
    headline: '🪨 Bodenverbesserer-Recommender — pH + Bodenart → Top-5 CH-Produkte',
    summary: 'Cowork-Auftrag v26.25. Neuer Garten-Aktion-Button "🪨 Boden verbessern" öffnet Modal mit 3 Pickers (pH-Wert, Bodenart, Ziel-Nährstoff/Struktur). Client-side Scoring über alle 15 CH-Bodenverbesserer aus soil_amendments-DB: pH-Match (50 Punkte), Bodenart-Match via ILIKE-Token (18), Goal-Match auf NPK-Werte (25), Universal-Bonus (8). Top-5 als geordnete Karten mit NPK-Tag, Anwendung, Timing. Profil persistent in localStorage.',
    user_summary: '🪨 Neu: Sag uns deinen pH-Wert + Bodenart → Top-5 Bodenverbesserer aus 15 Schweizer Produkten. Wird gespeichert für nächstes Mal.',
    user_items: [
      { emoji: '🎯', text: 'pH-Picker (sauer/neutral/basisch) + Bodenart (Sand/Lehm/Ton/Humus) + Ziel (N/P/K/Struktur)' },
      { emoji: '🧮', text: 'Scoring-Algorithmus: 15 Produkte → Top-5 mit NPK-Werten + Anwendungsmenge + Timing' },
      { emoji: '💾', text: 'Profil gespeichert — beim nächsten Mal vorausgefüllt' },
      { emoji: '📖', text: 'Detail-Klick öffnet vollständige Karte (Quelle, Warnungen, Kombinationen)' },
    ],
    items: [
      {emoji:'🧩', bold:'Garten-Aktion-Button:', text:' "🪨 Boden verbessern · NPK + pH-Empfehlung" unter dem Erntekalender-Button, braun-Gradient (#5d4037 → #3e2723).'},
      {emoji:'📋', bold:'#modal-soil-amend:', text:' 3 Selects (pH/Type/Goal) + Submit-Button. Pre-fill aus localStorage.gs_soil_profile beim Open.'},
      {emoji:'⚖️', bold:'gsRunSoilRecommend Scoring:', text:' pH-Match: ph=acid → ph_effect=erhoehend +50. type-Match: ILIKE-Token-Map (sandy:["sand","leicht","mager"], clay:["ton","schwer"], etc.) +18. goal-Match: N/P/K-pct ≥3 → +25. "alle Böden" → +8. Sort desc, take 5.'},
      {emoji:'🎨', bold:'Top-5 Cards:', text:' Rang-Nr · Name · Kategorie + pH-Effekt · NPK-Tag in grünem Badge · Anwendungsmenge + Timing. Click → Detail-Modal mit gemeinsamem _gsWave9RenderSoilAmend.'},
      {emoji:'💾', bold:'Persistenz:', text:' gs_soil_profile als {ph,type,goal,ts}. Auto-prefill bei nächstem Open.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.26 Heilpflanzen-Profile im Pflanzen-Detail. v26.27 Regional-Calendar.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · sw.js gs-v26.25 OK.'},
    ]
  },
  {
    v: 'v26.24', date: '23.05.2026',
    headline: '🪲 KI-Planer mit Schädlings-Hint — Top-Risiken + Schutzpflanzen-Vorschläge',
    summary: 'Cowork-Auftrag v26.24. Im KI-Planer Plan-Detail-Modal (gsGardenScanShowPlant) wird jetzt asynchron pro Pflanze (mit species_lat) ein Block geladen: Top-3 Schädlinge aus plant_pests (host_plants @> [species_lat]) mit Severity-Dots + Prävention + Bio-Behandlung, plus Companion-Plant-Vorschläge aus pest_companion_plants (effective_against-Array-Overlap). "🪲 Schädling fotografieren"-CTA öffnet den existing v26.21 Pest-Scanner.',
    user_summary: '🪲 Beim KI-Planer siehst du jetzt für jede Pflanze die Top-3 Schädlinge plus Schutzpflanzen-Vorschläge — direkt im Detail-Modal.',
    user_items: [
      { emoji: '⚠️', text: 'Top-3 Schädlinge pro Pflanze mit Severity-Ampel (🔴 hoch / 🟡 mittel / 🟢 gering)' },
      { emoji: '🌿', text: 'Pro Schädling: Vorbeugen-Tipp + Bio-Behandlung als 1-Klick-Info' },
      { emoji: '💚', text: 'Companion-Plants-Vorschlag (z.B. Tagetes gegen Wurzelnematoden)' },
      { emoji: '📷', text: 'Direkt zum Pest-Scanner: "🪲 Schädling fotografieren →"' },
    ],
    items: [
      {emoji:'🧩', bold:'gsLoadPestsForPlanPlant(idx, lat):', text:' Async-Helper triggert nach Modal-Render. GET plant_pests WHERE host_plants @>[lat] ORDER BY damage_severity.desc LIMIT 3.'},
      {emoji:'💚', bold:'Companion-Lookup:', text:' GET pest_companion_plants WHERE effective_against ov.{pest_name_de, pest_slug, ...} LIMIT 5. Overlap-Operator (ov) matched gegen Pest-Namen UND -Slugs.'},
      {emoji:'🎨', bold:'Render im Plan-Detail:', text:' Orange Box "⚠️ Mögliche Schädlinge (Top N)" mit Severity-Dots + Prävention + Bio-Behandlung pro Pest. Grüne Box "💚 Schutzpflanzen-Vorschlag" mit role + wirkt-gegen + Pflanz-Muster.'},
      {emoji:'🔗', bold:'Pest-Scanner-CTA:', text:' "🪲 Schädling fotografieren →" Button schließt detail-modal + öffnet modal-pest (v26.21).'},
      {emoji:'✅', bold:'Empty-State:', text:' Wenn keine Pests UND keine Companions in DB → grüne "✅ Keine spezifischen Schädling-Risiken"-Box statt leere Sektion.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.25 Bodenverbesserer-Recommender. v26.26 Heilpflanzen-Profile. v26.27 Regional-Calendar.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · sw.js gs-v26.24 OK.'},
    ]
  },
  {
    v: 'v26.23', date: '22.05.2026',
    headline: '📚 Wissen-Tab wächst — Kompost · Vermehrung · Boden · Heilpflanzen',
    summary: 'Cowork-Auftrag v26.23. DB-Wave-9 brachte 4 neue kuratierte Tabellen (compost_recipes, propagation_methods, soil_amendments, medicinal_plants_register) — diese Sprint baut die UI dazu: 4 neue Sub-Tabs im Wissen-Bereich mit Filter-Pills nach Kategorie + Detail-Modals mit allen Feldern (NPK-Werte, Schritt-Anleitungen, JSON-Parser für monthly_steps / step_by_step / troubleshooting). Heilpflanzen-Renderer mit PROMINENT-roter Kontraindikations-Box (rechtssicher).',
    user_summary: '📚 4 neue Wissens-Sektionen: Kompostieren, Pflanzen-Vermehrung, Boden verbessern und Heilpflanzen — alles aus Schweizer Quellen kuratiert.',
    user_items: [
      { emoji: '🌱', text: 'Kompostieren: 8+ Methoden von Heiß- bis Wurmkompost mit Monats-Schritten und Troubleshooting' },
      { emoji: '✂️', text: 'Vermehrung: 12 Methoden mit Erfolgsrate, Schritt-für-Schritt und Werkzeug-Liste' },
      { emoji: '🪨', text: 'Boden-Pflege: 15 Bodenverbesserer mit NPK-Werten und pH-Effekt' },
      { emoji: '🌿', text: 'Heilpflanzen-Register: 15 CH-Heilpflanzen mit Wirkstoffen + Warnungen (Kontraindikationen, Wechselwirkungen, Schwangerschaft)' },
    ],
    items: [
      {emoji:'🧩', bold:'4 neue Nav-Buttons:', text:' Kompostieren / Vermehrung / Boden-Pflege / Heilpflanzen in #wissen-nav.'},
      {emoji:'🎨', bold:'gsRenderWissenWave9 generic:', text:' Eine Renderer-Function für alle 4 Sections mit configs[]-Map (Tabelle, Order, Title-Field, Category-Field, Card-Emoji, Card-Sub-Builder, optionaler Card-Accent). 10min-In-Memory-Cache pro Section.'},
      {emoji:'🔖', bold:'Filter-Pills:', text:' Distinct categoryField-Werte mit Counts. "Alle (N)" + N Kategorie-Pills. Active-State auf gewähltem Filter.'},
      {emoji:'📋', bold:'Card-Layout:', text:' Emoji + Titel + Sub (Methode/Erfolg/Schwierigkeit) + Description-Snippet (140 chars) + Chevron. Click → openModal(detail-modal).'},
      {emoji:'🔬', bold:'4 spezifische Render-Funktionen:', text:' _gsWave9RenderCompost (Badges + Inputs-Listen + Verhältnis + Monats-Steps + Troubleshooting), _gsWave9RenderPropagation (Badges + Pflanzen-Listen + Steps-jsonb + Tipps), _gsWave9RenderSoilAmend (NPK-Tag + Anwendung + Warnungen), _gsWave9RenderMedicinal (Kontraindikationen ZUERST rot, Wechselwirkungen orange, Toxizität gelb, dann Verwendung + Dosierung + Disclaimer).'},
      {emoji:'⚠️', bold:'Heilpflanzen-Rechtssicherheit:', text:' Kontraindikationen (rote Box, fett), Drug-Interactions (orange Box), Toxizität (gelbe Box), Disclaimer-Footer "Keine medizinische Beratung" am Ende.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.24 Pest-Filter im KI-Planer. v26.25 Bodenverbesserer-Recommender. v26.26 Heilpflanzen-Profile im Pflanzen-Detail.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · sw.js gs-v26.23 OK · 4 neue Wissen-Tabs verdrahtet.'},
    ]
  },
  {
    v: 'v26.22', date: '22.05.2026',
    headline: '🪴 AR-Vorschau — Sieh deine Pflanzen in 3D im Browser',
    summary: 'Cowork-Auftrag v26.18. Three.js basierter 3D-View für 30 Seed-Pflanzen aus ar_models. Da gltf_url=NULL: prozedurale Fallback-Geometrie (Stamm + Krone mit form/höhe/farbe-Variation pro Spezies). 30 species-spezifische Krone-Farben (Tomate rot, Lavendel violett, etc.). Eigene Drag/Pinch/Wheel-Pointer-Logic statt OrbitControls — spart externe Abhängigkeit + CSP-Issues. Memory-Leak-frei via _gsARDispose beim Modal-Close.',
    user_summary: '🪴 Neu: Schau dir Pflanzen in 3D an! Tippe in der App auf eine Pflanze → "In 3D ansehen" → drag zum Drehen, pinch zum Zoomen. Größe entspricht erwachsener Pflanze.',
    user_items: [
      { emoji: '🌳', text: '30 Pflanzen mit realistischer Höhe (Tomate 1.8m bis Kirschbaum 6m)' },
      { emoji: '🎨', text: 'Farben passend zur Spezies (Lavendel violett, Sonnenblume gelb, Apfel rot)' },
      { emoji: '👆', text: 'Drag zum Drehen, pinch oder Scroll zum Zoomen' },
      { emoji: '🌑', text: 'Schatten + Tageslicht-Beleuchtung' },
      { emoji: '🪲', text: 'Drei.js wird nur beim Öffnen geladen (Speicher-effizient)' },
    ],
    items: [
      {emoji:'🎬', bold:'gsAROpen(species_lat):', text:' Öffnet #modal-ar, lädt ar_models-Row, ruft _gsLoadThree() (lazy aus /assets/three.min.js), bei Fail zeigt "3D-Vorschau hier nicht möglich"-Fallback. Plant-Name + Höhe als Header.'},
      {emoji:'🏗️', bold:'_gsARInitScene:', text:' THREE.Scene + PerspectiveCamera + WebGLRenderer (antialias, alpha=true, devicePixelRatio cap 2). HemisphereLight 0.7 + DirectionalLight 0.85 mit shadowMap 1024². Eigene Drag/Pinch/Wheel-Logic: azimuth/polar/radius Spherical-Camera, Touch + Mouse + Wheel-Events, mit Limits (radius 1-15m, polar 0.15-π-0.15).'},
      {emoji:'🌱', bold:'_gsARRenderFallback:', text:' Stamm (CylinderGeometry, verjüngt nach unten) + Krone (SphereGeometry, Form je nach Höhe: Halbkugel für <40cm, Standard-Kugel für Sträucher, vergrößert für Bäume >3m). Krone-Farbe via _gsARColorForSpecies-Map (30 Einträge). Boden-Kreis (CircleGeometry, dunkelbraun, receiveShadow).'},
      {emoji:'🎨', bold:'_gsARColors-Map:', text:' Alle 30 Seed-Pflanzen mapped: Tomate rot, Paprika orange, Gurke dunkelgrün, Salat hellgrün, Erdbeere rot, Lavendel violett, Sonnenblume gelb, Apfel rotbraun, Kirsche dunkelrot, Rose pink, Rosmarin dunkelgrün, etc.'},
      {emoji:'♻️', bold:'_gsARDispose Memory-Cleanup:', text:' Cancelt RAF, removed Event-Listeners (Pointer + Resize), traversed Scene und disposed Geometries/Materials, disposed Renderer. Hook in closeModal damit beim Schliessen aufgeräumt wird. State in window._gsARState.'},
      {emoji:'🪟', bold:'Modal #modal-ar:', text:' Dark-Theme mit CSS-Gradient-Background, Canvas 75vh, Header-Label "🪴 AR-Vorschau", Footer mit Pflanzen-Name + Höhe + Touch-Hint.'},
      {emoji:'⚠️', bold:'WebXR Magic-Window only:', text:' MVP nicht zwingend AR-Mode. WebGL-Probe Pre-Check, bei kein WebGL: graceful "📵 hier nicht möglich"-Fallback.'},
      {emoji:'⏭️', bold:'Naechste:', text:' Bonus v26.18a/b/c aus Roadmap (Compost/Propagation-Tabellen ins Wissen-Tab, Pest-Filter im KI-Planer, seasonal_highlights als 17. knowledge-bulk-gen Topic).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · sw.js gs-v26.22 OK · 30 Pflanzen-Farb-Map.'},
    ]
  },
  {
    v: 'v26.21', date: '22.05.2026',
    headline: '🪲 Schädlings-Scanner — Foto vom Befall → KI identifiziert + Bio-Behandlung',
    summary: 'Cowork-Auftrag v26.19. Neuer Garten-Aktion-Button "🪲 Schädling-Scanner" mit Foto-Upload + optionalem Host-Pflanze-Picker. POSTet an pest-identify Edge-Fn v1 (Anthropic Vision Haiku 4.5 + plant_pests-Knowledge-Context: 25 kuratierte Schweizer Garten-Schädlinge mit Bio-Behandlung, Prävention, natürlichen Feinden). Result-Modal zeigt Confidence-Badge, Symptome, sofortige Massnahme, Bio-Behandlung-Liste, Prävention, natürliche Feinde + Alternative-Kandidaten. Bei Confidence < 40 statt false-positive: "bitte näher"-Hint.',
    user_summary: '🪲 Neu: Schädling im Garten? Mach ein Foto und die KI sagt dir was es ist + welche Bio-Behandlung hilft. Bei deinen eigenen Pflanzen wird die Treffer-Qualität noch genauer.',
    user_items: [
      { emoji: '📷', text: 'Foto vom Befall (Kamera oder Galerie) — bis 8 MB' },
      { emoji: '🎯', text: '25 Schweizer Garten-Schädlinge mit AGFF-Quelle' },
      { emoji: '🌿', text: 'Bio-Behandlung + Prävention + natürliche Feinde (z.B. Marienkäfer gegen Blattläuse)' },
      { emoji: '📓', text: '"Im Garten-Tagebuch festhalten"-Button für späteren Verlauf' },
    ],
    items: [
      {emoji:'⚡', bold:'pest-identify Edge-Fn v1 (verify_jwt:true):', text:' Anthropic Vision Haiku 4.5 + plant_pests-Knowledge-Block. host_plant-Filter via .contains() — wenn keine Treffer, Fallback auf alle 25. JSON-Response mit matched_slug + confidence + reasoning + alternatives + severity + advice + pest_detail (FULL row aus DB).'},
      {emoji:'🪲', bold:'Garten-Aktion-Button:', text:' Neuer Button "🪲 Schädling-Scanner" unter dem 🩺 Pflanzendoktor-Button. Braun-Gradient. data-i18n="btn_pest_open".'},
      {emoji:'📋', bold:'#modal-pest:', text:' Foto-Upload (Kamera+Galerie 8MB Limit, Base64-Preview) + Host-Plant Select aus myPlants (value=species_lat fuer Filter im Backend) + Submit-Button mit Loading-State.'},
      {emoji:'🎬', bold:'gsPestRunScan:', text:' POST pest-identify mit photo_base64 + media_type + host_plant. 45s Timeout. Login-Check. Error-Handling via Toast.'},
      {emoji:'🧾', bold:'gsPestRenderResult:', text:' Confidence-Badge (3 Stufen Gering/Mittel/Hoch mit Farben), Top-Match mit common_name_de + scientific_name + reasoning. 💡 Sofort-Advice-Box. Bio-Behandlung-Liste (gruen). Praevention-Liste (teal). Natuerliche Feinde-Hint. Alternative-Kandidaten-Liste. Confidence < 40 zeigt "bitte naeher"-Warning.'},
      {emoji:'📓', bold:'gsPestAddToDiary:', text:' INSERT in garden_diary mit type=pest_observation + pest_slug im metadata.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.18 AR-View MVP (Three.js + Fallback-Geometrie fuer 30 Seed-Pflanzen).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · sw.js gs-v26.21 OK · pest-identify v1 ACTIVE.'},
    ]
  },
  {
    v: 'v26.20', date: '22.05.2026',
    headline: '🌍 i18n Live-Switcher — FR/IT/GSW sehen ihre Sprache direkt beim Erst-Visit',
    summary: 'gsI18n erweitert um Direct-PostgREST-Pull aus i18n_translations (1 GET, keine Anthropic-Calls), 24h-TTL pro Sprache und Boot-Auto-Build wenn Browser-Lang nicht DE ist. Plus openModal-Hook der dynamische Inhalte uebersetzt. FR/IT/GSW-User sehen jetzt die Top-211 UI-Strings ohne erst manuell im Picker zu wechseln.',
    user_summary: '🌍 GreenScan spricht jetzt auch Französisch, Italienisch und Schwiizerdüütsch — automatisch, je nach Browser-Sprache. Wechsel jederzeit im Profil unter "Sprache".',
    user_items: [
      { emoji: '🇫🇷', text: 'Französisch (321 Übersetzungen) — auto-aktiv bei navigator.language=fr*' },
      { emoji: '🇮🇹', text: 'Italienisch (313 Übersetzungen) — auto-aktiv bei navigator.language=it*' },
      { emoji: '🇨🇭', text: 'Schwiizerdüütsch (297 Übersetzungen) — manuell wählbar im Profil' },
      { emoji: '⚡', text: 'Schnellerer Sprach-Switch (Direct-DB-Pull, kein Edge-Fn-Hop)' },
      { emoji: '🔄', text: '24h-Auto-Refresh: neue Übersetzungen werden täglich nachgezogen' },
    ],
    items: [
      {emoji:'🛢️', bold:'gsI18n.loadFromDb(lang):', text:' Neuer Helper. Pullt aus /rest/v1/i18n_translations (PostgREST) direkt, mapped source_text→translated_text + matchet via data-i18n-fallback auf logische Keys + GS_I18N_JS_STRINGS-Map. 1 GET-Query, 0 Anthropic-Calls.'},
      {emoji:'⏱️', bold:'24h-TTL via bundleTs:', text:' Per-Sprache-Timestamp im persistierten Cache. hydrate() liest beide Cache-Formate (alt {de:{},fr:{}} ODER neu {bundles,ts}). isStale(lang) prueft >24h.'},
      {emoji:'🚀', bold:'Boot-Auto-Build:', text:' _bootI18n() nach DOMContentLoaded: wenn current!==de UND isStale(current) → async loadFromDb(current) → applyToDOM(). Fallback auf gsBuildI18n nur bei DB-Pull-Fehler.'},
      {emoji:'🔌', bold:'openModal-Hook:', text:' Idempotent gewrappte openModal ruft gsI18n.applyToDOM(modal) wenn current!==de. Damit werden dynamisch geoeffnete Modals (Marketplace/Doctor/Harvest/etc.) auch in FR/IT angezeigt.'},
      {emoji:'⚡', bold:'gsHandleLangChange Fast-Path:', text:' Bei manuellem Sprach-Switch nutzt jetzt zuerst loadFromDb (1 GET) statt gsBuildI18n (POSTet Edge-Fn, kann Anthropic-Calls triggern bei Cache-Miss). Fallback bleibt bei Fehler.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.19 Schädlings-Scanner (pest-identify Edge-Fn) · v26.18 AR-View MVP (Three.js).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · sw.js gs-v26.20 OK · 211 data-i18n-fallback Markers im Code.'},
    ]
  },
  {
    v: 'v26.16', date: '20.05.2026',
    headline: '⚙️ Cache-Inkonsistenz-Fix · neue Versionen erscheinen sofort',
    user_summary: 'Hintergrund-Verbesserung: wenn wir ein Update pushen, siehst du es sofort beim naechsten Browser-Refresh — keine veraltete Version mehr im Cache.',
    user_items: [
      {emoji:'⚙️', text:'HTML-Seite revalidiert bei jedem Besuch — neue Versionen kommen sofort an.'},
      {emoji:'⚡', text:'Statische Bilder + Bibliotheken bleiben 1 Jahr im Cache (sind versioniert) — schnellerer Wiederbesuch.'},
      {emoji:'🔄', text:'Service-Worker bumpt sich bei jeder Version automatisch — Update-Banner kommt zuverlaessig durch.'},
    ],
    summary: 'v26.16 Cowork Cache-Sprint: _headers HTML-Shell (/ und /index.html) auf max-age=0,must-revalidate (Cloudflare-Default war "cache" — User sahen alten GS_VERSION trotz Live-Deploy). Plus /assets/* + /data/* auf max-age=31536000 immutable (sind versioned via ?v=N query, sicherer Long-Cache). sw.js bleibt unveraendert (war schon max-age=0,must-revalidate aus v25.x).',
    items: [
      {emoji:'⚙️', bold:'_headers Cache-Control HTML:', text:' / und /index.html bekommen max-age=0,must-revalidate. Browser fragt bei jedem Aufruf den Server: "Hat sich was geaendert?" Wenn ja → neuer Body. Wenn nein → 304 (kein Re-Transfer). Loest Cache-Drift wo User stundenlang alte Version sahen.'},
      {emoji:'🗄️', bold:'_headers Assets + Data Long-Cache:', text:' /assets/* (leaflet.js, three.min.js, leaflet-images/*) und /data/* (plants.v1.js) bekommen max-age=31536000 immutable. Diese URLs sind content-versioned (?v=1) — Bump auf v=2 invalidet automatisch. Browser muss sie nie nochmal holen bis URL aendert.'},
      {emoji:'🔄', bold:'SW Update-Banner robuster:', text:' sw.js Top-Comment versionsbump dokumentiert v26.16 Cache-Strategie. Aus v25.x bleibt sw.js: Cache-Control public, max-age=0, must-revalidate + Service-Worker-Allowed: / (war schon korrekt). VERSION-Bump sorgt fuer Cache-Key-Refresh aller SW-internen Caches (SHELL_CACHE, STATIC_CACHE, IMAGE_CACHE, RUNTIME_CACHE).'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.9 AR-View MVP (P3 optional). Cowork-Backend-Deploys fuer Code\'s v26.12/v26.13 Edge-Fns. Live-Mode-Switch (Test→Live) Stripe.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v26.16 · _headers v26.16 · meta=26.16.20260520 · 4 neue Cache-Control Bloecke in _headers · Push → HardRefresh → GS_VERSION live=v26.16 sofort sichtbar.'},
    ]
  },
  {
    v: 'v26.15', date: '21.05.2026',
    headline: '✨ Update-News einfacher — Auto-User-Summary + Tech-Details-Toggle fuer alle Releases',
    summary: 'Sprint-Identitaet "v26.2 User-friendly Release-Notes Vollausbau". Cowork hat in v26.1 user_summary/user_items-Felder eingefuehrt — aber ~30 historische v25.x-Releases haben das noch nicht. Diese Version fuegt eine Auto-Heuristik hinzu, die fuer JEDEN alten Release einen lesbaren ersten Satz und Top-Items extrahiert. Plus Toggle "Technische Details" pro Release fuer Devs.',
    user_summary: 'Update-News sind jetzt einfacher zu lesen — kein technisches Kauderwelsch mehr. Wer doch alle Details sehen will, klickt auf "Technische Details".',
    user_items: [
      { emoji: '✨', text: 'Einfachere Sprache in den Update-News (was hat sich aus deiner Sicht geaendert).' },
      { emoji: '🔧', text: 'Toggle "Technische Details" fuer Power-User die alle Aenderungen sehen wollen.' },
      { emoji: '📜', text: 'Funktioniert auch fuer alte Updates — nichts muss nachgepflegt werden.' },
    ],
    items: [
      {emoji:'🪄', bold:'gsAutoUserSummary:', text:' Nimmt ersten Satz der technischen summary (max 220 chars). Fallback fuer alle Releases ohne explizite user_summary.'},
      {emoji:'🪄', bold:'gsAutoUserItems:', text:' Filtert technische Items (SKIP_BOLD_RX matched Verify/Naechste/Cowork/Constraint/Bilanz/Backwards-Compat/Hard-Lesson) und strippt BUG/BAUSTELLE/B<N>-Praefixe vom bold-Text. Liefert max 6 Items im {emoji, text}-Format.'},
      {emoji:'📜', bold:'About-Modal:', text:' Default zeigt user-friendly Items pro Release. Pro Release ein Tech-Details-Button der die rohen items mit bold-Praefix einblendet.'},
      {emoji:'🔔', bold:'Whats-New-Modal:', text:' Nutzt dieselbe Heuristik. Eigener Tech-Toggle unterhalb der User-Items. Backwards-Compat falls Heuristik-Funktionen nicht vorhanden sind.'},
      {emoji:'🎁', bold:'Zero-Touch:', text:' Existing GS_RELEASES-Eintraege bekommen 0 Aenderungen — Heuristik laeuft zur Render-Zeit. Wenn ein neuer Release explizit user_summary/user_items setzt, wird das bevorzugt.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.0 Pre-Release-stable Tag auf v26.15 (5 Min). v26.16 sw.js Cache-Control header.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · sw.js gs-v26.15 OK.'},
    ]
  },
  {
    v: 'v26.14', date: '21.05.2026',
    headline: '🌍 i18n Pass-3 Tooling — 235 Keys-Inventory + Bulk-Translate-Skript + Coverage-Helper',
    summary: 'Sprint-Identitaet "v26.8 i18n Pass-3". Frontend ist bereit fuer komplette FR+IT-Coverage: gsI18n hat 3-Level-Fallback, neuer gsI18nCoverage()-Helper zeigt pro Sprache geladene Keys-Anzahl. Inventory-Skript zaehlt 235 unique Translation-Keys aus index.html. Bulk-Translate-Skript ruft i18n-translate Edge-Fn chunk-weise (10 keys, 8s sleep). Tatsaechliches FR/IT-Backfill ist Cowork-Pflicht (braucht SERVICE_ROLE_KEY + DB-Diff via Supabase MCP).',
    user_summary: '🌍 Schweizer Markt Pass-3 vorbereitet: 235 Strings sind bereit fuer Franzoesisch + Italienisch. Backend-Translate folgt durch Cowork.',
    items: [
      {emoji:'📊', bold:'scripts/i18n_inventory.sh:', text:' Extrahiert ALLE Translation-Keys aus index.html (data-i18n + gsI18n.t + GS_I18N_JS_STRINGS) als sortierte Unique-Liste in /tmp/all_i18n_keys.txt. Aktuelle Zaehlung: 218 data-i18n + 18 gsI18n.t = 235 unique (Schnittmenge der drei Quellen).'},
      {emoji:'🔁', bold:'scripts/i18n_translate.sh:', text:' Chunked POST zu i18n-translate Edge-Fn (10 keys pro Call, 8s sleep gegen Anthropic Rate-Limit). Args fr/it/all. Liest /tmp/fr_missing.txt + /tmp/it_missing.txt (kommen aus Cowork DB-Diff). Erfordert SUPABASE_SERVICE_ROLE_KEY in Env.'},
      {emoji:'🔍', bold:'gsI18nCoverage():', text:' DevTools-Helper. Iteriert DOM [data-i18n] + GS_I18N_JS_STRINGS-Keys → expected. Pro Sprache zeigt geladene Bundle-Keys-Count. Ausgabe: {expected:235, de:218, fr:N, it:N, gsw:N}.'},
      {emoji:'⚠️', bold:'Cowork-Pipeline:', text:' (1) DB-Diff via Supabase MCP query → /tmp/fr_missing.txt + /tmp/it_missing.txt. (2) bash scripts/i18n_translate.sh all. (3) SELECT lang, COUNT(*) FROM i18n_translations GROUP BY lang → Verify 100% Coverage.'},
      {emoji:'🛡️', bold:'Frontend-Robustheit:', text:' gsI18n.t() hat bereits 3-Level-Fallback (bundle[current] → bundles.de → fallback-String → key). Auch bei luckenhafter Coverage bricht nichts.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.15 sw.js Cache-Control header (gegen Cache-Inkonsistenzen). v26.0+ Pre-Release-stable.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · sw.js gs-v26.14 OK · scripts/i18n_inventory.sh local test: 235 keys gezaehlt.'},
    ]
  },
  {
    v: 'v26.13', date: '21.05.2026',
    headline: '⏰ Trial-End-Reminder — 24h Push + In-App-Banner vor Trial-Auslauf',
    summary: 'User im 7-Tage-Trial bekommt 24h vor Auto-Charge eine Push-Notification + beim naechsten App-Open einen orangen In-App-Banner mit "Verlaengern"-CTA. Verbessert Conversion-Pipe und verhindert Refund-Drama. Sprint-Identitaet "v26.7 Trial-Reminder".',
    user_summary: '⏰ Neu: 24h vor Trial-Ende kriegst du eine kleine Erinnerung — als Handy-Push und als Banner in der App. Ein Klick auf "Verlaengern" und du behaeltst alle Pro-Features.',
    items: [
      {emoji:'🛠️', bold:'Backend daily-push-checker v3:', text:' notifyTrialEndingSoon() pruft Subs in trialing-Status mit trial_end in 24-25h Fenster. webpush.sendNotification mit Title "⏰ Dein GreenScan-Pro endet morgen" + URL /?open=abo. 410/404 Endpoint-Cleanup. Code in supabase/functions/daily-push-checker/index.ts.'},
      {emoji:'🗄️', bold:'Migration push_dedup:', text:' unique-index idx_push_send_log_dedup auf push_send_log(dedup_key). Verhindert dass dieselbe Trial-End-Erinnerung mehrfach pro Cron-Lauf (07/19 UTC) geschickt wird. Dedup-Key Format: trial_end_<uid>_<YYYY-MM-DD>.'},
      {emoji:'🔔', bold:'gsCheckTrialEnding:', text:' Boot-Trigger 4.5s nach DOMContentLoaded wenn sbIsLoggedIn. Ruft gsLoadSubInfo, prueft trial_end Hours-Left < 36. sessionStorage-Guard pro Trial-End-Datum verhindert Mehrfach-Show.'},
      {emoji:'🟠', bold:'gsShowTrialEndingBanner:', text:' Orange In-App-Banner ueber Bottom-Nav (left/right 14px, bottom = tab-h + sb + 12px). Zeigt "Dein Trial endet in <h>h" + "Verlaengern"-Button (-> gsShowAboScreen) + Schliessen-X. role=status + aria-live=polite. Auto-hide nach 12s.'},
      {emoji:'🔗', bold:'URL-Handler ?open=abo:', text:' Push-Click oeffnet greenscan.ch/?open=abo&utm_source=push_trial. Frontend ruft 1.5s nach Boot gsShowAboScreen() + bereinigt die URL.'},
      {emoji:'⚠️', bold:'Cowork-Pflicht:', text:' daily-push-checker v3 Re-Deploy ueber Cowork (existing v2-Trigger Frost/Wasser/Saisonal/Quiz muessen im handler zusammen mit notifyTrialEndingSoon-Call laufen — siehe TODO COWORK Kommentar im File).'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.14 i18n Pass-3 (FR+IT komplettieren via i18n-translate Edge-Fn).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · sw.js gs-v26.13 OK · gsCheckTrialEnding/gsShowTrialEndingBanner + ?open=abo Handler installiert.'},
    ]
  },
  {
    v: 'v26.12', date: '21.05.2026',
    headline: '🏪 Marketplace-Connect — Verkaeufer-Konto via Stripe Connect',
    summary: 'GreenScan-User koennen sich als Marketplace-Verkaeufer registrieren und Stripe-Express-Konto verbinden. Listings (Pflanzen, Samen, Werkzeug, Imker-Beratung) gehen direkt an den Verkaeufer, GreenScan erhaelt 5% Plattform-Gebuehr. Sprint-Identitaet "v26.6 Marketplace-Connect" — GS_VERSION-Bump zu v26.12 weil Cowork v26.1-v26.11 lokal vorgebaut hat (Karten-Reparatur, A11y, Maxlength, Console, Performance).',
    user_summary: '🏪 Neu: Werde Verkaeufer im Marktplatz! Verbinde dein Stripe-Konto in Settings und verkaufe eigene Pflanzen, Samen oder Werkzeug. Zahlung sicher ueber Stripe, Geld in 2-7 Tagen auf dein Konto.',
    items: [
      {emoji:'🗄️', bold:'Backend marketplace_sellers:', text:' Neue Tabelle mit RLS (User darf nur eigenen Eintrag lesen/schreiben), View v_my_marketplace_seller mit profiles-JOIN, Trigger fuer updated_at. Migration in supabase/migrations/20260520_marketplace_sellers.sql.'},
      {emoji:'⚡', bold:'Edge-Fn stripe-create-connect-account:', text:' Express-Onboarding-Account erstellen (CH, CHF, individual), AccountLink mit refresh_url/return_url, idempotent (existing account wird reused). Code in supabase/functions/stripe-create-connect-account/index.ts. Cowork deploys via Supabase MCP.'},
      {emoji:'⚙️', bold:'Settings-Row:', text:' Neue Card in "KI & Scanner" Block — Title/Sub dynamisch je nach Status (Pending/Active/Restricted/Disabled) via gsMarketplaceRefreshSettingsRow im initSettingsScreen.'},
      {emoji:'🖼️', bold:'gsMarketplaceOpenSellerScreen:', text:' Modal mit 4 Status-Renderings — Pending (Werbe-Block + Mit-Stripe-verbinden-Button), Active (Dashboard + Zum-Marktplatz), Restricted (Angaben-vervollstaendigen), Disabled (Support-Mail).'},
      {emoji:'🔐', bold:'gsMarketplaceStartConnect:', text:' POST stripe-create-connect-account mit Auth-Token, 30s Timeout, redirect zu onboarding_url. Error-Handling mit Toast.'},
      {emoji:'↩️', bold:'URL-Param-Handler:', text:' ?marketplace_done=1 zeigt Success-Toast + auto-opens Seller-Screen. ?marketplace_refresh=1 zeigt Abbruch-Toast. history.replaceState bereinigt URL.'},
      {emoji:'⚠️', bold:'Constraint:', text:' Stripe Connect muss im Dashboard aktiviert sein (https://dashboard.stripe.com/settings/connect) bevor erste Anmeldung klappt. stripe-webhook v9 account.updated Handler ist Cowork-Pflicht damit Status auto-syncen.'},
      {emoji:'🚀', bold:'Cowork-Sync:', text:' Bundled mit v26.1-v26.11 lokalen Aenderungen (Karten-Reparatur Tile-Fallback, A11y Auto-Labeler 78 Buttons, Auto-Maxlength + Z-Index-Tokens, Console-Cleanup silent in Production, Performance-Pass preconnect/dns-prefetch/_gsAutoLazyImg).'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.13 Trial-Reminder (Push + Banner 24h vor Trial-End). v26.14 i18n Pass-3 (FR+IT komplettieren). v26.0+ Pre-Release-stable.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 inline-scripts node --check OK · 4 marketplace-Funktionen + Settings-Row + URL-Handler eingebaut · sw.js gs-v26.12 OK.'},
    ]
  },
  {
    v: 'v26.11', date: '20.05.2026',
    headline: '⚡ Schnellerer Start · Bilder laden im Hintergrund',
    user_summary: 'Die App startet sichtbar schneller, weil Karten-Engine und Bilder im Hintergrund nachgeladen werden — du siehst die Inhalte sofort, statt auf alles zu warten.',
    user_items: [
      {emoji:'⚡', text:'Karten-Code (Leaflet) blockiert den Start nicht mehr — App ist schneller benutzbar.'},
      {emoji:'🖼️', text:'Bilder weiter unten laden erst wenn du dorthin scrollst — spart Datenvolumen + Akku.'},
      {emoji:'🔌', text:'Verbindung zu Supabase wird beim Start schon „warm" gehalten — erste Datenabfrage fühlt sich sofort an.'},
    ],
    summary: 'v26.11 Cowork Performance-Sprint: 5 Preconnect/dns-prefetch/prefetch Hints im <head> fuer Supabase/Fonts/Anthropic/Stripe/three.min.js. leaflet.js mit defer (kein Boot-Block — gsLoadLeaflet Polling-Helper handled spaeten Load). _gsAutoLazyImg IIFE patcht alle <img> ausser Top-4 LCP-Kandidaten auf loading=lazy + decoding=async + fetchpriority=low. MutationObserver wie bei v26.3/v26.4. Erwarteter LCP-Boost +20-40%, weniger Datenvolumen bei Scroll-Heavy-Sessions.',
    items: [
      {emoji:'⚡', bold:'preconnect/dns-prefetch (neu):', text:' <link rel="preconnect" href="vowbiueikwrauuceilhc.supabase.co" crossorigin> + fonts.googleapis + fonts.gstatic. dns-prefetch fuer api.anthropic.com + api.stripe.com. prefetch as="script" fuer /assets/three.min.js (lazy bei AR/3D-Use).'},
      {emoji:'🚀', bold:'leaflet.js defer:', text:' Vorher boot-blockierend (148 KB sync parse). Jetzt defer — gsLoadLeaflet() pollt typeof L beim Tab-Open, war bereits resilient gegen lazy Load.'},
      {emoji:'🖼️', bold:'_gsAutoLazyImg (neu):', text:' patcht alle <img>:not([loading]) ausser ersten 4 (LCP-Kandidaten) auf loading=lazy + decoding=async + fetchpriority=low. MutationObserver fuer dynamische Bild-Renderer (Marketplace-Listings, Plant-Detail-Modals).'},
      {emoji:'📊', bold:'Erwarteter Impact:', text:' LCP -300ms bis -800ms je nach Connection, FCP -100ms (defer), TBT -50ms (kein synchroner Leaflet-Parse). Bytes-on-Load -150KB bei Plant-Liste mit 50+ Thumbnails.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.6 Marketplace-Frontend (Code). v26.7 Trial-Reminder (Code). v26.8 i18n FR/IT Pass-3 (Code). Plus Daily-Routine via CODE_ROUTINE_MASTER.md.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v26.11 OK · _headers v26.11 · meta=26.11.20260520 · 5 preconnect/prefetch hints im <head> · leaflet.js defer · _gsAutoLazyImg aktiv (~17 Bilder lazy nach Boot).'},
    ]
  },
  {
    v: 'v26.5', date: '20.05.2026',
    headline: '🧹 Saubere Konsole · weniger Hintergrund-Rauschen',
    user_summary: 'Hinter den Kulissen: GreenScan schreibt weniger Diagnose-Meldungen in die Browser-Konsole — bessere Performance, weniger Krach. Entwickler koennen Dev-Mode jederzeit anschalten.',
    user_items: [
      {emoji:'🧹', text:'Konsole bleibt sauber — nur echte Warnungen und Fehler werden angezeigt.'},
      {emoji:'⚡', text:'Schnellere App durch weniger Browser-Logging-Last.'},
      {emoji:'🔬', text:'Entwickler-Modus jederzeit aktivierbar (URL ?gs_debug=1 oder localStorage).'},
    ],
    summary: 'v26.5 Cowork-Sprint: _gsConsoleCleanup IIFE läuft als allerstes Script. Wenn Host nicht localhost/127.0.0.1/.local/192.168.* UND ?gs_debug=1 nicht in URL UND localStorage.gs_debug !== "1": console.log/debug/info werden silent no-op. console.warn/error/trace bleiben IMMER aktiv. _gsConsoleOrig speichert Originale für gsConsoleRestore() Notfall-Switch. window._gsDevMode flag fuer andere Module. 80 bestehende Boot-Logs (72 log + 4 debug + 4 info) werden ohne Code-Aenderung silent.',
    items: [
      {emoji:'🧹', bold:'_gsConsoleCleanup (neu, Top of Script):', text:' IIFE wird im allerersten <script>-Tag ausgefuehrt VOR allem anderen (vor Error-Handler). Pruefung: location.hostname localhost/127.0.0.1/.local/192.168.* → Dev. URL ?gs_debug=1 → Dev. localStorage.gs_debug=1 → Dev. Sonst Prod = Silence.'},
      {emoji:'🔓', bold:'gsConsoleRestore() (Helper):', text:' Window-Helper um nach Boot Dev-Mode ohne Reload zu aktivieren. Setzt localStorage.gs_debug=1 + restored console.log/debug/info aus _gsConsoleOrig. Toast-Hinweis via console.warn.'},
      {emoji:'🟢', bold:'Dev-Banner in Console:', text:' Bei Dev-Mode logged Helper-Hint mit Style-Banner ("[GreenScan] Dev-Mode aktiv"). Macht klar dass Logs ankommen.'},
      {emoji:'🛡️', bold:'Was bleibt sichtbar:', text:' console.warn (114 Calls), console.error (17 Calls), console.trace, globaler Error-Handler ([GS-Error], [GS-Promise]). Alle Kritischen Meldungen kommen weiterhin durch.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.6 Marketplace-Connect-Frontend (Code). v26.7 Trial-End-Reminder (Code). v26.8 i18n Pass-3.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v26.5 OK · _headers v26.5 · meta=26.5.20260520 · 80 silenced Boot-Logs · 131 Warnings/Errors bleiben aktiv.'},
    ]
  },
  {
    v: 'v26.4', date: '20.05.2026',
    headline: '✏️ Eingabe-Limits · sichere Formulare ohne Roman-Spam',
    user_summary: 'Eingabefelder begrenzen jetzt sinnvoll wie viele Zeichen du eintippen kannst — verhindert versehentliches Pasten von ganzen Texten in Namen-Felder und schuetzt deine monatliche KI-Quote.',
    user_items: [
      {emoji:'✏️', text:'Namen-Felder akzeptieren bis 80 Zeichen, Notizen 500, Feedback bis 2000. Klar gekennzeichnet im Browser.'},
      {emoji:'🔒', text:'Schuetzt vor versehentlichem Mega-Paste — ein langer Roman ins „Wie sollen wir dich nennen"-Feld ist nicht mehr moeglich.'},
      {emoji:'💚', text:'Sauberere Daten gehen an unseren Server → schneller, weniger Fehler.'},
    ],
    summary: 'v26.4 Cowork-Sprint: _gsAutoMaxlength scannt alle <input>/<textarea> ohne maxlength und setzt Limits via Placeholder/Name/Type-Heuristik. Klassifiziert: name=80, title=120, search=100, email=254, password=256, url=2048, tel=32, code/otp=16, kurz-notizen=200, textarea-default=500, feedback/share/story=2000. MutationObserver patcht dynamische Forms. PLUS Z-Index-Tokens als :root --z-base/sticky/dropdown/overlay/modal/toast/tooltip/whatsnew/critical — sauberere Layer-Cake fuer neue Modals statt 99999 / 9050 / 8000 Spaghetti.',
    items: [
      {emoji:'✏️', bold:'_gsAutoMaxlength (neu):', text:' IIFE mit _gsAutoMlInit Guard. applyTo(root) iteriert input:not([maxlength]),textarea:not([maxlength]). classify(el) liest type+name+id+placeholder, mappt auf LIMITS-Konstante. Skipt Non-text Inputs (hidden/file/checkbox/radio/range/color/etc).'},
      {emoji:'🧱', bold:'CSS Z-Index-Tokens (erweitert):', text:' :root bekommt --z-base:1 / --z-sticky:100 / --z-dropdown:500 / --z-tooltip:8000 / --z-whatsnew:9500 / --z-critical:9999. Bestehende --z-overlay (1500) / --z-modal (4000) / --z-modal-top (5000) / --z-toast (9999) aus v24.49 bleiben unveraendert — kein breaking change.'},
      {emoji:'🔭', bold:'MutationObserver:', text:' wie v26.3 Auto-ARIA — beobachtet body fuer childList+subtree, triggert applyTo bei neuen Nodes.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.5 Console-Cleanup (Logger-Wrapper, prod-strip). v26.6 Marketplace-Connect-Frontend (Code). v26.7 Trial-End-Reminder (Code).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v26.4 OK · _headers v26.4 · meta=26.4.20260520 · 84 inputs + 22 textareas ohne maxlength werden beim Boot gepatcht · :root mit 9 neuen --z-* Tokens.'},
    ]
  },
  {
    v: 'v26.3', date: '20.05.2026',
    headline: '♿ Barrierefreiheit · Icon-Knoepfe sprechen jetzt mit Screen-Readern',
    user_summary: 'Wer GreenScan mit einem Screen-Reader (VoiceOver, NVDA, TalkBack) nutzt, hoert ab sofort sinnvolle Bezeichnungen fuer alle Symbol-Knoepfe — Schliessen, Loeschen, Bewerten, Foto, Teilen und mehr.',
    user_items: [
      {emoji:'♿', text:'Symbol-Knoepfe sagen jetzt ihren Zweck — z.B. „Schliessen" statt nur „X" — wenn dir GreenScan via Screen-Reader vorgelesen wird.'},
      {emoji:'🔄', text:'Auch neu eingeblendete Fenster (Abo-Modal, Was-ist-neu, KI-Doctor) bekommen automatisch die richtigen Bezeichnungen.'},
      {emoji:'🌍', text:'Bessere Barrierefreiheit hilft allen — auch wer Tastatur-Navigation oder Sprach-Steuerung nutzt.'},
    ],
    summary: 'v26.3 A11y Sprint: Auto-Labeler _gsAutoArias scannt beim Boot alle <button>EMOJI</button> ohne aria-label und ergaenzt aus EMOJI_LABELS-Map (~40 Symbol→Text-Mappings). MutationObserver patcht dynamisch eingeblendete Modals (gsShowAboScreen, gsShowFirstTrialModal, gsRenderWhatsNew, KI-Doctor etc.) ohne Re-Render-Cost. Defensive: skipt Buttons mit aria-labelledby oder echtem Text-Content (>4 lateinische Zeichen). Console-Debug-Log "+ N aria-labels" beim ersten Run.',
    items: [
      {emoji:'♿', bold:'_gsAutoArias (neu):', text:' IIFE mit window._gsAutoAriasInit Guard. labelize(root) iteriert button:not([aria-label]), liest textContent, mappt via EMOJI_LABELS, setAttribute("aria-label", lbl). Fallback-Reihenfolge: direct → first-char → title-attr.'},
      {emoji:'🗺️', bold:'EMOJI_LABELS-Map:', text:' 40+ Eintraege. × ✕ ✖ → Schliessen · 🗑 🗑️ → Loeschen · ★ ⭐ → Bewerten · ➤ → Weiter · ＋ + ➕ → Hinzufuegen · ❤ ❤️ 💚 → Gefaellt mir · 💬 → Kommentieren · 📷 📸 → Foto aufnehmen · 🖼 🖼️ → Bild auswaehlen · 🔄 ↻ → Aktualisieren · 🔍 🔎 → Suchen · ⚙ ⚙️ → Einstellungen · 🔔 → Benachrichtigungen · ▶ ▶️ → Abspielen · ⏸ ⏸️ → Pause · ↑ ↓ ← → → Richtungen.'},
      {emoji:'🔭', bold:'MutationObserver:', text:' beobachtet document.body fuer childList+subtree Aenderungen. Bei neuen Nodes triggert labelize(document). Dirty-Flag prevented dass jeder Add ein voller Scan ausloest, aber observer ist nicht throttled — bei extrem vielen Mutations koennten wir spaeter requestIdleCallback nutzen.'},
      {emoji:'🛡️', bold:'Defensive Skips:', text:' aria-labelledby-Wins-Path · echter Text-Content > 4 lateinische Zeichen wird ignoriert (real Button-Text) · Empty Buttons skipped.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.4 maxlength + Z-Index-Tokens. v26.5 Console-Cleanup. v26.6 Marketplace-Connect-Frontend.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v26.3 OK · _headers v26.3 · meta=26.3.20260520 · 78 Icon-only Buttons ohne aria-label gefunden → werden alle beim Boot gepatcht.'},
    ]
  },
  {
    v: 'v26.1', date: '19.05.2026',
    headline: '🗺️ Karte repariert · Nutzerfreundliche Update-Meldungen',
    // v26.2: user_summary + user_items zeigen wir End-Usern; items + summary bleiben fuer Devs/Changelog
    user_summary: 'Die Karte zeigt jetzt zuverlaessig deine Region — bei Netzwerk-Problemen wechselt sie automatisch auf eine immer erreichbare Standardkarte. Updates erklaeren wir ab sofort in einfacher Sprache.',
    user_items: [
      {emoji:'🗺️', text:'Karte laedt jetzt zuverlaessig. Wenn Swisstopo mal nicht erreichbar ist, springt automatisch die Standard-Karte ein — keine graue Flaeche mehr.'},
      {emoji:'💾', text:'Deine gewaehlte Karten-Ansicht (Swisstopo, Satellit, Wanderwege) wird gemerkt — beim naechsten Oeffnen ist sie sofort wieder da.'},
      {emoji:'📰', text:'„Was ist neu?" zeigt ab sofort kurze, klare Erklaerungen — kein Code-Kauderwelsch mehr.'},
    ],
    summary: 'Karten-Reparatur nach Fernandos Live-Report "graue Map mit blauem Punkt". Tile-Error-Auto-Fallback: nach 5 fehlgeschlagenen Swisstopo-Tiles innerhalb 10s switcht der Layer automatisch auf OSM (immer erreichbar). gsSetLayer persistiert die User-Wahl in localStorage (Key gs_map_layer). CSP connect-src um wmts.geo.admin.ch + opentopomap + arcgisonline + fastly.net erweitert (Tiles werden trotzdem ueber img-src https geladen, aber Connect-Path schadet nicht und macht prefetch-Warnings weg). GS_RELEASES Schema-Erweiterung: user_summary + user_items werden bevorzugt im Whats-new-Modal gerendert wenn vorhanden, sonst Fallback auf items.',
    items: [
      {emoji:'🗺️', bold:'_gsAddLayerWithFallback (neu):', text:' Helper mit tileerror-Watcher (5 Fehler in 10s → didFallback-Flag → Switch auf OSM). Init und User-Action gehen beide ueber diesen Helper. crossOrigin:true + keepBuffer:2 als Defensive-Defaults.'},
      {emoji:'💾', bold:'localStorage Layer-Persistenz:', text:' gsSetLayer schreibt gs_map_layer key (gsStore-Wrapper mit localStorage-Fallback). gsCreateMap liest den Wert beim Init und stellt den Button entsprechend auf active. Default bleibt swisstopo wenn nichts gespeichert.'},
      {emoji:'🔐', bold:'CSP connect-src erweitert:', text:' wmts.geo.admin.ch, *.geo.admin.ch, server.arcgisonline.com, *.tile.opentopomap.org, *.fastly.net (fuer Hybrid-Labels). Header-Version v25.38 → v26.1.'},
      {emoji:'📰', bold:'GS_RELEASES user_summary/user_items:', text:' Neue optionale Felder pro Release-Eintrag. Whats-new-Modal (gsRenderWhatsNew + Settings-Liste) bevorzugt user_items wenn vorhanden, items bleibt fuer Devs/Changelog. v26.1 + v25.38 retro-gefuellt; aeltere Releases nicht angefasst (zeigen weiterhin items).'},
      {emoji:'🐛', bold:'meta app-version Sync:', text:' 25.38.20260516 → 26.1.20260519.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.3 a11y aria-labels Top-100 Icon-only Buttons. v26.4 maxlength + Z-Index-Tokens. v26.5 Console-Cleanup. v26.6 Marketplace-Connect-Frontend.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v26.1 OK · _headers v26.1 OK · meta=26.1.20260519 · 1× _gsAddLayerWithFallback · 1× gs_map_layer Persistenz · tileerror-Listener registriert.'},
    ]
  },
  {
    v: 'v25.38', date: '16.05.2026',
    headline: '💎 Pro-only Restructure — Plus deaktiviert, Pro Lifetime + Pro 7d-Trial + Free',
    user_summary: 'Wir haben unsere Abos vereinfacht: nur noch EIN Pro-Abo (vereint alle bisherigen Features) plus „Pro Lifetime" — einmal zahlen, fuer immer alles. 7 Tage gratis testen, jederzeit kuendbar.',
    user_items: [
      {emoji:'⭐', text:'Pro Monthly fuer CHF 7.90/Monat oder Pro Yearly fuer CHF 79/Jahr (= 2 Monate gratis).'},
      {emoji:'🏆', text:'Pro Lifetime: einmalig CHF 45.60 — fuer immer alle Features, kein Abo mehr.'},
      {emoji:'🎁', text:'Gratis-Testwoche: 7 Tage alle Pro-Features. Wenn du nicht ueberzeugt bist, kostet es nichts.'},
      {emoji:'🌱', text:'Free-Plan bleibt natuerlich erhalten: 5 Scans pro Tag.'},
    ],
    summary: 'Fernando-Wunsch: nur noch EIN Abo-Modell — Pro (vereint alle bisherigen Plus + Pro Features). Plus-Lifetime wurde in Pro Lifetime umbenannt. Backend war LIVE 2026-05-14: Plus-Plans in Stripe + DB deaktiviert, 3 aktive Prices (pro_monthly 7.90, pro_yearly 79, pro_lifetime 45.60), stripe-checkout v6 capt 7d-Trial. v25.38 = Frontend dazu.',
    items: [
      {emoji:'🌱', bold:'gsShowFirstTrialModal:', text:' Drei Buttons statt vier — 🏆 Pro Lifetime einmalig CHF 45.60, ⭐ Pro Monthly 7-Tage-Trial (danach CHF 7.90/Mt), 🌱 Free-Plan. Plus-Button komplett raus. Header "7 Tage lang ALLES kostenlos testen".'},
      {emoji:'💎', bold:'gsShowAboScreen:', text:' freeCard + proCard (vereint Plus+Pro Features) + lifeCard (Pro Lifetime). plusCard entfernt. Pro-Card mit erweiterter Feature-Liste (KI-Doctor, Buch-Wissen, Familien-Konto, Offline, Export, Werbefrei). Lifetime-Text "= 6 Jahre Pro-Abo gratis" (vorher 12 Jahre Plus).'},
      {emoji:'📋', bold:'GS_PRICE_CATALOG:', text:' 5 Eintraege → 3 (pro_monthly / pro_yearly / pro_lifetime). plus_* lookup_keys entfernt — Backend wuerde 400 returnen wenn jemand die noch ruft.'},
      {emoji:'🏷️', bold:'gsRenderSubInfo:', text:' planName immer "Pro" (vorher tier.charAt + Plus-Fallback). Empty-State CTA "⬆️ Pro 7 Tage gratis testen" statt "Plus oder Pro".'},
      {emoji:'🛒', bold:'gsStartCheckout:', text:' Default-Lookup pro_monthly statt plus_monthly. Bestehende Aufrufer mit explizitem lookup_key sind already pro.'},
      {emoji:'🔄', bold:'Backwards-Compat:', text:' gsIsPaid() behaelt plus|premium in der OR-Pruefung — bestehende Legacy-Subs aus alter Phase bleiben weiterhin als paid markiert. gsShowAboScreen isLegacy={plan==="premium"||plan==="plus"} wird als isPro rendered.'},
      {emoji:'♿', bold:'a11y + Settings:', text:' #gs-abo-modal aria-label "GreenScan Pro Abonnement" (vorher Plus). Settings-Plan-Card-Sub fuer free-Plan: "Upgrade auf Pro — 7 Tage gratis testen".'},
      {emoji:'⏭️', bold:'Naechste:', text:' v25.39 Marketplace-Connect (Cowork Edge-Fn + Tabelle). v25.40 A11y / maxlength. v26.0 Pre-Release-stable.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v25.38 OK · 0 aktive plus_* lookup_keys · 0 "⭐ Plus" UI-Strings · gsIsPaid plus-OR bleibt fuer Legacy-Subs.'},
    ]
  },
  {
    v: 'v25.37', date: '15.05.2026',
    headline: '🔑 Scanner-Key-Robustheit — Length-Check >= 80 chars + "Personal-Key entfernen"-Button',
    summary: 'Zusatz-Bug aus Fernandos Stripe-Live-Test: wenn ps_api_key gesetzt aber LEER oder UNGUELTIG (z.B. abgebrochener Paste-Versuch "sk-ant-"), gewann das ueber den globalen Key → Scanner failt obwohl globaler Key live ist. Fix: Length-Check >= 80 in getApiConfig() schliesst Muell-Keys aus. Plus Settings-Row zum manuellen Entfernen falls schon einer im LocalStorage liegt.',
    items: [
      {emoji:'🛡️', bold:'getApiConfig() Z.16089:', text:' personalKey gewinnt jetzt NUR wenn startsWith("sk-ant-") UND length >= 80 (echte Anthropic-Keys sind 80+ chars). Gleiche Pruefung fuer globalKey als Sicherheits-Net. Vorher: jeder String mit "sk-ant-"-Prefix wurde akzeptiert.'},
      {emoji:'🗑️', bold:'Settings-Row "Persoenlichen API-Key entfernen":', text:' Neuer Eintrag in Settings → KI & Scanner. Sichtbar nur wenn ps_api_key gesetzt ist. Bei ungueltigem Key (kein sk-ant- oder < 80 chars) erscheint roter Warn-Hinweis "⚠️ Ungueltiger Key blockiert Scanner". JS toggled Visibility in initSettingsScreen().'},
      {emoji:'⚡', bold:'gsRemovePersonalKey():', text:' gsConfirmModal-basierte Bestaetigung, localStorage.removeItem("ps_api_key"), Toast "🗑️ Persoenlicher Key entfernt — globaler Key ist jetzt aktiv". Row sofort versteckt + Settings + API-Banner neu geladen.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v25.38 sw.js Cache-Control no-cache header (gegen Cache-Inkonsistenzen). v25.39 A11y. v26.0 Pre-Release-stable.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v25.37 OK · 1× personalKey.length >= 80 · 1× settings-personal-key-row · 1× gsRemovePersonalKey.'},
    ]
  },
  {
    v: 'v25.36', date: '15.05.2026',
    headline: '🌐 SELF-HOST Leaflet + Three.js (unpkg-CDN dead) + Mein-Abo Element-Fix',
    summary: 'Cowork-Live-Diagnose nach v25.35 via Chrome-MCP: NaN-Fix wirkt ("8 Scans"), ABER Karte haengt weiter — fetch von unpkg.com/leaflet returns onerror=unknown. CDN ist nicht erreichbar (Cloudflare-CSP / Adblock / unpkg-Outage). Polling-Retry kann das nicht heilen. PLUS Mein-Abo zeigt nur kaputtes Icon weil #abo-sub-info-host Element gar nicht im DOM ist (gsOpenAboTab oeffnete ein iframe-Modal mit src=abo.html — Datei existiert nicht). v25.36 loest beides: Self-Host und Modal-Routing.',
    items: [
      {emoji:'📦', bold:'6 Files kopiert nach /assets/ (~770 KB):', text:' leaflet.js (148 KB), leaflet.css (15 KB), three.min.js (604 KB), 3 leaflet-images/ Marker-PNGs. via curl von unpkg gezogen (Stand 1.9.4 / 0.128.0).'},
      {emoji:'🗺️', bold:'gsLoadLeaflet auf /assets/leaflet.js:', text:' SRI entfaellt bei same-origin. Polling-Retry aus v25.35 bleibt. onload Callback setzt L.Icon.Default.imagePath = "/assets/leaflet-images/" damit Marker-Pins nicht broken sind.'},
      {emoji:'🧊', bold:'_gsLoadThree auf /assets/three.min.js:', text:' Helper aktualisiert. 3 Three.js-Stellen (3D-Track + KI-Planer-3D + Garten-Detail-3D) routen ueber den existing Helper — keine Aenderungen an Callsites noetig.'},
      {emoji:'🎨', bold:'<head>-Link umgestellt:', text:' <link rel=stylesheet href=/assets/leaflet.css> + <script src=/assets/leaflet.js> statt unpkg-URLs mit SRI. Cloudflare Pages signiert jeden Build → kein SRI-Bedarf.'},
      {emoji:'🛠️', bold:'sw.js SHELL_URLS:', text:' 6 lokale /assets/-Pfade ersetzen 3 unpkg-URLs. unpkg.com aus IMAGE_HOSTS entfernt (kein Stale-While-Revalidate mehr noetig). pdf.js bleibt cdnjs (1.5 MB zu gross fuer Repo).'},
      {emoji:'💎', bold:'Mein-Abo Element-Fix:', text:' gsOpenAboTab oeffnete ein statisches #gs-abo-modal mit iframe src=abo.html — Datei existiert gar nicht im Repo. Jetzt routet die Function auf gsShowAboScreen (richtige dynamische Modal-UI mit Plan-Karten + #abo-sub-info-host). PLUS: statisches Modal bekommt eigenen #abo-sub-info-host als Belt-and-Suspenders fuer alle anderen Callsites.'},
      {emoji:'📊', bold:'Vorteile Self-Host:', text:' Keine externe DNS-Abhaengigkeit · Kein CDN-Outage-Risk · Kein CSP-Issue · Garantiert im SW-Shell-Cache nach Install · Cloudflare-Edge ist naeher als unpkg.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v25.37 sw.js Cache-Control no-cache header (gegen Cache-Inkonsistenzen). v25.38 A11y. v26.0 Pre-Release-stable.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v25.36 OK · 2× id="abo-sub-info-host" im Markup · 0 unpkg.com-Refs ausserhalb Kommentare.'},
    ]
  },
  {
    v: 'v25.35', date: '14.05.2026',
    headline: '🐛 3 P1-Bug-Fixes: Karten-Polling-Retry · NaN-Stats-Fix · Mein-Abo Empty-State sichtbar',
    summary: 'Cowork-Diagnose 2026-05-13 via Chrome-MCP + DB-Inspektion nach v25.34-Hotfix. App-Init laeuft jetzt durch, ABER 3 P1-Bugs noch sichtbar: Karte haengt (Splash 91% oder "Swisstopo laedt…" forever), Home zeigt "NaN 📷 Scans", Mein-Abo-Tab leer (Free-User sehen kein Empty-State).',
    items: [
      {emoji:'🗺️', bold:'BUG1 gsLoadLeaflet:', text:' Polling-Retry statt vertrauen-auf-onload. Neuer poll(tries) Innerer-Resolver checkt 50× im 200ms-Intervall ob typeof L wirklich object ist. Schuetzt vor Race wenn Script-Tag laedt aber L global nicht parsed. existing-Script-Pfad pollt auch 10s (z.B. via SW-Cache geladen, aber langsam initialisiert).'},
      {emoji:'⚙️', bold:'BUG1 Splash-91%:', text:' Splash-Step "🗺️ Karte & Marker vorbereiten…" bekommt try/catch um updateApiBanner + deduplicateDB. Ein Fehler in einer der Sub-Funktionen blockte vorher den ganzen Splash → 91% forever.'},
      {emoji:'🔢', bold:'BUG2 NaN-Fix:', text:' gsUpdateHomeScanStat + gsUpdateMoreStats parsen JSON.parse-Ergebnisse jetzt mit Array.isArray-Check (vermeidet undefined→NaN bei kaputtem localStorage). Number.isFinite-Final-Guard auf Total. gsAnimateCounter: Number(targetNum) + Number.isFinite-Check als allerletzte Defensive bevor toLocaleString.'},
      {emoji:'💎', bold:'BUG3 Mein-Abo:', text:' if(paid)-Wrapper entfernt — gsLoadSubInfo().then(gsRenderSubInfo) wird jetzt IMMER aufgerufen. Free-User sehen jetzt die Empty-State-Card aus v25.33 mit prominentem "⬆️ Plus oder Pro — 7 Tage gratis testen" CTA. .catch() rendert ebenfalls null-Empty-State (statt leeren Host).'},
      {emoji:'⏭️', bold:'Naechste:', text:' v25.36 Leaflet+Three.js self-host falls Karte trotz Polling-Retry noch flaky (eliminiert CDN-Race fuer immer). v25.37 sw.js Cache-Control no-cache header. v26.0 Pre-Release-stable.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v25.35 OK · meta=25.35.20260514 · _headers v25.35.'},
    ]
  },
  {
    v: 'v25.34', date: '13.05.2026',
    headline: '🚨 P0 HOTFIX: App stuck beim Init — Top-Level gsStore-Calls vor gsStore-Definition',
    summary: 'Cowork-Diagnose via Chrome-MCP nach Fernando-Bug-Report "App bleibt beim Init stehen". Console: "ReferenceError: gsStore is not defined at Z.13344". Root-Cause: v25.32 gsStore-Welle 4 (62 Calls migriert) hatte 2 TOP-LEVEL Initialisierungen übersehen — `let _quizStreak = parseInt(gsStore.get(...))` (Z.13344) und `var _mqStreak = parseInt(gsStore.get(...))` (Z.13485). Beide werden beim Script-Load ausgeführt, BEVOR gsStore (Z.~16186) definiert ist → ReferenceError → App-Init bricht ab → Splash bleibt bei "🌱 Starte App..." stehen. Fix: beide Top-Level-Vars auf safe-default 0 + Lazy-Load in initQuiz/initQuizModal sobald Funktion aufgerufen wird (DB+gsStore dann sicher da). 7/7 inline-scripts node --check OK. Verify: 0 Top-Level gsStore-Refs mehr vor Z.16186.',
    items: [
      {emoji:'🔍', bold:'Chrome-MCP-Diagnose:', text:' navigate green-scan.ch → 5s wait → Splash stuck. Console: ReferenceError gsStore at Z.13344. v25.32-Migration hatte 2 Top-Level-Calls übersehen weil Audit-Script nur Funktions-INSIDE-Pattern gesucht hatte.'},
      {emoji:'🛡️', bold:'Fix Z.13344 (_quizStreak):', text:' var = parseInt(gsStore.get(...)) → var = 0 (safe-default). initQuiz() lädt echten Wert via try-catch beim Aufruf.'},
      {emoji:'🛡️', bold:'Fix Z.13485 (_mqStreak):', text:' Gleicher Fix-Pattern. initQuizModal() lädt lazy.'},
      {emoji:'⏭️', bold:'Lessons-Learned 11:', text:' Bei localStorage→gsStore-Migration MUSS audit-script auch Top-Level-Initialisierungen (let/var/const) prüfen, nicht nur Funktions-INSIDE-Calls. gsStore wird erst spät im Script-Load definiert.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js gs-v25.34 · GS_VERSION=v25.34 · _headers v25.34 · meta=25.34.20260513 · grep "^(let|var|const).*gsStore." vor Z.16186: 0 Treffer ✓.'},
    ]
  },
  {
    v: 'v25.33', date: '13.05.2026',
    headline: '🐛 6 Fernando-Bug-Fixes nach Stripe-Test — Doppel-Modal weg, Trial 7 Tage, Scan-Dedup, Karte mit Retry',
    summary: 'Frontend-Cleanup nach Fernandos Stripe-Live-Test. Cowork hat parallel STRIPE komplett saniert: 3 Live-Products + Prices + Webhook + stripe-checkout v6 (Trial-Cap 30→7 + Default 7). v25.33 pflegt die UX-Probleme die im Test sichtbar wurden.',
    items: [
      {emoji:'🔴', bold:'BUG1 _gsAuthPrompt:', text:' Doppel-Onboarding-Modal deaktiviert (early return). Inkognito-User sahen vorher erst "Account erstellen" Pflicht-Modal, dann das richtige Onboarding. Alter Code bleibt als unreachable-Block fuer Notfall-Restore.'},
      {emoji:'🔴', bold:'BUG2 Demo-Modus:', text:' "👁️ Als Gast fortfahren" Button + gs-guest-banner aus DOM entfernt. gsOnboardingGuest + gsActivateGuestMode auf no-op gesetzt (Functions bleiben falls Re-Enable noetig).'},
      {emoji:'🔴', bold:'BUG3 Trial 30→7:', text:' gsTrialStart ruft jetzt gsStartCheckout(plan, false, 7). gsShowFirstTrialModal Texte "1 Monat gratis" → "1 Woche gratis" (3 Stellen: Header + 2 Plan-Buttons).'},
      {emoji:'🟠', bold:'BUG4 Empty-State:', text:' gsRenderSubInfo(null) zeigt jetzt eingeladene Free-Plan-Card mit grossem Upgrade-CTA "⬆️ Plus oder Pro — 7 Tage gratis testen" → gsShowFirstTrialModal. Vorher nur duenne Dashed-Box ohne Action.'},
      {emoji:'🟡', bold:'BUG5 Scan-Dedup:', text:' Neuer gsAddScanHistory(item) Helper mit Dedup-by-id. gsCurrentScanId() teilt eine ID zwischen den zwei Push-Pfaden (gsAddToScanHistory + saveScanToHistory) — 10s-Fenster. Beide alten Writer routen jetzt durch den Helper, mergen Felder statt 3 Eintraege zu erzeugen. Max 200 Eintraege.'},
      {emoji:'🟡', bold:'BUG6 Karten-Retry:', text:' initMap async + neuer gsLoadLeaflet() Lazy-Loader. 3× Versuche je 2s Pause, dann erst Fallback. Echter Fallback-Text: "Karte konnte nicht geladen werden · App neu starten" (statt "benötigt Internet" obwohl online).'},
      {emoji:'⏭️', bold:'Naechste:', text:' v26.0 Pre-Release-stable Tag nach Stripe-Test-Card-Verify durch Fernando. v25.34 AR-View MVP (P3 1 Woche optional).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v25.33 OK · 6/6 Bug-Stellen grep-clean.'},
    ]
  },
  {
    v: 'v25.32', date: '13.05.2026',
    headline: '🧹 gsStore-Welle 4 — 62 localStorage-Calls auf Quota-safe Wrapper migriert',
    summary: 'Tech-Debt-Cleanup: 10 Hot-Keys (Top-Audit-Ranking) mechanisch via Regex auf gsStore-Wrapper umgestellt. Schuetzt gegen Safari-Private-Mode-Crashes + QuotaExceededError unter Storage-Pressure. Reine Frontend-Migration, kein Backend-Bedarf.',
    items: [
      {emoji:'📋', bold:'gs_admin_log:', text:' 10 Calls (6 get / 4 set) — Audit-Log JSON-Array.'},
      {emoji:'🎯', bold:'gs_quiz_streak:', text:' 9 Calls (5 get / 4 set) — Quiz-Streak-Counter.'},
      {emoji:'🛒', bold:'gs_market_listings:', text:' 8 Calls (4 get / 4 set) — Marketplace-localStorage-Fallback fuer Drafts.'},
      {emoji:'🔥', bold:'gs_streak:', text:' 7 Calls (5 get / 2 set) — Login-/Aktiv-Tage-Streak.'},
      {emoji:'🌱', bold:'ps_myplants:', text:' 5 Calls (3 get / 2 set) — Pflanzen-Array Backup.'},
      {emoji:'⚙️', bold:'gs_prefs:', text:' 5 Calls (2 get / 3 set) — User-Preferences.'},
      {emoji:'🌻', bold:'gs_plantings:', text:' 5 Calls (2 get / 3 set) — Garten-Pflanzungen.'},
      {emoji:'🤖', bold:'gs_claude_model:', text:' 5 Calls (1 get / 4 set) — Claude-Modell-Fallback-Chain.'},
      {emoji:'🥀', bold:'gs_dead_plants:', text:' 4 Calls (1 get / 3 set) — Friedhof.'},
      {emoji:'🌾', bold:'gs_seed_inventory:', text:' 4 Calls (1 get / 3 set) — Saatgut-Lager.'},
      {emoji:'📐', bold:'Pattern:', text:' localStorage.setItem(K,v) → gsStore.set(K,v) · localStorage.getItem(K) → gsStore.get(K, null) · localStorage.removeItem(K) → gsStore.remove(K). Falsy-Fallbacks (|| "0" / || "[]") bleiben unveraendert.'},
      {emoji:'📊', bold:'Bilanz:', text:' 62 Calls migriert. Total LS-Calls in index.html: 701 → 639. Top-10 Hot-Keys jetzt 100% Wrapper.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v25.33 AR-View MVP (P3 1 Woche optional). v26.0 Pre-Release-stable nach Stripe-Test-Card-Verify.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v25.32 OK · 10/10 Hot-Keys 0 remaining-LS.'},
    ]
  },
  {
    v: 'v25.31', date: '13.05.2026',
    headline: '🩺 KI-Pflanzendoktor + 🥕 Erntekalender — Phase-2-Bundle (PictureThis-Killer-Features)',
    summary: 'Cowork hat plant-doctor-diagnose Edge-Fn (Vision-AI mit Multi-Hypothese + Treatment-Plan) + plant_doctor_history + harvest_log + v_harvest_stats_per_user View deployed. v25.31 ist das Frontend dazu: 3 neue Modals (Doctor / Harvest-Add / Harvest-Stats) + 2 neue Garten-Action-Buttons + ~25 i18n-Keys.',
    items: [
      {emoji:'🩺', bold:'A1 Doctor-Modal:', text:' Foto-Upload (Camera+Gallery max 10MB), Pflanzen-Picker aus myPlants, 8 Symptom-Multi-Select-Chips (Gelbe-Blaetter/Welke/Flecken/Schaedling/Missbildung/Faulnis/Vertrocknung/Parasit), Notiz-Textarea. Submit-Button mit Loading-State.'},
      {emoji:'🔬', bold:'A2 gsRunDiagnose:', text:' POST plant-doctor-diagnose mit photo-Base64 + species_lat + symptoms + user_note + plant_local_id + save_history=true. 60s Timeout. Login-Check.'},
      {emoji:'📊', bold:'A3 Result-Render:', text:' Urgency-Badge (4 Stufen Low/Medium/High/Critical mit Farben), Top-Diagnose mit Confidence-%, bis zu 4 Hypothesen, Treatment-Steps (priority-color border), Natural-Remedies-Liste, when_call_pro Warning, Smooth-Scroll-to-Result.'},
      {emoji:'👍', bold:'A4 Followup:', text:' 3 Buttons (Hilfreich/Wurde-besser/Wurde-schlechter) PATCH plant_doctor_history. Hilft anderen Usern via aggregierter Daten.'},
      {emoji:'📚', bold:'A5 History-Helper:', text:' gsDoctorHistoryLoad(plant_local_id) ready fuer kuenftige Plant-Detail-Tab-Integration.'},
      {emoji:'🥕', bold:'B1 Harvest-Add:', text:' Modal mit Datum (today-default), Menge+Einheit (g/kg/Stk/Bund/l/Tasse), Quality 1-5 Stars, Notiz. gsHarvestSubmit POST harvest_log.'},
      {emoji:'📊', bold:'B2 Stats-Modal:', text:' Liest v_harvest_stats_per_user fuer current-year, aggregiert total_grams + total_stk + plant-count, CSS-Bar-Chart (kein recharts dependency).'},
      {emoji:'🌻', bold:'B3 Garten-Buttons:', text:' 2 neue Action-Buttons unterhalb Voice-Mode (Doctor: teal, Harvest: orange).'},
      {emoji:'🌍', bold:'i18n:', text:' ~15 doctor_* Keys (no_photo/analyzing/urgency_*/followup_thanks) + ~5 harvest_* Keys (no_amount/save_error/saved) in GS_I18N_JS_STRINGS. ~25 data-i18n im Modal-HTML (Symptome, Labels, Buttons).'},
      {emoji:'🎨', bold:'CSS:', text:' .doctor-sym-chip (Multi-Select Chip mit :has-Selector fuer Checkbox-State).'},
      {emoji:'⏭️', bold:'Naechste:', text:' v25.32 gsStore-Welle 4 (1 Tag mechanisch). v25.33 AR-View MVP (1 Woche P3 optional). v26.0 Pre-Release-stable nach Stripe-Test-Card-Verify.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v25.31 OK.'},
    ]
  },
  {
    v: 'v25.30', date: '13.05.2026',
    headline: '🛒 Marketplace-Repair — User-Listings landen jetzt im Cloud-Feed (P0 Vertrauens-Bug fix)',
    summary: 'Cowork hat marketplace-publish Edge-Fn (Validate + Foto-Upload nach Storage + INSERT in 1 Call) + v_marketplace_listings View (mit seller_name + seller_is_expert + seller_is_premium + photo_urls JOIN) + fn_mkt_increment_views RPC deployed. v25.30 ist das Frontend dazu mit 3 Anpassungen.',
    items: [
      {emoji:'📤', bold:'B1 saveListing:', text:' Komplett umgeschrieben auf marketplace-publish (60s Timeout fuer Foto-Upload). Validate-Block bleibt, ABER nach Erfolg: kein localStorage-INSERT mehr — Backend macht alles. j.photo_count im Toast.'},
      {emoji:'📥', bold:'B2 loadMarketFromSupabase:', text:' Liest v_marketplace_listings statt rohe Tabelle. Mappt DB-Schema (description/category/photo_urls/user_id/seller_name) auf Frontend-Schema (desc/cat/images/sellerId/sellerName). Cloud-Listings haben Vorrang, lokale Drafts ergaenzen.'},
      {emoji:'👁️', bold:'B3 Views-Counter:', text:' openListingDetail ruft Fire-and-Forget fn_mkt_increment_views RPC mit p_listing_id. UUID-Regex stellt sicher dass alte localStorage-IDs nicht hochgezaehlt werden.'},
      {emoji:'🌐', bold:'i18n:', text:' 5 neue toast_market_* Keys (login_required/publishing/published/error/network_error) in GS_I18N_JS_STRINGS.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v25.31 Phase-2-Bundle (KI-Pflanzendoktor + Erntekalender, ~2 Tage). Backends LIVE.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v25.30 OK.'},
    ]
  },
  {
    v: 'v25.28', date: '13.05.2026',
    headline: '🌍 i18n Pass-2 — ~170 data-i18n Marker + ~80 JS-String-Keys (Schweizer Markt komplett)',
    summary: 'Cleanup-Sprint fuer i18n: alle wichtigen statischen UI-Strings bekommen jetzt data-i18n Marker, FR/IT/GSW-User sehen die ganze App in ihrer Sprache (nicht nur Tabs+Garten). GS_I18N_JS_STRINGS Map waechst von 9 auf ~80 Keys: Toasts (Login, Plant, Push, Community, Stripe, Sync), Errors (Quota, Auth, Upload, Premium), Confirm-Buttons (OK/Cancel/Save/Delete), Loading-Status. gsBuildI18n bekommt automatisch alle neuen Keys beim naechsten Sprach-Switch.',
    items: [
      {emoji:'🏷️', bold:'Onboarding:', text:' Register/Login/Magic-Link/Passwort-vergessen/Demo-Banner mit data-i18n (11 Marker).'},
      {emoji:'🏠', bold:'Home-Screen:', text:' Hero-Title, Hero-Sub, Stats-Labels (Arten/Essbar/Pflanzen/Scans), 9 Kategorie-Karten, Section-Header.'},
      {emoji:'🔍', bold:'Suche+Filter:', text:' "Arten suchen"-Title, 10 Category-Filter-Buttons, 6 Property-Filter, Reset-Button.'},
      {emoji:'🌱', bold:'Meine Pflanzen:', text:' Sammlung-Header, Title, 3 Stat-Karten (Pflanzen/Heute faellig/Gut versorgt).'},
      {emoji:'⚙️', bold:'Mehr-Screen:', text:' Title+Sub, Scan-History-Row, Share-App, 5 Nav-Items (Wissen/Saison/Markt/Heilmittel/Karte) inkl. Subtitle.'},
      {emoji:'🌻', bold:'Garten:', text:' Mein-Garten-Title+Sub, Gartenwetter-Card (Label+Tap-fuer-Details).'},
      {emoji:'🌿', bold:'Community:', text:' Title+Sub, 6 Filter-Tabs (Alle/Hilfe/Showcase/Tipps/Fragen/Raritaeten), New-Post Modal-Header.'},
      {emoji:'🛒', bold:'Marktplatz:', text:' Title, +Angebot-Button, 6 Cat-Buttons (Alle/Produkte/Samen/Zubehoer/Dienst/Tausch).'},
      {emoji:'🍲', bold:'Rezepte/Heilmittel/Wissen:', text:' alle Title+Sub.'},
      {emoji:'⚙️', bold:'Settings:', text:' 7 Group-Header (Abo/Standort/Darstellung/Notif/Garten/...) + ~30 Row-Labels inkl. Hints (Mein Standort, Dark Mode, App-Farbe, Kompakt, Giess-Notif, Wetter-Notif, Marktplatz-Alerts, Social-Notif, Mondkalender, Masseinheiten).'},
      {emoji:'💬', bold:'Feedback+Support:', text:' sec-Header (Feedback&Ideen / Community-Feedback / Support&Hilfe), Form-Labels, 4 Type-Options, Submit-Button.'},
      {emoji:'📦', bold:'Modal-Titel:', text:' Scan-Verlauf, KI-Experte, Neuer Garten, Neue Pflanzung, Neuer Post.'},
      {emoji:'💾', bold:'JS-Strings-Map:', text:' ~80 Keys (war 9): toast_* (Login/Plant/Push/Community/Stripe/Sync/i18n), err_* (Quota/Auth/Upload/Premium), confirm_* (OK/Cancel/Yes/No/Delete/Save), status_* (Loading/Saving/Done).'},
      {emoji:'🤖', bold:'Auto-Build:', text:' gsCollectI18nStrings sammelt alle data-i18n + JS-Map. Naechster Sprach-Switch baut FR/IT-Bundle automatisch.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v25.30 AR-View MVP (P3 nice-to-have). v26.0 Pre-Release-stable Tag.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v25.28 OK · data-i18n count: 172.'},
    ]
  },
  {
    v: 'v25.29', date: '12.05.2026',
    headline: '👥 Community-Experten-Verifikation — Verified-Badge + Stripe-Bestellung',
    summary: 'Cowork hat expert_verifications + v_social_posts_with_verifications + stripe-expert-checkout v1 + stripe-webhook v7 (kind=expert_verification) deployed. v25.29 ist das Frontend dazu. Community-Feed laedt jetzt aus der View, Posts mit is_expert_verified bekommen ein gruenes ✅-Badge. Experten (profiles.is_expert) sehen Verifizieren-Button auf fremden Posts. PRO/Lifetime-User auf eigenen Posts Verifikation-anfragen-Button (CHF 0.50 via Stripe-Checkout). v25.28 i18n Pass-2 verschoben.',
    items: [
      {emoji:'🔗', bold:'B1 View-Switch:', text:' loadSocialPosts ruft v_social_posts_with_verifications statt social_posts. Bringt verification_count + is_expert_verified pro Post mit.'},
      {emoji:'✅', bold:'B2 Verified-Badge:', text:' Post-Header bekommt gruenen Gradient-Badge ✅ Verifiziert + optional NxCount.'},
      {emoji:'🎓', bold:'B3 Experten-UI:', text:' gsLoadUserExpertStatus 1h-Cache, gsIsExpert + gsHasProPlan Helper. Verifizieren-Button nur fuer Experten auf fremden Posts.'},
      {emoji:'🛒', bold:'B4 Stripe-Flow:', text:' gsOpenVerifyModal (Confirm) + gsSubmitVerification (INSERT). gsRequestExpertVerification (PRO+own) ruft stripe-expert-checkout + Top-Level-Redirect.'},
      {emoji:'🔁', bold:'B5 Return-Handler:', text:' ?ev_payment=success/cancel in gsHandleAuthRedirect mit Toast + Feed-Reload.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v25.28 i18n Pass-2 (verschoben Cleanup). v25.30 AR-View MVP.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v25.29 OK.'},
    ]
  },
  {
    v: 'v25.27', date: '11.05.2026',
    headline: '🌍 i18n FR/IT/GSW aktiviert — Schweizer Markt mit Coworks i18n-translate-Backend',
    summary: 'Cowork hat i18n-translate Edge-Fn (Haiku 4.5, Bulk-Chunks, SHA-256-Cache) + i18n_translations-Tabelle deployed. v25.27 ist das Frontend dazu mit 5 Baustellen: gsI18n Singleton, Bundle-Builder, Settings-UI Sprachauswahl, data-i18n Pass-1, hreflang-Tags.',
    items: [
      {emoji:'🌐', bold:'gsI18n Singleton:', text:' detectLang (localStorage>URL>navigator), hydrate aus gs_i18n_bundles, t-Funktion mit DE-Fallback, applyToDOM ueber [data-i18n], setLang persistiert + Toast.'},
      {emoji:'🤖', bold:'gsBuildI18n:', text:' POST i18n-translate mit DE-Strings, Server-Cache via SHA-256, _setBundle persistiert. GS_I18N_JS_STRINGS fuer Toast/innerHTML.'},
      {emoji:'⚙️', bold:'Settings-UI:', text:' Sprache-Row nach Push-Settings mit 5 Optionen (Auto/DE/FR/IT/GSW). gsHandleLangChange + gsInitLangPicker.'},
      {emoji:'🏷️', bold:'data-i18n Pass-1:', text:' 16 Marker auf Bottom-Tabs + Garten-Action-Buttons + Settings-Labels.'},
      {emoji:'🔍', bold:'hreflang:', text:' 4 link rel=alternate im head fuer SEO. html lang dynamisch.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v25.28 = restliche statische Strings. v25.29 = Community-Experten. v25.30 = AR-View.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v25.27 OK.'},
    ]
  },
  {
    v: 'v25.26', date: '11.05.2026',
    headline: '🔔 Smart-Push-Notifications Frontend — fertig verdrahtet mit Coworks Backend',
    summary: 'Cowork hat in v25.25-Sprint das komplette Push-Backend deployed (VAPID, daily-push-checker v2, pg_cron 07/19 UTC, push_subscriptions-Schema +7 Spalten). v25.26 ist das Frontend dazu. 3 Bugs gefixt: Schema-Mismatch, Subscribe-Flow, Settings-UI. Plus iOS-Detection (Standalone + 16.4+ Pflicht).',
    items: [
      {emoji:'🔧', bold:'Bug 1 Schema-Fix:', text:' POST schreibt jetzt auth_secret (war auth), plus gps_lat/lng aus gs_user_location, plus 4 notify_*-Toggles, plus quiet_start/end_hour.'},
      {emoji:'🆕', bold:'Bug 2 Subscribe-Flow:', text:' gsGetVapidPublicKey + gsBase64UrlToUint8 + gsSubscribeWebPush mit pushManager.subscribe. gsUnsubscribeWebPush mit Server-DELETE.'},
      {emoji:'⚙️', bold:'Bug 3 Settings-UI:', text:' Master-Toggle + 4 Kategorie-Checkboxes (Frost/Wasser/Saison/Quiz) + Stille-Zeit-Picker. gsSavePushSettings persistiert localStorage + PATCH zum Server. Auto-Refresh nach Boot.'},
      {emoji:'🍎', bold:'iOS-Handling:', text:' gsPushSupportStatus prueft Standalone + iOS 16.4. Toast-Hinweis statt Subscribe-Versuch bei Inkompatibilitaet.'},
      {emoji:'⏭️', bold:'Smoke-Test pending Cowork:', text:' Toggle ON -> push_subscriptions row. dry_run-Trigger sollte details.sent enthalten. v25.27 i18n FR/IT als naechstes.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v25.26 OK.'},
    ]
  },
  {
    v: 'v25.25', date: '11.05.2026',
    headline: '🔓 Auth-Bug Final-Fix: „Registrierfenster nach Login" — Race-Condition mit Pflicht-Modal beseitigt',
    summary: 'Fernando-Reproduzierter Bug: Nach erfolgreichem Login zeigte sich plötzlich ein „Account erstellen — kostenlos"-Fenster. Root-Cause: Das in v24.33 eingeführte gs-auth-pflicht-modal (Boot-Timer 2.2s) öffnete sich PARALLEL zum Onboarding-Wrapper hinter diesem (z-index 9000 vs 9999999). Wenn der User seinen Login-Flow länger als 2.2s brauchte (E-Mail/Passwort tippen + senden), war das Pflicht-Modal bereits im DOM — versteckt hinter Onboarding. Nach erfolgreichem Login versteckte gsOnboardingHide den Onboarding-Wrapper, aber das Pflicht-Modal blieb sichtbar. Aus User-Sicht: „nach Login kommt Registrierfenster". v25.0/v25.1-Fixes (Sub-View-Reset + Idempotent-Guard) waren korrekt für den Onboarding-Flow selbst, hatten aber das parallele Modal nicht berücksichtigt.',
    items: [
      {emoji:'🛡️', bold:'Fix 1 — _gsAuthPrompt Onboarding-Guard (Z.~45197):', text:' Vor dem Erstellen des Pflicht-Modals wird geprüft ob #gs-onboarding sichtbar ist (style.display !== "none"). Wenn ja, wird das Modal NICHT erstellt — User ist mitten im Login/Register-Flow.'},
      {emoji:'🧹', bold:'Fix 2 — gsOnLoginSuccess Cleanup (Z.~48749):', text:' Nach erfolgreichem Login werden #gs-auth-pflicht-modal UND legacy #modal-profile entfernt/geschlossen falls noch im DOM. Doppelte Sicherheit für Edge-Cases (z.B. User klickt im Pflicht-Modal auf „Einloggen", dann via Onboarding ein).'},
      {emoji:'🎯', bold:'Saubere Lösung — keine Symptom-Behandlung:', text:' Beide Fixes adressieren die Wurzel: das Pflicht-Modal weiß jetzt vom Onboarding-Kontext, und gsOnLoginSuccess räumt restlos auf. Kein setTimeout-Hack, keine display:none-Vererbungs-Tricks. Verhalten dokumentiert in BUG_AUTH_LOGIN_ZEIGT_REGISTER.md (v25.25-Update).'},
      {emoji:'⏭️', bold:'Nächste:', text:' v25.21 Mischkultur-Score (entsperrt durch 41 plant_companion_matrix-Pairs). v25.23 Push wartet auf Cowork VAPID + Edge-Fn.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js gs-v25.25 OK · GS_VERSION=v25.25 OK · _headers v25.25 OK · meta app-version=25.25.20260511 OK · v25.25-Marker im Code: 2 (Fix 1 _gsAuthPrompt + Fix 2 gsOnLoginSuccess) OK.'},
    ]
  },
  {
    v: 'v25.24', date: '11.05.2026',
    headline: '🎙️ Hey GreenScan — Voice-Mode mit Web Speech API',
    summary: 'Drittes Feature des Konkurrenz-Killer-Sprints. v25.23 Push wartet auf Cowork. v25.24 Voice-Mode zuerst da kein Backend noetig. Floating-Modal mit 120px Mikrofon-Button (Pulse-Animation). SpeechRecognition de-CH, Intent-Detection 3 Use-Cases, SpeechSynthesis liest Antwort vor.',
    items: [
      {emoji:'🎤', bold:'Web Speech API + iOS-Fallback:', text:' window.SpeechRecognition + webkitSpeechRecognition. Feature-Detection mit Disabled-State.'},
      {emoji:'🧠', bold:'Intent-Detection 3 Cases:', text:' 1) Ernte/Saison -> gsLoadSeasonalTasks. 2) Erinnere -> Brain-Observe. 3) Generic -> callAI mit TTS-optimiertem Prompt.'},
      {emoji:'🔊', bold:'SpeechSynthesis de-CH:', text:' Max 800 Zeichen pro Utterance. Cancel-Bei-Modal-Close.'},
      {emoji:'🎨', bold:'UI:', text:' 120px Mic-Button mit color-coded Status (gruen idle, rot+Pulse listening, orange processing). Live-Transkript-Anzeige.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v25.23 Push (wartet). v25.27 i18n (wartet).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v25.24 OK.'},
    ]
  },
  {
    v: 'v25.22', date: '11.05.2026',
    headline: '📷 Foto-Verlauf-Slider im Pflanzen-Tagebuch — Konkurrenz-Killer #2',
    summary: 'Zweites Feature des Konkurrenz-Killer-Sprints. Pro Pflanze Foto-Verlauf-Slider mit chronologischer Timeline aller Bilder (Profil-Foto + alle diary[].photo). Range-Slider zum Durchscrollen ODER Vorher-Nachher-Compare-Mode mit erstem vs letztem Foto. PictureThis hat das, wir jetzt auch.',
    items: [
      {emoji:'📸', bold:'gsCollectPlantPhotos:', text:' p.photo (Profil mit added als ts) + alle diary[].photo. Chronologisch aelteste zuerst.'},
      {emoji:'🎚️', bold:'Single-Mode:', text:' Aspect-ratio 1 Container, object-fit:contain. Range-Slider mit accent-color gruen. Drag-to-seek via oninput.'},
      {emoji:'⇆', bold:'Compare-Mode:', text:' 2x1-Grid mit erstem + letztem Foto. Datum + Title-Label unter jedem Bild.'},
      {emoji:'🎯', bold:'UI-Trigger:', text:' 📸 Verlauf-Button im Plant-Diary-Modal-Header.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v25.23 Push (wartet auf Cowork). v25.24 Voice. v25.27 i18n.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v25.22 OK.'},
    ]
  },
  {
    v: 'v25.21', date: '11.05.2026',
    headline: '🌱 Mischkultur-Score beim Add-Plant — entsperrt durch Cowork (41 Pairs)',
    summary: 'Erstes Feature des Konkurrenz-Killer-Sprints. Cowork hat plant_companion_matrix mit 41 Pairs gefuellt (31 gut, 5 schlecht, 5 neutral). User tippt im Add-Plant-Modal Pflanzen-Namen — App mappt via window.DB auf lat, ruft plant_companion_matrix mit OR-Query, filtert gegen myPlants, sortiert in good/bad/neutral. Auto-Block 800ms-debounced unter Name-Input. Bei schlechten Kombinationen Tipp 50cm Abstand.',
    items: [
      {emoji:'🔍', bold:'gsLookupLatByName:', text:' Sucht in window.DB (4341 Arten) exakt-Match oder substring. Liefert null bei <3 Zeichen.'},
      {emoji:'📡', bold:'gsLoadCompanionsFor 1h-Cache:', text:' OR-Query species_a_lat ODER species_b_lat = lat. Cache pro lat.'},
      {emoji:'⚖️', bold:'gsScoreCompanions:', text:' Iteriert Pairs, klassifiziert in good/bad/neutral je nach relationship-Feld. Dedup via Set.'},
      {emoji:'🎨', bold:'UI Live-Auto-Block:', text:' 3 farbcodierte Bloecke gruen/rot/orange. Edge-Cases mit eigenen Hinweisen (keine myPlants, kein DB-Match).'},
      {emoji:'⏭️', bold:'Naechste:', text:' v25.22 Foto-Verlauf. v25.23 Push-Notifications. v25.24 Voice-Mode. v25.27 i18n FR/IT.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v25.21 OK.'},
    ]
  },
  {
    v: 'v25.20', date: '10.05.2026',
    headline: '📊 Garten-Insights-Dashboard — DB-Mega-Sprint v25.16-v25.20 KOMPLETT',
    summary: 'Letztes Feature der DB-Mega-Sprint-Serie. Aggregiert pollinators + plant_diseases + garden_tasks_catalog + species-DB + myPlants in einem Insights-Modal. Bestäuber-Score (% myPlants in Top-Pollinator-Plants), Krankheits-Risiko (Anzahl myPlants in affected_plants), Saison-Tasks-Count, DB-Stats-Footer. Reine Client-Aggregation ueber 3 cached Edge-Fn-Loads.',
    items: [
      {emoji:'🧮', bold:'gsInsightsCompute:', text:' Promise.all auf gsLoadPollinators+gsLoadDiseases+gsLoadSeasonalTasks. Berechnet Match-Scores + Risk-Liste mit Dedup + aktuelle Tasks.'},
      {emoji:'📊', bold:'4 Big-Stat-Boxen:', text:' myPlants gruen, Bestaeuber-% gelb, Krankheits-Risiko orange, Tasks blau. Color-coded scanbar.'},
      {emoji:'🌟', bold:'Detail-Blocks:', text:' Bestaeuber-Block, Risk-Block (Top-5 Issues), Saison-Block, Status-Block (planned vs planted), DB-Stats-Footer.'},
      {emoji:'🎉', bold:'DB-Mega-Sprint KOMPLETT:', text:' v25.16 Bee-Friendly + v25.17 Krankheits-Lexikon + v25.18 Saisonkalender + v25.20 Insights alle live. v25.19 Mischkultur wartet auf Cowork-Daten.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v25.20 OK.'},
    ]
  },
  {
    v: 'v25.18', date: '10.05.2026',
    headline: '📅 Saisonkalender — aktuelle Garten-Tasks inline + 12-Monats-Uebersicht',
    summary: 'Drittes Feature der v25.16-v25.20 DB-Mega-Sprint-Serie. Nutzt Coworks garden_tasks_catalog (15+ Tasks mit month_start/month_end + applies_to). Im Garten-Tab inline-Section mit Top-4 Tasks fuer aktuellen Monat plus Modal mit voller 12-Monats-Uebersicht. Year-Wrap fuer Tasks Nov-Feb. Emoji-Mapping fuer 10 Task-Typen.',
    items: [
      {emoji:'⏰', bold:'gsLoadSeasonalTasks 1h-Cache:', text:' GET garden_tasks_catalog mit order=month_start.asc. Tasks sind statisch.'},
      {emoji:'🎯', bold:'gsFilterTasksForMonth Year-Wrap:', text:' s<=e direkt-Range, sonst wrapping. Aktueller Monat = new Date().getMonth()+1.'},
      {emoji:'📌', bold:'Inline-Section:', text:' Auto-render im Garten-Tab nach DOM-Ready+2.2s. Top-4 Tasks als Card-Block. Header zeigt Im Monat + Alle X Tasks-Button -> Modal.'},
      {emoji:'📚', bold:'Voll-Uebersicht-Modal:', text:' 12 Monate als Cards, aktueller Monat highlighted gruen. Pro Task: Emoji+Title+Description+applies_to-Liste.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v25.19 Mischkultur (wartet auf Daten). v25.20 Insights-Dashboard.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v25.18 OK.'},
    ]
  },
  {
    v: 'v25.17', date: '10.05.2026',
    headline: '🦠 Krankheits-Lexikon — Symptom-Suche mit plant_diseases-DB + Bio/Chemo-Treatment',
    summary: 'Zweites Feature der v25.16-v25.20 DB-Mega-Sprint-Serie. Nutzt Coworks plant_diseases-Tabelle (16+ Eintraege, taeglich wachsend via pg_cron). Neues Modal im Garten-Tab mit Live-Symptom-Suche im Header (z.B. gelbe Blaetter, brauner Rand). Pro Krankheit: Cause-Badge, Severity-Badge, Symptome, Bio-Treatment + Konventionell-Treatment + Vorbeugung. Konkurrenz-Killer gegen PictureThis fuer Schweizer-DSGVO-konformen Disease-Use-Case.',
    items: [
      {emoji:'🔍', bold:'gsDiseaseSearch Multi-Keyword:', text:' Tokens werden split-und-jeder-muss-vorkommen (every). Search in name+lat_name+symptoms+symptoms_visual+cause_type+affected_plants.'},
      {emoji:'🦠', bold:'gsBuildDiseaseModal:', text:' Header rot-Gradient mit Symptom-Input (max 120, debounced 250ms). Cards mit Cause-Color-Mapping (Pilz violett, Bakterien blau, Virus rot, Schaedling braun, Mangel gruen).'},
      {emoji:'💊', bold:'Bio + Konventionell separat:', text:' treatment_bio gruener Quote-Block, treatment_chemical orange Quote-Block. Plus prevention-Zeile.'},
      {emoji:'⏭️', bold:'Naechste:', text:' v25.18 Saisonkalender. v25.19 Mischkultur (wartet auf Daten). v25.20 Insights-Dashboard.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 node --check OK · sw.js gs-v25.17 OK.'},
    ]
  },
  {
    v: 'v25.16', date: '10.05.2026',
    headline: '🐝 Bestäuber-Garten — neues Wildbienen-Förderungs-Feature mit pollinators-DB',
    summary: 'Erstes Feature der v25.16-v25.20 DB-Mega-Sprint-Serie nach Cowork-Backend-Erweiterung (4 neue Tabellen: plant_diseases, pollinators, garden_tasks_catalog, plant_companion_matrix). v25.16 nutzt pollinators-Tabelle (15+ Eintraege, taeglich wachsend via pg_cron) fuer ein neues Bestaeuber-Garten-Modal im Garten-Tab. Modal zeigt: myPlants-Match-Highlight, Top-12-Pflanzen aggregiert nach preferred_flowers-Coverage, 30 Insekten-Detail-Cards mit ecological_value-Badges. Public-read Cloud-DB, 30min-Client-Cache. Konkurrenzlos-Schweizer-Feature fuer Wildbienen-Foerderung.',
    items: [
      {emoji:'🐝', bold:'gsBeeFriendlyOpen() Modal:', text:' Header mit Linear-Gradient orange/gelb. Skeleton-Loading waehrend gsLoadPollinators(). UI-Trigger im Garten-Tab als gelber Action-Button.'},
      {emoji:'🌟', bold:'Top-Pflanzen-Aggregation:', text:' gsAggregatePollinatorPlants(rows) sammelt preferred_flowers aus allen Pollinator-Eintraegen, gruppiert + sortiert. Top-12 als Liste mit Anzahl Bestaeuber + Beispiel-Insekten.'},
      {emoji:'🌿', bold:'myPlants-Match-Highlight:', text:' Bei myPlants wird Match gegen Top-12 gefahren. Treffer: gruener Block mit Anzahl. Sonst Tipp-Block.'},
      {emoji:'⚠️', bold:'ecological_value-Badges:', text:' Pollinators mit kritisch=rot, hoch=orange. Plus type-Erkennung Schmetterling/Kaefer/Hummel mit Emoji.'},
      {emoji:'⏭️', bold:'Naechste Sub-Tasks:', text:' v25.17 Krankheits-Erkennung. v25.18 Saisonkalender. v25.19 Mischkultur. v25.20 Insights-Dashboard.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js (gs-v25.16) valid OK · GS_VERSION=v25.16 OK.'},
    ]
  },
  {
    v: 'v25.15', date: '10.05.2026',
    headline: 'KI-Planer Theme 1 Sub-Tasks 1.6+1.7: Auto-Sync myPlants + PDF-Export — Theme 1 KOMPLETT',
    summary: 'Letzter Sub-Task der v25.9-Theme-1-Mega-Upgrade-Serie. Plan-Result hat jetzt zwei Action-Buttons: In meinen Garten und PDF exportieren. Erstes legt pro recommended_plants[] einen myPlants-Eintrag an mit status=planned und plan_id-Referenz. Care-Intensity bestimmt Wasser-Default. Dedup gegen doppelte Imports. PDF-Export via iframe + window.print() funktioniert auf allen Plattformen (Mobile zeigt Als-PDF-speichern). Damit ist Theme 1 komplett.',
    items: [
      {emoji:'📚', bold:'gsGardenScanSyncToMyPlants():', text:' Pro recommended_plants[] ein myPlants-Eintrag mit status=planned, plan_id, lat, cat, emoji aus gsCatEmoji, water aus care_intensity, notes mit Position+qty+spacing+sow/harvest+reason. Dedup-Set gegen Doppel-Import. savePlantsToStorage + renderMyPlants + scheduleAllNotifications + Toast + Brain-Observe garden_plan_imported.'},
      {emoji:'📄', bold:'gsGardenScanExportPDF():', text:' Hidden-iframe mit Plan-HTML (Header + Site-Analysis + SVG-Skizze + Plant-Liste + Monatskalender + Tools + Warnings + Footer). Print-CSS mit page-break-Hints. iframe.contentWindow.print(). Cleanup nach 2s.'},
      {emoji:'🎨', bold:'UI Action-Buttons:', text:' In-meinen-Garten (gruen) + PDF-exportieren (outline). Flex-Layout mit min-width 140px, wrapped auf schmalen Screens.'},
      {emoji:'🎉', bold:'Theme 1 KI-Planer-Mega-Upgrade KOMPLETT:', text:' v25.11 (Wizard+Edge-Fn) -> v25.12 (2D-SVG) -> v25.13 (3D) -> v25.14 (Chat) -> v25.15 (Auto-Sync+PDF). Cowork-Backend voll integriert. End-to-End: 3 Fotos zu KI-Analyse zu 2D/3D-Plan zu Chat-Iteration zu eigenem Garten plus PDF.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js (gs-v25.15) valid OK · GS_VERSION=v25.15 OK.'},
    ]
  },
  {
    v: 'v25.14', date: '10.05.2026',
    headline: 'KI-Planer Theme 1 Sub-Task 1.5: Chat-Iteration via plan-iterate Edge-Fn',
    summary: 'Vierter Sub-Task der v25.9-Theme-1-Serie. Plan-Result hat jetzt eine Chat-Bar im Footer mit Input + Send-Button + Live-Iter-Counter. User kann Plan-Aenderungen in natuerlicher Sprache requesten. gsIteratePlan(planId, message) ruft plan-iterate Edge-Fn (30s Timeout). Response enthaelt vollstaendigen neuen Plan + change_summary. Bei Erfolg ersetzt s.analysis und re-rendert das Plan-Result inkl. SVG/3D-Re-Render. Letzte Aenderung wird als gruener Quote-Block angezeigt. Limit 5 Iterations pro Plan (Backend enforced via HTTP 429).',
    items: [
      {emoji:'💬', bold:'gsIteratePlan(planId, message):', text:' Async Wrapper fuer POST plan-iterate. Bearer-Auth, 30s Timeout. Body: plan_id+user_message. Response: ok+analysis+change_summary+iteration_count+iterations_remaining.'},
      {emoji:'⌨️', bold:'gsBuildGardenScanChatBar() UI:', text:' Footer-Block in Plan-Result mit Header (Plan anpassen + Iter-Counter), letzten change_summary, Input mit maxlength=300 + Enter-Submit, Send-Button. Bei Iter-Limit: Warning-Block statt Input.'},
      {emoji:'🔄', bold:'gsGardenScanChatSend() Handler:', text:' Optimistic UI mit Input clear + disable. Bei Erfolg: s.analysis ersetzt, Modal re-rendert (auch 3D falls aktiv).'},
      {emoji:'⏭️', bold:'Naechster Sub-Task:', text:' v25.15 1.6+1.7 Auto-Sync Plan-Pflanzen zu myPlants + PDF-Export-Polish.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js (gs-v25.14) valid OK · GS_VERSION=v25.14 OK.'},
    ]
  },
  {
    v: 'v25.13', date: '10.05.2026',
    headline: 'KI-Planer Theme 1 Sub-Task 1.4: 3D-Three.js-Render mit Auto-Rotate + Drag/Zoom',
    summary: 'Dritter Sub-Task der v25.9-Theme-1-Serie. Plan-Result hat jetzt einen 2D/3D-Toggle-Button. 3D-Mode rendert die Garten-Plane (braune Erde) mit 1m-GridHelper und einer Cylinder-Geometry pro Pflanze. Cylinder-Hoehe aus pl.mature_height_cm oder Kategorie-Defaults. Beeren/Obst/Blumen bekommen zusaetzlich Sphere oben drauf. Auto-Rotate-Mode pausiert bei User-Interaktion (Resume nach 2.5s). Drag-to-Rotate via Mouse + Touch. Wheel-Zoom + Pinch. Cleanup-Handle raeumt Listener + Renderer + Geometries beim Toggle zurueck zu 2D auf. Funktioniert offline dank v25.9 sw.js Three.js-Cache.',
    items: [
      {emoji:'🧊', bold:'gsRenderGardenScan3D(container, analysis):', text:' Three.js Scene mit Hellblauem Sky, Sun-DirectionalLight, Ambient + Hemisphere. PlaneGeometry W x D als Boden. GridHelper als 1m-Raster.'},
      {emoji:'🌱', bold:'Pflanzen als Cylinder (+ optional Sphere):', text:' Pro recommended_plants[] ein Cylinder mit kategorie-Farbe (analog 2D-SVG). Hoehe aus mature_height_cm oder Cat-Default. Beeren/Obst/Blumen bekommen Sphere on top.'},
      {emoji:'🎮', bold:'Interaktion:', text:' Auto-Rotate 0.0035 rad/frame, pausiert bei User-Interaktion. Mouse + Touch Drag-to-Rotate. Wheel-Zoom modifiziert camDist. Touch-action:none auf 3D-Host.'},
      {emoji:'🧹', bold:'Cleanup:', text:' window._gsGardenScan3DScene.dispose() entfernt 6 Event-Listener + renderer.dispose() + Scene-Traverse mit geometry/material disposal. Kein Memory-Leak.'},
      {emoji:'⏭️', bold:'Naechste Sub-Tasks:', text:' v25.14 1.5 Chat-Iteration via plan-iterate Edge-Fn (5-Iter-Limit). v25.15 1.6+1.7 Auto-Sync myPlants + PDF-Export.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js (gs-v25.13) valid OK · GS_VERSION=v25.13 OK · _headers v25.13 OK.'},
    ]
  },
  {
    v: 'v25.12', date: '10.05.2026',
    headline: 'KI-Planer Theme 1 Sub-Task 1.3: Responsive 2D-SVG-Plan-Skizze',
    summary: 'Zweiter Sub-Task der v25.9-Sprint-Theme-1. Nach v25.11 (Multi-Foto-Wizard + Edge-Fn) zeigt das Plan-Result jetzt eine echte 2D-Skizze des Gartens. SVG mit viewBox + preserveAspectRatio mobile-first responsive. 1m im Garten = 100 SVG-Units, mit gestricheltem 1m-Grid im Hintergrund. Pflanzen werden als farbcodierte Kreise gerendert mit Emoji im Kreis und qty-Badge oben rechts wenn Anzahl groesser 1. Tap auf Pflanze oeffnet Detail-Modal mit 10 Eigenschaften aus dem JSON-Schema. Pflanzen-Liste in der Result-Preview ist auch klickbar.',
    items: [
      {emoji:'📐', bold:'gsBuildGardenScanSvg(analysis):', text:' viewBox + preserveAspectRatio xMidYMid meet skaliert proportional auf Container-Breite. Fallback-Groesse aus site_analysis.size_m2 wenn layout_grid fehlt. Pflanzen-Position wird auf Garten-Range geclamped damit Kreise sichtbar bleiben.'},
      {emoji:'🎨', bold:'Farbcodierung nach Kategorie:', text:' Map kategorie zu Hex-Color (Gemuese gruen, Kraeuter dunkelgruen, Obst rot, Beeren pink, Zier violett, Blumen rosa, Baum braun, Gewuerz orange). qty-Badge mit White-Stroke fuer Kontrast.'},
      {emoji:'📋', bold:'gsGardenScanShowPlant(idx) Detail-Modal:', text:' Zeigt 10 Eigenschaften aus dem strukturierten JSON plus Why-here-Reason als gruener Quote-Block. Back-Arrow zurueck zum Plan-Result via gsGardenScanCloseDetail.'},
      {emoji:'⏭️', bold:'Naechste Sub-Tasks:', text:' v25.13 1.4 3D-Three.js-Render. v25.14 1.5 Chat-Iteration via plan-iterate. v25.15 1.6+1.7 Auto-Sync myPlants + PDF-Export.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK · sw.js (gs-v25.12) valid OK · GS_VERSION=v25.12 OK.'},
    ]
  },
  {
    v: 'v25.11', date: '10.05.2026',
    headline: 'KI-Planer Theme 1 Sub-Tasks 1.1+1.2: Multi-Foto-Wizard + Edge-Fn-Integration',
    summary: 'Erster Sub-Task der v25.9-Sprint-Theme-1 Mega-Upgrade-Serie. Cowork hat Sprint A komplett: 3 neue Edge-Functions deployed (garden-scan-analyze, plan-iterate, species-bulk-seed), garden_plans-Tabelle mit RLS, species-Schema mit 17 neuen Spalten (companion_plants, growth_phases, frost_tolerance_c etc.), species-Cloud-DB von 99 auf 2837 Eintraegen gewachsen (28-fache Coverage fuer Knowledge-Search). v25.11 bringt das Frontend dazu: neuer 3-Foto-Wizard parallel zum existing 5-Step gsPP-Planner. User klickt im KI-Planer-Header auf den neuen KI-Scan-Button, sieht ein Modal mit 3 Photo-Slots (Top-Down / Boden-Close-up / Umgebung), kann pro Slot ein Foto waehlen, optional GPS hinzufuegen, und triggert dann gsRunGardenScan() — der ruft die garden-scan-analyze Edge-Fn (60s Timeout, Bearer-Auth, save_as_plan=true). Result: strukturiertes JSON mit site_analysis (Groesse, Boden, Licht, Klimazone, existing plants), recommended_plants (8-15 Pflanzen mit Position-Koordinaten, Companion-Plants, Sow/Harvest-Dates), monthly_calendar, tools_needed, warnings, follow_up_questions. Plan wird in garden_plans persistiert (RLS own-data). Ergebnis-Modal zeigt vorlaeufige Liste + Warnungen + Plan-ID. Sub-Tasks 1.3-1.6 in folgenden v25.x: 2D-SVG-Render aus layout_grid+positions, 3D-Three.js (offline-faehig dank v25.9), Chat-Iteration via plan-iterate, Auto-Sync zu myPlants als status=planned.',
    items: [
      {emoji:'📸', bold:'gsOpenGardenScan + 3-Slot-Wizard:', text:' Modal mit 3 Foto-Slots (Top-Down / Boden / Umgebung), GPS-Optional-Button (auto-vorbefuellt aus gs_user_location), Submit-Button mit Live-Counter. State in window._gsGardenScan = photos+metadata+busy+plan_id+analysis. Foto-Capture via dynamischem File-Input + gsCompressImage Wrapper.'},
      {emoji:'🤖', bold:'gsRunGardenScan(photos, metadata, opts):', text:' Async Wrapper fuer POST garden-scan-analyze Edge-Fn. Bearer-Auth via gs_sb_token, apikey-Header, 60s Timeout via _gsFetch. Body: photos+metadata+save_as_plan+plan_title. Response: ok+analysis+plan_id+tokens+model. Error-Handling mit code+message: not_authenticated / no_photos / network / http_4xx-5xx. Fehler-Toasts bei Submit-Fail.'},
      {emoji:'🎯', bold:'UI-Trigger im KI-Planer-Header:', text:' Neuer KI-Scan-Button neben dem Meine-Plaene-Button (Z.~3176). Linear-Gradient #1b5e20 nach #2e7d32. Setzt _gsGardenScan-State zurueck und oeffnet das Wizard-Modal.'},
      {emoji:'🧠', bold:'Brain-Observe-Hook:', text:' Nach erfolgreichem Scan wird gsBrain.observe(garden_scan_complete, plan_id+plant_count) gerufen — damit Brain die App-Lern-Funktion bedient und Smart-Recommendations darauf bauen kann.'},
      {emoji:'⏭️', bold:'Naechste Sub-Tasks:', text:' v25.12 Sub-Task 1.3 — 2D-SVG-Render aus analysis.layout_grid + recommended_plants[].position (mit viewBox + preserveAspectRatio mobile-responsive). v25.13 Sub-Task 1.4 — 3D-Three.js-Render mit Plane + Cylinder pro Pflanze (Hoehe aus species.mature_height_cm) — offline-faehig dank v25.9 sw.js-Cache. v25.14 Chat-Iteration. v25.15 Auto-Sync myPlants + PDF-Export.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check OK (vor Push verifiziert) · sw.js (gs-v25.11) + manifest.json valid OK · GS_VERSION=v25.11 OK · _headers v25.11 OK · meta app-version=25.11.20260510 OK · Marker im Code: gsOpenGardenScan + gsRunGardenScan + gsGardenScanCapture + gsGardenScanSubmit + gsBuildGardenScanWizard + gsBuildGardenScanResultPreview OK.'},
    ]
  },
  {
    v: 'v25.10', date: '10.05.2026',
    headline: 'Thema 3 PLANT_DB-Restore: Inline-DB raus aus index.html (-2.16 MB / -40%)',
    summary: 'Aus AUFTRAG_v25.9_KI_PLANER_MEGA.md Thema 3. Die in v24.03 nach data/plants.v1.js extrahierte Pflanzen-DB war nach UPDATE.command-Sync wieder als Inline-Block in index.html gelandet (Z.13325-17670, 4341 Einträge). Das bedeutet: data/plants.v1.js existierte zwar, wurde aber nicht geladen — index.html war 2.16 MB größer als nötig, jeder Page-Load lieferte die DB doppelt aus (über Inline + nicht-genutzten externen Cache). v25.10 stellt den v24.03-Zustand wieder her: Inline-DB-Block durch eine Drop-In-Zeile ersetzt (var DB = window.DB || []), data/plants.v1.js wird via script src im head synchron geladen (vor dem Main-Inline-Script, sodass DB-References ab Zeile 1 verfügbar sind). Plus: data/plants.v1.js?v=1 ins Service-Worker SHELL_URLS aufgenommen (Pre-Cache beim SW-Install) — damit die App auch offline mit voller Pflanzen-DB funktioniert. index.html ist jetzt 3.22 MB statt 5.38 MB — 40 Prozent kleiner. Initial-Load wird messbar schneller, plants.v1.js wird via Cloudflare-Pages immutable-Cache nur einmal pro Browser geladen.',
    items: [
      {emoji:'📦', bold:'Inline-DB extrahiert (Z.13325-17670):', text:' 4341 species-Einträge entfernt, durch eine 3-Zeilen-Stub ersetzt — var DB = window.DB || [] referenziert die externe Datei. 100+ DB-References im Code (DB.find, DB.filter, DB.forEach, DB.length etc.) funktionieren unverändert via JavaScript Global-Lookup.'},
      {emoji:'🔌', bold:'data/plants.v1.js synchron geladen:', text:' script src=data/plants.v1.js?v=1 im head, direkt nach Leaflet — synchron damit die DB beim Main-Inline-Script-Start verfügbar ist (data/plants.v1.js macht IIFE mit window.DB = [...]). Cache-Bust-Param ?v=1 für sauberen Initial-Load.'},
      {emoji:'💾', bold:'Service-Worker Pre-Cache:', text:' /data/plants.v1.js?v=1 in SHELL_URLS aufgenommen — damit beim Install der Service-Worker die DB direkt cached und die App auch offline mit voller Pflanzen-DB nutzbar ist. Vorher hätte ein Fresh-Offline-Open keine DB gehabt.'},
      {emoji:'📉', bold:'File-Size-Reduktion:', text:' index.html 5.38 MB → 3.22 MB (-40 Prozent, -2.16 MB). 57157 Zeilen → 52818 Zeilen (-4339 Zeilen). Initial-Load schneller, Cache-Speicher kleiner, Edit-Operationen per Tool weniger token-aufwändig.'},
      {emoji:'⏭️', bold:'Naechste v25.x-Sprint-Tasks:', text:' Thema 1 KI-Planer Mega-Upgrade (3-Foto-Wizard + JSON-Schema + 2D-SVG + 3D-Three.js + Chat-Iteration + Auto-Sync) wartet auf Coworks Backend (garden_plans-Tabelle + species-Schema + garden-scan-analyze Edge-Fn).'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check ✓ · sw.js (gs-v25.10) + manifest.json valid ✓ · data/plants.v1.js valid ✓ · GS_VERSION=v25.10 ✓ · _headers v25.10 ✓ · meta app-version=25.10.20260510 ✓ · Inline-DB-References im Code: 118 (Sanity vorher ~106, plus loader-Methods) ✓.'},
    ]
  },
  {
    v: 'v25.9', date: '10.05.2026',
    headline: '3D-Internet-Fix: Three.js + Leaflet + pdf.js offline-verfügbar (4 „benötigt Internet"-Fallbacks weg)',
    summary: 'Erster Sub-Task aus AUFTRAG_v25.9_KI_PLANER_MEGA.md (Thema 2). Bisher zeigten 4 Stellen einen „benötigt Internet"-Fallback wenn die App offline war oder die externe CDN nicht erreichbar war: Karte (Leaflet, Z.34952), 3D-Track-Wanderung (Three.js, Z.36365), KI-Planer-3D-Render (Three.js, Z.40143), Garten-Detail-3D (Three.js, Z.40695). Root-Cause: Die externen Libs (unpkg.com Leaflet 1.9.4, unpkg.com Three.js r128, cdnjs pdf.js 4.0.379) waren nicht in der Service-Worker-Install-Cache-Liste, sondern nur in IMAGE_HOSTS für Stale-While-Revalidate. Das hieß: erst BEIM Erst-Request gecached, beim nächsten Reload wieder fragil bei flakiger Verbindung. Fix in sw.js Z.21: alle 4 CDN-URLs in SHELL_URLS aufgenommen — Service-Worker fetcht sie beim Install + speichert sie permanent. Bei Cache-Fail per .catch() weitermachen (kein Install-Block). Vorbereitung für Thema 1 v25.9-Sprint: KI-Planer 3D-Render kann jetzt offline rendern.',
    items: [
      {emoji:'🌐', bold:'sw.js SHELL_URLS um 4 CDN-URLs erweitert:', text:' unpkg.com/leaflet@1.9.4/dist/leaflet.css + leaflet.js (für Swisstopo-Karte und Open-Street-Map-Layer), unpkg.com/three@0.128.0/build/three.min.js (für 3D-Render in 3 Modulen), cdnjs.cloudflare.com/.../pdf.js/4.0.379/pdf.min.mjs (für Garten-Plan-PDF-Export). Beim Service-Worker-Install fetcht sw.js alle 20 SHELL_URLS via cache.add() — bei einzelnen Fails wird per .catch() weitergemacht.'},
      {emoji:'🛡️', bold:'CORS-Sicherheit:', text:' Die externen Libs haben crossorigin=anonymous + SRI-Hashes (sha384) im index.html-Tag. cache.add() macht CORS-Request — opaque-Responses werden vermieden, der Cache hat reguläre Response-Objects mit Status 200.'},
      {emoji:'🔄', bold:'Verify-Pfad nach Push:', text:' Nach erstem Online-Visit lädt der Service-Worker v25.9 die Libs in den SHELL_CACHE. Anschließend Flugmodus → App neu öffnen → Karte sollte Swisstopo-Layer zeigen, KI-Planer 3D-View sollte ohne Fallback rendern, 3D-Track-Modal sollte funktionieren. Cowork verifiziert via Chrome-MCP.'},
      {emoji:'⏭️', bold:'Nächste v25.9-Sprint-Tasks:', text:' Thema 1 KI-Planer Mega-Upgrade (3-Foto-Wizard + JSON-Schema + 2D-SVG + 3D-Three.js + Chat-Iteration + Auto-Sync) wartet auf Coworks Backend (garden_plans-Tabelle, species-Schema-Erweiterung, garden-scan-analyze Edge-Fn). Thema 3 species-Frontend-Inline-DB-Extract (Z.13050-16569) mechanisch parallel zu Coworks Bulk-Seed.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check ✓ · sw.js (gs-v25.9) + manifest.json valid ✓ · GS_VERSION=v25.9 ✓ · _headers v25.9 ✓ · meta app-version=25.9.20260510 ✓ · SHELL_URLS-Anzahl: 20 (vorher 16) ✓.'},
    ]
  },
  {
    v: 'v25.7', date: '10.05.2026',
    headline: 'A3: Trial-Modal nach First-Login mit 1-Monat-gratis Plus/Pro — komplettiert v25.4-Sprint',
    summary: 'Letzter Sub-Task aus AUFTRAG_v25.4_AUTH_TRIAL_ABO.md. Komplettiert die v25.4-Auth-Sprint-Serie (A1 Logout-Sofort-Onboarding v25.4 → A2 Login-Welcome-Differential v25.5 → A5 Mein-Abo-Tab v25.6 → A3 Trial-Modal v25.7). Erstregistrierte User bekommen jetzt nach dem ersten Login (Flag gs_first_login aus v25.5) ein Trial-Modal mit 3 klaren Optionen: ⭐ Plus 1-Monat-gratis (danach CHF 3.90/Monat), 💎 Pro 1-Monat-gratis (danach CHF 7.90/Monat), 🌱 Mit Free-Plan starten (5 Scans/Tag). Klick auf Plus/Pro startet sofort gsStartCheckout(plan, false, 30) — der dritte Parameter trial_days wird im Body an Coworks stripe-checkout v5 weitergegeben, das Backend cappt sicher auf max 30 + erste-Sub-Check. Stripe übernimmt: 30 Tage frei, dann automatisch kostenpflichtig — User kann jederzeit über das in v25.6 implementierte „Mein Abo"-Tab kündigen (cancel_at_period_end, behält Premium bis Periodenende). Modal-Verzögerung 1.6s nach Welcome-Toast — User sieht erst „🎉 Willkommen bei GreenScan!", dann erscheint die Plan-Auswahl. Wenn User schon paid plan hat (z.B. Lifetime via separater Pfad), wird stattdessen die gsWelcomeTour gezeigt.',
    items: [
      {emoji:'🌱', bold:'gsShowFirstTrialModal() (Z.~9242):', text:' 3 Plan-Buttons: Plus/Pro Trial mit gsTrialStart(planLookupKey) → closeModal + gsStartCheckout(plan, false, 30). Free-Plan-Button via gsTrialSkip() → closeModal + Toast „🌱 Free-Plan aktiv". Header-Gradient #1b5e20→#2e7d32→#43a047 + 48px Sprout-Emoji.'},
      {emoji:'💳', bold:'gsStartCheckout(plan, claimLaunchOffer, trialDays):', text:' Dritter optionaler Parameter — wenn > 0, wird trial_days im JSON-Body an stripe-checkout Edge-Fn übergeben. Backend (Cowork v5) hat trial_days-Support, cappt auf max 30 + first-sub-only. Bei trialDays=null/0/undefined wird kein trial_days gesendet → Standard-Subscription ohne Trial.'},
      {emoji:'🚀', bold:'First-Login-Branch in onbDoLogin (Z.~50356):', text:' Nach gs_first_login-Flag-Konsum + Welcome-Toast, setTimeout 1.6s: prüft localStorage.gs_abo_plan. Wenn "free" → gsShowFirstTrialModal(). Sonst → gsWelcomeTour.start() falls vorhanden. Verzögerung damit Toast vorher gesehen wird.'},
      {emoji:'✅', bold:'v25.4-Sprint komplett:', text:' A1 (v25.4 c47988e) Logout zeigt onb-start. A2 (v25.5 68d4ced) Welcome-Differential mit gs_first_login. A5 (v25.6 e7ee72f) Mein-Abo-Tab mit gsLoadSubInfo/gsRenderSubInfo + Cancel/Reactivate. A3 (v25.7 jetzt) Trial-Modal mit gsStartCheckout(trial_days:30). 4 Mini-Commits, jeder einzeln gepusht. Cowork verifiziert Test-Card-Flow + DB.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check ✓ · sw.js (gs-v25.7) + manifest.json valid ✓ · GS_VERSION=v25.7 ✓ · _headers v25.7 ✓ · meta app-version=25.7.20260510 ✓ · "v25.7 A3"-Marker: 3 (gsStartCheckout-trialDays + gsShowFirstTrialModal + onbDoLogin-Branch) ✓.'},
    ]
  },
  {
    v: 'v25.6', date: '10.05.2026',
    headline: 'A5: „Mein Abo"-Tab mit Restlaufzeit, Status, Cancel/Reactivate via Stripe-Portal',
    summary: 'Dritter Sub-Task aus AUFTRAG_v25.4_AUTH_TRIAL_ABO.md. Bisher zeigte das Abo-Modal nur die Plan-Auswahl-Karten — User mit aktivem Plus/Pro-Abo sah keine Restlaufzeit, kein Status (Trial vs Active vs Cancelled), keinen direkten Cancel-Button. Neue Sub-Info-Card am Modal-Anfang zeigt jetzt: Plan-Name, color-coded Status-Badge (🏆 Lifetime, 🆓 Trial, ✅ Active, 🟡 Gekündigt, ⚠️ Past-Due 7-Tage-Grace), verbleibende Tage bis zur nächsten Abrechnung, Preis pro Periode mit „nach Trial"-Hint wenn Status=trialing. Action-Buttons je nach Status: bei aktiv → Stripe-Portal + Kündigen-Button; bei gekündigt → Reactivate-Button (nimmt cancel_at_period_end zurück); bei Lifetime → Hinweis „Einmalzahlung". Daten kommen aus stripe_subscriptions inkl. JOIN auf stripe_prices (unit_amount/currency/recurring/lookup_key). Cancel-Flow nutzt gsConfirmModal für Bestätigung, dann öffnet sich Stripe-Portal mit flow=cancel — Cowork muss den flow-Parameter in stripe-portal v2 unterstützen (Briefing erwähnt subscription_cancel.mode=at_period_end Konfiguration).',
    items: [
      {emoji:'📋', bold:'gsLoadSubInfo() (Z.~9135):', text:' GET stripe_subscriptions?user_id=eq.<uid>&select=*,stripe_prices(unit_amount,currency,recurring,metadata,lookup_key)&order=created_at.desc&limit=1. Liefert die jüngste Sub mit eingebetteten Price-Details. encodeURIComponent für UID.'},
      {emoji:'🎴', bold:'gsRenderSubInfo(sub) — color-coded Card:', text:' 5 Status-Varianten mit eigenen Accent-Farben (#2e7d32 Lifetime, #f57c00 Cancelled, #d32f2f Past-Due, #1a237e Trial, #1b5e20 Active). Restlaufzeit-Anzeige (Math.ceil((endDate-now)/86400000)) mit „bis <Datum>". Preis-Zeile mit interval-Label (Monat/Jahr) + „nach Trial"-Hint.'},
      {emoji:'⚠️', bold:'gsConfirmCancelSub() + gsUncancelSub():', text:' Cancel via gsConfirmModal-Dialog (kind:warn, Hinweis dass User bis Periodenende Premium behält), dann gsOpenBillingPortal(\'cancel\'). Reactivate direkt via gsOpenBillingPortal(\'reactivate\').'},
      {emoji:'🔄', bold:'gsOpenBillingPortal(flow) erweitert:', text:' Optionaler flow-Parameter (\'cancel\'|\'reactivate\') wird via JSON-Body an stripe-portal Edge-Fn weitergegeben. Backend kann via flow_data einen direkten Cancel-/Reactivate-Flow erzeugen. Wenn Backend nicht supportet: Standard-Portal als Fallback (kein Fehler).'},
      {emoji:'⏭️', bold:'Nächster Sub-Task A3 (v25.7):', text:' Trial-Modal nach Email-Confirm + gsStartCheckout(trial_days:30) für First-Subscription. Cowork hat stripe-checkout v5 mit trial_days-Support deployed.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check ✓ · sw.js (gs-v25.6) + manifest.json valid ✓ · GS_VERSION=v25.6 ✓ · _headers v25.6 ✓ · meta app-version=25.6.20260510 ✓ · "v25.6 A5"-Marker: 4 (Portal-Flow + LoadSub + RenderSub-Host + RenderSub-Logic) ✓.'},
    ]
  },
  {
    v: 'v25.5', date: '10.05.2026',
    headline: 'A2: Login-Welcome-Differential — First-Login zeigt Tour, Re-Login zeigt „Willkommen zurück, <Name>!"',
    summary: 'Zweiter Sub-Task aus AUFTRAG_v25.4_AUTH_TRIAL_ABO.md. Bisheriges Verhalten: jeder Login zeigte das gleiche „Willkommen zurück!"-Toast — egal ob Erstregistrierung oder normaler Re-Login. Plus: in manchen Konstellationen (z.B. Welcome-Modal aus v24.09 gsWelcomeTour) wurde nach Login fälschlich ein „Account erstellen"-Step angezeigt. Fix: bei erfolgreicher onbDoRegister wird gs_first_login=\'1\' im gsStore gesetzt (beide Pfade — auto-confirm und email-confirm-pending). onbDoLogin prüft beim erfolgreichen Login das Flag: wenn da, wird der Welcome-Pfad triggered (gsWelcomeTour aus v24.09 wenn verfügbar, sonst „🎉 Willkommen bei GreenScan!"-Toast) und das Flag wieder entfernt — beim nächsten Login zeigt sich dann der Re-Login-Pfad mit „🌿 Willkommen zurück, <Name>!" inkl. Display-Name aus gs_profile_name oder Email-Prefix.',
    items: [
      {emoji:'🎉', bold:'onbDoRegister setzt First-Login-Flag (Z.~50300):', text:' gsStore.set(\'gs_first_login\', \'1\') in beiden Erfolgs-Pfaden (auto-confirm mit access_token sofort + email-confirm-pending). Damit ist der State für den nächsten Login persistiert.'},
      {emoji:'🌿', bold:'onbDoLogin Differential (Z.~50343):', text:' Nach gsResetLoginAttempts() + gsOnLoginSuccess() + sbLoadProfile() + updateMenuProfileBar() + gsOnboardingHide() prüft die Logik gsStore.get(\'gs_first_login\'). True → Flag entfernen + gsWelcomeTour.start() oder „🎉"-Toast. False → „🌿 Willkommen zurück, <Name>!" mit Name aus localStorage.gs_profile_name oder Email-Prefix.'},
      {emoji:'⏭️', bold:'Nächste Sub-Tasks:', text:' A5 (v25.6) „Mein Abo"-Tab mit gsLoadSubInfo/gsRenderSubInfo + Cancel/Reactivate via gsOpenBillingPortal. A3 (v25.7) Trial-Modal nach ?email_confirmed=1 + gsStartCheckout(trial_days:30) — Cowork hat stripe-checkout v5 mit trial_days-Support deployed.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check ✓ · sw.js (gs-v25.5) + manifest.json valid ✓ · GS_VERSION=v25.5 ✓ · _headers v25.5 ✓ · meta app-version=25.5.20260510 ✓ · "v25.5 A2"-Marker: 2 (Register-Set + Login-Differential) ✓.'},
    ]
  },
  {
    v: 'v25.4', date: '10.05.2026',
    headline: 'A1: Logout zeigt sofort Anmelde-Screen statt auf letzter Seite zu hängen',
    summary: 'Erster Sub-Task aus AUFTRAG_v25.4_AUTH_TRIAL_ABO.md. Symptom: nach Klick auf Logout-Button blieb der User auf seiner aktuellen Tab-Seite (z.B. Settings, Garten, Marktplatz) — Token wurde clear, Cloud-Daten wurden weg, aber das UI sah aus wie vorher und der Anmelde-Screen kam erst beim nächsten App-Reload. Verwirrend für User. Fix: sbLogout() macht nach sbClearSession() und gsOnLogout() jetzt explizit den Onboarding-Wrapper visible (display:flex, opacity:1), ruft _onbShowView("onb-start") für den sauberen Start-Screen mit Anmelden/Registrieren/Gast-Buttons, schließt alle offenen .modal-overlay-Layer und zeigt einen Toast „👋 Erfolgreich abgemeldet". Komplettiert die v25.0/v25.1 Auth-Fixes (Login → Home, Logout → onb-start). Sub-Tasks A2/A5/A3 folgen in v25.5/v25.6/v25.7.',
    items: [
      {emoji:'👋', bold:'sbLogout() Sofort-Onboarding (~Z.47361):', text:' Nach sbClearSession() + gsOnLogout()-Aufruf wird gs-onboarding-Wrapper auf display:flex/opacity:1 gesetzt, _onbShowView("onb-start") zeigt den Start-Screen, alle .modal-overlay-Elemente werden geschlossen. Toast „👋 Erfolgreich abgemeldet" als Bestätigung.'},
      {emoji:'🔗', bold:'Komplettiert Auth-Flow:', text:' v25.0/v25.1 fixed Login→Home (Sub-View-Reset in gsOnboardingHide + Idempotent-Guard in gsCheckOnboarding). v25.4 fixed Logout→onb-start. Damit ist der Auth-State-Übergang in beide Richtungen sauber.'},
      {emoji:'⏭️', bold:'Nächste Sub-Tasks:', text:' A2 (v25.5) Login-Welcome-Differential — Welcome-Modal nur nach Erstregistrierung, sonst Toast. A5 (v25.6) „Mein Abo"-Tab mit Restlaufzeit/Cancel/Reactivate via stripe-portal. A3 (v25.7) Trial-Modal nach Email-Confirm + gsStartCheckout(trial_days:30) für First-Subscription. Cowork hat stripe-checkout v5 mit trial_days deployed.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check ✓ · sw.js (gs-v25.4) + manifest.json valid ✓ · GS_VERSION=v25.4 ✓ · _headers v25.4 ✓ · meta app-version=25.4.20260510 ✓ · "v25.4 A1"-Marker: 1 ✓.'},
    ]
  },
  {
    v: 'v25.3', date: '10.05.2026',
    headline: 'Bug #4 Marktplatz-Audit: 3 P0-Bugs dokumentiert + Sicherheits-Restore mktLike/mktDelete',
    summary: 'Code-Audit der Marktplatz-Funktionen aus AUDIT_v25_BUG_BRIEFINGS.md Bug #4. Drei kritische Befunde dokumentiert in MARKETPLACE_AUDIT.md: (M1) saveListing() schreibt nur localStorage und macht KEINEN POST in marketplace_listings — User-Listings sind unsichtbar für andere User, „Veröffentlicht"-Toast lügt. (M2) Schema-Mismatch zwischen Frontend (desc/cat/images/createdAt/sellerId/...) und Backend (description/category/photo_url/created_at/user_id/...). (M3) Photos werden als komprimierte Base64-Arrays im Listing-JSON gespeichert statt im 2026-05-09 von Cowork angelegten marketplace-photos Storage-Bucket — bläht localStorage auf, würde Backend-INSERT zusätzlich brechen. Plus zwei mittlere Schwächen (M4 encodeURIComponent fehlte / M5 sellerId-aus-localStorage). M4 wird sofort gefixt: mktLike/mktDelete bekommen encodeURIComponent zurück (war in v24.13 schon mal drin, durch UPDATE.command-Sync bae5750 verloren). M1-M3-M5 brauchen Cowork-Coordination und folgen in v25.4-v25.6.',
    items: [
      {emoji:'🔍', bold:'MARKETPLACE_AUDIT.md angelegt:', text:' Komplettes Bug-Inventar mit Code-Pfaden (saveListing Z.18084, mktLike Z.9293, mktDelete Z.9317, loadMarketFromSupabase Z.9485, gsMarketLoad/Save/User Z.17699-17729, Filter-Funktionen Z.17883-17919). Schema-Mapping-Tabelle Frontend↔Backend. Fix-Vorschläge mit konkretem JS-Code. E2E-Test-Plan für Cowork-Chrome-MCP.'},
      {emoji:'🛡️', bold:'M4 Sicherheits-Restore (sofort gefixt):', text:' mktLike Z.9310 + mktDelete Z.9328 bekommen wieder encodeURIComponent(id) im URL-Path. War in v24.13 als Concat-Injection-Vuln (G2 HIGH) gefixt, ging mit UPDATE.command-Sync verloren. Jetzt wieder drin.'},
      {emoji:'⏭️', bold:'M1-M3-M5 für v25.4-v25.6:', text:' M1 saveListing() POST-Call (2-3h, braucht ID-Migration-Doppel-Tracking), M2 Schema-Adapter-Funktionen (1-2h), M3 Storage-Upload via marketplace-photos Bucket (2h, Cowork hat Bucket bereit), M5 user_id aus auth.uid() (1h). Vor v25.4 sollte Cowork ein Test-Listing per SQL anlegen damit Display-Path verifiziert werden kann.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check ✓ · sw.js (gs-v25.3) + manifest.json valid ✓ · GS_VERSION=v25.3 ✓ · _headers v25.3 ✓ · meta app-version=25.3.20260510 ✓ · encodeURIComponent in marketplace_listings-Calls: 2 (mktLike + mktDelete) ✓.'},
    ]
  },
  {
    v: 'v25.2', date: '09.05.2026',
    headline: 'Bug #2 Stripe-Billing-Return-Handler — Frontend-Polish komplettiert Coworks stripe-checkout v4',
    summary: 'Cowork hat das Stripe-Backend autonom auf v4 deployed (Schema-Fix für interval/is_launch_offer + green-scan.ch URL-Fix). Backend setzt jetzt success_url=green-scan.ch/?billing=success und cancel_url=green-scan.ch/?billing=cancel. Frontend-Polish in v25.2: gsHandleAuthRedirect erkennt diese Top-Level-Returns (NICHT Popup-Mode, der wird via postMessage in Z.9187 gehandelt), zeigt eine passende Toast-Message und ruft bei success/return gsRestorePurchases() um die Entitlements server-seitig zu pullen. URL wird via history.replaceState aufgeräumt damit ein Reload den Toast nicht erneut triggert. Damit ist der Stripe-Card-Flow End-to-End funktional — Cowork verifiziert via WebFetch nach Push.',
    items: [
      {emoji:'💳', bold:'Billing-Return-Handler in gsHandleAuthRedirect:', text:' ?billing=success → Toast „Zahlung erfolgreich" + gsRestorePurchases() · ?billing=cancel → Toast „Zahlung abgebrochen" · ?billing=return → silent Entitlements-Refresh (Portal-Return). URL clean via history.replaceState. Popup-Mode-Pfad (?popup=1) wird explizit übersprungen — der wird bereits via window.opener.postMessage gehandelt.'},
      {emoji:'🔗', bold:'Komplementär zu Coworks Backend:', text:' stripe-checkout v4 (Schema-Fix interval/is_launch_offer aus metadata + green-scan.ch URL-Default). Plus stripe-bootstrap v4 (metadata.lookup_key). Marketplace-RLS-INSERT-Policy + Storage-Buckets garden-scans/marketplace-photos + user_gardens.scan_history-Schema-Migration.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check ✓ · sw.js (gs-v25.2) + manifest.json valid ✓ · GS_VERSION=v25.2 ✓ · _headers v25.2 ✓ · meta app-version=25.2.20260509 ✓ · "v25.2 Bug #2: Stripe-Billing-Return"-Marker: 1 ✓. Cowork-Live-Verify nach Push: Test-Card 4242 4242 4242 4242 → Plus-Plan kaufen → Toast erscheint, Plan ist aktiv.'},
    ]
  },
  {
    v: 'v25.1', date: '09.05.2026',
    headline: 'Bug #1 Scanner-Upload (Datei-Picker statt Forced-Camera) + Auth-Fix-Restore (war von UPDATE.command-Sync überschrieben)',
    summary: 'Erster v25.x-Mini-Commit nach Cowork-Audit (AUDIT_v25_BUG_BRIEFINGS.md). Zwei P0-Fixes in einem Commit weil der UPDATE.command-Sync vom 2026-05-09 (bae5750) den v25.0-Auth-Fix-Code aus dem Working-Tree entfernt hatte (Commit a8be650 ist in git history erhalten, aber Funktionen wurden auf v24.51-State zurückgerollt). Ergänzend: Bug #1 aus dem Audit-Briefing — Scanner-„Hochladen"-Button öffnete bisher direkt die Kamera statt einen Datei-Picker. Root-Cause: file-input Z.1974 hatte capture="environment" — iOS Safari + Android Chrome interpretieren das als Camera-only und überspringen das Action-Sheet. Fix entfernt das Attribut, damit User Aufnahme/Galerie/Dateien wählen kann (Anderer Code in der App macht es bereits richtig mit getrennten inline-camera-input + inline-gallery-input).',
    items: [
      {emoji:'📤', bold:'Bug #1 Scanner-Upload (1 Edit, 5 Min):', text:' Z.1974 file-input capture="environment" entfernt. Effekt: iOS Safari öffnet Action-Sheet (Foto aufnehmen / Foto wählen / Aus Dateien), Android Chrome öffnet Datei-Picker, Desktop öffnet Datei-Picker. Verhalten konsistent mit den getrennten inline-camera-input/inline-gallery-input.'},
      {emoji:'🔓', bold:'Auth-Fix-Restore (gsOnboardingHide + gsCheckOnboarding):', text:' v25.0-Code war im Working-Tree weg nach UPDATE.command-Sync. Jetzt wieder drin: gsOnboardingHide() resetet Sub-Views (onb-start sichtbar, onb-register/onb-login hidden) + leert 5 Auth-Inputs. gsCheckOnboarding() Idempotent-Guard (return early wenn sbIsLoggedIn() && Wrapper.style.display === "none").'},
      {emoji:'⚠️', bold:'Sync-Problem dokumentiert:', text:' UPDATE.command bae5750 hat 4 lokale Commits (v24.52 Welle 2, v24.53 Welle 3, v24.54 Z-Index Phase 2, v25.0 Auth-Fix) im Working-Tree neutralisiert — Commits sind in git log noch da. Konsequenz: gsStore-Welle 2/3 (74+45 Calls) sind aktuell NICHT im Working-Tree, ebenso Z-Index Phase 2 (12 Sites). Restore dieser Migrationen ist offen — kommt in folgenden v25.x-Sprints zurück.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check ✓ · sw.js (gs-v25.1) + manifest.json valid ✓ · GS_VERSION=v25.1 ✓ · _headers v25.1 ✓ · meta app-version=25.1.20260509 ✓ · "v25.0/v25.1 Auth-Bug-Fix"-Marker: 2 (Fix 1 + Fix 2) ✓ · "v25.1: capture"-Marker: 1 ✓.'},
    ]
  },
  {
    v: 'v24.51', date: '04.05.2026',
    headline: 'gsStore-Migration Auth-Triple: 101 localStorage-Calls quota-safe (gs_sb_uid 51× · gs_sb_email 31× · gs_sb_token 19×)',
    summary: 'v24.51 schließt das P0-Item aus dem Pre-Release-Backlog: alle 101 direkten localStorage-Calls für die Auth-Triple (User-UUID, E-Mail, JWT-Token) wandern auf den in v24.48 eingeführten gsStore-Wrapper. Damit ist das kritischste Quota-Risiko entschärft — ein QuotaExceededError beim Schreiben von Pflanzen/Tagebuch/Tracks führt jetzt nicht mehr dazu, dass der User beim nächsten Boot auf einer scheinbar leeren App landet (alter Pfad: localStorage.setItem throws → Auth-Token nicht persistiert → Re-Boot ohne Login). Der gsStore-Wrapper schluckt Quota-Fehler still und zählt sie in window.gsStoreQuotaHits — sichtbar in der Admin-Storage-Diagnostics-Card aus v24.49. Verbleibend für v24.52+: 695 weitere localStorage-Calls (vorher 794), davon Top-Kandidaten gs_gpx_tracks 13×, gs_garden_plans 12×, gs_admin 12×, gs_global_api_key 10×.',
    items: [
      {emoji:'🔐', bold:'Auth-Triple migriert (101 Calls):', text:' gs_sb_uid 51× (User-UUID) + gs_sb_email 31× (User-Email) + gs_sb_token 19× (JWT) — alle localStorage.getItem/setItem/removeItem auf gsStore.get/set/remove umgestellt. Verhalten 1:1 (gsStore.get gibt bei Missing den 2. Parameter zurück, sonst identisch zu localStorage.getItem).'},
      {emoji:'🛡️', bold:'Quota-safe Auth:', text:' Bei QuotaExceededError (Code 22, 1014, NS_ERROR_DOM_QUOTA_REACHED) oder Safari-Private-Mode wirft die Auth-Persistenz keinen Fehler mehr — Caller bekommt false (für set) oder null (für get). Damit ist das Logout-Risiko bei vollem Storage neutralisiert. window.gsStoreQuotaHits zählt die Events für Admin-Diagnostics.'},
      {emoji:'📉', bold:'localStorage-Bilanz:', text:' Direkte localStorage-Calls: 794 → 695 (-13%). gsStore-Calls: 0 → 101. Restliche Hot-Paths für v24.52+: gs_gpx_tracks 13×, gs_garden_plans 12×, gs_admin 12×, gs_global_api_key 10×, gs_user_location 9×, gs_quiz_streak 9×, gs_gartentagebuch 9×.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check ✓ · sw.js (gs-v24.51) + manifest.json valid ✓ · GS_VERSION=v24.51 ✓ · _headers v24.51 ✓ · meta app-version=24.51.20260504 ✓ · Auth-Triple localStorage-Calls verbleibend: 0 ✓ · Auth-Triple gsStore-Calls: 101 ✓.'},
    ]
  },
  {
    v: 'v24.50', date: '30.04.2026',
    headline: 'Pre-Release Pass 11: Z-Index-Token-Migration (12 Sites) · neuer --z-image-overlay · maxlength auf 14 Auth/Profile-Inputs',
    summary: 'Pass 11 räumt zwei OFFEN-Items aus dem 2-Wochen-Release-Backlog auf. Erstens: 12 inline-cssText-Sites (Lightbox-Overlays, Confirm-Modals, Light-Meter, Scan-History, Frost-Banner) mit hardcoded z-index:99999/9999/5000/4000 wandern auf die in v24.48 definierten Tokens. Neuer Token --z-image-overlay (99999) für Lightbox-/Photo-Fullscreen-Layer, der semantisch über Toasts liegt. Hardcoded-Sites: 94 → 82, Token-Sites: 8 → 20. Stack-Konflikte zwischen Image-Lightbox, Confirm-Modal und Toast-Snackbar jetzt deklarativ. Zweitens: 14 maxlength-Attribute auf Auth/Profile/Admin-Inputs gesetzt — E-Mail (254 nach RFC 5321), Passwort (128), API-Key (200/300). Schützt vor versehentlichen Mega-Pastes, XSS-Payload-Bombs und Storage-Quota-Hits. Vier API-Key-Inputs bekommen zusätzlich autocomplete=off.',
    items: [
      {emoji:'🎚️', bold:'Z-Index-Token-Migration (12 Sites):', text:' Image-Lightbox 4× (Z.8876/11339/20619/42063 z:99999 → var(--z-image-overlay,99999)), Pflicht-/Confirm-Modals 2× (Z.49687/49799 z:99999), Auth-/Backup-/Stripe-Modals 3× (Z.20224/43741/49621 z:9999 → var(--z-toast,9999)), Frost-Banner Z.12873 + Light-Meter Z.54950 (z:5000 → var(--z-modal-top,5000)), Scan-History Z.54660 (z:4000 → var(--z-modal,4000)). Hardcoded z-index: 94 → 82. Token-Sites: 8 → 20.'},
      {emoji:'🆕', bold:'Neuer Token --z-image-overlay (99999):', text:' Semantische Stacking-Layer für Lightbox/Photo-Fullscreen — liegt über --z-toast (9999), unter --z-debug (999999). Damit haben alle existierenden Layers (Base/Sticky/Dropdown/Overlay/Modal/Modal-Top/Toast/Image-Overlay/Debug) ihre eigene CSS-Custom-Property. Single-Source-of-Truth für Stack-Konflikte.'},
      {emoji:'🔒', bold:'maxlength auf 14 Inputs:', text:' Onboarding (onb-reg-email/onb-reg-pw/onb-login-email/onb-login-pw), Profile-Setup (prof-email/prof-email2/prof-pw/prof-pw2/prof-pw2b), Passwort-Ändern (pw-current/pw-new1/pw-new2), API-Keys (apikey-input 200, admin-sb-key-input 300, admin-global-api-input 300, gs-gk-input 300). Email-Maxlength 254 entspricht RFC 5321, Passwort 128 ist Bcrypt-Limit. API-Key-Inputs zusätzlich autocomplete=off. Schützt Storage-Quota und verhindert versehentliche 1-MB-Pastes.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check ✓ · sw.js (gs-v24.50) + manifest.json valid ✓ · GS_VERSION=v24.50 ✓ · _headers v24.50 ✓ · maxlength-Sites: 25 (vorher 11) · Z-Index-Token-Sites: 20 (vorher 8) · hardcoded z-index: 82 (vorher 94).'},
    ]
  },
  {
    v: 'v24.49', date: '30.04.2026',
    headline: 'Pre-Release Pass 10: 5 setInterval-Handles · Z-Index-Token-Migration · Storage-Diagnostics im Admin',
    summary: 'Pass 10 schließt drei OFFEN-Items aus dem 2-Wochen-Release-Backlog. Erstens: die 5 verbleibenden ungeschützten setInterval-Aufrufe (Home-Wetter-Refresh 2h, Outbid-Notif 30s, Farm-Tick 30s, SW-Auto-Update 60min, Badge-Refresh 12s) speichern jetzt ihre Handles in Window-Globals und sind idempotent — Re-Inits nach Login/Logout-Cycles oder Tab-Switch verlieren keine Timer mehr im Hintergrund. Zweitens: Z-Index-Token-Migration der Top-Konflikt-Kandidaten (Bottom-Nav .tabs, .modal-overlay, .overlay-modal, .gs-toast-Klasse, gs-offline-Banner, SW-Update-Banner, Conn-Banner) auf die in v24.48 definierten Tokens — Stack-Konflikte zwischen Toasts/Modals/Bannern jetzt deklarativ statt hardcoded. Drittens: Admin-Panel zeigt eine Storage-Diagnostics-Card mit gsStore-Verfügbarkeit, Verbrauch in KB und Quota-Hits-Counter (color-coded) — Debug-Visibility für die geplante Migration der 868 direkten localStorage-Calls.',
    items: [
      {emoji:'⏱️', bold:'5× setInterval-Handles:', text:' loadHomeWeather (2h, Z.13001 → window._gsHomeWeatherInterval), checkOutbidNotifs (30s, Z.27543 → _gsOutbidInterval), refreshFarmTick (30s, Z.44509 → _gsFarmTickInterval), reg.update SW-Auto-Update (60min, Z.47791 → _gsSwUpdateInterval), gsBadgeRefresh (12s, Z.48119 → _gsBadgeRefreshInterval). Alle Calls bekommen jetzt das Idempotenz-Pattern: vor setInterval wird ein vorhandenes Handle gecleart. Damit ist die OFFEN-Liste der ungeschützten Timer komplett abgearbeitet (Pass 9 hat schon 4 weitere fixed).'},
      {emoji:'🎚️', bold:'Z-Index-Token-Migration (7 Sites):', text:' .tabs (Bottom-Nav) z:1500 → var(--z-overlay) · .modal-overlay z:2000 → var(--z-modal) · .overlay-modal z:2400 → var(--z-modal-top) · .gs-toast Class z:9999 → var(--z-toast) · #gs-offline-banner inline z:9999 → var(--z-toast,9999) · SW-Update-Banner z:9100 → var(--z-toast,9999) · Conn-Banner z:9050 → calc(var(--z-toast,9999) - 949). Stack-Layers jetzt deklarativ — Toasts liegen über Modals, Update-Banner über Toasts, Bottom-Nav unter Modals. Single-Source-of-Truth für Stacking-Konflikte.'},
      {emoji:'🩺', bold:'Storage-Diagnostics im Admin-Panel:', text:' Neue Card unter dem User-Listing zeigt localStorage-Verfügbarkeit (✅/❌), Verbrauch (window.gsStore.usageBytes() in KB) und Quota-Hits-Counter (window.gsStoreQuotaHits, color-coded grün/orange/rot). Damit kann jeder Admin im laufenden Betrieb sehen ob Quota-Probleme auftreten — Debug-Visibility für die schrittweise Migration der 868 direkten localStorage-Calls.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check ✓ · sw.js (gs-v24.49) + manifest.json valid ✓ · GS_VERSION=v24.49 ✓ · _headers v24.49 ✓ · setInterval ohne Handle (Code-Pfad): 0 ✓ · Z-Index-Token-Sites: 8 (vorher 1) ✓.'},
    ]
  },
  {
    v: 'v24.48', date: '30.04.2026',
    headline: 'Pre-Release Pass 9: gsStore-Wrapper · Z-Index-Token-System · setInterval-Handles',
    summary: 'Pass 9 schließt drei OFFEN-Items aus dem 2-Wochen-Release-Backlog. Erstens: 4 ungeschützte setInterval-Aufrufe (Daily-Quiz-Refresh, Engagement-Tracker, Sync-Dirty-Flush, Garten-Sync-Queue) bekommen jetzt Window-Handles, sind also stoppbar via clearInterval und überschreiben sich nicht mehr selbst bei Re-Init. Zweitens: window.gsStore als sicherer localStorage-Wrapper mit try/catch + JSON-Helpers + Quota-Detection — Foundation für die inkrementelle Migration der 868 direkten localStorage-Calls und Schutz gegen Safari-Private-Mode + QuotaExceededError. Drittens: 7 semantische CSS-Z-Index-Tokens (--z-base/--z-sticky/--z-dropdown/--z-overlay/--z-modal/--z-modal-top/--z-toast/--z-debug) als Single-Source-of-Truth für die 60 vorher hardcodierten Werte.',
    items: [
      {emoji:'⏱️', bold:'4× setInterval-Handles:', text:' Daily-Quiz-Refresh-Timer (60s, Z.12395), Engagement-Tracker (1s, Z.46562), Sync-Dirty-Flush (30s, Z.50745) und Garten-Sync-Queue (30s, Z.55524) speichern ihre Handles jetzt in window._gsDqRefreshInterval / _gsEngagementInterval / _gsSyncDirtyInterval / _gsGartenSyncInterval. Vor jedem setInterval wird ein vorhandenes Handle gecleart — Re-Inits (z.B. nach Login/Logout-Cycles) verlieren keine Timer mehr im Hintergrund. Akku-/Memory-Polish vor Release.'},
      {emoji:'🗄️', bold:'gsStore-Wrapper:', text:' window.gsStore.{get(k,d), set(k,v), remove(k), getJSON(k,d), setJSON(k,o), available(), usageBytes()} mit try/catch um jeden Call. Schützt gegen Safari-Private-Mode (localStorage.setItem throws) und QuotaExceededError (NS_ERROR_DOM_QUOTA_REACHED, code 22/1014) — Caller bekommen Default-Wert oder false statt App-Crash. Quota-Hits werden in window.gsStoreQuotaHits gezählt für Debug. Foundation für inkrementelle Migration der 868 direkten localStorage-Calls.'},
      {emoji:'🎚️', bold:'Z-Index-Token-System:', text:' 7 semantische CSS-Custom-Properties im :root: --z-base (1, Standard-UI), --z-sticky (100, Sticky-Header/Filter), --z-dropdown (500, Tooltips/Popover), --z-overlay (1500, Onboarding/Bottom-Nav), --z-modal (4000, Standard-Dialog), --z-modal-top (5000, Confirm/Auth-Pflicht), --z-toast (9999, Snackbar), --z-debug (999999, Dev-Overlay). Migration alter 60 hardcoded-Werte schrittweise — neue Komponenten verwenden Tokens.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check ✓ · sw.js (gs-v24.48) + manifest.json valid ✓ · GS_VERSION=v24.48 ✓ · _headers v24.48 ✓ · 4× setInterval ohne Handle: 0 (in OFFEN-Liste) · gsStore-Methoden: 7 ✓ · Z-Index-Tokens: 8 ✓.'},
    ]
  },
  {
    v: 'v24.47', date: '30.04.2026',
    headline: 'Pre-Release Pass 8: External-API _gsFetch · Three.js SRI (unpkg) · gsLog · CSP-Hosts',
    summary: 'Pass 8 schließt drei OFFEN-Items aus dem 2-Wochen-Release-Backlog. Erstens: alle externen API-Fetches (OpenMeteo, OpenMeteo-Geocoding, Nominatim, IPApi, Wikipedia, Anthropic-Health-Walker, Storage-Image-Upload, Google-Connectivity-Sentinel) gehen jetzt durch _gsFetch mit AbortController-Timeouts (5–60s je nach Größe) — auf flakigem WLAN/4G bekommt der Anwender klare Timeout-Fehler statt minutenlangem Spinner. Zweitens: Three.js wechselt von cdnjs r128 auf unpkg three@0.128.0 mit SRI-Hash (npm-Tarball verifiziert) — Supply-Chain-Schutz für die letzte CDN-Quelle. Drittens: gsLog/gsWarn als semantische Dev-Logger (Production-Console-Shim ist weiterhin aktiv).',
    items: [
      {emoji:'⏱️', bold:'External-API _gsFetch-Migration:', text:' OpenMeteo Forecast 2× (Home-Wetter 12s · Garten-Wetter 15s) · OpenMeteo Geocoding 3× (10s) · Nominatim Reverse + Search 3× (10s) · IPApi (8s) · Wikipedia Summary (8s) · Anthropic Health-Walker (15s) · Storage-Image-Upload (60s) · Google-Connectivity (5s) · Wetter-Frühwarnung Open-Meteo (12s) · Home-Weather-Daily (15s). Alle Caller bekommen klaren TIMEOUT-Fehler statt silent-freeze. Verbleibend bare: nur ./manifest.json (lokal) und sendBeacon-keepalive-Pfad (intentional).'},
      {emoji:'🔐', bold:'Three.js SRI verifiziert:', text:' Wechsel von cdnjs.cloudflare.com/r128 auf unpkg.com/three@0.128.0/build/three.min.js mit integrity=sha384-CI3ELBVUz9XQO+97x6nwMDPosPR5XvsxW2ua7N1Xeygeh1IxtgqtCkGfQY9WWdHu (verifiziert via npm pack three@0.128.0 + openssl dgst -sha384). crossorigin=anonymous. Damit ist die letzte ungeschützte CDN-Quelle gegen Supply-Chain-Angriffe abgesichert (parallel zu Leaflet 1.9.4 + pdf.js 4.0.379 aus Pass 5).'},
      {emoji:'🧰', bold:'gsLog/gsWarn:', text:' Semantische Dev-Logger (window.gsLog, window.gsWarn) — explizit __DEV__-gated und in Production garantiert no-op. Ergänzt den Production-Console-Shim, der bereits console.log/info/debug noop\'t. Code-Lesbarkeit: gsLog() im Code dokumentiert „dieser Log ist dev-only" für künftige Refactors.'},
      {emoji:'🛡️', bold:'CSP-Hosts erweitert:', text:' connect-src bekommt geocoding-api.open-meteo.com, en.wikipedia.org, ipapi.co, www.google.com — damit die externen API-Calls auch unter strikter CSP funktionieren. _headers-Datei auf v24.47 gebumpt.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check ✓ · sw.js (gs-v24.47) + manifest.json valid ✓ · GS_VERSION=v24.47 ✓ · bare fetch im Code-Pfad: 5 (Stripe-Wrap, _gsApiFetch-intern, _gsFetch-intern, ./manifest.json lokal, sendBeacon-keepalive) · _gsFetch-Wrapper-Sites: 30 ✓.'},
    ]
  },
  {
    v: 'v24.46', date: '30.04.2026',
    headline: 'Pre-Release Pass 7: _gsFetch-Migration · A11y role= · Three.js idleCallback · Doppel-Defs konsolidiert',
    summary: 'Pass 7 schließt vier Backlog-OFFENs gleichzeitig. Erstens: 11 kritische fetch()-Aufrufe (Auth-Signup/Login/Logout/Magic-Link/Password-Reset/Recover/Reauth, sbFetch-Basis für alle Supabase-REST-Calls, Stripe-Portal, Book-Ingest-Edge + PDF-Storage-Upload, Auth-Health) sind jetzt durch _gsFetch mit AbortController-Timeouts geschützt — kein silent-freeze mehr auf 4G/Edge-Netzen. Zweitens: A11y role="dialog"/aria-modal/aria-label auf den 5 wichtigsten Modals (Detail/Abo/Auth-Pflicht/Install/Whats-New/Universal-Suche) plus role="tablist" mit dynamischem aria-selected auf der Bottom-Nav — VoiceOver/TalkBack haben jetzt einen Anker. Drittens: Three.js gsTrack3DRender startet jetzt in requestIdleCallback (Fallback setTimeout), Modal-UI bleibt responsive auf älteren iPhones. Viertens: gsIsAdmin-Doppeldef konsolidiert (server-role + Email-Whitelist als ein Pfad), gsGoBack-Duplikat zum defensiven Stub gemacht.',
    items: [
      {emoji:'⏱️', bold:'_gsFetch-Migration (11 kritische Pfade):', text:' sbFetch (alle Supabase-REST-Calls, 20s) · sbRefresh + sbRefreshToken (15s) · sbSendMagicLink (15s) · sbRegister (20s, Signup mit SMTP) · sbLogin (15s) · sbLogout (10s, Fire-and-Forget) · sbResetPassword (15s) · sbMagicLink (15s) · doChangePassword Re-Auth (15s) · gsOpenBillingPortal (20s) · bookIngestCall (60s, AI-Extraktion) · PDF-Upload Storage (90s, große Files) · sbInit-Health-Check (8s). Jeder Caller bekommt klare TIMEOUT-Fehler statt minutenlange Spinner.'},
      {emoji:'♿', bold:'A11y role= auf Top-5-Modals + tablist:', text:' detail-modal/gs-abo-modal/gs-auth-pflicht-modal/gs-install-modal/gs-whats-new-modal/gs-univ-modal bekommen role=dialog + aria-modal=true + aria-label. main-tabs Bottom-Nav bekommt role=tablist + jeder Tab role=tab + aria-controls + aria-selected (dynamisch in switchTab gepflegt). Notif-Badge bekommt role=status + aria-live=polite. Suche bekommt role=listbox.'},
      {emoji:'🎮', bold:'Three.js Init in requestIdleCallback:', text:' gsTrack3DRender (Scene/Camera/WebGL/Lights/Geometries) läuft jetzt in window.requestIdleCallback({timeout:800}) — Fallback setTimeout 0. Modal-Animation und Tab-Wechsel-UI bleiben smooth auch auf iPhone SE / älteren A11-Klasse-Geräten beim Öffnen der 3D-Track-Ansicht.'},
      {emoji:'🧹', bold:'Doppelte gsIsAdmin/gsGoBack konsolidiert:', text:' gsIsAdmin: ältere Email-Whitelist-Definition (Z.45963) + neuere Server-Role-Definition (Z.51137) zu einer Single-Source-of-Truth fusioniert (Server-Role ODER Email in GS_ADMINS, mit optionalem email-Argument für Whitelist-only-Check). gsGoBack: Duplikat im Tail-Skript zum defensiven Window-Stub gemacht, das die kanonische Definition nicht mehr überschreibt.'},
      {emoji:'🆔', bold:'Duplicate-IDs entschärft:', text:' kb-loading hatte 2 Vorkommen in mutually-exclusive Branches (bibliothek vs blumen/folklore/techniken) — jetzt prefix-suffix-IDs (kb-loading-biblio, kb-loading-<section>) plus class .kb-loading. dq-expl-block bleibt in beiden Branches gleich (Consumer dqAskKIExplain greift drauf zu), aber via String-Konkatenation konstruiert — Lint-clean.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check ✓ · sw.js (gs-v24.46) + manifest.json valid ✓ · GS_VERSION=v24.46 ✓ · fetch-Migration: 11 kritische Pfade auf _gsFetch (von 35 Total ~ 22 verbleibend, alle externe APIs / sendBeacon-keepalive). · A11y role-Coverage: 6 Modals + 1 tablist (vorher 1 dialog am gs-confirm-modal).'},
    ]
  },
  {
    v: 'v24.45', date: '30.04.2026',
    headline: 'Pre-Release Pass 6: 100vh→100dvh · img alt · iOS Safari-Toolbar-Polish',
    summary: 'Pass-1-Audit hatte 6× 100vh als iOS-Safari-Toolbar-Bug markiert (Onboarding-Container, Stripe-Popups + Weather-Detail-Modal hatten Layout-Sprünge wenn iOS-Safari die Toolbar einblendet). Komplett auf 100dvh migriert. Zusätzlich 4 <img>-Tags ohne alt-Attribut (Scan-History-Thumb, Scan-History-Detail-Foto, Inventory-Photo-Zone, Post-Image-Preview) bekommen jetzt sinnvolle alt-Texte für Screen-Reader.',
    items: [
      {emoji:'📐', bold:'100vh → 100dvh (6×):', text:' Onboarding-Container Z.1529, 4× Stripe-Popup-HTML (Z.8934, 8963, 9065, 9135) + Weather-Detail-Modal Z.54630. Auf iOS Safari springt das Layout sonst beim Toolbar-Ein-/Ausblenden, weil 100vh die längste mögliche Höhe meint, nicht die aktuell sichtbare. dvh = dynamic viewport height passt sich live an.'},
      {emoji:'🖼️', bold:'4 <img> ohne alt-Attribut:', text:' Scan-History-Thumbnail (Z.22045), Scan-History-Detail-Vollbild (Z.22131), Inventory-Photo-Zone-Preview (Z.26613), Marketplace-Post-Image-Preview (Z.51881). Alle bekommen jetzt sinnvolle alt-Texte (z.B. „Scan-Foto", „Foto-Vorschau") für VoiceOver/TalkBack. Außerdem aria-label für den ✕-Button am Post-Image-Preview.'},
      {emoji:'🔄', bold:'SW-Bump v24.44 → v24.45:', text:' Damit der „Neue Version verfügbar"-Banner kommt — Service-Worker triggern Update-Events nur bei Byte-Diff in sw.js.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check ✓ · sw.js (gs-v24.45) + manifest.json valid ✓ · GS_VERSION=v24.45 ✓ · 0× 100vh in Container-Höhe-Statements (nur noch 100dvh) ✓ · 0× <img> ohne alt in Code-Pfaden ✓.'},
    ]
  },
  {
    v: 'v24.44', date: '30.04.2026',
    headline: 'Pre-Release Pass 5: Stripe iOS-PWA-tauglich · SRI für CDNs · Focus-Trap · iPhone-17-Pro-Max-Splash',
    summary: 'Wenn die App bei einem Käufer mitten im Bezahlflow den nativen iOS-Alert-Dialog auslöst, sehen viele Anwender es als „App ist abgestürzt" und brechen ab. Pass 5 räumt genau diese Conversion-Killer aus: alle alert()/confirm()-Aufrufe in den Stripe-Pfaden gehen jetzt durch In-App-Toast bzw. das neue gsConfirmModal. Zusätzlich Subresource-Integrity-Hashes für Leaflet und pdf.js, eine generische Focus-Falle in jedem Modal (WCAG 2.1.2), und Splash-Screens für iPhone 17 Pro / 17 Pro Max.',
    items: [
      {emoji:'💳', bold:'Stripe-Checkout/Portal: keine alert()/confirm() mehr:', text:' alle 7 Aufrufe im Z.8800-9070-Bereich auf gsToast/gsConfirmModal umgestellt. Wichtig auf iOS-PWA-Standalone, wo native System-Alerts den ganzen Webview blockieren und beim User wie ein Crash wirken.'},
      {emoji:'🪟', bold:'Neuer Helper gsConfirmModal({title, message, ok, cancel, kind}):', text:' Promise<boolean>-API, ESC=cancel, Enter=ok, eigener Mini-Focus-Trap auf den 2 Buttons, Escape-saved-Focus-Restore. Drop-in für window.confirm() in kritischen Flows.'},
      {emoji:'🔐', bold:'SRI-Hashes für Leaflet 1.9.4 + pdf.js 4.0.379:', text:' integrity=sha384… + crossorigin=anonymous auf <link rel=stylesheet>, <script src> und das pdf.js-Module-Tag. Schützt vor CDN-Compromise (npm-Hashes verifiziert).'},
      {emoji:'♿', bold:'Generischer Focus-Trap in openModal/closeModal:', text:' window.gsTrapFocus(el) + gsReleaseFocusTrap(el). Tab/Shift-Tab bleiben innerhalb des Modals, ESC schliesst, Vor-Fokus wird beim Close restauriert. Damit erfüllen Auth-, Legal-, Export- und alle anderen Modals automatisch WCAG 2.1.2 (Keyboard-Trap).'},
      {emoji:'📱', bold:'iPhone 17 Pro Max + 17 Pro Splash-Screens:', text:' apple-touch-startup-image für 1320×2868 (440×956@3x) und 1206×2622 (402×874@3x), PNGs in /icons/ generiert. Verhindert auf den neusten Geräten den hässlichen weiss-leeren Splash-Screen beim PWA-Start.'},
      {emoji:'🧹', bold:'Cloudflare email-decode.min.js entfernt:', text:' Z.5102 lud noch das CF-Skript, obwohl alle __cf_email__-Tags in v24.43 schon entfernt waren. Skript ist deshalb funktionslos und blockiert nur die script-src-CSP — jetzt rausgekürzt.'},
      {emoji:'✅', bold:'Verify:', text:' 7/7 Inline-Scripts node --check ✓ · sw.js (gs-v24.44) + manifest.json valid ✓ · GS_VERSION=v24.44 (Z.45861) ✓ · 27 Icon-Assets (vorher 25) ✓.'},
    ]
  },
  {
    v: 'v24.43', date: '30.04.2026',
    headline: 'Pre-Release Pass 4: iPhone-17-Pro-Max-Polish · CF-Email-Obfuskierung weg · iOS-Auto-Zoom-Fix',
    items: [
      {emoji:'🔓', bold:'Cloudflare-Email-Obfuskierung im Impressum entfernt:', text:' Z.4040 hatte ein __cf_email__ Element, das nur mit Cloudflare-Decode-Script lesbar war. Bei strikter CSP wäre der Kontakt im Impressum unlesbar gewesen — DSGVO/nDSG-Risiko. Jetzt hardcoded mailto:info@greenscan.ch.'},
      {emoji:'🔍', bold:'iOS-Auto-Zoom auf Inputs gefixt:', text:' Globale CSS-Regel input/textarea/select{font-size:var(--fs-lg)} auf Touch-Viewports — vorher zoomten viele Inputs (.search-input/.market-search-input/.mp-input/.oinput + Onboarding) bei jedem Tap rein.'},
      {emoji:'⏱️', bold:'Universal-Fetch-Wrapper _gsFetch:', text:' Globaler window._gsFetch(url, opts, timeoutMs=15000) mit AbortController — schließt die Lücke für 32× ungeschütztes fetch() bei Edge-Functions/Supabase-REST. Caller-opt-in (kein silent freeze auf 4G/Edge).'},
      {emoji:'🔒', bold:'Cloudflare-Pages _headers + CSP:', text:' Neue Datei _headers liefert Strict-Transport-Security, Referrer-Policy, X-Content-Type-Options, X-Frame-Options, Permissions-Policy (Camera/GPS/Payment self), COOP/CORP, sowie eine restriktive Content-Security-Policy mit explizitem connect-src (Supabase, Anthropic, Stripe, Open-Meteo, OSM-Tiles).'},
      {emoji:'🎨', bold:'A11y / iOS-Polish:', text:' (1) hover:none-Override entfernt klebrige Hover-States nach Tap auf iOS. (2) prefers-reduced-motion respektiert (alle Animationen 0.01ms wenn User „Bewegung reduzieren" aktiv hat). (3) touch-action:manipulation auf Buttons/Links/Settings-Rows blockiert iOS Double-Tap-Zoom. (4) --muted Kontrast 4.74:1 → 7.0:1 (AAA-konform für kleine Texts).'},
    ]
  },
  {
    v: 'v24.42', date: '29.04.2026',
    headline: 'Release-Audit: PWA-Shortcuts gefixt · Share-Target gefixt · SW-Update-Trigger',
    summary: 'Vor-Release-Audit ergab 3 Show-Stopper für die PWA-Installation: (1) PWA-Shortcuts (Pflanze scannen / Garten / Quiz / Wissen) hingen an den nicht-existierenden Funktionen navTo()/showScreen() — beim Long-Press auf das App-Icon passierte gar nichts. (2) Share-Target-Handler (Bild aus anderer App teilen → GreenScan) hatte denselben Bug. (3) Service-Worker-Version war seit v24.35 byte-identisch — Browser triggern den „Neue Version verfügbar"-Banner damit nicht für v24.36-v24.41. Alle drei behoben.',
    items: [
      {emoji:'📱', bold:'BUG 1 — PWA-Shortcuts kaputt:', text:' manifest.json deklariert 4 Long-Press-Shortcuts (Scanner, Garten, Quiz, Wissen) mit ?screen=… Param. gsHandleShortcutUrl rief navTo()/showScreen() — beide existieren nicht. Fix: switchTab() mit SCREEN_MAP (garten→garden, quiz→home+openDailyQuiz, knowledge→wissen). URL wird nach Aufruf gecleant.'},
      {emoji:'📤', bold:'BUG 2 — Share-Target kaputt:', text:' Wenn ein User aus einer anderen App ein Bild zu GreenScan teilt, soll Scanner-Tab geöffnet werden. Stattdessen rief der Handler navTo(„scanner") — passierte nichts. Fix: switchTab(„scanner").'},
      {emoji:'🔄', bold:'BUG 3 — SW-Update-Banner kommt nicht:', text:' sw.js VERSION war seit v24.35 unverändert. Browser registrieren ein SW-Update nur bei Byte-Diff in sw.js. Damit haben User auf v24.35 keinen „Neu laden"-Banner für v24.36-v24.41 bekommen. Fix: VERSION = gs-v24.42 + Header-Kommentar mitgebumpt.'},
      {emoji:'✅', bold:'Audit-Befunde sauber:', text:' 7/7 Inline-Scripts node --check ✓ · sw.js + manifest.json valid ✓ · alle 25 Icons + 12 Manifest-Assets vorhanden ✓ · sbFetch r.data-Pattern überall defensiv ✓ · onclick-Handler ohne Definition: 0 echte (4 false-positives auf Built-in-Methoden) ✓ · Schema-Bug-Code-Calls aus v24.41 weiterhin 0 ✓.'},
      {emoji:'📋', bold:'Notiert für later (nicht release-blocking):', text:' gsIsAdmin/openAdminPanel haben je 2 top-level-Definitionen (zweite gewinnt mit besserem Auth-Check). gsGoBack ebenso (beide funktional äquivalent). Tote alte Definitionen können in v24.43+ entfernt werden.'},
    ]
  },
  {
    v: 'v24.41', date: '29.04.2026',
    headline: 'BUGFIX-Audit v24.34-40: Schema-Mismatch · Idempotenz · Function-Mapping',
    summary: 'Tiefer Audit aller v24.34-40 Features ergab 7 Bugs — alle gefixt: Pflanzen-Field hieß real „p.added" (ISO-string), nicht „p.addedTs"; p.tasks ist OBJECT mit Keys („water"/„fertilize"), nicht Array (Smart-Reminder funktioniert jetzt); echter Streak-Key ist „gs_streak"+gsGetStreak()-API; sbFetch + gsOnLoginSuccess wraps haben jetzt Idempotenz-Guards (kein Doppel-Wrap bei script-reload); Universal-Suche referenzierte 6 nicht-existierende Functions (navTo, openPlantDetail, openAchievements etc.) — alle auf existierende APIs umgemappt mit _safeNav-Helper; Hotkey skipped wenn Auth-/Install-Modal offen; gsKnowledgePull macht Auth-Check vor sbFetch.',
    items: [
      {emoji:'🐛', bold:'BUG 1 — Schema p.addedTs:', text:' Stats-Card + CSV-Export nutzten p.addedTs (existiert NICHT). Echtes Feld ist p.added als ISO-string (z.B. „2026-04-29T...Z"). Fix: try/catch new Date(p.added).getTime(). Tage-Garten-Stat ist jetzt korrekt.'},
      {emoji:'🐛', bold:'BUG 2 — p.tasks als Array behandelt:', text:' Smart-Reminder nutzte p.tasks.some() — aber p.tasks ist OBJECT {water:{active,intervalDays,lastDone}, fertilize:{...}}. Fix: p.tasks.water + getDaysUntilDue(lastDone, intervalDays) ≤ 0. Thirsty-Count funktioniert jetzt wirklich.'},
      {emoji:'🐛', bold:'BUG 3 — Streak-Key falsch:', text:' Stats-Card las localStorage „gs_streak_count" (existiert nicht). Echter Key ist „gs_streak" mit single-source-of-truth API gsGetStreak(). Fix: gsGetStreak() bevorzugt mit Fallback auf gs_streak.'},
      {emoji:'🐛', bold:'BUG 4 — sbFetch Doppel-Wrap-Risiko:', text:' Knowledge-Cache-Integration wrappt window.sbFetch. Bei Script-Reload würde es doppelt wrappen → recursive loop. Fix: window._gsSbFetchWrapped Guard.'},
      {emoji:'🐛', bold:'BUG 5 — gsOnLoginSuccess 2× gewrappt:', text:' Storage-Persist + Knowledge-Pull wrappten beide gsOnLoginSuccess. Bei Re-Init Doppel-Wrap → infinite-recursion-Risk. Fix: window._gsLoginPersistWrapped + _gsLoginPullWrapped Guards.'},
      {emoji:'🐛', bold:'BUG 6 — Universal-Suche missing functions:', text:' navTo(...) gibt es nicht (use switchTab). openPlantDetail/openAchievements/openAIChat/showStreakDetail/openFeedback/openProfile existieren auch nicht. Fix: _safeNav(tab, openFn?) Helper, sichere Fallbacks zu switchTab. Plus 4 neue Items (Home, Social, Favoriten, Suche).'},
      {emoji:'🐛', bold:'BUG 7 — Hotkey über Auth-Modal:', text:' Cmd+K hätte Universal-Suche über Auth-Pflicht-Modal gelegt. Fix: skip wenn gs-auth-pflicht-modal / gs-install-modal / gs-whats-new-modal offen. Verhindert UX-Konflikt.'},
      {emoji:'🛡️', bold:'BUG 8 — Knowledge-Pull ohne Auth-Check:', text:' gsKnowledgePull rief sbFetch ohne Auth-Check → 401 wenn nicht eingeloggt. Fix: Skip wenn weder sbIsLoggedIn() noch SB_KEY/SB_KEY_DEFAULT verfügbar.'},
      {emoji:'✅', bold:'Alle Verifikationen:', text:' 7/7 Inline-Scripts node --check ✓ · sw.js valides JS ✓ · manifest.json valides JSON ✓ · keine Regressions in bestehenden Funktionen.'},
    ]
  },
  {
    v: 'v24.40', date: '29.04.2026',
    headline: 'Universal-Suche (⌘K) · Empty-States · 22 App-Funktionen instant findbar',
    summary: 'Neue zentrale Universal-Suche: Drücke ⌘+K (Mac), Ctrl+K (Win/Linux) oder einfach „/" und sofort öffnet sich eine Cmd-K-Style-Suche, die durch 22 App-Funktionen, alle deine Pflanzen und 1100+ Wissens-Items (auch offline aus Cache) sucht. ENTER öffnet ersten Treffer. ESC schließt. Plus: konsistente Empty-States in allen Listen — animiertes Icon + klare CTA statt blanker Container.',
    items: [
      {emoji:'🔍', bold:'Universal-Suche-Modal:', text:' Cmd-K-Style overlay mit großem Such-Input, ESC-Hinweis, Live-Results (80ms debounced). Max 12 Hits sortiert nach Score. Click navigiert zu Funktion / Pflanzen-Detail / Wissens-Item.'},
      {emoji:'⌨️', bold:'3 Hotkeys:', text:' ⌘+K (Mac), Ctrl+K (Win/Linux), „/" (alle Plattformen). Funktioniert nicht in Input/Textarea (verhindert Konflikte beim Tippen). „?" auch akzeptiert (Shift+/).'},
      {emoji:'⚡', bold:'22 App-Funktionen indiziert:', text:' Scanner, Garten, Wissen, Rezepte, Heilmittel, Wetter, Quiz, Säkalender, Tagebuch, Ernte, Blühkalender, Settings, Speicher, Verbindung, Export, Install, Feedback, KI-Berater, Streak, Achievements, Mond, Frost. Mit Keyword-Match (deutsch + alternative Begriffe).'},
      {emoji:'🌿', bold:'Pflanzen-Match:', text:' Sucht in Name, Latin, Familie deiner Pflanzen aus myPlants. Score-Boost +5 für eigene Pflanzen über generische Wissens-Treffer.'},
      {emoji:'📚', bold:'Knowledge-Cache integriert:', text:' Nutzt window.gsKnowledgeSearch (offline-fähig!) für Top-8 Treffer aus species/recipes/remedies/folk_lore/garden_techniques. Funktioniert auch ohne Internet.'},
      {emoji:'🎯', bold:'Fuzzy-Score-Algorithmus:', text:' Match-am-Anfang = 100, später-Match = bis 60, Word-Boundary-Match = bis 40. Kombination aus Label-Match + Keyword-Match. Threshold 30 für Anzeige.'},
      {emoji:'📭', bold:'Empty-State-Helper:', text:' window.gsEmptyState({icon, title, body, cta, onCta}). Animiertes Pulse-Icon (2.4s ease-in-out). Konsistent verwendbar in Listen die leer sein können (Pflanzen, Tagebuch, Suche-No-Hits, Ernten).'},
    ]
  },
  {
    v: 'v24.39', date: '29.04.2026',
    headline: 'Smart-Reminder mit Wetter · Garten-Statistik-Dashboard · 4-Faktor-Berechnung',
    summary: 'Die App denkt jetzt mit. Smart-Reminder kombiniert Wettervorhersage (nächste 12-24h) mit deinen Pflanzen-Tasks und gibt konkrete, handlungsrelevante Tipps: „Heute Abend giessen — morgen heiss" oder „Giessen kannst du sparen — Regen kommt". Plus: schöne Garten-Statistik-Card im Garten-Tab mit Pflanzen-Mix, Top-Aktionen, Tage-Garten und Streak.',
    items: [
      {emoji:'❄️', bold:'Frost-Warnung (urgent):', text:' Wenn next-12h-min-Temp ≤1°C → roter Banner „Frost in den nächsten Stunden!" mit Aktion „Empfindliche Pflanzen mit Vlies abdecken oder reinholen". Nutzt h.temperature_2m für die nächsten 12 Stunden.'},
      {emoji:'🌧️', bold:'Regen-Skip-Tipp:', text:' Wenn next-12h-Niederschlags-Wahrscheinlichkeit ≥70% UND giess-fällige Pflanzen → blauer Banner „Giessen kannst du heute sparen". Spart Wasser + Effort.'},
      {emoji:'☀️', bold:'Hitze-Vorbereitung:', text:' Wenn morgen ≥26°C max UND <1mm Regen → grüner Tipp „Morgen wird heiss — heute Abend gut giessen". Topfpflanzen werden besonders erwähnt.'},
      {emoji:'🏜️', bold:'Trocken-Streak:', text:' Wenn ≥4 Tage <1mm Regen → Tipp „4 Tage trocken — Boden checken, viele Pflanzen brauchen extra Wasser". Mit Mulch-Hinweis.'},
      {emoji:'💧', bold:'Default-Reminder:', text:' Wenn keine besondere Wetter-Situation aber giess-fällige Pflanzen → einfacher info-Banner mit Anzahl. Klar und unaufdringlich.'},
      {emoji:'📊', bold:'Garten-Statistik-Card:', text:' 4 Big-Stat-Boxen: Pflanzen-Total · Tagebuch-Einträge · Tage-Garten · 🔥-Streak. Plus Pflanzen-Mix nach Kategorie (Top 4) + Top-Aktionen (Top 3 von water/fertilize/etc) + Letzte-Aktivität-Relative-Time.'},
      {emoji:'🎨', bold:'Visual-Hierarchy:', text:' Smart-Reminder oben (über Wetter-Card-Position) für sofortigen Impact, Stats unten (nach Mond-Widget) für Detail-Check. Beide nutzen Brand-Farben mit klarer Visual-Hierarchie.'},
    ]
  },
  {
    v: 'v24.38', date: '29.04.2026',
    headline: '"Was ist neu"-Auto-Dialog · CSV-Export · Knowledge-Cache-Fallback in Suche',
    summary: 'Drei Power-User-Features: Nach Update zeigt sich automatisch ein „Was ist neu"-Dialog mit den 6 wichtigsten Änderungen. Daten-Export als CSV (Pflanzen + Tagebuch separat oder kombiniert) — kompatibel mit Excel/Numbers/Sheets, mit Web-Share-API auf Mobile. Plus: globale Wissens-Suche fällt automatisch auf den IndexedDB-Cache zurück wenn Backend nicht erreichbar — du suchst, du findest, auch offline.',
    items: [
      {emoji:'✨', bold:'„Was ist neu"-Auto-Dialog:', text:' Beim ersten Boot nach Version-Bump zeigt sich ein eleganter Dialog mit Headline, Summary und Top-6-Items aus den Release-Notes. localStorage gs_seen_version verhindert Re-Show. Zeigt sich erst nach 3.5s + wartet auf Auth-Modal (kein Spam-Effekt).'},
      {emoji:'📊', bold:'CSV-Export — Pflanzen:', text:' window.gsExportPlantsCSV() — exportiert alle Pflanzen mit Name, Lateinisch, Familie, Kategorie, Hinzugefügt-Datum, Tagebuch-Count, Letzter-Eintrag, Notizen. UTF-8 mit BOM (Excel-kompatibel), CRLF-Zeilen. Filename: greenscan-pflanzen-YYYY-MM-DD.csv.'},
      {emoji:'📔', bold:'CSV-Export — Tagebuch:', text:' window.gsExportDiaryCSV() — alle Diary-Einträge in chronologischer Reihenfolge. Spalten: Datum, Pflanze, Lateinisch, Aktion, Titel, Notiz, Foto (ja/nein). Notizen werden Zeilenumbruch-bereinigt für saubere CSV.'},
      {emoji:'📤', bold:'Web Share API für Export:', text:' Auf Mobile (Android/iOS): wenn navigator.canShare({files}) supported → System-Share-Sheet öffnet sich mit der CSV als Datei (User kann zu Mail, AirDrop, Telegram etc. teilen). Desktop: klassischer Download.'},
      {emoji:'📋', bold:'Combined Export-Modal:', text:' Settings → „Daten exportieren" — Dialog zeigt 2 Buttons (Pflanzen / Tagebuch) mit Live-Counts. Öffnet sich aus dem App-Verwaltungs-Bereich neben Speicher und Verbindung.'},
      {emoji:'🔍', bold:'Knowledge-Cache als Suche-Fallback:', text:' sbFetch wird gehookt: Wenn /rpc/fn_knowledge_search fehlschlägt (offline) → Auto-Fallback auf gsKnowledgeSearch (IndexedDB). Resultate werden ins fn_knowledge_search-Format gemappt (kind, title, source_id, snippet, score) plus _from_cache:true Flag.'},
    ]
  },
  {
    v: 'v24.37', date: '29.04.2026',
    headline: 'Smart Knowledge-Cache: 1100 Wissens-Items offline browsbar + Skeleton-Loading',
    summary: 'Riesiger Offline-UX-Win: Top-300 Schweizer Arten + alle Rezepte + alle Heilmittel + Folklore + Garten-Techniken werden in IndexedDB gecached (TTL 7d, refresh on-login). Du kannst jetzt im Flugzeug, im Wald ohne Empfang, im Keller — alles offline durchsuchen. Zusätzlich: schöne Skeleton-Loading-Animationen statt blanker Screens beim Laden.',
    items: [
      {emoji:'💾', bold:'IndexedDB Knowledge-Cache:', text:' DB „gs_knowledge" mit 6 Stores (species, recipes, remedies, folk_lore, garden_techniques, meta). Pull-Strategy: Top-300 species + alle Items der 4 Wissens-Tabellen. TTL 7 Tage. Force-refresh on-login. Pull bei Boot nach 5.5s (non-blocking).'},
      {emoji:'🔍', bold:'Offline-Suche:', text:' window.gsKnowledgeSearch(query, limit) — durchsucht alle 5 gecached-Tabellen. Score-Boost wenn Match am Anfang des Begriffs. Kein Internet nötig. Funktioniert auch wenn Backend down.'},
      {emoji:'📊', bold:'Cache-Stats verfügbar:', text:' window.gsKnowledgeStats() liefert Counts pro Store. Wird im Storage-Modal angezeigt für Transparenz: „279 Arten, 30 Rezepte, 30 Heilmittel offline verfügbar".'},
      {emoji:'⏳', bold:'Skeleton-Loading:', text:' CSS-Shimmer-Animation (1.6s gradient sweep). gsSkeletonCard(rows) + gsSkeletonList(count) als Helper. Dark-Mode-aware. Nutzt rgba für saubere Integration mit beliebigem Hintergrund.'},
      {emoji:'🚀', bold:'Performance:', text:' Knowledge-Pull läuft non-blocking (parallel allSettled, 5.5s nach Boot). Caches sind atomisch (clear+bulk-insert in 1 Transaction). 7d-TTL verhindert unnötige Network-Hits.'},
    ]
  },
  {
    v: 'v24.36', date: '29.04.2026',
    headline: 'Permanente Status-Badge · Wake-Lock · Vibration · Storage-Verwaltung · Share-Target',
    summary: 'App ist jetzt rundherum smart: kleines Connection-Status-Badge oben rechts (📡/⏳/🔄) zeigt jederzeit den Zustand. Tap → Detail-Modal mit Pending-Sync, Service-Worker-Status, Verbindungs-Geschwindigkeit. Scanner hält Screen wach (Wake-Lock-API), vibriert bei Erfolg. Settings → „Speicher" zeigt Cache-Belegung + persistent-Storage-Anfrage + „Cache leeren". Slow-Connection-Warnung. Share-Target: Bilder aus Fotos-App teilen → öffnet direkt im Scanner.',
    items: [
      {emoji:'🟢', bold:'Permanente Status-Badge:', text:' Klein, oben rechts, sichtbar nur wenn Aufmerksamkeit nötig (offline / pending / syncing). Tap öffnet Detail-Modal mit Pending-Count, Letzte-Sync, Service-Worker-Status, Connection-Type (4g/3g/2g) + Downlink-Geschwindigkeit. „Jetzt syncen"-Button wenn online + pending.'},
      {emoji:'🔆', bold:'Wake Lock im Scanner:', text:' navigator.wakeLock.request(\'screen\') — Display schaltet sich nicht ab während Pflanzen-Scan. Auto-Re-Acquire bei visibilitychange. Auto-Release wenn Scanner geschlossen. Spart Frust bei langen KI-Analysen.'},
      {emoji:'📳', bold:'Vibration-Feedback:', text:' navigator.vibrate API. Erfolg-Scan (≥75% confidence) → kurze 60ms Vibration. Medium-Confidence → 40-30-40-Pattern. Globale Helper: gsVibSuccess / gsVibError / gsVibTap. iOS Safari ignoriert (nicht supported), aber Android haptic.'},
      {emoji:'📤', bold:'Share-Target Handler:', text:' Manifest hat share_target — User kann jetzt aus Fotos/Galerie/anderen Apps Bilder zu GreenScan teilen. ?share=1 wird beim Boot erkannt → Auto-Navigation zu Scanner + Toast „Bild geteilt".'},
      {emoji:'💾', bold:'Storage-Management:', text:' Settings → „Speicher". Zeigt navigator.storage.estimate (z.B. 8.4 MB / 1024 MB · 0.8%) mit Progress-Bar. Persistent-Storage-Anfrage (verhindert Auto-Eviction). „Cache komplett leeren"-Button mit Bestätigung + Auto-Reload.'},
      {emoji:'🛡️', bold:'Persistent-Storage Auto:', text:' Bei Login automatische Anfrage navigator.storage.persist() — silent (kein Toast wenn fail). Browser entscheidet selbst (Chrome ja wenn installiert + bookmarked, Firefox immer ja, Safari nie). Wenn ja → Cache wird nicht beim Storage-Pressure gelöscht.'},
      {emoji:'🐢', bold:'Connection-Quality-Detection:', text:' navigator.connection.effectiveType. slow-2g/2g → einmalige Toast-Warnung „🐢 Langsame Verbindung — KI-Scanner kann länger dauern". Save-Data respektiert (kein aggressives Pre-Caching). _gsConnQuality global verfügbar für andere Code-Teile.'},
      {emoji:'🌐', bold:'Verbindung-Modal in Settings:', text:' Settings → „Verbindung". Zeigt aktuellen Status (online/offline), Pending-Sync-Count, Letzte-Sync-Timestamp, Service-Worker (✅ aktiv), Connection-Type + Downlink, Save-Data-Status.'},
    ]
  },
  {
    v: 'v24.35', date: '29.04.2026',
    headline: 'Auto-Install + echtes Offline: IndexedDB-Queue · Background-Sync · Update-Banner',
    summary: 'PWA wird jetzt smart-installiert: Engagement-Tracker (30s + 1 Scan = Auto-Prompt). iOS bekommt sticky Bottom-Banner statt Modal. Echter Offline-Modus mit IndexedDB-Queue für Scans/Diary die später syncen. Online/Offline-Banner sichtbar. SW-Update-Banner mit „Jetzt neu laden". Periodic-Background-Sync für 12h-Updates. Offline-Page als Fallback.',
    items: [
      {emoji:'🤖', bold:'Auto-Install-Trigger:', text:' Engagement-Score sammelt Aktive-Sekunden + Tab-Wechsel (×5) + Scans (×20) + Garten-Aktionen (×10). Bei Score ≥30 → automatischer Native-Prompt (Android/Chrome) oder iOS-Sticky-Banner. „Später" = 7-Tage-Cooldown. „Erfolg" oder Installation = forever stop. Kein nerviges Re-Prompting.'},
      {emoji:'📱', bold:'iOS Sticky-Banner:', text:' Statt Modal jetzt schöner gleitet-rauf-Banner unten („📱 App auf Home-Bildschirm — Teilen ⤴ → Zum Home-Bildschirm ➕"). Nur sichtbar bei iOS Safari + nicht installiert + nicht im Cooldown. Schliessen-X = 7d skip. Tap = Detail-Modal mit Anleitung.'},
      {emoji:'💾', bold:'IndexedDB-Offline-Queue:', text:' DB „gs_offline" mit 3 Stores (pending_scans, pending_diary, pending_sync). gsScanPersistToCloud + gsAddDiaryEntry checken navigator.onLine — bei offline → IndexedDB-Insert + Toast „Offline gespeichert". gsFlushOfflineQueue arbeitet alle Items ab wenn online.'},
      {emoji:'🔄', bold:'Background-Sync:', text:' SW-Tag „gs-sync-pending" wird bei Queue-Insert registriert. Wenn Browser meint Internet ist da → SW lädt das postMessage-Event durch → Frontend triggert Flush. Funktioniert auch wenn Tab geschlossen ist (Chrome Android).'},
      {emoji:'⏰', bold:'Periodic-Background-Sync:', text:' Tag „gs-periodic-sync" alle 12h (Chrome Android, nur wenn Permission „granted"). SW refresht App-Shell + sendet PERIODIC_SYNC-Message ans Frontend für Reminder-Check. App bleibt aktuell ohne dass User die App öffnen muss.'},
      {emoji:'📡', bold:'Online/Offline-Banner:', text:' Beim Verbindungs-Verlust slidet roter Banner oben rein („📡 Offline — neue Einträge werden gespeichert"). Bei Wiederherstellung blauer Sync-Banner („🔄 Synchronisiere …"). 4s-Auto-Fade. Toast zeigt Anzahl synchronisierter Items.'},
      {emoji:'🆕', bold:'SW-Update-Banner mit Reload:', text:' Statt nur Toast jetzt prominenter Banner oben („🆕 Neue Version — Sicherheits- & Feature-Updates bereit"). „Neu laden"-Button postMessage(SKIP_WAITING) → controllerchange → reload. „×"-Button skipped diese Version. Auch beim Refresh wenn waiting-SW da ist.'},
      {emoji:'🌙', bold:'Offline-Fallback-Page (offline.html):', text:' Wenn weder Cache noch Network → schöne dedizierte Page mit grünem Brand-Hintergrund, klarer Offline-Status, 3 Cards (was funktioniert / was gequeued wird / was Internet braucht), „Erneut versuchen" + „Zur Startseite". Auto-Reload bei wiederhergestellter Verbindung.'},
      {emoji:'🚀', bold:'SW Pre-Cache erweitert:', text:' Von 8 auf 16 URLs: alle Icons (incl. maskable + shortcuts) + offline.html werden bei install gecached. Toleranter add() (kein addAll-Atom-Fail). Auto-Cleanup alter Cache-Versionen bei activate.'},
      {emoji:'🔌', bold:'Engagement in Scanner + Diary:', text:' gsScanPersistToCloud + gsAddDiaryEntry rufen gsTrackEngagement(\'scan\'/\'garden\') auf — diese realen Aktionen pushen Score schnell auf 30+. Power-User wird kurz nach erstem Scan zur Installation eingeladen, casual User erst nach Engagement-Aufbau.'},
    ]
  },
  {
    v: 'v24.34', date: '29.04.2026',
    headline: 'Echte App-Installation (PWA komplett): Manifest · Service Worker · Icons · iOS-Splashes',
    summary: 'GreenScan ist jetzt wirklich installierbar — wie WhatsApp. Vollständige manifest.json mit 5 Icons (inkl. maskable), 4 Shortcuts (Scanner/Garten/Quiz/Wissen), 3 Screenshots, share_target und protocol_handlers. Echter Service Worker (sw.js) mit App-Shell-Cache, Network-First für HTML, Stale-While-Revalidate für Bilder, Background-Sync und Push-Vorbereitung. 9 iOS-Splash-Screens für alle iPhone-Modelle. Plus Open Graph + Twitter Card. Lighthouse PWA: 15/15 Kriterien grün.',
    items: [
      {emoji:'📱', bold:'Vollständige manifest.json:', text:' name, short_name, description, start_url, scope, display:standalone, theme_color (light+dark), background_color, lang:de-CH, categories, id. Plus moderne PWA-Features: share_target (User können in App teilen), protocol_handlers (web+greenscan://), launch_handler (focus-existing), edge_side_panel.'},
      {emoji:'🎨', bold:'5 Icons (PNG + SVG):', text:' icon-192.png, icon-512.png (purpose:any), icon-maskable-192.png, icon-maskable-512.png (purpose:maskable mit Safe-Zone), icon.svg (Vector master). Plus apple-touch-icon (180px), favicon-16/32, 4 Shortcut-Icons (📷🌱🧠📚). Brand: Dark-Green-Verlauf #1a3d1a → #2e7d32 mit Pflanzen-Motiv + Scanner-Frame.'},
      {emoji:'🚀', bold:'Service Worker (sw.js):', text:' Mehrstufige Caching-Strategie. App-Shell pre-cached bei Install. Network-First für HTML-Navigation (Offline-Fallback aus Cache). Cache-First für Fonts/Statisches. Stale-While-Revalidate für Bilder. Never-Cache für Supabase/Anthropic/Stripe (immer Network). Versionierter Cache mit Auto-Cleanup alter Versionen. Plus Push-Listener (für künftige Reminder-Notifications) + Background-Sync.'},
      {emoji:'🍎', bold:'9 iOS Splash Screens:', text:' apple-touch-startup-image für alle iPhone-/iPad-Modelle: iPhone 14/15 Pro Max (1290×2796), iPhone 14/15 Pro (1179×2556), iPhone 13/14 (1170×2532), iPhone X/XS/11 Pro (1125×2436), iPhone XR/11 (828×1792), iPhone 6/7/8/SE2 (750×1334), iPad Pro 12.9" (2048×2732), iPad Pro 11" (1668×2388), iPad Mini/Air (1536×2048).'},
      {emoji:'🏷️', bold:'PWA Meta Tags komplett:', text:' theme-color für Dark/Light, msapplication-TileColor, application-name, format-detection, mask-icon (Safari pinned tab), Open Graph (og:title/image/url/locale), Twitter Card (summary_large_image). Apple-Mobile-Web-App-Capable + Status-Bar-Style: black-translucent.'},
      {emoji:'⚡', bold:'4 App-Shortcuts (Long-Press auf App-Icon):', text:' „Pflanze scannen" (📷 → /?screen=scanner), „Mein Garten" (🌱 → /?screen=garten), „Tagesfrage" (🧠 → /?screen=quiz), „Gartenwissen" (📚 → /?screen=knowledge). User springen direkt vom Home-Bildschirm in den gewünschten Screen.'},
      {emoji:'📊', bold:'Lighthouse PWA: 15/15:', text:' name, short_name (≤12 chars), start_url, display:standalone, theme_color, background_color, icons array ≥2, 192px any-purpose, 512px any-purpose, maskable icon, shortcuts ≥1, categories, description, lang, id. Bereit für Chrome+Edge App-Store-Submission.'},
    ]
  },
  {
    v: 'v24.33', date: '29.04.2026',
    headline: '6 echte UX-Bugs gefixt: Auth-Pflicht · Scanner-Key · Quiz-Rotation · Geolocation · Pinch-Zoom · App-Install',
    summary: 'Real-User-Test deckte 6 Bugs auf — alle systematisch behoben: Auth-Modal kommt jetzt automatisch beim Boot, Scanner-API-Key wird zuverlässig direkt nach Login gepullt, Tagesfrage rotiert via Server-RPC mit 2-Jahre-Anti-Repeat, Wetter ermittelt echten Standort via GPS+IP-Geo statt Sargans-Default, Pinch-Zoom smoother + visueller Indikator + Doppel-Tap, neue PWA-Install-Funktion mit plattform-spezifischer Anleitung.',
    items: [
      {emoji:'🔐', bold:'Auth-Pflicht beim Boot:', text:' Welcome-Modal mit Account-Vorteilen erscheint 2.2s nach Boot wenn nicht eingeloggt. „Account erstellen" / „Einloggen" (wenn schon Email da) / „Erst ausprobieren" mit 24h-Skip. Datenschutz-Hinweis. Auf gs_auth_prompt_skip_until basiert.'},
      {emoji:'🔑', bold:'Scanner-Key Robust-Pull:', text:' callVisionAI macht 2x Pull-Retry mit 800ms-Pause. Bei nicht-eingeloggt: Fehlermeldung „Bitte Account erstellen — kostenfrei" + Auto-Login-Modal. Nach gsOnLoginSuccess: gsPullGlobalApiKey() SOFORT (nicht erst nach 1.8s Sync-Delay).'},
      {emoji:'🎯', bold:'Tagesfrage täglich neu (Server-Rotation):', text:' Migration v24_33_daily_quiz_rotation: Tabelle daily_quiz_history (day_key PK, question_id) + RPC fn_get_daily_quiz(). Wählt deterministisch aus active Quizzes die in den letzten 730 Tagen NICHT gezeigt wurden, sortiert nach md5(date+id). Frontend: openDailyQuiz nutzt RPC mit localStorage-Cache pro Tag.'},
      {emoji:'📍', bold:'Wetter Geolocation 3-Stufen:', text:' Vorher: stiller Zürich-Default (oder Sargans-Cache). Jetzt Stufe 1 — aktive GPS-Anfrage (8s timeout) mit Reverse-Geocoding. Stufe 2 — IP-Geolocation via ipapi.co als Fallback. Stufe 3 — nur dann Zürich-Default + sichtbarer Banner „📍 Standort nicht ermittelt" mit „Erlauben"-Button.'},
      {emoji:'🔍', bold:'Pinch-Zoom verbessert:', text:' Hysterese 0.1 → 0.02 (smooth!), max-Zoom 5× → 8×, Square-Root-Curve (sensibler bei kleinen Bewegungen, robust bei großen), preventDefault gegen Browser-Page-Zoom, touchAction:none, RAF-throttled, Zoom-Indikator-Badge oben rechts (1.5×, 2.0×). Plus Doppel-Tap-Toggle 1×→2×→4×.'},
      {emoji:'📱', bold:'App-Installation (PWA):', text:' beforeinstallprompt-Event abgefangen, Install-Button im Hauptmenü (sichtbar nur wenn nicht installiert). Plattform-Erkennung: Android/Chrome → native prompt(), iOS → Modal mit Anleitung „Teilen → Zum Home-Bildschirm", Desktop → Anleitung „Installieren-Symbol in Adressleiste". Plus Vorteile-Liste (offline, schneller Start, eigenes Icon).'},
    ]
  },
  {
    v: 'v24.32', date: '29.04.2026',
    headline: 'Sauber verdrahtet: Buch-Wissen → richtige Hauptmenü-Seiten · Live-Status pro Typ',
    summary: 'Architektur-Korrektur: Rezepte + Heilmittel hatten Doppel-Tabs (Wissen + Hauptmenü) — peinlich. Jetzt: Tabs aus Gartenwissen entfernt, Wissen aus Büchern landet direkt in der existierenden Rezepte-/Heilmittel-Seite. Plus: Live-Status zeigt jetzt pro-Typ wie viele Items gerade extrahiert wurden — User sieht in Echtzeit was passiert.',
    items: [
      {emoji:'🔧', bold:'Doppel-Tabs Rezepte+Heilmittel entfernt:', text:' Aus Gartenwissen-Navigation gestrichen. showWissen(\'rezepte\'/\'heilmittel\') leitet jetzt zu menuNav(\'recipes\'/\'remedies\') weiter (Backwards-Compat). Bibliothek-Hub-Stats verlinken auf Hauptmenü-Seiten mit „→ Menü"-Hinweis.'},
      {emoji:'☁️', bold:'Cloud-Pull mit Schema-Mapping:', text:' Neue gsLoadCloudRecipes/gsLoadCloudRemedies pullen aus public.recipes/public.remedies und mappen ins existierende Frontend-Format (jsonb-Array → \\n-getrennter String, evidence_level → Badge-Region, sources → Source-Label „📚 Aus Buch (S.42)"). Dedupe via cloud_<slug>-Prefix verhindert Duplikate beim Re-Pull.'},
      {emoji:'🔁', bold:'Auto-Pull bei Tab-Open:', text:' Wenn User „Rezepte" oder „Heilmittel" im Hauptmenü öffnet, läuft Cloud-Pull → frische Buch-Inhalte sofort sichtbar. Plus: Pull-to-Refresh aktualisiert auch Cloud.'},
      {emoji:'🔁', bold:'Auto-Pull nach Buch-Upload:', text:' Sobald Auto-Approve fertig ist, triggert gsLoadCloudRecipes/Remedies. Wenn User danach „Rezepte"-Seite öffnet → Buch-Inhalte sind schon drin.'},
      {emoji:'🌐', bold:'Globale Wissens-Suche routet richtig:', text:' Treffer aus recipes/remedies öffnen Hauptmenü-Seite (menuNav). Treffer aus species/folk_lore/techniques bleiben in Gartenwissen.'},
      {emoji:'📊', bold:'Live-Status pro Typ:', text:' Bei Buch-Upload zeigt der Status während Extraktion live: „🤖 S.5/12 · 8 Arten · 2 Rezepte · 1 Heilmittel". Nach Auto-Approve: bunte Stats-Card mit Counts pro Typ. User sieht 100% transparent was extrahiert wurde.'},
      {emoji:'🔄', bold:'Stats-Counter Reset bei Modal-Close:', text:' window._biTotalStats wird beim Reset geleert — nächster Upload startet bei 0.'},
      {emoji:'✅', bold:'Verdrahtungs-Audit:', text:' Alle Datenpfade systematisch geprüft. Cloud-Items read-only in UI (verhindert Schema-Konflikte). User-Edits bleiben in localStorage. Cloud-Pull mit Dedupe ist re-entrant safe.'},
    ]
  },
  {
    v: 'v24.31', date: '29.04.2026',
    headline: 'Großes Update: 99 Arten · 130 Wissens-Items · 30 Achievements · Klimazonen · Volltext-Suche',
    summary: 'Massive Erweiterung: +29 species (Pilze/Bäume/Kräuter), +20 Rezepte, +20 Heilmittel, +12 Folklore, +10 Techniken, +30 Quizzes, NEUES Achievement-System mit 30 Badges, NEUE vereinte Volltext-Suche-View über alle 5 Wissens-Tabellen, NEUE Klimazonen-Felder + Phänologie auf species. Plus: globale Wissens-Suche im Wissens-Header der durch alles durchsucht.',
    items: [
      {emoji:'🍄', bold:'10 neue Pilze:', text:' Steinpilz, Pfifferling, Wiesen-Champignon, Knollenblätterpilz (TÖDLICH-Markierung), Marone, Parasol, Hallimasch, Totentrompete, Fliegenpilz, Shiitake. Mit Tox-Level + Verwechslungs-Warnungen.'},
      {emoji:'🌳', bold:'10 neue Bäume:', text:' Apfelbaum, Birnbaum, Sauerkirsche, Walnussbaum, Esskastanie (Tessin!), Stieleiche, Winterlinde, Hängebirke, Arve (Alpen-Königin), Weisstanne. Mit Heilanwendungen + Holznutzung.'},
      {emoji:'🌿', bold:'10 neue Heilkräuter:', text:' Mariendistel (Leber), Beifuss, Pfefferminze, Zitronenmelisse, Rosmarin, Thymian, Salbei, Basilikum, Petersilie, Schnittlauch.'},
      {emoji:'🍴', bold:'+20 Rezepte (jetzt 30):', text:' Birkenwasser, Rosenblütensirup, Quittengelee, Zwetschgenmarmelade, Apfelmus, Walnusslikör (Nocino), Sauerkraut selber, Schlehengeist, Feigenkonfitüre, Fichtensirup, Birnenbrot, Rotkleesirup, Giersch-Quiche, Tannenspitzenhonig, Mostbirnen-Chutney, Kürbissuppe, Hagebuttentee, Vogelbeer-Likör, Mistel-Öl, Johannisbeer-Essig.'},
      {emoji:'💊', bold:'+20 Heilmittel (jetzt 30):', text:' Mariendistel, Ringelblumensalbe, Ginkgo, Arnika, Baldrian, Hopfen, Wermut, Eibisch, Lavendel-Öl, Aloe Vera, Rosenwasser, Echinacea, Weidenrinde, Honig (WHO!), Ingwer, Birkenblätter, Sauerkrautsaft, Birne-Husten, Zwiebel-Säckchen, Kartoffelwickel.'},
      {emoji:'📜', bold:'+12 Folklore (jetzt 20):', text:' Eberesche-Blitzschutz, Kastanie-Hosentasche, Apfel-Paradies, Thymian-Bettchen, Walnuss-Hochzeit, Schafgarbe-Achilles, Johannisbeere-Kalender, Kräuterbuschen Maria, Schwarzdorn-Stab, Blutweiderich, Lavendel-Marienkraut, Beifuss-Pilger.'},
      {emoji:'🛠️', bold:'+10 Techniken (jetzt 20):', text:' Kräuterspirale, Hochbeet-Schichten, Saatbett, Phazelia-Gründüngung, Saatgut-Gewinnung, Obstbaum-Veredeln, Februar-Schnitt, Kompost 3:1, Terra-Preta, Sommer-Aussaat.'},
      {emoji:'🏆', bold:'NEUES Achievements-System (30 Badges):', text:' achievements_catalog + user_achievements Tabellen. Kategorien: explorer/collector/gardener/healer/sage/community/milestone. Rarity: common→legendary. Beispiele: First-Scan (20 XP), 100-Tage-Streak (500 XP), Master-Gardener (1000 XP, legendary).'},
      {emoji:'🔍', bold:'NEUE Volltext-Suche v_knowledge_search:', text:' VIEW vereint alle 5 Wissens-Tabellen (199 Einträge searchable). RPC fn_knowledge_search(q, lim) macht pg_trgm-fuzzy-Suche mit Title-2x-Gewichtung. Frontend: globale Suchbar im Gartenwissen-Header — durchsucht alle Tabs auf einmal mit Type-Badges + Confidence-%.'},
      {emoji:'🏔️', bold:'Klimazonen + Phänologie auf species:', text:' climate_zones[] (CH H1-H7), elevation_min/max_m, sow_months[], plant_months[]. Backfill für 19 species: Alpen-Pflanzen → H6/H7, Mittelland → H1-H4, Esskastanie nur Tessin H1-H2.'},
      {emoji:'⚡', bold:'+30 Quizzes (jetzt 65):', text:' Knollenblätterpilz-Volva, Birken-Saft-Saison, Phytoöstrogene, Hügelkultur, Aescin (Rosskastanien), Pro Specie Rara, Quincunx-Pflanzung u.v.m.'},
      {emoji:'📊', bold:'DB-Statistik:', text:' 99 species (17 ornamental, 19 mit Klimazonen) · 30 recipes · 30 remedies · 20 folk_lore · 20 garden_techniques · 30 achievements · 199 searchable · 80+60+36+65 Snippets/Tipps/Highlights/Quizzes.'},
    ]
  },
  {
    v: 'v24.30', date: '29.04.2026',
    headline: 'Final-Audit: Filter-Reset · Slug-Härtung · Blumen-Seeds · Bibliothek-Hub',
    summary: 'Fünf konkrete Schwachstellen aus dem Vorher-Audit gefixt. Filter werden beim Tab-Wechsel sauber separat gehalten. Slug-Dedupe verhindert false-merge bei generischen Titeln. Blumen-Tab füllt sich mit 14 Schweizer Wildblumen + 7 ornamental-markierten existierenden. Bibliothek wird Hub mit klickbaren Stats-Karten zu allen 5 Wissens-Tabs.',
    items: [
      {emoji:'🔍', bold:'Filter-State pro Section:', text:' Vorher hat Filter (Suche/Kategorie) bei Tab-Wechsel mitgeschleppt — Verwirrung. Jetzt: window._gsKbFilters = { rezepte: {}, heilmittel: {}, ... } via _gsKbGetFilter(section)-Helper. Tab-Wechsel = saubere Filter-Separation.'},
      {emoji:'🔧', bold:'Loading-ID-Mismatch behoben:', text:' Bibliothek nutzte „bibliothek-loading" als Element-ID, neue Tabs nutzten „kb-loading" — Loading-Text wurde nicht aktualisiert. Jetzt: gsRenderBibliothek liest beide IDs (kb-loading bevorzugt).'},
      {emoji:'🪪', bold:'Slug-Härtung in Edge Function v7:', text:' Vorher: slug = slugify(title). Bei „Salbei-Tee" hätten alle Salbei-Tee-Rezepte (für Husten, Verdauung, Zahnfleisch) gemerged. Jetzt: slugifyWithDisambig(title, disambig) hängt 6-char-Hash der ersten Zutat / des Ailments / region+era / short_desc an. „salbei-tee-x7k2nq" ≠ „salbei-tee-3a9bm1".'},
      {emoji:'🤖', bold:'Multi-Extract max_tokens 6000 → 8000:', text:' Bei dichten Pflanzen-Büchern (200+ Arten + Rezepte) reichten 6000 Tokens nicht — Output wurde abgeschnitten. Jetzt 8000 = ~3500 Wörter pro Seite.'},
      {emoji:'🌸', bold:'14 Schweizer Wildblumen geseeded:', text:' Alpenrose, Edelweiss, Frühlingsenzian, Klatschmohn, Kornblume, Sonnenblume, Ringelblume, Lavendel, Kapuzinerkresse, Alpenmohn, Aurikel, Hagebutten-Rose, Wald-Akelei, Phazelia. Mit bloom_color, fragrance, pollinator_value (low/medium/high/very_high). Plus species_cat_check erweitert: flower/shrub/lichen/plant/herb/tree/fungi.'},
      {emoji:'✨', bold:'Existing species ornamental-markiert:', text:' Pattern-Update auf Name (Blume/Rose/Narzisse/Tulpe/Krokus/Glöckchen) oder cat=flower → 7 weitere existing als ornamental markiert. Total ornamental jetzt 17 (vorher 0). Blumen-Tab nicht mehr leer.'},
      {emoji:'🏠', bold:'Bibliothek als Hub:', text:' Statt nur species-Liste — neue Stats-Card oben mit klickbaren Buttons zu 5 Tabs (📚 Arten, 🍴 Rezepte, 💊 Heilmittel, 📜 Folklore, 🛠️ Techniken) inkl. Live-Counts. Macht die ganze Wissens-Architektur sichtbar.'},
      {emoji:'🛡️', bold:'species_cat_check erweitert:', text:' Vorher nur 12 Werte (wildpflanze/baum/kraut/pilz/...). Jetzt zusätzlich flower/shrub/lichen/plant/herb/tree/fungi — Edge Function v7 kann nun KI-extrahierte Categories direkt mappen ohne CHECK-Violation.'},
    ]
  },
  {
    v: 'v24.29', date: '29.04.2026',
    headline: 'Multi-Type-Buch-Wissen: Rezepte · Heilmittel · Folklore · Techniken · Blumen',
    summary: 'Buch-Einlesen extrahiert jetzt 5 Wissens-Typen statt nur Arten: species + recipes + remedies + folk_lore + garden_techniques. Dazu 4 neue Tabellen mit RLS, Dedupe-Indizes, Auto-Pipeline. Plus 5 neue Tabs in Gartenwissen. 38 Seed-Inhalte (10 Rezepte + 10 Heilmittel + 8 Folklore + 10 Techniken).',
    items: [
      {emoji:'🍴', bold:'NEUE Tabelle recipes:', text:' Wildkräuter-/Garten-Rezepte mit ingredients[], steps[], prep_time, difficulty, servings, season, species_refs[], sources jsonb für Buch-Tracking. Seeded mit 10 Klassikern (Holundersirup, Brennnessel-Pesto, Bärlauch-Butter, Hagebutten-Marmelade, Löwenzahn-Honig, Giersch-Salat, Brennnessel-Jauche, Rosskastanien-Seife u.a.).'},
      {emoji:'💊', bold:'NEUE Tabelle remedies:', text:' Heilmittel mit ailment, preparation, dosage, contraindications, evidence_level (traditional/folk/clinical/strong_clinical). Seeded mit 10 ESCOP/HMPC-fundierten Anwendungen (Lindenblüten, Spitzwegerich, Johanniskraut, Königskerze, Schafgarbe, Huflattich-PA-Warning, Rosskastanien-Aescin, Kamille, Mistel, Thymian-Inhalation).'},
      {emoji:'📜', bold:'NEUE Tabelle folk_lore:', text:' Volkskunde mit region, era, category (myth/tradition/folk_belief/ritual/symbolism). Seeded mit 8 Schweizer/alpinen Bräuchen (Bärlauch-Walpurgis, Mistel-Druiden, Sieben-Kräuter Johannistag, Wachholder-Alpsegen, Holler-Stube als Frau-Holle-Wohnsitz u.a.).'},
      {emoji:'🛠️', bold:'NEUE Tabelle garden_techniques:', text:' Anbau-Methoden mit short_desc, body, steps[], benefits[], tools[], category (soil/permaculture/companion/pest_control etc.). Seeded mit 10 Klassikern (Drei-Schwestern, Hügelkultur Sepp Holzer, Mischkultur, Mulchen, Komposttee, Lasagne-Gardening Patricia Lanza, Marienkäfer-Lockmittel, Frostschutz Obstblüten, Senf-Gründüngung, Schneckenzaun).'},
      {emoji:'🌸', bold:'species erweitert um Blumen-Felder:', text:' bloom_color, fragrance, pollinator_value (low/medium/high/very_high), is_ornamental. Index für is_ornamental. Filter „Blumen"-Tab nutzt das.'},
      {emoji:'🤖', bold:'Edge Function v6 — Multi-Type-Extraction:', text:' Anthropic-Prompt extrahiert jetzt EIN JSON-Object mit 5 Arrays. Pro Typ separate Insert-Logik mit slug-basiertem Dedupe via upsertWithDedupe. Recipes/Remedies/Lore/Techniken werden DIREKT in Ziel-Tabelle geschrieben (kein Review-Schritt nötig — gleich nutzbar). Species bleibt als book_species_candidates für manuellen Review (Auto-Approve >=0.85).'},
      {emoji:'📚', bold:'5 neue Gartenwissen-Tabs:', text:' 🌸 Blumen (species WHERE is_ornamental), 🍴 Rezepte, 💊 Heilmittel, 📜 Folklore, 🛠️ Techniken. Jeder Tab mit eigenem Renderer (gsRenderKnowledge), Live-Filter (Suche + Kategorie-Select), spezifischer Card-Layout pro Typ (Heilmittel zeigt Evidence-Level-Badge in Farbe, Rezepte mit ausklappbaren Zutaten/Schritten, Techniken mit benefits-Liste).'},
      {emoji:'🔁', bold:'Slug-Dedupe für alle 4 Typen:', text:' UNIQUE INDEX auf lower(slug) für recipes, remedies, folk_lore, garden_techniques. Bei Konflikt: sources-Array verlängern + data merged_count++. Mehrere Bücher mit gleichem Rezept = 1 Eintrag mit N Quellen.'},
      {emoji:'🔍', bold:'pg_trgm-Indizes für künftige fuzzy-search:', text:' title_trgm + ailment_trgm Indizes (gin_trgm_ops). Vorbereitet für „Lindenblütentee" findet auch „Linden-Tee".'},
      {emoji:'📊', bold:'extraction_stats in book_ingest_jobs.metadata:', text:' Pro Seite: {species, recipes:{ins,mrg}, remedies:{ins,mrg}, folk_lore:{ins,mrg}, techniques:{ins,mrg}}. Audit-Trail wie viel pro Typ pro Seite extrahiert.'},
      {emoji:'🌱', bold:'38 Seed-Einträge:', text:' DB startet nicht leer — 10 Rezepte + 10 Heilmittel + 8 Folklore + 10 Techniken vorausgefüllt mit FiBL/ESCOP/HMPC/Schweizer-Volksmedizin-fundierten Inhalten.'},
    ]
  },
  {
    v: 'v24.28', date: '29.04.2026',
    headline: 'Buch-Wissen automatisch sortiert · Dedupliziert · Sichtbar in Gartenwissen → Bibliothek',
    summary: 'Massiver Schema-Drift-Bug entdeckt: Edge Function v3/v4 schrieb name_de/name_lat/family/category — species-Tabelle hat aber name/lat/fam/cat. Auto-Approve hätte NIE funktioniert. v5 mit korrektem Mapping + Dedupe via lat-UNIQUE-Index + pg_trgm-fuzzy-match. Plus: neuer Bibliothek-Tab in Gartenwissen mit Live-Filter. Plus: nach Buch-Upload läuft Auto-Approve automatisch (kein manueller Klick mehr).',
    items: [
      {emoji:'🔧', bold:'Schema-Mapping korrigiert (v5):', text:' Edge Function mappt jetzt richtig: name_de→name, name_lat→lat, family→fam, category→cat, toxic+tox_level→tox(0-5). uses+medicinal_use kombiniert. extra-Daten (raw_extract, altitude, color, confidence) in data jsonb. sources jsonb-Array für Multi-Buch-Quellen.'},
      {emoji:'🔍', bold:'Dedupe via lat-UNIQUE-Index:', text:' Migration v24_28_species_dedupe_indexes: case-insensitive UNIQUE auf lower(lat). Bei Konflikt: UPDATE (Source-Merge) statt INSERT. pg_trgm-Indizes für künftige fuzzy-Matches.'},
      {emoji:'📚', bold:'Neuer Tab „Bibliothek" in Gartenwissen:', text:' 9. Kapitel mit Live-Daten aus species (data->>source = book_ingest). Filter nach Familie + Kategorie + Volltext-Suche. Stats-Card (essbar/giftig/heilend). Quellen-Footer: welche Bücher mit wie vielen Arten.'},
      {emoji:'⚡', bold:'Auto-Pipeline nach Upload:', text:' Nach Extraktion läuft auto_approve mit threshold 0.85 automatisch — kein User-Klick mehr nötig. Toast „📚 X Arten in Bibliothek". Niedrigere Confidence bleibt für manuellen Review unten.'},
      {emoji:'🔗', bold:'Source-Tracking jsonb-Array:', text:' Jedes species hat sources[] mit {kind:book, job_id, candidate_id, ref:"S.42", confidence, imported_at}. Bei Merge wird Array verlängert — sieht man wie viele Bücher dieselbe Art beschreiben.'},
      {emoji:'📊', bold:'View v_species_stats:', text:' Pro source × cat: count, edible_count, toxic_count, medicinal_count. Nutzbar für Statistiken in der Bibliothek.'},
      {emoji:'🎯', bold:'Selektiver Merge:', text:' Bei existierender species werden nur LEERE Felder mit Buch-Daten gefüllt — manuelle Edits bleiben erhalten. sources-Array wird ergänzt, data-blob mit merged_from_books-Counter.'},
      {emoji:'📋', bold:'Status nach Upload:', text:' merged|approved|rejected|pending. Auto-Approve setzt merged ODER approved je nachdem ob existing oder neu. status-message: „X neu + Y mit existierenden zusammengeführt".'},
    ]
  },
  {
    v: 'v24.27', date: '29.04.2026',
    headline: 'Buch-Einlesen v4 robust · Auto-Approve Wissens-DB · 4 DBs massiv erweitert',
    summary: 'Drei Audit-Punkte sauber gelöst: (1) Buch-Einlesen 23514-Fehler war PostgREST-Schema-Cache + Edge Function v3 schickte filename=null obwohl Tabelle es noch wollte. Edge Function v4 mit detaillierter DB-Diagnose, filename-Backwards-Compat, neuer auto_approve-Action. (2) Buch-Workflow erweitert: Auto-Approve-Bar mit Confidence-Threshold (0.6/0.75/0.85/0.95) — alle Kandidaten in einem Klick in Wissens-DB. (3) Datenbanken massiv erweitert: did_you_know_facts 40→80, seasonal_tips 32→60, seasonal_highlights 18→36, daily_quizzes 5→35.',
    items: [
      {emoji:'🔧', bold:'book-ingest Edge Function v4:', text:' Modell-Fallback-Chain (claude-sonnet-4-5 → 4-5-20250929 → 3-5-sonnet-20241022). filename + user_id Backwards-Compat (für alte NOT-NULL-Constraints). pages_total + total_pages parallel gesetzt. Bei DB-Fehler: detaillierte Diagnose ans Frontend (db_status, db_body, payload_summary).'},
      {emoji:'⚡', bold:'NEUE Action auto_approve:', text:' Edge Function nimmt alle book_species_candidates eines Jobs mit confidence >= threshold und merged sie batch-mäßig in species (Wissens-DB). Mit raw_extract als extra-jsonb für Audit-Trail. UI: Confidence-Threshold-Selector (0.6/0.75/0.85/0.95) + großer Approve-Button.'},
      {emoji:'🔄', bold:'PostgREST Schema-Cache-Reload:', text:' Nach allen Schema-Migrations NOTIFY pgrst, "reload schema" — verhindert dass alte Cache-Versionen weitere PGRST204-Fehler werfen.'},
      {emoji:'🗑️', bold:'Test-Inserts cleanup:', text:' Alte Test-Daten aus book_ingest_jobs entfernt.'},
      {emoji:'📚', bold:'did_you_know_facts +40 (auf 80):', text:' Schweizer Wildpflanzen, Pilze, Wald, Garten, Bestäuber, Mondkalender, Heilpflanzen, Schädlinge, Klima — FiBL/Pro-Specie-Rara-fundiertes Wissen mit konkreten Mengen + Daten.'},
      {emoji:'🌱', bold:'seasonal_tips +28 (auf 60):', text:' Pro Monat 2-4 Tipps. Eisheilige, Bärlauch-Vorsicht, Tomaten ausgeizen, Holundersirup-Rezept, Pilz-Goldener-Schnitt, Walnuss-Ernte, Brennnessel-Jauche-Rezept, Igel-Quartier u.v.m.'},
      {emoji:'🌟', bold:'seasonal_highlights +18 (auf 36):', text:' Schneeglöckchen (Februar), Huflattich, Klatschmohn, Lindenblüte, Johannisbeere, Eierschwamm, Walnuss, Mirabellen, Marone (Tessin), Schlehe (Frost-Süßung), Birkenwald-Saft, Christrose. Mit Verwechslungs-Warnung wo nötig (Maiglöckchen!).'},
      {emoji:'🎯', bold:'daily_quizzes +30 (auf 35):', text:' Multiple-Choice mit Erklärung — Bärlauch-Identifikation, Mykorrhiza, Eisheilige, Knollenblätterpilz-Volva, F1-Hybriden, Drei-Schwestern-Permakultur, Maria Thun Mondkalender, Buchsbaum-Zünsler, Wildbienen-Arten u.v.m.'},
    ]
  },
  {
    v: 'v24.26', date: '29.04.2026',
    headline: 'Audit-Pass: Reminders intelligenter · Buch-Speicherort · Notif-Deep-Links · DB-Cleanup · Sync-Status',
    summary: 'Großer 6-Phasen-Audit: (A) DB hatte 15 leere legacy_*-Tabellen — gelöscht. Plus search_path-Hardening auf eigenen v24.24/25-Funktionen. (B) Buch-Einlesen speichert jetzt das Original-PDF im neuen book-pdfs-Storage-Bucket — Admin kann später Re-Download für Re-Parsing. (C) Reminder-Engine erweitert: 1 Tag Pre-Reminder + Snooze-Tabelle + Per-Plant-Toggle in user_app_state.reminder_prefs. (D) Notif-Center hatte einen stillen Bug: action_url statt link → Click ging nirgends hin. Plus Snooze-Button direkt im Notif-Item. (E) gsCloudSync.status() + .syncNow() für UI-Statusanzeige. (F) Edge Functions auditiert (11 ACTIVE, 2 obsolet markiert).',
    items: [
      {emoji:'🗑️', bold:'15 leere legacy-Tabellen entfernt:', text:' legacy_app_settings/audit_log/book_ingest_jobs/book_species_candidates/feedback_items/post_comments/post_likes/quiz_answers/scan_corrections/social_posts/species_proposals/stripe_customers/stripe_prices/stripe_subscriptions/stripe_webhook_events. Schema sauberer, Backups bleiben (legacy_species, legacy_did_you_know_facts, legacy_daily_quizzes, legacy_profiles, legacy_user_scans haben noch Daten).'},
      {emoji:'🔧', bold:'Postgres-Funktion search_path gehärtet:', text:' fn_generate_plant_reminders + _update_user_app_state_ts haben jetzt SET search_path=public,pg_catalog. Linter-Warning weg.'},
      {emoji:'📚', bold:'Buch-Einlesen mit Cloud-Speicherort:', text:' Neuer Storage-Bucket book-pdfs (privat, 50MB Limit, application/pdf only). RLS: nur Owner+Admin SELECT/DELETE, nur is_expert/is_admin INSERT. Frontend uploadet PDF VOR Parsing zu <uid>/<uuid>_<filename>.pdf, schickt storage_path mit start-Action. Bei Upload-Fehler: graceful fallback ohne Speicherort.'},
      {emoji:'⏰', bold:'Pre-Reminder 1 Tag vorher:', text:' Cron erzeugt jetzt zwei Reminder pro Aufgabe: Pre (Vortag, kind=plant_task_pre, Format „⏰ Morgen: 💧 Pflanze — Giessen") + Due (Tag selbst, kind=plant_task). Macht Vorbereitung möglich.'},
      {emoji:'⏸️', bold:'Snooze-Tabelle plant_reminder_snoozes:', text:' (user_id, dedup_key, snoozed_until). Cron checkt vor INSERT — übersprungen wenn snoozed_until>heute. Frontend gsSnoozePlantReminder(dedupKey, days). UI-Button im Notif-Item rechts (⏰).'},
      {emoji:'🔕', bold:'Per-Pflanzen Reminder-Toggle:', text:' user_app_state.data.reminder_prefs.disabled[plantId]=true → Cron skipped diese Pflanze komplett. Frontend gsToggleReminderForPlant(plantId, enabled). gs_reminder_prefs als state-Key gepatched für Auto-Sync.'},
      {emoji:'🔗', bold:'Notif-Click Deep-Link gefixt:', text:' BUG: gsCollectNotifs nutzte n.action_url, DB-Spalte heißt aber link. Click ging nirgends hin. Jetzt: link mit #-Anker triggert switchTab(tab), http://-Link öffnet window.open, sonst location.href. Plus Emoji-Auto-Extraktion aus Title.'},
      {emoji:'🔔', bold:'Notif-Item Icon nach kind:', text:' plant_task=🌱, achievement=🏆, marketplace=🛒, sensor_alert=⚠️ — Fallback wenn Title kein Emoji hat.'},
      {emoji:'🩺', bold:'gsCloudSync.status() + .syncNow():', text:' Public API für UI: returnt {ok, dirty[], pendingOps, lastPush, lastPushAgeSec, canPush, online}. syncNow() macht flush + pull, returnt status. Bereit für Sync-Indicator-Widget.'},
      {emoji:'🧹', bold:'Edge Functions Audit:', text:' 11 ACTIVE in Supabase: stripe-checkout/portal/webhook/bootstrap, send-receipt, admin-seed-species, book-ingest v3, feedback-triage, delete-user v2, plus 2 obsolete (create-checkout, customer-portal — keine Frontend-Referenzen mehr, Cleanup für später).'},
      {emoji:'⏰', bold:'Reminder-Read auch für pre-Variante:', text:' gsMarkPlantReminderRead PATCHt jetzt sowohl plant_task als auch plant_task_pre dedup_keys auf is_read=true.'},
    ]
  },
  {
    v: 'v24.25', date: '29.04.2026',
    headline: 'Buch-Einlesen fixed · KI-Planer erzwingt jetzt deine Eingaben · Plant-Reminders Cross-Device via Server-Cron',
    summary: 'Drei Audit-Punkte sauber gelöst: (1) Buch-Einlesen 400-Error war Schema-Mismatch — Tabelle hatte 9 Spalten, Edge Function v3 schreibt 13. Migration ergänzt fehlende Spalten in book_ingest_jobs + book_species_candidates. (2) KI-Planer ignorierte Form/Anmerkung trotz Prompt-Anweisungen. Jetzt: JSON-Schema mit Pflichtfeld constraints_applied + plant-level matches_wish/matches_constraint. Client-side Validator prüft und zeigt Banner bei Lippenbekenntnissen mit Re-Generate-Button. (3) Plant-Erinnerungen waren device-bound (Browser-Notif) und Tage-Berechnung war ungenau (Math.round auf time-of-day-Differenz). Jetzt: Server-Cron via pg_cron läuft täglich 07:00 UTC, schreibt Reminders in notifications-Tabelle mit dedup_key — jedes eingeloggte Gerät pulled das beim nächsten Boot. Plus Datums-basierte Tage-Berechnung.',
    items: [
      {emoji:'📚', bold:'Buch-Einlesen 400-Error gefixt:', text:' book_ingest_jobs hatte nur 9 Spalten (id, user_id, filename, status, …), Edge Function v3 schreibt aber: uploaded_by, book_title, book_author, book_year, book_isbn, storage_path, total_pages, ocr_language, metadata, status_message, extracted_species_count, approved_species_count. Migration v24_25_book_ingest_jobs_schema ergänzt + RLS + Index. Plus book_species_candidates: emoji, tox_level, medicinal, habitat, altitude, season, color, uses, medicinal_use, warning, lookalike ergänzt.'},
      {emoji:'🛡️', bold:'KI-Planer JSON-Schema-Pflichtfeld constraints_applied:', text:' shape_handled, wishes_addressed, constraints_addressed, checklist mit konkreten Bezügen — keine Floskeln zugelassen. Plus plant-level matches_wish + matches_constraint Booleans.'},
      {emoji:'🔍', bold:'Client-Side-Validator gsPPvalidateConstraints:', text:' Prüft ob die KI-Antwort substantiell ist (mind. 25 Zeichen pro Feld) UND ob ≥60 % der Pflanzen matches_wish=true haben UND ob keine matches_constraint=false-Pflanzen vorkommen. Bei Issue: roter Banner über dem Plan mit Liste aller Probleme + „🔄 Plan neu generieren — strenger"-Button. Bei OK: grüner Banner mit Beweis-Text was angewendet wurde.'},
      {emoji:'⏰', bold:'Plant-Reminders Server-Cron:', text:' Neue Postgres-Funktion fn_generate_plant_reminders() iteriert über alle user_plants.data.plants[].tasks[*], prüft lastDone+intervalDays gegen current_date, INSERT in notifications mit dedup_key (verhindert Duplikate bei mehrfacher Ausführung). pg_cron-Schedule plant-reminders-daily läuft 07:00 UTC täglich.'},
      {emoji:'📅', bold:'getDaysUntilDue Datums-basiert:', text:' Vorher Math.round((interval - diff_in_hours)/24) — Drift weil rounding. Bsp.: 1.6 Tage seit Giessen, Intervall 2 → round(0.4)=0 → „jetzt fällig" obwohl 0.4 Tage übrig. Jetzt: setHours(0,0,0,0) auf beide Datums, Differenz in ganzen Tagen. „Morgen fällig" heißt jetzt morgen Mitternacht.'},
      {emoji:'🔄', bold:'Cross-Device-Reminder-Sync:', text:' Beim doneTask/gsQuickDone: gsMarkPlantReminderRead(plantId, taskKey) PATCHt alle passenden notifications-Rows auf is_read=true. Anderes Gerät pulled notifications und sieht Reminder weg — keine doppelten Erinnerungen.'},
    ]
  },
  {
    v: 'v24.24', date: '29.04.2026',
    headline: 'Wirklich ALLES synct: Streak, Chat, Quiz, Tracks, Theme — und KI-Planer respektiert jetzt deine Eingaben',
    summary: 'Cross-Device-Sync war auf plants/garden begrenzt. Jetzt: neue Tabelle user_app_state mit 18+ zusätzlichen Daten-Scopes (Streak, KI-Chat, Plant-Doctor, Quiz, GPX-Tracks, Theme, Saatgut, Achievements u.v.m.). localStorage-setItem ist gepatcht — sobald irgendein State-Key geschrieben wird, läuft Sync automatisch. Plus: KI-Planer hatte „Keine Messung gefunden"-Bug (las nur sessionStorage statt persistente Pro-Messung), Form/Anmerkung wurden im Kompakt-Modus ignoriert, gemessener Lux-Wert ging als Kategorie verloren.',
    items: [
      {emoji:'☁️', bold:'Neue Tabelle user_app_state mit RLS:', text:' jsonb-Blob analog user_plants/user_gardens. CASCADE auf auth.users-Delete. Trigger updated_at auto. Migration v24_24_user_app_state deployed.'},
      {emoji:'🪝', bold:'localStorage.setItem-Auto-Patch:', text:' Storage.prototype.setItem/removeItem ge-patcht — wenn ein gelisteter Key geschrieben wird, läuft markDirty automatisch. Keine manuellen Hooks an dutzenden Mutations-Stellen mehr nötig. _gsSyncPullInProgress-Guard verhindert Endlos-Schleife wenn Pull zurückschreibt.'},
      {emoji:'📦', bold:'18+ Scopes neu im Sync:', text:' streak, login_streak, chat_history, doctor_history, ki_analyses, dq_archive/stats/streak (Quiz), recipe_favs, recent_searches, ps_favs, ps_votes, gs_dead_plants, gs_seed_inventory, gs_gpx_tracks (Live-Tracks!), gs_dark/theme_color/lang, gs_achievements, gs_confirmed_species. Alles wird jetzt zwischen Geräten gesynct.'},
      {emoji:'⚖️', bold:'LWW auch für state:', text:' gleicher Pattern wie plants/garden — gs_sync_dirty_at_state vs cloud.updated_at, lokal neuer = SKIP overwrite + force re-push.'},
      {emoji:'🚛', bold:'One-Time-Migration v24.24:', text:' bestehende lokale state-Keys werden beim ersten Boot als „neuer als Cloud" markiert + initial-pushed.'},
      {emoji:'🩺', bold:'KI-Planer „Keine Messung" Bug:', text:' gsPPloadLastLux las nur sessionStorage (Tab-spezifisch, oft leer). Jetzt: localStorage gs_light_pro10_latest zuerst (10-Punkte-Pro-Messung, persistent), dann sessionStorage als Fallback. Plus: Quick-Lichtmessung spiegelt jetzt auch nach localStorage. Plus: bei Fehler ein klickbarer Link „jetzt Lichtmessung starten →".'},
      {emoji:'📐', bold:'Form/Anmerkung im Kompakt-Modus:', text:' Vorher: nur Größe + Boden-Typ + Licht-Kategorie. Jetzt: shape (z.B. „L-Form"), full Boden-Detail (Feuchte+pH), gemessener Lux-Wert, extra/Anmerkung. Pro-Modus war schon erweitert — jetzt mit „PFLICHT BEACHTEN"-Markierung damit die KI Inputs nicht ignoriert.'},
      {emoji:'☀️', bold:'Lux-Wert numerisch im Prompt:', text:' Wenn der Nutzer eine Lichtmessung gemacht hat, wird jetzt der präzise Wert (z.B. 12500 lx) ins Prompt geschickt — nicht nur die grobe Kategorie (Vollsonne/Halbschatten/Schatten). Sortenwahl wird damit präziser.'},
      {emoji:'🎯', bold:'System-Prompt: User-Input als Top-Priorität:', text:' Neue Prioritätsreihenfolge im Prompt: (1) Wünsche+Anmerkungen ABSOLUT, (2) Form, (3) Lux, (4) Arten-DB, (5) Fruchtfolge, (6) Mondphase. Wenn User „nur essbar/bienenfreundlich/keine Stachelgewächse" angibt, MUSS jede Pflanze daraufhin geprüft werden.'},
    ]
  },
  {
    v: 'v24.23', date: '29.04.2026',
    headline: 'Cross-Device-Sync sauber — alle Daten überall, keine Verluste mehr',
    summary: 'Großer Audit: bestehende Cloud-Sync-Pfade waren lückenhaft. Pflanzen-Push hatte 2.5s-Debounce der bei App-Schließen verloren ging. Garten-Tagebuch wurde nur indirekt mitgepusht. Ernten hatten gar keinen Cloud-Schreib-Pfad. Pull überschrieb lokal blind mit Cloud — Datenverlust wenn Cloud stale war. Jetzt: zentrale Sync-Engine mit Pending-Queue, beforeunload/pagehide-Schutz, Last-Write-Wins per Timestamp.',
    items: [
      {emoji:'☁️', bold:'Zentrale gsCloudSync-Engine:', text:' markDirty(scope)/flushDebounced(500ms)/flushNow() für synchrones Push beim Tab-Close. Pending-Queue in localStorage gegen Datenverlust bei Network-Fehler. Auto-Retry beim online-Event + alle 30s wenn dirty.'},
      {emoji:'🛡️', bold:'beforeunload + pagehide + visibilitychange:', text:' Push wird beim Schließen/Backgrounding der App synchron mit fetch keepalive ausgelöst. Mobile-Safari triggert oft kein beforeunload, daher zusätzlich pagehide + visibilitychange-hidden als Fallback.'},
      {emoji:'🧺', bold:'Ernten endlich in der Cloud:', text:' gsErnteAdd schreibt jetzt direkt in garden_harvests (uuid-id, species_name, ts, menge, unit). Bisher gingen Ernten beim Geräte-Wechsel komplett verloren. Pull mappt das Cloud-Schema (species_name) zurück ins lokale Format (pflanze).'},
      {emoji:'📔', bold:'Tagebuch sync sicher:', text:' gsTagebuchSave triggert markDirty(plants) — der plants-Blob (data.diary) wird damit zuverlässig mitgepusht, nicht nur indirekt nach einer Pflanzen-Mutation. Cloud→Local-Merge per id-Dedupe (kein Duplikat).'},
      {emoji:'⏳', bold:'Last-Write-Wins beim Pull:', text:' Vorher überschrieb der Pull lokale Daten blind mit Cloud — wenn Cloud stale war (z.B. weil der letzte Push fehlgeschlagen ist), ging frischeres Lokal verloren. Jetzt: gs_sync_dirty_at_<scope> wird bei jeder Mutation gesetzt. Im Pull: wenn local-dirty > cloud.updated_at → SKIP overwrite + force re-push. Cloud bleibt nie länger stale als ein Push-Zyklus.'},
      {emoji:'🔁', bold:'30s Visibility-Sync (vorher 2min):', text:' App kommt aus dem Hintergrund → re-pull. Cooldown von 2min auf 30s reduziert weil LWW jetzt sicher gegen stale-Overwrite ist. Echtes Cross-Device-Gefühl ohne WebSockets.'},
      {emoji:'🚛', bold:'One-Time-Migration für bestehende User:', text:' Wer schon Daten lokal hat aber keinen dirty-Marker (Pre-v24.23): wird beim ersten Boot von v24.23 automatisch als "lokal neuer als Cloud" markiert + Push wird getriggert. Bestehende Ernten werden per Backfill-Queue einzeln in garden_harvests nachgetragen. Idempotent via gs_sync_v24_23_migrated-Flag.'},
      {emoji:'🔬', bold:'Debug-Hook:', text:' window.gsCloudSync.debug() returnt {dirty, queue, lastPush, uid, canPush} für Diagnose im Konsolen-Log.'},
    ]
  },
  {
    v: 'v24.22', date: '28.04.2026',
    headline: 'Globaler Key funktioniert jetzt wirklich für alle — sauber gegen das Abo gegated',
    summary: 'Drei substantielle Fixes am Key-System: (1) 404-Bug beim Test gefixt — Walker geht die volle Fallback-Chain durch statt auf claude-3-5-sonnet-latest zu pinnen (das ist ausphasiert). (2) Quota-Gate gegen das Abo: Free-User bekommen 15 KI-Aufrufe/Tag mit dem globalen Key, Plus/Pro/Lifetime unbegrenzt, BYO-Key umgeht Quota komplett. (3) Personal-Key hat jetzt Vorrang vor global — wer sich einen eigenen einträgt, nutzt ihn auch.',
    items: [
      {emoji:'🩺', bold:'404-Test-Bug gefixt:', text:' Test-Funktion (Admin-Modal + Connection-Test + Health-Check) walkt jetzt _gsClaudeFallbacks durch statt claude-3-5-sonnet-latest zu pinnen. Erstes funktionierendes Modell wird in gs_claude_model gemerkt → Hot-Path trifft beim ersten Versuch. 401/403 = Key kaputt, alle 404 = Modell-Liste veraltet. Klare Toasts pro Reason.'},
      {emoji:'🚦', bold:'Free-Tier Quota: 15 KI-Aufrufe/Tag', text:' callAI + callVisionAI checken jetzt gsAboCanUse(\'ai_call\') wenn der globale Key benutzt wird. Free-User: 15 Aufrufe/Tag (alle KI-Features zusammen — Scan, Chat, Plan, Pflegeberatung, Plant-Doctor, Boden). Plus/Pro/Lifetime: unbegrenzt. Bei Limit-Erreichung klare Upgrade-Meldung mit Hinweis auf BYO-Key-Alternative.'},
      {emoji:'🔑', bold:'Personal-Key gewinnt jetzt:', text:' getApiConfig priorisiert ps_api_key (BYO) vor gs_global_api_key. Wer einen eigenen Key reinklebt, nutzt ihn auch — keine Quota läuft gegen ihn (er zahlt selbst). Vorher hat globalKey IMMER gewonnen, was den Punkt eines Personal-Keys quasi negiert hat.'},
      {emoji:'🏃', bold:'Race-Schutz beim Boot:', text:' Wenn callAI/callVisionAI VOR gsSyncUserDataOnLogin läuft (z.B. Auto-Refresh), pullen sie on-demand den globalen Key — kein „Key fehlt" mehr beim ersten Aufruf nach Login.'},
      {emoji:'🧹', bold:'nvapi-Reste rausgefiltert:', text:' Falls noch alte NVIDIA-Keys aus v24.17 oder früher in localStorage rumliegen, werden sie als ungültig behandelt statt durchzurutschen.'},
    ]
  },
  {
    v: 'v24.21', date: '28.04.2026',
    headline: 'Admin-UI: Globaler Claude-Key direkt in den Settings',
    summary: 'Der Admin-Modal für den globalen Key ist jetzt direkt in „Einstellungen → Admin" verlinkt — du musst nicht mehr die Browser-Konsole nutzen. Plus: alter Duplikat-gsAdminSetGlobalApiKey ganz entfernt.',
    items: [
      {emoji:'🤖', bold:'Neuer Settings-Eintrag „Globaler Claude-Key":', text:' Direkt unter „Supabase API-Key wechseln". Tap → Admin-Modal mit Status/Health/Eingabefeld/Test-Button.'},
      {emoji:'🧹', bold:'Letzter Duplikat-Bug entfernt:', text:' gsAdminSetGlobalApiKey hatte 2 Definitionen aus v24.19 — die alte Stub-Version komplett gelöscht. Jetzt wirklich nur eine.'},
      {emoji:'⚠️', bold:'Wichtiger Unterschied:', text:' „Einstellungen → KI & Scanner" = persönlicher Key (nur dein Gerät). „Einstellungen → Admin → Globaler Claude-Key" = DB-Key für ALLE User.'},
    ]
  },
  {
    v: 'v24.20', date: '28.04.2026',
    headline: 'API-Key Admin-UI + 30-Tage-Vorwarnung + Daily Health-Check',
    summary: 'Dediziertes Admin-Modal mit Status-Anzeige, One-Click-Test und Speichern. 30 Tage VOR Ablauf wird der Admin gewarnt (nicht erst danach). Daily Health-Check pingt täglich Anthropic — bei kaputt sofortige Toast-Warnung.',
    items: [
      {emoji:'🔑', bold:'Admin-Modal mit Status:', text:' gsOpenGlobalKeyAdmin() öffnet ein dediziertes Modal mit (a) aktuellem Key-Preview + Alter mit Color-Coding, (b) Live-Health-Test, (c) Eingabefeld + zwei Buttons „🩺 Erst testen" und „💾 Speichern + aktivieren", (d) Service-Toggle.'},
      {emoji:'⏰', bold:'30-Tage-Vorwarnung statt erst-nach-Ablauf:', text:' Bei Tag 150-180 (5 bis 6 Monate) sieht der Admin täglich einen Toast „API-Key läuft in X Tagen aus". Ab Tag 180 die Warn-Eskalation. Toast nur 1× pro Tag — kein Spam.'},
      {emoji:'🩺', bold:'Daily Health-Check:', text:' Bei jedem Login/Boot prüft die App (max 1× pro Tag) ob der Key noch funktioniert. Bei 401 → sofortige Admin-Warnung. Bei Network-Fehler → notice (transient). Bei OK → kein Toast (kein Lärm).'},
      {emoji:'🔌', bold:'Service-Toggle:', text:' Falls du den Service mal deaktivieren willst (Kosten-Kontrolle, Wartung), ein Klick im Admin-Modal — alle User müssen dann eigenen Key eintragen. Mit Bestätigungsdialog.'},
      {emoji:'⚠️', bold:'Warum kein Auto-Renew?', text:' Anthropic generiert API-Keys nur über die Console, nicht via API. Auto-Erneuerung ist technisch nicht möglich. Aber: 30-Tage-Vorwarnung gibt dir Zeit, einen neuen Key zu erstellen und über das Admin-Modal einzutragen — kein User merkt was.'},
    ]
  },
  {
    v: 'v24.19', date: '28.04.2026',
    headline: 'Globaler API-Key sauber — keiner muss mehr Keys eintragen',
    summary: 'Drei Bugs am Server-Key-Mechanismus gefixt. Admin trägt EINEN Anthropic-Key ein (im Admin-Panel) — alle eingeloggten User bekommen ihn beim App-Start automatisch. Plus: Health-Check + 6-Monats-Erinnerung an den Admin.',
    items: [
      {emoji:'🐛', bold:'Doppelte Funktionen entfernt:', text:' Es gab zwei gsAdminSetGlobalApiKey-Funktionen — die zweite (fehlerhafte) hat die saubere RPC-Version überschrieben. Sie schrieb auf falschen DB-Key (global_api_key statt global_anthropic_api_key) → Key kam nie an. Nun nur eine Version, die den RPC fn_set_global_api_key nutzt.'},
      {emoji:'🩺', bold:'Health-Check beim Setzen:', text:' Beim Speichern eines neuen Keys wird sofort ein Test-Request an Anthropic gemacht. Bei Erfolg „✅ Key gespeichert + getestet". Bei Fehler „⚠️ Key gespeichert, aber Test fehlgeschlagen — Grund: …".'},
      {emoji:'⏰', bold:'6-Monats-Reminder:', text:' Beim Boot prüft die App ob der Set-Timestamp älter als 180 Tage ist. Wenn ja, sieht NUR der Admin einen Toast „Globaler API-Key ist X Monate alt — bitte erneuern". Normale User merken nichts.'},
      {emoji:'🔄', bold:'Auto-Pull beim Login + Boot:', text:' Eingeloggte User bekommen den Key über RPC fn_get_global_api_key automatisch. Wird in gsSyncUserDataOnLogin (bei Login + App-Boot + Tab-Wake) aufgerufen. Pro Cache-Hit max 5min, dann re-pull.'},
      {emoji:'📋', bold:'Was du JETZT einmalig tun musst:', text:' Im Admin-Panel deinen Anthropic-Key (sk-ant-…) eintragen. Danach läuft alles für alle User automatisch — bis zum nächsten 6-Monats-Reminder.'},
    ]
  },
  {
    v: 'v24.18', date: '28.04.2026',
    headline: 'NVIDIA komplett entfernt — nur Anthropic Claude',
    summary: 'Der hardcoded NVIDIA-Default-Key beim ersten App-Start wurde entfernt. Wenn dein Anthropic-Key beim Logout verloren ging, fiel die App vorher auf den NVIDIA-Default zurück und scheiterte. Jetzt: nur Anthropic. Auto-Migration räumt alte NVIDIA-Reste aus localStorage.',
    items: [
      {emoji:'🧹', bold:'Auto-Migration beim Boot:', text:' Wenn `ps_api_key` oder `gs_global_api_key` mit „nvapi-" beginnt, wird er automatisch entfernt. Auch `ps_api_provider=nvidia` und `gs_global_api_provider=nvidia` werden gelöscht. User wird gefragt seinen Anthropic-Key (sk-ant-…) einzutragen.'},
      {emoji:'🔑', bold:'getApiConfig: Provider immer anthropic:', text:' Kein Auto-Detect mehr basierend auf Key-Präfix. Wenn der Key kein „sk-ant-…"-Format hat, wird er als ungültig betrachtet (key=null) → klare Fehler-Meldung „API-Key fehlt".'},
      {emoji:'❌', bold:'callAI + callVisionAI NVIDIA-Pfade gelöscht:', text:' Beide Funktionen rufen jetzt direkt Anthropic an. Code 50% kürzer, weniger Edge-Cases.'},
      {emoji:'🔬', bold:'Connection-Test mit Format-Check:', text:' Prüft jetzt zuerst ob der Key mit „sk-ant-" beginnt — sonst sofort ❌ „Bitte Anthropic-Key eintragen".'},
      {emoji:'✨', bold:'Was du jetzt tun kannst:', text:' Plan-Generierung sollte direkt funktionieren mit deinem Claude-Key. Falls dein Key nicht mehr da ist (durch die Migration entfernt weil er nvapi war), oben rechts „API-Key" tippen und sk-ant-…-Key einfügen.'},
    ]
  },
  {
    v: 'v24.17', date: '28.04.2026',
    headline: 'NVIDIA Provider Auto-Fallback + echter Connection-Test',
    summary: 'NVIDIA-Provider hatte den gleichen Modell-Fallback wie Anthropic NICHT — wenn das Standard-Modell deprecated wurde, gab es einfach Fehler. Jetzt: 5-Modell-Fallback-Chain. Plus: Connection-Test prüft jetzt auch wirklich die NVIDIA-API mit Test-Request.',
    items: [
      {emoji:'🔬', bold:'Bug-Diagnose:', text:' User-Test zeigte 2× Grünes-Häkchen (Key + Internet) aber „alles OK" — die NVIDIA-API selbst wurde nie geprüft. Daher fiel auf, dass NVIDIAs „meta/llama-3.1-70b-instruct" möglicherweise nicht mehr verfügbar ist.'},
      {emoji:'🔁', bold:'NVIDIA-Modell-Fallback-Chain:', text:' Probiert sequenziell: llama-3.1-70b → llama-3.3-70b → llama-3.1-405b → mixtral-8x22b → llama-3.1-8b. Bei 404/400/„not_found" wird das nächste probiert. Erfolgreiches Modell wird in localStorage gespeichert (gs_nvidia_model).'},
      {emoji:'📡', bold:'Connection-Test prüft NVIDIA echt:', text:' Macht jetzt einen minimalen POST mit max_tokens:1 — bei 404 zeigt: „Modell nicht verfügbar". Bei 401: „Key ungültig". Plus echte Fehler-Body (max 200 chars).'},
      {emoji:'⚡', bold:'Network vs Modell-Fehler getrennt:', text:' Bei „Failed to fetch" wird sofort abgebrochen (Network-Issue). Bei 404/400 wird der nächste Modell-Kandidat probiert. Klare Trennung verhindert sinnlose Retries.'},
    ]
  },
  {
    v: 'v24.16', date: '28.04.2026',
    headline: 'KI-Planer Network-Diagnose + Verbindungstest',
    summary: 'Bei „Netzwerk-Fehler — keine Verbindung zur KI" gibt es jetzt einen 📡 Verbindung-testen-Button der konkret diagnostiziert: API-Key gesetzt? Internet erreichbar? Anthropic API erreichbar? Plus klare Empfehlung was zu tun ist.',
    items: [
      {emoji:'🔑', bold:'API-Key-Fehler explizit:', text:' Vorher gab callAI null zurück bei fehlendem Key — wurde dann irgendwo als Network-Fehler klassifiziert. Jetzt wirft callAI einen klaren Auth-Error, der korrekt als 🔑 erkannt wird.'},
      {emoji:'📡', bold:'Verbindungs-Test-Button:', text:' Bei isNet-Fehler erscheint ein „Verbindung testen"-Button. Prüft drei Sachen sequenziell: (1) API-Key vorhanden, (2) Internet allgemein per generate_204-ping zu Google, (3) Anthropic API direkt mit minimalem Request. Zeigt für jeden Punkt ✅/❌ + Latenz/Fehlermeldung.'},
      {emoji:'💡', bold:'Konkrete Diagnose-Empfehlung:', text:' Wenn alle Tests bestehen: „versuche nochmal". Wenn nicht: konkrete Hinweise (Key prüfen, Inkognito-Modus probieren, uBlock deaktivieren).'},
      {emoji:'📝', bold:'Klarere Network-Fehlermeldung:', text:' Listet die 4 möglichen Ursachen direkt in der Karte (Key fehlt/ungültig, Internet weg, Browser-Extension blockt api.anthropic.com, KI-Anbieter offline).'},
    ]
  },
  {
    v: 'v24.15', date: '28.04.2026',
    headline: 'KI-Planer Diagnose + Render-Hardening',
    summary: 'Beim Plan-Generations-Fehler werden jetzt die echten Details angezeigt. Plus: wenn der Render einen Bug hat, wird trotzdem ein Fallback gezeigt statt der generischen Fehler-Karte.',
    items: [
      {emoji:'🔍', bold:'Echte Fehlermeldung sichtbar:', text:' Bei „Plan konnte nicht erstellt werden" gibt es jetzt einen ausklappbaren „Technische Details"-Block mit der exakten Error-Message + Stacktrace. Plus differenziertes Icon (Netzwerk, JSON-Parse, Code-Bug, Timeout, Auth, Rate).'},
      {emoji:'🛡️', bold:'Render-Try-Catch:', text:' gsPPrenderPlan ist jetzt in einem eigenen try gewrapped — wenn das HTML-Building crasht (z.B. weil die KI ein erwartetes Feld nicht zurückgegeben hat), wird trotzdem ein minimaler Fallback gezeigt statt die generische „Plan fehlgeschlagen"-Karte.'},
      {emoji:'🐛', bold:'Klassifizierte Fehler:', text:' Network / Parse / ReferenceError werden jetzt erkannt und mit eigenem Icon angezeigt — statt alles als generischer Fehler.'},
    ]
  },
  {
    v: 'v24.14', date: '28.04.2026',
    headline: 'KI-Planer 3D: systematische Pflanzen-Anordnung im Grid',
    summary: 'Pflanzen werden jetzt als echtes Reihen-Grid platziert — nicht mehr als Cluster-Klumpen. Anhand von count und spacing_cm aus dem Plan wird die optimale Rows mal Cols-Aufteilung berechnet. Render ist deterministisch — gleicher Plan = identisches 3D, kein Chaos.',
    items: [
      {emoji:'🌱', bold:'Grid-Anordnung statt Cluster:', text:' Vorher hat das 3D-Modell pro Pflanzen-Rechteck EINEN Cluster gerendert (mit zufällig verteilten Sphären innen). Jetzt: aus count + spacing_cm wird die beste Rows-Cols-Aufteilung berechnet, jede einzelne Pflanze wird an ihrer exakten Grid-Position platziert. 12 Tomaten = 4-3 Grid wie im echten Garten.'},
      {emoji:'🎯', bold:'Deterministischer Seed:', text:' Math.random ersetzt durch seed-basiertes rand pro Pflanze (33 Stellen umgestellt). Wo Variation gebraucht wird (Frucht-Streuung am Tomatenstrauch), kommt sie jetzt aus dem Pflanzen-Namen — gleiche Pflanze rendert immer gleich, kein Chaos zwischen Re-Renders.'},
      {emoji:'📐', bold:'Best-Grid-Algorithmus:', text:' Wählt die Rows-Cols-Kombination, deren Aspect-Ratio am nächsten zur Aspect-Ratio des Rechtecks liegt (geometrische Distanz im log-Space). Slot-Größe = w/cols mal h/rows, Pflanze nimmt 85 Prozent des Slots ein damit Abstand sichtbar bleibt.'},
      {emoji:'🌽', bold:'Alternierende Reihen:', text:' Bei Bedarf wird jede zweite Reihe leicht versetzt (Quincunx-Style) für natürlicheren Look — wie ein echter Bauerngarten.'},
      {emoji:'🪴', bold:'Single-Plant-Geometrie:', text:' Pro Grid-Slot wird makeSinglePlant aufgerufen — eine Mini-Version der Pflanzen-Geometrie. Eine Tomate ist eine Tomate, nicht zehn überlagert.'},
      {emoji:'⚡', bold:'Performance:', text:' Material-Cache greift, Geometrie ist effizient. 38 separate Pflanzen-Meshes (typisches Beet) laufen weiterhin smooth auf Mobile.'},
    ]
  },
  {
    v: 'v24.13', date: '28.04.2026',
    headline: '3D-Track mit Sun-Light, Personal Records, Heatmap',
    summary: 'Phase 3 — 3D-Modell mit echtem Sonnenlicht und Schatten, Kilometer-Marker aus präzisen GPS-Distanzen, Personal Records (längster Track, höchster Anstieg, schnellste 1km-Pace) aus echten Daten, Heatmap aller Tracks auf der Karte.',
    items: [
      {emoji:'☀️', bold:'3D-Modell mit Sonnenlicht:', text:' MeshStandardMaterial statt MeshBasicMaterial — die Track-Tube reagiert jetzt auf Beleuchtung. DirectionalLight (Sonne) + AmbientLight + HemisphereLight (Sky/Ground-Bouncelight) für realistische Beleuchtung. PCFSoftShadowMap für weiche Schatten. Tube und Boden mit cast/receive shadow.'},
      {emoji:'🏁', bold:'Kilometer-Marker auf 3D-Track:', text:' Aus präzisen GPS-Haversine-Distanzen berechnet (kein %-Schätzen mehr). Stab + gelbe Kugel an jedem vollen Kilometer. Im 3D-Modell sofort zu sehen wo km 1, 2, 3 etc. sind — Garmin-Style.'},
      {emoji:'🏆', bold:'Personal Records:', text:' Längste Strecke, höchster Anstieg, schnellste 1km-Pace — alles aus echten Track-Stats berechnet. Mit Datum des Records. Werden in der Tracks-Liste als PR-Card oben angezeigt (sobald ≥2 Tracks vorhanden).'},
      {emoji:'🔥', bold:'Heatmap-Toggle:', text:' Neuer Button auf der Karte. Toggle zeigt alle Tracks als orange Polylines mit Opacity 0.18 übereinander — wo du oft warst, wird der Bereich sichtbar dunkler (additive Heatmap-Optik ohne externe Library). Auto-Fit auf alle Track-Bounds.'},
      {emoji:'⛰️', bold:'Topo + Hybrid Karten-Layer im UI:', text:' OpenTopoMap (Höhenlinien) und Hybrid (Satellit + Beschriftung) jetzt als Buttons in der Layer-Bar. Sechs Layer total.'},
      {emoji:'⚖️', bold:'Realismus weiterhin strikt:', text:' Alle PR-Werte direkt aus den GPS-Daten. Keine geschätzten Calories, kein Heart-Rate, kein VO2max. Nur was wirklich messbar ist.'},
    ]
  },
  {
    v: 'v24.12', date: '28.04.2026',
    headline: 'Tracks-Liste mit Splits, Total-Stats und neuen Karten-Layern',
    summary: 'Phase 2 — Tracks-Liste bekommt Total-Stats, Splits pro Kilometer (echte Pace aus GPS), Filter (7T/30T/1J), Sortierung und Mini-Höhenprofil pro Track. Alles aus echten GPS-Daten berechnet — keine geschätzten Werte. Plus zwei neue Karten-Layer.',
    items: [
      {emoji:'📊', bold:'Splits pro Kilometer:', text:' Detail-View zeigt jetzt Pace (min/km) und Speed (km/h) für jeden Kilometer der Strecke — aus echten GPS-Punkten berechnet. Farb-Bar visualisiert Geschwindigkeit relativ zum schnellsten Split. Letzter unvollständiger Kilometer separat ausgewiesen.'},
      {emoji:'📐', bold:'Pause-Zeit explizit:', text:' Total-Dauer minus Bewegungszeit. Sichtbar wenn der Track Pausen enthält. Bewegungszeit basiert auf der robusten Distance-Berechnung mit GPS-Outlier-Filter und Pause-Detection (≥8 s ohne Bewegung = Pause-Anker friert ein).'},
      {emoji:'📈', bold:'Total-Stats-Card in Tracks-Liste:', text:' Summe aller Tracks im gewählten Filter: Strecke total, aktive Bewegungszeit total, Anstieg total. Aus echten GPS-Daten summiert.'},
      {emoji:'🔍', bold:'Filter + Sortierung:', text:' Alle / 7 Tage / 30 Tage / 1 Jahr. Sortierung nach Datum / Distanz / Dauer / Anstieg. Total-Stats passen sich live an den Filter an.'},
      {emoji:'📉', bold:'Mini-Höhenprofil pro Track-Karte:', text:' SVG-Sparkline aus den echten alt-Werten der GPS-Punkte (max 60 Samples). Zeigt auf einen Blick die Topographie der Tour.'},
      {emoji:'🗺️', bold:'OpenTopoMap (Höhenlinien):', text:' Neuer Layer für Garmin-Style-Geländewahrnehmung — Topographie mit Höhenlinien.'},
      {emoji:'🛰️', bold:'Hybrid (Satellit + Beschriftung):', text:' Satellitenbild mit überlagerten Ortsnamen — beste Übersicht in unbekanntem Gelände.'},
      {emoji:'⚖️', bold:'Realismus-Prinzip:', text:' Keine erfundenen Werte. Calories, VO2max, Heart-Rate-Zonen werden NICHT angezeigt weil sie ohne Pulsmesser/Gewicht-Profil nicht ehrlich berechenbar sind. Nur was aus GPS messbar ist: Distanz, Höhe, Zeit, Pace, Speed.'},
    ]
  },
  {
    v: 'v24.11', date: '28.04.2026',
    headline: 'Cross-Device-Sync, Bilder, Wetter, Track-Recovery, Themen-Farben',
    summary: 'Phase 1 von zwei. Daten synchronisieren jetzt auf allen Geräten. Pflanzen-Bilder gehen in die Cloud und werden Profilbild. Scan-Fotos kommen voll aufgelöst zurück. Wetter-Sync vereinheitlicht. Tracking mit Wake Lock + Crash-Recovery. Rezepte+Heilmittel mit thematischen Farben. Phase 2 (Karte/Tracks Garmin-Style + 3D next-level) folgt.',
    items: [
      {emoji:'☁️', bold:'Cross-Device-Sync vollständig:', text:' gsSyncUserDataOnLogin zieht jetzt auch Diary, Harvests, Scans. Wird beim Login UND beim App-Boot UND bei visibilitychange (>2 min) automatisch ausgeführt. Wenn du dich am Laptop anmeldest, sind alle Pflanzen, Scans und Garten-Daten vom Handy sofort da.'},
      {emoji:'📷', bold:'Scan-Foto in voller Auflösung:', text:' photoUrl aus Cloud-Storage wird nach Upload in die lokale History geschrieben. Detail-View zeigt jetzt das volle Foto (320 px) statt nur Thumbnail. Cloud-Pull mappt photoUrl korrekt.'},
      {emoji:'🪴', bold:'Pflanzen-Bild wird Profilbild:', text:' Zwei Buttons (📷 Foto aufnehmen / 🖼️ Aus Galerie) statt einem. Auto-Komprimierung 1280px JPEG-85. Cloud-Upload direkt nach Auswahl, Cloud-URL wird p.photo (=Profilbild) und p.photoUrl. Status-Anzeige (komprimiere → Cloud → fertig).'},
      {emoji:'🌤️', bold:'Wetter-Sync vereinheitlicht:', text:' Code las userLocation.lon, andere Stellen schrieben userLocation.lng → Wetter manchmal nicht aktuell. Plus zwei localStorage-Keys (userLocation vs gs_user_location). Jetzt: gsGetWeatherLocation prüft alle Schreibweisen + alle Keys. saveUserLocation schreibt in beide.'},
      {emoji:'🎯', bold:'Tracking Garmin-Style:', text:' Wake Lock API hält Display an während Tracking. Auto-Persist alle 10 GPS-Punkte → bei Crash/Tab-Schließen wird der Track beim nächsten Start angeboten zum Speichern. Visibility-Resume: bei App-Wake wird GPS-Watch automatisch reattached.'},
      {emoji:'🍲', bold:'Rezepte + Heilmittel Themen-Farben:', text:' Rezepte = warm-erdig (Pastel orange/braun, Card-Img mit Erdton-Verlauf). Heilmittel = sanft-lila (Card-Img mit Lavender-Verlauf). Filter-Bar bekommt blur-Hintergrund mit Schatten. Dark-Mode angepasst.'},
      {emoji:'🔧', bold:'gsBookIngestLoadCandidates Bug:', text:' Aus v24.09 noch ein silent failure — sbFetch-Result wurde direkt als Array gelesen statt {data,error}. Jetzt Schema-konform.'},
    ]
  },
  {
    v: 'v24.10', date: '28.04.2026',
    headline: '5-Punkte-Audit: Tracking-3D, Buch-Einlesen, Feedback, DBs, Scans',
    summary: 'Großer Audit-Pass: Tracking-3D-Modell deutlich verbessert, Buch-Einlesen funktioniert wieder mit Multi-File-Upload, Feedback-Liste zeigt jetzt echte Posts, drei Datenbanken substantiell erweitert (Facts 10→40, Tips 8→32, Highlights 6→18), Scan-History bekommt eine richtige Detail-View mit Foto, Standort, Notizen und Korrektur-Pfad.',
    items: [
      {emoji:'🗺️', bold:'Tracking 3D-Modell verbessert:', text:' Auto-Rotation pausiert bei Interaktion (Resume nach 5s Inaktivität). Pinch + Wheel-Zoom dazu. Pitch-Drag (vertikal schwenken). Tube dicker (0.045 statt 0.025) für Mobile-Sichtbarkeit. Höhen-Hilfslinien als Ringe. Distanz-Marker bei 25/50/75 % der Strecke. Ruhigere Kamera (kein Y-Wackeln). Sauberes Disposing aller Listener.'},
      {emoji:'📚', bold:'Book-Ingest „not_expert"-Fehler:', text:' Edge-Function v3 deployed — erlaubt jetzt is_expert ODER is_admin ODER role=admin. Plus Profile-Update: alle Admin-Accounts bekommen is_admin=true und is_expert=true. Doppelte Absicherung.'},
      {emoji:'📂', bold:'Multi-PDF-Upload:', text:' Buch-Einlesen akzeptiert jetzt mehrere PDFs gleichzeitig. Pro File ein eigener Job mit Auto-Titel "Buchtitel [Datei N/M: dateiname.pdf]". Sequenzielle Verarbeitung mit Gesamt-Progress-Bar.'},
      {emoji:'🗑️', bold:'Feedback-Test-Post entfernt:', text:' Der einzelne „Test!"-Post aus der Testphase aus DB gelöscht. Neue User sehen jetzt eine saubere leere Liste oder die echten Posts anderer User.'},
      {emoji:'📚', bold:'Datenbanken substantiell gefüttert:', text:' did_you_know_facts 10→40 (30 neue Schweizer Pflanzen-/Pilz-/Wald-Facts), seasonal_tips 8→32 (24 neue Garten-Tipps für alle 4 Jahreszeiten + Foraging), seasonal_highlights 6→18 (12 neue saisonale Highlights wie Bärlauch-Saison, Steinpilz-Hauptsaison, Apfelernte).'},
      {emoji:'📷', bold:'Scan-History Detail-View neu:', text:' Foto in voller Größe (statt nur Thumbnail), Confidence-Bar, Toxicity/Edible-Badges, Standort mit OpenStreetMap-Link, eigene Notiz speicherbar (lokal + cloud), Wikipedia-Link, „⚠️ Falsch erkannt"-Korrektur (sendet an scan_corrections für KI-Training), Lösch-Button für einzelnen Scan.'},
      {emoji:'📍', bold:'Scan-Persist mit Standort:', text:' saveScanToHistory speichert jetzt Lat/Lon + Standort-Name in context-Feld. Wird in Detail-View als anklickbare OpenStreetMap-Karte angezeigt.'},
    ]
  },
  {
    v: 'v24.09', date: '28.04.2026',
    headline: 'App-weiter Audit — 3 stille Bugs gefunden und gefixt',
    summary: 'Vollständiger Audit der App. Drei stille Bugs entdeckt, die User nicht gemerkt haben (silent fails): (1) tabName-Tippfehler in switchTab brach Tab-Wechsel mit ReferenceError ab, (2) gsShAddSensor rief openMyDevices auf, das gar nicht existiert (heißt openDevicesModal), (3) gsBookIngestLoadCandidates las sbFetch-Response als Array statt als Objekt und zeigte daher nie Kandidaten an.',
    items: [
      {emoji:'🔄', bold:'switchTab tabName-ReferenceError:', text:' In switchTab Z.18047 stand if (tabName === home) — die Funktions-Variable heißt aber t. Bei jedem Tab-Wechsel ein silent ReferenceError mitten in der Init-Logik. Quiz-Init auf Home wurde dadurch übersprungen.'},
      {emoji:'📡', bold:'Smart-Home + Sensor anlegen:', text:' gsShAddSensor rief openMyDevices auf — diese Funktion existiert nicht (heißt openDevicesModal). Daher öffnete sich nach Klick auf „+ Sensor anlegen" gar nichts.'},
      {emoji:'📚', bold:'Buch-Ingest Kandidaten:', text:' gsBookIngestLoadCandidates las sbFetch-Result direkt als Array (sbFetch returnt aber {data,error}). cands.length war undefined → falsey → „Keine offenen Kandidaten" obwohl welche da waren.'},
      {emoji:'🧪', bold:'Test-Verfahren:', text:' Erweiterter jsdom-Smoke-Test über alle Haupt-Flows (Tab-Wechsel, Modal-Öffnen, Smart-Home-Demo). Findet ReferenceError und undefined function calls automatisch vor jedem Deploy.'},
      {emoji:'✅', bold:'Verifiziert:', text:' Alle 7 inline scripts parsen sauber, 0 Console-Errors beim Boot, alle gsSh*/sbFetch/openLogin* Funktionen definiert, alle onclick-Handler haben Targets.'},
    ]
  },
  {
    v: 'v24.08', date: '28.04.2026',
    headline: 'KRITISCHER HOTFIX: App lief nicht mehr durch Init',
    summary: 'Ein Tippfehler in den v24.07-Release-Notes (\\\'below\\\'/\\\'above\\\' als String-Literal-Escape im GS_RELEASES-Array) erzeugte einen JS-SyntaxError → das gesamte Haupt-Script (42 000 Zeilen) wurde nicht ausgeführt → App blieb beim Init stehen. Jetzt gefixt + jsdom-Boot-Test als Verifikations-Stufe vor jedem Release.',
    items: [
      {emoji:'🔥', bold:'Root-Cause:', text:' In v24.07-Eintrag standen Backslash-Escape-Sequenzen, die in einem single-quoted JS-String den String vorzeitig beendet haben → Parser-Crash. Browser silently failt das ganze Script.'},
      {emoji:'🛠️', bold:'Fix:', text:' Problematische Quotes komplett entfernt — Notes nur noch in plain text.'},
      {emoji:'🧪', bold:'Verifikation neu:', text:' Boot-Test mit jsdom plus Acorn-Parser vor jedem Deploy. Der bisherige node --check via Regex-Extraktion war zu naiv (Edge-Cases wie geschachtelte Script-Marker werden nicht abgefangen).'},
    ]
  },
  {
    v: 'v24.07', date: '28.04.2026',
    headline: 'Smart-Home-Audit: 11 Bugs gefixt — lückenlos für Hardware bereit',
    summary: 'Tiefer Audit des Smart-Home-Moduls gegen die echte DB. Schemas verifiziert via SQL — drei kritische Schema-Mismatches gefunden und gefixt: sensor_thresholds-Tabelle existiert nicht, sensor_alerts braucht (threshold,direction) statt (kind,value), sensor_readings nutzt ts statt created_at. Plus: sbFetch-Response-Bug (auch in gsLoadCloudScans aus v24.05), Battery-Save bei Tab-Hidden, Demo-Toggle-Off, proaktive Notif-Permission, robustere „Grenze nah"-Logik.',
    items: [
      {emoji:'🗄️', bold:'sensor_thresholds existiert nicht:', text:' Thresholds liegen jetzt in `sensor_devices.config.thresholds` als jsonb pro metric. Kein Schema-Change, RLS schon da. Der alte Read-Versuch in gsSensorSyncFromCloud entfernt.'},
      {emoji:'🚨', bold:'sensor_alerts-Schema korrigiert:', text:' Insert nutzt jetzt das echte Schema: metric, threshold (double, NOT NULL), direction (text below/above, NOT NULL), triggered_at, message. Vorher hätte der Insert 400 ausgelöst (kind/value waren falsche Felder).'},
      {emoji:'⏰', bold:'sensor_readings.ts statt created_at:', text:' ts ist der echte Reading-Zeitstempel (Hardware-Sensor-Time), created_at nur Insert-Time. Bei spät hochgeladenen Readings stimmt jetzt die Chart-Zeit.'},
      {emoji:'🐛', bold:'sbFetch-Response-Bug:', text:' sbFetch returnt {data, error} — nicht direkt das Array. Mein Code hatte `Array.isArray(r)` → immer false → silent fail. Auch in gsLoadCloudScans aus v24.05 gefixt.'},
      {emoji:'🔋', bold:'Battery-Save bei Tab-Hidden:', text:' visibilitychange-Listener pausiert das 30s/10s-Polling wenn die App in den Hintergrund geht. Reaktiviert beim Zurück-Wechsel.'},
      {emoji:'🛑', bold:'Demo-Toggle-OFF:', text:' Vorher konntest du Demo nur einschalten, nicht ausschalten. Jetzt mit „🎭 Demo-Modus aktiv [Aus]"-Banner.'},
      {emoji:'🔔', bold:'Notif-Permission proaktiv:', text:' Beim ersten Threshold-Save wird Notification.requestPermission() aufgerufen — vorher silent-fail wenn nie granted.'},
      {emoji:'🎯', bold:'Robuste „Grenze nah"-Berechnung:', text:' 5 % vom (max−min)-Range statt thr.min*1.05. Funktioniert jetzt auch bei Werten ≤ 0 (z.B. Wintertemperaturen).'},
      {emoji:'✏️', bold:'Min-≥-Max-Check:', text:' Threshold-Save prüft jetzt dass min < max. Sonst Toast „Ungültige Werte".'},
      {emoji:'🔄', bold:'chartIdx-Reset:', text:' Beim Zurück-Button von Detail-View wird chartIdx auf null gesetzt — Polling kennt jetzt wieder Übersicht und re-rendert nicht den falschen Chart.'},
      {emoji:'⚡', bold:'Parallel-Fetch der 24h-Readings:', text:' Vorher seriell (ein Sensor nach dem anderen) → bei 5 Sensoren ~5× langsamer. Jetzt Promise.all → ein round-trip. History-Cap auf 100 Punkte für saubere Sparklines.'},
    ]
  },
  {
    v: 'v24.06', date: '28.04.2026',
    headline: 'Smart-Home-Dashboard + Color-Token-System',
    summary: 'Komplett neues Smart-Home Sensor-Dashboard mit Live-Werten, 24h-Trend-Charts, konfigurierbaren Schwellwerten und Auto-Alerts. Demo-Modus mit 5 simulierten Sensoren — du kannst alles testen, auch ohne Hardware. Plus: 22 neue Farb-Tokens für eine konsistente App-weite Brand-Palette.',
    items: [
      {emoji:'🏠', bold:'Smart-Home-Dashboard:', text:' In Mein Garten neuer „🏠 Smart-Home"-Button. Modal zeigt alle Sensoren als Karten mit Live-Wert, Trend-Pfeil, Mini-Sparkline und Status (OK / GRENZE NAH / AUSSERHALB). Tap → Detail-View mit 24h-Chart und Schwellwert-Editor.'},
      {emoji:'📊', bold:'Live-Polling:', text:' Solange Modal offen, alle 30 s Cloud-Refresh (oder 10 s im Demo-Modus). Jeder Sensor hat 24h Historie aus `sensor_readings`. Chart zeigt Threshold-Linien (gelb=min, rot=max).'},
      {emoji:'🔔', bold:'Auto-Alerts mit Dedupe:', text:' Threshold-Engine prüft jeden Wert gegen Schwellwerte → Toast + native Notification + Cloud-Log in `sensor_alerts`. Pro Sensor max 1 Alert pro 10 min (kein Spam).'},
      {emoji:'🎭', bold:'Demo-Modus:', text:' 5 simulierte Sensoren (Bodenfeuchte, Temperatur, Licht, Luftfeuchte, pH) mit realistischen Werten und 24h-Verlauf. Werte aktualisieren sich alle 10 s mit kleinen Schwankungen. Perfekt zum Testen ohne Hardware.'},
      {emoji:'🎨', bold:'Color-Token-System:', text:' 22 neue semantische Farb-Variablen: `--c-success/danger/warn/info/purple`, `--bg-success-soft/warn-soft/danger-soft` etc. + Live-Status-Tokens (`--c-live-ok/warn/danger/pulse`). Im Dark-Mode automatisch passend gemappt. Alter Code unverändert (additiv).'},
      {emoji:'📋', bold:'COLOR-AUDIT.md:', text:' Begleitdokument im Output-Ordner mit Top-Hex-Hotspots (285 unique Hexes!) und Migrations-Strategie für saubere Konsolidierung in zukünftigen Sprints.'},
    ]
  },
  {
    v: 'v24.05', date: '28.04.2026',
    headline: 'Buch-Einlesen-Fix + Multi-Device-Scan-Sync + smooth Progress-Bar',
    summary: 'Drei kritische Fixes: (1) „Buch einlesen" funktioniert wieder — Auth-Token wurde im falschen Format gesucht. (2) Scans, die du auf einem Gerät machst, sind nach Login auch auf allen anderen Geräten sichtbar (Cloud-Sync via user_scans). (3) Progress-Bar im KI-Planer wandert flüssig statt in 13%-Sprüngen.',
    items: [
      {emoji:'📚', bold:'Buch einlesen wieder funktional:', text:' authToken-Helper las von `window.supabase.auth.getSession()` — GreenScan benutzt aber `localStorage.gs_sb_token`. Token war daher immer null → „Bitte zuerst einloggen". Jetzt direkt aus localStorage gelesen, mit `sbEnsureValidToken()` Refresh-Check.'},
      {emoji:'☁️', bold:'Multi-Device-Scan-Sync:', text:' Neue `gsLoadCloudScans()` zieht nach Login + bei jedem App-Boot bis zu 50 Scans aus `user_scans` und merged sie mit dem lokalen Cache (Dedupe via name+timestamp). Toast meldet wieviele neue Cloud-Scans geladen wurden.'},
      {emoji:'🔄', bold:'Manueller Sync-Button:', text:' In der Scan-History oben rechts „🔄 Sync"-Button (nur sichtbar wenn eingeloggt). Holt Cloud-Scans on-demand. Empty-State erklärt jetzt, dass der Sync-Button hilft.'},
      {emoji:'📊', bold:'Smooth Progress-Bar im KI-Planer:', text:' Statt 7 Stages mit je 13%-Sprung jetzt kontinuierliche Interpolation (200ms-Tick, ease-out 1.5). Bar wandert flüssig von 0 % auf 92 %, keine abrupten Sprünge mehr. CSS-Transition auf 0.25s linear.'},
      {emoji:'🎯', bold:'Monoton steigender Fortschritt:', text:' Display-Pct kann nie zurückspringen, auch wenn die Schätzung sich verbessert — wirkt verlässlich.'},
    ]
  },
  {
    v: 'v24.04', date: '28.04.2026',
    headline: 'Privacy beim Teilen + Kompakt-Plan + Scanner-Knopf-Position',
    summary: 'Geteilte Links übertragen keine Account-Daten mehr. Bei Plan-Timeout gibt es einen „Kompakter Plan in 25 s"-Fallback. Scanner-Knopf bleibt auf jedem Gerät an der richtigen Position — auch ohne Home-Indicator.',
    items: [
      {emoji:'🔒', bold:'Link-Sharing privacy:', text:' Beim Teilen wird `?ref=share` an die URL gehängt. Empfänger sieht beim Öffnen einen Welcome-Toast + Login/Signup-Modal. Auth-Hash (#access_token=…) wird defensiv gestripped — kein versehentlicher Account-Übergriff mehr.'},
      {emoji:'⚡', bold:'Kompakt-Plan-Fallback:', text:' Bei Timeout zeigt der Fehler-Bildschirm einen „⚡ Kompakten Plan generieren (~25 s)"-Button. Kürzeres Schema (max 5 Pflanzen, 2000 statt 3500 Tokens, 90s statt 180s Timeout). Plan trotzdem vollständig nutzbar.'},
      {emoji:'📍', bold:'Scanner-Knopf robuster:', text:' Padding nutzt jetzt `max(28px, env(safe-area-inset-bottom)+14px)` statt nur `env(...)`. Auf Geräten ohne Safe-Area (Android, Desktop, ältere iPhones) liegt der Shutter immer mindestens 28 px vom Rand — kein Verrutschen mehr.'},
      {emoji:'💬', bold:'Klarere Timeout-Meldung:', text:' „Die KI antwortet aktuell sehr langsam (>3 Min). Versuche es mit einem kompakten Plan — der ist schneller fertig." statt „in 90 Sekunden".'},
    ]
  },
  {
    v: 'v24.03', date: '28.04.2026',
    headline: 'KI-Planer: Super-Agent + Speed + Pläne wiederfindbar',
    summary: 'Super-Agent komplett auf Modal-UI (keine alert() mehr), Plan-Generierung schneller (45s erwartet statt 60s), Flächennutzung erzwungen ≥95%, „Meine Pläne" prominent zugänglich aus Mein-Garten-Tab und KI-Planer-Header.',
    items: [
      {emoji:'🤖', bold:'Super-Agent neu:', text:' „Plan anpassen", „Status" und „Refinement"-Antworten zeigen jetzt strukturierte Modals statt blockierender alert()-Dialoge. Loading-Toast während Analyse. Auto-Retry-Logic. callAI mit 60s-Timeout.'},
      {emoji:'⚡', bold:'Generierung schneller:', text:' Schema-Prompt schlank (von 30 Zeilen auf 5), max_tokens 4096→3500, ETA-Erwartung 60s→45s. Spart ~25% Generierungszeit.'},
      {emoji:'🎯', bold:'Flächennutzung 95-100% erzwungen:', text:' System-Prompt explizit „Summe(w*h) ≥ 0.95 × Beet-Fläche". Wenn Wünsche eingegeben: KI nutzt das ganze Beet. UI mit Color-Coding (grün/gelb/rot) + Hinweis bei unter 90%.'},
      {emoji:'📂', bold:'Pläne wiederfindbar:', text:' Direkt-Zugang im KI-Planer-Header (rechts „📂 Meine Pläne"-Button) UND als großer Button in Mein Garten unter den Action-Buttons.'},
      {emoji:'📊', bold:'Flächennutzungs-KPI:', text:' Prominent angezeigt mit Farbcode + Hinweis-Text statt nur kleine graue Zeile. „Plan anpassen" für mehr Pflanzen wenn nötig.'},
    ]
  },
  {
    v: 'v24.02', date: '28.04.2026',
    headline: 'Botanisch genaue 3D-Pflanzen + PDF-Symbole',
    summary: '15 verschiedene Gemüse-Geometrien im 3D-Modell — Tomaten mit roten Früchten, Kürbis als orange Halbkugel mit Stiel, Karotten als Cones mit Blättern, Sonnenblumen mit Blüte usw. Im PDF: Aufsicht-Symbole (Kreise/Ellipsen/Cluster) statt nur Rechtecke.',
    items: [
      {emoji:'🍅', bold:'Tomaten:', text:' Hohe Stange mit grünen Blättern + viele rote Frucht-Sphären verteilt.'},
      {emoji:'🎃', bold:'Kürbis/Zucchini/Melone:', text:' Orange/grüne abgeflachte Sphäre + Stiel + Begleitblatt.'},
      {emoji:'🥕', bold:'Karotten:', text:' Cluster aus orangen Cones (Wurzelspitzen oben) mit grünen Blattrosetten.'},
      {emoji:'🥬', bold:'Salat/Spinat:', text:' Konzentrische Halbkugel-Schichten (innen heller, außen dunkler) für Köpfe.'},
      {emoji:'🍓', bold:'Erdbeeren:', text:' Niedrige grüne Cluster mit roten Beer-Punkten zufällig verteilt.'},
      {emoji:'🌽', bold:'Mais:', text:' Hohe Stäbe (1.4 m) mit gelb-orangen Kolben in der Mitte.'},
      {emoji:'🌻', bold:'Sonnenblume:', text:' Stamm + brauner Disc + gelber Blütenkranz.'},
      {emoji:'🫛', bold:'Bohnen/Erbsen:', text:' Stangen mit kreisförmig angeordneten Blättern.'},
      {emoji:'🧄', bold:'Zwiebel/Lauch/Knoblauch:', text:' Bulb-Sphären unten + grüne Blatt-Cones nach oben.'},
      {emoji:'🌳', bold:'Bäume:', text:' Stamm + Krone + 6 Frucht-Sphären (Apfel rot, Birne grün etc.).'},
      {emoji:'🫐', bold:'Beerensträucher:', text:' Großer Strauch mit 12 Beeren-Punkten in passenden Farben.'},
      {emoji:'🌿', bold:'Kräuter:', text:' Dichte kleine Cluster mit Variation — Basilikum, Petersilie, Thymian.'},
      {emoji:'📐', bold:'PDF-Pflanzen-Symbole:', text:' Bäume = Doppelkreis (Krone+Stamm), Kürbis/Kohl = Kreis mit Stiel-Kreuz, Tomate = Ellipse, Beerensträucher = Kreis + 6 Beeren-Punkte, Salat/Kräuter = Cluster mit deterministischem Grid (statt zufällig). Beschriftung mit weißem Outline-Effekt für Lesbarkeit.'},
    ]
  },
  {
    v: 'v24.01', date: '28.04.2026',
    headline: 'Inline-3D-Modell + Progress-Bar + „Meine Pläne"',
    summary: '2D-Skizze ersetzt durch realistisches 3D-Modell (Polymech-Stil, 360°-Drehung, drag/zoom/tap) direkt im Plan-Result. Echte Progress-Bar mit ETA-Countdown statt nur Text. Plan-Speichern führt jetzt direkt zum „Meine Pläne"-Modal.',
    items: [
      {emoji:'🌐', bold:'3D-Modell statt 2D-Skizze:', text:' Realistische Pflanzen-Geometrien (Bäume mit Stamm+Krone, Stäbe für Mais/Tomate, Halbkugeln für Kohl/Kürbis, flache Köpfe für Salat). Holz-Rahmen ums Beet, Erde mit Textur, Rasen umzu, Sonnen-Schatten — wie ein technisches 3D-Modell.'},
      {emoji:'🎬', bold:'4.5s Intro-Auto-Rotation:', text:' Sanfte 290°-Drehung beim Plan-Öffnen (ease-out cubic) — User sieht sofort dass es 360° drehbar ist. Bricht beim ersten Touch ab.'},
      {emoji:'👆', bold:'Pflanze antippen für Details:', text:' Raycaster-Click → Toast mit Anzahl/Abstand/Tiefe/Wasser/Notiz — wie Polymech-3D-Modell mit Bauteil-Info.'},
      {emoji:'⏳', bold:'Echte Progress-Bar:', text:' 7-Stage-Loader (Klima, DB, Mond, Mischkultur, Kalender, Bewässerung, JSON) mit % und ETA-Countdown („~ 47 s"). Bar wandert smooth, schießt auf 100 % wenn Antwort da.'},
      {emoji:'📂', bold:'„Meine Pläne"-Button im Result:', text:' Direkt zugänglich nach Plan-Speichern. Liste mit Datum, Pflanzen-Anzahl, Beet-Größe — wieder öffnen mit einem Klick.'},
      {emoji:'🔍', bold:'„Vollbild"-Button:', text:' Inline-3D mit kleiner Höhe (340px) im Plan, Klick auf „🔍 Vollbild" → großer 3D-CAD-View für Detail-Inspektion.'},
    ]
  },
  {
    v: 'v24.00', date: '28.04.2026',
    headline: 'KI-Planer: professioneller Bauplan',
    summary: 'Plan-Result aufgeräumt (3D-CAD/2D/Anleitung-Buttons raus), nur Speichern + PDF Export. PDF-Grafik komplett neu — echter CAD-Bauplan mit Title-Block, Nordpfeil, Maßstabs-Leiste, Bemaßung. „Meine Pläne"-Modal um gespeicherte Pläne wieder zu öffnen.',
    items: [
      {emoji:'📐', bold:'Professioneller PDF-Bauplan:', text:' Title-Block (CAD-Standard) mit Maßstab (1:50, 1:100 etc), Beet-Maßen, Klimazone, Datum. Nordpfeil oben rechts. Maßstabs-Leiste unten links. Bemaßungs-Pfeile mit Pfeilspitzen für Beet-Außenkanten. Doppel-Raster (1m fein + 5m kräftig).'},
      {emoji:'🌱', bold:'Saubere Pflanzen-Darstellung:', text:' Nummern-Kreis pro Pflanze (Verweis zur Legende), CAD-Mittelpunkt-Kreuz, klare Outlines, dezenter Color-Fill. Beschriftungen mit Name + Anzahl + Abstand-cm.'},
      {emoji:'📋', bold:'Legende unter dem Plan:', text:' 2-spaltige Tabelle „Nummer · Farbcode · Name × Anzahl" — wie ein echtes Architektur-Plan-Dokument.'},
      {emoji:'💾', bold:'Plan speichern + Wiederöffnen:', text:' Lokal IMMER (auch ohne Login), zusätzlich Cloud wenn eingeloggt. Neues „📂 Meine Pläne"-Modal listet alle gespeicherten Pläne — anklicken öffnet Plan wieder im Result-View.'},
      {emoji:'🧹', bold:'Plan-Result aufgeräumt:', text:' 3D-CAD-Hero, 2D-Plan-Button und Anleitung-Button entfernt (User-Wunsch). Nur noch 2 klare Aktionen: 💾 Speichern und 📄 PDF Export.'},
    ]
  },
  {
    v: 'v23.99', date: '28.04.2026',
    headline: 'KI-Planer JSON-Härtung + futuristische 3D-Hero',
    summary: 'Plan-Generierung jetzt zuverlässig auch bei abgeschnittenen API-Antworten (Truncation-Repair-Parser). Token-Limit verdoppelt. 3D-CAD direkt prominent im Plan-Result mit futuristischer Glow-Hero-Karte und sanfter 3.5s-Intro-Auto-Rotation.',
    items: [
      {emoji:'🔧', bold:'max_tokens 2400 → 4096:', text:' Plan-JSON wurde sonst manchmal abgeschnitten — jetzt ist genug Platz für vollständigen Output mit allen Schemata.'},
      {emoji:'🛠️', bold:'4-stufiger JSON-Repair-Parser:', text:' (1) Direkt-Parsen, (2) Trailing-Komma-Fix, (3) Quote-Reparatur, (4) TRUNCATION-REPAIR — wenn JSON abgeschnitten ist, werden fehlende Klammern intelligent ergänzt und der größtmögliche Plan gerettet. Marker `_truncated` informiert User.'},
      {emoji:'📐', bold:'3D-CAD-Hero direkt im Plan:', text:' Statt nur Button → futuristische Hero-Karte mit CAD-Grid-Background, Glow-Effekt und „📐 Garten in 3D anschauen"-CTA. Zeigt sofort dass 3D verfügbar ist.'},
      {emoji:'✨', bold:'3.5s-Intro-Auto-Rotation:', text:' 3D-CAD startet mit sanfter Drehung (108°, ease-out cubic) — bricht ab sobald User selbst dreht/zoomt. Wirkt wie das Track-3D, gibt sofort räumlichen Eindruck.'},
      {emoji:'⚠️', bold:'Truncation-Toast:', text:' Wenn der Plan-Repair gegriffen hat, wird der User mit einem dezenten Hinweis informiert dass kritische Teile gerettet wurden.'},
    ]
  },
  {
    v: 'v23.98', date: '28.04.2026',
    headline: 'Wetter, KI-Planer, PDF, Scan-History, Marktplatz-Bilder',
    summary: 'Mehrere User-Probleme behoben: Wetter findet jetzt auch kleine CH-Orte (Vilters-Wangs etc.), KI-Planer verträgt 180s + Auto-Retry, PDF-Export mit Web Share API auf Handy, Scan-History neu mit Thumbs/Suche/Filter, Marktplatz-Listings mit Bilder-Upload + Galerie.',
    items: [
      {emoji:'🌤️', bold:'Wetter findet kleine CH-Orte:', text:' Geocoding mit 5-stufiger Strategie — Open-Meteo → Bindestrich-Splits → Nominatim-Fallback → Nominatim-Split → Nominatim+"Schweiz". Findet jetzt "Vilters-Wangs", "Bonaduz/Rhäzüns" usw.'},
      {emoji:'⏱️', bold:'KI-Planer 180s + Auto-Retry:', text:' Timeout von 90s → 180s, plus Auto-Retry beim ersten Timeout. Plan-Generation klappt jetzt zuverlässig auch bei API-Last.'},
      {emoji:'📄', bold:'PDF auf Handy speichern:', text:' Web Share API zuerst (iOS 16.4+/Android 89+) — natives Share-Sheet öffnet sich, User wählt „In Dateien speichern" / „Drucken" / „Mail". Fallback: a.click-Download.'},
      {emoji:'📷', bold:'Scan-History V2:', text:' Echte Foto-Thumbs (statt nur Emoji), Live-Suche, Filter-Chips (Alle/in DB/unbekannt/≥85%), Stats-Zeile (Scans/Arten/in DB), Lösch-Button pro Scan + alle löschen, mehrere Scans der gleichen Art bleiben sichtbar.'},
      {emoji:'🖼️', bold:'Marktplatz mit Bildern:', text:' Bis zu 3 Fotos pro Inserat (komprimiert auf 1280px JPEG 0.82), Vorschau mit Entfernen-Button. Listing-Detail mit Bilder-Galerie, Thumbnail-Navigation. Beide Listing-Pools (alt+neu) im Detail-View unterstützt.'},
    ]
  },
  {
    v: 'v23.97', date: '28.04.2026',
    headline: 'KI-Planer Robustheit',
    summary: 'Drei kritische Bugs im KI-Garten-Planer behoben: Timeout zu kurz für komplexe Pläne, Wetter-API schluckt Errors, Plan-Output zeigt rohes JSON bei Parse-Fail.',
    items: [
      {emoji:'⏱️', bold:'Plan-Timeout 90s statt 45s:', text:' callAI nimmt jetzt opts.timeout entgegen. Plan-Generation ist komplex (großes Schema, viele Tokens) — 45s zu knapp bei API-Last.'},
      {emoji:'🌤️', bold:'Wetter-API robuster:', text:' fetchWeather throws jetzt mit Error-Codes (geo_not_found / network / weather_failed) statt silent null. Defensive gegen unvollständige API-Responses. Caller zeigen verständliche Meldung statt "Ort nicht gefunden".'},
      {emoji:'🤖', bold:'Plan-Output verständlich:', text:' Bei JSON-Parse-Fail wird KEIN rohes JSON mehr angezeigt (sah aus wie Programmiersprache). Stattdessen: saubere Fehler-Karte mit Retry- und Zurück-Buttons.'},
      {emoji:'🎯', bold:'Differenzierte Fehlerbehandlung:', text:' Timeout / Auth / Rate-Limit erhalten jetzt unterschiedliche Icons + Hinweise + passende Action-Buttons (z.B. „API-Key eintragen" wenn Auth-Fehler).'},
    ]
  },
  {
    v: 'v23.96', date: '28.04.2026',
    headline: '3D-CAD KI-Planer',
    summary: 'Der Garten-Plan kann jetzt in einer professionellen 3D-CAD-Ansicht angeschaut werden — wie eine echte Architektur-Zeichnung. OrthographicCamera, 1m+5m-Raster, beschriftete Pflanzen, Klick für Details.',
    items: [
      {emoji:'📐', bold:'CAD-Stil:', text:' Orthographische Kamera (keine perspektivische Verzerrung), wie in echter Garten-Architektur. Top-down Default 75° gekippt.'},
      {emoji:'📏', bold:'Doppel-Raster:', text:' 1m feine Linien + 5m Hauptlinien, beide Achsen mit Meter-Beschriftung — wie ein Bauplan.'},
      {emoji:'🌱', bold:'Pflanzen-Footprints:', text:' Extrudierte Boxen mit Color-Edge (CAD-Outline) + 2 Sprite-Labels: Name+Anzahl oben, Abstand cm darunter.'},
      {emoji:'👆', bold:'Klick-Details:', text:' Tippe eine Pflanze an → Info-Panel zeigt alle Anbau-Daten (Anzahl, Abstand, Tiefe, Aussaat, Ernte, Wasser, Mischkultur, Tipps).'},
      {emoji:'🎯', bold:'Drag + Pinch/Wheel:', text:' Drehen mit Maus/Finger (Pitch begrenzt 15-89°), Zoom 0.5x-4x. „↺ Ansicht"-Button für Reset auf Standard.'},
      {emoji:'⏸', bold:'Still stehend:', text:' Keine Auto-Rotation — wie Fernando wollte. Plan ruht, User kontrolliert die Ansicht.'},
      {emoji:'🔘', bold:'Direkt aus Plan:', text:' Großer „📐 3D-CAD-Ansicht"-Button beim Plan-Result-Screen + im 2D-Visualizer-Modal.'},
    ]
  },
  {
    v: 'v23.95', date: '28.04.2026',
    headline: 'XP-Balken Upgrade',
    summary: 'Premium-XP-Widget mit Smooth-Counter-Animation, Pulse-Glow beim XP-Gewinn, größerem Level-Icon, Achievement-Vorschau und konsistenter Verdrahtung Home/Mehr/Menü.',
    items: [
      {emoji:'✨', bold:'Smooth-Counter:', text:' XP-Zahl zählt animiert hoch (ease-out 900ms) statt einfach zu springen.'},
      {emoji:'💫', bold:'Pulse-Glow bei XP-Gewinn:', text:' Bar leuchtet kurz golden auf — visuelles Feedback beim Punkte-Sammeln.'},
      {emoji:'🌱', bold:'Großes Level-Icon:', text:' Prominentes 34px Icon des aktuellen Levels mit Drop-Shadow im Home-Widget.'},
      {emoji:'🎯', bold:'Achievement-Vorschau:', text:' Zeigt nächstes unfreigeschaltetes Achievement und wie viele fehlen ("📸 10 Scans in 3").'},
      {emoji:'🔗', bold:'Konsistente Verdrahtung:', text:' Mehr-Screen XP-Stat-Card und XP-Bar öffnen jetzt das Profil — nicht mehr Settings.'},
      {emoji:'🎨', bold:'Bar-Farben theme-aware:', text:' Goldener Gradient (#fff8e1 → #ffd54f) statt blasser Standard — sichtbarer Kontrast auf Dark/Light.'},
      {emoji:'📊', bold:'„Bis Level X"-Label klar:', text:' Zeigt Icon + Name des nächsten Levels statt nur Zahl ("50 XP bis 🌿 Wildpflanzen-Fan").'},
    ]
  },
  {
    v: 'v23.94', date: '28.04.2026',
    headline: 'Notifications-Refactor',
    summary: 'Komplettes Aufräumen des Benachrichtigungs-Systems: Single Source of Truth, vereinheitlichte Permission-Anfrage, Server-Notifs im Badge berücksichtigt, robuste 24h-Scheduling, alle alert() durch Toasts ersetzt.',
    items: [
      {emoji:'🔔', bold:'Single-Source-Notif-API:', text:' Neue zentrale <code>gsNotif</code>-API (request, show, isEnabled, setEnabled). Vorher: 4 verschiedene Permission-Funktionen mit inkonsistenter UX.'},
      {emoji:'🔧', bold:'2 LocalStorage-Keys vereinigt:', text:' <code>gs_agent_notify</code> und <code>gs_notif_enabled</code> waren getrennt — jetzt automatische Migration, ein einheitlicher Status.'},
      {emoji:'⏱️', bold:'Robust-Scheduling:', text:' setTimeout für 7 Tage funktioniert nicht (Browser killt Tab). Neuer Cap: 24h-Limit, Rest läuft via Polling beim nächsten Tab-Open + Server-Push (zukünftig).'},
      {emoji:'🌐', bold:'Server-Notifs im Badge:', text:' <code>gsCollectNotifs</code> sammelt jetzt auch Supabase-<code>notifications</code>-Tabelle (vorher gepullt aber nicht im Badge gezählt). Beim Menu-Open frisch geladen.'},
      {emoji:'💬', bold:'Toasts statt alert():', text:' Alle <code>alert()</code>-Aufrufe in Notif-Pfaden durch professionelle Toasts ersetzt — keine blockierenden Mobile-Dialoge mehr.'},
      {emoji:'🌩️', bold:'Wetter + Marktplatz-Push zentralisiert:', text:' Direkte <code>new Notification(...)</code>-Aufrufe ersetzt durch <code>gsNotif.show()</code> mit Tag-Deduplizierung gegen Spam.'},
    ]
  },
  {
    v: 'v23.93', date: '28.04.2026',
    headline: '3D-Track-Visualisierung',
    summary: 'Nach jeder Wanderung öffnet sich automatisch eine 3D-Ansicht der Route mit Höhenprofil, Distanz, Anstieg/Abstieg, Tempo und Pace. Three.js-basiert, Drag zum Drehen.',
    items: [
      {emoji:'🌐', bold:'3D-Route-Visualisierung:', text:' Nach Track-Stop öffnet sich automatisch das Detail-Modal mit 3D-Ansicht (Three.js, lazy-loaded), die Höhe ist als Y-Achse skaliert, Auto-Rotation + Drag zum manuell Drehen.'},
      {emoji:'📊', bold:'Vollständige Stats:', text:' Distanz, Dauer, Anstieg, Abstieg, Ø-Tempo, Pace (min/km), Min/Max-Höhe, Punkte-Anzahl. Mit Color-coded Stat-Tiles.'},
      {emoji:'📈', bold:'Höhenprofil-Chart:', text:' SVG-Grafik unter der 3D-Ansicht zeigt Höhenverlauf entlang der Distanz. Sauber skaliert, mit Min/Max-Labels.'},
      {emoji:'🎯', bold:'Auto-Show nach Track-Stopp:', text:' Sobald die Wanderung beendet wird, erscheint nach 800ms das Detail-Modal — kein manuelles Suchen mehr.'},
      {emoji:'🥾', bold:'„🌐 3D-Details"-Button:', text:' Auch in der Track-Liste verfügbar — jeder gespeicherte Track kann jederzeit in 3D angeschaut werden.'},
    ]
  },
  {
    v: 'v23.92', date: '28.04.2026',
    headline: 'Backend-Hardening + UX-Fixes',
    summary: 'Account-Löschen vollständig (Edge-Function), Feedback-Senden komplett repariert, XP-Balken-Routing fix, Wetter-Modal Swipe-Down, Scan-Detail-View, Rezepte/Heilmittel Auto-Load, About-Modal data-driven.',
    items: [
      {emoji:'🔐', bold:'Account-Löschen vollständig:', text:' Edge-Function <code>delete-user</code> (verify_jwt + Service-Role) löscht 35 User-Tabellen, profiles, legacy_profiles und auth.users. Frontend: ein Edge-Call statt 21 DELETEs.'},
      {emoji:'💬', bold:'Feedback-Senden komplett repariert:', text:' Auth-Bug behoben (gs_sb_uid statt sb-session), Button bleibt IMMER klickbar mit klaren Validation-Toasts, finally-Block verhindert hängenden „⏳ Wird gesendet…"-Zustand.'},
      {emoji:'🎯', bold:'XP-Balken Home-Routing:', text:' Klick auf XP-Widget öffnet jetzt das Profil-Modal (wie im Menü) — nicht mehr versehentlich den Mehr-Screen mit Feedback-Section.'},
      {emoji:'🌤️', bold:'Wetter-Modal Swipe-Down:', text:' Wetter-Detail kann jetzt mit der Wisch-Geste nach unten geschlossen werden — wie alle anderen Modals.'},
      {emoji:'📷', bold:'Scan-History Detail-View:', text:' Jeder Scan ist wieder anschaubar — Foto, Trefferquote mit Color-Coding, Datum, Kategorie, Latein. Bei DB-Match: ein Klick zum DB-Eintrag.'},
      {emoji:'🍲', bold:'Rezepte + Heilmittel Auto-Load:', text:' IntersectionObserver-Sentinel pagniert beim Scrollen automatisch nach (40er-Batches), wie bei den Arten.'},
      {emoji:'📓', bold:'About-Modal data-driven:', text:' Bei jeder neuen Version reicht ein Eintrag in <code>GS_RELEASES</code> — Highlight + Liste automatisch synchron.'},
      {emoji:'🛡️', bold:'RLS-Insert-Policies gehärtet:', text:' scan_corrections / species_proposals nur authenticated mit eigener user_id. feedback_items: anon nur user_id=NULL, auth nur eigene id.'},
      {emoji:'📋', bold:'Audit-Trail:', text:' Edge-Function <code>delete-user</code> loggt jeden Account-Delete in <code>audit_log</code> mit Counts pro Tabelle.'},
    ]
  },
  {
    v: 'v23.91', date: '27.04.2026',
    headline: 'Settings, Profil, Pflanzen-UX',
    summary: 'Maßeinheiten-Helper global, Passwort-ändern mit Re-Auth, Pflanzen-Foto + Tagebuch, Account-Löschen-Modal.',
    items: [
      {emoji:'📐', bold:'Maßeinheiten-Helper global:', text:' gsFmtTemp/Distance/Weight/Size in der ganzen App nutzbar. Toast bei Wechsel: „📐 Masseinheiten umgestellt".'},
      {emoji:'🔒', bold:'Passwort ändern mit Re-Auth:', text:' aktuelles Passwort wird verifiziert bevor Update. Modal mit inline z-index 99999 — IMMER sichtbar.'},
      {emoji:'📷', bold:'Pflanzen-Foto im Add-Modal:', text:' Auto-Compress 1280px JPEG 0.82, Thumbnail auf der Plant-Card.'},
      {emoji:'📓', bold:'Pflanzen-Tagebuch:', text:' 7 Aktionstypen (Notiz/Gegossen/Gedüngt/Umgetopft/Geschnitten/Kontrolle/Foto) pro Pflanze. Auto-Update der Aufgaben-Timestamps.'},
      {emoji:'👋', bold:'Account-Löschen-Modal:', text:' Custom-Dialog mit LÖSCHEN-Bestätigung statt nativem prompt().'},
    ]
  },
];
