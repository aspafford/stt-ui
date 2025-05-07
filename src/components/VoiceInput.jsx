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
    frequencyBands, // Add frequency bands
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
            
            {/* Frequency bands visualization - only show when actively connected */}
            {isListening && connectionStatus === 'connected' && (
              <Box 
                sx={{ 
                  width: '100%', 
                  mt: 1,
                  position: 'relative' 
                }}
                aria-label="Audio frequency visualization"
              >
                {/* Frequency bands visualization */}
                <Box 
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    height: 70, // Slightly taller for better visualization
                    p: 1,
                    bgcolor: 'rgba(0,0,0,0.02)',
                    borderRadius: 2,
                    position: 'relative',
                    border: '1px solid rgba(0,0,0,0.08)',
                  }}
                >
                  {frequencyBands.map((level, index) => {
                    // All bands are now in speech range since we've removed the lowest bands
                    // Color gradient from light blue -> dark blue -> cyan for increasing levels
                    
                    // Calculate color intensity based on frequency range
                    // Our bands now match our frequency ranges: low/mid/high voice
                    const isLowerVoice = index <= 3;  // 300-1000Hz
                    const isMidVoice = index > 3 && index <= 7;  // 1000-2000Hz
                    // Higher speech frequencies (index > 7) will be the default case
                    
                    // Determine color based on level and frequency range
                    let color;
                    if (isLowerVoice) {
                      // Low voice (fundamental frequencies) - purple to indigo
                      color = level < 15 ? 'rgba(103, 58, 183, 0.3)' : // very light purple
                              level < 40 ? 'rgba(103, 58, 183, 0.6)' : // light purple
                              level < 70 ? 'rgba(103, 58, 183, 0.8)' : // purple 
                              'rgba(103, 58, 183, 1.0)';               // deep purple
                    } else if (isMidVoice) {
                      // Mid voice (formants) - blue to primary
                      color = level < 15 ? 'primary.light' : 
                              level < 40 ? 'primary.main' : 
                              level < 70 ? 'info.main' : 'info.dark';
                    } else {
                      // High voice (consonants) - cyan to teal
                      color = level < 15 ? 'rgba(0, 188, 212, 0.3)' : // light cyan
                              level < 40 ? 'rgba(0, 188, 212, 0.6)' : // cyan
                              level < 70 ? 'rgba(0, 188, 212, 0.8)' : // deep cyan
                              'rgba(0, 188, 212, 1.0)';               // teal
                    }
                    
                    return (
                      <Box
                        key={index}
                        sx={{
                          width: `calc(100% / ${frequencyBands.length} - 2px)`,
                          height: `${level}%`,
                          bgcolor: color,
                          borderRadius: '2px 2px 0 0',
                          transition: 'height 0.1s ease',
                          minWidth: 3,
                          // Add glow effect for higher intensity levels
                          boxShadow: level > 70 ? 
                                    '0 0 5px rgba(33, 150, 243, 0.5)' : 'none',
                        }}
                        aria-hidden="true"
                      />
                    );
                  })}
                </Box>
                
                {/* Keep the original level meter hidden for screen readers */}
                <Box sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={audioLevel} 
                    aria-label="Audio level meter"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(audioLevel)}
                    aria-valuetext={`Audio level ${audioLevel < 33 ? 'low' : audioLevel < 66 ? 'medium' : 'high'}`}
                  />
                </Box>
                
                {/* Frequency range indicators with color coding */}
                <Box 
                  sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    mt: 0.5,
                    fontSize: '0.75rem',
                    color: 'text.secondary'
                  }}
                >
                  <span aria-hidden="true" style={{ color: 'rgba(103, 58, 183, 0.8)' }}>Low (300-1000Hz)</span>
                  <span aria-hidden="true" style={{ color: 'rgba(33, 150, 243, 0.8)' }}>Mid (1000-2000Hz)</span>
                  <span aria-hidden="true" style={{ color: 'rgba(0, 188, 212, 0.8)' }}>High (2000-5000Hz)</span>
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