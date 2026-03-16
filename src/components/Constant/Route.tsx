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
  ORGANISATION_DETAIL: '/organisation/:uuid',
  ORGANISATION_ONBOARDING: '/organisation/onboarding',
  ORGANISATION_CREATE: '/organisation/create',
  SUBSCRIPTIONS: '/subscriptions',
  USERS: '/users',
  PROFILE: '/profile',
  FRANCHISE: '/franchise',
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];
