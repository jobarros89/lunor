"use client";

import { Textarea } from "@/components/ui/textarea";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createSong, updateSong } from "@/lib/actions/louvor";
import type { Song } from "@/lib/louvor";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TimeSignaturePicker } from "@/components/louvor/time-signature-picker";

type SongFormProps = {
  churchSlug: string;
  churchId: string;
} & ({ mode?: "create"; song?: never } | { mode: "edit"; song: Song });

export function SongForm(props: SongFormProps) {
  const { churchSlug, churchId } = props;
  const isEdit = props.mode === "edit";
  const song = isEdit ? props.song : null;
  const router = useRouter();
  const [aberto, setAberto] = useState(isEdit);
  const [timeSignature, setTimeSignature] = useState(song?.time_signature ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function salvar(form: FormData) {
    const payload = {
      churchSlug,
      churchId,
      title: String(form.get("title") ?? ""),
      artist: String(form.get("artist") ?? ""),
      defaultKey: String(form.get("defaultKey") ?? ""),
      bpm: form.get("bpm") ? Number(form.get("bpm")) : undefined,
      timeSignature: String(form.get("timeSignature") ?? ""),
      lyrics: String(form.get("lyrics") ?? ""),
      chordChart: String(form.get("chordChart") ?? ""),
      link: String(form.get("link") ?? ""),
      youtubeVideoId: song?.youtube_video_id ?? "",
      spotifyTrackId: song?.spotify_track_id ?? "",
    };

    setErro(null);
    startTransition(async () => {
      if (song) {
        const result = await updateSong({ ...payload, songId: song.id });
        if (!result.ok) {
          setErro(result.error ?? "Não foi possível salvar a música");
          return;
        }
        router.push(`/${churchSlug}/louvor/${song.id}`);
        return;
      }

      const result = await createSong(payload);
      if (!result.ok) {
        setErro(result.error ?? "Não foi possível cadastrar a música");
        return;
      }
      router.push(`/${churchSlug}/louvor/${result.data.songId}`);
    });
  }

  if (!aberto) {
    return (
      <Button
        variant="outline"
        onClick={() => setAberto(true)}
      >
        <Plus className="size-4" />
        Ou cadastre manualmente
      </Button>
    );
  }

  return (
    <form action={salvar} className="space-y-4">
      <Field label="Título" required>
        <Input
          name="title"
          defaultValue={song?.title ?? ""}
          placeholder="Nome da música"
          required
          maxLength={160}
        />
      </Field>

      <Field label="Artista">
        <Input
          name="artist"
          defaultValue={song?.artist ?? ""}
          placeholder="Artista (opcional)"
          maxLength={120}
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Tom padrão">
          <Input
            name="defaultKey"
            defaultValue={song?.default_key ?? ""}
            maxLength={8}
            placeholder="Ex.: G"
          />
        </Field>
        <Field label="BPM">
          <Input
            name="bpm"
            type="number"
            defaultValue={song?.bpm ?? ""}
            min={20}
            max={300}
            placeholder="20–300"
          />
        </Field>
        <Field label="Compasso">
          <TimeSignaturePicker
            name="timeSignature"
            value={timeSignature}
            onChange={setTimeSignature}
            id="song-time-signature"
          />
        </Field>
      </div>

      <Field label="Link de referência">
        <Input
          name="link"
          defaultValue={song?.link ?? ""}
          maxLength={500}
          placeholder="YouTube, cifra ou outra referência"
        />
      </Field>

      <Field label="Letra">
        <Textarea
          name="lyrics"
          defaultValue={song?.lyrics ?? ""}
          maxLength={20000}
          rows={isEdit ? 14 : 8}
          placeholder="Letra — é o que a equipe lê para ensaiar"
          className="w-full p-3 text-base md:text-sm"
        />
      </Field>

      <Field label="Cifra">
        <Textarea
          name="chordChart"
          defaultValue={song?.chord_chart ?? ""}
          maxLength={20000}
          rows={isEdit ? 16 : 10}
          placeholder="[Verso]\nC\nGrande é o Senhor"
          className="w-full p-3 font-mono text-base md:text-sm"
        />
      </Field>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} >
          {pending
            ? "Salvando…"
            : isEdit
              ? "Salvar alterações"
              : "Salvar no acervo"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => (isEdit ? router.back() : setAberto(false))}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
