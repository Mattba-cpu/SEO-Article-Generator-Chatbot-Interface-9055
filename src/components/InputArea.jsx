import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import VoiceRecorder from './VoiceRecorder';

const { FiSend, FiLoader } = FiIcons;

const InputArea = ({ value, onChange, onSend, isLoading }) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (value.trim() && !isLoading) {
      onSend(value);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleVoiceRecorderOutput = (output) => {
    onSend(output);
  };

  return (
    <div className="p-4 border-t border-gray-800/30 bg-[#0a0a0a]">
      <form onSubmit={handleSubmit} className="flex items-end gap-3 max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyPress={handleKeyPress}
            placeholder="Décrivez votre prestation..."
            className={`w-full px-4 py-3 bg-[#141414] border rounded-xl resize-none outline-none transition-all text-sm text-gray-100 placeholder-gray-500 ${
              isFocused ? 'border-olive-500/50 ring-1 ring-olive-500/20' : 'border-gray-800/50'
            }`}
            rows="1"
            style={{ minHeight: '48px', maxHeight: '120px' }}
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center gap-2">
          <VoiceRecorder onSend={handleVoiceRecorderOutput} />

          <motion.button
            type="submit"
            disabled={!value.trim() || isLoading}
            className="p-3 rounded-xl transition-all"
            style={{
              backgroundColor: value.trim() && !isLoading ? '#D85A4A' : '#1a1a1a',
              color: value.trim() && !isLoading ? 'white' : '#6b7280',
              cursor: !value.trim() || isLoading ? 'not-allowed' : 'pointer'
            }}
            whileHover={value.trim() && !isLoading ? { scale: 1.02 } : {}}
            whileTap={value.trim() && !isLoading ? { scale: 0.98 } : {}}
          >
            <SafeIcon
              icon={isLoading ? FiLoader : FiSend}
              className={`text-lg ${isLoading ? 'animate-spin' : ''}`}
            />
          </motion.button>
        </div>
      </form>
    </div>
  );
};

export default InputArea;
