// garden-scan-analyze v7 (v26.99 Garten-Planer v3)
// v6-Basis (Mondkalender · Fruchtfolge · Mischkultur · Frost · Wasser-Zonen · Vorkultur · Erntefenster)
// NEU v7: Multi-Year (1-3 Jahre) · Klima-adaptiv (climate_scenarios_ch) · Constraints (Budget/Pflege/Erfahrung/Permakultur/Kinder-Haustiere/Bio) · Simulations-Modus · yearly_outputs
// v9 (v29.37): Server-Rate-Limit (KI-Kostenschutz) — max 20 Garten-Analysen/Stunde/User via
//   fn_check_rate_limit. Fail-open (Rate-Limit-Fehler blockiert den Dienst nicht).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_SCENARIOS = ["baseline", "warmer_drier", "wetter_summer"];
const ALLOWED_REGIONS = ["mittelland", "jura", "alpen", "tessin"];

async function getAnthropicKey(admin: any): Promise<string | null> {
  const fromEnv = Deno.env.get("ANTHROPIC_API_KEY");
  if (fromEnv) return fromEnv;
  try {
    const { data } = await admin.from("app_settings").select("value").eq("key", "global_anthropic_api_key").maybeSingle();
    return data?.value ?? null;
  } catch (_) { return null; }
}

// v26.83: Lunar-Calendar 2026 (vereinfacht — Pflanztage nach biodynamischem Pattern).
function getLunarDayType(date: Date): string {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const types = ["wurzel", "blatt", "blüte", "frucht"];
  return types[dayOfYear % 4];
}

function buildLunarSection(): string {
  return `\n\n## MONDKALENDER-PRINZIPIEN (biodynamisch)\nBerücksichtige diese Aussaat-Empfehlungen nach Mondphase:\n- **Wurzeltage** (Karotte, Rettich, Zwiebel, Kartoffel, Rote Bete, Pastinake) — bei abnehmendem Mond + Wurzel-Konstellation\n- **Blatttage** (Salat, Spinat, Kohl, Kräuter, Mangold) — bei zunehmendem Mond + Blatt-Konstellation\n- **Blütentage** (Blumen, Brokkoli, Blumenkohl, Artischocken, Hopfen) — bei zunehmendem Mond + Blüten-Konstellation\n- **Fruchttage** (Tomate, Bohne, Gurke, Erbse, Kürbis, Zucchini, Mais, Paprika) — bei zunehmendem Mond + Frucht-Konstellation\nFür jede Pflanze: setze \"lunar_phase_optimal\" entsprechend (wurzel/blatt/blüte/frucht). Empfehle dem User die Aussaat NUR an passenden Tagen.`;
}

function buildCropRotationSection(): string {
  return `\n\n## FRUCHTFOLGE-PRINZIPIEN (4-Jahres-Zyklus, Pflanzenfamilien)\nWichtigste Familien + Vertreter:\n- **Solanaceae** (Nachtschattengewächse): Tomate, Paprika, Aubergine, Kartoffel — Starkzehrer\n- **Cucurbitaceae** (Kürbisse): Gurke, Zucchini, Kürbis, Melone — Starkzehrer\n- **Brassicaceae** (Kreuzblütler): Kohl, Brokkoli, Blumenkohl, Radieschen, Rettich — Mittelzehrer\n- **Fabaceae** (Hülsenfrüchte): Bohne, Erbse, Linse — Stickstoff-Fixierer\n- **Apiaceae** (Doldenblütler): Karotte, Sellerie, Petersilie, Pastinake — Mittelzehrer\n- **Alliaceae** (Lauch): Zwiebel, Knoblauch, Lauch, Schnittlauch — Schwachzehrer\n- **Asteraceae** (Korbblütler): Salat, Endivie, Sonnenblume — Mittelzehrer\n- **Chenopodiaceae**: Mangold, Spinat, Rote Bete — Mittelzehrer\n\nREGEL: Folge Starkzehrer (1. Jahr) → Mittelzehrer (2. Jahr) → Schwachzehrer (3. Jahr) → Gründüngung/Hülsenfrucht (4. Jahr). NIE 2 Jahre in Folge gleiche Familie am selben Standort. Fülle pro Pflanze: \"crop_family\" + \"feeder_class\" (\"stark|mittel|schwach|fixer\") + \"succession_after\" (was als nächstes hierhin kommen sollte).`;
}

