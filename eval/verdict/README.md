# Python Verdict reference

The canonical Python two-candidate adapter will be implemented here as
`eval/verdict/reference.py` during the Phase 0 parity spike. This folder reserves
its location; it does not contain model inference logic yet.

The reference uses the same pinned model files, tokenizer input packing,
calibrator `per_k[2]` temperature, and true/false candidate order as the
TypeScript adapter in `src/judges/device/verdict.ts`. It generates the reference
scores used to compare Python, Node, browser WebGPU and browser WASM.

Use `tests/fixtures/verdict/cases.json` for the common parity inputs,
`tests/fixtures/verdict/python-reference.json` for the Python reference scores,
and `tests/fixtures/verdict/parity.json` for the cross-runtime comparison.
Those small fixture outputs are committed. These files will be generated during
the spike; do not replace them with fabricated model scores.
Keep downloaded model weights, virtual environments and Python caches local.
Pin the actual Python dependencies in `eval/verdict/requirements.txt` when the
reference is implemented; dependency selection belongs to that model spike.
The browser and production Worker never import or run this Python code.
