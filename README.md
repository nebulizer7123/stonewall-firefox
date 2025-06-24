# stonewall-firefox

Stonewall is a Firefox add-on designed to help you avoid distracting websites. It can:

- Block websites or specific paths.
- Track the time you spend on each domain.
- Clear time spent data for specific domains.
- Schedule when blocked rules are active.
- Quickly block the current page from the context menu.
- Reliably cancel requests before they are loaded.

## Installing

1. Open Firefox and browse to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select the `manifest.json` file inside the `extension` directory.

## Options

Open the add-on options to add or remove blocked sites and configure optional start/end times.
You can adjust the schedule of existing entries right from the list and start a temporary Pomodoro block for a site. A small popup is available from the toolbar button where you can select a list and begin or end a Pomodoro session without opening the options page. The popup also links to the preferences page for quick access. Each list shows a status indicator with a manual Block/Unblock switch. The status updates automatically based on schedules and Pomodoro sessions but lets you override it at any time.
Both the popup and options pages pre-fill the Pomodoro timer with a 20-minute value so you can simply press **Start** for a standard session.
The options page also displays how much time you've spent on each domain so far.
You can remove domains from this list to reset their counters.

Version 0.1.1 adds a web request listener to stop blocked pages before they load.

Blocked entries use the full URL path. For example, blocking `https://www.reddit.com/r/gaming` leaves other Reddit paths accessible.

Time spent on each domain is stored locally and updated once per second.
Only one list is active at a time. Choose the active list from the toolbar popup or the options page. If the active list is set to "Allow Only" then any URL not matching one of its patterns is blocked. Extension and about pages remain accessible regardless of which list is active.
Blocked URLs show a page with an Unblock button that either removes the address from a block list or adds it to the active allow list.
