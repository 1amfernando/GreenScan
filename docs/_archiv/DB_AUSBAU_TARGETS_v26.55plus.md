# DB-Ausbau Targets ab v26.55 — species + Knowledge

**Datum:** 2026-05-27 · **Auftrag:** Cowork → Claude Code (autonom)
**Quelle:** Fernando-Wunsch "DB mehr aufbauen" + Workspace-CLAUDE-Claim "4'342 Arten"

---

## 1 · species 2'837 → 4'342 (+1'505) [v26.55 / Multi-Sub-Bumps]

**Stand:** SELECT count(*) FROM species → ~2'837
**Ziel:** 4'342 (matches Workspace-CLAUDE-Versprechen)

### Quoten-Aufteilung (1'505 neu)

| Kategorie | Aktuell | Neu | Ziel | Quelle |
|---|---|---|---|---|
| **plant** (Wild + Garten) | ~1'200 | +800 | ~2'000 | Info Flora CH + GBIF + Mittelland-Lokal |
| **fungi** (Pilze) | ~400 | +400 | ~800 | VAPKO-Liste + Pilzführer-Lit |
| **tree** (Bäume) | ~200 | +200 | ~400 | Schweizer Forst-Vereinbarung + Pro Specie Rara |
| **moss/lichen/algae** | ~50 | +105 | ~155 | Bioindikator-Listen WSL |
| **herb** (Kräuter, oft Cross-Listed) | ~250 | – (Cross-Cat) | bleibt | – |

### Sub-Bump-Plan

- **v26.55a:** +200 Wildkräuter CH (Brennnessel-Varianten, Wildmöhre, Spitzwegerich, Beifuß, Schöllkraut)
- **v26.55b:** +200 Wildblumen Alpen (Enzian-Spezies, Anemonen, Steinbrech, Edelweiß-Varianten)
- **v26.55c:** +100 Wasserpflanzen (Bachflohkraut, Wasserpest, Tausendblatt-Spezies)
- **v26.55d:** +100 Gartenpflanzen-Klassiker (Rosen-Sorten, Stauden-Klassiker)
- **v26.55e:** +200 Nutzpflanzen-Diversität (Salat-Sorten, Kohl-Diversität, Tomaten-Sorten Pro-Specie-Rara)
- **v26.55f:** +400 Pilze (300 ungenießbar + essbar mit VAPKO-Klasse, 100 giftig/tödlich mit Symptom-Bib)
- **v26.55g:** +200 Bäume (CH-heimisch + Pro-Specie-Rara Obst-Sorten)
- **v26.55h:** +105 Moose/Flechten/Algen (Bioindikator-Listen)

### Curation-Strategie

```typescript
// Pseudo-Code für species-bulk-seed v4
const PROMPT_TEMPLATE = `
Schreibe 50 species-Einträge zur Kategorie "${category}" mit Schweizer Fokus.
Pro Eintrag: lat (binomial), name (DE), fam (Familie lat), cat ('plant'|'fungi'|'tree'|'moss'|'lichen'|'algae'|'herb'),
emoji, description (60-100 chars), habitat, season, uses,
edible (bool), tox (0-5), medicinal (bool), warning, lookalike,
light_min/opt/max (0-3), water_need, soil_ph (string range '5.5-7.0'),
hardiness ('-30..40' string), found_in_ch (bool), conservation,
tips, sources (jsonb array of strings), bloom_months (int[]), harvest_months (int[]),
climate_zones (H1-H7 array), elevation_min/max_m.

Anti-Dup: jeder lat lower(...) muss unique sein. Skip wenn schon in DB.
`;
```

**Verify after each batch:**
```sql
SELECT cat, count(*) FROM species GROUP BY cat ORDER BY count DESC;
SELECT count(*) FROM species WHERE found_in_ch = true;
SELECT count(*) FROM species WHERE tox >= 3; -- toxic+
SELECT count(*) FROM species WHERE medicinal = true;
```

---

## 2 · Knowledge-Tables vertiefen [v26.56]

**Strategie:** pg_cron `knowledge-growth-daily` Topic-Counts ausweiten + Anthropic-Quote anpassen.

