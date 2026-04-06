import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';
import { Save, CheckCircle } from 'lucide-react';
import { AvatarUpload } from '@/components/shared-ui/FileUpload/AvatarUpload';
import DropdownSelect from '@/components/shared-ui/DropdownSelect/DropdownSelect';
import { userService } from '@/services/userService';
import { authService } from '@/services/authService';
import type { UserResponse } from '@/services/models/user';
import styles from './Profile.module.css';

const GENDER_OPTIONS = [
  { value: 'Male',   label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other',  label: 'Other' },
];

const Profile = () => {
  const { user, updateUser } = useAuthStore();

  // Profile state
  const [profile, setProfile]         = useState<UserResponse | null>(null);
  const [firstName, setFirstName]     = useState('');
  const [middleName, setMiddleName]   = useState('');
  const [lastName, setLastName]       = useState('');
  const [phone, setPhone]             = useState('');
  const [gender, setGender]           = useState<string | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [bio, setBio]                 = useState('');
  const [avatarUrl, setAvatarUrl]     = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving]   = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword]   = useState('');
  const [newPassword, setNewPassword]           = useState('');
  const [confirmPassword, setConfirmPassword]   = useState('');
  const [pwSaving, setPwSaving]   = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    setProfileLoading(true);
    userService.getUserById(user.id)
      .then((data) => {
        setProfile(data);
        setFirstName(data.firstName || '');
        setMiddleName(data.middleName || '');
        setLastName(data.lastName || '');
        setPhone(data.phoneNumber || '');
        setGender(data.gender || null);
        setDateOfBirth(data.dateOfBirth || '');
        setBio(data.bio || '');
        const url = data.imageUrl;
        setAvatarUrl(url && url.startsWith('http') ? url : null);
      })
      .catch((err) => toast.error(err.message || 'Failed to load profile'))
      .finally(() => setProfileLoading(false));
  }, [user?.id]);

  const getInitials = () => {
    if (firstName && lastName) return (firstName[0] + lastName[0]).toUpperCase();
    if (firstName) return firstName.slice(0, 2).toUpperCase();
    if (user?.email) return user.email.slice(0, 2).toUpperCase();
    return 'U';
  };

  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');

  const isDirty = profile !== null && (
    firstName   !== (profile.firstName   || '') ||
    middleName  !== (profile.middleName  || '') ||
    lastName    !== (profile.lastName    || '') ||
    phone       !== (profile.phoneNumber || '') ||
    gender      !== (profile.gender      || null) ||
    dateOfBirth !== (profile.dateOfBirth || '') ||
    bio         !== (profile.bio         || '')
  );

  const isPwFilled = currentPassword.trim() !== '' || newPassword !== '' || confirmPassword !== '';

  const handleSaveProfile = async () => {
    if (!user?.id || !profile) return;
    setProfileSaving(true);
    try {
      const updated = await userService.updateUser(user.id, {
        firstName,
        middleName:   middleName   || undefined,
        lastName,
        email:        profile.email,
        phoneNumber:  phone        || undefined,
        gender:       gender       || undefined,
        dateOfBirth:  dateOfBirth  || undefined,
        bio:          bio          || undefined,
        orgId:        profile.orgId,
        roleId:       profile.roleId,
        statusId:     profile.statusId,
      });
      setProfile(updated);
      setProfileSuccess(true);
      toast.success('Profile saved successfully!');
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) { toast.error('Please enter your current password'); return; }
    if (newPassword.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('New passwords do not match'); return; }
    setPwSaving(true);
    try {
      await authService.changePassword(newPassword);
      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully!');
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className={styles.profilePage}>
      {/* Personal Information */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Personal Information</h3>
        </div>
        <div className={styles.cardBody}>
          {/* Avatar */}
          <div className={styles.avatarSection}>
            <div className={styles.avatarUploadWrapper}>
              <AvatarUpload
                currentUrl={avatarUrl}
                initials={getInitials()}
                userId={user?.id}
                onUploadComplete={(url) => {
                  setAvatarUrl(url);
                  updateUser({ imageUrl: url });
                }}
                onError={(msg) => toast.error(msg)}
              />
            </div>
            <div className={styles.avatarInfo}>
              <h3>{fullName || 'Admin User'}</h3>
              <p>Org Name: {profile?.orgName || 'InspectPro Internal'}</p>
            </div>
          </div>

          {/* Name row — 3 columns */}
          <div className={styles.formGrid3}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>First Name</label>
              <input
                type="text"
                className={styles.formInput}
                value={firstName}
                maxLength={50}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter first name"
                disabled={profileLoading}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Middle Name</label>
              <input
                type="text"
                className={styles.formInput}
                value={middleName}
                maxLength={50}
                onChange={(e) => setMiddleName(e.target.value)}
                placeholder="Enter middle name (optional)"
                disabled={profileLoading}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Last Name</label>
              <input
                type="text"
                className={styles.formInput}
                value={lastName}
                maxLength={50}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter last name"
                disabled={profileLoading}
              />
            </div>
          </div>

          {/* Rest of fields — 2 columns */}
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Email</label>
              <input
                type="email"
                maxLength={100}
                className={styles.formInput}
                value={profile?.email || user?.email || ''}
                disabled
                title="Email cannot be changed"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Phone</label>
              <input
                type="text"
                className={styles.formInput}
                value={phone}
                maxLength={10}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter phone number"
                disabled={profileLoading}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Date of Birth</label>
              <input
                type="date"
                className={`${styles.formInput} ${!dateOfBirth ? styles.dobEmpty : ''}`}
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                disabled={profileLoading}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Gender</label>
              <DropdownSelect
                options={GENDER_OPTIONS}
                value={gender}
                onChange={(val) => setGender(val as string | null)}
                placeholder="Select gender"
                searchable={false}
                disabled={profileLoading}
              />
            </div>
          </div>

          <div className={styles.formGroup} style={{ marginTop: 18 }}>
            <label className={styles.formLabel}>Bio</label>
            <textarea
              className={styles.formInput}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Write a short bio..."
              rows={3}
              maxLength={1000}
              disabled={profileLoading}
              style={{ height: 'auto', padding: '10px 14px', resize: 'vertical' }}
            />
          </div>

          <div className={styles.btnRow}>
            <button className={styles.saveBtn} onClick={handleSaveProfile} disabled={!isDirty || profileSaving}>
              {profileSuccess
                ? <><CheckCircle size={16} /> Saved</>
                : <><Save size={16} /> {profileSaving ? 'Saving...' : 'Save Changes'}</>
              }
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
                  placeholder="Minimum 8 characters"
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
              <button type="submit" className={styles.saveBtn} disabled={!isPwFilled || pwSaving}>
                {pwSuccess
                  ? <><CheckCircle size={16} /> Updated</>
                  : pwSaving ? 'Updating...' : 'Update Password'
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
