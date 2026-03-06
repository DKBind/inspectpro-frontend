// Storage Keys
export const STORAGE_KEYS = {
  AUTH: 'auth-storage',
  THEME: 'theme-preference',
  SIDEBAR_COLLAPSED: 'sidebar-collapsed',
} as const;

// TanStack Query Keys
export const QUERY_KEYS = {
  DASHBOARD: {
    STATS: ['dashboard', 'stats'],
    RECENT_INSPECTIONS: ['dashboard', 'recent-inspections'],
    ACTIVITY_FEED: ['dashboard', 'activity-feed'],
  },
  PROJECTS: {
    LIST: ['projects', 'list'],
    DETAIL: (id: string) => ['projects', 'detail', id],
  },
  INSPECTIONS: {
    LIST: ['inspections', 'list'],
    DETAIL: (id: string) => ['inspections', 'detail', id],
  },
  USERS: {
    LIST: ['users', 'list'],
    PROFILE: ['users', 'profile'],
  },
} as const;
