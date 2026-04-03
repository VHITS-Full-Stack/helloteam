import { Plus } from 'lucide-react';
import Button from './Button';

const AddButton = ({ onClick, disabled = false, loading = false, children = 'Add' }) => {
  return (
    <Button
      variant="primary"
      size="sm"
      icon={Plus}
      onClick={onClick}
      disabled={disabled}
      loading={loading}
    >
      {children}
    </Button>
  );
};

export default AddButton;
