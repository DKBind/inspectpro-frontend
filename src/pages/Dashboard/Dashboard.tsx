import { useState } from 'react';
import {
  FolderKanban,
  ClipboardCheck,
  Bug,
  TrendingUp,
  TrendingDown,
  Calendar,
  Plus,
  FileText,
  UserPlus,
  BarChart3,
  Activity,
} from 'lucide-react';
import Pagination from '@/components/shared-ui/Pagination/Pagination';
import styles from './Dashboard.module.css';

// ─── Dummy Data ────────────────────────────────────────────────────────
const statsData = [
  {
    label: 'Total Projects',
    value: 42,
    trend: '+12%',
    trendUp: true,
    icon: FolderKanban,
    color: 'Blue' as const,
  },
  {
    label: 'Active Inspections',
    value: 18,
    trend: '+8%',
    trendUp: true,
    icon: ClipboardCheck,
    color: 'Green' as const,
  },
  {
    label: 'Open Defects',
    value: 37,
    trend: '-5%',
    trendUp: false,
    icon: Bug,
    color: 'Orange' as const,
  },
  {
    label: 'Completion Rate',
    value: '89%',
    trend: '+3%',
    trendUp: true,
    icon: Activity,
    color: 'Purple' as const,
  },
];

const inspectionsData = [
  { id: 'INS-001', project: 'Mumbai Tower A', type: 'Structural', date: '2026-03-05', status: 'Passed' },
  { id: 'INS-002', project: 'Delhi Metro Phase 4', type: 'Electrical', date: '2026-03-04', status: 'Failed' },
  { id: 'INS-003', project: 'Bangalore IT Park', type: 'Fire Safety', date: '2026-03-04', status: 'In Progress' },
  { id: 'INS-004', project: 'Chennai Bridge', type: 'Structural', date: '2026-03-03', status: 'Passed' },
  { id: 'INS-005', project: 'Hyderabad Campus', type: 'Plumbing', date: '2026-03-03', status: 'Pending' },
  { id: 'INS-006', project: 'Pune Residential', type: 'HVAC', date: '2026-03-02', status: 'Passed' },
  { id: 'INS-007', project: 'Kolkata Mall', type: 'Elevator', date: '2026-03-02', status: 'Failed' },
  { id: 'INS-008', project: 'Jaipur Heritage', type: 'Structural', date: '2026-03-01', status: 'Passed' },
  { id: 'INS-009', project: 'Ahmedabad Infra', type: 'Electrical', date: '2026-03-01', status: 'In Progress' },
  { id: 'INS-010', project: 'Lucknow Highway', type: 'Road Safety', date: '2026-02-28', status: 'Pending' },
];

const activityFeed = [
  { text: '<strong>Rajesh Kumar</strong> completed inspection for Mumbai Tower A', time: '10 min ago', dot: 'Green' },
  { text: '<strong>Priya Sharma</strong> reported 3 new defects in Delhi Metro Phase 4', time: '25 min ago', dot: 'Red' },
  { text: '<strong>Amit Patel</strong> started Bangalore IT Park fire safety check', time: '1 hour ago', dot: 'Blue' },
  { text: '<strong>Sneha Gupta</strong> approved checklist for Pune Residential', time: '2 hours ago', dot: 'Green' },
  { text: '<strong>Vikram Singh</strong> uploaded inspection report for Chennai Bridge', time: '3 hours ago', dot: 'Orange' },
];

const quickActions = [
  { label: 'New Inspection', icon: Plus },
  { label: 'Create Report', icon: FileText },
  { label: 'Add Team Member', icon: UserPlus },
  { label: 'View Analytics', icon: BarChart3 },
];

// ─── Helper ────────────────────────────────────────────────────────────
const getStatusClass = (status: string) => {
  switch (status) {
    case 'Passed': return styles.statusPassed;
    case 'Failed': return styles.statusFailed;
    case 'Pending': return styles.statusPending;
    case 'In Progress': return styles.statusInProgress;
    default: return '';
  }
};

const formatDate = () => {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// ─── Component ─────────────────────────────────────────────────────────
const Dashboard = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const totalPages = Math.ceil(inspectionsData.length / pageSize);
  const paginatedInspections = inspectionsData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  return (
    <div className={styles.dashboardPage}>
      {/* Welcome Banner */}
      <div className={styles.welcomeBanner}>
        <div className={styles.welcomeText}>
          <h2>Welcome back, Admin! 👋</h2>
          <p>Here's what's happening with your projects today.</p>
        </div>
        <div className={styles.welcomeDate}>
          <Calendar />
          {formatDate()}
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        {statsData.map((stat) => (
          <div
            key={stat.label}
            className={`${styles.statCard} ${styles[`statCard${stat.color}`]}`}
          >
            <div className={styles.statHeader}>
              <span className={styles.statLabel}>{stat.label}</span>
              <div className={`${styles.statIcon} ${styles[`statIcon${stat.color}`]}`}>
                <stat.icon />
              </div>
            </div>
            <div className={styles.statBody}>
              <span className={styles.statValue}>{stat.value}</span>
              <span
                className={`${styles.statTrend} ${
                  stat.trendUp ? styles.trendUp : styles.trendDown
                }`}
              >
                {stat.trendUp ? <TrendingUp /> : <TrendingDown />}
                {stat.trend} from last month
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Content Grid: Table + Activity Feed */}
      <div className={styles.contentGrid}>
        {/* Recent Inspections */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Recent Inspections</h3>
            <button className={styles.panelAction}>View All</button>
          </div>
          <div className={styles.panelBody}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Project</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedInspections.map((ins) => (
                  <tr key={ins.id}>
                    <td style={{ fontWeight: 600, color: 'hsl(221, 83%, 63%)' }}>{ins.id}</td>
                    <td style={{ color: 'hsl(210, 40%, 90%)' }}>{ins.project}</td>
                    <td>{ins.type}</td>
                    <td>{ins.date}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${getStatusClass(ins.status)}`}>
                        {ins.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.paginationContainer}>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={inspectionsData.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Activity Feed */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>Activity Feed</h3>
              <button className={styles.panelAction}>See All</button>
            </div>
            <div className={styles.panelBody}>
              <ul className={styles.activityList}>
                {activityFeed.map((item, idx) => (
                  <li key={idx} className={styles.activityItem}>
                    <div
                      className={`${styles.activityDot} ${
                        styles[`dot${item.dot}`]
                      }`}
                    />
                    <div className={styles.activityContent}>
                      <div
                        className={styles.activityText}
                        dangerouslySetInnerHTML={{ __html: item.text }}
                      />
                      <div className={styles.activityTime}>{item.time}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Quick Actions */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>Quick Actions</h3>
            </div>
            <div className={styles.quickActions}>
              {quickActions.map((action) => (
                <button key={action.label} className={styles.quickActionBtn}>
                  <action.icon />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
