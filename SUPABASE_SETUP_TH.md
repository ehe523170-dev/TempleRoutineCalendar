# คู่มือการติดตั้งฐานข้อมูล Supabase สำหรับโปรเจกต์ปฏิทินวัด ☸️

เนื่องจากระบบนี้ใช้ **Supabase** เป็นฐานข้อมูลและระบบจัดการสมาชิก นี่คือขั้นตอนทั้งหมดที่คุณต้องทำในการนำโปรเจกต์นี้ไปใช้งานจริงครับ

## ขั้นตอนที่ 1: สร้างโปรเจกต์ใน Supabase
1. ไปที่ [Supabase](https://supabase.com/) และเข้าสู่ระบบ
2. กดปุ่ม **"New Project"** และตั้งชื่อโปรเจกต์ (เช่น `temple-calendar`)
3. รอจนกว่าโปรเจกต์จะถูกสร้างเสร็จ (ประมาณ 1-2 นาที)

## ขั้นตอนที่ 2: รันคำสั่ง SQL สร้างตาราง (Schema)
1. ในหน้า Dashboard ของ Supabase ให้ไปที่แถบเมนูซ้ายมือ เลือก **"SQL Editor"**
2. กดปุ่ม **"New Query"**
3. คัดลอกโค้ดทั้งหมดในไฟล์ `supabase/schema.sql` จากโปรเจกต์นี้ ไปวางในช่อง SQL Editor
4. กดปุ่ม **"Run"** (หรือ `Ctrl+Enter`) ที่มุมขวาล่าง
5. หากสำเร็จ คุณจะเห็นข้อความ *Success. No rows returned.*

## ขั้นตอนที่ 3: เปิดใช้งานการเข้าสู่ระบบผ่าน Google (เลือกได้)
1. ไปที่เมนู **"Authentication"** ทางซ้ายมือ -> เลือก **"Providers"**
2. กดเปิดใช้งาน **"Google"**
3. นำ `Client ID` และ `Client Secret` จาก Google Cloud Console มาใส่
4. (หากทดสอบเฉยๆ ข้ามขั้นตอนนี้และใช้อีเมลสมมติล็อคอินได้เลย)

## ขั้นตอนที่ 4: ตั้งค่าไฟล์ .env.local ในโปรเจกต์
1. ไปที่เมนู **"Project Settings"** (ไอคอนเฟือง ⚙️) มุมซ้ายล่าง -> เลือก **"API"**
2. คัดลอกค่า **Project URL** นำไปใส่ในไฟล์ `.env.local` ในตัวแปร `NEXT_PUBLIC_SUPABASE_URL`
3. คัดลอกค่า **anon / public key** นำไปใส่ในตัวแปร `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. คัดลอกค่า **service_role / secret key** นำไปใส่ในตัวแปร `SUPABASE_SERVICE_ROLE_KEY` (ห้ามให้ใครรู้คีย์นี้เด็ดขาด)

ตัวอย่าง `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL="https://abcdefghijklmnop.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## ขั้นตอนที่ 5: รันทดสอบระบบ
เมื่อตั้งค่าทุกอย่างเสร็จแล้ว เปิด Terminal ใน VS Code แล้วพิมพ์คำสั่ง:
```bash
npm run dev
```
แล้วเปิดหน้าเว็บที่ `http://localhost:3000` คุณจะสามารถสมัครสมาชิก สร้างห้อง และใช้งานระบบได้แบบสมบูรณ์ 100% ครับ!
