/**
 * Cinematic demo recorder: 1920x1080, visible cursor, eased scrolling,
 * zoom holds on the moments that matter, and hover states on cards.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = process.env.APP ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? './video';
const SPEED = Number(process.env.SPEED ?? 1);
const RECORD = process.env.RECORD !== '0';
const pause = (ms) => new Promise((r) => setTimeout(r, ms / SPEED));
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  ...(RECORD ? { recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } } } : {}),
});

/** A drawn cursor: headless Chromium renders no pointer, so we draw one. */
await context.addInitScript(() => {
  const install = () => {
    if (document.getElementById('__cur')) return;
    const c = document.createElement('div');
    c.id = '__cur';
    c.style.cssText = [
      'position:fixed', 'z-index:2147483647', 'width:24px', 'height:24px',
      'margin:-12px 0 0 -12px', 'border-radius:50%',
      'background:rgba(245,158,11,0.30)', 'border:2.5px solid #f59e0b',
      'box-shadow:0 2px 10px rgba(0,0,0,.25)', 'pointer-events:none',
      'left:-200px', 'top:-200px', 'transition:transform 120ms ease-out',
    ].join(';');
    document.documentElement.appendChild(c);
    window.__cur = {
      to: (x, y) => { c.style.left = x + 'px'; c.style.top = y + 'px'; },
      tap: () => { c.style.transform = 'scale(0.55)'; setTimeout(() => (c.style.transform = 'scale(1)'), 160); },
    };

    // Caption bar. Rendered in-page so it is burned in at record time and
    // cannot drift out of sync - this ffmpeg has no libass to burn an SRT.
    const cap = document.createElement('div');
    cap.id = '__cap';
    cap.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:30px', 'transform:translateX(-50%)',
      'z-index:2147483646', 'max-width:1100px', 'padding:14px 26px',
      'background:rgba(17,24,39,0.90)', 'color:#fff', 'border-radius:10px',
      'font:600 27px/1.38 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      'text-align:center', 'white-space:pre-line', 'pointer-events:none',
      'opacity:0', 'transition:opacity 220ms ease', 'letter-spacing:.1px',
      'box-shadow:0 8px 30px rgba(0,0,0,.35)',
    ].join(';');
    document.documentElement.appendChild(cap);
    // Reserve room so the caption bar never covers a button or field.
    document.body.style.paddingBottom = '150px';
    window.__say = (t) => {
      if (!t) { cap.style.opacity = '0'; return; }
      cap.textContent = t;
      cap.style.opacity = '1';
    };
  };
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', install)
    : install();
});

const page = await context.newPage();
const t0 = Date.now();
const marks = [];
const mark = (what) => { marks.push({ what, at: (Date.now() - t0) / 1000 }); console.log(`  ${((Date.now()-t0)/1000).toFixed(1)}s  ${what}`); };

const lines = [];
async function say(text) {
  lines.push({ at: (Date.now() - t0) / 1000, text });
  await page.evaluate((t) => window.__say?.(t), text).catch(() => {});
}

let cx = 960, cy = 540;
async function glide(x, y, ms = 420) {
  const steps = Math.max(8, Math.round(ms / 22));
  const sx = cx, sy = cy;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;   // easeInOutQuad
    const nx = sx + (x - sx) * e, ny = sy + (y - sy) * e;
    await page.mouse.move(nx, ny);
    await page.evaluate(([a, b]) => window.__cur?.to(a, b), [nx, ny]);
    await new Promise((r) => setTimeout(r, ms / steps / SPEED));
  }
  cx = x; cy = y;
}

async function pointAt(locator, ms = 420) {
  const box = await locator.boundingBox();
  if (!box) return;
  await glide(box.x + box.width / 2, box.y + Math.min(box.height / 2, 26), ms);
}

async function tap(locator, { settle = 700 } = {}) {
  await pointAt(locator);
  await page.evaluate(() => window.__cur?.tap());
  await pause(180);
  await locator.click();
  await pause(settle);
}

async function typeInto(locator, text, delay = 55) {
  await pointAt(locator, 320);
  await locator.click();
  await locator.fill('');
  await locator.type(text, { delay: delay / SPEED });
}

