#!/usr/bin/env bash
set -e

UPSTREAM_URL="https://github.com/anomalyco/opencode.git"
UPSTREAM_BRANCH="dev"

if ! git remote | grep -q "^upstream$"; then
    echo "add remote upstream..."
    git remote add upstream "$UPSTREAM_URL"
fi

echo "getting changes of upstream..."
git fetch upstream "$UPSTREAM_BRANCH"

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "merge upstream/$UPSTREAM_BRANCH to $CURRENT_BRANCH..."

if git merge upstream/"$UPSTREAM_BRANCH" --no-edit; then
    echo "success marge!"
    echo "update (bun install)..."
    bun install
else
    echo "erorr"
    exit 1
fi