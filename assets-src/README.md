# Mascot source assets

Everything here is *source*, not shipped. Vite copies `public/` into the build
and the PWA precaches it, so raw art lives here instead and the scripts write
their (much smaller) output into `public/`.

## Files

| File | Feeds | Rebuild with |
|---|---|---|
| `faraday-sheet.png` | the seed for `faraday-hires.png` | `node scripts/make-turntable-seed.mjs` |
| `faraday-hires.png` | `faraday-rig.psd` + `public/faraday-rig/` | `node scripts/cut-rig-layers.mjs` |
| `faraday-icon.png` | favicon + apple-touch icon | `node scripts/make-favicon.mjs` |

`faraday-icon.png` is a *different drawing* — shaded hair, wrinkles, a white
collar. Only the favicon uses it.

`faraday-sheet.png` is no longer cut from directly. It was the source of the six
pose PNGs via `slice-mascot.mjs`, now deleted: it wrote the same
`public/faraday-*.png` files that `slice-poses.mjs` writes, so running it would
have silently reverted the whole set to 197px cells. The sheet survives as the
ancestor — it seeds `faraday-hires.png`, which everything else now descends
from.

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

## `faraday-hires.png` — the rig's source

A 1024px redraw of the canonical idle pose on flat magenta, generated from
`seed-idle.png` (itself the sheet's idle cell upscaled). **This, not
`faraday-sheet.png`, is what the rig is cut from** — the sheet's cells are
197x211, which upscaled 5x gave outlines too soft to hold at 200px.

Regenerate with `scripts/make-hires-portrait.mjs`, which asks for the *same
drawing* back at 2K — same proportions, same line weight, same palette:

```
node scripts/make-turntable-seed.mjs assets-src/seed-idle.png
node --env-file=.env.local scripts/make-hires-portrait.mjs assets-src/seed-idle.png assets-src/faraday-hires.png
```

Put `GEMINI_API_KEY=<key>` in `.env.local` — gitignored by the `*.local` rule,
so it never reaches a commit. Node reads the file itself; passing the key inline
on the command line would leave it in shell history instead.

Then point `SOURCE` in `scripts/cut-rig-layers.mjs` at the result and re-pick the
twelve seed coordinates against it — they are pixel positions in the source, so
they do not survive a new image. Two traps found doing exactly that:

- The browser may save the result as **JPEG with a `.png` name**, and may append
  a second extension. Check the signature (`ff d8` is JPEG) and convert with the
  PowerShell recipe above before anything tries to decode it as PNG.
- The generated art connects his jacket, face outline and hair outline into one
  dark network, so the jacket fill needs its radius cap or it claims every
  outline in the picture and starves the nearest-owner sweep.

Costs a paid generation per run, and **image generation is not on the free
tier**: every image model returns `free_tier_requests limit: 0`, which arrives
as a 429 saying "retry in 22s" — the quota is zero, not spent, so retrying never
works. Either enable billing or generate in the AI Studio UI and save the file
here. `scripts/check-gemini-key.mjs` tests a key without spending anything.

Expect several rounds. Every clause of that script's prompt is a failure this
project already hit — see "Prompt notes" below before editing it.

## Rig layers — `faraday-rig.psd`

The idle Faraday cut into 12 separately-movable parts, for the Rive rig test in
`docs/mascot-plan.md` §14. Source-only, never shipped: the app still renders the
flat pose PNGs in `public/`.

**A PSD and not a folder of PNGs**, because Rive imports one as a unit — drag it
onto an artboard and every layer arrives positioned, ordered and named. Twelve
loose PNGs would be twelve manual placements with nothing holding them in
register, and a sidecar JSON of coordinates is no help: Rive cannot read one.

`scripts/psd.mjs` writes it, no dependency, same as `png.mjs` next door. The
cutter round-trips the file through its own reader before finishing, and
`faraday-rig-stack.png` is the flattened result — the script fails if the layers
do not put back at least 90% of the source character.

| Layers | |
|---|---|
| structure | `jacket` `collar` `bowtie` `hair` `head` |
| face | `eye-white-a/b` `pupil-a/b` `brow-a/b` `mouth` |
| gestures | `gesture-thinking/happy/wrong/streak` — `node scripts/cut-gestures.mjs` |

The gesture layers are his hands, lifted out of the generated poses so the rig
can gesture and not only emote — it is cut from the idle portrait, which has no
arms. They only register because every pose goes through one shared framing box,
so his head lands in the same place at the same size in all of them.

Two of them render *behind* his hair and two in front, and it matters: raised
arms carry a black sleeve that otherwise cuts a dark wedge across his white hair,
while `thinking` rests a hand on his chin and has to cover it.

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
| `poses-v2-magenta.mp4` | pose library, magenta backdrop, 2s holds | nothing — fed `point`/`thumbsup`/`wave`, all deleted |
| `celebration.mp4` | celebration | 12 frames, 4.90s–6.00s at 0.1s → `faraday-celebrate.png` |
| `typing-loop.mp4` | chat typing indicator | 12 frames, 2.617s–3.45s → `faraday-typing.png`, head-cropped |

7.5MB of original MP4 compressed to 1.7MB. Verified fit for purpose: the sprite
re-cut from the compressed `celebration.mp4` matches the one built from the
original to within 0.6% transparent area, with zero magenta fringe either way.

Rebuild the sprite strips with `scripts/make-sprite.mjs`, which documents its
ffmpeg frame-grab. ffmpeg is a dev-machine tool here, not a project dependency —
nothing in `npm run build` needs it.

`extract-poses.mjs` is gone with the poses it cut. `point`, `thumbsup` and
`wave` were the last art from the video lineage, full-body where everything else
is a head crop, and they were the only reason `isLargePose` and its size guard
existed. Deleting them took that whole concept with them. The clips stay as the
record; the celebration and typing strips still come from here.

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

## Regenerating the pose PNGs

The six head poses shipped in `public/` are generated, not composed. The rig
cannot make them: it has twelve layers and none is an arm, while `thinking` puts
a hand at his chin, `happy` raises both, and `wrong` holds out an open palm.
Rendering them off the rig gives five near-identical heads with different
eyebrows — expression is not gesture.

```
node scripts/make-poses.mjs --print   # prompts for manual AI Studio runs
node --env-file=.env.local scripts/make-poses.mjs   # or generate directly
node scripts/slice-poses.mjs          # cut all six to public/faraday-*.png
```

All five attach `faraday-hires.png` as the reference, so the whole set ends up
the same vintage as the rig; `idle` needs no generation because that file *is*
the idle pose. `slice-poses.mjs` skips whatever has not been generated yet, so
it can be re-run as they arrive.

**Do it all at once.** The six are internally consistent today, so replacing
some and not others fragments the set worse than leaving it alone.

**Sparks are deliberately not in the prompts.** The old `happy` had green sparks
and `streak` amber bolts drawn into the art; `SparkBurst` in
`src/components/electric` already draws them at runtime — `FaradayReaction` uses
it — so baking them in duplicates the effect, freezes the colour, and hands the
transparency key a field of detached islands.

Framing is shared, not per-pose: every crop is anchored on idle's box, widened
symmetrically only where a pose genuinely reaches further. Cropping each pose to
its own bounds is what makes a mascot's head change size when it swaps.
