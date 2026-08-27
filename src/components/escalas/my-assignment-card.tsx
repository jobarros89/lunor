"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarPlus, Check, MessageCircle, X } from "lucide-react";
import { respondToAssignment } from "@/lib/actions/assignment-response";
import {
  ASSIGNMENT_STATUS_BADGE,
  ASSIGNMENT_STATUS_LABELS,
} from "@/lib/escalas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ResponseMode = "nao_posso" | "falar_lider" | null;

export function MyAssignmentCard({
  churchSlug,
  churchId,
  eventId,
  assignmentId,
  roleName,
  status,
  arrivalTime,
  itemsToBring,
  equipments,
  leaderName,
}: {
  churchSlug: string;
  churchId: string;
  eventId: string;
  assignmentId: string;
  roleName: string;
  status: string;
  arrivalTime: string | null;
  itemsToBring: string | null;
  equipments: string[];
  leaderName: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [responseMode, setResponseMode] = useState<ResponseMode>(null);
  const [note, setNote] = useState("");

  function respond(response: "confirmar" | "nao_posso" | "falar_lider") {
    startTransition(async () => {
      const result = await respondToAssignment({
        churchSlug,
        churchId,
        eventId,
        assignmentId,
        response,
        note,
      });
      if (result && !result.ok) {
        toast.error(result.error);
        return;
      }

      if (response === "confirmar") toast.success("Escala confirmada!");
      if (response === "nao_posso") toast.success("Líder avisado. A substituição foi aberta.");
      if (response === "falar_lider") toast.success("Seu líder foi avisado.");
      setResponseMode(null);
      setNote("");
    });
  }

  const canRespond = ["convidado", "confirmado", "falar_lider", "substituicao_solicitada"].includes(status);

  return (
    <Card className="rounded-3xl border-2 border-foreground/10">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Sua escala</CardTitle>
          <Badge className={`rounded-full border-0 ${ASSIGNMENT_STATUS_BADGE[status] ?? ""}`}>
            {ASSIGNMENT_STATUS_LABELS[status] ?? status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">Função:</span>{" "}<span className="font-medium">{roleName}</span></p>
          {arrivalTime && (
            <p>
              <span className="text-muted-foreground">Chegada:</span>{" "}
              <span className="font-medium">{new Date(arrivalTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            </p>
          )}
          {leaderName && <p><span className="text-muted-foreground">Líder:</span>{" "}<span className="font-medium">{leaderName}</span></p>}
          {itemsToBring && <p><span className="text-muted-foreground">Levar:</span>{" "}<span className="font-medium">{itemsToBring}</span></p>}
          {equipments.length > 0 && (
            <div className="pt-1">
              <p className="text-muted-foreground">Equipamentos:</p>
              <ul className="mt-1 space-y-1">
                {equipments.map((name) => <li key={name} className="rounded-full bg-muted px-3 py-2 font-medium">{name}</li>)}
              </ul>
            </div>
          )}
        </div>

        {canRespond && !responseMode && (
          <div className="grid gap-2 sm:grid-cols-3">
            <Button disabled={pending || status === "confirmado"} onClick={() => respond("confirmar")} className="h-11 rounded-full">
              <Check className="size-4" /> Confirmo
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => setResponseMode("nao_posso")} className="h-11 rounded-full">
              <X className="size-4" /> Não posso
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => setResponseMode("falar_lider")} className="h-11 rounded-full">
              <MessageCircle className="size-4" /> Falar com líder
            </Button>
          </div>
        )}

        {responseMode && (
          <div className="space-y-3 rounded-2xl border bg-muted/30 p-4">
            <div>
              <p className="text-sm font-medium">{responseMode === "nao_posso" ? "Avise o líder" : "O que você precisa conversar?"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {responseMode === "nao_posso" ? "O motivo é opcional e ajuda na busca por uma substituição." : "A mensagem é opcional. O líder será notificado mesmo sem texto."}
              </p>
            </div>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mensagem opcional" maxLength={500} className="h-11 rounded-full" />
            <div className="flex gap-2">
              <Button variant="outline" disabled={pending} onClick={() => { setResponseMode(null); setNote(""); }} className="h-11 flex-1 rounded-full">Cancelar</Button>
              <Button disabled={pending} onClick={() => respond(responseMode)} className="h-11 flex-1 rounded-full">{pending ? "Enviando…" : "Enviar"}</Button>
            </div>
          </div>
        )}

        <a href={`/${churchSlug}/escalas/${eventId}/calendario`} className="flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <CalendarPlus className="size-4" />
          Adicionar ao meu calendário
        </a>
      </CardContent>
    </Card>
  );
}
