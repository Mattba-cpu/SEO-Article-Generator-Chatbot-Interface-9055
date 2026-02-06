import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const { FiSend, FiMessageSquare, FiTrash2, FiSettings, FiGrid } = FiIcons;

const HomePage = ({
  conversations,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onOpenSettings,
  onOpenGallery,
  isLoading = false,
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onNewConversation(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatRelativeTime = (date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr });
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-gray-800/30 flex items-center justify-between px-6 flex-shrink-0">
        <img
          src="/logo.png"
          alt="O'Live Prod"
          className="h-8 w-auto object-contain"
          style={{ maxHeight: '32px' }}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenGallery}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-all"
            title="Articles WordPress"
          >
            <SafeIcon icon={FiGrid} className="text-lg" />
          </button>
          <button
            onClick={onOpenSettings}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-all"
            title="Paramètres"
          >
            <SafeIcon icon={FiSettings} className="text-lg" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          {/* Title */}
          <h2 className="text-2xl font-semibold text-gray-100 mb-6">
            <span style={{ color: '#D85A4A' }}>Vos</span> discussions
          </h2>

          {/* Input bar */}
          <form onSubmit={handleSubmit} className="mb-8">
            <div className="relative">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Décrivez votre prestation pour démarrer..."
                className="w-full px-4 py-4 pr-14 bg-[#141414] border border-gray-800/50 rounded-xl resize-none outline-none transition-all text-sm text-gray-100 placeholder-gray-500 focus:border-olive-500/50 focus:ring-1 focus:ring-olive-500/20"
                rows="1"
                style={{ minHeight: '56px' }}
              />
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all text-white"
                style={{
                  backgroundColor: inputValue.trim() ? '#D85A4A' : '#1f2937',
                  color: inputValue.trim() ? 'white' : '#6b7280'
                }}
              >
                <SafeIcon icon={FiSend} className="text-lg" />
              </button>
            </div>
          </form>

          {/* Conversations count */}
          <p className="text-sm text-gray-400 mb-4">
            <span className="font-medium" style={{ color: '#E8715F' }}>{conversations.length}</span> conversation{conversations.length !== 1 ? 's' : ''}
          </p>

          {/* Conversations list */}
          <div className="space-y-1">
            <AnimatePresence initial={false}>
              {conversations.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-olive-900/30 border border-olive-500/20 flex items-center justify-center">
                    <SafeIcon icon={FiMessageSquare} className="text-2xl text-olive-400" />
                  </div>
                  <p className="text-gray-400 text-sm">Aucune conversation</p>
                  <p className="text-gray-500 text-xs mt-1">Décrivez votre prestation ci-dessus pour commencer</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <motion.div
                    key={conv.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="group relative"
                  >
                    <button
                      onClick={() => onSelectConversation(conv.id)}
                      className="w-full text-left px-4 py-4 rounded-lg hover:bg-[#1a1a1a] transition-colors border-l-2 border-transparent hover:border-olive-500"
                    >
                      <p className="text-sm text-gray-200 font-medium truncate pr-8">
                        {conv.title || 'Nouvelle discussion'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Dernier message {formatRelativeTime(conv.last_update)}
                      </p>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conv.id);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-gray-500 hover:text-olive-400 hover:bg-[#1a1a1a] rounded-lg transition-all"
                    >
                      <SafeIcon icon={FiTrash2} className="text-sm" />
                    </button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
