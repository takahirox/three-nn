"""Deterministic CPU ideal-ray teacher, training and held-out export validation."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import torch
from torch import nn

ROOT = Path(__file__).resolve().parents[1]
SCENE = json.loads((ROOT / 'src/shadow-scene.json').read_text())
ANGLES = [-40, 0, 40]
PRESETS = {
    'small-shallow': [4, 16, 1],
    'medium-shallow': [4, 32, 1],
    'small-deep': [4, 16, 16, 1],
    'baseline-deep': [4, 32, 32, 1],
}
MANIFEST = ROOT / 'src/shadow-models/manifest.json'


def artifact_path(variant):
    return ROOT / ('src/shadow-weights.json' if variant == 'baseline-deep'
                   else f'src/shadow-models/{variant}.json')


def inputs(points):
    """points columns: world x, world z, azimuth degrees."""
    lo_x, hi_x = SCENE['ground']['x']
    lo_z, hi_z = SCENE['ground']['z']
    a = points[:, 2] * math.pi / 180
    return torch.stack(((2 * points[:, 0] - hi_x - lo_x) / (hi_x - lo_x),
                        (2 * points[:, 1] - hi_z - lo_z) / (hi_z - lo_z),
                        a.sin(), a.cos()), dim=1)


def teacher(points):
    """Positive t ray intersections; tangent sphere and closed AABB count as hits."""
    eps = SCENE['teacher']['epsilon']
    a = points[:, 2] * math.pi / 180
    elevation = math.radians(SCENE['light']['elevationDegrees'])
    direction = torch.stack((math.cos(elevation) * a.sin(),
                             torch.full_like(a, math.sin(elevation)),
                             math.cos(elevation) * a.cos()), dim=1)
    origin = torch.stack((points[:, 0], torch.full_like(a, SCENE['ground']['y'] + eps),
                          points[:, 1]), dim=1)
    delta = origin - torch.tensor(SCENE['sphere']['center'])
    b = (delta * direction).sum(dim=1)
    discriminant = b.square() - (delta.square().sum(dim=1) - SCENE['sphere']['radius'] ** 2)
    sphere_hit = (discriminant >= 0) & (-b + discriminant.clamp_min(0).sqrt() > 0)
    center, size = torch.tensor(SCENE['box']['center']), torch.tensor(SCENE['box']['size'])
    lower, upper = center - size / 2, center + size / 2
    # Parallel axes: the slab is unbounded inside, empty outside (avoid 0/0).
    parallel = direction.abs() < 1e-12
    safe = torch.where(parallel, torch.ones_like(direction), direction)
    t1, t2 = (lower - origin) / safe, (upper - origin) / safe
    inside = (origin >= lower) & (origin <= upper)
    near = torch.where(parallel, torch.where(inside, -torch.inf, torch.inf), torch.minimum(t1, t2))
    far = torch.where(parallel, torch.where(inside, torch.inf, -torch.inf), torch.maximum(t1, t2))
    box_hit = (far.min(dim=1).values >= near.max(dim=1).values.clamp_min(0)) & (far.min(dim=1).values > 0)
    return (~(sphere_hit | box_hit)).float().reshape(-1, 1)


def teacher_tests():
    # Interior floor contacts, projected shadow, far outside, and azimuth sign.
    points = torch.tensor([[-0.9, 0.5, 0], [0.95, 0.15, 0], [-0.9, -0.2, 0],
                           [2.9, 2.9, 0], [2.9, -2.9, 40], [-1.6, -0.1, 40],
                           [-1.6, -0.1, -40]], dtype=torch.float64)
    assert teacher(points).flatten().tolist() == [0, 0, 0, 1, 1, 0, 1]


def evaluation_points():
    # Independent cell centers; 512 systematic samples of each class
    # from a 121x121 grid for each held-out angle.
    ground = SCENE['ground']
    points = []
    for angle in ANGLES:
        candidates = torch.tensor([
            [ground['x'][0] + (i + 0.5) / 121 * (ground['x'][1] - ground['x'][0]),
             ground['z'][0] + (j + 0.5) / 121 * (ground['z'][1] - ground['z'][0]), angle]
            for i in range(121) for j in range(121)], dtype=torch.float64)
        labels = teacher(candidates).flatten()
        for label in [0, 1]:
            group = candidates[labels == label]
            assert len(group) >= 512
            indices = torch.arange(512) * len(group) // 512
            points.append(group[indices])
    return torch.cat(points)


def evaluate(model, points):
    with torch.no_grad():
        prediction = model(inputs(points).float())
        labels = teacher(points)
        shadow, actual = prediction < 0.5, labels < 0.5
        return {'samples': len(points), 'shadowed': int(actual.sum()),
                'lit': int((~actual).sum()),
                'mae': float((prediction - labels).abs().mean()),
                'iou': float((shadow & actual).sum() / (shadow | actual).sum())}


def create_model(architecture=None):
    architecture = architecture or PRESETS['baseline-deep']
    modules = []
    for index, (width, output) in enumerate(zip(architecture, architecture[1:])):
        modules.extend([nn.Linear(width, output),
                        nn.Sigmoid() if index == len(architecture) - 2 else nn.ReLU()])
    return nn.Sequential(*modules)


def load_model(artifact):
    model = create_model(artifact['architecture'])
    with torch.no_grad():
        for module, layer in zip(list(model)[::2], artifact['layers']):
            module.weight.copy_(torch.tensor(layer['weights']))
            module.bias.copy_(torch.tensor(layer['biases']))
    return model


def training_points():
    # 65,536 uniform plus 32,768 shadowed samples from rejection sampling.
    def random_points(n):
        r = torch.rand(n, 3)
        for k, domain in enumerate([SCENE['ground']['x'], SCENE['ground']['z'], SCENE['light']['azimuthDegrees']]):
            r[:, k] = domain[0] + r[:, k] * (domain[1] - domain[0])
        # Keep the exact numeric evaluation angles out of training.
        for angle in ANGLES:
            r[r[:, 2] == angle, 2] += 0.001
        return r
    uniform_points = random_points(65536)
    shadow_points = []
    count = 0
    while count < 32768:
        candidate = random_points(32768)
        selected = candidate[teacher(candidate).flatten() == 0]
        shadow_points.append(selected)
        count += len(selected)
    points = torch.cat([uniform_points, torch.cat(shadow_points)[:32768]])
    return points


def train(variant, baseline, points, output, held_out):
    # Dataset and minibatch RNG state are independent of the selected shape.
    if variant == 'baseline-deep':
        model = baseline
    else:
        with torch.random.fork_rng():
            torch.manual_seed(73)
            model = create_model(PRESETS[variant])
    x, y = inputs(points), teacher(points)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.003)
    for step in range(10000):
        indices = torch.randint(len(x), (2048,))
        optimizer.zero_grad(set_to_none=True)
        loss = nn.functional.binary_cross_entropy(model(x[indices]), y[indices])
        loss.backward()
        optimizer.step()
        if step % 2000 == 0:
            print(f'{variant} step={step} BCE={loss.item():.6f}', flush=True)
    artifact = {
        'architecture': PRESETS[variant], 'activation': 'relu', 'outputActivation': 'sigmoid',
        'sceneVersion': SCENE['version'], 'target': 'ideal-ray floor visibility: 0 shadowed, 1 lit',
        'normalization': {'x': SCENE['ground']['x'], 'z': SCENE['ground']['z'],
                          'inputs': ['x mapped to [-1,1]', 'z mapped to [-1,1]', 'sin(azimuth)', 'cos(azimuth)']},
        'layers': [{'weights': m.weight.tolist(), 'biases': m.bias.tolist()} for m in list(model)[::2]],
        'training': {'seed': 73, 'uniformSamples': 65536, 'extraShadowSamples': 32768,
                     'steps': 10000, 'batchSize': 2048, 'optimizer': 'Adam', 'learningRate': 0.003,
                     'loss': 'BCE', 'dtype': 'float32', 'device': 'cpu', 'threads': 1,
                     'torchVersion': str(torch.__version__)}}
    artifact['validationSet'] = {'gridSide': 121, 'samplesPerClassPerAngle': 512, 'anglesDegrees': ANGLES,
                                 'selection': 'cell centers; systematic class-stratified subsample'}
    artifact['validation'] = report(model, held_out)
    probes = torch.tensor([[-2.1, -1.7, -40], [-0.9, -0.2, 0], [0.95, -0.6, 40],
                           [2.8, 2.7, 0], [0, -1, -17], [-0.25, -0.15, 0], [0.5, -0.6, 0], [1.4, -0.6, 0]], dtype=torch.float32)
    artifact['probes'] = [{'point': p.tolist(), 'visibility': float(model(inputs(p[None]))[0, 0].detach())} for p in probes]
    if variant != 'baseline-deep':
        artifact['id'] = variant
        artifact['parameterCount'] = sum(p.numel() for p in model.parameters())
    validate(artifact, held_out, variant)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(artifact, separators=(',', ':')) + '\n')
    print(f'Exported {output}', flush=True)


def report(model, held_out):
    return {'aggregate': evaluate(model, held_out), 'angles': {
        str(a): evaluate(model, held_out[held_out[:, 2] == a]) for a in ANGLES}}


def validate(artifact, held_out, variant):
    assert artifact['architecture'] == PRESETS[variant]
    assert artifact['sceneVersion'] == SCENE['version']
    assert artifact['activation'] == 'relu' and artifact['outputActivation'] == 'sigmoid'
    assert len(artifact['layers']) == len(PRESETS[variant]) - 1
    for layer, width, output in zip(artifact['layers'], PRESETS[variant], PRESETS[variant][1:]):
        assert len(layer['biases']) == len(layer['weights']) == output
        assert all(len(row) == width for row in layer['weights'])
        assert torch.isfinite(torch.tensor(layer['weights'])).all()
        assert torch.isfinite(torch.tensor(layer['biases'])).all()
    model = load_model(artifact)
    result = report(model, held_out)
    print(variant, json.dumps(result), flush=True)
    for actual, stored in [(result['aggregate'], artifact['validation']['aggregate'])] + [
            (result['angles'][str(a)], artifact['validation']['angles'][str(a)]) for a in ANGLES]:
        for key in actual:
            assert math.isfinite(actual[key]) and abs(actual[key] - stored[key]) < 2e-5, key
    if variant == 'baseline-deep':
        assert result['aggregate']['iou'] >= 0.70, 'baseline held-out IoU gate failed'
    with torch.no_grad():
        predictions = model(inputs(held_out).float())
        assert torch.isfinite(predictions).all()
        assert predictions.min() < 0.5 < predictions.max(), 'degenerate constant-class export'
    return result


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def registry(points, held_out):
    return {
        'version': 1, 'defaultModel': 'baseline-deep', 'sceneVersion': SCENE['version'],
        'sharedData': {
            'seed': 73, 'rng': 'PyTorch CPU RNG after seeded baseline Linear initialization',
            'trainingPointsSHA256': hashlib.sha256(bytes(points.untyped_storage())).hexdigest(),
            'evaluationPointsSHA256': hashlib.sha256(bytes(held_out.untyped_storage())).hexdigest(),
            'trainingSamples': len(points), 'evaluationSamples': len(held_out),
            'batchOrder': 'same RNG state after training-point generation; randint each step',
        },
        'models': [{
            'id': variant,
            'label': f"{variant.replace('-', ' ').title()} · " + ' → '.join(map(str, shape)),
            'artifact': '../shadow-weights.json' if variant == 'baseline-deep' else f'./{variant}.json',
            'sha256': digest(artifact_path(variant)), 'architecture': shape,
            'parameterCount': sum((i + 1) * o for i, o in zip(shape, shape[1:])),
            'tensors': [{'weights': [o, i], 'biases': [o]} for i, o in zip(shape, shape[1:])],
        } for variant, shape in PRESETS.items()],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--variant', choices=PRESETS, default='baseline-deep')
    parser.add_argument('--all', action='store_true', help='Train missing presets, retain existing artifacts, refresh registry')
    parser.add_argument('--output', type=Path, help='Override a single variant output; baseline default remains compatible')
    parser.add_argument('--validate-only', action='store_true')
    args = parser.parse_args()
    if args.all and args.output:
        parser.error('--output cannot be combined with --all')
    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)
    torch.manual_seed(73)
    teacher_tests()
    held_out = evaluation_points()
    baseline = create_model()
    points = training_points()
    batch_state = torch.get_rng_state()
    for variant in PRESETS if args.all else [args.variant]:
        output = args.output or artifact_path(variant)
        torch.set_rng_state(batch_state)
        if args.validate_only or (args.all and output.exists()):
            validate(json.loads(output.read_text()), held_out, variant)
        else:
            train(variant, baseline, points, output, held_out)
    if args.all:
        expected = registry(points, held_out)
        if args.validate_only:
            assert json.loads(MANIFEST.read_text()) == expected, 'registry mismatch'
        else:
            MANIFEST.parent.mkdir(parents=True, exist_ok=True)
            MANIFEST.write_text(json.dumps(expected, indent=2) + '\n')


if __name__ == '__main__':
    main()
