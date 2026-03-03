@echo off
REM This script will remove harga-modal-firebase-adminsdk-fbsvc-9999863e3d.json from your git history and allow you to push to GitHub again.
REM 1. Download BFG Repo-Cleaner from https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar and place it in this folder.
REM 2. Run this script from your project root.

REM Remove the file from the latest commit and working tree
if exist harga-modal-firebase-adminsdk-fbsvc-9999863e3d.json (
  git rm --cached harga-modal-firebase-adminsdk-fbsvc-9999863e3d.json
)

echo harga-modal-firebase-adminsdk-fbsvc-9999863e3d.json>>.gitignore

git add .gitignore

git commit -m "Remove service account key and add to .gitignore"

REM Run BFG to remove the file from all history
java -jar bfg-1.14.0.jar --delete-files harga-modal-firebase-adminsdk-fbsvc-9999863e3d.json

git reflog expire --expire=now --all

git gc --prune=now --aggressive

echo "Now force pushing to origin..."
git push --force

echo "Done! Check your repo and revoke the old GCP key for security."
