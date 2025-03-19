import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout/Layout';
import { Login } from './pages/auth/Login';
import { Dashboard } from './pages/dashboard/Dashboard';
import { Subscriptions } from './pages/subscriptions/Subscriptions';
import { AddSubscription } from './pages/subscriptions/AddSubscription';
import { ViewSubscription } from './pages/subscriptions/ViewSubscription';
import { EditSubscription } from './pages/subscriptions/EditSubscription';
import { UserProfile } from './pages/profile/UserProfile';

// Protected route component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mb-4"></div>
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
          Authenticating...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}

// Public route that redirects to dashboard if user is already logged in
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mb-4"></div>
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
          Authenticating...
        </p>
      </div>
    );
  }

  if (currentUser) {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          
          {/* Public Routes */}
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } 
          />
          
          {/* Protected Routes */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/subscriptions" 
            element={
              <ProtectedRoute>
                <Subscriptions />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/subscriptions/add" 
            element={
              <ProtectedRoute>
                <AddSubscription />
              </ProtectedRoute>
            } 
          />
          
          {/* Add routes for viewing and editing subscriptions */}
          <Route 
            path="/subscriptions/:id" 
            element={
              <ProtectedRoute>
                <ViewSubscription />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/subscriptions/:id/edit" 
            element={
              <ProtectedRoute>
                <EditSubscription />
              </ProtectedRoute>
            } 
          />
          
          {/* User Profile Route */}
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <UserProfile />
              </ProtectedRoute>
            } 
          />
          
          {/* Fallback for 404 */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
