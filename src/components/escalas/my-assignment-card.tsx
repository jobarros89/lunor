"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarPlus, Check, MessageCircle, X } from "lucide-react";
import { respondToAssignment } from "@/lib/actions/assignment-response";
import { getAssignmentServingArea } from "@/lib/actions/assignment-serving";
import { resolveServiceWindow, timeLabel } from "@/lib/service-window";
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
  releaseTime,
  teamArrivalTime,
  teamReleaseTime,
  eventStartsAt,
  eventEndsAt,
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
  releaseTime?: string | null;
  teamArrivalTime?: string | null;
  teamReleaseTime?: string | null;
  eventStartsAt?: string;
  eventEndsAt?: string | null;
  itemsToBring: string | null;
  equipments: string[];
  leaderName: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [responseMode, setResponseMode] = useState<ResponseMode>(null);
  const [note, setNote] = useState("");
  const [servingArea, setServingArea] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getAssignmentServingArea({ churchId, assignmentId }).then((result) => {
      if (active && result.ok) setServingArea(result.data.departmentName);
    });
    return () => {
      active = false;
    };
  }, [churchId, assignmentId]);

  const serviceWindow = useMemo(() => {
    if (eventStartsAt) {
      return resolveServiceWindow({
        eventStart: eventStartsAt,
        eventEnd: eventEndsAt,
        teamArrival: teamArrivalTime,
        teamRelease: teamReleaseTime,
        assignmentArrival: arrivalTime,
        assignmentRelease: releaseTime,
      });
    }
    return {
      arrivalAt: arrivalTime ?? teamArrivalTime ?? null,
      releaseAt: releaseTime ?? teamReleaseTime ?? eventEndsAt ?? null,
      arrivalSource: arrivalTime ? "assignment" as const : teamArrivalTime ? "ministry" as const : null,
      releaseSource: releaseTime ? "assignment" as const : teamReleaseTime ? "ministry" as const : eventEndsAt ? "event" as const : null,
    };
  }, [arrivalTime, eventEndsAt, eventStartsAt, releaseTime, teamArrivalTime, teamReleaseTime]);

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
  const arrivalLabel = timeLabel(serviceWindow.arrivalAt);
  const releaseLabel = timeLabel(serviceWindow.releaseAt);

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
          {servingArea && (
            <p><span className="text-muted-foreground">Onde vai servir:</span>{" "}<span className="font-medium">{servingArea}</span></p>
          )}
          <p><span className="text-muted-foreground">Função:</span>{" "}<span className="font-medium">{roleName}</span></p>
          {arrivalLabel && (
            <p>
              <span className="text-muted-foreground">Chegada:</span>{" "}
              <span className="font-medium">{arrivalLabel}</span>
              {serviceWindow.arrivalSource === "assignment" && (
                <span className="ml-1 text-xs text-muted-foreground">(ajuste individual)</span>
              )}
            </p>
          )}
          {releaseLabel && (
            <p>
              <span className="text-muted-foreground">Saída prevista:</span>{" "}
              <span className="font-medium">{releaseLabel}</span>
              {serviceWindow.releaseSource === "assignment" && (
                <span className="ml-1 text-xs text-muted-foreground">(ajuste individual)</span>
              )}
            </p>
          )}
          {eventStartsAt && (
            <p>
              <span className="text-muted-foreground">Culto:</span>{" "}
              <span className="font-medium">{timeLabel(eventStartsAt)}</span>
              {eventEndsAt && <span className="font-medium"> – {timeLabel(eventEndsAt)}</span>}
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
