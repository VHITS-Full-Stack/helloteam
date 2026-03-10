import { ArrowLeft, Phone, Video } from 'lucide-react';
import { Avatar } from '../common';

const ChatHeader = ({ participant, isOnline, onBack }) => {
  return (
    <div className="h-16 px-4 flex items-center gap-3 bg-[#1a5c3a] text-white flex-shrink-0">
      {onBack && (
        <button
          onClick={onBack}
          className="lg:hidden p-2 -ml-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}
      <Avatar
        name={participant?.name}
        src={participant?.profilePhoto}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-white truncate">
          {participant?.name || 'Unknown'}
        </h3>
        <div className="flex items-center gap-1.5">
          {isOnline && (
            <span className="w-2 h-2 bg-green-400 rounded-full" />
          )}
          <p className="text-xs text-white/70">
            {isOnline ? 'Working now' : 'Offline'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button className="p-2.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
          <Phone className="w-5 h-5" />
          <span className="sr-only">Call</span>
        </button>
        <button className="p-2.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
          <Video className="w-5 h-5" />
          <span className="sr-only">Video</span>
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
