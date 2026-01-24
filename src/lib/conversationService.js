import { supabase } from './supabase';

// ============ CONVERSATIONS ============

// Récupérer toutes les conversations de l'utilisateur connecté
export const getConversations = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: 'Non connecté' };

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', user.id)
    .order('last_update', { ascending: false });

  return { data: data || [], error };
};

// Créer une nouvelle conversation
export const createConversation = async (title = 'Nouvelle discussion') => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'Non connecté' };

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: user.id,
      title,
      last_update: new Date().toISOString()
    })
    .select()
    .single();

  return { data, error };
};

// Mettre à jour le titre d'une conversation
export const updateConversationTitle = async (conversationId, title) => {
  const { data, error } = await supabase
    .from('conversations')
    .update({ title, last_update: new Date().toISOString() })
    .eq('id', conversationId)
    .select()
    .single();

  return { data, error };
};

// Mettre à jour last_update d'une conversation
export const touchConversation = async (conversationId) => {
  const { error } = await supabase
    .from('conversations')
    .update({ last_update: new Date().toISOString() })
    .eq('id', conversationId);

  return { error };
};

// Supprimer une conversation (et ses messages en cascade)
export const deleteConversation = async (conversationId) => {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId);

  return { error };
};

// ============ MESSAGES ============

// Récupérer les messages d'une conversation
export const getMessages = async (conversationId) => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  return { data: data || [], error };
};

// Ajouter un message
export const addMessage = async (conversationId, message) => {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender: message.sender,
      text: message.text || null,
      type: message.type || 'text',
      audio_url: message.audio_url || null,
      duration: message.duration || null
    })
    .select()
    .single();

  // Mettre à jour last_update de la conversation
  if (!error) {
    await touchConversation(conversationId);
  }

  return { data, error };
};

// Supprimer un message
export const deleteMessage = async (messageId) => {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId);

  return { error };
};
