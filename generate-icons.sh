#!/bin/bash

# Simple script to create placeholder icons using ImageMagick
# If ImageMagick is not installed, follow INSTALLATION.md for alternatives

if command -v convert &> /dev/null; then
    echo "Creating icons with ImageMagick..."
    
    # Create 16x16 icon
    convert -size 16x16 xc:#667eea -fill white -pointsize 10 -gravity center -annotate +0+0 "BR" icon16.png
    
    # Create 48x48 icon
    convert -size 48x48 xc:#667eea -fill white -pointsize 30 -gravity center -annotate +0+0 "BR" icon48.png
    
    # Create 128x128 icon
    convert -size 128x128 xc:#667eea -fill white -pointsize 80 -gravity center -annotate +0+0 "BR" icon128.png
    
    echo "✅ Icons created successfully!"
else
    echo "❌ ImageMagick not found."
    echo "Please follow INSTALLATION.md to create icons manually."
    echo ""
    echo "Quick option: Visit https://www.favicon-generator.org/"
fi
