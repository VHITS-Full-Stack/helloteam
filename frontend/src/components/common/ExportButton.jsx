import { Download, Loader2 } from 'lucide-react';
import Button from './Button';

const ExportButton = ({ onClick, loading = false, disabled = false, children = 'Export CSV' }) => {
  return (
    <Button
      variant="outline"
      size="sm"
      icon={loading ? Loader2 : Download}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? 'Exporting...' : children}
    </Button>
  );
};

export default ExportButton;
