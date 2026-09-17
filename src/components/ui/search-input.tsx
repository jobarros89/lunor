"use client";

import { useId, useRef } from "react";
import type { ComponentProps } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SearchInput({
  label,
  value,
  onValueChange,
  className,
  id,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "ref"> & {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative min-w-0 flex-1">
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        {...props}
        id={inputId}
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        autoComplete="off"
        className={cn(
          "pl-10 pr-12 [&::-webkit-search-cancel-button]:appearance-none",
          className,
        )}
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={props.disabled}
          aria-label="Limpar busca"
          className="absolute right-0.5 top-1/2 -translate-y-1/2"
          onClick={() => {
            onValueChange("");
            inputRef.current?.focus();
          }}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
