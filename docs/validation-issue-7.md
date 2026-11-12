# Issue #7 validation

Source: [Orbit controls for Neural Shadow](https://github.com/takahirox/three-nn/issues/7).
Implementation revision: **`f6a7a4f8fdfa2559efc76f48949633c004f3eed7`**.
Checks cover that runtime tree on November 12, 2026. This subsequent evidence
commit changes only this report and its JSON record; runtime files are unchanged.
The final checkpoint SHA is supplied in the GitWeave Result. No PR was created
or updated by this node; this report supplies evidence for the downstream PR.

The original AC4 evidence below missed a zoom-only reset defect subsequently
found in review. The [reset correction](#ac4-zoom-only-reset-correction) records
the fix and focused validation; the other evidence retains its original scope.

## Mandatory pre-merge acceptance

| Criterion | Actual implementation and evidence | Result |
| --- | --- | --- |
| AC1 — Orbit | Canvas-only Three.js OrbitControls on the existing orthographic camera, fixed scene-spec target, no pan/damping. Native CDP mouse drags changed viewpoint through all horizontal quadrants; outside drags, right drags and Ctrl drags preserved pose. Extreme vertical drags clamped polar angle to 0.100000 and 1.520796 radians. Orbit/zoom created no new shader modules. | **Pass** |
| AC2 — Zoom/touch | Native CDP wheel and Ctrl+wheel events zoomed and clamped at 0.5 and 2. CDP-emulated one-finger drag orbited; two-finger pinch changed zoom from 1 to 2 without changing target. Only the shadow canvas has touch capture. | **Pass** for automated wheel/touch event paths. **Not run** for physical touch and physical trackpad; see limitations below. |
| AC3 — Independent light/modes | At an orbited/zoomed pose, light changed to 37° and remained there across Reference, Neural and Difference. Position, target and zoom were identical across modes. After pipeline completion, diagnostics reported 3/2/3 render calls respectively; screenshots were inspected, including Difference's error boundaries at an arbitrary orbit. No model changes. | **Pass** |
| AC4 — Reset/resize | Reset restored (5,6,7), (0,0,−0.2), zoom 1 within floating-point tolerance while retaining Difference and light 37°. Resizing to 740px retained pose/zoom and 1.6 canvas aspect. At 375px the page had no horizontal overflow and Reset view stayed in bounds. Resize during measurement held drawing-buffer dimensions, then applied the new size afterward without changing pose/zoom. | **Pass** |
| AC5 — Isolation | Reference and Neural each completed 30 warmup + 120 sample frames at the same non-default pose/zoom. Mouse drag, wheel and Reset attempts during both warmup and sampling did not move the camera. All sampled queue submissions recorded controls disabled, reset disabled, measuring true and zero diagnostic render calls. Exactly 450/300 GPU render passes occurred (3/2 per frame), with no extra control renders. Both JSON results recorded identical camera position/target/zoom. Camera and reset worked afterward. A one-shot rejected queue wait through the benchmark API restored controls on recoverable failure. | **Pass** |
| AC6 — Regression/failure | All five numeric tests passed, including unchanged shadow accuracy and original x⁴ contracts. Both pages reached actual WebGPU success; original x⁴ light input worked. Missing WebGPU, null adapter, invalid WGSL initialization and destruction of the test GPUDevice showed visible errors, hid the canvas and disabled controls/reset; subsequent mouse/wheel input was harmless. Normal rendering reported no GPU validation errors or uncaught exceptions. Training, weights, model inference, teacher, light conventions and shadow-map setup are unchanged. | **Pass** |
| AC7 — Checks/docs | `npm ci`, `npm test`, `npm run build`, production WebGPU smoke, complete diff review and whitespace checks succeeded. README and on-page help document controls, target/reset, limits, measurement locking and matching view parameters. Environment/method below. | **Pass** for executed checks; physical-device limitation remains explicitly recorded under AC2. |

## Commands and environment

- **Pass:** `npm ci` — installed the lockfile's 15 packages, zero reported vulnerabilities.
- **Pass:** `npm test` — 5 tests, 0 failures. x⁴ MAE 0.00268418 / max error
  0.01103208; shadow visibility MAE 0.011563056 / IoU 0.987749839.
- **Pass:** `npm run build` — both Vite entry points built. Existing shared
  Three.js bundle warning (>500 kB) remains; no new dependency or build config.
- **Pass:** `git diff --check`, staged whitespace check, complete diff review,
  local report links and JSON parsing.
- **Pass:** production served with
  `npm run preview -- --host 127.0.0.1 --port 4187 --strictPort`.
- Chrome **157.0.8103.39**, isolated temporary headless profile, macOS **27.2**,
  **ARM64**, Node **26.12.1**, npm **11.20.0**.
- Actual WebGPU device: vendor **apple**, architecture **metal-3**,
  `isFallbackAdapter=false`, timestamp queries supported. Browser diagnostic
  device/description strings were empty. No software GPU or unsafe WebGPU flags.
- Browser automation used Node's native WebSocket and Chrome DevTools Protocol,
  without installing browser dependencies. Temporary scripts ran via
  `node /tmp/three-nn-issue7-smoke.mjs` and
  `node /tmp/three-nn-issue7-extra.mjs`. The scripts are session-local; the
  [saved evidence](shadow-orbit-validation.json) preserves outcomes and view data.

## Browser method and benchmark evidence

Launch Chrome with `--headless=new --remote-debugging-port=0`, a new temporary
`--user-data-dir`, `--no-first-run` and `--no-default-browser-check`. Connect only
to that owned debugging endpoint. The normal Chrome connector could not read its
profile's debugging endpoint, so the isolated browser supplied the smoke test.

At a 1200×1000 viewport, wait for `#status[data-state=ready]`, inspect
`shadowDemo.diagnostics()` for the actual backend, then use CDP
`Input.dispatchMouseEvent` for canvas/outside/modified drags and wheel events.
Check pose through diagnostics, switch modes and light through their DOM events,
and activate the native reset button. Resize with
`Emulation.setDeviceMetricsOverride`, including 740px and 375px widths. Inspect
rendered Reference, Neural and Difference screenshots after pipelines settle.
CDP `Input.dispatchTouchEvent` with touch emulation exercises single/two-pointer
paths; it does not constitute a physical touch-device test.

For each isolated benchmark, call `shadowDemo.benchmark()` without awaiting it
in the driving CDP evaluation. While its promise is pending, attempt camera input
and reset before and after warmup; read diagnostics and disabled state. Test-only
wrappers around `GPUQueue.submit` and `GPUCommandEncoder.beginRenderPass` record
pose and pass counts without extra renders. Every submission retained the locked
pose, target and zoom. Normal interactive diagnostics render once; diagnostics
return state without rendering while measurement is active.

Both modes used light 37°, 1024×640 physical pixels, position
`[-6.374720776085729, 2.6961408952375683, 7.858148627319339]`, target
`[0, 0, -0.2]`, zoom `1.0799772127212148`. Raw benchmark result objects are in the
[saved JSON](shadow-orbit-validation.json). Instrumentation adds CPU overhead, so
these smoke timings establish successful execution and metadata/isolation only;
they are **not a performance comparison or speedup claim**. CPU render-submit and
GPU render-pass timestamp semantics remain unchanged.

For failure paths, inject hooks before navigation to hide `navigator.gpu`, return
null from adapter requests or return an invalid shader module. Destroy only the
isolated page's GPUDevice for loss handling. A separate one-shot
`onSubmittedWorkDone` rejection tests recoverable API benchmark cleanup without
marking the device failed. Each hook is isolated from normal rendering assertions.

## Limitations and optional validation

- **Not run — physical touch (AC2):** this environment exposes an isolated desktop
  headless Chrome session on a Mac with no available touch screen/device. Manual
  one-finger orbit and two-finger pinch on a supported physical touch+WebGPU
  browser remain unverified. Resume on such a device; emulation is not a Pass for
  that hardware path. The Issue explicitly permits reporting an unavailable
  touch scenario as Not run.
- **Not run — physical trackpad:** no physical trackpad input was available to
  the agent. Native CDP wheel and Ctrl+wheel cover browser event handling only.
- **Not run — hosted CI:** no CI workflow is configured in this repository.
- **Skipped (optional):** screen recording and additional browsers/devices.
- No implementation defect remains identified. Retain the device-validation
  limitations when preparing downstream PR evidence; do not convert them to Pass.

## AC4 zoom-only reset correction

Validated on November 12, 2026, against the fix commit containing this section
(final SHA supplied in the GitWeave Result). Validated runtime blob:
`src/shadow-demo.js` **`e7b0043e97dfa70716e164a8bd9b2fb082875d1e`**.

- **Fail (before fix):** reproduced on parent `4940ff41c2e42bc35bb4e3554c8596275812007a`.
  Wheel zoom to 1.2277376631548256, then Reset view, returned zoom to 1 but
  submitted no GPU work; the canvas screenshot remained identical to the zoomed
  image. `OrbitControls.update()` returned false.
- **Pass (after fix):** Reset renders explicitly when `update()` returns false.
  Native CDP wheel and reset-button clicks in Reference, Neural and Difference
  each restored the scene-spec position/target/zoom while retaining light 37°
  and the selected mode. Each reset made exactly one top-level renderer call
  (3/2/3 GPU submissions respectively, including internal shadow work). Canvas
  screenshot hashes matched each mode's settled initial view exactly.
- **Pass:** an orbit followed by reset used the existing change listener and
  rendered once; repeating reset at the initial view also rendered once.
- Method: isolated headless Chrome **157.0.8103.52**, macOS **27.2 ARM64**,
  actual Apple **metal-3** WebGPU, `isFallbackAdapter=false`, Vite dev server on
  localhost. Session-local Node/CDP instrumentation counted top-level renderer
  calls and GPU submissions and read controls directly. No `diagnostics()` calls
  were made. No uncaught exceptions or GPU validation errors were observed.
- **Pass:** `npm ci`, `npm test` (5 tests), `npm run build`, `git diff --check`.
  The existing >500 kB bundle warning remains. These focused checks supplement
  the earlier evidence; physical touch/trackpad remain **Not run** as above.

## Required post-merge verification

None required.
