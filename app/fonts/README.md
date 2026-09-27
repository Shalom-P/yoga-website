# Self-hosted brand fonts

`app/layout.tsx` used to load these five families with `next/font/google`, which
downloads them from Google Fonts during `next build`. Google Fonts sometimes
answers with extensionless `https://fonts.gstatic.com/l/font?kit=…&skey=…&v=…`
URLs instead of `/s/…/*.woff2`, and Next's loader cannot handle them
([vercel/next.js#99114](https://github.com/vercel/next.js/issues/99114), still
open on 2026-09-27; the fixes, vercel/next.js#99132 and vercel/next.js#99308,
were unmerged). The production build then fails with
`Can't resolve '@vercel/turbopack-next/internal/font/google/font'` /
`next/font/google queries have exactly one entry`, at random. `next build
--webpack` breaks on the same URLs. Serving the files from here takes Google out
of the build entirely.

The files are the exact bytes Google served for the old `next/font/google`
options, fetched on 2026-09-27. They are byte-identical to what
www.myyogaclasses.fit was serving that day, so Latin text, the ₹ included,
renders exactly as before. Only the `latin` and `latin-ext` subsets are kept:
Cyrillic, Greek and Vietnamese letters, which Google also served, now come from
the fallback fonts. `index.ts` loads the files and explains the
two-loaders-per-family setup; `app/globals.css` joins each pair into the
`--font-*` variable the stylesheets read.

| File | Family | Style | Subset | Upstream |
| --- | --- | --- | --- | --- |
| `inter-latin.woff2` | Inter | normal | latin | https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7W0Q5nw.woff2 |
| `inter-latin-ext.woff2` | Inter | normal | latin-ext | https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa25L7W0Q5n-wU.woff2 |
| `fraunces-latin.woff2` | Fraunces | normal | latin | https://fonts.gstatic.com/s/fraunces/v38/6NUI8FyLNQOQZAnv9bYEvCeYdG9Ea92uemAO8UikR_BPug.woff2 |
| `fraunces-latin-ext.woff2` | Fraunces | normal | latin-ext | https://fonts.gstatic.com/s/fraunces/v38/6NUI8FyLNQOQZAnv9bYEvCeYdG9Ea92uemAO_0ikR_BPumo3.woff2 |
| `geist-mono-latin.woff2` | Geist Mono | normal | latin | https://fonts.gstatic.com/s/geistmono/v6/or3nQ6H-1_WfwkMZI_qYFrcdmhHkjko.woff2 |
| `geist-mono-latin-ext.woff2` | Geist Mono | normal | latin-ext | https://fonts.gstatic.com/s/geistmono/v6/or3nQ6H-1_WfwkMZI_qYFrkdmhHkjkotbA.woff2 |
| `cormorant-garamond-latin.woff2` | Cormorant Garamond | normal | latin | https://fonts.gstatic.com/s/cormorantgaramond/v21/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYqXtKky2F7g.woff2 |
| `cormorant-garamond-latin-ext.woff2` | Cormorant Garamond | normal | latin-ext | https://fonts.gstatic.com/s/cormorantgaramond/v21/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYp3tKky2F7i6C.woff2 |
| `cormorant-garamond-italic-latin.woff2` | Cormorant Garamond | italic | latin | https://fonts.gstatic.com/s/cormorantgaramond/v21/co3ZmX5slCNuHLi8bLeY9MK7whWMhyjYrEtImSqn7B6D.woff2 |
| `cormorant-garamond-italic-latin-ext.woff2` | Cormorant Garamond | italic | latin-ext | https://fonts.gstatic.com/s/cormorantgaramond/v21/co3ZmX5slCNuHLi8bLeY9MK7whWMhyjYrEtGmSqn7B6DxjY.woff2 |
| `hanken-grotesk-latin.woff2` | Hanken Grotesk | normal | latin | https://fonts.gstatic.com/s/hankengrotesk/v12/ieVn2YZDLWuGJpnzaiwFXS9tYtpd59CxCis4.woff2 |
| `hanken-grotesk-latin-ext.woff2` | Hanken Grotesk | normal | latin-ext | https://fonts.gstatic.com/s/hankengrotesk/v12/ieVn2YZDLWuGJpnzaiwFXS9tYtpT59CxCis4UvI.woff2 |

## Updating

These are the stylesheet requests the old options produced. Fetch one with a
current desktop Chrome user agent (Google picks the format from it), take the
`/* latin */` and `/* latin-ext */` `@font-face` blocks, download their `src`
URLs and replace the files, keeping the names:

- `https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap`
- `https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,100..900,0..100&display=swap`
- `https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap`
- `https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap`
- `https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&display=swap`

If Google's latin or latin-ext `unicode-range` has changed, update `index.ts` to
match. The size-adjusted fallback faces in `app/globals.css` carry the metrics
`next/font/google` generated for these families; revisit them only if a family's
proportions change.

The `@fontsource-variable/*` packages carry the same fonts but not the same
files: they add a hinting `prep` table, encode Cormorant's kerning differently,
and have no Fraunces build with exactly the weight, optical-size and softness
axes used here. That is why the files come straight from Google.

## License

All five families are under the SIL Open Font License 1.1. The copyright
notices and license text are in `OFL.txt`.
