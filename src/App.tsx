import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, PublicRoute } from './routes/RouteGuards';
import { useAuthStore } from './store/useAuthStore';
import { Button } from './components/ui/button';

// Placeholder Pages
const LoginPage = () => {
  const { setAuth } = useAuthStore();
  const handleLogin = () => {
    // Mock login action
    setAuth({ id: '1', email: 'admin@inspectpro.com', role: 'admin' }, 'mock-access', 'mock-refresh');
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border p-6 shadow-sm">
        <h1 className="mb-4 text-2xl font-bold">InspectPro Login</h1>
        <p className="mb-6 text-sm text-muted-foreground">Log in to your account</p>
        <Button onClick={handleLogin} className="w-full">
          Sign In
        </Button>
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const { user, clearAuth } = useAuthStore();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between border-b px-6">
        <h2 className="text-lg font-semibold">InspectPro Dashboard</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button variant="outline" onClick={clearAuth}>
            Logout
          </Button>
        </div>
      </header>
      <main className="flex-1 p-6 text-center">
        <h3 className="mb-2 text-2xl font-bold">Welcome back, {user?.role}!</h3>
        <p className="text-muted-foreground">This is your protected dashboard view.</p>
      </main>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          {/* Add more protected routes here */}
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
