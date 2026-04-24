#!/bin/bash
# QUICK-START.sh
# Run this to immediately test if your frontend is fixed
# ═════════════════════════════════════════════════════════════════════════════════╗

echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║             PingRyde Frontend - Quick Start After Fix                      ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Navigate to frontend directory
echo "📁 Step 1: Navigating to frontend directory..."
cd frontend || { echo "❌ Error: frontend directory not found"; exit 1; }
echo "✓ Current directory: $(pwd)"
echo ""

# Step 2: Clear cache
echo "🗑️  Step 2: Clearing build cache..."
echo "   • Removing .nuxt folder (if exists)..."
rm -rf .nuxt 2>/dev/null && echo "   ✓ Cleared .nuxt" || echo "   → No .nuxt to clear"
echo ""

# Step 3: Check dependencies
echo "📦 Step 3: Verifying dependencies..."
if [ -d "node_modules" ]; then
  echo "   ✓ node_modules exists"
else
  echo "   ⚠️  node_modules not found, running npm install..."
  npm install
  echo ""
fi

# Step 4: Verify config file
echo "⚙️  Step 4: Verifying nuxt.config.ts..."
if grep -q "defineNuxtConfig" nuxt.config.ts; then
  echo "   ✓ nuxt.config.ts is correct"
else
  echo "   ❌ nuxt.config.ts is broken"
  exit 1
fi

if grep -q "~/assets/css/main.css" nuxt.config.ts; then
  echo "   ✓ CSS import is configured"
else
  echo "   ⚠️  CSS import not found"
fi
echo ""

# Step 5: Start dev server
echo "🚀 Step 5: Starting dev server..."
echo "   Running: npm run dev"
echo ""
echo "   After this starts, visit:"
echo "   → http://localhost:3000"
echo ""
echo "   Look for:"
echo "   ✓ Dark background (not white)"
echo "   ✓ White text (not black)"
echo "   ✓ Teal/cyan colored title"
echo "   ✓ No console errors in DevTools"
echo ""
echo "   Press Ctrl+C to stop the server"
echo ""
echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo ""

npm run dev
