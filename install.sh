#!/bin/bash
set -e

echo "Installing ai-router..."

# Install dependencies
bun install

# Link globally
bun link

echo "Done! ai-router is now available globally."
echo "Run 'ai-router --help' to get started."
