import { useState, useRef, useCallback } from 'react';
import { Mic, Square, Send, X } from 'lucide-react';

const AudioRecorder = ({ onSend, onCancel }) => {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg',
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);
      setRecording(true);
      setDuration(0);
      startTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Could not access microphone. Please check permissions.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [recording]);

  const handleSend = useCallback(() => {
    if (audioBlob) {
      const file = new File([audioBlob], `voice-note-${Date.now()}.webm`, {
        type: audioBlob.type,
      });
      onSend(file, duration);
      setAudioBlob(null);
      setDuration(0);
    }
  }, [audioBlob, duration, onSend]);

  const handleCancel = useCallback(() => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    setAudioBlob(null);
    setDuration(0);
    onCancel();
  }, [recording, onCancel]);

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Not started yet - show mic button
  if (!recording && !audioBlob) {
    return (
      <button
        onClick={startRecording}
        className="p-2.5 text-gray-500 hover:text-primary hover:bg-primary-50 rounded-xl transition-colors"
        title="Record voice note"
      >
        <Mic className="w-5 h-5" />
      </button>
    );
  }

  // Recording in progress or review
  return (
    <div className="flex items-center gap-2 flex-1 bg-red-50 rounded-xl px-3 py-2">
      {recording ? (
        <>
          <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-red-600 flex-1">
            Recording {formatDuration(duration)}
          </span>
          <button
            onClick={stopRecording}
            className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
            title="Stop recording"
          >
            <Square className="w-4 h-4" />
          </button>
        </>
      ) : (
        <>
          <span className="text-sm font-medium text-gray-600 flex-1">
            Voice note ({formatDuration(duration)})
          </span>
          <button
            onClick={handleCancel}
            className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
            title="Discard"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={handleSend}
            className="p-1.5 text-primary hover:bg-primary-50 rounded-lg transition-colors"
            title="Send voice note"
          >
            <Send className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
};

export default AudioRecorder;
