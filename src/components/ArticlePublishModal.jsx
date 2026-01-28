import React, { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiX, FiUpload, FiImage, FiTrash2, FiSend, FiLoader, FiPlus, FiEye, FiEdit3 } = FiIcons;

/**
 * Détecte et extrait les informations d'un article depuis un message
 */
export const parseArticleFromMessage = (text) => {
  if (!text) return null;

  const hasTitle = /titre\s*:/i.test(text);
  const hasArticle = /article\s*:/i.test(text) || /<h[1-3]/i.test(text);
  const hasMeta = /meta\s*description\s*:/i.test(text) || /metadescription\s*:/i.test(text);

  if (!hasTitle && !hasArticle) return null;

  let title = '';
  const titleMatch = text.match(/titre\s*:\s*(.+?)(?=\n|article\s*:|metadescription\s*:|$)/is);
  if (titleMatch) {
    title = titleMatch[1].trim().replace(/<[^>]*>/g, '');
  }

  let metaDescription = '';
  const metaMatch = text.match(/meta\s*description\s*:\s*(.+?)(?=\n\n|titre\s*:|article\s*:|$)/is) ||
                    text.match(/metadescription\s*:\s*(.+?)(?=\n\n|titre\s*:|article\s*:|$)/is);
  if (metaMatch) {
    metaDescription = metaMatch[1].trim().replace(/<[^>]*>/g, '');
  }

  let content = '';
  const articleMatch = text.match(/article\s*:\s*([\s\S]+?)(?=titre\s*:|metadescription\s*:|meta\s*description\s*:|$)/i);
  if (articleMatch) {
    content = articleMatch[1].trim();
  } else {
    const htmlMatch = text.match(/(<h[1-3][\s\S]+)/i);
    if (htmlMatch) {
      content = htmlMatch[1].trim();
    }
  }

  if (!title && content.length < 100) return null;

  return {
    title: title || 'Sans titre',
    content,
    metaDescription
  };
};

export const isPublishableArticle = (text) => {
  const parsed = parseArticleFromMessage(text);
  return parsed !== null && (parsed.content.length > 200 || parsed.title.length > 5);
};

/**
 * Parse le contenu HTML en blocs structurés
 */
const parseContentToBlocks = (htmlContent) => {
  if (!htmlContent) return [];

  const blocks = [];
  let blockId = 0;

  // Nettoyer le contenu
  let content = htmlContent
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  // Regex pour détecter les différents types de blocs
  const blockPatterns = [
    { type: 'h1', regex: /<h1[^>]*>([\s\S]*?)<\/h1>/gi },
    { type: 'h2', regex: /<h2[^>]*>([\s\S]*?)<\/h2>/gi },
    { type: 'h3', regex: /<h3[^>]*>([\s\S]*?)<\/h3>/gi },
    { type: 'p', regex: /<p[^>]*>([\s\S]*?)<\/p>/gi },
    { type: 'ul', regex: /<ul[^>]*>([\s\S]*?)<\/ul>/gi },
    { type: 'ol', regex: /<ol[^>]*>([\s\S]*?)<\/ol>/gi },
  ];

  // Trouver tous les blocs HTML
  const htmlBlocks = [];
  blockPatterns.forEach(({ type, regex }) => {
    let match;
    while ((match = regex.exec(content)) !== null) {
      htmlBlocks.push({
        type,
        content: match[0],
        innerContent: match[1],
        index: match.index
      });
    }
  });

  // Trier par position
  htmlBlocks.sort((a, b) => a.index - b.index);

  // Si on a des blocs HTML, les utiliser
  if (htmlBlocks.length > 0) {
    htmlBlocks.forEach((block) => {
      blocks.push({
        id: `block_${blockId++}`,
        type: block.type === 'h1' || block.type === 'h2' || block.type === 'h3' ? 'heading' : block.type,
        headingLevel: block.type.startsWith('h') ? parseInt(block.type[1]) : null,
        content: block.innerContent.trim(),
        rawHtml: block.content
      });
    });
  } else {
    // Sinon, parser par lignes/paragraphes
    const lines = content.split('\n\n').filter(line => line.trim());
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Détecter les titres markdown
      if (trimmed.startsWith('# ')) {
        blocks.push({
          id: `block_${blockId++}`,
          type: 'heading',
          headingLevel: 1,
          content: trimmed.substring(2)
        });
      } else if (trimmed.startsWith('## ')) {
        blocks.push({
          id: `block_${blockId++}`,
          type: 'heading',
          headingLevel: 2,
          content: trimmed.substring(3)
        });
      } else if (trimmed.startsWith('### ')) {
        blocks.push({
          id: `block_${blockId++}`,
          type: 'heading',
          headingLevel: 3,
          content: trimmed.substring(4)
        });
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        blocks.push({
          id: `block_${blockId++}`,
          type: 'ul',
          content: trimmed
        });
      } else {
        blocks.push({
          id: `block_${blockId++}`,
          type: 'p',
          content: trimmed
        });
      }
    });
  }

  return blocks;
};

