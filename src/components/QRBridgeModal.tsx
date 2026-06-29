import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { QRCodeSVG } from "qrcode.react";
import { motion } from "framer-motion";
import { Smartphone, X, Loader as Loader2, CheckCircle as CheckCircle2 } from "./electric";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface Props {
  studentId: string;
  label?: string;
  onClose: () => void;
  onImageReceived: (img: { dataUrl: string; base64: string; mimeType: string }) => void;
}

export default function QRBridgeModal({ studentId, label, onClose, onImageReceived }: Props) {
  const createSession = useMutation(api.bridge.createBridgeSession);
  const consume = useMutation(api.bridge.consumeSession);

  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const receivedRef = useRef(false);

  // Create exactly one session when the modal opens (guard against StrictMode double-fire)
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    createSession({ studentId: studentId as Id<"students">, label })
      .then((r) => setToken(r.token))
      .catch((e) => {
        console.error("[QRBridge] createSession failed:", e);
        setError("יצירת הקוד נכשלה. נסה שוב.");
      });
  }, [createSession, studentId, label]);

  const session = useQuery(api.bridge.getSession, token ? { token } : "skip");

  // Pull the photo into the chat the moment the phone uploads it
  useEffect(() => {
    if (receivedRef.current) return;
    if (session?.status === "uploaded" && session.imageBase64 && session.imageMimeType) {
      receivedRef.current = true;
      const mimeType = session.imageMimeType;
      const base64 = session.imageBase64;
      onImageReceived({ dataUrl: `data:${mimeType};base64,${base64}`, base64, mimeType });
      if (token) consume({ token }).catch(console.error);
    }
  }, [session, token, onImageReceived, consume]);

  const url = token ? `${window.location.origin}/bridge/${token}` : "";
  const received = session?.status === "uploaded" || receivedRef.current;

  return (
    <motion.div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      dir="rtl"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className="relative w-full max-w-[26rem] rounded-2xl border-2 border-outline-variant bg-surface shadow-2xl overflow-hidden"
        initial={{ scale: 0.96, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 12 }}
        transition={{ type: "spring", damping: 26, stiffness: 240 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-outline-variant/60 bg-surface-container-lowest">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-primary-container/30 border-2 border-primary flex items-center justify-center">
              <Smartphone size={18} className="text-primary" />
            </span>
            <div className="font-headline-md text-on-surface">צלם מהטלפון</div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-variant/50 hover:text-primary transition-colors"
            title="סגור"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center text-center gap-4">
          {error ? (
            <div className="py-10 text-error font-body-md">{error}</div>
          ) : received ? (
            <div className="py-10 flex flex-col items-center gap-3">
              <CheckCircle2 size={48} className="text-primary" />
              <div className="font-headline-md text-on-surface">התמונה התקבלה!</div>
              <div className="font-body-md text-on-surface-variant">צורפה לצ'אט — אפשר לשלוח לבדיקה.</div>
            </div>
          ) : (
            <>
              <div className="font-body-md text-on-surface-variant max-w-[20rem]">
                סרוק את הקוד עם מצלמת הטלפון, צלם את המחברת, והתמונה תופיע כאן אוטומטית.
              </div>

              {/* QR — on a white card so phone cameras read it reliably */}
              <div className="relative rounded-2xl bg-white p-4 shadow-inner" style={{ minWidth: 216, minHeight: 216 }}>
                {url ? (
                  <QRCodeSVG value={url} size={184} level="M" includeMargin={false} />
                ) : (
                  <div className="w-[184px] h-[184px] flex items-center justify-center">
                    <Loader2 size={28} className="text-neutral-400 animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-primary font-label-md">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                ממתין לטלפון…
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
