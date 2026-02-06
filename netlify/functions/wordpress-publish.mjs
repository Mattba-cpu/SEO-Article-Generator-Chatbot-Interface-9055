/**
 * Netlify Function pour publier un article sur WordPress avec Divi Builder
 * Structure fixe Template O.Live :
 * - Section 1
 *   - Row 1 : Texte (intro H1 + paragraphe)
 *   - Row 2 : Pixel Image Slider 1 + Texte 1 + Vidéo + Texte 2 + Pixel Image Slider 2
 *   - Row 3 : Texte CTA + Bouton
 * - Section 2 (vide)
 */

// Helper pour encoder en base64 les credentials
const btoa = (str) => Buffer.from(str).toString('base64');

/**
 * Upload une image vers la médiathèque WordPress
 */
async function uploadImageToWordPress(imageData, wpUrl, authHeader) {
  const { base64, name, type } = imageData;

  // Convertir base64 en buffer
  const base64Data = base64.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  // Upload vers WordPress Media Library
  const response = await fetch(`${wpUrl}/index.php?rest_route=/wp/v2/media`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': type,
      'Content-Disposition': `attachment; filename="${name}"`,
    },
    body: buffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur upload image: ${response.status} - ${errorText}`);
  }

  const mediaData = await response.json();

  return {
    id: mediaData.id,
    url: mediaData.source_url,
  };
}

/**
 * Génère le contenu Divi complet (format Template O.Live EXACT)
 */
function generateDiviContent(template, slider1Urls, slider2Urls) {
  const moduleAttrs = '_builder_version="4.27.4" _module_preset="default" global_colors_info="{}"';

  // Extraire les données du template
  const { intro, texte1, videoUrl, texte2 } = template;

  // Construire le HTML de l'intro
  const introHtml = intro
    ? `<p>${intro}</p>`
    : '<p>&nbsp;</p>';

  // Construire le HTML du texte 1
  const texte1Html = texte1
    ? texte1.split('\n').filter(l => l.trim()).map(p => `<p>${p}</p>`).join('\n')
    : '<p>&nbsp;</p>';

  // Construire le HTML du texte 2
  const texte2Html = texte2
    ? texte2.split('\n').filter(l => l.trim()).map(p => `<p>${p}</p>`).join('\n')
    : '<p>&nbsp;</p>';

  // === STRUCTURE FIXE TEMPLATE O.LIVE ===

  // Section 1
  const section1Attrs = 'fb_built="1" _builder_version="4.16" global_colors_info="{}"';

  // Row 1 : Texte intro (sera combiné avec le titre dans postData)
  const row1Attrs = '_builder_version="4.16" background_size="initial" background_position="top_left" background_repeat="repeat" global_colors_info="{}"';
  const col1Attrs = 'type="4_4" _builder_version="4.16" custom_padding="|||" global_colors_info="{}" custom_padding__hover="|||"';
  const text1Attrs = '_builder_version="4.27.4" background_size="initial" background_position="top_left" background_repeat="repeat" custom_padding="2px|||||" global_colors_info="{}"';

  const row1 = `[et_pb_row ${row1Attrs}][et_pb_column ${col1Attrs}][et_pb_text ${text1Attrs}]${introHtml}[/et_pb_text][/et_pb_column][/et_pb_row]`;

  // Row 2 : Contenu principal
  const row2Attrs = '_builder_version="4.27.4" _module_preset="default" global_colors_info="{}"';
  const col2Attrs = 'type="4_4" _builder_version="4.27.4" _module_preset="default" global_colors_info="{}"';

  // Module 1: Images Slider 1
  // Si 1 seule image → et_pb_image simple
  // Si plusieurs images → dipi_image_gallery (carrousel)
  let imageModule1 = '';
  if (slider1Urls.length === 1) {
    // Image simple sans carrousel
    imageModule1 = `[et_pb_image src="${slider1Urls[0]}" alt="" title_text="" align="center" ${moduleAttrs}][/et_pb_image]`;
  } else if (slider1Urls.length > 1) {
    // Carrousel avec plusieurs images
    const slider1Children = slider1Urls.map(url =>
      `[dipi_image_gallery_child item_image="${url}" item_image_size="full" ${moduleAttrs}][/dipi_image_gallery_child]`
    ).join('');
    // Attributs pour un affichage correct du slider sans crop
    const sliderAttrs = `gallery_style="slider" gallery_image_size="full" slider_effect="slide" show_arrows="on" show_dots="on" slider_loop="on" slider_image_fit="contain" use_original_ratio="on" slider_item_width="100%" ${moduleAttrs}`;
    imageModule1 = `[dipi_image_gallery admin_label="Pixel Image Slider" ${sliderAttrs}]${slider1Children}[/dipi_image_gallery]`;
  } else {
    // Pas d'image - module vide
    imageModule1 = `[et_pb_image src="" alt="" ${moduleAttrs}][/et_pb_image]`;
  }

  // Module 2: Texte 1
  const texteModule1 = `[et_pb_text ${moduleAttrs}]${texte1Html}[/et_pb_text]`;

  // Module 3: Vidéo
  const videoModule = `[et_pb_video src="${videoUrl || ''}" admin_label="Vidéo" ${moduleAttrs}][/et_pb_video]`;

  // Module 4: Texte 2
  const texteModule2 = `[et_pb_text ${moduleAttrs}]${texte2Html}[/et_pb_text]`;

  // Module 5: Images Slider 2
  // Si 1 seule image → et_pb_image simple
  // Si plusieurs images → dipi_image_gallery (carrousel)
  let imageModule2 = '';
  if (slider2Urls.length === 1) {
    // Image simple sans carrousel
    imageModule2 = `[et_pb_image src="${slider2Urls[0]}" alt="" title_text="" align="center" ${moduleAttrs}][/et_pb_image]`;
  } else if (slider2Urls.length > 1) {
    // Carrousel avec plusieurs images
    const slider2Children = slider2Urls.map(url =>
      `[dipi_image_gallery_child item_image="${url}" item_image_size="full" ${moduleAttrs}][/dipi_image_gallery_child]`
    ).join('');
    // Attributs pour un affichage correct du slider sans crop
    const slider2Attrs = `gallery_style="slider" gallery_image_size="full" slider_effect="slide" show_arrows="on" show_dots="on" slider_loop="on" slider_image_fit="contain" use_original_ratio="on" slider_item_width="100%" ${moduleAttrs}`;
    imageModule2 = `[dipi_image_gallery admin_label="Pixel Image Slider" ${slider2Attrs}]${slider2Children}[/dipi_image_gallery]`;
  } else {
    // Pas d'image - module vide
    imageModule2 = `[et_pb_image src="" alt="" ${moduleAttrs}][/et_pb_image]`;
  }

  const row2 = `[et_pb_row ${row2Attrs}][et_pb_column ${col2Attrs}]${imageModule1}${texteModule1}${videoModule}${texteModule2}${imageModule2}[/et_pb_column][/et_pb_row]`;

  // Row 3 : CTA (Texte + Bouton)
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
    // Debug: taille du body reçu
    const bodySize = event.body ? event.body.length : 0;
    console.log(`Body reçu: ${bodySize} caractères (${(bodySize / 1024 / 1024).toFixed(2)} MB)`);

    // Récupérer les credentials depuis les variables d'environnement
    const wpUrl = process.env.WORDPRESS_URL;
    const wpUser = process.env.WORDPRESS_USER;
    const wpPassword = process.env.WORDPRESS_APP_PASSWORD;

    const missing = [];
    if (!wpUrl) missing.push('WORDPRESS_URL');
    if (!wpUser) missing.push('WORDPRESS_USER');
    if (!wpPassword) missing.push('WORDPRESS_APP_PASSWORD');

    if (missing.length > 0) {
      throw new Error(`Variables WordPress manquantes: ${missing.join(', ')}`);
    }

    // Parse le body
    let payload;
    try {
      payload = JSON.parse(event.body);
    } catch (parseError) {
      console.error('Erreur parsing JSON:', parseError.message);
      throw new Error(`Erreur parsing JSON: ${parseError.message}`);
    }

    const { title, metaDescription, template } = payload;
    console.log(`Titre: ${title}`);
    console.log(`Slider 1: ${template?.slider1?.length || 0} images`);
    console.log(`Slider 2: ${template?.slider2?.length || 0} images`);

    if (!title) {
      throw new Error('Titre requis');
    }

    // Authentification WordPress (Basic Auth avec Application Password)
    const authHeader = `Basic ${btoa(`${wpUser}:${wpPassword}`)}`;

    // === 1. Upload des images du Slider 1 ===
    const slider1Urls = [];
    if (template?.slider1 && template.slider1.length > 0) {
      console.log(`Upload de ${template.slider1.length} image(s) pour Slider 1...`);
      for (const imageData of template.slider1) {
        try {
          const uploaded = await uploadImageToWordPress(imageData, wpUrl, authHeader);
          slider1Urls.push(uploaded.url);
          console.log(`Image uploadée: ${uploaded.url}`);
        } catch (error) {
          console.error(`Erreur upload:`, error.message);
        }
      }
    }

    // === 2. Upload des images du Slider 2 ===
    const slider2Urls = [];
    if (template?.slider2 && template.slider2.length > 0) {
      console.log(`Upload de ${template.slider2.length} image(s) pour Slider 2...`);
      for (const imageData of template.slider2) {
        try {
          const uploaded = await uploadImageToWordPress(imageData, wpUrl, authHeader);
          slider2Urls.push(uploaded.url);
          console.log(`Image uploadée: ${uploaded.url}`);
        } catch (error) {
          console.error(`Erreur upload:`, error.message);
        }
      }
    }

    // === 3. Générer le contenu Divi ===
    const diviContent = generateDiviContent(template || {}, slider1Urls, slider2Urls);
    console.log('Contenu Divi généré');

    // === 4. Créer l'article WordPress ===
    // Le titre H1 est ajouté au début du contenu Divi
    const fullContent = `[et_pb_section fb_built="1" _builder_version="4.16" global_colors_info="{}"][et_pb_row _builder_version="4.16" background_size="initial" background_position="top_left" background_repeat="repeat" global_colors_info="{}"][et_pb_column type="4_4" _builder_version="4.16" custom_padding="|||" global_colors_info="{}" custom_padding__hover="|||"][et_pb_text _builder_version="4.27.4" background_size="initial" background_position="top_left" background_repeat="repeat" custom_padding="2px|||||" global_colors_info="{}"]<h1><strong>${title}</strong></h1>
<p>${template?.intro || ''}</p>[/et_pb_text][/et_pb_column][/et_pb_row]${diviContent.replace(/^\[et_pb_section[^\]]*\]\[et_pb_row[^\]]*\]\[et_pb_column[^\]]*\]\[et_pb_text[^\]]*\][^[]*\[\/et_pb_text\]\[\/et_pb_column\]\[\/et_pb_row\]/, '')}`;

    const postData = {
      title: title,
      content: fullContent,
      status: 'draft',
      meta: {
        '_et_pb_use_builder': 'on',
        '_et_pb_page_layout': 'et_no_sidebar',
        '_et_pb_post_hide_nav': 'default',
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

    // === 5. Retourner le résultat ===
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        postId: post.id,
        postUrl: post.link,
        editUrl: `${wpUrl}/wp-admin/post.php?post=${post.id}&action=edit`,
        imagesUploaded: slider1Urls.length + slider2Urls.length,
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
