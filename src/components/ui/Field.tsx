import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

interface FieldChrome {
  label?: string;
  hint?: string;
  error?: string;
}

function Chrome({ id, label, hint, error, children }: FieldChrome & { id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-label-lg text-on-surface-variant">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-label-md text-error font-semibold">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-label-md text-on-surface-variant">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement>, FieldChrome {}

/** Clay text input (.field) with optional label / hint / error chrome. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, className = "", id: idProp, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <Chrome id={id} label={label} hint={hint} error={error}>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`field ${error ? "border-error" : ""} ${className}`}
        {...rest}
      />
    </Chrome>
  );
});

export interface FieldTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldChrome {}

/** Multiline variant of Field. */
export const FieldTextarea = forwardRef<HTMLTextAreaElement, FieldTextareaProps>(function FieldTextarea(
  { label, hint, error, className = "", id: idProp, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <Chrome id={id} label={label} hint={hint} error={error}>
      <textarea
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`field resize-y ${error ? "border-error" : ""} ${className}`}
        {...rest}
      />
    </Chrome>
  );
});

export default Field;
