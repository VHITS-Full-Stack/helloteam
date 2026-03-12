import { useState } from 'react';
import { Search, Plus, MessageCircle } from 'lucide-react';
import { Avatar } from '../common';

const ConversationList = ({
  conversations,
  contacts,
  selectedId,
  onSelect,
  onNewConversation,
  isUserOnline,
  loading,
}) => {
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);

  const filtered = conversations.filter((conv) =>
    conv.participant?.name?.toLowerCase().includes(search.toLowerCase())
  );

  // Available contacts that don't have a conversation yet
  const availableContacts = (contacts || []).filter(
    (contact) => !conversations.some((conv) => conv.participant?.id === contact.id)
  );

  const filteredContacts = availableContacts.filter((contact) =>
    contact.name?.toLowerCase().includes(search.toLowerCase())
  );

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / 86400000);

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (days === 1) return 'Yesterday';
    if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getLastMessagePreview = (conv) => {
    const msg = conv.messages?.[0];
    if (!msg) return 'No messages yet';
    if (msg.messageType === 'AUDIO') return 'Voice note';
    if (msg.messageType === 'IMAGE') return 'Photo';
    if (msg.messageType === 'FILE' || msg.messageType === 'VIDEO') return msg.fileName || 'Attachment';
    return msg.content || '';
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Messages</h2>
          {availableContacts.length > 0 && (
            <button
              onClick={() => setShowNewChat(!showNewChat)}
              className="p-2 text-gray-500 hover:text-primary hover:bg-primary-50 rounded-xl transition-colors"
              title="New conversation"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* New chat contacts dropdown */}
      {showNewChat && availableContacts.length > 0 && (
        <div className="border-b border-gray-100 bg-primary-50/30 max-h-48 overflow-y-auto">
          <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Start new conversation
          </p>
          {availableContacts.map((contact) => (
            <button
              key={contact.id}
              onClick={() => {
                onNewConversation(contact);
                setShowNewChat(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary-50 transition-colors"
            >
              <Avatar
                name={contact.name}
                src={contact.profilePhoto}
                size="sm"
                status={isUserOnline?.(contact.userId) ? 'online' : undefined}
              />
              <span className="text-sm font-medium text-gray-700">{contact.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 && filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MessageCircle className="w-10 h-10 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">
              {search ? 'No conversations match your search' : 'No conversations yet'}
            </p>
          </div>
        ) : (
          <>
            {filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 transition-colors border-b border-gray-50
                  ${selectedId === conv.id
                    ? 'bg-primary-50 border-l-3 border-l-primary'
                    : 'hover:bg-gray-50'
                  }
                `}
              >
                <Avatar
                  name={conv.participant?.name}
                  src={conv.participant?.profilePhoto}
                  size="md"
                  status={isUserOnline?.(conv.participant?.userId) ? 'online' : undefined}
                />
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-gray-900 truncate">
                      {conv.participant?.name}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                      {formatTime(conv.messages?.[0]?.createdAt || conv.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-gray-500 truncate">
                      {getLastMessagePreview(conv)}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="ml-2 flex-shrink-0 w-5 h-5 bg-primary text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}

            {/* Available contacts shown by default */}
            {filteredContacts.length > 0 && (
              <>
                <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  New conversation
                </p>
                {filteredContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => onNewConversation(contact)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary-50 transition-colors border-b border-gray-50"
                  >
                    <Avatar
                      name={contact.name}
                      src={contact.profilePhoto}
                      size="md"
                      status={isUserOnline?.(contact.userId) ? 'online' : undefined}
                    />
                    <div className="flex-1 min-w-0 text-left">
                      <span className="font-semibold text-sm text-gray-900 truncate block">
                        {contact.name}
                      </span>
                      <p className="text-xs text-gray-400">Tap to start chatting</p>
                    </div>
                  </button>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ConversationList;
