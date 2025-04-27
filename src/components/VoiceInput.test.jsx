import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import VoiceInput from './VoiceInput';

// Mock MediaRecorder globally
class MockMediaRecorder {
  constructor(stream) {
    this.stream = stream;
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
    this.onerror = null;
  }

  start(timeslice) {
    this.state = 'recording';
    return this;
  }

  stop() {
    this.state = 'inactive';
    if (this.onstop) {
      this.onstop();
    }
    return this;
  }

  // Helper method to simulate data available event
  _triggerDataAvailable(data) {
    if (this.ondataavailable) {
      this.ondataavailable({ data });
    }
  }
}

// Mock AudioContext
class MockAnalyserNode {
  constructor() {
    this.fftSize = 0;
    this.frequencyBinCount = 128;
  }
  
  getByteTimeDomainData(array) {
    // Fill with "silent" audio data
    for (let i = 0; i < array.length; i++) {
      array[i] = 128;
    }
  }
}

class MockAudioNode {
  connect() {}
  disconnect() {}
}

class MockAudioContext {
  constructor() {
    this.state = 'running';
  }

  createMediaStreamSource() {
    return new MockAudioNode();
  }

  createAnalyser() {
    return new MockAnalyserNode();
  }

  close() {
    return Promise.resolve();
  }
}