/**
 * Convertit les blocs en HTML
 */
const blocksToHtml = (blocks) => {
  return blocks.map(block => {
    if (block.type === 'image') {
      return `<figure class="wp-block-image aligncenter size-large"><img src="{{${block.imageRef}}}" alt="${block.alt || ''}" /></figure>`;
    }
    if (block.type === 'heading') {
      const tag = `h${block.headingLevel || 2}`;
      return `<${tag}>${block.content}</${tag}>`;
    }
    if (block.type === 'ul' || block.type === 'ol') {
      return block.rawHtml || `<${block.type}>${block.content}</${block.type}>`;
    }
    return `<p>${block.content}</p>`;
  }).join('\n\n');
};

const ArticlePublishModal = ({ isOpen, onClose, article, onPublish }) => {
  const [images, setImages] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedMeta, setEditedMeta] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState('edit');
  const [dragOver, setDragOver] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [openInsertMenu, setOpenInsertMenu] = useState(null);
  const fileInputRef = useRef(null);

  // Initialiser les blocs quand l'article change
  React.useEffect(() => {
    if (article) {
      setEditedTitle(article.title || '');
      setEditedMeta(article.metaDescription || '');
      setBlocks(parseContentToBlocks(article.content));
      setOpenInsertMenu(null);
    }
  }, [article]);

  // Fermer le menu d'insertion quand on clique ailleurs
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (openInsertMenu && !e.target.closest('[data-insert-menu]')) {
        setOpenInsertMenu(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openInsertMenu]);

  const handleImageUpload = useCallback((files) => {
    const newImages = Array.from(files).map((file, index) => ({
      id: `img_${Date.now()}_${index}`,
      file,
      preview: URL.createObjectURL(file),
      name: file.name
    }));
    setImages(prev => [...prev, ...newImages]);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      handleImageUpload(files);
    }
  }, [handleImageUpload]);

  const removeImage = useCallback((imageId) => {
    setImages(prev => {
      const img = prev.find(i => i.id === imageId);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter(i => i.id !== imageId);
    });
    // Retirer le bloc image correspondant
    setBlocks(prev => prev.filter(b => b.imageId !== imageId));
  }, []);

  const insertImageAfterBlock = useCallback((blockId, imageId) => {
    const image = images.find(i => i.id === imageId);
    if (!image) return;

    const newImageBlock = {
      id: `block_img_${Date.now()}`,
      type: 'image',
      imageId: imageId,
      imageRef: `IMAGE_${imageId}`,
      preview: image.preview,
      alt: image.name.replace(/\.[^.]+$/, '')
    };

    setBlocks(prev => {
      const index = prev.findIndex(b => b.id === blockId);
      if (index === -1) return [...prev, newImageBlock];
      const newBlocks = [...prev];
      newBlocks.splice(index + 1, 0, newImageBlock);
      return newBlocks;
    });
  }, [images]);

  const removeBlock = useCallback((blockId) => {
    setBlocks(prev => prev.filter(b => b.id !== blockId));
  }, []);

  const updateBlockContent = useCallback((blockId, newContent) => {
    setBlocks(prev => prev.map(b =>
      b.id === blockId ? { ...b, content: newContent } : b
    ));
  }, []);

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const imagesData = await Promise.all(
        images.filter(img => blocks.some(b => b.imageId === img.id)).map(async (img) => {
          const base64 = await fileToBase64(img.file);
          return {
            id: img.id,
            name: img.name,
            base64,
            type: img.file.type
          };
        })
      );

      const htmlContent = blocksToHtml(blocks);

      await onPublish({
        title: editedTitle,
        content: htmlContent,
        metaDescription: editedMeta,
        images: imagesData
      });

      onClose();
    } catch (error) {
      console.error('Erreur publication:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });
  };

  const insertedImageIds = useMemo(() =>
    new Set(blocks.filter(b => b.type === 'image').map(b => b.imageId)),
    [blocks]
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-[#141414] rounded-2xl w-full max-w-5xl max-h-[90vh] border border-gray-800/50 overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800/50">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">Publier sur WordPress</h2>
              <div className="flex bg-[#0a0a0a] rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('edit')}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    activeTab === 'edit' ? 'bg-[#D85A4A] text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <SafeIcon icon={FiEdit3} className="inline mr-1.5" />
                  Éditer
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    activeTab === 'preview' ? 'bg-[#D85A4A] text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <SafeIcon icon={FiEye} className="inline mr-1.5" />
                  Aperçu
                </button>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors">
              <SafeIcon icon={FiX} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex">
            {/* Main editor */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'edit' ? (
                <div className="space-y-4">
                  {/* Titre */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Titre SEO</label>
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-[#0a0a0a] border border-gray-800/50 rounded-xl text-white placeholder-gray-500 outline-none transition-all focus:border-[#D85A4A]/50"
                      placeholder="Titre de l'article"
                    />
                  </div>

                  {/* Meta */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Meta description</label>
                    <textarea
                      value={editedMeta}
                      onChange={(e) => setEditedMeta(e.target.value)}
                      className="w-full px-4 py-3 bg-[#0a0a0a] border border-gray-800/50 rounded-xl text-white placeholder-gray-500 outline-none resize-none"
                      rows={2}
                    />
                  </div>

                  {/* Blocs de contenu */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Contenu de l'article
                      <span className="text-xs text-gray-500 ml-2">(Cliquez sur + pour insérer une image)</span>
                    </label>

                    <div className="space-y-2">
                      {blocks.map((block, index) => (
                        <div key={block.id} className="group">
                          {/* Bloc */}
                          <div className={`relative bg-[#0a0a0a] border rounded-lg overflow-hidden ${
                            block.type === 'image' ? 'border-[#D85A4A]/50' : 'border-gray-800/50'
                          }`}>
                            {block.type === 'image' ? (
                              <div className="relative">
                                <img src={block.preview} alt={block.alt} className="w-full max-h-64 object-contain bg-black/50" />
                                <button
                                  onClick={() => removeBlock(block.id)}
                                  className="absolute top-2 right-2 p-1.5 bg-red-600 rounded-lg text-white hover:bg-red-700"
                                >
                                  <SafeIcon icon={FiTrash2} className="text-sm" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2 p-3">
                                <div className="flex-shrink-0 pt-1">
                                  <span className={`text-xs px-2 py-0.5 rounded ${
                                    block.type === 'heading'
                                      ? 'bg-blue-900/50 text-blue-300'
                                      : block.type === 'ul' || block.type === 'ol'
                                      ? 'bg-purple-900/50 text-purple-300'
                                      : 'bg-gray-800 text-gray-400'
                                  }`}>
                                    {block.type === 'heading' ? `H${block.headingLevel}` : block.type.toUpperCase()}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  {editingBlockId === block.id ? (
                                    <textarea
                                      value={block.content}
                                      onChange={(e) => updateBlockContent(block.id, e.target.value)}
                                      onBlur={() => setEditingBlockId(null)}
                                      autoFocus
                                      className="w-full bg-transparent text-white resize-none outline-none"
                                      rows={3}
                                    />
                                  ) : (
                                    <div
                                      onClick={() => setEditingBlockId(block.id)}
                                      className={`text-gray-200 cursor-text hover:bg-gray-800/30 rounded p-1 -m-1 ${
                                        block.type === 'heading' ? 'font-semibold text-white' : ''
                                      }`}
                                      dangerouslySetInnerHTML={{ __html: block.content }}
                                    />
                                  )}
                                </div>
                                <button
                                  onClick={() => removeBlock(block.id)}
                                  className="flex-shrink-0 p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <SafeIcon icon={FiTrash2} className="text-sm" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Bouton d'insertion d'image entre les blocs */}
                          {images.filter(img => !insertedImageIds.has(img.id)).length > 0 && (
                            <div className="relative h-8 flex items-center justify-center" data-insert-menu>
                              <div className="flex items-center gap-2 w-full px-4">
                                <div className="h-px bg-gray-700/50 flex-1" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenInsertMenu(openInsertMenu === block.id ? null : block.id);
                                  }}
                                  className={`p-1.5 rounded-full text-white transition-colors ${
                                    openInsertMenu === block.id ? 'bg-[#c44d3f]' : 'bg-[#D85A4A] hover:bg-[#c44d3f]'
                                  }`}
                                >
                                  <SafeIcon icon={FiPlus} className="text-xs" />
                                </button>
                                <div className="h-px bg-gray-700/50 flex-1" />
                              </div>

                              {/* Menu dropdown */}
                              {openInsertMenu === block.id && (
                                <div
                                  className="absolute left-1/2 -translate-x-1/2 top-full mt-1 bg-[#1a1a1a] border border-gray-700 rounded-lg p-2 z-50 min-w-[180px] shadow-xl"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <p className="text-xs text-gray-400 mb-2 px-1">Insérer une image :</p>
                                  {images.filter(img => !insertedImageIds.has(img.id)).map(img => (
                                    <button
                                      key={img.id}
                                      onClick={() => {
                                        insertImageAfterBlock(block.id, img.id);
                                        setOpenInsertMenu(null);
                                      }}
                                      className="flex items-center gap-2 w-full p-2 hover:bg-gray-800 rounded text-left transition-colors"
                                    >
                                      <img src={img.preview} alt="" className="w-10 h-10 object-cover rounded" />
                                      <span className="text-sm text-gray-300 truncate flex-1">{img.name}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Preview */
                <div className="prose prose-invert max-w-none">
                  <h1 className="text-2xl font-bold text-white mb-4">{editedTitle}</h1>
                  {editedMeta && (
                    <p className="text-gray-400 italic border-l-2 border-[#D85A4A] pl-3 mb-6">{editedMeta}</p>
                  )}
                  <div className="space-y-4">
                    {blocks.map(block => {
                      if (block.type === 'image') {
                        return (
                          <figure key={block.id} className="my-6">
                            <img src={block.preview} alt={block.alt} className="max-w-full h-auto rounded-lg mx-auto" />
                          </figure>
                        );
                      }
                      if (block.type === 'heading') {
                        const Tag = `h${block.headingLevel}`;
                        return <Tag key={block.id} className="text-white font-semibold mt-6" dangerouslySetInnerHTML={{ __html: block.content }} />;
                      }
                      return <p key={block.id} className="text-gray-200" dangerouslySetInnerHTML={{ __html: block.content }} />;
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar - Images */}
            <div className="w-64 border-l border-gray-800/50 p-4 overflow-y-auto">
              <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <SafeIcon icon={FiImage} />
                Images ({images.length})
              </h3>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all mb-4 ${
                  dragOver ? 'border-[#D85A4A] bg-[#D85A4A]/10' : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <SafeIcon icon={FiUpload} className="text-2xl text-gray-500 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Glissez vos images</p>
                <p className="text-xs text-gray-500 mt-1">ou cliquez pour parcourir</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleImageUpload(e.target.files)}
                  className="hidden"
                />
              </div>

              {/* Liste des images */}
              <div className="space-y-2">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className={`relative group rounded-lg overflow-hidden border ${
                      insertedImageIds.has(img.id) ? 'border-[#D85A4A]/50' : 'border-gray-700'
                    }`}
                  >
                    <img src={img.preview} alt={img.name} className="w-full h-20 object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => removeImage(img.id)}
                        className="p-2 bg-red-600 rounded-lg text-white hover:bg-red-700"
                      >
                        <SafeIcon icon={FiTrash2} />
                      </button>
                    </div>
                    {insertedImageIds.has(img.id) && (
                      <div className="absolute top-1 right-1 bg-[#D85A4A] text-white text-xs px-2 py-0.5 rounded">
                        Inséré
                      </div>
                    )}
                    <p className="text-xs text-gray-400 p-2 truncate">{img.name}</p>
                  </div>
                ))}
              </div>

              {images.length > 0 && images.filter(i => !insertedImageIds.has(i.id)).length > 0 && (
                <p className="text-xs text-gray-500 mt-3">
                  Survolez entre deux blocs et cliquez sur + pour insérer une image
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-800/50 flex justify-between items-center">
            <p className="text-sm text-gray-500">
              {blocks.length} blocs • {insertedImageIds.size} images insérées
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
                Annuler
              </button>
              <button
                onClick={handlePublish}
                disabled={isPublishing || !editedTitle.trim()}
                className="px-6 py-2 bg-[#D85A4A] text-white rounded-xl font-medium flex items-center gap-2 hover:bg-[#c44d3f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPublishing ? (
                  <>
                    <SafeIcon icon={FiLoader} className="animate-spin" />
                    Publication...
                  </>
                ) : (
                  <>
                    <SafeIcon icon={FiSend} />
                    Publier sur WordPress
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ArticlePublishModal;
