# BUG-REPORT: Nach Login wird Registrier-Form gezeigt statt Home

> **Owner:** Claude Code · **Reporter:** Fernando · **Diagnose:** Cowork 2026-05-06 · **Severity:** P0 (blockt Auth-Flow komplett)

---

## Symptom (Fernando)
> „Bei der Anmeldung kommt einmal die Anmelde Seite und dann die Registrierseite nach dem Anmelden."

User-Flow:
1. App öffnen → Onboarding zeigt sich (`#gs-onboarding` Wrapper auf `display:flex`)
2. User klickt „🔑 Anmelden" → `gsOnboardingLogin()` → `onbShowLogin()` → Login-Form sichtbar (`#onb-login`)
3. User gibt Email + PW ein, klickt „Anmelden"
4. **Erwartet:** Onboarding hidet, Home-Tab erscheint
5. **Tatsächlich:** Registrier-Form (`#onb-register`) wird angezeigt

---

## Cowork-Diagnose (Code-Pfade analysiert)

### Initial-DOM (Z.1541-1621)
```html
<div id="gs-onboarding" style="display:none">    <!-- Wrapper, wird via JS auf display:flex gesetzt -->
  <div id="onb-start">                            <!-- default visible (kein style) -->
  <div id="onb-register" style="display:none">    <!-- initial hidden -->
  <div id="onb-login" style="display:none">       <!-- initial hidden -->
</div>
```

### Login-Pfad (`onbDoLogin` Z.50229)
```js
async function onbDoLogin() {
  // ... validate, then sbLogin
  var res = await sbLogin(email, pw);
  if (res.error) { ... }
  // Erfolg:
  gsResetLoginAttempts();
  if (typeof gsOnLoginSuccess === 'function') gsOnLoginSuccess();
  try { await sbLoadProfile(); } catch(e){}
  if (typeof updateMenuProfileBar === 'function') updateMenuProfileBar();
  gsOnboardingHide();           // ← versteckt nur den WRAPPER, nicht die Sub-Views!
  if (typeof showProfileToast === 'function') showProfileToast('✅ Willkommen zurück!', 'success');
}
```

### Bug-Quelle: `gsOnboardingHide()` (Z.50325)
```js
function gsOnboardingHide() {
  var el = document.getElementById('gs-onboarding');
  if (!el) return;
  el.style.opacity = '0';
  el.style.transition = 'opacity .35s';
  setTimeout(function(){
    el.style.display = 'none';   // ← nur Wrapper, Sub-Views bleiben in ihrem State!
    el.style.opacity = '';
  }, 350);
  try { localStorage.setItem(GS_ONBOARDING_KEY, 'logged_in'); } catch(e){}
}
```

**Problem:** Sub-Views (`onb-start`/`onb-login`/`onb-register`) werden NICHT auf einen sauberen Initial-State zurückgesetzt. Wenn der Wrapper später wieder sichtbar wird (durch irgendeinen Re-Trigger von `gsCheckOnboarding()` oder direktem `el.style.display='flex'`), kommt der zuletzt aktive Sub-View hoch.

### Wahrscheinlicher Re-Trigger
Mögliche Quellen für ein Re-Open des Onboarding-Wrappers nach Login:

1. **`gsCheckOnboarding()` läuft nochmal** — z.B. via setTimeout nach `sbInit` (Z.51913 ist der einzige direkte Aufruf, aber evtl. Re-Trigger über Auth-State-Listener)
2. **Race-Condition**: `sbSaveSession` schreibt Token, aber `gsCheckOnboarding()` läuft VORHER und sieht keinen Token → öffnet Onboarding
3. **Email-Confirm-Redirect** (`?email_confirmed=1`): wenn URL-Param da ist, wird vielleicht Register/Profile-Setup-Form gezeigt
4. **Guest-Mode-Banner** (Z.1672) `onclick="gsOnboardingRegister()"` — falls User versehentlich draufklickt

### Inspect zur Verifikation (live im Browser)
DevTools-Console-Befehle:
```js
// Welche Sub-View ist gerade sichtbar?
['onb-start','onb-login','onb-register'].forEach(id=>{
  var e=document.getElementById(id);
  console.log(id, e?.style.display||'(default visible)');
});

// Wrapper-Status
console.log('wrapper:', document.getElementById('gs-onboarding')?.style.display);

// Was sagt LocalStorage?
console.log('onboarding_key:', localStorage.getItem('gs_onboarding_done'));
console.log('logged_in:', !!localStorage.getItem('gs_sb_token'));
console.log('guest_mode:', localStorage.getItem('gs_guest_mode'));
```

---

