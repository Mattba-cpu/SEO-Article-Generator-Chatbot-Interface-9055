// URLs des webhooks depuis les variables d'environnement
export const ENDPOINTS = {
  CHAT: import.meta.env.VITE_WEBHOOK_CHAT_URL,
  AUDIO: import.meta.env.VITE_WEBHOOK_AUDIO_URL
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