function buildCompanionSection(antagonistPairs: any[]): string {
  if (!antagonistPairs || antagonistPairs.length === 0) return "";
  const list = antagonistPairs.slice(0, 25).map((p: any) =>
    `- ${p.species_a_lat} ✕ ${p.species_b_lat} (${p.relationship}): ${p.reason || ""}`
  ).join("\n");
  return `\n\n## MISCHKULTUR-WARNUNGEN (aus plant_companion_matrix)\nVERMEIDE folgende Pflanzen-Kombinationen am selben Beet:\n${list}\n\nFülle pro Pflanze: \"companion_pairs\" (gute Nachbarn) und \"incompatible_plants\" (zu vermeiden). Bei Konflikten im Plan: warne im \"warnings\"-Array konkret.`;
}

function buildSeasonalSection(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const monthNames = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
  const seasonGuide: Record<number, string> = {
    1: "WINTER: Plane für die Saison, beginne Vorkultur ab Februar. Aktuell: Wartung, Werkzeuge schärfen.",
    2: "VORFRÜHLING: Tomate, Paprika, Aubergine Vorkultur (Indoor 18-22°C). Außen: Erbse, Spinat möglich.",
    3: "FRÜHLING: Karotte, Radieschen, Spinat direkt säen. Vorkultur Salat. Knoblauch stecken.",
    4: "FRÜHLING-START: Mehr Direktsaat. Kartoffel legen. Aussaat-Hauptmonat. Letzter Frostschutz nötig.",
    5: "FRÜHSOMMER: Eisheilige beachten (Mitte Mai). DANACH alles Frostempfindliche raus: Tomate, Gurke, Bohne, Kürbis.",
    6: "SOMMER: Hauptpflege. Salat-Nachsaaten alle 2 Wochen. Bohnen-Nachsaat. Wachstum + Bewässerung.",
    7: "HOCHSOMMER: Ernte beginnt. Nachsaat Winterkulturen: Feldsalat, Endivie, Wintersalat ab Ende Juli.",
    8: "SPÄTSOMMER: Hauptsaat Wintergemüse: Feldsalat, Spinat, Lauch-Pikieren. Tomate beschneiden.",
    9: "HERBST-START: Wintergemüse-Pflanzung abschließen. Ernte Hauptkulturen. Boden-Vorbereitung.",
    10: "HERBST: Aussaat Knoblauch (Winterüberlieger). Gründüngung: Phacelia, Roggen. Mulchen.",
    11: "SPÄTHERBST: Beete abräumen, mulchen, Boden ruhen lassen. Letzte Wintergemüse-Ernte.",
    12: "WINTER: Garten-Pause. Sammelt Erfahrungen, plant nächste Saison. Werkzeug-Pflege."
  };
  return `\n\n## AKTUELLE SAISON: ${monthNames[month-1]} ${now.getFullYear()}\n${seasonGuide[month] || ""}\n\nKonzentriere Plan auf das was JETZT gepflanzt werden kann + nächste 3-6 Monate. Für jede Pflanze setze \"sow_date\" realistisch innerhalb der nächsten 60 Tage (oder \"pre_cultivation_indoor_start\" wenn Vorkultur).`;
}

