/* ────────────────────────────────────────────────────────────
   GreenScan Service Worker
   v26.80 — 3 Bug-Fixes Quiz-Rangliste + KI-Erklärung + Karten-Toast (Cowork 2026-06-02): (1) openDqRanking auf quiz_leaderboard-Tabelle umgestellt: queryt jetzt RPC fn_quiz_leaderboard_top(p_limit:50) statt alte leere quiz_ranking-Tabelle. Mappe v26.72-Schema {rnk,display_name,total_correct,streak_max,total_attempts} → openDqRanking-Schema {username,yearPoints,yearCorrect,yearTotal,streak}. (2) dqAskKIExplain nutzt jetzt callAI() statt direkt localStorage.gs_anthropic_key (Personal-Key war seit v26.67 admin-only → Normal-User sahen "API-Key fehlt"-Toast). Global-Key wird automatisch via getApiConfig() geholt, Abo-Quota wird gechecked (Free 15/Tag, Paid ∞). Fehler-Meldungen klarer formuliert (Quota vs Key). (3) gsAddMarker zeigt jetzt gsToast wenn Name leer ist statt silent return — User bekommt Feedback warum Save fehlschlägt. 7/7 node --check OK.
   v26.79 — 3D-Planer Phase 3: Procedural Plant-Builder + Detail-Polish (Cowork 2026-06-02): (1) 8 Kategorie-spezifische Procedural-Modelle statt platte Cylinder: Baum (Trunk+3-Crown-Spheres mit detaillierter Krone), Obstbaum (Trunk+Crown+6 bunte Frucht-Spheres), Beere (4 Stems+8 Blätter+6-10 Berry-Spheres im Cluster mit emissive Glow), Gemüse (Stem+15 Blatt-Spheres in 3 Lagen), Kraut (12 Bushy-Spheres), Blume (Stem+2 Leaves+Pollen-Center+8 Petals als Rosette), Hauspflanze (Topf+10 Blätter), Kraut-Default. (2) Boden-Polish: segmentierte Plane (24x24) mit Vertex-Color-Variation (organische Earth-Optik), 60 Gras-Tufts (Cone-Geo, random rotation) scattered. (3) Sky-Polish: visible Sun-Disk + Halo am Himmel die mit Sun-Hour-Slider mitbewegt werden, Golden-Hour-Tönung beider. (4) Wind-Sway-Animation: alle Crowns/Leaves/Blossoms haben individuelle phase+amplitude, rotation.z+x oscilliert mit windT (0.018/frame). (5) Konflikt-Glow traverse Group-Tree statt single mesh. (6) Mini-Map liest userData direkt vom Group. (7) Backend: plant_3d_models Tabelle + Storage-Bucket plant-3d-models für später echte GLB-Assets (Procedural ist Default-Fallback). 7/7 node --check OK.
   v26.78 — Saison-Pilze Phase 2: Verwechsler-Galerie + Wachstums-Forecast (Cowork 2026-06-01): (1) Verwechsler-Galerie: in der Mushroom-Saison-Home-Card listet kritische Doppelgänger (mushroom_lookalikes.confusion_risk ∈ {sehr_hoch_lebensgefahr, hoch}) für alle patch.typical_mushrooms. Compact-Card mit Top-2 lethal-Verwechslern + Button "Alle X Verwechsler ansehen" → Modal mit allen Details (visual/key/smell/habitat/spore differences + pro_tip + VAPKO-Hinweis). (2) Wachstums-Forecast: Open-Meteo-API pullt 3-Tage-Niederschlag + Boden-6cm-Temp + aktuelle Luftfeuchte. Score 0-100 berechnet (Regen 15-50mm = +50, Boden 8-20°C = +30, Humidity >75% = +20). Live-Anzeige "X% Pilz-Wahrscheinlichkeit" mit Color-Code (≥70 grün/jetzt raus, 40-70 gelb, <40 grau/warten). (3) gsOpenMushroomLookalikesModal Modal-API window-exposed. Idempotent via card.dataset.lookalikeMounted/forecastMounted. 7/7 node --check OK. Verschoben in v26.79+: Karten-Hotspots-Heatmap, Phänologie-Timeline.
   v26.77 — 3D-Planer Phase 2 + Perf-Sprint Phase 1 (Cowork 2026-06-01): (1) Mini-Map: 120x120 Canvas-Overlay rechts oben im 3D-Host, zeichnet Top-Down-View der Pflanzen-Positionen + 1m-Raster + Kamera-Direction-Pfeil. Toggle-Button 🗺 in den 3D-Controls. Re-Render alle 250ms damit Kamera-Pfeil aktuell bleibt. (2) Companion-Konflikt-Glow: lädt async plant_companion_matrix für alle rp[].lat-Namen, markiert antagonistische Paare (relationship in 'schlecht','kritisch_schlecht') mit MeshStandardMaterial emissive=0xd32f2f intensity=0.45 → rot pulsendes Glow. Mini-Map zeigt Konflikt-Pflanzen größer + mit weißem Ring. (3) Backend Phase-1 Perf-Sprint LIVE: 7 unindexed FK-Indexes erstellt (idx_book_species_candidates_reviewed_by, idx_marketplace_messages_sender_id, idx_profiles_role_assigned_by, idx_seasonal_highlights/seasonal_tips_created_by, idx_species_proposals_reviewed_by/user_id). Backend-Cleanup Phase 2-5 als Migrations-Drafts in PERF_SPRINT_v26.77_DRAFT.md vorbereitet (RLS-Wrap + Multi-Perm-Konsolidierung). 7/7 node --check OK. Verschoben in v26.78+: GLB-Pflanzen-Modelle (zu groß für Sprint).
   v26.75 — Frontend-Vervollständigung (v26.70–v26.72-Backends verdrahtet): (1) Marktplatz-Chat live: openMarketChat dispatcht jetzt eingeloggte User auf echten marketplace_messages-Backend statt Demo-localStorage. _gsChatStartThread öffnet Thread (GET marketplace_messages?listing_id&buyer_id), 5s-Polling (Modal-.open-guard, lastCount-Diff gegen Flicker), POST mit Prefer:return=minimal, fn_mkt_chat_mark_read RPC. Verkäufer-Seite: gsOpenConversations-Inbox aus v_marketplace_conversations mit Unread-Badges. Gast/Demo-Listings fallen auf _openMarketChatDemo zurück. 📨-Button im Marktplatz-Header. (2) "Meine Funde"-Screen: gsOpenMyFinds rendert window.gsMapFinds.list() mit Fokus/Privacy-Toggle (🌍/🔒)/Delete (gsConfirmModal + Live-Marker-Entfernung aus _gsMarkerLayers). 📋-Button im Karten-Header. (3) Home-Card Quiz-Rangliste: gsHomeFillLeaderboard lädt lazy dqLoadLeaderboardTop(3) (anon-granted), Medaillen 🥇🥈🥉, Klick öffnet gsOpenQuizLeaderboard. Reine Frontend-Verdrahtung, kein neues Backend. 7/7 node --check OK.
   v26.74 — 3D-Planer Polish: Sonnen-Slider + Schatten + 4K-Photo-Export (Master-Auftrag #3, Subset 3/10): (1) gsRenderGardenScan3D Three.js erweitert: renderer.shadowMap.enabled + PCFSoftShadowMap, sun.castShadow=true mit PCFShadowMap 1024x1024 + ortho-Camera-Bounds aus W/D. (2) Ambient + Sun + Hemisphere als globale Refs gespeichert für Sun-Hour-Setter. (3) Plant-Meshes castShadow + receiveShadow, Spheres castShadow. Ground receiveShadow. (4) setSunHour(4-20): Halbkreis-Bogen von Ost (4h Sonnenaufgang) über Mittag bis West (20h Untergang). Intensität 0.35+sin(arc)*0.85. Golden-Hour-Tönung (4-8h + 16-20h): r=1.0, g=1-gold*0.25, b=1-gold*0.55. Ambient scales with Sun-Höhe. Sky+Fog-Background tönt mit. (5) exportPhoto: temporäres Resize auf 3840×2160 (4K), pixelRatio=1, camera aspect updated, render+toDataURL('image/png'), Download via Anchor, danach restore. preserveDrawingBuffer=true für Browser-Support. (6) HTML-Controls in result-Preview: Sun-Slider input[range] 4-20 step 0.5 default 12 mit onchange→gs3DSetSunHour(hour) → window._gsGardenScan3DScene.setSunHour. Live-Label "HH:MM" reagiert auf Slider. Photo-Button onclick=gs3DExportPhoto. (7) Cleanup-Handle erweitert um {dispose, setSunHour, exportPhoto}. 7/7 node --check OK. Nicht implementiert: Mini-Map, Companion-Konflikt-Glow, Pflanzen-GLB-Modelle, Pfad-Tool, Beet-Editor (komplex, später v26.75+).
   v26.73 — Backend-Frontend-Audit + Saison-Pilze-Live-Counter (Master-Auftrag #4 + #9): (1) BACKEND_FRONTEND_MAP_v26.73.md erstellt — vollständige Matrix Tabelle×Frontend×Edge-Fn. 122 Tables, 30 Edge-Fns. Audit-Findings: 5 Stripe-Setup-Functions sind Dead-Code seit v26.40, customer-portal/create-checkout sind Duplikate von stripe-portal/stripe-checkout, 5 legacy_* Tables zum Löschen vorbereitet, plant-doctor-diagnose fehlte AI-Logging. (2) plant-doctor-diagnose v2 LIVE deployed mit fn_log_ai_usage RPC — alle 5 KI-Edge-Fns logen jetzt Tokens (war Single-Missing-Fn). (3) Master-#9 Saison-Pilze Erweiterung: gsAttachMushroomLiveCounter zeigt unter Home-Mushroom-Saison-Card den Community-Counter "🐾 X Funde diesen Monat" + Top-3 Species — pullt aus map_user_finds WHERE category=pilz AND is_private=false AND found_at>=monatsanfang. Anonymisiert (nur Count, kein User-Bezug). Empty-State CTA "Teile deinen ersten Fund". Idempotent via dataset.liveCounterMounted. 7/7 node --check OK.
   v26.72 — Quiz-Leaderboard (Master-Auftrag #11): Globale Rangliste über alle User. Migration v26_72_quiz_leaderboard LIVE: (1) CREATE TABLE quiz_leaderboard PK auf user_id mit display_name, total_correct, total_attempts, streak_current, streak_max, last_active_date, rank_position. 3 Indexes (correct desc, streak desc, active). RLS: all read + users upsert own row. (2) RPC fn_quiz_leaderboard_top(p_limit) SECURITY INVOKER → row_number-Ranking, GRANT zu authenticated+anon. (3) RPC fn_quiz_leaderboard_my_rank() SECURITY DEFINER mit search_path=public, GRANT authenticated. (4) RPC fn_quiz_leaderboard_upsert(correct,attempts,streak_cur,streak_max,name?) SECURITY INVOKER mit GREATEST-Merge (kein Backward-Slide) + display_name fallback 'Pilz-<Animal> <Num>' aus user_id-Hash. (5) pg_cron quiz-leaderboard-rank täglich 02:00 UTC: UPDATE rank_position via window-function. Frontend: dqSaveStats triggert dqPushLeaderboardDebounced (2s) → UPSERT via RPC mit aktuellen Stats + gs_social_name als Display-Name. gsOpenQuizLeaderboard öffnet Modal mit Top-20 + medals + Streak-Badge + eigenem Rang via fn_quiz_leaderboard_my_rank. dqLoadLeaderboardTop / dqLoadMyRank window-exposed für Home-Card-Use später. 7/7 node --check OK.
   v26.71 — Karten-Fund-Speicher Cross-Device (Master-Auftrag #10): Karten-Fundpunkte syncen jetzt zur Cloud. Migration v26_71_map_user_finds LIVE: (1) CREATE TABLE map_user_finds mit user_id FK, species_name, category (pilz|pflanze|baum|kraut|sonstiges), lat/lng/accuracy/altitude, found_at, note (1000 chars), photo_url, weather_condition, edible_confirmed, quantity_estimate (einzeln|mehrere|massenhaft), is_private (default true). (2) 5 Indexes: user+time, geo, species, category+time, community (partial WHERE is_private=false). (3) RLS: users see own finds + community sees public + insert/update/delete eigene. (4) Storage-Bucket map-find-photos public mit Folder-Pattern uid/file (User darf nur eigenen Folder schreiben). (5) Storage-Policies: upload/update/delete own, anyone read public. Frontend: (a) gsAddMarker POSTet zusätzlich nach map_user_finds wenn eingeloggt — speichert cloud_id zurück in LS-Cache. (b) gsLoadMarkersFromCloud async pullt 500 letzte Funde + rendert die noch nicht-LS-bekannten als Marker mit ☁️-Indicator + Community-Badge wenn !is_private. (c) Wrapper-API window.gsMapFinds.list / togglePrivacy / delete für künftiges Meine-Funde-Screen. (d) Marker-Cat-Mapping pilz/baum/pflanze/kraut → DB-Enum, Rest → sonstiges. 7/7 node --check OK.
   v26.70 — Marketplace Tutti-Style (Master-Auftrag #5): Inserate gehen jetzt OHNE Pflicht-Stripe-Connect. Online-Bezahlung ist OPTIONAL. Default = Tutti-Style: Kontakt-Button statt Kaufen-Button, Bezahlung privat (TWINT/Cash/Übergabe). Migration v26_70_marketplace_tutti_style LIVE: (1) ALTER TABLE marketplace_listings ADD allow_online_payment bool default false + contact_method text default 'chat'. (2) Neue Tabelle marketplace_messages mit RLS (User sieht nur Chats wo er Buyer ODER Seller ist, INSERT nur sender_id=own_uid). 4 Indexes (listing_time / buyer / seller / unread). (3) View v_marketplace_conversations (security_invoker) für Übersicht. (4) RPC fn_mkt_chat_mark_read setzt read_at für eingehende Messages. Frontend: (a) Settings-Row "🏪 Verkäufer-Konto verbinden" umformuliert zu "💳 Online-Bezahlung aktivieren · Optional" mit Tutti-Erklärung im Sub-Text. (b) Listing-Form bekommt grüne Checkbox "Online-Bezahlung anbieten (optional)" mit Tutti-Hinweis. (c) submitListing speichert allow_online_payment + contact_method. (d) loadMarketFromSupabase mapped die neuen Felder. (e) openListingDetail buynow-Pfad: bei !allow_online_payment → primärer Button wird "💬 Kontakt aufnehmen" (blauer Gradient) statt "💳 Jetzt kaufen". Tutti-Hint-Box mit "Bezahlung privat" + Badge im Preis-Block (💳 Online-Zahlung vs 🤝 Privat). 7/7 node --check OK.
   v26.69 — Universal-Save Audit (Master-Auftrag #8): Cloud-Sync für Settings-Toggles war SILENT BROKEN seit v23.78. (1) Bug-Fix: savePref() rief gsPrefsPush — definiert war aber nur gsPrefsPushNow → typeof-Guard schluckte den Push silent. Settings-Toggles wurden NIE in user_preferences gespiegelt. Alias window.gsPrefsPush=gsPrefsPushNow + smart Mapping (strukturierte Spalten language/region/units vs. free-form prefs jsonb). (2) Migration v26_69_user_preferences_prefs_jsonb LIVE: ALTER TABLE user_preferences ADD prefs jsonb default '{}'. Arbitrary Toggles (homeWeather/showMoon/pestTips/safetyWarnings/marketNotif/socialNotif/harvestNotif) landen jetzt im prefs-Blob. (3) gsPrefsPull merged jetzt prefs-jsonb in gs_prefs zurück + refresht userPrefs-Globalvar — flacher Lese-Zugriff bleibt erhalten. (4) Neue Konstante GS_KEEP_ON_LOGOUT als explizite Doku-Whitelist für Keys die Logout überleben (gs_dark, gs_lang, gs_theme_color, gs_consent, gs_prefs, gs_user_location, gs_units, sb_url/key). 7/7 node --check OK.
   v26.68 — KI-Plan Cross-Device + Stripe-Portal Bug-Fix (Cowork 2026-06-01): (1) Plan-Save in Mein-Garten: gsPPopenSavedPlans pullt jetzt Cloud aus user_gardens.data.plans + garden_plans Tabelle und merged mit LS → Pläne sichtbar auf allen Geräten. gsPPdeletePlan löscht aus beiden Cloud-Stellen + nutzt gsConfirmModal. gsPPloadSavedPlan robust. (2) Stripe Abo verwalten Bug behoben: Edge-Fn stripe-portal v4 LIVE — vorher las sie aus nicht-existenter Tabelle stripe_customers → 404 für alle User. Jetzt Customer-ID aus stripe_subscriptions.stripe_customer_id + Stripe-API-Search-Fallback. 7/7 node --check OK.
   v26.67 — Personal-API-Key admin-only (Cowork 2026-06-01): Settings-Row "Persönlichen API-Key entfernen" jetzt admin-only-row Class — Normal-User sehen sie nicht mehr. Globaler Claude-Key funktioniert für ALLE Abo-Stufen (Free 15/Tag · Plus/Pro/Lifetime ∞). Verhalten wie bei anderen Apps: Key ist immer aktiv, nur das Abo regelt die Quota. Power-User können ps_api_key weiterhin via Browser-Console setzen. 7/7 node --check OK.
   v26.66 — HOTFIX (Cowork 2026-06-01): Scan-Crash "confirmed.find is not a function" gefixt. Backup-Build Z.58106 hatte '{}' als Fallback statt '[]' → corrupted gs_confirmed_species als Object in Cloud → confirmed.find() crashed. Fix: (1) Backup-Build forciert []. (2) addToConfirmed + gsShowConfirmedScans Array.isArray-Guards. (3) Cloud-Pull stateMap forced auf Array. (4) Boot-Repair migriert alte {}-Backups direkt in LS auf []. Tritt nie wieder auf, auch nicht mit alten corrupted Cloud-Backups. 7/7 node --check OK.
   v26.65 — Settings + i18n + Backend Audit (Cowork 2026-05-30): (1) Sprachen-System: Schwiizerdütsch raus, Englisch + Spanisch rein. gsI18n.SUPPORTED=['de','en','fr','it','es'] + bundles + Toast-Cases. Sprach-Picker HTML. i18n_translations gsw-rows DELETE (297). i18n-translate Edge-Fn v2 mit en/es Lang-Map deployed. EN/ES werden lazy by first-switch via Anthropic-Bulk-Run gefüllt. (2) Settings-Audit: confirm() bei clearAllData → gsConfirmModal mit kind=danger + Free-Quota-Hint. Doppelte About-Card konsolidiert. Arten-Zahl jetzt dynamisch aus DB.length. ~25 data-i18n auf Settings-Toggles ergänzt (Garten/KI/Datenschutz/Rechtliches/Über). (3) AI-Quota-Row: Free-User sehen 'X/15 Calls heute · Y übrig', Paid sehen '∞ Unlimited'. Live-Refresh in initSettingsScreen. (4) gsRemovePersonalKey: Property-Bug behoben (body→message, okText→ok, danger→kind:'danger') + Free-Plan-Quota-Hint im Confirm. (5) Backend: stripe-webhook v11 deployed (5 neue Cases: trial_will_end Push, charge.failed Audit, dispute Alert, customer.updated email-sync, payment_method.attached Analytics — Code war 3 Wochen ungedeployed). 7/7 node --check OK.
   v26.64 — Polish (Cowork 2026-05-30): (1) 7 user-facing bare alert() → gsToast (savePlant/submitListing-3x/submitPost/submitIgPost/saveRecipe/saveManualLocation/saveGarden) — Hard-Lesson #2 (iOS-PWA-Webview-Blocker) für alle Form-Validations final geschlossen. (2) Achievements-Modal a11y: role=dialog + aria-modal + aria-labelledby + ESC-Close-Handler (auto-cleanup) + gsTrapFocus wenn vorhanden. 7/7 node --check OK.
   v26.63 — Audit-Sweep + Memory-Sync (B+ → A-, Cowork 2026-05-30): (1) gsConfirmCancelSub Fallback raus (Dead-Code, iOS-PWA-P0). (2) gsDeleteDiaryEntry + deletePlant: async + gsConfirmModal. (3) gsErnteAdd Toast-Bug: savedMenge vor Reset. (4) Achievements-Widget A11y (role/tabindex/aria/keyboard). (5) Frost-Banner Re-Render-Guard via dataset.frostKey + aria-label. Memory-Sync 4 Files. 7/7 node --check OK.
   v26.51 — Mein-Garten Audit + 3 Quick-Wins (Cowork 2026-05-27): (1) gsTbDelete + gsErnteDelete nutzen gsConfirmModal statt native confirm() — Hard-Lesson #2 (iOS-PWA-Webview-Blocker) für Mein-Garten geschlossen. (2) gsQuickDone + gsDoneAllDue schreiben pro Done einen p.diary-Entry (action+ts+title+source, Cap 200/Plant) — Done-History persistent und Cross-Device-synct. (3) STATE_KEYS-Map erweitert um gs_sae_merkliste + gs_bl_month/tab/bee + gs_tb_filter/search/cat_selected + gs_ernte_unit/view + gs_ernte_log (plants-Scope). _buildStateBlob serialisiert sae_merkliste + garten_prefs sub-object. Pull-Pfad stateMap setzt nach Cloud-Pull zurück in localStorage. Audit-Findings in outputs/MEIN_GARTEN_AUDIT_v26.51.md (25 Lücken, 3 P0 + 3 P1 + 3 RT). 7/7 node --check OK.
   v26.50 — ai_daily_usage Edge-Fn-Logging (AUFTRAG_v26.50, Trio #4 fertig): 5 Edge-Fns gepatched mit fn_log_ai_usage RPC fire-and-forget vor success-Return — alle Anthropic-Calls werden jetzt in ai_daily_usage upsert-incrementiert (Cowork-Backend RPC: SECURITY DEFINER, composite-unique date+edge_fn). LIVE deployed: pest-identify v2, mushroom-identify v2, garden-scan-analyze v5, plan-iterate v3, knowledge-bulk-gen v11. Pattern: `await admin.rpc('fn_log_ai_usage', {p_edge_fn: '<name>', p_tokens_in: <in>, p_tokens_out: <out>})` mit try/catch nicht-blockierend. v26.47 Admin-Token-Cost-Widget zeigt jetzt echte Live-Daten (statt leerem View). 7/7 node --check OK.
   v26.49 — Wetter-Alert-Widget Home (AUFTRAG_v26.49, garden_weather_alerts 10 Eintraege aus DB-Wave-14): Neues #weather-alert-card auf Home (ueber Mushroom-Saison-Card). Query garden_weather_alerts mit typical_months=cs.{currentMonth}. Region-Filter heuristisch client-side via GS_WA_REGION_TOKENS-Map (user_region_slug → ['Mittelland','Wallis','Tessin',...] Substring-Match in typical_regions Text-Array). Severity-Sort: katastrophal → hoch → mittel → gering, dann hours_to_react asc (dringend first). 4h in-Memory-Cache pro region+month key. Render: Severity-Gradient (katastrophal=#b71c1c, hoch=#c62828, mittel=#e65100, gering=#f57c00). Pulse-Animation (gs-wa-pulse keyframe-box-shadow) NUR bei katastrophal. Severity-Badge mit "React in <h>h"-Hinweis. Playfair-Title mit Emoji. Region+affected_plants-Zeile. Immediate-actions als dunkle Inline-Box. 2 Action-Buttons: MeteoSchweiz-Link extern + "Nächste"-Toggle. Click rotiert mit Fade. Auto-Load 350ms nach Home-Mount. 3 neue Functions: gsLoadGardenWeatherAlerts / gsRenderWeatherAlert / gsShowNextWeatherAlert. 7/7 node --check OK.
   v26.48 — Garten-Besucher-Sub-Tab + v_ai_usage_summary-Wiring (AUFTRAG_v26.48, DB-Wave-14 garden_visitors_animals 12 Eintraege): 11. Wissen-Sub-Tab "🦔 Besucher" (Igel, Eichhörnchen, Fledermaus, Marienkäfer, Hornisse, Salamander, Eidechse, Regenwurm etc). configs[besucher] table=garden_visitors_animals order=red_list_status,category,common_name_de. categoryField=category (Filter-Pills nach: saeugetier/insekt_nuetzling/insekt_schaedlich/reptil/amphibie/fledermaus/sonstige). Card-Accent: damage_severity hoch/katastrophal=rot, mittel=orange, gefährdet=gelb, Nützling=grün. Neuer _gsWave9RenderVisitor Detail-Modal: Rote-Liste-Banner ZUERST bei gefährdet + Nützling-Highlight-Banner gruen bei Beneficial. Badges (Category-Emoji + Size-cm + CH-heimisch + protected_status + active_time). active_months. beneficial_role PROMINENT als grosse grüne Box bei Nützling. potential_damage als rote/orange Box bei hoch/mittel. habitat_in_garden. food_preferences + what_attracts + what_repels + shelter_recommendations + conservation_actions als List-Sections. observation_tips cyan. Fun-Fact orange. PLUS v26.47 Token-Cost-Widget: Wired to v_ai_usage_summary View (statt direkter ai_daily_usage), nutzt pre-computed estimated_cost_usd_haiku × USD→CHF (0.88) für genauere Werte. Fallback auf eigene gsEstimateCostCHF wenn View leer. 1 neue Function: _gsWave9RenderVisitor. 7/7 node --check OK.
   v26.47 — Token-Cost-Widget Admin (AUFTRAG_v26.47, Pentagon #3 fertig): Migration v26_47_ai_daily_usage applied (table ai_daily_usage mit composite-PK date+edge_fn, total_tokens_in/out, total_cost_chf, call_count, index date desc, RLS authenticated-select + service-role-all). Cowork ergaenzt Edge-Fn-Logging via UPSERT-Pattern in jeder Anthropic-API-Call sobald Tabelle live. Frontend: Neuer admin-only Settings-Row "📊 KI-Nutzung & Kosten" in "KI & Scanner"-Sektion. Modal #modal-token-cost mit 2 Tabs: Heute (pro Edge-Fn Tokens/Calls/Cost) + 7-Tage-Trend (Tages-Total + Mini-Bar-Chart). Anthropic Haiku 4.5 Pricing client-side estimate ($1/Mio In · $5/Mio Out, USD→CHF ~0.88). Header-Card mit Playfair-Total + Calls/Tokens-Sub. Pro Edge-Fn Card mit monospace font_family für slug + CHF-Cost rechts + Calls/Tok-In/Tok-Out Sub-Zeile. 7-Tage-View aggregiert pro Tag + Mini-Bar-Chart (Höhe proportional zu max-day-cost) mit linear-gradient #00bcd4→#00838f. Disclaimer-Footer mit Pricing-Hinweis. 5 neue Functions: openTokenCostModal / gsTokenCostSwitchTab / gsTokenCostLoadToday / gsTokenCostLoad7d / gsEstimateCostCHF / gsFormatChf. 7/7 node --check OK. **Pentagon-Sprint #3 v26.43-v26.47 abgeschlossen.**
   v26.46 — Urban-Balkon-Wizard im KI-Planer (AUFTRAG_v26.46, urban_balcony_design 16 Designs aus DB-Wave-13): KI-Planer-Wizard erweitert: wenn User plan_intent='container' wählt, erscheint inline-Wizard mit (a) Number-Input "m²" (1-30, step 0.5), (b) Orientation-Select (Süd/Süd-Ost/Süd-West/Ost/West/Nord/Wintergarten), (c) "🔍 Vorlagen"-Button. gsBalconyWizardSearch: query urban_balcony_design WHERE size_min<=user_size AND size_max>=user_size AND orientation=picked. Fallback bei null Treffer ohne orientation-Filter. Result: bis 6 Cards inline mit difficulty-Emoji + Size/Container/CHF/Yield. Click → gsBalconyTemplateOpen Vollbild-Detail-Modal: Header lila→blau-Gradient, Eckdaten-Pills (CHF + Container + Setup-h + Maintenance min/W + 🐾 Pet-OK + 👶 Kind-OK), Watering/Winter/Wind/Sun-Strategy, recommended_plants als grüne Pills (bis 18), container_types, best_for_swiss_cities, pro_tips + common_pitfalls als Listen. "Vorlage übernehmen"-Button gsBalconyAdoptTemplate erstellt garden_plan mit plan_intent='container_balcony' + allPlants flat aus recommended_plants jsonb + metadata.balcony_template_slug/size/orientation. 4 neue Functions: gsBalconyWizardChanged / gsBalconyWizardSearch / gsBalconyTemplateOpen / gsBalconyAdoptTemplate. 7/7 node --check OK.
   v26.45 — Indoor-Pflanzen-Sub-Tab (AUFTRAG_v26.45, DB-Wave-13 indoor_houseplants 20 Eintraege): 10. Wissen-Sub-Tab "🪴 Zimmer". configs[indoor] table=indoor_houseplants order=difficulty,common_name_de. categoryField=light_requirement (Filter-Pills nach Lichtbedarf). Card-Accent rot bei toxic_to_pets ODER toxic_to_children, gruen bei air_purifying, hellgruen bei einfacher difficulty. Card-Sub mit scientific_name + Licht-Icon + difficulty + 🚫 Pet-Tox + 🌬 Luft-Badges. Neuer _gsWave9RenderIndoor Detail-Modal: Bei isPetTox/isChildTox roter Banner ZUERST mit konkreten Warnings + tel:145. Bei Air-Purifying gruener "NASA-Studie"-Banner. 2x2-Grid Pflege-Profil (💡 Licht / 💧 Gießen / 🌡 Temp / 💨 Feuchte). Badges (difficulty + origin_region + growth_speed + mature_size). Description. fertilizer_schedule (grün) + repotting_frequency (braun) + Topf-Material. Vermehrung (cyan). common_problems + pest_susceptibility als List-Sections. Pro-Tips grün. Pet-Warning-Disclaimer prominent bei toxic. 1 neue Function: _gsWave9RenderIndoor. 7/7 node --check OK.
   v26.44 — Forest-Garden Designer (AUFTRAG_v26.44, forest_garden_design 8 Designs aus DB-Wave-13): Neuer Garten-Aktion-Button "🌳 Forest-Garden planen · 7-Schichten + 8 Vorlagen" (Gradient #33691e→#1b5e20). Modal #modal-forest-garden mit Intro + Filter-Pills nach design_type (food_forest_zone / beerenstrauch_etage / wildhecken_garten / pilz_etage / wein_etage) + Card-Liste mit difficulty-Emoji (🟢 einfach / 🟡 mittel / 🔴 fortgeschritten) + Size-Range + Setup-Years + Yield + CHF-Cost + Description. Click → Detail-View. Detail mit 7-Schichten-SVG-Diagramm: vertikale Rects mit Schicht-Farbe (Canopy #1b5e20 oben → Wurzel #6d4c41 unten + Pilz-Etage #4a148c). Opacity 0.92 bei Schicht mit Daten, 0.4 bei leerer Schicht. Pro Schicht: Label + Beschreibung + Pflanzen-Pills in Schicht-Farbe. Eckdaten-Pills (Yield + Cost + Maintenance + Maturity). Pro-Tips (grün) + Common-Pitfalls (rot). Meta-Zeile (Klima-Zonen + Slope + Wasser-Management + Nutztiere). "Plan übernehmen"-Button erstellt garden_plan mit plan_intent='permaculture_hugel' + allPlants aus allen Layern + metadata.forest_design_slug. 30min Cache. 6 neue Functions: openForestGardenModal / gsForestLoad / gsForestRender / gsForestSetFilter / gsForestOpenDetail / gsForestBackToList / gsForestAdoptPlan. 7/7 node --check OK.
   v26.43 — Alpenpflanzen-Sub-Tab (AUFTRAG_v26.43, DB-Wave-13 alpine_garden_plants 12 Eintraege inkl. Eisenhut TOEDLICH): 9. Wissen-Sub-Tab "🏔️ Alpen". configs[alpen] table=alpine_garden_plants order=altitude_m_min,common_name_de. Card-Accent rot bei warnings='tödlich' ODER slug indexOf 'eisenhut' (Eisenhut-Lebensgefahr prominent), orange bei protected_species, gelb bei red_list 'gefährdet/verletzlich'. Card-Sub mit scientific_name + Höhenband (m) + 🔒-Icon bei protected + 🇨🇭-Flag bei swiss_native. Neuer _gsWave9RenderAlpine Detail-Modal: Toedlich-Banner mit tel:145 ZUERST bei toxic. Schutz-Banner orange bei protected (NHG-Hinweis). Höhenband als grosser blauer Badge prominent. Badges (CH-heimisch + habitat_type + Rote-Liste-Status + cultivation_difficulty). Eckdaten kompakt (Exposition/Wasser/pH/Boden/Härtegrad). Wuchsform (Höhe/Breite/Blütezeit/Blütenfarbe). Garten-Eignung gruen + Steingarten-Rolle braun. Kultivierungs-Notizen cyan. Companion-Plants. Warnungen prominent rot bei toxic, orange sonst. Schutz-Disclaimer lila bei protected. 1 neue Function: _gsWave9RenderAlpine. 7/7 node --check OK.
   v26.42 — Vogel-Garten Sub-Tab + bird_friendly plan_intent (AUFTRAG_v26.42, DB-Wave-12 garden_birds_register 19 Eintraege): 8. Sub-Tab "🦜 Vögel" im Wissen-Tab aktiviert (configs[voegel] + _gsWave9RenderBird bereits in v26.38 als forward-compat enthalten). Sort by status_in_ch (gefährdete zuerst). Card-Accent rot bei "vom aussterben/stark gefährdet", orange bei "verletzlich/gefährdet", gelb bei "potentiell/nahezu gefährdet". Detail-Modal: Status-Banner bei red_list_status. Lockpflanzen (gruen) + Futter (gelb) + Futterhaus-Körner (orange) als Listen. Birdhouse-Type-Box mit Lage. attracting_tips als prominente Bird-Friendly-Garten-Box. Bedrohungen-Liste. Fun-Fact. Plus: KI-Planer-Plan-Typ-Picker um 5. Option "🦜 Vogel-Garten" erweitert (bird_friendly intent). Bei Auswahl gruene Hint-Box "KI empfiehlt Hecken, Beerensträucher und Wildkräuter-Ecken — wenig Rasen, viel Vielfalt". Result-Preview intentLabelMap + bird_friendly Badge. Plant-Liste mit birdTag forward-compat: pl.bird_tags Array → "🦜 Lockt: Amsel, Rotkehlchen…" ODER bei isBirdFriendly + pl.attracts_birds/bird_friendly=true → "🦜 Vogel-freundlich". Cowork-Ergänzung garden-scan-analyze v4 mit plan_intent='bird_friendly' wird das nutzen. 7/7 node --check OK.
   v26.41 — Wassergarten-Sub-Tab aktiviert (AUFTRAG_v26.41, DB-Wave-12 water_features 24 Eintraege): 7. Sub-Tab "💧 Wassergarten" im Wissen-Tab. configs[wasser] + _gsWave9RenderWater bereits in v26.38 als forward-compat enthalten — jetzt nur HTML-Tab-Button aktiviert. Filter-Pills nach feature_type (Distinct: teichpflanze / schwimmpflanze / unterwasserpflanze / teich_design / wassertier). Card-Accent rot bei invasive_in_ch / blau bei teich_design / gruen bei swiss_native. Detail-Modal: bei invasive → rotes Lebensgefahr-aehnliches Banner "⛔ INVASIV in CH". Header-Gradient nach Type. Badges (CH-heimisch + Sauerstoff + Wasser-Filtration + Tiere + CHF-Kosten). Wasser-Tiefe + Licht + Hardiness-Zone + Höhe-über-Wasser + Spreading. Blütezeit + Farbe. best_paired_with (gruen) + do_not_pair_with (rot) Listen. Kultivierungs-Tipps + Warnungen. Bei teich_design: CH-Recht-Hinweis (Bewilligung). 7/7 node --check OK.
   v26.40 — Companion-Lookup via View (AUFTRAG_v26.40 / Bonus B-B): Im Plan-Detail-Modal (gsGardenScanShowPlant) wird zusaetzlich zur v26.24 Pest-Box ein async-Block geladen mit Top-3 'gute Nachbarn' + Top-2 'schlechte Nachbarn' aus v_commonion_lookup View (Cowork-Backend). Vereinfacht die alte OR-Logik (species_a/species_b in companion_plants_full) auf 1 GET-Query pro Pflanze. Render: 2 Boxen (gruen + rot) mit partner_lat + confidence-Badge (Prozent) + reason + effect_on_self. 15min in-Memory-Cache pro species_lat. Order by confidence DESC limit 20 → client-side split gut/schlecht. Neuer Mount-Slot #ai-plant-companions-block-<idx> ZWISCHEN den Pflanzen-Daten und der v26.24 Pest-Box (gleicher async-Aufruf-Pattern wie gsLoadPestsForPlanPlant). 1 neue Function: gsLoadCompanionsForPlanPlant. 7/7 node --check OK.
   v26.39 — Mushroom-Saison-Widget Home (AUFTRAG_v26.39 / Bonus B-A): Neues #mushroom-season-card auf Home (lila Gradient #4a148c→#6a1b9a) zwischen Wisdom-Card und Quiz. Query mushroom_seasonal_patches mit best_months=cs.{currentMonth} + region_canton_codes=ov.{userCantons} via gsGetRegionContext (Fallback: alle Patches des Monats ohne Region-Filter). Day-of-year deterministisch (day % length) eine Patch pro Tag. 6h in-Memory-Cache pro region+month key. Render: Header mit Schwierigkeit-Badge (🎯), Region+Monat+Forest-Type Line, Liste typischer Pilze (titlecased aus typical_mushrooms Array, Top-5) in Playfair-italic, Wetter-Trigger-Box (🌧), VAPKO-Kontrollstelle mit tel-Link prominent, 2 Action-Buttons (🔍 Pilz-Scanner öffnet existing openMushroomModal · 🗓 Region wechseln öffnet openRegionalCalendarModal). Auto-Load 500ms nach Home-Mount. 2 neue Functions: gsLoadTodaysMushroomSeason / gsRenderMushroomSeason. 7/7 node --check OK.
   v26.38 — Mushroom-Glossar Wissen-Sub-Tab (AUFTRAG_v26.38 / Bonus B-C): 6. Sub-Tab "🍄 Pilze" als Erweiterung der v26.23 Wave-9-Renderer. configs[]-Map um pilze erweitert (table=mushroom_register, order=edibility,common_name_de → toedlich zuerst). cardAccent rot (#b71c1c) bei toedlich, orange bei giftig, gelb bei bedingt_essbar, grün bei speisepilz. Neuer _gsWave9RenderMushroom Detail-Modal: gradient nach edibility (rot/orange/gelb/grün), Lebensgefahr-Banner mit tel:145 ZUERST bei toedlich/giftig. Badges (Edibility-Pill + VAPKO + protected_status). Habitat/Symbiose/Saison/Höhe. Identifying-Features-Box (gelb). Morph kompakt (Hut/Lamellen/Sporen/Stiel/Geruch/Geschmack). Bei Gift: toxic_compounds + symptoms_if_toxic + emergency_action prominent rot. Bei Speisepilz: cooking_preparation + conservation_methods. Async-Sub-Load _gsMushroomLoadDetailExtras: (a) Lookalikes bidirektional via .or(edible_slug.eq.,lookalike_slug.eq.) mit risk-Badge (hoch=rot/mittel=orange/niedrig=oliv) + visual/smell/habitat/spore/pro_tip; (b) bei isEdible Rezepte via primary_mushroom_slugs=cs.{slug}. Neue gsMushroomRecipeOpen-Funktion für mushroom_recipes Detail (Header gradient + Zutaten/Steps/Methode/Pairing/Tradition). VAPKO-Footer immer prominent. 4 neue Functions: _gsWave9RenderMushroom / _gsMushroomLoadDetailExtras / gsMushroomRecipeOpen + erweiterte gsWave9OpenDetail-Dispatch. Auch _gsWave9RenderWater + _gsWave9RenderBird bereits enthalten als forward-compat für v26.41/v26.42 (Tabs erst dort). 7/7 node --check OK.
   v26.37 — Pollinator-Garten-Modus (AUFTRAG_v26.37): KI-Planer-Wizard bekommt Plan-Typ-Picker mit 4 Optionen (🥕 Selbstversorgung default / 🐝 Bienen-Garten / 🌳 Permakultur-Hügel / 🪴 Container-Balkon). 2x2-Grid mit Active-State (#2e7d32 bg). Click → gsGardenScanSetIntent updated window._gsGardenScan.metadata.plan_intent + Refresh. Bei pollinator zusätzlicher gelber Hint-Box: "KI bevorzugt Pflanzen mit hoher ecological_value für Bestäuber". gsRunGardenScan body.metadata.plan_intent defaultet auf self_sufficiency wenn unset. Result-Preview Header zeigt Intent-Badge (z.B. "🐝 Bienen-Garten"). Plant-Liste forward-compatible: zeigt "🐝 Bevorzugt von: Honigbiene, Hummel, Schwebfliege" wenn Backend v3 pl.pollinator_tags liefert, sonst "🐝 Hoher Bestäuber-Wert" wenn isPollinator + pl.ecological_value >= 7. 1 neue Function: gsGardenScanSetIntent. Cowork-Ergänzung garden-scan-analyze v3 mit System-Prompt-Erweiterung wird separat geliefert. 7/7 node --check OK.
   v26.36 — Marketplace Pestizid-frei-Filter (AUFTRAG_v26.36): Migration v26_36_marketplace_pesticide_free applied (ALTER TABLE marketplace_listings ADD organic_certified bool default false + pesticide_free bool default false + certification_label text + 2 partial indexes). Frontend: Bio + Pestizid-frei Checkboxen in beiden Listing-Forms (submitListing-Modal #modal-new-listing UND saveListing-Modal). Bei Bio-Aktivierung erscheint Cert-Label-Dropdown (Knospe / EU-Bio / Demeter / Naturland / Bioland / Sonstiges). loadMarketFromSupabase mappt jetzt organic_certified + pesticide_free + certification_label aus v_marketplace_listings View. renderMarket-Cards bekommen Bio-Badge (#e8f5e9/#1b5e20 mit "🌱 Bio (Knospe)") UND Pestizid-frei-Badge (#fff8e1/#bf360c "🚫 Pestizid-frei", nur wenn nicht Bio). 2 Filter-Pills "🌱 Bio-zertifiziert" + "🚫 Pestizid-frei" oberhalb Listings — click toggelt gs_market_filter_organic/_pestfree localStorage. Pestizid-frei-Filter zeigt auch Bio (da Bio implies pestfree). gsMarketResetFilter clearedt auch die 2 neuen Toggles. 2 neue Functions: gsMarketFilterOrganic / gsMarketFilterPestfree. saveListing PATCHt nach POST die 3 Spalten (Edge-Fn marketplace-publish kennt sie noch nicht). 7/7 node --check OK.
   v26.35 — Bauernregel des Tages (AUFTRAG_v26.35): Neues Home-Widget #wisdom-card zwischen "Wusstest du?" und "Schnell-Quiz". Daily-Rotation aus traditional_garden_wisdom mit applicable_months=cs.{currentMonth} Filter (Fallback alle Regeln). Day-of-year deterministisch (day % data.length). 12h in-Memory-Cache. Click → gsShowNextWisdom rotiert mit Fade. Validity-Badge mit 4 Farben: wissenschaftlich_bestaetigt=🟢 grün (#c8e6c9), tendenziell_richtig=🟡 gelb (#fff9c4), umstritten=🟠 orange (#ffe0b2), aberglaube_widerlegt=🔴 rot+"Mythos"-Label (#ffcdd2). Render zeigt saying (Playfair italic), Region + saying_dialect, meaning (📖 Bedeutung), modern_take (🔬 Modern in cream-Box). Auto-Load 400ms nach Home-Mount. 3 neue Functions: gsLoadTodaysWisdom / gsRenderWisdom / gsShowNextWisdom. 7/7 node --check OK.
   v26.34 — Garten-Tagebuch UI-Form (AUFTRAG_v26.34): Neuer Garten-Aktion-Button "📔 Tagebuch-Eintrag · 11 Typen + Saison-Stats" (Gradient #558b2f→#33691e). Modal #modal-diary-entry mit 2 Tabs (➕ Neuer Eintrag | 📊 Saison-Statistik). Type-Picker als 2-Spalten-Grid für alle 11 GS_DIARY_TYPES (general/pest_observation/disease/harvest/sowing/fertilization/pruning/watering/medicinal_harvest/seed_collection/flowering). Conditional Fields pro Type: Species-Picker aus myPlants (harvest/sowing/medicinal_harvest/seed_collection/pruning/flowering/disease), harvest_kg (harvest/medicinal_harvest), pest_slug + Tipp-Box auf Pest-Scanner (pest_observation), fertilizer + water_liter + disease in metadata-Felder. Photo-Upload (8MB cap, b64 in metadata bis Storage-Upload). Common: Titel + Notiz (800 chars). gsDiarySubmitEntry POSTet via gsDiaryAddEntry → garden_diary. Stats-Tab: Header mit total-Count, Ernte-Total-kg-Card + Top-5 Pflanzen, Pest-Count, Per-Type-Liste sortiert. 8 neue Functions: openDiaryEntryModal/gsDiarySwitchTab/gsDiaryRenderTypePicker/gsDiarySetType/gsDiaryRenderConditional/gsDiaryLoadPhoto/gsDiarySubmitEntry/gsDiaryRenderStats. 7/7 node --check OK.
   v26.33 — Pilz-Scanner (AUFTRAG_v26.33, sicherheitskritisch): neue Edge-Fn mushroom-identify v1 (verify_jwt:true) mit Anthropic Vision Haiku 4.5 + mushroom_register-Knowledge-Context (20 Pilze: 5 toedlich/2 giftig/13 essbar+bedingt, VAPKO-Klassen). Frontend: 4. Scan-Modus "🍄 Pilz-Scanner" Garten-Aktion-Button (violetter Gradient #6a1b9a→#4a148c) + Modal mit prominentem Tox-Info-145-Disclaimer + Habitat-Picker (7 Typen) + 8MB Foto-Upload. gsMushroomRunScan POST mit image_base64+habitat_hint+region_slug. gsMushroomRenderResult mit safetyMap (red=TÖDLICH/GIFTIG, orange=BEDINGT_ESSBAR, yellow=VORSICHT, green=Speisepilz aus v_mushroom_safety View). Bidirektionale Lookalikes-Rendering mit confusion_risk-Badge (hoch=rot/mittel=orange/niedrig=oliv) + visual/smell/spore_print/pro_tip. VAPKO-Box mit Kontrollstelle/Telefon-tel-Link aus user-region. Bei m.edibility ∈ {toedlich,giftig}: gsShowMushroomDangerOverlay() = position:fixed inset:0 z:99999 #b71c1c-Vollbild mit gs-mushroom-pulse-keyframe-Animation, ☠️-Icon, "TÖDLICH GIFTIG"/"GIFTIG" Headline, KI-Match-Name + scientific_name, NICHT-ESSEN-Warning, "☎️ Tox-Info: 145"-tel-Link-Button (full-width, white-on-red), "Verstanden — Details anzeigen"-Dismiss. Plus Bottom-Result-Card mit symptoms_if_toxic + emergency_action + 145-Footer. Speisepilz-Pfad: cooking_preparation + conservation_methods. Footer-Disclaimer "KI ersetzt KEINE VAPKO". Confidence < 60 → "UNSICHER" gelbe Warn-Box statt false-positive. 7/7 node --check OK.
   v26.32 — Garten-Tagebuch v2 (AUFTRAG_v26.32): Migration v26_32_garden_diary_v2_kategorien applied — entry_type (check 11 values) + pest_slug (FK plant_pests) + species_lat + harvest_kg + metadata jsonb. Plus idx_garden_diary_user_type_ts + idx_garden_diary_pest_slug. Bug-Fix bestehende v26.21+v26.29 Inserts (silent fail durch type/notes-Spalten die nicht existierten → korrigiert auf entry_type/text/tag). Neue Helper gsDiaryAddEntry generic + gsDiaryStats aggregiert harvest_kg/per_type/per_species fuer Saison-Statistik. GS_DIARY_TYPES-Map mit 11 emoji+label+tag definitions.
   v26.30 — Samen-Gewinnung-Wissen (AUFTRAG_v26.30): 5. Sub-Tab im Wissen-Bereich (🌰 Samen ernten) als Erweiterung der v26.23 Wave-9-Renderer. configs[]-Map um 'samen' erweitert (seed_saving_methods, 12 Eintraege, Order difficulty+plant_name_de, Card-Sub mit pollination_type + isolation_distance + viability_years, Card-Accent rot bei Cucurbita-Kreuzung). _gsWave9RenderSeedSaving Detail-Modal mit WICHTIG-Warning ZUERST (Cucurbita), Badges (Bestäubung/Isolation/Keimfähigkeit/Schwierigkeit/Sortenstabilität), Ernte-Timing + Reife-Zeichen, Extraktion + Reinigung + Trocknung, Lagerung-Box mit Temp/Feuchte/Behälter, Schweizer Rechtslage + Kulturelle Bedeutung.
   v26.29 — Duengeplan-Coach (AUFTRAG_v26.29) + Beet-Layout-Designer (AUFTRAG_v26.31, bundled): 2 neue Garten-Aktion-Buttons. Duengeplan: Modal mit Pflanzen-Picker, auto-select bei myPlants-Match, Phasen-Liste aus fertilization_schedules mit NPK-Focus, Bio + Mineral-Optionen, Dosis (g/m² + ml/l), Frequenz, Kosten CHF, Warnungen, organic_certified Badge. "Erledigt"-Button pro Phase → garden_diary (type=fertilization). Layouts: 10 Vorlagen aus garden_layouts mit Filter-Pills (layout_type + Anfaenger-Toggle). Detail-Modal mit plant_combinations (jsonb array/object), rotation_plan (jsonb Jahr→Pflanzen), pro_tips (gruen), common_pitfalls (rot).
   v26.28 — KI-Planer Region-Wiring (AUFTRAG_v26.28): gsRunGardenScan body.metadata bekommt async region_slug (via gsGetRegionContext aus v26.27) + soil_type/soil_ph (aus localStorage gs_soil_profile von v26.25). Backend garden-scan-analyze v2 nutzt das fuer Frost-Constraints + best_vegetables + Boden-Empfehlungen im System-Prompt. plan-iterate v2 lest die region_used aus garden_plans-Record (automatisch region-aware bei Iterationen).
   v26.27 — Regional-Calendar (AUFTRAG_v26.27): neuer Garten-Aktion-Button "🗓️ Regional-Kalender" + Modal mit 7-CH-Hoehenzonen-Picker aus regional_garden_calendars. Wahl persistiert in localStorage gs_region. Render: aktueller Monat prominent in oranger Box (12 Monats-Tasks), best_vegetables (gruen), challenging_plants (orange), 12-Monats-Accordion (current open, andere collapsed). gsGetRegionContext() API fuer KI-Planer-Integration (kann last_frost_avg, growing_season_days, monthly_tasks als Constraint nutzen).
   v26.26 — Heilpflanzen-Profile (AUFTRAG_v26.26): openDetail Pflanzen-Detail-Modal bekommt async geladenen Heilpflanzen-Block falls sp.lat in medicinal_plants_register existiert. gsLoadMedicinalProfile mountet eine groessere gruene Section am Ende des existing Modals mit Badges (Evidenz/CH-heimisch/geschuetzt), dann ZUERST prominent rote Kontraindikationen + orange Wechselwirkungen + gelbe Toxizitaet, dann Verwendung (Pflanzenteile/Wirkstoffe/traditionelle vs evidenzbasierte Anwendung/Zubereitung/Dosierung/Erntezeit/Rechtslage), Footer-Disclaimer. Backwards-compat: keine Section wenn kein Match.
   v26.25 — Bodenverbesserer-Recommender (AUFTRAG_v26.25): Garten-Aktion-Button "🪨 Boden verbessern" + Modal mit pH/Bodenart/Goal Pickers + scoring (50 pH-Match, 18 Type-Match, 25 Goal-Match, 8 Universal). Top-5 aus 15 CH-Bodenverbesserern. Profil in gs_soil_profile localStorage gecached + bei naechstem Open vorausgefuellt. Detail-Modal nutzt v26.23 _gsWave9RenderSoilAmend.
   v26.24 — Pest-Filter im KI-Planer (AUFTRAG_v26.24): gsGardenScanShowPlant Detail-Modal bekommt async geladenen Block mit Top-3 Schaedlingen (plant_pests via host_plants @> [species_lat]) + Companion-Plant-Vorschlaegen (pest_companion_plants via effective_against-Overlap). Severity-Dots + Praevention + Bio-Behandlung pro Pest. "🪲 Schaedling fotografieren"-CTA oeffnet existing v26.21 Pest-Scanner-Modal.
   v26.23 — Wissen-Tab Erweiterung (AUFTRAG_v26.23): 4 neue Sub-Tabs aus DB-Wave-9. Kompostieren (8 Methoden), Vermehrung (12 Methoden), Boden-Pflege (15 Bodenverbesserer), Heilpflanzen (15 CH-Heilpflanzen). gsRenderWissenWave9 generic Renderer mit Filter-Pills (Kategorie-Distinct + Counts) + Card-Liste. gsWave9OpenDetail dispatch zu 4 spezifischen Render-Funktionen (_gsWave9RenderCompost/Propagation/SoilAmend/Medicinal). Heilpflanzen-Renderer mit PROMINENT (rot/orange) Kontraindikationen + Wechselwirkungen + Toxizitaet + Disclaimer-Footer (rechtssicher). 10min in-Memory-Cache pro Section.
   v26.22 — AR-View MVP (AUFTRAG_CODE_v26.18). Three.js-basierter 3D-View fuer 30 Seed-Pflanzen aus ar_models. Da gltf_url=NULL: Fallback-Geometrie (Stamm-Zylinder + Krone-Sphere mit verjuengter Form je nach Hoehe: flach fuer Kraeuter <40cm, Standard-Strauch, vergroessert fuer Baeume >3m). 30 species-spezifische Krone-Farben (Tomate rot, Lavendel violett, Sonnenblume gelb, etc.). _gsARInitScene mit HemisphereLight + DirectionalLight + Shadow-Map + eigener Drag/Pinch/Wheel-Pointer-Logic (statt OrbitControls — spart externe Abhaengigkeit). _gsARDispose disposed Geometries/Materials/Renderer beim Modal-Close (Memory-Leak-frei) via closeModal-Hook. Three.js lazy via existing _gsLoadThree() aus /assets/three.min.js (v25.36).
   v26.21 — Schaedlings-Scanner (AUFTRAG_CODE_v26.19). Neue Edge-Fn pest-identify v1 (verify_jwt:true) mit Anthropic Vision Haiku 4.5 + plant_pests-Knowledge-Context (25 Schweizer Schaedlinge mit Bio-Behandlung + Praevention + natuerliche Feinde, AGFF-Source). Frontend: neuer Garten-Aktion-Button "🪲 Schaedling-Scanner" + Modal mit Foto-Upload (Kamera/Galerie) + optionalem Host-Pflanze-Picker aus myPlants. gsPestRunScan POSTet zu Edge-Fn, gsPestRenderResult zeigt Match mit Confidence-Badge (3 Stufen Gering/Mittel/Hoch), Symptome, Bio-Behandlung, Praevention, natuerliche Feinde + Alternative-Kandidaten. Confidence < 40 zeigt "bitte naeher"-Hint statt false-positive. "📓 Im Garten-Tagebuch festhalten"-Button insertet in garden_diary.
   v26.20 — i18n Frontend-Switcher (AUFTRAG_CODE_v26.20). gsI18n erweitert: neuer loadFromDb(lang) Direct-PostgREST-Pull aus i18n_translations (1 GET-Query, 0 Anthropic-Calls; viel schneller als gsBuildI18n weil Edge-Fn-Cache-Miss-Path entfaellt). 24h-TTL pro Sprache via bundleTs-Map. Boot-Auto-Build: bei detectLang()!=de UND isStale(lang) wird Bundle async beim DOMContentLoaded geladen + applyToDOM erneut. openModal-Hook (idempotent) ruft applyToDOM auf jeden neu geoeffneten Modal damit dynamische Inhalte uebersetzt sind. gsHandleLangChange nutzt Fast-Path loadFromDb zuerst, Fallback auf gsBuildI18n nur bei DB-Pull-Fehler. FR/IT/GSW-User sehen jetzt schon beim Erst-Visit ihre Sprache.
   v26.16 — Cache-Inkonsistenz-Fix: _headers HTML-Shell mit max-age=0,must-revalidate (Cloudflare-Default war cache → User sahen alten GS_VERSION nach Push). Plus /assets/* + /data/* mit max-age=31536000 immutable (versioned URLs). sw.js wird bei v-Bump automatisch revalidated. Reduziert Cache-Drift zwischen Browser-Cache und Live-Deploy.
   v26.15 — User-friendly Release-Notes Vollausbau (v26.2-Sprint)
   v26.14 — i18n Pass-3 Tooling (v26.8-Sprint). Inventory-Script extrahiert 235 unique Translation-Keys aus index.html (218 data-i18n + 18 gsI18n.t + GS_I18N_JS_STRINGS-Map). Bulk-Translate-Skript scripts/i18n_translate.sh ruft i18n-translate Edge-Fn chunk-weise (10 keys, 8s sleep) gegen Anthropic Rate-Limit. gsI18n.coverage() DevTools-Helper + window.gsI18nCoverage() Shortcut fuer Cowork-Verify nach Bulk-Translate. Tatsaechliches FR/IT-Backfill ist Cowork-Pflicht (braucht SERVICE_ROLE_KEY + DB-Diff SELECT-Query).
   v26.13 — Trial-End-Reminder (v26.7-Sprint). Backend daily-push-checker v3 mit notifyTrialEndingSoon (Subs mit trial_end in 24-25h, dedup via push_send_log unique-index Migration 20260521_push_dedup.sql). Frontend gsCheckTrialEnding pruft alle 4.5s nach Boot wenn eingeloggt — bei <36h Trial-Rest zeigt es einen orange In-App-Banner ueber der Bottom-Nav mit "Verlaengern"-CTA zu gsShowAboScreen. sessionStorage-Guard pro Trial-End-Datum verhindert Mehrfach-Show. URL-Handler ?open=abo oeffnet Abo-Modal nach Push-Click.
   v26.12 — Marketplace-Connect Frontend (v26.6-Sprint, GS_VERSION-Bump erfolgt zu v26.12 weil Cowork v26.1-v26.11 lokal vorgebaut hat). Settings-Row "Verkaeufer-Konto verbinden" + 5 Functions (gsMarketplaceLoadStatus, gsMarketplaceRefreshSettingsRow, gsMarketplaceOpenSellerScreen mit 4 Statusansichten Pending/Active/Restricted/Disabled, gsMarketplaceStartConnect ruft stripe-create-connect-account Edge-Fn, gsMarketplaceOpenStripeDashboard) + URL-Handler ?marketplace_done=1/?marketplace_refresh=1. Backend-Files in supabase/migrations/20260520_marketplace_sellers.sql + supabase/functions/stripe-create-connect-account/index.ts. Cowork deploys via Supabase MCP. Bundled mit dem ungepushten lokalen v26.11 Performance-Pass (preconnect/dns-prefetch/_gsAutoLazyImg) und v26.1-v26.5 (Karten-Reparatur, A11y Auto-Labeler, Maxlength, Z-Index, Console-Cleanup).
   v26.11 — Performance-Pass: preconnect zu Supabase/Fonts, dns-prefetch Anthropic+Stripe, prefetch three.min.js, leaflet.js mit defer (kein Boot-Block — gsLoadLeaflet pollt eh). _gsAutoLazyImg patcht alle <img> ausser Top-4 LCP-Kandidaten auf loading=lazy + decoding=async + fetchpriority=low. Erwarteter LCP-Boost +20-40%.
   v26.5 — Console-Cleanup _gsConsoleCleanup: silent no-op fuer console.log/debug/info in Production (Host !localhost UND nicht ?gs_debug=1 UND nicht localStorage.gs_debug=1). console.warn/error/trace bleiben aktiv. window.gsConsoleRestore() schaltet ad-hoc ein. Reduziert Noise + PII-Leakage + DevTools-Render-Cost. 80 Boot-Logs (72 log + 4 debug + 4 info) werden silent ohne dass einzelne Calls geaendert werden mussten.
   v26.4 — Auto-Maxlength + Z-Index-Tokens. _gsAutoMaxlength scannt alle <input>/<textarea> ohne maxlength und setzt sinnvolle Limits via Placeholder/Name-Heuristik (name=80, search=100, email=254, code=16, textarea_default=500, feedback/share=2000). MutationObserver wie bei v26.3. Plus :root CSS-Tokens --z-base/sticky/dropdown/overlay/modal/toast/tooltip/whatsnew/critical fuer kuenftige Layer.
   v26.3 — A11y Auto-Labeler: 78 Icon-only Buttons (×, 🗑️, ★, ➤, ❤, 💬, ↑, ＋, 📷 etc.) bekommen automatisch aria-label via Boot-Scan + MutationObserver fuer dynamisch gerenderte Modals. Screen-Reader-friendly (NVDA/VoiceOver/TalkBack) ohne 78 manuelle HTML-Edits. EMOJI_LABELS-Map mit ~40 Symbol→Text-Mappings. Defensive: skipt Buttons mit aria-labelledby oder echtem Text-Content.
   v26.1 — Karten-Reparatur + User-friendly Release-Notes. Karte: Tile-Error-Auto-Fallback (Swisstopo→OSM nach 5 Fehlern in 10s), localStorage-Persistenz der Layer-Wahl, CSP um wmts.geo.admin.ch + opentopomap + arcgisonline + fastly.net erweitert. GS_RELEASES bekommt user_summary + user_items fuer Nutzer-Whats-New (technische items bleiben fuer Devs). Pro-only Restructure aus v25.38 bleibt aktiv.
   v25.38 — Pro-only Restructure (Backend hat Plus-Plans deaktiviert + Plus-Lifetime in Pro Lifetime umbenannt). Frontend: gsShowFirstTrialModal mit 3 Buttons (Pro Lifetime / Pro Monthly 7d-Trial / Free), gsShowAboScreen vereinfacht (freeCard + proCard + lifeCard statt 4 Karten), GS_PRICE_CATALOG auf 3 Pro-Eintraege gekuerzt, planName in gsRenderSubInfo immer "Pro", Empty-State CTA "Pro 7 Tage gratis testen", gsStartCheckout-Default = pro_monthly. Legacy plus/premium-Subs bleiben als isPaid backwards-compat.
   Strategien:
     • App-Shell (HTML/CSS/JS): Network-First mit Cache-Fallback → offline.html
     • Statische Assets (icons/fonts/manifest): Cache-First
     • API/Supabase: Network-Only (Offline-Engine queued)
     • Bilder/Fotos: Stale-While-Revalidate
     • Periodic-Sync: 12h-Update-Pull
     • Background-Sync: Tag „gs-sync-pending" (Queue-Flush)
   ──────────────────────────────────────────────────────────── */
