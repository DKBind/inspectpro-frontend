import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { authService } from '@/services/authService';
import { ROUTES } from '@/components/Constant/Route';
import { Shield, Eye, EyeOff, CheckCircle2, BarChart3, Users2, ClipboardList } from 'lucide-react';
import styles from './Login.module.css';

const Login = () => {
  const { setTokens, setFirstLoginDone } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await authService.login(email.trim().toLowerCase(), password);

      // Store only tokens — useAppInit will fetch user details + my-access
      setTokens(data.idToken, data.refreshToken);

      if (data.isFirstLogin) {
        // Mark first login in store (in-memory only, not persisted)
        navigate(ROUTES.UPDATE_PASSWORD);
        return;
      }

      setFirstLoginDone();
      navigate(ROUTES.DASHBOARD);
    } catch {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authPage}>
      {/* Left Brand Panel */}
      <div className={styles.brandPanel}>
        <div className={styles.brandContent}>
          <div className={styles.brandLogo}>
            <Shield className={styles.brandLogoIcon} />
          </div>
          <h1 className={styles.brandName}>InspectWise Pro</h1>
          <p className={styles.brandTagline}>Inspection & Quality Management</p>
          <p className={styles.brandDesc}>
            The enterprise platform for managing inspections, quality audits, and compliance workflows — all in one place.
          </p>

          <div className={styles.featureList}>
            <div className={styles.featureItem}>
              <ClipboardList className={styles.featureIcon} />
              <span>End-to-end inspection management</span>
            </div>
            <div className={styles.featureItem}>
              <BarChart3 className={styles.featureIcon} />
              <span>Real-time quality analytics</span>
            </div>
            <div className={styles.featureItem}>
              <Users2 className={styles.featureIcon} />
              <span>Multi-org & franchise support</span>
            </div>
            <div className={styles.featureItem}>
              <CheckCircle2 className={styles.featureIcon} />
              <span>Role-based access control</span>
            </div>
          </div>
        </div>

        <div className={styles.brandFooter}>
          <p>© 2025 InspectWise Pro. All rights reserved.</p>
        </div>

        <div className={styles.brandOrb1} />
        <div className={styles.brandOrb2} />
      </div>

      {/* Right Form Panel */}
      <div className={styles.formPanel}>
        <div className={styles.formCard}>
          <div className={styles.mobileLogo}>
            <div className={styles.mobileLogoIcon}><Shield /></div>
            <span className={styles.mobileLogoText}>InspectWise Pro</span>
          </div>

          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Sign in to your account</h2>
            <p className={styles.formSubtitle}>Enter your credentials to access the platform</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Email address</label>
              <input
                type="email"
                className={styles.formInput}
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>

            <div className={styles.formGroup}>
              <div className={styles.labelRow}>
                <label className={styles.formLabel}>Password</label>
                <Link to={ROUTES.FORGOT_PASSWORD} className={styles.forgotLink}>
                  Forgot password?
                </Link>
              </div>
              <div className={styles.passwordWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={styles.formInput}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            {error && <div className={styles.errorMsg}>{error}</div>}

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? (
                <span className={styles.loadingRow}>
                  <span className={styles.spinner} />
                  Signing in…
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
