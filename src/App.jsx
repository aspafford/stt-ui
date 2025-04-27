import { CssBaseline, Box, Typography } from '@mui/material';
import VoiceInput from './components/VoiceInput';
import './App.css';

function App() {
  return (
    <>
      <CssBaseline />
      <Box sx={{ textAlign: 'center', p: 4 }}>
        <Typography variant="h3" gutterBottom>
          Speech to Text
        </Typography>
        <VoiceInput />
      </Box>
    </>
  );
}

export default App;
