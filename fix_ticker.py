import os
import re

directory = "d:/siti/CASINO_finale"

# Cerca tutti i file .html e .css
for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith((".html", ".css")):
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Cerca ".ticker-track {" e inserisci flex-shrink: 0; min-width: 100%; se non presenti
            state = {"modified": False}
            
            def repl(match):
                block = match.group(1)
                new_block = block
                if "flex-shrink:" not in block:
                    # Inserisci prima dell'ultima parentesi graffa
                    new_block = new_block[:-1] + " flex-shrink: 0;" + new_block[-1]
                if "min-width:" not in new_block:
                    new_block = new_block[:-1] + " min-width: 100%;" + new_block[-1]
                if new_block != block:
                    state["modified"] = True
                return new_block
            
            content_updated = re.sub(r"(\.ticker-track\s*\{[^}]*?\})", repl, content, flags=re.DOTALL)
            
            if state["modified"]:
                print(f"Modificato: {filepath}")
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(content_updated)

print("Completato!")
