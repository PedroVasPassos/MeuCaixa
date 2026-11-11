from playwright.sync_api import sync_playwright
from pathlib import Path
p=Path(__file__).resolve().parent
html=(p/'preview.html').read_text()
css=(p.parent/'src/App.css').read_text()
html=html.replace('<link rel="stylesheet" href="../src/App.css">', f'<style>{css}</style>')
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    for theme in ['dark','light']:
        page=browser.new_page(viewport={'width':1440,'height':1020},device_scale_factor=1)
        preview = html.replace('<html lang="pt-BR">',f'<html lang="pt-BR" data-theme="{theme}">')
        if theme == 'light': preview = preview.replace('☼ <span>Claro</span>','☽ <span>Escuro</span>')
        page.set_content(preview,wait_until='load')
        page.screenshot(path=str(p/f'preview-{theme}.png'),full_page=True)
        page.close()
    browser.close()
