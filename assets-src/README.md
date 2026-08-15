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

## Video clips

Three 720x1280 clips were generated to source poses and the celebration
animation. They are **not committed** — 7.5MB of MP4 to produce ~140KB of
shipped PNG is a bad trade for a repo, and every frame worth keeping is already
extracted. Keep the originals off-repo; this table is the record of what came
from where.

| Clip | Purpose | Used from it |
|---|---|---|
| `Using_the_attached_character_a.mp4` | first pose attempt, grey backdrop | nothing — superseded |
| `..._a (1).mp4` | pose library, magenta backdrop, 2s holds | holds at 3.35s, 5.35s, 7.2s, 9.0s → `point`, `thumbsup` |
| `..._a (2).mp4` | celebration | 12 frames, 4.90s–6.00s at 0.1s → `faraday-celebrate.png` |

Rebuild from frames with `scripts/extract-poses.mjs` (stills) or
`scripts/make-sprite.mjs` (strips). Both document the PowerShell frame-grab in
their headers — Windows scrubs and renders PNGs, so no ffmpeg install.

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
