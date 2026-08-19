import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export async function GET(request: Request) {
  try {
    // 1. Verify Vercel Cron Secret (if deployed on Vercel)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Initialize Supabase Client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Missing Supabase credentials in server' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 3. Fetch today's events (UTC+7)
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
    
    const { data: events, error: eventError } = await supabase
      .from('events')
      .select('*, profiles!created_by(email, room_nickname)')
      .eq('event_date', today);

    if (eventError) {
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    // 4. Fetch all members' emails
    const { data: members, error: membersError } = await supabase
      .from('profiles')
      .select('email');
      
    if (membersError) {
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    const emails = members?.map(m => m.email).filter(Boolean) || [];
    if (emails.length === 0) {
      return NextResponse.json({ success: true, message: 'No users to email' });
    }

    // 5. Setup Email Transporter
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
      return NextResponse.json({ error: 'EMAIL_USER or EMAIL_PASS missing' }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });

    // 6. Format HTML
    let eventsHtml = '';
    if (!events || events.length === 0) {
      eventsHtml = '<p style="text-align: center; color: #9ca3af;">วันนี้ไม่มีกิจกรรมพิเศษครับ</p>';
    } else {
      eventsHtml = events.map(e => {
        return `
          <div style="border-left: 4px solid #ea580c; padding-left: 12px; margin-bottom: 16px;">
            <div style="font-size: 12px; color: #ea580c; font-weight: bold; margin-bottom: 4px;">${e.kind}</div>
            <h3 style="margin: 0 0 4px 0; font-size: 16px; color: #111827;">${e.title}</h3>
            <p style="margin: 0; font-size: 14px; color: #4b5563;">รับผิดชอบโดย: ${e.profiles?.room_nickname || e.profiles?.email || 'Admin'}</p>
          </div>
        `;
      }).join('');
    }

    const mailOptions = {
      from: `"ระบบปฏิทินวัด" <${user}>`,
      to: emails.join(','),
      subject: `[แจ้งเตือนอัตโนมัติ] กิจวัตรวัดประจำวัน ${today}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #ea580c; text-align: center;">🙏 แจ้งเตือนกิจวัตรวัดวันนี้</h2>
          <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin-top: 20px;">
            ${eventsHtml}
          </div>
          <p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 24px;">อีเมลฉบับนี้ส่งโดยระบบอัตโนมัติของวัด (Cron Job)</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true, message: 'Email sent successfully' });
  } catch (error: any) {
    console.error('Cron Email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
