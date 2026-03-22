#!/usr/bin/env node
/**
 * Generates lib/celestrak/fallbackTles.ts — a hardcoded TLE dataset for
 * the satellite dashboard to use when CelesTrak is unavailable.
 *
 * Run: node scripts/generate-fallback-tles.mjs
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'lib', 'celestrak', 'fallbackTles.ts');

// ── TLE helpers ────────────────────────────────────────────────────────────

function tleChecksum(line68) {
  let sum = 0;
  for (let i = 0; i < 68; i++) {
    const c = line68[i];
    if (c >= '0' && c <= '9') sum += parseInt(c, 10);
    else if (c === '-') sum += 1;
  }
  return sum % 10;
}

/**
 * Encode as CelesTrak BSTAR / mmDotDot notation: SXXXXXSN (8 chars)
 * value = 0.XXXXX × 10^N
 * Example: 0.000145 → ' 14500-3'
 */
function fmtScientific(val) {
  if (!val || val === 0) return ' 00000-0';
  const sign = val >= 0 ? ' ' : '-';
  const abs = Math.abs(val);
  const exp = Math.floor(Math.log10(abs)) + 1;
  const mantissa = Math.round((abs / Math.pow(10, exp)) * 100000);
  const mantissaClamped = Math.min(99999, Math.max(0, mantissa));
  const mantissaStr = String(mantissaClamped).padStart(5, '0');
  const expSign = exp >= 0 ? '+' : '-';
  const expStr = String(Math.abs(exp));
  return `${sign}${mantissaStr}${expSign}${expStr}`;
}

function buildLine1(sat) {
  const norad = String(sat.noradId).padStart(5, '0');
  const intl  = sat.intlDesig.padEnd(8).substring(0, 8);
  const epoch = '26001.00000000'; // 2026 Jan 1
  const mmDot = sat.mmDot ?? 0;
  const mmDotSign = mmDot < 0 ? '-' : ' ';
  const mmDotStr = mmDotSign + '.' + String(Math.round(Math.abs(mmDot) * 1e8)).padStart(8, '0');
  const bstar   = fmtScientific(sat.bstar ?? 0);
  const elemSet = String(sat.elemSet ?? 999).padStart(4);

  // Template breakdown (each field is fixed-width, total = 68 chars):
  // '1 '(2) + norad(5) + 'U '(2) + intl(8) + ' '(1) + epoch(14) + ' '(1)
  //   + mmDotStr(10) + '  00000+0 '(10) + bstar(8) + ' 0 '(3) + elemSet(4) = 68
  const body = `1 ${norad}U ${intl} ${epoch} ${mmDotStr}  00000+0 ${bstar} 0 ${elemSet}`;

  if (body.length !== 68) {
    throw new Error(`line1: expected 68, got ${body.length} for "${sat.name}"\n"${body}"`);
  }
  return body + tleChecksum(body);
}

function buildLine2(sat) {
  const norad = String(sat.noradId).padStart(5, '0');
  const incl  = sat.inc.toFixed(4).padStart(8);
  const raan  = sat.raan.toFixed(4).padStart(8);
  const ecc   = String(Math.round(sat.ecc * 1e7)).padStart(7, '0');
  const argp  = sat.argp.toFixed(4).padStart(8);
  const ma    = sat.ma.toFixed(4).padStart(8);
  const mm    = sat.mm.toFixed(8).padStart(11);
  const rev   = String(Math.min(sat.revNum ?? 10000, 99999)).padStart(5);

  // '2 '(2) + norad(5) + ' '(1) + incl(8) + ' '(1) + raan(8) + ' '(1)
  //   + ecc(7) + ' '(1) + argp(8) + ' '(1) + ma(8) + ' '(1) + mm(11) + rev(5) = 68
  const body = `2 ${norad} ${incl} ${raan} ${ecc} ${argp} ${ma} ${mm}${rev}`;

  if (body.length !== 68) {
    throw new Error(`line2: expected 68, got ${body.length} for "${sat.name}"\n"${body}"`);
  }
  return body + tleChecksum(body);
}

