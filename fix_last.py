import os
import re

directory = "d:/siti/CASINO_finale"

correct_scroll_html = """<div class="ticker-scroll">
            <div class="ticker-track">
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
            </div>
        </div>"""

for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith(".html"):
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Cerca l'intera sezione <div class="ticker-scroll">...</div> e sostituiscila
            # Trova l'apertura e trova la chiusura corretta
            pattern = r"<div class=\"ticker-scroll\">.*?</div>\s*</div>"
            content_updated, count = re.subn(pattern, correct_scroll_html, content, flags=re.DOTALL | re.IGNORECASE)
            
            if count > 0:
                print(f"Ripulito scroll in: {filepath}")
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(content_updated)

print("Ripulitura completata!")
