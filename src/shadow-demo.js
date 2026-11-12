import {
  AmbientLight, BoxGeometry, Color, DirectionalLight, Mesh, MeshBasicNodeMaterial,
  MeshLambertNodeMaterial, NoToneMapping, OrthographicCamera, PCFShadowMap,
  PlaneGeometry, Scene, SphereGeometry, SRGBColorSpace, Vector2, WebGPURenderer,
} from 'three/webgpu';
import { abs, color, float, positionWorld, shadow, uniform, vec3, vec4 } from 'three/tsl';
import spec from './shadow-scene.json';
import { neuralVisibility } from './neural-shadow.js';
import './style.css';

const canvas = document.querySelector('#scene');
const slider = document.querySelector('#azimuth');
const selector = document.querySelector('#mode');
const measure = document.querySelector('#measure');
const status = document.querySelector('#status');
const timing = document.querySelector('#timing');
let failed = false;
let measuring = false;

function showError(error) {
  failed = true;
  canvas.hidden = true;
  for (const control of [slider, selector, measure]) control.disabled = true;
  status.dataset.state = 'error';
  status.textContent = `Unable to run Neural Shadow: ${error.message} `
    + 'Use a current WebGPU browser with graphics acceleration on localhost or HTTPS, '
    + 'then reload. Check browser GPU diagnostics and console if the problem persists.';
  console.error(error);
}

