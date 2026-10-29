"""Canonical Python reference for the on-device judge (Qwen3.5-0.8B, D-55).

Reads tests/fixtures/verdict/cases.json and writes
tests/fixtures/verdict/python-reference.json. The prompt and scoring match
src/judges/device/verdict.ts exactly; see eval/verdict/README.md.

Usage: eval/verdict/.venv/bin/python -I eval/verdict/reference.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "eval" / "verdict" / "model"
FIXTURES = ROOT / "tests" / "fixtures" / "verdict"

MODEL_REPO = "onnx-community/Qwen3.5-0.8B-Text-ONNX"
MODEL_REVISION = "25cdf33f386b487a25f3d743e86442517bdb77ff"
MODEL_FILE = "onnx/model_q4.onnx"

# Qwen3.5 chat template for one user turn with thinking disabled.
PROMPT_TEMPLATE = (
    "<|im_start|>user\n{question}<|im_end|>\n"
    "<|im_start|>assistant\n<think>\n\n</think>\n\n"
)
QUESTION_TEMPLATE = "Is this statement true? Answer with only yes or no.\n\nStatement: {claim}"
YES_TOKENS = (9405, 9175)  # "yes", "Yes"
NO_TOKENS = (2083, 2665)  # "no", "No"
MAX_TOKENS = 512

ORT_DTYPES = {"tensor(float)": np.float32, "tensor(float16)": np.float16}


def build_prompt(answer: str, claim: str) -> str:
    proposition = claim.replace("{answer}", answer)
    return PROMPT_TEMPLATE.format(question=QUESTION_TEMPLATE.format(claim=proposition))


def log_sum_exp(values: list[float]) -> float:
    top = max(values)
    return top + math.log(sum(math.exp(value - top) for value in values))


def p_true(logits: np.ndarray) -> float:
    """P("yes") among the yes and no tokens of the next-token distribution."""
    yes = log_sum_exp([float(logits[token]) for token in YES_TOKENS])
    no = log_sum_exp([float(logits[token]) for token in NO_TOKENS])
    return 1.0 / (1.0 + math.exp(no - yes))


def empty_state(session: ort.InferenceSession) -> dict[str, np.ndarray]:
    """Zeroed recurrent states and an empty key/value cache for a fresh prompt."""
    state = {}
    for model_input in session.get_inputs():
        if not model_input.name.startswith("past_"):
            continue
        shape = [1 if dim == "batch_size" else 0 if isinstance(dim, str) else dim
                 for dim in model_input.shape]
        state[model_input.name] = np.zeros(shape, dtype=ORT_DTYPES[model_input.type])
    return state


def main() -> None:
    tokenizer = Tokenizer.from_file(str(MODEL_DIR / "tokenizer.json"))
    session = ort.InferenceSession(
        str(MODEL_DIR / MODEL_FILE), providers=["CPUExecutionProvider"]
    )

    cases = json.loads((FIXTURES / "cases.json").read_text())
    results = []
    for case in cases:
        encoding = tokenizer.encode(build_prompt(case["answer"], case["claim"]), add_special_tokens=False)
        if len(encoding.ids) > MAX_TOKENS:
            raise ValueError(f"{case['id']} has {len(encoding.ids)} tokens; the limit is {MAX_TOKENS}.")
        feeds = {
            "input_ids": np.array([encoding.ids], dtype=np.int64),
            "attention_mask": np.ones((1, len(encoding.ids)), dtype=np.int64),
            "num_logits_to_keep": np.array(1, dtype=np.int64),
            **empty_state(session),
        }
        (logits,) = session.run(["logits"], feeds)
        results.append({
            "id": case["id"],
            "tokens": len(encoding.ids),
            "p": round(p_true(logits[0, -1]), 6),
        })

    output = {
        "model": {"repo": MODEL_REPO, "revision": MODEL_REVISION, "file": MODEL_FILE},
        "runtime": f"onnxruntime {ort.__version__} (CPU)",
        "results": results,
    }
    (FIXTURES / "python-reference.json").write_text(json.dumps(output, indent=2) + "\n")


if __name__ == "__main__":
    main()
