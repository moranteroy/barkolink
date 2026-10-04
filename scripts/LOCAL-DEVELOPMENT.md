Run `npm run dev -- --port 8100` from the project folder. This starts the Functions emulator first, then Vite. An already running account backend on port 5001 is reused.

For a frontend started separately (for example, through an IDE), run `npm run functions:emulate` in another terminal and keep it running.

The Functions emulator runs account management code locally. Firebase Auth and SQL Connect still use this project's live services, so accounts created through the local admin page are real accounts. The Firebase CLI must be signed in with access to this project.

Stop the combined dev command with Ctrl+C. It stops the processes it started and leaves a previously running backend alone.
