"use client";

import { useState } from "react";
import type { ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return <div className="relative"><Input {...props} type={visible ? "text" : "password"} className={cn("pr-12", className)} /><Button type="button" variant="ghost" size="icon" className="absolute right-0.5 top-1/2 -translate-y-1/2" aria-label={visible ? "Ocultar senha" : "Mostrar senha"} aria-pressed={visible} disabled={props.disabled} onClick={() => setVisible((value) => !value)}><Icon className="size-4" aria-hidden="true" /></Button></div>;
}
