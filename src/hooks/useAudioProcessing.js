import { useRef, useEffect, useCallback } from 'react';

/**
 * Custom hook for audio processing
 * @param {MediaStream} mediaStream - The microphone media stream
 * @param {boolean} isProcessing - Whether audio processing should be active
 * @param {boolean} isConnectionReady - Whether the STT connection is ready
 * @param {Function} onAudioData - Callback to receive processed audio data
 * @returns {Object} Audio processing functions and state
 */
export function useAudioProcessing(mediaStream, isProcessing, isConnectionReady, onAudioData) {
  // Refs for audio processing
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);

  // Function to convert Float32Array to Int16Array for STT processing
  const convertFloat32ToInt16 = useCallback((float32Array) => {
    const int16Array = new Int16Array(float32Array.length);
    
    for (let i = 0; i < float32Array.length; i++) {
      // Convert from -1.0 - 1.0 range to -32768 - 32767 range
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    
    return int16Array;
  }, []);

  // Setup audio processing node
  useEffect(() => {
    if (!mediaStream || !isProcessing) return;

    // Create AudioContext if needed
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        
        // Try to create with desired sample rate, but this might be ignored by browser
        try {
          const sampleRate = 16000; // Preferred for STT
          audioContextRef.current = new AudioContext({ sampleRate });
          console.log('Created AudioContext with sample rate:', audioContextRef.current.sampleRate);
        } catch (error) {
          console.error('Failed to create AudioContext with specific sample rate:', error);
          audioContextRef.current = new AudioContext();
          console.log('Created default AudioContext with sample rate:', audioContextRef.current.sampleRate);
        }
      } catch (error) {
        console.error('Error creating AudioContext:', error);
        return;
      }
    }

    try {
      // Use a larger buffer size for more stable audio processing
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      // Keep reference to the processor to avoid garbage collection
      audioContextRef.current.audioWorkletProcessor = processor;
      processorRef.current = processor;
      
      processor.onaudioprocess = (e) => {
        // Only send data if we're processing and connection is ready
        if (isProcessing && isConnectionReady) {
          // Get the audio data from the input channel
          const inputData = e.inputBuffer.getChannelData(0);
          
          try {
            // Detect if there's actual sound in the audio data
            const hasSound = inputData.some(sample => Math.abs(sample) > 0.01);
            
            // Log audio level occasionally
            if (Math.random() < 0.005 && hasSound) {
              const max = Math.max(...Array.from(inputData).map(s => Math.abs(s)));
              console.log('Audio active, level:', max.toFixed(3));
            }
            
            // Convert Float32Array to Int16Array for STT
            const int16Data = convertFloat32ToInt16(inputData);
            
            // Send the converted audio data to the callback
            onAudioData(int16Data.buffer);
          } catch (error) {
            console.error('Error processing audio data:', error);
          }
        }
      };
      
      // Setup audio graph: source -> processor -> silent destination
      const source = audioContextRef.current.createMediaStreamSource(mediaStream);
      source.connect(processor);
      
      // Use a silent node to create a valid audio graph without causing feedback
      const silentNode = audioContextRef.current.createGain();
      silentNode.gain.value = 0; // Set gain to 0 to make it silent
      processor.connect(silentNode);
      silentNode.connect(audioContextRef.current.destination);
    } catch (error) {
      console.error('Error setting up audio processing:', error);
    }

    // Cleanup function
    return () => {
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.audioWorkletProcessor = null;
      }
    };
  }, [mediaStream, isProcessing, isConnectionReady, onAudioData, convertFloat32ToInt16]);

  // Function to get the current AudioContext
  const getAudioContext = useCallback(() => {
    return audioContextRef.current;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, []);

  return {
    getAudioContext,
    getSampleRate: () => audioContextRef.current?.sampleRate || 16000,
    convertFloat32ToInt16
  };
}