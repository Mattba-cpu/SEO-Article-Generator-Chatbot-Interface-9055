import React from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const { FiUser, FiCopy, FiCheck, FiDownload, FiPlay, FiPause } = FiIcons;

const MessageBubble = ({ message, onDownload }) => {
  const [copied, setCopied] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const audioRef = React.useRef(null);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(message.duration || 0);
  const [audioUrl, setAudioUrl] = React.useState(null);

  const isUser = message.sender === 'user';
  const isAudio = message.type === 'audio';

  React.useEffect(() => {
    if (isAudio && message.audioBlob) {
      const url = URL.createObjectURL(message.audioBlob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [isAudio, message.audioBlob]);

  React.useEffect(() => {
    if (isAudio && audioRef.current && audioUrl) {
      const audio = audioRef.current;
      const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
      const handleDurationChange = () => setDuration(audio.duration);
      const handleEnded = () => setIsPlaying(false);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('durationchange', handleDurationChange);
      audio.addEventListener('ended', handleEnded);
      return () => {
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('durationchange', handleDurationChange);
        audio.removeEventListener('ended', handleEnded);
      };
    }
  }, [isAudio, audioUrl]);

  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  const copyToClipboard = async () => {
    try {
      if (isAudio) return;
      const cleanText = message.text
        .replace(/```(?:\w+)?\n?([\s\S]*?)```/g, '$1')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/<[^>]*>/g, '');
      await navigator.clipboard.writeText(cleanText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erreur copie:', err);
    }
  };

  const formatText = (text) => {
    if (!text) return '';
    return text
      .replace(
        /```(?:\w+)?\n?([\s\S]*?)```/g,
        '<pre class="bg-gray-800/50 p-3 rounded-lg my-2 overflow-x-auto text-xs"><code class="text-gray-300">$1</code></pre>'
      )
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-100 font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-gray-200">$1</em>')
      .replace(
        /`(.*?)`/g,
        '<code class="bg-gray-800/50 px-1.5 py-0.5 rounded text-xs text-olive-400">$1</code>'
      )
      .replace(/\n/g, '<br>');
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div className={`flex max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-2.5`}>
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden`}
          style={isUser ? { backgroundColor: 'rgba(92, 32, 24, 0.5)', border: '1px solid rgba(216, 90, 74, 0.3)' } : {}}
        >
          {isUser ? (
            <SafeIcon icon={FiUser} className="text-sm" style={{ color: '#E8715F' }} />
          ) : (
            <img
              src="/logo.png"
              alt="O'Live Prod"
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Message content */}
        <div className="flex flex-col gap-1">
          <div
            className={`px-4 py-3 rounded-2xl ${
              isUser
                ? 'text-white rounded-tr-sm'
                : 'bg-[#1a1a1a] text-gray-200 rounded-tl-sm'
            }`}
            style={isUser ? { backgroundColor: '#D85A4A' } : (message.isArticle ? { borderLeft: '2px solid #E8715F' } : {})}
          >
            {isAudio ? (
              <div className="flex items-center gap-3 min-w-[180px]">
                <button
                  onClick={togglePlayAudio}
                  className={`w-8 h-8 flex items-center justify-center rounded-full ${
                    isUser ? 'bg-olive-700 hover:bg-olive-700' : 'bg-[#141414] hover:bg-[#1f1f1f]'
                  } transition-colors`}
                >
                  <SafeIcon icon={isPlaying ? FiPause : FiPlay} className="text-sm" />
                </button>
                <div className="flex-1 flex items-center gap-1">
                  {Array(16)
                    .fill()
                    .map((_, i) => (
                      <div
                        key={i}
                        className={`w-1 rounded-full transition-all ${
                          (i / 16) * 100 <= progress
                            ? isUser
                              ? 'bg-white'
                              : 'bg-olive-400'
                            : isUser
                            ? 'bg-olive-400/40'
                            : 'bg-gray-600'
                        }`}
                        style={{ height: `${Math.random() * 12 + 4}px` }}
                      />
                    ))}
                </div>
                <span className="text-xs opacity-70">{formatTime(isPlaying ? currentTime : duration)}</span>
                {audioUrl && <audio ref={audioRef} src={audioUrl} className="hidden" />}
              </div>
            ) : (
              <div
                className="text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: formatText(message.text) }}
              />
            )}
          </div>

          {/* Actions */}
          <div className={`flex items-center gap-2 px-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-gray-500">
              {format(message.timestamp, 'HH:mm', { locale: fr })}
            </span>
            {!isUser && !isAudio && (
              <div className="flex gap-0.5">
                <button
                  onClick={copyToClipboard}
                  className="p-1 hover:bg-olive-900/30 rounded transition-colors"
                >
                  <SafeIcon
                    icon={copied ? FiCheck : FiCopy}
                    className={`text-xs ${copied ? 'text-olive-400' : 'text-gray-500 hover:text-olive-400'}`}
                  />
                </button>
                <button onClick={onDownload} className="p-1 hover:bg-olive-900/30 rounded transition-colors">
                  <SafeIcon icon={FiDownload} className="text-xs text-gray-500 hover:text-olive-400" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MessageBubble;
