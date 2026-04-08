import PermissionGate from './PermissionGate';

export const withPermission = (Component, permission, options = {}) => {
  return function PermissionWrappedComponent(props) {
    return (
      <PermissionGate permission={permission} {...options}>
        <Component {...props} />
      </PermissionGate>
    );
  };
};