| Tabelle | Aktuell | Ziel | Δ | Topic-Wert in cron |
|---|---|---|---|---|
| recipes | 132 | 300 | +168 | 12/Tag → 25/Tag (Schweizer-Rezepte mit medizinal-Komponente) |
| remedies | 100 | 250 | +150 | 12/Tag → 20/Tag (alpine Heiltraditionen + TCM-Crossover) |
| folk_lore | 90 | 200 | +110 | 12/Tag → 18/Tag (CH-Sagen + Bauernregeln + Dialekt-Variationen) |
| garden_techniques | 68 | 200 | +132 | 12/Tag → 20/Tag (Biodynamik + Permakultur-CH + Vertikalgärten) |
| plant_diseases | 65 | 200 | +135 | 12/Tag → 20/Tag (mit Bio-Behandlung + Companion-Schutz) |
| did_you_know_facts | 80 | 250 | +170 | 12/Tag → 25/Tag (virale Quality) |
| seasonal_tips | 60 | 180 | +120 | 12/Tag → 15/Tag |
| daily_quizzes | 119 | 300 | +181 | 12/Tag → 20/Tag |
| pollinators | 66 | 150 | +84 | 8/Tag → 12/Tag |
| plant_companion_matrix | 67 | 200 | +133 | 8/Tag → 15/Tag |
| swiss_heritage_varieties | 20 | 100 | +80 | 5/Tag → 12/Tag (NEU mit Pro-Specie-Rara) |

**Migration `v26_56_pg_cron_extend.sql`:**
```sql
-- Update pg_cron-Schedule für knowledge-growth-daily
SELECT cron.unschedule('knowledge-growth-daily');
SELECT cron.schedule(
  'knowledge-growth-daily',
  '30 3 * * *',
  $$SELECT net.http_post(
    url := 'https://vowbiueikwrauuceilhc.supabase.co/functions/v1/knowledge-bulk-gen',
    headers := jsonb_build_object('Authorization','Bearer '||current_setting('app.settings.service_role_key'), 'Content-Type','application/json'),
    body := jsonb_build_object('mode','rotation','target_counts', jsonb_build_object(
      'recipes', 25, 'remedies', 20, 'folk_lore', 18, 'garden_techniques', 20,
      'plant_diseases', 20, 'did_you_know_facts', 25, 'seasonal_tips', 15,
      'daily_quizzes', 20, 'pollinators', 12, 'plant_companion_matrix', 15,
      'swiss_heritage_varieties', 12
    ))
  );$$
);
```

**knowledge-bulk-gen v12:** target_counts-jsonb parameter unterstützen, Salvage-Parser v6 (truncated JSON), 35 Topics enable.

---

## 3 · Verify after Sprints

```sql
-- Total Knowledge-DB-Größe
SELECT 'recipes' AS t, count(*) FROM recipes UNION ALL
SELECT 'remedies', count(*) FROM remedies UNION ALL
SELECT 'folk_lore', count(*) FROM folk_lore UNION ALL
SELECT 'garden_techniques', count(*) FROM garden_techniques UNION ALL
SELECT 'plant_diseases', count(*) FROM plant_diseases UNION ALL
SELECT 'did_you_know_facts', count(*) FROM did_you_know_facts UNION ALL
SELECT 'seasonal_tips', count(*) FROM seasonal_tips UNION ALL
SELECT 'daily_quizzes', count(*) FROM daily_quizzes UNION ALL
SELECT 'pollinators', count(*) FROM pollinators UNION ALL
SELECT 'plant_companion_matrix', count(*) FROM plant_companion_matrix UNION ALL
SELECT 'swiss_heritage_varieties', count(*) FROM swiss_heritage_varieties
ORDER BY 2 DESC;

-- species Final
SELECT count(*) FROM species; -- soll 4342+
SELECT cat, count(*) FROM species GROUP BY cat ORDER BY count DESC;
```

---

**Erstellt:** Cowork 2026-05-27 · Auftrag: User-Wunsch "DB mehr aufgebaut werden".
