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

// Import master hook that coordinates all functionality
import { useSpeechToText } from '../hooks/useSpeechToText';

/**
 * Voice Input component with speech-to-text functionality
 * @returns {JSX.Element} Rendered component
 */
function VoiceInput() {
  const {
    // State
    isListening,
    isProcessing,
    permissionStatus,
    connectionStatus,
    audioLevel,
    transcript,
    formattedRecordingTime,
    errorMessage,
    
    // Functions
    toggleListening,
    stopListening,
    clearTranscript
  } = useSpeechToText();

  // Get status message based on current state
  const getStatusMessage = () => {
    if (errorMessage) {
      return errorMessage;
    }
    
    if (isProcessing) {
      return 'Processing audio...';
    }
    
    // Check if we're connecting to AssemblyAI
    if (isListening && connectionStatus === 'connecting') {
      return 'Connecting to speech service...';
    }
    
    switch (permissionStatus) {
      case 'idle':
        return 'Click microphone to start';
      case 'pending':
        return 'Requesting microphone access...';
      case 'denied':
        return 'Microphone access denied';
      case 'granted':
        if (isListening) {
          if (connectionStatus === 'connected') {
            return `Listening... (${formattedRecordingTime})`;
          } else {
            return 'Preparing to listen...';
          }
        } else {
          return 'Microphone ready. Click Mic to start.';
        }
      default:
        return 'Click microphone to start';
    }
  };

  // Get the appropriate mic button text
  const getMicButtonText = () => {
    return isListening ? 'Stop' : 'Start';
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
            onClick={toggleListening}
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
            
            {/* Loading indicator when connecting */}
            {isListening && connectionStatus === 'connecting' && (
              <Box sx={{ width: '100%', mt: 1 }}>
                <LinearProgress 
                  variant="indeterminate" 
                  color="primary"
                  sx={{ 
                    height: 6, 
                    borderRadius: 3
                  }}
                  aria-label="Connecting"
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Establishing connection to speech service...
                </Typography>
              </Box>
            )}
            
            {/* Level meter - only show when actively connected */}
            {isListening && connectionStatus === 'connected' && (
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
              onClick={stopListening}
              disabled={isProcessing || connectionStatus !== 'connected'}
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
                      onClick={clearTranscript}
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
}

export default VoiceInput;