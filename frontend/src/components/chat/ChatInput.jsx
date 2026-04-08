import { useState, useRef, useCallback } from 'react';
import { Paperclip, Send, X, Loader2 } from 'lucide-react';
import AudioRecorder from './AudioRecorder';

const FilePreviewItem = ({ file, preview, onRemove, disabled }) => {
  return (
    <div className="relative group flex-shrink-0">
      {preview ? (
        <img src={preview} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
      ) : file.type.startsWith('video/') ? (
        <div className="w-16 h-16 rounded-lg bg-[#1a5c3a]/10 border border-gray-200 flex flex-col items-center justify-center">
          <svg className="w-5 h-5 text-[#1a5c3a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[9px] text-gray-500 mt-0.5 truncate max-w-[56px] px-1">{file.name.split('.').pop()?.toUpperCase()}</span>
        </div>
      ) : (
        <div className="w-16 h-16 rounded-lg bg-gray-100 border border-gray-200 flex flex-col items-center justify-center">
          <span className="text-xs text-gray-500 font-bold">
            {file.name.split('.').pop()?.toUpperCase()}
          </span>
          <span className="text-[9px] text-gray-400 mt-0.5 truncate max-w-[56px] px-1">{file.name}</span>
        </div>
      )}
      {!disabled && (
        <button
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

const ChatInput = ({ onSendText, onSendFile, onSendAudio, onTyping, disabled, participantName }) => {
  const [text, setText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [showRecorder, setShowRecorder] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const handleTextChange = (e) => {
    setText(e.target.value);

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
      if (selectedFiles.length > 0) {
        handleSendFiles();
      } else {
        handleSendText();
      }
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setSelectedFiles((prev) => [...prev, ...files]);

    files.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setFilePreviews((prev) => [...prev, { name: file.name, preview: ev.target.result }]);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreviews((prev) => [...prev, { name: file.name, preview: null }]);
      }
    });

    // Reset input so the same file(s) can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    setFilePreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendFiles = useCallback(async () => {
    if (selectedFiles.length === 0 || sending) return;

    setSending(true);
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const messageType = file.type.startsWith('image/')
          ? 'IMAGE'
          : file.type.startsWith('video/')
            ? 'VIDEO'
            : 'FILE';

        // Only send caption with the first file
        const caption = i === 0 ? (text.trim() || undefined) : undefined;
        await onSendFile(file, messageType, caption);
      }
    } catch (err) {
      console.error('Failed to send file:', err);
    } finally {
      clearFiles();
      setText('');
      setSending(false);
    }
  }, [selectedFiles, sending, text, onSendFile]);

  const handleSendAudio = useCallback(async (file, duration) => {
    setSending(true);
    try {
      await onSendAudio(file, duration);
      setShowRecorder(false);
    } finally {
      setSending(false);
    }
  }, [onSendAudio]);

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

  const placeholder = participantName ? `Message ${participantName}...` : 'Type a message...';

  return (
    <div className="border-t border-gray-200 bg-white flex-shrink-0">
      {/* File previews */}
      {selectedFiles.length > 0 && (
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0 pb-1">
              {selectedFiles.map((file, index) => (
                <FilePreviewItem
                  key={`${file.name}-${file.lastModified}-${file.size}`}
                  file={file}
                  preview={filePreviews[index]?.preview}
                  onRemove={() => removeFile(index)}
                  disabled={sending}
                />
              ))}
              {!sending && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-500 hover:border-gray-400 transition-colors flex-shrink-0"
                  title="Add more files"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              {sending ? (
                <Loader2 className="w-5 h-5 text-[#1a5c3a] animate-spin" />
              ) : (
                <>
                  <button
                    onClick={handleSendFiles}
                    disabled={disabled}
                    className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#1a5c3a] text-white hover:bg-[#15472e] shadow-sm transition-all disabled:opacity-50"
                  >
                    Send {selectedFiles.length > 1 ? `(${selectedFiles.length})` : ''}
                  </button>
                  <button
                    onClick={clearFiles}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Clear all
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Input row */}
      <div className="px-5 py-4 flex items-end gap-3">
        {/* Attachment button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors flex-shrink-0"
          title="Attach file"
          disabled={disabled || sending}
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
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
        <div className="flex-1">
          <textarea
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full resize-none px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a5c3a]/20 focus:border-[#1a5c3a] transition-colors max-h-24 overflow-y-auto"
            style={{ minHeight: '42px' }}
          />
        </div>

        {/* Send button - only show when no files are selected (file preview has its own Send) */}
        {selectedFiles.length === 0 && (
          <button
            onClick={handleSendText}
            disabled={!text.trim() || sending || disabled}
            className={`
              px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0
              ${text.trim() && !sending
                ? 'bg-[#1a5c3a] text-white hover:bg-[#15472e] shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }
            `}
            title="Send"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatInput;
