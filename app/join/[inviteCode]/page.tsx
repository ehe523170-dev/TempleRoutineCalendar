"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import Link from "next/link";

export default function JoinRoom() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const inviteCode = params.inviteCode as string;
  const [status, setStatus] = useState("กำลังประมวลผล...");
  const [error, setError] = useState("");
  const supabase = createClient();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      sessionStorage.setItem("pendingJoin", inviteCode);
      router.push("/login");
      return;
    }

    async function join() {
      try {
        const { data: roomId, error: rpcError } = await supabase.rpc("join_room_by_invite", { invite_token: inviteCode });
        
        if (rpcError) throw rpcError;
        
        setStatus("เข้าร่วมห้องสำเร็จ!");
        setTimeout(() => {
          router.replace(`/?roomId=${roomId}`);
        }, 1500);
      } catch (err: any) {
        console.error(err);
        setStatus("");
        setError(err.message || "รหัสคำเชิญไม่ถูกต้อง หรือหมดอายุแล้ว");
      }
    }

    join();
  }, [user, loading, inviteCode, router, supabase]);

  if (loading) return <div className="p-8 text-center">กำลังโหลด...</div>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-sm bg-white p-8 rounded-xl shadow-sm text-center space-y-4">
        <h1 className="text-2xl font-bold">เข้าร่วมห้อง</h1>
        {status && <p className="text-green-600">{status}</p>}
        {error && (
          <div className="space-y-4">
            <p className="text-red-600">{error}</p>
            <Link href="/" className="inline-block px-4 py-2 bg-orange-600 text-white rounded-lg">กลับหน้าแรก</Link>
          </div>
        )}
      </div>
    </div>
  );
}
