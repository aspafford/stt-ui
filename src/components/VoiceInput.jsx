import { useState } from 'react';
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

  return (
    <Container maxWidth="sm">
      <Paper elevation={3} sx={{ p: 3, mt: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
          {/* Microphone button */}
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<MicIcon />}
            sx={{ borderRadius: '50%', width: 80, height: 80 }}
          >
            Mic
          </Button>

          {/* Status indicator and level meter container */}
          <Box sx={{ width: '100%', textAlign: 'center', py: 2 }}>
            <Typography variant="body1" color="text.secondary">
              {permissionStatus === 'idle' ? 'Click microphone to start' : 
               permissionStatus === 'pending' ? 'Requesting microphone access...' :
               permissionStatus === 'denied' ? 'Microphone access denied' :
               isListening ? 'Listening...' : 'Microphone ready'}
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