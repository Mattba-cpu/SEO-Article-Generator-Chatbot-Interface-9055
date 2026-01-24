import React from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiMenu, FiChevronLeft, FiHome } = FiIcons;

const Header = ({ onToggleSidebar, sidebarOpen, onGoHome }) => {
  return (
    <header className="h-16 bg-[#0a0a0a] border-b border-gray-800/30 flex items-center px-4 gap-3 flex-shrink-0">
      <button
        onClick={onToggleSidebar}
        className="p-2 text-gray-400 hover:text-olive-400 hover:bg-olive-900/20 rounded-lg transition-all"
      >
        <SafeIcon icon={sidebarOpen ? FiChevronLeft : FiMenu} className="text-lg" />
      </button>

      <button
        onClick={onGoHome}
        className="p-2 text-gray-400 hover:text-olive-400 hover:bg-olive-900/20 rounded-lg transition-all"
        title="Accueil"
      >
        <SafeIcon icon={FiHome} className="text-lg" />
      </button>

      <div className="flex items-center gap-3 ml-2">
        <img
          src="/logo.png"
          alt="O'Live Prod"
          className="h-7 w-auto object-contain"
          style={{ maxHeight: '28px' }}
        />
      </div>
    </header>
  );
};

export default Header;
