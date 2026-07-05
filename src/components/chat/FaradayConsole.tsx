import { type ChangeEvent, type RefObject } from "react";
import { X, Send, Calculator, ImagePlus, Settings, QrCode } from "../electric";
import { type PreparedImage } from "../../services/imageUpload";

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
  return (
    <div className="flex-shrink-0 bg-surface/95 backdrop-blur-xl border-t border-outline-variant/60 p-3 z-20 relative">
      <div className="max-w-4xl mx-auto">
        {/* Console panel */}
        <div className="bg-on-surface/5 backdrop-blur-lg rounded-[16px] border-2 border-outline-variant shadow-lg flex flex-col overflow-hidden focus-within:ring-1 focus-within:ring-primary/50 transition-all">
          {/* Console title bar */}
          <div className="flex items-center gap-2 px-4 py-1.5 border-b border-outline-variant/40 text-on-surface-variant bg-surface-container-low/60">
            <Calculator className="" />
            <span className="font-label-md" style={{ fontSize: '11px', letterSpacing: '0.04em' }}>Faraday Console v2.0</span>
            <div className="flex-1" />
            <span className="font-label-md opacity-50" style={{ fontSize: '10px' }}>הקש Enter לשליחה</span>
          </div>
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
                className="w-full bg-transparent border-none text-on-surface placeholder-on-surface-variant/50 focus:ring-0 focus:outline-none py-2 px-2 font-body-md"
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
              <button
                className="w-11 h-11 bg-primary-container hover:bg-primary text-on-primary rounded-xl shadow-sm flex items-center justify-center transition-all active:scale-90 disabled:opacity-50 disabled:pointer-events-none"
                onClick={onSubmit}
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
  );
}
