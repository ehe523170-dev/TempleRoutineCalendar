import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { emails, eventsHtml } = await request.json();

    if (!emails || !eventsHtml) {
      return NextResponse.json({ error: 'Missing emails or eventsHtml' }, { status: 400 });
    }

    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
      return NextResponse.json({ error: 'EMAIL_USER or EMAIL_PASS is not set in environment variables' }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: user,
        pass: pass,
      },
    });

    const mailOptions = {
      from: `"ระบบปฏิทินวัด" <${user}>`,
      to: emails.join(','),
      subject: `[แจ้งเตือน] กิจวัตรวัดประจำวัน`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #ea580c; text-align: center;">🙏 แจ้งเตือนกิจวัตรวัดวันนี้</h2>
          <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin-top: 20px;">
            ${eventsHtml}
          </div>
          <p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 24px;">อีเมลฉบับนี้ส่งโดยระบบอัตโนมัติของวัด</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Email send error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
