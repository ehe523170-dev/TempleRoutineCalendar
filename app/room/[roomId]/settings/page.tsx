"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../../contexts/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "../../../../lib/supabase/client";
import Link from "next/link";
import QRCode from "react-qr-code";

type Membership = {
  user_id: string;
  role: string;
  profiles?: { email: string, full_name: string };
};

export default function RoomSettings() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;
  
  const [members, setMembers] = useState<Membership[]>([]);
  const [role, setRole] = useState("member");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("");
  const supabase = createClient();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    async function load() {
      const { data: myMem } = await supabase
        .from("memberships")
        .select("role")
        .eq("room_id", roomId)
        .eq("user_id", user?.id)
        .single();
      
      if (!myMem) {
        router.push("/");
        return;
      }
      setRole(myMem.role);

      const { data: roomData } = await supabase.from("rooms").select("name").eq("id", roomId).single();
      if (roomData) setRoomName(roomData.name);

      const { data: mems } = await supabase
        .from("memberships")
        .select(`
          user_id,
          role,
          profiles (
            email,
            full_name
          )
        `)
        .eq("room_id", roomId);
        
      if (mems) setMembers(mems as any[]);
    }
    load();
  }, [user, loading, roomId, router, supabase]);

  const canEdit = role === "abbot";

  async function rotateCode() {
    if (!canEdit) return;
    if (confirm("การเปลี่ยนรหัส QR จะทำให้ QR เก่าใช้งานไม่ได้ ต้องการทำต่อหรือไม่?")) {
      const { data, error } = await supabase.rpc("rotate_room_invite", { room_id: roomId });
      if (error) alert("Error: " + error.message);
      else if (data) setInviteCode(data);
    }
  }

  async function promoteUser(targetUserId: string, newRole: string) {
    if (!canEdit) return;
    await supabase.from("memberships").update({ role: newRole }).eq("room_id", roomId).eq("user_id", targetUserId);
    setMembers(members.map(m => m.user_id === targetUserId ? { ...m, role: newRole } : m));
  }
  
  async function kickUser(targetUserId: string) {
    if (!canEdit) return;
    if (confirm("คุณต้องการลบสมาชิกคนนี้ออกจากห้องใช่หรือไม่?")) {
      await supabase.from("memberships").delete().eq("room_id", roomId).eq("user_id", targetUserId);
      setMembers(members.filter(m => m.user_id !== targetUserId));
    }
  }

  const joinUrl = inviteCode ? `${window.location.origin}/join/${inviteCode}` : "";

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link href={`/?roomId=${roomId}`} className="text-gray-500 hover:text-black">← กลับ</Link>
        <h1 className="text-2xl font-bold">ตั้งค่าห้อง: {roomName || roomId.substring(0,8)}...</h1>
      </div>

      {canEdit && (
        <section className="bg-white p-6 rounded-xl shadow-sm space-y-4">
          <h2 className="text-xl font-bold">รหัสเชิญ / QR Code (เจ้าอาวาส)</h2>
          {!inviteCode ? (
            <button onClick={rotateCode} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
              สร้าง QR Code รับสมาชิก
            </button>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-100 p-4 inline-block rounded-lg">
                <QRCode value={joinUrl} size={150} />
              </div>
              <p className="text-sm bg-gray-50 p-2 rounded break-all">{joinUrl}</p>
              <button onClick={rotateCode} className="px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 text-sm">
                หมุนเวียนเปลี่ยนรหัสใหม่ (ยกเลิกอันเก่า)
              </button>
            </div>
          )}
        </section>
      )}

      <section className="bg-white p-6 rounded-xl shadow-sm space-y-4">
        <h2 className="text-xl font-bold">สมาชิกในห้อง</h2>
        <div className="divide-y border-t border-gray-100 mt-4">
          {members.map(m => (
            <div key={m.user_id} className="py-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">
                  {m.profiles?.email || m.user_id.substring(0,8)}... 
                  {m.user_id === user?.id && <span className="text-orange-500 ml-1">(คุณ)</span>}
                </p>
                <p className="text-xs text-gray-500 capitalize">สิทธิ์: {m.role}</p>
              </div>
              {canEdit && m.user_id !== user?.id && (
                <div className="flex gap-2">
                  <select 
                    value={m.role} 
                    onChange={(e) => promoteUser(m.user_id, e.target.value)}
                    className="p-1 border rounded text-sm bg-gray-50 outline-none"
                  >
                    <option value="member">Member</option>
                    <option value="scheduler">Scheduler</option>
                    <option value="abbot">Abbot</option>
                  </select>
                  <button onClick={() => kickUser(m.user_id)} className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded">ลบ</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
