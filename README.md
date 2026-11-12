# three-nn

Neural Shading Hello World: two spheres compare analytical `x^4` with a trained
**1 → 8 → 1 ReLU MLP evaluated per fragment with Three.js TSL on WebGPU**.
This demonstrates offline training → exported weights → shader inference → live
comparison. **This does not demonstrate a performance improvement.** The simple
analytical baseline may be faster than the network.

## Run the demo

Prerequisites:

- Node.js **20.19+ within 20.x, or 22.12+** and npm (Node 26.12.1/npm 11.20.0
  used for validation).
- A current WebGPU-capable browser, for example Chrome on macOS with a Metal GPU
  and graphics acceleration enabled. Tested with Chrome 157 on macOS 27.2, Apple
  Metal 3 hardware. Browser/OS support alone does not guarantee an available GPU
  adapter; check `chrome://gpu` when troubleshooting.
- A secure context: use the localhost URL below, or HTTPS when hosted elsewhere.

```sh
npm install
npm run dev
```

Open the printed local URL (normally `http://localhost:5173`). Python is **not**
needed to run, test or build the demo: the trained JSON is committed.

The left sphere is the analytical reference; the right sphere uses the network.
Move **Light azimuth** to change the shared world-space direction toward the
light, or focus the slider and use arrow keys. Zero degrees points toward the
camera; negative/positive angles move left/right. The direction has a fixed
upward component and is normalized. Both spheres update without retraining.

Initialization reports success only after confirming a WebGPU backend and
compiling/rendering both materials. Missing WebGPU, a failed adapter/device,
shader errors or device loss show a visible recovery message and disable the
control. Three.js's automatic WebGL2 fallback is rejected before rendering.

```sh
npm test             # JSON contract + 101-point numerical accuracy
npm run build       # production files in dist/
npm run preview     # serve the built files locally
```

Three.js is pinned to **0.181.1**, Vite to **7.3.8**; commit changes to both the
manifest and lockfile when updating dependencies. The build may report a large
chunk warning for the Three.js WebGPU bundle; this minimal demo keeps one bundle.

## How it works

- [`training/train.py`](training/train.py) trains only on CPU with PyTorch.
  [`src/weights.json`](src/weights.json) is its exported artifact.
- [`src/main.js`](src/main.js) shares one orthographic camera, sphere geometry,
  base color and light-direction uniform between both meshes. Normalization,
  `x = clamp(dot(N, L), 0, 1)` and shading run in the fragment stage, using the
  fragment's world-space normal. The reference uses TSL `pow(x, 4)`.
- [`src/neural-mlp.js`](src/neural-mlp.js) imports that JSON and builds the eight
  hidden-unit TSL expressions once. The JavaScript loop constructs the shader;
  it does not evaluate samples on the CPU. TSL generates the GPU shader. There
  is no runtime training, inference library, lookup texture, compute pipeline or
  handwritten WGSL.
- Both `MeshBasicNodeMaterial.fragmentNode` outputs bypass built-in lighting.
  There are no scene lights. Both intensities are clamped to `[0,1]`, multiplied
  by the same linear base color, and passed through the same sRGB output
  conversion with tone mapping disabled. Displayed RGB values therefore include
  the shared color conversion; the intensity comparison happens in linear space.
- Rendering happens on initialization, resize and slider input; no continuous
  animation loop or CPU network inference is needed.

The MLP is a piecewise linear approximation, so small bands and differences are
expected. It was trained only on `[0,1]`; behavior outside that domain is not
validated. Raw network output is linear and may be slightly negative or exceed
one. Accuracy tests use **unclamped** output; only display intensity is clamped.

## Reproduce the training

