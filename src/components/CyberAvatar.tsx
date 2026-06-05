import React from "react";
import { getAvatarData } from "../services/avatarHelper";

interface CyberAvatarProps {
  name: string;
  size?: number;
  showText?: boolean;
}

export default function CyberAvatar({ name, size = 48, showText = true }: CyberAvatarProps) {
  const { color, shape } = getAvatarData(name);
  const initials = name.slice(0, 2);

  // Render the inner shape representing the student's unique digital signature
  const renderInnerShape = () => {
    switch (shape) {
      case "circle":
        return <div className="rounded-full w-2/5 h-2/5" style={{ backgroundColor: color.text }} />;
      case "square-rotated":
        return <div className="w-1/3 h-1/3 rotate-45" style={{ backgroundColor: color.text }} />;
      case "h-bar":
        return <div className="w-1/2 h-1/6 rounded-sm" style={{ backgroundColor: color.text }} />;
      case "cross":
        return (
          <div className="relative w-2/5 h-2/5 flex items-center justify-center">
            <div className="absolute w-full h-[2px]" style={{ backgroundColor: color.text }} />
            <div className="absolute h-full w-[2px]" style={{ backgroundColor: color.text }} />
          </div>
        );
      case "rings":
      default:
        return (
          <div className="w-1/2 h-1/2 border-2 border-dashed rounded-full animate-[spin_10s_linear_infinite]" style={{ borderColor: color.text }} />
        );
    }
  };

  return (
    <div 
      className="relative flex items-center justify-center flex-shrink-0 rounded-full"
      style={{ 
        width: size, 
        height: size,
        background: color.bg,
        border: `2px solid ${color.border}`,
        boxShadow: `0 0 10px ${color.glow}`
      }}
    >
      {/* Dynamic Inner Cyber Core */}
      <div className="absolute inset-0 flex items-center justify-center opacity-45">
        {renderInnerShape()}
      </div>

      {/* Initials Text overlay */}
      {showText && (
        <span 
          className="font-mono font-bold z-10 select-none text-xs" 
          style={{ color: color.text, textShadow: `0 0 5px ${color.text}` }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
