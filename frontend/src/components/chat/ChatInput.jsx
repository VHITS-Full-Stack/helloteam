import { useState, useRef, useCallback } from 'react';
import { Paperclip, Send, Image, X } from 'lucide-react';
import AudioRecorder from './AudioRecorder';

const ChatInput = ({ onSendText, onSendFile, onSendAudio, onTyping, disabled }) => {
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [showRecorder, setShowRecorder] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const handleTextChange = (e) => {
    setText(e.target.value);

    // Emit typing event (debounced)
    if (onTyping) {
      onTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => onTyping(false), 2000);
    }
  };

  const handleSendText = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      await onSendText(trimmed);
      setText('');
      if (onTyping) onTyping(false);
    } finally {
      setSending(false);
    }
  }, [text, sending, onSendText, onTyping]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (selectedFile) {
        handleSendFile();
      } else {
        handleSendText();
      }
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendFile = useCallback(async () => {
    if (!selectedFile || sending) return;

    setSending(true);
    try {
      const messageType = selectedFile.type.startsWith('image/')
        ? 'IMAGE'
        : selectedFile.type.startsWith('video/')
          ? 'VIDEO'
          : 'FILE';

      await onSendFile(selectedFile, messageType, text.trim() || undefined);
      clearFile();
      setText('');
    } finally {
      setSending(false);
    }
  }, [selectedFile, sending, text, onSendFile]);

  const handleSendAudio = useCallback(async (file, duration) => {
    setSending(true);
    try {
      await onSendAudio(file, duration);
      setShowRecorder(false);
    } finally {
      setSending(false);
    }
  }, [onSendAudio]);

  // If recorder is active, show that instead
  if (showRecorder) {
    return (
      <div className="px-4 py-3 border-t border-gray-100 bg-white flex-shrink-0">
        <AudioRecorder
          onSend={handleSendAudio}
          onCancel={() => setShowRecorder(false)}
        />
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100 bg-white flex-shrink-0">
      {/* File preview */}
      {selectedFile && (
        <div className="px-4 pt-3 flex items-center gap-2">
          {filePreview ? (
            <img src={filePreview} alt="" className="w-16 h-16 rounded-lg object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
              <span className="text-xs text-gray-500 font-medium">
                {selectedFile.name.split('.').pop()?.toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700 truncate">{selectedFile.name}</p>
            <p className="text-xs text-gray-400">
              {(selectedFile.size / 1024).toFixed(0)} KB
            </p>
          </div>
          <button
            onClick={clearFile}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input row */}
      <div className="px-4 py-3 flex items-end gap-2">
        {/* Attachment button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 text-gray-500 hover:text-primary hover:bg-primary-50 rounded-xl transition-colors flex-shrink-0"
          title="Attach file"
          disabled={disabled}
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        />

        {/* Voice note */}
        <AudioRecorder
          onSend={handleSendAudio}
          onCancel={() => setShowRecorder(false)}
        />

        {/* Text input */}
        <textarea
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors max-h-24 overflow-y-auto"
          style={{ minHeight: '42px' }}
        />

        {/* Send button */}
        <button
          onClick={selectedFile ? handleSendFile : handleSendText}
          disabled={(!text.trim() && !selectedFile) || sending || disabled}
          className={`
            p-2.5 rounded-xl transition-all flex-shrink-0
            ${(text.trim() || selectedFile) && !sending
              ? 'bg-primary text-white hover:bg-primary-dark shadow-sm'
              : 'text-gray-400 bg-gray-100 cursor-not-allowed'
            }
          `}
          title="Send"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
