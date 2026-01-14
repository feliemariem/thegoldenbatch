const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendInviteEmail = async (to, firstName, registrationUrl) => {
  const msg = {
    to,
    from: process.env.FROM_EMAIL,
    subject: "You're Invited! USLS-IS Batch 2003 - 25th Alumni Homecoming",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #006633;">Hi ${firstName || 'Batchmate'}!</h2>
        
        <p>You're invited to register for our <strong>25th Alumni Homecoming</strong>!</p>
        
        <p>Click the button below to complete your registration:</p>
        
        <p style="text-align: center; margin: 30px 0;">
          <a href="${registrationUrl}" 
             style="background: #006633; color: white; padding: 14px 28px; 
                    text-decoration: none; border-radius: 8px; font-weight: bold;">
            Register Now
          </a>
        </p>
        
        <p>Or copy this link: <br><a href="${registrationUrl}">${registrationUrl}</a></p>
        
        <p>See you there!</p>
        
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