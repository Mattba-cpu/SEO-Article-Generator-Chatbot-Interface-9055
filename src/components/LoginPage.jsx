import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { useAuth } from '../contexts/AuthContext';

const { FiMail, FiArrowRight, FiCheck, FiLoader } = FiIcons;

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');
  const { sendMagicLink } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || isLoading) return;

    setIsLoading(true);
    setError('');

    const { error } = await sendMagicLink(email);

    if (error) {
      setError(error.message);
      setIsLoading(false);
    } else {
      setIsSent(true);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="O'Live Prod"
            className="h-16 mx-auto mb-4 object-contain"
          />
          <p className="text-gray-500 text-sm">Agent SEO</p>
        </div>

        {/* Card */}
        <div className="bg-[#141414] rounded-2xl p-8 border border-gray-800/50">
          {isSent ? (
            // Succès - Email envoyé
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div
                className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: 'rgba(216, 90, 74, 0.2)' }}
              >
                <SafeIcon icon={FiCheck} className="text-2xl" style={{ color: '#D85A4A' }} />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Vérifiez votre boîte mail
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                Un lien de connexion a été envoyé à<br />
                <span className="text-white font-medium">{email}</span>
              </p>
              <p className="text-gray-500 text-xs">
                Le lien expire dans 1 heure
              </p>
              <button
                onClick={() => {
                  setIsSent(false);
                  setEmail('');
                }}
                className="mt-6 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Utiliser une autre adresse email
              </button>
            </motion.div>
          ) : (
            // Formulaire de connexion
            <>
              <h2 className="text-xl font-semibold text-white mb-2 text-center">
                Connexion
              </h2>
              <p className="text-gray-400 text-sm text-center mb-6">
                Entrez votre email pour recevoir un lien de connexion
              </p>

              <form onSubmit={handleSubmit}>
                <div className="relative mb-4">
                  <SafeIcon
                    icon={FiMail}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full pl-12 pr-4 py-3 bg-[#0a0a0a] border border-gray-800/50 rounded-xl text-white placeholder-gray-500 outline-none transition-all focus:border-[#D85A4A]/50 focus:ring-1 focus:ring-[#D85A4A]/20"
                    disabled={isLoading}
                  />
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 text-sm mb-4 text-center"
                  >
                    {error}
                  </motion.p>
                )}

                <motion.button
                  type="submit"
                  disabled={!email.trim() || isLoading}
                  className="w-full py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2 transition-all"
                  style={{
                    backgroundColor: email.trim() && !isLoading ? '#D85A4A' : '#1a1a1a',
                    color: email.trim() && !isLoading ? 'white' : '#6b7280',
                    cursor: !email.trim() || isLoading ? 'not-allowed' : 'pointer'
                  }}
                  whileHover={email.trim() && !isLoading ? { scale: 1.02 } : {}}
                  whileTap={email.trim() && !isLoading ? { scale: 0.98 } : {}}
                >
                  {isLoading ? (
                    <>
                      <SafeIcon icon={FiLoader} className="animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      Recevoir le lien
                      <SafeIcon icon={FiArrowRight} />
                    </>
                  )}
                </motion.button>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-6">
          Seuls les utilisateurs autorisés peuvent se connecter
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
