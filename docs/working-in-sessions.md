# Working in Claude Code sessions
### Habits that keep everything reachable — from any computer or your phone

## 1. Start in the cloud by default
In the desktop app's **Code** tab, before your first message, click the environment button under the message box (it says **Local**) and choose **Cloud → Default**.

- A cloud session keeps running with the app closed or the Mac off.
- You can open it anywhere: **claude.ai/code** in a browser, or the **Code** tab in the Claude phone app.
- Use **Local** only when the work needs files that exist only on your Mac.
- Use the **Default** cloud environment. Only add another environment if a project needs different settings (secret keys, a setup script).

## 2. Know the two kinds of session

| Kind | Where it runs | Reachable from home? |
|---|---|---|
| **Cloud** | Anthropic's servers | Always |
| **Local** (desktop app set to Local, or `claude` typed in Terminal) | Your Mac | Only with Remote Control on, the Mac awake, and the app or terminal open |

- If a session shows in your claude.ai/code sidebar, it is either cloud or already has Remote Control.
- A local session without Remote Control doesn't appear there at all.
- Not sure which a session is? Ask any session to check. It can look it up.

## 3. GitHub is the source of truth
Cloud sessions work from what's **on GitHub**, not from your Mac.

- Before switching or ending a session, say **"commit and push."**
- Uncommitted changes stay on whichever computer made them.

## 4. Write things down before you stop
- **popcode-demo:** end each working session with **"save notes."** That writes a handoff into `docs/STATUS.md`, so the next session, on any device, knows where things stand.
- **Other projects:** ask for a short handoff note committed to the repository.

## 5. Moving a session to the cloud
- **Desktop-app local session:** click the caret by its title (or right-click it in the sidebar), then **Open in → Cloud**. Commit and push first.
- **Terminal session** (started with `claude`): it can't be moved. Commit and push, save notes, then start a new cloud session on the same repository and branch and tell it to read the notes.

## 6. If you must use a local session while away
1. Turn on **Remote Control** in that session before you leave.
2. Keep the Mac awake: **System Settings → Energy → Prevent automatic sleeping when the display is off**, or run `caffeinate -i` in a Terminal tab.
3. Leave the app or terminal window open. Minimizing is fine; closing ends it.

Even then, a restart, a macOS update or a network drop disconnects it. That's another reason to prefer cloud.

## 7. One task per session, with a clear name
Short, focused sessions with descriptive titles ("Book spine fix", not "New session") are easier to find and resume. Finished sessions can be archived to keep the sidebar tidy.

## End-of-day checklist
1. **"Commit and push."**
2. **"Save notes."**
3. Local and you'll want it later? **Open in → Cloud.**
