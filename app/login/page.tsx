"use client";

import { useState, useEffect } from "react";
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

  useEffect(() => {
    if (!loading && user) {
      router.push("/");
    }
  }, [user, loading, router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#fdfaf6]"><div className="w-12 h-12 border-4 border-orange-300 border-t-orange-600 rounded-full animate-spin"></div></div>;
  if (user) return null;

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
      else {
        router.push("/");
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-8 relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, #fdfaf6 0%, #fff0dc 50%, #ffe0ba 100%)'
    }}>
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-orange-300 opacity-20 blur-3xl mix-blend-multiply"></div>
        <div className="absolute top-[60%] -right-[10%] w-[50%] h-[50%] rounded-full bg-yellow-400 opacity-20 blur-3xl mix-blend-multiply"></div>
      </div>

      <div className="w-full max-w-md z-10">
        <div className="bg-white/80 backdrop-blur-xl p-8 sm:p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-500 to-yellow-400 text-white text-3xl shadow-lg shadow-orange-200 mb-6">
              ☸
            </div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-700 to-orange-500">
              ปฏิทินกิจวัตรวัด
            </h1>
            <p className="text-gray-500 mt-3 font-medium">เข้าสู่ระบบเพื่อจัดการและติดตามกิจนิมนต์</p>
          </div>

          {error && (
            <div className="mb-6 p-4 text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="อีเมล"
                className="w-full p-3.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all placeholder:text-gray-400"
                required
              />
            </div>
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="รหัสผ่าน"
                className="w-full p-3.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all placeholder:text-gray-400"
                required
              />
            </div>
            <button type="submit" className="w-full py-4 mt-2 text-white bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl font-bold hover:from-orange-600 hover:to-orange-700 transition-all shadow-md shadow-orange-200/50 active:scale-[0.98]">
              {isSignUp ? "ลงทะเบียน" : "เข้าสู่ระบบ"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-8">
            {isSignUp ? "มีบัญชีอยู่แล้ว?" : "ยังไม่มีบัญชีใช่หรือไม่?"}{" "}
            <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="font-bold text-orange-600 hover:text-orange-700 underline underline-offset-2">
              {isSignUp ? "เข้าสู่ระบบ" : "ลงทะเบียนใหม่"}
            </button>
          </p>
        </div>
        
        <p className="text-center text-sm text-orange-800/60 mt-8 font-medium">
          ระบบบริหารจัดการกิจวัตรวัดอัจฉริยะ © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
