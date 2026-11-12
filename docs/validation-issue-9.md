# Issue #9 validation

Source: [Compare Neural Shadow MLP depth and width](https://github.com/takahirox/three-nn/issues/9).
Implementation revision: **`6932867c50c0756f298792d830cfbd0e36744610`**.
Checks ran on November 12, 2026 against this runtime/training/model tree. The
subsequent evidence commit changes only this report and the saved JSON; the final
checkpoint SHA is supplied in the GitWeave Result.

## Mandatory pre-merge acceptance

| Criterion | Implementation and executed evidence | Result |
| --- | --- | --- |
| AC1 — Four variants | Three newly trained JSON exports plus the unchanged baseline, referenced by the manifest. Independent tests verify exact 4→16→1 / 4→32→1 / 4→16→16→1 / 4→32→32→1 shapes, 97/193/369/1249 finite parameters, artifact hashes and tensor dimensions. | **Pass** |
| AC2 — Fair training | `--all` trained the three missing presets and validated/reused the baseline. Identical teacher, training points and minibatch RNG state; registry records shared training/evaluation point hashes. Teacher geometry assertions pass. Separate baseline regeneration compared byte-identically with the committed original. README documents individual/all regeneration and the fixed optimization budget. | **Pass** |
| AC3 — Common evaluation | All four independent JS evaluators regenerate teacher labels and the balanced held-out points, verify probes/activations/layout, and compare aggregate and all three angles' counts/MAE/IoU with metadata. README table records actual results and tolerances; only the original baseline retains its quality gate. | **Pass** |
| AC4 — Actual TSL/WebGPU | Hardware Apple Metal backend, no fallback. All four Neural and Difference views rendered with distinct canvas screenshot hashes per model; Reference hashes identical across all four selections. Settled diagnostics show 3/2/3 render calls for Reference/Neural/Difference with shadow casting/mapping disabled only in Neural. Screenshots visibly show learned edge differences. | **Pass** |
| AC5 — Live selection | Default baseline and friendly architecture labels/summary verified. All selections/modes retained the same non-default orbit, target, zoom, light 37° and 1024×640 physical buffer. Model-only changes in Neural created no shader modules. All nine initial pipelines compiled/submitted before controls were enabled. | **Pass** |
| AC6 — Benchmark | Reference plus every Neural preset completed two runs of 30 warm-up + 120 samples with identical view/light/buffer/settings. All interaction controls, including model selection, were disabled at every recorded benchmark submission. Wheel/reset attempts during warm-up and sampling preserved pose. Resize during measurement held the physical buffer. No shader module creation occurred within sampled submissions. Results identify model, architecture/count, view, environment, resolution and timing semantics. Difference excluded. | **Pass** |
| AC7 — Regressions | Original x⁴ page reached hardware WebGPU readiness and its slider worked; original numeric tests pass. Native CDP orbit/wheel, light changes, Reset view including zoom-only redraw, resize and 375px layout checked. Missing WebGPU, null adapter, invalid WGSL and device loss each showed an error, hid the canvas and disabled all five controls. Normal runs had no uncaught exceptions or console/GPU errors. Baseline weights unchanged. | **Pass** |
| AC8 — Evidence | Commands below, production hardware WebGPU smoke, two benchmark repetitions and saved environment/revision/results. | **Pass** |
| AC9 — Documentation | README and page help explain presets, constraints, ideal-ray versus filtered-map targets, fair comparison, training, accuracy, compilation and benchmark limitations. Local changed-document links and whitespace checked. | **Pass** |

## Commands and environment

- **Pass:** `npm ci` — lockfile dependencies installed; zero reported vulnerabilities.
- **Pass:** Python venv setup and `pip install -r training/requirements.txt`.
- **Pass:** `.venv/bin/python training/train-shadow.py --all` — three real
  10,000-step CPU training/export runs; existing baseline validated and retained;
  deterministic manifest generated. The same command also refreshes hashes after
  explicitly regenerating individual variants.
- **Pass:** `.venv/bin/python training/train-shadow.py --all --validate-only` —
  all exports, teacher tests, regenerated data hashes and registry agree.
- **Pass:** `.venv/bin/python training/train-shadow.py --validate-only` — original
  baseline command remains compatible.
- **Pass:** `.venv/bin/python training/train-shadow.py --variant baseline-deep
  --output /tmp/three-nn-issue9-baseline.json`, followed by `cmp` against
  `src/shadow-weights.json`. SHA-256 remains
  `103e6458ff52cda172e11f29eb9e9b010fbdf2b523d203b57e83bb8245ec2236`.
- **Pass:** `npm test` at the implementation revision — **11 tests**, zero failures;
  original x⁴ MAE 0.00268418 / max error 0.01103208. All four shadow models'
  measured accuracy is in the [README table](../README.md#train-and-validate-neural-shadow).
- **Pass:** `npm run build` at the implementation revision — both entries built;
  existing >500 kB shared Three.js bundle warning remains.
- **Pass:** `git diff --check`, staged whitespace check, complete diff review,
  JSON parsing and changed-document local links.
- **Pass:** production served with `npm run preview -- --host 127.0.0.1
  --port 4199 --strictPort`; session-local Node/CDP browser scripts exercised
  switching, screenshots, input, measurements and injected failures.

Chrome **157.0.8103.52**, isolated headless profile, macOS **27.2 (26B123)**,
**ARM64**, Node **26.12.1**, npm **11.20.0**, Python **3.13.13**, PyTorch **2.9.1**.
Actual backend **WebGPU**, vendor **apple**, architecture **metal-3**,
`isFallbackAdapter=false`, timestamp queries supported; device/description
strings empty. No software GPU or unsafe WebGPU flags. The normal Chrome tool
could not read its profile's debugging endpoint; only the newly launched owned
profile's CDP endpoint was used. No reset tickets, allowance purchases, model
switches or external repository writes were used.

## Browser method and timing observations

The [saved JSON](shadow-model-validation.json) records exact browser/device/view
metadata, initial compilation observations, 12 canvas hashes/diagnostics,
10 benchmark results, interaction isolation, mobile layout and failure outcomes.
Screenshots were captured and inspected in the session; no image assets or
browser framework were added to the application.

Launch Chrome with `--headless=new --remote-debugging-port=0`, a new temporary
`--user-data-dir`, `--no-first-run` and `--no-default-browser-check`. Native Node
WebSocket/CDP connects only to that owned endpoint. At 1200×1000, wait for
`#status[data-state=ready]`; use native CDP mouse drag/wheel to establish a
non-default view, and DOM change/input events for model/mode/light controls.
Capture the canvas after compositor frames settle, then compare hashes across
all models in each mode. Settled diagnostics avoid counting a redundant shadow
update twice within one animation frame.

Call `shadowDemo.benchmark()` asynchronously through CDP, attempt input during
warm-up and sampling, and inspect diagnostics without injecting extra renders.
Test-only wrappers count shader modules, GPU queue submissions and render passes,
and record disabled controls and physical buffer size at submissions. Repeat at
the same view for every preset and Reference. Failures are injected on separate
navigations before initialization; loss destroys only the owned test GPUDevice.

Both runs used light **37°**, **1024×640** physical pixels, camera position
**[−3.600004336286473, 8.897820005468692, 4.350688731280109]**, target
**[0, 0, −0.2]**, zoom **1.0526315789473684**. Reference records the selected
baseline ID as comparison context; its image/computation is independent of it.

| Mode / model | GPU render-pass median, run 1 (ms) | Run 2 (ms) |
| --- | ---: | ---: |
| Reference | 0.458752 | 0.458752 |
| Neural / small-shallow | 0.262144 | 0.262144 |
| Neural / medium-shallow | 0.262144 | 0.262144 |
| Neural / small-deep | 0.393216 | 0.393216 |
| Neural / baseline-deep | 1.835008 | 1.835008 |

These are actual GPU timestamp observations at one pose/device, with coarse
quantized values. Two equal medians do not establish stability or universal
speedup. The three smaller models cost less here and have worse held-out
accuracy; the baseline costs more than Reference. CPU render-submit medians
were approximately 0.2–0.3 ms and **do not establish GPU speedup**. Instrumentation
adds CPU overhead; neither metric includes presentation/compositing latency.

Initial compile plus first-submit total was **85.4 ms**, including shared work,
with per-model/mode observations in JSON. Driver/browser caches may already be
warm; this is not a cold compiler benchmark. An initial smoke assertion that
all mode transitions create zero modules failed: toggling Three.js shadow flags
can rebuild shared renderer shaders (38 to 54 modules across the mode cycles).
The check was corrected to distinguish model-only selection (zero new modules)
from mode changes. Final benchmark instrumentation verified constant module
counts throughout sampled submissions after warm-up; all final assertions pass.

## Limitations and optional validation

- **Not run:** hosted CI; this repository has no configured CI workflow.
- **Skipped (optional):** additional browsers/devices and committed screenshot grid.
- Physical touch/trackpad testing was not repeated for this model-selection work;
  OrbitControls implementation is unchanged. Native mouse/wheel and responsive
  layout were checked. This does not claim physical touch-device evidence.
- This remains a single-seed, fixed-budget comparison on fixed geometry and a
  bounded light range. Neither equal training steps nor total parameter counts
  isolate a causal effect of depth. README retains these limitations.
- No mandatory criterion remains unperformed or blocked.

## Required post-merge verification

None required.
