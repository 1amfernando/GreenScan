-- v30.84: Wissens-Ausbau (User-Wunsch: „Füge mehr Wissen hinzu — Bauernregel
-- des Tages, Wusstest du?, Gartenwissen").
--
-- Befund vor dem Ausbau (live gemessen):
--   traditional_garden_wisdom: 82 Zeilen, aber pro Monat sehr ungleich verteilt —
--     Januar 11, Dezember 11, Februar 14 → bei 31 Tagen wiederholt sich die
--     „Bauernregel des Tages" im Winter alle ~11 Tage.
--   did_you_know_facts: 162 Zeilen, aber Kategorien doppelt in DE und EN
--     (pilz/pilze/fungi, baum/trees, heilpflanze/heilpflanzen, fauna/animals,
--     flora/plants, ecology/oekologie …) → Filter-Dropdown unbrauchbar.
--   garden_techniques: 161 Zeilen, nur 20 mit Emoji → Karten optisch flach.
--
-- Dieser Ausbau: +34 Bauernregeln (Schwerpunkt Nov–Feb), +40 Fakten,
-- Kategorie-Normalisierung, Emoji-Auffüllung. Alles idempotent.

-- ═══════════════════════════════════════════════════════════════════
-- 1 · BAUERNREGELN — Schwerpunkt auf den dünnen Wintermonaten
-- ═══════════════════════════════════════════════════════════════════
-- Quellen: überlieferte CH-Bauernregeln; „modern_take" ordnet jede Regel
-- ehrlich ein (bestätigt / tendenziell / umstritten / widerlegt) statt sie
-- unkritisch zu verkaufen.

INSERT INTO public.traditional_garden_wisdom
  (slug, saying, saying_dialect, region, meaning, category, validity, modern_take, applicable_months, source)
VALUES
-- ── JANUAR ──
('neujahrsnacht-still','Ist die Neujahrsnacht still und klar, deutet''s auf ein gutes Jahr',NULL,'Schweiz','Eine ruhige, klare Silvesternacht gilt als Vorbote eines fruchtbaren Jahres.','wetter','aberglaube_widerlegt','Eine einzelne Nacht hat keinerlei Aussagekraft für die kommenden zwölf Monate. Schöne Erzählung, kein Prognosewert.',ARRAY[1],'Schweizer Bauernregel-Sammlung'),
('januar-nass-unfruchtbar','Ist der Januar nass statt weiss, bleibt der Speicher ohne Reis',NULL,'Mittelland','Ein milder, regnerischer Januar statt Schnee gilt als schlechtes Vorzeichen für die Ernte.','wetter','tendenziell_richtig','Ein Kern Wahrheit: Schneedecke schützt Boden und Wintersaaten vor Kahlfrost und speichert Feuchtigkeit. Milde Nässe fördert dagegen Pilzdruck.',ARRAY[1],'Schweizer Bauernregel-Sammlung'),
('januar-knospen-warnung','Wenn im Januar die Knospen schwellen, wird der Frost sie bald zerschellen',NULL,'Schweiz','Zu frühes Austreiben nach mildem Wetter endet meist im nächsten Frost.','wachstum','wissenschaftlich_bestaetigt','Korrekt. Vorzeitiger Austrieb nach Warmphasen ist ein reales Risiko — die Frosthärte geht verloren, Spätfrost schädigt dann Knospen und Blüten.',ARRAY[1,2],'Schweizer Bauernregel-Sammlung'),
('hl-drei-koenige-tag','An Dreikönigen wächst der Tag um einen Hirschensprung','An Dreikönig wachst dr Tag um en Hirschesprung','Innerschweiz','Ab dem 6. Januar wird die Tageslänge spürbar merklich.','wachstum','wissenschaftlich_bestaetigt','Stimmt: Nach der Wintersonnenwende nimmt der Tag zunächst kaum, ab Anfang Januar dann deutlich zu — rund 1–2 Minuten täglich.',ARRAY[1],'Schweizer Bauernregel-Sammlung'),
('januar-donner-unwetter','Januar-Donner bringt viel Unwetter',NULL,'Schweiz','Wintergewitter deuten auf eine unbeständige Folgezeit.','wetter','tendenziell_richtig','Plausibel: Gewitter im Januar setzen sehr labile Luftschichtung voraus — typisch für stürmische Westlagen, die oft mehrere Wochen anhalten.',ARRAY[1],'Bauernregeln CH / MeteoSchweiz'),
('januar-obstbaum-schnitt','Im Januar schneid den Baum, dann trägt er nächstes Jahr den Traum',NULL,'Thurgau','Der Winterschnitt an Obstbäumen erfolgt in der Saftruhe.','pflege','wissenschaftlich_bestaetigt','Fachlich korrekt — aber nur bei frostfreiem Wetter über −5 °C schneiden. Kernobst verträgt Winterschnitt gut, Steinobst besser erst im Sommer.',ARRAY[1,2],'Obstbau Schweiz'),
('januar-vogelfuetterung','Wer im Januar die Vögel nährt, dem sind im Sommer die Raupen gewehrt',NULL,'Schweiz','Winterfütterung hält Vögel im Garten, die später Schädlinge fressen.','schaedling','tendenziell_richtig','Teilweise: Winterfütterung erhöht die Überlebensrate. Der Schädlingseffekt kommt aber vor allem über Nistplätze und ein insektenreiches Umfeld.',ARRAY[1,2,12],'Schweizer Bauernregel-Sammlung'),
('januar-boden-ruhe','Gefrorener Boden im Januar spart im Frühling manche Müh',NULL,'Bern','Frost sprengt schwere Böden auf und erspart Umgraben.','pflege','wissenschaftlich_bestaetigt','Die Frostgare ist real: Gefrierendes Bodenwasser dehnt sich aus und bricht Tonaggregate auf — schwere Böden werden dadurch krümeliger.',ARRAY[1,2,12],'Bodenkunde / Agroscope'),

-- ── FEBRUAR ──
('februar-schnee-duenger','Februarschnee ist des armen Mannes Dünger',NULL,'Schweiz','Schnee im Februar soll den Boden düngen.','wachstum','umstritten','Ein Körnchen Wahrheit: Schnee bringt etwas gebundenen Stickstoff aus der Luft ein — die Menge ist mit wenigen Kilogramm pro Hektar aber gering. Der Schutzeffekt wiegt schwerer.',ARRAY[2],'Schweizer Bauernregel-Sammlung'),
('lichtmess-hell','Ist''s an Lichtmess hell und rein, wird ein langer Winter sein','Isch Liechtmäss hell und rein, git''s en lange Winter drei','Schweiz','Klares Wetter am 2. Februar deutet auf anhaltenden Winter.','wetter','aberglaube_widerlegt','Der Ursprung des Murmeltiertags. Meteorologisch ohne Grundlage: Ein einzelner Tag lässt keinen Schluss auf sechs weitere Wochen zu.',ARRAY[2],'Schweizer Bauernregel-Sammlung'),
('februar-sturm-fruehling','Februarstürme bringen den Frühling herbei',NULL,'Mittelland','Stürmischer Februar leitet den Wechsel zur Frühjahrswitterung ein.','wetter','tendenziell_richtig','Nachvollziehbar: Kräftige Westwindlagen im Spätwinter bringen milde Atlantikluft — die Vegetation startet danach oft früher.',ARRAY[2],'Bauernregeln CH / MeteoSchweiz'),
('februar-haselbluete','Blüht die Hasel im Februar, kommt ein zeitiges Frühjahr',NULL,'Schweiz','Die Haselblüte gilt als erster Frühlingsbote.','wachstum','wissenschaftlich_bestaetigt','Phänologisch korrekt: Die Haselblüte markiert offiziell den Vorfrühling. Sie reagiert direkt auf die Wärmesumme der Vorwochen.',ARRAY[1,2],'Phänologie / MeteoSchweiz'),
('februar-aussaat-fenster','Im Februar die Zwiebel sät, wer eine frühe Ernte mäht',NULL,'Wallis','Frühe Aussaat von Zwiebeln in milden Lagen.','aussaat','tendenziell_richtig','Gilt nur für milde Lagen wie das Wallis oder das Tessin. Im Mittelland und in Berglagen ist Februar zu früh — Vorkultur im Haus ist sinnvoller.',ARRAY[2],'Schweizer Bauernregel-Sammlung'),
('februar-nebel-frost','Februarnebel bringt im Mai noch Frost',NULL,'Emmental','Häufiger Februarnebel gilt als Vorzeichen für späte Fröste.','wetter','aberglaube_widerlegt','Keine belegbare Kopplung über drei Monate. Spätfröste im Mai entstehen durch kurzfristige Kaltluftvorstösse, nicht durch Februarnebel.',ARRAY[2],'Schweizer Bauernregel-Sammlung'),
('februar-kompost-wenden','Wend im Februar den Kompost, dann hast du im März den besten Most',NULL,'Schweiz','Umsetzen des Komposts vor der Gartensaison.','pflege','wissenschaftlich_bestaetigt','Sinnvoll: Umsetzen bringt Sauerstoff ein und beschleunigt die Rotte, sodass der Kompost zur Pflanzzeit reif ist.',ARRAY[2,3],'Kompostberatung Schweiz'),

-- ── NOVEMBER ──
('november-laub-schutz','Lass das Laub am Beete liegen, wirst im Frühling Leben kriegen',NULL,'Schweiz','Laub als natürliche Winterdecke stehenlassen.','pflege','wissenschaftlich_bestaetigt','Ökologisch belegt: Laubschicht schützt vor Frost und Erosion und bietet Igeln, Laufkäfern und Puppen Überwinterungsraum.',ARRAY[10,11],'Naturgarten / BAFU'),
('allerheiligen-winter','Allerheiligen Sonnenschein zieht einen harten Winter ein',NULL,'Innerschweiz','Schönes Wetter am 1. November deutet auf strengen Winter.','wetter','aberglaube_widerlegt','Kein statistischer Zusammenhang nachweisbar. Klassische Lostag-Regel ohne Prognosewert.',ARRAY[11],'Schweizer Bauernregel-Sammlung'),
('november-baum-pflanzen','Im November gepflanzt, hat im Frühling schon getanzt',NULL,'Mittelland','Herbstpflanzung von Gehölzen ist der Frühjahrspflanzung überlegen.','pflege','wissenschaftlich_bestaetigt','Fachlich richtig: Wurzeln wachsen im noch warmen Boden weiter, die Pflanze ist im Frühjahr etabliert und übersteht Trockenheit besser.',ARRAY[10,11],'Baumschule Schweiz'),
('november-nebel-winter','Novembernebel, milder Winter',NULL,'Schweiz','Nebelreicher November soll milden Winter ankündigen.','wetter','umstritten','Schwach begründbar: Nebellagen zeigen stabile Hochdrucklagen an. Ein Rückschluss auf den ganzen Winter ist daraus aber nicht seriös ableitbar.',ARRAY[11],'Bauernregeln CH / MeteoSchweiz'),
('martini-gans','Sankt Martin trüb, macht den Winter lieb',NULL,'Schweiz','Trübes Wetter am 11. November verspricht milden Winter.','wetter','aberglaube_widerlegt','Lostag-Regel ohne meteorologische Basis. Die Martini-Tradition ist kulturell wertvoll, als Prognose aber wertlos.',ARRAY[11],'Schweizer Bauernregel-Sammlung'),
('november-schnitt-verbot','Im November ruht die Schere, sonst nimmt der Frost die Ehre',NULL,'Schweiz','Spätherbstschnitt macht Pflanzen frostempfindlich.','pflege','tendenziell_richtig','Weitgehend korrekt: Frische Schnittwunden verholzen im Spätherbst schlecht und sind Eintrittspforten für Frostschäden und Pilze. Besser bis zur Saftruhe warten.',ARRAY[11],'Obstbau Schweiz'),

-- ── DEZEMBER ──
('dezember-kalt-jahr','Dezember kalt mit Schnee, gibt Korn auf jeder Höh',NULL,'Graubünden','Kalter, schneereicher Dezember verspricht gute Getreideernte.','wetter','tendenziell_richtig','Die Schneedecke schützt Wintersaaten vor Kahlfrost — insoweit plausibel. Der Ernteerfolg hängt aber weit stärker vom Frühjahr ab.',ARRAY[12],'Schweizer Bauernregel-Sammlung'),
('barbarazweig','Barbarazweige am 4. Dezember blühen an Weihnachten',NULL,'Schweiz','Am Barbaratag geschnittene Kirschzweige blühen zum Fest.','pflege','wissenschaftlich_bestaetigt','Funktioniert tatsächlich: Die Knospen haben ihre Kältebedürfnis-Phase erfüllt und treiben in der warmen Stube nach etwa drei Wochen aus.',ARRAY[12],'Volksbrauch / Botanik'),
('weihnacht-gruen-ostern-weiss','Weihnachten grün, Ostern weiss','Wiehnacht grüen, Oschtere wiiss','Schweiz','Milde Weihnachten bedeuten kalte Ostern.','wetter','aberglaube_widerlegt','Statistisch nicht haltbar — der Zusammenhang wurde mehrfach an Langzeitreihen geprüft und widerlegt. Beliebt, aber falsch.',ARRAY[12],'Schweizer Bauernregel-Sammlung'),
('dezember-wintersonnenwende','Zur Sonnenwende kehrt das Licht, doch Kälte weicht noch lange nicht',NULL,'Schweiz','Trotz zunehmender Tage folgen die kältesten Wochen erst danach.','wetter','wissenschaftlich_bestaetigt','Korrekt und wichtig: Die Kältephase hinkt der Sonnenwende um Wochen nach, weil Boden und Gewässer erst auskühlen müssen.',ARRAY[12,1],'Meteorologie'),
('dezember-vogel-wasser','Im Winter ist offenes Wasser den Vögeln lieber als das Futter',NULL,'Schweiz','Wasser ist im Frost knapper als Nahrung.','pflege','wissenschaftlich_bestaetigt','Stimmt: Bei durchgefrorener Landschaft ist Trinkwasser der limitierende Faktor. Eine eisfreie Tränke hilft mehr als zusätzliches Futter.',ARRAY[12,1,2],'Vogelwarte Sempach'),
('dezember-immergruen-giessen','Auch der Immergrüne dürstet, wenn der Frost die Erde bürstet',NULL,'Schweiz','Immergrüne Pflanzen verdunsten auch im Winter Wasser.','pflege','wissenschaftlich_bestaetigt','Wichtiger Punkt: Frosttrocknis ist eine Hauptursache für Winterschäden. An frostfreien Tagen giessen — besonders bei Buchs, Rhododendron und Kübelpflanzen.',ARRAY[12,1,2],'Gartenbau Schweiz'),
('dezember-schnee-aeste','Schüttle den Schnee vom Ast, sonst bricht er unter seiner Last',NULL,'Berggebiete','Nassschnee kann Äste brechen.','pflege','wissenschaftlich_bestaetigt','Praktisch richtig, besonders bei Nassschnee und Säulenformen. Vorsichtig abschütteln — gefrorene Äste brechen bei ruckartiger Bewegung leicht.',ARRAY[12,1,2],'Gartenbau Schweiz'),

-- ── GANZJÄHRIG / MEHRMONATIG ──
('boden-nie-nackt','Ein nackter Boden ist ein kranker Boden',NULL,'Schweiz','Offener Boden verliert Struktur, Feuchtigkeit und Leben.','pflege','wissenschaftlich_bestaetigt','Zentrale Regel der modernen Bodenkunde: Dauerbegrünung oder Mulch schützt vor Erosion, Verschlämmung und Humusabbau.',ARRAY[1,2,3,4,5,6,7,8,9,10,11,12],'Agroscope / Bodenkunde'),
('regenwurm-reichtum','Wo der Regenwurm sich wohlfühlt, wächst auch der Gärtner Glück',NULL,'Schweiz','Regenwurmdichte als Indikator für Bodengesundheit.','wachstum','wissenschaftlich_bestaetigt','Belegt: Regenwürmer sind ein anerkannter Bioindikator. Ihre Gänge verbessern Durchlüftung, Wasserführung und Nährstoffverfügbarkeit.',ARRAY[3,4,5,6,7,8,9,10],'Agroscope'),
('giessen-morgens','Giess am Morgen, nicht am Abend, sonst wird''s der Schnecke labend',NULL,'Schweiz','Morgens giessen beugt Schnecken und Pilzen vor.','pflege','wissenschaftlich_bestaetigt','Doppelt richtig: Blätter trocknen tagsüber ab (weniger Pilzdruck) und feuchte Nachtbeete locken Schnecken deutlich stärker an.',ARRAY[4,5,6,7,8,9],'Gartenbau Schweiz'),
('mischkultur-schutz','Zwiebel neben Rüebli sät, wer Fliegen aus dem Beete jagt',NULL,'Schweiz','Mischkultur von Zwiebeln und Karotten gegen Möhrenfliege.','schaedling','tendenziell_richtig','Der Klassiker der Mischkultur. Studien zeigen eine Wirkung, sie ist aber schwächer als oft behauptet — ein Kulturschutznetz wirkt zuverlässiger.',ARRAY[3,4,5,6],'Bio Suisse / Mischkultur'),
('unkraut-zeigt-boden','Das Unkraut sagt dir, was dein Boden hat',NULL,'Schweiz','Wildkräuter als Zeigerpflanzen für Bodeneigenschaften.','wachstum','wissenschaftlich_bestaetigt','Anerkanntes Prinzip (Ellenberg-Zeigerwerte): Brennnessel zeigt Stickstoff, Schachtelhalm Staunässe, Hederich saure Böden an.',ARRAY[3,4,5,6,7,8,9,10],'Ellenberg / Vegetationskunde'),
('eisheilige-warten','Vor den Eisheiligen ist kein Sommer sicher','Vor de Iisheilige isch kei Summer sicher','Schweiz','Bis Mitte Mai droht noch Frost.','wetter','tendenziell_richtig','Statistisch abgeschwächt, aber praktisch weiter klug: Späte Fröste bis Mitte Mai kommen im Mittelland regelmässig vor. Frostempfindliches erst danach auspflanzen.',ARRAY[4,5],'MeteoSchweiz'),
('herbstlaub-kompost','Herbstlaub im Kompost ist des Gärtners bester Trost',NULL,'Schweiz','Laub als Kompostmaterial.','pflege','wissenschaftlich_bestaetigt','Richtig, mit Einschränkung: Laub ist kohlenstoffreich und verrottet langsam. Mit stickstoffreichem Material mischen, sonst stockt die Rotte.',ARRAY[10,11],'Kompostberatung Schweiz')
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- 2 · „WUSSTEST DU?" — Kategorien normalisieren + neue Fakten
-- ═══════════════════════════════════════════════════════════════════
-- 2a) Doppelte DE/EN-Kategorien auf eine deutsche Form vereinheitlichen.
--     Vorher waren u.a. pilz/pilze/fungi drei getrennte Filter-Einträge.
UPDATE public.did_you_know_facts SET category = 'pilze'        WHERE category IN ('pilz','fungi');
UPDATE public.did_you_know_facts SET category = 'baeume'       WHERE category IN ('baum','trees');
UPDATE public.did_you_know_facts SET category = 'tiere'        WHERE category IN ('animals','fauna');
UPDATE public.did_you_know_facts SET category = 'pflanzen'     WHERE category IN ('plants','flora','botany');
UPDATE public.did_you_know_facts SET category = 'heilpflanzen' WHERE category IN ('heilpflanze','medicinal');
UPDATE public.did_you_know_facts SET category = 'wildkraeuter' WHERE category IN ('wildkraut','wildpflanzen','foraging');
UPDATE public.did_you_know_facts SET category = 'oekologie'    WHERE category IN ('ecology','naturschutz');
UPDATE public.did_you_know_facts SET category = 'kraeuter'     WHERE category IN ('herbs','culinary');
UPDATE public.did_you_know_facts SET category = 'garten'       WHERE category IN ('permakultur','schaedlinge','ernte');
UPDATE public.did_you_know_facts SET category = 'wald'         WHERE category IN ('forest');
UPDATE public.did_you_know_facts SET category = 'pflanzen'     WHERE category IN ('chemistry','ethnobotany','folklore');
UPDATE public.did_you_know_facts SET category = 'natur'        WHERE category IS NULL OR TRIM(category) = '';

