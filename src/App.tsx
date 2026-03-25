import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, PublicRoute } from './routes/RouteGuards';
import { ROUTES } from './components/Constant/Route';
import AdminLayout from './components/layout/AdminLayout/AdminLayout';
import Login from './pages/Login/Login';
import ForgotPassword from './pages/ForgotPassword/ForgotPassword';
import UpdatePassword from './pages/UpdatePassword/UpdatePassword';
import Dashboard from './pages/Dashboard/Dashboard';
import Settings from './pages/Settings/Settings';
import Organisation from './pages/Organisation/Organisation';
import OrganisationDetail from './pages/Organisation/OrganisationDetail';
import OrganisationOnboarding from './pages/OrganisationOnboarding';
import OrganisationCreate from './pages/OrganisationCreate';
import Franchise from './pages/Franchise/Franchise';
import Subscriptions from './pages/Subscriptions/Subscriptions';
import FranchiseSubscriptions from './pages/FranchiseSubscriptions/FranchiseSubscriptions';
import Customers from './pages/Customers/Customers';
import Projects from './pages/Projects/Projects';
import ProjectDetail from './pages/Projects/ProjectDetail';
import ProjectCreate from './pages/Projects/ProjectCreate';
import ProjectEdit from './pages/Projects/ProjectEdit';
import Checklists from './pages/Checklists/Checklists';
import InspectionExecution from './pages/Inspections/InspectionExecution';
import DefectSummary from './pages/Inspections/DefectSummary';
import UsersRolesPage from './pages/UsersRoles/UsersRolesPage';
import Notifications from './pages/Notifications/Notifications';
import Users from './pages/Users/Users';
import NotFound from './components/shared-ui/NotFound/NotFound';
import Unauthorized from './pages/Unauthorized/Unauthorized';
import Profile from './pages/Settings/Profile/Profile';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route element={<PublicRoute />}>
          <Route path={ROUTES.LOGIN} element={<Login />} />
          <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPassword />} />
        </Route>

        {/* Open routes — no auth required */}
        <Route path={ROUTES.UNAUTHORIZED} element={<Unauthorized />} />

        {/* Semi-protected: must be authenticated but allows first-login users */}
        <Route element={<ProtectedRoute />}>
          <Route path={ROUTES.UPDATE_PASSWORD} element={<UpdatePassword />} />
        </Route>

        {/* Protected Routes — wrapped in AdminLayout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
            <Route path={ROUTES.PROJECTS} element={<Projects />} />
            <Route path={ROUTES.PROJECT_CREATE} element={<ProjectCreate />} />
            <Route path={ROUTES.PROJECT_DETAIL} element={<ProjectDetail />} />
            <Route path={ROUTES.PROJECT_EDIT} element={<ProjectEdit />} />
            <Route path={ROUTES.INSPECTIONS} element={<Dashboard />} />
            <Route path={ROUTES.INSPECTION_EXECUTE} element={<InspectionExecution />} />
            <Route path={ROUTES.CHECKLISTS} element={<Checklists />} />
            <Route path={ROUTES.DEFECTS} element={<Dashboard />} />
            <Route path={ROUTES.DEFECT_SUMMARY} element={<DefectSummary />} />
            <Route path={ROUTES.REPORTS} element={<Dashboard />} />
            <Route path={ROUTES.SETTINGS} element={<Settings />} />
            <Route path={ROUTES.ORGANISATION} element={<Organisation />} />
            <Route path={ROUTES.ORGANISATION_DETAIL} element={<OrganisationDetail />} />
            <Route path={ROUTES.ORGANISATION_ONBOARDING} element={<OrganisationOnboarding />} />
            <Route path={ROUTES.ORGANISATION_CREATE} element={<OrganisationCreate />} />
            <Route path={ROUTES.SUBSCRIPTIONS} element={<Subscriptions />} />
            <Route path={ROUTES.USERS} element={<Users />} />
            <Route path={ROUTES.FRANCHISE} element={<Franchise />} />
            <Route path={ROUTES.FRANCHISE_SUBSCRIPTIONS} element={<FranchiseSubscriptions />} />
            <Route path={ROUTES.CLIENTS} element={<Customers />} />
            <Route path={ROUTES.USERS_ROLES} element={<UsersRolesPage />} />
            <Route path={ROUTES.NOTIFICATIONS} element={<Notifications />} />
            <Route path={ROUTES.PROFILE} element={<Profile />} />
          </Route>
        </Route>

        {/* Default Redirect */}
        <Route path="/" element={<Navigate to={ROUTES.DASHBOARD} replace />} />

        {/* 404 Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
