# Mascot source assets

Everything here is *source*, not shipped. Vite copies `public/` into the build
and the PWA precaches it, so raw art lives here instead and the scripts write
their (much smaller) output into `public/`.

## Files

| File | Feeds | Rebuild with |
|---|---|---|
| `faraday-sheet.png` | the six pose PNGs | `node scripts/slice-mascot.mjs` |
| `faraday-icon.png` | favicon + apple-touch icon | `node scripts/make-favicon.mjs` |

Both arrived as JPEG data with a `.png` name — check the signature before
assuming otherwise (`ff d8` is JPEG, `89 50 4e 47` is PNG). Convert with
Windows' own imaging stack; no install needed:

```powershell
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($p)
$bmp = New-Object System.Drawing.Bitmap $img.Width, $img.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
([System.Drawing.Graphics]::FromImage($bmp)).DrawImage($img, 0, 0, $img.Width, $img.Height)
$bmp.Save("$p.tmp", [System.Drawing.Imaging.ImageFormat]::Png)
```

## Video clips — `video/`

Source clips for the poses and the celebration animation, kept so the frames
can be re-cut without re-generating. Re-encoded at CRF 30, no audio, original
720x1280 (resolution is kept deliberately: downscaling would soften the
outlines the background key relies on).

| Clip | Purpose | Used from it |
|---|---|---|
| `poses-v1-grey.mp4` | first pose attempt, grey backdrop | nothing — superseded, kept as the counter-example |
| `poses-v2-magenta.mp4` | pose library, magenta backdrop, 2s holds | holds at 3.35s, 5.35s, 7.2s, 9.0s → `point`, `thumbsup` |
| `celebration.mp4` | celebration | 12 frames, 4.90s–6.00s at 0.1s → `faraday-celebrate.png` |

7.5MB of original MP4 compressed to 1.7MB. Verified fit for purpose: the sprite
re-cut from the compressed `celebration.mp4` matches the one built from the
original to within 0.6% transparent area, with zero magenta fringe either way.

Rebuild with `scripts/extract-poses.mjs` (stills) or `scripts/make-sprite.mjs`
(strips); both document their ffmpeg frame-grab. ffmpeg is a dev-machine tool
here, not a project dependency — nothing in `npm run build` needs it.

## Prompt notes for the next generation

What worked, and what to keep saying:

- **Flat magenta backdrop.** His palette has no magenta, so the edge-in flood
  fill keys it exactly. The first clip's grey backdrop sat too close to his hair
  and outlines.
- **"Hold each pose 2 seconds."** A held pose is a fully-drawn frame for free,
  and holds are trivial to find by sampling motion.
- **"No motion blur."** A blurred frame cannot be a sprite, and it smears the
  outline the flood fill needs.
- **Nothing in the outer 10% of frame.** Raised arms otherwise clip in a
  circular crop.

What did *not* take, and needs saying harder:

- **Framing.** Both clips came back full-body despite asking for head and
  shoulders, which pushes the head small. Try: "the character fills the frame
  from the top of his hair to mid-chest; never show the waist."
- **Clip length.** A 1.5s loop was requested; both came back 10s. Ask for a
  single cycle and expect to find the usable window yourself.
- **Seamless loops.** Neither clip contained one — the celebration is a
  continuous performance, which is why it ships as a one-shot rather than a
  looping idle.