function buildIntentSection(intent: string, pollinatorPlants: any[] | null, birds: any[] | null): string {
  switch (intent) {
    case "pollinator":
      return `\n\n## PLAN-TYP: BIENEN-GARTEN (Pollinator-Modus)\nUser will Bestäuber fördern.\n\nBEVORZUGE diese CH-Bestäuber-Lieblinge (aus DB):\n${(pollinatorPlants || []).slice(0, 15).map((p: any) => `- ${p.name}: bevorzugt von ${(p.preferred_visitors || []).slice(0, 3).join(", ")}`).join("\n")}\n\nMache mind. 6 von 12 Pflanzen Bestäuber-freundlich. Tagetes, Phacelia, Borretsch, Ringelblume, Lavendel sind Klassiker. Fülle pollinator_tags entsprechend.`;
    case "permaculture_hugel":
      return `\n\n## PLAN-TYP: PERMAKULTUR-HUGEL\nHugelkultur: Holzkerne im Inneren, mehrjährige + Selbstausaat-Pflanzen bevorzugt. Top + Sloping. Wenig Ein-Jahres-Gemüse, mehr Kräuter + Beeren + Wurzelfrüchte.`;
    case "container_balcony":
      return `\n\n## PLAN-TYP: BALKON-CONTAINER\nNur topftaugliche Pflanzen (max 50cm hoch, Wurzelballen passt in 5-15L Topf). Cherry-Tomate, Basilikum, Salat, Erdbeere, Kräuter, Mini-Gurke. KEINE: Mais, Kartoffel, Kürbis, große Kohlsorten.`;
    case "bird_friendly":
      return `\n\n## PLAN-TYP: VOGEL-GARTEN (Bird-Friendly-Modus)\nUser will Garten-Vögel fördern. BEVORZUGE Hecken, Beerensträucher (Holunder, Vogelbeere, Wildrose), Wildkräuter-Ecken, Brennnessel-Streifen für Insekten.\n\nCH-Garten-Vögel die DU im Plan fördern sollst (aus DB):\n${(birds || []).slice(0, 12).map((b: any) => `- ${b.common_name_de} (${b.status_in_ch}): liebt ${(b.preferred_plants || []).join(", ")} | Tipps: ${(b.attracting_tips || []).slice(0, 2).join("; ")}`).join("\n")}\n\nMache mind. 4 von 12 Pflanzen vogelfreundlich (Beeren, Samen-/Insekten-Wirt). Fülle bird_tags pro Pflanze: Liste von Vogelarten die sie anlockt.`;
    default:
      return "";
  }
}

// v7: Klima-adaptive Sektion
function buildClimateSection(climateRow: any | null, scenario: string, horizonYears: number): string {
  if (!climateRow || scenario === "baseline") {
    return horizonYears > 1
      ? `\n\n## KLIMA-SZENARIO: BASELINE (Referenzklima)\nPlane mit dem heutigen Referenzklima, berücksichtige aber normale Jahr-zu-Jahr-Schwankungen über ${horizonYears} Jahre. Vergib pro Jahr einen \"climate_resilience_score\" (0-100).`
      : "";
  }
  const t = Number(climateRow.avg_temp_delta_c) || 0;
  const p = Number(climateRow.avg_precip_delta_pct) || 0;
  const f = Number(climateRow.frost_days_delta) || 0;
  return `\n\n## KLIMA-SZENARIO (klima-adaptive Planung über ${horizonYears} Jahr(e))\nSzenario \"${scenario}\" für Region ${climateRow.region}: ${climateRow.summary || ""}\nKlima-Deltas vs. Referenz: Temperatur ${t >= 0 ? "+" : ""}${t}°C · Niederschlag ${p >= 0 ? "+" : ""}${p}% · Frosttage ${f >= 0 ? "+" : ""}${f} Tage.\nPASSE die Pflanzenauswahl an dieses Szenario an: bei Erwärmung wärmeliebende + hitze-/trockenheitstolerante Arten bevorzugen, Aussaat-/Erntefenster verschieben, Bewässerungs-/Mulch-Strategie anpassen, bei mehr Niederschlag pilzresistente Sorten + gute Drainage. Vergib pro Jahr einen \"climate_resilience_score\" (0-100, höher = besser an dieses Klima angepasst).`;
}

