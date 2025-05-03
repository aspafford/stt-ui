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
// Import the API and RealtimeTranscriber from AssemblyAI
import { AssemblyAI, RealtimeTranscriber } from 'assemblyai';
// Log the SDK to check it's properly loaded
console.log('AssemblyAI SDK imported');

// Constants for configuration
const RECORDING_TIMESLICE_MS = 500;
const AUDIO_LEVEL_UPDATE_INTERVAL_MS = 100;
const API_URL = 'http://localhost:3000/api/stt-token';
const API_KEY = 'stt_client_token_12345'; // In production, store this securely

function VoiceInput() {
  // State variables as specified in the milestone
  const [permissionStatus, setPermissionStatus] = useState('idle');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); 
  const [transcript, setTranscript] = useState('');
  const [tempTranscript, setTempTranscript] = useState(''); // Store FINAL transcript segments while recording
  const [partialTranscript, setPartialTranscript] = useState(''); // Store PARTIAL transcript (not used in final output)
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
  
  // Ref for recording timer interval
  const recordingTimerRef = useRef(null);

  // Refs for AssemblyAI transcriber and token
  const socketRef = useRef(null);
  const assemblyTokenRef = useRef(null);
  const connectionReadyRef = useRef(false);

  // Function to clean up MediaStream tracks
  const cleanupMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  // Function to request a temporary token from our server
  const fetchAssemblyToken = async () => {
    try {
      console.log('Fetching token from:', API_URL);
      console.log('Using client API key:', API_KEY);
      
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
      console.log('Received token response:', data);
      
      if (!data.token) {
        console.error('Token is missing in the response:', data);
        throw new Error('Server did not return a token');
      }
      
      return data.token;
    } catch (error) {
      console.error('Error fetching AssemblyAI token:', error);
      throw error;
    }
  };

  // Function to initialize WebSocket connection with AssemblyAI
  const initializeAssemblyAI = useCallback(async () => {
    try {
      // Get a token from our server
      const token = await fetchAssemblyToken();
      assemblyTokenRef.current = token;
      console.log('Received token from server:', token);
      if (!token) {
        throw new Error('Token is undefined or empty');
      }
      
      // Helper function to set up event handlers for the transcriber
      const setupEventHandlers = (transcriber) => {
        transcriber.on("open", () => {
          console.log('AssemblyAI connection established');
          connectionReadyRef.current = true;
          // Reset any previous error messages when connection is established
          setErrorMessage('');
        });
        
        // Handle connection status changes
        transcriber.on("connecting", () => {
          console.log('Connecting to AssemblyAI...');
        });
        
        transcriber.on("connected", () => {
          console.log('AssemblyAI connection active and ready for audio');
          connectionReadyRef.current = true;
        });
        
        // Handle session begin message
        transcriber.on("SessionBegins", (session) => {
          console.log('Session begins:', session);
        });
        
        transcriber.on("transcript", (transcriptData) => {
          console.log('Transcript received:', transcriptData);
          
          // Helper function to extract text from any transcript format
          const getTranscriptText = (data) => {
            // Try to find the transcript text in various potential locations
            return data.text || 
                   data.transcript || 
                   (data.data && data.data.text) || 
                   (data.data && data.data.transcript) || 
                   (typeof data.message === 'string' ? data.message : '');
          };
          
          // Get the text from the current transcript object
          const newText = getTranscriptText(transcriptData);
          
          // Skip empty text
          if (!newText || newText.trim() === '') {
            console.log('Received transcript but text is empty');
            return;
          }
          
          // Handle based on message type
          if (transcriptData.message_type === 'PartialTranscript') {
            // Store partial transcripts in separate state variable
            // This prevents partials from overwriting our accumulated final transcripts
            setPartialTranscript(newText);
            
            // For debugging only:
            if (Math.random() < 0.2) { // Only log 20% of partials
              console.log('Received partial transcript (not affecting final output):', 
                newText.substring(0, 30) + (newText.length > 30 ? '...' : ''));
            }
          } 
          else if (transcriptData.message_type === 'FinalTranscript') {
            // For final transcripts, ACCUMULATE in the temporary transcript
            // This is the critical part - we must append each final segment
            if (newText.trim()) {
              console.log('Appended final transcript segment:', newText);
              
              // Create a unique ID for debugging this specific setTempTranscript call
              const updateId = Math.random().toString(36).substring(2, 8);
              console.log(`[${updateId}] Starting temp transcript update with:`, newText);
              console.log(`[${updateId}] Current tempTranscript before update:`, tempTranscript);
              
              setTempTranscript(prevTemp => {
                // Add a space between segments if needed
                const spacer = prevTemp ? ' ' : '';
                const updatedText = prevTemp + spacer + newText.trim();
                
                console.log(`[${updateId}] Prev temp value inside update fn:`, prevTemp);
                console.log(`[${updateId}] New temp value being set:`, updatedText);
                
                return updatedText;
              });
            }
          }
          else {
            // For any other type of message, also append to temp transcript if it has content
            if (newText.trim()) {
              console.log('Non-standard transcript with text:', newText);
              
              setTempTranscript(prevTemp => {
                // Add a space between segments if needed
                const spacer = prevTemp ? ' ' : '';
                return prevTemp + spacer + newText.trim();
              });
            }
          }
        });
        
        // Enhanced error handling
        transcriber.on("error", (error) => {
          console.error('AssemblyAI error:', error);
          
          // Create a more user-friendly error message
          let errorMsg;
          if (error.message) {
            errorMsg = `Error: ${error.message}`;
          } else if (typeof error === 'string') {
            errorMsg = `Error: ${error}`;
          } else {
            errorMsg = 'An error occurred with the speech recognition service';
          }
          
          setErrorMessage(errorMsg);
          
          // Try to reconnect if it's a connection issue
          if (error.message && 
             (error.message.includes('connection') || 
              error.message.includes('network') || 
              error.message.includes('timeout'))) {
            console.log('Connection error detected, will attempt to reconnect...');
            // Wait a moment before reconnecting
            setTimeout(() => {
              if (socketRef.current === transcriber) {
                try {
                  transcriber.connect().catch(e => {
                    console.error('Reconnection attempt failed:', e);
                  });
                } catch (e) {
                  console.error('Error in reconnection attempt:', e);
                }
              }
            }, 2000);
          }
        });
        
        transcriber.on("close", () => {
          console.log('AssemblyAI connection closed');
          connectionReadyRef.current = false;
        });
        
        // Handle session end message
        transcriber.on("SessionTerminated", (reason) => {
          console.log('Session terminated with reason:', reason);
        });
        
        // Connect to AssemblyAI
        (async () => {
          try {
            console.log('Attempting to connect to AssemblyAI...');
            await transcriber.connect();
            console.log('Successfully connected to AssemblyAI');
          } catch (error) {
            console.error('Error connecting to AssemblyAI:', error);
            setErrorMessage(`Connection error: ${error.message || 'Failed to connect to speech service'}`);
            
            // Try reconnecting after a delay
            setTimeout(() => {
              console.log('Attempting to reconnect after failure...');
              if (socketRef.current === transcriber) {
                try {
                  transcriber.connect().catch(e => {
                    console.error('Reconnection attempt failed:', e);
                  });
                } catch (e) {
                  console.error('Error in reconnection attempt:', e);
                }
              }
            }, 3000);
          }
        })();
      };
      
      try {
        console.log('Creating RealtimeTranscriber...');
        
        // First, make sure we have an AudioContext to get the sample rate
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          audioContextRef.current = new AudioContext();
          console.log('Created AudioContext with sample rate:', audioContextRef.current.sampleRate);
        }
        
        // Get the actual sample rate from the audio context
        const actualSampleRate = audioContextRef.current.sampleRate;
        console.log('Using actual sample rate for transcriber:', actualSampleRate);
        
        // Create a realtime transcriber with the actual sample rate
        const transcriber = new RealtimeTranscriber({
          token: token,
          sample_rate: actualSampleRate // Critical: Use actual browser sample rate
        });
        
        // Log created transcriber object
        console.log('Transcriber object:', transcriber);
        
        console.log('Transcriber created successfully');
        
        // Store the transcriber in the ref
        socketRef.current = transcriber;
        
        // Set up event handlers
        setupEventHandlers(transcriber);
        
        return transcriber;
      } catch (error) {
        console.error('Error creating transcriber:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error initializing AssemblyAI:', error);
      setErrorMessage(`Failed to connect to speech-to-text service: ${error.message}`);
      return null;
    }
  }, []);

  // Function to close the AssemblyAI connection
  const closeAssemblyAI = useCallback(async () => {
    if (socketRef.current) {
      try {
        console.log('Closing AssemblyAI connection...');
        // Check if the connection is already closed
        if (typeof socketRef.current.close === 'function') {
          await socketRef.current.close();
          console.log('AssemblyAI connection closed successfully');
        } else {
          console.log('Connection does not have a close method, might already be closed');
        }
      } catch (error) {
        console.error('Error closing AssemblyAI connection:', error);
      }
      socketRef.current = null;
      connectionReadyRef.current = false;
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
      if (isListening) {
        // IMPORTANT: We're stopping a recording session
        console.log('Stopping recording...');
        console.log('Current temp transcript before stopping:', tempTranscript);
        
        // Show processing state
        setIsProcessing(true);
        
        // CRITICAL: Add a longer delay (1.5 seconds) before stopping to ensure all final transcripts are processed
        setTimeout(() => {
          // Now actually stop the recording by updating isListening state
          setIsListening(false);
          
          // Then process the collected transcript after another small delay
          setTimeout(() => {
            console.log('Processing final transcript after delay...');
            console.log('Final temp transcript value:', tempTranscript);
            
            // Only update the transcript if there's content in tempTranscript
            if (tempTranscript.trim()) {
              console.log('Final collected transcript from this session:', tempTranscript.trim());
              
              // Move the temp transcript to the displayed transcript
              setTranscript(prev => {
                // If there's already content, add a space before new content
                const spacer = prev && !prev.endsWith(' ') ? ' ' : '';
                const newContent = tempTranscript.trim();
                
                // Concatenate to existing transcript
                const finalText = prev + spacer + newContent;
                console.log('Complete transcript after appending:', finalText);
                return finalText;
              });
            } else {
              console.log('No transcript content to append from this session');
            }
            
            // Clear the temp transcript
            setTempTranscript('');
            
            // End processing state
            setIsProcessing(false);
          }, 500);
        }, 1500); // Longer delay to ensure all transcript events are processed
      } else {
        // Starting new recording session
        console.log('Starting new recording session...');
        
        // Reset temporary states before starting
        setTempTranscript('');
        setPartialTranscript('');
        console.log('Starting new recording session - cleared temporary transcripts');
        
        // Start listening
        setIsListening(true);
      }
    } else {
      // Request microphone access
      await requestMicrophonePermission();
    }
  };
  
  // Add a function to clear transcript
  const handleClearTranscript = () => {
    setTranscript('');
    setTempTranscript('');
    setPartialTranscript('');
    console.log('All transcripts cleared');
  };
  
  // Handler for complete button click
  const handleCompleteClick = () => {
    if (isListening) {
      // Use the same logic as the mic button for stopping
      handleMicButtonClick();
    }
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

  // Function to convert Float32Array to Int16Array
  const convertFloat32ToInt16 = (float32Array) => {
    const int16Array = new Int16Array(float32Array.length);
    
    for (let i = 0; i < float32Array.length; i++) {
      // Convert from -1.0 - 1.0 range to -32768 - 32767 range
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    
    return int16Array;
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
          
          // Use 16kHz sample rate - most STT APIs expect this
          const sampleRate = 16000;
          
          // Try to create with desired sample rate, but this might be ignored by browser
          try {
            audioContextRef.current = new AudioContext({ sampleRate });
            console.log('Created AudioContext with sample rate:', audioContextRef.current.sampleRate);
          } catch (error) {
            // Fall back to default if setting sample rate fails
            console.error('Failed to create AudioContext with specific sample rate:', error);
            audioContextRef.current = new AudioContext();
            console.log('Created default AudioContext with sample rate:', audioContextRef.current.sampleRate);
          }
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

  // Effect to handle media recording and AssemblyAI when isListening changes
  useEffect(() => {
    if (!mediaStreamRef.current) return;

    // Start recording and AssemblyAI when isListening becomes true
    if (isListening) {
      (async () => {
        try {
          // Initialize AssemblyAI WebSocket
          await initializeAssemblyAI();
          
          // Start the recording timer
          setRecordingTime(0);
          recordingTimerRef.current = setInterval(() => {
            setRecordingTime(prev => prev + 1);
          }, 1000);
          
          // Create audio processor for real-time STT
          if (audioContextRef.current) {
            // Use a larger buffer size for more stable audio processing
            const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            // Keep reference to the processor to avoid garbage collection
            audioContextRef.current.audioWorkletProcessor = processor;
            
            processor.onaudioprocess = (e) => {
              // Only send data if we're recording, the transcriber is initialized, and the connection is ready
              if (isListening && socketRef.current && connectionReadyRef.current) {
                // Get the audio data from the input channel
                const inputData = e.inputBuffer.getChannelData(0);
                
                try {
                  // Log audio data to see if it contains actual sound
                  const hasSound = inputData.some(sample => Math.abs(sample) > 0.01);
                  
                  // IMPORTANT: Always send audio data, even if it seems silent
                  // This ensures a continuous audio stream which STT systems need
                  
                  // Minimal logging - just occasionally check if we have sound
                  if (Math.random() < 0.005) { // Only log 0.5% of the time
                    if (hasSound) {
                      const max = Math.max(...Array.from(inputData).map(s => Math.abs(s)));
                      console.log('Audio active, level:', max.toFixed(3));
                    }
                  }
                  
                  // Convert Float32Array to Int16Array before sending - critical for STT
                  // This uses the convertFloat32ToInt16 function that's already defined but not being used
                  const int16Data = convertFloat32ToInt16(inputData);
                  
                  // Send the converted audio data to AssemblyAI
                  socketRef.current.sendAudio(int16Data.buffer);
                } catch (error) {
                  console.error('Error sending audio to AssemblyAI:', error);
                }
              } else if (isListening && socketRef.current && !connectionReadyRef.current) {
                // The connection is not ready yet, but we're trying to send data
                // This is normal during initialization and not an error
                console.log('Waiting for AssemblyAI connection to be ready before sending audio...');
              }
            };
            
            // Important: Connect the processor to the audio source but NOT to the destination
            // to avoid audio feedback issues
            const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
            source.connect(processor);
            
            // Don't connect to destination to avoid feedback loop
            // Connecting to destination would play back the microphone input
            // causing echo and feedback
            // processor.connect(audioContextRef.current.destination);
            
            // Instead, connect to a silent node if needed - this creates a valid audio graph
            // without causing feedback
            const silentNode = audioContextRef.current.createGain();
            silentNode.gain.value = 0; // Set gain to 0 to make it silent
            processor.connect(silentNode);
            silentNode.connect(audioContextRef.current.destination);
          }
        } catch (error) {
          console.error('Error starting speech-to-text:', error);
          setErrorMessage(`Error starting speech-to-text: ${error.message}`);
          setIsListening(false);
        }
      })();
    } else {
      // Stop recording when isListening becomes false
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
      // Close WebSocket connection
      closeAssemblyAI();
      
      // Clear recording timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
    
    // Cleanup function
    return () => {
      // Close WebSocket if component unmounts
      (async () => {
        try {
          await closeAssemblyAI();
        } catch (error) {
          console.error('Error closing AssemblyAI connection during cleanup:', error);
        }
      })();
      
      // Clear recording timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, [isListening, initializeAssemblyAI, closeAssemblyAI]);

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
              <Box>
                <Typography component="div">
                  <Box component="span" role="textbox" aria-readonly="true">{transcript}</Box>
                </Typography>
                {transcript && (
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    <Button 
                      size="small" 
                      variant="outlined" 
                      color="secondary"
                      onClick={handleClearTranscript}
                      aria-label="Clear transcript"
                    >
                      Clear
                    </Button>
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
              </Box>
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

  // useEffect cleanup function to handle component unmount
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
      
      // Close AssemblyAI connection
      (async () => {
        try {
          await closeAssemblyAI();
        } catch (error) {
          console.error('Error closing AssemblyAI connection during final cleanup:', error);
        }
      })();
    };
  }, [cleanupMediaStream, closeAssemblyAI]); // Include dependencies
}

export default VoiceInput;