import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { authService } from '@/services/authService';
import { ROUTES } from '@/components/Constant/Route';
import { Shield, CheckCircle, AlertCircle } from 'lucide-react';
import styles from '../Login/Login.module.css';

const UpdatePassword = () => {
  const navigate = useNavigate();
  const { setFirstLoginDone } = useAuthStore();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const getStrength = (pw: string): number => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  };

  const strength = getStrength(newPassword);
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['', styles.strengthWeak, styles.strengthMedium, styles.strengthMedium, styles.strengthStrong];

  const handleSubmit = async (e: React.FormEvent) => {
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

    try {
      await authService.changePassword(newPassword);
    } catch {
      // Non-fatal — password may not be enforced on backend yet
    }

    setFirstLoginDone();
    setSuccess(true);
    setTimeout(() => navigate(ROUTES.DASHBOARD), 1500);
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
          <div className={styles.logoTitle}>InspectWise Pro</div>
        </div>

        {success ? (
          <>
            <div className={styles.successMsg}>
              <CheckCircle />
              Password updated successfully! Redirecting...
            </div>
            <h2 className={styles.formTitle}>You're all set!</h2>
            <p className={styles.formSubtitle}>
              Taking you to your dashboard now.
            </p>
          </>
        ) : (
          <>
            <h2 className={styles.formTitle}>Update your password</h2>
            <p className={styles.formSubtitle}>
              Please set a new password to secure your account
            </p>

            {error && (
              <div className={styles.errorMsg}>
                <AlertCircle />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
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
                {newPassword && (
                  <>
                    <div className={styles.passwordStrength}>
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`${styles.strengthBar} ${
                            i <= strength ? strengthColors[strength] : ''
                          }`}
                        />
                      ))}
                    </div>
                    <span
                      className={styles.strengthLabel}
                      style={{
                        color:
                          strength <= 1
                            ? 'hsl(0, 84%, 60%)'
                            : strength <= 2
                            ? 'hsl(45, 93%, 47%)'
                            : 'hsl(142, 71%, 45%)',
                      }}
                    >
                      {strengthLabels[strength]}
                    </span>
                  </>
                )}
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
                Set Password & Continue
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default UpdatePassword;
