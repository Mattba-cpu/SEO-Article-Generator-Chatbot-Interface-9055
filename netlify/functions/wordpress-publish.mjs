/**
 * Netlify Function pour publier un article sur WordPress avec Divi Builder
 * Structure fixe Template O.Live
 */

import sharp from 'sharp';

const btoa = (str) => Buffer.from(str).toString('base64');

const IMAGE_CONFIG = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 85,
};

/**
 * Traite une image (redimensionne sans crop)
 */
async function processImage(base64Data) {
  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
  const inputBuffer = Buffer.from(cleanBase64, 'base64');

  return sharp(inputBuffer)
    .resize(IMAGE_CONFIG.maxWidth, IMAGE_CONFIG.maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: IMAGE_CONFIG.quality })
    .toBuffer();
}

/**
 * Upload une image vers WordPress
 */
async function uploadImageToWordPress(imageData, wpUrl, authHeader) {
  const { base64, name } = imageData;

  const buffer = await processImage(base64);
  const fileName = name.replace(/\.[^.]+$/, '.jpg');

  const response = await fetch(`${wpUrl}/index.php?rest_route=/wp/v2/media`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'image/jpeg',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
    body: buffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur upload image: ${response.status} - ${errorText}`);
  }

  const mediaData = await response.json();
  return { id: mediaData.id, url: mediaData.source_url };
}

/**
 * Génère le contenu Divi (Template O.Live)
 */
function generateDiviContent(template, slider1Urls, slider2Urls) {
  const moduleAttrs = '_builder_version="4.27.4" _module_preset="default" global_colors_info="{}"';
  const { intro, texte1, videoUrl, texte2 } = template;

  const introHtml = intro ? `<p>${intro}</p>` : '<p>&nbsp;</p>';
  const texte1Html = texte1
    ? texte1.split('\n').filter(l => l.trim()).map(p => `<p>${p}</p>`).join('\n')
    : '<p>&nbsp;</p>';
  const texte2Html = texte2
    ? texte2.split('\n').filter(l => l.trim()).map(p => `<p>${p}</p>`).join('\n')
    : '<p>&nbsp;</p>';

  // Section 1
  const section1Attrs = 'fb_built="1" _builder_version="4.16" global_colors_info="{}"';
  const row1Attrs = '_builder_version="4.16" background_size="initial" background_position="top_left" background_repeat="repeat" global_colors_info="{}"';
  const col1Attrs = 'type="4_4" _builder_version="4.16" custom_padding="|||" global_colors_info="{}" custom_padding__hover="|||"';
  const text1Attrs = '_builder_version="4.27.4" background_size="initial" background_position="top_left" background_repeat="repeat" custom_padding="2px|||||" global_colors_info="{}"';

  const row1 = `[et_pb_row ${row1Attrs}][et_pb_column ${col1Attrs}][et_pb_text ${text1Attrs}]${introHtml}[/et_pb_text][/et_pb_column][/et_pb_row]`;

  // Row 2 : Contenu principal
  const row2Attrs = '_builder_version="4.27.4" _module_preset="default" global_colors_info="{}"';
  const col2Attrs = 'type="4_4" _builder_version="4.27.4" _module_preset="default" global_colors_info="{}"';

  // Slider 1
  let imageModule1 = '';
  if (slider1Urls.length === 1) {
    imageModule1 = `[et_pb_image src="${slider1Urls[0]}" alt="" title_text="" align="center" ${moduleAttrs}][/et_pb_image]`;
  } else if (slider1Urls.length > 1) {
    const children = slider1Urls.map(url =>
      `[dipi_image_gallery_child item_image="${url}" item_image_size="full" ${moduleAttrs}][/dipi_image_gallery_child]`
    ).join('');
    const sliderAttrs = `gallery_style="slider" gallery_image_size="full" slider_effect="slide" show_arrows="on" show_dots="on" slider_loop="on" slider_image_fit="contain" use_original_ratio="on" slider_item_width="100%" ${moduleAttrs}`;
    imageModule1 = `[dipi_image_gallery admin_label="Pixel Image Slider" ${sliderAttrs}]${children}[/dipi_image_gallery]`;
  } else {
    imageModule1 = `[et_pb_image src="" alt="" ${moduleAttrs}][/et_pb_image]`;
  }

  const texteModule1 = `[et_pb_text ${moduleAttrs}]${texte1Html}[/et_pb_text]`;
  const videoModule = `[et_pb_video src="${videoUrl || ''}" admin_label="Vidéo" ${moduleAttrs}][/et_pb_video]`;
  const texteModule2 = `[et_pb_text ${moduleAttrs}]${texte2Html}[/et_pb_text]`;

  // Slider 2
  let imageModule2 = '';
  if (slider2Urls.length === 1) {
    imageModule2 = `[et_pb_image src="${slider2Urls[0]}" alt="" title_text="" align="center" ${moduleAttrs}][/et_pb_image]`;
  } else if (slider2Urls.length > 1) {
    const children = slider2Urls.map(url =>
      `[dipi_image_gallery_child item_image="${url}" item_image_size="full" ${moduleAttrs}][/dipi_image_gallery_child]`
    ).join('');
    const sliderAttrs = `gallery_style="slider" gallery_image_size="full" slider_effect="slide" show_arrows="on" show_dots="on" slider_loop="on" slider_image_fit="contain" use_original_ratio="on" slider_item_width="100%" ${moduleAttrs}`;
    imageModule2 = `[dipi_image_gallery admin_label="Pixel Image Slider" ${sliderAttrs}]${children}[/dipi_image_gallery]`;
  } else {
    imageModule2 = `[et_pb_image src="" alt="" ${moduleAttrs}][/et_pb_image]`;
  }

  const row2 = `[et_pb_row ${row2Attrs}][et_pb_column ${col2Attrs}]${imageModule1}${texteModule1}${videoModule}${texteModule2}${imageModule2}[/et_pb_column][/et_pb_row]`;

  // Row 3 : CTA
  const row3Attrs = '_builder_version="4.27.4" _module_preset="default" global_colors_info="{}"';
  const ctaText = `[et_pb_text ${moduleAttrs}]<h3><span style="font-size: 14px; color: #666666;">Prêt à donner une nouvelle dimension à votre projet ?</span></h3>
<p><span>Offrez à vos spectateurs une expérience immersive unique grâce à nos solutions complètes de captation et diffusion live ! Notre équipe d'experts met à votre disposition un dispositif technique de pointe.</span></p>
<p><span>Basés à Meyreuil, nous intervenons dans toute la France pour donner vie à vos événements.</span></p>[/et_pb_text]`;
  const ctaButton = `[et_pb_button button_url="https://olive-prod.fr/?page_id=300" button_text="CONTACT" button_alignment="center" ${moduleAttrs}][/et_pb_button]`;
  const row3 = `[et_pb_row ${row3Attrs}][et_pb_column ${col2Attrs}]${ctaText}${ctaButton}[/et_pb_column][/et_pb_row]`;

  // Section 2 (vide)
  const section2 = `[et_pb_section fb_built="1" _builder_version="4.27.4" _module_preset="default" global_colors_info="{}"][/et_pb_section]`;

  return `[et_pb_section ${section1Attrs}]${row1}${row2}${row3}[/et_pb_section]${section2}`;
}

/**
 * Handler principal
 */
export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
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

    const payload = JSON.parse(event.body);
    const { title, metaDescription, template } = payload;

    if (!title) {
      throw new Error('Titre requis');
    }

    const authHeader = `Basic ${btoa(`${wpUser}:${wpPassword}`)}`;

    // Upload images Slider 1
    const slider1Urls = [];
    if (template?.slider1?.length > 0) {
      for (const imageData of template.slider1) {
        try {
          const uploaded = await uploadImageToWordPress(imageData, wpUrl, authHeader);
          slider1Urls.push(uploaded.url);
        } catch (error) {
          console.error('Erreur upload slider1:', error.message);
        }
      }
    }

    // Upload images Slider 2
    const slider2Urls = [];
    if (template?.slider2?.length > 0) {
      for (const imageData of template.slider2) {
        try {
          const uploaded = await uploadImageToWordPress(imageData, wpUrl, authHeader);
          slider2Urls.push(uploaded.url);
        } catch (error) {
          console.error('Erreur upload slider2:', error.message);
        }
      }
    }

    // Générer le contenu Divi
    const diviContent = generateDiviContent(template || {}, slider1Urls, slider2Urls);

    // Créer l'article WordPress
    const fullContent = `[et_pb_section fb_built="1" _builder_version="4.16" global_colors_info="{}"][et_pb_row _builder_version="4.16" background_size="initial" background_position="top_left" background_repeat="repeat" global_colors_info="{}"][et_pb_column type="4_4" _builder_version="4.16" custom_padding="|||" global_colors_info="{}" custom_padding__hover="|||"][et_pb_text _builder_version="4.27.4" background_size="initial" background_position="top_left" background_repeat="repeat" custom_padding="2px|||||" global_colors_info="{}"]<h1><strong>${title}</strong></h1>
<p>${template?.intro || ''}</p>[/et_pb_text][/et_pb_column][/et_pb_row]${diviContent.replace(/^\[et_pb_section[^\]]*\]\[et_pb_row[^\]]*\]\[et_pb_column[^\]]*\]\[et_pb_text[^\]]*\][^[]*\[\/et_pb_text\]\[\/et_pb_column\]\[\/et_pb_row\]/, '')}`;

    const postData = {
      title,
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
    console.error('Erreur wordpress-publish:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
}
