const sgMail = require('@sendgrid/mail');
const db = require('../db');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendInviteEmail = async (to, firstName, registrationUrl) => {
  const siteUrl = process.env.SITE_URL || 'https://thegoldenbatch2003.com';
  const apiUrl = process.env.API_URL || 'https://api.thegoldenbatch2003.com';
  const msg = {
    to,
    from: process.env.FROM_EMAIL,
    subject: "You're Invited! University of St. La Salle - IS 2003 – 25th Alumni Homecoming",
    html: `
      <div style="margin:0; padding:0; background:#ffffff;">
        <div style="max-width:600px; margin:0 auto; font-family: Arial, sans-serif; color:#1a1a1a;">

          <!-- Header -->
          <div style="background:#0d1a14; padding:28px; text-align:center;">
            <img src="${apiUrl}/images/lasalle.jpg" alt="The Golden Batch Logo" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 12px;" />
            <div style="color:#CFB53B; letter-spacing:3px; font-weight:700; font-size:28px; font-family: Georgia, 'Times New Roman', serif; margin-bottom:8px;">
              THE GOLDEN BATCH 2003
            </div>
            <div style="color:#ffffff; font-size:16px; font-family: Georgia, 'Times New Roman', serif; letter-spacing:2px; margin-bottom:6px;">
              UNIVERSITY OF ST. LA SALLE - IS
            </div>
            <div style="color:#CFB53B; font-size:14px; font-family: Arial, sans-serif;">
              25th Alumni Homecoming
            </div>
          </div>

          <!-- Body -->
          <div style="padding:32px 28px; background:#ffffff;">
            <p style="font-size:18px; margin:0 0 20px; font-family: Arial, sans-serif; color:#1a1a1a;">
              Hi ${firstName || "Batchmate"},
            </p>

            <p style="font-size:16px; line-height:1.6; margin:0 0 18px; font-family: Arial, sans-serif; color:#1a1a1a;">
              You're invited to register for our <strong>25th Alumni Homecoming</strong>.
            </p>

            <p style="font-size:16px; line-height:1.6; margin:0 0 26px; font-family: Arial, sans-serif; color:#1a1a1a;">
              Click the button below to complete your registration:
            </p>

            <!-- Button -->
            <div style="text-align:center; margin:32px 0;">
              <a href="${registrationUrl}"
                 style="
                   background:#006633;
                   color:#ffffff;
                   padding:16px 42px;
                   font-size:18px;
                   font-weight:700;
                   text-decoration:none;
                   border-radius:8px;
                   display:inline-block;
                   font-family: Arial, sans-serif;
                 ">
                Register Now
              </a>
            </div>

            <p style="font-size:14px; line-height:1.6; margin:0 0 6px; font-family: Arial, sans-serif; color:#1a1a1a;">
              Or copy this link:
            </p>

            <p style="font-size:14px; line-height:1.6; word-break:break-all; margin:0 0 26px; font-family: Arial, sans-serif;">
              <a href="${registrationUrl}" style="color:#006633; text-decoration:underline;">
                ${registrationUrl}
              </a>
            </p>

            <p style="font-size:16px; margin:0 0 30px; font-family: Arial, sans-serif; color:#1a1a1a;">
              See you there!
            </p>

            <p style="font-size:14px; color:#666666; margin:0; font-family: Arial, sans-serif;">
              — USLS-IS 2003 Organizing Committee
            </p>
          </div>

          <!-- Footer -->
          <div style="background:#0d1a14; padding:20px; text-align:center; font-size:14px; font-family: Arial, sans-serif;">
            <span style="color:#CFB53B;">© USLS-IS Golden Batch 2003</span><br/>
            <span style="color:#ffffff;">Questions? Email us at</span>
            <a href="mailto:uslsis.batch2003@gmail.com" style="color:#CFB53B; text-decoration:none;">
              uslsis.batch2003@gmail.com
            </a>
          </div>

        </div>
      </div>
    `,
  };

  try {
    await sgMail.send(msg);

    // Log to email_log table
    await db.query(
      `INSERT INTO email_log (recipient_email, recipient_name, subject, email_type, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [to, firstName || null, msg.subject, 'invite', 'sent']
    );

    return { success: true };
  } catch (error) {
    console.error('Email error:', error.response?.body || error);
    return { success: false, error: error.message };
  }
};

const sendPasswordResetEmail = async (to, firstName, resetUrl) => {
  const siteUrl = process.env.SITE_URL || 'https://thegoldenbatch2003.com';
  const apiUrl = process.env.API_URL || 'https://api.thegoldenbatch2003.com';
  const msg = {
    to,
    from: process.env.FROM_EMAIL,
    subject: "Reset your password",
    html: `
      <div style="margin:0; padding:0; background:#ffffff;">
        <div style="max-width:600px; margin:0 auto; font-family: Arial, sans-serif; color:#1a1a1a;">

          <!-- Header -->
          <div style="background:#0d1a14; padding:28px; text-align:center;">
            <img src="${apiUrl}/images/lasalle.jpg" alt="The Golden Batch Logo" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 12px;" />
            <div style="color:#CFB53B; letter-spacing:3px; font-weight:700; font-size:28px; font-family: Georgia, 'Times New Roman', serif; margin-bottom:8px;">
              THE GOLDEN BATCH 2003
            </div>
            <div style="color:#ffffff; font-size:16px; font-family: Georgia, 'Times New Roman', serif; letter-spacing:2px; margin-bottom:6px;">
              UNIVERSITY OF ST. LA SALLE - IS
            </div>
            <div style="color:#CFB53B; font-size:14px; font-family: Arial, sans-serif;">
              25th Alumni Homecoming
            </div>
          </div>

          <!-- Body -->
          <div style="padding:32px 28px; background:#ffffff;">
            <p style="font-size:18px; margin:0 0 20px; font-family: Arial, sans-serif; color:#1a1a1a;">
              Hi ${firstName || 'Batchmate'},
            </p>

            <p style="font-size:16px; line-height:1.6; margin:0 0 18px; font-family: Arial, sans-serif; color:#1a1a1a;">
              We received a request to reset your password for the The Golden Batch 2003 website. If you made this request, please click the button below to set a new password. If you didn't request a password reset, you can safely ignore this email.
            </p>

            <p style="font-size:16px; line-height:1.6; margin:0 0 26px; font-family: Arial, sans-serif; color:#1a1a1a;">
              Click the button below to set a new password:
            </p>

            <!-- Button -->
            <div style="text-align:center; margin:32px 0;">
              <a href="${resetUrl}"
                 style="
                   background:#006633;
                   color:#ffffff;
                   padding:16px 42px;
                   font-size:18px;
                   font-weight:700;
                   text-decoration:none;
                   border-radius:8px;
                   display:inline-block;
                   font-family: Arial, sans-serif;
                 ">
                Reset Password
              </a>
            </div>

            <p style="font-size:14px; line-height:1.6; margin:0 0 6px; font-family: Arial, sans-serif; color:#1a1a1a;">
              Or copy this link:
            </p>

            <p style="font-size:14px; line-height:1.6; word-break:break-all; margin:0 0 20px; font-family: Arial, sans-serif;">
              <a href="${resetUrl}" style="color:#006633; text-decoration:underline;">
                ${resetUrl}
              </a>
            </p>

            <p style="font-size:14px; line-height:1.6; margin:0 0 10px; font-family: Arial, sans-serif; color:#666666;">
              This link will expire in 1 hour.
            </p>

            <p style="font-size:14px; line-height:1.6; margin:0 0 30px; font-family: Arial, sans-serif; color:#666666;">
              If you didn't request this, you can safely ignore this email.
            </p>

            <p style="font-size:14px; color:#666666; margin:0; font-family: Arial, sans-serif;">
              — USLS-IS 2003 Organizing Committee
            </p>
          </div>

          <!-- Footer -->
          <div style="background:#0d1a14; padding:20px; text-align:center; font-size:14px; font-family: Arial, sans-serif;">
            <span style="color:#CFB53B;">© USLS-IS Golden Batch 2003</span><br/>
            <span style="color:#ffffff;">Questions? Email us at</span>
            <a href="mailto:uslsis.batch2003@gmail.com" style="color:#CFB53B; text-decoration:none;">
              uslsis.batch2003@gmail.com
            </a>
          </div>

        </div>
      </div>
    `,
  };

  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error('Email error:', error.response?.body || error);
    return { success: false, error: error.message };
  }
};

// HTML escape helper
const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const sendScreeningConfirmationEmail = async (details) => {
  const {
    to,
    firstName,
    eventTitle,
    eventDate,
    cinemaLabel,
    showtime,
    venue,
    quantity,
    seats,
    ticketNumbers,
    reference
  } = details;

  // Build plain text body from array of lines, filtering out empty seats line
  const textLines = [
    `Hi, ${firstName}!`,
    '',
    `Thank you for supporting the USLS-IS Batch 2003 ${eventTitle} block screening. Your payment is confirmed.`,
    '',
    `${cinemaLabel} – ${showtime}, ${eventDate}`,
    venue,
    `Tickets: ${quantity}`,
    seats ? `Seats: ${seats}` : null,
    `Serial numbers: ${ticketNumbers}`,
    `Reference number: ${reference}`,
    '',
    'We will contact you on where to pick up your tickets (movie stub/food voucher). Just present them at the cinema on screening day. See you there!',
    '',
    'Questions? Email us at uslsis.batch2003@gmail.com.',
    '',
    'In St. La Salle,',
    '',
    'USLS-IS Batch 2003'
  ].filter(line => line !== null).join('\n');

  const seatsRowHtml = seats ? `<tr>
  <td style="padding:10px 0;border-bottom:1px solid #1F3A2A;font-family:Poppins,Arial,Helvetica,sans-serif;font-size:14px;color:#A7B0AA;">Seats</td>
  <td style="padding:10px 0;border-bottom:1px solid #1F3A2A;font-family:Poppins,Arial,Helvetica,sans-serif;font-size:14px;color:#E6EBE7;font-weight:600;text-align:right;">${escapeHtml(seats)}</td>
</tr>` : '';

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Your tickets are confirmed</title>
</head>
<body style="margin:0;padding:0;background:#1B1F1D;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#1B1F1D;">
<tr>
<td align="center" style="padding:24px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#0E1410;border:1px solid #1F2A22;border-radius:16px;overflow:hidden;">
<!-- Header Image -->
<tr>
<td style="padding:0;">
<img src="https://thegoldenbatch2003.com/images/doomsday-email-header.jpg" alt="USLS-IS Golden Batch 2003 presents Avengers: Doomsday, an opening day block screening fundraiser. Beneficiary: USLS Liceo Student Government." width="600" height="240" style="display:block;width:100%;max-width:600px;height:auto;border:0;">
</td>
</tr>
<!-- Body -->
<tr>
<td style="padding:36px 40px;font-family:Poppins,Arial,Helvetica,sans-serif;">
<!-- Greeting -->
<p style="margin:0 0 20px;font-size:22px;font-weight:600;color:#E6EBE7;">Hi, ${escapeHtml(firstName)}!</p>
<!-- Thank you -->
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#C5CCC7;">Thank you for supporting the USLS-IS Batch 2003 ${escapeHtml(eventTitle)} block screening. Your payment is confirmed.</p>
<!-- Details Box -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#10251A;border:1px solid #2F6B40;border-radius:12px;">
<tr>
<td style="padding:22px 24px;">
<p style="margin:0 0 4px;font-size:18px;font-weight:600;color:#7BD892;font-family:Poppins,Arial,Helvetica,sans-serif;">${escapeHtml(cinemaLabel)} - ${escapeHtml(showtime)}, ${escapeHtml(eventDate)}</p>
<p style="margin:0 0 16px;font-size:14px;color:#A7B0AA;font-family:Poppins,Arial,Helvetica,sans-serif;">${escapeHtml(venue)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
  <td style="padding:10px 0;border-bottom:1px solid #1F3A2A;font-family:Poppins,Arial,Helvetica,sans-serif;font-size:14px;color:#A7B0AA;">Tickets</td>
  <td style="padding:10px 0;border-bottom:1px solid #1F3A2A;font-family:Poppins,Arial,Helvetica,sans-serif;font-size:14px;color:#E6EBE7;font-weight:600;text-align:right;">${quantity}</td>
</tr>
${seatsRowHtml}<tr>
  <td style="padding:10px 0;border-bottom:1px solid #1F3A2A;font-family:Poppins,Arial,Helvetica,sans-serif;font-size:14px;color:#A7B0AA;">Serial numbers</td>
  <td style="padding:10px 0;border-bottom:1px solid #1F3A2A;font-family:Poppins,Arial,Helvetica,sans-serif;font-size:14px;color:#E6EBE7;font-weight:600;text-align:right;">${escapeHtml(ticketNumbers)}</td>
</tr>
<tr>
  <td style="padding:10px 0;font-family:Poppins,Arial,Helvetica,sans-serif;font-size:14px;color:#A7B0AA;">Reference number</td>
  <td style="padding:10px 0;font-family:Poppins,Arial,Helvetica,sans-serif;font-size:14px;color:#E6EBE7;font-weight:600;text-align:right;">${escapeHtml(reference)}</td>
</tr>
</table>
</td>
</tr>
</table>
<!-- Pickup paragraph -->
<p style="margin:24px 0;font-size:15px;line-height:1.6;color:#C5CCC7;">We will contact you on where to pick up your tickets (movie stub/food voucher). Just present them at the cinema on screening day. See you there!</p>
<!-- Questions -->
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#C5CCC7;">Questions? Email us at <a href="mailto:uslsis.batch2003@gmail.com" style="color:#7BD892;text-decoration:none;">uslsis.batch2003@gmail.com</a>.</p>
<!-- Divider -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="border-top:1px solid #1F2A22;padding-top:24px;"></td></tr>
</table>
<!-- Get more tickets -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
<td align="center" style="padding-bottom:16px;">
<p style="margin:0;font-size:14px;color:#A7B0AA;font-family:Poppins,Arial,Helvetica,sans-serif;">Bringing friends or family?</p>
</td>
</tr>
<tr>
<td align="center" style="padding-bottom:24px;">
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://thegoldenbatch2003.com/movie-screening" style="height:48px;v-text-anchor:middle;width:180px;" arcsize="21%" fillcolor="#4CC16A" stroke="f">
<w:anchorlock/>
<center style="color:#05140A;font-family:Poppins,Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;">Get more tickets</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="background:#4CC16A;border-radius:10px;padding:14px 32px;">
<a href="https://thegoldenbatch2003.com/movie-screening" style="color:#05140A;font-family:Poppins,Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;display:inline-block;">Get more tickets</a>
</td>
</tr>
</table>
<!--<![endif]-->
</td>
</tr>
</table>
<!-- Sign off -->
<p style="margin:0 0 4px;font-size:15px;color:#C5CCC7;font-family:Poppins,Arial,Helvetica,sans-serif;">In St. La Salle,</p>
<p style="margin:0;font-size:15px;color:#E6EBE7;font-weight:600;font-family:Poppins,Arial,Helvetica,sans-serif;">USLS-IS Batch 2003</p>
</td>
</tr>
<!-- Footer -->
<tr>
<td style="background:#0A0E0B;border-top:1px solid #1F2A22;padding:16px;text-align:center;">
<p style="margin:0;font-size:12px;color:#7E8B82;font-family:Poppins,Arial,Helvetica,sans-serif;">thegoldenbatch2003.com</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;

  const msg = {
    to,
    from: process.env.FROM_EMAIL,
    reply_to: 'uslsis.batch2003@gmail.com',
    subject: `Your ${eventTitle} tickets are confirmed`,
    text: textLines,
    html: htmlBody
  };

  try {
    await sgMail.send(msg);

    // Log to email_log table
    await db.query(
      `INSERT INTO email_log (recipient_email, recipient_name, subject, email_type, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [to, firstName || null, msg.subject, 'screening_confirmation', 'sent']
    );

    return { success: true };
  } catch (error) {
    console.error('Screening confirmation email error:', error.response?.body || error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendInviteEmail, sendPasswordResetEmail, sendScreeningConfirmationEmail };