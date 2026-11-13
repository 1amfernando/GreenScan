# _rdata.py — Helfer von arten_namen_pruefung.py (kein Pruefstand, wird nicht einzeln gefahren).
#
# Kleiner Leser fuer R-Dateien (.rda / save()), nur Standardbibliothek.
# Warum selbst gebaut: die zwei Rueckgratlisten, die von hier aus erreichbar sind (WCVP, LCVP),
# liegen nur als R-Datenpakete vor, und es gibt hier kein R. `pyreadr` (PyPI) scheiterte an LCVP
# (gemessen 11.11.2026: "Unhandled S-Expression: 51" — die Datei ist im ASCII-Format gespeichert);
# an WCVP wurde es nicht mehr versucht. Format: R Internals, Abschnitt "Serialization Formats".
# Kann: xz/gzip/bzip2/unkomprimiert · Formate XDR ("X") und ASCII ("A") · Version 2 und 3
# · data.frame aus Zeichen-, Ganzzahl-, Gleitkomma-, Logik- und Faktor-Spalten · ALTREP
# (compact_intseq, compact_realseq, deferred_string, wrap_*).
# Liest und verwirft: Umgebungen, externe Zeiger, Funktionen (kommen als Attribute vor).
# Kann NICHT: Bytecode, S4-Inhalte — braucht ein Namens-Datensatz nicht; dann ein klarer Fehler.
import bz2, gzip, io, lzma, re, struct

NA_INT = -2147483648


class _Xdr:
    def __init__(self, daten):
        self.b = daten
        self.p = 0

    def ganz(self):
        v = struct.unpack_from('>i', self.b, self.p)[0]
        self.p += 4
        return v

    def gleit(self):
        v = struct.unpack_from('>d', self.b, self.p)[0]
        self.p += 8
        return v

    def ganze(self, n):
        v = struct.unpack_from('>%di' % n, self.b, self.p)
        self.p += 4 * n
        return list(v)

    def gleite(self, n):
        v = struct.unpack_from('>%dd' % n, self.b, self.p)
        self.p += 8 * n
        return list(v)

    def roh(self, n):
        v = self.b[self.p:self.p + n]
        self.p += n
        return v

    def ueberspringe(self, n):
        self.p += n


_ESC = re.compile(rb'\\([0-7]{1,3}|.)')
_ESC_TAB = {b'n': b'\n', b't': b'\t', b'v': b'\v', b'b': b'\b', b'r': b'\r', b'f': b'\f',
            b'a': b'\a', b'\\': b'\\', b'?': b'?', b"'": b"'", b'"': b'"'}


def _esc(m):
    g = m.group(1)
    if g[:1] in b'01234567':
        return bytes([int(g, 8)])
    return _ESC_TAB.get(g, g)


class _Ascii:
    def __init__(self, strom):
        self.f = strom

    def _zeile(self):
        z = self.f.readline()
        if not z:
            raise EOFError('Datei endet mitten im Objekt')
        return z.strip()

    def ganz(self):
        z = self._zeile()
        return NA_INT if z == b'NA' else int(z)

    def gleit(self):
        z = self._zeile()
        if z == b'NA':
            return float('nan')
        return float(z.decode('ascii').replace('Inf', 'inf').replace('NaN', 'nan'))

    def ganze(self, n):
        return [self.ganz() for _ in range(n)]

    def gleite(self, n):
        return [self.gleit() for _ in range(n)]

    def roh(self, n):
        z = self._zeile()
        return _ESC.sub(_esc, z) if b'\\' in z else z

    def ueberspringe(self, n):
        self.f.readline()


def _oeffne(pfad):
    with open(pfad, 'rb') as f:
        kopf = f.read(6)
    if kopf[:6] == b'\xfd7zXZ\x00':
        return lzma.open(pfad, 'rb')
    if kopf[:2] == b'\x1f\x8b':
        return gzip.open(pfad, 'rb')
    if kopf[:3] == b'BZh':
        return bz2.open(pfad, 'rb')
    return open(pfad, 'rb')


class Sym(str):
    pass


