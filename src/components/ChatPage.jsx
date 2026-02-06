import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import MessageBubble from './MessageBubble';
import InputArea from './InputArea';
import TypingIndicator from './TypingIndicator';
import Header from './Header';
import Sidebar from './Sidebar';
import SettingsModal from './SettingsModal';
import ArticlePublishModal, { parseArticleFromMessage } from './ArticlePublishModal';
import { sendChatMessage, extractWebhookResponse, publishToWordPress } from '../lib/api';
import {
  getConversations,
  createConversation,
  deleteConversation as deleteConv,
  getMessages,
  addMessage
} from '../lib/conversationService';
import { saveWordPressPost } from '../lib/wordpressService';
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

const ChatPage = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const initialMessageSent = useRef(false);

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [waitingForAudioResponse, setWaitingForAudioResponse] = useState(false);
  const messagesEndRef = useRef(null);
  const pendingConversationRef = useRef(null);

  // Modal de publication WordPress
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [articleToPublish, setArticleToPublish] = useState(null);

  // Charger les conversations pour la sidebar
  useEffect(() => {
    const loadConversations = async () => {
      const { data } = await getConversations();
      setConversations(data || []);
    };
    loadConversations();
  }, []);

  // Charger les messages de la conversation
  useEffect(() => {
    const loadMessages = async () => {
      if (!conversationId) return;

      const { data, error } = await getMessages(conversationId);
      if (!error) {
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
  }, [conversationId]);

  // Envoyer le message initial si présent (nouvelle conversation depuis HomePage)
  useEffect(() => {
    const initialMessage = location.state?.initialMessage;
    if (initialMessage && conversationId && !initialMessageSent.current) {
      initialMessageSent.current = true;
      // Petit délai pour s'assurer que le composant est monté
      setTimeout(() => {
        sendMessageInternal(initialMessage);
      }, 100);
    }
  }, [conversationId, location.state]);

  // Scroll automatique
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const selectConversation = (id) => {
    if (id === conversationId) return;
    setIsLoading(false);
    setWaitingForAudioResponse(false);
    navigate(`/chat/${id}`);
  };

  const startNewConversation = async () => {
    const { data: newConv, error } = await createConversation('Nouvelle discussion');
    if (!error && newConv) {
      setConversations(prev => [newConv, ...prev]);
      navigate(`/chat/${newConv.id}`);
    }
  };

  const deleteConversation = async (id) => {
    const { error } = await deleteConv(id);
    if (!error) {
      setConversations(prev => prev.filter(c => c.id !== id));
      if (conversationId === id) {
        navigate('/');
      }
    }
  };

  const handleWebhookResponse = async (responseData) => {
    if (!waitingForAudioResponse && !isLoading) return;

    setWaitingForAudioResponse(false);
    setIsLoading(false);
    pendingConversationRef.current = null;

    const aiResponse = extractWebhookResponse(responseData);

    const { data: savedMsg } = await addMessage(conversationId, {
      sender: 'ai',
      text: aiResponse,
      type: 'text'
    });

    if (savedMsg) {
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

  const sendMessageInternal = async (text) => {
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

      const { data: aiMsg } = await addMessage(conversationId, {
        sender: 'ai',
        text: aiResponse,
        type: 'text'
      });

      if (aiMsg) {
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

      // Mettre à jour la liste des conversations
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
        const { data: audioMsg } = await addMessage(conversationId, {
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
              audioBlob: messageContent.content,
              duration: messageContent.duration || 0,
              sender: 'user',
              timestamp: audioMsg.created_at
            }
          ]);
        }

        if (messageContent.expectResponse) {
          setIsLoading(true);
          setWaitingForAudioResponse(true);
          pendingConversationRef.current = conversationId;
        }
        return;
      }
    }

    const text = typeof messageContent === 'string' ? messageContent.trim() : '';
    if (!text) return;

    await sendMessageInternal(text);
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
    doc.save(`chat-${conversationId?.slice(0, 8) || 'export'}.pdf`);
  };

  const handleOpenPublishModal = (messageText) => {
    const parsed = parseArticleFromMessage(messageText);
    if (parsed) {
      setArticleToPublish(parsed);
      setIsPublishModalOpen(true);
    }
  };

  const handlePublishToWordPress = async (articleData) => {
    try {
      const result = await publishToWordPress(articleData);

      setIsPublishModalOpen(false);
      setArticleToPublish(null);

      // Sauvegarder dans la galerie
      await saveWordPressPost({
        title: articleData.title,
        postUrl: result?.postUrl || '',
        editUrl: result?.editUrl || '',
        postId: result?.postId || null
      });

      const randomMessage = SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)];
      const articleUrl = result?.postUrl || result?.editUrl || '#';
      const confirmationText = `${randomMessage}\n\n🔗 ${articleUrl}`;

      const { data: savedMsg } = await addMessage(conversationId, {
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

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      <Sidebar
        isOpen={isSidebarOpen}
        conversations={conversations}
        currentSessionId={conversationId}
        onSelectConversation={selectConversation}
        onNewChat={startNewConversation}
        onDeleteConversation={deleteConversation}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          sidebarOpen={isSidebarOpen}
          onGoHome={() => navigate('/')}
        />

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

        <InputArea
          value={inputValue}
          onChange={setInputValue}
          onSend={sendMessage}
          isLoading={isLoading}
          sessionId={conversationId}
        />
      </div>

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

export default ChatPage;
