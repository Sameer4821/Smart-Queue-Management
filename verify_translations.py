import re
import os

langs = ["en", "hi", "mr", "ta", "te", "bn"]
keys_by_lang = {}

for lang in langs:
    path = os.path.join("src", "translations", f"{lang}.js")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    # Match any word characters followed by optional spaces and colon at line start or after space
    # excluding outer export syntax
    lines = content.split('\n')
    keys = []
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("export const") or stripped == "};" or stripped.startswith("//"):
            continue
        match = re.match(r'^([a-zA-Z0-9_]+)\s*:', stripped)
        if match:
            keys.append(match.group(1))
    keys_by_lang[lang] = set(keys)

print("Key counts:")
for lang, kset in keys_by_lang.items():
    print(f"  {lang}: {len(kset)} keys")

all_keys = keys_by_lang["en"]
has_mismatch = False
for lang in langs[1:]:
    diff1 = all_keys - keys_by_lang[lang]
    diff2 = keys_by_lang[lang] - all_keys
    if diff1:
        print(f"🚨 Keys in 'en' but missing in '{lang}': {diff1}")
        has_mismatch = True
    if diff2:
        print(f"🚨 Keys in '{lang}' but missing in 'en': {diff2}")
        has_mismatch = True

if not has_mismatch:
    print("✅ All translation files have matching keys!")
else:
    print("❌ Translation keys mismatch found!")
    exit(1)
