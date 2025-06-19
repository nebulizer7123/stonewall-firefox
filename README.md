# stonewall-firefox

Stonewall is a Firefox add-on designed to help you avoid distracting websites. It can:

- Block websites or specific paths.
- Track the time you spend on each domain.
- Clear time spent data for specific domains.
- Schedule when blocked rules are active.
- Quickly block the current page from the context menu.

## Installing

1. Open Firefox and browse to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select the `manifest.json` file inside the `extension` directory.

## Options

Open the add-on options to add or remove blocked sites and configure optional start/end times.
You can adjust the schedule of existing entries right from the list and start a temporary Pomodoro block for a site.
The options page also displays how much time you've spent on each domain so far.
You can remove domains from this list to reset their counters.

Blocked entries use the full URL path. For example, blocking `https://www.reddit.com/r/gaming` leaves other Reddit paths accessible.

Time spent on each domain is stored locally and updated once per second.
When a list's type is set to "Allow Only", any active allow lists restrict access exclusively to their patterns. All other URLs are blocked, and these allowances take priority over block lists.

Extension and about pages are always accessible, even when an allow list is active, so you can open any add-on settings page.
Blocked URLs show a page with an Unblock button that either removes the address from a block list or adds it to an active allow list.