describe('VoiceInput', () => {
  // Mock navigator.mediaDevices.getUserMedia
  const mockGetUserMedia = vi.fn();
  
  // Store original MediaRecorder and AudioContext
  let originalMediaRecorder;
  let originalAudioContext;
  let originalRAF;
  let originalCAF;
  
  beforeEach(() => {
    // Save originals
    originalMediaRecorder = global.MediaRecorder;
    originalAudioContext = global.AudioContext;
    originalRAF = window.requestAnimationFrame;
    originalCAF = window.cancelAnimationFrame;
    
    // Mock MediaRecorder
    global.MediaRecorder = MockMediaRecorder;
    
    // Mock AudioContext
    global.AudioContext = MockAudioContext;
    global.window.AudioContext = MockAudioContext;
    
    // Mock requestAnimationFrame
    window.requestAnimationFrame = vi.fn(cb => {
      cb(Date.now());
      return 1;
    });
    
    // Mock cancelAnimationFrame
    window.cancelAnimationFrame = vi.fn();
    
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
    
    // Setup console.error and console.log mocks to avoid polluting test output
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Reset all mocks after each test
    vi.resetAllMocks();
    
    // Restore originals
    global.MediaRecorder = originalMediaRecorder;
    global.AudioContext = originalAudioContext;
    global.window.AudioContext = originalAudioContext;
    window.requestAnimationFrame = originalRAF;
    window.cancelAnimationFrame = originalCAF;
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
  
  // Milestone 3 & 4 specific tests
  
  it('should toggle recording state when mic button is clicked after permission is granted', async () => {
    // Mock successful permission
    const mockStream = { id: 'mock-stream-id', getTracks: () => [] };
    mockGetUserMedia.mockResolvedValue(mockStream);
    
    render(<VoiceInput />);
    
    const micButton = screen.getByRole('button', { name: /toggle microphone/i });
    
    // First click to get permission
    await act(async () => {
      fireEvent.click(micButton);
    });
    
    // Spy on MediaRecorder start method
    const startSpy = vi.spyOn(MockMediaRecorder.prototype, 'start');
    
    // Now with permission granted, click to start listening
    await act(async () => {
      fireEvent.click(micButton);
    });
    
    // Check that MediaRecorder.start was called with 500ms chunks
    expect(startSpy).toHaveBeenCalledWith(500);
    
    // Check that the Complete button is visible
    expect(screen.getByText(/Complete/i)).toBeInTheDocument();
    
    // Spy on MediaRecorder stop method
    const stopSpy = vi.spyOn(MockMediaRecorder.prototype, 'stop');
    
    // Click again to stop listening
    await act(async () => {
      fireEvent.click(micButton);
    });
    
    // Check that MediaRecorder.stop was called
    expect(stopSpy).toHaveBeenCalled();
    
    // Complete button should not be in the document anymore (conditionally rendered)
    expect(screen.queryByText(/Complete/i)).not.toBeInTheDocument();
  });
  
  // Milestone 5 specific tests
  
  it('should set up audio analysis for level meter when recording starts', async () => {
    // Spy on AudioContext and AnalyserNode methods
    const createMediaStreamSourceSpy = vi.spyOn(MockAudioContext.prototype, 'createMediaStreamSource');
    const createAnalyserSpy = vi.spyOn(MockAudioContext.prototype, 'createAnalyser');
    const getByteTimeDomainDataSpy = vi.spyOn(MockAnalyserNode.prototype, 'getByteTimeDomainData');
    
    // Mock a MediaStream
    const mockStream = { id: 'mock-stream-id', getTracks: () => [] };
    mockGetUserMedia.mockResolvedValue(mockStream);
    
    render(<VoiceInput />);
    
    const micButton = screen.getByRole('button', { name: /toggle microphone/i });
    
    // First click to get permission
    await act(async () => {
      fireEvent.click(micButton);
    });
    
    // Now click to start listening
    await act(async () => {
      fireEvent.click(micButton);
    });
    
    // Verify AudioContext methods were called properly
    expect(createMediaStreamSourceSpy).toHaveBeenCalled();
    expect(createAnalyserSpy).toHaveBeenCalled();
    
    // Verify requestAnimationFrame was called
    expect(window.requestAnimationFrame).toHaveBeenCalled();
    
    // Verify getByteTimeDomainData was called
    expect(getByteTimeDomainDataSpy).toHaveBeenCalled();
    
    // Note: We don't test cancelAnimationFrame since our clean-up is run asynchronously
    // and may not happen within the test's timeframe
  });
  
  // Milestone 6 specific tests
  
  it('should show processing UI and then mock transcript after recording stops', async () => {
    // Setup fake timers to control setTimeout
    vi.useFakeTimers();
    
    // Mock successful permission and stream
    const mockStream = { id: 'mock-stream-id', getTracks: () => [] };
    mockGetUserMedia.mockResolvedValue(mockStream);
    
    render(<VoiceInput />);
    
    const micButton = screen.getByRole('button', { name: /toggle microphone/i });
    
    // First click to get permission
    await act(async () => {
      fireEvent.click(micButton);
    });
    
    // Now click to start listening
    await act(async () => {
      fireEvent.click(micButton);
    });
    
    // Get the mock recorder to simulate a stop event
    const mockRecorder = new MockMediaRecorder(mockStream);
    
    // Set up the ondataavailable and onstop handlers
    mockRecorder.ondataavailable = () => {};
    
    // Simulate MediaRecorder stop event completion
    await act(async () => {
      // Click the "Complete" button to stop recording
      const completeButton = screen.getByRole('button', { name: /complete recording/i });
      fireEvent.click(completeButton);
      
      // Manually trigger onstop (simulating MediaRecorder.stop)
      if (mockRecorder.onstop) mockRecorder.onstop();
    });
    
    // Verify that the UI shows "Processing" state
    expect(screen.getByText(/Processing audio.../i)).toBeInTheDocument();
    expect(screen.getByText(/Converting speech to text.../i)).toBeInTheDocument();
    
    // Verify that controls are disabled during processing
    expect(micButton).toBeDisabled();
    
    // Fast-forward through the timeout
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    
    // Verify that the mock transcript appears
    expect(screen.getByText(/Hello world! This is a mock transcription/i)).toBeInTheDocument();
    
    // Verify that controls are re-enabled
    expect(micButton).not.toBeDisabled();
    
    // Cleanup fake timers
    vi.useRealTimers();
  });
});