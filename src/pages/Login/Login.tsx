import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { ROUTES } from '@/components/Constant/Route';
import { Shield, Lock } from 'lucide-react';
import styles from './Login.module.css';

const Login = () => {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@inspectpro.com');
  const [password, setPassword] = useState('password');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isFirstLogin = false; // toggle to true to test first-login flow
    setAuth(
      { 
        id: '1', 
        email, 
        name: 'Admin User', 
        role: 'super_admin', // Default role
        roles: ['super_admin', 'admin'] // All accessible roles
      },
      'mock-access-token',
      'mock-refresh-token',
      isFirstLogin
    );
    if (isFirstLogin) {
      navigate(ROUTES.UPDATE_PASSWORD);
    } else {
      navigate(ROUTES.DASHBOARD);
    }
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.bgDecoration}>
        <div className={`${styles.bgOrb} ${styles.bgOrb1}`} />
        <div className={`${styles.bgOrb} ${styles.bgOrb2}`} />
      </div>

      <div className={styles.authCard}>
        {/* Logo */}
        <div className={styles.logoSection}>
          <div className={styles.logoIcon}>
            <Shield />
          </div>
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
              required
            />
          </div>



          <div className={styles.formOptions}>
            <label className={styles.rememberMe}>
              <input type="checkbox" />
              Remember me
            </label>
            <button
              type="button"
              className={styles.forgotLink}
              onClick={() => navigate(ROUTES.FORGOT_PASSWORD)}
            >
              Forgot password?
            </button>
          </div>

          <button type="submit" className={styles.submitBtn}>
            Sign In
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
