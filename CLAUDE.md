# Speech-to-Text UI Technical Overview

This document provides a technical overview of the Speech-to-Text user interface project to help future AI assistants quickly understand the codebase architecture and project-specific considerations.

## Project Structure

- **Framework**: React with Vite
- **UI Components**: Material UI
- **Testing**: Vitest and React Testing Library
- **Language**: JavaScript/JSX

## Key Components

### VoiceInput.jsx

The main component that handles:
- Microphone permissions and access
- Audio recording via MediaRecorder API
- Audio level visualization via Web Audio API
- Mock speech-to-text processing
- Status and error displays
- Transcript display with copy functionality

### Constants

```javascript
// Config constants for timing and performance tuning
const RECORDING_TIMESLICE_MS = 500;        // Chunk size for MediaRecorder
const PROCESSING_DELAY_MS = 1500;          // Simulated STT processing delay
const AUDIO_LEVEL_UPDATE_INTERVAL_MS = 100; // Throttling for audio visualization
```

## Audio Processing Flow

1. **Permission Request**: User grants microphone access
2. **Recording Initialization**: MediaRecorder starts collecting audio chunks
3. **Audio Visualization**: Web Audio API analyzes audio data for level meter
4. **Recording Completion**: Audio chunks are combined into a single Blob
5. **Processing**: Mock STT processing with artificial delay
6. **Transcript Display**: Results shown with copy option

## Key APIs Used

### MediaDevices API
```javascript
navigator.mediaDevices.getUserMedia({ audio: true })
```
Used to request microphone access and get an audio stream.

### MediaRecorder API
```javascript
const mediaRecorder = new MediaRecorder(mediaStream);
mediaRecorder.ondataavailable = (event) => { /* ... */ };
mediaRecorder.onstop = () => { /* ... */ };
```
Used to record audio from the MediaStream.

### Web Audio API
```javascript
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();
const source = audioContext.createMediaStreamSource(mediaStream);
```
Used to analyze audio data for visualization.

## State Management

The component uses multiple React state hooks to manage different aspects:

```javascript
const [permissionStatus, setPermissionStatus] = useState('idle');
const [isListening, setIsListening] = useState(false);
const [isProcessing, setIsProcessing] = useState(false);
const [transcript, setTranscript] = useState('');
const [errorMessage, setErrorMessage] = useState('');
const [audioLevel, setAudioLevel] = useState(0);
const [recordingTime, setRecordingTime] = useState(0);
```

## Refs for Resource Management

The component uses refs to maintain references to various resources:

```javascript
const mediaStreamRef = useRef(null);
const mediaRecorderRef = useRef(null);
const audioContextRef = useRef(null);
const analyserRef = useRef(null);
const animationFrameRef = useRef(null);
const audioDataRef = useRef(null);
const audioChunksRef = useRef([]);
const recordingTimerRef = useRef(null);
```

## Important Cleanup Considerations

Resources are cleaned up in multiple places:
- When recording stops
- When the component unmounts
- When user permissions change

## Testing Approach

Tests use mocks for:
- MediaRecorder
- AudioContext
- navigator.mediaDevices
- Web timing functions (setTimeout, setInterval, requestAnimationFrame)

Testing environment-specific behavior is handled with:
```javascript
if (process.env.NODE_ENV !== 'test') {
  // Production-only code
}
```

## Edge Cases Handled

1. Permission denials
2. Missing microphone
3. Empty or very short recordings
4. Browser incompatibilities
5. Non-secure contexts
6. Recording errors
7. Proper resource cleanup
8. Device disconnections

## Accessibility Features

- ARIA live regions for status updates
- ARIA roles for semantic HTML
- Proper keyboard navigation
- Visible status indicators
- Screen reader compatibility

## Future Enhancements Considerations

1. **Real STT Integration**: Replace mock implementation with actual speech recognition services (e.g., Web Speech API, Google Cloud Speech-to-Text, etc.)

2. **Multilingual Support**: Add language selection options

3. **Adaptive Audio Processing**: Implement noise cancellation or voice activity detection

4. **Recording History**: Allow saving and retrieving past recordings/transcripts

5. **Transcription Options**: Add formatting, translation, or summarization features

6. **Enhanced Visualization**: More detailed audio visualization (spectrograms, waveforms)

7. **Mobile Optimizations**: Touch-specific interaction improvements

8. **Performance Improvements**: Further optimization for long recordings or low-resource devices

## Development Workflow

The project development followed these milestones:

1. Basic UI setup
2. Microphone permission handling
3. Start/stop recording functionality
4. Comprehensive error handling
5. Audio level visualization
6. Mock STT processing and transcript display
7. Refinements and edge case handling

## Commands

- **Development**: `npm run dev`
- **Build**: `npm run build`
- **Test**: `npm test`
- **Preview Production Build**: `npm run preview`

## Dependencies

The project uses the following main dependencies:
- React
- Material UI
- Vite
- Vitest and React Testing Library for testing