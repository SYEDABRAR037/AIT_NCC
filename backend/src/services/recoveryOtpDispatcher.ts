import { sendOtpEmail } from './mail.service';

export interface RecoveryOtpMessage {
  recipientEmail: string;
  cadetName: string;
  otp: string;
}

/** Adapter boundary for recovery delivery; current SMTP implementation is best-effort, not durable. */
export interface RecoveryOtpDispatcher {
  dispatch(message: RecoveryOtpMessage): Promise<boolean>;
}

export const recoveryOtpDispatcher: RecoveryOtpDispatcher = {
  async dispatch(message) {
    const result = await sendOtpEmail(message);
    return result.success;
  },
};
