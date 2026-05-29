#!/usr/bin/env python3
"""
Download Instagram profile images via mobile feed API.
Output: JSON array to stdout
"""
import os, sys, json, time, random
from pathlib import Path
from urllib.parse import unquote

# Load .env
env_path = Path(__file__).parent.parent.parent / '.env'
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip())

import requests

MOBILE_UA = 'Instagram 275.0.0.27.98 Android'

def make_session(session_id_raw):
    session_id = unquote(session_id_raw)
    ds_user_id = session_id.split(':')[0] if ':' in session_id else ''
    s = requests.Session()
    s.headers.update({
        'User-Agent': MOBILE_UA,
        'Accept': '*/*',
        'x-ig-app-id': '936619743392459',
    })
    s.cookies.set('sessionid', session_id, domain='.instagram.com', path='/')
    s.cookies.set('ds_user_id', ds_user_id, domain='.instagram.com', path='/')
    return s

def get_user_id(s, username):
    r = s.get(
        f'https://www.instagram.com/api/v1/users/web_profile_info/?username={username}',
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                 'Referer': f'https://www.instagram.com/{username}/'},
        timeout=20,
    )
    if r.status_code == 429:
        raise Exception('Rate limited. Wait a few minutes.')
    if r.status_code == 401:
        raise Exception('sessionid expired — get a fresh one from browser cookies.')
    r.raise_for_status()
    return r.json()['data']['user']['id']

def fetch_feed(s, user_id, limit=30):
    posts = []
    max_id = None
    while len(posts) < limit:
        params = {'count': min(12, limit - len(posts))}
        if max_id:
            params['max_id'] = max_id
        r = s.get(
            f'https://www.instagram.com/api/v1/feed/user/{user_id}/',
            params=params, timeout=20,
        )
        if r.status_code != 200:
            break
        data = r.json()
        items = data.get('items', [])
        if not items:
            break
        for item in items:
            if item.get('media_type') == 2:  # skip videos
                continue
            candidates = item.get('image_versions2', {}).get('candidates', [])
            if not candidates:
                continue
            # Largest image = first candidate
            image_url = candidates[0]['url']
            caption = ''
            try:
                caption = (item.get('caption') or {}).get('text', '')[:200]
            except Exception:
                pass
            posts.append({
                'imageUrl': image_url,
                'postUrl': f"https://www.instagram.com/p/{item.get('code', item['id'])}/",
                'caption': caption,
            })
        if not data.get('more_available'):
            break
        max_id = data.get('next_max_id')
        if not max_id:
            break
        time.sleep(0.8 + random.random() * 0.4)
    return posts[:limit]

def download_image(s, url, out_dir):
    r = s.get(url, timeout=30, stream=True)
    r.raise_for_status()
    name = f"ig-{int(time.time()*1000)}-{random.randint(1000,9999)}.jpg"
    dest = Path(out_dir) / name
    with open(dest, 'wb') as f:
        for chunk in r.iter_content(8192):
            f.write(chunk)
    return name

def main():
    username = sys.argv[1] if len(sys.argv) > 1 else None
    limit    = int(sys.argv[2]) if len(sys.argv) > 2 else 30

    session_id = os.environ.get('INSTAGRAM_SESSION_ID', '').strip()
    accounts   = os.environ.get('INSTAGRAM_ACCOUNTS', '').strip()

    if not username:
        username = accounts.split(',')[0].strip() if accounts else None
    if not username:
        print(json.dumps({'error': 'No username'}), file=sys.stderr); sys.exit(1)
    if 'instagram.com/' in username:
        username = username.rstrip('/').split('instagram.com/')[-1].split('/')[0]
    if not session_id:
        print(json.dumps({'error': 'INSTAGRAM_SESSION_ID not set'}), file=sys.stderr); sys.exit(1)

    out_dir = Path(__file__).parent.parent.parent / 'public' / 'uploads' / 'gallery'
    out_dir.mkdir(parents=True, exist_ok=True)

    s = make_session(session_id)

    # Use cached user_id if set in env, else fetch it
    user_id = os.environ.get('INSTAGRAM_USER_ID', '').strip()
    if not user_id:
        print(f'[instagram] Getting user ID for @{username}...', file=sys.stderr)
        user_id = get_user_id(s, username)
        print(f'[instagram] user_id={user_id} (set INSTAGRAM_USER_ID={user_id} in .env to skip this step)', file=sys.stderr)
    else:
        print(f'[instagram] Using cached user_id={user_id}', file=sys.stderr)

    print(f'[instagram] Fetching feed (limit {limit})...', file=sys.stderr)
    posts = fetch_feed(s, user_id, limit)
    print(f'[instagram] Found {len(posts)} image posts', file=sys.stderr)

    results = []
    for post in posts:
        try:
            fname = download_image(s, post['imageUrl'], out_dir)
            results.append({'filename': fname, 'postUrl': post['postUrl'], 'caption': post['caption']})
            print(f'[instagram] ✓ {fname}', file=sys.stderr)
            time.sleep(0.5 + random.random() * 0.5)
        except Exception as e:
            print(f'[instagram] ✗ {post["postUrl"]}: {e}', file=sys.stderr)

    print(f'[instagram] Done — {len(results)} downloaded', file=sys.stderr)
    print(json.dumps(results))

if __name__ == '__main__':
    main()
