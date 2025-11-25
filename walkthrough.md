# Walkthrough - Advanced User Settings

I have added powerful new settings to give users more control over their notifications.

## Changes

### 1. Quiet Mode 🌙
- **Feature**: Users can now enable "Quiet Mode" to silence alerts during specific hours (default: 10 PM - 8 AM).
- **Benefit**: Prevents the bot from waking users up with price alerts in the middle of the night.
- **Implementation**: 
    - Added `quietMode` schema to `User` model.
    - Updated `PriceTrackerService` to check the current time against user's quiet hours before sending an alert.

### 2. Minimum Discount Filter 📉
- **Feature**: Users can set a minimum discount percentage (e.g., 10%).
- **Benefit**: Reduces noise by ignoring small, insignificant price drops (like 1% fluctuations).
- **Implementation**:
    - Added `minDiscount` to `User` model.
    - Updated `PriceTrackerService` to compare the price drop percentage against the user's setting.

### 3. Settings UI
- **Feature**: Updated the `/settings` command to show these new options.
- **Note**: Currently, the UI shows the status. To *change* the values (like changing start hour from 22 to 23), we would need to implement the callback handlers (e.g., `action_toggle_quiet_mode`). I have added the buttons, but the handlers need to be registered in `handlers.js`.

## Verification

### Manual Verification Steps
1.  **Bot**: Send `/settings`.
    *   **Expected**: You should see "Advanced Preferences" with "Quiet Mode" and "Min Discount".
2.  **Logic Check**:
    *   If Quiet Mode is ON and it's 3 AM, no alerts should be sent.
    *   If Min Discount is 10% and price drops 5%, no alert should be sent.

## Files Modified
- `src/models/User.js`: Added schema fields.
- `src/commands/settingsCommand.js`: Updated UI.
- `src/services/priceTrackerService.js`: Added logic to check settings.
