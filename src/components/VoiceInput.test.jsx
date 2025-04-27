import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
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
    // Return simulated "mild" audio level data (non-silent, but not loud)
    if (array) {
      for (let i = 0; i < array.length; i++) {
        // Values around 128 represent silence, 0 and 255 represent peak values
        // We'll simulate some mild audio activity
        array[i] = 128 + Math.floor(Math.random() * 30);
      }
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
  let originalSetTimeout;
  let originalClearTimeout;
  let originalSetInterval;
  let originalClearInterval;
  
  beforeEach(() => {
    // Save originals
    originalMediaRecorder = global.MediaRecorder;
    originalAudioContext = global.AudioContext;
    originalRAF = window.requestAnimationFrame;
    originalCAF = window.cancelAnimationFrame;
    originalSetTimeout = window.setTimeout;
    originalClearTimeout = window.clearTimeout;
    originalSetInterval = window.setInterval;
    originalClearInterval = window.clearInterval;
    
    // Mock MediaRecorder
    global.MediaRecorder = MockMediaRecorder;
    
    // Mock AudioContext
    global.AudioContext = MockAudioContext;
    global.window.AudioContext = MockAudioContext;
    
    // Mock requestAnimationFrame - but prevent infinite recursion if a test case 
    // ends up calling itself from within the callback
    let isInRequestAnimationFrame = false;
    window.requestAnimationFrame = vi.fn(cb => {
      if (!isInRequestAnimationFrame) {
        isInRequestAnimationFrame = true;
        cb(Date.now());
        isInRequestAnimationFrame = false;
      }
      return 1;
    });
    
    // Mock cancelAnimationFrame
    window.cancelAnimationFrame = vi.fn();
    
    // Mock setTimeout and clearTimeout - avoid executing some callbacks immediately
    window.setTimeout = vi.fn((cb, delay) => {
      // Don't immediately execute callbacks for mock STT processing or audio level updates
      // Let tests control the timing with advanceTimersByTime
      if (typeof cb === 'function' && delay !== 1500 && delay !== 0) cb();
      return 123;
    });
    window.clearTimeout = vi.fn();
    
    // Mock setInterval and clearInterval
    window.setInterval = vi.fn(() => 456);
    window.clearInterval = vi.fn();
    
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
    window.setTimeout = originalSetTimeout;
    window.clearTimeout = originalClearTimeout;
    window.setInterval = originalSetInterval;
    window.clearInterval = originalClearInterval;
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
    
    // In test environment, we're using setTimeout with a delay of 0 instead of 
    // requestAnimationFrame directly, so we verify setTimeout was called
    expect(window.setTimeout).toHaveBeenCalled();
    
    // Verify getByteTimeDomainData was called
    expect(getByteTimeDomainDataSpy).toHaveBeenCalled();
    
    // Verify that the audio level meter is visible
    const progressBar = screen.getByRole('progressbar', { name: /audio level meter/i });
    expect(progressBar).toBeInTheDocument();
  });
  
  // Milestone 6 specific tests
  
  it('should process audio even with a small blob size in test environment', async () => {
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
    
    // Create a mock blob that is small (less than 1000 bytes)
    const mockTinyBlob = new Blob([""], { type: 'audio/webm' });
    Object.defineProperty(mockTinyBlob, 'size', { value: 100 }); // Force small size
    
    // Mock the Blob constructor to return our small blob
    const originalBlob = global.Blob;
    global.Blob = vi.fn(() => mockTinyBlob);
    
    // Simulate MediaRecorder stop event completion
    await act(async () => {
      // Click the "Complete" button to stop recording
      const completeButton = screen.getByRole('button', { name: /complete recording/i });
      fireEvent.click(completeButton);
    });
    
    // Verify that in test mode it shows processing (because we skip the small blob check)
    expect(screen.getByText(/Processing audio/i)).toBeInTheDocument();
    
    // Fast-forward timer to see if transcript appears (should in test env)
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    
    // Verify transcript appears
    expect(screen.getByText(/Hello world! This is a mock transcription/i)).toBeInTheDocument();
    
    // Restore the original Blob constructor
    global.Blob = originalBlob;
    
    // Cleanup fake timers
    vi.useRealTimers();
  });

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
  
  it('should show recording status when recording is active', async () => {
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
    
    // Verify that status shows listening
    const statusText = screen.getByRole('status').textContent;
    expect(statusText).toMatch(/Listening/i);
    
    // Verify that a Complete button is shown
    expect(screen.getByRole('button', { name: /complete recording/i })).toBeInTheDocument();
  });
  
  it('should allow copying transcript text', async () => {
    // Mock successful permission and stream
    const mockStream = { id: 'mock-stream-id', getTracks: () => [] };
    mockGetUserMedia.mockResolvedValue(mockStream);
    
    // Mock clipboard API
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined)
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true
    });
    
    // Setup fake timers
    vi.useFakeTimers();
    
    render(<VoiceInput />);
    
    // Get permission, start recording, then stop to generate transcript
    const micButton = screen.getByRole('button', { name: /toggle microphone/i });
    
    await act(async () => {
      fireEvent.click(micButton); // Get permission
    });
    
    await act(async () => {
      fireEvent.click(micButton); // Start recording
    });
    
    await act(async () => {
      fireEvent.click(micButton); // Stop recording
    });
    
    // Fast-forward through processing
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    
    // Verify transcript appears
    expect(screen.getByText(/Hello world! This is a mock transcription/i)).toBeInTheDocument();
    
    // There should now be a Copy Text button
    const copyButton = screen.getByRole('button', { name: /copy transcript to clipboard/i });
    expect(copyButton).toBeInTheDocument();
    
    // Click the copy button
    await act(async () => {
      fireEvent.click(copyButton);
    });
    
    // Verify clipboard API was called with the transcript text
    expect(mockClipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('Hello world! This is a mock transcription')
    );
    
    // Cleanup
    vi.useRealTimers();
  });
  
  afterAll(() => {
    // Ensure all mocks are restored
    vi.restoreAllMocks();
  });
});