# Design Document

## Overview

The filename anonymization feature will add a privacy-focused option to the download section that allows users to generate generic, non-descriptive filenames instead of using the original video title. This feature integrates seamlessly with the existing download workflow and maintains the current UI/UX patterns.

## Architecture

### Component Integration
- The feature will be integrated into the existing `DownloadSection` component
- A new state variable `anonymizeFilename` will be added to track the user's preference
- The anonymization logic will be applied during the download request preparation
- Settings persistence will use the existing Tauri settings system

### Data Flow
1. User toggles the anonymization checkbox in the UI
2. State is updated and preference is saved to local storage
3. When download is initiated, the anonymization setting is checked
4. If enabled, a generic filename is generated; otherwise, original title is used
5. The filename preference is passed to the backend download system

## Components and Interfaces

### UI Components

#### Anonymization Checkbox Control
- **Location**: Between the audio settings and download button sections
- **Styling**: Consistent with existing checkbox patterns (audio inclusion toggle)
- **Components**: 
  - Checkbox input with custom styling
  - Label with tooltip support
  - Visual feedback indicators
  - Help text section

#### Visual Feedback Elements
- Status indicator showing current anonymization state
- Preview text showing filename format when enabled
- Tooltip explaining the feature functionality

### State Management

#### New State Variables
```typescript
const [anonymizeFilename, setAnonymizeFilename] = useState(false)
```

#### Settings Integration
- Extend existing settings loading/saving to include anonymization preference
- Use the same pattern as other user preferences (quality, audio settings)

### Backend Integration

#### Download Request Modification
- Add `anonymize_filename` field to download request payload
- Backend will handle filename generation based on this flag

#### Filename Generation Logic
- **Pattern**: `video_[timestamp]_[random].[extension]`
- **Timestamp**: Unix timestamp for uniqueness
- **Random**: 6-character alphanumeric string
- **Extension**: Preserved from original format

## Data Models

### Extended Download Request Interface
```typescript
interface DownloadRequest {
  url: string
  format: string
  output_path: string
  anonymize_filename?: boolean  // New field
}
```

### Settings Extension
```typescript
interface AppSettings {
  // ... existing settings
  anonymize_filename: boolean  // New setting
}
```

## Error Handling

### Validation
- No additional validation required for the anonymization setting
- Existing download validation remains unchanged

### Error States
- If filename generation fails, fallback to original behavior
- Log errors but don't block download process
- Show user notification if anonymization fails

## Testing Strategy

### Unit Tests
- Test anonymization state management
- Test settings persistence
- Test filename generation logic
- Test UI component rendering and interactions

### Integration Tests
- Test complete download flow with anonymization enabled/disabled
- Test settings loading and saving
- Test error handling scenarios

### User Acceptance Tests
- Verify checkbox behavior matches existing patterns
- Verify tooltip and help text display correctly
- Verify filename anonymization works as expected
- Verify settings persistence across app restarts

## Implementation Details

### Styling Approach
- Use existing glass-card and motion components
- Follow the same visual patterns as the audio inclusion toggle
- Maintain consistent spacing and typography
- Use existing color scheme and hover effects

### Internationalization
- Add new translation keys for anonymization feature
- Support both English and Polish languages
- Follow existing translation key naming conventions

### Performance Considerations
- Minimal performance impact (simple boolean state)
- Filename generation is lightweight operation
- Settings persistence uses existing efficient system

## Security Considerations

### Privacy Protection
- Generated filenames contain no identifiable information
- Random component prevents pattern recognition
- Timestamp provides uniqueness without revealing content

### Data Handling
- No sensitive data stored or transmitted
- Anonymization preference stored locally only
- No impact on existing security measures