/**
 * _exifjpeg.js — baut ein winziges JPEG mit echten EXIF-Daten.
 *
 * Wird von scan_check.js gebraucht: ein Binaer-Parser, der nie gegen echte
 * Bytes gelaufen ist, ist eine Behauptung. Hier entstehen die Bytes.
 *
 * baueJpegMitExif({ datum:'2026:07:14 09:33:12', lat:46.8182, lng:8.2275 })
 *   → Buffer (SOI + APP1/Exif + EOI)
 */
function baueJpegMitExif(o) {
  o = o || {};
  const little = true;
  const chunks = [];
  // ── TIFF-Kopf ──────────────────────────────────────────────────────────
  const tiff = [];
  const push16 = (a, v) => { a.push(v & 0xff, (v >> 8) & 0xff); };            // little endian
  const push32 = (a, v) => { a.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff); };
  tiff.push(0x49, 0x49);          // „II"
  push16(tiff, 42);
  push32(tiff, 8);                // IFD0 beginnt bei 8

  const hatDatum = !!o.datum, hatGps = (o.lat != null && o.lng != null);
  const ifd0Entries = (hatDatum ? 1 : 0) + (hatGps ? 1 : 0);

  // Platzhalter — die Offsets stehen erst fest, wenn die Groessen bekannt sind.
  const ifd0Start = 8;
  const ifd0Len = 2 + ifd0Entries * 12 + 4;
  const exifIfdStart = ifd0Start + ifd0Len;
  const exifLen = hatDatum ? (2 + 1 * 12 + 4) : 0;
  const gpsIfdStart = exifIfdStart + exifLen;
  const gpsLen = hatGps ? (2 + 4 * 12 + 4) : 0;
  const datenStart = gpsIfdStart + gpsLen;

  const daten = [];
  let datumOff = 0, latOff = 0, lngOff = 0, latRefOff = 0, lngRefOff = 0;
  if (hatDatum) {
    datumOff = datenStart + daten.length;
    for (const ch of o.datum) daten.push(ch.charCodeAt(0));
    daten.push(0);
  }
  function gradTeile(x) {
    const a = Math.abs(x);
    const g = Math.floor(a);
    const m = Math.floor((a - g) * 60);
    const s = Math.round(((a - g) * 60 - m) * 60 * 100);   // 2 Nachkommastellen
    return [[g, 1], [m, 1], [s, 100]];
  }
  if (hatGps) {
    latOff = datenStart + daten.length;
    for (const [n, d] of gradTeile(o.lat)) { push32(daten, n); push32(daten, d); }
    lngOff = datenStart + daten.length;
    for (const [n, d] of gradTeile(o.lng)) { push32(daten, n); push32(daten, d); }
  }

  // ── IFD0 ───────────────────────────────────────────────────────────────
  const ifd0 = [];
  push16(ifd0, ifd0Entries);
  if (hatDatum) { push16(ifd0, 0x8769); push16(ifd0, 4); push32(ifd0, 1); push32(ifd0, exifIfdStart); }
  if (hatGps)   { push16(ifd0, 0x8825); push16(ifd0, 4); push32(ifd0, 1); push32(ifd0, gpsIfdStart); }
  push32(ifd0, 0);

  // ── Exif-IFD ───────────────────────────────────────────────────────────
  const exifIfd = [];
  if (hatDatum) {
    push16(exifIfd, 1);
    push16(exifIfd, 0x9003); push16(exifIfd, 2); push32(exifIfd, o.datum.length + 1); push32(exifIfd, datumOff);
    push32(exifIfd, 0);
  }

  // ── GPS-IFD ────────────────────────────────────────────────────────────
  const gpsIfd = [];
  if (hatGps) {
    push16(gpsIfd, 4);
    // LatRef (ASCII, 2 Zeichen → passt in die 4 Inline-Bytes)
    push16(gpsIfd, 0x0001); push16(gpsIfd, 2); push32(gpsIfd, 2);
    gpsIfd.push((o.lat < 0 ? 'S' : 'N').charCodeAt(0), 0, 0, 0);
    push16(gpsIfd, 0x0002); push16(gpsIfd, 5); push32(gpsIfd, 3); push32(gpsIfd, latOff);
    push16(gpsIfd, 0x0003); push16(gpsIfd, 2); push32(gpsIfd, 2);
    gpsIfd.push((o.lng < 0 ? 'W' : 'E').charCodeAt(0), 0, 0, 0);
    push16(gpsIfd, 0x0004); push16(gpsIfd, 5); push32(gpsIfd, 3); push32(gpsIfd, lngOff);
    push32(gpsIfd, 0);
  }

  const tiffBody = [].concat(tiff, ifd0, exifIfd, gpsIfd, daten);
  const app1Payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00].concat(tiffBody);  // „Exif\0\0"
  const app1Size = app1Payload.length + 2;

  chunks.push(0xFF, 0xD8);                                   // SOI
  chunks.push(0xFF, 0xE1, (app1Size >> 8) & 0xff, app1Size & 0xff);
  chunks.push(...app1Payload);
  chunks.push(0xFF, 0xD9);                                   // EOI
  return Buffer.from(chunks);
}
module.exports = { baueJpegMitExif };
