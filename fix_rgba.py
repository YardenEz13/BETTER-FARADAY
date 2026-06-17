import os
import re
import glob

replacements = [
    (r'rgba\(\s*0\s*,\s*255\s*,\s*136\s*,\s*(0\.\d+)\s*\)', 'var(--color-primary)'),
    (r'rgba\(\s*0\s*,\s*255\s*,\s*255\s*,\s*(0\.\d+)\s*\)', 'var(--color-accent)'),
    (r'rgba\(\s*255\s*,\s*50\s*,\s*50\s*,\s*(0\.\d+)\s*\)', 'var(--color-danger)'),
    (r'rgba\(\s*255\s*,\s*75\s*,\s*75\s*,\s*(0\.\d+)\s*\)', 'var(--color-danger)'),
    (r'rgba\(\s*239\s*,\s*68\s*,\s*68\s*,\s*(0\.\d+)\s*\)', 'var(--color-danger)'),
    (r'rgba\(\s*245\s*,\s*212\s*,\s*79\s*,\s*(0\.\d+)\s*\)', 'var(--color-warning)'),
    (r'rgba\(\s*245\s*,\s*158\s*,\s*11\s*,\s*(0\.\d+)\s*\)', 'var(--color-warning)'),
    (r'rgba\(\s*16\s*,\s*185\s*,\s*129\s*,\s*(0\.\d+)\s*\)', 'var(--color-success)'),
    (r'rgba\(\s*153\s*,\s*255\s*,\s*0\s*,\s*(0\.\d+)\s*\)', 'var(--color-secondary)'),
    (r'rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*(0\.\d+)\s*\)', 'var(--color-on-background)'),
    (r'rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(0\.\d+)\s*\)', 'var(--color-on-surface)'),
]

files = glob.glob('c:/Users/yarde/Documents/.gemini/antigravity/playground/cobalt-apollo/src/**/*.tsx', recursive=True)

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for pattern, var_name in replacements:
        def repl(m):
            opacity = float(m.group(1))
            percent = int(opacity * 100)
            return f"color-mix(in srgb, {var_name} {percent}%, transparent)"
        new_content = re.sub(pattern, repl, new_content)
    
    if new_content != content:
        with open(file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {os.path.basename(file)}")

print("Done.")
