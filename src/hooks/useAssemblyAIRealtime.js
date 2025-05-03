import { useState, useRef, useEffect, useCallback } from 'react';
import { RealtimeTranscriber } from 'assemblyai';

// Constants
const API_URL = 'http://localhost:3000/api/stt-token';
const API_KEY = 'stt_client_token_12345'; // In production, store this securely

/**
 * Custom hook for integrating with AssemblyAI realtime transcription
 * @param {boolean} isActive - Whether the transcription should be active
 * @param {number} sampleRate - Sample rate from audio context
 * @returns {Object} Transcription state and functions
 */
export function useAssemblyAIRealtime(isActive, sampleRate = 16000) {
  // State for transcripts
  const [tempTranscript, setTempTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [sttError, setSTTError] = useState('');

  // Refs for AssemblyAI
  const transcriber = useRef(null);
  const assemblyToken = useRef(null);
  const connectionReady = useRef(false);

  // Function to fetch a token from the server
  const fetchToken = useCallback(async () => {
    try {
      console.log('Fetching token from:', API_URL);
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        }
      });
      
      console.log('Server response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.token) {
        throw new Error('Server did not return a token');
      }
      
      console.log('Received token from server');
      return data.token;
    } catch (error) {
      console.error('Error fetching AssemblyAI token:', error);
      throw error;
    }
  }, []);

  // Function to connect to AssemblyAI
  const connect = useCallback(async () => {
    // Don't connect again if already connecting/connected
    if (connectionStatus === 'connecting' || connectionStatus === 'connected') {
      return true;
    }
    
    setConnectionStatus('connecting');
    setSTTError('');
    
    try {
      // Fetch a new token
      const token = await fetchToken();
      assemblyToken.current = token;
      
      if (!token) {
        throw new Error('Token is undefined or empty');
      }
      
      // Create a transcriber with the token and sample rate
      const newTranscriber = new RealtimeTranscriber({
        token,
        sample_rate: sampleRate
      });
      
      // Set up event handlers
      newTranscriber.on("open", () => {
        console.log('AssemblyAI connection established');
        connectionReady.current = true;
        setConnectionStatus('connected');
        setSTTError('');
      });
      
      newTranscriber.on("connecting", () => {
        console.log('Connecting to AssemblyAI...');
        setConnectionStatus('connecting');
      });
      
      newTranscriber.on("connected", () => {
        console.log('AssemblyAI connection active and ready for audio');
        connectionReady.current = true;
        setConnectionStatus('connected');
      });
      
      newTranscriber.on("transcript", (transcriptData) => {
        // Helper function to extract text from any transcript format
        const getTranscriptText = (data) => {
          return data.text || 
                 data.transcript || 
                 (data.data && data.data.text) || 
                 (data.data && data.data.transcript) || 
                 (typeof data.message === 'string' ? data.message : '');
        };
        
        // Get text from the transcript object
        const newText = getTranscriptText(transcriptData);
        
        // Skip empty text
        if (!newText || newText.trim() === '') {
          return;
        }
        
        // Handle different message types
        if (transcriptData.message_type === 'PartialTranscript') {
          // Store partial transcript but don't affect final output
          setPartialTranscript(newText);
        } 
        else if (transcriptData.message_type === 'FinalTranscript') {
          // Accumulate final transcripts
          if (newText.trim()) {
            setTempTranscript(prevTemp => {
              // Add a space between segments if needed
              const spacer = prevTemp ? ' ' : '';
              return prevTemp + spacer + newText.trim();
            });
          }
        }
        else if (newText.trim()) {
          // Handle other message types with text
          setTempTranscript(prevTemp => {
            const spacer = prevTemp ? ' ' : '';
            return prevTemp + spacer + newText.trim();
          });
        }
      });
      
      newTranscriber.on("error", (error) => {
        console.error('AssemblyAI error:', error);
        
        // Create user-friendly error message
        let errorMsg;
        if (error.message) {
          errorMsg = `Error: ${error.message}`;
        } else if (typeof error === 'string') {
          errorMsg = `Error: ${error}`;
        } else {
          errorMsg = 'An error occurred with the speech recognition service';
        }
        
        setSTTError(errorMsg);
        setConnectionStatus('error');
        
        // Try to reconnect for certain errors
        if (error.message && 
           (error.message.includes('connection') || 
            error.message.includes('network') || 
            error.message.includes('timeout'))) {
          setTimeout(() => {
            // Only retry if this transcriber is still the current one
            if (transcriber.current === newTranscriber) {
              try {
                console.log('Attempting to reconnect...');
                newTranscriber.connect().catch(e => {
                  console.error('Reconnection attempt failed:', e);
                });
              } catch (e) {
                console.error('Error in reconnection attempt:', e);
              }
            }
          }, 2000);
        }
      });
      
      newTranscriber.on("close", () => {
        console.log('AssemblyAI connection closed');
        connectionReady.current = false;
        
        // Only update status if this is still the active transcriber
        if (transcriber.current === newTranscriber) {
          setConnectionStatus('idle');
        }
      });
      
      // Store the transcriber
      transcriber.current = newTranscriber;
      
      // Connect to AssemblyAI
      try {
        console.log('Connecting to AssemblyAI...');
        await newTranscriber.connect();
        console.log('Successfully connected to AssemblyAI');
        return true;
      } catch (error) {
        console.error('Error connecting to AssemblyAI:', error);
        setSTTError(`Connection error: ${error.message || 'Failed to connect to speech service'}`);
        setConnectionStatus('error');
        return false;
      }
    } catch (error) {
      console.error('Error initializing AssemblyAI:', error);
      setSTTError(`Failed to connect to speech-to-text service: ${error.message}`);
      setConnectionStatus('error');
      return false;
    }
  }, [fetchToken, connectionStatus, sampleRate]);

  // Function to disconnect from AssemblyAI
  const disconnect = useCallback(async () => {
    if (transcriber.current) {
      try {
        console.log('Closing AssemblyAI connection...');
        if (typeof transcriber.current.close === 'function') {
          await transcriber.current.close();
          console.log('AssemblyAI connection closed successfully');
        }
      } catch (error) {
        console.error('Error closing AssemblyAI connection:', error);
      }
      
      transcriber.current = null;
      connectionReady.current = false;
      setConnectionStatus('idle');
    }
  }, []);

  // Function to send audio data to AssemblyAI
  const sendAudio = useCallback((audioData) => {
    if (transcriber.current && connectionReady.current) {
      try {
        transcriber.current.sendAudio(audioData);
        return true;
      } catch (error) {
        console.error('Error sending audio to AssemblyAI:', error);
        return false;
      }
    }
    return false;
  }, []);

  // Function to clear accumulated transcripts
  const clearTranscripts = useCallback(() => {
    setTempTranscript('');
    setPartialTranscript('');
  }, []);

  // Auto-connect/disconnect based on isActive
  useEffect(() => {
    if (isActive) {
      // Reset states before connecting
      clearTranscripts();
      connect();
    } else {
      // Disconnect when not active
      disconnect();
    }
  }, [isActive, connect, disconnect, clearTranscripts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    tempTranscript,
    partialTranscript,
    connectionStatus,
    connectionReady: connectionReady.current,
    sttError,
    connect,
    disconnect,
    sendAudio,
    clearTranscripts
  };
}