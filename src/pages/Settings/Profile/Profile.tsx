import { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { Save, CheckCircle, AlertCircle } from 'lucide-react';
import styles from './Profile.module.css';

const Profile = () => {
  const { user } = useAuthStore();

  // Profile form state
  const [name, setName] = useState(user?.name || '');
  const [email] = useState(user?.email || '');
  const [phone, setPhone] = useState('+91 98765 43210');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState('');

  const getInitials = () => {
    if (name) return name.slice(0, 2).toUpperCase();
    if (email) return email.slice(0, 2).toUpperCase();
    return 'U';
  };

  const handleSaveProfile = () => {
    // Mock save
    alert('Profile saved (demo)');
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);

    if (!currentPassword) {
      setPwError('Please enter your current password');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match');
      return;
    }

    // Mock success
    setPwSuccess(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPwSuccess(false), 3000);
  };

  return (
    <div className={styles.profilePage}>
      {/* Profile Info */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Personal Information</h3>
        </div>
        <div className={styles.cardBody}>
          {/* Avatar */}
          <div className={styles.avatarSection}>
            <div className={styles.avatarLarge}>{getInitials()}</div>
            <div className={styles.avatarInfo}>
              <h3>{name || 'Admin User'}</h3>
              <p>{email}</p>
              <span>{user?.role === 'super_admin' ? 'Super Admin' : 'Admin'}</span>
            </div>
          </div>

          {/* Form */}
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Full Name</label>
              <input
                type="text"
                className={styles.formInput}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Email</label>
              <input
                type="email"
                className={styles.formInput}
                value={email}
                disabled
                title="Email cannot be changed"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Phone</label>
              <input
                type="tel"
                className={styles.formInput}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Role</label>
              <input
                type="text"
                className={styles.formInput}
                value={user?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                disabled
              />
            </div>
          </div>

          <div className={styles.btnRow}>
            <button className={styles.cancelBtn}>Cancel</button>
            <button className={styles.saveBtn} onClick={handleSaveProfile}>
              <Save /> Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Change Password</h3>
        </div>
        <div className={styles.cardBody}>
          {pwSuccess && (
            <div className={styles.successMsg}>
              <CheckCircle /> Password changed successfully!
            </div>
          )}
          {pwError && (
            <div className={styles.errorMsg}>
              <AlertCircle /> {pwError}
            </div>
          )}

          <form onSubmit={handleChangePassword} className={styles.passwordSection}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Current Password</label>
              <input
                type="password"
                className={styles.formInput}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                style={{ maxWidth: 400 }}
              />
            </div>
            <div className={styles.formGrid} style={{ maxWidth: 820 }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>New Password</label>
                <input
                  type="password"
                  className={styles.formInput}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Confirm New Password</label>
                <input
                  type="password"
                  className={styles.formInput}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>
            </div>
            <div className={styles.btnRow} style={{ justifyContent: 'flex-start' }}>
              <button type="submit" className={styles.saveBtn}>
                Update Password
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
