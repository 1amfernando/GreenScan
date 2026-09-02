// ══════════════════════════════════════════════════════════════════════════
// SPIEGEL — wortgetreu aus der laufenden Auslieferung gezogen am 02.09.2026
// (v32.19). version 3 · verify_jwt=true · ezbr_sha256 54412e83…
//
// KEINE Überarbeitung. Siehe BEFUND.md daneben: diese Funktion wird von
// niemandem aufgerufen und nimmt Empfänger, Betrag und Text aus dem
// Anfrage-Rumpf — jede angemeldete Person kann damit eine erfundene
// GreenScan-Quittung an jede Adresse schicken. Empfehlung: stilllegen.
// ══════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// SUPABASE EDGE FUNCTION: send-receipt
// Sendet Quittungs-E-Mail nach Stripe-Zahlung
// Deploy: supabase functions deploy send-receipt
// ════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')! // resend.com (kostenlos bis 3000 E-Mails/Monat)
const FROM_EMAIL     = 'info@greenscan.ch'
const FROM_NAME      = 'GreenScan'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  try {
    const { type, email, name, amount, currency, date, transactionId, charityName, isSubscription } = await req.json()

    const dateFormatted = new Date(date || Date.now()).toLocaleDateString('de-CH', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    })
    const amountFormatted = (amount / 100).toLocaleString('de-CH', { style: 'currency', currency: currency?.toUpperCase() || 'CHF' })
    const displayName = name || email?.split('@')[0] || 'Naturfreund'

    let subject = ''
    let bodyContent = ''

    if (isSubscription) {
      // === ABO-QUITTUNG ===
      subject = `Dein GreenScan Pro Abo — Quittung ${dateFormatted}`
      bodyContent = `
        <div style="text-align:center;margin-bottom:28px;">
          <div style="font-size:48px;margin-bottom:8px;">✅</div>
          <h2 style="font-family:Georgia,serif;font-size:22px;color:#0f2e0f;margin:0 0 6px;">Abo aktiviert — Danke!</h2>
          <p style="font-size:14px;color:#7a9a7a;margin:0;">GreenScan Pro ist jetzt für dich freigeschaltet.</p>
        </div>

        <div style="background:#f5f9f0;border-radius:14px;padding:20px;margin-bottom:24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:13px;color:#7a9a7a;padding:5px 0;">Abo-Typ</td><td style="font-size:13px;color:#1c2b1c;font-weight:600;text-align:right;">GreenScan Pro (monatlich)</td></tr>
            <tr><td style="font-size:13px;color:#7a9a7a;padding:5px 0;border-top:1px solid #d4e8d4;">Betrag</td><td style="font-size:13px;color:#1c2b1c;font-weight:600;text-align:right;border-top:1px solid #d4e8d4;">${amountFormatted}</td></tr>
            <tr><td style="font-size:13px;color:#7a9a7a;padding:5px 0;border-top:1px solid #d4e8d4;">Datum</td><td style="font-size:13px;color:#1c2b1c;font-weight:600;text-align:right;border-top:1px solid #d4e8d4;">${dateFormatted}</td></tr>
            <tr><td style="font-size:13px;color:#7a9a7a;padding:5px 0;border-top:1px solid #d4e8d4;">Transaktions-ID</td><td style="font-size:11px;color:#7a9a7a;text-align:right;border-top:1px solid #d4e8d4;font-family:monospace;">${transactionId || '–'}</td></tr>
          </table>
        </div>

        <div style="background:#e8f5e8;border-radius:12px;padding:16px;margin-bottom:24px;">
          <p style="font-size:13px;color:#1a5c1a;margin:0 0 8px;font-weight:700;">🌿 Freigeschaltete Funktionen:</p>
          <p style="font-size:13px;color:#2d5a2d;margin:0;line-height:1.8;">
            📷 KI-Scanner unbegrenzt<br>
            💬 KI-Chat zu jeder Art<br>
            💾 Funde & Garten speichern<br>
            🏆 XP, Level & Meilensteine<br>
            🌍 Community-Zugang
          </p>
        </div>
      `
    } else {
      // === SPENDENQUITTUNG ===
      subject = `Deine GreenScan-Spende — Quittung ${dateFormatted}`
      bodyContent = `
        <div style="text-align:center;margin-bottom:28px;">
          <div style="font-size:48px;margin-bottom:8px;">💚</div>
          <h2 style="font-family:Georgia,serif;font-size:22px;color:#0f2e0f;margin:0 0 6px;">Danke für deine Spende!</h2>
          <p style="font-size:14px;color:#7a9a7a;margin:0;">Dein Beitrag macht einen echten Unterschied.</p>
        </div>

        <div style="background:#f5f9f0;border-radius:14px;padding:20px;margin-bottom:24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size:13px;color:#7a9a7a;padding:5px 0;">Organisation</td><td style="font-size:13px;color:#1c2b1c;font-weight:600;text-align:right;">${charityName || '–'}</td></tr>
            <tr><td style="font-size:13px;color:#7a9a7a;padding:5px 0;border-top:1px solid #d4e8d4;">Spendebetrag</td><td style="font-size:15px;color:#1a5c1a;font-weight:800;text-align:right;border-top:1px solid #d4e8d4;">${amountFormatted}</td></tr>
            <tr><td style="font-size:13px;color:#7a9a7a;padding:5px 0;border-top:1px solid #d4e8d4;">Datum</td><td style="font-size:13px;color:#1c2b1c;font-weight:600;text-align:right;border-top:1px solid #d4e8d4;">${dateFormatted}</td></tr>
            <tr><td style="font-size:13px;color:#7a9a7a;padding:5px 0;border-top:1px solid #d4e8d4;">Transaktions-ID</td><td style="font-size:11px;color:#7a9a7a;text-align:right;border-top:1px solid #d4e8d4;font-family:monospace;">${transactionId || '–'}</td></tr>
          </table>
        </div>

        <div style="background:#e8f5e8;border-radius:12px;padding:14px;margin-bottom:24px;">
          <p style="font-size:12.5px;color:#2d5a2d;margin:0;line-height:1.7;">
            ✅ 100% deiner Spende geht direkt an <strong>${charityName}</strong>.<br>
            GreenScan behält nichts davon.<br><br>
            Für eine offizielle Spendenquittung schreib uns: <a href="mailto:info@greenscan.ch" style="color:#1a5c1a;">info@greenscan.ch</a>
          </p>
        </div>
      `
    }

    // E-Mail via Resend senden
    const emailHtml = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef7ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef7ee;padding:32px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:520px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(15,46,15,0.12);">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(145deg,#0f2e0f,#1a5c1a,#2d8a2d);padding:28px 32px;text-align:center;">
    <div style="font-size:36px;margin-bottom:6px;">🌿</div>
    <div style="font-family:Georgia,serif;font-size:24px;font-weight:bold;color:#fff;letter-spacing:0.5px;">GreenScan</div>
    <div style="font-size:11px;color:rgba(255,255,255,0.55);margin-top:3px;letter-spacing:1.5px;text-transform:uppercase;">Die Natur-App der Schweiz</div>
  </td></tr>

  <!-- ANREDE -->
  <tr><td style="padding:28px 32px 0;">
    <p style="font-size:15px;color:#1c2b1c;margin:0 0 20px;">Hallo ${displayName},</p>
    ${bodyContent}
  </td></tr>

  <!-- FUSSZEILE -->
  <tr><td style="padding:0 32px 28px;">
    <p style="font-size:13px;color:#7a9a7a;margin:0;line-height:1.7;">
      Mit naturverbundenen Grüssen,<br>
      <strong style="color:#1a5c1a;">Das GreenScan-Team</strong>
    </p>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#f5f9f0;border-top:1px solid #d4e8d4;padding:18px 32px;text-align:center;">
    <p style="font-size:11.5px;color:#aaa;margin:0;line-height:1.7;">
      🌿 GreenScan · <a href="https://green-scan.ch" style="color:#2d8a2d;text-decoration:none;">green-scan.ch</a>
      · <a href="mailto:info@greenscan.ch" style="color:#2d8a2d;text-decoration:none;">info@greenscan.ch</a>
    </p>
    <p style="font-size:10.5px;color:#ccc;margin:8px 0 0;">
      Diese E-Mail ist deine Zahlungsbestätigung. Bitte aufbewahren.
    </p>
  </td></tr>

</table>
<p style="font-size:10.5px;color:#aaa;margin:16px 0 0;text-align:center;">© ${new Date().getFullYear()} GreenScan · Chur, Schweiz</p>
</td></tr>
</table>
</body>
</html>`

    // Senden via Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [email],
        subject: subject,
        html: emailHtml,
      })
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error('E-Mail konnte nicht gesendet werden: ' + err)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
