import { useState, useCallback } from 'react';

/**
 * Custom hook for managing microphone permission
 * @returns {Object} Permission status and functions
 */
export function useMicrophonePermission() {
  // State for tracking permission status
  const [permissionStatus, setPermissionStatus] = useState('idle');
  const [permissionError, setPermissionError] = useState('');
  const [mediaStream, setMediaStream] = useState(null);

  // Function to clean up stream tracks
  const cleanupMediaStream = useCallback(() => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
  }, [mediaStream]);

  // Function to request microphone permission
  const requestPermission = useCallback(async () => {
    // Only proceed if not already granted
    if (permissionStatus !== 'granted') {
      try {
        setPermissionStatus('pending');
        setPermissionError('');
        
        // Request access to the microphone
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Clean up any existing stream before storing the new one
        cleanupMediaStream();
        
        // Store the stream
        setMediaStream(stream);
        
        // Update permission status
        setPermissionStatus('granted');
        
        return stream;
      } catch (error) {
        console.error('Error accessing microphone:', error);
        
        // Handle specific error types
        let errorMessage;
        if (error.name === 'NotAllowedError') {
          setPermissionStatus('denied');
          errorMessage = 'Microphone permission denied. Please allow access to use this feature.';
        } else if (error.name === 'NotFoundError') {
          setPermissionStatus('denied');
          errorMessage = 'No microphone found. Please connect a microphone and try again.';
        } else if (error.name === 'TypeError' && !navigator.mediaDevices) {
          setPermissionStatus('denied');
          errorMessage = 'Media devices not available. This may be due to a non-secure context (non-HTTPS).';
        } else {
          setPermissionStatus('denied');
          errorMessage = `Microphone error: ${error.message}`;
        }
        
        setPermissionError(errorMessage);
        return null;
      }
    }
    
    // If already granted, just return the current stream
    return mediaStream;
  }, [permissionStatus, cleanupMediaStream, mediaStream]);

  // Clean up on component unmount
  const cleanup = useCallback(() => {
    cleanupMediaStream();
  }, [cleanupMediaStream]);

  return {
    permissionStatus,
    permissionError,
    mediaStream,
    requestPermission,
    cleanup
  };
}