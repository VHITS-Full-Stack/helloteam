import { ArrowLeft } from 'lucide-react';
import { Avatar } from '../common';

const ChatHeader = ({ participant, isOnline, onBack }) => {
  return (
    <div className="h-16 px-4 flex items-center gap-3 border-b border-gray-100 bg-white flex-shrink-0">
      {onBack && (
        <button
          onClick={onBack}
          className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}
      <Avatar
        name={participant?.name}
        src={participant?.profilePhoto}
        size="md"
        status={isOnline ? 'online' : 'offline'}
      />
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 truncate">
          {participant?.name || 'Unknown'}
        </h3>
        <p className="text-xs text-gray-500">
          {isOnline ? 'Online' : 'Offline'}
        </p>
      </div>
    </div>
  );
};

export default ChatHeader;