'use strict';

const VERSION = 'gs-v26.80';
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const IMAGE_CACHE = `${VERSION}-images`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

// App-Shell: kritische Dateien — werden bei install vorgecached
const SHELL_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
  '/icons/favicon-16.png',
  '/icons/shortcut-scanner.png',
  '/icons/shortcut-garden.png',
  '/icons/shortcut-quiz.png',
  '/icons/shortcut-knowledge.png',
  // v25.10 Thema 3: PLANT_DB extern (4341 Arten, immutable-cached). Vor-Cachen
  // damit App offline mit voller Pflanzen-DB funktioniert (sonst nur leere DB).
  '/data/plants.v1.js?v=1',
  // v25.36 SELF-HOST: vorher unpkg.com fuer Leaflet+Three (siehe v25.9 Comment
  // im git log) — Cowork hat live verifiziert dass unpkg vom Browser onerror
  // returns. Jetzt aus eigenem /assets/-Ordner: kein CDN-Race, kein CSP-Issue,
  // garantiert im Shell-Cache nach Install. Repo waechst ~770 KB.
  '/assets/leaflet.js',
  '/assets/leaflet.css',
  '/assets/three.min.js',
  '/assets/leaflet-images/marker-icon.png',
  '/assets/leaflet-images/marker-icon-2x.png',
  '/assets/leaflet-images/marker-shadow.png',
  // pdf.js bleibt CDN (1.5MB zu gross fuer das Repo, wird nur fuer PDF-Export
  // genutzt — nicht kritisch fuer Karte/3D-Render).
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs'
];

