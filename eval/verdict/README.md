# On-device judge reference

The on-device judge is Qwen3.5-0.8B (D-55), run from the pinned ONNX build named
in `src/judges/device/verdict.ts`. It answers one question per guess: is this claim
true of the player's answer? The adapter asks the model whether the statement is
true and returns P(true) as the probability of "yes" against "no" for the next
token, from a single forward pass.

`reference.py` is the canonical Python copy of that adapter. It must use the same
model file, prompt, and yes/no tokens as the TypeScript adapter, which is shared by
the browser and Node.

## Setup

Use Python 3.10 or newer. From the repository root:

```sh
python3 -m venv eval/verdict/.venv
eval/verdict/.venv/bin/pip install -r eval/verdict/requirements.txt
```

Download `config.json`, `tokenizer.json`, `tokenizer_config.json`, and the model
file with its `_data` file into `eval/verdict/model/`, keeping the `onnx/` folder,
from the pinned revision of the repository named in `deviceModel`. That folder, the
virtual environment, and Python caches are ignored by Git.

## Parity

1. `eval/verdict/.venv/bin/python -I eval/verdict/reference.py` scores
   `tests/fixtures/verdict/cases.json` and writes
   `tests/fixtures/verdict/python-reference.json`.
2. `npm run ts -- eval/verdict/parity.ts [browser-results.json ...]` scores the same
   cases in Node with `onnxruntime-node`, compares every runtime with the Python
   reference, and writes `tests/fixtures/verdict/parity.json`. Browser results use
   the same `{ runtime, results: [{ id, p }] }` shape.

Every runtime must agree with the reference within |ΔP| ≤ 0.02. Cases within 0.04
of the 0.5 threshold are flagged, since small differences can flip them. Never
replace generated scores with hand-written ones. The browser and production Worker
never import or run this Python code.