function tlePair(sat) {
  const nameLine = sat.name.padEnd(24).substring(0, 24);
  return [nameLine, buildLine1(sat), buildLine2(sat)].join('\n');
}

// ── Catalogue ──────────────────────────────────────────────────────────────
// Epoch: 2026-001 (Jan 1, 2026).
// Mean motions & inclinations are accurate. RAAN/MA spread sats around globe.

const CATALOGUE = [
  // Space Stations (LEO)
  { name: 'ISS (ZARYA)',          noradId: 25544, intlDesig: '98067A',
    inc: 51.6402, raan: 120.0, ecc: 0.0002, argp:  90.0, ma: 270.0, mm: 15.5012,
    mmDot: 0.00002,  bstar: 0.000145, revNum: 46000 },
  { name: 'CSS (TIANHE)',         noradId: 48274, intlDesig: '21035A',
    inc: 41.4700, raan: 200.0, ecc: 0.0003, argp:  80.0, ma: 280.0, mm: 15.6149,
    mmDot: 0.000015, bstar: 0.000120, revNum: 10000 },

  // Science (LEO)
  { name: 'HST',                  noradId: 20580, intlDesig: '90037B',
    inc: 28.4700, raan: 180.0, ecc: 0.0003, argp:  70.0, ma: 290.0, mm: 15.0919,
    mmDot: 0.000005, bstar: 0.000050, revNum: 60000 },

  // Weather / Earth Obs (LEO Sun-sync ~98°)
  { name: 'NOAA 19',             noradId: 33591, intlDesig: '09005A',
    inc: 98.7000, raan: 250.0, ecc: 0.0015, argp:  90.0, ma: 270.0, mm: 14.1224,
    mmDot: 0.000001, bstar: 0.000010, revNum: 70000 },
  { name: 'TERRA',               noradId: 25994, intlDesig: '99068A',
    inc: 98.2000, raan: 260.0, ecc: 0.0001, argp:  90.0, ma: 180.0, mm: 14.5742,
    mmDot: 0.000001, bstar: 0.000005, revNum: 90000 },
  { name: 'AQUA',                noradId: 27424, intlDesig: '02022A',
    inc: 98.2000, raan:  80.0, ecc: 0.0002, argp:  90.0, ma:  90.0, mm: 14.5742,
    mmDot: 0.000001, bstar: 0.000008, revNum: 80000 },
  { name: 'LANDSAT 8',           noradId: 39084, intlDesig: '13008A',
    inc: 98.2200, raan: 100.0, ecc: 0.0001, argp:  90.0, ma:  45.0, mm: 14.5743,
    mmDot: 0.000001, bstar: 0.000005, revNum: 55000 },
  { name: 'SENTINEL-1A',         noradId: 39634, intlDesig: '14016A',
    inc: 98.1800, raan: 140.0, ecc: 0.0001, argp:  90.0, ma: 135.0, mm: 14.5272,
    mmDot: 0.000001, bstar: 0.000005, revNum: 50000 },

  // GEO (Weather & Communications, ~0°)
  { name: 'GOES 18',             noradId: 51850, intlDesig: '22021A',
    inc:  0.0700, raan:   0.0, ecc: 0.0001, argp:   0.0, ma:   0.0, mm: 1.00271,
    mmDot: 0, bstar: 0, revNum: 1000 },
  { name: 'GOES 16',             noradId: 41866, intlDesig: '16071A',
    inc:  0.0490, raan:   0.0, ecc: 0.0001, argp:   0.0, ma: 180.0, mm: 1.00271,
    mmDot: 0, bstar: 0, revNum: 3000 },
  { name: 'INTELSAT 901',        noradId: 26824, intlDesig: '01024A',
    inc:  0.0400, raan:   0.0, ecc: 0.0001, argp:   0.0, ma:  90.0, mm: 1.00270,
    mmDot: 0, bstar: 0, revNum: 8000 },
  { name: 'INTELSAT 905',        noradId: 27441, intlDesig: '02020A',
    inc:  0.0300, raan:   0.0, ecc: 0.0001, argp:   0.0, ma: 270.0, mm: 1.00270,
    mmDot: 0, bstar: 0, revNum: 7000 },

  // GPS Block II/IIF/IIIA (MEO ~55°)
  { name: 'GPS BIIRM-2 (PRN 31)', noradId: 29486, intlDesig: '06042A',
    inc: 55.1614, raan: 271.0, ecc: 0.0092, argp: 307.0, ma:  52.0, mm: 2.00562,
    mmDot: 0, bstar: 0, revNum: 13000 },
  { name: 'GPS BIIRM-5 (PRN 07)', noradId: 32711, intlDesig: '08012A',
    inc: 55.1000, raan: 151.0, ecc: 0.0120, argp:  10.0, ma: 350.0, mm: 2.00556,
    mmDot: 0, bstar: 0, revNum: 12000 },
  { name: 'GPS BIIF-2 (PRN 01)',  noradId: 35752, intlDesig: '09043A',
    inc: 55.4360, raan: 341.0, ecc: 0.0050, argp: 200.0, ma: 160.0, mm: 2.00553,
    mmDot: 0, bstar: 0, revNum: 11000 },
  { name: 'GPS BIIF-7 (PRN 12)',  noradId: 40534, intlDesig: '15013A',
    inc: 54.8300, raan:  91.0, ecc: 0.0100, argp: 100.0, ma: 260.0, mm: 2.00546,
    mmDot: 0, bstar: 0, revNum:  7000 },

  // GLONASS (MEO ~65°)
  { name: 'GLONASS-M 747',        noradId: 32276, intlDesig: '07065A',
    inc: 64.9900, raan: 100.0, ecc: 0.0001, argp:  90.0, ma: 270.0, mm: 2.13142,
    mmDot: 0, bstar: 0, revNum: 14000 },
  { name: 'GLONASS-M 748',        noradId: 32295, intlDesig: '07065C',
    inc: 64.9900, raan: 220.0, ecc: 0.0001, argp:  90.0, ma:  90.0, mm: 2.13142,
    mmDot: 0, bstar: 0, revNum: 14000 },
  { name: 'GLONASS-M 752',        noradId: 36111, intlDesig: '09070A',
    inc: 64.9900, raan: 340.0, ecc: 0.0002, argp:  90.0, ma: 180.0, mm: 2.13142,
    mmDot: 0, bstar: 0, revNum: 12000 },

  // Galileo (MEO ~56°)
  { name: 'GALILEO-PFM (E11)',    noradId: 37846, intlDesig: '12055B',
    inc: 56.0000, raan: 317.0, ecc: 0.0003, argp:  90.0, ma: 270.0, mm: 1.70476,
    mmDot: 0, bstar: 0, revNum: 11000 },
  { name: 'GALILEO-FM2 (E12)',    noradId: 37848, intlDesig: '12055D',
    inc: 56.0000, raan: 317.0, ecc: 0.0003, argp:  90.0, ma: 150.0, mm: 1.70476,
    mmDot: 0, bstar: 0, revNum: 11000 },
  { name: 'GALILEO-FM5 (E19)',    noradId: 40544, intlDesig: '15017A',
    inc: 56.0000, raan: 197.0, ecc: 0.0002, argp:  90.0, ma: 270.0, mm: 1.70476,
    mmDot: 0, bstar: 0, revNum:  9000 },
  { name: 'GALILEO-FM6 (E20)',    noradId: 40545, intlDesig: '15017B',
    inc: 56.0000, raan:  77.0, ecc: 0.0002, argp:  90.0, ma: 270.0, mm: 1.70476,
    mmDot: 0, bstar: 0, revNum:  9000 },

  // Starlink (LEO ~53°, 550 km) — sample spread across orbital planes
  { name: 'STARLINK-1007',        noradId: 44713, intlDesig: '19074G',
    inc: 53.0000, raan:  20.0, ecc: 0.0001, argp:  90.0, ma: 270.0, mm: 15.5000,
    mmDot: 0.00001, bstar: 0.0001, revNum: 20000 },
  { name: 'STARLINK-1008',        noradId: 44714, intlDesig: '19074H',
    inc: 53.0000, raan:  50.0, ecc: 0.0001, argp:  90.0, ma:  90.0, mm: 15.5000,
    mmDot: 0.00001, bstar: 0.0001, revNum: 20000 },
  { name: 'STARLINK-1009',        noradId: 44715, intlDesig: '19074J',
    inc: 53.0000, raan:  80.0, ecc: 0.0001, argp:  90.0, ma: 180.0, mm: 15.5000,
    mmDot: 0.00001, bstar: 0.0001, revNum: 20000 },
  { name: 'STARLINK-1010',        noradId: 44716, intlDesig: '19074K',
    inc: 53.0000, raan: 200.0, ecc: 0.0001, argp:  90.0, ma:   0.0, mm: 15.5000,
    mmDot: 0.00001, bstar: 0.0001, revNum: 20000 },
  { name: 'STARLINK-1011',        noradId: 44717, intlDesig: '19074L',
    inc: 53.0000, raan: 280.0, ecc: 0.0001, argp:  90.0, ma:  45.0, mm: 15.5000,
    mmDot: 0.00001, bstar: 0.0001, revNum: 20000 },

  // OneWeb (LEO ~87°, 1200 km)
  { name: 'ONEWEB-0008',          noradId: 44057, intlDesig: '19010B',
    inc: 87.4000, raan:  50.0, ecc: 0.0005, argp:  90.0, ma: 270.0, mm: 13.2709,
    mmDot: 0.000005, bstar: 0.00005, revNum: 15000 },
  { name: 'ONEWEB-0009',          noradId: 44058, intlDesig: '19010C',
    inc: 87.4000, raan: 230.0, ecc: 0.0005, argp:  90.0, ma:  90.0, mm: 13.2709,
    mmDot: 0.000005, bstar: 0.00005, revNum: 15000 },

  // Amateur Radio (LEO)
  { name: 'AO-7',                 noradId:  7530, intlDesig: '74089B',
    inc: 101.7800, raan: 150.0, ecc: 0.0012, argp:  90.0, ma: 270.0, mm: 13.7743,
    mmDot: 0, bstar: 0, revNum: 99999 },
];