class RLeser:
    """lies(pfad, spalten=None) -> {objektname: {'spalten': {name: liste}, 'zeilen': n}}"""

    def __init__(self, pfad, behalten=None):
        self.pfad = pfad
        self.behalten = behalten      # None = alle Zeichenspalten dekodieren; Menge von Spaltennummern sonst
        self.refs = []
        self.tiefe_vec = 0
        self.spalte = None

    def lies(self):
        strom = _oeffne(self.pfad)
        magie = strom.read(5)
        if magie not in (b'RDX2\n', b'RDX3\n', b'RDA2\n', b'RDA3\n'):
            raise ValueError('keine R-Datendatei (Kopf %r)' % magie)
        art = strom.read(2)
        if art == b'X\n':
            self.q = _Xdr(strom.read())
            strom.close()
        elif art == b'A\n':
            self.q = _Ascii(io.BufferedReader(strom, 1 << 20) if not isinstance(strom, io.BufferedReader) else strom)
        else:
            raise ValueError('unbekanntes Serialisierungsformat %r' % art)
        version = self.q.ganz()
        self.q.ganz()
        self.q.ganz()
        if version == 3:
            n = self.q.ganz()
            self.q.roh(n)
        elif version != 2:
            raise ValueError('Serialisierungsversion %r nicht unterstuetzt' % version)
        return self._objekt()

    # --- ein Objekt ---------------------------------------------------------------
    def _laenge(self):
        n = self.q.ganz()
        if n == -1:
            hi = self.q.ganz()
            lo = self.q.ganz()
            n = (hi << 32) + (lo & 0xFFFFFFFF)
        return n

    def _zeichen(self, dekodieren=True):
        flags = self.q.ganz()
        if (flags & 0xFF) != 9:
            raise ValueError('CHARSXP erwartet, Typ %d' % (flags & 0xFF))
        n = self.q.ganz()
        if n == -1:
            return None
        if not dekodieren:
            self.q.ueberspringe(n)
            return None
        roh = self.q.roh(n)
        if (flags >> 12) & 4:                       # LATIN1_MASK
            return bytes(roh).decode('latin-1')
        return bytes(roh).decode('utf-8', 'replace')

    def _objekt(self, flags=None):
        q = self.q
        if flags is None:
            flags = q.ganz()
        typ = flags & 0xFF
        hat_attr = bool(flags & 0x200)
        hat_tag = bool(flags & 0x400)

        if typ == 254 or typ in (253, 252, 251, 250, 249, 248):   # NULL und die festen Sonderwerte
            return None
        if typ == 255:                                            # Verweis auf ein frueheres Symbol
            i = flags >> 8
            if i == 0:
                i = q.ganz()
            return self.refs[i - 1]
        if typ == 1:                                              # Symbol
            s = Sym(self._zeichen() or '')
            self.refs.append(s)
            return s
        if typ in (2, 3, 5, 6, 17):                               # Paarliste (auch Funktion, Versprechen, Sprache, Punkte)
            aus = []
            while True:
                if hat_attr:
                    self._objekt()
                tag = self._objekt() if hat_tag else None
                wert = self._objekt()
                aus.append((tag, wert))
                flags = q.ganz()
                typ2 = flags & 0xFF
                if typ2 == 254:
                    break
                if typ2 not in (2, 3, 5, 6, 17):                  # gepunktetes Paar: der Rest ist ein beliebiges Objekt
                    aus.append((None, self._objekt(flags)))
                    break
                hat_attr = bool(flags & 0x200)
                hat_tag = bool(flags & 0x400)
            return aus
        if typ == 4:                                              # Umgebung: zaehlt als Verweis, Inhalt wird gelesen und verworfen
            self.refs.append(None)
            q.ganz()
            for _ in range(4):
                self._objekt()
            return None
        if typ == 22:                                             # externer Zeiger (z.B. readr/data.table-Attribut)
            self.refs.append(None)
            self._objekt()
            self._objekt()
            if hat_attr:
                self._objekt()
            return None
        if typ == 23:                                             # schwacher Verweis
            self.refs.append(None)
            if hat_attr:
                self._objekt()
            return None
        if typ in (7, 8):                                         # eingebaute Funktion: nur ein Name
            q.roh(q.ganz())
            return None
        if typ == 25:                                             # S4-Objekt: nur Attribute
            if hat_attr:
                self._objekt()
            return None
        if typ == 9:                                              # einzelne Zeichenkette (selten direkt)
            n = q.ganz()
            return None if n == -1 else bytes(q.roh(n)).decode('utf-8', 'replace')

        if typ in (10, 13):                                       # logisch, ganzzahlig
            wert = q.ganze(self._laenge())
        elif typ == 14:                                           # Gleitkomma
            wert = q.gleite(self._laenge())
        elif typ == 15:                                           # komplex
            wert = q.gleite(2 * self._laenge())
        elif typ == 16:                                           # Zeichenvektor
            n = self._laenge()
            dek = True
            if self.behalten is not None and self.tiefe_vec == 1 and n > 1000:
                dek = self.spalte in self.behalten
            z = self._zeichen
            wert = [z(dek) for _ in range(n)] if dek else self._ueberspringe_zeichen(n)
        elif typ in (19, 20):                                     # Liste
            n = self._laenge()
            self.tiefe_vec += 1
            wert = []
            for i in range(n):
                if self.tiefe_vec == 1:
                    self.spalte = i
                wert.append(self._objekt())
            self.tiefe_vec -= 1
        elif typ == 24:                                           # Rohbytes
            wert = q.roh(self._laenge())
        elif typ == 238:                                          # ALTREP
            info = self._objekt()
            zustand = self._objekt()
            attr = self._objekt()
            wert = self._altrep(info, zustand)
            if attr:
                return _MitAttr(wert, dict((str(t), w) for t, w in attr))
            return wert
        else:
            raise ValueError('R-Typ %d wird von diesem Leser nicht unterstuetzt' % typ)

        if hat_attr:
            attr = self._objekt() or []
            return _MitAttr(wert, dict((str(t), w) for t, w in attr))
        return wert

    def _ueberspringe_zeichen(self, n):
        z = self._zeichen
        for _ in range(n):
            z(False)
        return _Uebersprungen(n)

    def _altrep(self, info, zustand):
        klasse = str(info[0][1]) if info else ''
        if klasse == 'compact_intseq':
            n, start, schritt = int(zustand[0]), int(zustand[1]), int(zustand[2])
            return list(range(start, start + n * schritt, schritt))
        if klasse == 'compact_realseq':
            n, start, schritt = int(zustand[0]), zustand[1], zustand[2]
            return [start + i * schritt for i in range(n)]
        if klasse == 'deferred_string':
            quelle = zustand[0][1]
            quelle = quelle.wert if isinstance(quelle, _MitAttr) else quelle
            return [None if (v == NA_INT or v != v) else (str(int(v)) if float(v).is_integer() else repr(v))
                    for v in quelle]
        if klasse.startswith('wrap_'):
            inhalt = zustand[0] if isinstance(zustand, list) else zustand
            return inhalt.wert if isinstance(inhalt, _MitAttr) else inhalt
        raise ValueError('ALTREP-Klasse %r wird nicht unterstuetzt' % klasse)


