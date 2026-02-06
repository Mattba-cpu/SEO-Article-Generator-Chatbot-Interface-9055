import { supabase } from './supabase';

/**
 * Récupérer tous les posts WordPress de l'utilisateur
 */
export const getWordPressPosts = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: 'Non connecté' };

  const { data, error } = await supabase
    .from('wordpress_posts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return { data: data || [], error };
};

/**
 * Sauvegarder un nouveau post WordPress
 */
export const saveWordPressPost = async (postData) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'Non connecté' };

  const { data, error } = await supabase
    .from('wordpress_posts')
    .insert({
      user_id: user.id,
      title: postData.title,
      post_url: postData.postUrl,
      edit_url: postData.editUrl || null,
      wordpress_post_id: postData.postId || null
    })
    .select()
    .single();

  return { data, error };
};

/**
 * Supprimer un post WordPress de la galerie
 */
export const deleteWordPressPost = async (postId) => {
  const { error } = await supabase
    .from('wordpress_posts')
    .delete()
    .eq('id', postId);

  return { error };
};
