"""Simulation models. All numbers are illustrative, not hardware benchmarks."""
import numpy as np, random

TASKS = {
    "image":  {"name": "Image classification", "unit": "images", "min": 1000, "max": 50000, "default": 10000, "sec_per_unit": 0.012},
    "weather": {"name": "Weather simulation", "unit": "grid cells", "min": 1000, "max": 100000, "default": 20000, "sec_per_unit": 0.006},
    "molecule": {"name": "Molecular simulation", "unit": "atoms", "min": 500, "max": 30000, "default": 5000, "sec_per_unit": 0.02},
    "matrix": {"name": "Matrix computation", "unit": "million ops", "min": 100, "max": 5000, "default": 1000, "sec_per_unit": 0.1},
}
# speedup vs CPU, transfer and overhead as fraction of base time, power (W), usage [cpu, gpu, npu], RAM/VRAM (GB)
PARADIGMS = {
    "cpu": {"name": "Classical (CPU)", "speedup": 1.0, "transfer": 0.0, "overhead": 0.02, "power": 65, "usage": [95, 0, 0], "ram": 6.0, "vram": 0.0,
            "why": "One general processor works step by step: flexible, few parallel lanes."},
    "hybrid": {"name": "Hybrid (CPU + GPU)", "speedup": 3.4, "transfer": 0.06, "overhead": 0.04, "power": 190, "usage": [45, 82, 0], "ram": 5.2, "vram": 6.5,
               "why": "The GPU runs thousands of identical operations in parallel, but data must move between CPU and GPU."},
    "hetero": {"name": "Heterogeneous (CPU + GPU + NPU)", "speedup": 4.3, "transfer": 0.08, "overhead": 0.07, "power": 150, "usage": [40, 70, 60], "ram": 5.5, "vram": 5.0,
               "why": "Each stage goes to the processor that suits it. Scheduling adds overhead."},
    "accel": {"name": "AI accelerator (NPU/TPU)", "speedup": 6.0, "transfer": 0.03, "overhead": 0.03, "power": 45, "usage": [15, 0, 90], "ram": 3.0, "vram": 0.0,
              "why": "Built for neural-network matrix math: fast and efficient, but only for supported operations."},
}
STAGES = ["Data loading", "Preprocessing", "Computation", "Inference", "Results"]

def estimate(paradigm: str, task: str, size: int) -> dict:
    p, t = PARADIGMS[paradigm], TASKS[task]
    base = t["sec_per_unit"] * size
    processing, transfer, overhead = base / p["speedup"], base * p["transfer"], base * p["overhead"]
    total = processing + transfer + overhead                      # T = processing + transfer + overhead
    return {"processing": round(processing, 2), "transfer": round(transfer, 2), "overhead": round(overhead, 2),
            "total": round(total, 2), "energy_wh": round(p["power"] * total / 3600, 3), "power_w": p["power"]}

def timeline(paradigm: str, points: int = 100) -> list:
    p, rng = PARADIGMS[paradigm], random.Random(7)
    out = []
    for i in range(points + 1):
        ramp = min(1, i / 8)
        j = lambda v: round(max(0, min(100, v * ramp * (0.9 + rng.random() * 0.1))), 1)
        out.append({"progress": i, "cpu": j(p["usage"][0]), "gpu": j(p["usage"][1]), "npu": j(p["usage"][2]),
                    "ram": round(p["ram"] * ramp, 2), "vram": round(p["vram"] * ramp, 2), "power": round(p["power"] * ramp)})
    return out

def bell(shots: int, noise: float) -> dict:
    """Real 2-qubit statevector: H on q0 then CNOT(q0 -> q1), then measurement with optional bit-flip noise."""
    H = np.array([[1, 1], [1, -1]]) / np.sqrt(2)
    I = np.eye(2)
    CNOT = np.array([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1], [0, 0, 1, 0]])
    state = CNOT @ np.kron(H, I) @ np.array([1, 0, 0, 0])
    probs = np.abs(state) ** 2
    rng = np.random.default_rng()
    counts = {"00": 0, "01": 0, "10": 0, "11": 0}
    for k in rng.choice(4, size=shots, p=probs):
        a, b = int(k) >> 1, int(k) & 1
        if rng.random() < noise: a ^= 1
        if rng.random() < noise: b ^= 1
        counts[f"{a}{b}"] += 1
    return {"statevector": [round(float(x), 4) for x in state], "ideal": [round(float(x), 3) for x in probs], "counts": counts, "shots": shots}
