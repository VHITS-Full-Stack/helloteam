import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Phone, Copy, Check } from 'lucide-react';
import { Avatar } from '../common';

const ChatHeader = ({ participant, isOnline, onBack }) => {
  const [showPhone, setShowPhone] = useState(false);
  const [copied, setCopied] = useState(false);
  const phoneRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (phoneRef.current && !phoneRef.current.contains(e.target)) {
        setShowPhone(false);
      }
    };
    if (showPhone) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPhone]);

  const handleCopy = async () => {
    if (!participant?.phone) return;
    try {
      await navigator.clipboard.writeText(participant.phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = participant.phone;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
      <div className="flex items-center gap-1 relative" ref={phoneRef}>
        <button
          onClick={() => {
            setShowPhone(!showPhone);
            setCopied(false);
          }}
          className="p-2.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
        >
          <Phone className="w-5 h-5" />
          <span className="sr-only">Call</span>
        </button>

        {showPhone && (
          <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 p-3 z-50 min-w-[200px]">
            {participant?.phone ? (
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${participant.phone}`}
                  className="text-sm font-medium text-gray-900 hover:text-primary transition-colors"
                >
                  {participant.phone}
                </a>
                <button
                  onClick={handleCopy}
                  className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary-50 rounded-lg transition-colors"
                  title="Copy phone number"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No phone number available</p>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default ChatHeader;
