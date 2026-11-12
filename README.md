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
