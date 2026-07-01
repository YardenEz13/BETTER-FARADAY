import { ELECTRIC_ICONS, ElectricField } from "../components/electric";

/**
 * Dev showcase for the electric icon family + circuit-field backdrop.
 * Route: /electric-demo  (safe to delete — not linked from the app).
 */
const ICONS = Object.entries(ELECTRIC_ICONS).map(([label, Cmp]) => ({ Cmp, label }));

export default function ElectricGallery() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-on-background" style={{ padding: "2.5rem" }}>
      {/* hero with the circuit-field backdrop */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 24,
          padding: "3rem",
          marginBottom: "2.5rem",
          background: "var(--color-surface)",
          border: "1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)",
        }}
      >
        <ElectricField intensity={0.6} density="dense" />
        <div style={{ position: "relative" }}>
          <h1 style={{ fontSize: 34, fontWeight: 800, margin: 0 }}>פאראדיי · Electric SVG kit</h1>
          <p style={{ opacity: 0.8, marginTop: 8 }}>Theme-aware, animated, science-inspired graphics.</p>
        </div>
      </div>

      {/* icon family */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem" }}>
        {ICONS.map(({ Cmp, label }) => (
          <div
            key={label}
            style={{
              width: 150,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              padding: "1.5rem",
              borderRadius: 18,
              background: "var(--color-surface)",
              border: "1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)",
            }}
          >
            <Cmp size={72} title={label} />
            <span style={{ fontSize: 13, opacity: 0.75 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
