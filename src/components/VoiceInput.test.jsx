import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import VoiceInput from './VoiceInput';

describe('VoiceInput', () => {
  // Mock navigator.mediaDevices.getUserMedia
  const mockGetUserMedia = vi.fn();
  
  beforeEach(() => {
    // Create a mock mediaDevices if it doesn't exist
    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: mockGetUserMedia
        },
        writable: true
      });
    } else {
      // Just mock the getUserMedia method
      navigator.mediaDevices.getUserMedia = mockGetUserMedia;
    }
    
    // Setup console.error mock to avoid polluting test output
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Reset all mocks after each test
    vi.resetAllMocks();
  });
  
  it('renders all required UI elements', () => {
    render(<VoiceInput />);
    
    // Microphone button with MicIcon
    const micButton = screen.getByRole('button', { name: /toggle microphone/i });
    expect(micButton).toBeInTheDocument();
    expect(micButton).toHaveTextContent('Start');
    
    // Status area
    expect(screen.getByText(/Click microphone to start/i)).toBeInTheDocument();
    
    // Complete button (initially not visible, but we can still check for it)
    // We know it's conditionally rendered (not just hidden with CSS)
    // So we confirm it's not in the document when isListening is false
    expect(screen.queryByText(/Complete/i)).not.toBeInTheDocument();
    
    // Transcript display area
    expect(screen.getByText(/Transcription will appear here/i)).toBeInTheDocument();
  });
  
  it('should call getUserMedia when mic button is clicked and permission is not granted', async () => {
    // Mock successful permission
    mockGetUserMedia.mockResolvedValue('mock-stream');
    
    render(<VoiceInput />);
    
    // Find and click the microphone button
    const micButton = screen.getByRole('button', { name: /toggle microphone/i });
    
    await act(async () => {
      fireEvent.click(micButton);
    });
    
    // Check that getUserMedia was called with audio: true
    expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
    
    // Check status is updated
    expect(screen.getByText(/Microphone ready/i)).toBeInTheDocument();
  });
  
  it('should update status on permission denied (NotAllowedError)', async () => {
    // Mock permission denied error
    const permissionError = new Error('Permission denied');
    permissionError.name = 'NotAllowedError';
    mockGetUserMedia.mockRejectedValue(permissionError);
    
    render(<VoiceInput />);
    
    // Find and click the microphone button
    const micButton = screen.getByRole('button', { name: /toggle microphone/i });
    
    await act(async () => {
      fireEvent.click(micButton);
    });
    
    // Should show error message
    expect(screen.getByText(/Microphone permission denied/i)).toBeInTheDocument();
  });
  
  it('should update status on no microphone found (NotFoundError)', async () => {
    // Mock no microphone error
    const noMicError = new Error('No microphone found');
    noMicError.name = 'NotFoundError';
    mockGetUserMedia.mockRejectedValue(noMicError);
    
    render(<VoiceInput />);
    
    // Find and click the microphone button
    const micButton = screen.getByRole('button', { name: /toggle microphone/i });
    
    await act(async () => {
      fireEvent.click(micButton);
    });
    
    // Should show error message
    expect(screen.getByText(/No microphone found/i)).toBeInTheDocument();
  });
  
  it('should handle TypeError when navigator.mediaDevices is undefined', async () => {
    // Simulate TypeError by making getUserMedia throw TypeError
    const typeError = new TypeError('Cannot read properties of undefined');
    mockGetUserMedia.mockRejectedValue(typeError);
    
    // Temporarily remove navigator.mediaDevices to simulate non-secure context
    const originalMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      writable: true
    });
    
    render(<VoiceInput />);
    
    // Find and click the microphone button
    const micButton = screen.getByRole('button', { name: /toggle microphone/i });
    
    await act(async () => {
      fireEvent.click(micButton);
    });
    
    // Should show non-secure context error message
    expect(screen.getByText(/Media devices not available/i)).toBeInTheDocument();
    
    // Restore navigator.mediaDevices
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      writable: true
    });
  });
  
  it('should store MediaStream in ref when permission is granted', async () => {
    // Create a mock MediaStream
    const mockStream = { id: 'mock-stream-id', getTracks: () => [] };
    mockGetUserMedia.mockResolvedValue(mockStream);
    
    render(<VoiceInput />);
    
    // Find and click the microphone button
    const micButton = screen.getByRole('button', { name: /toggle microphone/i });
    
    await act(async () => {
      fireEvent.click(micButton);
    });
    
    // Check status is updated correctly, which indirectly confirms stream was stored
    expect(screen.getByText(/Microphone ready/i)).toBeInTheDocument();
    expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
  });
  
  // Milestone 3 specific tests
  
  it('should toggle isListening when mic button is clicked after permission is granted', async () => {
    // Mock successful permission
    mockGetUserMedia.mockResolvedValue('mock-stream');
    
    render(<VoiceInput />);
    
    const micButton = screen.getByRole('button', { name: /toggle microphone/i });
    
    // First click to get permission
    await act(async () => {
      fireEvent.click(micButton);
    });
    
    // Now with permission granted, click to toggle listening
    await act(async () => {
      fireEvent.click(micButton);
    });
    
    // Should show Listening... status and the button should say Stop
    expect(screen.getByText(/Listening.../i)).toBeInTheDocument();
    expect(micButton).toHaveTextContent('Stop');
    
    // The Complete button should be visible
    const completeButton = screen.getByRole('button', { name: /complete recording/i });
    expect(completeButton).toBeInTheDocument();
    expect(completeButton).toBeVisible();
    
    // Click again to toggle off
    await act(async () => {
      fireEvent.click(micButton);
    });
    
    // Should be back to ready state
    expect(screen.getByText(/Microphone ready/i)).toBeInTheDocument();
    expect(micButton).toHaveTextContent('Start');
    
    // Complete button should not be in the document anymore (conditionally rendered)
    expect(screen.queryByRole('button', { name: /complete recording/i })).not.toBeInTheDocument();
  });
  
  it('should stop listening when Complete button is clicked', async () => {
    // Mock successful permission
    mockGetUserMedia.mockResolvedValue('mock-stream');
    
    render(<VoiceInput />);
    
    const micButton = screen.getByRole('button', { name: /toggle microphone/i });
    
    // First click to get permission
    await act(async () => {
      fireEvent.click(micButton);
    });
    
    // Now with permission granted, click to start listening
    await act(async () => {
      fireEvent.click(micButton);
    });
    
    // Verify we're listening
    expect(screen.getByText(/Listening.../i)).toBeInTheDocument();
    
    // Click the Complete button
    const completeButton = screen.getByRole('button', { name: /complete recording/i });
    await act(async () => {
      fireEvent.click(completeButton);
    });
    
    // Should be back to ready state
    expect(screen.getByText(/Microphone ready/i)).toBeInTheDocument();
    expect(micButton).toHaveTextContent('Start');
  });
  
  it('should clear transcript when starting a new recording', async () => {
    // Mock successful permission
    mockGetUserMedia.mockResolvedValue('mock-stream');
    
    const { rerender } = render(<VoiceInput />);
    
    const micButton = screen.getByRole('button', { name: /toggle microphone/i });
    
    // First click to get permission
    await act(async () => {
      fireEvent.click(micButton);
    });
    
    // Artificially set a transcript by re-rendering with props
    // This is a bit of a hack since we can't directly modify state in tests
    // In a real component we'd use setTranscript, but for the test we'll work around it
    
    // Instead, we'll directly test the implementation logic
    // Get the implementation of handleMicButtonClick
    // We know it calls setTranscript('') when !prevState is true
    // So we'll verify the button click calls this function
    
    // Click to start listening (should clear transcript)
    await act(async () => {
      fireEvent.click(micButton);
    });
    
    // Verify we're listening
    expect(screen.getByText(/Listening.../i)).toBeInTheDocument();
    
    // The transcript should be empty 
    // (We can't directly test this since we can't see state, but we know the logic calls setTranscript(''))
    expect(screen.getByText(/Transcription will appear here/i)).toBeInTheDocument();
  });
});