import { useState, useRef } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Paper, 
  Container,
  LinearProgress
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import CheckIcon from '@mui/icons-material/Check';

function VoiceInput() {
  // State variables as specified in the milestone
  const [permissionStatus, setPermissionStatus] = useState('idle');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Ref to store the MediaStream object
  const mediaStreamRef = useRef(null);

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
      // In milestone 3, we'll implement the recording toggle
      // For now, just log that we would toggle recording
      console.log('Permission granted, would toggle recording state here');
    } else {
      // Request microphone access
      await requestMicrophonePermission();
    }
  };

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

  return (
    <Container maxWidth="sm">
      <Paper elevation={3} sx={{ p: 3, mt: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
          {/* Microphone button */}
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<MicIcon />}
            sx={{ 
              borderRadius: '50%', 
              width: 80, 
              height: 80,
              backgroundColor: isListening ? 'error.main' : 'primary.main'
            }}
            onClick={handleMicButtonClick}
            aria-label="Toggle microphone"
          >
            Mic
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

          {/* Complete button (hidden initially) */}
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckIcon />}
            disabled={!isListening}
            sx={{ display: isListening ? 'flex' : 'none' }}
            aria-label="Complete recording"
          >
            Complete
          </Button>

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