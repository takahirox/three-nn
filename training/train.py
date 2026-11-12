"""Train the demo's scalar MLP on CPU and export weights (no runtime training)."""

import argparse
import json
from pathlib import Path

import torch
from torch import nn


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output", type=Path,
        default=Path(__file__).resolve().parents[1] / "src" / "weights.json",
    )
    args = parser.parse_args()

    torch.manual_seed(42)
    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)
    model = nn.Sequential(nn.Linear(1, 8), nn.ReLU(), nn.Linear(8, 1)).cpu()
    x = torch.linspace(0, 1, 1025).reshape(-1, 1)
    y = x.pow(4)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
    for _ in range(12000):
        optimizer.zero_grad(set_to_none=True)
        loss = (model(x) - y).square().mean()
        loss.backward()
        optimizer.step()

    with torch.no_grad():
        errors = (model(torch.linspace(0, 1, 101).reshape(-1, 1))
                  - torch.linspace(0, 1, 101).reshape(-1, 1).pow(4)).abs()
        mae, maximum = errors.mean().item(), errors.max().item()
        if mae > 0.03 or maximum > 0.10:
            raise RuntimeError(f"Accuracy gate failed: MAE={mae}, max={maximum}")
        artifact = {
            "architecture": [1, 8, 1],
            "activation": "relu",
            "inputDomain": [0, 1],
            "target": "x^4",
            "targetDomain": [0, 1],
            "outputActivation": "linear",
            "displayClamp": [0, 1],
            "training": {
                "seed": 42, "samples": 1025, "steps": 12000,
                "optimizer": "Adam", "learningRate": 0.01,
                "loss": "MSE", "dtype": "float32", "device": "cpu",
                "torchVersion": str(torch.__version__),
            },
            "w1": model[0].weight[:, 0].tolist(),
            "b1": model[0].bias.tolist(),
            "w2": model[2].weight[0].tolist(),
            "b2": model[2].bias[0].item(),
        }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
    print(f"Exported 25 parameters to {args.output}")
    print(f"101-point unclamped MAE={mae:.8f}, max absolute error={maximum:.8f}")


if __name__ == "__main__":
    main()
