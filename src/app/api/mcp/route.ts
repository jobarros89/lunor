import { z } from "zod";
import {
  executeLunorTool,
  LUNOR_TOOLS,
  type LunorToolContext,
} from "@/lib/ai/tools";
import { getActiveMinistry } from "@/lib/ministry";
import { createClient } from "@/lib/supabase/server";
import { getTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const MCP_VERSION = "2026-07-28";
const HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  "MCP-Protocol-Version": MCP_VERSION,
  "X-Robots-Tag": "noindex, nofollow",
};

const rpcSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]),
  method: z.enum(["server/discover", "tools/list", "tools/call"]),
  params: z.record(z.string(), z.unknown()).optional(),
});

const callSchema = z.object({
  name: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()).default({}),
});

function rpcResult(id: string | number, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result }, { headers: HEADERS });
}

function rpcError(
  id: string | number | null,
  code: number,
  message: string,
  status = 200
) {
  return Response.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    { status, headers: HEADERS }
  );
}

async function toolContext(request: Request): Promise<LunorToolContext | null> {
  const churchSlug = request.headers.get("x-lunor-church-slug")?.trim();
  const ministryId = request.headers.get("x-lunor-ministry-id")?.trim();
  if (!churchSlug || !ministryId || !z.string().uuid().safeParse(ministryId).success) {
    return null;
  }

  const tenant = await getTenant(churchSlug);
  if (tenant.guardianOnly) return null;
  const ministries = await getActiveMinistry(churchSlug);
  const ministry = ministries.options.find((item) => item.id === ministryId);
  if (!ministry?.canManage) return null;

  return {
    churchId: tenant.church.id,
    ministryId: ministry.id,
    ministryName: ministry.name,
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return rpcError(null, -32001, "Unauthorized", 401);

  const protocol = request.headers.get("mcp-protocol-version");
  if (protocol !== MCP_VERSION) {
    return rpcError(null, -32600, `MCP-Protocol-Version must be ${MCP_VERSION}`, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
  }
  const parsed = rpcSchema.safeParse(body);
  if (!parsed.success) return rpcError(null, -32600, "Invalid Request", 400);

  const { id, method, params } = parsed.data;
  const methodHeader = request.headers.get("mcp-method");
  if (methodHeader !== method) {
    return rpcError(id, -32600, "Mcp-Method header does not match request method", 400);
  }

  if (method === "server/discover") {
    return rpcResult(id, {
      protocolVersion: MCP_VERSION,
      serverInfo: { name: "lunor", version: "1" },
      capabilities: { tools: { listChanged: false } },
    });
  }

  if (method === "tools/list") {
    return rpcResult(id, {
      tools: LUNOR_TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.parameters,
        annotations: tool.annotations,
      })),
      ttlMs: 300_000,
      cacheScope: "private",
    });
  }

  const call = callSchema.safeParse(params ?? {});
  if (!call.success) return rpcError(id, -32602, "Invalid tool arguments");
  const nameHeader = request.headers.get("mcp-name");
  if (nameHeader !== call.data.name) {
    return rpcError(id, -32600, "Mcp-Name header does not match tool name", 400);
  }
  if (!LUNOR_TOOLS.some((tool) => tool.name === call.data.name)) {
    return rpcError(id, -32602, "Unknown tool");
  }

  const context = await toolContext(request);
  if (!context) return rpcError(id, -32003, "Forbidden", 403);

  try {
    const result = await executeLunorTool(call.data.name, call.data.arguments, context);
    return rpcResult(id, {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
      isError: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "tool_error";
    return rpcResult(id, {
      content: [{ type: "text", text: `Erro ao consultar o LUNOR: ${message}` }],
      isError: true,
    });
  }
}
