"""Reproduce the Pi SDK archive with only its vulnerable dependency lock fixed."""
import base64
import copy
import gzip
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parent.parent
SDK = "@earendil-works/pi-coding-agent"
SDK_VERSION = "0.99.1"
BRACE_VERSION = "5.0.12"
OUTPUT = ROOT / "vendor/pi-coding-agent-0.99.1-security.1.tgz"


def npm_json(*arguments):
    result = subprocess.run(
        ["npm", *arguments, "--json"], cwd=ROOT, check=True,
        capture_output=True, text=True,
    )
    return json.loads(result.stdout)


def integrity(data):
    return "sha512-" + base64.b64encode(hashlib.sha512(data).digest()).decode()


def main():
    cache = ROOT / "tmp/pi-sdk-security"
    cache.mkdir(parents=True, exist_ok=True)
    upstream = npm_json("view", f"{SDK}@{SDK_VERSION}", "dist")
    brace = npm_json(
        "view", f"brace-expansion@{BRACE_VERSION}",
        "version", "dist", "dependencies", "engines", "license",
    )
    packed = npm_json(
        "pack", f"{SDK}@{SDK_VERSION}", "--ignore-scripts",
        "--pack-destination", str(cache),
    )[0]
    original = (cache / packed["filename"]).read_bytes()
    if integrity(original) != upstream["integrity"]:
        raise RuntimeError("Published SDK integrity mismatch")
    output = io.BytesIO()
    changed = []
    with tarfile.open(fileobj=io.BytesIO(original), mode="r:gz") as source:
        with gzip.GzipFile(fileobj=output, mode="wb", filename="", mtime=0) as zipped:
            with tarfile.open(fileobj=zipped, mode="w", format=tarfile.PAX_FORMAT) as target:
                for member in source.getmembers():
                    path = PurePosixPath(member.name)
                    if path.is_absolute() or ".." in path.parts or path.parts[0] != "package":
                        raise RuntimeError("Unexpected archive path")
                    if not member.isfile() and not member.isdir():
                        raise RuntimeError("Unexpected link or special file in SDK archive")
                    data = source.extractfile(member).read() if member.isfile() else b""
                    if member.name == "package/npm-shrinkwrap.json":
                        lock = json.loads(data)
                        entry = lock["packages"]["node_modules/brace-expansion"]
                        if entry["version"] != "5.0.9":
                            raise RuntimeError("Upstream lock changed; inspect before regenerating")
                        entry.update(
                            version=BRACE_VERSION,
                            resolved=brace["dist"]["tarball"],
                            integrity=brace["dist"]["integrity"],
                            dependencies=brace["dependencies"],
                            engines=brace["engines"],
                            license=brace["license"],
                        )
                        data = (json.dumps(lock, indent=2, ensure_ascii=False) + "\n").encode()
                        changed.append(member.name)
                    info = copy.copy(member)
                    info.uid = info.gid = 0
                    info.uname = info.gname = ""
                    info.mtime = 0
                    info.pax_headers = {}
                    info.size = len(data)
                    target.addfile(info, io.BytesIO(data) if member.isfile() else None)
    if changed != ["package/npm-shrinkwrap.json"]:
        raise RuntimeError("Expected exactly the SDK dependency-lock patch")
    artifact = output.getvalue()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(artifact)
    record = {
        "upstream": {
            "package": SDK, "version": SDK_VERSION,
            "tarball": upstream["tarball"], "integrity": upstream["integrity"],
        },
        "patch": {
            "file": "npm-shrinkwrap.json",
            "packagePath": "node_modules/brace-expansion",
            "from": "5.0.9", "to": BRACE_VERSION,
            "tarball": brace["dist"]["tarball"],
            "integrity": brace["dist"]["integrity"],
        },
        "artifact": {
            "path": OUTPUT.relative_to(ROOT).as_posix(),
            "sha256": hashlib.sha256(artifact).hexdigest(),
            "integrity": integrity(artifact),
        },
        "unchanged": "All SDK source, compiled assets, package version and licenses",
        "reproduce": "python3 scripts/vendor-pi-sdk.py",
    }
    (OUTPUT.parent / "pi-sdk-security.json").write_text(
        json.dumps(record, indent=2) + "\n"
    )
    print(json.dumps(record))


if __name__ == "__main__":
    main()
