#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""arten_namen_pruefung.py — sind die lateinischen Namen der Artenliste gueltig?

Die Frage aus docs/ARTEN-LUECKEN.md §2: sind Binome wie „Rumex persicaria" oder
„Urtica officinalis" akzeptierte Namen, Synonyme oder OCR-Phantome? Bis zum 11.11.2026
hiess die Antwort „von hier aus nicht pruefbar". Zwei taxonomische Rueckgratlisten sind
aber als R-Datenpakete ueber raw.githubusercontent.com erreichbar:

  WCVP  World Checklist of Vascular Plants (Kew), Stand v16 vom 04.06.2026,
        aus dem Paket rWCVPdata 0.8.0 (inst/CITATION nennt Version und Datum)
        https://raw.githubusercontent.com/matildabrown/rWCVPdata/main/data/wcvp_names.rda
        50'703'420 Bytes · 1'448'984 Namen · Lizenz der Daten: CC BY (Kew), des Pakets: GPL-3
  LCVP  Leipzig Catalogue of Vascular Plants 3.0.1 (iDiv) — die ZWEITE Stimme
        https://raw.githubusercontent.com/idiv-biodiversity/LCVP/master/data/tab_lcvp.rda
        18'491'776 Bytes · 1'337'891 Namen · Lizenz: MIT

Die Listen gehoeren NICHT ins Repo (zusammen 69 MB). Abrufweg:

  mkdir -p /tmp/listen/wcvp /tmp/listen/lcvp
  curl -o /tmp/listen/wcvp/wcvp_names.rda https://raw.githubusercontent.com/matildabrown/rWCVPdata/main/data/wcvp_names.rda
  curl -o /tmp/listen/lcvp/tab_lcvp.rda   https://raw.githubusercontent.com/idiv-biodiversity/LCVP/master/data/tab_lcvp.rda
  python3 scripts/arten_namen_pruefung.py --wcvp /tmp/listen/wcvp/wcvp_names.rda --lcvp /tmp/listen/lcvp/tab_lcvp.rda

  python3 scripts/arten_namen_pruefung.py --selbsttest     # die Regeln allein, ohne jede Liste

Danach laeuft alles OHNE Netz. Ohne --schreiben wird docs/arten-namen-pruefung.csv nur
VERGLICHEN (Exit 1 bei Abweichung); ohne eine Liste ist das Ergebnis „nicht pruefbar"
(Exit 2), nie gruen.

WAS GEPRUEFT WIRD — UND WAS NICHT
  Beide Listen fuehren nur GEFAESSPFLANZEN. Eintraege der Kategorien pilz, flechte, moos
  und alge sind deshalb `nicht_pruefbar` (mit Grund), nicht `unbekannt`. Geprueft wird der
  NAME, nicht ob die Art in der Schweiz vorkommt, und nicht ob der deutsche Name dazu passt.

DIE VIER KLASSEN
  akzeptiert      der Name ist in der Liste der akzeptierte Name eines Taxons
  synonym         der Name ist ein Synonym (auch: illegitim, ungueltig, orthographische
                  Variante, falsch angewandt) — mit dem akzeptierten Namen daneben
  unbekannt       kein Treffer in WCVP und LCVP, auch nicht unscharf
  nicht_pruefbar  mit Grund: falsches Reich fuer die Listen · nur eine Gattung · Name in
                  der Liste „Unplaced"/„unresolved" (bekannt, aber nicht eingeordnet) ·
                  unscharfer Treffer mit mehreren gleich guten Kandidaten

