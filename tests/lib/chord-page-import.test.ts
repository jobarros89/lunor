import { describe, expect, it } from "vitest";
import {
  ChordPageImportError,
  extractChordPageCandidates,
  htmlFragmentToText,
  parsePublicChordUrl,
} from "@/lib/music/import/fetch-chord-page";

describe("importação de cifra por página pública", () => {
  it("aceita URL pública HTTP/HTTPS e remove fragmento", () => {
    expect(parsePublicChordUrl("https://example.com/cifra?id=1#refrão").toString()).toBe(
      "https://example.com/cifra?id=1"
    );
  });

  it.each([
    "http://localhost/cifra",
    "http://127.0.0.1/cifra",
    "http://10.0.0.10/cifra",
    "http://169.254.169.254/latest/meta-data",
    "http://172.16.20.3/cifra",
    "http://192.168.1.20/cifra",
    "http://[::1]/cifra",
    "http://service.internal/cifra",
  ])("bloqueia destinos locais ou privados: %s", (url) => {
    expect(() => parsePublicChordUrl(url)).toThrow(ChordPageImportError);
  });

  it("recusa protocolos e credenciais que não pertencem a uma página pública", () => {
    expect(() => parsePublicChordUrl("file:///etc/passwd")).toThrow(ChordPageImportError);
    expect(() => parsePublicChordUrl("https://user:pass@example.com/cifra")).toThrow(
      ChordPageImportError
    );
  });

  it("converte HTML em texto preservando alinhamento útil da cifra", () => {
    const text = htmlFragmentToText(
      "<div>Tom: G<br>G       D<br>Grande &amp; fiel<br><script>segredo()</script>Em   C</div>"
    );

    expect(text).toContain("Tom: G\nG       D\nGrande & fiel\nEm   C");
    expect(text).not.toContain("segredo");
  });

  it("prioriza blocos preformatados com conteúdo musical", () => {
    const html = `
      <html>
        <body>
          <nav>Entrar · Política de privacidade · Newsletter</nav>
          <main>
            <h1>Minha música</h1>
            <pre class="cifra">
Tom: G
Introdução:
G  D  Em  C
Verso:
G              D
Linha de exemplo para o teste
Em             C
Outra linha de exemplo
            </pre>
          </main>
        </body>
      </html>
    `;

    const candidates = extractChordPageCandidates(html);

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].source).toBe("pre");
    expect(candidates[0].content).toContain("G  D  Em  C");
    expect(candidates[0].content).not.toContain("Política de privacidade");
  });
});
