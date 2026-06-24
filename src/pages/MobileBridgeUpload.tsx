import { useState, useRef, type ChangeEvent } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { Camera, Loader2, CheckCircle2, AlertTriangle, Zap } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { prepareImageForUpload } from "../services/imageUpload";

export default function MobileBridgeUpload() {
  const { token } = useParams<{ token: string }>();
  const publicSession = useQuery(api.bridge.getPublicSession, token ? { token } : "skip");
  const attach = useMutation(api.bridge.attachBridgeImage);

  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !token) return;
    setStatus("uploading");
    setErrorMsg(null);
    try {
      const prepared = await prepareImageForUpload(file);
      await attach({ token, imageBase64: prepared.base64, imageMimeType: prepared.mimeType });
      setStatus("done");
    } catch (err) {
      console.error("[MobileBridge] upload failed:", err);
      setErrorMsg(err instanceof Error ? err.message : "ההעלאה נכשלה. נסה שוב.");
      setStatus("error");
    }
  };

  const alreadyUsed =
    publicSession?.found === true &&
    (publicSession.status === "uploaded" || publicSession.status === "consumed") &&
    status !== "uploading";

  return (
    <div
      dir="rtl"
      className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-10 text-center gap-6"
      style={{ background: "var(--color-surface)" }}
    >
      {/* Branding */}
      <div className="flex items-center gap-2 text-primary">
        <Zap size={22} className="fill-current" />
        <span className="font-headline-md">פאראדיי</span>
      </div>

      {/* Loading the session */}
      {publicSession === undefined && (
        <Loader2 size={32} className="text-on-surface-variant animate-spin" />
      )}

      {/* Invalid or expired link */}
      {publicSession && (!publicSession.found || publicSession.expired) && (
        <div className="flex flex-col items-center gap-3 max-w-[20rem]">
          <AlertTriangle size={44} className="text-error" />
          <div className="font-headline-md text-on-surface">הקישור פג תוקף</div>
          <div className="font-body-md text-on-surface-variant">
            צור קוד QR חדש במחשב ונסה שוב.
          </div>
        </div>
      )}

      {/* Success */}
      {status === "done" && (
        <div className="flex flex-col items-center gap-3 max-w-[20rem]">
          <CheckCircle2 size={56} className="text-primary" />
          <div className="font-headline-md text-on-surface">נשלח למחשב! ✓</div>
          <div className="font-body-md text-on-surface-variant">
            אפשר לחזור למסך המחשב — התמונה כבר שם.
          </div>
        </div>
      )}

      {/* Already used (by a previous upload) */}
      {alreadyUsed && status !== "done" && (
        <div className="flex flex-col items-center gap-3 max-w-[20rem]">
          <CheckCircle2 size={44} className="text-on-surface-variant" />
          <div className="font-headline-md text-on-surface">כבר נשלחה תמונה</div>
          <div className="font-body-md text-on-surface-variant">
            הקישור הזה שומש. צור קוד חדש במחשב כדי לשלוח עוד תמונה.
          </div>
        </div>
      )}

      {/* Upload UI */}
      {publicSession?.found && !publicSession.expired && !alreadyUsed && status !== "done" && (
        <div className="flex flex-col items-center gap-5 w-full max-w-[22rem]">
          <div>
            <div className="font-headline-md text-on-surface mb-1">צלם את המחברת</div>
            {publicSession.label && (
              <div className="font-label-md text-on-surface-variant">עבור: {publicSession.label}</div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFile}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={status === "uploading"}
            className="w-full flex flex-col items-center justify-center gap-3 py-10 rounded-3xl border-2 border-dashed border-primary/50 bg-primary-container/10 text-primary active:scale-95 transition-transform disabled:opacity-60"
          >
            {status === "uploading" ? (
              <>
                <Loader2 size={40} className="animate-spin" />
                <span className="font-label-lg">שולח…</span>
              </>
            ) : (
              <>
                <Camera size={44} />
                <span className="font-label-lg">פתח מצלמה / בחר תמונה</span>
              </>
            )}
          </button>

          {errorMsg && (
            <div className="flex items-center gap-2 text-error font-label-md">
              <AlertTriangle size={16} /> {errorMsg}
            </div>
          )}

          <div className="font-label-md text-on-surface-variant/70" style={{ fontSize: "12px" }}>
            התמונה נשלחת ישירות למסך המחשב שלך.
          </div>
        </div>
      )}
    </div>
  );
}
