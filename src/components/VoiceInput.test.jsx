import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import VoiceInput from './VoiceInput';

// Mock the direct path to the hook
vi.mock('../hooks/useSpeechToText', () => ({
  useSpeechToText: vi.fn()
}));

// Import the mocked hook
import { useSpeechToText } from '../hooks/useSpeechToText';

/**
 * Creates mock values for the useSpeechToText hook with sensible defaults
 * @param {Object} overrides - Properties to override in the default mock values
 * @returns {Object} Mock values for the useSpeechToText hook
 */
const createSpeechToTextMock = (overrides = {}) => {
  // Default mock values
  const defaults = {
    isListening: false,
    isProcessing: false,
    permissionStatus: 'idle',
    connectionStatus: 'idle',
    audioLevel: 0,
    transcript: '',
    tempTranscript: '',
    partialTranscript: '',
    formattedRecordingTime: '00:00',
    errorMessage: '',
    toggleListening: vi.fn(),
    stopListening: vi.fn(),
    clearTranscript: vi.fn(),
    sendAudio: vi.fn(),
    getAudioContext: vi.fn(),
    getSampleRate: vi.fn()
  };
  
  // Return merged object with overrides taking precedence
  return { ...defaults, ...overrides };
};

describe('VoiceInput', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('renders all required UI elements in initial state', () => {
    // Use default mock values (idle state)
    useSpeechToText.mockReturnValue(createSpeechToTextMock());
    
    render(<VoiceInput />);
    
    // Microphone button
    const micButton = screen.getByRole('button', { name: /toggle microphone/i });
    expect(micButton).toBeInTheDocument();
    expect(micButton).toHaveTextContent('Start');
    
    // Status text
    expect(screen.getByText(/Click microphone to start/i)).toBeInTheDocument();
    
    // Complete button should not be visible
    expect(screen.queryByText(/Complete/i)).not.toBeInTheDocument();
    
    // Transcript area
    expect(screen.getByText(/Transcription will appear here/i)).toBeInTheDocument();
  });
  
  it('renders listening state UI elements', () => {
    // Set up mock for active listening state
    useSpeechToText.mockReturnValue(createSpeechToTextMock({
      isListening: true,
      permissionStatus: 'granted',
      connectionStatus: 'connected',
      audioLevel: 50, // Mid-level audio
      formattedRecordingTime: '00:05'
    }));
    
    render(<VoiceInput />);
    
    // Microphone button should say "Stop"
    const micButton = screen.getByRole('button', { name: /toggle microphone/i });
    expect(micButton).toHaveTextContent('Stop');
    
    // Status should show Listening with timer
    expect(screen.getByText(/Listening... \(00:05\)/i)).toBeInTheDocument();
    
    // Complete button should be visible
    expect(screen.getByText(/Complete/i)).toBeInTheDocument();
    
    // Audio level meter should be visible
    expect(screen.getByRole('progressbar', { name: /audio level meter/i })).toBeInTheDocument();
  });
  
  it('renders processing state UI elements', () => {
    // Set up mock for processing state
    useSpeechToText.mockReturnValue(createSpeechToTextMock({
      isProcessing: true,
      permissionStatus: 'granted'
    }));
    
    render(<VoiceInput />);
    
    // Status should show Processing
    expect(screen.getByText(/Processing audio/i)).toBeInTheDocument();
    
    // Mic button should be disabled
    const micButton = screen.getByRole('button', { name: /toggle microphone/i });
    expect(micButton).toBeDisabled();
    
    // Linear progress should be visible
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    
    // Transcript area message
    expect(screen.getByText(/Converting speech to text/i)).toBeInTheDocument();
  });
  
  it('renders transcript and action buttons when transcript exists', () => {
    // Mock with existing transcript
    useSpeechToText.mockReturnValue(createSpeechToTextMock({
      permissionStatus: 'granted',
      transcript: 'This is a test transcript'
    }));
    
    render(<VoiceInput />);
    
    // Transcript should be displayed
    expect(screen.getByText('This is a test transcript')).toBeInTheDocument();
    
    // Clear and Copy buttons should be visible
    expect(screen.getByRole('button', { name: /clear transcript/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy transcript/i })).toBeInTheDocument();
  });
  
  it('renders connecting state UI elements', () => {
    // Set up mock for connecting state
    useSpeechToText.mockReturnValue(createSpeechToTextMock({
      isListening: true,
      permissionStatus: 'granted',
      connectionStatus: 'connecting' // Still connecting to AssemblyAI
    }));
    
    render(<VoiceInput />);
    
    // Status should show connecting message
    expect(screen.getByText(/Connecting to speech service/i)).toBeInTheDocument();
    
    // Should show indeterminate progress bar
    const progressBar = screen.getByRole('progressbar', { name: /Connecting/i });
    expect(progressBar).toBeInTheDocument();
    
    // Complete button should be disabled
    const completeButton = screen.getByRole('button', { name: /complete recording/i });
    expect(completeButton).toBeDisabled();
  });

  it('renders error message when there is an error', () => {
    // Mock with error message
    useSpeechToText.mockReturnValue(createSpeechToTextMock({
      permissionStatus: 'denied',
      errorMessage: 'Microphone permission denied'
    }));
    
    render(<VoiceInput />);
    
    // Error message should be displayed
    expect(screen.getByText('Microphone permission denied')).toBeInTheDocument();
  });
  
  it('calls toggleListening when mic button is clicked', async () => {
    // Set up mock with toggleListening spy
    const toggleListeningSpy = vi.fn();
    useSpeechToText.mockReturnValue(createSpeechToTextMock({
      permissionStatus: 'granted',
      toggleListening: toggleListeningSpy
    }));
    
    render(<VoiceInput />);
    
    // Find and click the microphone button
    const micButton = screen.getByRole('button', { name: /toggle microphone/i });
    
    await act(async () => {
      fireEvent.click(micButton);
    });
    
    // Check that toggleListening was called
    expect(toggleListeningSpy).toHaveBeenCalledTimes(1);
  });
  
  it('calls stopListening when Complete button is clicked', async () => {
    // Set up mock with stopListening spy
    const stopListeningSpy = vi.fn();
    useSpeechToText.mockReturnValue(createSpeechToTextMock({
      isListening: true,
      permissionStatus: 'granted',
      connectionStatus: 'connected',
      audioLevel: 50,
      formattedRecordingTime: '00:05',
      stopListening: stopListeningSpy
    }));
    
    render(<VoiceInput />);
    
    // Find and click the Complete button
    const completeButton = screen.getByRole('button', { name: /complete recording/i });
    
    await act(async () => {
      fireEvent.click(completeButton);
    });
    
    // Check that stopListening was called
    expect(stopListeningSpy).toHaveBeenCalledTimes(1);
  });
  
  it('calls clearTranscript when Clear button is clicked', async () => {
    // Set up mock with clearTranscript spy
    const clearTranscriptSpy = vi.fn();
    useSpeechToText.mockReturnValue(createSpeechToTextMock({
      permissionStatus: 'granted',
      transcript: 'This is a test transcript',
      clearTranscript: clearTranscriptSpy
    }));
    
    render(<VoiceInput />);
    
    // Find and click the Clear button
    const clearButton = screen.getByRole('button', { name: /clear transcript/i });
    
    await act(async () => {
      fireEvent.click(clearButton);
    });
    
    // Check that clearTranscript was called
    expect(clearTranscriptSpy).toHaveBeenCalledTimes(1);
  });
  
  it('calls navigator.clipboard.writeText when Copy button is clicked', async () => {
    // Mock clipboard API
    const writeTextMock = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true
    });
    
    // Set up mock with transcript
    useSpeechToText.mockReturnValue(createSpeechToTextMock({
      permissionStatus: 'granted',
      transcript: 'This is a test transcript'
    }));
    
    render(<VoiceInput />);
    
    // Find and click the Copy button
    const copyButton = screen.getByRole('button', { name: /copy transcript/i });
    
    await act(async () => {
      fireEvent.click(copyButton);
    });
    
    // Check that clipboard.writeText was called with the transcript
    expect(writeTextMock).toHaveBeenCalledWith('This is a test transcript');
  });
});