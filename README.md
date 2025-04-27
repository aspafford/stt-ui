# Speech-to-Text UI

A user-friendly React application for recording audio and converting speech to text. This project demonstrates a complete audio recording and transcription workflow with a focus on accessibility and user experience.

![Speech-to-Text UI](https://github.com/vitejs/vite-plugin-react/assets/4060187/0af17277-e4a7-44ee-8b88-31bf89ba0b92)
*Note: The image above is a placeholder. Update with your actual app screenshot.*

## Features

- 🎤 Microphone access with proper permission handling
- ⏺️ Audio recording with visual level meter
- ⏱️ Recording timer for tracking session length
- 🔄 Speech-to-text conversion (currently mocked)
- 📋 Transcript display with copy-to-clipboard functionality
- ⚠️ Comprehensive error handling
- ♿ Accessible design with ARIA attributes and keyboard navigation
- 🧪 Thorough test coverage using Vitest and React Testing Library

## Demo

Try the application to see how it works:

1. Click the microphone button to request access
2. Start recording your voice
3. The audio level meter will show your voice intensity
4. Click "Complete" to stop and process the recording
5. View and copy the transcribed text

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/stt-ui.git
cd stt-ui

# Install dependencies
npm install
```

### Development

```bash
# Start the development server
npm run dev
```

### Testing

```bash
# Run all tests
npm test
```

### Building for Production

```bash
# Create a production build
npm run build

# Preview the production build
npm run preview
```

## Project Structure

```
stt-ui/
├── public/
├── src/
│   ├── components/
│   │   ├── VoiceInput.jsx       # Main speech-to-text component
│   │   └── VoiceInput.test.jsx  # Tests for the component
│   ├── App.jsx                  # App entry point
│   └── main.jsx                 # React initialization
├── CLAUDE.md                    # Technical documentation for AI assistants
├── README.md                    # This file
└── package.json                 # Dependencies and scripts
```

## Technologies

- **Frontend**: React with Material UI
- **Build Tool**: Vite
- **Testing**: Vitest and React Testing Library
- **APIs**: MediaDevices, MediaRecorder, Web Audio API

## Browser Compatibility

This application uses modern Web APIs and is compatible with:

- Chrome 60+
- Firefox 63+
- Safari 14.1+
- Edge 79+

## Future Enhancements

- Integration with real speech-to-text services
- Multiple language support
- Saving/loading recording history
- Enhanced audio visualization
- Configurable speech recognition options
- Mobile-optimized interface

## Credits

This project was built with:

- [React](https://reactjs.org/)
- [Material UI](https://mui.com/)
- [Vite](https://vitejs.dev/)
- [Vitest](https://vitest.dev/)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

*Created with [React](https://reactjs.org/) and [Vite](https://vitejs.dev/)*