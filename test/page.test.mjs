// What the landing page has to be true of, asserted against the rendered page rather than
// against the stylesheet that produces it.
//
// The design system's own position is that a contract is an outcome and not a declaration:
// `header.css` leaves the brand lockup and the bar's gap to each site, on purpose, and
// `verify/pages.mjs` measures the result instead — "the wordmark broke" is a height compared
// against a height, not a rule compared against a rule. The three sites are covered that way.
// This page is not, because it is rendered by a server rather than deployed as files, and
// nothing in that suite can crawl it.
//
// So it gets the same treatment here, narrowed to what this page actually has. Every assertion
// below is a mistake that was made while building it and would have been caught by nobody:
//
//   the shell     an extra closing brace on the tokens fence swallowed the rule after it, and
//                 the content ran the full 1180 with no gutter — 160px wider than every other
//                 page in the family. Nothing failed; the sheet parsed and the page rendered.
//   the header    the body carried top padding where blust.ch carries none, which put the mark
//                 22 pixels below where every sibling puts it.
//   the wordmark  the page's own `a` rule painted the whole lockup in the link color, where
//                 the family leaves a link inheriting and colors one span of it.
//
// A browser is the only thing that can see any of those, which is why this file is the one
// place in this repository that needs one.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createHttpServer } from "companygraph-mcp-server/http";
import fs from "node:fs";

const snapshot = JSON.parse(fs.readFileSync(new URL("../snapshot.json", import.meta.url), "utf8"));
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

let server, browser, base;

before(async () => {
  server = createHttpServer(snapshot, {
    pageCss: read("page.css"),
    pageBrand: read("brand.html").trim(),
    pageIcon: `data:image/svg+xml;base64,${fs.readFileSync(new URL("../favicon.svg", import.meta.url)).toString("base64")}`,
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.close();
});

// The shell every prose page in the family sits in: 1180 at most, and a gutter that grows with
// the viewport until it reaches 80 and stops. Asserted as the rule that applied, because that
// is what a stray brace takes away — the rendered width alone would not say why it was wrong.
test("the content sits in the family's shell", async () => {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(base, { waitUntil: "networkidle" });
  const shell = await page.evaluate(() => {
    const m = document.querySelector("main");
    const cs = getComputedStyle(m);
    const box = m.getBoundingClientRect();
    return {
      maxWidth: cs.maxWidth, padLeft: cs.paddingLeft,
      padRight: cs.paddingRight, outer: Math.round(box.width),
      bodyPadTop: getComputedStyle(document.body).paddingTop,
    };
  });
  assert.equal(shell.maxWidth, "1180px", "the shell caps at the family's measure");
  assert.equal(shell.padLeft, "80px", "the gutter reached its stop");
  assert.equal(shell.padRight, "80px", "and on both sides");
  assert.equal(shell.outer, 1180, "the shell is as wide as it may be at this viewport");
  assert.equal(shell.bodyPadTop, "0px", "the space above the header is the header's, not the body's");
  await page.close();
});

// Where the mark sits, in the numbers a sibling page puts it at: 2rem of header padding above
// it, and the shell's own gutter to its left.
test("the mark sits where every sibling puts it", async () => {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(base, { waitUntil: "networkidle" });
  const mark = await page.evaluate(() => {
    const r = document.querySelector(".brand svg").getBoundingClientRect();
    return { left: Math.round(r.left), top: Math.round(r.top), size: Math.round(r.height) };
  });
  // (1400 − 1180) / 2 centers the shell, and 80 is its gutter.
  assert.equal(mark.left, 190, "the mark starts at the shell's gutter");
  assert.equal(mark.size, 28, "the mark is the family's 28px");
  // 2rem above, and the mark centered in a row no taller than itself.
  assert.ok(mark.top >= 30 && mark.top <= 34, `the mark sits under 2rem of header, at ${mark.top}px`);
  await page.close();
});

// The wordmark is two halves and reads as two halves: the name in the page's ink, the second
// word in the accent. One rule painting the whole link takes that apart without breaking
// anything a parser would notice.
test("the wordmark is two colors, and the second is the accent", async () => {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(base, { waitUntil: "networkidle" });
  const colors = await page.evaluate(() => {
    const b = document.querySelector(".brand b");
    const span = b.querySelector("span");
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--c-mid").trim();
    const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
    const hex = (el) => getComputedStyle(el).color;
    const asRgb = (v) => { const d = document.createElement("i"); d.style.color = v; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; };
    return { b: hex(b), span: hex(span), accent: asRgb(accent), ink: asRgb(ink) };
  });
  assert.equal(colors.span, colors.accent, "the second word is the accent");
  assert.equal(colors.b, colors.ink, "the first is the page's ink");
  assert.notEqual(colors.b, colors.span, "and the two are not the same color");
  await page.close();
});

// The check the design system runs against every page it covers, in its own words: the brand is
// one line and the page does not scroll sideways on the narrowest phone it is written for.
test("on a phone the wordmark holds and nothing scrolls sideways", async () => {
  const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
  await page.goto(base, { waitUntil: "networkidle" });
  const shut = await page.evaluate(() => ({
    brand: Math.round(document.querySelector(".brand").getBoundingClientRect().height),
    mark: Math.round(document.querySelector(".brand svg").getBoundingClientRect().height),
    wide: document.documentElement.scrollWidth > window.innerWidth,
  }));
  assert.ok(shut.brand <= shut.mark,
    `the wordmark broke: the brand is ${shut.brand}px against a ${shut.mark}px mark`);
  assert.ok(!shut.wide, "the page scrolls sideways");
  await page.close();
});

// The one link that is not decoration: a reader who arrived from a registry listing and wants
// the person behind the server. It comes from the identity's own `url`, so this asserts the
// page took it rather than that anyone typed it.
test("the brand links the address the model gives for itself", async () => {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(base, { waitUntil: "networkidle" });
  const href = await page.getAttribute(".brand", "href");
  const identity = snapshot.entities.find((e) => e.id === snapshot.rootId);
  assert.equal(href, identity.fields.url, "the brand links the identity's url");
  await page.close();
});