/** Eased scroll - the default jump looks like a cut. */
async function scrollBy(distance, ms = 1100) {
  await page.evaluate(
    ([d, dur]) =>
      new Promise((res) => {
        const start = window.scrollY, t = performance.now();
        const ease = (x) => (x < 0.5 ? 2 * x * x : -1 + (4 - 2 * x) * x);
        const step = (now) => {
          const p = Math.min(1, (now - t) / dur);
          window.scrollTo(0, start + d * ease(p));
          p < 1 ? requestAnimationFrame(step) : res();
        };
        requestAnimationFrame(step);
      }),
    [distance, ms / SPEED],
  );
}

/** Zoom toward an element, hold, then release. Keeps text crisp (it's a transform, not an upscale). */
async function zoomHold(selector, scale = 1.18, holdMs = 2200, ms = 800) {
  await page.evaluate(
    ([sel, s, dur]) => {
      const el = document.querySelector(sel);
      const r = el?.getBoundingClientRect();
      const ox = r ? r.left + r.width / 2 : innerWidth / 2;
      const oy = r ? r.top + r.height / 2 : innerHeight / 2;
      const b = document.body;
      b.style.transition = `transform ${dur}ms cubic-bezier(.4,0,.2,1)`;
      b.style.transformOrigin = `${ox}px ${oy}px`;
      b.style.transform = `scale(${s})`;
    },
    [selector, scale, ms / SPEED],
  );
  await pause(ms + holdMs);
  await page.evaluate(() => { document.body.style.transform = 'scale(1)'; });
  await pause(ms);
}

async function actAs(fragment) {
  const all = page.getByLabel('Acting as');
  let sel = null;
  for (let i = 0; i < (await all.count()); i++) if (await all.nth(i).isVisible()) { sel = all.nth(i); break; }
  const value = await sel.evaluate((el, f) => [...el.options].find((o) => o.textContent.includes(f))?.value ?? null, fragment);
  await pointAt(sel, 350);
  await sel.selectOption(value);
  await pause(1100);
}

