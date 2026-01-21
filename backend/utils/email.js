const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendInviteEmail = async (to, firstName, registrationUrl) => {
  const siteUrl = process.env.SITE_URL || 'https://the-golden-batch.onrender.com';
  const msg = {
    to,
    from: process.env.FROM_EMAIL,
    subject: "You're Invited! UNIVERSITY OF ST. LA SALLE - IS 2003 – 25th Alumni Homecoming",
    html: `
      <div style="margin:0; padding:0; background:#ffffff;">
        <div style="max-width:600px; margin:0 auto; font-family: Arial, sans-serif; color:#1a1a1a;">

          <!-- Header -->
          <div style="background:#0d1a14; padding:28px; text-align:center;">
            <img src="${siteUrl}/images/logo.png" alt="The Golden Batch Logo" style="width: 80px; height: 80px; margin-bottom: 12px;" />
            <div style="color:#CFB53B; letter-spacing:3px; font-weight:700; font-size:28px; font-family: Georgia, 'Times New Roman', serif; margin-bottom:8px;">
              THE GOLDEN BATCH
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
            <span style="color:#CFB53B;">USLS-IS 2003</span><br/>
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

const sendPasswordResetEmail = async (to, firstName, resetUrl) => {
  const siteUrl = process.env.SITE_URL || 'https://the-golden-batch.onrender.com';
  const msg = {
    to,
    from: process.env.FROM_EMAIL,
    subject: "Password Reset - USLS-IS Batch 2003",
    html: `
      <div style="margin:0; padding:0; background:#ffffff;">
        <div style="max-width:600px; margin:0 auto; font-family: Arial, sans-serif; color:#1a1a1a;">

          <!-- Header -->
          <div style="background:#0d1a14; padding:28px; text-align:center;">
            <img src="${siteUrl}/images/logo.png" alt="The Golden Batch Logo" style="width: 80px; height: 80px; margin-bottom: 12px;" />
            <div style="color:#CFB53B; letter-spacing:3px; font-weight:700; font-size:28px; font-family: Georgia, 'Times New Roman', serif; margin-bottom:8px;">
              THE GOLDEN BATCH
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
              We received a request to reset your password for the USLS-IS Batch 2003 Alumni Homecoming site.
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
            <span style="color:#CFB53B;">USLS-IS 2003</span><br/>
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

module.exports = { sendInviteEmail, sendPasswordResetEmail };