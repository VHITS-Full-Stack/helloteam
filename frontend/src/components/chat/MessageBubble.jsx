import { useState, useRef, useMemo } from 'react';
import { Play, Pause, Download, FileText, Image, Mic } from 'lucide-react';

// Generate pseudo-random waveform bars from a seed (consistent per message)
const generateWaveform = (seed, barCount = 40) => {
  let hash = 0;
  const str = String(seed || 'default');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const bars = [];
  for (let i = 0; i < barCount; i++) {
    hash = ((hash << 5) - hash) + i;
    hash |= 0;
    const normalized = (Math.abs(hash) % 100) / 100;
    // Create a natural waveform shape — higher in the middle
    const positionFactor = 1 - Math.abs((i / barCount) - 0.5) * 1.2;
    bars.push(Math.max(0.15, Math.min(1, normalized * 0.6 + positionFactor * 0.4)));
  }
  return bars;
};

const AudioPlayer = ({ src, duration, isMine, messageId }) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [loaded, setLoaded] = useState(false);
  const audioRef = useRef(null);
  const waveformBars = useMemo(() => generateWaveform(messageId || src), [messageId, src]);
  const barCount = waveformBars.length;

  const togglePlay = async () => {
    if (!audioRef.current) return;

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }

    // Lazy load: set src only on first play
    if (!loaded && src) {
      setLoading(true);
      audioRef.current.src = src;
      audioRef.current.load();

      try {
        await new Promise((resolve, reject) => {
          const onCanPlay = () => { cleanup(); resolve(); };
          const onError = () => { cleanup(); reject(new Error('Failed to load')); };
          const cleanup = () => {
            audioRef.current?.removeEventListener('canplaythrough', onCanPlay);
            audioRef.current?.removeEventListener('error', onError);
          };
          audioRef.current.addEventListener('canplaythrough', onCanPlay, { once: true });
          audioRef.current.addEventListener('error', onError, { once: true });
        });
        setLoaded(true);
        setLoading(false);
        if (audioRef.current.duration && isFinite(audioRef.current.duration)) {
          setAudioDuration(audioRef.current.duration);
        }
        await audioRef.current.play();
        setPlaying(true);
      } catch (err) {
        console.error('Audio playback failed:', err);
        setLoading(false);
        // Don't permanently disable — allow retry
      }
    } else {
      try {
        await audioRef.current.play();
        setPlaying(true);
      } catch (err) {
        console.error('Audio playback failed:', err);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const dur = audioRef.current.duration;
    if (!dur || !isFinite(dur)) return;
    const pct = (audioRef.current.currentTime / dur) * 100;
    setProgress(pct);
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleEnded = () => {
    setPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };

  const handleSeek = (e) => {
    if (!audioRef.current || !audioRef.current.duration || !isFinite(audioRef.current.duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    audioRef.current.currentTime = pct * audioRef.current.duration;
  };

  const formatDuration = (seconds) => {
    if (!seconds || !isFinite(seconds) || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const playedBarIndex = Math.floor((progress / 100) * barCount);

  return (
    <div className="flex items-center gap-3 min-w-[220px] max-w-[280px]">
      {/* Audio element — no src initially, loaded on first play */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        preload="none"
      />

      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        disabled={loading}
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
          isMine
            ? 'bg-white/20 text-white hover:bg-white/30'
            : 'bg-[#1a5c3a]/10 text-[#1a5c3a] hover:bg-[#1a5c3a]/20'
        }`}
      >
        {loading ? (
          <div className={`w-4 h-4 border-2 rounded-full animate-spin ${
            isMine ? 'border-white/30 border-t-white' : 'border-[#1a5c3a]/30 border-t-[#1a5c3a]'
          }`} />
        ) : playing ? (
          <Pause className="w-4.5 h-4.5" />
        ) : (
          <Play className="w-4.5 h-4.5 ml-0.5" />
        )}
      </button>

      {/* Waveform + time */}
      <div className="flex-1 min-w-0">
        {/* Waveform bars — always visible */}
        <div
          className="flex items-center gap-[2px] h-[28px] cursor-pointer"
          onClick={handleSeek}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSeek(e);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Seek audio"
        >
          {waveformBars.map((height, i) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              className={`rounded-full transition-colors duration-150 ${
                i < playedBarIndex
                  ? isMine
                    ? 'bg-white'
                    : 'bg-[#1a5c3a]'
                  : isMine
                    ? 'bg-white/35'
                    : 'bg-[#1a5c3a]/25'
              }`}
              style={{
                width: '2.5px',
                height: `${Math.round(height * 28)}px`,
                minHeight: '4px',
              }}
            />
          ))}
        </div>

        {/* Duration */}
        <span className={`text-[10px] mt-0.5 block ${isMine ? 'text-white/60' : 'text-gray-400'}`}>
          {playing ? formatDuration(currentTime) : formatDuration(audioDuration || 0)}
        </span>
      </div>
    </div>
  );
};

const MessageBubble = ({ message, isMine, senderName }) => {
  const [imgError, setImgError] = useState(false);

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
          <AudioPlayer
            src={message.fileUrl}
            duration={message.audioDuration}
            isMine={isMine}
            messageId={message.id}
          />
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
              {imgError ? (
                <div className="flex items-center gap-3 p-3 bg-gray-50">
                  <div className="w-10 h-10 rounded-lg bg-[#1a5c3a]/10 flex items-center justify-center flex-shrink-0">
                    <Image className="w-5 h-5 text-[#1a5c3a]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{message.fileName || 'Image'}</p>
                    <p className="text-xs text-[#1a5c3a]">Click to view</p>
                  </div>
                </div>
              ) : (
                <img
                  src={message.fileUrl}
                  alt={message.fileName || 'Image'}
                  className="w-full h-auto max-h-[300px] object-contain bg-gray-50"
                  loading="lazy"
                  onError={() => setImgError(true)}
                />
              )}
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
