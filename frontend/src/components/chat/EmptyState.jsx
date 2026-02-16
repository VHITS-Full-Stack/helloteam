import { MessageCircle } from 'lucide-react';

const EmptyState = ({ hasConversations = false }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <MessageCircle className="w-10 h-10 text-gray-300" />
      </div>
      <h3 className="text-lg font-semibold text-gray-500 mb-1">
        {hasConversations ? 'Select a conversation' : 'No conversations yet'}
      </h3>
      <p className="text-sm text-gray-400 text-center max-w-xs">
        {hasConversations
          ? 'Choose a conversation from the list to start chatting'
          : 'Start a new conversation with your assigned contacts'
        }
      </p>
    </div>
  );
};

export default EmptyState;
