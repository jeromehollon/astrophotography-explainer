"""Web-sized copies of the observatory photos shown in the thank-you modal.

    uv run tools/assets/thanks_photos.py

Reads source_images/thanks/*.jpg (git-ignored originals), applies the EXIF
orientation, fits each inside 1600 px and writes assets/thanks/observatory_<n>.jpg.
"""
import glob, os
from PIL import Image, ImageOps

os.makedirs('assets/thanks', exist_ok=True)
for i, f in enumerate(sorted(glob.glob('source_images/thanks/*.jpg')), 1):
    im = ImageOps.exif_transpose(Image.open(f)).convert('RGB')
    im.thumbnail((1600, 1600), Image.LANCZOS)
    out = f'assets/thanks/observatory_{i}.jpg'
    im.save(out, 'JPEG', quality=85, optimize=True, progressive=True)
    print(out, im.size)
