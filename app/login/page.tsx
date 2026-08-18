"use client";

import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  if (loading) return <div className="p-8 text-center">กำลังโหลด...</div>;
  if (user) {
    router.push("/");
    return null;
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setError("โปรดยืนยันอีเมลของคุณ");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      else router.push("/");
    }
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) setError("ไม่สามารถเข้าสู่ระบบด้วย Google ได้");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-sm space-y-6 bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <div className="text-center">
          <div className="text-4xl text-orange-500 mb-2">☸</div>
          <h1 className="text-2xl font-bold">ปฏิทินกิจวัตรวัด</h1>
          <p className="text-gray-500 text-sm mt-1">กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ</p>
        </div>

        {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">{error}</div>}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="อีเมล"
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none transition"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="รหัสผ่าน"
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none transition"
            required
          />
          <button type="submit" className="w-full p-3 text-white bg-orange-600 rounded-lg font-medium hover:bg-orange-700 transition">
            {isSignUp ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
          <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">หรือ</span></div>
        </div>

        <button
          onClick={handleGoogleLogin}
          type="button"
          className="w-full p-3 flex items-center justify-center gap-2 border rounded-lg hover:bg-gray-50 transition"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
          เข้าสู่ระบบด้วย Google
        </button>

        <p className="text-center text-sm text-gray-500">
          {isSignUp ? "มีบัญชีอยู่แล้ว?" : "ยังไม่มีบัญชี?"}{" "}
          <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-orange-600 hover:underline">
            {isSignUp ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
          </button>
        </p>
      </div>
    </div>
  );
}
