import { useState, useEffect, useRef } from 'react';

// Update interval for audio level visualization
const AUDIO_LEVEL_UPDATE_INTERVAL_MS = 100;

/**
 * Custom hook for audio level visualization
 * @param {MediaStream} mediaStream - The microphone media stream
 * @param {boolean} isActive - Whether the visualization should be active
 * @returns {Object} Audio level state and related functions
 */
export function useAudioVisualization(mediaStream, isActive) {
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Refs for audio processing
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioDataRef = useRef(null);

  // Function to calculate RMS (Root Mean Square) from audio data
  const calculateRMS = (buffer) => {
    let sum = 0;
    
    // Sum of squares
    for (let i = 0; i < buffer.length; i++) {
      // Convert from 0-255 to -128-127 range for audio samples
      const sample = (buffer[i] / 128.0) - 1.0;
      sum += sample * sample;
    }
    
    // Return the square root of the mean
    const rms = Math.sqrt(sum / buffer.length);
    
    // Scale to 0-100 range with a logarithmic curve for better visualization
    const scaledRMS = Math.min(100, Math.max(0, 
      100 * Math.pow(rms, 0.5) / 0.5
    ));
    
    return scaledRMS;
  };

  // Effect to set up audio visualization
  useEffect(() => {
    if (!mediaStream || !isActive) {
      // Reset if not active or no stream
      setAudioLevel(0);
      return;
    }
    
    try {
      // Create AudioContext if it doesn't exist or if it's closed
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContext();
      }
      
      // Create audio source from the media stream
      const source = audioContextRef.current.createMediaStreamSource(mediaStream);
      
      // Create an analyser node
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256; // Smaller FFT size for better performance
      analyserRef.current = analyser;
      
      // Connect the source to the analyser (but not to destination to avoid feedback)
      source.connect(analyser);
      
      // Create a buffer for the time domain data
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      audioDataRef.current = dataArray;
      
      // Function to update the level meter
      const updateLevelMeter = () => {
        if (!analyserRef.current || !audioDataRef.current) return;
        
        // Get the time domain data
        analyserRef.current.getByteTimeDomainData(audioDataRef.current);
        
        // Calculate the audio level
        const level = calculateRMS(audioDataRef.current);
        
        // Update the state
        setAudioLevel(level);
        
        // Schedule the next frame with throttling for performance
        animationFrameRef.current = setTimeout(() => {
          requestAnimationFrame(updateLevelMeter);
        }, AUDIO_LEVEL_UPDATE_INTERVAL_MS);
      };
      
      // Start the animation loop
      updateLevelMeter();
    } catch (error) {
      console.error('Error setting up audio visualization:', error);
      setAudioLevel(0);
    }
    
    // Cleanup function
    return () => {
      if (animationFrameRef.current) {
        clearTimeout(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
      
      setAudioLevel(0);
    };
  }, [mediaStream, isActive]);

  // Expose the AudioContext to be used by other hooks if needed
  const getAudioContext = () => audioContextRef.current;

  return {
    audioLevel,
    getAudioContext
  };
}