# Hero loop video

AI-generated b-roll for demo hero backgrounds (工務店・住宅系).

| File | Spec |
|---|---|
| `hero-loop.mp4` | 1280×720, 20s, H.264, ~4MB |
| `hero-loop.webm` | VP9, 20s, ~2MB |
| `hero-loop-poster.jpg` | First-frame poster for LCP / no-JS fallback |

## Usage

```html
<video autoplay muted loop playsinline poster="../shared/video/hero-loop-poster.jpg">
  <source src="../shared/video/hero-loop.webm" type="video/webm" />
  <source src="../shared/video/hero-loop.mp4" type="video/mp4" />
</video>
```

Integrated in **E案** (`e-taisei/index.html`). Other skins can reference the same files.

## Source clips

12 clips × ~1.7s (trimmed from 4s AI generations). Raw clips in `clips/` are build artifacts — not required for deploy.

Generated with Seedance 2.5 via Higgsfield (2026-09-02). Replace with client footage after buyout.
