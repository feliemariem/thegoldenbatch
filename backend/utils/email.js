const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendInviteEmail = async (to, firstName, registrationUrl) => {
  const msg = {
    to,
    from: process.env.FROM_EMAIL,
    subject: "You're Invited! University of St. La Salle - IS 2003 – 25th Alumni Homecoming",
    html: `
      <div style="margin:0; padding:0; background:#ffffff;">
        <div style="max-width:600px; margin:0 auto; font-family: Arial, Helvetica, sans-serif; color:#1a1a1a;">

          <!-- Header -->
          <div style="background:#1f2a24; padding:24px; text-align:center;">
            <div style="color:#d4b44c; letter-spacing:3px; font-weight:700; font-size:14px;">
              THE GOLDEN BATCH
            </div>
          </div>

          <div style="background:#2f6b3e; padding:28px; text-align:center; color:#ffffff;">
            <h1 style="margin:0; font-size:28px; font-weight:800;">
              University of St. La Salle - IS 2003
            </h1>
            <p style="margin:8px 0 0; font-size:18px;">
              25th Alumni Homecoming
            </p>
          </div>

          <!-- Body -->
          <div style="padding:32px 28px; background:#ffffff;">
            <p style="font-size:18px; margin:0 0 20px;">
              Hi ${firstName || "Batchmate"},
            </p>

            <p style="font-size:17px; line-height:1.6; margin:0 0 18px;">
              You're invited to register for our <strong>25th Alumni Homecoming</strong>.
            </p>

            <p style="font-size:17px; line-height:1.6; margin:0 0 26px;">
              Click the button below to complete your registration:
            </p>

            <!-- Button -->
            <div style="text-align:center; margin:32px 0;">
              <a href="${registrationUrl}"
                 style="
                   background:#2f6b3e;
                   color:#ffffff;
                   padding:16px 42px;
                   font-size:20px;
                   font-weight:800;
                   text-decoration:none;
                   border-radius:14px;
                   display:inline-block;
                 ">
                Register Now
              </a>
            </div>

            <p style="font-size:15px; line-height:1.6; margin:0 0 6px;">
              Or copy this link:
            </p>

            <p style="font-size:15px; line-height:1.6; word-break:break-all; margin:0 0 26px;">
              <a href="${registrationUrl}" style="color:#1a73e8; text-decoration:underline;">
                ${registrationUrl}
              </a>
            </p>

            <p style="font-size:17px; margin:0 0 30px;">
              See you there!
            </p>

            <p style="font-size:15px; color:#6b6b6b; margin:0;">
              — USLS-IS 2003 Organizing Committee
            </p>
          </div>

          <!-- Footer -->
          <div style="background:#333333; padding:20px; text-align:center; color:#cccccc; font-size:14px;">
            USLS-IS 2003<br/>
            Questions? Email us at
            <a href="mailto:uslsis.batch2003@gmail.com" style="color:#d4b44c; text-decoration:none;">
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
  const msg = {
    to,
    from: process.env.FROM_EMAIL,
    subject: "Password Reset - USLS-IS Batch 2003",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #006633;">Hi ${firstName || 'Batchmate'}!</h2>
        
        <p>We received a request to reset your password for the USLS-IS Batch 2003 Alumni Homecoming site.</p>
        
        <p>Click the button below to set a new password:</p>
        
        <p style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background: #006633; color: white; padding: 14px 28px; 
                    text-decoration: none; border-radius: 8px; font-weight: bold;">
            Reset Password
          </a>
        </p>
        
        <p>Or copy this link: <br><a href="${resetUrl}">${resetUrl}</a></p>
        
        <p style="color: #999; font-size: 14px;">This link will expire in 1 hour.</p>
        
        <p style="color: #999; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
        
        <p style="color: #666; margin-top: 30px;">
          — USLS-IS Batch 2003 Organizing Committee
        </p>
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