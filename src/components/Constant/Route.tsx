export const ROUTES = {
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',
  UPDATE_PASSWORD: '/update-password',
  DASHBOARD: '/dashboard',
  PROJECTS: '/projects',
  INSPECTIONS: '/inspections',
  CHECKLISTS: '/checklists',
  DEFECTS: '/defects',
  REPORTS: '/reports',
  SETTINGS: '/settings',
  ORGANISATION: '/organisation',
  USERS: '/users',
  PROFILE: '/profile',
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];
