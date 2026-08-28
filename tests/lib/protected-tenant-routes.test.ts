import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const TENANT_ROOT = join(process.cwd(), "src", "app", "[churchSlug]");

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return name === "route.ts" ? [full] : [];
  });
}

describe("tenant route handlers — authentication regression guard", () => {
  it("toda route.ts sob [churchSlug] usa getTenant explicitamente", () => {
    const routes = routeFiles(TENANT_ROOT);
    expect(routes.length).toBeGreaterThan(0);

    const unprotected = routes
      .filter((file) => !readFileSync(file, "utf8").includes("getTenant("))
      .map((file) => relative(process.cwd(), file));

    expect(
      unprotected,
      `Rotas tenant sem getTenant(): ${unprotected.join(", ")}`
    ).toEqual([]);
  });
});
