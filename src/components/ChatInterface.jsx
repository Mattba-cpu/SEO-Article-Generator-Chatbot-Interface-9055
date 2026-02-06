import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import MessageBubble from './MessageBubble';
import InputArea from './InputArea';
import TypingIndicator from './TypingIndicator';
import Header from './Header';
import Sidebar from './Sidebar';
import HomePage from './HomePage';
import SettingsModal from './SettingsModal';
import ArticlePublishModal, { parseArticleFromMessage } from './ArticlePublishModal';
import { useAuth } from '../contexts/AuthContext';
import { sendChatMessage, extractWebhookResponse, publishToWordPress } from '../lib/api';
import {
  getConversations,
  createConversation,
  deleteConversation as deleteConv,
  getMessages,
  addMessage
} from '../lib/conversationService';
import { jsPDF } from 'jspdf';

// Messages de succès pour la publication WordPress
const SUCCESS_MESSAGES = [
  "Parfait ! Ton article est en ligne sur WordPress.",
  "C'est fait ! L'article a été publié avec succès.",
  "Article publié ! Tu peux le consulter et le peaufiner si besoin.",
  "Nickel, l'article est maintenant sur WordPress en brouillon.",
  "Publication réussie ! Clique sur le lien pour voir ton article.",
  "Voilà, c'est en ligne ! L'article t'attend sur WordPress."
];

