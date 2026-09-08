import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchVerseTextFromFree } from "@/lib/bible/fetch-verse-free";

describe("fetchVerseTextFromFree", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("busca o livro na fonte oficial da BLIVRE e extrai somente o versículo", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        [
          "\\name-short",
          "Efésios",
          "\\*name-short",
          "\\v Ef.4.2",
          "Versículo anterior.",
          "\\v Ef.4.3",
          "Procurai guardar a unidade do Espírito pelo vínculo da paz.",
          "\\fn",
          "Nota editorial que não deve aparecer.",
          "\\*fn",
          "\\v Ef.4.4",
          "Versículo seguinte.",
        ].join("\n")
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchVerseTextFromFree({
      book: "ef",
      chapter: 4,
      verse: 3,
      label: "Ef 4:3",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/blivre/BibliaLivre/master/textos/f4/n4/efes.txt",
      expect.objectContaining({ cache: "force-cache" })
    );
    expect(result).toEqual({
      text: "Procurai guardar a unidade do Espírito pelo vínculo da paz.",
      label: "Ef 4:3",
      version: "BLIVRE",
    });
  });
});
