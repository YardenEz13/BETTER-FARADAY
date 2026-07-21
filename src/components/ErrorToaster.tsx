import { useEffect } from "react";
import { ToastStack, useToasts } from "./ui/Toast";
import { ERROR_EVENT } from "../lib/errors";

/**
 * The app-wide "something failed" surface. The global handlers in main.tsx
 * already log + report to Sentry; this is the half the user can see.
 *
 * Mounted once in App, so every un-caught rejection — including the ~35 bare
 * `await someMutation({…})` call sites — produces feedback instead of a
 * silently dead button. Screens that want inline/per-action handling still
 * catch locally; this is the floor, not a replacement.
 */
export default function ErrorToaster() {
  const { toasts, push, dismiss } = useToasts(6000);

  useEffect(() => {
    const onError = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      push("error", "פעולה נכשלה", detail);
    };
    window.addEventListener(ERROR_EVENT, onError);
    return () => window.removeEventListener(ERROR_EVENT, onError);
  }, [push]);

  return <ToastStack toasts={toasts} onDismiss={dismiss} position="top" />;
}
