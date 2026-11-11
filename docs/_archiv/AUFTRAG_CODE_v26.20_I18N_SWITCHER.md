# AUFTRAG v26.20 — i18n Frontend-Switcher (DE/FR/IT/GSW)

**Owner:** Claude Code (Frontend).
**Priorität:** P1 (Schweizer Markt-Coverage aktivieren — DB ist ready).
**Erwartete Dauer:** ~5-7 Std (Top-100 UI-Strings i18n-fähig machen + Picker + Persistenz).
**Vorbedingung:** ✅ `i18n_translations`-Tabelle hat 931 Einträge (DE→FR: 321, DE→IT: 313, DE→GSW: 297).

---

## Was und warun

Code's v26.x-Backend hat i18n FR/IT auf 100% gebracht. **Aber kein Frontend nutzt das.** Schweizer FR/IT/GSW-User sehen weiter alles auf Deutsch.

Use-Case-Triage:
- DE = Standard, ~70% der CH-Nutzer
- FR = ~20% (Romandie)
- IT = ~7% (Tessin)
- GSW = ~3% Spaß-Modus (alemannisch)

Wir wollen NICHT 5.5 MB index.html komplett übersetzen — sondern **Top-100 UI-Strings** mit `data-i18n`-Attributen versehen + Live-Switch.

---

## Architektur

### 1. i18n-Bundle laden + cachen

#### Boot-Sequence (im Body, vor App-Start)

```js
window.gsI18n = (function(){
  const STORE_KEY = 'gs_lang';
  const CACHE_KEY = 'gs_i18n_cache_v1';
  let current = localStorage.getItem(STORE_KEY) || _detectBrowserLang() || 'de';
  let dict = {};  // { 'key': 'translated_string' }

  function _detectBrowserLang() {
    const nav = (navigator.language || 'de').toLowerCase();
    if (nav.startsWith('fr')) return 'fr';
    if (nav.startsWith('it')) return 'it';
    if (nav.startsWith('de')) return 'de';
    return 'de';  // Fallback
  }

  async function load(lang) {
    if (lang === 'de') {
      dict = {};  // Source-Sprache, keine Übersetzung nötig
      return;
    }

    // Cache prüfen
    const cached = JSON.parse(localStorage.getItem(`${CACHE_KEY}_${lang}`) || 'null');
    if (cached && Date.now() - cached.ts < 24*3600*1000) {  // 24h Cache
      dict = cached.dict;
      return;
    }

    // Vom Backend holen
    const { data } = await sbFetch(`i18n_translations?target_lang=eq.${lang}&select=source_text,target_text`);
    dict = {};
    (data || []).forEach(r => dict[r.source_text] = r.target_text);
    localStorage.setItem(`${CACHE_KEY}_${lang}`, JSON.stringify({ ts: Date.now(), dict }));
  }

  function t(de_text) {
    if (current === 'de') return de_text;
    return dict[de_text] || de_text;  // Fallback Deutsch
  }

  async function setLang(lang) {
    current = lang;
    localStorage.setItem(STORE_KEY, lang);
    await load(lang);
    _applyToDOM();
  }

  function _applyToDOM() {
    // Alle Elemente mit data-i18n Attribute scannen + ersetzen
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });
    // Placeholder + Title-Attribute
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.getAttribute('data-i18n-title'));
    });
  }

  // Bei Boot
  load(current).then(_applyToDOM);

  return { t, setLang, get current() { return current; }, _applyToDOM };
})();
```

### 2. Top-100 Strings mit data-i18n versehen

**Strategie:** Statt manuell durchs 56k-Zeilen-HTML → automatisch via Skript identifizieren.

Im Repo `scripts/i18n_extract.sh` (Code: erweitern):
```bash
grep -oE 'data-i18n="[^"]*"' index.html | sort -u | wc -l
```

Empfohlene Strategie:
1. Nav-Links („Garten", „Wissen", „Profil") → `data-i18n`
2. Buttons („Speichern", „Abbrechen", „Foto aufnehmen", „Plan erstellen")
3. Modal-Titel + Onboarding-Schritte
4. Tab-Labels, Filter-Labels, Setting-Labels
5. Toast-Messages → ggf `gsT('key')` als Wrapper für `gsI18n.t()`

**Konkretes Vorgehen für Code:**
```js
// Vor v26.20:
button.textContent = 'Speichern';

// Nach v26.20 (Option A: data-i18n + textContent):
<button data-i18n="Speichern">Speichern</button>

// Nach v26.20 (Option B: für dynamisch erzeugten Text):
button.textContent = gsI18n.t('Speichern');
```

### 3. Sprach-Picker im Profil-Screen

```html
<div class="setting-row">
  <label data-i18n="Sprache">Sprache</label>
  <select id="gs-lang-picker" onchange="gsI18n.setLang(this.value)">
    <option value="de">🇩🇪 Deutsch</option>
    <option value="fr">🇫🇷 Français</option>
    <option value="it">🇮🇹 Italiano</option>
    <option value="gsw">🇨🇭 Schwiizerdüütsch</option>
  </select>
</div>
```

Bei Boot:
```js
document.getElementById('gs-lang-picker').value = gsI18n.current;
```

### 4. Pluralisierung + Variablen (Phase 2, nicht MVP)

Vorerst keine ICU-Messages. Für „3 Pflanzen" → entweder:
- Server-Side bereits korrekt pluralisiert in i18n_translations
- Frontend-Templates mit `{count}` Placeholder

```js
function t_count(key, count) {
  return gsI18n.t(key).replace('{count}', count);
}
```

### 5. Datum/Zahl-Formatierung (Phase 2)

Bei v26.20 NICHT zwingend. Phase 2 würde `Intl.NumberFormat(current).format(...)` einsetzen.

### 6. Missing-Translation-Tracking (Phase 2)

Wenn Production-Mode `dict[key]` undefined → optional silently log → ggf zu i18n_translate POSTen für späteres Bulk-Fill.

---

## Definition of Done

- [ ] `window.gsI18n` ist gloal verfügbar mit `t()`, `setLang()`, `current`
- [ ] Cache in localStorage `gs_i18n_cache_v1_<lang>` mit 24h-TTL
- [ ] Mind. **80 UI-Strings** mit `data-i18n` Attribute (oder gsI18n.t() Wrapper)
- [ ] Sprach-Picker im Profil-Screen (4 Sprachen) mit Live-Switch
- [ ] Browser-Lang Auto-Detect bei First-Visit
- [ ] FR/IT/GSW User sehen tatsächlich übersetzte Top-Strings
- [ ] 7/7 Inline-Scripts node-clean
- [ ] sw.js VERSION-Bump auf v26.20
- [ ] GS_RELEASES Eintrag mit user_summary: „🌍 Sprachauswahl: Deutsch, Français, Italiano, Schwiizerdüütsch — direkt im Profil wechselbar."

## Commit-Message

```
v26.20: 🌍 i18n Frontend-Switcher — DE/FR/IT/GSW Live-Wechsel

- window.gsI18n: t(de_text) Wrapper mit 24h-Cache
- 80+ UI-Strings mit data-i18n Attribute
- Sprach-Picker im Profil-Screen (4 Sprachen + Browser-Detect)
- Verbindung zu i18n_translations-Tabelle (931 Einträge)
- localStorage gs_lang Persistenz

Cowork-Auftrag v26.20 erfüllt.
```

---

**Geschrieben:** Cowork-Claude 2026-05-22.
