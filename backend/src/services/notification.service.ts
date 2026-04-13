import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export class NotificationService {
  static async sendEmail(to: string, subject: string, html: string): Promise<void> {
    try {
      await transporter.sendMail({
        from: process.env.FROM_EMAIL || 'noreply@mlcplatform.com',
        to,
        subject,
        html,
      });
    } catch (error) {
      console.error('Email send failed:', error);
    }
  }

  static async sendWelcomeEmail(
    email: string,
    name: string,
    tempPassword: string,
    role: string
  ): Promise<void> {
    const html = `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2D5BE3, #6C4FD4); padding: 30px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">Welcome to MLC Platform</h1>
        </div>
        <div style="background: #F4F7FF; padding: 30px; border-radius: 0 0 12px 12px;">
          <p>Hello <strong>${name}</strong>,</p>
          <p>Your account has been created as <strong>${role.replace('_', ' ')}</strong>.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 10px 0 0;"><strong>Temporary Password:</strong> <code style="background: #E8EDF5; padding: 4px 8px; border-radius: 4px;">${tempPassword}</code></p>
          </div>
          <p style="color: #FF4757;"><strong>Important:</strong> You must change your password on first login.</p>
          <p>Your account will be activated once your parent confirms the setup.</p>
        </div>
      </div>
    `;
    await NotificationService.sendEmail(email, 'Welcome to MLC Platform — Account Created', html);
  }

  static async sendRechargeNotification(
    email: string,
    status: string,
    amount: number,
    mobileNumber: string
  ): Promise<void> {
    const statusColor = status === 'SUCCESS' ? '#00B894' : status === 'FAILED' ? '#FF4757' : '#FFA502';
    const html = `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: white; padding: 20px; border: 1px solid #E8EDF5; border-radius: 12px;">
          <h2>Recharge ${status}</h2>
          <p>Mobile: <strong>${mobileNumber}</strong></p>
          <p>Amount: <strong>₹${amount}</strong></p>
          <p>Status: <span style="background: ${statusColor}20; color: ${statusColor}; padding: 4px 12px; border-radius: 50px; font-weight: 600;">${status}</span></p>
        </div>
      </div>
    `;
    await NotificationService.sendEmail(email, `Recharge ${status} — ₹${amount}`, html);
  }

  static async sendCommissionNotification(
    email: string,
    amount: number,
    serviceType: string,
    rechargeAmount: number
  ): Promise<void> {
    const html = `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: white; padding: 20px; border: 1px solid #E8EDF5; border-radius: 12px;">
          <h2 style="color: #00B894;">Commission Credited! 🎉</h2>
          <p>Amount: <strong style="font-family: 'JetBrains Mono'; font-size: 24px;">₹${amount.toFixed(2)}</strong></p>
          <p>For: ${serviceType} recharge of ₹${rechargeAmount}</p>
        </div>
      </div>
    `;
    await NotificationService.sendEmail(email, `Commission Credited — ₹${amount.toFixed(2)}`, html);
  }

  static async sendWithdrawalStatusEmail(
    email: string,
    status: string,
    amount: number,
    utrNumber?: string,
    reason?: string
  ): Promise<void> {
    const html = `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: white; padding: 20px; border: 1px solid #E8EDF5; border-radius: 12px;">
          <h2>Withdrawal ${status}</h2>
          <p>Amount: <strong>₹${amount}</strong></p>
          ${utrNumber ? `<p>UTR Number: <code>${utrNumber}</code></p>` : ''}
          ${reason ? `<p>Reason: ${reason}</p>` : ''}
        </div>
      </div>
    `;
    await NotificationService.sendEmail(email, `Withdrawal ${status}`, html);
  }
}
