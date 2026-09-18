// The stylesheet this deployment hands the server for its landing page.
//
// The server ships a plain sheet of its own so that any instance reads without one. This site
// belongs to a family that has a design, so it supplies the family's instead — and supplies it
// by asking the design package for its own blocks rather than copying their bytes here, which
// is the same reason a page carries fences instead of a stylesheet somebody pasted once.
//
// Four blocks and no more. Tokens carries the colour ramp and both themes; the prose reset is
// what every prose page in the family declares first; the title contract is the two-part
// headline; the footer credit is the mark. The header, the nav and the stage are deliberately
// absent — this is one screen of prose and a table, with nowhere to navigate to.
//
// What follows them is this page's own layout, written against the tokens and against the class
// names `companygraph/mcp-server` documents as its markup contract. Those names are the seam: a
// rule here that invents a class the server does not emit styles nothing, silently.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blockFor } from "@robertblust/design/fences";

// The design package ships the font files the blocks name, and `tokens.css` states the rule the
// family holds itself to: nothing may name a family the site does not ship. This page has no
// static directory to serve them from — it is rendered by a server, not deployed as files — so
// they travel inside the stylesheet as data. Ninety-one kilobytes become about a hundred and
// twenty-five base64, paid on a visit to one page that is otherwise five. The alternative was a
// static route in a package that has no business growing one.
const FONT_DIR = fileURLToPath(new URL("../node_modules/@robertblust/design/assets/fonts/", import.meta.url));
const FONTS = [
  { family: "Bricolage Grotesque", file: "Bricolage-var.woff2", weight: "200 800" },
  { family: "Instrument Sans", file: "InstrumentSans-var.woff2", weight: "400 700" },
  { family: "Plex Mono", file: "PlexMono-400.woff2", weight: "400" },
  { family: "Plex Mono", file: "PlexMono-600.woff2", weight: "600" },
];

// One `src` per face, not the two a site writes. A page serving these from `/fonts/` names the
// same file twice, as `woff2-variations` and as `woff2`, and pays nothing for the second; here
// the second would be a second copy of the bytes, and the file doubled to 230 kilobytes before
// anyone noticed. Every browser that supports variable fonts reads them from plain `woff2`.
const faces = FONTS.map(({ family, file, weight }) => {
  const b64 = fs.readFileSync(path.join(FONT_DIR, file)).toString("base64");
  return `  @font-face{font-family:"${family}";`
    + `src:url(data:font/woff2;base64,${b64}) format("woff2");`
    + `font-weight:${weight};font-display:swap}`;
}).join("\n");

const OUT = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), "page.css");

// `design tokens` is the one fence whose stored block stops before the closing brace: a prose
// page closes `:root` inside the fence and a deck leaves it open. This page is prose.
const tokens = `${blockFor("design tokens", "page")}\n  }`;
const reset = blockFor("prose reset", null);
const title = blockFor("title contract", null);

const own = `
  /* The page's own layout. Everything above is the design package's, and moves with it. */
  body { background: var(--ground); color: var(--ink); padding: 4rem 1.25rem 6rem; }
  main { width: 100%; max-width: 1180px; margin: 0 auto; padding: 0 min(7vw, 80px); }

  /* The shapes guestgraph.io/api/ uses, so the two read as one family: a Bricolage h2, prose
     at 62ch in --dim, and one marked block per page in --c-flag. The tokens say that colour is
     a reversal and never decoration — here it marks the sentence where the server says what it
     does not do, which is the only claim on the page a reader has to take on trust. */
  h2 { font-family: "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif;
       font-weight: 700; letter-spacing: -.025em; line-height: 1.06;
       font-size: clamp(1.35rem, 2.3vw, 1.8rem); color: var(--ink);
       margin: clamp(2.6rem, 6vh, 4rem) 0 .2rem; }
  p { margin: 0 0 1rem; max-width: 62ch; }
  .lede { margin-top: .9rem; margin-bottom: 0; font-size: 1rem; color: var(--dim);
          max-width: 62ch; }
  .note { margin: 2rem 0; max-width: 56ch; padding-left: 1rem;
          border-left: 2px solid var(--c-flag); color: var(--ink); font-size: 1rem; }
  .note p { margin: 0 0 .8rem; max-width: none; }
  .note p:last-child { margin-bottom: 0; }
  .title { margin-bottom: .4rem; }
  a { color: var(--c-mid); }
  a:hover, a:focus-visible { color: var(--ink); }
  code, pre, .mono { font-family: "Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace; }
  code, pre { font-size: .88em; }
  pre, code.addr { background: var(--raise); border: 1px solid var(--rule); border-radius: 6px; }
  pre { padding: .85rem 1rem; overflow-x: auto; }
  code.addr { padding: .25rem .5rem; color: var(--c-mid); }

  /* The row the API page lists an operation with, reused for both lists here: the paths the
     server answers, and the tools it answers them with. A card at rest, scannable in one pass,
     the method in the accent and the summary in prose beside it. Nothing here opens, because
     neither list has a detail to hide: the API page's rows are disclosures and these are not,
     which is why the shared shape is the head row rather than the summary element. */
  .ops { margin-top: 1.3rem; padding: 0; list-style: none; display: grid; gap: .55rem; }
  .ops > li { background: var(--raise); border: 1px solid var(--rule); border-radius: 8px; }
  .ops .head { display: grid; gap: .15rem .9rem; align-items: baseline;
               grid-template-columns: minmax(0, 1fr); padding: .5rem .75rem; }
  .ops .m { font-size: .74rem; font-weight: 600; letter-spacing: .08em; color: var(--c-mid); }
  .ops .p { font-size: .9rem; color: var(--ink); }
  .ops .s { font-size: .93rem; color: var(--dim); }
  .ops .s code { color: var(--ink); }

  @media (min-width: 780px) {
    /* Narrower than the API page's 21rem path column: these paths are /mcp and /, and that
       measure was cut for /apaleo/events/{secret}. Same grid, sized for what it holds. */
    .ops .head { grid-template-columns: 3.6rem minmax(0, 7rem) minmax(0, 1fr); }
    /* A tool has no method, so its two columns start where the path's does. */
    .ops.tools .head { grid-template-columns: minmax(0, 12rem) minmax(0, 1fr); }
  }

  footer { margin-top: 2.6rem; padding-top: 1.25rem; border-top: 1px solid var(--rule);
           font-family: "Plex Mono", ui-monospace, monospace; font-size: .78rem;
           letter-spacing: .06em; color: var(--dim); }
  footer a { color: inherit; }
  footer a:hover, footer a:focus-visible { color: var(--c-mid); }

  @media (max-width: 34rem) {
    body { padding: 2.5rem 0 4rem; }
  }
`;

fs.writeFileSync(OUT, [faces, tokens, reset, title, own].join("\n\n") + "\n");
console.log(`wrote ${OUT}: ${fs.statSync(OUT).size} bytes from the design package's own blocks`);
