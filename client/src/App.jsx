import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Consultations from './pages/Consultations';
import AdminBlogManagement from './admin/AdminBlogManagement';
import CommentManagement from './admin/CommentManagement';
import BlogList from './pages/BlogList';
import BlogDetails from './pages/BlogDetails';
import EbookOrders from './pages/EbookOrders';
import DigitalProducts from './pages/DigitalProducts';
import Coupons from './pages/Coupons';
import CourseClicks from './pages/CourseClicks';
import SignIns from './pages/SignIns';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ContactMessages from './pages/ContactMessages';
import QuestionnaireAnalytics from './pages/QuestionnaireAnalytics';
import AskSidSettings from './pages/AskSidSettings';
import ReadingContent from './pages/ReadingContent';
import Entitlements from './pages/Entitlements';
import CompanionFiles from './pages/CompanionFiles';

// Shown to a signed-in person who is not an administrator (e.g. a customer of the public site, which
// shares this login system), or when the server could not confirm the role.
function AdminAccessMessage({ kind }) {
  const { signOut, retryAdminCheck } = useAuth();
  const denied = kind === 'denied';
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__header">
          <h1>{denied ? 'Administrator access required' : 'Could not verify access'}</h1>
          <p>
            {denied
              ? 'This account is not an administrator of the dashboard. If you should have access, please contact the site owner.'
              : 'We could not confirm your administrator access. Check your connection and try again.'}
          </p>
        </div>
        {!denied && (
          <button type="button" className="btn btn-primary" onClick={retryAdminCheck}>Try again</button>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => signOut().catch(() => {})}>Sign out</button>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, isAdmin, adminStatus, loading } = useAuth();

  if (loading || (isAuthenticated && adminStatus === 'unknown')) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (adminStatus === 'error') return <AdminAccessMessage kind="error" />;
  if (!isAdmin) return <AdminAccessMessage kind="denied" />;
  return children;
}

function GuestRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e1e2e',
              color: '#cdd6f4',
              border: '1px solid rgba(255,255,255,0.08)',
            },
          }}
        />
        <Routes>
          {/* Guest routes */}
          <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/:id" element={<BlogDetails />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<EbookOrders />} />
            <Route path="/coupons" element={<Coupons />} />
            <Route path="/products" element={<DigitalProducts />} />
            <Route path="/course-interactions" element={<CourseClicks />} />
            <Route path="/consultations" element={<Consultations />} />
            <Route path="/blogs" element={<AdminBlogManagement />} />
            <Route path="/blogs/:id/comments" element={<CommentManagement />} />
            <Route path="/sign-ins" element={<SignIns />} />
            <Route path="/contact-messages" element={<ContactMessages />} />
            <Route path="/questionnaire" element={<QuestionnaireAnalytics />} />
            <Route path="/ask-sid" element={<AskSidSettings />} />
            <Route path="/reading" element={<ReadingContent />} />
            <Route path="/customers-access" element={<Entitlements />} />
            <Route path="/companion-files" element={<CompanionFiles />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
