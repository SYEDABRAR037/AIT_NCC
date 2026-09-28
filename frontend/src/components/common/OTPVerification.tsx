import React, { useState, useRef, useEffect } from 'react';
import './OTPVerification.css';

interface OTPVerificationProps {
  destination: string;
  length?: number;
  expiresInSeconds?: number;
  verifyDisabled?: boolean;
  onVerify: (otp: string) => void;
  onResend: () => void | boolean | Promise<void | boolean>;
  onBack?: () => void;
  loading: boolean;
  error: string | null;
  cooldown: number;
}

export const OTPVerification: React.FC<OTPVerificationProps> = ({
  destination,
  length = 6,
  expiresInSeconds,
  verifyDisabled = false,
  onVerify,
  onResend,
  onBack,
  loading,
  error,
  cooldown,
}) => {
  const [otp, setOtp] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    if (value.length > 1) {
      const digits = value.slice(0, length).split('');
      setOtp(digits.concat(Array(length - digits.length).fill('')));
      inputRefs.current[Math.min(digits.length, length - 1)]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const paste = e.clipboardData.getData('text').trim();
    if (!new RegExp(`^\\d{1,${length}}$`).test(paste)) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    const newOtp = paste.split('').concat(Array(length - paste.length).fill(''));
    setOtp(newOtp);
    inputRefs.current[Math.min(paste.length, length - 1)]?.focus();
  };

  const handleResend = async () => {
    const succeeded = await onResend();
    if (succeeded) setOtp(Array(length).fill(''));
    inputRefs.current[0]?.focus();
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onVerify(otp.join(''));
  };

  return (
    <div className="otp-container">
      {onBack && (
        <button type="button" className="otp-back-button" onClick={onBack}>
          ← Back
        </button>
      )}
      <div className="otp-header">
        <h2>Verify Your Identity</h2>
        <p>Enter the {length}-digit verification code sent to {destination}.</p>
        {expiresInSeconds !== undefined && (
          <p className="otp-expiry" aria-live="polite">
            {expiresInSeconds > 0 ? `Code expires in ${formatTime(expiresInSeconds)}` : 'This verification code has expired.'}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="otp-form">
        <div className="otp-inputs" onPaste={handlePaste} role="group" aria-label={`${length}-digit verification code`}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              aria-label={`Digit ${index + 1} of ${length}`}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={loading}
              className="otp-input"
            />
          ))}
        </div>

        {error && <div className="otp-error" role="alert" aria-live="assertive">{error}</div>}

        <button type="submit" className="otp-verify-button" disabled={loading || verifyDisabled || otp.join('').length < length}>
          {loading ? 'Verifying OTP...' : 'Verify OTP'}
        </button>
      </form>

      <div className="otp-resend">
        <p>Didn't receive the code?</p>
        <button
          onClick={handleResend}
          disabled={loading || cooldown > 0}
          className="otp-resend-button"
        >
          {cooldown > 0 ? `Resend OTP Available in 00:${cooldown.toString().padStart(2, '0')}` : 'Resend OTP'}
        </button>
      </div>
    </div>
  );
};
