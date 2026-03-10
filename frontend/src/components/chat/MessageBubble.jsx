import { useState, useRef } from 'react';
import { Play, Pause, Download, FileText, Image } from 'lucide-react';

const AudioPlayer = ({ src, duration }) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const pct = (audioRef.current.currentTime / audioRef.current.duration) * 100;
    setProgress(pct);
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleEnded = () => {
    setPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        preload="metadata"
      />
      <button
        onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 hover:bg-white/30 transition-colors"
      >
        {playing ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" />
        )}
      </button>
      <div className="flex-1">
        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/60 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[10px] opacity-70 mt-0.5 block">
          {playing ? formatDuration(currentTime) : formatDuration(duration || 0)}
        </span>
      </div>
    </div>
  );
};

const MessageBubble = ({ message, isMine, senderName }) => {
  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const renderContent = () => {
    switch (message.messageType) {
      case 'AUDIO':
        return (
          <AudioPlayer src={message.fileUrl} duration={message.audioDuration} />
        );

      case 'IMAGE':
        return (
          <div className="space-y-1.5">
            <a
              href={message.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl overflow-hidden border border-gray-200 shadow-sm"
            >
              <img
                src={message.fileUrl}
                alt={message.fileName || 'Image'}
                className="w-full h-auto max-h-[300px] object-contain bg-gray-50"
                loading="lazy"
              />
            </a>
            {message.content && (
              <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>
        );

      case 'FILE':
      case 'VIDEO':
        return (
          <a
            href={message.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 shadow-sm transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-[#1a5c3a]/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-[#1a5c3a]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{message.fileName || 'File'}</p>
              <p className="text-xs text-gray-400">{formatFileSize(message.fileSize)}</p>
            </div>
            <Download className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </a>
        );

      default:
        return (
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        );
    }
  };

  const displayName = isMine ? 'You' : (senderName || 'Unknown');
  const isMedia = message.messageType === 'IMAGE' || message.messageType === 'FILE' || message.messageType === 'VIDEO';

  return (
    <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} mb-4`}>
      {isMedia ? (
        <div className="max-w-[65%]">
          {renderContent()}
        </div>
      ) : (
        <div
          className={`
            max-w-[65%] px-4 py-2.5 rounded-2xl
            ${isMine
              ? 'bg-[#1a5c3a] text-white rounded-br-md'
              : 'bg-gray-100 text-gray-900 rounded-bl-md'
            }
          `}
        >
          {renderContent()}
        </div>
      )}
      <p className={`text-xs text-gray-400 mt-1 ${isMine ? 'text-right' : 'text-left'}`}>
        {displayName} &middot; {formatTime(message.createdAt)}
      </p>
    </div>
  );
};

export default MessageBubble;
