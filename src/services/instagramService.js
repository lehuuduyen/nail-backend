const axios = require('axios');

const IG_APP_ID = '936619743392459';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function makeHeaders(username, sessionId, extra = {}) {
  const h = {
    'User-Agent': BROWSER_UA,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    Referer: 'https://www.instagram.com/',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    ...extra,
  };
  if (sessionId) h['Cookie'] = `sessionid=${sessionId}`;
  return h;
}

/** Strategy 1: unofficial web_profile_info API */
async function fetchViaProfileApi(username, sessionId) {
  const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
  const res = await axios.get(url, {
    headers: makeHeaders(username, sessionId, {
      'x-ig-app-id': IG_APP_ID,
      Accept: '*/*',
    }),
    timeout: 20000,
  });
  const user = res.data?.data?.user;
  if (!user) throw new Error('No user data in response');
  return extractPostsFromUser(user);
}

/** Strategy 2: scrape HTML page and extract embedded JSON */
async function fetchViaHtml(username, sessionId) {
  const url = `https://www.instagram.com/${encodeURIComponent(username)}/`;
  const res = await axios.get(url, {
    headers: makeHeaders(username, sessionId),
    timeout: 25000,
  });
  const html = res.data;

  // Find JSON blobs embedded in script tags
  const matches = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  for (const [, scriptContent] of matches) {
    if (!scriptContent.includes('edge_owner_to_timeline_media')) continue;
    // Try to find the user object
    const userMatch = scriptContent.match(/"user"\s*:\s*(\{[\s\S]+?"edge_owner_to_timeline_media"[\s\S]+?\})\s*[,\}]/);
    if (userMatch) {
      try {
        // Extract as much JSON as we can
        const user = JSON.parse(userMatch[1] + '}');
        return extractPostsFromUser(user);
      } catch {
        // Try broader extraction
      }
    }
    // Try window._sharedData style
    const sharedMatch = scriptContent.match(/window\._sharedData\s*=\s*(\{[\s\S]+?\});\s*<\/script>/);
    if (sharedMatch) {
      try {
        const shared = JSON.parse(sharedMatch[1]);
        const user = shared?.entry_data?.ProfilePage?.[0]?.graphql?.user;
        if (user) return extractPostsFromUser(user);
      } catch {
        // ignore
      }
    }
  }
  throw new Error('Could not extract Instagram data from page HTML');
}

function extractPostsFromUser(user) {
  const edges = user.edge_owner_to_timeline_media?.edges || [];
  return edges
    .filter(({ node }) => !node.is_video && node.display_url)
    .map(({ node }) => ({
      instagramId: node.id,
      imageUrl: node.display_url,
      thumbnailUrl: node.thumbnail_src || node.display_url,
      caption: (node.edge_media_to_caption?.edges?.[0]?.node?.text || '').slice(0, 200),
      postUrl: `https://www.instagram.com/p/${node.shortcode}/`,
      takenAt: node.taken_at_timestamp ? new Date(node.taken_at_timestamp * 1000) : new Date(),
    }));
}

/**
 * Fetch recent image posts from a public Instagram profile.
 * Tries unofficial API first, falls back to HTML scraping.
 */
async function fetchProfilePosts(username, sessionId = null, limit = 30) {
  let lastErr;

  for (const strategy of [fetchViaProfileApi, fetchViaHtml]) {
    try {
      const posts = await strategy(username, sessionId);
      return posts.slice(0, limit);
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        throw new Error(
          'Instagram requires authentication. Add INSTAGRAM_SESSION_ID to .env ' +
            '(copy sessionid cookie from browser after logging in to instagram.com).'
        );
      }
      lastErr = err;
      // Small wait before trying next strategy
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  throw new Error(
    `Failed to fetch Instagram profile @${username}: ${lastErr?.message}. ` +
      'If rate-limited, add INSTAGRAM_SESSION_ID to .env.'
  );
}

/** Download a remote image to a buffer — storage (R2/disk) is the caller's job. */
async function downloadImageBuffer(imageUrl) {
  const res = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: {
      'User-Agent': BROWSER_UA,
      Referer: 'https://www.instagram.com/',
    },
  });
  return Buffer.from(res.data);
}

module.exports = { fetchProfilePosts, downloadImageBuffer };
