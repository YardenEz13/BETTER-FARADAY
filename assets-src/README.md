# Mascot source assets

Everything here is *source*, not shipped. Vite copies `public/` into the build
and the PWA precaches it, so raw art lives here instead and the scripts write
their (much smaller) output into `public/`.

## Files

| File | Feeds | Rebuild with |
|---|---|---|
| `faraday-sheet.png` | the six pose PNGs | `node scripts/slice-mascot.mjs` |
| `faraday-sheet.png` | `faraday-rig/` — the rig layers | `node scripts/cut-rig-layers.mjs` |
| `faraday-icon.png` | favicon + apple-touch icon | `node scripts/make-favicon.mjs` |

`faraday-icon.png` is a *different drawing* — shaded hair, wrinkles, a white
collar. Only the favicon uses it. `faraday-sheet.png` is the canonical model;
generate against that one.

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

## Rig layers — `faraday-rig/`

The idle Faraday cut into 12 separately-movable parts, for the Rive rig test in
`docs/mascot-plan.md` §14. Source-only, never shipped: the app still renders the
flat pose PNGs in `public/`.

Every layer is written on the same 1024x1024 canvas, so importing the folder
into Rive stacks them in register with no offsets to re-enter. `manifest.json`
carries each layer's pixel count, bounding box and a suggested pivot;
`_stack.png` is the flattened result, and the script fails if it does not put
back at least 90% of the source character.

| Layers | |
|---|---|
| structure | `jacket` `collar` `bowtie` `hair` `head` |
| face | `eye-white-a/b` `pupil-a/b` `brow-a/b` `mouth` |

`a`/`b` are positions **in the artwork**, never `left`/`right` or `start`/`end`
— the drawing does not mirror under RTL. Same rule as `.faraday-25d-wing-a` in
`src/index.css`.

### What this cut can and cannot do

Verified by moving the parts: the pupils slide over a full white sclera, and the
brows lift off clean skin, both with no hole where the part used to be. The
inpainting is exact rather than guessed — those regions are closed shapes, so
they are filled with their own colour, not with invented pixels.

Two ceilings, neither fixable here:

- **The hair is one mass**, not a swoop and two wings. It is a single connected
  white region in this drawing.
- **The face outline is drawn where the hair overlaps it**, so the head has a
  bite out of it under each hair wing. Move the hair more than ~15px at 1024 and
  a white seam opens along the hairline.

Both need the redraw in `docs/mascot-plan.md` §5.3. This cut exists to answer
whether that redraw is worth buying.

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
| `typing-loop.mp4` | chat typing indicator | 12 frames, 2.617s–3.45s → `faraday-typing.png`, head-cropped |

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

- **Framing.** Asking for "head and shoulders" was ignored twice and gave
  full-body poses, usable only at 84px and up. Phrasing it as a negative —
  "do NOT show his waist, belt or full torso" — got the typing clip noticeably
  closer, though he still reaches the bottom of frame. Assume you will crop:
  `make-sprite.mjs … head` anchors a square to the top of the character.
- **Clip length.** Every clip comes back 10s no matter what length is asked
  for. Expect to find the usable window yourself.
- **Seamless loops.** Asking twice, in two forms ("return to the starting
  position" *and* "final frame pixel-identical to the first") is what produced
  one. Measured: the typing clip's best loop pair scores 0.78, against 3.5 for
  the celebration clip, which had no loop anywhere and so ships as a one-shot.
  Find the window by scanning every frame pair for the lowest difference.
