import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/components/Constant/Route';
import { authService } from '@/services/authService';
import { Shield, ArrowLeft, CheckCircle, Eye, EyeOff } from 'lucide-react';
import styles from '../Login/Login.module.css';
import { cn } from '@/lib/utils';

type Step = 'email' | 'otp' | 'reset' | 'success';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  const stepIndex: Record<Step, number> = { email: 0, otp: 1, reset: 2, success: 3 };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.sendOtp(email.trim().toLowerCase());
      setStep('otp');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResending(true);
    try {
      await authService.sendOtp(email.trim().toLowerCase());
      setStep('otp');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to re-send OTP. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const token = await authService.verifyOtp(email.trim().toLowerCase(), otp.trim());
      setResetToken(token);
      setStep('reset');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(resetToken, newPassword);
      setStep('success');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authPage} style={{ background: 'var(--ip-page-bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
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
            {(['email', 'otp', 'reset'] as const).map((s, i) => (
              <div
                key={s}
                className={`${styles.step} ${i === stepIndex[step] ? styles.stepActive : ''} ${i < stepIndex[step] ? styles.stepDone : ''}`}
              />
            ))}
          </div>
        )}

        {/* Step: Email */}
        {step === 'email' && (
          <>
            <h2 className={styles.formTitle}>Forgot password?</h2>
            <p className={styles.formSubtitle}>
              Enter your email and we'll send you an OTP to reset your password.
            </p>
            {error && <div className={cn(styles.errorMsg, 'mt-2')}>{error}</div>}
            <form onSubmit={handleSendOtp}>
              <div className={cn(styles.formGroup, 'mt-4')}>
                <label className={styles.formLabel}>Email address</label>
                <input
                  type="email"
                  className={styles.formInput}
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <button type="submit" className={cn(styles.submitBtn, 'mt-2')} disabled={loading}>
                {loading ? 'Sending OTP…' : 'Send OTP'}
              </button>
              <button className={cn(styles.backBtn, 'mt-2')} onClick={() => navigate(ROUTES.LOGIN)}>
                <ArrowLeft /> Back to login
              </button>
            </form>
          </>
        )}

        {/* Step: OTP */}
        {step === 'otp' && (
          <>
            <h2 className={styles.formTitle}>Verify OTP</h2>
            <p className={styles.formSubtitle}>
              Enter the 6-digit code sent to <strong>{email}</strong>
            </p>
            {error && <div className={cn(styles.errorMsg, 'mt-2')}>{error}</div>}
            <form onSubmit={handleVerifyOtp}>
              <div className={cn(styles.formGroup, 'mt-4')}>
                <label className={styles.formLabel}>OTP Code</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  required
                  disabled={loading}
                  autoComplete="one-time-code"
                />
              </div>
              <button type="submit" className={cn(styles.submitBtn, 'mt-2')} disabled={loading || resending || otp.length < 6}>
                {loading ? 'Verifying…' : 'Verify OTP'}
              </button>
            </form>
            { (!loading && !resending) && <div className={styles.footerLink}>
              Didn't receive a code?{' '}
              <button onClick={() => { setError(''); handleReSendOtp({ preventDefault: () => {} } as React.FormEvent); }}>
                Resend
              </button>
            </div> }
            <button className={cn(styles.backBtn, 'mt-2')} onClick={() => { setStep('email'); setError(''); }}>
              <ArrowLeft /> Back
            </button>
          </>
        )}

        {/* Step: New Password */}
        {step === 'reset' && (
          <>
            <button className={styles.backBtn} onClick={() => { setStep('otp'); setError(''); }}>
              <ArrowLeft /> Back
            </button>
            <h2 className={styles.formTitle}>Set new password</h2>
            <p className={styles.formSubtitle}>Create a strong password for your account</p>
            {error && <div className={cn(styles.errorMsg, 'mt-2')}>{error}</div>}
            <form onSubmit={handleResetPassword}>
              <div className={cn(styles.formGroup, 'mt-4')}>
                <label className={styles.formLabel}>New Password</label>
                <div className={styles.passwordWrapper}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={styles.formInput}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>
              <div className={cn(styles.formGroup, 'mt-2')}>
                <label className={styles.formLabel}>Confirm Password</label>
                <div className={styles.passwordWrapper}>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    className={styles.formInput}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <button type="button" className={styles.eyeBtn} onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1}>
                    {showConfirm ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>
              <button type="submit" className={cn(styles.submitBtn, 'mt-2')} disabled={loading}>
                {loading ? 'Resetting…' : 'Reset Password'}
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
            <button className={cn(styles.submitBtn, 'mt-4')} onClick={() => navigate(ROUTES.LOGIN)}>
              Back to Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
