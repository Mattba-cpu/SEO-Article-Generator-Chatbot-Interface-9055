import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const { FiMessageSquare, FiPlus, FiTrash2, FiSettings } = FiIcons;

const Sidebar = ({
  isOpen,
  conversations,
  currentSessionId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onOpenSettings
}) => {
  return (
    <motion.aside
      initial={false}
      animate={{ width: isOpen ? 280 : 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="h-full bg-[#0a0a0a] border-r border-gray-800/30 flex flex-col overflow-hidden flex-shrink-0"
    >
      <div className="w-[280px] h-full flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-gray-800/30">
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 text-white py-2.5 px-4 rounded-lg transition-all text-sm font-medium"
            style={{ backgroundColor: '#D85A4A' }}
          >
            <SafeIcon icon={FiPlus} className="text-sm" />
            <span>Nouvelle discussion</span>
          </button>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <AnimatePresence initial={false}>
            {conversations.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-olive-900/20 border border-olive-500/20 flex items-center justify-center">
                  <SafeIcon icon={FiMessageSquare} className="text-olive-400 text-xl" />
                </div>
                <p className="text-xs text-gray-500">Aucune conversation</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                    currentSessionId === conv.id
                      ? 'bg-olive-900/30 border-l-2 border-olive-500 text-white'
                      : 'text-gray-400 hover:bg-[#141414] hover:text-gray-200 border-l-2 border-transparent'
                  }`}
                  onClick={() => onSelectConversation(conv.id)}
                >
                  <SafeIcon
                    icon={FiMessageSquare}
                    className={`text-sm flex-shrink-0 ${
                      currentSessionId === conv.id ? 'text-olive-400' : 'text-gray-500'
                    }`}
                  />
                  <div className="flex-1 overflow-hidden min-w-0">
                    <p className="text-sm truncate">{conv.title || 'Nouvelle discussion'}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {format(new Date(conv.last_update), 'dd MMM, HH:mm', { locale: fr })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-olive-400 hover:bg-[#1a1a1a] rounded transition-all flex-shrink-0"
                  >
                    <SafeIcon icon={FiTrash2} className="text-xs" />
                  </button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-800/30 space-y-2">
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-all text-sm"
          >
            <SafeIcon icon={FiSettings} className="text-sm" />
            <span>Paramètres</span>
          </button>
          <div className="flex items-center gap-2 px-3">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#D85A4A' }} />
            <span className="text-xs text-gray-500">Agent <span style={{ color: '#E8715F' }}>connecté</span></span>
          </div>
        </div>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