// v7: Constraints (harte Nutzer-Vorgaben)
function buildConstraintsSection(c: any): string {
  if (!c || typeof c !== "object") return "";
  const bits: string[] = [];
  if (c.budget_chf_per_year != null && c.budget_chf_per_year !== "") bits.push(`- BUDGET: max. CHF ${c.budget_chf_per_year} pro Jahr (Saatgut, Setzlinge, Erde, Material). Bleibe darunter; Direktsaat + Selbstvermehrung + günstige Kulturen bevorzugen. Fülle pro Jahr \"estimated_budget_chf\".`);
  if (c.care_hours_per_week != null && c.care_hours_per_week !== "") bits.push(`- PFLEGE-ZEIT: max. ${c.care_hours_per_week} Stunden pro Woche. Bei knapper Zeit pflegeleichte, robuste Pflanzen + Mulch + Tröpfchenbewässerung. Fülle pro Jahr \"estimated_care_hours_per_week\".`);
  if (c.experience_level) {
    const expMap: Record<string, string> = {
      anfaenger: "ANFÄNGER: nur einfache, fehlertolerante Pflanzen (Radieschen, Salat, Bohnen, Zucchini, Kräuter). Sehr klare Schritt-für-Schritt-Hinweise, wenig gleichzeitig.",
      fortgeschritten: "FORTGESCHRITTEN: gemischtes Niveau, auch anspruchsvollere Kulturen erlaubt.",
      profi: "PROFI: volle Bandbreite inkl. anspruchsvoller Kulturen, Vorkultur, Veredelung, Nachsaaten."
    };
    bits.push("- ERFAHRUNG: " + (expMap[String(c.experience_level).toLowerCase()] || c.experience_level));
  }
  if (c.permaculture_principles) bits.push("- PERMAKULTUR: Wende Permakultur-Prinzipien an — Pflanzengilden, mehrjährige essbare Stauden, Mulch, Kompost-Kreisläufe, minimale Bodenstörung, Randzonen nutzen.");
  if (c.pets_or_kids) bits.push("- HAUSTIERE/KINDER: KEINE giftigen Pflanzen (z.B. Eisenhut, Fingerhut, Engelstrompete, Goldregen, Rizinus, Maiglöckchen, Eibe). Setze pro Pflanze \"child_pet_safe\" (true/false) und nimm nur sichere Pflanzen in den Plan auf.");
  if (c.organic_only) bits.push("- BIO: ausschliesslich biologische Methoden — keine synthetischen Dünger/Pestizide. Nützlinge, Mischkultur, Pflanzenjauchen, organische Dünger.");
  if (!bits.length) return "";
  return `\n\n## NUTZER-CONSTRAINTS (HARTE Vorgaben — strikt einhalten!)\n${bits.join("\n")}`;
}

// v7: Mehrjahres-Strategie + Simulations-Modus
function buildHorizonSection(horizonYears: number, simMode: string): string {
  if (horizonYears <= 1) return "";
  const simMap: Record<string, string> = {
    optimistic: "OPTIMISTISCH: gute Bedingungen, erfahrene Pflege, ideales Wetter → Ertrags-Schätzungen am oberen Rand.",
    pessimistic: "PESSIMISTISCH: Wetter-Extreme, Schädlingsdruck, knappe Zeit → konservative Ertrags-Schätzungen, mehr Risiko-Puffer.",
    realistic: "REALISTISCH: durchschnittliche Bedingungen + Pflege → ausgewogene, realistische Schätzungen."
  };
  let years = `- Jahr 1: Aufbau (Boden verbessern, einfache Starter-Kulturen, Infrastruktur anlegen).`;
  if (horizonYears >= 2) years += `\n- Jahr 2: Erweiterung (Fruchtfolge greift, mehrjährige Kulturen etabliert, höherer Ertrag).`;
  if (horizonYears >= 3) years += `\n- Jahr 3: Reife (volle Vielfalt, stabile Pflanzengilden, maximaler Ertrag bei sinkendem Aufwand).`;
  return `\n\n## MEHRJAHRES-STRATEGIE (${horizonYears}-Jahres-Plan)\nErstelle einen sich entwickelnden ${horizonYears}-Jahres-Plan. Jahr für Jahr baut der Garten Bodenfruchtbarkeit + Struktur auf:\n${years}\nWende ECHTE Fruchtfolge über die Jahre an — gleiche Pflanzenfamilie nie 2 Jahre am selben Beet.\nSIMULATIONS-MODUS: ${simMap[String(simMode || "realistic").toLowerCase()] || simMap.realistic}`;
}

function buildV7SchemaAddon(horizonYears: number): string {
  if (horizonYears <= 1) return "";
  return `\n\n## ZUSÄTZLICHE PFLICHT-FELDER (zusätzlich zum JSON oben, auf TOP-Ebene des JSON-Objekts):\n\"multi_year_strategy\": \"<2-4 Sätze: wie sich der Garten über ${horizonYears} Jahre entwickelt>\",\n\"risks\": [\"<konkretes mehrjähriges Risiko, z.B. Klima/Schädling/Boden + Gegenmassnahme>\"],\n\"simulated_yield_year3_kg\": <number — geschätzter Gesamt-Ertrag im LETZTEN Planjahr>,\n\"yearly_outputs\": [\n  { \"year\": <1..${horizonYears}>, \"plants\": [\"<Pflanzenname>\"], \"estimated_budget_chf\": <number>, \"estimated_care_hours_per_week\": <number>, \"climate_resilience_score\": <0-100>, \"yield_kg\": <number>, \"yearly_highlight\": \"<1 Satz Highlight des Jahres>\" }\n]\nGib für JEDES der ${horizonYears} Jahre GENAU EINEN yearly_outputs-Eintrag aus (also ${horizonYears} Einträge).`;
}