class _MitAttr:
    __slots__ = ('wert', 'attr')

    def __init__(self, wert, attr):
        self.wert = wert
        self.attr = attr


class _Uebersprungen:
    __slots__ = ('n',)

    def __init__(self, n):
        self.n = n


def spaltennamen(pfad):
    """Erster Durchgang: nur die Struktur. -> [(objektname, [spaltennamen], zeilen)]"""
    oben = RLeser(pfad, behalten=set()).lies()
    aus = []
    for tag, obj in oben:
        if isinstance(obj, _MitAttr) and 'names' in obj.attr:
            namen = obj.attr['names']
            namen = namen.wert if isinstance(namen, _MitAttr) else namen
            n = 0
            for sp in obj.wert:
                w = sp.wert if isinstance(sp, _MitAttr) else sp
                n = max(n, w.n if isinstance(w, _Uebersprungen) else len(w))
            aus.append((str(tag), list(namen), n))
    return aus


def tabelle(pfad, objekt, spalten):
    """Zweiter Durchgang: nur die genannten Spalten dekodieren. -> {spalte: liste}"""
    struktur = dict((o, (n, z)) for o, n, z in spaltennamen(pfad))
    if objekt not in struktur:
        raise KeyError('Objekt %r nicht in der Datei (vorhanden: %s)' % (objekt, ', '.join(struktur)))
    namen, zeilen = struktur[objekt]
    fehlt = [s for s in spalten if s not in namen]
    if fehlt:
        raise KeyError('Spalten fehlen: %s (vorhanden: %s)' % (', '.join(fehlt), ', '.join(namen)))
    idx = set(namen.index(s) for s in spalten)
    oben = RLeser(pfad, behalten=idx).lies()
    for tag, obj in oben:
        if str(tag) != objekt:
            continue
        aus = {}
        for s in spalten:
            sp = obj.wert[namen.index(s)]
            w, attr = (sp.wert, sp.attr) if isinstance(sp, _MitAttr) else (sp, {})
            if 'levels' in attr:                                   # Faktor -> Text
                lv = attr['levels']
                lv = lv.wert if isinstance(lv, _MitAttr) else lv
                w = [None if (i == NA_INT or i is None) else lv[i - 1] for i in w]
            aus[s] = w
        return aus, zeilen
    raise KeyError(objekt)
