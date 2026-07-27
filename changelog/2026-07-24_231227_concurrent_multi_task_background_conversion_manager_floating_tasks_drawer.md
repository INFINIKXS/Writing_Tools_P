---
archived: 2026-07-24T23:12:27.401315
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\80ea9bd4-9af7-400e-bf87-d31e05fcce7f\walkthrough.md
---

# Concurrent Multi-Task Background Conversion Manager & Floating Tasks Drawer

Implemented concurrent multi-task background conversion state management and a persistent floating tasks drawer in `frontend/src/components/ConverterView.jsx`.

## Summary of Changes

1. **Global Background Jobs Registry (`bgJobs`)**:
   - Added `[bgJobs, setBgJobs] = useState([])` state registry and `jobControllersRef` map.
   - Each job object tracks: `id`, `toolId`, `toolTitle`, `toolColor`, `fileName`, `status`, `uploadMetrics`, `elapsedTime`, `progressMsg`, `resultBlob`, `resultFilename`, `resultInfo`, `error`, `createdAt`, `files`, and `params`.
   - `handleConvert` creates a new background job entry in `bgJobs`, sets it as `activeJobId`, and initiates asynchronous XHR upload and FastAPI status polling (`/api/jobs/${job_id}/status`) per job without blocking UI state or cancelling when switching tools/navigating away.
   - Independent elapsed time counters run per job.

2. **Persistent Floating Tasks Drawer (`BackgroundTasksDrawer`)**:
   - Created fixed bottom-right (`fixed bottom-6 right-6 z-50`) glassmorphism component.
   - **Collapsed Pill Badge**: Displays running count (`⚡ X Processing` with animated spinner) and (`✅ Y Ready` / `Failed`). Clicking toggles the drawer open/closed.
   - **Expanded Drawer View**: Displays active and completed conversion tasks with tool icons, file names, status badges, progress bars, upload speed/ETA, and elapsed time.
   - **Action Buttons**:
     - **`[ 📥 Download ]`**: Directly triggers browser download of completed task blobs.
     - **`[ 🔍 Open Task ]`**: Restores the tool interface, file selection, and active view for that specific job.
     - **`[ ❌ Dismiss / Cancel ]`**: Aborts running XHR upload, sends backend cancellation request (`/api/jobs/${backendJobId}/cancel`), and removes job entry.

3. **Build Verification**:
   - Ran `npm run build` in `frontend/` and confirmed compilation succeeded with 0 errors.

## Verification Results
- `npm run build`: `✓ built in 2m` with zero errors.
