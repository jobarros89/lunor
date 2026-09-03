"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { buildWorshipSetlistProposal } from "@/lib/ai/worship-setlist-proposal";
import { getActiveMinistry } from "@/lib/ministry";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/types";

const schema = z.object({
  churchSlug: z.string().trim().min(2).max(100),
  ministryId: z.string().uuid(),
  eventId: z.string().uuid(),
  songIds: z
    .array(z.string().uuid())
    .min(2)
    .max(6)
    .refine((songIds) => new Set(songIds).size === songIds.length),
});

type ApplyWorshipSetlistResult = {
  added: number;
  skippedExisting: number;
};

export async function confirmAssistantWorshipSetlist(
  raw: unknown
): Promise<ActionResult<ApplyWorshipSetlistResult>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Proposta de repertório inválida" };
  }
  const d = parsed.data;

  const tenant = await getTenant(d.churchSlug);
  if (tenant.guardianOnly) {
    return { ok: false, error: "Sem permissão para alterar o repertório" };
  }

  const ministries = await getActiveMinistry(d.churchSlug);
  const ministry = ministries.options.find((item) => item.id === d.ministryId);
  if (!ministry?.canManage) {
    return { ok: false, error: "Sem permissão para alterar o repertório deste ministério" };
  }

  let proposal;
  try {
    proposal = await buildWorshipSetlistProposal(
      {
        churchId: tenant.church.id,
        ministryId: ministry.id,
        ministryName: ministry.name,
      },
      { eventId: d.eventId, songIds: d.songIds }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "proposal_invalid";
    if (message === "worship_scope_required") {
      return { ok: false, error: "Esta ação está disponível apenas no Louvor" };
    }
    if (message === "event_not_found") {
      return { ok: false, error: "O culto não está mais disponível" };
    }
    if (message === "worship_proposal_song_not_found") {
      return {
        ok: false,
        error: "Uma das músicas saiu do acervo ativo. Peça uma nova sugestão ao LUNOR.",
      };
    }
    return {
      ok: false,
      error: "A proposta mudou. Peça uma nova sugestão ao LUNOR.",
    };
  }

  const supabase = await createClient();
  const { data: currentItems, error: currentError } = await supabase
    .from("setlist_items")
    .select("song_id, position")
    .eq("church_id", tenant.church.id)
    .eq("event_id", proposal.event.id)
    .order("position");

  if (currentError) {
    return { ok: false, error: "Não foi possível conferir o repertório atual" };
  }

  const existingSongIds = new Set((currentItems ?? []).map((item) => item.song_id));
  const songsToAdd = proposal.songs.filter(
    (song) => !existingSongIds.has(song.songId)
  );
  const skippedExisting = proposal.songs.length - songsToAdd.length;

  if (songsToAdd.length === 0) {
    return { ok: true, data: { added: 0, skippedExisting } };
  }

  const nextPosition =
    Math.max(0, ...(currentItems ?? []).map((item) => item.position)) + 1;
  const { error: insertError } = await supabase.from("setlist_items").insert(
    songsToAdd.map((song, index) => ({
      church_id: tenant.church.id,
      event_id: proposal.event.id,
      song_id: song.songId,
      position: nextPosition + index,
      key_override: null,
      notes: null,
    }))
  );

  if (insertError) {
    if (insertError.code === "23505") {
      return {
        ok: false,
        error: "O repertório mudou enquanto você confirmava. Abra o culto e revise a sequência.",
      };
    }
    return { ok: false, error: "Não foi possível adicionar as músicas agora" };
  }

  revalidatePath(`/${d.churchSlug}`);
  revalidatePath(`/${d.churchSlug}/assistente`);
  revalidatePath(`/${d.churchSlug}/louvor`);
  revalidatePath(`/${d.churchSlug}/escalas/${proposal.event.id}`);

  return {
    ok: true,
    data: { added: songsToAdd.length, skippedExisting },
  };
}
