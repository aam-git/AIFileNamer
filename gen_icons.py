from PIL import Image, ImageDraw

def create_dot_icon(filename, color):
    # Create a 32x32 transparent image
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw a circle in the center
    # Bounding box for the circle
    box = [4, 4, 28, 28]
    
    # Draw the main circle
    draw.ellipse(box, fill=color, outline=(255, 255, 255, 255), width=2)
    
    # Save the image
    img.save(filename)

# Red dot for idle/not running
create_dot_icon("public/favicon_red_180x180.png", (244, 63, 94, 255)) # Rose 500

# Green dot for scanning
create_dot_icon("public/favicon_green_180x180.png", (16, 185, 129, 255)) # Emerald 500

print("Icons generated!")
