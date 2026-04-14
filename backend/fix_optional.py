import glob
import re

directories = ["app"]
for d in directories:
    for filepath in glob.glob(d + "/**/*.py", recursive=True):
        with open(filepath, "r") as f:
            content = f.read()
        
        # strip out existing from __future__ import annotations
        content = re.sub(r'^from __future__ import annotations\n', '', content, flags=re.MULTILINE)
        content = re.sub(r'^from typing import Optional\n', '', content, flags=re.MULTILINE)
        
        # Replace type | None with Optional[type]
        content = re.sub(r'([A-Za-z0-9_]+)\s*\|\s*None', r'Optional[\1]', content)
        content = re.sub(r'None\s*\|\s*([A-Za-z0-9_]+)', r'Optional[\1]', content)
        
        # Add Optional to typing imports
        if "from typing import" in content and "Optional" not in content and "Optional[" in content:
            content = re.sub(r'from typing import (.*)', r'from typing import \1, Optional', content, count=1)
        elif "from typing import" not in content and "Optional[" in content:
            content = "from typing import Optional\n" + content
            
        content = "from __future__ import annotations\n" + content
        
        with open(filepath, "w") as f:
            f.write(content)
print("Finished fixing python scripts.")
