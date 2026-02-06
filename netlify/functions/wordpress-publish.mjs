/**
 * Netlify Function pour publier un article sur WordPress avec Divi Builder
 *
 * Cette fonction :
 * 1. Reçoit les données d'article du frontend
 * 2. Upload les images vers la médiathèque WordPress
 * 3. Génère le contenu au format Divi Builder
 * 4. Crée l'article en brouillon
 */

// Helper pour encoder en base64 les credentials
const btoa = (str) => Buffer.from(str).toString('base64');

/**
 * Upload une image vers la médiathèque WordPress
 */
async function uploadImageToWordPress(imageData, wpUrl, authHeader) {
  const { base64, filename, mimeType, alt } = imageData;

  // Convertir base64 en buffer
  const base64Data = base64.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  // Upload vers WordPress Media Library (rest_route pour compatibilité serveur)
  const response = await fetch(`${wpUrl}/index.php?rest_route=/wp/v2/media`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
    body: buffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur upload image: ${response.status} - ${errorText}`);
  }

  const mediaData = await response.json();

  // Mettre à jour l'alt text si fourni
  if (alt) {
    await fetch(`${wpUrl}/index.php?rest_route=/wp/v2/media/${mediaData.id}`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ alt_text: alt }),
    });
  }

  return {
    id: mediaData.id,
    url: mediaData.source_url,
    alt: alt || '',
  };
}

/**
 * Génère le contenu Divi complet (format Template O.Live EXACT)
 *
 * Structure FIXE (toujours identique) :
 * - Section 1
 *   - Row 1 : Texte (intro)
 *   - Row 2 : Pixel Image Slider + Texte + Vidéo + Texte + Pixel Image Slider
 *   - Row 3 : Texte + Bouton
 * - Section 2 (vide)
 */
function generateDiviContent(blocks, imageUrls) {
  const moduleAttrs = '_builder_version="4.27.4" _module_preset="default" global_colors_info="{}"';

  // Extraire le contenu des blocs pour remplir la template
  let introHtml = '';
  let texte1Html = '';
  let texte2Html = '';
  let videoUrl = '';
  const imageUrlsList = Object.values(imageUrls);

  // Parcourir les blocs et extraire le contenu
  let textBlockIndex = 0;
  blocks.forEach((block) => {
    if (block.type === 'heading') {
      const content = block.text || '';
      const level = block.level || 2;
      let html;
      if (level === 1) {
        html = `<h1><strong>${content}</strong></h1>`;
      } else if (level === 3) {
        html = `<h3><strong>${content}</strong></h3>`;
      } else if (level === 4) {
        html = `<h4><em><span style="font-size: medium;">${content}</span></em></h4>`;
      } else {
        html = `<h${level}><strong>${content}</strong></h${level}>`;
      }

      if (!introHtml) {
        introHtml += html;
      } else if (!texte1Html || textBlockIndex === 0) {
        texte1Html += html;
        textBlockIndex = 1;
      } else {
        texte2Html += html;
      }
    } else if (block.type === 'paragraph') {
      const content = block.text || '';
      const html = `<p>${content}</p>`;

      if (!introHtml || introHtml.includes('<h1>')) {
        introHtml += html;
      } else if (textBlockIndex === 0 || !texte1Html) {
        texte1Html += html;
        textBlockIndex = 1;
      } else {
        texte2Html += html;
      }
    } else if (block.type === 'list') {
      const tag = block.listType === 'ordered' ? 'ol' : 'ul';
      const content = block.text || '';
      const html = `<${tag}>${content}</${tag}>`;

      if (textBlockIndex === 0 || !texte1Html) {
        texte1Html += html;
        textBlockIndex = 1;
      } else {
        texte2Html += html;
      }
    } else if (block.type === 'video') {
      videoUrl = block.src || block.url || '';
    }
  });

  // Si pas de contenu, mettre des placeholders
  if (!introHtml) introHtml = '<h1><strong>Titre de l\'article</strong></h1><p>Introduction de l\'article.</p>';
  if (!texte1Html) texte1Html = '<p>&nbsp;</p>';
  if (!texte2Html) texte2Html = '<p>&nbsp;</p>';

  // URLs des images (ou vide si pas d'images)
  const image1Url = imageUrlsList[0] || '';
  const image2Url = imageUrlsList[1] || imageUrlsList[0] || '';

  // === STRUCTURE FIXE TEMPLATE O.LIVE ===

  // Section 1
  const section1Attrs = 'fb_built="1" _builder_version="4.16" global_colors_info="{}"';

  // Row 1 : Texte intro
  const row1Attrs = '_builder_version="4.16" background_size="initial" background_position="top_left" background_repeat="repeat" global_colors_info="{}"';
  const col1Attrs = 'type="4_4" _builder_version="4.16" custom_padding="|||" global_colors_info="{}" custom_padding__hover="|||"';
  const text1Attrs = '_builder_version="4.27.4" background_size="initial" background_position="top_left" background_repeat="repeat" custom_padding="2px|||||" global_colors_info="{}"';

  const row1 = `[et_pb_row ${row1Attrs}][et_pb_column ${col1Attrs}][et_pb_text ${text1Attrs}]${introHtml}[/et_pb_text][/et_pb_column][/et_pb_row]`;

  // Row 2 : Pixel Image Slider + Texte + Vidéo + Texte + Pixel Image Slider
  const row2Attrs = '_builder_version="4.27.4" _module_preset="default" global_colors_info="{}"';
  const col2Attrs = 'type="4_4" _builder_version="4.27.4" _module_preset="default" global_colors_info="{}"';

  // Module 1: Pixel Image Slider
  const pixelSlider1 = `[dipi_image_gallery admin_label="Pixel Image Slider" ${moduleAttrs}][dipi_image_gallery_child item_image="${image1Url}" ${moduleAttrs}][/dipi_image_gallery_child][/dipi_image_gallery]`;

  // Module 2: Texte
  const texteModule1 = `[et_pb_text ${moduleAttrs}]${texte1Html}[/et_pb_text]`;

  // Module 3: Vidéo
  const videoModule = `[et_pb_video src="${videoUrl}" admin_label="Vidéo" ${moduleAttrs}][/et_pb_video]`;

  // Module 4: Texte
  const texteModule2 = `[et_pb_text ${moduleAttrs}]${texte2Html}[/et_pb_text]`;

  // Module 5: Pixel Image Slider
  const pixelSlider2 = `[dipi_image_gallery admin_label="Pixel Image Slider" ${moduleAttrs} width="100%" max_width="67%" module_alignment="center" height="734px"][dipi_image_gallery_child item_image="${image2Url}" ${moduleAttrs}][/dipi_image_gallery_child][/dipi_image_gallery]`;

  const row2 = `[et_pb_row ${row2Attrs}][et_pb_column ${col2Attrs}]${pixelSlider1}${texteModule1}${videoModule}${texteModule2}${pixelSlider2}[/et_pb_column][/et_pb_row]`;

  // Row 3 : Texte CTA + Bouton
  const row3Attrs = '_builder_version="4.27.4" _module_preset="default" global_colors_info="{}"';

  const ctaText = `[et_pb_text ${moduleAttrs}]<h3><span style="font-size: 14px; color: #666666;">Prêt à donner une nouvelle dimension à votre projet ?</span></h3>
<p><span>Offrez à vos spectateurs une expérience immersive unique grâce à nos solutions complètes de captation et diffusion live ! Notre équipe d'experts met à votre disposition un dispositif technique de pointe.</span></p>
<p><span>Basés à Meyreuil, nous intervenons dans toute la France pour donner vie à vos événements.</span></p>[/et_pb_text]`;

  const ctaButton = `[et_pb_button button_url="https://olive-prod.fr/?page_id=300" button_text="CONTACT" button_alignment="center" ${moduleAttrs}][/et_pb_button]`;

  const row3 = `[et_pb_row ${row3Attrs}][et_pb_column ${col2Attrs}]${ctaText}${ctaButton}[/et_pb_column][/et_pb_row]`;

  // Section 2 (vide)
  const section2 = `[et_pb_section fb_built="1" _builder_version="4.27.4" _module_preset="default" global_colors_info="{}"][/et_pb_section]`;

  // Structure complète
  return `[et_pb_section ${section1Attrs}]${row1}${row2}${row3}[/et_pb_section]${section2}`;
}

/**
 * Handler principal de la Netlify Function
 */
export async function handler(event) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Récupérer les credentials depuis les variables d'environnement
    const wpUrl = process.env.WORDPRESS_URL;
    const wpUser = process.env.WORDPRESS_USER;
    const wpPassword = process.env.WORDPRESS_APP_PASSWORD;

    // Debug: voir quelles variables sont définies
    const missing = [];
    if (!wpUrl) missing.push('WORDPRESS_URL');
    if (!wpUser) missing.push('WORDPRESS_USER');
    if (!wpPassword) missing.push('WORDPRESS_APP_PASSWORD');

    if (missing.length > 0) {
      console.log('Variables présentes:', {
        WORDPRESS_URL: !!wpUrl,
        WORDPRESS_USER: !!wpUser,
        WORDPRESS_APP_PASSWORD: !!wpPassword
      });
      throw new Error(`Variables WordPress manquantes: ${missing.join(', ')}`);
    }

    // Parse le body
    const payload = JSON.parse(event.body);
    const { title, metaDescription, content, images } = payload;

    if (!title || !content) {
      throw new Error('Données manquantes: title et content requis');
    }

    // Authentification WordPress (Basic Auth avec Application Password)
    const authHeader = `Basic ${btoa(`${wpUser}:${wpPassword}`)}`;

    // === 1. Upload des images vers WordPress ===
    const imageUrls = {};

    if (images && Object.keys(images).length > 0) {
      console.log(`Upload de ${Object.keys(images).length} image(s)...`);

      for (const [key, imageData] of Object.entries(images)) {
        try {
          const uploaded = await uploadImageToWordPress(imageData, wpUrl, authHeader);
          imageUrls[key] = uploaded.url;
          console.log(`Image ${key} uploadée: ${uploaded.url}`);
        } catch (error) {
          console.error(`Erreur upload ${key}:`, error.message);
          // On continue même si une image échoue
        }
      }
    }

    // === 2. Générer le contenu Divi ===
    const diviContent = generateDiviContent(content, imageUrls);
    console.log('Contenu Divi généré');

    // === 3. Créer l'article WordPress ===
    const postData = {
      title: title,
      content: diviContent,
      status: 'draft', // Publié en brouillon par sécurité
      meta: {
        // Meta Divi pour activer le Builder
        '_et_pb_use_builder': 'on',
        '_et_pb_page_layout': 'et_no_sidebar',
        '_et_pb_post_hide_nav': 'default',
        // Meta Yoast SEO
        '_yoast_wpseo_metadesc': metaDescription || '',
      },
    };

    const postResponse = await fetch(`${wpUrl}/index.php?rest_route=/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData),
    });

    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      throw new Error(`Erreur création article: ${postResponse.status} - ${errorText}`);
    }

    const post = await postResponse.json();
    console.log(`Article créé: ${post.link}`);

    // === 4. Retourner le résultat ===
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        postId: post.id,
        postUrl: post.link,
        editUrl: `${wpUrl}/wp-admin/post.php?post=${post.id}&action=edit`,
        imagesUploaded: Object.keys(imageUrls).length,
        message: `Article "${title}" créé en brouillon`,
      }),
    };

  } catch (error) {
    console.error('Erreur wordpress-publish:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
}
