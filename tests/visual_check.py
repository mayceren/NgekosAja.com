"""Final layout and screenshot checks against clean seed data."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width':1440,'height':900},locale='id-ID',timezone_id='Asia/Jakarta')
    page = context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto((ROOT/'index.html').as_uri())
    page.evaluate('localStorage.clear()')
    page.reload()
    page.wait_for_function('Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)')
    page.screenshot(animations='disabled', path=str(ROOT/'tests/home-desktop.png'),full_page=True)
    page.screenshot(animations='disabled', path=str(ROOT/'tests/home-1440.png'))
    for width in [1440,1024,768,600,430,390,360,320]:
        page.set_viewport_size({'width':width,'height':900 if width>760 else 844})
        page.wait_for_timeout(60)
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1'),f'Document overflow {width}'
        for selector in ['.hero h1 em','#hero-search','.hero-search button','.nav-actions']:
            bounds=page.locator(selector).bounding_box()
            assert bounds['x']>=-1 and bounds['x']+bounds['width']<=width+1,f'Clipped {selector} at {width}: {bounds}'
        if width==390:
            page.screenshot(animations='disabled', path=str(ROOT/'tests/home-mobile.png'),full_page=True)
    page.set_viewport_size({'width':1440,'height':900})
    def route(path):
        page.evaluate('(path)=>{location.hash=path}', '#/'+path)
        page.wait_for_timeout(100)
    route('marketplace')
    page.screenshot(animations='disabled', path=str(ROOT/'tests/marketplace-1440.png'))
    page.evaluate('NK.setRole("owner")')
    route('owner')
    page.screenshot(animations='disabled', path=str(ROOT/'tests/owner-desktop.png'),full_page=True)
    page.screenshot(animations='disabled', path=str(ROOT/'tests/owner-1440.png'))
    page.evaluate('NK.setRole("tenant","t1")')
    route('tenant')
    page.screenshot(animations='disabled', path=str(ROOT/'tests/tenant-desktop.png'),full_page=True)
    page.screenshot(animations='disabled', path=str(ROOT/'tests/tenant-1440.png'))
    page.locator('[data-action=pay]').first.click()
    expect(page.locator('.modal')).to_be_visible()
    page.screenshot(animations='disabled', path=str(ROOT/'tests/payment-1440.png'))
    for width in [1440,768,390,360,320]:
        page.set_viewport_size({'width':width,'height':900 if width>760 else 844})
        box=page.locator('.modal').bounding_box()
        assert box['x']>=0 and box['x']+box['width']<=width,f'Modal overflow {width}'
        assert page.locator('.modal').evaluate('(el)=>el.scrollWidth<=el.clientWidth+1'),f'Modal inner overflow {width}'
    assert not errors, errors
    print('Final visual checks passed: home 320-1440px, payment modal 320-1440px; 9 screenshots saved; no JavaScript errors.')
    browser.close()
