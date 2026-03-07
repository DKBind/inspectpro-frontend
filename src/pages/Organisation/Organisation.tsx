import {
  Building2,
  CreditCard,
  Users,
  Crown,
  Check,
  CalendarDays,
  HardDrive,
  Globe,
} from 'lucide-react';
import styles from './Organisation.module.css';

const Organisation = () => {
  return (
    <div className={styles.orgPage}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Organisation</h1>
          <p className={styles.pageSubtitle}>
            Manage your organisation details, subscription, and billing
          </p>
        </div>
      </div>

      <div className={styles.cardsGrid}>
        {/* Organisation Details */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>
              <Building2 /> Organisation Details
            </h3>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Organisation Name</span>
              <span className={styles.infoValue}>InspectWisePro India Pvt. Ltd.</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Industry</span>
              <span className={styles.infoValue}>Construction & Infrastructure</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Location</span>
              <span className={styles.infoValue}>Mumbai, Maharashtra</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Account Status</span>
              <span className={`${styles.statusDot} ${styles.dotActive}`}>Active</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Account ID</span>
              <span className={styles.infoValue}>ORG-2024-00142</span>
            </div>
          </div>
        </div>

        {/* Subscription */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>
              <CreditCard /> Subscription Plan
            </h3>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Current Plan</span>
              <span className={`${styles.planBadge} ${styles.planEnterprise}`}>
                <Crown /> Enterprise
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Billing Cycle</span>
              <span className={styles.infoValue}>Annual</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Start Date</span>
              <span className={styles.infoValue}>01 Apr 2025</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Renewal Date</span>
              <span className={`${styles.statusDot} ${styles.dotWarning}`}>31 Mar 2026</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Payment Method</span>
              <span className={styles.infoValue}>•••• •••• •••• 4242</span>
            </div>
          </div>
        </div>
      </div>

      {/* Usage & Limits */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <HardDrive /> Usage & Limits
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.cardsGrid}>
            {/* Users */}
            <div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>
                  <Users style={{ display: 'inline', width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} />
                  Team Members
                </span>
                <span className={styles.infoValue}>24 / 50</span>
              </div>
              <div className={styles.usageBar}>
                <div className={styles.usageTrack}>
                  <div className={`${styles.usageFill} ${styles.usageFillGreen}`} style={{ width: '48%' }} />
                </div>
                <div className={styles.usageLabel}>
                  <span>48% used</span>
                  <span>26 remaining</span>
                </div>
              </div>
            </div>

            {/* Projects */}
            <div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>
                  <Globe style={{ display: 'inline', width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} />
                  Active Projects
                </span>
                <span className={styles.infoValue}>42 / 100</span>
              </div>
              <div className={styles.usageBar}>
                <div className={styles.usageTrack}>
                  <div className={`${styles.usageFill} ${styles.usageFillGreen}`} style={{ width: '42%' }} />
                </div>
                <div className={styles.usageLabel}>
                  <span>42% used</span>
                  <span>58 remaining</span>
                </div>
              </div>
            </div>

            {/* Storage */}
            <div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>
                  <HardDrive style={{ display: 'inline', width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} />
                  Storage
                </span>
                <span className={styles.infoValue}>18.4 GB / 25 GB</span>
              </div>
              <div className={styles.usageBar}>
                <div className={styles.usageTrack}>
                  <div className={`${styles.usageFill} ${styles.usageFillOrange}`} style={{ width: '73%' }} />
                </div>
                <div className={styles.usageLabel}>
                  <span>73% used</span>
                  <span>6.6 GB remaining</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Renewal */}
      <div className={styles.renewalCard}>
        <div className={styles.renewalHeader}>
          <div>
            <h3 className={styles.renewalTitle}>Renew Your Subscription</h3>
            <p style={{ fontSize: 13, color: 'hsl(215, 20%, 55%)', marginTop: 4 }}>
              Your Enterprise plan expires on 31 Mar 2026
            </p>
          </div>
          <div className={styles.renewalPrice}>
            ₹2,49,999 <span>/ year</span>
          </div>
        </div>

        <div className={styles.renewalDetails}>
          <div className={styles.renewalItem}>
            <Check /> Up to 50 team members
          </div>
          <div className={styles.renewalItem}>
            <Check /> 100 active projects
          </div>
          <div className={styles.renewalItem}>
            <Check /> 25 GB cloud storage
          </div>
          <div className={styles.renewalItem}>
            <Check /> Priority support & SLA
          </div>
          <div className={styles.renewalItem}>
            <Check /> Advanced analytics & BI
          </div>
          <div className={styles.renewalItem}>
            <Check /> Custom inspection templates
          </div>
        </div>

        <button className={styles.renewBtn}>
          <CalendarDays style={{ display: 'inline', width: 18, height: 18, marginRight: 8, verticalAlign: 'middle' }} />
          Renew Subscription
        </button>
      </div>
    </div>
  );
};

export default Organisation;
