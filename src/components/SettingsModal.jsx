import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useAuth } from '../contexts/AuthContext';

const { FiX, FiMail, FiBriefcase, FiLogOut, FiSave, FiLoader } = FiIcons;

const SettingsModal = ({ isOpen, onClose }) => {
  const { user, userProfile, updateProfile, signOut } = useAuth();
  const [companyName, setCompanyName] = useState(userProfile?.company_name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  React.useEffect(() => {
    if (userProfile) {
      setCompanyName(userProfile.company_name || '');
    }
  }, [userProfile]);

  const handleSave = async () => {
    if (!companyName.trim() || isSaving) return;

    setIsSaving(true);
    setMessage({ type: '', text: '' });

    const { error } = await updateProfile({ company_name: companyName.trim() });

    if (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde' });
    } else {
      setMessage({ type: 'success', text: 'Profil mis à jour' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }

    setIsSaving(false);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);

    // Timeout de 3s max pour la déconnexion
    const signOutPromise = signOut();
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000));

    await Promise.race([signOutPromise, timeoutPromise]);

    // Nettoyer le localStorage Supabase
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key);
      }
    });

    window.location.href = '/login';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-[#141414] rounded-2xl w-full max-w-md border border-gray-800/50 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800/50">
            <h2 className="text-lg font-semibold text-white">Paramètres</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
            >
              <SafeIcon icon={FiX} />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Email (non modifiable) */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                <SafeIcon icon={FiMail} className="inline mr-2" />
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-gray-800/50 rounded-xl text-gray-400 cursor-not-allowed"
              />
            </div>

            {/* Nom de l'entreprise */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                <SafeIcon icon={FiBriefcase} className="inline mr-2" />
                Nom de l'entreprise
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Nom de votre entreprise"
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-gray-800/50 rounded-xl text-white placeholder-gray-500 outline-none transition-all focus:border-[#D85A4A]/50 focus:ring-1 focus:ring-[#D85A4A]/20"
              />
            </div>

            {/* Message */}
            {message.text && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-sm text-center ${
                  message.type === 'error' ? 'text-red-400' : 'text-green-400'
                }`}
              >
                {message.text}
              </motion.p>
            )}

            {/* Bouton Sauvegarder */}
            <motion.button
              onClick={handleSave}
              disabled={!companyName.trim() || isSaving}
              className="w-full py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2 transition-all"
              style={{
                backgroundColor: companyName.trim() && !isSaving ? '#D85A4A' : '#1a1a1a',
                color: companyName.trim() && !isSaving ? 'white' : '#6b7280',
                cursor: !companyName.trim() || isSaving ? 'not-allowed' : 'pointer'
              }}
              whileHover={companyName.trim() && !isSaving ? { scale: 1.02 } : {}}
              whileTap={companyName.trim() && !isSaving ? { scale: 0.98 } : {}}
            >
              {isSaving ? (
                <>
                  <SafeIcon icon={FiLoader} className="animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <SafeIcon icon={FiSave} />
                  Sauvegarder
                </>
              )}
            </motion.button>
          </div>

          {/* Footer - Déconnexion */}
          <div className="p-4 border-t border-gray-800/50">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full py-3 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-900/20 border border-red-900/30 font-medium flex items-center justify-center gap-2 transition-all"
            >
              {isLoggingOut ? (
                <>
                  <SafeIcon icon={FiLoader} className="animate-spin" />
                  Déconnexion...
                </>
              ) : (
                <>
                  <SafeIcon icon={FiLogOut} />
                  Se déconnecter
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SettingsModal;
