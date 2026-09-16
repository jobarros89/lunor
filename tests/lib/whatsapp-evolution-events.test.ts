import { describe, expect, it } from "vitest";
import {
  mapEvolutionConnectionStatus,
  mapEvolutionMessageStatus,
  parseEvolutionConnectionUpdate,
  parseEvolutionMessageUpdate,
} from "@/lib/whatsapp/evolution-events";

describe("Evolution webhook events", () => {
  it.each([
    ["PENDING", null],
    ["SERVER_ACK", "sent"],
    ["DELIVERY_ACK", "delivered"],
    ["READ", "read"],
    ["PLAYED", "read"],
    ["ERROR", "failed"],
    ["DELETED", null],
  ])("mapeia status %s", (providerStatus, expected) => {
    expect(mapEvolutionMessageStatus(providerStatus)).toBe(expected);
  });

  it("extrai id e status de MESSAGES_UPDATE", () => {
    expect(
      parseEvolutionMessageUpdate({
        event: "MESSAGES_UPDATE",
        instance: "rez-rio",
        data: { key: { id: "ABC123" }, status: "DELIVERY_ACK" },
      })
    ).toMatchObject({
      event: "messages.update",
      instance: "rez-rio",
      providerMessageId: "ABC123",
      providerStatus: "DELIVERY_ACK",
      status: "delivered",
    });
  });

  it("aceita keyId e status dentro de update", () => {
    expect(
      parseEvolutionMessageUpdate({
        event: "messages.update",
        instance: "rez-rio",
        data: { keyId: "MSG-2", update: { status: "READ" } },
      })
    ).toMatchObject({ providerMessageId: "MSG-2", status: "read" });
  });

  it("rejeita update sem instância ou id da mensagem", () => {
    expect(parseEvolutionMessageUpdate({ event: "messages.update", data: { status: "READ" } })).toBeNull();
    expect(parseEvolutionMessageUpdate({ event: "messages.update", instance: "x", data: { status: "READ" } })).toBeNull();
  });

  it.each([
    ["open", "connected"],
    ["connecting", "connecting"],
    ["close", "disconnected"],
    ["error", "error"],
  ])("mapeia conexão %s", (providerState, expected) => {
    expect(mapEvolutionConnectionStatus(providerState)).toBe(expected);
  });

  it("extrai CONNECTION_UPDATE", () => {
    expect(
      parseEvolutionConnectionUpdate({
        event: "CONNECTION_UPDATE",
        instance: "rez-rio",
        data: { state: "open" },
      })
    ).toEqual({
      event: "connection.update",
      instance: "rez-rio",
      providerState: "open",
      status: "connected",
    });
  });
});
