import os

html_dir = r'c:\Users\RI.ROSSI\Desktop\CASINO_finale\html'
temp_dir = r'c:\Users\RI.ROSSI\Desktop\CASINO_finale\temp_styles'
os.makedirs(temp_dir, exist_ok=True)

files = ['chi-siamo.html', 'contatti.html', 'giochi.html', 'poker.html', 'promozioni.html', 'roulette.html', 'slot.html', 'user.html']

for f in files:
    path = os.path.join(html_dir, f)
    if not os.path.exists(path):
        continue
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    start = content.find('<style>')
    end = content.find('</style>')
    
    if start != -1 and end != -1:
        style_content = content[start+7:end]
        
        # Write extracted CSS to temp file
        temp_path = os.path.join(temp_dir, f.replace('.html', '.css'))
        with open(temp_path, 'w', encoding='utf-8') as temp_file:
            temp_file.write(style_content)
            
        # Remove <style>...</style> block from HTML
        new_content = content[:start] + content[end+8:]
        
        # Ensure we have a link to the page specific css
        css_name = f.replace('.html', '.css')
        link_tag = f'<link rel="stylesheet" href="../styles/{css_name}">'
        
        # If the HTML doesn't already link to this specific css file, insert it after layout.css
        if css_name in ['chi-siamo.css', 'giochi.css', 'user.css', 'contatti.css', 'promozioni.css']:
             if link_tag not in new_content:
                  layout_link = '<link rel="stylesheet" href="../styles/layout.css">'
                  new_content = new_content.replace(layout_link, layout_link + '\n    ' + link_tag)
        
        with open(path, 'w', encoding='utf-8') as file:
            file.write(new_content)
            
        print(f'Processed {f}, extracted CSS saved to temp_styles/{css_name}')
