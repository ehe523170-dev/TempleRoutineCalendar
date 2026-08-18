"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import Link from "next/link";

type EventItem = {
  id: string;
  room_id: string;
  day: number;
  time: string;
  title: string;
  kind: "บิณฑบาต" | "งานวัด" | "กิจนิมนต์";
  color: "saffron" | "green" | "blue";
  event_assignees?: { profiles: { id: string, email: string, full_name: string } }[];
  event_acknowledgements?: { user_id: string }[];
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
  const searchParams = useSearchParams();
  const [roomId, setRoomId] = useState(searchParams.get("roomId"));
  const [memberships, setMemberships] = useState<any[]>([]);
  const [role, setRole] = useState("member");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedDay, setSelectedDay] = useState(12);
  const [modal, setModal] = useState(false);
  const [notice, setNotice] = useState(0);
  const [form, setForm] = useState({ title: "", time: "05:30", kind: "บิณฑบาต" as EventItem["kind"] });
  const supabase = createClient();
  const days = Array.from({ length: 42 }, (_, i) => i - 2).map((day) => day > 0 && day <= 31 ? day : null);
  const selectedEvents = useMemo(() => events.filter(e => e.day === selectedDay), [events, selectedDay]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchMems = async () => {
      const { data } = await supabase.from("memberships").select("room_id, role, rooms(name)").eq("user_id", user.id);
      if (data) {
        setMemberships(data);
        if (!roomId && data.length > 0) {
          setRoomId(data[0].room_id);
          setRole(data[0].role);
          router.replace(`/?roomId=${data[0].room_id}`);
        } else if (roomId) {
          const currentMem = data.find(m => m.room_id === roomId);
          if (currentMem) setRole(currentMem.role);
        }
      }
    };
    fetchMems();
  }, [user, authLoading, roomId, router, supabase]);

  useEffect(() => {
    if (!roomId) return;
    const fetchEvents = async () => {
      const { data } = await supabase
        .from("events")
        .select(`
          *,
          event_assignees (
            profiles (id, email, full_name)
          ),
          event_acknowledgements (user_id)
        `)
        .eq("room_id", roomId);
        
      if (data) setEvents(data as any[]);
    };

    const fetchNotifs = async () => {
      if (!user) return;
      const { count } = await supabase.from("notifications").select("*", { count: 'exact', head: true }).eq("user_id", user.id).eq("read_status", false);
      setNotice(count || 0);
    }
    
    fetchEvents();
    fetchNotifs();

    const channel = supabase.channel(`room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `room_id=eq.${roomId}` }, () => {
        fetchEvents();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_acknowledgements' }, () => {
        fetchEvents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, supabase, user]);

  if (authLoading || !user) return <div className="p-8 text-center">กำลังโหลด...</div>;

  if (!roomId) {
    return (
      <div className="p-8 max-w-xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-center">เลือกห้องหรือสร้างห้องใหม่</h1>
        <div className="space-y-4">
          {memberships.map(m => (
            <button key={m.room_id} onClick={() => setRoomId(m.room_id)} className="w-full p-4 border rounded-lg hover:bg-gray-50 bg-white">
              เข้าสู่ห้อง: {m.rooms?.name || m.room_id.substring(0,8)}... (สิทธิ์: {m.role})
            </button>
          ))}
          <Link href="/create-room" className="block w-full p-4 text-center text-orange-600 border border-orange-600 rounded-lg hover:bg-orange-50">
            + สร้างห้องของวัดใหม่
          </Link>
        </div>
      </div>
    );
  }

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const color = form.kind === "บิณฑบาต" ? "saffron" : form.kind === "งานวัด" ? "green" : "blue";
    
    // 1. Insert Event
    const { data: eventData, error } = await supabase.from("events").insert({
      room_id: roomId,
      day: selectedDay,
      time: form.time,
      title: form.title,
      kind: form.kind,
      color: color,
    }).select().single();

    if (error) {
      alert("Failed to insert event: " + error.message);
      return;
    }

    // 2. Insert Assignees (In this simple UI, we assume creator assigns themselves for now, 
    // or you'd have a dropdown of members to select).
    if (eventData) {
      await supabase.from("event_assignees").insert({
        event_id: eventData.id,
        user_id: user?.id
      });
    }

    setModal(false);
    setForm({ ...form, title: "" });
  }

  async function acknowledgeEvent(eventId: string) {
    await supabase.from("event_acknowledgements").insert({
      event_id: eventId,
      user_id: user?.id
    });
  }

  const canEdit = role === "abbot" || role === "scheduler";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="temple-mark">☸</div><div><strong>ปฏิทินวัด</strong><span>ID: {roomId.substring(0, 4)}...</span></div></div>
        <nav>
          <button><Icon name="home"/>ภาพรวม</button>
          <button className="active"><Icon name="calendar"/>ปฏิทิน</button>
          <button><Icon name="users"/>สมาชิก</button>
          <button><Icon name="bell"/>การแจ้งเตือน <b>{notice}</b></button>
        </nav>
        <div className="sidebar-bottom">
          <Link href={`/room/${roomId}/settings`} className="block w-full text-left p-2 rounded hover:bg-gray-100 flex items-center gap-3"><Icon name="settings"/>ตั้งค่าห้อง</Link>
          <div className="profile mt-2"><div className="avatar">U</div><div className="overflow-hidden"><strong>{user.email?.split("@")[0]}</strong><span className="capitalize">{role}</span></div></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="mobile-brand">☸</button>
          <div className="room-pill"><span>ห้อง</span><strong>{roomId.substring(0, 6)}</strong><Icon name="chevron"/></div>
          <div className="top-actions">
            <button className="bell"><Icon name="bell"/><i>{notice}</i></button>
            {canEdit && <button className="primary" onClick={() => setModal(true)}><Icon name="plus"/> เพิ่มกิจกรรม</button>}
          </div>
        </header>

        <div className="content">
          <section className="page-head">
            <div>
              <p>วันนี้ วันพุธที่ 12 สิงหาคม 2569</p>
              <h1>ปฏิทินกิจวัตรวัด</h1>
            </div>
            <div className="status"><span></span> ซิงค์ข้อมูลแล้ว</div>
          </section>
          
          <section className="workspace">
            <div className="calendar-card">
              <div className="calendar-toolbar"><div><button aria-label="เดือนก่อน">‹</button><h2>สิงหาคม 2569</h2><button aria-label="เดือนถัดไป">›</button></div><button className="today" onClick={() => setSelectedDay(12)}>วันนี้</button></div>
              <div className="weekdays">{thaiDays.map(d => <span key={d}>{d}</span>)}</div>
              <div className="calendar-grid">{days.map((day, i) => <button key={i} className={`${day === selectedDay ? "selected" : ""} ${day === 12 ? "actual" : ""}`} disabled={!day} onClick={() => day && setSelectedDay(day)}>{day && <><span className="day-number">{day}</span><div className="dots">{events.filter(e => e.day === day).slice(0,3).map(e => <i key={e.id} className={e.color}></i>)}</div></>}</button>)}</div>
              <div className="legend"><span><i className="saffron"></i>บิณฑบาต</span><span><i className="green"></i>งานวัด</span><span><i className="blue"></i>กิจนิมนต์</span></div>
            </div>

            <div className="day-panel">
              <div className="panel-head"><div><span>กำหนดการ</span><h2>{selectedDay} สิงหาคม 2569</h2></div>{canEdit && <button onClick={() => setModal(true)}><Icon name="plus"/></button>}</div>
              
              <div className="event-list">
                {selectedEvents.length ? selectedEvents.map(item => {
                  const assignees = item.event_assignees?.map(a => a.profiles?.email?.split('@')[0]).join(", ");
                  const isAssignedToMe = item.event_assignees?.some(a => a.profiles?.id === user?.id);
                  const hasAcknowledged = item.event_acknowledgements?.some(a => a.user_id === user?.id);

                  return (
                    <article className="event" key={item.id}>
                      <div className={`time ${item.color}`}>{item.time}</div>
                      <div className="event-body">
                        <span className={`tag ${item.color}`}>{item.kind}</span>
                        <h3>{item.title}</h3>
                        <p><span className="mini-avatar">{assignees ? assignees.charAt(0).toUpperCase() : '?'}</span>{assignees || "ไม่มีผู้รับผิดชอบ"}</p>
                        
                        {isAssignedToMe && !hasAcknowledged && (
                          <button onClick={() => acknowledgeEvent(item.id)} className="mt-2 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                            กดรับทราบงาน
                          </button>
                        )}
                        {hasAcknowledged && <p className="text-xs text-green-600 mt-1">✓ รับทราบแล้ว</p>}

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
        </div>
      </main>

      {modal && canEdit && <div className="modal-backdrop" onMouseDown={() => setModal(false)}><form className="modal" onSubmit={addEvent} onMouseDown={e => e.stopPropagation()}><div className="modal-head"><div><span>วันที่ {selectedDay} สิงหาคม 2569</span><h2>เพิ่มกิจกรรมใหม่</h2></div><button type="button" onClick={() => setModal(false)}>×</button></div><label>ชื่อกิจกรรม<input autoFocus value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="เช่น ทำความสะอาดศาลา"/></label><div className="form-row"><label>เวลา<input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})}/></label><label>ประเภท<select value={form.kind} onChange={e => setForm({...form, kind: e.target.value as EventItem["kind"]})}><option>บิณฑบาต</option><option>งานวัด</option><option>กิจนิมนต์</option></select></label></div><div className="text-xs text-gray-500 mb-4">* ระบบจะกำหนดให้คุณเป็นผู้รับผิดชอบอัตโนมัติ</div><div className="modal-actions"><button type="button" onClick={() => setModal(false)}>ยกเลิก</button><button className="primary" type="submit">บันทึกกิจกรรม</button></div></form></div>}
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
