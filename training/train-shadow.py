"""Deterministic CPU ideal-ray teacher, training and held-out export validation."""
import argparse
import json
import math
from pathlib import Path
import torch
from torch import nn

ROOT = Path(__file__).resolve().parents[1]
SCENE = json.loads((ROOT / 'src/shadow-scene.json').read_text())
ANGLES = [-40, 0, 40]


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


def create_model():
    return nn.Sequential(nn.Linear(4, 32), nn.ReLU(), nn.Linear(32, 32), nn.ReLU(), nn.Linear(32, 1), nn.Sigmoid())


def load_model(artifact):
    model = create_model()
    with torch.no_grad():
        for module, layer in zip([model[0], model[2], model[4]], artifact['layers']):
            module.weight.copy_(torch.tensor(layer['weights']))
            module.bias.copy_(torch.tensor(layer['biases']))
    return model


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'src/shadow-weights.json')
    parser.add_argument('--validate-only', action='store_true')
    args = parser.parse_args()
    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)
    torch.manual_seed(73)
    teacher_tests()
    held_out = evaluation_points()
    if args.validate_only:
        artifact = json.loads(args.output.read_text())
        assert artifact['sceneVersion'] == SCENE['version']
        model = load_model(artifact)
    else:
        model = create_model()
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
        x, y = inputs(points), teacher(points)
        optimizer = torch.optim.Adam(model.parameters(), lr=0.003)
        for step in range(10000):
            indices = torch.randint(len(x), (2048,))
            optimizer.zero_grad(set_to_none=True)
            loss = nn.functional.binary_cross_entropy(model(x[indices]), y[indices])
            loss.backward()
            optimizer.step()
            if step % 2000 == 0:
                print(f'step={step} BCE={loss.item():.6f}', flush=True)
        artifact = {
            'architecture': [4, 32, 32, 1], 'activation': 'relu', 'outputActivation': 'sigmoid',
            'sceneVersion': SCENE['version'], 'target': 'ideal-ray floor visibility: 0 shadowed, 1 lit',
            'normalization': {'x': SCENE['ground']['x'], 'z': SCENE['ground']['z'],
                              'inputs': ['x mapped to [-1,1]', 'z mapped to [-1,1]', 'sin(azimuth)', 'cos(azimuth)']},
            'layers': [{'weights': m.weight.tolist(), 'biases': m.bias.tolist()} for m in [model[0], model[2], model[4]]],
            'training': {'seed': 73, 'uniformSamples': 65536, 'extraShadowSamples': 32768,
                         'steps': 10000, 'batchSize': 2048, 'optimizer': 'Adam', 'learningRate': 0.003,
                         'loss': 'BCE', 'dtype': 'float32', 'device': 'cpu', 'threads': 1,
                         'torchVersion': str(torch.__version__)}}
    report = {'aggregate': evaluate(model, held_out), 'angles': {
        str(a): evaluate(model, held_out[held_out[:, 2] == a]) for a in ANGLES}}
    print(json.dumps(report, indent=2))
    assert report['aggregate']['iou'] >= 0.70, 'held-out IoU gate failed'
    if not args.validate_only:
        artifact['validationSet'] = {'gridSide': 121, 'samplesPerClassPerAngle': 512, 'anglesDegrees': ANGLES,
                                     'selection': 'cell centers; systematic class-stratified subsample'}
        artifact['validation'] = report
        # These probes cross-check Python float32 against independent JS/TSL layout.
        probes = torch.tensor([[-2.1, -1.7, -40], [-0.9, -0.2, 0], [0.95, -0.6, 40],
                               [2.8, 2.7, 0], [0, -1, -17], [-0.25, -0.15, 0], [0.5, -0.6, 0], [1.4, -0.6, 0]], dtype=torch.float32)
        artifact['probes'] = [{'point': p.tolist(), 'visibility': float(model(inputs(p[None]))[0, 0].detach())} for p in probes]
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(artifact, separators=(',', ':')) + '\n')
        print(f'Exported {args.output}')


if __name__ == '__main__':
    main()