Use Python **3.10–3.13** on a platform supported by PyTorch 2.9.1 (validated with
Python 3.13.13 on macOS ARM64). A separate virtual environment keeps Python out
of ordinary app startup:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r training/requirements.txt
.venv/bin/python training/train.py
npm test
```

On Windows, use `.venv\Scripts\python` instead of `.venv/bin/python`.
To compare without replacing the committed artifact:

```sh
.venv/bin/python training/train.py --output /tmp/three-nn-weights.json
```

The deterministic procedure uses seed **42**, a single CPU thread, PyTorch
deterministic algorithms, default seeded `Linear` initialization and float32.
The dataset is **1,025 equally spaced inputs** including both endpoints of
`[0,1]`, with exact target `x^4`; no random dataset or shuffle is involved.
The model is `Linear(1,8) → ReLU → Linear(8,1)`. Full-batch Adam minimizes MSE
for **12,000 steps** at learning rate **0.01**, using PyTorch's other optimizer
defaults. No weights are hand selected or frozen. Export fails if the 101-point
accuracy requirements are not met.

The pinned PyTorch version and identical environment regenerate byte-identical
JSON (verified with two runs). Bitwise equality across different CPU platforms
or PyTorch versions is not guaranteed; rerun the numeric test after regeneration.
PyTorch can warn about optional NumPy being absent; this script uses only tensors
and Python lists and does not require NumPy.

### Export contract

The JSON records `architecture: [1,8,1]`, `activation: "relu"`,
`inputDomain: [0,1]`, `target: "x^4"`, `targetDomain: [0,1]`,
`outputActivation: "linear"`, `displayClamp: [0,1]`, and training metadata.
The **25 learned scalar parameters** are:

| Field | Ordering |
| --- | --- |
| `w1[8]` | `Linear(1,8).weight[i][0]`, hidden units `i = 0…7` |
| `b1[8]` | `Linear(1,8).bias[i]`, same order |
| `w2[8]` | `Linear(8,1).weight[0][i]`, same hidden-unit order |
| `b2` | `Linear(8,1).bias[0]`, scalar |

For each scalar `x`, the unclamped output is:

```text
y = b2 + sum(w2[i] * max(w1[i] * x + b1[i], 0), i = 0…7)
```

[`tests/mlp.test.js`](tests/mlp.test.js) verifies schema, finite parameters and
counts, then independently evaluates all **101 points `i/100`, `i = 0…100`**.
Committed weights measure **MAE 0.00268418** and **maximum absolute error
0.01103208** using JavaScript numbers, below the required **0.03 / 0.10**.
PyTorch float32 and GPU float32 may differ slightly from JavaScript float64.

## Browser verification

For shader changes, run the demo in a WebGPU-capable browser and verify the
success message, both spheres, slider/keyboard interaction, and browser console.
Test missing support and adapter failure as well. Record browser, OS, adapter,
backend verification, revision and actual results; `navigator.gpu` alone does
not prove WebGPU execution. The Issue #3 evidence is in
[`docs/validation-issue-3.md`](docs/validation-issue-3.md).

## Contributor documentation

- [Development flow](docs/development-flow.md)
- [Review and merge guidelines](docs/review-guidelines.md)
- [UI/UX and layout principles](docs/ui-ux-principles.md)
- [Test and CI performance principles](docs/testing-ci-principles.md)
- [Agent guidance](AGENTS.md)
- [Issue template](.github/ISSUE_TEMPLATE/issue.md)
- [Pull request template](.github/pull_request_template.md)

Three.js references: [WebGPURenderer guide](https://threejs.org/manual/pages/webgpurenderer),
[TSL](https://threejs.org/docs/pages/TSL.html),
[MeshBasicNodeMaterial](https://threejs.org/docs/pages/MeshBasicNodeMaterial.html).

## Neural Shadow (Issue #5)

Open **[`/shadow.html`](shadow.html)** on the same dev server, or follow the
“Neural Shadow demo” link on the original page. Both entries are included by
`vite.config.js` in `npm run build` and work with `npm run preview`. The original
x⁴ shaders, weights and accuracy tests are preserved.

Select **Reference (shadow map)**, **Neural**, or **Difference** without reloading.
The shared, keyboard-accessible azimuth slider updates the light without
retraining. Reference uses an actual Three.js directional shadow map. Neural
replaces only floor visibility with the selected pretrained TSL fragment
MLP (default **4 → 32 → 32 → 1**) and disables the light's shadow casting, renderer shadow mapping and shadow
updates. The sphere and box keep identical ordinary Lambert lighting in all modes
and are not learned receivers. There is no path tracing or scene generalization.

Drag inside the canvas with the left mouse button or one finger to orbit; use the
mouse wheel, trackpad scroll or two-finger pinch to zoom. OrbitControls allows a
full horizontal turn around the fixed scene-spec target. Polar angle is bounded
to **0.1 … π/2 − 0.05 radians** (about 5.7–87.1° from up), keeping the camera
above the floor; panning is disabled. Orthographic zoom is bounded to **0.5–2×**.
Touch gestures are captured only on this canvas; the rest of the page scrolls
normally. Controls respond immediately without damping or an animation loop.

**Reset view** restores the scene-spec initial position **(5,6,7)**, target
**(0,0,−0.2)** and zoom **1×**, preserving light and mode. Mode changes and resizing
retain the current pose and zoom. The **Neural model** selector also preserves
light, mode, renderer and canvas size; in Reference it leaves the image unchanged. All modes share this live camera, and Difference
compares visibility at identical camera/light/scene settings. Camera pose is not a
network input, so orbiting requires no retraining or new weights.

### Fixed scene and light convention

[`src/shadow-scene.json`](src/shadow-scene.json) is read by both the browser and
Python. Its version is also recorded in the weights. Geometry and lighting:

| Item | Specification |
| --- | --- |
| Ground | Opaque horizontal plane at y=0, x,z each in [−3,3] |
| Sphere | Center (−0.9,0.65,0.5), radius 0.65; rests on ground |
| Axis-aligned box | Center (0.95,0.6,0.15), size (0.9,1.2,0.9); rests on ground |
| Directional light | White, intensity 2.5, elevation 45°, azimuth θ ∈ [−60°,60°] |
| Ambient | Common unshadowed linear floor intensity 0.18 |
| Initial camera | Orthographic, position (5,6,7), target (0,0,−0.2), zoom 1, horizontal extent ±4.5 |
| Shadow map | 1024², `PCFShadowMap`, bias −0.0002, normalBias 0 |
| Shadow camera | Orthographic ±5, near 0.1, far 25 |

**L points from the floor toward the light**, with
`L = (cos(45°) sin(θ), sin(45°), cos(45°) cos(θ))`. At zero azimuth it points
upward and toward +Z; positive azimuth adds +X. The actual DirectionalLight sits
at `10 L` and targets the origin. The teacher ray and shader use the same θ and
fixed elevation. The scene JSON also fixes colors, framing and presentation.
Changing geometry or light elevation requires a new scene version and retraining.

### Shared lighting and interpreting Difference

[`src/shadow-demo.js`](src/shadow-demo.js) uses a common floor expression in both
modes, in linear color:

```text
floorRGB = baseRGB × (0.18 + (2.5 × sin(45°) / π) × visibility)
```

Both use `MeshBasicNodeMaterial.fragmentNode`, sRGB output, no tone mapping,
antialiasing, the same live camera and pixel ratio `min(devicePixelRatio,2)`.
Ambient stays unshadowed. Reference gets visibility from Three.js TSL
`shadow(light).r`, which renders both `castShadow` occluders through the real
Three.js shadow-map pass; the floor has `receiveShadow=true`. It is not a CPU or
analytical shadow imitation. Neural uses
[`neural-shadow.js`](src/neural-shadow.js), importing the committed JSON. JS builds
the graph once; the shader evaluates it per floor fragment, with no CPU raycasts,
lookup masks, runtime inference library or runtime training.

Difference evaluates both visibility factors at the **same floor fragment** and
shows `e = abs(VshadowMap − Vneural)` as linear `(e,e²,0)` before common sRGB
conversion. Black means zero, orange intermediate error, yellow full disagreement.
This is the absolute linear floor-color difference divided componentwise by the
common `baseRGB × directIntensity`; the ambient cancels. Casters retain their
normal colors. **Difference runs both techniques and cannot be timed.**

The teacher is **ideal hard ray visibility, not captured shadow-map pixels**.
Neural edges are soft; map filtering, tessellated sphere geometry, finite texels
and depth bias cause further edge differences. The visualization exposes these
rather than claiming pixel equality. Unoccluded floor illumination is identical;
independent quantitative accuracy measures visibility rather than display colors.

### Train and validate Neural Shadow

Use the existing Python environment and pinned `training/requirements.txt` above:

```sh
# Train missing presets and validate/reuse existing ones, including the baseline.
# Refreshes the deterministic registry, referencing the original baseline file.
.venv/bin/python training/train-shadow.py --all
.venv/bin/python training/train-shadow.py --all --validate-only
npm test

