# stonewall-firefox

Stonewall is a minimal browser extension for blocking distracting websites. It supports schedules with optional breaks, immediate blocking, and the ability to block or allow specific pages.

## Installing
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select `manifest.json` in the `extension` folder.

## Usage
Open the extension options page to configure blocking rules.

- **Mode** – choose between blocking listed URLs or allowing only the listed URLs.
- **Immediate Block** – manually enable or disable blocking regardless of schedules.
- **Patterns** – list of full URLs or domains to block or allow.
- **Focus Sessions** – set days of the week, start and end times, and break lengths. When a session ends the break timer unblocks pages for the specified minutes.

Use the toolbar popup to quickly toggle immediate blocking or open the options page.