function buildSystemPrompt(regionalContext: any | null, intentSection: string, intent: string, antagonistPairs: any[], climateSection: string, constraintsSection: string, horizonSection: string, v7Addon: string): string {
  let regionalSection = "";
  if (regionalContext) {
    regionalSection = `\n\n## REGIONAL-CONTEXT (Schweizer Standort)\nRegion: ${regionalContext.region_name} (${regionalContext.canton_codes?.join(",")})\nKlimazone: ${regionalContext.climate_zone}, Höhe ${regionalContext.altitude_m_min}-${regionalContext.altitude_m_max}m\nLetzter Frost Ø: ${regionalContext.last_frost_avg}\nErster Frost Ø: ${regionalContext.first_frost_avg}\nWachstumstage: ${regionalContext.growing_season_days}\nNiederschlag: ${regionalContext.rainfall_mm_year} mm/Jahr\nBeste Gemüse: ${(regionalContext.best_vegetables || []).join(", ")}\nHerausfordernde Pflanzen: ${(regionalContext.challenging_plants || []).join(", ")}`;
  }

  const lunarSection = buildLunarSection();
  const rotationSection = buildCropRotationSection();
  const companionSection = buildCompanionSection(antagonistPairs);
  const seasonalSection = buildSeasonalSection();

  const tagFields = intent === "bird_friendly"
    ? '"bird_tags":["<amsel|rotkehlchen|kohlmeise|...>"], "pollinator_tags":[]'
    : '"pollinator_tags":["<honig-biene|wildbiene|hummel|schmetterling|schwebfliege>"], "bird_tags":[]';

  return `Du bist GreenScan-KI-Pro-Gartenplaner — professionelle Garten-Planung auf Niveau eines Permakultur-Designers + Bio-Gärtners + Saisongemüse-Experten für Schweiz.${regionalSection}${seasonalSection}${lunarSection}${rotationSection}${companionSection}${intentSection}${climateSection}${constraintsSection}${horizonSection}\n\nDeine Aufgabe: Analysiere die Foto(s) der Gartenfläche. Liefere einen INTELLIGENT durchdachten Plan der ALLE Aspekte berücksichtigt:\n1. **Standort-Analyse** (Boden, Licht, Klima, Mikroklimate)\n2. **Pflanzen-Auswahl** (Mischkultur-tauglich, Fruchtfolge-konform, klimazonal passend)\n3. **Aussaat-Timing** (Mondphase + Saison + Vorkultur-Indoor wenn nötig)\n4. **Spatial-Layout** (Pflanzdichte, Wasserzonen, Wurzeltiefe, Schatten-Wurf)\n5. **Pflege-Plan** (Bewässerung, Düngung, Schutz, Ernte-Fenster)\n6. **Folgekulturen** (was kommt NACH dieser Pflanze — 4-Jahres-Fruchtfolge)\n7. **Risiken + Warnungen** (Mischkultur-Konflikte, Frost-Empfindlichkeit, Krankheiten)\n\nWICHTIG: Antworte NUR mit gültigem JSON nach diesem Schema. KEINE Markdown-Code-Blöcke, KEIN Vor-/Nachtext.\n\n{\n  \"site_analysis\": {\n    \"size_m2\": <number>,\n    \"shape\": \"rectangular|circular|irregular\",\n    \"soil\": { \"type\": \"sandig|lehmig|tonig|humos|gemischt\", \"ph_estimate\": <number>, \"moisture\": \"trocken|mittel|feucht\", \"improvement_tips\":[\"<text>\"] },\n    \"light\": { \"level\": \"vollsonne|halbschatten|schatten\", \"hours_per_day\": <number>, \"shade_source\": \"<text or null>\" },\n    \"climate_zone\": \"H1|H2|H3|H4|H5|H6|H7\",\n    \"microclimates\":[{\"location\":\"<text>\",\"type\":\"warm|kalt|windgeschützt|exponiert\"}],\n    \"existing_plants\": [{ \"name\": \"<text>\", \"health\": \"gut|mittel|schlecht\", \"area_m2\": <number> }],\n    \"challenges\": [\"<text>\"]\n  },\n  \"plan_summary\": {\n    \"headline\":\"<1 sentence essence>\",\n    \"main_principles\":[\"<text>\",\"<text>\",\"<text>\"],\n    \"yield_estimate_kg_year\": <number>,\n    \"effort_hours_week\": <number>,\n    \"start_now_actions\":[\"<actionable today>\"]\n  },\n  \"recommended_plants\": [\n    {\n      \"name\": \"<text de>\",\n      \"lat\": \"<text scientific>\",\n      \"category\": \"Gemüse|Kräuter|Beeren|Blumen|Wildpflanze|Pilz\",\n      \"crop_family\": \"Solanaceae|Cucurbitaceae|Brassicaceae|Fabaceae|Apiaceae|Alliaceae|Asteraceae|Chenopodiaceae|other\",\n      \"feeder_class\": \"stark|mittel|schwach|fixer\",\n      \"position\": { \"x\": <number m>, \"y\": <number m>, \"row\": <int> },\n      \"qty\": <int>,\n      \"spacing_cm\": <int>,\n      \"planting_density_per_m2\": <number>,\n      \"root_depth\": \"flach|mittel|tief\",\n      \"water_zone\": \"trocken|mittel|feucht\",\n      \"pre_cultivation_indoor_start\": \"YYYY-MM-DD or null\",\n      \"sow_date\": \"YYYY-MM-DD\",\n      \"transplant_date\": \"YYYY-MM-DD or null\",\n      \"harvest_start\": \"YYYY-MM-DD or null\",\n      \"harvest_end\": \"YYYY-MM-DD or null\",\n      \"days_to_maturity\": <int>,\n      \"lunar_phase_optimal\": \"wurzel|blatt|blüte|frucht\",\n      \"yield_kg_estimate\": <number or null>,\n      \"companion_pairs\": [\"<text>\"],\n      \"incompatible_plants\": [\"<text>\"],\n      \"succession_after\": \"<welche Familie als nächstes ans selbe Beet>\",\n      \"frost_tolerance_c\": <number or null>,\n      \"care_intensity\": \"low|medium|high\",\n      \"child_pet_safe\": <true|false>,\n      ${tagFields},\n      \"reason\": \"<warum diese Wahl, max 2 Saetze>\"\n    }\n  ],\n  \"layout_grid\": { \"width_m\": <number>, \"depth_m\": <number>, \"rows\": <int>, \"cols\": <int>, \"water_zones\":[{\"zone\":\"trocken|mittel|feucht\",\"area_m2\":<number>}] },\n  \"weekly_calendar\": [\n    { \"week_nr\": <int 1-52>, \"month\":\"<jan-dez>\", \"actions\":[\"<text>\"], \"lunar_focus\":\"<wurzel|blatt|blüte|frucht|alle>\" }\n  ],\n  \"crop_rotation_4_year\": {\n    \"year_1\":[\"<Familie + Beispiel>\"],\n    \"year_2\":[\"<...>\"],\n    \"year_3\":[\"<...>\"],\n    \"year_4\":[\"<Gründüngung|Mischung>\"]\n  },\n  \"companion_groups\": [\n    { \"group\":\"<text z.B. Drei-Schwestern>\", \"plants\":[\"<text>\"], \"synergy\":\"<text>\" }\n  ],\n  \"tools_needed\": [\"<text>\"],\n  \"warnings\": [\"<konkret z.B. 'Kartoffel neben Tomate → beide Solanaceae → Krautfäule-Risiko'>\"],\n  \"follow_up_questions\": [\"<text z.B. Wasseranschluss vorhanden?>\"]\n}${v7Addon}\n\nQUALITÄTS-MAßSTAB: Anfänger soll Plan VERSTEHEN. Profi soll Plan RESPEKTIEREN. Max 12 Pflanzen. Jede Pflanze muss mind. ein \"companion_pairs\"-Partner haben. Warnings konkret + actionable. Pre-cultivation_indoor_start IMMER setzen wenn Pflanze frostempfindlich + aktueller Monat <= Mai.`;
}

