const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=60, s-maxage=120",
  "x-content-type-options": "nosniff"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function encodeObjectKey(key) {
  return key.split("/").map((part) => encodeURIComponent(part)).join("/");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "FilmCloudflare",
        bucket: "lol",
        time: new Date().toISOString()
      });
    }

    if (url.pathname === "/api/videos") {
      if (request.method !== "GET") {
        return json({ error: "Method not allowed" }, 405);
      }

      if (!env.MOVIES || !env.PUBLIC_R2_BASE_URL) {
        return json({ error: "R2 binding or public base URL is not configured" }, 500);
      }

      const cursor = url.searchParams.get("cursor") || undefined;
      const prefix = url.searchParams.get("prefix") || undefined;
      const limitParam = Number(url.searchParams.get("limit") || 1000);
      const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 1000, 1), 1000);

      try {
        const listed = await env.MOVIES.list({
          limit,
          cursor,
          prefix
        });

        const base = env.PUBLIC_R2_BASE_URL.replace(/\/+$/, "");
        const videos = listed.objects
          .filter((object) => /\.mp4$/i.test(object.key))
          .map((object) => {
            const name = object.key.split("/").pop() || object.key;
            const folder = object.key.includes("/")
              ? object.key.slice(0, object.key.lastIndexOf("/"))
              : "Phim lẻ";

            return {
              key: object.key,
              title: name.replace(/\.mp4$/i, ""),
              category: folder,
              size: object.size,
              uploaded: object.uploaded ? object.uploaded.toISOString() : null,
              etag: object.etag,
              url: `${base}/${encodeObjectKey(object.key)}`
            };
          });

        return json({
          videos,
          truncated: listed.truncated,
          cursor: listed.truncated ? listed.cursor : null,
          count: videos.length
        });
      } catch (error) {
        return json({
          error: "Không thể đọc danh sách video từ R2.",
          detail: error instanceof Error ? error.message : String(error)
        }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
