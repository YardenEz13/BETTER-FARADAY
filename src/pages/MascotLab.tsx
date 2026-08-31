import { useState } from "react";
import FaradayAvatar, { type FaradayPose, isLargePose } from "../components/FaradayAvatar";
import FaradayMoodAvatar, { type FaradayMood } from "../components/FaradayMoodAvatar";
import FaradayReaction, { type FaradayReactionKind } from "../components/FaradayReaction";
import Faraday25D, { type Faraday25DPose } from "../components/Faraday25D";

/**
 * Dev-only mascot lab: every pose and every animation on one screen, rendered
 * by the real components so nothing here can drift from what ships.
 *
 * Routed at /mascot behind an import.meta.env.DEV check — several of these
 * moments are otherwise hard to see on purpose (a level-up needs a teacher to
 * approve a promotion; the homework bubble needs a finished set).
 */

const POSES: FaradayPose[] = ["idle", "thinking", "happy", "wrong", "streak", "point", "thumbsup", "wave"];
const KINDS: FaradayReactionKind[] = ["correct", "wrong", "streak", "levelup", "homework"];
const MOODS: FaradayMood[] = ["idle", "thinking", "happy"];
const HEAD_POSES: Faraday25DPose[] = ["idle", "thinking", "happy", "wrong", "streak"];

export default function MascotLab() {
  const [reaction, setReaction] = useState<FaradayReactionKind | null>(null);
  const [mood, setMood] = useState<FaradayMood>("idle");
  const [spriteKey, setSpriteKey] = useState(0);
  // Faraday25D masks are cut for the head crop, so the lab only offers those.
  const [headPose, setHeadPose] = useState<Faraday25DPose>("idle");

  return (
    <div dir="rtl" className="min-h-screen bg-background text-on-surface p-6 flex flex-col gap-8"
      style={{ fontFamily: "'Assistant', sans-serif" }}>

      <header className="flex items-center gap-3">
        <img src="/favicon.svg" alt="" className="w-10 h-10 rounded-[23%]" />
        <h1 className="text-xl font-extrabold">מעבדת פאראדיי · Mascot Lab</h1>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="label-mono text-primary">Poses — idle breathes and blinks, thinking sways</h2>
        <div className="flex flex-wrap gap-6">
          {POSES.map((p) => (
            <div key={p} className="flex flex-col items-center gap-2">
              <div className="w-24 h-24 rounded-2xl bg-surface border-2 border-outline flex items-center justify-center"
                style={{ boxShadow: "var(--shadow-clay)" }}>
                <FaradayAvatar pose={p} px={88} />
              </div>
              <span className="text-xs font-semibold">
                {p}{isLargePose(p) && " · large only"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="label-mono text-primary">Pose swap — springs in on every change</h2>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-surface border-2 border-primary flex items-center justify-center">
            <FaradayMoodAvatar mood={mood} px={72} fill />
          </div>
          {MOODS.map((m) => (
            <button key={m} onClick={() => setMood(m)}
              className={m === mood ? "btn-clay-primary" : "btn-clay-ghost"}>
              {m}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="label-mono text-primary">2.5D — his own art on five depth planes, tilts toward the pointer</h2>
        <div className="flex flex-wrap items-center gap-8">
          <Faraday25D pose={headPose} px={200} />
          <Faraday25D pose={headPose} px={96} />
          <div className="flex flex-wrap gap-2">
            {HEAD_POSES.map((p) => (
              <button key={p} className={headPose === p ? "btn-clay-primary" : "btn-clay-ghost"} onClick={() => setHeadPose(p)}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="label-mono text-primary">Celebration sprite — 12 frames, steps(), one shot</h2>
        <div className="flex items-center gap-6">
          <span key={spriteKey} className="faraday-sprite" style={{ ["--cell" as string]: "120px" }} />
          <span key={`s${spriteKey}`} className="faraday-sprite" style={{ ["--cell" as string]: "44px" }} />
          <button className="btn-clay-ghost" onClick={() => setSpriteKey((k) => k + 1)}>replay</button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="label-mono text-primary">Typing loop — 12 frames, seamless, at chat size (36px)</h2>
        <div className="flex items-center gap-6">
          <span className="faraday-typing" style={{ ["--cell" as string]: "120px" }} />
          <div className="w-9 h-9 rounded-full bg-surface-bright border-2 border-primary flex items-center justify-center overflow-hidden">
            <span className="faraday-typing" />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="label-mono text-primary">Reactions — bubble springs in, avatar squashes on landing</h2>
        <div className="flex flex-wrap gap-3">
          {KINDS.map((k) => (
            <button key={k} className="btn-clay-primary" onClick={() => { setReaction(null); setTimeout(() => setReaction(k), 50); }}>
              {k}
            </button>
          ))}
        </div>
      </section>

      <FaradayReaction
        kind={reaction ?? "correct"}
        level={3}
        streakCount={5}
        visible={reaction !== null}
        onDone={() => setReaction(null)}
      />
    </div>
  );
}
