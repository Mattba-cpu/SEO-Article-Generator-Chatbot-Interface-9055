import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiX, FiUpload, FiImage, FiTrash2, FiSend, FiLoader, FiVideo, FiType, FiEye, FiEdit3, FiMove } = FiIcons;

/**
 * Détecte et extrait les informations d'un article depuis un message
 */
export const parseArticleFromMessage = (text) => {
  if (!text) return null;

  const hasTitle = /titre\s*:/i.test(text);
  const hasArticle = /article\s*:/i.test(text) || /<h[1-3]/i.test(text);

  if (!hasTitle && !hasArticle) return null;

  // Extraire le titre (s'arrête à la première nouvelle ligne)
  let title = '';
  const titleMatch = text.match(/titre\s*:\s*(.+?)(?=\n|$)/i);
  if (titleMatch) {
    title = titleMatch[1].trim().replace(/<[^>]*>/g, '');
  }

  // Extraire le slug (s'arrête à la première nouvelle ligne)
  let slug = '';
  const slugMatch = text.match(/slug\s*:\s*(.+?)(?=\n|$)/i);
  if (slugMatch) {
    slug = slugMatch[1].trim().replace(/<[^>]*>/g, '').toLowerCase().replace(/\s+/g, '-');
  }

  // Extraire la meta description (une ou deux lignes)
  let metaDescription = '';
  const metaMatch = text.match(/meta\s*description\s*:\s*(.+?)(?=\n\n|\ntitre|\narticle|\nslug|$)/is) ||
                    text.match(/metadescription\s*:\s*(.+?)(?=\n\n|\ntitre|\narticle|\nslug|$)/is);
  if (metaMatch) {
    metaDescription = metaMatch[1].trim().replace(/<[^>]*>/g, '');
  }

  // Extraire le contenu de l'article (le plus gros bloc)
  let content = '';
  // Chercher d'abord avec "Article:" comme label
  const articleMatch = text.match(/article\s*:\s*([\s\S]+?)(?=\n(?:titre|metadescription|meta description|slug)\s*:|$)/i);
  if (articleMatch) {
    content = articleMatch[1].trim();
  } else {
    // Sinon, prendre tout le contenu HTML
    const htmlMatch = text.match(/(<h[1-3][\s\S]+)/i);
    if (htmlMatch) {
      content = htmlMatch[1].trim();
    }
  }

  if (!title && content.length < 100) return null;

  return {
    title: title || 'Sans titre',
    content,
    metaDescription,
    slug
  };
};

export const isPublishableArticle = (text) => {
  const parsed = parseArticleFromMessage(text);
  return parsed !== null && (parsed.content.length > 200 || parsed.title.length > 5);
};

/**
 * Extrait le texte brut du HTML
 */
const stripHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
};

/**
 * Parse le contenu pour extraire intro et textes
 */
const parseContentForTemplate = (htmlContent) => {
  if (!htmlContent) return { intro: '', texte1: '', texte2: '' };

  // Nettoyer le contenu
  let content = htmlContent
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  // Extraire les paragraphes
  const paragraphs = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = pRegex.exec(content)) !== null) {
    const text = stripHtml(match[1]);
    if (text) paragraphs.push(text);
  }

  // Si pas de balises p, séparer par lignes
  if (paragraphs.length === 0) {
    const lines = content.split('\n\n').filter(l => l.trim());
    lines.forEach(line => {
      const text = stripHtml(line);
      if (text && !text.startsWith('#')) paragraphs.push(text);
    });
  }

  // Distribuer dans les sections
  const intro = paragraphs[0] || '';
  const texte1 = paragraphs.slice(1, Math.ceil(paragraphs.length / 2) + 1).join('\n\n');
  const texte2 = paragraphs.slice(Math.ceil(paragraphs.length / 2) + 1).join('\n\n');

  return { intro, texte1, texte2 };
};

