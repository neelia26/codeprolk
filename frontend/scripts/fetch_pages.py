import urllib.request
from html.parser import HTMLParser

class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.skip = False
        self.output = []

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'noscript'):
            self.skip = True
        if tag in ('h1', 'h2', 'h3', 'h4', 'p', 'li'):
            self.output.append('\n')

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript'):
            self.skip = False

    def handle_data(self, data):
        if not self.skip:
            text = data.strip()
            if text:
                self.output.append(text + ' ')

urls = {
    'about': 'https://codeprolk.com/about-us/',
    'terms': 'https://codeprolk.com/terms-and-conditions/',
    'disclaimer': 'https://codeprolk.com/disclaimer/',
    'privacy': 'https://codeprolk.com/privacy-policy/',
}

for name, url in urls.items():
    print(f'Fetching {url}')
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    html = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', errors='ignore')
    parser = TextExtractor()
    parser.feed(html)
    text = ''.join(parser.output)
    text = ' '.join(text.split())
    with open(f'{name}-page.txt', 'w', encoding='utf-8') as f:
        f.write(text)
    print(f'Wrote {name}-page.txt')
