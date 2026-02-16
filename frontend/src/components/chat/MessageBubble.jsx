import { useState, useRef } from 'react';
import { Play, Pause, Download, FileText, Image, Check, CheckCheck } from 'lucide-react';

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

const MessageBubble = ({ message, isMine }) => {
  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
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
          <div className="space-y-1">
            <a
              href={message.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg overflow-hidden max-w-[280px]"
            >
              <img
                src={message.fileUrl}
                alt={message.fileName || 'Image'}
                className="w-full h-auto max-h-[300px] object-cover"
                loading="lazy"
              />
            </a>
            {message.content && (
              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
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
            className={`flex items-center gap-2 p-2 rounded-lg ${
              isMine ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'
            } transition-colors`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isMine ? 'bg-white/20' : 'bg-gray-200'
            }`}>
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{message.fileName || 'File'}</p>
              <p className="text-[10px] opacity-70">{formatFileSize(message.fileSize)}</p>
            </div>
            <Download className="w-4 h-4 opacity-60 flex-shrink-0" />
          </a>
        );

      default:
        return (
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        );
    }
  };

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
      <div
        className={`
          max-w-[75%] px-3 py-2 rounded-2xl
          ${isMine
            ? 'bg-primary text-white rounded-br-md'
            : 'bg-gray-100 text-gray-900 rounded-bl-md'
          }
        `}
      >
        {renderContent()}
        <div className={`flex items-center justify-end gap-1 mt-0.5 ${
          isMine ? 'text-white/60' : 'text-gray-400'
        }`}>
          <span className="text-[10px]">{formatTime(message.createdAt)}</span>
          {isMine && (
            message.isRead ? (
              <CheckCheck className="w-3.5 h-3.5 text-blue-300" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
