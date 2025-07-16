# Implementation Plan

- [x] 1. Add internationalization support for filename anonymization
  - Add translation keys for anonymization feature in English translation file
  - Add corresponding Polish translations for all new keys
  - Include labels, tooltips, help text, and status messages
  - _Requirements: 2.2, 4.1, 4.2_

- [x] 2. Implement anonymization state management in DownloadSection component










  - Add `anonymizeFilename` state variable with useState hook
  - Create `handleAnonymizationToggle` function to manage state changes
  - Implement settings persistence using existing Tauri settings system
  - Load anonymization preference on component mount
  - _Requirements: 1.4, 3.1, 3.2, 3.3_


- [x] 3. Create anonymization UI control with existing styling patterns





  - Add checkbox control between audio settings and download button sections
  - Implement visual feedback indicators matching audio toggle design
  - Add tooltip support using existing Tooltip component
  - Include status text showing current anonymization state
  - _Requirements: 2.1, 2.3, 2.4_


- [x] 4. Add filename preview and help text components








  - Create preview text showing anonymized filename format when enabled
  - Add HelpText component explaining anonymization functionality
  - Implement dynamic preview updates based on anonymization state
  - _Requirements: 4.1, 4.3_


- [x] 5. Integrate anonymization setting into download request flow





  - Modify handleDownload function to include anonymization preference
  - Add anonymize_filename field to download request payload
  - Ensure setting is passed to backend download system
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 6. Add user feedback for anonymization status








  - Show confirmation when anonymization affects download
  - Add visual feedback in download queue for anonymized files
  - Implement appropriate notifications using existing notification system
  - _Requirements: 4.2, 4.3_

- [ ] 7. Test anonymization feature integration
  - Write unit tests for state management functions
  - Test settings persistence across component remounts
  - Verify UI component rendering and interactions
  - Test complete download flow with anonymization enabled/disabled
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3_