import { useCallback, useEffect, useState } from 'react';
import { useMicrophonePermission } from './useMicrophonePermission';
import { useAudioProcessing } from './useAudioProcessing';
import { useAssemblyAIRealtime } from './useAssemblyAIRealtime';
import { useAudioVisualization } from './useAudioVisualization';
import { useRecordingTimer } from './useRecordingTimer';

/**
 * Master hook that coordinates all speech-to-text functionality
 * @returns {Object} Combined state and functions for speech-to-text
 */
export function useSpeechToText() {
  // Local state for the component
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  // Microphone permission hook
  const {
    permissionStatus,
    permissionError,
    mediaStream,
    requestPermission,
    cleanup: cleanupMicrophone
  } = useMicrophonePermission();

  // AssemblyAI realtime transcription hook
  const {
    tempTranscript,
    partialTranscript,
    connectionStatus,
    connectionReady,
    sttError,
    connect: connectAssemblyAI,
    disconnect: disconnectAssemblyAI,
    sendAudio,
    clearTranscripts
  } = useAssemblyAIRealtime(isListening);

  // Audio visualization hook
  const { audioLevel, getAudioContext } = useAudioVisualization(mediaStream, isListening);

  // Audio processing hook for sending data to AssemblyAI
  const { getSampleRate } = useAudioProcessing(
    mediaStream,
    isListening,
    connectionReady,
    sendAudio // Pass the sendAudio function as a callback
  );

  // Recording timer hook
  const { formattedRecordingTime, resetTimer } = useRecordingTimer(isListening);

  // Start listening function
  const startListening = useCallback(async () => {
    // Request microphone permission if not already granted
    if (permissionStatus !== 'granted') {
      const stream = await requestPermission();
      if (!stream) {
        return false; // Permission denied or error
      }
    }

    // Reset state
    clearTranscripts();
    resetTimer();
    
    // Start listening
    setIsListening(true);
    return true;
  }, [permissionStatus, requestPermission, clearTranscripts, resetTimer]);

  // Stop listening function - only handles the listening state
  const stopListening = useCallback(() => {
    if (!isListening) return;
    setIsListening(false);
  }, [isListening]);

  // useEffect to update transcript when isListening changes to false (after stopping)
  // or when tempTranscript changes while not listening
  useEffect(() => {
    if (!isListening && tempTranscript.trim()) {
      setTranscript(tempTranscript);
    }
  }, [isListening, tempTranscript])

  // Toggle listening function
  const toggleListening = useCallback(async () => {
    if (isListening) {
      stopListening();
    } else {
      await startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Clear transcript function
  const clearTranscript = useCallback(() => {
    setTranscript('');
    clearTranscripts();
  }, [clearTranscripts]);

  // Get combined error message
  const getErrorMessage = useCallback(() => {
    if (permissionError) return permissionError;
    if (sttError) return sttError;
    return '';
  }, [permissionError, sttError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectAssemblyAI();
      cleanupMicrophone();
    };
  }, [disconnectAssemblyAI, cleanupMicrophone]);

  // Return all state and functions
  return {
    // State
    isListening,
    permissionStatus,
    connectionStatus,
    audioLevel,
    transcript,
    tempTranscript,
    partialTranscript,
    formattedRecordingTime,
    errorMessage: getErrorMessage(),
    
    // Functions
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
    
    // Raw access to inner functions if needed
    sendAudio,
    getAudioContext,
    getSampleRate
  };
}