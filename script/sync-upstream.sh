#!/usr/bin/env bash
set -e

UPSTREAM_URL="https://github.com/anomalyco/opencode.git"
UPSTREAM_BRANCH="dev"
WORK_BRANCH="fuck-dev"


if ! git remote | grep -q "^upstream$"; then
    echo "add remote upstream..."
    git remote add upstream "$UPSTREAM_URL"
fi


#  if some not commits
if ! git diff-index --quiet HEAD--; then
  echo "error: some uncommited changes"
  exit 1
fi


echo "getting changes of upstream/$UPSTREAM_BRANCH"
git fetch upstream "$UPSTREAM_BRANCH"



echo "updating clean local '$UPSTREAM_BRANCH'"
git checkout "$UPSTREAM_BRANCH"
git reset --hard upstream/"$UPSTREAM_BRANCH"

echo "switching to '$WORK_BRANCH' and merging"
git checkout "$WORK_BRANCH"

#
# CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
# echo "merge upstream/$UPSTREAM_BRANCH to $CURRENT_BRANCH..."

if git merge upstream/"$UPSTREAM_BRANCH" --no-edit; then
    echo "success marge!"
    echo "update (bun install)..."
    bun install
else
    echo "merge conflict"
    echo "erorr"
    echo "resolve conflicts manually, then run: git commit && bun install"
    exit 1
fi
