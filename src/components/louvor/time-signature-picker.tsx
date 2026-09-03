"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const COMMON_TIME_SIGNATURES = ["4/4", "3/4", "6/8", "12/8", "2/4"] as const;

function isCommonTimeSignature(value: string) {
  return COMMON_TIME_SIGNATURES.includes(value as (typeof COMMON_TIME_SIGNATURES)[number]);
}

export function TimeSignaturePicker({
  value,
  onChange,
  name,
  id = "time-signature",
}: {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  id?: string;
}) {
  const [custom, setCustom] = useState(Boolean(value) && !isCommonTimeSignature(value));

  useEffect(() => {
    if (!value) return;
    setCustom(!isCommonTimeSignature(value));
  }, [value]);

  return (
    <div className="space-y-2">
      {name && <input type="hidden" name={name} value={value} />}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Escolha o compasso">
        {COMMON_TIME_SIGNATURES.map((signature) => {
          const selected = !custom && value === signature;
          return (
            <button
              key={signature}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setCustom(false);
                onChange(signature);
              }}
              className={cn(
                "min-h-11 min-w-14 rounded-full border px-4 text-sm font-semibold transition-colors",
                selected
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background hover:border-foreground/40 hover:bg-accent/40"
              )}
            >
              {signature}
            </button>
          );
        })}

        <button
          type="button"
          aria-pressed={custom}
          onClick={() => {
            setCustom(true);
            if (isCommonTimeSignature(value)) onChange("");
          }}
          className={cn(
            "min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors",
            custom
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background hover:border-foreground/40 hover:bg-accent/40"
          )}
        >
          Outro
        </button>
      </div>

      {custom && (
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={5}
          pattern="(?:[1-9]|[12][0-9]|3[0-2])/(?:1|2|4|8|16|32)"
          title="Informe um compasso como 5/4 ou 7/8"
          placeholder="Ex.: 5/4 ou 7/8"
          inputMode="text"
          autoComplete="off"
          className="h-11 rounded-xl"
        />
      )}
    </div>
  );
}
