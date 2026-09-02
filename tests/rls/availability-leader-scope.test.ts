import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.API_URL!;
const anonKey = process.env.ANON_KEY!;
const serviceKey = process.env.SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function newUser(email: string): Promise<SupabaseClient> {
  const { error } = await admin.auth.admin.createUser({
    email,
    password: "senha-teste-123",
    email_confirm: true,
    user_metadata: { full_name: email.split("@")[0] },
  });
  if (error) throw error;

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: "senha-teste-123",
  });
  if (signInError) throw signInError;
  return client;
}

describe("disponibilidade visível por liderança ministerial", () => {
  let owner: SupabaseClient;
  let leader: SupabaseClient;
  let louvorVolunteer: SupabaseClient;
  let kidsVolunteer: SupabaseClient;
  let churchId: string;
  let louvorId: string;
  let kidsId: string;
  let leaderId: string;
  let louvorVolunteerId: string;
  let kidsVolunteerId: string;
  const run = Date.now();

  beforeAll(async () => {
    owner = await newUser(`availability-owner-${run}@teste.dev`);
    leader = await newUser(`availability-leader-${run}@teste.dev`);
    louvorVolunteer = await newUser(`availability-louvor-${run}@teste.dev`);
    kidsVolunteer = await newUser(`availability-kids-${run}@teste.dev`);

    churchId = (
      await owner.rpc("create_church", {
        p_name: "Igreja Disponibilidade",
        p_slug: `availability-${run}`,
      })
    ).data;

    const { data: church } = await admin
      .from("churches")
      .select("invite_code")
      .eq("id", churchId)
      .single();

    await Promise.all([
      leader.rpc("join_church", { p_invite_code: church!.invite_code }),
      louvorVolunteer.rpc("join_church", { p_invite_code: church!.invite_code }),
      kidsVolunteer.rpc("join_church", { p_invite_code: church!.invite_code }),
    ]);

    leaderId = (await leader.auth.getUser()).data.user!.id;
    louvorVolunteerId = (await louvorVolunteer.auth.getUser()).data.user!.id;
    kidsVolunteerId = (await kidsVolunteer.auth.getUser()).data.user!.id;

    const { data: ministries, error: ministriesError } = await owner
      .from("ministries")
      .insert([
        { church_id: churchId, name: "Louvor", slug: `louvor-${run}` },
        { church_id: churchId, name: "Kids", slug: `kids-${run}` },
      ])
      .select("id, name");
    expect(ministriesError).toBeNull();
    louvorId = ministries!.find((ministry) => ministry.name === "Louvor")!.id;
    kidsId = ministries!.find((ministry) => ministry.name === "Kids")!.id;

    const { error: membershipError } = await owner.from("ministry_members").insert([
      {
        church_id: churchId,
        ministry_id: louvorId,
        user_id: leaderId,
        role: "lider",
      },
      {
        church_id: churchId,
        ministry_id: louvorId,
        user_id: louvorVolunteerId,
        role: "voluntario",
      },
      {
        church_id: churchId,
        ministry_id: kidsId,
        user_id: kidsVolunteerId,
        role: "voluntario",
      },
    ]);
    expect(membershipError).toBeNull();

    const { error: louvorCalendarError } = await louvorVolunteer
      .from("member_availability_calendar")
      .insert({
        church_id: churchId,
        ministry_id: null,
        campus_id: null,
        user_id: louvorVolunteerId,
        availability_date: "2099-01-04",
        period: "all_day",
        status: "available",
      });
    expect(louvorCalendarError).toBeNull();

    const { error: kidsCalendarError } = await kidsVolunteer
      .from("member_availability_calendar")
      .insert([
        {
          church_id: churchId,
          ministry_id: null,
          campus_id: null,
          user_id: kidsVolunteerId,
          availability_date: "2099-01-04",
          period: "all_day",
          status: "available",
        },
        {
          church_id: churchId,
          ministry_id: kidsId,
          campus_id: null,
          user_id: kidsVolunteerId,
          availability_date: "2099-01-05",
          period: "all_day",
          status: "unavailable",
        },
      ]);
    expect(kidsCalendarError).toBeNull();

    const { error: recurringError } = await louvorVolunteer
      .from("member_availability_recurring")
      .insert({
        church_id: churchId,
        ministry_id: null,
        campus_id: null,
        user_id: louvorVolunteerId,
        weekday: 0,
        period: "all_day",
        status: "available",
      });
    expect(recurringError).toBeNull();
  });

  it("líder vê o calendário geral e recorrente do voluntário que lidera", async () => {
    const [{ data: calendar }, { data: recurring }] = await Promise.all([
      leader
        .from("member_availability_calendar")
        .select("user_id")
        .eq("church_id", churchId)
        .eq("user_id", louvorVolunteerId),
      leader
        .from("member_availability_recurring")
        .select("user_id")
        .eq("church_id", churchId)
        .eq("user_id", louvorVolunteerId),
    ]);

    expect(calendar).toEqual([{ user_id: louvorVolunteerId }]);
    expect(recurring).toEqual([{ user_id: louvorVolunteerId }]);
  });

  it("líder de Louvor não vê disponibilidade do Kids", async () => {
    const [{ data: general }, { data: ministry }] = await Promise.all([
      leader
        .from("member_availability_calendar")
        .select("user_id")
        .eq("church_id", churchId)
        .eq("user_id", kidsVolunteerId)
        .is("ministry_id", null),
      leader
        .from("member_availability_calendar")
        .select("user_id")
        .eq("church_id", churchId)
        .eq("ministry_id", kidsId),
    ]);

    expect(general).toEqual([]);
    expect(ministry).toEqual([]);
  });

  it("voluntário continua vendo a própria disponibilidade", async () => {
    const { data } = await kidsVolunteer
      .from("member_availability_calendar")
      .select("availability_date")
      .eq("church_id", churchId)
      .eq("user_id", kidsVolunteerId)
      .order("availability_date");

    expect(data).toEqual([
      { availability_date: "2099-01-04" },
      { availability_date: "2099-01-05" },
    ]);
  });
});
