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

DREI KLASSEN seit v32.41 (vorher zwei):

  !!  nirgends gelesen, kein eigenes on*, kein zusammengesetzter Name
      -> das ist der Verdacht
  .   zusammengesetzt nachgeschlagen (`getElementById('tp-' + k)`)
      -> KEIN Fehler; die vier `tp-`-Felder standen seit v31.74 als
         Dauer-Falschmeldung im Bericht
  (still) normal gelesen

DER PREIS, ehrlich benannt: ein Feld, das mit einem erkannten Praefix
ANFAENGT, aber trotzdem tot ist, landet in der mittleren Klasse statt in der
oberen. Genau deshalb verschwindet diese Klasse nicht aus dem Bericht - sie
wird nur nicht mehr mitgezaehlt. Gegenprobe gemacht: ein totes Feld mit
eigenem Namen wird weiter rot gemeldet, ein totes `tp-gegenprobe` landet
sichtbar in der mittleren Klasse.
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

# -- v32.41 - Zusammengesetzte Namen erkennen, statt sie zu melden --------
#
# `getElementById('tp-' + k)` enthaelt die id `tp-len` nirgends als
# Zeichenkette. Vier solche Felder standen seit v31.74 als Treffer im Bericht
# und funktionieren tadellos - eine DAUERHAFTE Falschmeldung.
#
# Das ist nicht bloss Kosmetik. Genau so wird ein Bericht unlesbar: nicht
# durch eine falsche Zahl, sondern durch eine, die man zu ignorieren gelernt
# hat (dieselbe Lehre wie bei `render_check` in v32.21, wo vier
# Emoji-Wasserzeichen jahrelang als "abgeschnittener Inhalt" gemeldet wurden).
#
# Erkannt wird deshalb die BAUFORM: ein Nachschlagen, dessen Argument mit
# einer Zeichenkette beginnt und dann verkettet wird. Die so gefundenen
# Praefixe bekommen eine EIGENE Klasse - sie verschwinden nicht, sie werden
# nur nicht mehr als Fehler gezaehlt.
#
# **Was man nicht beweisen kann, sagt man gesondert, statt es unter die
# Fehler zu mischen.**
VERKETTUNG = r"(?:getElementById|querySelector|querySelectorAll)\(\s*['\"]#?([A-Za-z0-9_-]{2,})['\"]\s*\+"
praefixe = set(m.group(1) for m in re.finditer(VERKETTUNG, src))

verdaechtig = []
zusammengesetzt = []
for fid, f in felder.items():
    # Jedes Vorkommen der id im Quelltext zaehlen ...
    treffer = [m.start() for m in re.finditer(re.escape(fid), src)]
    # ... ausser denen INNERHALB der eigenen Definition
    aussen = [t for t in treffer if not (f['pos'] <= t <= f['ende'])]
    if aussen or f['eigen']:
        continue
    passend = sorted([p for p in praefixe if fid.startswith(p) and len(fid) > len(p)],
                     key=len, reverse=True)
    zeile = (fid, wo(f['pos']), f['tag'] + (':' + f['typ'] if f['typ'] else ''), f['ph'])
    if passend:
        zusammengesetzt.append(zeile + (passend[0],))
    else:
        verdaechtig.append(zeile)

print('Formularfelder gesamt :', len(felder))
print('Kommen NIRGENDS sonst vor (weder gelesen noch eigenes on*):', len(verdaechtig))
for z in sorted(verdaechtig): print('   !! %-26s %-26s %-15s %s' % z)
print('Zusammengesetzt nachgeschlagen (kein Fehler):', len(zusammengesetzt))
for z in sorted(zusammengesetzt):
    print("   .  %-26s %-26s %-15s ueber '%s' + ..." % (z[0], z[1], z[2], z[4]))
print('Erkannte Verkettungs-Praefixe:', len(praefixe),
      ('(' + ', '.join(sorted(praefixe)[:8]) + ('...' if len(praefixe) > 8 else '') + ')') if praefixe else '')
