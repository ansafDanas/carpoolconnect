import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import { ComingSoonProvider } from "./components/ComingSoon";
import { NotificationsProvider } from "./components/Notifications";
import { useAuth } from "./context/AuthContext";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import AppLayout from "./layouts/AppLayout";
import AdminLayout from "./layouts/AdminLayout";

// Route-level code splitting keeps the first paint light: Leaflet and the
// heavier screens only load when someone actually opens them.
const FindRides = lazy(() => import("./pages/FindRides"));
const RideDetails = lazy(() => import("./pages/RideDetails"));
const OfferRide = lazy(() => import("./pages/OfferRide"));
const MyRides = lazy(() => import("./pages/MyRides"));
const MyBookings = lazy(() => import("./pages/MyBookings"));
const RequestRide = lazy(() => import("./pages/RequestRide"));
const Profile = lazy(() => import("./pages/Profile"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const MyPeople = lazy(() => import("./pages/MyPeople"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Messages = lazy(() => import("./pages/Messages"));
const Reviews = lazy(() => import("./pages/Reviews"));

const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminRides = lazy(() => import("./pages/AdminRides"));
const AdminBookings = lazy(() => import("./pages/AdminBookings"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const AdminRideDetails = lazy(() => import("./pages/AdminRideDetails"));
const NotFound = lazy(() => import("./pages/NotFound"));

function RouteFallback() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div
        className="inline-flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-text-muted shadow-card"
        role="status"
      >
        <span
          className="size-4 animate-spin rounded-full border-2 border-leaf/25 border-t-leaf"
          aria-hidden="true"
        />
        Loading…
      </div>
    </div>
  );
}

function withSuspense(element) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

function RootRedirect() {
  const { token, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm font-medium text-text-muted">
        Loading CarpoolConnect…
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/landing" replace />;
  }

  return <Navigate to={isAdmin ? "/admin/dashboard" : "/app/dashboard"} replace />;
}

/** Already signed in? Skip the auth screens entirely. */
function PublicOnly({ children }) {
  const { token, loading } = useAuth();

  if (loading) return <RouteFallback />;
  if (token) return <Navigate to="/" replace />;

  return children;
}

function App() {
  return (
    <BrowserRouter>
      {/* The Coming Soon dialog and notification polling are app-wide, so both
          providers wrap every route instead of being repeated per screen. */}
      <ComingSoonProvider>
        <NotificationsProvider>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/landing" element={<PublicOnly><Landing /></PublicOnly>} />
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route
              path="/app"
              element={
                <ProtectedRoute allowedRoles={["passenger", "driver"]}>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route
                path="find-rides"
                element={
                  <ProtectedRoute allowedRoles={["passenger"]}>
                    {withSuspense(<FindRides />)}
                  </ProtectedRoute>
                }
              />
              <Route
                path="request-ride"
                element={
                  <ProtectedRoute allowedRoles={["passenger"]}>
                    {withSuspense(<RequestRide />)}
                  </ProtectedRoute>
                }
              />
              <Route
                path="rides/:id"
                element={<ProtectedRoute>{withSuspense(<RideDetails />)}</ProtectedRoute>}
              />
              <Route
                path="offer-ride"
                element={
                  <ProtectedRoute allowedRoles={["driver"]}>
                    {withSuspense(<OfferRide />)}
                  </ProtectedRoute>
                }
              />
              <Route
                path="my-rides"
                element={
                  <ProtectedRoute allowedRoles={["driver"]}>
                    {withSuspense(<MyRides />)}
                  </ProtectedRoute>
                }
              />
              <Route
                path="my-bookings"
                element={
                  <ProtectedRoute allowedRoles={["passenger"]}>
                    {withSuspense(<MyBookings />)}
                  </ProtectedRoute>
                }
              />
              <Route
                path="messages"
                element={<ProtectedRoute>{withSuspense(<Messages />)}</ProtectedRoute>}
              />
              <Route
                path="notifications"
                element={<ProtectedRoute>{withSuspense(<Notifications />)}</ProtectedRoute>}
              />
              <Route
                path="reviews"
                element={<ProtectedRoute>{withSuspense(<Reviews />)}</ProtectedRoute>}
              />
              <Route
                path="profile"
                element={<ProtectedRoute>{withSuspense(<Profile />)}</ProtectedRoute>}
              />
              <Route
                path="people"
                element={<ProtectedRoute>{withSuspense(<MyPeople />)}</ProtectedRoute>}
              />
              <Route
                path="people/:userId"
                element={
                  <ProtectedRoute>{withSuspense(<PublicProfile />)}</ProtectedRoute>
                }
              />
            </Route>

            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route
                path="dashboard"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    {withSuspense(<AdminDashboard />)}
                  </ProtectedRoute>
                }
              />
              <Route
                path="users"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    {withSuspense(<AdminUsers />)}
                  </ProtectedRoute>
                }
              />
              <Route
                path="rides"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    {withSuspense(<AdminRides />)}
                  </ProtectedRoute>
                }
              />
              <Route
                path="rides/:id"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    {withSuspense(<AdminRideDetails />)}
                  </ProtectedRoute>
                }
              />
              <Route
                path="bookings"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    {withSuspense(<AdminBookings />)}
                  </ProtectedRoute>
                }
              />
              <Route
                path="reports"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    {withSuspense(<AdminReports />)}
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Legacy links keep working rather than 404-ing an old bookmark. */}
            <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
            <Route path="/find-rides" element={<Navigate to="/app/find-rides" replace />} />
            <Route path="/request-ride" element={<Navigate to="/app/request-ride" replace />} />
            <Route path="/offer-ride" element={<Navigate to="/app/offer-ride" replace />} />
            <Route path="/my-rides" element={<Navigate to="/app/my-rides" replace />} />
            <Route path="/my-bookings" element={<Navigate to="/app/my-bookings" replace />} />
            <Route path="/profile" element={<Navigate to="/app/profile" replace />} />
            <Route path="/rides/:id" element={<Navigate to="/app/rides/:id" replace />} />

            <Route path="*" element={withSuspense(<NotFound />)} />
          </Routes>
        </NotificationsProvider>
      </ComingSoonProvider>
    </BrowserRouter>
  );
}

export default App;

