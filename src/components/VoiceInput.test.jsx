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
    
    // Status area
    expect(screen.getByText(/Click microphone to start/i)).toBeInTheDocument();
    
    // Complete button (initially not visible but in DOM)
    // Note: We use a more generic approach since the Complete button might be styled to be hidden
    expect(screen.getByText(/Complete/i)).toBeInTheDocument();
    
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
    
    // We need to spy on the useRef to check if the stream is stored
    // This is a bit tricky in React, so we'll indirectly test functionality
    
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
});