"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { createClient } from "../../lib/supabase/client";

export default function CreateRoom() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  if (!user) return <div className="p-8">กรุณาเข้าสู่ระบบ</div>;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error: rpcError } = await supabase.rpc("create_room", { room_name: name });
      
      if (rpcError) throw rpcError;
      
      if (data && typeof data === 'object' && 'room_id' in data) {
        router.push(`/?roomId=${data.room_id}`);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "เกิดข้อผิดพลาดในการสร้างห้อง");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white p-8 rounded-xl shadow-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">สร้างห้องของวัด</h1>
        {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อวัด / ชื่อห้อง</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            placeholder="เช่น วัดป่า... / กลุ่มบิณฑบาต..."
            required
            autoFocus
          />
        </div>

        <div className="flex gap-4">
          <button type="button" onClick={() => router.back()} className="w-full p-3 border rounded-lg hover:bg-gray-50">
            ยกเลิก
          </button>
          <button type="submit" disabled={loading} className="w-full p-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">
            {loading ? "กำลังสร้าง..." : "สร้างห้อง"}
          </button>
        </div>
      </form>
    </div>
  );
}
