import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';

import NotFound from '@pages/NotFound/NotFound';

/**
 * Blocks non authenticated users, (optionally) wrong role users
 * If routed with a :role param, redirect to canonical path if not matching.
 */
function ProtectedRoute({ children, role }) {
  const { isAuthenticated, isFetchingProfile, profile, user } = useAuth();
  const { role: urlRole } = useParams();
  const location = useLocation();

  // Redirect to login if not authenticated
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // For static required role (e.g. /admin/barbers), show 404 if wrong role
  if (role && !isFetchingProfile && user && user.role !== role) {
    return <NotFound />;
  }

  // Every verified client gets a useful profile before entering the portal.
  // This also upgrades older phone-only accounts the next time they return.
  if (
    !isFetchingProfile &&
    user?.role === 'CLIENT' &&
    profile &&
    (!profile.name?.trim() || !profile.surname?.trim()) &&
    location.pathname !== '/client/welcome'
  ) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/client/welcome?next=${encodeURIComponent(next)}`} replace />;
  }

  // For dynamic :role routes, redirect to correct role path if role in URL doesn't match real role
  if (urlRole && !isFetchingProfile && user && urlRole.toLowerCase() !== user.role.toLowerCase()) {
    const pathParts = window.location.pathname.split('/').slice(2); // skip '',':role'
    return <Navigate to={`/${user.role.toLowerCase()}/${pathParts.join('/')}`} replace />;
  }

  return children;
}
export default ProtectedRoute;