// v7: Region-Key für climate_scenarios_ch aus regionalContext/metadata ableiten
function deriveClimateRegion(regionalContext: any | null, metadata: any): string {
  const explicit = (metadata?.climate_region || "").toString().toLowerCase().trim();
  if (ALLOWED_REGIONS.includes(explicit)) return explicit;
  const hay = [
    regionalContext?.region_name,
    regionalContext?.slug,
    regionalContext?.climate_zone,
    (regionalContext?.canton_codes || []).join(" "),
  ].join(" ").toLowerCase();
  if (/(tessin|ticino|sudschweiz|südschweiz|\bti\b|misox)/.test(hay)) return "tessin";
  if (/(jura|\bju\b|\bne\b|neuenburg|neuchatel)/.test(hay)) return "jura";
  if (/(alpen|alpin|voralpen|gebirge|\bgr\b|\bvs\b|wallis|graubunden|graubünden|berg)/.test(hay)) return "alpen";
  return "mittelland";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, svcKey);

    // v29.37: Server-Rate-Limit (KI-Kostenschutz) — max 20 Garten-Analysen/Stunde/User. Fail-open:
    // ein Fehler im Rate-Limit-Check darf den Dienst nicht blockieren.
    try {
      const { data: rlOk } = await admin.rpc("fn_check_rate_limit", { p_bucket: user.id, p_action: "garden_scan", p_max_per_hour: 20 });
      if (rlOk === false) {
        return new Response(JSON.stringify({ error: "rate_limited", message: "Zu viele Garten-Analysen in kurzer Zeit — bitte etwas später erneut." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } catch (_) { /* fail-open */ }

    const apiKey = await getAnthropicKey(admin);
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Anthropic API key not configured" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { photos, metadata, save_as_plan, plan_title } = body;
    if (!Array.isArray(photos) || photos.length === 0 || photos.length > 3) {
      return new Response(JSON.stringify({ error: "photos must be array of 1-3 base64 strings" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // v7: neue Parameter (validiert/geclamped)
    let horizonYears = parseInt(String(body.planning_horizon_years ?? metadata?.planning_horizon_years ?? 1), 10);
    if (!Number.isFinite(horizonYears) || horizonYears < 1) horizonYears = 1;
    if (horizonYears > 3) horizonYears = 3;
    let climateScenario = String(body.climate_scenario ?? metadata?.climate_scenario ?? "baseline");
    if (!ALLOWED_SCENARIOS.includes(climateScenario)) climateScenario = "baseline";
    const constraints = (body.constraints && typeof body.constraints === "object") ? body.constraints
      : (metadata?.constraints && typeof metadata.constraints === "object") ? metadata.constraints : {};
    let simulationMode = String(body.simulation_mode ?? metadata?.simulation_mode ?? "realistic");
    if (!["realistic", "optimistic", "pessimistic"].includes(simulationMode)) simulationMode = "realistic";

    let regionalContext: any | null = null;
    const regionSlug = metadata?.region_slug;
    if (regionSlug && typeof regionSlug === "string") {
      const { data: regionData } = await admin
        .from("regional_garden_calendars")
        .select("*")
        .eq("slug", regionSlug)
        .maybeSingle();
      if (regionData) regionalContext = regionData;
    }

    // v7: Klima-Szenario-Zeile laden (nur wenn nicht baseline)
    let climateRow: any | null = null;
    const climateRegion = deriveClimateRegion(regionalContext, metadata);
    if (climateScenario !== "baseline") {
      const { data: csData } = await admin
        .from("climate_scenarios_ch")
        .select("*")
        .eq("region", climateRegion)
        .eq("scenario", climateScenario)
        .maybeSingle();
      if (csData) climateRow = csData;
    }

    // v26.83: Mischkultur-Antagonisten injecten
    const { data: antagonistPairs } = await admin
      .from("plant_companion_matrix")
      .select("species_a_lat,species_b_lat,relationship,reason")
      .in("relationship", ["schlecht", "kritisch_schlecht"])
      .limit(30);

    const planIntent: string = metadata?.plan_intent || "self_sufficiency";
    let pollinatorPlants: any[] | null = null;
    let birds: any[] | null = null;

    if (planIntent === "pollinator") {
      const { data: polData } = await admin
        .from("pollinators")
        .select("name,scientific_name,preferred_flowers,ecological_value")
        .in("ecological_value", ["kritisch", "hoch"])
        .limit(20);
      const flowerMap: Record<string, string[]> = {};
      (polData || []).forEach((p: any) => {
        (p.preferred_flowers || []).forEach((f: string) => {
          if (!flowerMap[f]) flowerMap[f] = [];
          flowerMap[f].push(p.name);
        });
      });
      pollinatorPlants = Object.entries(flowerMap).map(([flower, visitors]) => ({
        name: flower,
        scientific_name: "-",
        preferred_visitors: visitors,
      }));
    } else if (planIntent === "bird_friendly") {
      const { data: birdData } = await admin
        .from("garden_birds_register")
        .select("common_name_de,status_in_ch,preferred_plants,attracting_tips,food_preferences")
        .in("status_in_ch", ["haeufig", "regelmaessig", "sommervogel"])
        .limit(15);
      birds = birdData;
    }

    const intentSection = buildIntentSection(planIntent, pollinatorPlants, birds);
    const climateSection = buildClimateSection(climateRow, climateScenario, horizonYears);
    const constraintsSection = buildConstraintsSection(constraints);
    const horizonSection = buildHorizonSection(horizonYears, simulationMode);
    const v7Addon = buildV7SchemaAddon(horizonYears);

    const userContent: any[] = photos.map((b64: string) => ({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: b64.replace(/^data:image\/[a-z]+;base64,/, ""),
      },
    }));

    const photoLabels = ["Foto 1: Top-Down/Übersicht", "Foto 2: Boden-Close-up", "Foto 3: Umgebung/Lichtquelle"].slice(0, photos.length);
    const userText = `Hier sind ${photos.length} Foto(s) eines Gartens. ${photoLabels.join(". ")}.\n\nMetadaten: ${JSON.stringify(metadata || {})}\nPlanungs-Horizont: ${horizonYears} Jahr(e) · Klima-Szenario: ${climateScenario} (Region ${climateRegion}) · Simulation: ${simulationMode}\n\nAnalysiere die Fläche und erstelle einen PROFESSIONELLEN Pflanz-Plan nach dem Schema im System-Prompt. Denke an Fruchtfolge, Mondkalender, Mischkultur, Saison-Timing${horizonYears > 1 ? ", Mehrjahres-Entwicklung" : ""}.`;
    userContent.push({ type: "text", text: userText });

    const systemPrompt = buildSystemPrompt(regionalContext, intentSection, planIntent, antagonistPairs || [], climateSection, constraintsSection, horizonSection, v7Addon);

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: horizonYears > 1 ? 14000 : 10000,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      return new Response(JSON.stringify({ error: "Anthropic API error", status: anthropicRes.status, detail: errBody.slice(0, 500) }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData.content?.[0]?.text || "";

    let analysis: any = null;
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "").trim();
      analysis = JSON.parse(cleaned);
    } catch (parseErr) {
      return new Response(JSON.stringify({
        error: "Failed to parse JSON response",
        raw_preview: rawText.slice(0, 800),
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // v7: yearly_outputs normalisieren (defensiv)
    const yearlyOutputs = Array.isArray(analysis?.yearly_outputs) ? analysis.yearly_outputs : [];

    let planId: string | null = null;
    if (save_as_plan === true) {
      const { data: insertData, error: insertErr } = await admin
        .from("garden_plans")
        .insert({
          user_id: user.id,
          title: plan_title || `Plan ${new Date().toLocaleDateString("de-CH")}`,
          scan_input: { photo_count: photos.length, metadata: metadata || {}, region_used: regionSlug || null, plan_intent: planIntent, planner_version: "v7", climate_region: climateRegion, simulation_mode: simulationMode },
          ai_analysis: analysis,
          status: "draft",
          planning_horizon_years: horizonYears,
          climate_scenario: climateScenario,
          constraints: constraints || {},
          plan_version: 2,
          yearly_outputs: yearlyOutputs,
        })
        .select("id")
        .single();
      if (!insertErr) planId = insertData?.id ?? null;
    }

    try {
      await admin.rpc("fn_log_ai_usage", {
        p_edge_fn: "garden-scan-analyze",
        p_tokens_in: anthropicData?.usage?.input_tokens || 0,
        p_tokens_out: anthropicData?.usage?.output_tokens || 0,
      });
    } catch (_) { /* nicht-blockierend */ }

    return new Response(JSON.stringify({
      ok: true,
      analysis,
      plan_id: planId,
      regional_context_used: regionalContext?.slug || null,
      plan_intent_used: planIntent,
      planning_horizon_years: horizonYears,
      climate_scenario: climateScenario,
      climate_region: climateRegion,
      simulation_mode: simulationMode,
      tokens: anthropicData.usage,
      model: anthropicData.model,
      planner_version: "v7",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
