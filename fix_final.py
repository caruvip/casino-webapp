import os
import re

directory = "d:/siti/CASINO_finale"

# Standard premium ticker contents (duplicated once for infinite seamless scrolling)
standard_ticker_html = """<div class="ticker-track">
            <div class="ticker-item">⭐ <span class="winner">@LuckyMax</span> ha vinto <strong>€1.200</strong> su Lightning Roulette</div>
            <div class="ticker-item">🔥 <span class="winner">@StarGamer99</span> ha vinto <strong>€3.500</strong> su Fortune 777</div>
            <div class="ticker-item">💎 <span class="winner">@ProPlayer</span> ha vinto <strong>€850</strong> su Blackjack Classico</div>
            <div class="ticker-item">🚀 <span class="winner">@CryptoKing</span> ha vinto <strong>€2.100</strong> su Rocket Crash</div>
            <div class="ticker-item">🎰 <span class="winner">@NightOwl</span> ha vinto <strong>€620</strong> su Diamond Slots</div>
            <div class="ticker-item">⭐ <span class="winner">@LuckyMax</span> ha vinto <strong>€1.200</strong> su Lightning Roulette</div>
            <div class="ticker-item">🔥 <span class="winner">@StarGamer99</span> ha vinto <strong>€3.500</strong> su Fortune 777</div>
            <div class="ticker-item">💎 <span class="winner">@ProPlayer</span> ha vinto <strong>€850</strong> su Blackjack Classico</div>
            <div class="ticker-item">🚀 <span class="winner">@CryptoKing</span> ha vinto <strong>€2.100</strong> su Rocket Crash</div>
            <div class="ticker-item">🎰 <span class="winner">@NightOwl</span> ha vinto <strong>€620</strong> su Diamond Slots</div>
        </div>"""

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith((".html", ".css")):
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            
            modified = False
            
            # 1. Update CSS blocks for .ticker-track
            # Replace 'min-width: 100%;' with 'width: max-content;' inside .ticker-track definition
            pattern_css = r"(\.ticker-track\s*\{[^}]*?\})"
            
            def repl_css(match):
                block = match.group(1)
                new_block = block
                if "min-width: 100%;" in new_block:
                    new_block = new_block.replace("min-width: 100%;", "width: max-content;")
                elif "min-width:" not in new_block and "width:" not in new_block:
                    new_block = new_block[:-1] + " width: max-content;" + new_block[-1]
                
                # Make sure flex-shrink: 0 is there
                if "flex-shrink: 0;" not in new_block:
                    new_block = new_block[:-1] + " flex-shrink: 0;" + new_block[-1]
                
                return new_block
            
            content_updated = re.sub(pattern_css, repl_css, content, flags=re.DOTALL)
            if content_updated != content:
                content = content_updated
                modified = True
            
            # 2. Update HTML ticker track content (only for HTML files)
            if file.endswith(".html"):
                # Find <div class="ticker-track">...</div> (case insensitive, dotall)
                pattern_html = r"<div class=\"ticker-track\">.*?</div>"
                content_updated, count = re.subn(pattern_html, standard_ticker_html, content, flags=re.DOTALL | re.IGNORECASE)
                if count > 0:
                    content = content_updated
                    modified = True
            
            if modified:
                print(f"Modificato con successo: {filepath}")
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(content)

print("Aggiornamento completo!")
