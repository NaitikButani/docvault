"""
Upload all DocVault project files to GitHub via the GitHub REST API.
Uses gh CLI token -- no git installation needed.
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import os
import base64
import json
import subprocess
import urllib.request
import urllib.error
from pathlib import Path

# ---- Get token from gh CLI ----
def get_gh_token():
    result = subprocess.run(
        ["gh", "auth", "token"],
        capture_output=True, text=True
    )
    return result.stdout.strip()

# ---- GitHub API helper ----
def github_api(method, path, token, data=None):
    url = f"https://api.github.com{path}"
    req = urllib.request.Request(url, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    if data:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(data).encode()
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read()), res.status
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return json.loads(body) if body else {}, e.code

# ---- Files to skip ----
SKIP_DIRS = {".git", "__pycache__", "uploads", ".venv", "venv", "env", "node_modules", "docvault.db"}
SKIP_EXTS = {".pyc", ".pyo", ".db", ".sqlite", ".npy"}
SKIP_FILES = {"docvault.db"}

def should_skip(path: Path) -> bool:
    for part in path.parts:
        if part in SKIP_DIRS:
            return True
    if path.suffix in SKIP_EXTS:
        return True
    if path.name in SKIP_FILES:
        return True
    return False

# ---- Main upload ----
def upload_project(project_dir: str, owner: str, repo: str, token: str):
    project_path = Path(project_dir)
    files = [f for f in project_path.rglob("*") if f.is_file()]
    
    uploaded = 0
    skipped = 0
    errors = []

    for file_path in sorted(files):
        relative = file_path.relative_to(project_path)
        
        if should_skip(relative):
            skipped += 1
            continue

        try:
            with open(file_path, "rb") as f:
                content = base64.b64encode(f.read()).decode()
        except Exception as e:
            print(f"  ⚠️  Cannot read {relative}: {e}")
            skipped += 1
            continue

        github_path = str(relative).replace("\\", "/")
        api_path = f"/repos/{owner}/{repo}/contents/{github_path}"

        data = {
            "message": f"Add {github_path}",
            "content": content,
        }

        result, status = github_api("PUT", api_path, token, data)
        
        if status in (200, 201):
            print(f"  ✅ {github_path}")
            uploaded += 1
        else:
            msg = result.get("message", "unknown error")
            print(f"  ❌ {github_path}: {msg} (status {status})")
            errors.append(github_path)

    print(f"\n{'='*50}")
    print(f"✅ Uploaded:  {uploaded} files")
    print(f"⏭️  Skipped:   {skipped} files")
    print(f"❌ Errors:    {len(errors)} files")
    if errors:
        print("Failed files:", errors)
    print(f"\n🌐 View at: https://github.com/{owner}/{repo}")
    return uploaded, errors

# ---- Update repo topics ----
def set_repo_topics(owner, repo, token):
    topics = ["python", "fastapi", "ai", "nlp", "semantic-search", 
              "document-management", "ocr", "rest-api", "sentence-transformers"]
    result, status = github_api(
        "PUT", f"/repos/{owner}/{repo}/topics", token,
        {"names": topics}
    )
    if status == 200:
        print("✅ Topics set!")
    else:
        print(f"⚠️  Could not set topics: {result.get('message', '')}")

if __name__ == "__main__":
    TOKEN = get_gh_token()
    if not TOKEN:
        print("❌ Could not get GitHub token. Make sure gh is authenticated.")
        exit(1)
    
    OWNER = "NaitikButani"
    REPO = "docvault"
    PROJECT_DIR = r"C:\Users\naiti\.gemini\antigravity\scratch\docvault"

    print(f"🚀 Uploading DocVault to github.com/{OWNER}/{REPO}\n")
    print(f"📁 Project: {PROJECT_DIR}\n")
    
    uploaded, errors = upload_project(PROJECT_DIR, OWNER, REPO, TOKEN)
    
    if uploaded > 0:
        print("\n🏷️  Setting repo topics...")
        set_repo_topics(OWNER, REPO, TOKEN)
        print("\n🎉 Done! Your project is live at:")
        print(f"   https://github.com/{OWNER}/{REPO}")