// Domains, die NIE gecached werden (immer Network)
const NEVER_CACHE_HOSTS = [
  'supabase.co',
  'supabase.in',
  'api.anthropic.com',
  'api.stripe.com',
  'js.stripe.com',
  'm.stripe.network',
  'open-meteo.com',
  'api.open-meteo.com',
  'ipapi.co',
  'tile.openstreetmap.org',
  'plausible.io',
  'analytics.google.com'
];

// Bild-Hosts: Stale-While-Revalidate
// v25.36 SELF-HOST: unpkg.com entfernt — Leaflet+Three sind jetzt /assets/-lokal.
const IMAGE_HOSTS = [
  'fonts.gstatic.com',
  'fonts.googleapis.com',
  'cdnjs.cloudflare.com'  // bleibt fuer pdf.js
];

// ─── INSTALL ─────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Install', VERSION);
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => {
        // addAll fails atomically — wenn auch nur eine URL nicht cached → komplett fail
        // → wir nutzen stattdessen einzelne add() mit catch, damit fehlende Dateien
        // den Install nicht blockieren (Robustheit > Vollständigkeit)
        return Promise.all(
          SHELL_URLS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('[SW] Shell-Cache fehlgeschlagen für:', url, err.message);
            })
          )
        );
      })
      .then(() => self.skipWaiting()) // Aktiviere SW sofort, ohne reload zu warten
      .catch((err) => console.warn('[SW] Install error:', err))
  );
});

