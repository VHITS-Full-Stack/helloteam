import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import permissionsService from '../services/permissions.service';

// Module-level promise deduplication so multiple hook instances share one API call
let activePermissionsFetch = null;

/**
 * Custom hook for permission-based access control
 * Fetches user permissions from the API and provides helper functions
 * to check permissions throughout the application
 */
export const usePermissions = () => {
  const { user, isAuthenticated } = useAuth();
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch permissions when user is authenticated
  useEffect(() => {
    const fetchPermissions = async () => {
      if (!isAuthenticated || !user) {
        setPermissions([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Reuse in-flight request if one exists
        if (!activePermissionsFetch) {
          activePermissionsFetch = permissionsService.getMyPermissions();
        }
        const response = await activePermissionsFetch;

        if (response.success) {
          setPermissions(response.data.permissions || []);
        } else {
          setError(response.error || 'Failed to fetch permissions');
          setPermissions([]);
        }
      } catch (err) {
        console.error('Error fetching permissions:', err);
        setError(err.error || 'Failed to fetch permissions');
        setPermissions([]);
      } finally {
        setLoading(false);
        activePermissionsFetch = null;
      }
    };

    fetchPermissions();
  }, [isAuthenticated, user?.id]);

  // Check if user has a specific permission
  const hasPermission = useCallback(
    (permission) => {
      if (!permission) return true;
      return permissions.includes(permission);
    },
    [permissions]
  );

  // Check if user has any of the given permissions
  const hasAnyPermission = useCallback(
    (permissionList) => {
      if (!permissionList || permissionList.length === 0) return true;
      return permissionList.some((p) => permissions.includes(p));
    },
    [permissions]
  );

  // Check if user has all of the given permissions
  const hasAllPermissions = useCallback(
    (permissionList) => {
      if (!permissionList || permissionList.length === 0) return true;
      return permissionList.every((p) => permissions.includes(p));
    },
    [permissions]
  );

  // Check if user can perform CRUD operations on a resource
  const canView = useCallback(
    (resource) => hasPermission(`${resource}.view`),
    [hasPermission]
  );

  const canCreate = useCallback(
    (resource) => hasPermission(`${resource}.create`),
    [hasPermission]
  );

  const canEdit = useCallback(
    (resource) => hasPermission(`${resource}.edit`),
    [hasPermission]
  );

  const canDelete = useCallback(
    (resource) => hasPermission(`${resource}.delete`),
    [hasPermission]
  );

  // Memoized role check
  const role = useMemo(() => user?.role, [user?.role]);

  const isSuperAdmin = useMemo(() => role === 'SUPER_ADMIN', [role]);
  const isAdmin = useMemo(
    () => ['SUPER_ADMIN', 'ADMIN'].includes(role),
    [role]
  );
  const isAdminRole = useMemo(
    () =>
      ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'HR', 'FINANCE', 'SUPPORT'].includes(
        role
      ),
    [role]
  );

  // Refresh permissions
  const refreshPermissions = useCallback(async () => {
    if (!isAuthenticated || !user) return;

    try {
      setLoading(true);
      activePermissionsFetch = null; // Clear cached promise to force fresh fetch
      const response = await permissionsService.getMyPermissions();
      if (response.success) {
        setPermissions(response.data.permissions || []);
      }
    } catch (err) {
      console.error('Error refreshing permissions:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  return {
    permissions,
    loading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canView,
    canCreate,
    canEdit,
    canDelete,
    role,
    isSuperAdmin,
    isAdmin,
    isAdminRole,
    refreshPermissions,
  };
};

export default usePermissions;