## Empfohlener Fix (Pflicht-Edits)

### Fix 1: `gsOnboardingHide()` (Z.50325-50335) — Sub-Views sauber zurücksetzen
```js
function gsOnboardingHide() {
  var el = document.getElementById('gs-onboarding');
  if (!el) return;
  el.style.opacity = '0';
  el.style.transition = 'opacity .35s';
  setTimeout(function(){
    el.style.display = 'none';
    el.style.opacity = '';
    // v25.0: Sub-Views auf default-state zurücksetzen damit beim
    //        next-Re-Open der saubere Start-Screen kommt
    var startEl = document.getElementById('onb-start');
    var regEl   = document.getElementById('onb-register');
    var loginEl = document.getElementById('onb-login');
    if (startEl) startEl.style.display = '';     // sichtbar (default)
    if (regEl)   regEl.style.display = 'none';
    if (loginEl) loginEl.style.display = 'none';
    // Inputs leeren — vermeidet Daten-Lecks zwischen User-Sessions
    ['onb-reg-name','onb-reg-email','onb-reg-pw','onb-login-email','onb-login-pw'].forEach(function(id){
      var inp = document.getElementById(id);
      if (inp) inp.value = '';
    });
  }, 350);
  try { localStorage.setItem(GS_ONBOARDING_KEY, 'logged_in'); } catch(e){}
}
```

### Fix 2: `gsCheckOnboarding()` (Z.49991) — robust gegen Re-Trigger
Stelle sicher dass die Funktion **nichts macht** wenn Wrapper bereits hidden ist UND User eingeloggt ist:
```js
function gsCheckOnboarding() {
  // v25.0: Idempotent — wenn schon eingeloggt + Wrapper hidden, nichts tun
  if (typeof sbIsLoggedIn === 'function' && sbIsLoggedIn()) {
    var el = document.getElementById('gs-onboarding');
    if (el && el.style.display === 'none') return;  // bereits sauber
  }
  // ... rest wie bisher
}
```

### Fix 3 (optional, für Profil-Setup-Step): Email-Confirm-Welcome
Wenn `?email_confirmed=1` URL-Param da ist UND User eingeloggt ist:
- KEIN Onboarding zeigen
- Stattdessen: einmalige Toast „✅ Email bestätigt — Willkommen!"
- URL-Param entfernen (`history.replaceState`)

---

## Working-Pattern für den Fix

```bash
cd "$HOME/Documents/Claude wichtige dateien/local-agent-mode-sessions/repo-clone"
git pull --rebase origin main

# Fix in index.html — nutze grep um exakte Zeilen zu finden
grep -n "function gsOnboardingHide" index.html

# Edit machen (3 Stellen)
# ...

# Verify
node --check ... # 7 Inline-Scripts

# v-Bump v24.51 → v25.0 (Major-Bump weil Auth-Flow + AUFTRAG_v25.md startet)
# - index.html: GS_VERSION
# - sw.js: VERSION
# - _headers: Top-Comment
# - GS_RELEASES neuer Eintrag
# - meta name="app-version"

git add index.html sw.js _headers
git commit -m "v25.0: Auth-Login-Bug fix — gsOnboardingHide reset Sub-Views

Root-Cause: gsOnboardingHide() versteckte nur den Wrapper #gs-onboarding,
nicht die Sub-Views (onb-start/onb-login/onb-register). Beim Re-Trigger
von gsCheckOnboarding() (z.B. nach sbInit-Race) kam der zuletzt aktive
Sub-View hoch — daher 'Registrier-Form nach Login'.

Fix:
- gsOnboardingHide() resetet onb-start sichtbar, onb-register/onb-login hidden
- Inputs werden geleert (Daten-Leck-Schutz zwischen User-Sessions)
- gsCheckOnboarding() idempotent: nichts tun wenn schon eingeloggt+hidden

Cowork-Diagnose 2026-05-06 in BUG_AUTH_LOGIN_ZEIGT_REGISTER.md.

Files: index.html (Z.50325, Z.49991)
Verify: 7/7 node --check ✓"

git push origin main
```

Nach Push: Cowork verifiziert via Chrome-MCP Live-Login-Flow.

---

## Definition of Done
- [ ] Login mit Test-Account → Home-Tab kommt (kein Register)
- [ ] Logout → Onboarding zeigt `onb-start` (nicht `onb-register`)
- [ ] Magic-Link-Flow unverändert
- [ ] 7/7 node --check ✓
- [ ] LIVE auf green-scan.ch nach UPDATE.command + CF-Cache-Purge

**Stand:** 2026-05-06 · Cowork-Diagnose · Pflicht-Sprint vor v25.x
