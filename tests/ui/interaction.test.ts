// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SongLibrary } from "@/components/louvor/song-library";
import { AvailabilityCalendar } from "@/components/disponibilidade/availability-calendar";
import { SectionNav } from "@/components/ui/section-nav";
import type { Song } from "@/lib/louvor";

const { submitAvailability } = vi.hoisted(() => ({ submitAvailability: vi.fn(async () => ({ ok: true })) }));
vi.mock("next/link", () => ({ default: (props: Record<string, unknown>) => createElement("a", props) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/actions/availability", () => ({ submitMyCalendarAvailability: submitAvailability }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vi.clearAllMocks();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

async function click(button: Element | null | undefined) {
  expect(button).toBeTruthy();
  await act(async () => (button as HTMLElement).click());
}
function button(text: string) {
  return [...host.querySelectorAll("button")].find((element) => element.textContent?.includes(text));
}
async function search(value: string) {
  const input = host.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("UI: preparo do voluntário", () => {
  it("filtra por artista, comunica ausência de resultados e permite recuperar o acervo", async () => {
    const songs: Song[] = [
      { id: "a", title: "Canção A", artist: "Equipe Alfa", default_key: "D", bpm: 72, lyrics: null, link: null, active: true },
      { id: "b", title: "Canção B", artist: "Equipe Beta", default_key: "A", bpm: 110, lyrics: null, link: null, active: true },
    ];
    await act(async () => root.render(createElement(SongLibrary, { churchSlug: "demo", songs, lastUsed: {} })));
    await search("beta");
    expect(host.querySelectorAll('a[href^="/demo/louvor/"]')).toHaveLength(1);
    expect(host.querySelector('a[href="/demo/louvor/b"]')).not.toBeNull();
    expect(host.querySelector('[role="status"]')?.textContent).toContain("1 música");
    await search("sem resultado");
    expect(host.textContent).toContain("Nenhuma música encontrada");
    await click(button("Ver todo o acervo"));
    expect(host.querySelectorAll('a[href^="/demo/louvor/"]')).toHaveLength(2);
    expect(host.querySelector("input")?.value).toBe("");
  });

  it("mantém a disponibilidade como rascunho até a confirmação explícita do mês", async () => {
    await act(async () => root.render(createElement(AvailabilityCalendar, {
      churchSlug: "demo", churchId: "church", ministryId: "kids", scopeLabel: "Kids",
      initialMonth: "2026-09", entries: [], campuses: [],
    })));
    const day = [...host.querySelectorAll('button[aria-label]')].find((element) => element.getAttribute("aria-label")?.startsWith("1 de "));
    await click(day);
    expect(day?.getAttribute("aria-pressed")).toBe("true");
    await click([...host.querySelectorAll("button")].find((element) => element.textContent?.trim() === "Disponível"));
    expect(submitAvailability).not.toHaveBeenCalled();
    await click(button("Confirmar disponibilidade do mês"));
    expect(submitAvailability).toHaveBeenCalledOnce();
    expect(submitAvailability).toHaveBeenCalledWith(expect.objectContaining({
      churchId: "church", ministryId: "kids", month: "2026-09",
      entries: [{ date: "2026-09-01", status: "available" }],
    }));
    expect(host.textContent).toContain("enviada");
  });

  it("expõe a seção ativa e preserva os endereços da navegação", async () => {
    await act(async () => root.render(createElement(SectionNav, { label: "Áreas do Kids", items: [
      { key: "home", label: "Visão", href: "/demo/infantil", active: false },
      { key: "availability", label: "Disponibilidade", href: "/demo/infantil/disponibilidade", active: true },
    ] })));
    expect(host.querySelector('nav')?.getAttribute("aria-label")).toBe("Áreas do Kids");
    expect(host.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(host.querySelector('[aria-current="page"]')?.getAttribute("href")).toBe("/demo/infantil/disponibilidade");
  });
});
