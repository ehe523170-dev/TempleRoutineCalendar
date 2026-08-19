"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

type EventItem = {
  id: string;
  day: number;
  time: string;
  title: string;
  kind: "บิณฑบาต" | "งานวัด" | "กิจนิมนต์";
  color: "saffron" | "green" | "blue";
  // The new flat schema uses created_by instead of assignees for simplicity, but we can adapt.
};

const thaiDays = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.2 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2.4v-4h.09A1.7 1.7 0 0 0 4 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.4 4.2a1.7 1.7 0 0 0 1-.6A1.7 1.7 0 0 0 9.8 2.5v-.1h4v.09A1.7 1.7 0 0 0 14.8 4a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.8 8.4a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.1v4h-.09A1.7 1.7 0 0 0 20 14.8a1.7 1.7 0 0 0-.6.2Z"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    chevron: <path d="m9 18 6-6-6-6"/>,
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name]}</svg>;
}

function HomeContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [role, setRole] = useState("member");
  const [profile, setProfile] = useState<any>(null);
  
  const [events, setEvents] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [modal, setModal] = useState(false);
  const [notice, setNotice] = useState(0);
  const [form, setForm] = useState({ title: "", time: "05:30", kind: "บิณฑบาต", customKind: "" });
  
  const [activeTab, setActiveTab] = useState('overview');

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-11
  const actualToday = currentDate.getDate(); // 1-31

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const days = Array.from({ length: 42 }, (_, i) => {
    const day = i - firstDayOfMonth + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });

  const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  const thaiMonthName = thaiMonths[currentMonth];
  const thaiYear = currentYear + 543;
  const thaiDayNamesFull = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
  const thaiDayNameToday = thaiDayNamesFull[currentDate.getDay()];

  const supabase = createClient();
  const selectedEvents = useMemo(() => events.filter(e => new Date(e.start_time).getDate() === selectedDay), [events, selectedDay]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchProfile = async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setProfile(data);
        setRole(data.role);
      }
    };
    fetchProfile();
  }, [user, authLoading, router, supabase]);

  useEffect(() => {
    if (!user) return;
    const fetchEvents = async () => {
      const { data } = await supabase.from("events").select("*, profiles!created_by(email, room_nickname)");
      if (data) setEvents(data);
    };

    const fetchNotifs = async () => {
      const { count } = await supabase.from("notifications").select("*", { count: 'exact', head: true }).eq("user_id", user.id).eq("is_read", false);
      setNotice(count || 0);
    }
    
    fetchEvents();
    fetchNotifs();
  }, [supabase, user]);

  useEffect(() => {
    if (activeTab === 'members' && role === 'abbot') {
      supabase.from('profiles').select('*').then(({ data }) => setMembers(data || []));
    }
  }, [activeTab, role, supabase]);

  const [isSendingEmail, setIsSendingEmail] = useState(false);

  if (authLoading || !user) return <div className="p-8 text-center">กำลังโหลด...</div>;

  async function sendDailyEmail() {
    if (!confirm('ยืนยันการส่งอีเมลแจ้งเตือนกิจกรรมของวันนี้ให้ทุกคน?')) return;
    
    setIsSendingEmail(true);
    try {
      // 1. Get all members' emails
      const { data: membersData } = await supabase.from('profiles').select('email');
      const emails = membersData?.map(m => m.email).filter(Boolean) || [];
      
      if (emails.length === 0) {
        alert('ไม่มีรายชื่อสมาชิกในระบบ');
        setIsSendingEmail(false);
        return;
      }

      // 2. Format today's events
      let eventsHtml = '';
      if (selectedEvents.length === 0) {
        eventsHtml = '<p style="text-align: center; color: #9ca3af;">วันนี้ไม่มีกิจกรรมพิเศษครับ</p>';
      } else {
        eventsHtml = selectedEvents.map(e => {
          return `
            <div style="border-left: 4px solid #ea580c; padding-left: 12px; margin-bottom: 16px;">
              <div style="font-size: 12px; color: #ea580c; font-weight: bold; margin-bottom: 4px;">${e.kind}</div>
              <h3 style="margin: 0 0 4px 0; font-size: 16px; color: #111827;">${e.title}</h3>
              <p style="margin: 0; font-size: 14px; color: #4b5563;">รับผิดชอบโดย: ${e.profiles?.room_nickname || e.profiles?.email || 'Admin'}</p>
            </div>
          `;
        }).join('');
      }

      // 3. Send via our new API
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails, eventsHtml })
      });

      if (res.ok) {
        alert('✅ ส่งอีเมลแจ้งเตือนสำเร็จ!');
      } else {
        const err = await res.json();
        alert('❌ เกิดข้อผิดพลาด: ' + (err.error || 'Unknown error'));
      }
    } catch (e: any) {
      alert('❌ เกิดข้อผิดพลาด: ' + e.message);
    } finally {
      setIsSendingEmail(false);
    }
  }

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    
    const startDate = new Date();
    startDate.setDate(selectedDay);
    
    let dbKind = 'กิจนิมนต์';
    let dbColor = 'blue';
    const finalKind = form.kind === "อื่นๆ" ? form.customKind || "กิจกรรมทั่วไป" : form.kind;
    
    if (finalKind === "บิณฑบาต") { dbKind = finalKind; dbColor = 'saffron'; }
    else if (finalKind === "งานวัด") { dbKind = finalKind; dbColor = 'green'; }
    else if (finalKind === "กิจนิมนต์") { dbKind = finalKind; dbColor = 'blue'; }
    else if (finalKind === "ทำวัตรเช้า" || finalKind === "ทำวัตรเย็น") { dbKind = finalKind; dbColor = 'saffron'; }
    else { dbKind = finalKind; dbColor = 'blue'; } // Generic fallback
    
    const { data: eventData, error } = await supabase.from("events").insert({
      title: `${form.time} - ${form.title}`,
      start_time: startDate.toISOString(),
      end_time: startDate.toISOString(),
      event_date: startDate.toISOString().split('T')[0],
      kind: dbKind,
      color: dbColor,
      created_by: user!.id
    }).select().single();

    if (error) {
      alert("Failed to insert event: " + error.message);
      return;
    }

    if (eventData) {
      setEvents([...events, { ...eventData, profiles: { email: user!.email, room_nickname: profile?.room_nickname } }]);
    }

    setModal(false);
    setForm({ ...form, title: "" });
  }

  const canEdit = role === "abbot" || role === "scheduler";

  async function saveMemberRole(memberId: string, newRole: string) {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', memberId);
    if (!error) {
      setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    } else {
      alert('Error updating role: ' + error.message);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="temple-mark">☸</div><div><strong>ปฏิทินวัด</strong><span>ส่วนกลาง</span></div></div>
        <nav>
          <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}><Icon name="calendar"/>ปฏิทินกิจวัตร</button>
          {role === 'abbot' && (
            <button className={activeTab === 'members' ? 'active' : ''} onClick={() => setActiveTab('members')}><Icon name="users"/>จัดการพระลูกวัด</button>
          )}
          <button><Icon name="bell"/>การแจ้งเตือน <b>{notice}</b></button>
        </nav>
        <div className="sidebar-bottom">
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} className="block w-full text-left p-2 rounded hover:bg-gray-100 flex items-center gap-3 text-red-600">ออกจากระบบ</button>
          <div className="profile mt-2"><div className="avatar">{(profile?.room_nickname || user.email || 'U')[0]}</div><div className="overflow-hidden"><strong>{profile?.room_nickname || user.email?.split("@")[0]}</strong><span className="capitalize">{role === 'abbot' ? 'เจ้าอาวาส (Admin)' : role === 'scheduler' ? 'ผู้จัดตาราง' : 'พระลูกวัด'}</span></div></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="mobile-brand">☸</button>
          <div className="room-pill"><span>ระบบ</span><strong>วัดเดียว</strong><Icon name="chevron"/></div>
          <div className="top-actions">
            <button className="bell"><Icon name="bell"/><i>{notice}</i></button>
            {canEdit && activeTab === 'overview' && <button className="primary" onClick={() => setModal(true)}><Icon name="plus"/> เพิ่มกิจกรรม</button>}
          </div>
        </header>

        <div className="content">
          <section className="page-head">
            <div>
              <p>วันนี้ วัน{thaiDayNameToday}ที่ {actualToday} {thaiMonthName} {thaiYear}</p>
              <h1>{activeTab === 'overview' ? 'ปฏิทินกิจวัตรวัด' : 'ระบบจัดการพระลูกวัด'}</h1>
            </div>
            <div className="status"><span></span> ซิงค์ข้อมูลแล้ว</div>
          </section>
          
          {activeTab === 'overview' ? (
            <section className="workspace">
              <div className="calendar-card">
                <div className="calendar-toolbar"><div><button aria-label="เดือนก่อน">‹</button><h2>{thaiMonthName} {thaiYear}</h2><button aria-label="เดือนถัดไป">›</button></div><button className="today" onClick={() => setSelectedDay(actualToday)}>วันนี้</button></div>
                <div className="weekdays">{thaiDays.map(d => <span key={d}>{d}</span>)}</div>
                <div className="calendar-grid">{days.map((day, i) => <button key={i} className={`${day === selectedDay ? "selected" : ""} ${day === actualToday ? "actual" : ""}`} disabled={!day} onClick={() => day && setSelectedDay(day)}>{day && <><span className="day-number">{day}</span><div className="dots">{events.filter(e => new Date(e.start_time).getDate() === day).slice(0,3).map(e => <i key={e.id} className={e.color}></i>)}</div></>}</button>)}</div>
                <div className="legend"><span><i className="saffron"></i>บิณฑบาต</span><span><i className="green"></i>งานวัด</span><span><i className="blue"></i>กิจนิมนต์</span></div>
              </div>

              <div className="day-panel">
                <div className="panel-head" style={{ padding: '16px 20px' }}>
                  <div><span>กำหนดการ</span><h2>{selectedDay} {thaiMonthName} {thaiYear}</h2></div>
                  <div style={{display: 'flex', gap: '8px'}}>
                    {canEdit && (
                      <button 
                        onClick={sendDailyEmail} 
                        disabled={isSendingEmail}
                        style={{ backgroundColor: '#ea580c', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', width: 'auto', opacity: isSendingEmail ? 0.7 : 1 }}
                      >
                        <Icon name="bell"/> {isSendingEmail ? 'กำลังส่ง...' : 'ส่งอีเมลแจ้งเตือนของวันนี้'}
                      </button>
                    )}
                    {canEdit && <button onClick={() => setModal(true)} style={{backgroundColor: '#f7eee1', color: '#b26c18', border: 'none', width: '32px', height: '32px', borderRadius: '8px', display: 'grid', placeItems: 'center'}}><Icon name="plus"/></button>}
                  </div>
                </div>
                
                <div className="event-list">
                  {selectedEvents.length ? selectedEvents.map(item => {
                    const creator = item.profiles?.room_nickname || item.profiles?.email?.split('@')[0] || "Admin";

                    return (
                      <article className="event" key={item.id}>
                        <div className={`time ${item.color}`}>&bull;</div>
                        <div className="event-body">
                          <span className={`tag ${item.color}`}>{item.kind}</span>
                          <h3>{item.title}</h3>
                          <p><span className="mini-avatar">{creator.charAt(0).toUpperCase()}</span>{creator}</p>
                        </div>
                        <button className="event-more">•••</button>
                      </article>
                    )
                  }) : (
                    <div className="empty">
                      <span>☸</span><strong>วันนี้ยังไม่มีกิจกรรม</strong>
                      {canEdit && <button onClick={() => setModal(true)}>เพิ่มกิจกรรม</button>}
                    </div>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-y border-gray-100 text-sm">
                      <th className="py-3 px-4 font-medium text-gray-500">อีเมล</th>
                      <th className="py-3 px-4 font-medium text-gray-500">ฉายา/หน้าที่</th>
                      <th className="py-3 px-4 font-medium text-gray-500">ตำแหน่ง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(m => (
                      <tr key={m.id} className="border-b border-gray-50">
                        <td className="py-3 px-4 font-medium">{m.email} {m.id === user.id && <span className="text-orange-500 text-xs">(คุณ)</span>}</td>
                        <td className="py-3 px-4 text-gray-600">{m.room_nickname || 'ยังไม่กำหนด'}</td>
                        <td className="py-3 px-4">
                          <select 
                            value={m.role}
                            onChange={(e) => saveMemberRole(m.id, e.target.value)}
                            className="bg-gray-50 border border-gray-200 rounded p-1 text-sm outline-none"
                            disabled={m.id === user.id} // Don't let admin demote themselves easily
                          >
                            <option value="member">พระลูกวัด</option>
                            <option value="scheduler">ผู้จัดตาราง</option>
                            <option value="abbot">เจ้าอาวาส (Admin)</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </main>

      {modal && canEdit && <div className="modal-backdrop" onMouseDown={() => setModal(false)}><form className="modal" onSubmit={addEvent} onMouseDown={e => e.stopPropagation()}><div className="modal-head"><div><span>วันที่ {selectedDay} {thaiMonthName} {thaiYear}</span><h2>เพิ่มกิจกรรมใหม่</h2></div><button type="button" onClick={() => setModal(false)}>×</button></div><label>ชื่อกิจกรรม<input autoFocus value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="เช่น ทำความสะอาดศาลา"/></label><div className="form-row"><label>เวลา<input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})}/></label><label>ประเภท<select value={form.kind} onChange={e => setForm({...form, kind: e.target.value})}><option>บิณฑบาต</option><option>งานวัด</option><option>กิจนิมนต์</option><option>ทำวัตรเช้า</option><option>ทำวัตรเย็น</option><option>อื่นๆ</option></select></label></div>{form.kind === 'อื่นๆ' && <label style={{marginTop: '12px'}}>ประเภทกิจกรรม (ระบุเอง)<input type="text" value={form.customKind} onChange={e => setForm({...form, customKind: e.target.value})} placeholder="เช่น กวาดลานวัด, ประชุม"/></label>}<div className="text-xs text-gray-500 mb-4 mt-4">* ระบบจะบันทึกในปฏิทินส่วนกลางของวัด</div><div className="modal-actions"><button type="button" onClick={() => setModal(false)}>ยกเลิก</button><button className="primary" type="submit">บันทึกกิจกรรม</button></div></form></div>}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="p-8 text-center">กำลังโหลด...</div>}>
      <HomeContent />
    </Suspense>
  );
}
