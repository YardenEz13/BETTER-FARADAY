// A simple hash function to map names to stable values
export function getAvatarData(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Harmonies of neon-cyber colors: Emerald, Acid Green, Cyan, Cyber Rose, Purple, Amber
  const palette = [
    { bg: "rgba(0, 255, 136, 0.08)", border: "#00ff88", glow: "rgba(0, 255, 136, 0.4)", text: "#00ff88" }, // Neon Emerald
    { bg: "rgba(180, 255, 0, 0.08)", border: "#b4ff00", glow: "rgba(180, 255, 0, 0.4)", text: "#b4ff00" }, // Acid Green
    { bg: "rgba(0, 229, 255, 0.08)", border: "#00e5ff", glow: "rgba(0, 229, 255, 0.4)", text: "#00e5ff" }, // Laser Cyan
    { bg: "rgba(255, 0, 127, 0.08)", border: "#ff007f", glow: "rgba(255, 0, 127, 0.4)", text: "#ff007f" }, // Cyber Rose
    { bg: "rgba(167, 139, 250, 0.08)", border: "#a78bfa", glow: "rgba(167, 139, 250, 0.4)", text: "#a78bfa" }, // Neon Purple
    { bg: "rgba(245, 158, 11, 0.08)", border: "#f59e0b", glow: "rgba(245, 158, 11, 0.4)", text: "#f59e0b" }, // Cyber Amber
  ];

  const colorIndex = Math.abs(hash) % palette.length;
  const color = palette[colorIndex];
  
  // Determine a shape type for the core avatar element
  const shapeTypes = ["circle", "square-rotated", "h-bar", "cross", "rings"];
  const shape = shapeTypes[Math.abs(hash) % shapeTypes.length];
  
  return { color, shape };
}
