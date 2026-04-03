import { RefreshCw } from 'lucide-react';
import Button from './Button';

const RefreshButton = ({ onClick, loading = false, disabled = false }) => {
  return (
    <Button
      variant="outline"
      size="sm"
      icon={RefreshCw}
      onClick={onClick}
      disabled={disabled || loading}
      loading={loading}
    >
      Refresh
    </Button>
  );
};

export default RefreshButton;
