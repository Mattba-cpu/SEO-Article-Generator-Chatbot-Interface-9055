import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import MessageBubble from './MessageBubble';
import InputArea from './InputArea';
import TypingIndicator from './TypingIndicator';
import Header from './Header';
import Sidebar from './Sidebar';
import HomePage from './HomePage';
import SettingsModal from './SettingsModal';
import { useAuth } from '../contexts/AuthContext';
import { sendChatMessage, extractWebhookResponse } from '../lib/api';
import {
  getConversations,
  createConversation,
  updateConversationTitle,
  deleteConversation as deleteConv,
  getMessages,
  addMessage
} from '../lib/conversationService';
import { jsPDF } from 'jspdf';

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
    setWaitingForAudioResponse(false);
    setIsLoading(false);

    const aiResponse = extractWebhookResponse(responseData);

    // Sauvegarder en BDD
    const { data: savedMsg } = await addMessage(currentConversationId, {
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

    try {
      const response = await sendChatMessage(text, conversationId);
      const aiResponse = extractWebhookResponse(response);

      // Sauvegarder la réponse IA en BDD
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
      setIsLoading(false);
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
                />
              ))}
              {isLoading && <TypingIndicator />}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        </div>

        <InputArea value={inputValue} onChange={setInputValue} onSend={sendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default ChatInterface;
