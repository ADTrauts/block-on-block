import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendVerificationEmail(email: string, token: string) {
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-email?token=${token}`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Verify your email address',
    html: `
      <h1>Email Verification</h1>
      <p>Please click the link below to verify your email address:</p>
      <a href="${verificationUrl}">${verificationUrl}</a>
      <p>This link will expire in 24 hours.</p>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Reset your password',
    html: `
      <h1>Password Reset</h1>
      <p>Please click the link below to reset your password:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>This link will expire in 1 hour.</p>
    `,
  });
}

export async function sendWelcomeEmail(email: string, name: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Welcome to Vssyl',
    html: `
      <h1>Welcome to Vssyl!</h1>
      <p>Hi ${name},</p>
      <p>Thank you for joining Vssyl. We're excited to have you on board!</p>
      <p>Get started by exploring your dashboard and customizing it to your needs.</p>
    `,
  });
}

export async function sendCalendarInviteEmail(params: {
  toEmail: string;
  subject: string;
  bodyHtml: string;
  icsContent?: string;
}) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: params.toEmail,
    subject: params.subject,
    html: params.bodyHtml,
    attachments: params.icsContent
      ? [{ filename: 'invite.ics', content: params.icsContent, contentType: 'text/calendar; charset=utf-8; method=REQUEST' }]
      : [],
  });
}

export async function sendCalendarUpdateEmail(params: {
  toEmail: string;
  subject: string;
  bodyHtml: string;
  icsContent?: string; // METHOD:UPDATE
}) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: params.toEmail,
    subject: params.subject,
    html: params.bodyHtml,
    attachments: params.icsContent
      ? [{ filename: 'invite.ics', content: params.icsContent, contentType: 'text/calendar; charset=utf-8; method=UPDATE' }]
      : [],
  });
}

export async function sendCalendarCancelEmail(params: {
  toEmail: string;
  subject: string;
  bodyHtml: string;
  icsContent?: string; // METHOD:CANCEL
}) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: params.toEmail,
    subject: params.subject,
    html: params.bodyHtml,
    attachments: params.icsContent
      ? [{ filename: 'invite.ics', content: params.icsContent, contentType: 'text/calendar; charset=utf-8; method=CANCEL' }]
      : [],
  });
}

/**
 * Send price change notification email to all affected subscribers
 */
export async function sendPriceChangeNotification(params: {
  toEmail: string;
  tier: string;
  billingCycle: 'monthly' | 'yearly';
  oldPrice: number;
  newPrice: number;
  effectiveDate: Date;
  userName?: string;
}) {
  const { toEmail, tier, billingCycle, oldPrice, newPrice, effectiveDate, userName } = params;
  
  const tierName = tier
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  const priceChange = newPrice - oldPrice;
  const priceChangePercent = ((priceChange / oldPrice) * 100).toFixed(1);
  const isIncrease = priceChange > 0;
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vssyl.com';
  const billingUrl = `${appUrl}/settings/billing`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: toEmail,
    subject: `Important: ${tierName} Plan Price Update`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${isIncrease ? '#fff3cd' : '#d1ecf1'}; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          .price-box { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .old-price { text-decoration: line-through; color: #6c757d; }
          .new-price { font-size: 24px; font-weight: bold; color: ${isIncrease ? '#dc3545' : '#28a745'}; }
          .change { font-size: 18px; color: ${isIncrease ? '#dc3545' : '#28a745'}; }
          .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${isIncrease ? 'Price Update' : 'Great News!'}</h1>
            <p>Your ${tierName} plan pricing has been updated</p>
          </div>
          
          <p>Hi ${userName || 'there'},</p>
          
          <p>We're writing to inform you about a change to your ${tierName} ${billingCycle} subscription pricing.</p>
          
          <div class="price-box">
            <p><strong>Previous Price:</strong> <span class="old-price">$${oldPrice.toFixed(2)}</span></p>
            <p><strong>New Price:</strong> <span class="new-price">$${newPrice.toFixed(2)}</span></p>
            <p><strong>Change:</strong> <span class="change">${isIncrease ? '+' : ''}$${Math.abs(priceChange).toFixed(2)} (${isIncrease ? '+' : ''}${priceChangePercent}%)</span></p>
          </div>
          
          <p><strong>Effective Date:</strong> ${effectiveDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</p>
          
          ${isIncrease ? `
            <p>This change will take effect on your next billing cycle. If you have any questions or concerns, please don't hesitate to reach out to our support team.</p>
          ` : `
            <p>This reduced price will be applied to your next billing cycle. We're always working to provide you with the best value!</p>
          `}
          
          <a href="${billingUrl}" class="button">View Billing Settings</a>
          
          <div class="footer">
            <p>If you have any questions, please contact our support team.</p>
            <p>© ${new Date().getFullYear()} Vssyl. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
}

export async function sendBusinessInvitationEmail(
  email: string,
  businessName: string,
  invitedByName: string,
  role: string,
  title: string | null,
  department: string | null,
  token: string,
  message?: string,
  inviterBlockId?: string
) {
  const invitationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/accept-invitation?token=${token}`;
  const roleDisplay = role === 'ADMIN' ? 'Administrator' : role === 'MANAGER' ? 'Manager' : 'Employee';

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: `You've been invited to join ${businessName} on Vssyl`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb; margin-bottom: 20px;">You've been invited!</h1>
        
        <p>Hi there,</p>
        
        <p><strong>${invitedByName}</strong> has invited you to join <strong>${businessName}</strong> on Vssyl.</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e293b;">Invitation Details:</h3>
          <ul style="list-style: none; padding: 0;">
            <li style="margin-bottom: 8px;"><strong>Role:</strong> ${roleDisplay}</li>
            ${title ? `<li style="margin-bottom: 8px;"><strong>Title:</strong> ${title}</li>` : ''}
            ${department ? `<li style="margin-bottom: 8px;"><strong>Department:</strong> ${department}</li>` : ''}
            <li style="margin-bottom: 8px;"><strong>Invited by:</strong> ${invitedByName}</li>
            ${inviterBlockId ? `<li style="margin-bottom: 8px;"><strong>Inviter Block ID:</strong> <code style="background: #f1f5f9; padding: 2px 4px; border-radius: 3px;">${inviterBlockId}</code></li>` : ''}
          </ul>
        </div>
        
        ${message ? `
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-style: italic;">"${message}"</p>
        </div>
        ` : ''}
        
        <p>To accept this invitation, click the button below:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${invitationUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Accept Invitation
          </a>
        </div>
        
        <p style="font-size: 14px; color: #64748b;">
          This invitation will expire in 7 days. If you have any questions, please contact ${invitedByName}.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #94a3b8;">
          If you're having trouble with the button above, copy and paste this URL into your browser: ${invitationUrl}
        </p>
      </div>
    `,
  });
} 