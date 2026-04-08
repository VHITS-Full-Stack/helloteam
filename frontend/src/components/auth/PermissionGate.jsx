import { usePermissions } from '../../hooks/usePermissions';

/**
 * PermissionGate - A component that conditionally renders its children
 * based on the user's permissions.
 *
 * Usage:
 * <PermissionGate permission="employees.create">
 *   <Button>Add Employee</Button>
 * </PermissionGate>
 *
 * <PermissionGate permissions={["employees.edit", "employees.delete"]} requireAll={false}>
 *   <Button>Edit or Delete</Button>
 * </PermissionGate>
 *
 * <PermissionGate permission="employees.delete" fallback={<span>No access</span>}>
 *   <Button>Delete</Button>
 * </PermissionGate>
 */

const PermissionGate = ({
  children,
  permission,
  permissions = [],
  requireAll = false,
  fallback = null,
  showDisabled = false,
  disabledMessage = 'You do not have permission to perform this action',
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = usePermissions();

  // While loading, optionally show nothing or a placeholder
  if (loading) {
    return fallback;
  }

  // Single permission check
  if (permission) {
    const hasAccess = hasPermission(permission);

    if (hasAccess) {
      return children;
    }

    // Show disabled version if requested
    if (showDisabled && children) {
      return (
        <div className="opacity-50 cursor-not-allowed" title={disabledMessage}>
          <div className="pointer-events-none">{children}</div>
        </div>
      );
    }

    return fallback;
  }

  // Multiple permissions check
  if (permissions.length > 0) {
    const hasAccess = requireAll
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);

    if (hasAccess) {
      return children;
    }

    // Show disabled version if requested
    if (showDisabled && children) {
      return (
        <div className="opacity-50 cursor-not-allowed" title={disabledMessage}>
          <div className="pointer-events-none">{children}</div>
        </div>
      );
    }

    return fallback;
  }

  // No permission specified, render children
  return children;
};

export default PermissionGate;