-- 2b) Eindeutigkeit auf dem Titel — did_you_know_facts hatte NUR einen
--     Primärschlüssel auf id. Ohne UNIQUE(title) wäre jedes erneute Ausführen
--     dieser Migration ein Duplikat-Generator. Live geprüft: aktuell 0 doppelte
--     Titel, die Bedingung greift also sauber.
CREATE UNIQUE INDEX IF NOT EXISTS did_you_know_facts_title_uidx
  ON public.did_you_know_facts (title);

-- 2c) Neue Fakten. Bewusst mit Schweiz-Bezug und über die Kategorien verteilt.
INSERT INTO public.did_you_know_facts (title, body, icon, category, month, is_active)
VALUES
('Bäume warnen sich gegenseitig','Wird eine Akazie von Tieren befressen, gibt sie Ethylen an die Luft ab. Nachbarbäume registrieren das Signal und reichern innert Minuten Gerbstoffe in ihren Blättern an — sie schmecken dann bitter.','🌳','baeume',NULL,true),
('Der grösste Organismus ist ein Pilz','Ein Hallimasch-Geflecht in Oregon durchzieht rund 9 km² Waldboden und gilt als grösstes bekanntes Lebewesen der Erde. Auch Schweizer Wälder beherbergen Geflechte von mehreren Hektaren.','🍄','pilze',NULL,true),
('Wurzeln handeln mit Pilzen','Über 90 % aller Landpflanzen leben in Mykorrhiza — Pilze liefern Wasser und Phosphor, die Pflanze zahlt mit Zucker. Ein Teelöffel gesunder Waldboden enthält kilometerlange Pilzfäden.','🤝','pilze',NULL,true),
('Der Edelweiss-Pelz ist ein Sonnenschutz','Die weisse Behaarung des Edelweiss besteht aus luftgefüllten Härchen, die UV-Strahlung absorbieren — ein natürlicher Sonnenschutz für das Hochgebirge. In der Schweiz ist die Pflanze geschützt.','🏔️','pflanzen',NULL,true),
('Brennnesseln sind Nährstoff-Kraftwerke','Brennnesseln enthalten mehr Eisen als Spinat und bis zu 30 % Protein in der Trockenmasse. Als Jauche liefern sie zudem einen der stickstoffreichsten Gratis-Dünger im Garten.','🌿','wildkraeuter',NULL,true),
('Igel laufen erstaunlich weit','Ein Igel legt in einer Nacht bis zu zwei Kilometer zurück. Deshalb braucht er vernetzte Gärten — ein 13 × 13 cm grosses Loch im Zaun genügt als Durchgang.','🦔','tiere',NULL,true),
('Wildbienen sind meist Einzelgänger','Von den rund 600 Wildbienenarten der Schweiz leben über 90 % solitär, ohne Volk und ohne Honig. Viele nisten im Boden — offene Erdstellen sind wertvoller als jedes gekaufte Insektenhotel.','🐝','tiere',NULL,true),
('Löwenzahn-Wurzeln reichen tief','Die Pfahlwurzel des Löwenzahns wird bis zu einem Meter lang. Sie durchbricht Verdichtungen und holt Mineralien aus Tiefen, die andere Pflanzen nicht erreichen — deshalb ist er ein guter Bodenlockerer.','🌼','wildkraeuter',NULL,true),
('Nadelbäume frieren nicht','Fichten und Tannen lagern im Herbst Zucker und Eiweisse in ihre Zellen ein — ein biologisches Frostschutzmittel. Dadurch überstehen sie Temperaturen bis unter −40 °C.','🌲','baeume',12,true),
('Ein Regenwurm frisst sein eigenes Gewicht','Regenwürmer setzen täglich etwa ihr Körpergewicht an Erde um. Auf einem gesunden Hektar erzeugen sie im Jahr mehrere Tonnen Wurmhumus.','🪱','oekologie',NULL,true),
('Schnecken haben Tausende Zähne','Auf der Raspelzunge einer Nacktschnecke sitzen bis zu 25 000 winzige Zähnchen. Damit schabt sie Blätter ab — der typische Lochfrass entsteht.','🐌','tiere',5,true),
('Tomaten sind Nachtschattengewächse','Tomate, Kartoffel, Aubergine und Paprika gehören alle zur selben Familie wie die giftige Tollkirsche. Grüne Tomaten und Kartoffelkeime enthalten deshalb Solanin.','🍅','garten',7,true),
('Lavendel wirkt nachweislich beruhigend','Der Inhaltsstoff Linalool im Lavendelöl dämpft nachweislich die Aktivität des Nervensystems. Studien zeigen messbare Effekte auf Einschlafzeit und Angstempfinden.','💜','heilpflanzen',6,true),
('Der Bärlauch-Irrtum kann tödlich sein','Bärlauch wird mit Maiglöckchen und Herbstzeitlose verwechselt — beide sind stark giftig. Sicheres Merkmal: Bärlauch riecht beim Zerreiben deutlich nach Knoblauch, die Giftpflanzen nicht.','⚠️','wildkraeuter',4,true),
('Moose haben keine Wurzeln','Moose nehmen Wasser und Nährstoffe über die gesamte Oberfläche auf. Manche Arten überleben komplette Austrocknung und ergrünen nach Regen innert Minuten wieder.','🌱','pflanzen',NULL,true),
('Ein Baum kühlt wie zehn Klimageräte','Eine ausgewachsene Buche verdunstet an einem Sommertag bis zu 400 Liter Wasser. Die Verdunstungskühlung entspricht der Leistung mehrerer Klimageräte — Stadtbäume senken die Umgebungstemperatur messbar.','❄️','baeume',7,true),
('Vögel brauchen Insekten, nicht Körner','Fast alle heimischen Singvögel füttern ihre Jungen ausschliesslich mit Insekten. Ein Meisenpaar braucht für eine Brut rund 10 000 Raupen — ein insektenfreundlicher Garten ist Vogelschutz.','🐦','tiere',5,true),
('Kompost wird über 60 Grad heiss','In einem gut geschichteten Komposthaufen erzeugen Mikroorganismen Temperaturen von 60–70 °C. Diese Hitze tötet Unkrautsamen und Krankheitserreger ab.','♨️','garten',NULL,true),
('Schachtelhalm ist ein lebendes Fossil','Schachtelhalme wuchsen bereits vor 400 Millionen Jahren als baumhohe Wälder. Ihr hoher Kieselsäuregehalt macht sie heute zum klassischen Pflanzenstärkungsmittel.','🦕','heilpflanzen',NULL,true),
('Rot sehen Bienen nicht','Bienen nehmen Ultraviolett wahr, aber kein Rot — rote Blüten erscheinen ihnen schwarz. Viele Blüten tragen UV-Muster, die für uns unsichtbar sind und wie Landebahnen wirken.','🌈','tiere',NULL,true),
('Der Fliegenpilz ist selten tödlich','Trotz seines Rufs verläuft eine Fliegenpilz-Vergiftung nur äusserst selten tödlich. Die wirklich gefährlichen Arten sind die unscheinbaren Knollenblätterpilze — sie verursachen fast alle Todesfälle.','🍄','pilze',9,true),
('Efeu blüht als einzige im Herbst','Efeu blüht von September bis November — dann, wenn kaum eine andere Pflanze Nektar bietet. Für Bienen und Schwebfliegen ist er die letzte grosse Nahrungsquelle vor dem Winter.','🍃','oekologie',10,true),
('Samen können Jahrzehnte warten','Im Boden ruhende Samen bilden eine Samenbank. Manche Ackerwildkräuter keimen noch nach über 50 Jahren, sobald Licht und Bodenbewegung sie erreichen.','⏳','pflanzen',NULL,true),
('Marienkäfer-Larven sind die besseren Jäger','Eine einzige Marienkäferlarve frisst bis zu 400 Blattläuse, bevor sie sich verpuppt. Die unscheinbaren, grau-orangen Larven sind also wertvoller als die Käfer selbst.','🐞','tiere',6,true),
('Wasser steigt ohne Pumpe 100 Meter hoch','Bäume transportieren Wasser rein durch Verdunstungssog und Kohäsion bis in die Krone. In den Leitbahnen herrscht dabei Unterdruck — ein physikalisches Kunststück ohne bewegliche Teile.','💧','baeume',NULL,true),
('Alpenpflanzen wachsen extrem langsam','Ein Polster des Stengellosen Leimkrauts kann über 100 Jahre alt sein und wächst nur Millimeter pro Jahr. Ein Tritt neben den Weg zerstört Jahrzehnte Wachstum.','🏔️','oekologie',7,true),
('Die Kartoffel kam über Spanien','Die Kartoffel stammt aus den Anden und erreichte Europa im 16. Jahrhundert. In der Schweiz setzte sie sich erst nach den Hungerkrisen des 18. Jahrhunderts durch.','🥔','garten',NULL,true),
('Rosmarin überwintert nicht überall','Rosmarin ist im Mittelmeerraum winterhart, im Schweizer Mittelland aber grenzwertig. Sorten wie „Arp" oder „Veitshöchheim" überstehen Frost deutlich besser.','🌿','kraeuter',11,true),
('Blätter fallen nicht ab — sie werden abgeworfen','Vor dem Laubfall bildet der Baum eine Trennschicht am Blattstiel und zieht vorher Stickstoff und Phosphor zurück. Das Herbstlaub ist also bereits ausgeräumte Restsubstanz.','🍂','baeume',10,true),
('Ameisen melken Blattläuse','Ameisen schützen Blattlauskolonien vor Feinden und ernten dafür deren Honigtau. Wer Blattläuse bekämpfen will, muss deshalb oft zuerst die Ameisenstrasse unterbrechen.','🐜','tiere',6,true),
('Der Boden lebt mehr als die Erde darüber','In einer Handvoll gesundem Gartenboden leben mehr Organismen als Menschen auf der Erde. Der Grossteil ist bis heute nicht wissenschaftlich beschrieben.','🔬','oekologie',NULL,true),
('Schnittlauch blüht essbar','Die violetten Schnittlauchblüten sind essbar und schmecken mild-zwiebelig. Sie machen sich gut im Salat — nach der Blüte werden die Halme allerdings hart.','💐','kraeuter',6,true),
('Frost macht Rosenkohl süss','Bei Frost wandelt Rosenkohl Stärke in Zucker um, um seine Zellen zu schützen. Deshalb schmeckt er nach den ersten Frostnächten deutlich milder.','🥬','garten',11,true),
('Spinnen sind die grössten Insektenjäger','Spinnen erbeuten weltweit jährlich mehr Insektenbiomasse als alle Vögel zusammen. Ein Garten mit Spinnennetzen ist ein biologisch regulierter Garten.','🕷️','tiere',9,true),
('Die Eibe ist fast komplett giftig','Alle Teile der Eibe sind stark giftig — ausser dem roten Fruchtmantel. Der Samen darin ist es allerdings wieder. Vögel fressen die Frucht und scheiden den Samen unverdaut aus.','☠️','baeume',9,true),
('Gründüngung ersetzt den Dünger','Phacelia, Klee und Lupine binden Stickstoff aus der Luft und lockern den Boden. Nach dem Einarbeiten liefern sie Nährstoffe, für die man sonst Dünger kaufen müsste.','🌾','garten',8,true),
('Der Duft von Regen hat einen Namen','Petrichor entsteht, wenn Regen auf trockenen Boden trifft und Geosmin freisetzt — ein Stoffwechselprodukt von Bodenbakterien. Menschen nehmen ihn noch in winzigsten Mengen wahr.','🌧️','oekologie',NULL,true),
('Buchsbaumzünsler kam per Schiff','Der Buchsbaumzünsler wurde um 2007 aus Ostasien eingeschleppt und hat sich seither in der ganzen Schweiz ausgebreitet. Natürliche Gegenspieler fehlen — Spatzen lernen ihn erst langsam zu fressen.','🐛','garten',6,true),
('Bärentraube wirkt bei Blasenentzündung','Bärentraubenblätter enthalten Arbutin, das im Harn antibakteriell wirkt. Die Anwendung ist gut belegt, sollte aber wegen der Hydrochinon-Belastung zeitlich begrenzt bleiben.','🫐','heilpflanzen',NULL,true),
('Ein Kubikmeter Waldluft ist fast keimfrei','Bäume geben Terpene ab, die Bakterien und Pilzsporen hemmen. Waldluft enthält dadurch deutlich weniger Keime als Stadtluft — ein Teil des messbaren Effekts von Waldspaziergängen.','🌲','wald',NULL,true)
ON CONFLICT (title) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- 3 · GARTENWISSEN — Emojis auffüllen (nur 20 von 161 hatten eines)
-- ═══════════════════════════════════════════════════════════════════
-- Die Karten wirkten ohne Emoji optisch flach. Kategorie-passendes
-- Standard-Emoji setzen, vorhandene bleiben unangetastet.
UPDATE public.garden_techniques SET emoji = CASE category
    WHEN 'soil'         THEN '🪱'
    WHEN 'propagation'  THEN '🌱'
    WHEN 'pest_control' THEN '🐞'
    WHEN 'pruning'      THEN '✂️'
    WHEN 'fertilizing'  THEN '🧪'
    WHEN 'planting'     THEN '🪴'
    WHEN 'permaculture' THEN '♻️'
    WHEN 'mulching'     THEN '🍂'
    WHEN 'companion'    THEN '🤝'
    WHEN 'seasonal'     THEN '📅'
    ELSE '🌿'
  END
WHERE emoji IS NULL OR TRIM(emoji) = '';
