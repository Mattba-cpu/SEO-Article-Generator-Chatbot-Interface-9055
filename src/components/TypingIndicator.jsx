import React from 'react';
import { motion } from 'framer-motion';

const TypingIndicator = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start mb-4"
    >
      <div className="flex gap-2.5">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden">
          <img
            src="/logo.png"
            alt="O'Live Prod"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="bg-[#1a1a1a] border border-olive-500/20 rounded-2xl rounded-tl-sm px-4 py-3">
          <div className="flex items-center gap-1">
            <motion.div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: '#E8715F' }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0 }}
            />
            <motion.div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: '#E8715F' }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
            />
            <motion.div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: '#E8715F' }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TypingIndicator;
