"""Fetch the fixed research artifacts only, enforcing exact sizes and SHA-256."""
from hashlib import sha256
import json
from pathlib import Path
import subprocess
from tempfile import NamedTemporaryFile

from backend.recovery_data import CACHE, DIGEST, ROOT

QASPER = "https://qasper-dataset.s3.us-west-2.amazonaws.com/qasper-train-dev-v0.3.tgz"
MODEL = "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/"


def fetch(url, path, digest, size):
    if path.is_file():
        if path.stat().st_size==size and sha256(path.read_bytes()).hexdigest()==digest:
            return
        raise ValueError(f"Unexpected existing file at {path.name}.")
    path.parent.mkdir(parents=True,exist_ok=True)
    with NamedTemporaryFile(dir=path.parent,delete=False) as tmp:
        pending=Path(tmp.name)
    try:
        subprocess.run(["curl","--fail","--location","--silent","--show-error","--proto","=https",
                        "--proto-redir","=https","--max-time","240","--max-filesize",str(max(4096,size)),
                        url,"--output",str(pending)],check=True)
        if pending.stat().st_size!=size or sha256(pending.read_bytes()).hexdigest()!=digest:
            raise ValueError("Artifact integrity check failed.")
        pending.replace(path)
    finally:
        pending.unlink(missing_ok=True)


if __name__=="__main__":
    manifest=json.loads((ROOT/"backend/data/minilm-v2.json").read_bytes())
    sizes={"1_Pooling/config.json":190,"config.json":612,"onnx/model_quint8_avx2.onnx":23046789,
           "sentence_bert_config.json":53,"tokenizer.json":466247,"tokenizer_config.json":350}
    fetch(QASPER,CACHE/"qasper.tgz",DIGEST,10835856)
    for name,size in sizes.items():
        fetch(MODEL+manifest["revision"]+"/"+name,CACHE/"minilm"/name,manifest["files"][name],size)
