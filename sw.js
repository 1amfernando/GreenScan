/* ────────────────────────────────────────────────────────────
   GreenScan Service Worker
   v26.52 — Tox-Quick-Search Notfall-Banner (lebensrettender Frontend-Sprint): Notfall-Banner auf Home erweitert mit 2 tel-Links (☎ 145 Tox-Info + ☎ 144 Notruf) und 🔍 Tox-Suche-Button. Neues #modal-tox-search Modal mit Live-Suche durch 3 toxische DB-Tabellen (mushroom_register: edibility in (toedlich/giftig/bedingt_essbar/ungeniessbar), alpine_garden_plants: warnings IS NOT NULL, indoor_houseplants: toxic_to_pets OR toxic_to_children). 30min in-Memory-Cache. Fuzzy-Substring-Match in keywords. Severity-Sort: fatal → toxic → conditional → pet-child → inedible. Render mit Severity-Color (b71c1c-fatal/c62828-toxic/e65100-cond/bf360c-petchild), VAPKO-Klasse-Badge, Symptome + Notfall-Action, 145+144-tel-Links pro Card. 4 Schnellzugriff-Filter-Buttons (☠ Tödliche Pilze / ⚠ Eisenhut & Co / 🐾 Pet-Tox / 👶 Kind-Tox). KEIN Login + KEIN KI-Call erforderlich — pure DB-Lookup über sbFetch. Disclaimer-Box "Bei Verdacht IMMER 145 anrufen". 7 neue Functions: openToxQuickSearch / gsToxLoadCache / gsToxSearchRun / gsToxSearchExec / gsToxRenderCard / gsToxQuickFilter (+ internal debounce). 7/7 node --check OK.
   v26.51 — Backend-Security-Hardening + Frontend-Audit (Self-Audit-Sprint nach Supabase-Advisor-Findings): Migration v26_51_backend_security_hardening LIVE applied + v26_51b_lock_admin_only_functions. **14 SECURITY DEFINER Views → security_invoker=true** (v_ai_usage_summary, v_user_entitlements, v_marketplace_listings, v_mushroom_safety, v_companion_lookup, v_knowledge_search, v_harvest_stats_per_user, v_social_posts_with_verifications, v_cron_health, v_species_stats, v_my_marketplace_seller, v_knowledge_db_stats, v_ai_usage_weekly, v_ai_usage_monthly) — RLS wird jetzt wieder respektiert (war kritisch: jeder konnte über View Daten anderer User lesen). **feedback_votes RLS gehärtet** (war ALWAYS-TRUE auf INSERT/UPDATE/DELETE → jeder konnte fremde Votes manipulieren). Jetzt voter_key=auth.uid() OR anon-key only. **29 Indexes auf FKs** (Perf: ai_queries, garden_diary/harvests/plans/tasks, marketplace_listings, notifications, plant_diagnoses/doctor_history, push_send_log/subscriptions, quiz_answers/ranking, scan_corrections/events, sensor_alerts/readings, user_achievements/quest_progress/scans, friendships, post_comments). **6 Duplicate-Indexes gedroppt** (ai_daily_usage, garden_diary/harvests/plantings, species). **2 function_search_path_mutable fix** (update_expert_verif_timestamp, fn_normalize_species_cat). **4 admin-only Functions locked** (fn_assign_role, fn_cleanup_old_data, fn_set_global_api_key, is_admin_user) — REVOKE EXECUTE für anon/authenticated, GRANT für service_role. Frontend: alert() → gsToast für 4 user-facing Marketplace + Recipes Submit-Flows (Hard-Lesson #2 iOS-PWA safe). Supabase-Advisor-Diff: 14 ERROR + 84 WARN → 0 ERROR + 75 WARN. 7/7 node --check OK.
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

const VERSION = 'gs-v26.52';
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