async function start() {
  if (!window.isSecureContext || !navigator.gpu) throw new Error('WebGPU is unavailable.');
  [slider.min, slider.max] = spec.light.azimuthDegrees.map(String);
  const renderer = new WebGPURenderer({ canvas, antialias: true, trackTimestamp: true });
  renderer.onDeviceLost = (info) => showError(new Error(`GPU device lost: ${info.message}`));
  await renderer.init();
  if (!renderer.backend.isWebGPUBackend) {
    renderer.dispose();
    throw new Error('WebGPU adapter/device unavailable (WebGL2 fallback rejected).');
  }
  const device = renderer.backend.device;
  const timestampsSupported = renderer.backend.trackTimestamp;
  // Timestamp collection is needed only during isolated measurements.
  renderer.backend.trackTimestamp = false;
  const adapterInfo = () => ({ vendor: device.adapterInfo.vendor,
    architecture: device.adapterInfo.architecture, device: device.adapterInfo.device,
    description: device.adapterInfo.description, isFallbackAdapter: device.adapterInfo.isFallbackAdapter });
  device.addEventListener('uncapturederror', (event) => showError(event.error));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, spec.presentation.maxPixelRatio));
  renderer.shadowMap.type = { PCFShadowMap }[spec.shadow.filter];
  if (renderer.shadowMap.type === undefined) throw new Error('Unsupported scene shadow filter.');
  const scene = new Scene();
  scene.background = new Color(spec.presentation.background);
  const camera = new OrthographicCamera(-spec.camera.extent, spec.camera.extent,
    spec.camera.extent, -spec.camera.extent, spec.camera.near, spec.camera.far);
  camera.position.fromArray(spec.camera.position);
  camera.lookAt(...spec.camera.target);
  const light = new DirectionalLight(0xffffff, spec.light.intensity);
  const s = spec.shadow;
  light.shadow.mapSize.set(s.mapSize, s.mapSize);
  light.shadow.bias = s.bias;
  light.shadow.normalBias = s.normalBias;
  Object.assign(light.shadow.camera, { left: -s.cameraExtent, right: s.cameraExtent,
    top: s.cameraExtent, bottom: -s.cameraExtent, near: s.near, far: s.far });
  scene.add(light, light.target, new AmbientLight(0xffffff, spec.light.ambient * Math.PI));
  for (const [geometry, object] of [
    [new SphereGeometry(spec.sphere.radius, 64, 40), spec.sphere],
    [new BoxGeometry(...spec.box.size), spec.box],
  ]) {
    const mesh = new Mesh(geometry, new MeshLambertNodeMaterial({ color: object.color }));
    mesh.position.fromArray(object.center);
    mesh.castShadow = true;
    // Only the ground receives shadows, in both modes.
    scene.add(mesh);
  }

  const azimuth = uniform(0);
  const predicted = neuralVisibility(positionWorld, azimuth);
  const mapped = shadow(light).r;
  const base = color(new Color(spec.ground.color));
  const direct = spec.light.intensity * Math.sin(spec.light.elevationDegrees * Math.PI / 180) / Math.PI;
  const floorColor = (visibility) => vec4(base.mul(float(spec.light.ambient).add(visibility.mul(direct))), 1);
  const material = (fragmentNode) => {
    const result = new MeshBasicNodeMaterial();
    result.fragmentNode = fragmentNode;
    return result;
  };
  const error = abs(mapped.sub(predicted));
  const materials = {
    reference: material(floorColor(mapped)),
    neural: material(floorColor(predicted)),
    difference: material(vec4(vec3(error, error.mul(error), 0), 1)),
  };
  const ground = new Mesh(new PlaneGeometry(spec.ground.x[1] - spec.ground.x[0],
    spec.ground.z[1] - spec.ground.z[0]), materials.reference);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((spec.ground.x[0] + spec.ground.x[1]) / 2, spec.ground.y,
    (spec.ground.z[0] + spec.ground.z[1]) / 2);
  ground.receiveShadow = true;
  scene.add(ground);

  function applyMode(mode) {
    ground.material = materials[mode];
    renderer.shadowMap.enabled = mode !== 'neural';
    light.castShadow = mode !== 'neural';
    // Also stop any cached ShadowNode updates when switching to Neural.
    light.shadow.autoUpdate = mode !== 'neural';
    light.shadow.needsUpdate = mode !== 'neural';
    document.querySelector('#legend').hidden = mode !== 'difference';
    measure.disabled = measuring || mode === 'difference' || failed;
  }
  function updateLight() {
    azimuth.value = Number(slider.value) * Math.PI / 180;
    const e = spec.light.elevationDegrees * Math.PI / 180;
    light.position.set(Math.cos(e) * Math.sin(azimuth.value), Math.sin(e),
      Math.cos(e) * Math.cos(azimuth.value)).multiplyScalar(spec.light.distance);
    document.querySelector('#angle').value = `${slider.value}°`;
  }
  function render() {
    if (failed) return;
    renderer.render(scene, camera);
  }
  function resize() {
    if (failed || measuring) return;
    const { width, height } = canvas.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.top = spec.camera.extent * height / width;
    camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    try { render(); } catch (error) { showError(error); }
  }
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  async function benchmark() {
    if (selector.value === 'difference' || measuring || failed) return;
    measuring = true;
    for (const control of [slider, selector, measure]) control.disabled = true;
    timing.textContent = 'Measuring isolated frames…';
    try {
      const cpu = [], gpu = [];
      renderer.backend.trackTimestamp = timestampsSupported;
      for (let i = 0; i < 150; i++) {
        await nextFrame();
        if (failed) throw new Error('Device failed during measurement.');
        const start = performance.now();
        render();
        const elapsed = performance.now() - start;
        if (timestampsSupported) await renderer.resolveTimestampsAsync();
        await device.queue.onSubmittedWorkDone();
        if (i >= 30) {
          cpu.push(elapsed);
          if (timestampsSupported && Number.isFinite(renderer.info.render.timestamp)) {
            gpu.push(renderer.info.render.timestamp);
          }
        }
      }
      const size = renderer.getDrawingBufferSize(new Vector2());
      const result = { mode: selector.value, backend: 'WebGPU',
        physicalPixels: [size.x, size.y], azimuth: Number(slider.value),
        shadowMap: s, warmup: 30, samples: 120,
        cpuRenderSubmitMedianMs: median(cpu),
        gpuRenderPassMedianMs: gpu.length ? median(gpu) : null,
        gpuTiming: gpu.length ? 'Sum of render-pass timestamp queries (including shadow pass)' : 'unavailable',
        adapter: adapterInfo(), userAgent: navigator.userAgent,
        note: 'CPU render-submit excludes GPU completion and is not evidence of GPU speedup.' };
      timing.textContent = JSON.stringify(result, null, 2);
      return result;
    } finally {
      measuring = false;
      renderer.backend.trackTimestamp = false;
      if (!failed) {
        slider.disabled = selector.disabled = false;
        applyMode(selector.value);
        resize();
      }
    }
  }
  updateLight();
  canvas.hidden = false;
  // Validate every mode's pipelines and a real submission before reporting ready.
  device.pushErrorScope('validation');
  for (const mode of ['reference', 'neural', 'difference']) {
    applyMode(mode);
    await renderer.compileAsync(scene, camera);
    resize();
    await device.queue.onSubmittedWorkDone();
  }
  const validationError = await device.popErrorScope();
  if (validationError) throw validationError;
  if (failed) return;
  applyMode(selector.value);
  resize();
  slider.addEventListener('input', () => {
    try { updateLight(); render(); } catch (error) { showError(error); }
  });
  selector.addEventListener('change', () => {
    try { applyMode(selector.value); render(); } catch (error) { showError(error); }
  });
  measure.addEventListener('click', () => benchmark().catch(showError));
  new ResizeObserver(resize).observe(canvas);
  slider.disabled = selector.disabled = measure.disabled = false;
  status.dataset.state = 'ready';
  status.textContent = 'WebGPU active · all three modes compiled and rendered.';

  // Render diagnostics plus the same benchmark used by the UI.
  // Per-render call deltas distinguish the native shadow pass from Neural.
  window.shadowDemo = {
    benchmark,
    diagnostics() {
      const before = renderer.info.render.calls;
      render();
      return { backend: renderer.backend.isWebGPUBackend ? 'WebGPU' : 'unexpected',
        mode: selector.value, shadowMapEnabled: renderer.shadowMap.enabled,
        lightCastShadow: light.castShadow, renderCalls: renderer.info.render.calls - before,
        physicalPixels: [canvas.width, canvas.height], timestampQueries: timestampsSupported,
        adapter: adapterInfo() };
    },
  };
}

start().catch(showError);
