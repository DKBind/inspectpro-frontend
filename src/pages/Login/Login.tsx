import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useModuleStore } from '@/store/useModuleStore';
import { moduleService } from '@/services/moduleService';
import { authService } from '@/services/authService';
import { ROUTES } from '@/components/Constant/Route';
import { Shield, Lock } from 'lucide-react';
import styles from './Login.module.css';

const Login = () => {
  const { setAuth } = useAuthStore();
  const { setAccessModules } = useModuleStore();
  const navigate = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await authService.login(email.trim().toLowerCase(), password);

      const user = {
        id:          data.userId,
        email:       data.email,
        name:        `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim(),
        role:        data.superAdmin ? 'super_admin' : (data.roleName ?? 'user'),
        roleId:      data.superAdmin ? undefined : data.roleId,
        // Map all roles with their IDs so the role-switcher works
        roles:       (data.roles ?? []).map((r) => ({ roleId: r.roleId, roleName: r.roleName })),
        orgId:       data.orgId,
        isSuperAdmin: data.superAdmin,
      };

      setAuth(user, data.accessToken, data.refreshToken, false);

      // Use my-access as the single source of truth for sidebar visibility
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
      <div className={styles.bgDecoration}>
        <div className={`${styles.bgOrb} ${styles.bgOrb1}`} />
        <div className={`${styles.bgOrb} ${styles.bgOrb2}`} />
      </div>

      <div className={styles.authCard}>
        <div className={styles.logoSection}>
          <div className={styles.logoIcon}><Shield /></div>
          <div className={styles.logoTitle}>InspectWisePro</div>
          <div className={styles.logoSubtitle}>Inspection & Quality Management</div>
        </div>

        <h2 className={styles.formTitle}>Welcome back</h2>
        <p className={styles.formSubtitle}>Sign in to your account to continue</p>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Email</label>
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

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Password</label>
            <input
              type="password"
              className={styles.formInput}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <div style={{
              color: 'hsl(0,84%,60%)',
              fontSize: 13,
              padding: '8px 12px',
              background: 'hsla(0,84%,60%,0.08)',
              borderRadius: 6,
              border: '1px solid hsla(0,84%,60%,0.2)',
              marginBottom: 8,
            }}>
              {error}
            </div>
          )}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className={styles.dividerRow}>
          <div className={styles.dividerLine} />
          <span className={styles.dividerText}>or continue with</span>
          <div className={styles.dividerLine} />
        </div>

        <button className={styles.secondaryBtn} type="button">
          <Lock />
          Sign in with OTP
        </button>
      </div>
    </div>
  );
};

export default Login;
