import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import VoiceInput from './VoiceInput';

describe('VoiceInput', () => {
  it('renders all required UI elements', () => {
    render(<VoiceInput />);
    
    // Microphone button with MicIcon
    const micButton = screen.getByRole('button', { name: /mic/i });
    expect(micButton).toBeInTheDocument();
    
    // Status area
    expect(screen.getByText(/Click microphone to start/i)).toBeInTheDocument();
    
    // Complete button (initially not visible but in DOM)
    // Note: We use a more generic approach since the Complete button might be styled to be hidden
    expect(screen.getByText(/Complete/i)).toBeInTheDocument();
    
    // Transcript display area
    expect(screen.getByText(/Transcription will appear here/i)).toBeInTheDocument();
  });
});