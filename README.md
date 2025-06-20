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
