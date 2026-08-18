// Tests to verify Supabase RLS and RPC logic
// Note: Requires a local Supabase instance running and test users created.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "YOUR_ANON_KEY";

const aliceClient = createClient(supabaseUrl, supabaseKey);
const bobClient = createClient(supabaseUrl, supabaseKey);

describe("Supabase Security Rules", () => {
  beforeAll(async () => {
    // Authenticate test users
    await aliceClient.auth.signInWithPassword({ email: "alice@test.com", password: "password" });
    await bobClient.auth.signInWithPassword({ email: "bob@test.com", password: "password" });
  });

  it("Alice can create a room and becomes Abbot", async () => {
    const { data, error } = await aliceClient.rpc("create_room_with_abbot", { room_name: "Alice's Room" });
    expect(error).toBeNull();
    expect(data.room_id).toBeDefined();
    
    // Verify membership role
    const { data: mem } = await aliceClient.from("memberships").select("role").eq("room_id", data.room_id).single();
    expect(mem?.role).toBe("abbot");
  });

  it("Bob cannot read Alice's room data unless he joins", async () => {
    const { data: roomData } = await aliceClient.from("rooms").select("id").limit(1).single();
    const roomId = roomData?.id;

    const { data: bobRead, error } = await bobClient.from("rooms").select("*").eq("id", roomId);
    expect(bobRead).toHaveLength(0); // Should be empty due to RLS
  });

  it("Bob can join via invite code", async () => {
    // Alice generates invite code
    const { data: inviteCode } = await aliceClient.rpc("rotate_invite_code", { target_room_id: "ALICE_ROOM_ID" });
    
    // Bob joins
    const { data: joinedRoomId, error } = await bobClient.rpc("join_room_by_invite", { code: inviteCode });
    expect(error).toBeNull();
    expect(joinedRoomId).toBeDefined();

    // Verify Bob is a member
    const { data: bobMem } = await bobClient.from("memberships").select("role").eq("room_id", joinedRoomId).single();
    expect(bobMem?.role).toBe("member");
  });

  it("Only Abbot can rotate invite code", async () => {
    const { error } = await bobClient.rpc("rotate_invite_code", { target_room_id: "ALICE_ROOM_ID" });
    expect(error).not.toBeNull(); // Should fail
  });
});
