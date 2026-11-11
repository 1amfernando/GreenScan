// ══════════════════════════════════════════════════════════════════════════
// SPIEGEL — wortgetreu aus der laufenden Auslieferung gezogen am 02.09.2026
// (v32.19). version 4 · verify_jwt=true · ezbr_sha256 f63fa33e…
// Keine Überarbeitung.
//
// Diese Funktion war ausgeliefert und wird vom Frontend benutzt, hatte aber
// keinen Quelltext im Repo — obwohl sie im Namen des Nutzers Inserate anlegt
// und Fotos in einen öffentlichen Bucket lädt. Genau so etwas gehört lesbar.
// ══════════════════════════════════════════════════════════════════════════
// v28.10 marketplace-publish v4 — B-007 FIX: robuste Token-Validierung.
// Root-Cause des „invalid token": createClient(url, userToken) + getUser() OHNE Token-Arg
// suchte eine nicht-existente Session -> user=null -> 401. Fix: sbAdmin.auth.getUser(userToken).
// v25.30: Validate + Foto-Upload + INSERT in 1 Call. v26.92: MAX_PHOTOS 3->5.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

async function uploadPhoto(userId: string, listingId: string, idx: number, b64: string): Promise<string | null> {
  let raw: string;
  try {
    raw = b64.replace(/^data:image\/\w+;base64,/, "");
    const bin = atob(raw);
    if (bin.length > MAX_PHOTO_BYTES) return null;
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const path = `${userId}/${listingId}_${idx}.jpg`;
    const { error } = await sbAdmin.storage.from("marketplace-photos").upload(path, bytes, {
      contentType: "image/jpeg",
      upsert: true
    });
    if (error) { console.warn("upload error:", error.message); return null; }
    const { data } = sbAdmin.storage.from("marketplace-photos").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) { console.warn("upload exception:", e); return null; }
}

Deno.serve(async (req: Request) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: cors });

  try {
    const authHdr = req.headers.get("authorization") || "";
    const userToken = authHdr.replace(/^Bearer\s+/i, "");
    if (!userToken) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });

    // v28.10 B-007 FIX: Token EXPLIZIT an getUser übergeben (vorher: getUser() ohne Arg -> user=null).
    const { data: userData, error: userErr } = await sbAdmin.auth.getUser(userToken);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "invalid token", detail: userErr?.message || null }), { status: 401, headers: cors });
    }
    const userId = userData.user.id;

    const body = await req.json();

    const title = String(body.title || "").trim().slice(0, 80);
    const description = String(body.description || "").trim().slice(0, 500);
    const category = String(body.category || "").trim().slice(0, 40);
    const priceMode = String(body.price_mode || "fix");
    const price = body.price != null ? Number(body.price) : null;
    const currency = String(body.currency || "CHF").toUpperCase();
    const region = String(body.region || "").trim().slice(0, 8);
    const contact = String(body.contact || "").trim().slice(0, 80);
    const photosB64: string[] = Array.isArray(body.photos_b64) ? body.photos_b64.slice(0, MAX_PHOTOS) : [];
    const listingId = body.listing_id ? String(body.listing_id) : null;

    if (!title) return new Response(JSON.stringify({ error: "title required" }), { status: 400, headers: cors });
    if (!category) return new Response(JSON.stringify({ error: "category required" }), { status: 400, headers: cors });
    if (!region) return new Response(JSON.stringify({ error: "region required" }), { status: 400, headers: cors });
    if (!contact) return new Response(JSON.stringify({ error: "contact required" }), { status: 400, headers: cors });
    if (!['fix','vb','tausch','gratis'].includes(priceMode)) {
      return new Response(JSON.stringify({ error: "price_mode invalid" }), { status: 400, headers: cors });
    }
    if ((priceMode === 'fix' || priceMode === 'vb') && (!price || price <= 0)) {
      return new Response(JSON.stringify({ error: "price required for fix/vb mode" }), { status: 400, headers: cors });
    }

    let actualListingId = listingId;
    let row: any;
    if (listingId) {
      const { data: existing } = await sbAdmin.from("marketplace_listings")
        .select("id, user_id").eq("id", listingId).maybeSingle();
      if (!existing || existing.user_id !== userId) {
        return new Response(JSON.stringify({ error: "listing not found or not owner" }), { status: 403, headers: cors });
      }
      const { data: upd, error: e1 } = await sbAdmin.from("marketplace_listings").update({
        title, description, category,
        price: priceMode === 'tausch' || priceMode === 'gratis' ? null : price,
        currency, region, contact, price_mode: priceMode,
        updated_at: new Date().toISOString()
      }).eq("id", listingId).select().single();
      if (e1) throw e1;
      row = upd;
    } else {
      const { data: ins, error: e2 } = await sbAdmin.from("marketplace_listings").insert({
        user_id: userId,
        title, description, category,
        price: priceMode === 'tausch' || priceMode === 'gratis' ? null : price,
        currency, region, contact, price_mode: priceMode,
        status: 'active', views: 0, reports: 0
      }).select().single();
      if (e2) throw e2;
      row = ins;
      actualListingId = ins.id;
    }

    let photoUrls: string[] = [];
    if (photosB64.length && actualListingId) {
      const uploadPromises = photosB64.map((b64, idx) => uploadPhoto(userId, actualListingId!, idx, b64));
      const results = await Promise.all(uploadPromises);
      photoUrls = results.filter((u): u is string => u !== null);
      if (photoUrls.length) {
        await sbAdmin.from("marketplace_listings").update({
          photo_url: photoUrls[0],
          photo_urls: photoUrls
        }).eq("id", actualListingId);
        row.photo_url = photoUrls[0];
        row.photo_urls = photoUrls;
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      id: actualListingId,
      listing: row,
      photo_count: photoUrls.length,
      photo_failures: photosB64.length - photoUrls.length
    }), { headers: cors });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 500, headers: cors });
  }
});
