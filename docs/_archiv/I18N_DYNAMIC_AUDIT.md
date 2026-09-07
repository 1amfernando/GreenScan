# I18N_DYNAMIC_AUDIT — Unübersetzte dynamische Render-Strings (v28.48, 08.06.2026)

Read-only 9-Agenten-Workflow-Audit über ~45 dynamische Render-Funktionen in index.html.
**398 unübersetzte Strings** (von 399 geprüft). Sichtbarkeit: high 223 · med 151 · low 24.

Muster pro Sprint: lokaler `_t`-Guard am Funktionsanfang → Strings auf `_t('key','DE-Fallback')` → Keys in `GS_I18N_JS_STRINGS` registrieren → Edge-Fn `i18n-translate` generiert EN/FR/IT/ES auto. Nur Keys/IDs in onclick (Hard-Lesson #12). VOR Key-Anlage: Dupe-Check gegen GS_I18N_JS_STRINGS (viele tag_*/stat_* existieren schon aus v28.45-48).

**Erledigt (v28.45-v28.48):** gsNewPlantCard · renderSocialFeed · renderMarket (+_catLabel/_priceLabel/_timeAgo) · renderMyPlants (+getDueLabel) · openTaskManager · openDetail (+getCatLabel).

## Batch-Übersicht (empfohlene Sprint-Reihenfolge nach Sichtbarkeit)

| Batch | Unübersetzt |
|---|---|
| A_Pflanzen_Listen | 32 |
| B_Wissen_Lexikon | 34 |
| C_Rezepte_Heilmittel | 27 |
| D_Marktplatz_Chat | 23 |
| E_Quiz_Battle (4 functions: renderDailyQuizTeaser, gsBattleRenderList, gsBattleRenderRound, gsBattleRenderResult) | 38 |
| F_Doktor_Scan (batch F_Doktor_Scan) | 74 |
| G_Garten_Saison | 59 |
| H_Farm | 4 |
| I_Profil_Wetter_Lina | 107 |

## Findings (gruppiert nach Funktion)

### A_Pflanzen_Listen

**`buildPlantCard`** (11)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 23904 | high | heading | Aufgaben | `card_section_tasks` |
| 23931 | high | label | Wasser | `stat_water` |
| 23932 | high | label | Sonne | `stat_sun` |
| 23933 | high | label | Dünger | `stat_fertilizer` |
| 23939 | high | button | Pflegeberatung | `btn_care_advice` |
| 23940 | high | button | Diagnose | `btn_diagnosis` |
| 23945 | high | button | Aufgaben | `btn_manage_tasks` |
| 23946 | high | button | Tagebuch | `btn_diary` |
| 23947 | high | button | Bearbeiten | `btn_edit` |
| 23948 | high | button | Pflanzenfriedhof | `btn_cemetery` |
| 23949 | high | button | Löschen | `btn_delete` |

**`gsFavsRenderOutdoor`** (8)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 23664 | high | heading | Noch kein Garten | `garden_empty_title` |
| 23665 | high | hint | Lege einen Garten oder ein Beet an, um Outdoor-Pflanzen, Pflege-Plan … | `garden_empty_hint` |
| 23666 | high | button | Garten anlegen | `btn_add_garden` |
| 23682 | med | label | Kein Standort | `garden_no_location` |
| 23694 | med | label | Gepflanzt:  | `planting_date_label` |
| 23698 | low | button | Alle  | `btn_view_all_garden` |
| 23701 | med | hint | Noch nichts gepflanzt. | `garden_empty_plantings` |
| 23703 | med | button | Pflanze hinzufügen | `btn_add_planting` |

**`renderCemetery`** (4)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 27290 | med | empty | Noch keine verstorbenen Pflanzen. | `cemetery_empty` |
| 27301 | low | label | Unbekannt | `cemetery_unknown_date` |
| 27302 | med | label | Unbekannte Ursache | `cemetery_unknown_cause` |
| 27305 | med | button | Wiederherstellen | `btn_restore_plant` |

**`renderList`** (9)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 23233 | high | label | Arten | `search_status_species_count` |
| 23235 | high | other | Keine Treffer | `search_no_results` |
| 23245 | high | heading | Keine Einträge gefunden | `search_empty_title` |
| 23246 | high | hint | Versuche einen anderen Begriff / oder wähle eine andere Kategorie. | `search_empty_hint` |
| 23254 | high | badge | Giftig | `tag_toxic` |
| 23255 | high | badge | Essbar | `tag_edible` |
| 23256 | high | badge | Heilpflanze | `tag_medicinal` |
| 23257 | high | badge | Geschützt | `tag_protected` |
| 23279 | med | button | weitere Arten laden | `btn_load_more_species` |

### B_Wissen_Lexikon

**`filterSchaedlinge`** (1)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 39972 | high | empty | Nichts gefunden. | `schaedling_no_results` |

**`renderAussaat`** (1)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 40014 | high | label | Jetzt | `aussaat_current_month_indicator` |

**`renderBodenInfoCard`** (6)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 44697 | high | label | Boden gut geeignet für | `boden_info_good_soil_label` |
| 44698 | high | other | pH optimal: | `boden_info_ph_optimal_label` |
| 44704 | high | label | Boden-Warnung: | `boden_info_warning_label` |
| 44704 | med | other | auf | `boden_info_on_soil_type` |
| 44707 | high | label | Was tun? | `boden_info_what_todo_label` |
| 44717 | high | label | Idealer Boden für | `boden_info_ideal_soil_label` |

**`renderBodenTypen`** (6)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 37923 | high | hint | Wähle deinen Bodentyp um zu sehen, welche Pflanzen passen und wie du … | `bodentypen_intro_hint` |
| 37933 | high | badge | Ideal | `boden_ideal_badge` |
| 37938 | high | label | Vorteile | `boden_advantages_label` |
| 37942 | high | label | Nachteile | `boden_disadvantages_label` |
| 37946 | high | label | Verbesserung: | `boden_improvement_label` |
| 37950 | high | label | Gut geeignet für diese Arten | `boden_suitable_plants_label` |

**`renderLexikon`** (6)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 38137 | high | badge | Arten | `lexikon_species_count_badge` |
| 38138 | high | badge | Essbar | `lexikon_edible_badge` |
| 38139 | high | badge | Giftig | `lexikon_toxic_badge` |
| 38140 | high | badge | Heilkraft | `lexikon_medicinal_badge` |
| 38165 | high | other | Kompakte Grundlagen | `lexikon_intro_label` |
| 38165 | high | other | Fachbegriffe | `lexikon_terms_label` |

**`renderPflanzentafel`** (7)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 40029 | high | hint | Alle Angaben in cm. Tracht: I=Starkzehrer, II=Mittelzehrer, III=Schwa… | `pflanzentafel_intro_hint` |
| 40044 | high | label | Pflanze | `pflanzentafel_plant_column` |
| 40044 | high | label | Abst. | `pflanzentafel_distance_column` |
| 40044 | high | label | Reihe | `pflanzentafel_row_column` |
| 40044 | high | label | Saat | `pflanzentafel_seed_column` |
| 40044 | high | label | Mond | `pflanzentafel_moon_column` |
| 40044 | high | label | Tr. | `pflanzentafel_tracht_column` |

**`renderSchaedlingItems`** (6)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 39946 | high | badge | Krankheit | `schaedling_krankheit_badge` |
| 39946 | high | badge | Schädling | `schaedling_pest_badge` |
| 39950 | high | label | Erkennung: | `schaedling_recognition_label` |
| 39952 | high | label | Massnahmen: | `schaedling_measures_label` |
| 39957 | high | label | Betrifft folgende Arten | `schaedling_affected_species_label` |
| 39957 | med | other | in Datenbank | `schaedling_in_database_suffix` |

**`renderSchaedlinge`** (1)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 39923 | high | hint | Schädling oder Pflanze suchen… | `schaedlinge_search_placeholder` |

### C_Rezepte_Heilmittel

**`buildRecipeCard`** (3)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 37405 | high | label | Favorit | `recipe_card_favorite_label` |
| 37405 | high | title | Als Favorit speichern | `recipe_card_save_favorite_hint` |
| 37408 | high | badge | Heilwirkung | `remedy_card_healing_effect_badge` |

**`openRecipeDetail`** (13)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 37651 | med | title | Infokarte: | `recipe_detail_ingredient_card_tooltip` |
| 37670 | med | other | Schritt | `recipe_detail_step_label_step` |
| 37692 | med | label | Infokarte | `recipe_detail_plant_card_label` |
| 37694 | high | heading | Wirkung & Anwendung | `remedy_detail_healing_effect_heading` |
| 37695 | high | heading | Warnhinweis | `remedy_detail_warning_heading` |
| 37697 | high | heading | Zutaten | `recipe_detail_ingredients_heading` |
| 37700 | high | heading | Zubereitung | `recipe_detail_preparation_heading` |
| 37703 | med | heading | Tipps & Hinweise | `recipe_detail_tips_heading` |
| 37706 | high | button | Bearbeiten | `recipe_detail_edit_button` |
| 37707 | high | button | Löschen | `recipe_detail_delete_button` |
| 37709 | med | button | Foto hinzufügen | `recipe_detail_add_photo_button` |
| 37716 | high | button | Gespeichert | `recipe_detail_saved_button` |
| 37716 | high | button | Speichern | `recipe_detail_save_button` |

**`renderRecipes`** (6)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 37539 | med | other | von | `recipes_filter_count_separator` |
| 37544 | high | empty | Noch keine Favoriten | `recipes_empty_state_no_favorites` |
| 37544 | high | empty | Keine Rezepte in dieser Kategorie | `recipes_empty_state_no_category` |
| 37544 | high | hint | Tippe ♡ auf einem Rezept um es zu speichern | `recipes_empty_state_hint_save_favorite` |
| 37544 | high | hint | Wähle "Alle" um alle anzuzeigen | `recipes_empty_state_hint_show_all` |
| 37563 | med | other | Lade weitere | `recipes_lazy_load_label_load_more` |

**`renderRemedies`** (5)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 37596 | high | empty | Noch keine Favoriten. | `remedies_empty_state_no_favorites` |
| 37596 | high | hint | Tippe ♡ auf einem Heilmittel | `remedies_empty_state_hint_favorite` |
| 37596 | high | empty | Noch keine Heilmittel. | `remedies_empty_state_no_remedies` |
| 37596 | high | hint | Füge dein erstes Rezept hinzu! | `remedies_empty_state_hint_add_recipe` |
| 37614 | med | other | Lade weitere | `remedies_lazy_load_label_load_more` |

### D_Marktplatz_Chat

**`openListingDetail`** (15)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 31787 | high | heading | 🔨 Auktion läuft | `auction_running` |
| 31790 | high | label | Aktuelles Höchstgebot | `current_highest_bid` |
| 31792 | high | hint | Gebote · Mindesterhöhung CHF | `bids_min_increment` |
| 31794 | high | label | verbleibend | `remaining` |
| 31810 | high | button | 💬 Kontakt aufnehmen | `contact_seller` |
| 31811 | high | hint | 💡 Tutti-Style: Verkäufer akzeptiert nur direkte Kontaktaufnahme. Beza… | `tutti_style_hint` |
| 31814 | high | label | Preis | `price` |
| 31826 | high | heading | 🔄 Tauschangebot | `exchange_offer` |
| 31827 | high | label | Biete: | `offer_label` |
| 31828 | high | label | Suche: | `want_label` |
| 31828 | low | empty | Anfrage | `request_fallback` |
| 31831 | high | button | 💬 Tauschangebot senden | `send_exchange_offer` |
| 31837 | high | heading | GRATIS 🎁 | `free_label` |
| 31839 | high | button | 📩 Interesse melden | `express_interest` |
| 31852 | high | heading | Verkäufer & Lieferung | `seller_shipping_heading` |

**`renderChatMessages`** (1)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 32350 | med | empty | Noch keine Nachrichten. Schreib als Erster! 💬 | `no_messages_yet` |

**`renderPurchases`** (7)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 32445 | high | empty | Noch nichts hier. | `nothing_here_yet` |
| 32454 | high | badge | 🥇 Führend | `status_leading` |
| 32455 | high | badge | 🔴 Überboten | `status_outbid` |
| 32457 | high | badge | 🏆 Gewonnen! | `status_won` |
| 32459 | high | badge | 💳 Gekauft | `status_bought` |
| 32466 | high | label | Mein Gebot | `my_bid_label` |
| 32466 | high | label | Preis | `price` |

### E_Quiz_Battle (4 functions: renderDailyQuizTeaser, gsBattleRenderList, gsBattleRenderRound, gsBattleRenderResult)

**`gsBattleRenderList`** (16)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 28501 | high | label | Dein ELO: | `battle_your_elo` |
| 28503 | high | button | Neues Battle (Zufalls-Gegner) | `btn_new_battle_random` |
| 28507 | med | empty | Nichts hier. | `empty_state_nothing_here` |
| 28509 | med | other | Zufalls-Gegner | `battle_random_opponent` |
| 28509 | med | other | Gegner | `battle_opponent` |
| 28514 | high | badge | Sieg | `battle_verdict_win` |
| 28514 | high | badge | Niederlage | `battle_verdict_loss` |
| 28514 | high | badge | Unentschieden | `battle_verdict_draw` |
| 28519 | high | label | Du bist dran! | `battle_your_turn` |
| 28519 | med | other | Zufall | `battle_type_random` |
| 28519 | med | other | Freund | `battle_type_friend` |
| 28522 | med | other | Warte auf Gegner… | `battle_waiting_for_opponent` |
| 28522 | med | badge | Offen | `battle_status_open` |
| 28534 | high | heading | Du bist dran | `battle_section_your_turn` |
| 28535 | high | heading | Offen | `battle_section_open` |
| 28536 | high | heading | Vergangen | `battle_section_past` |

**`gsBattleRenderResult`** (8)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 28730 | high | heading | Geschafft! | `battle_done` |
| 28731 | high | label | Dein Score: | `battle_your_score` |
| 28732 | high | hint | Warte auf deinen Gegner. Schau später wieder rein — das ⚔️-Badge zeig… | `battle_waiting_result_hint` |
| 28735 | high | badge | Sieg! | `battle_result_win` |
| 28735 | high | badge | Niederlage | `battle_result_loss` |
| 28735 | high | badge | Unentschieden | `battle_result_draw` |
| 28739 | high | label | Dein Score: | `battle_your_score` |
| 28741 | med | label | ELO | `battle_elo_label` |

**`gsBattleRenderRound`** (1)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 28662 | high | label | Runde | `battle_round` |

**`renderDailyQuizTeaser`** (13)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 16664 | high | button | Quiz-Battle (1v1) | `btn_quiz_battle_1v1` |
| 16669 | med | other | Tage | `unit_days` |
| 16686 | high | badge | Punkte heute | `quiz_points_today` |
| 16687 | med | other | Zeit abgelaufen | `quiz_timeout` |
| 16687 | high | other | Nicht ganz richtig | `quiz_incorrect` |
| 16688 | high | heading | Heute schon beantwortet | `quiz_already_answered_today` |
| 16691 | med | label | Nächste Frage in | `quiz_next_question_in` |
| 16691 | low | other | h | `unit_hours_short` |
| 16691 | low | other | min | `unit_minutes_short` |
| 16699 | high | heading | Tägliche Frage bereit | `quiz_teaser_ready` |
| 16702 | high | button | Jetzt starten | `btn_start_now` |
| 16702 | med | other | 20 Sek | `quiz_time_limit_20s` |
| 16704 | high | hint | Keine zweite Chance · Nicht schummeln · App verlassen = verloren | `quiz_rules_hint` |

### F_Doktor_Scan (batch F_Doktor_Scan)

**`gsMushroomRenderResult`** (30)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 29094 | med | label | Möglicher Kandidat: | `mushroom_possible_candidate_label` |
| 29097 | high | label | ⚠️ UNSICHERE Identifikation (Confidence | `mushroom_uncertain_label` |
| 29098 | med | empty | KI ist sich nicht sicher. | `mushroom_uncertain_fallback` |
| 29101 | high | toast | 🚫 NICHT essen! Geh zur offiziellen VAPKO-Pilzkontrolle. | `mushroom_unsafe_warning` |
| 29112 | high | badge | TÖDLICH | `mushroom_deadly_badge` |
| 29112 | high | badge | GIFTIG | `mushroom_toxic_badge` |
| 29113 | high | badge | NUR JUNG / BEDINGT ESSBAR | `mushroom_conditional_edible_badge` |
| 29114 | high | badge | ⚠️ Vorsicht | `mushroom_caution_badge` |
| 29115 | high | badge | Speisepilz | `mushroom_edible_badge` |
| 29125 | med | label | VAPKO-Klasse: | `mushroom_vapko_class_label` |
| 29129 | med | label | Beobachtet: | `mushroom_observed_label` |
| 29134 | high | heading | 🤢 Symptome bei Verzehr: | `mushroom_toxic_symptoms_heading` |
| 29140 | high | label | ☎️ Tox-Info Schweiz: | `mushroom_toxinfo_label` |
| 29146 | med | heading | 🍳 Zubereitung: | `mushroom_cooking_heading` |
| 29147 | med | heading | 📦 Konservieren: | `mushroom_conservation_heading` |
| 29153 | high | heading | ⚠️ VERWECHSLUNGS-RISIKO | `mushroom_lookalike_warning_heading` |
| 29160 | med | label | 👁️ Visuell: | `mushroom_visual_diff_label` |
| 29161 | med | label | 👃 Geruch: | `mushroom_smell_diff_label` |
| 29162 | med | label | 🔬 Sporen: | `mushroom_spore_diff_label` |
| 29163 | low | label | 💡 Profi-Tipp: | `mushroom_pro_tip_label` |
| 29173 | high | hint | Hinweis: Diese KI ist eine erste Einschätzung. Sie ersetzt KEINE offi… | `mushroom_disclaimer` |
| 29174 | low | label | Quelle: | `mushroom_source_label` |
| 29186 | high | heading | 🔒 VAPKO-Kontrolle empfohlen | `mushroom_vapko_recommended_heading` |
| 29187 | med | label | Kontrollstelle: | `mushroom_control_place_label` |
| 29218 | high | heading | TÖDLICH GIFTIG | `mushroom_deadly_toxic_heading` |
| 29221 | med | label | KI vermutet: | `mushroom_ai_suspects_label` |
| 29226 | high | toast | NICHT ESSEN, NICHT BERÜHREN. Bei Verdacht auf Verzehr SOFORT Notfall-… | `mushroom_deadly_danger_msg` |
| 29227 | high | toast | NICHT ESSEN. Bei Symptomen umgehend Tox-Info anrufen. | `mushroom_toxic_danger_msg` |
| 29230 | high | button | ☎️ Tox-Info: 145 | `mushroom_toxinfo_button` |
| 29234 | high | button | Verstanden — Details anzeigen | `mushroom_danger_confirm_button` |

**`gsPestRenderResult`** (9)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 28905 | high | empty | Kein eindeutiger Schädling erkannt. Bitte Foto näher oder schärfer au… | `pest_no_match_msg` |
| 28908 | high | label | ⚠️ Unsicher (Confidence | `pest_uncertain_label` |
| 28923 | high | label | Schwere · Confidence | `pest_severity_label` |
| 28931 | high | heading | Schaden / Symptome | `pest_symptoms_heading` |
| 28936 | high | heading | 🌿 Bio-Behandlung | `pest_organic_treatment_heading` |
| 28943 | high | heading | 🛡️ Vorbeugen | `pest_prevention_heading` |
| 28949 | med | label | Natürliche Feinde: | `pest_natural_enemies_label` |
| 28952 | low | label | Alternative Kandidaten: | `pest_alternatives_label` |
| 28981 | med | title | Schädling erkannt | `pest_diary_entry_title` |

**`openScanHistoryDetail`** (10)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 23033 | med | label | Scan löschen | `scan_detail_delete_aria` |
| 23056 | med | label | Schliessen | `scan_detail_close_aria` |
| 23078 | med | label | 📝 Eigene Notiz | `scan_detail_note_label` |
| 23079 | low | label | z.B. "Gesehen am Bachufer", "nochmal prüfen"… | `scan_detail_note_placeholder` |
| 23080 | med | button | 💾 Notiz speichern | `scan_detail_save_note_button` |
| 23084 | med | button | 📖 In DB öffnen | `scan_detail_open_db_button` |
| 23085 | med | button | Nicht in DB | `scan_detail_not_in_db_button` |
| 23086 | med | button | 🌐 Wikipedia | `scan_detail_wikipedia_button` |
| 23089 | med | button | ⚠️ Falsch erkannt | `scan_detail_wrong_id_button` |
| 23090 | med | button | 🗑️ Aus History löschen | `scan_detail_delete_history_button` |

**`renderRoomScanResult`** (12)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 26077 | high | heading | 📊 Raum-Lichtkarte | `room_scan_light_map_heading` |
| 26080 | med | label | Tiefer Schatten | `room_scan_deep_shadow` |
| 26080 | med | label | Schatten | `room_scan_shadow` |
| 26080 | med | label | Indirektes Licht | `room_scan_indirect_light` |
| 26080 | med | label | Helles Licht | `room_scan_bright_light` |
| 26080 | med | label | Volle Sonne | `room_scan_full_sun` |
| 26093 | high | label | Ideal für: | `room_scan_ideal_for_label` |
| 26102 | high | heading | 🏆 Empfehlung | `room_scan_recommendation_heading` |
| 26103 | med | label | Hellster Spot: | `room_scan_brightest_spot_label` |
| 26103 | med | hint | ideal für lichtliebende Pflanzen. | `room_scan_light_loving_hint` |
| 26104 | med | label | Schattigster Spot: | `room_scan_shadiest_spot_label` |
| 26104 | med | hint | ideal für Schattenverträgliche. | `room_scan_shade_tolerant_hint` |

**`renderScanHistFull`** (13)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 13866 | med | label | Scans | `scan_hist_scans_badge` |
| 13867 | med | label | Arten | `scan_hist_species_badge` |
| 13868 | med | badge | in DB | `scan_hist_in_db_badge` |
| 13869 | med | button | 🗑 Alle | `scan_hist_delete_all_button` |
| 13893 | med | empty | Keine Treffer | `scan_hist_no_hits` |
| 13893 | med | empty | Noch keine Scans | `scan_hist_no_scans` |
| 13894 | med | hint | Filter ändern oder Suche zurücksetzen | `scan_hist_change_filter_hint` |
| 13894 | med | hint | Scanne deine erste Pflanze mit der KI! | `scan_hist_first_scan_hint` |
| 13928 | med | label | Scan löschen | `scan_hist_delete_scan_aria` |
| 13944 | med | label | Nach Name oder lateinisch suchen… | `scan_hist_search_placeholder` |
| 13946 | med | button | Alle | `scan_hist_filter_all` |
| 13946 | med | button | in DB | `scan_hist_filter_in_db` |
| 13946 | med | button | unbekannt | `scan_hist_filter_unknown` |

### G_Garten_Saison

**`gsDiaryRenderConditional`** (11)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 30087 | high | label | — Pflanze wählen oder freilassen — | `select_plant_optional` |
| 30093 | high | label | Erntemenge (kg, optional) | `harvest_amount_kg` |
| 30101 | high | label | Schädling (optional, falls bekannt) | `pest_optional` |
| 30102 | med | hint | z.B. blattlaus oder schnecke | `pest_example` |
| 30103 | med | hint | Tipp: Nutze 🪲 Schädling-Scanner für KI-Identifikation — der schreibt … | `pest_scanner_tip` |
| 30109 | high | label | Dünger / Mittel (optional) | `fertilizer_optional` |
| 30110 | med | hint | z.B. Kompost, Hornspäne, Brennnessel-Jauche | `fertilizer_example` |
| 30116 | high | label | Menge in Liter (optional) | `water_amount_liters` |
| 30117 | low | hint | z.B. 10 | `water_amount_example` |
| 30122 | high | label | Symptom (optional) | `disease_symptom` |
| 30123 | med | hint | z.B. Mehltau, gelbe Flecken | `disease_symptom_example` |

**`gsForestRender`** (12)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 30337 | med | empty | Keine Forest-Garden-Designs in der DB. | `no_forest_designs` |
| 30365 | med | other | Hohe Bäume (Nuss, Kastanie, alte Apfelbäume) | `canopy_description` |
| 30366 | med | other | Mittelhohe Obstbäume (Apfel, Pflaume, Kirsche) | `understory_description` |
| 30367 | med | other | Beerensträucher (Holunder, Aronia, Johannisbeere) | `shrubs_description` |
| 30368 | med | other | Mehrjährige Kräuter (Beinwell, Brennnessel, Minze) | `herbaceous_description` |
| 30369 | med | other | Niedrige Pflanzen (Erdbeere, Walderdbeere, Klee) | `groundcover_description` |
| 30370 | med | other | Knollen-Pflanzen (Topinambur, Yacon, Wurzel-Zwiebel) | `rhizosphere_description` |
| 30371 | med | other | Klettern (Kiwi, Trauben, Hopfen, Bohnen) | `vertical_description` |
| 30372 | med | other | Pilze auf Stämmen (Shiitake, Austernpilz) | `mushroom_description` |
| 30396 | low | other | ✓ {{ count }} Pflanzen | `plants_count` |
| 30396 | low | other | definiert | `defined` |
| 30396 | low | other | — leer | `empty` |

**`openPlantingDetail`** (33)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 54985 | med | badge | Fruchttag | `fruit_day` |
| 54985 | med | badge | Blatttag | `leaf_day` |
| 54985 | med | badge | Wurzeltag | `root_day` |
| 54985 | med | badge | Blütentag | `flower_day` |
| 54993 | high | other | Heute idealer Tag für {{ plant }}! | `ideal_day_today` |
| 54993 | high | other | Heute nicht optimal – besser an {{ day }} pflanzen | `not_optimal_day` |
| 55000 | high | heading | Pflanzinformationen | `planting_information` |
| 55003 | high | label | Pflanztiefe | `planting_depth` |
| 55003 | med | other | Oberflächennah | `surface_level` |
| 55004 | high | label | Pflanzabstand | `planting_distance` |
| 55005 | high | label | Reihenabstand | `row_distance` |
| 55006 | high | label | Saattiefe | `sowing_depth` |
| 55006 | med | hint | Lichtkeimer – nicht bedecken | `light_germinator` |
| 55012 | high | heading | Keimung | `germination` |
| 55015 | med | badge | Lichtkeimer | `light_germinator_badge` |
| 55015 | med | badge | Dunkelkeimer | `dark_germinator` |
| 55016 | med | label | Keimtemp. | `germination_temp` |
| 55017 | med | label | Boden min. | `min_soil_temp` |
| 55023 | high | heading | Mischkultur | `intercropping` |
| 55024 | high | label | Gute Nachbarn: | `good_neighbors` |
| 55025 | high | label | Schlechte Nachbarn: | `bad_neighbors` |
| 55031 | high | heading | Fruchtfolge | `crop_rotation` |
| 55033 | med | other | Pause: mindestens {{ years }} Jahr{{ plural }} am gleichen Standort | `crop_rotation_pause` |
| 55034 | med | label | Gute Vorgänger: | `good_predecessors` |
| 55035 | med | label | Nicht nach: | `avoid_after` |
| 55043 | high | label | Wachstum: | `growth_label` |
| 55044 | low | other | Tage | `days_label` |
| 55050 | med | label | Gepflanzt: | `planted_label` |
| 55051 | high | badge | Erntebereit! | `harvest_ready` |
| 55051 | high | label | Ernte: | `harvest_label` |
| 55066 | high | heading | Bodeneignung | `soil_suitability` |
| 55074 | med | label | Notizen | `notes_label` |
| 55076 | high | button | Pflanzung entfernen | `delete_planting` |

**`renderGardenLibrary`** (1)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 15245 | med | empty | Keine Artikel gefunden | `no_articles_found` |

**`renderSeasonList`** (2)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 27234 | med | empty | Im {{ month }} gibt es für diese Kategorie keine Aktivität. | `no_season_activity` |
| 27254 | high | title | in der Schweiz | `in_switzerland` |

### H_Farm

**`renderFarmAnimals`** (1)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 55753 | high | empty | Noch keine Tiere. Kaufe dein erstes Tier im Shop! | `farm_animals_empty` |

**`renderFarmBuildings`** (1)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 55806 | med | label | Lv. | `farm_building_level` |

**`renderFarmGrid`** (2)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 55510 | high | empty | Klicke " + Feld" um dein erstes Feld anzulegen. | `farm_grid_empty_hint` |
| 55518 | high | label | Leer | `farm_plot_empty` |

### I_Profil_Wetter_Lina

**`gsLinaRender`** (10)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 66871 | high | heading | Hallo, ich bin Lina! | `lina_greeting_title` |
| 66871 | high | hint | Deine Garten- & Natur-Coachin — frag mich alles zu Pflanzen, Garten, … | `lina_greeting_hint` |
| 66881 | med | other | 🌿 Lina denkt nach… | `lina_typing_indicator` |
| 66884 | med | label | Lina | `lina_name` |
| 66884 | med | hint | Dein Garten-Coach · immer gratis | `lina_subtitle` |
| 66885 | med | button | ＋ Neu | `lina_new_btn` |
| 66889 | high | title | Frag Lina etwas… | `lina_input_placeholder` |
| 66920 | med | toast | Entschuldige, da ist gerade etwas schiefgelaufen — magst du es nochma… | `lina_error_message` |
| 66930 | med | toast | 🌿 Wir haben heute schon richtig viel geplaudert — wie schön! Mein Tag… | `lina_quota_reached` |
| 66932 | med | toast | Hmm, das hat gerade nicht geklappt 🌿 — bitte versuch es gleich nochmal. | `lina_error_retry` |

**`gsNlRenderPhotos`** (3)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 18303 | med | badge | ★ Haupt | `marketplace_photo_main` |
| 18304 | med | button | ☆ Haupt | `marketplace_photo_set_main` |
| 18305 | med | button | Foto entfernen | `marketplace_photo_remove` |

**`gsWxRender`** (4)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 67458 | high | heading | 🌦️ Wetter-Warnungen | `weather_alerts_title` |
| 67462 | high | empty | Keine aktiven Warnungen. GreenScan prüft deinen Standort alle 3 Stund… | `weather_alerts_none` |
| 67468 | med | button | ✓ Gesehen | `weather_alert_acknowledge` |
| 67477 | med | button | 🗑️ Entfernen | `weather_alert_remove` |

**`openWeatherDetail`** (17)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 8781 | med | other | 🌤️ Wetterdaten laden… | `weather_detail_loading` |
| 8786 | med | other | ⚠️ Keine Verbindung | `weather_detail_no_connection` |
| 8816 | high | hint | ❄️ Frostgefahr unter 2°C — empfindliche Pflanzen und Kübelpflanzen re… | `weather_tip_frost` |
| 8817 | high | hint | 🥵 Sehr heiss — Pflanzen morgens früh oder abends nach Sonnenuntergang… | `weather_tip_hot` |
| 8818 | high | hint | 🌧️ Regen erwartet — kein Giessen nötig. Gute Zeit für Umpflanzen. | `weather_tip_rain` |
| 8819 | high | hint | 🌱 Ideales Wetter zum Pflanzen, Säen und Umtopfen. | `weather_tip_ideal` |
| 8820 | high | hint | 💨 Starker Wind — Klettergewächse und hohe Pflanzen sichern. | `weather_tip_wind` |
| 8821 | high | hint | ☀️ Hoher UV-Index — Pflanzen giessen wenn Sonne tief steht, nicht mit… | `weather_tip_uv` |
| 8824 | med | other | 💧  | `weather_tip_rain_prefix` |
| 8824 | high | hint | mm Regen heute erwartet — Balkonpflanzen prüfen ob Wasser abläuft. | `weather_tip_rain_amount` |
| 8825 | high | hint | 🌿 Gute Bedingungen für den Garten. Regelmässig kontrollieren und beda… | `weather_tip_good_conditions` |
| 8839 | high | label | ⚠️ Frost:  | `weather_warning_frost` |
| 8839 | high | other | °C — Gefrierschutz für Leitungen und empfindliche Pflanzen! | `weather_warning_frost_action` |
| 8840 | high | other | ⛈️ Gewitter erwartet — nicht im Freien arbeiten! | `weather_warning_thunderstorm` |
| 8841 | high | label | 💨 Sturm:  | `weather_warning_storm` |
| 8841 | high | other |  km/h — Gewächshaus und Folientunnel sichern! | `weather_warning_storm_action` |
| 8857 | med | label | Jetzt | `weather_hourly_now` |

**`renderFeedback`** (20)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 26551 | high | heading | Community-Posts werden geladen… | `feedback_loading_title` |
| 26552 | low | hint | Frisch aus der Supabase-Datenbank | `feedback_loading_hint` |
| 26567 | high | heading | Community-Feed konnte nicht geladen werden | `feedback_error_title` |
| 26569 | high | button | 🔄 Erneut versuchen | `feedback_error_retry_btn` |
| 26576 | high | heading | Noch kein Community-Feedback | `feedback_empty_title` |
| 26577 | med | hint | Sei die erste Person, die eine Idee, einen Fehler oder einen Wunsch t… | `feedback_empty_hint` |
| 26584 | med | empty | Keine Einträge in diesem Filter — Filter wechseln. | `feedback_filter_empty` |
| 26609 | med | badge | Noch nicht analysiert | `feedback_status_pending` |
| 26610 | med | badge | Angenommen | `feedback_status_accepted` |
| 26611 | med | badge | Umgesetzt | `feedback_status_implemented` |
| 26612 | med | badge | Abgelehnt | `feedback_status_rejected` |
| 26613 | med | badge | Braucht mehr Info | `feedback_status_needs_info` |
| 26614 | med | badge | Duplikat | `feedback_status_duplicate` |
| 26666 | med | label | IDEEN | `feedback_stats_ideas_label` |
| 26671 | med | label | KI-ANALYSIERT | `feedback_stats_analyzed` |
| 26672 | med | label | ANGENOMMEN | `feedback_stats_accepted` |
| 26673 | med | label | 👍 COMMUNITY | `feedback_stats_community` |
| 26674 | med | label | UMGESETZT | `feedback_stats_implemented` |
| 26695 | med | label | 🤖 KI-Bewertung | `feedback_ai_evaluation_label` |
| 26700 | low | button | KI-Bewertung neu anstossen | `feedback_reanalyze_btn` |

**`renderMoonWidget`** (10)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 54884 | high | label | 🌙 Mondkalender · Heute | `moon_widget_calendar_today` |
| 54886 | med | label | Alter:  | `moon_widget_age` |
| 54886 | med | other |  Tage ·  | `moon_widget_days` |
| 54886 | med | label | % beleuchtet | `moon_widget_illuminated` |
| 54909 | med | label | Heute ·  | `moon_calendar_today_label` |
| 54914 | low | other |  Tage alt ·  | `moon_calendar_days_old` |
| 54914 | low | label | % beleuchtet | `moon_calendar_illuminated` |
| 54928 | high | heading | 📅 14-Tage Mondkalender | `moon_calendar_14day_title` |
| 54938 | low | label |  ← heute | `moon_calendar_today_marker` |
| 54947 | high | heading | 📖 Mondtypen | `moon_calendar_types_title` |

**`renderProfileLogin`** (23)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 63949 | high | hint | Melde dich an und speichere deine Entdeckungen, Level und Meilensteine | `profile_login_subtitle` |
| 63957 | high | button | 🔑 Anmelden | `profile_login_tab_login` |
| 63961 | high | button | ✨ Registrieren | `profile_login_tab_register` |
| 63966 | high | title | E-Mail-Adresse | `profile_login_email_placeholder` |
| 63972 | high | title | Passwort | `profile_login_password_placeholder` |
| 63982 | high | button | Passwort vergessen? | `profile_login_forgot_password` |
| 63990 | high | button | 🔑 Anmelden | `profile_login_button` |
| 63995 | high | title | Dein Name (optional) | `profile_register_name_placeholder` |
| 64001 | high | title | E-Mail-Adresse | `profile_register_email_placeholder` |
| 64007 | high | title | Passwort (mind. 8 Zeichen) | `profile_register_password_placeholder` |
| 64013 | high | title | Passwort bestätigen | `profile_register_password_confirm_placeholder` |
| 64026 | high | button | ✨ Kostenlos registrieren | `profile_register_button` |
| 64028 | med | other | Durch die Registrierung stimmst du unserer | `profile_register_agree_start` |
| 64030 | med | label | Datenschutzerklärung | `profile_register_privacy_policy` |
| 64038 | high | button | Ohne Konto fortfahren → | `profile_login_continue_guest` |
| 64090 | high | other | E-Mail und Passwort erforderlich. | `profile_login_error_required` |
| 64092 | low | other | ⏳ Anmelden… | `profile_login_button_loading` |
| 64102 | high | toast | ✅ Willkommen zurück! | `profile_login_success_toast` |
| 64113 | high | other | Passwort mind. 8 Zeichen. | `profile_register_error_password_length` |
| 64114 | high | other | Passwörter stimmen nicht überein. | `profile_register_error_password_mismatch` |
| 64116 | low | other | ⏳ Registrieren… | `profile_register_button_loading` |
| 64118 | low | button | ✨ Registrieren | `profile_register_button_reset` |
| 64130 | high | other | ✅ Konto existiert bereits — bitte melde dich an. | `profile_register_error_duplicate` |

**`renderProfileSetup`** (1)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 64601 | low | toast | ❌ URL und Key erforderlich | `profile_setup_error_required` |

**`renderSupport`** (19)

| Zeile | Vis | Kind | DE-Text | proposed_key |
|---|---|---|---|---|
| 56182 | high | heading | Wie funktioniert der KI-Scanner? | `support_faq_scanner_how` |
| 56182 | high | other | Lade ein Foto oder nimm eines auf. Der Scanner schickt es an die Anth… | `support_faq_scanner_answer` |
| 56183 | high | heading | Warum öffnet sich die Kamera nicht? | `support_faq_camera_why` |
| 56183 | high | other | Browser erlauben Kamerazugriff nur über HTTPS oder localhost. Wenn du… | `support_faq_camera_answer` |
| 56184 | high | heading | Was bedeuten die Toxizitätsstufen? | `support_faq_toxicity_what` |
| 56184 | high | other | ✅ Ungiftig · 🟡 Leicht giftig · 🟠 Mässig giftig · ⚠️ Giftig · 🔴 Stark … | `support_faq_toxicity_answer` |
| 56185 | med | heading | Wie bekomme ich einen API Key? | `support_faq_apikey_how` |
| 56185 | med | other | Anthropic: console.anthropic.com → API Keys. Tipp: meist hat der App-… | `support_faq_apikey_answer` |
| 56186 | med | heading | Kann ich die App ohne Internet nutzen? | `support_faq_offline_can` |
| 56186 | med | other | Die Datenbank mit 542 Arten funktioniert offline. Der KI-Scanner und … | `support_faq_offline_answer` |
| 56187 | med | heading | Wie melde ich einen Datenfehler? | `support_faq_dataerrror_how` |
| 56187 | med | other | Tippe auf "Feedback" und wähle "Datenfehler". Beschreibe was falsch i… | `support_faq_dataerror_answer` |
| 56192 | high | heading | 📞 Notfall-Kontakte | `support_emergency_contacts_title` |
| 56193 | high | button | 🚨 Notruf Schweiz — 144 | `support_emergency_swiss` |
| 56194 | high | button | ☠️ Tox Info Suisse — 145 | `support_emergency_tox_info` |
| 56195 | med | button | 🇪🇺 EU-Notruf — 112 | `support_emergency_eu` |
| 56214 | med | badge | ✅ API Key aktiv | `support_api_banner_active` |
| 56214 | med | badge | ⚠️ API Key fehlt – tippe zum Einrichten | `support_api_banner_missing` |
| 56220 | low | hint | Anthropic: console.anthropic.com → API Keys | `support_api_help_anthropic` |