// ─── ACTIVATE ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate', VERSION);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => {
          console.log('[SW] Lösche alten Cache:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim()) // Nimm sofort Kontrolle aller Tabs
  );
});

// ─── HELPERS ─────────────────────────────────────────────────
function isNeverCache(url) {
  try {
    const u = new URL(url);
    return NEVER_CACHE_HOSTS.some((h) => u.hostname.endsWith(h));
  } catch (e) { return false; }
}
function isImageHost(url) {
  try {
    const u = new URL(url);
    return IMAGE_HOSTS.some((h) => u.hostname.endsWith(h));
  } catch (e) { return false; }
}
function isImageRequest(req) {
  return req.destination === 'image' || /\.(png|jpg|jpeg|gif|webp|avif|svg|ico)(\?|$)/i.test(req.url);
}
function isFontRequest(req) {
  return req.destination === 'font' || /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(req.url);
}
function isHTMLNav(req) {
  return req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));
}

// Fetch-Strategien
async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.status === 200 && fresh.type !== 'opaqueredirect') {
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    // Final fallback für HTML-Navigation: index.html → offline.html
    if (isHTMLNav(req)) {
      const shell = await caches.open(SHELL_CACHE);
      const fallback = await shell.match('/index.html') || await shell.match('/');
      if (fallback) return fallback;
      // Last-Resort: dedicated offline.html mit nice UI
      const offlinePage = await shell.match('/offline.html');
      if (offlinePage) return offlinePage;
    }
    throw err;
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.status === 200 && fresh.type !== 'opaqueredirect') {
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then((res) => {
    if (res && res.status === 200 && res.type !== 'opaqueredirect') {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  }).catch(() => cached);
  return cached || fetchPromise;
}

// ─── FETCH ───────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Nur GET cachen (POST/PUT/DELETE direkt durchreichen)
  if (req.method !== 'GET') return;

  const url = req.url;

  // Skip: chrome-extension, data:, blob:
  if (!url.startsWith('http')) return;

  // 1. Never-cache hosts (Supabase, Anthropic, Stripe, Wetter, IP-Geo) → Network only
  if (isNeverCache(url)) return;

  // 2. App-Shell HTML-Navigation → Network-First (immer aktuell, bei offline aus Cache)
  if (isHTMLNav(req)) {
    event.respondWith(networkFirst(req, SHELL_CACHE));
    return;
  }

  // 3. Manifest + statische Skripte → Network-First (Updates wichtig)
  if (/\/(manifest\.json|sw\.js)$/.test(url)) {
    event.respondWith(networkFirst(req, STATIC_CACHE));
    return;
  }

  // 4. Bilder → Stale-While-Revalidate (schnell + Updates im Hintergrund)
  if (isImageRequest(req)) {
    event.respondWith(staleWhileRevalidate(req, IMAGE_CACHE));
    return;
  }

  // 5. Fonts → Cache-First (Fonts ändern sich selten)
  if (isFontRequest(req) || isImageHost(url)) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // 6. Default → Network-First mit Runtime-Cache
  event.respondWith(networkFirst(req, RUNTIME_CACHE));
});

