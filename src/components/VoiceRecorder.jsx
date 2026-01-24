import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import RecordRTC from 'recordrtc';
import SafeIcon from '../common/SafeIcon';
import { ENDPOINTS } from '../lib/api';

const { FiMic, FiX, FiPause, FiPlay, FiSend, FiLoader } = FiIcons;

const VoiceRecorder = ({ onSend }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [waveformData, setWaveformData] = useState([]);
  const [isSending, setIsSending] = useState(false);

  const recorderRef = useRef(null);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    if (isRecording && !isPaused) {
      animationRef.current = setInterval(() => {
        const newData = Array(20).fill().map(() => Math.random() * 0.8 + 0.2);
        setWaveformData(newData);
      }, 150);
    } else {
      clearInterval(animationRef.current);
    }
    return () => clearInterval(animationRef.current);
  }, [isRecording, isPaused]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      recorderRef.current = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/wav',
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: 1,
        desiredSampRate: 16000,
      });

      recorderRef.current.startRecording();
      setIsRecording(true);
      setIsPaused(false);
      setAudioBlob(null);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Erreur microphone:', error);
      onSend({ type: 'text', content: "Erreur d'accès au microphone." });
    }
  };

  const stopRecording = () => {
    if (!recorderRef.current) return;

    recorderRef.current.stopRecording(() => {
      const blob = recorderRef.current.getBlob();
      setAudioBlob(blob);
      setIsRecording(false);
      setIsPaused(false);
      clearInterval(timerRef.current);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      sendAudioMessage(blob);
    });
  };

  const cancelRecording = () => {
    if (recorderRef.current) {
      if (isRecording) {
        recorderRef.current.stopRecording(() => {
          recorderRef.current.reset();
        });
      } else {
        recorderRef.current.reset();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
    resetToInitialState();
  };

  const resetToInitialState = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    setIsPlaying(false);
    setIsRecording(false);
    setIsPaused(false);
    setIsSending(false);
    setWaveformData([]);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const sendAudioMessage = async (blobToSend = null) => {
    const blob = blobToSend || audioBlob;
    if (!blob || isSending) return;

    setIsSending(true);

    try {
      const audioBlobCopy = new Blob([blob], { type: blob.type });
      const currentDuration = recordingTime;

      // Envoyer le message vocal immédiatement
      onSend({
        type: 'audio',
        content: audioBlobCopy,
        duration: currentDuration,
        expectResponse: true
      });

      // RÉINITIALISATION IMMÉDIATE de l'interface
      resetToInitialState();

      const formData = new FormData();
      formData.append('audio', audioBlobCopy, 'recording.wav');
      
      const response = await fetch(ENDPOINTS.AUDIO, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const responseData = await response.json();

      onSend({
        type: 'webhookResponse',
        content: responseData
      });

    } catch (error) {
      console.error('Erreur d\'envoi audio:', error);
      onSend({ type: 'text', content: "Erreur d'envoi du message vocal." });
      resetToInitialState();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {isSending ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-2.5 rounded-xl text-olive-500 bg-olive-900/10 border border-olive-500/20"
          >
            <SafeIcon icon={FiLoader} className="text-xl animate-spin" />
          </motion.div>
        ) : audioBlob ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex items-center gap-2"
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-[#141414] border border-gray-800/50">
              <span className="text-xs text-gray-300">{formatTime(recordingTime)}</span>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={cancelRecording}
                className="text-gray-400 hover:text-olive-400"
              >
                <SafeIcon icon={FiX} />
              </motion.button>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => sendAudioMessage()}
              className="p-2.5 rounded-xl text-white shadow-lg"
              style={{ backgroundColor: '#D85A4A' }}
            >
              <SafeIcon icon={FiSend} />
            </motion.button>
          </motion.div>
        ) : isRecording ? (
          <motion.div
            key="recording"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex items-center gap-2"
          >
            <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-olive-900/20 border border-olive-500/50 shadow-[0_0_15px_rgba(216,90,74,0.2)]">
              <motion.div
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-olive-500"
              />
              <span className="text-sm font-mono text-olive-400">{formatTime(recordingTime)}</span>
              <button onClick={cancelRecording} className="text-gray-400 hover:text-white ml-2">
                <SafeIcon icon={FiX} />
              </button>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={stopRecording}
              className="p-2.5 rounded-xl text-white shadow-lg"
              style={{ backgroundColor: '#D85A4A' }}
            >
              <SafeIcon icon={FiSend} />
            </motion.button>
          </motion.div>
        ) : (
          <motion.button
            key="mic"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={startRecording}
            className="p-2.5 rounded-xl border border-gray-800/50 bg-[#141414] transition-all"
            style={{ color: '#E8715F' }}
          >
            <SafeIcon icon={FiMic} className="text-xl" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoiceRecorder;