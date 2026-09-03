const MCP_TOKEN_PREFIX = "lunor_mcp_";

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function isLunorMcpToken(value: string) {
  return value.startsWith(MCP_TOKEN_PREFIX) && value.length >= MCP_TOKEN_PREFIX.length + 40;
}

export function generateLunorMcpToken() {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  return `${MCP_TOKEN_PREFIX}${bytesToBase64Url(random)}`;
}

export function lunorMcpTokenPrefix(token: string) {
  return token.slice(0, 20);
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
