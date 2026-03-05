import { Resend } from "resend";
import fs from "node:fs";

let resend: Resend | null = null;
function getResend() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY || "");
  }
  return resend;
}

interface SendCertificateEmailOptions {
  to: string;
  participantName: string;
  workshopTitle: string;
  workshopDate: string;
  pdfPath: string;
  verifyUrl: string;
}

export async function sendCertificateEmail(
  opts: SendCertificateEmailOptions,
): Promise<void> {
  const { to, participantName, workshopTitle, workshopDate, pdfPath, verifyUrl } = opts;

  const pdfBuffer = fs.readFileSync(pdfPath);
  const fileName = `${participantName.replace(/\s+/g, "_")}_Certificate.pdf`;

  await getResend().emails.send({
    from: process.env.EMAIL_FROM || "certificates@talentease.com",
    to,
    subject: `Your Certificate of Completion — ${workshopTitle}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fafafa; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #F5A623, #D0021B); padding: 32px 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">
            🎉 Congratulations, ${participantName}!
          </h1>
        </div>
        <div style="padding: 32px 24px;">
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            You have successfully completed the <strong>${workshopTitle}</strong> workshop on <strong>${workshopDate}</strong>.
          </p>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Your certificate of completion is attached to this email as a PDF. You can also verify your certificate anytime using the QR code printed on it, or by visiting:
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${verifyUrl}" style="display: inline-block; padding: 12px 28px; background: #F5A623; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Verify Certificate
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px; text-align: center;">
            Talentease — Creating Tomorrow's Leaders Today
          </p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: fileName,
        content: pdfBuffer,
      },
    ],
  });
}
