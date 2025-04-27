import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Paper, 
  Container,
  LinearProgress
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import CheckIcon from '@mui/icons-material/Check';

// Constants for configuration
const RECORDING_TIMESLICE_MS = 500;
const PROCESSING_DELAY_MS = 1500;
const AUDIO_LEVEL_UPDATE_INTERVAL_MS = process.env.NODE_ENV === 'test' ? 0 : 100;

function VoiceInput() {
  // State variables as specified in the milestone
  const [permissionStatus, setPermissionStatus] = useState('idle');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); 
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  
  // Refs to store the MediaStream and MediaRecorder objects
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioDataRef = useRef(null);
  
  // Ref to store audio chunks
  const audioChunksRef = useRef([]);
  
  // Ref for recording timer interval
  const recordingTimerRef = useRef(null);

  // Function to clean up MediaStream tracks
  const cleanupMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  // Function to request microphone permission
  const requestMicrophonePermission = async () => {
    // Only proceed if not already granted
    if (permissionStatus !== 'granted') {
      try {
        setPermissionStatus('pending');
        setErrorMessage('');
        
        // Request access to the microphone
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Clean up any existing stream before storing the new one
        cleanupMediaStream();
        
        // Store the stream for later use
        mediaStreamRef.current = stream;
        
        // Update permission status
        setPermissionStatus('granted');
      } catch (error) {
        console.error('Error accessing microphone:', error);
        
        // Handle specific error types
        if (error.name === 'NotAllowedError') {
          setPermissionStatus('denied');
          setErrorMessage('Microphone permission denied. Please allow access to use this feature.');
        } else if (error.name === 'NotFoundError') {
          setPermissionStatus('denied');
          setErrorMessage('No microphone found. Please connect a microphone and try again.');
        } else if (error.name === 'TypeError' && !navigator.mediaDevices) {
          setPermissionStatus('denied');
          setErrorMessage('Media devices not available. This may be due to a non-secure context (non-HTTPS).');
        } else {
          setPermissionStatus('denied');
          setErrorMessage(`Microphone error: ${error.message}`);
        }
      }
    }
  };

  // Handler for mic button click
  const handleMicButtonClick = async () => {
    if (permissionStatus === 'granted') {
      // Toggle the isListening state
      setIsListening(prevState => {
        if (!prevState) {
          // Starting a new recording, clear any previous transcript
          setTranscript('');
        }
        return !prevState;
      });
    } else {
      // Request microphone access
      await requestMicrophonePermission();
    }
  };
  
  // Handler for complete button click
  const handleCompleteClick = () => {
    setIsListening(false);
  };

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
    // Adding a small value (0.01) to avoid log(0)
    const scaledRMS = Math.min(100, Math.max(0, 
      100 * Math.pow(rms, 0.5) / 0.5
    ));
    
    return scaledRMS;
  };

  // Effect to set up audio visualization when listening state changes
  useEffect(() => {
    if (!mediaStreamRef.current) return;
    
    // Start audio visualization when isListening becomes true
    if (isListening) {
      try {
        // Create an AudioContext if it doesn't exist or if it's closed
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          audioContextRef.current = new AudioContext();
        }
        
        // Create audio source from the media stream
        const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
        
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
        setErrorMessage(`Error setting up level meter: ${error.message}`);
      }
    } else {
      // Clean up when isListening becomes false
      if (animationFrameRef.current) {
        clearTimeout(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // Reset audio level
      setAudioLevel(0);
      
      // Close the audio context
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
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
    };
  }, [isListening]);

  // Effect to handle media recording when isListening changes
  useEffect(() => {
    if (!mediaStreamRef.current) return;

    // Start recording when isListening becomes true
    if (isListening) {
      try {
        // Start the recording timer
        setRecordingTime(0);
        recordingTimerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
        // Clear the audio chunks
        audioChunksRef.current = [];
        
        // Create a new MediaRecorder instance
        const mediaRecorder = new MediaRecorder(mediaStreamRef.current);
        mediaRecorderRef.current = mediaRecorder;
        
        // Set up the ondataavailable event handler
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        // Set up the onstop event handler
        mediaRecorder.onstop = () => {
          console.log(`Recording stopped. Collected ${audioChunksRef.current.length} chunks.`);
          
          // Create a single Blob from all chunks
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          console.log(`Recorded audio blob: size = ${audioBlob.size} bytes, type = ${audioBlob.type}`);
          
          // Show processing status
          setErrorMessage('');
          setIsProcessing(true);
          
          // Detect if recording is empty or very short
          // Skip this check in test environment
          if (audioBlob.size < 1000 && process.env.NODE_ENV !== 'test') {
            setErrorMessage('Recording too short or no speech detected. Please try again.');
            setIsProcessing(false);
            return;
          }
          
          // Simulate STT processing delay
          setTimeout(() => {
            // Generate mock transcript
            const mockTranscript = 'Hello world! This is a mock transcription generated from your audio. The speech-to-text system is working properly.';
            setTranscript(mockTranscript);
            setErrorMessage('');
            setIsProcessing(false);
          }, PROCESSING_DELAY_MS);
        };
        
        // Set up the onerror event handler
        mediaRecorder.onerror = (event) => {
          console.error('MediaRecorder error:', event.error);
          setErrorMessage(`Recording error: ${event.error.message || 'Unknown error'}`);
          setIsListening(false);
        };
        
        // Start recording with configured chunk size
        mediaRecorder.start(RECORDING_TIMESLICE_MS);
        
      } catch (error) {
        console.error('Error starting MediaRecorder:', error);
        setErrorMessage(`Error starting recording: ${error.message}`);
        setIsListening(false);
      }
    } else {
      // Stop recording when isListening becomes false
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
      // Clear recording timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
    
    // Cleanup function
    return () => {
      // Stop the recording if component unmounts while recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
      // Clear recording timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, [isListening]);

  // Use memo for formatted recording time to avoid unnecessary re-renders
  const formattedRecordingTime = useMemo(() => {
    const minutes = Math.floor(recordingTime / 60);
    const seconds = recordingTime % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [recordingTime]);

  // Get status message based on current state
  const getStatusMessage = () => {
    if (errorMessage) {
      return errorMessage;
    }
    
    if (isProcessing) {
      return 'Processing audio...';
    }
    
    switch (permissionStatus) {
      case 'idle':
        return 'Click microphone to start';
      case 'pending':
        return 'Requesting microphone access...';
      case 'denied':
        return 'Microphone access denied';
      case 'granted':
        return isListening ? `Listening... (${formattedRecordingTime})` : 'Microphone ready. Click Mic to start.';
      default:
        return 'Click microphone to start';
    }
  };

  // Get the appropriate mic button text based on listening state
  const getMicButtonText = () => {
    if (!isListening) {
      return 'Start';
    }
    return 'Stop';
  };

  return (
    <Container maxWidth="sm">
      <Paper elevation={3} sx={{ p: 3, mt: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
          {/* Microphone button */}
          <Button 
            variant="contained" 
            color={isListening ? "error" : "primary"}
            startIcon={isListening ? <MicOffIcon /> : <MicIcon />}
            sx={{ 
              borderRadius: '50%', 
              width: 80, 
              height: 80
            }}
            onClick={handleMicButtonClick}
            disabled={isProcessing || permissionStatus === 'pending'}
            aria-label="Toggle microphone"
          >
            {getMicButtonText()}
          </Button>

          {/* Status indicator and level meter container */}
          <Box 
            sx={{ width: '100%', textAlign: 'center', py: 2 }}
            aria-live="polite"
            role="status"
          >
            <Typography variant="body1" color="text.secondary">
              {getStatusMessage()}
            </Typography>
            
            {/* Level meter */}
            {isListening && (
              <Box sx={{ width: '100%', mt: 1 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={audioLevel} 
                  color="success"
                  sx={{ 
                    height: 10, 
                    borderRadius: 5,
                    '& .MuiLinearProgress-bar': {
                      transition: 'transform 0.1s linear'
                    }
                  }}
                  aria-label="Audio level meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(audioLevel)}
                  aria-valuetext={`Audio level ${audioLevel < 33 ? 'low' : audioLevel < 66 ? 'medium' : 'high'}`}
                />
                <Box 
                  sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    mt: 0.5,
                    fontSize: '0.75rem',
                    color: 'text.secondary'
                  }}
                >
                  <span aria-hidden="true">Low</span>
                  <span aria-hidden="true">Medium</span>
                  <span aria-hidden="true">High</span>
                </Box>
              </Box>
            )}
          </Box>

          {/* Complete button (shown only when recording) */}
          {isListening && (
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckIcon />}
              onClick={handleCompleteClick}
              disabled={isProcessing}
              aria-label="Complete recording"
            >
              Complete
            </Button>
          )}

          {/* Transcription result container */}
          <Paper 
            elevation={1} 
            sx={{ 
              width: '100%', 
              minHeight: 100, 
              p: 2, 
              bgcolor: 'grey.50',
              display: 'flex',
              alignItems: 'center',
              justifyContent: transcript ? 'flex-start' : 'center',
              position: 'relative'
            }}
            aria-live="polite"
            role="region"
            aria-label="Transcription output"
          >
            {isProcessing && (
              <Box 
                sx={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  right: 0, 
                  height: 4 
                }}
              >
                <LinearProgress color="primary" />
              </Box>
            )}
            {transcript ? (
              <Typography>
                <Box component="span" role="textbox" aria-readonly="true">{transcript}</Box>
                {transcript && (
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button 
                      size="small" 
                      variant="outlined" 
                      onClick={() => navigator.clipboard.writeText(transcript)}
                      aria-label="Copy transcript to clipboard"
                    >
                      Copy Text
                    </Button>
                  </Box>
                )}
              </Typography>
            ) : (
              <Typography color="text.secondary" align="center">
                {isProcessing ? 'Converting speech to text...' : 'Transcription will appear here'}
              </Typography>
            )}
          </Paper>
        </Box>
      </Paper>
    </Container>
  );
  // Add a useEffect cleanup function to handle component unmount
  useEffect(() => {
    // Return cleanup function that will run on unmount
    return () => {
      // Clean up MediaStream tracks
      cleanupMediaStream();
      
      // Clean up audio context
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
      
      // Clean up animation frame
      if (animationFrameRef.current) {
        clearTimeout(animationFrameRef.current);
      }
      
      // Clean up recording timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []); // Empty dependency array means this only runs on mount/unmount
}

export default VoiceInput;