try {
  // ── Home ───────────────────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await pause(1200);
  await actAs('Furniture Workshop A');
  mark('home');
  await say("A Mumbai furniture workshop produces 80 kg\nof clean plywood offcuts every week.");
  await glide(700, 300, 700); await pause(1400);
  await zoomHold('h1', 1.12, 1600, 700);
  await scrollBy(430, 1300); await pause(900);
  mark('categories');
  await say("Two kilometres away, a decor business\nbuys new wood for the same job.");
  await pointAt(page.getByRole('link', { name: /Wood & plywood offcuts/ }).first(), 600);
  await pause(1100);
  await scrollBy(420, 1300); await pause(800);
  mark('rails');
  await say("Neither knows the other exists. The material\nhas value \u2014 what's missing is coordination.");
  const firstCard = page.locator('article').first();
  await pointAt(firstCard, 700); await pause(1500);
  await scrollBy(-830, 1200); await pause(700);

  // ── List surplus ───────────────────────────────────────────────────────
  await tap(page.getByRole('link', { name: /List surplus/i }).first(), { settle: 1400 });
  mark('list-surplus');
  await say("The workshop lists its surplus:\nquantity, condition, and the dimensions.");
  await tap(page.getByRole('radio', { name: 'Wood & plywood offcuts' }), { settle: 800 });
  await typeInto(page.getByLabel('Title *'), 'Plywood offcuts, clean and dry');
  await pause(500);
  await scrollBy(320, 900);
  await typeInto(page.getByLabel('Quantity *'), '80', 110);
  await pause(400);
  await tap(page.getByRole('radio', { name: 'Clean, usable' }), { settle: 500 });
  await typeInto(page.getByLabel('Smallest piece size (cm) *'), '15', 110);
  await typeInto(page.getByLabel('Largest piece size (cm) *'), '40', 110);
  await pause(400);
  await tap(page.getByRole('radio', { name: 'No', exact: true }).first(), { settle: 500 });
  await scrollBy(360, 900);
  await page.getByLabel('Available from *').fill(day(0));
  await page.getByLabel('Available until *').fill(day(3));
  await pause(900);
  mark('submit-listing');
  await say("80 kg of clean, untreated offcuts,\n15 to 40 cm, available for three days.");
  await tap(page.getByRole('button', { name: 'List surplus material' }), { settle: 2600 });

  // ── Buyer ──────────────────────────────────────────────────────────────
  await actAs('Decor & Packaging Business B');
  mark('buyer');
  await say("Now the other side. The decor business\nsays what it needs.");
  await tap(page.getByRole('link', { name: /Post a requirement/i }).first(), { settle: 1500 });
  await tap(page.getByRole('radio', { name: 'Wood & plywood offcuts' }), { settle: 800 });
  await typeInto(page.getByLabel('Quantity needed *'), '50', 110);
  await page.getByLabel('Needed by *').fill(day(2));
  await pause(700);
  await scrollBy(340, 900);
  await tap(page.getByRole('checkbox', { name: 'Unused' }), { settle: 400 });
  await tap(page.getByRole('checkbox', { name: 'Clean, usable' }), { settle: 500 });
  await typeInto(page.getByLabel('Minimum usable piece size (cm)'), '10', 110);
  await pause(800);
  await scrollBy(420, 900);
  mark('find-matches');
  await say("50 kg, nothing under 10 cm, untreated,\nwithin 15 kilometres.");
  await tap(page.getByRole('button', { name: /Find matching surplus/i }), { settle: 3000 });

  // ── THE MOMENT ─────────────────────────────────────────────────────────
  mark('checks');
  await say("One compatible match \u2014\nand it shows exactly why.");
  await pause(1500);
  await zoomHold('ul', 1.22, 2400, 900);          // hold on the six checks
  await say("Category, quantity, minimum size, condition,\navailability window, distance.");
  await pause(2600);
  await say("Six checks, in plain words.\nNo relevance score, no black box.");
  await pause(2400);
  await scrollBy(300, 1000); await pause(1200);
  mark('near-misses');
  await say("Two nearby listings didn't match \u2014 and it\nsays which check each one failed.");
  const reasons = page.getByRole('button', { name: /Show reasons/i });
  if (await reasons.count()) await tap(reasons.first(), { settle: 2600 });
  await scrollBy(340, 1100); await pause(2600);
  await scrollBy(-520, 1000); await pause(800);

  // ── Reserve ────────────────────────────────────────────────────────────
  mark('reserve');
  await say("Reserve 50 of the 80. Partial reservation\nis the normal case, not an edge case.");
  await tap(page.getByRole('button', { name: /^Reserve/i }).first(), { settle: 2400 });
  await zoomHold('dl', 1.15, 2400, 800);
  mark('confirm');
  await say("A conditional write in DynamoDB makes\nover-reservation impossible.");
  await tap(page.getByRole('button', { name: /Confirm reservation/i }), { settle: 3000 });

  // ── Handoff ────────────────────────────────────────────────────────────
  await actAs('Furniture Workshop A');
  mark('handoff');
  await say("The supplier confirms the material\nphysically changed hands.");
  await page.goto(`${BASE}/dashboard?tab=incoming`, { waitUntil: 'networkidle' });
  await pause(2200);
  await tap(page.getByRole('button', { name: /Confirm handoff/i }).first(), { settle: 1500 });
  await tap(page.getByRole('button', { name: /Confirm handoff/i }).last(), { settle: 3000 });

  // ── Impact ─────────────────────────────────────────────────────────────
  mark('impact');
  await say("Only then is it recorded as reuse \u2014\nmeasured, not estimated.");
  await page.goto(`${BASE}/impact`, { waitUntil: 'networkidle' });
  await pause(1800);
  await zoomHold('p', 1.16, 2600, 800);
  await scrollBy(330, 1100); await pause(2600);
  await say("50 kg redirected through a single match.");
  await pause(2200);
  mark('end');
  console.log('  DONE');
  writeFileSync(`${OUT}/marks.json`, JSON.stringify(marks, null, 2));
  writeFileSync(`${OUT}/lines.json`, JSON.stringify(lines, null, 2));
} catch (err) {
  console.error('  FAILED:', err.message.split('\n')[0]);
  await page.screenshot({ path: `${OUT}/failure.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