// ── Generate ───────────────────────────────────────────────────────────────

// Verify TLE lines first
let errors = 0;
for (const sat of CATALOGUE) {
  try {
    const l1 = buildLine1(sat);
    const l2 = buildLine2(sat);
    if (l1.length !== 69) { console.error(`✗ ${sat.name} line1 length=${l1.length}`); errors++; }
    if (l2.length !== 69) { console.error(`✗ ${sat.name} line2 length=${l2.length}`); errors++; }
  } catch (err) {
    console.error(`✗ ${sat.name}: ${err.message}`);
    errors++;
  }
}
if (errors > 0) {
  console.error(`${errors} errors — aborting.`);
  process.exit(1);
}

const tleText = CATALOGUE.map(tlePair).join('\n');

const tsContent = `// lib/celestrak/fallbackTles.ts
// AUTO-GENERATED by scripts/generate-fallback-tles.mjs — do not edit manually.
// Used when CelesTrak is unreachable. Altitudes and inclinations are accurate.
// Epoch: 2026-01-01. Orbital longitudes are illustrative, not real-time.

/** Raw TLE text (3-line sets) for ${CATALOGUE.length} representative satellites. */
export const FALLBACK_TLE_TEXT = \`${tleText}
\`;

/** Snapshot date (ISO format). */
export const FALLBACK_SNAPSHOT_DATE = "2026-01-01";
`;

writeFileSync(OUT, tsContent, 'utf8');
console.log(`✓ Wrote ${CATALOGUE.length} satellites to lib/celestrak/fallbackTles.ts`);
console.log('✓ All TLE lines verified (69 chars each).');
