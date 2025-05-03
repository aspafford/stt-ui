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
  const [isProcessing, setIsProcessing] = useState(false);
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

  // Stop listening function with delay for final processing
  const stopListening = useCallback(() => {
    if (!isListening) return;
    
    console.log('Stopping recording...');
    setIsProcessing(true);
    
    // Add a delay to ensure all final transcripts are processed
    setTimeout(() => {
      setIsListening(false);
      
      // Process the collected transcript after another small delay
      setTimeout(() => {
        console.log('Final collected transcript:', tempTranscript);
        
        // Add the temp transcript to the main transcript
        if (tempTranscript.trim()) {
          setTranscript(prev => {
            const spacer = prev && !prev.endsWith(' ') ? ' ' : '';
            return prev + spacer + tempTranscript.trim();
          });
        }
        
        setIsProcessing(false);
      }, 500); // Short delay after stopping
    }, 1500); // Longer delay before stopping
  }, [isListening, tempTranscript]);

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
    isProcessing,
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