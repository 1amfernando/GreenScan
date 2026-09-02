#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""field_check.py — Formularfelder, die niemand liest.

    python3 scripts/field_check.py

Anlass: v31.72. Das Garten-Formular hatte Breite und Laenge, eine
Flaechen-Vorschau rechnete live mit ihnen, und `editGarden` LAS sie beim
Bearbeiten wieder ein — nur geschrieben hat sie nie jemand. Man tippte die
Masse ein, sah die Flaeche, speicherte, und beim naechsten Oeffnen war
alles leer. Gefunden wurde das beim Lesen, nicht beim Messen; dieser
Pruefstand macht daraus etwas Wiederholbares.

WIE ER SUCHT: er zaehlt jedes Vorkommen einer Feld-id im Quelltext
AUSSERHALB ihrer eigenen Definition. Das ist absichtlich grob — es erfasst
auch Helfer (`g('x')`), maskierte Anfuehrungszeichen (`\'x\'`) und jede
querySelector-Variante. Der erste Anlauf suchte nur nach
`getElementById('x')` und meldete daraufhin 172 von 172 Feldern als kaputt.

WAS ER NICHT FINDEN KANN — und das ist wichtig, sonst jagt der Naechste
Gespenster:

  · Zusammengesetzte Namen. `getElementById('tp-' + k)` ist von keiner
    Textsuche zu finden. Die vier Felder tp-len/tp-wid/tp-soil/tp-light
    sind so verdrahtet und funktionieren.
  · Felder mit eigenem on*-Attribut (`onchange="savePref('x',this.checked)"`)
    werden uebersprungen — sie brauchen keinen Namen im Code. Ohne diese
    Regel meldet er fast jede Einstellung als kaputt.

Ein Treffer ist also ein VERDACHT, kein Urteil. Jede Zeile einzeln
nachsehen. Beim ersten gezielten Durchgang (v31.74) blieb von 303 Feldern
genau einer uebrig, der wirklich nichts tat: „Angemeldet bleiben".
"""

import io, re
src = io.open('/home/user/GreenScan/index.html', encoding='utf-8').read()

felder = {}
for m in re.finditer(r'<(input|select|textarea)\b([^>]*)>', src, re.I):
    attrs = m.group(2)
    mid = re.search(r'\bid="([^"]+)"', attrs)
    if not mid: continue
    typ = re.search(r'\btype="([^"]+)"', attrs)
    if typ and typ.group(1).lower() == 'hidden': continue
    eigen = bool(re.search(r'\bon(change|input|click|blur|keyup|keydown|submit)=', attrs))
    ph = re.search(r'\bplaceholder="([^"]*)"', attrs)
    felder[mid.group(1)] = {'pos': m.start(), 'eigen': eigen, 'ende': m.end(),
                            'typ': (typ.group(1) if typ else ''),
                            'ph': (ph.group(1) if ph else '')[:36],
                            'tag': m.group(1).lower()}

anker = [(m.start(), m.group(1)) for m in re.finditer(r'id="((?:modal|screen)-[a-z0-9\-]+)"', src)]
def wo(pos):
    letzter = ''
    for p, n in anker:
        if p < pos: letzter = n
        else: break
    return letzter

verdaechtig = []
for fid, f in felder.items():
    # Jedes Vorkommen der id im Quelltext zaehlen …
    treffer = [m.start() for m in re.finditer(re.escape(fid), src)]
    # … ausser denen INNERHALB der eigenen Definition
    aussen = [t for t in treffer if not (f['pos'] <= t <= f['ende'])]
    if not aussen and not f['eigen']:
        verdaechtig.append((fid, wo(f['pos']), f['tag'] + (':' + f['typ'] if f['typ'] else ''), f['ph']))

print('Formularfelder gesamt :', len(felder))
print('Kommen NIRGENDS sonst vor (weder gelesen noch eigenes on*):', len(verdaechtig))
for z in sorted(verdaechtig): print('   !! %-26s %-26s %-15s %s' % z)
