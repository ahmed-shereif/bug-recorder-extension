#!/usr/bin/env python3
"""
Script to create placeholder icons using PIL/Pillow
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    import sys
    
    def create_icon(size, filename):
        """Create an icon with the specified size"""
        # Create image with purple background
        img = Image.new('RGB', (size, size), color='#667eea')
        draw = ImageDraw.Draw(img)
        
        # Try to use a nice font, fallback to default if not available
        try:
            # Try to use a system font
            font_size = int(size * 0.6)
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            try:
                font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", font_size)
            except:
                # Fallback to default font
                font = ImageFont.load_default()
        
        # Calculate text position (centered)
        text = "BR"
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        position = ((size - text_width) // 2, (size - text_height) // 2)
        
        # Draw white text
        draw.text(position, text, fill='white', font=font)
        
        # Save the image
        img.save(filename)
        print(f"✅ Created {filename} ({size}x{size})")
    
    # Create all three icon sizes
    print("Creating icons with PIL/Pillow...")
    create_icon(16, 'icon16.png')
    create_icon(48, 'icon48.png')
    create_icon(128, 'icon128.png')
    
    print("\n✅ All icons created successfully!")
    
except ImportError:
    print("❌ PIL/Pillow not found.")
    print("Please install it with: pip install Pillow")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error creating icons: {e}")
    sys.exit(1)


