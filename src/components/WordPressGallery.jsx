import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getWordPressPosts, deleteWordPressPost } from '../lib/wordpressService';

const { FiArrowLeft, FiExternalLink, FiEdit, FiTrash2, FiFileText, FiLoader } = FiIcons;

const WordPressGallery = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    setIsLoading(true);
    const { data, error } = await getWordPressPosts();
    if (!error) {
      setPosts(data);
    }
    setIsLoading(false);
  };

  const handleDelete = async (postId) => {
    if (!confirm('Supprimer cet article de la galerie ?')) return;

    setDeletingId(postId);
    const { error } = await deleteWordPressPost(postId);
    if (!error) {
      setPosts(prev => prev.filter(p => p.id !== postId));
    }
    setDeletingId(null);
  };

  const formatDate = (date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr });
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-gray-800/30 flex items-center px-6 flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <SafeIcon icon={FiArrowLeft} />
          <span className="text-sm">Retour</span>
        </button>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Title */}
          <h2 className="text-2xl font-semibold text-gray-100 mb-2">
            <span style={{ color: '#D85A4A' }}>Vos</span> articles WordPress
          </h2>
          <p className="text-gray-500 text-sm mb-8">
            {posts.length} article{posts.length !== 1 ? 's' : ''} publié{posts.length !== 1 ? 's' : ''}
          </p>

          {/* Loading state */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <SafeIcon icon={FiLoader} className="text-3xl text-gray-500 animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            /* Empty state */
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#1a1a1a] border border-gray-800 flex items-center justify-center">
                <SafeIcon icon={FiFileText} className="text-2xl text-gray-500" />
              </div>
              <p className="text-gray-400">Aucun article publié</p>
              <p className="text-gray-500 text-sm mt-1">
                Vos articles WordPress apparaîtront ici après publication
              </p>
            </div>
          ) : (
            /* Grid 3 columns */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {posts.map((post) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-[#141414] rounded-xl border border-gray-800/50 overflow-hidden group hover:border-gray-700 transition-colors"
                  >
                    {/* Card header */}
                    <div className="p-4 border-b border-gray-800/30">
                      <h3 className="text-white font-medium text-sm line-clamp-2 min-h-[40px]">
                        {post.title}
                      </h3>
                      <p className="text-gray-500 text-xs mt-2">
                        Publié {formatDate(post.created_at)}
                      </p>
                    </div>

                    {/* Card actions */}
                    <div className="p-3 flex items-center justify-between bg-[#0a0a0a]/50">
                      <div className="flex gap-2">
                        <a
                          href={post.post_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
                        >
                          <SafeIcon icon={FiExternalLink} className="text-xs" />
                          Voir
                        </a>
                        {post.edit_url && (
                          <a
                            href={post.edit_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
                          >
                            <SafeIcon icon={FiEdit} className="text-xs" />
                            Éditer
                          </a>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(post.id)}
                        disabled={deletingId === post.id}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {deletingId === post.id ? (
                          <SafeIcon icon={FiLoader} className="text-sm animate-spin" />
                        ) : (
                          <SafeIcon icon={FiTrash2} className="text-sm" />
                        )}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WordPressGallery;
