import { useState, useEffect, useRef } from 'react';

// Update interval for audio level visualization
const AUDIO_LEVEL_UPDATE_INTERVAL_MS = 100;

// Number of frequency bands for the visualization - UPDATED
const NUM_FREQUENCY_BANDS = 16;

// --- Tuning Parameters ---
const HIGH_PASS_CUTOFF_HZ = 1000;
const HIGH_PASS_Q_FACTOR = 0.707; // Standard Q for Butterworth-like response
const ANALYSER_FFT_SIZE = 2048;
const ANALYSER_SMOOTHING_TIME = 0.65;


export function useAudioVisualization(mediaStream, isActive) {
  const [audioLevel, setAudioLevel] = useState(0);
  const [frequencyBands, setFrequencyBands] = useState(Array(NUM_FREQUENCY_BANDS).fill(0));

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioDataRef = useRef(null);
  const frequencyDataRef = useRef(null);

  const calculateRMS = (buffer) => {
    const RMS_POWER_SCALE = 0.5;
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      const sample = (buffer[i] / 128.0) - 1.0;
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / buffer.length);
    const scaledRMS = Math.min(100, Math.max(0,
      100 * Math.pow(rms, RMS_POWER_SCALE)
    ));
    return scaledRMS;
  };

  const processFrequencyBands = (frequencyData, bandCount) => {
    const NOISE_FLOOR_THRESHOLD = 0.20;
    const NOISE_FLOOR_REDUCTION_FACTOR = 0.15;
    const BAND_VISUALIZATION_POWER_SCALE = 0.6;

    // UPDATED: Redefined for 16 bands, including sub-1000Hz ranges relevant to speech
    const speechFocusedFrequencyRanges = [
      // Low frequencies (will be attenuated by HPF but show residual voice energy)
      [100, 200],   // Core fundamental range (male/female lower end)
      [200, 350],   // Upper fundamentals, first harmonics
      [350, 550],   // Lower midrange, vowel body
      [550, 850],   // Midrange, vowel quality, start of formants
      // Mid and High frequencies (critical for speech clarity)
      [850, 1100],  // Approaching HPF cutoff, lower formants
      [1100, 1350], // First formant region
      [1350, 1600], // Speech clarity, between F1 and F2
      [1600, 1900], // Second formant region (F2)
      [1900, 2200], // Upper F2, consonant sounds
      [2200, 2500], // Consonants, fricatives
      [2500, 2800], // Sibilance (s, sh, z)
      [2800, 3200], // Upper sibilance, speech clarity
      [3200, 3700], // Higher speech harmonics, "air"
      [3700, 4300], // High frequencies, some consonant detail
      [4300, 5000], // Very high frequencies
      [5000, 6000]  // Top band (within 8kHz Nyquist for 16kHz sampling)
    ];

    const bands = Array(bandCount).fill(0);
    const frequencyDataLength = frequencyData.length;
    const sampleRate = audioContextRef.current?.sampleRate || 48000;
    const nyquist = sampleRate / 2;
    const frequencyBinSize = nyquist / frequencyDataLength;

    const activeRanges = speechFocusedFrequencyRanges.slice(0, bandCount);
    if (activeRanges.length !== bandCount) {
        // This ensures that if speechFocusedFrequencyRanges isn't perfectly sized,
        // we don't have issues. Ideally, its length should match bandCount.
        console.warn(`Mismatch between NUM_FREQUENCY_BANDS (${bandCount}) and defined ranges (${activeRanges.length}). Ensure speechFocusedFrequencyRanges has ${bandCount} entries.`);
    }


    for (let i = 0; i < activeRanges.length; i++) {
      const [lowFreq, highFreq] = activeRanges[i];
      const startIndex = Math.max(0, Math.floor(lowFreq / frequencyBinSize));
      const endIndex = Math.min(frequencyDataLength - 1, Math.floor(highFreq / frequencyBinSize));

      if (startIndex >= endIndex) continue;

      let sum = 0;
      for (let j = startIndex; j < endIndex; j++) {
        sum += frequencyData[j];
      }
      const avg = sum / (endIndex - startIndex);
      let normalizedValue = avg / 255.0;

      let weight = 1.0;
      const bandCenterFreq = (lowFreq + highFreq) / 2;

      // Weighting logic:
      // Boost core speech intelligibility frequencies
      if (bandCenterFreq >= 1000 && bandCenterFreq <= 2500) {
        // weight = 1.2;
      // Boost consonants and sibilants for clarity
      } else if (bandCenterFreq > 2500 && bandCenterFreq <= 4000) {
        weight = 1.4;
      // Slightly reduce very high frequencies ("air")
      } else if (bandCenterFreq > 4000) {
        // weight = 0.7;
      // For bands below 1000Hz (which are affected by HPF),
      // apply a moderate weight. This helps show voice presence
      // without over-emphasizing filtered-out noise.
      } else if (bandCenterFreq < 1000 && bandCenterFreq >= 100) { // Specifically target the new lower bands
        // weight = 0.8;
      }
      // Default weight for any other bands (e.g. if ranges are defined outside these specific conditions)
      // is 1.0, but our ranges should be covered.

      normalizedValue *= weight;

      if (normalizedValue < NOISE_FLOOR_THRESHOLD) {
        normalizedValue *= NOISE_FLOOR_REDUCTION_FACTOR;
      }

      normalizedValue = Math.max(0, Math.min(1, normalizedValue));
      bands[i] = Math.min(100, Math.max(0,
        100 * Math.pow(normalizedValue, BAND_VISUALIZATION_POWER_SCALE)
      ));
    }
    return bands;
  };

  useEffect(() => {
    if (!mediaStream || !isActive) {
      setAudioLevel(0);
      setFrequencyBands(Array(NUM_FREQUENCY_BANDS).fill(0));
      if (animationFrameRef.current) {
        clearTimeout(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
      return;
    }

    let sourceNode;
    let highPassFilterNode;

    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
          console.error("Web Audio API is not supported in this browser.");
          return;
        }
        audioContextRef.current = new AudioCtx();
      }

      sourceNode = audioContextRef.current.createMediaStreamSource(mediaStream);
      highPassFilterNode = audioContextRef.current.createBiquadFilter();
      highPassFilterNode.type = 'highpass';
      highPassFilterNode.frequency.setValueAtTime(HIGH_PASS_CUTOFF_HZ, audioContextRef.current.currentTime);
      highPassFilterNode.Q.setValueAtTime(HIGH_PASS_Q_FACTOR, audioContextRef.current.currentTime);

      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = ANALYSER_FFT_SIZE;
      analyser.smoothingTimeConstant = ANALYSER_SMOOTHING_TIME;
      analyserRef.current = analyser;

      sourceNode.connect(highPassFilterNode);
      highPassFilterNode.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      audioDataRef.current = new Uint8Array(bufferLength);
      frequencyDataRef.current = new Uint8Array(bufferLength);

      const updateVisualizations = () => {
        if (!analyserRef.current || !audioDataRef.current || !frequencyDataRef.current || !isActive) {
            if (animationFrameRef.current) clearTimeout(animationFrameRef.current);
            return;
        }

        analyserRef.current.getByteTimeDomainData(audioDataRef.current);
        const level = calculateRMS(audioDataRef.current);

        analyserRef.current.getByteFrequencyData(frequencyDataRef.current);
        const bands = processFrequencyBands(frequencyDataRef.current, NUM_FREQUENCY_BANDS);

        setAudioLevel(level);
        setFrequencyBands(bands);

        animationFrameRef.current = setTimeout(() => {
          requestAnimationFrame(updateVisualizations);
        }, AUDIO_LEVEL_UPDATE_INTERVAL_MS);
      };
      updateVisualizations();

    } catch (error) {
      console.error('Error setting up audio visualization:', error);
      setAudioLevel(0);
      setFrequencyBands(Array(NUM_FREQUENCY_BANDS).fill(0));
    }

    return () => {
      if (animationFrameRef.current) {
        clearTimeout(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      try {
        sourceNode?.disconnect();
        highPassFilterNode?.disconnect();
      } catch(e) {
        console.warn("Error disconnecting audio nodes during cleanup:", e);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed' && !isActive) {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
      setAudioLevel(0);
      setFrequencyBands(Array(NUM_FREQUENCY_BANDS).fill(0));
    };
  }, [mediaStream, isActive]);

  const getAudioContext = () => audioContextRef.current;

  return {
    audioLevel,
    frequencyBands,
    getAudioContext
  };
}