# Regenerate any one variant (all four IDs are accepted):
.venv/bin/python training/train-shadow.py --variant small-shallow
.venv/bin/python training/train-shadow.py --variant medium-shallow
.venv/bin/python training/train-shadow.py --variant small-deep
# Optional baseline reproduction without replacing the committed artifact:
.venv/bin/python training/train-shadow.py --output /tmp/shadow-weights.json

# Explicitly regenerate every variant, then refresh artifact hashes:
for variant in small-shallow medium-shallow small-deep baseline-deep; do
  .venv/bin/python training/train-shadow.py --variant "$variant"
done
.venv/bin/python training/train-shadow.py --all
```

Without options, the original baseline training/export command remains compatible;
`--validate-only` validates the baseline. `--output` redirects a single variant's
export/validation. After replacing artifacts, `--all` refreshes the registry.

All presets use PyTorch 2.9.1, seed **73**, one CPU thread, deterministic algorithms
and float32. To preserve the valid baseline's data exactly, the script first
initializes the seeded baseline Linear layers, then generates **65,536 uniform
floor/azimuth samples plus 32,768 shadowed samples** by rejection sampling. It
uses these same 98,304 examples and labels for every shape, regardless of model
initialization. Each alternative initializes its own default Linear layers with
seed 73, without consuming the shared data/minibatch RNG. Each training run
starts minibatch sampling from the same post-data-generation RNG state. The
registry records SHA-256 of the raw contiguous training float32 and held-out
float64 point tensors (little-endian in the validated environment). No training
dataset or framework checkpoint is committed.

Exact −40°, 0°, +40° angles are excluded from training. ReLU activates **every**
hidden layer; only the final layer uses sigmoid. Adam minimizes BCE for
**10,000 steps** with random batches of **2,048**, learning rate **0.003** and
other optimizer defaults. This is a fixed budget, with no early stopping or
held-out model selection. Equal steps do not establish equal convergence or
optimization quality. Bitwise reproducibility across platforms or PyTorch
versions is not promised; rerun numeric validation after regeneration. The
unchanged baseline was reproduced byte-for-byte in the validated environment.

The CPU teacher offsets origins to `(x,0.0001,z)` and traces positive-distance
rays toward L. A sphere quadratic with discriminant ≥0 and a positive far root
counts as a hit (including tangency). The box uses closed AABB slab intersections
with overlapping intervals and a positive exit; parallel axes must lie inside
the slab. Either hit gives visibility 0, otherwise 1. Basic contact, outside,
projected-shadow and direction-sign cases run before training/validation.

[`src/shadow-models/manifest.json`](src/shadow-models/manifest.json) fixes model
IDs, friendly architecture labels, exact artifact paths/hashes, tensor dimensions,
parameter counts (weights **and biases**), default ID, scene version and shared
data provenance. Each model JSON contains architecture, activations, scene version,
normalization/input order, target semantics, all learned tensors, training budget,
held-out metrics and float32 probes. The baseline reuses
[`shadow-weights.json`](src/shadow-weights.json) without duplication or modification.

Inputs are world x and z mapped linearly from the ground domain to [−1,1], then
sin(θ), cos(θ). Each layer stores `weights[outputNeuron][inputNeuron]` and
`biases[outputNeuron]`; hidden outputs are `max(Wx+b,0)`, the last output is
`sigmoid(Wx+b)` and display visibility is clamped to [0,1]. The TSL graph uses the
selected layer count to place activations, packs row dot products into vec4
operations and materializes neurons to avoid exponential graph expansion. All
artifacts are bundled, and Reference plus every Neural/Difference pipeline is
compiled and submitted before controls become available. Initialization reports
progress/errors and total compilation time. Selecting a model needs no reload,
fetch or training. Three.js can rebuild shared shaders when mode flags change;
the benchmark warms the selected state before collecting samples. The compact
summary reports the selected ID, architecture, count and common held-out
aggregate MAE/IoU.

[`tests/shadow-model.test.js`](tests/shadow-model.test.js) checks every required
shape, finite parameters, hash, tensor layout and independent Python/JS probes.
It independently regenerates the ray labels and fixed held-out set for **all four**
models. At each of −40°, 0°, +40°, a 121² cell-center grid is divided by ideal
visibility; **512 samples per class** are selected systematically at indices
`floor(k × classCount / 512)`. Each angle has **1,024 samples (512 shadowed / 512
lit)**; the aggregate has **3,072 (1,536 / 1,536)**. These points are independent
of training. This balanced metric is not an area-weighted floor error. Shadow
classification uses `V < 0.5`. Recomputed counts must match exactly; Python
float32 versus JS float64 tolerances are **2e-5 MAE**, **1e-6 IoU** and **2e-5
probe visibility**. Only the existing baseline retains its aggregate IoU ≥0.70
gate; smaller variants may legitimately lose quality.

| Model ID | Architecture | Parameters | −40° MAE / IoU | 0° MAE / IoU | +40° MAE / IoU | Aggregate MAE / IoU |
| --- | --- | ---: | --- | --- | --- | --- |
| `small-shallow` | 4 → 16 → 1 | 97 | 0.046241 / 0.960227 | 0.082998 / 0.920000 | 0.074787 / 0.926335 | 0.068009 / 0.935225 |
| `medium-shallow` | 4 → 32 → 1 | 193 | 0.044710 / 0.963947 | 0.083992 / 0.925319 | 0.064305 / 0.942699 | 0.064336 / 0.943723 |
| `small-deep` | 4 → 16 → 16 → 1 | 369 | 0.016379 / 0.982659 | 0.022148 / 0.971264 | 0.018805 / 0.984496 | 0.019111 / 0.979448 |
| `baseline-deep` | 4 → 32 → 32 → 1 | 1,249 | 0.009873 / 0.990291 | 0.013256 / 0.986486 | 0.011560 / 0.986486 | 0.011563 / 0.987750 |

These single-seed, fixed-budget observations show better aggregate accuracy for
the deeper presets here. Compare width at fixed depth and depth at fixed width;
parameter count also changes, so this is not causal evidence about depth alone,
nor a claim that larger networks are universally more accurate or faster. Compare
visible sphere and box shadow edges at the same light/view in Neural, then
Difference; filtered reference edges differ from the ideal-ray targets. All
results apply only to this fixed scene, floor and light range.

### Compare rendering cost

1. Open the production `/shadow.html` with `npm run preview`. Keep browser, device,
   window size, device pixel ratio, light angle, camera pose and zoom fixed between
   models and modes. Wait for “WebGPU active”. Choose Reference or Neural and the
   **Neural model**, then **Measure this mode**. Repeat for Reference and each of
   the four models without moving the camera, light or window. Run each at least
   twice and retain both results; a single median does not establish stability.
2. Each run uses 30 warm-up and 120 sampled frames, one per animation frame,
   waiting for submitted GPU work after each. Light/mode controls, camera input,
   model selection, Reset view and resize are held during warm-up and sampling,
   then restored if the demo remains healthy. The chosen pose is preserved throughout. It renders
   only the selected method, never Difference.
3. The output records mode, model ID, architecture, parameter count, physical
   canvas pixels, light angle, shadow settings,
   browser, adapter, backend, `cameraPosition`, `cameraTarget`, `cameraZoom` and
   medians. Compare results only at matching view parameters; different poses or
   zooms are distinct measurement conditions. CPU wall time brackets only
   synchronous `renderer.render()` submission; GPU completion waits are outside this timer.
   When available, Three.js timestamp queries sum GPU render-pass times including
   the reference shadow pass and common scene/output passes. They exclude browser
   compositing and are not end-to-end presented frame latency. GPU time is reported
   as **unavailable** when timestamp queries are unsupported; CPU timing alone is
   exploratory and **cannot establish a GPU speedup**.

Initial compilation observations are available through `shadowDemo.compilation`
and `shadowDemo.compilationTotalMs`; they include compile plus first submission,
not isolated compiler time. Compilation is completed before any timed run.

Shadow maps scale with caster geometry/count and map resolution; neural work
scales with floor receiver fragments and network size. Neither technique is
universally faster. In the recorded Apple Metal test, Neural was slower; no NN
speedup is claimed. Exact production timings, environment, browser smoke evidence
and validation revision for the original baseline are in
[`docs/validation-issue-5.md`](docs/validation-issue-5.md). Current four-model
observations, limitations and acceptance evidence are in
[`docs/validation-issue-9.md`](docs/validation-issue-9.md).