// ─── MESSAGE-HANDLER ─────────────────────────────────────────
// Erlaubt der App, den SW zu steuern (skipWaiting, clearCaches)
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => {
          if (event.source) event.source.postMessage({ type: 'CACHES_CLEARED' });
        })
    );
  } else if (data.type === 'GET_VERSION') {
    if (event.source) event.source.postMessage({ type: 'VERSION', version: VERSION });
  }
});

// ─── PUSH-NOTIFICATIONS ──────────────────────────────────────
// Vorbereitung für künftige Web-Push-Reminder (Pflanzen-Pflege)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch (e) { payload = { title: 'GreenScan', body: event.data.text() }; }
  const title = payload.title || '🌱 GreenScan';
  const options = {
    body: payload.body || 'Du hast eine neue Benachrichtigung.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || 'greenscan',
    data: payload.data || {},
    actions: payload.actions || [],
    vibrate: [100, 50, 100],
    silent: false
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── NOTIFICATION-CLICK ──────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// ─── BACKGROUND-SYNC ─────────────────────────────────────────
// Tag 'gs-sync-pending' → flush Offline-Queue (Garten/Diary/Scans).
// Tag 'gs-sync-now' → force-flush (manuell triggered).
self.addEventListener('sync', (event) => {
  if (event.tag === 'gs-sync-pending' || event.tag === 'gs-sync-now') {
    console.log('[SW] sync event:', event.tag);
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        if (clients.length === 0) return;
        clients.forEach((c) => c.postMessage({ type: 'SYNC_PENDING', tag: event.tag }));
      })
    );
  }
});

// ─── PERIODIC-SYNC ───────────────────────────────────────────
// Tag 'gs-periodic-sync' → 12h-Pull (App-Shell-Refresh + Pflanzen-Reminder-Check).
// Nur Chrome Android wenn User Permission „granted" gibt (selten, aber wertvoll).
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'gs-periodic-sync') {
    console.log('[SW] periodic-sync event:', event.tag);
    event.waitUntil(
      Promise.all([
        // App-Shell refreshen (für Updates)
        caches.open(SHELL_CACHE).then((cache) =>
          fetch('/index.html').then((res) => {
            if (res.ok) return cache.put('/index.html', res);
          }).catch(() => {})
        ),
        // Frontend-Tabs benachrichtigen (Reminder/Sync)
        self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((c) => c.postMessage({ type: 'PERIODIC_SYNC' }));
        })
      ])
    );
  }
});

console.log('[SW] Loaded', VERSION);
