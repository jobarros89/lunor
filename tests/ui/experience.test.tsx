// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BottomNav } from "@/components/shell/bottom-nav";
import { Sidebar } from "@/components/shell/sidebar";
import { OfflineNotice } from "@/components/shell/offline-notice";
import { TeamDirectory } from "@/components/pessoas/team-directory";
import { EquipmentDirectory } from "@/components/equipamentos/equipment-directory";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { DeleteFutureEventButton } from "@/components/escalas/event-delete-control";
import { SongContentTabs } from "@/components/louvor/song-content-tabs";
import { ChildForm } from "@/components/infantil/child-form";
import { AvailabilityCalendar } from "@/components/disponibilidade/availability-calendar";
import LoginPage from "@/app/(auth)/login/page";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const mocks = vi.hoisted(() => ({
  pathname: "/demo/louvor",
  completeChurch: vi.fn(async () => ({ ok: true })),
  completeMember: vi.fn(async () => ({ ok: true })),
  deleteEvent: vi.fn(async () => ({ ok: true })),
  createChild: vi.fn(async () => ({ ok: true })),
  submitAvailability: vi.fn(async () => ({ ok: true })),
  signIn: vi.fn<(data: FormData) => Promise<{ ok: boolean; error: string }>>(
    async () => ({
      ok: false,
      error: "Não foi possível entrar. Confira seus dados.",
    }),
  ),
  signInWithGoogle: vi.fn(),
  registerMaterial: vi.fn(),
  removeMaterial: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => createElement("a", props),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/onboarding", () => ({
  completeChurchOnboarding: mocks.completeChurch,
  completeMemberOnboarding: mocks.completeMember,
}));
vi.mock("@/lib/actions/event-delete", () => ({
  deleteFutureEvent: mocks.deleteEvent,
}));
vi.mock("@/lib/actions/infantil", () => ({ createChild: mocks.createChild }));
vi.mock("@/lib/actions/auth", () => ({
  signIn: mocks.signIn,
  signInWithGoogle: mocks.signInWithGoogle,
}));
vi.mock("@/lib/actions/availability", () => ({
  submitMyCalendarAvailability: mocks.submitAvailability,
}));
vi.mock("@/lib/actions/rehearsal-materials", () => ({
  registerRehearsalMaterial: mocks.registerMaterial,
  removeRehearsalMaterial: mocks.removeMaterial,
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({ createSignedUrl: vi.fn(async () => ({ data: null })) }),
    },
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  localStorage.clear();
  vi.clearAllMocks();
  mocks.pathname = "/demo/louvor";
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});
async function render(node: ReactNode) {
  await act(async () => root.render(node));
}
async function nextFrame() {
  // Base UI schedules initial and restored focus on the next animation frame.
  await act(
    async () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
}
async function click(element: Element | null | undefined) {
  expect(element).toBeTruthy();
  await act(async () => (element as HTMLElement).click());
  await nextFrame();
}
function button(text: string) {
  return [...document.querySelectorAll("button")].find(
    (node) => node.textContent?.trim() === text,
  );
}
async function input(element: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function select(element: HTMLSelectElement, value: string) {
  await act(async () => {
    element.value = value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function key(element: Element, key: string) {
  await act(async () =>
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        code: key,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  await nextFrame();
}

describe("Navegação e estados compartilhados", () => {
  it("oferece ao voluntário os módulos habilitados e mantém o perfil acessível por Mais", async () => {
    await render(
      <BottomNav
        churchSlug="demo"
        hasLouvor
        hasKids={false}
        isLeader={false}
        escalasPending={2}
      />,
    );
    const hrefs = [...host.querySelectorAll("a")].map((node) =>
      node.getAttribute("href"),
    );
    expect(hrefs).toEqual([
      "/demo",
      "/demo/escalas?filtro=todas",
      "/demo/times",
      "/demo/escalas?filtro=minhas",
      "/demo/mais",
    ]);
  });
  it("mantém o menu familiar separado, mesmo com outros módulos habilitados", async () => {
    await render(
      <BottomNav churchSlug="demo" guardianOnly hasLouvor hasKids isLeader />,
    );
    expect(
      [...host.querySelectorAll("a")].map((node) => node.getAttribute("href")),
    ).toEqual(["/demo/infantil", "/demo/mais"]);
  });
  it("agrupa a navegação sem duplicar links nem exibir administração sem permissão", async () => {
    await render(
      <Sidebar
        churchSlug="demo"
        churchName="Igreja de teste"
        canAdmin={false}
        isLeader={false}
        activeMinistryNavigation={null}
        hasLouvor
        hasKids={false}
      />,
    );
    const hrefs = [...host.querySelectorAll("nav a")].map((node) =>
      node.getAttribute("href"),
    );
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).not.toContain("/demo/admin");
    expect(hrefs).not.toContain("/demo/infantil");
    expect(
      host.querySelector('[role="group"][aria-label="Seus times"]'),
    ).not.toBeNull();
    await click(
      host.querySelector('button[aria-label="Recolher menu lateral"]'),
    );
    expect(host.querySelector('a[aria-label="Times"]')).not.toBeNull();
    await click(
      host.querySelector('button[aria-label="Expandir menu lateral"]'),
    );
    expect(host.textContent).toContain("Presença · preparo · propósito");
  });
  it("anuncia a perda de conexão e remove o aviso quando ela retorna", async () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    await render(<OfflineNotice />);
    expect(host.textContent).toBe("");
    online.mockReturnValue(false);
    await act(async () => window.dispatchEvent(new Event("offline")));
    expect(host.querySelector('[role="status"]')?.textContent).toContain(
      "sem conexão",
    );
    online.mockReturnValue(true);
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(host.textContent).toBe("");
  });
  it("preserva IDs explícitos e associa rótulo, ajuda e erro ao campo", async () => {
    await render(
      <Field
        label="Nome"
        description="Como aparece na equipe"
        error="Confira o nome"
      >
        <Input id="member-name" />
      </Field>,
    );
    const control = host.querySelector("input")!;
    expect(host.querySelector("label")?.htmlFor).toBe("member-name");
    expect(control.getAttribute("aria-invalid")).toBe("true");
    for (const id of control.getAttribute("aria-describedby")!.split(" "))
      expect(document.getElementById(id)).not.toBeNull();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(
      "Confira o nome",
    );
  });
});

describe("Diretórios", () => {
  it("busca pessoas sem depender de acentos e limpa a busca devolvendo o foco", async () => {
    await render(
      <TeamDirectory
        churchSlug="demo"
        members={[
          {
            id: "one",
            name: "Júlia de Teste",
            profession: "Música",
            avatarUrl: null,
            roles: ["Voluntário"],
            churchRole: null,
            skillCount: 1,
          },
          {
            id: "two",
            name: "Pedro de Teste",
            profession: null,
            avatarUrl: null,
            roles: [],
            churchRole: null,
            skillCount: 0,
          },
        ]}
      />,
    );
    const search = host.querySelector("input")!;
    await input(search, "julia");
    expect(host.querySelectorAll("li")).toHaveLength(1);
    expect(host.querySelector('a[href="/demo/pessoas/one"]')).not.toBeNull();
    await input(search, "inexistente");
    expect(host.textContent).toContain("Nenhuma pessoa encontrada");
    await click(host.querySelector('button[aria-label="Limpar busca"]'));
    expect(document.activeElement).toBe(search);
    expect(host.querySelectorAll("li")).toHaveLength(2);
  });
  it("combina busca e situação sem perder o acesso à ficha do equipamento", async () => {
    await render(
      <EquipmentDirectory
        churchSlug="demo"
        items={[
          {
            id: "a",
            name: "Teclado A",
            details: "Modelo Alpha",
            owner: "Da igreja",
            status: "disponivel",
            statusLabel: "Disponível",
            statusClassName: "",
            photoUrl: null,
            valueLabel: null,
          },
          {
            id: "b",
            name: "Teclado B",
            details: "Modelo Beta",
            owner: "Da igreja",
            status: "manutencao",
            statusLabel: "Manutenção",
            statusClassName: "",
            photoUrl: null,
            valueLabel: null,
          },
        ]}
      />,
    );
    await select(host.querySelector("select")!, "manutencao");
    expect(host.querySelectorAll("li")).toHaveLength(1);
    expect(host.querySelector('a[href="/demo/equipamentos/b"]')).not.toBeNull();
    await input(host.querySelector("input")!, "Alpha");
    expect(host.textContent).toContain("Nenhum equipamento encontrado");
    await click(button("Limpar filtros"));
    expect(host.querySelectorAll("li")).toHaveLength(2);
    expect(host.querySelector("select")?.value).toBe("");
  });
});

describe("Entrada e onboarding", () => {
  it("mostra e oculta a senha sem submeter o login e mantém o erro visível após a tentativa", async () => {
    await render(<LoginPage />);
    const email = host.querySelector<HTMLInputElement>('[name="email"]')!;
    const password = host.querySelector<HTMLInputElement>('[name="password"]')!;
    await input(email, "teste@exemplo.com");
    await input(password, "senha-apenas-de-teste");
    await click(host.querySelector('button[aria-label="Mostrar senha"]'));
    expect(password.type).toBe("text");
    expect(password.value).toBe("senha-apenas-de-teste");
    expect(mocks.signIn).not.toHaveBeenCalled();
    await click(host.querySelector('button[aria-label="Ocultar senha"]'));
    expect(password.type).toBe("password");
    await click(button("Entrar"));
    expect(mocks.signIn).toHaveBeenCalledOnce();
    expect(mocks.signIn.mock.calls[0][0].get("email")).toBe(
      "teste@exemplo.com",
    );
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "Confira seus dados",
    );
    expect(button("Continuar com Google")).toBeTruthy();
    expect(mocks.signInWithGoogle).not.toHaveBeenCalled();
  });
  it("mantém a criação da igreja apenas na confirmação da última etapa", async () => {
    await render(
      <OnboardingWizard
        mode="owner"
        churchId="church"
        churchName="Teste"
        churchSlug="demo"
        ministries={[]}
        skills={[]}
      />,
    );
    await click(button("Continuar"));
    expect(host.querySelector('[aria-current="step"]')?.textContent).toContain(
      "Primeiro time",
    );
    expect(document.activeElement).toBe(host.querySelector("h1"));
    await click(button("Continuar"));
    expect(mocks.completeChurch).not.toHaveBeenCalled();
    await click(button("Ir para o LUNOR"));
    expect(mocks.completeChurch).toHaveBeenCalledWith({
      churchId: "church",
      modules: ["teams", "worship"],
      ministryName: "Louvor",
    });
  });
  it("permite escolher mais de um ministério sem concluir o cadastro antes do envio", async () => {
    await render(
      <OnboardingWizard
        mode="member"
        churchId="church"
        churchName="Teste"
        churchSlug="demo"
        ministries={[
          { id: "kids", name: "Kids" },
          { id: "music", name: "Louvor" },
        ]}
        skills={[]}
      />,
    );
    expect(button("Entrar no LUNOR")?.disabled).toBe(true);
    await click(button("Kids"));
    await click(button("Louvor"));
    expect(mocks.completeMember).not.toHaveBeenCalled();
    await click(button("Entrar no LUNOR"));
    expect(mocks.completeMember).toHaveBeenCalledWith({
      churchId: "church",
      ministryIds: ["kids", "music"],
      phone: "",
    });
  });
});

describe("Preparo e operação", () => {
  it("a troca de mês limpa só a seleção visual e preserva o rascunho até confirmar", async () => {
    await render(
      <AvailabilityCalendar
        churchSlug="demo"
        churchId="church"
        ministryId="kids"
        scopeLabel="Kids"
        initialMonth="2026-09"
        entries={[]}
        campuses={[]}
      />,
    );
    const day = [...host.querySelectorAll("button[aria-label]")].find((node) =>
      node.getAttribute("aria-label")?.startsWith("1 de "),
    );
    await click(day);
    await click(button("Disponível"));
    await click(host.querySelector('button[aria-label="Próximo mês"]'));
    expect(host.querySelector('button[aria-pressed="true"]')).toBeNull();
    await click(host.querySelector('button[aria-label="Mês anterior"]'));
    expect(mocks.submitAvailability).not.toHaveBeenCalled();
    await click(button("Confirmar disponibilidade do mês"));
    expect(mocks.submitAvailability).toHaveBeenCalledWith(
      expect.objectContaining({
        month: "2026-09",
        entries: [{ date: "2026-09-01", status: "available" }],
      }),
    );
  });
  it("não exclui ao abrir ou cancelar a confirmação e devolve o foco ao gatilho", async () => {
    await render(
      <DeleteFutureEventButton
        context={{
          churchSlug: "demo",
          churchId: "church",
          eventId: "event",
          eventTitle: "Culto de teste",
        }}
        redirectTo="/demo/escalas"
      />,
    );
    const trigger = button("Apagar culto")!;
    trigger.focus();
    await click(trigger);
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(document.activeElement?.textContent).toBe("Não, manter");
    expect(mocks.deleteEvent).not.toHaveBeenCalled();
    await click(button("Não, manter"));
    expect(mocks.deleteEvent).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
    await click(trigger);
    await key(document.activeElement!, "Escape");
    expect(mocks.deleteEvent).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });
  it("só executa a exclusão após a confirmação explícita e preserva o destino", async () => {
    const context = {
      churchSlug: "demo",
      churchId: "church",
      eventId: "event",
      eventTitle: "Culto de teste",
    };
    await render(
      <DeleteFutureEventButton context={context} redirectTo="/demo/escalas" />,
    );
    await click(button("Apagar culto"));
    await click(button("Sim, apagar"));
    expect(mocks.deleteEvent).toHaveBeenCalledWith(context);
    expect(mocks.push).toHaveBeenCalledWith("/demo/escalas");
  });
  it("navega por letra e cifra com teclado e mantém o envio de materiais restrito", async () => {
    await render(
      <SongContentTabs
        churchSlug="demo"
        churchId="church"
        songId="song"
        lyrics="Letra de teste"
        chordChart="C G Am F"
        materials={[]}
        arrangementVersions={[]}
        canEdit={false}
      />,
    );
    const tabs = [...host.querySelectorAll<HTMLElement>('[role="tab"]')];
    expect(tabs).toHaveLength(3);
    tabs[0].focus();
    await key(tabs[0], "ArrowRight");
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    expect(host.querySelector('[role="tabpanel"]')?.textContent).toContain(
      "C G Am F",
    );
    await click(tabs[2]);
    expect(host.textContent).not.toContain("Adicionar material de ensaio");
    expect(mocks.registerMaterial).not.toHaveBeenCalled();
    expect(mocks.removeMaterial).not.toHaveBeenCalled();
  });
  it("preserva os consentimentos e os dados enviados no cadastro Kids", async () => {
    await render(
      <ChildForm churchSlug="demo" churchId="church" ministryId="kids" />,
    );
    expect(button("Cadastrar criança")?.disabled).toBe(true);
    await input(
      host.querySelector<HTMLInputElement>('[name="fullName"]')!,
      "Criança de teste",
    );
    await input(
      host.querySelector<HTMLInputElement>('[name="birthDate"]')!,
      "2020-01-01",
    );
    await input(
      host.querySelector<HTMLInputElement>('[name="guardianName"]')!,
      "Responsável de teste",
    );
    await click(host.querySelectorAll('input[type="checkbox"]')[0]);
    expect(mocks.createChild).not.toHaveBeenCalled();
    await click(button("Cadastrar criança"));
    expect(mocks.createChild).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "Criança de teste",
        guardianName: "Responsável de teste",
        consent: true,
        photoConsent: false,
        churchId: "church",
        ministryId: "kids",
      }),
    );
    expect(mocks.push).toHaveBeenCalledWith("/demo/infantil");
  });
});