const ChatInterface = () => {
  const { user } = useAuth();
  const [showHomePage, setShowHomePage] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);

  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [waitingForAudioResponse, setWaitingForAudioResponse] = useState(false);
  const messagesEndRef = useRef(null);
  const pendingConversationRef = useRef(null); // Track which conversation is waiting for response

  // État pour le modal de publication WordPress
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [articleToPublish, setArticleToPublish] = useState(null);

  // Générer un titre intelligent basé sur le premier message
  const generateTitle = (text) => {
    const cleaned = text
      .replace(/^(salut|bonjour|hello|hey|coucou)[,.\s]*/i, '')
      .replace(/^(je veux|je voudrais|il faut|peux-tu|est-ce que tu peux)[,.\s]*/i, '')
      .replace(/^(me |m'|nous )/i, '')
      .trim();

    const words = cleaned.split(' ').slice(0, 8).join(' ');

    if (words.length > 50) {
      return words.slice(0, 50) + '...';
    }
    return words || 'Nouvelle discussion';
  };

  // Charger les conversations de l'utilisateur
  const loadConversations = useCallback(async () => {
    if (!user) return;

    setIsLoadingConversations(true);
    const { data, error } = await getConversations();

    if (!error) {
      setConversations(data);
    }
    setIsLoadingConversations(false);
  }, [user]);

  // Charger les conversations au montage
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Charger les messages quand on sélectionne une conversation
  useEffect(() => {
    const loadMessages = async () => {
      if (!currentConversationId) {
        setMessages([]);
        return;
      }

      const { data, error } = await getMessages(currentConversationId);

      if (!error) {
        // Transformer les données pour le format attendu par les composants
        const formattedMessages = data.map(msg => ({
          id: msg.id,
          text: msg.text,
          sender: msg.sender,
          type: msg.type,
          duration: msg.duration,
          timestamp: msg.created_at
        }));
        setMessages(formattedMessages);
      }
    };

    loadMessages();
  }, [currentConversationId]);

  // Scroll automatique
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Créer une nouvelle conversation avec un message initial
  const startNewConversation = async (initialMessage) => {
    const title = generateTitle(initialMessage);
    const { data: newConv, error } = await createConversation(title);

    if (error || !newConv) {
      console.error('Erreur création conversation:', error);
      return;
    }

    // Ajouter à la liste locale
    setConversations(prev => [newConv, ...prev]);
    setCurrentConversationId(newConv.id);
    setMessages([]);
    setShowHomePage(false);

    // Envoyer le message initial
    setTimeout(() => {
      sendMessageInternal(initialMessage, newConv.id);
    }, 100);
  };

  // Sélectionner une conversation existante
  const selectConversation = (id) => {
    if (id === currentConversationId) return;
    // Reset loading state when switching conversations
    setIsLoading(false);
    setWaitingForAudioResponse(false);
    setCurrentConversationId(id);
    setShowHomePage(false);
  };

  // Retour à la page d'accueil
  const goToHomePage = () => {
    setShowHomePage(true);
    setCurrentConversationId(null);
    setMessages([]);
  };

  // Supprimer une conversation
  const deleteConversation = async (id) => {
    const { error } = await deleteConv(id);

    if (!error) {
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversationId === id) {
        goToHomePage();
      }
    }
  };

  const handleWebhookResponse = async (responseData) => {
    if (!waitingForAudioResponse && !isLoading) return;

    const targetConversationId = pendingConversationRef.current || currentConversationId;

    setWaitingForAudioResponse(false);
    setIsLoading(false);
    pendingConversationRef.current = null;

    const aiResponse = extractWebhookResponse(responseData);

    // Sauvegarder en BDD
    const { data: savedMsg } = await addMessage(targetConversationId, {
      sender: 'ai',
      text: aiResponse,
      type: 'text'
    });

    // Only update UI if still on the same conversation
    if (savedMsg && currentConversationId === targetConversationId) {
      setMessages(prev => [
        ...prev,
        {
          id: savedMsg.id,
          text: aiResponse,
          sender: 'ai',
          type: 'text',
          timestamp: savedMsg.created_at,
          isArticle: aiResponse.toLowerCase().includes('titre :')
        }
      ]);
    }
  };

  const sendMessageInternal = async (text, conversationId) => {
    // Sauvegarder le message utilisateur en BDD
    const { data: userMsg } = await addMessage(conversationId, {
      sender: 'user',
      text,
      type: 'text'
    });

    if (userMsg) {
      setMessages(prev => [
        ...prev,
        {
          id: userMsg.id,
          text,
          sender: 'user',
          type: 'text',
          timestamp: userMsg.created_at
        }
      ]);
    }

    setInputValue('');
    setIsLoading(true);
    pendingConversationRef.current = conversationId;

    try {
      const response = await sendChatMessage(text, conversationId);
      const aiResponse = extractWebhookResponse(response);

      // Sauvegarder la réponse IA en BDD
      const { data: aiMsg } = await addMessage(conversationId, {
        sender: 'ai',
        text: aiResponse,
        type: 'text'
      });

      // Only update UI if still on the same conversation
      if (aiMsg && currentConversationId === conversationId) {
        setMessages(prev => [
          ...prev,
          {
            id: aiMsg.id,
            text: aiResponse,
            sender: 'ai',
            type: 'text',
            timestamp: aiMsg.created_at,
            isArticle: aiResponse.toLowerCase().includes('titre :')
          }
        ]);
      }

      // Mettre à jour la liste des conversations (last_update)
      setConversations(prev =>
        prev.map(c =>
          c.id === conversationId
            ? { ...c, last_update: new Date().toISOString() }
            : c
        ).sort((a, b) => new Date(b.last_update) - new Date(a.last_update))
      );

    } catch (error) {
      console.error('Error:', error);
    } finally {
      // Only reset loading if this was the pending conversation
      if (pendingConversationRef.current === conversationId) {
        setIsLoading(false);
        pendingConversationRef.current = null;
      }
    }
  };

  const sendMessage = async (messageContent) => {
    if (isLoading && typeof messageContent !== 'object') return;

    if (typeof messageContent === 'object') {
      if (messageContent.type === 'webhookResponse') {
        handleWebhookResponse(messageContent.content);
        return;
      } else if (messageContent.type === 'audio') {
        // Pour l'audio, on sauvegarde aussi en BDD
        const { data: audioMsg } = await addMessage(currentConversationId, {
          sender: 'user',
          type: 'audio',
          duration: messageContent.duration || 0
        });

        if (audioMsg) {
          setMessages(prev => [
            ...prev,
            {
              id: audioMsg.id,
              type: 'audio',
              audioBlob: messageContent.content, // Blob local pour lecture
              duration: messageContent.duration || 0,
              sender: 'user',
              timestamp: audioMsg.created_at
            }
          ]);
        }

        if (messageContent.expectResponse) {
          setIsLoading(true);
          setWaitingForAudioResponse(true);
          pendingConversationRef.current = currentConversationId;
        }
        return;
      }
    }

    const text = typeof messageContent === 'string' ? messageContent.trim() : '';
    if (!text) return;

    await sendMessageInternal(text, currentConversationId);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Export O'Live Prod", 10, 20);
    let y = 40;
    messages.forEach((msg) => {
      if (msg.type === 'audio') return;
      const sender = msg.sender === 'user' ? 'Moi' : 'IA';
      const lines = doc.splitTextToSize(`${sender}: ${msg.text}`, 180);
      doc.text(lines, 10, y);
      y += lines.length * 7;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });
    doc.save(`chat-${currentConversationId?.slice(0, 8) || 'export'}.pdf`);
  };

  // Ouvrir le modal de publication avec l'article parsé
  const handleOpenPublishModal = (messageText) => {
    const parsed = parseArticleFromMessage(messageText);
    if (parsed) {
      setArticleToPublish(parsed);
      setIsPublishModalOpen(true);
    }
  };

  // Publier l'article sur WordPress
  const handlePublishToWordPress = async (articleData) => {
    try {
      const result = await publishToWordPress(articleData);

      // Fermer le modal immédiatement
      setIsPublishModalOpen(false);
      setArticleToPublish(null);

      // Choisir un message aléatoire
      const randomMessage = SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)];
      const articleUrl = result?.postUrl || result?.editUrl || '#';

      // Créer le message de confirmation avec le lien
      const confirmationText = `${randomMessage}\n\n🔗 [Voir l'article sur WordPress](${articleUrl})`;

      // Ajouter directement dans les messages (pas de sendMessageInternal qui déclenche l'IA)
      const { data: savedMsg } = await addMessage(currentConversationId, {
        sender: 'ai',
        text: confirmationText,
        type: 'text'
      });

      if (savedMsg) {
        setMessages(prev => [
          ...prev,
          {
            id: savedMsg.id,
            text: confirmationText,
            sender: 'ai',
            type: 'text',
            timestamp: savedMsg.created_at
          }
        ]);
      }

    } catch (error) {
      console.error('Erreur publication WordPress:', error);
      throw error;
    }
  };

  // Afficher la page d'accueil
  if (showHomePage) {
    return (
      <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
        <HomePage
          conversations={conversations}
          onSelectConversation={selectConversation}
          onNewConversation={startNewConversation}
          onDeleteConversation={deleteConversation}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isLoading={isLoadingConversations}
        />
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </div>
    );
  }

  // Afficher la vue chat
  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      <Sidebar
        isOpen={isSidebarOpen}
        conversations={conversations}
        currentSessionId={currentConversationId}
        onSelectConversation={selectConversation}
        onNewChat={goToHomePage}
        onDeleteConversation={deleteConversation}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} sidebarOpen={isSidebarOpen} onGoHome={goToHomePage} />

        <div className="flex-1 overflow-y-auto bg-[#0a0a0a]">
          <div className="max-w-4xl mx-auto p-4">
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={{ ...m, timestamp: new Date(m.timestamp) }}
                  onDownload={downloadPDF}
                  onPublishArticle={handleOpenPublishModal}
                />
              ))}
              {isLoading && <TypingIndicator />}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        </div>

        <InputArea value={inputValue} onChange={setInputValue} onSend={sendMessage} isLoading={isLoading} sessionId={currentConversationId} />
      </div>

      {/* Modal de publication WordPress */}
      <ArticlePublishModal
        isOpen={isPublishModalOpen}
        onClose={() => {
          setIsPublishModalOpen(false);
          setArticleToPublish(null);
        }}
        article={articleToPublish}
        onPublish={handlePublishToWordPress}
      />
    </div>
  );
};

export default ChatInterface;
