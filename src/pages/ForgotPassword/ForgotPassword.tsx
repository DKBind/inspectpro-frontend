import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/components/Constant/Route';
import { Shield, ArrowLeft, CheckCircle } from 'lucide-react';
import styles from '../Login/Login.module.css';

type Step = 'email' | 'otp' | 'reset' | 'success';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const stepIndex = { email: 0, otp: 1, reset: 2, success: 3 };

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('otp');
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('reset');
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return;
    setStep('success');
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.bgDecoration}>
        <div className={`${styles.bgOrb} ${styles.bgOrb1}`} />
        <div className={`${styles.bgOrb} ${styles.bgOrb2}`} />
      </div>

      <div className={styles.authCard}>
        <div className={styles.logoSection}>
          <div className={styles.logoIcon}>
            <Shield />
          </div>
          <div className={styles.logoTitle}>InspectWisePro</div>
        </div>

        {/* Step indicators */}
        {step !== 'success' && (
          <div className={styles.steps}>
            {['email', 'otp', 'reset'].map((s, i) => (
              <div
                key={s}
                className={`${styles.step} ${
                  i === stepIndex[step] ? styles.stepActive : ''
                } ${i < stepIndex[step] ? styles.stepDone : ''}`}
              />
            ))}
          </div>
        )}

        {/* Step: Email */}
        {step === 'email' && (
          <>
            <button className={styles.backBtn} onClick={() => navigate(ROUTES.LOGIN)}>
              <ArrowLeft /> Back to login
            </button>
            <h2 className={styles.formTitle}>Forgot password?</h2>
            <p className={styles.formSubtitle}>
              Enter your email and we'll send you an OTP to reset your password
            </p>
            <form onSubmit={handleSendOtp}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Email address</label>
                <input
                  type="email"
                  className={styles.formInput}
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className={styles.submitBtn}>
                Send OTP
              </button>
            </form>
          </>
        )}

        {/* Step: OTP */}
        {step === 'otp' && (
          <>
            <button className={styles.backBtn} onClick={() => setStep('email')}>
              <ArrowLeft /> Back
            </button>
            <h2 className={styles.formTitle}>Verify OTP</h2>
            <p className={styles.formSubtitle}>
              Enter the 6-digit code sent to <strong>{email}</strong>
            </p>
            <form onSubmit={handleVerifyOtp}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>OTP Code</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  required
                />
              </div>
              <button type="submit" className={styles.submitBtn}>
                Verify OTP
              </button>
            </form>
            <div className={styles.footerLink}>
              Didn't receive a code?{' '}
              <button onClick={() => setStep('email')}>Resend</button>
            </div>
          </>
        )}

        {/* Step: New Password */}
        {step === 'reset' && (
          <>
            <button className={styles.backBtn} onClick={() => setStep('otp')}>
              <ArrowLeft /> Back
            </button>
            <h2 className={styles.formTitle}>Set new password</h2>
            <p className={styles.formSubtitle}>
              Create a strong password for your account
            </p>
            <form onSubmit={handleResetPassword}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>New Password</label>
                <input
                  type="password"
                  className={styles.formInput}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Confirm Password</label>
                <input
                  type="password"
                  className={styles.formInput}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className={styles.submitBtn}>
                Reset Password
              </button>
            </form>
          </>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <>
            <div className={styles.successMsg}>
              <CheckCircle />
              Password reset successfully!
            </div>
            <h2 className={styles.formTitle}>All done!</h2>
            <p className={styles.formSubtitle}>
              Your password has been reset. You can now sign in with your new password.
            </p>
            <button
              className={styles.submitBtn}
              onClick={() => navigate(ROUTES.LOGIN)}
            >
              Back to Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
