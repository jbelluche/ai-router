#!/bin/bash
set -e

echo "Uninstalling ai-router..."

# Remove global link
bun unlink ai-router 2>/dev/null || bun pm rm -g ai-router 2>/dev/null || true

echo "Done! ai-router has been removed."
