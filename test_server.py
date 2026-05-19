import urllib.request
import re

url = "http://localhost/casino-webapp-main-finale/html/index.html"
try:
    response = urllib.request.urlopen(url)
    html = response.read().decode('utf-8')
    
    # Trova la sezione ticker
    ticker_match = re.search(r'<footer class="ticker">.*?</footer>', html, re.DOTALL | re.IGNORECASE)
    if ticker_match:
        print("=== SEZIONE TICKER TROVATA ===")
        print(ticker_match.group(0))
    else:
        print("Sezione ticker NON trovata.")
except Exception as e:
    print(f"Errore durante il caricamento di {url}: {e}")
