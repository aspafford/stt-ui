import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import VoiceInput from './VoiceInput';

// Mock the direct path to the hook
vi.mock('../hooks/useSpeechToText', () => ({
  useSpeechToText: vi.fn()
}));

// Import the mocked hook
import { useSpeechToText } from '../hooks/useSpeechToText';

describe('VoiceInput', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('renders all required UI elements in initial state', () => {
    // Set up the mock hook return value for this test
    useSpeechToText.mockReturnValue({
      isListening: false,
      isProcessing: false,
      permissionStatus: 'idle',
      audioLevel: 0,
      transcript: '',
      formattedRecordingTime: '00:00',
      errorMessage: '',
      toggleListening: vi.fn(),
      stopListening: vi.fn(),
      clearTranscript: vi.fn()
    });
    
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
    // Set up the mock hook return value for listening state
    useSpeechToText.mockReturnValue({
      isListening: true,
      isProcessing: false,
      permissionStatus: 'granted',
      audioLevel: 50, // Mid-level audio
      transcript: '',
      formattedRecordingTime: '00:05',
      errorMessage: '',
      toggleListening: vi.fn(),
      stopListening: vi.fn(),
      clearTranscript: vi.fn()
    });
    
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
    // Set up the mock hook return value for processing state
    useSpeechToText.mockReturnValue({
      isListening: false,
      isProcessing: true,
      permissionStatus: 'granted',
      audioLevel: 0,
      transcript: '',
      formattedRecordingTime: '00:00',
      errorMessage: '',
      toggleListening: vi.fn(),
      stopListening: vi.fn(),
      clearTranscript: vi.fn()
    });
    
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
    useSpeechToText.mockReturnValue({
      isListening: false,
      isProcessing: false,
      permissionStatus: 'granted',
      audioLevel: 0,
      transcript: 'This is a test transcript',
      formattedRecordingTime: '00:00',
      errorMessage: '',
      toggleListening: vi.fn(),
      stopListening: vi.fn(),
      clearTranscript: vi.fn()
    });
    
    render(<VoiceInput />);
    
    // Transcript should be displayed
    expect(screen.getByText('This is a test transcript')).toBeInTheDocument();
    
    // Clear and Copy buttons should be visible
    expect(screen.getByRole('button', { name: /clear transcript/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy transcript/i })).toBeInTheDocument();
  });
  
  it('renders error message when there is an error', () => {
    // Mock with error message
    useSpeechToText.mockReturnValue({
      isListening: false,
      isProcessing: false,
      permissionStatus: 'denied',
      audioLevel: 0,
      transcript: '',
      formattedRecordingTime: '00:00',
      errorMessage: 'Microphone permission denied',
      toggleListening: vi.fn(),
      stopListening: vi.fn(),
      clearTranscript: vi.fn()
    });
    
    render(<VoiceInput />);
    
    // Error message should be displayed
    expect(screen.getByText('Microphone permission denied')).toBeInTheDocument();
  });
  
  it('calls toggleListening when mic button is clicked', async () => {
    // Set up mock with toggleListening spy
    const toggleListeningSpy = vi.fn();
    useSpeechToText.mockReturnValue({
      isListening: false,
      isProcessing: false,
      permissionStatus: 'granted',
      audioLevel: 0,
      transcript: '',
      formattedRecordingTime: '00:00',
      errorMessage: '',
      toggleListening: toggleListeningSpy,
      stopListening: vi.fn(),
      clearTranscript: vi.fn()
    });
    
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
    // Set up mock with toggleListening spy
    const stopListeningSpy = vi.fn();
    useSpeechToText.mockReturnValue({
      isListening: true,
      isProcessing: false,
      permissionStatus: 'granted',
      audioLevel: 50,
      transcript: '',
      formattedRecordingTime: '00:05',
      errorMessage: '',
      toggleListening: vi.fn(),
      stopListening: stopListeningSpy,
      clearTranscript: vi.fn()
    });
    
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
    useSpeechToText.mockReturnValue({
      isListening: false,
      isProcessing: false,
      permissionStatus: 'granted',
      audioLevel: 0,
      transcript: 'This is a test transcript',
      formattedRecordingTime: '00:00',
      errorMessage: '',
      toggleListening: vi.fn(),
      stopListening: vi.fn(),
      clearTranscript: clearTranscriptSpy
    });
    
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
    useSpeechToText.mockReturnValue({
      isListening: false,
      isProcessing: false,
      permissionStatus: 'granted',
      audioLevel: 0,
      transcript: 'This is a test transcript',
      formattedRecordingTime: '00:00',
      errorMessage: '',
      toggleListening: vi.fn(),
      stopListening: vi.fn(),
      clearTranscript: vi.fn()
    });
    
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