TREFFER-ARTEN (Spalte treffer_art) — ein unscharfer Treffer zaehlt NIE still als exakt
  exakt               Zeichen fuer Zeichen (nur Leerraum bereinigt)
  normalisiert        rein formal umgeschrieben: Hybridzeichen (x/×), ssp.→subsp., „agg."/
                      „s.l." entfernt, Autor („L.") entfernt, Klammerzusatz „(blau)" entfernt,
                      gross geschriebenes Epitheton klein
  unscharf_akzent     Akzente entfernt (OCR: „Cheiránthus")
  unscharf_rang       Dreifachname ohne Rangwort; der Rang stammt aus der Liste
  unscharf_teilname   nur ein TEIL der Zeichenkette ist ein Name („Nasturtium Cardamine amara"
                      → „Cardamine amara"; „Echeveria perle von nürnberg" → kein Treffer)
  unscharf_endung     nur die ENDUNG weicht ab (letzte drei Zeichen, Abstand 1–2): „Juncus
                      multiflora" ~ „multiflorus". Kandidat in `geprueft_als`
  unscharf_tippfehler EIN Zeichen weicht ab, irgendwo im Epitheton („silvatica" ~ „sylvatica")
                      oder in der Gattung („Pirola" ~ „Pyrola"). Kandidat in `geprueft_als`
  kein                kein Treffer / nicht gesucht
  Ein unscharfer Treffer ist ein HINWEIS, kein Urteil: die Buch-Einlese hat Gattungen mit
  fremden Epitheta gekreuzt, und ein solches Phantom kann zufaellig neben einem echten Namen
  liegen („Matthiola microcarpa" ~ „Matthiola macrocarpa" — das ist ein Roetegewaechs).
  Deshalb stehen unscharfe Treffer in JEDER Tabelle in eigenen Spalten.

NORMALISIERUNG, offen gelegt (Funktion `zerlege`): Unicode NFC · Leerraum · Klammerzusatz weg
· „×"/„x" als eigenes Zeichen weg · Akzente weg (NFD ohne Kombinationszeichen) · „agg.",
„s.l.", „s.str." weg · ein abschliessendes Autorkuerzel weg · „sp."/„spec." → nur Gattung ·
Rangwoerter auf subsp./var./f. · zwei kleine Woerter auch mit Bindestrich („bursa pastoris"
→ „bursa-pastoris") · Vergleich ohne Gross-/Kleinschreibung. Der Abstand ist
Damerau-Levenshtein (ein Tausch = 1). Unscharf gesucht wird erst ab 5 Zeichen; zwei Zeichen
Abstand gelten NUR an der Endung (ab 7 Zeichen) — „pauciflora" ~ „parviflora" ist kein Treffer.

FREIWILLIG: --ncbi VERZEICHNIS (mit `pip install --no-deps --target VERZEICHNIS ncbi-taxon-db
marisa-trie`; NCBI Taxonomy, Stand 2024.9.7, 89 MB). NCBI ist KEINE nomenklatorische Instanz
und der Index kennt keine Synonyme — er aendert deshalb keine Klasse ausser einer: fuehrt NCBI
den GANZEN Namen ausserhalb der Gefaesspflanzen (Pilz, Tier, Alge), dann ist der Eintrag
`nicht_pruefbar` (falsches Reich fuer die Listen) statt `unbekannt`. Nie an der Gattung allein:
„Bartschia" ist bei NCBI eine Tiergattung, gemeint ist die Pflanze Bartsia (gemessen). Fuer
Pilze, Flechten, Moose und Algen steht in `zweite_stimme`, ob NCBI den Namen fuehrt.
"""
import argparse
import collections
import csv
import gzip
import io
import json
import os
import subprocess
import sys
import unicodedata

HIER = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HIER)
sys.path.insert(0, HIER)
sys.dont_write_bytecode = True      # kein scripts/__pycache__ im Repo hinterlassen
import _rdata  # noqa: E402

CSV_PFAD = os.path.join(REPO, 'docs', 'arten-namen-pruefung.csv')
QUELLE_WCVP = 'WCVP v16 (04.06.2026, rWCVPdata 0.8.0)'
QUELLE_LCVP = 'LCVP 3.0.1'
GEFAESS = ('wildpflanze', 'baum', 'kraut', 'hauspflanze', 'gemuese')
OHNE_LISTE = {'pilz': 'Pilze', 'flechte': 'Flechten', 'moos': 'Moose', 'alge': 'Algen'}
SPALTEN = ['id', 'name', 'lat', 'klasse', 'akzeptierter_name', 'quelle', 'treffer_art',
           'cat', 'geprueft_als', 'status_in_quelle', 'zweite_stimme', 'bemerkung']
RANG = {'subsp.': 'subsp.', 'subsp': 'subsp.', 'ssp.': 'subsp.', 'ssp': 'subsp.',
        'var.': 'var.', 'var': 'var.', 'f.': 'f.', 'fo.': 'f.', 'forma': 'f.',
        'subvar.': 'subvar.', 'convar.': 'convar.', 'nothosubsp.': 'subsp.', 'nothovar.': 'var.'}
ZUSATZ = ('agg.', 'agg', 's.l.', 's.str.', 's.lat.', 'coll.')
NUR_GATTUNG = ('sp.', 'sp', 'spec.', 'spec', 'spp.', 'spp')
STUFE = ['exakt', 'normalisiert', 'unscharf_akzent', 'unscharf_rang', 'unscharf_teilname', 'unscharf_endung', 'unscharf_tippfehler']


# ── Artenliste laden (die Datei ist JavaScript, also liest Node sie) ─────────────
def lade_db():
    js = ("const fs=require('fs'),vm=require('vm');const c={window:{}};vm.createContext(c);"
          "vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),c);"
          "process.stdout.write(JSON.stringify(c.window.DB.map(s=>({id:s.id,name:s.name,lat:s.lat,cat:s.cat}))));")
    aus = subprocess.run(['node', '-e', js, os.path.join(REPO, 'data', 'plants.v1.js')],
                         capture_output=True, check=True)
    return json.loads(aus.stdout.decode('utf-8'))


# ── Normalisierung ───────────────────────────────────────────────────────────────
def ohne_akzent(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def zerlege(roh):
    """-> dict(form, gattung, epitheton, rang, infra, schritte[], stufe, rest, alternativen[])
    form: 'binom' | 'infra' | 'gattung' | 'leer'"""
    schritte, stufe = [], 0
    s = ' '.join(unicodedata.normalize('NFC', str(roh or '')).split())
    if '(' in s:
        import re
        neu = ' '.join(re.sub(r'\([^)]*\)', ' ', s).split())
        if neu != s:
            schritte.append('Klammerzusatz entfernt'); stufe = max(stufe, 1); s = neu
    if '×' in s:
        s = ' '.join(s.replace('×', ' × ').split())
    glatt = ohne_akzent(s)
    if glatt != s:
        schritte.append('Akzent entfernt'); stufe = max(stufe, 2); s = glatt
    w = s.split()
    if any(t in ('×', 'x', 'X') for t in w[1:]) or (w and w[0] in ('×', 'x', 'X')):
        w = [t for i, t in enumerate(w) if not (t in ('×', 'x', 'X'))]
        schritte.append('Hybridzeichen entfernt'); stufe = max(stufe, 1)
    if any(t.lower() in ZUSATZ for t in w[1:]):
        w = [w[0]] + [t for t in w[1:] if t.lower() not in ZUSATZ]
        schritte.append('Zusatz agg./s.l. entfernt'); stufe = max(stufe, 1)
    if len(w) >= 3 and (w[-1] == 'L.' or (w[-1][:1].isupper() and w[-1].endswith('.') and w[-1].lower() not in RANG)):
        schritte.append('Autor „%s" entfernt' % w[-1]); stufe = max(stufe, 1); w = w[:-1]
    z = dict(form='leer', gattung='', epitheton='', rang='', infra='', schritte=schritte, stufe=stufe,
             rest='', alternativen=[])
    if not w:
        return z
    z['gattung'] = w[0].lower()
    if len(w) == 1 or w[1].lower() in NUR_GATTUNG:
        z['form'] = 'gattung'
        return z
    if len(w) == 2:
        if w[1][:1].isupper():
            schritte.append('Epitheton klein geschrieben'); z['stufe'] = max(z['stufe'], 1)
        z['form'], z['epitheton'] = 'binom', w[1].lower()
        return z
    if w[2].lower() in RANG and len(w) >= 4:
        if w[2] != RANG[w[2].lower()]:
            schritte.append('Rangwort „%s" → „%s"' % (w[2], RANG[w[2].lower()])); z['stufe'] = max(z['stufe'], 1)
        z['form'], z['epitheton'], z['rang'], z['infra'] = 'infra', w[1].lower(), RANG[w[2].lower()], w[3].lower()
        z['rest'] = ' '.join(w[4:])
        return z
    # drei und mehr Woerter ohne Rangwort: die Zeichenkette ist kein Name in Normalform.
    # Kandidaten in fester Reihenfolge; jeder Treffer ist „unscharf".
    if w[1][:1].isupper():
        z['alternativen'].append(('teilname', w[1].lower(), w[2].lower(), 'hinterer Teil „%s %s"' % (w[1], w[2])))
        z['alternativen'].append(('teilname', w[0].lower(), w[2].lower(), 'Gattung + letztes Wort „%s %s"' % (w[0], w[2])))
    else:
        if len(w) == 3:
            z['alternativen'].append(('bindestrich', w[0].lower(), (w[1] + '-' + w[2]).lower(), 'Epitheton mit Bindestrich geschrieben'))
        z['alternativen'].append(('rang', w[0].lower(), w[1].lower(), w[2].lower()))
        z['alternativen'].append(('teilname', w[0].lower(), w[1].lower(), 'vorderer Teil „%s %s", Rest „%s" ignoriert' % (w[0], w[1], ' '.join(w[2:]))))
    z['form'] = 'binom'
    z['epitheton'] = ''
    return z


def abstand(a, b, grenze):
    """Damerau-Levenshtein (optimal string alignment); gibt grenze+1 zurueck, sobald es mehr ist."""
    la, lb = len(a), len(b)
    if abs(la - lb) > grenze:
        return grenze + 1
    vor2, vor = None, list(range(lb + 1))
    for i in range(1, la + 1):
        akt = [i] + [0] * lb
        klein = akt[0]
        for j in range(1, lb + 1):
            k = 0 if a[i - 1] == b[j - 1] else 1
            v = min(vor[j] + 1, akt[j - 1] + 1, vor[j - 1] + k)
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                v = min(v, vor2[j - 2] + 1)
            akt[j] = v
            if v < klein:
                klein = v
        if klein > grenze:
            return grenze + 1
        vor2, vor = vor, akt
    return vor[lb]


def erlaubt(wort):
    return 0 if len(wort) < 5 else (1 if len(wort) < 9 else 2)


# ── Die Listen ───────────────────────────────────────────────────────────────────
def _auszug(pfad, objekt, spalten):
    """Liest die .rda einmal und legt daneben (NICHT im Repo) einen Auszug ab."""
    ablage = pfad + '.auszug.tsv.gz'
    if os.path.exists(ablage) and os.path.getmtime(ablage) >= os.path.getmtime(pfad):
        with gzip.open(ablage, 'rt', encoding='utf-8', newline='') as f:
            kopf = f.readline().rstrip('\n').split('\t')
            if kopf == spalten:
                return [z.rstrip('\n').split('\t') for z in f]
    tab, n = _rdata.tabelle(pfad, objekt, spalten)
    zeilen = []
    for i in range(n):
        z = []
        for s in spalten:
            v = tab[s][i]
            if v is None or v != v:
                v = ''
            elif isinstance(v, float):
                v = str(int(v))
            z.append(str(v).replace('\t', ' ').replace('\n', ' ').strip())
        zeilen.append(z)
    try:
        with gzip.open(ablage, 'wt', encoding='utf-8', newline='') as f:
            f.write('\t'.join(spalten) + '\n')
            for z in zeilen:
                f.write('\t'.join(z) + '\n')
    except OSError:
        pass
    return zeilen


class Wcvp:
    SP = ['plant_name_id', 'taxon_rank', 'taxon_status', 'family', 'genus', 'species',
          'infraspecific_rank', 'infraspecies', 'taxon_name', 'taxon_authors', 'accepted_plant_name_id']

    def __init__(self, pfad, zeilen=None):
        self.z = zeilen if zeilen is not None else _auszug(pfad, 'wcvp_names', self.SP)
        self.nach_id = {}
        self.binom = collections.defaultdict(list)
        self.infra = collections.defaultdict(list)
        self.infra_ohne_rang = collections.defaultdict(list)
        self.epitheta = collections.defaultdict(set)
        self.gattungen = collections.defaultdict(list)
        for i, r in enumerate(self.z):
            self.nach_id[r[0]] = i
            g, e, rang, inf = r[4].lower(), r[5].lower(), r[6], r[7].lower()
            if not g:
                continue
            if not e:
                self.gattungen[g].append(i)
            elif not inf:
                self.binom[(g, e)].append(i)
                self.epitheta[g].add(e)
            else:
                self.infra[(g, e, RANG.get(rang, rang), inf)].append(i)
                self.infra_ohne_rang[(g, e, inf)].append(i)
        self.gattungsnamen = set(self.gattungen) | set(self.epitheta)

    def name(self, i):
        r = self.z[i]
        return (r[8] + ' ' + r[9]).strip()

    def urteil(self, zeilen):
        """Mehrere Zeilen desselben Namens (Homonyme) -> (klasse, akzeptierter_name, status, bemerkung)"""
        akz, syn, rest = [], [], []
        for i in zeilen:
            r = self.z[i]
            ziel = self.nach_id.get(r[10]) if r[10] else None
            if r[2] in ('Accepted', 'Artificial Hybrid') or (ziel == i and r[2] != 'Unplaced'):
                akz.append(i)
            elif ziel is not None and ziel != i:
                syn.append((i, ziel))
            else:
                rest.append(i)
        status = ' / '.join(sorted(set(self.z[i][2] for i in zeilen)))
        if akz:
            bem = '' if len(zeilen) == 1 else '%d gleichlautende Namen in der Liste, einer davon akzeptiert' % len(zeilen)
            return 'akzeptiert', self.name(akz[0]), status, bem
        if syn:
            # Gleichlautende Namen verschiedener Autoren: ein spaeteres Homonym ist illegitim (ICN Art. 53),
            # der Name OHNE Autor meint im Zweifel das legitime. Erst wenn es keines gibt, zaehlen alle.
            legitim = [(i, z) for i, z in syn if self.z[i][2] == 'Synonym']
            ziele = []
            for _, z in (legitim or syn):
                if self.name(z) not in ziele:
                    ziele.append(self.name(z))
            bem = []
            if legitim and len(legitim) < len(syn):
                bem.append('%d weitere gleichlautende Namen (illegitim/ungueltig/falsch angewandt) nicht gewertet' % (len(syn) - len(legitim)))
            if len(ziele) > 1:
                bem.append('gleichlautende Namen verschiedener Autoren zeigen auf %d akzeptierte Namen' % len(ziele))
            return 'synonym', ' | '.join(ziele), status, '; '.join(bem)
        return 'nicht_pruefbar', '', status, 'in der Liste bekannt, aber nicht eingeordnet (%s)' % status

    def suche(self, z):
        """-> (zeilen, stufe, geprueft_als, bemerkung) oder None"""
        g, e = z['gattung'], z['epitheton']
        if z['form'] == 'infra':
            t = self.infra.get((g, e, z['rang'], z['infra']))
            if t:
                return t, z['stufe'], None, ''
            t = self.infra_ohne_rang.get((g, e, z['infra']))
            if t:
                return t, 3, None, 'Rang in der Liste anders als angegeben'
            return None
        if e:
            t = self.binom.get((g, e))
            return (t, z['stufe'], None, '') if t else None
        for alt in z['alternativen']:
            if alt[0] == 'rang':
                t = self.infra_ohne_rang.get((alt[1], alt[2], alt[3]))
                if t:
                    return t, 3, None, 'Dreifachname ohne Rangwort'
            else:
                t = self.binom.get((alt[1], alt[2]))
                if t:
                    return t, (max(z['stufe'], 1) if alt[0] == 'bindestrich' else 4), None, alt[3]
        return None

    def unscharf(self, z):
        """Unscharfe Suche. -> (kandidaten[(zeilen, (gattung, epitheton))], abstand, art, naechster) oder None.
        art: 'endung' | 'tippfehler'. naechster: ein Name im Abstand 2 mitten im Wort — KEIN Treffer, nur Hinweis."""
        if z['form'] == 'infra' or z['epitheton']:
            g, e = z['gattung'], z['epitheton']
        elif z['alternativen']:
            a = z['alternativen'][-1]
            g, e = a[1], a[2]
        else:
            return None
        if g in self.epitheta:
            gatt = [(g, 0)]
        elif len(g) >= 5:
            gatt = [(g2, 1) for g2 in self.epitheta if abs(len(g2) - len(g)) <= 1 and abstand(g, g2, 1) == 1]
        else:
            gatt = []
        funde, naechster = [], ''
        for g2, dg in gatt:
            if dg:
                if e in self.epitheta[g2]:
                    funde.append((1, 'tippfehler', (g2, e)))
                continue
            if len(e) < 5:
                continue
            for e2 in sorted(self.epitheta[g2]):      # sortiert: eine Menge hat je Lauf eine andere Reihenfolge
                if abs(len(e2) - len(e)) > 2:
                    continue
                d = abstand(e, e2, 2)
                if d > 2 or d == 0:
                    continue
                gleich = 0
                while gleich < min(len(e), len(e2)) and e[gleich] == e2[gleich]:
                    gleich += 1
                endung = gleich >= max(len(e), len(e2)) - 3
                if d == 1:
                    funde.append((1, 'endung' if endung else 'tippfehler', (g2, e2)))
                elif endung and len(e) >= 7:
                    funde.append((2, 'endung', (g2, e2)))
                elif not naechster:
                    naechster = '%s %s' % (g2.capitalize(), e2)
        if not funde:
            return ([], 0, '', naechster) if naechster else None
        d = min(f[0] for f in funde)
        beste = sorted(set(f for f in funde if f[0] == d), key=lambda f: f[2])
        art = 'tippfehler' if any(f[1] == 'tippfehler' for f in beste) else 'endung'
        return [(self.binom[f[2]], f[2]) for f in beste], d, art, naechster


class Lcvp:
    SP = ['Input.Genus', 'Input.Epitheton', 'Rank', 'Input.Subspecies.Epitheton', 'Input.Authors',
          'Status', 'Output.Taxon']

    def __init__(self, pfad):
        self.binom = collections.defaultdict(list)
        self.infra = collections.defaultdict(list)
        for r in _auszug(pfad, 'tab_lcvp', self.SP):
            g, e = r[0].lower().replace('_x', ''), r[1].lower().replace('_x', '')
            if not g or not e:
                continue
            ziel = ' '.join(r[6].replace('_x ', ' ').split())
            if r[2] == 'species' or r[3] in ('', 'nil'):
                self.binom[(g, e)].append((r[5], ziel))
            else:
                self.infra[(g, e, r[3].lower())].append((r[5], ziel))

    def stimme(self, z):
        """-> (klasse, akzeptierter_name, text) oder None"""
        g, e = z['gattung'], z['epitheton']
        if z['form'] == 'infra':
            t = self.infra.get((g, e, z['infra']))
        elif e:
            t = self.binom.get((g, e))
        else:
            t = None
        if not t:
            return None
        st = set(s for s, _ in t)
        if 'accepted' in st:
            ziel = [n for s, n in t if s == 'accepted'][0]
            return 'akzeptiert', ziel, 'LCVP: akzeptiert'
        if 'synonym' in st:
            ziele = []
            for s, n in t:
                if s == 'synonym' and n not in ziele:
                    ziele.append(n)
            return 'synonym', ' | '.join(ziele), 'LCVP: Synonym von ' + ' | '.join(ziele)
        return 'nicht_pruefbar', '', 'LCVP: ' + '/'.join(sorted(st))


class Ncbi:
    """NCBI Taxonomy aus dem PyPI-Paket ncbi-taxon-db (Index der GUELTIGEN Namen, ohne Synonyme)."""
    GRUPPEN = ['Tracheophyta', 'Fungi', 'Metazoa', 'Bryophyta', 'Marchantiophyta', 'Anthocerotophyta',
               'Chlorophyta', 'Streptophyta', 'Rhodophyta', 'Phaeophyceae', 'Bacillariophyta',
               'Cyanobacteriota', 'Bacteria', 'Eukaryota']
    DEUTSCH = {'Tracheophyta': 'Gefaesspflanzen', 'Fungi': 'Pilze', 'Metazoa': 'Tiere', 'Bryophyta': 'Laubmoose',
               'Marchantiophyta': 'Lebermoose', 'Anthocerotophyta': 'Hornmoose', 'Chlorophyta': 'Gruenalgen',
               'Streptophyta': 'Streptophyta ohne Gefaesspflanzen', 'Rhodophyta': 'Rotalgen', 'Phaeophyceae': 'Braunalgen',
               'Bacillariophyta': 'Kieselalgen', 'Cyanobacteriota': 'Cyanobakterien', 'Bacteria': 'Bakterien',
               'Eukaryota': 'andere Eukaryoten'}

    def __init__(self, verzeichnis):
        sys.path.insert(0, verzeichnis)
        from marisa_trie import RecordTrie
        d = os.path.join(verzeichnis, 'ncbi_taxon_db')
        self.sn = RecordTrie('I').mmap(os.path.join(d, 'sn2taxid.marisa'))
        self.taxa = RecordTrie('IBBB').mmap(os.path.join(d, 'taxa.marisa'))
        self.gruppe = {}
        for name in self.GRUPPEN:
            t = self.sn.get(name)
            if t:
                self.gruppe[t[0][0]] = name

    def _reich(self, taxid):
        for _ in range(60):
            if taxid in self.gruppe:
                return self.DEUTSCH[self.gruppe[taxid]]
            t = self.taxa.get(str(taxid))
            if not t or t[0][0] == taxid or t[0][0] == 0:
                return ''
            taxid = t[0][0]
        return ''

    def reich_des_namens(self, gattung, epitheton):
        t = self.sn.get('%s %s' % (gattung.capitalize(), epitheton)) if epitheton else None
        return self._reich(t[0][0]) if t else ''

    def stimme(self, lat):
        n = zerlege(lat)
        if n['form'] == 'gattung':
            t = self.sn.get(n['gattung'].capitalize())
            return 'NCBI: nur Gattung, %s' % (('gefuehrt (%s)' % self._reich(t[0][0])) if t else 'nicht gefuehrt')
        name = ' '.join(unicodedata.normalize('NFC', str(lat or '')).split())
        t = self.sn.get(name)
        if not t and n['form'] == 'binom' and n['epitheton']:
            t = self.sn.get('%s %s' % (n['gattung'].capitalize(), n['epitheton']))
        if t:
            return 'NCBI: als gueltiger Name gefuehrt (%s)' % (self._reich(t[0][0]) or 'Gruppe unbekannt')
        g = self.sn.get(n['gattung'].capitalize()) if n['gattung'] else None
        return 'NCBI: Name nicht gefuehrt, Gattung %s' % (('gefuehrt (%s)' % self._reich(g[0][0])) if g else 'auch nicht')


# ── Ein Eintrag ──────────────────────────────────────────────────────────────────
def pruefe(sp, wcvp, lcvp, ncbi=None):
    z = dict(id=sp['id'], name=sp['name'], lat=sp['lat'], klasse='', akzeptierter_name='', quelle='',
             treffer_art='kein', cat=sp['cat'], geprueft_als='', status_in_quelle='', zweite_stimme='', bemerkung='')
    if sp['cat'] in OHNE_LISTE:
        z['klasse'] = 'nicht_pruefbar'
        z['bemerkung'] = 'keine Offline-Liste fuer %s (WCVP und LCVP fuehren nur Gefaesspflanzen)' % OHNE_LISTE[sp['cat']]
        if ncbi:
            z['zweite_stimme'] = ncbi.stimme(sp['lat'])
        return z
    n = zerlege(sp['lat'])
    schritte = '; '.join(n['schritte'])
    if n['form'] == 'leer':
        z['klasse'], z['bemerkung'] = 'nicht_pruefbar', 'kein lateinischer Name'
        return z
    if n['form'] == 'gattung':
        bekannt = n['gattung'] in wcvp.gattungsnamen
        z['klasse'], z['quelle'] = 'nicht_pruefbar', QUELLE_WCVP
        z['bemerkung'] = 'nur eine Gattung, kein Artname — die Gattung ist in WCVP %s' % ('bekannt' if bekannt else 'NICHT bekannt')
        return z
    stimme = lcvp.stimme(n) if lcvp else None
    if lcvp:
        z['zweite_stimme'] = stimme[2] if stimme else 'LCVP: kein Treffer'
    t = wcvp.suche(n)
    if t:
        zeilen, stufe, _, bem = t
        k, akz, status, bem2 = wcvp.urteil(zeilen)
        z.update(klasse=k, akzeptierter_name=akz, quelle=QUELLE_WCVP, treffer_art=STUFE[stufe],
                 geprueft_als=wcvp.name(zeilen[0]), status_in_quelle=status,
                 bemerkung='; '.join(x for x in (schritte, bem, bem2) if x))
        if k == 'nicht_pruefbar' and stimme and stimme[0] in ('akzeptiert', 'synonym'):
            z['bemerkung'] += ' — LCVP ordnet den Namen ein, WCVP nicht; es bleibt „nicht pruefbar"'
        return z
    if stimme and stimme[0] in ('akzeptiert', 'synonym'):
        z.update(klasse=stimme[0], akzeptierter_name=stimme[1], quelle=QUELLE_LCVP,
                 treffer_art=STUFE[n['stufe']], geprueft_als=sp['lat'], status_in_quelle=stimme[2],
                 bemerkung='; '.join(x for x in (schritte, 'in WCVP kein Treffer, nur in LCVP') if x))
        return z
    u = wcvp.unscharf(n)
    naechster = u[3] if u else ''
    if u and u[0]:
        kand, d, art = u[0], u[1], u[2]
        urteile = [wcvp.urteil(zl) for zl, _ in kand]
        namen = ['%s %s' % (g.capitalize(), e) for _, (g, e) in kand]
        ziele = sorted(set((k, a) for k, a, _, _ in urteile))
        if len(ziele) == 1 and ziele[0][0] != 'nicht_pruefbar':
            z.update(klasse=ziele[0][0], akzeptierter_name=ziele[0][1], quelle=QUELLE_WCVP,
                     treffer_art='unscharf_' + art, geprueft_als=' | '.join(namen),
                     status_in_quelle=urteile[0][2],
                     bemerkung='; '.join(x for x in (schritte, 'Abstand %d zum Namen in der Liste' % d) if x))
        else:
            z.update(klasse='nicht_pruefbar', quelle=QUELLE_WCVP, treffer_art='unscharf_' + art,
                     geprueft_als=' | '.join(namen[:6]) + (' (+%d weitere)' % (len(namen) - 6) if len(namen) > 6 else ''),
                     bemerkung='; '.join(x for x in (schritte, (
                         '%d Kandidaten im Abstand %d, nicht eindeutig' % (len(namen), d) if len(namen) > 1
                         else 'der eine Kandidat ist in der Liste nicht eingeordnet')) if x))
        return z
    g = n['gattung'] if n['epitheton'] or not n['alternativen'] else n['alternativen'][-1][1]
    bekannt = g in wcvp.gattungsnamen
    reich = ncbi.reich_des_namens(g, n['epitheton']) if (ncbi and not bekannt) else ''
    if reich and reich != 'Gefaesspflanzen':
        z['klasse'] = 'nicht_pruefbar'
        z['zweite_stimme'] = 'NCBI: als gueltiger Name gefuehrt (%s)' % reich
        z['bemerkung'] = '; '.join(x for x in (schritte, 'laut NCBI Taxonomy keine Gefaesspflanze (%s) — falsches Reich fuer WCVP/LCVP, obwohl die Kategorie „%s" heisst' % (reich, sp['cat'])) if x)
        return z
    z['klasse'] = 'unbekannt'
    z['quelle'] = QUELLE_WCVP + (' + ' + QUELLE_LCVP if lcvp else '')
    z['bemerkung'] = '; '.join(x for x in (schritte, 'Gattung %s in WCVP %s' % (
        g.capitalize(), 'bekannt, diese Verbindung nicht' if bekannt else 'NICHT bekannt'),
        ('naechster Name im Abstand 2 (kein Treffer): ' + naechster) if naechster else '') if x)
    return z


# ── Bericht ──────────────────────────────────────────────────────────────────────
def tausender(n):
    return format(n, ',').replace(',', "'")


def spalte(z):
    """Die sechs Spalten jeder Tabelle: ein unscharfer Treffer zaehlt nie unter akzeptiert/synonym."""
    if z['klasse'] in ('akzeptiert', 'synonym') and z['treffer_art'].startswith('unscharf'):
        return 'unscharf→' + z['klasse']
    return z['klasse']


SP6 = ['akzeptiert', 'synonym', 'unscharf→akzeptiert', 'unscharf→synonym', 'unbekannt', 'nicht_pruefbar']


def bericht(zeilen, db):
    aus = []
    klassen = ['akzeptiert', 'synonym', 'unbekannt', 'nicht_pruefbar']
    arten = STUFE + ['kein']
    kt = collections.Counter((z['klasse'], z['treffer_art']) for z in zeilen)
    aus.append('Klasse × Treffer-Art (%s Eintraege)' % tausender(len(zeilen)))
    aus.append('  %-15s %s  %6s' % ('', ' '.join('%13s' % a.replace('unscharf_', '~') for a in arten), 'Summe'))
    for k in klassen:
        aus.append('  %-15s %s  %6d' % (k, ' '.join('%13d' % kt[(k, a)] for a in arten), sum(kt[(k, a)] for a in arten)))
    aus.append('  (~ = unscharf. „exakt" + „normalisiert" sind die sicheren Treffer.)')
    kc = collections.Counter((z['cat'], spalte(z)) for z in zeilen)
    cats = sorted(set(z['cat'] for z in zeilen), key=lambda c: -sum(kc[(c, k)] for k in SP6))
    aus.append('')
    aus.append('Kategorie × Klasse — unscharfe Treffer in eigenen Spalten')
    aus.append('  %-12s %s  %6s' % ('', ' '.join('%20s' % k for k in SP6), 'Summe'))
    for c in cats + ['ALLE']:
        f = (lambda k: sum(kc[(x, k)] for x in cats)) if c == 'ALLE' else (lambda k, c=c: kc[(c, k)])
        aus.append('  %-12s %s  %6d' % (c, ' '.join('%20d' % f(k) for k in SP6), sum(f(k) for k in SP6)))
    # die Buch-Einlese: Trivialnamen mit mehr als zwei Binomen (ARTEN-LUECKEN §2)
    binome = collections.defaultdict(set)
    for s in db:
        binome[s['name']].add(str(s['lat']).strip())
    gross = set(n for n, b in binome.items() if len(b) > 2)
    teil = [z for z in zeilen if z['name'] in gross]
    kg = collections.Counter(spalte(z) for z in teil)
    aus.append('')
    aus.append('Die Buch-Einlese (ARTEN-LUECKEN §2): %d Trivialnamen mit mehr als zwei Binomen, %s Eintraege'
               % (len(gross), tausender(len(teil))))
    aus.append('  ' + ' · '.join('%s %d' % (k, kg[k]) for k in SP6))
    aus.append('')
    aus.append('  %-28s %4s %4s %4s %4s %4s %4s %4s  %s' % ('Trivialname', 'n', 'akz', 'syn', '~akz', '~syn', 'unb', 'n.p.', 'akzeptierte Namen, auf die die sicheren Treffer zeigen'))
    je = collections.defaultdict(list)
    for z in teil:
        je[z['name']].append(z)
    for name, zl in sorted(je.items(), key=lambda kv: (-len(kv[1]), kv[0]))[:15]:
        c = collections.Counter(spalte(z) for z in zl)
        ziele = set(z['akzeptierter_name'] for z in zl if spalte(z) in ('akzeptiert', 'synonym'))
        aus.append('  %-28s %4d %s  %d' % (name[:28], len(zl), ' '.join('%4d' % c[k] for k in SP6), len(ziele)))
    fd = [z for z in zeilen if z['id'].startswith('FD')]
    kf = collections.Counter(spalte(z) for z in fd)
    aus.append('')
    aus.append('Alle Eintraege der Buch-Einlese (Kennung FD…, %s): ' % tausender(len(fd)) + ' · '.join('%s %d' % (k, kf[k]) for k in SP6))
    unb = [z for z in zeilen if z['klasse'] == 'unbekannt']
    aus.append('Unbekannt gesamt %d — davon Kennung FD %d · Gattung in WCVP bekannt, nur die Verbindung nicht: %d · Gattung nicht bekannt: %d'
               % (len(unb), sum(1 for z in unb if z['id'].startswith('FD')),
                  sum(1 for z in unb if 'bekannt, diese Verbindung nicht' in z['bemerkung']),
                  sum(1 for z in unb if 'NICHT bekannt' in z['bemerkung'])))
    nv = [z for z in zeilen if z['cat'] in OHNE_LISTE and z['zweite_stimme'].startswith('NCBI')]
    if nv:
        aus.append('')
        aus.append('Pilze, Flechten, Moose, Algen — NUR als Hinweis (NCBI ist keine nomenklatorische Instanz, der Index hat keine Synonyme):')
        for c in OHNE_LISTE:
            t = [z for z in nv if z['cat'] == c]
            ja = sum(1 for z in t if 'als gueltiger Name gefuehrt' in z['zweite_stimme'])
            gat = sum(1 for z in t if z['zweite_stimme'].startswith('NCBI: nur Gattung'))
            aus.append('  %-8s %4d Eintraege · bei NCBI als gueltiger Name gefuehrt %4d · nicht gefuehrt %4d · nur Gattung %d'
                       % (c, len(t), ja, len(t) - ja - gat, gat))
    return '\n'.join(aus)


# ── Selbsttest: die Regeln gegen eine winzige, erfundene Liste — beide Richtungen ──
def selbsttest():
    def zl(i, status, g, e, rang, inf, autor, ziel):
        name = ' '.join(x for x in (g, e, rang, inf) if x)
        return [str(i), 'Species' if e else 'Genus', status, 'Testaceae', g, e, rang, inf, name, autor, str(ziel) if ziel else '']
    w = Wcvp(None, [
        zl(1, 'Accepted', 'Fagus', 'sylvatica', '', '', 'L.', 1),
        zl(2, 'Accepted', 'Matthiola', 'incana', '', '', '(L.) W.T.Aiton', 2),
        zl(3, 'Synonym', 'Matthiola', 'annua', '', '', '(L.) Sweet', 2),
        zl(4, 'Accepted', 'Matthiola', 'parviflora', '', '', 'X.', 4),
        zl(5, 'Unplaced', 'Rumex', 'persicaria', '', '', 'Clem.', 0),
        zl(6, 'Accepted', 'Juncus', 'multiflorus', '', '', 'Y.', 6),
        zl(7, 'Accepted', 'Capsella', 'bursa-pastoris', '', '', '(L.) Medik.', 7),
        zl(8, 'Accepted', 'Mentha', 'piperita', '', '', 'L.', 8),
        zl(9, 'Accepted', 'Cardamine', 'amara', '', '', 'L.', 9),
        zl(10, 'Accepted', 'Daucus', 'carota', 'subsp.', 'sativus', 'Z.', 10),
        zl(11, 'Accepted', 'Daucus', 'carota', '', '', 'L.', 11),
        zl(12, 'Synonym', 'Orchis', 'globosa', '', '', 'L.', 13),
        zl(13, 'Accepted', 'Traunsteinera', 'globosa', '', '', '(L.) Rchb.', 13),
        zl(14, 'Illegitimate', 'Orchis', 'globosa', '', '', 'Brot.', 2),
        zl(15, 'Accepted', 'Pyrus', 'nigra', '', '', 'A.', 15),
        zl(16, 'Accepted', 'Pinus', 'nigra', '', '', 'B.', 16),
        zl(17, 'Accepted', 'Nasturtium', '', '', '', 'W.T.Aiton', 17),
        zl(18, 'Accepted', 'Urtica', 'dioica', '', '', 'L.', 18),
    ])
    faelle = [   # (lat, kategorie, klasse, treffer_art, akzeptierter Name beginnt mit)
        ('Fagus sylvatica', 'baum', 'akzeptiert', 'exakt', 'Fagus sylvatica'),
        ('Fagus silvatica', 'baum', 'akzeptiert', 'unscharf_tippfehler', 'Fagus sylvatica'),     # ein Zeichen mitten im Wort
        ('Matthiola annua', 'wildpflanze', 'synonym', 'exakt', 'Matthiola incana'),
        ('Matthiola pauciflora', 'wildpflanze', 'unbekannt', 'kein', ''),                          # 2 Zeichen mitten im Wort: KEIN Treffer
        ('Matthiola odoratum', 'wildpflanze', 'unbekannt', 'kein', ''),                            # Phantom: Gattung bekannt, Verbindung nicht
        ('Rumex persicaria', 'wildpflanze', 'nicht_pruefbar', 'exakt', ''),                        # bekannt, aber Unplaced
        ('Juncus multiflora', 'wildpflanze', 'akzeptiert', 'unscharf_endung', 'Juncus multiflorus'),
        ('Capsella bursa pastoris', 'wildpflanze', 'akzeptiert', 'normalisiert', 'Capsella bursa-pastoris'),
        ('Mentha x piperita', 'kraut', 'akzeptiert', 'normalisiert', 'Mentha piperita'),
        ('Mentha × piperita', 'kraut', 'akzeptiert', 'normalisiert', 'Mentha piperita'),
        ('Méntha piperita', 'kraut', 'akzeptiert', 'unscharf_akzent', 'Mentha piperita'),          # OCR-Akzent ist nie „exakt"
        ('Fagus sylvatica L.', 'baum', 'akzeptiert', 'normalisiert', 'Fagus sylvatica'),
        ('Nasturtium Cardamine amara', 'wildpflanze', 'akzeptiert', 'unscharf_teilname', 'Cardamine amara'),
        ('Daucus carota ssp. sativus', 'gemuese', 'akzeptiert', 'normalisiert', 'Daucus carota subsp. sativus'),
        ('Daucus carota var. sativus', 'gemuese', 'akzeptiert', 'unscharf_rang', 'Daucus carota subsp. sativus'),
        ('Daucus carota sativus', 'gemuese', 'akzeptiert', 'unscharf_rang', 'Daucus carota subsp. sativus'),
        ('Daucus carota Sorte Nantes', 'gemuese', 'akzeptiert', 'unscharf_teilname', 'Daucus carota'),
        ('Orchis globosa', 'wildpflanze', 'synonym', 'exakt', 'Traunsteinera globosa'),            # das legitime Homonym gewinnt
        ('Pirus nigra', 'wildpflanze', 'nicht_pruefbar', 'unscharf_tippfehler', ''),               # zwei Gattungen gleich nah
        ('Nasturtium sp.', 'wildpflanze', 'nicht_pruefbar', 'kein', ''),                           # nur eine Gattung
        ('Urtica officinalis', 'wildpflanze', 'unbekannt', 'kein', ''),
        ('Vestiti conspicuus', 'wildpflanze', 'unbekannt', 'kein', ''),                            # Gattung unbekannt
        ('Amanita muscaria', 'pilz', 'nicht_pruefbar', 'kein', ''),                                # falsches Reich fuer die Liste
    ]
    rot = 0
    for lat, cat, klasse, art, ziel in faelle:
        z = pruefe(dict(id='T', name='Test', lat=lat, cat=cat), w, None)
        ok = (z['klasse'] == klasse and z['treffer_art'] == art and z['akzeptierter_name'].startswith(ziel)
              and bool(ziel) == bool(z['akzeptierter_name']) and ' | ' not in z['akzeptierter_name'])
        if not ok:
            rot += 1
            print('  ROT  %-30s erwartet %s/%s/%s — ist %s/%s/%s' % (lat, klasse, art, ziel or '—', z['klasse'], z['treffer_art'], z['akzeptierter_name'] or '—'))
    for a, b, gr, soll in (('silvatica', 'sylvatica', 2, 1), ('pauciflora', 'parviflora', 2, 2), ('abc', 'acb', 2, 1),
                           ('multiflora', 'multiflorus', 2, 2), ('kurz', 'ganzanders', 2, 3)):
        if abstand(a, b, gr) != soll:
            rot += 1
            print('  ROT  abstand(%s, %s) = %d, erwartet %d' % (a, b, abstand(a, b, gr), soll))
    print('Selbsttest: %d Faelle, %d rot' % (len(faelle) + 5, rot))
    return 1 if rot else 0


def schreibe_csv(zeilen):
    puffer = io.StringIO()
    w = csv.DictWriter(puffer, fieldnames=SPALTEN, lineterminator='\n', quoting=csv.QUOTE_MINIMAL)
    w.writeheader()
    for z in zeilen:
        w.writerow(z)
    return puffer.getvalue()


def main():
    ap = argparse.ArgumentParser(description='Prueft die lateinischen Namen der Artenliste gegen WCVP (und LCVP).')
    ap.add_argument('--wcvp', help='Pfad zu wcvp_names.rda (rWCVPdata)')
    ap.add_argument('--lcvp', help='Pfad zu tab_lcvp.rda (LCVP) — zweite Stimme, freiwillig')
    ap.add_argument('--ncbi', help='Verzeichnis mit ncbi_taxon_db und marisa_trie (PyPI) — freiwillig, nur Hinweise')
    ap.add_argument('--schreiben', action='store_true', help='docs/arten-namen-pruefung.csv neu schreiben')
    ap.add_argument('--selbsttest', action='store_true', help='die Regeln gegen eine erfundene Mini-Liste fahren (ohne Listen, ohne Netz)')
    a = ap.parse_args()
    if a.selbsttest:
        return selbsttest()
    if not a.wcvp or not os.path.exists(a.wcvp):
        print('NICHT PRUEFBAR: die WCVP-Liste fehlt (--wcvp PFAD). Abrufweg im Kopf dieses Skripts.')
        return 2
    if a.lcvp and not os.path.exists(a.lcvp):
        print('NICHT PRUEFBAR: --lcvp zeigt auf keine Datei: ' + a.lcvp)
        return 2
    db = lade_db()
    wcvp = Wcvp(a.wcvp)
    lcvp = Lcvp(a.lcvp) if a.lcvp else None
    ncbi = None
    if a.ncbi:
        try:
            ncbi = Ncbi(a.ncbi)
        except Exception as e:                                     # fehlt das Paket, ist das kein gruener Lauf
            print('NICHT PRUEFBAR: --ncbi %s laesst sich nicht laden (%s: %s)' % (a.ncbi, type(e).__name__, e))
            return 2
    zeilen = [pruefe(sp, wcvp, lcvp, ncbi) for sp in db]
    text = schreibe_csv(zeilen)
    print('Artenliste: %s Eintraege · WCVP: %s Namen%s' % (
        tausender(len(db)), tausender(len(wcvp.z)), (' · LCVP als zweite Stimme' if lcvp else ' · OHNE zweite Stimme')
        + (' · NCBI als Hinweis' if ncbi else ' · ohne NCBI')))
    print()
    print(bericht(zeilen, db))
    if lcvp:
        beide = [z for z in zeilen if z['quelle'] == QUELLE_WCVP and z['klasse'] in ('akzeptiert', 'synonym')
                 and not z['treffer_art'].startswith('unscharf')]
        einig = sum(1 for z in beide if z['zweite_stimme'].startswith('LCVP: akzeptiert') == (z['klasse'] == 'akzeptiert')
                    and z['zweite_stimme'] != 'LCVP: kein Treffer')
        ohne = sum(1 for z in beide if z['zweite_stimme'] == 'LCVP: kein Treffer' or z['zweite_stimme'].startswith('LCVP: un')
                   or z['zweite_stimme'].startswith('LCVP: ex'))
        print()
        print('Zweite Stimme: von %s exakt/normalisiert in WCVP eingeordneten Namen sieht LCVP %s gleich '
              '(akzeptiert bzw. Synonym), %s anders, %s kennt es nicht oder ordnet sie nicht ein.'
              % (tausender(len(beide)), tausender(einig), tausender(len(beide) - einig - ohne), tausender(ohne)))
    print()
    if a.schreiben:
        with open(CSV_PFAD, 'w', encoding='utf-8', newline='') as f:
            f.write(text)
        print('geschrieben: docs/arten-namen-pruefung.csv (%s Zeilen)' % tausender(len(zeilen)))
        return 0
    if not os.path.exists(CSV_PFAD):
        print('ROT: docs/arten-namen-pruefung.csv fehlt — mit --schreiben anlegen.')
        return 1
    with open(CSV_PFAD, encoding='utf-8', newline='') as f:
        alt = f.read()
    if alt == text:
        print('GRUEN: docs/arten-namen-pruefung.csv stimmt mit diesem Lauf ueberein.')
        return 0
    alt_z, neu_z = alt.split('\n'), text.split('\n')
    anders = sum(1 for x, y in zip(alt_z, neu_z) if x != y) + abs(len(alt_z) - len(neu_z))
    print('ROT: docs/arten-namen-pruefung.csv weicht in %d Zeilen von diesem Lauf ab '
          '(andere Liste? andere Artenliste? --lcvp oder --ncbi vergessen?).' % anders)
    return 1


if __name__ == '__main__':
    sys.exit(main())
