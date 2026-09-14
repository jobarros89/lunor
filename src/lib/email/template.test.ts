import { describe, expect, it } from "vitest";
import { renderLunorEmail, renderLunorText } from "./template";

describe("LUNOR transactional email template", () => {
  it("renders details and optional repertoire", () => {
    const options = {
      title: "Você foi escalado",
      intro: "Confira sua escala.",
      details: [
        { label: "Campus", value: "Botafogo" },
        { label: "Chegada", value: "08:00" },
      ],
      listTitle: "Repertório",
      listItems: [{ primary: "Canção teste", secondary: "Tom G" }],
      actionLabel: "Ver escala",
      actionUrl: "https://lunorservice.com/escala",
    };

    const html = renderLunorEmail(options);
    const text = renderLunorText(options);

    expect(html).toContain("Campus");
    expect(html).toContain("Botafogo");
    expect(html).toContain("Canção teste");
    expect(html).toContain("Tom G");
    expect(text).toContain("Chegada: 08:00");
    expect(text).toContain("- Canção teste · Tom G");
  });

  it("does not render an empty optional list", () => {
    const html = renderLunorEmail({
      title: "Disponibilidade",
      intro: "Informe quando pode servir.",
      actionLabel: "Responder",
      actionUrl: "https://lunorservice.com/disponibilidade",
      listTitle: "Repertório",
      listItems: [],
    });

    expect(html).not.toContain(">Repertório<");
  });

  it("escapes dynamic content", () => {
    const html = renderLunorEmail({
      title: "<script>alert(1)</script>",
      intro: "Teste & validação",
      actionLabel: "Abrir",
      actionUrl: "https://lunorservice.com/?a=1&b=2",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Teste &amp; validação");
  });
});
