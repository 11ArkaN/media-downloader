import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";
import "./i18n";

// Completely disable Windows media controls integration
if ('mediaSession' in navigator) {
  // Override the entire MediaSession object to be non-functional
  Object.defineProperty(navigator, 'mediaSession', {
    value: {
      metadata: null,
      setActionHandler: () => {},
      setPositionState: () => {},
      playbackState: 'none'
    },
    writable: false,
    configurable: false
  });
}

// Also override any video/audio elements that might auto-register
const originalCreateElement = document.createElement;
document.createElement = function(tagName: string, options?: ElementCreationOptions) {
  const element = originalCreateElement.call(this, tagName, options);
  
  if (tagName.toLowerCase() === 'video' || tagName.toLowerCase() === 'audio') {
    // Disable media session for all video/audio elements
    element.addEventListener('loadedmetadata', () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
      }
    });
    element.addEventListener('play', () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
      }
    });
  }
  
  return element;
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
