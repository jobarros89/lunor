"use client";

import { cloneElement, useId } from "react";
import type { AriaAttributes, ReactElement, ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Rótulo + controle associados via `useId` (WCAG 1.3.1/4.1.2).
 * Injeta o `id` no único filho (Input, select ou textarea), então o
 * `<label htmlFor>` aponta para o campo — leitor de tela anuncia o rótulo
 * e tocar no texto foca o campo.
 */
export function Field({
  label,
  children,
  className,
  required,
  description,
  error,
}: {
  label: string;
  children: ReactElement<AriaAttributes & { id?: string }>;
  className?: string;
  required?: boolean;
  description?: ReactNode;
  error?: string;
}) {
  const generatedId = useId();
  const id = children.props.id ?? generatedId;
  const describedBy =
    [
      children.props["aria-describedby"],
      description && `${id}-description`,
      error && `${id}-error`,
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-sm">
        {label}
        {required && (
          <span className="text-destructive" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </Label>
      {cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : children.props["aria-invalid"],
        "aria-required": required || children.props["aria-required"],
      })}
      {description && (
        <p
          id={`${id}-description`}
          className="text-xs leading-relaxed text-muted-foreground"
        >
          {description}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
