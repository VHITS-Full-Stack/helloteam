import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import chatService from '../../services/chat.service';
import ConversationList from '../../components/chat/ConversationList';
import ChatHeader from '../../components/chat/ChatHeader';
import MessageBubble from '../../components/chat/MessageBubble';
import ChatInput from '../../components/chat/ChatInput';
import EmptyState from '../../components/chat/EmptyState';

const ClientChat = () => {
  const { user } = useAuth();
  const { socket, isUserOnline } = useSocket() || {};
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [typingUser, setTypingUser] = useState(null);
  const [showMobileList, setShowMobileList] = useState(true);
  const [messagesError, setMessagesError] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Fetch conversations and contacts
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [convRes, contactRes] = await Promise.all([
          chatService.getConversations(),
          chatService.getContacts(),
        ]);
        if (convRes.success) setConversations(convRes.data);
        if (contactRes.success) setContacts(contactRes.data);
      } catch (err) {
        console.error('Failed to load chat data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch messages when selecting a conversation
  const fetchMessages = useCallback(async (conversationId, cursor = null) => {
    try {
      if (!cursor) {
        setMessagesLoading(true);
        setMessagesError(null);
      }
      const res = await chatService.getMessages(conversationId, cursor);
      if (res.success) {
        if (cursor) {
          setMessages((prev) => [...res.data.messages, ...prev]);
        } else {
          setMessages(res.data.messages);
        }
        setHasMore(res.data.hasMore);
        setNextCursor(res.data.nextCursor);
      } else {
        if (!cursor) setMessagesError(res.error || 'Failed to load messages');
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
      if (!cursor) setMessagesError(err.message || 'Failed to load messages');
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // Select conversation
  const handleSelectConversation = useCallback((conv) => {
    setSelectedConversation(conv);
    setMessages([]);
    setShowMobileList(false);
    fetchMessages(conv.id);

    // Mark messages as read
    if (socket && conv.participant?.userId) {
      socket.emit('chat:mark_read', {
        conversationId: conv.id,
        senderUserId: conv.participant.userId,
      });
    }

    // Reset unread count locally
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
    );
  }, [socket, fetchMessages]);

  // Start new conversation
  const handleNewConversation = useCallback(async (contact) => {
    try {
      const res = await chatService.createConversation(user.client.id, contact.id);
      if (res.success) {
        const conv = {
          ...res.data,
          messages: [],
          unreadCount: 0,
          participant: {
            id: contact.id,
            name: contact.name,
            profilePhoto: contact.profilePhoto,
            userId: contact.userId,
            phone: contact.phone,
          },
        };

        setConversations((prev) => {
          const exists = prev.find((c) => c.id === conv.id);
          if (exists) return prev;
          return [conv, ...prev];
        });

        handleSelectConversation(conv);
      }
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  }, [user, handleSelectConversation]);

  // Send text message via socket
  const handleSendText = useCallback(async (content) => {
    if (!selectedConversation || !socket) return;

    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      id: tempId,
      tempId,
      conversationId: selectedConversation.id,
      senderUserId: user.id,
      content,
      messageType: 'TEXT',
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    // Optimistic update
    setMessages((prev) => [...prev, tempMessage]);
    scrollToBottom();

    socket.emit('chat:send_message', {
      conversationId: selectedConversation.id,
      content,
      recipientUserId: selectedConversation.participant?.userId,
      tempId,
    });

    // Update conversation list
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === selectedConversation.id
          ? { ...c, messages: [tempMessage], lastMessageAt: new Date().toISOString() }
          : c
      );
      return updated.sort((a, b) =>
        new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
      );
    });
  }, [selectedConversation, socket, user]);

  // Send file via REST
  const handleSendFile = useCallback(async (file, messageType, caption) => {
    if (!selectedConversation) return;

    try {
      const res = await chatService.sendMessage(selectedConversation.id, {
        content: caption,
        messageType,
        file,
      });
      if (res.success) {
        setMessages((prev) => [...prev, res.data]);
        scrollToBottom();

        setConversations((prev) => {
          const updated = prev.map((c) =>
            c.id === selectedConversation.id
              ? { ...c, messages: [res.data], lastMessageAt: new Date().toISOString() }
              : c
          );
          return updated.sort((a, b) =>
            new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
          );
        });
      }
    } catch (err) {
      console.error('Failed to send file:', err);
    }
  }, [selectedConversation]);

  // Send audio via REST
  const handleSendAudio = useCallback(async (file, duration) => {
    if (!selectedConversation) return;

    try {
      const res = await chatService.sendMessage(selectedConversation.id, {
        messageType: 'AUDIO',
        file,
        audioDuration: duration,
      });
      if (res.success) {
        setMessages((prev) => [...prev, res.data]);
        scrollToBottom();
      }
    } catch (err) {
      console.error('Failed to send audio:', err);
    }
  }, [selectedConversation]);

  // Handle typing indicators
  const handleTyping = useCallback((isTyping) => {
    if (!selectedConversation || !socket) return;
    const event = isTyping ? 'chat:typing' : 'chat:stop_typing';
    socket.emit(event, {
      conversationId: selectedConversation.id,
      recipientUserId: selectedConversation.participant?.userId,
    });
  }, [selectedConversation, socket]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      // If in current conversation, add message
      if (selectedConversation && message.conversationId === selectedConversation.id) {
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
        scrollToBottom();

        // Mark as read
        socket.emit('chat:mark_read', {
          conversationId: message.conversationId,
          senderUserId: message.senderUserId,
        });
      } else {
        // Increment unread count
        setConversations((prev) =>
          prev.map((c) =>
            c.id === message.conversationId
              ? { ...c, unreadCount: (c.unreadCount || 0) + 1, messages: [message], lastMessageAt: message.createdAt }
              : c
          )
        );
      }

      // Update conversation order
      setConversations((prev) =>
        [...prev].sort((a, b) =>
          new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
        )
      );
    };

    const handleMessageSent = (message) => {
      // Replace temp message with confirmed message
      setMessages((prev) =>
        prev.map((m) => (m.tempId && m.tempId === message.tempId ? message : m))
      );
    };

    const handleMessagesRead = ({ conversationId }) => {
      if (selectedConversation?.id === conversationId) {
        setMessages((prev) =>
          prev.map((m) => (m.senderUserId === user.id ? { ...m, isRead: true } : m))
        );
      }
    };

    const handleTypingEvent = ({ conversationId, userId }) => {
      if (selectedConversation?.id === conversationId) {
        setTypingUser(userId);
      }
    };

    const handleStopTyping = ({ conversationId }) => {
      if (selectedConversation?.id === conversationId) {
        setTypingUser(null);
      }
    };

    socket.on('chat:new_message', handleNewMessage);
    socket.on('chat:message_sent', handleMessageSent);
    socket.on('chat:messages_read', handleMessagesRead);
    socket.on('chat:typing', handleTypingEvent);
    socket.on('chat:stop_typing', handleStopTyping);

    return () => {
      socket.off('chat:new_message', handleNewMessage);
      socket.off('chat:message_sent', handleMessageSent);
      socket.off('chat:messages_read', handleMessagesRead);
      socket.off('chat:typing', handleTypingEvent);
      socket.off('chat:stop_typing', handleStopTyping);
    };
  }, [socket, selectedConversation, user]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0 && !messagesLoading) {
      scrollToBottom();
    }
  }, [messages.length, messagesLoading]);

  // Load older messages on scroll to top
  const handleScroll = () => {
    if (!messagesContainerRef.current || !hasMore || messagesLoading) return;
    if (messagesContainerRef.current.scrollTop < 50 && nextCursor) {
      fetchMessages(selectedConversation.id, nextCursor);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Conversation List */}
      <div className={`w-80 flex-shrink-0 ${showMobileList ? 'block' : 'hidden'} lg:block`}>
        <ConversationList
          conversations={conversations}
          contacts={contacts}
          selectedId={selectedConversation?.id}
          onSelect={handleSelectConversation}
          onNewConversation={handleNewConversation}
          isUserOnline={isUserOnline}
          loading={loading}
        />
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col min-w-0 min-h-0 ${!showMobileList ? 'flex' : 'hidden'} lg:flex`}>
        {selectedConversation ? (
          <div className="flex flex-col h-full min-h-0">
            <ChatHeader
              participant={selectedConversation.participant}
              isOnline={isUserOnline?.(selectedConversation.participant?.userId)}
              onBack={() => setShowMobileList(true)}
            />

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto px-6 py-4 bg-white min-h-0"
              onScroll={handleScroll}
            >
              {messagesLoading && messages.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messagesError ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-red-500 mb-2">{messagesError}</p>
                  <button
                    onClick={() => fetchMessages(selectedConversation.id)}
                    className="text-sm text-primary font-medium hover:text-primary-dark"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  {hasMore && (
                    <div className="text-center py-2">
                      <button
                        onClick={() => fetchMessages(selectedConversation.id, nextCursor)}
                        className="text-xs text-primary hover:text-primary-dark font-medium"
                      >
                        Load older messages
                      </button>
                    </div>
                  )}
                  {messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isMine={msg.senderUserId === user.id}
                      senderName={selectedConversation.participant?.name}
                    />
                  ))}
                  {typingUser && (
                    <div className="flex items-center gap-1 px-3 py-1 text-xs text-gray-400">
                      <span className="flex gap-0.5">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                      <span className="ml-1">typing...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <ChatInput
              onSendText={handleSendText}
              onSendFile={handleSendFile}
              onSendAudio={handleSendAudio}
              onTyping={handleTyping}
              participantName={selectedConversation.participant?.name?.split(' ')[0]}
            />
          </div>
        ) : (
          <EmptyState hasConversations={conversations.length > 0} />
        )}
      </div>
    </div>
  );
};

export default ClientChat;
