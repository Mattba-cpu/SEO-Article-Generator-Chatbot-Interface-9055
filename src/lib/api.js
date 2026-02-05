// URLs des webhooks depuis les variables d'environnement
export const ENDPOINTS = {
  CHAT: import.meta.env.VITE_WEBHOOK_CHAT_URL,
  AUDIO: import.meta.env.VITE_WEBHOOK_AUDIO_URL,
  // WordPress utilise maintenant une Netlify Function (credentials sécurisés côté serveur)
  WORDPRESS: '/.netlify/functions/wordpress-publish'
};

// Vérification au démarrage que les variables sont définies
if (!ENDPOINTS.CHAT) {
  console.error('VITE_WEBHOOK_CHAT_URL non définie dans .env');
}
if (!ENDPOINTS.AUDIO) {
  console.error('VITE_WEBHOOK_AUDIO_URL non définie dans .env');
}

/**
 * Envoie un message avec un sessionId pour maintenir le contexte dans n8n
 */
export const sendChatMessage = async (message, sessionId) => {
  try {
    const response = await fetch(ENDPOINTS.CHAT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        sessionId, // Identifiant unique de la session
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const textData = await response.text();
    try {
      return JSON.parse(textData);
    } catch (e) {
      return textData;
    }
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};

/**
 * Extrait proprement la réponse et nettoie les tags de langage Markdown
 */
export const extractWebhookResponse = (data) => {
  let result = "";

  if (typeof data === 'string') {
    result = data;
  } else if (Array.isArray(data)) {
    const firstItem = data[0];
    result = typeof firstItem === 'string' ? firstItem : (firstItem?.output || firstItem?.text || firstItem?.json?.output || JSON.stringify(firstItem));
  } else if (data && typeof data === 'object') {
    result = data.output || data.text || data.message || data.response || data.json?.output || data['AI Agent']?.json?.output || JSON.stringify(data);
  }

  if (typeof result === 'string') {
    // Supprime les blocs de code markdown et les noms de langage (ex: ```markdown ... ```)
    return result.replace(/^```(?:\w+)?\n?/, '').replace(/\n?```$/, '').trim();
  }

  return String(result);
};

/**
 * Convertit un bloc en format structuré pour le webhook
 */
const formatBlock = (block, position, imageIndex, images) => {
  const baseBlock = { position };

  switch (block.type) {
    case 'image': {
      const img = images.find(i => i.id === block.imageId);
      const alt = block.alt || (img ? img.name.replace(/\.[^.]+$/, '') : '');
      return {
        ...baseBlock,
        type: 'image',
        imageKey: `IMAGE_${imageIndex}`,
        imagePlaceholder: `{{IMAGE_${imageIndex}}}`,
        alt,
        html: `<figure class="wp-block-image aligncenter size-large"><img src="{{IMAGE_${imageIndex}}}" alt="${alt}" /></figure>`
      };
    }

    case 'heading': {
      const level = block.headingLevel || 2;
      return {
        ...baseBlock,
        type: 'heading',
        level,
        text: block.content,
        html: `<h${level}>${block.content}</h${level}>`
      };
    }

    case 'ul':
      return {
        ...baseBlock,
        type: 'list',
        listType: 'unordered',
        text: block.content,
        html: `<ul>${block.content}</ul>`
      };

    case 'ol':
      return {
        ...baseBlock,
        type: 'list',
        listType: 'ordered',
        text: block.content,
        html: `<ol>${block.content}</ol>`
      };

    case 'blockquote':
      return {
        ...baseBlock,
        type: 'quote',
        text: block.content,
        html: `<blockquote>${block.content}</blockquote>`
      };

    case 'code':
      return {
        ...baseBlock,
        type: 'code',
        text: block.content,
        html: `<pre><code>${block.content}</code></pre>`
      };

    default:
      // Paragraphe par défaut
      return {
        ...baseBlock,
        type: 'paragraph',
        text: block.content || '',
        html: `<p>${block.content || ''}</p>`
      };
  }
};

/**
 * Publie un article sur WordPress via Netlify Function
 * La fonction gère l'upload des images et la création de l'article en format Divi
 */
export const publishToWordPress = async (articleData) => {
  try {
    const blocks = articleData.blocks || [];
    const images = articleData.images || [];

    // Construire le contenu dynamiquement - s'adapte à n'importe quel nombre de blocs
    let imageIndex = 0;
    const content = blocks.map((block, position) => {
      const formattedBlock = formatBlock(block, position, imageIndex, images);
      if (block.type === 'image') imageIndex++;
      return formattedBlock;
    });

    // Extraire les images utilisées (dans l'ordre d'apparition)
    const imagesData = {};
    let imgIdx = 0;
    blocks.forEach(block => {
      if (block.type === 'image') {
        const img = images.find(i => i.id === block.imageId);
        if (img) {
          imagesData[`IMAGE_${imgIdx}`] = {
            base64: img.base64,
            filename: img.name,
            mimeType: img.type,
            alt: block.alt || img.name.replace(/\.[^.]+$/, '')
          };
          imgIdx++;
        }
      }
    });

    // Calculer les statistiques dynamiquement
    const typeCount = content.reduce((acc, block) => {
      acc[block.type] = (acc[block.type] || 0) + 1;
      return acc;
    }, {});

    const payload = {
      // === ARTICLE ===
      title: articleData.title || '',
      metaDescription: articleData.metaDescription || '',

      // === CONTENU DÉTAILLÉ (tableau dynamique, dans l'ordre exact) ===
      content,

      // === IMAGES (objet dynamique avec toutes les images utilisées) ===
      images: imagesData,

      // === STATISTIQUES (calculées dynamiquement) ===
      stats: {
        totalBlocks: content.length,
        totalImages: Object.keys(imagesData).length,
        // Compte dynamique par type de bloc
        ...Object.fromEntries(
          Object.entries(typeCount).map(([type, count]) => [`total_${type}`, count])
        )
      },

      // === MÉTADONNÉES ===
      timestamp: new Date().toISOString()
    };

    console.log('Payload WordPress:', JSON.stringify(payload, null, 2));

    const response = await fetch(ENDPOINTS.WORDPRESS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Erreur WordPress: ${response.status}`);
    }

    const result = await response.json().catch(() => response.text());
    return result;
  } catch (error) {
    console.error('Erreur publication WordPress:', error);
    throw error;
  }
};