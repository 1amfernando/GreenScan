# store/ — App-Store-Build-Tooling

Build-Konfigurationen, um die GreenScan-PWA als native App auszuliefern. **Kein Teil der
ausgelieferten Web-App** (reine Dev-Tooling-Dateien, analog zu `supabase/`).

```
store/
├── android/
│   ├── twa-manifest.json   ← fertige Bubblewrap-Config (Package ch.greenscan.app)
│   └── BUILD_ANDROID.md    ← Schritt-für-Schritt (Bubblewrap → APK/AAB + SHA-256)
└── ios/
    ├── capacitor.config.json
    ├── package.json
    └── BUILD_IOS.md        ← PWA-Home-Screen (sofort) + App-Store-Weg (Capacitor/Xcode)
```

Einstieg: [`../STORE_SUBMISSION_GUIDE.md`](../STORE_SUBMISSION_GUIDE.md).

**Nie ins Repo:** Signing-Keystores (`*.keystore`, `*.jks`, `*.p12`), Keystore-Passwörter,
Apple-Provisioning-Profiles. Diese gehören NUR auf Fernandos Rechner. Verlust eines
Signing-Keys = keine App-Updates mehr möglich.
```
