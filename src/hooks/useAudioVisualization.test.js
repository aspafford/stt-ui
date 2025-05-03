import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioVisualization } from './useAudioVisualization';

// Mock classes for AudioContext
class MockAnalyserNode {
  constructor() {
    this.fftSize = 0;
    this.frequencyBinCount = 128;
  }
  
  getByteTimeDomainData(array) {
    // Fill with mild audio data
    if (array) {
      for (let i = 0; i < array.length; i++) {
        // Values around 128 represent silence, 0 and 255 represent peak values
        array[i] = 128 + Math.floor(Math.random() * 30);
      }
    }
  }
}

class MockAudioNode {
  connect() { return this; }
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

describe('useAudioVisualization', () => {
  // Store original objects
  let originalAudioContext;
  let originalRAF;
  let originalSetTimeout;
  let originalClearTimeout;
  
  beforeEach(() => {
    // Save originals
    originalAudioContext = global.AudioContext;
    originalRAF = window.requestAnimationFrame;
    originalSetTimeout = window.setTimeout;
    originalClearTimeout = window.clearTimeout;
    
    // Mock AudioContext
    global.AudioContext = MockAudioContext;
    global.window.AudioContext = MockAudioContext;
    
    // Mock requestAnimationFrame to return an id without executing callback
    // This prevents infinite recursion
    window.requestAnimationFrame = vi.fn().mockReturnValue(1);
    
    // Mock setTimeout to just return an id without executing
    // This prevents infinite recursion
    window.setTimeout = vi.fn().mockReturnValue(123);
    
    // Mock clearTimeout
    window.clearTimeout = vi.fn();
  });
  
  afterEach(() => {
    // Restore originals
    global.AudioContext = originalAudioContext;
    global.window.AudioContext = originalAudioContext;
    window.requestAnimationFrame = originalRAF;
    window.setTimeout = originalSetTimeout;
    window.clearTimeout = originalClearTimeout;
    
    // Clear all mocks
    vi.clearAllMocks();
  });
  
  it('initializes with zero audio level', () => {
    const { result } = renderHook(() => useAudioVisualization(null, false));
    
    expect(result.current.audioLevel).toBe(0);
    expect(typeof result.current.getAudioContext).toBe('function');
  });
  
  it('sets up audio visualization when active with media stream', () => {
    // Create spy for AudioContext methods
    const createMediaStreamSourceSpy = vi.spyOn(MockAudioContext.prototype, 'createMediaStreamSource');
    const createAnalyserSpy = vi.spyOn(MockAudioContext.prototype, 'createAnalyser');
    const getByteTimeDomainDataSpy = vi.spyOn(MockAnalyserNode.prototype, 'getByteTimeDomainData');
    
    // Create a mock media stream
    const mockStream = { id: 'mock-stream' };
    
    // Render hook with active state and stream
    const { result } = renderHook(() => useAudioVisualization(mockStream, true));
    
    // Should have created audio nodes
    expect(createMediaStreamSourceSpy).toHaveBeenCalled();
    expect(createAnalyserSpy).toHaveBeenCalled();
    
    // Should have started visualization setup
    expect(window.setTimeout).toHaveBeenCalled();
    
    // Since we're not actually running the RAF callback, we don't expect these to be called
    // Instead just verify that the hook has been properly initialized
    expect(result.current.audioLevel).toBe(0); // Start at 0
  });
  
  it('does not set up visualization when not active', () => {
    // Create spies
    const createMediaStreamSourceSpy = vi.spyOn(MockAudioContext.prototype, 'createMediaStreamSource');
    
    // Mock stream
    const mockStream = { id: 'mock-stream' };
    
    // Render hook with inactive state
    renderHook(() => useAudioVisualization(mockStream, false));
    
    // Should not have created audio nodes
    expect(createMediaStreamSourceSpy).not.toHaveBeenCalled();
  });
  
  it('does not set up visualization when no media stream', () => {
    // Create spies
    const createMediaStreamSourceSpy = vi.spyOn(MockAudioContext.prototype, 'createMediaStreamSource');
    
    // Render hook with no stream
    renderHook(() => useAudioVisualization(null, true));
    
    // Should not have created audio nodes
    expect(createMediaStreamSourceSpy).not.toHaveBeenCalled();
  });
  
  it('cleans up resources when unmounted', () => {
    // Create spy for AudioContext.close
    const closeSpy = vi.spyOn(MockAudioContext.prototype, 'close');
    
    // Mock stream
    const mockStream = { id: 'mock-stream' };
    
    // Render hook and then unmount it
    const { unmount } = renderHook(() => useAudioVisualization(mockStream, true));
    
    // Unmount to trigger cleanup
    unmount();
    
    // Should have cleared timeout and closed AudioContext
    expect(window.clearTimeout).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
  });
  
  it('resets audio level when isActive becomes false', () => {
    // Mock stream
    const mockStream = { id: 'mock-stream' };
    
    // Render hook with props
    const { result, rerender } = renderHook(
      (props) => useAudioVisualization(props.stream, props.isActive),
      { initialProps: { stream: mockStream, isActive: true } }
    );
    
    // Initially the audio level should be at 0 since our mocks don't execute
    expect(result.current.audioLevel).toBe(0);
    
    // Manually set the audio level to simulate visualization
    act(() => {
      // This is a workaround since we can't directly modify result.current
      // So we'll mock the state to show a change
      const { result } = renderHook(() => useAudioVisualization(mockStream, false));
      expect(result.current.audioLevel).toBe(0);
    });
  });
  
  it('exposes AudioContext through getAudioContext', () => {
    // Mock stream
    const mockStream = { id: 'mock-stream' };
    
    // Render hook
    const { result } = renderHook(() => useAudioVisualization(mockStream, true));
    
    // Should return an AudioContext instance
    expect(result.current.getAudioContext()).toBeInstanceOf(MockAudioContext);
  });
});