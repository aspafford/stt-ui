import { useState, useRef, useEffect } from 'react';
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

function VoiceInput() {
  // State variables as specified in the milestone
  const [permissionStatus, setPermissionStatus] = useState('idle');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Refs to store the MediaStream and MediaRecorder objects
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  
  // Ref to store audio chunks
  const audioChunksRef = useRef([]);

  // Function to request microphone permission
  const requestMicrophonePermission = async () => {
    // Only proceed if not already granted
    if (permissionStatus !== 'granted') {
      try {
        setPermissionStatus('pending');
        setErrorMessage('');
        
        // Request access to the microphone
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
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

  // Effect to handle media recording when isListening changes
  useEffect(() => {
    if (!mediaStreamRef.current) return;

    // Start recording when isListening becomes true
    if (isListening) {
      try {
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
        };
        
        // Set up the onerror event handler
        mediaRecorder.onerror = (event) => {
          console.error('MediaRecorder error:', event.error);
          setErrorMessage(`Recording error: ${event.error.message || 'Unknown error'}`);
          setIsListening(false);
        };
        
        // Start recording with 500ms chunks
        mediaRecorder.start(500);
        
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
    }
    
    // Cleanup function
    return () => {
      // Stop the recording if component unmounts while recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isListening]);

  // Get status message based on current state
  const getStatusMessage = () => {
    if (errorMessage) {
      return errorMessage;
    }
    
    switch (permissionStatus) {
      case 'idle':
        return 'Click microphone to start';
      case 'pending':
        return 'Requesting microphone access...';
      case 'denied':
        return 'Microphone access denied';
      case 'granted':
        return isListening ? 'Listening...' : 'Microphone ready. Click Mic to start.';
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
            aria-label="Toggle microphone"
          >
            {getMicButtonText()}
          </Button>

          {/* Status indicator and level meter container */}
          <Box 
            sx={{ width: '100%', textAlign: 'center', py: 2 }}
            aria-live="polite"
          >
            <Typography variant="body1" color="text.secondary">
              {getStatusMessage()}
            </Typography>
            
            {/* Level meter (initially empty) */}
            {isListening && (
              <Box sx={{ width: '100%', mt: 1 }}>
                <LinearProgress variant="determinate" value={0} />
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
              justifyContent: transcript ? 'flex-start' : 'center'
            }}
            aria-live="polite"
          >
            {transcript ? (
              <Typography>{transcript}</Typography>
            ) : (
              <Typography color="text.secondary" align="center">
                Transcription will appear here
              </Typography>
            )}
          </Paper>
        </Box>
      </Paper>
    </Container>
  );
}

export default VoiceInput;