import os
import glob

directories = ["app/models", "app/schemas", "app/services", "app/connectors"]
for d in directories:
    for filepath in glob.glob(d + "/**/*.py", recursive=True):
        with open(filepath, "r") as f:
            content = f.read()
        if "from __future__ import annotations" not in content:
            with open(filepath, "w") as f:
                f.write("from __future__ import annotations\n" + content)
print("Added __future__ annotations to all files.")
