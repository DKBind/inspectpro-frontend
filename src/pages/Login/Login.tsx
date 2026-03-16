import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useModuleStore } from '@/store/useModuleStore';
import { moduleService } from '@/services/moduleService';
import { authService } from '@/services/authService';
import { ROUTES } from '@/components/Constant/Route';
import { Shield, Eye, EyeOff, CheckCircle2, BarChart3, Users2, ClipboardList } from 'lucide-react';
import styles from './Login.module.css';

const Login = () => {
  const { setAuth } = useAuthStore();
  const { setAccessModules } = useModuleStore();
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

      const user = {
        id: data.userId,
        email: data.email,
        name: `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim(),
        role: data.superAdmin ? 'super_admin' : (data.roleName ?? 'user'),
        roleId: data.superAdmin ? undefined : data.roleId,
        roles: (data.roles ?? []).map((r) => ({ roleId: r.roleId, roleName: r.roleName })),
        orgId: data.orgId,
        isSuperAdmin: data.superAdmin,
      };

      const isFirstLogin = data.isFirstLogin ?? false;
      setAuth(user, data.accessToken, data.refreshToken, isFirstLogin);

      if (isFirstLogin) {
        navigate(ROUTES.UPDATE_PASSWORD);
        return;
      }

      await moduleService.getMyAccess(data.userId).then(setAccessModules).catch(() => {});

      navigate(ROUTES.DASHBOARD);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
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
          <h1 className={styles.brandName}>InspectWisePro</h1>
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
          <p>© 2025 InspectWisePro. All rights reserved.</p>
        </div>

        {/* Decorative orbs */}
        <div className={styles.brandOrb1} />
        <div className={styles.brandOrb2} />
      </div>

      {/* Right Form Panel */}
      <div className={styles.formPanel}>
        <div className={styles.formCard}>
          {/* Mobile logo */}
          <div className={styles.mobileLogo}>
            <div className={styles.mobileLogoIcon}><Shield /></div>
            <span className={styles.mobileLogoText}>InspectWisePro</span>
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

            {error && (
              <div className={styles.errorMsg}>
                {error}
              </div>
            )}

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
