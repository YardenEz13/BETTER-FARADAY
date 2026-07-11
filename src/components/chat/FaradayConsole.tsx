import { type ChangeEvent, type RefObject, useRef } from "react";
import { X, Send, Calculator, ImagePlus, Settings, QrCode } from "../electric";
import { type PreparedImage } from "../../services/imageUpload";
import { animateSafe } from "../../lib/anime";

interface FaradayConsoleProps {
  input: string;
  onInputChange: (value: string) => void;
  attachedImage: PreparedImage | null;
  onRemoveImage: () => void;
  imageError: string | null;
  isTyping: boolean;
  isAnalyzing: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  onOpenQRBridge: () => void;
  onOpenPlayground?: () => void;
}

/**
 * The message input bar ("Faraday Console") — purely presentational. All state
 * and handlers live in AIChatPanel; this renders the console chrome, image
 * preview, attach/QR/playground buttons, text input and send button.
 */
export default function FaradayConsole({
  input, onInputChange, attachedImage, onRemoveImage, imageError,
  isTyping, isAnalyzing, fileInputRef, onFileSelect, onSubmit,
  onOpenQRBridge, onOpenPlayground,
}: FaradayConsoleProps) {
  const sendBtnRef = useRef<HTMLButtonElement>(null);
  const burstRef = useRef<HTMLSpanElement>(null);

  // Fire a charge when a message is sent: the button recoils + a spark ring
  // bursts out. anime.js; no-ops under reduced motion. The button is disabled
  // when there's nothing to send, so onClick only reaches here on a real send.
  const fireCharge = () => {
    const btn = sendBtnRef.current;
    const burst = burstRef.current;
    if (btn) animateSafe(btn, { scale: [1, 0.82, 1], duration: 340, ease: "outBack" });
    if (burst) animateSafe(burst, { scale: [0.5, 2.1], opacity: [0.65, 0], duration: 520, ease: "outQuad" });
    onSubmit();
  };

  return (
    <div dir="rtl" className="flex-shrink-0 bg-background border-t border-outline-variant/60 p-3 z-20 relative">
      <div className="max-w-4xl mx-auto">
        {/* Console panel — clay pill (1d Faraday Clay) */}
        <div
          className="bg-surface rounded-[18px] border-2 border-outline flex flex-col overflow-hidden focus-within:border-primary/60 transition-all"
          style={{ boxShadow: 'var(--shadow-clay)' }}
        >
          {/* Attached image preview */}
          {attachedImage && (
            <div className="flex items-center gap-3 px-4 py-2 border-b border-outline-variant/40 bg-surface-container-low/50">
              <img src={attachedImage.dataUrl} alt="תצוגה מקדימה" className="w-12 h-12 rounded-lg object-cover border border-primary/40 shadow-sm flex-shrink-0" />
              <div className="flex items-center gap-1.5 flex-1 min-w-0 text-primary">
                <ImagePlus size={14} className="flex-shrink-0" />
                <span className="font-label-md truncate" style={{ fontSize: '12px' }}>תמונת מחברת מצורפת — פאראדיי ייתן לך רמז לצעד הבא</span>
              </div>
              <button
                onClick={onRemoveImage}
                className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-surface-variant/50 transition-colors flex-shrink-0"
                title="הסר תמונה"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {imageError && (
            <div className="px-4 py-2 border-b border-outline-variant/40 bg-error/10 text-error font-label-md" style={{ fontSize: '12px' }}>
              {imageError}
            </div>
          )}
          {/* Input row */}
          <div className="flex items-center p-2 gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isTyping || isAnalyzing}
              className={`p-2 transition-colors rounded-lg hover:bg-surface-variant/50 disabled:opacity-40 disabled:cursor-not-allowed ${attachedImage ? 'text-primary' : 'text-on-surface-variant hover:text-primary'}`}
              title="צלם או צרף תמונת מחברת לבדיקה"
            >
              <ImagePlus className="" />
            </button>
            <button
              onClick={onOpenQRBridge}
              disabled={isTyping || isAnalyzing}
              className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-variant/50 disabled:opacity-40 disabled:cursor-not-allowed"
              title="צלם מהטלפון (QR)"
            >
              <QrCode className="" />
            </button>
            <button
              onClick={onOpenPlayground}
              disabled={!onOpenPlayground}
              className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-variant/50 disabled:opacity-40 disabled:cursor-not-allowed"
              title="מגרש המתמטיקה — פתרון בלי דף ועיפרון"
            >
              <Calculator className="" />
            </button>
            <div className="flex-1 relative">
              <input
                type="text"
                dir="rtl"
                className="w-full bg-transparent border-none text-on-surface placeholder-on-surface-variant/50 focus:ring-0 focus:outline-none py-2 px-2 font-body-md text-right"
                placeholder={attachedImage ? "הוסף שאלה על התמונה (לא חובה)..." : "הקלד את התשובה שלך כאן... (ניתן להשתמש ב-LaTeX)"}
                value={input}
                onChange={e => onInputChange(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && onSubmit()}
                disabled={isTyping || isAnalyzing}
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-variant/50"
                title="הגדרות"
              >
                <Settings className="" />
              </button>
              <div className="relative flex items-center justify-center">
                <span
                  ref={burstRef}
                  className="absolute w-11 h-11 rounded-full pointer-events-none"
                  style={{
                    border: '2px solid var(--color-primary)',
                    boxShadow: '0 0 12px color-mix(in srgb, var(--color-primary) 60%, transparent)',
                    opacity: 0,
                  }}
                  aria-hidden
                />
                <button
                  ref={sendBtnRef}
                  className="w-11 h-11 bg-primary hover:brightness-105 text-white rounded-[13px] flex items-center justify-center transition-all active:translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none relative"
                  style={{ boxShadow: 'var(--shadow-clay-primary)' }}
                  onClick={fireCharge}
                  disabled={(!input.trim() && !attachedImage) || isTyping || isAnalyzing}
                  title={attachedImage ? "קבל רמז לפי התמונה" : "שלח"}
                >
                  <Send className="" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