const ArticlePublishModal = ({ isOpen, onClose, article, onPublish }) => {
  // Structure fixe correspondant à la template Divi
  const [formData, setFormData] = useState({
    // Row 1 - Intro
    title: '',
    introText: '',
    // Row 2 - Contenu principal
    slider1Images: [], // Carrousel 1
    texte1: '',
    videoUrl: '',
    texte2: '',
    slider2Images: [], // Carrousel 2
    // Meta
    metaDescription: '',
    slug: ''
  });

  const [isPublishing, setIsPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState('edit');
  const [dragOverZone, setDragOverZone] = useState(null);

  const slider1InputRef = useRef(null);
  const slider2InputRef = useRef(null);

  // Initialiser le formulaire quand l'article change
  React.useEffect(() => {
    if (article) {
      const { intro, texte1, texte2 } = parseContentForTemplate(article.content);
      setFormData({
        title: article.title || '',
        introText: intro,
        slider1Images: [],
        texte1: texte1,
        videoUrl: '',
        texte2: texte2,
        slider2Images: [],
        metaDescription: article.metaDescription || '',
        slug: article.slug || ''
      });
    }
  }, [article]);

  const handleImageUpload = useCallback((files, sliderKey) => {
    const newImages = Array.from(files).map((file, index) => ({
      id: `img_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 11)}`,
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
      type: file.type
    }));

    setFormData(prev => ({
      ...prev,
      [sliderKey]: [...prev[sliderKey], ...newImages]
    }));
  }, []);

  const handleDrop = useCallback((e, sliderKey) => {
    e.preventDefault();
    setDragOverZone(null);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      handleImageUpload(files, sliderKey);
    }
  }, [handleImageUpload]);

  const removeImage = useCallback((sliderKey, imageId) => {
    setFormData(prev => {
      const img = prev[sliderKey].find(i => i.id === imageId);
      if (img) URL.revokeObjectURL(img.preview);
      return {
        ...prev,
        [sliderKey]: prev[sliderKey].filter(i => i.id !== imageId)
      };
    });
  }, []);

  const reorderImages = useCallback((sliderKey, newOrder) => {
    setFormData(prev => ({
      ...prev,
      [sliderKey]: newOrder
    }));
  }, []);

  const updateField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  /**
   * Compresse et redimensionne une image avant l'envoi
   * Max 1920px de large, qualité JPEG 0.8
   */
  const compressImage = (file, maxWidth = 1920, quality = 0.8) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculer les nouvelles dimensions
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          // Créer un canvas pour redimensionner
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Convertir en JPEG compressé
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
    });
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      // Préparer les images du slider 1 (compressées)
      const slider1Data = await Promise.all(
        formData.slider1Images.map(async (img) => {
          const base64 = await compressImage(img.file);
          // Changer l'extension en .jpg puisqu'on convertit en JPEG
          const name = img.name.replace(/\.[^.]+$/, '.jpg');
          return {
            id: img.id,
            name,
            base64,
            type: 'image/jpeg'
          };
        })
      );

      // Préparer les images du slider 2 (compressées)
      const slider2Data = await Promise.all(
        formData.slider2Images.map(async (img) => {
          const base64 = await compressImage(img.file);
          const name = img.name.replace(/\.[^.]+$/, '.jpg');
          return {
            id: img.id,
            name,
            base64,
            type: 'image/jpeg'
          };
        })
      );

      // Envoyer les données structurées selon la template
      // Le parent (ChatInterface) gère la fermeture du modal après succès
      await onPublish({
        title: formData.title,
        metaDescription: formData.metaDescription,
        slug: formData.slug,
        // Structure template Divi
        template: {
          intro: formData.introText,
          slider1: slider1Data,
          texte1: formData.texte1,
          videoUrl: formData.videoUrl,
          texte2: formData.texte2,
          slider2: slider2Data
        }
      });
    } catch (error) {
      console.error('Erreur publication:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  // Composant pour une zone d'upload d'images (slider) avec drag & drop reorder
  const ImageSliderZone = ({ sliderKey, images, inputRef, label }) => (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-white flex items-center gap-2">
        <SafeIcon icon={FiImage} className="text-[#D85A4A]" />
        {label}
        <span className="text-xs text-gray-500 font-normal">
          ({images.length} image{images.length !== 1 ? 's' : ''})
        </span>
        {images.length > 1 && (
          <span className="text-xs text-gray-500 font-normal flex items-center gap-1">
            <SafeIcon icon={FiMove} className="text-xs" />
            Glissez pour réordonner
          </span>
        )}
      </label>

      {/* Zone de drop pour upload */}
      <div
        onDrop={(e) => handleDrop(e, sliderKey)}
        onDragOver={(e) => { e.preventDefault(); setDragOverZone(sliderKey); }}
        onDragLeave={() => setDragOverZone(null)}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
          dragOverZone === sliderKey
            ? 'border-[#D85A4A] bg-[#D85A4A]/10'
            : 'border-gray-700 hover:border-gray-600 bg-[#0a0a0a]'
        }`}
      >
        <SafeIcon icon={FiUpload} className="text-2xl text-gray-500 mx-auto mb-2" />
        <p className="text-sm text-gray-400">Glissez vos images ou cliquez</p>
        <p className="text-xs text-gray-500 mt-1">Plusieurs images = carrousel</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleImageUpload(e.target.files, sliderKey)}
          className="hidden"
        />
      </div>

      {/* Aperçu des images avec drag & drop reorder */}
      {images.length > 0 && (
        <Reorder.Group
          axis="x"
          values={images}
          onReorder={(newOrder) => reorderImages(sliderKey, newOrder)}
          className="flex flex-wrap gap-2"
        >
          {images.map((img) => (
            <Reorder.Item
              key={img.id}
              value={img}
              className="relative group cursor-grab active:cursor-grabbing"
              whileDrag={{ scale: 1.05, zIndex: 50 }}
            >
              <img
                src={img.preview}
                alt={img.name}
                className="w-20 h-20 object-cover rounded-lg border border-gray-700 pointer-events-none"
                draggable={false}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors pointer-events-none" />
              <button
                onClick={(e) => { e.stopPropagation(); removeImage(sliderKey, img.id); }}
                className="absolute -top-2 -right-2 p-1 bg-red-600 rounded-full text-white hover:bg-red-700 opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <SafeIcon icon={FiTrash2} className="text-xs" />
              </button>
              <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                {images.indexOf(img) + 1}
              </span>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}
    </div>
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
          className="bg-[#141414] rounded-2xl w-full max-w-4xl max-h-[90vh] border border-gray-800/50 overflow-hidden flex flex-col"
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
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'edit' ? (
              <div className="space-y-6">
                {/* Meta SEO */}
                <div className="bg-[#0a0a0a] rounded-xl p-4 border border-gray-800/50 space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Slug (URL de l'article)</label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => updateField('slug', e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                      className="w-full px-3 py-2 bg-transparent border border-gray-700 rounded-lg text-white placeholder-gray-500 outline-none focus:border-[#D85A4A]/50"
                      placeholder="mon-article-seo"
                    />
                    <p className="text-xs text-gray-500 mt-1">olive-prod.fr/{formData.slug || 'mon-article'}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Meta description (SEO)</label>
                    <textarea
                      value={formData.metaDescription}
                      onChange={(e) => updateField('metaDescription', e.target.value)}
                      className="w-full px-3 py-2 bg-transparent border border-gray-700 rounded-lg text-white placeholder-gray-500 outline-none resize-none focus:border-[#D85A4A]/50"
                      rows={2}
                      placeholder="Description pour les moteurs de recherche..."
                    />
                  </div>
                </div>

                {/* Section 1: Intro */}
                <div className="bg-[#1a1a1a] rounded-xl p-4 border border-blue-900/30">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-2 py-1 bg-blue-900/50 text-blue-300 text-xs rounded">ROW 1</span>
                    <span className="text-sm text-gray-400">Introduction</span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2 flex items-center gap-2">
                        <SafeIcon icon={FiType} className="text-[#D85A4A]" />
                        Titre H1
                      </label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => updateField('title', e.target.value)}
                        className="w-full px-4 py-3 bg-[#0a0a0a] border border-gray-700 rounded-xl text-white placeholder-gray-500 outline-none focus:border-[#D85A4A]/50"
                        placeholder="Titre principal de l'article"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Paragraphe d'introduction</label>
                      <textarea
                        value={formData.introText}
                        onChange={(e) => updateField('introText', e.target.value)}
                        className="w-full px-4 py-3 bg-[#0a0a0a] border border-gray-700 rounded-xl text-white placeholder-gray-500 outline-none resize-none focus:border-[#D85A4A]/50"
                        rows={3}
                        placeholder="Texte d'introduction..."
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Contenu principal */}
                <div className="bg-[#1a1a1a] rounded-xl p-4 border border-green-900/30">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-2 py-1 bg-green-900/50 text-green-300 text-xs rounded">ROW 2</span>
                    <span className="text-sm text-gray-400">Contenu principal</span>
                  </div>

                  <div className="space-y-6">
                    {/* Slider 1 */}
                    <ImageSliderZone
                      sliderKey="slider1Images"
                      images={formData.slider1Images}
                      inputRef={slider1InputRef}
                      label="Pixel Image Slider 1"
                    />

                    {/* Texte 1 */}
                    <div>
                      <label className="block text-sm font-medium text-white mb-2 flex items-center gap-2">
                        <SafeIcon icon={FiType} className="text-[#D85A4A]" />
                        Bloc Texte 1
                      </label>
                      <textarea
                        value={formData.texte1}
                        onChange={(e) => updateField('texte1', e.target.value)}
                        className="w-full px-4 py-3 bg-[#0a0a0a] border border-gray-700 rounded-xl text-white placeholder-gray-500 outline-none resize-none focus:border-[#D85A4A]/50"
                        rows={4}
                        placeholder="Contenu texte (peut contenir plusieurs paragraphes)..."
                      />
                    </div>

                    {/* Vidéo */}
                    <div>
                      <label className="block text-sm font-medium text-white mb-2 flex items-center gap-2">
                        <SafeIcon icon={FiVideo} className="text-[#D85A4A]" />
                        Vidéo YouTube
                        <span className="text-xs text-gray-500 font-normal">(optionnel)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.videoUrl}
                        onChange={(e) => updateField('videoUrl', e.target.value)}
                        className="w-full px-4 py-3 bg-[#0a0a0a] border border-gray-700 rounded-xl text-white placeholder-gray-500 outline-none focus:border-[#D85A4A]/50"
                        placeholder="https://www.youtube.com/watch?v=..."
                      />
                    </div>

                    {/* Texte 2 */}
                    <div>
                      <label className="block text-sm font-medium text-white mb-2 flex items-center gap-2">
                        <SafeIcon icon={FiType} className="text-[#D85A4A]" />
                        Bloc Texte 2
                      </label>
                      <textarea
                        value={formData.texte2}
                        onChange={(e) => updateField('texte2', e.target.value)}
                        className="w-full px-4 py-3 bg-[#0a0a0a] border border-gray-700 rounded-xl text-white placeholder-gray-500 outline-none resize-none focus:border-[#D85A4A]/50"
                        rows={4}
                        placeholder="Contenu texte (peut contenir plusieurs paragraphes)..."
                      />
                    </div>

                    {/* Slider 2 */}
                    <ImageSliderZone
                      sliderKey="slider2Images"
                      images={formData.slider2Images}
                      inputRef={slider2InputRef}
                      label="Pixel Image Slider 2"
                    />
                  </div>
                </div>

                {/* Section 3: CTA (fixe) */}
                <div className="bg-[#1a1a1a] rounded-xl p-4 border border-purple-900/30 opacity-60">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-1 bg-purple-900/50 text-purple-300 text-xs rounded">ROW 3</span>
                    <span className="text-sm text-gray-400">Call-to-Action (fixe)</span>
                  </div>
                  <p className="text-sm text-gray-500 italic">
                    Cette section est générée automatiquement avec le texte et bouton "CONTACT" standard.
                  </p>
                </div>
              </div>
            ) : (
              /* Preview */
              <div className="prose prose-invert max-w-none">
                <div className="bg-[#0a0a0a] rounded-xl p-6 border border-gray-800/50 mb-6">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Aperçu de l'article</span>
                </div>

                {/* Row 1: Intro */}
                <div className="mb-8 pb-8 border-b border-gray-800">
                  <h1 className="text-3xl font-bold text-white mb-4">{formData.title || 'Titre de l\'article'}</h1>
                  <p className="text-gray-300 text-lg">{formData.introText || 'Introduction...'}</p>
                </div>

                {/* Row 2: Contenu */}
                <div className="space-y-8 mb-8 pb-8 border-b border-gray-800">
                  {/* Slider 1 */}
                  {formData.slider1Images.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {formData.slider1Images.map(img => (
                        <img key={img.id} src={img.preview} alt="" className="h-48 rounded-lg object-cover" />
                      ))}
                    </div>
                  )}

                  {/* Texte 1 */}
                  {formData.texte1 && (
                    <div className="text-gray-200 whitespace-pre-line">{formData.texte1}</div>
                  )}

                  {/* Vidéo */}
                  {formData.videoUrl && (
                    <div className="bg-gray-900 rounded-xl p-4 text-center">
                      <SafeIcon icon={FiVideo} className="text-3xl text-gray-500 mb-2" />
                      <p className="text-sm text-gray-400">Vidéo: {formData.videoUrl}</p>
                    </div>
                  )}

                  {/* Texte 2 */}
                  {formData.texte2 && (
                    <div className="text-gray-200 whitespace-pre-line">{formData.texte2}</div>
                  )}

                  {/* Slider 2 */}
                  {formData.slider2Images.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {formData.slider2Images.map(img => (
                        <img key={img.id} src={img.preview} alt="" className="h-48 rounded-lg object-cover" />
                      ))}
                    </div>
                  )}
                </div>

                {/* Row 3: CTA */}
                <div className="bg-gray-900/50 rounded-xl p-6 text-center">
                  <h3 className="text-gray-400 text-sm mb-2">Prêt à donner une nouvelle dimension à votre projet ?</h3>
                  <p className="text-gray-500 text-sm mb-4">Texte CTA standard...</p>
                  <span className="inline-block px-6 py-2 bg-[#D85A4A] text-white rounded-lg">CONTACT</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-800/50 flex justify-between items-center">
            <p className="text-sm text-gray-500">
              {formData.slider1Images.length + formData.slider2Images.length} images •
              {formData.videoUrl ? ' 1 vidéo' : ' Pas de vidéo'}
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
                Annuler
              </button>
              <button
                onClick={handlePublish}
                disabled={isPublishing || !formData.title.trim()}
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
