const state = {
  videos: [],
  cursor: null,
  hasMore: false,
  loading: false,
  filter: "all",
  query: "",
  mediaInfo: new Map()
};

const grid = document.getElementById("videoGrid");
const countEl = document.getElementById("movieCount");
const statusEl = document.getElementById("syncStatus");
const resultLabel = document.getElementById("resultLabel");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const errorPanel = document.getElementById("errorPanel");
const modal = document.getElementById("playerModal");
const player = document.getElementById("videoPlayer");
let posterObserver = null;

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return "MP4";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "—:—";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}

function safeDate(value) {
  if (!value) return "Video";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Video" : date.toLocaleDateString("vi-VN");
}

function visibleVideos() {
  let list = [...state.videos];
  if (state.filter === "recent") {
    list.sort((a, b) => new Date(b.uploaded || 0) - new Date(a.uploaded || 0));
  }
  if (state.query) {
    const q = state.query.toLocaleLowerCase();
    list = list.filter((v) => `${v.title} ${v.key} ${v.category}`.toLocaleLowerCase().includes(q));
  }
  return list;
}

function applyMediaInfo(video, card) {
  const info = state.mediaInfo.get(video.key);
  if (!info) return;
  const duration = card.querySelector(".duration-badge");
  const image = card.querySelector(".poster-image");
  if (duration) duration.textContent = formatDuration(info.duration);
  if (image && info.thumbnail) {
    image.src = info.thumbnail;
    image.hidden = false;
    card.querySelector(".poster").classList.add("has-thumbnail");
  }
}

function createPosterObserver() {
  if (posterObserver) posterObserver.disconnect();
  posterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const card = entry.target;
      posterObserver.unobserve(card);
      const video = card._filmVideo;
      if (video) loadVideoPreview(video, card);
    });
  }, { rootMargin: "260px 0px" });
}

function loadVideoPreview(videoData, card) {
  const cached = state.mediaInfo.get(videoData.key);
  if (cached) {
    applyMediaInfo(videoData, card);
    return;
  }

  const probe = document.createElement("video");
  probe.crossOrigin = "anonymous";
  probe.preload = "metadata";
  probe.muted = true;
  probe.playsInline = true;
  let saved = false;

  const saveInfo = (thumbnail = null) => {
    if (saved) return;
    saved = true;
    const info = {
      duration: Number.isFinite(probe.duration) ? probe.duration : NaN,
      thumbnail
    };
    state.mediaInfo.set(videoData.key, info);
    if (card.isConnected) applyMediaInfo(videoData, card);
    probe.removeAttribute("src");
    probe.load();
  };

  probe.addEventListener("loadedmetadata", () => {
    const duration = probe.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      saveInfo();
      return;
    }
    const seekTo = Math.min(Math.max(duration * 0.08, 0.15), 2.5, Math.max(duration - 0.05, 0));
    probe.addEventListener("seeked", () => {
      let thumbnail = null;
      try {
        const width = 480;
        const ratio = probe.videoWidth && probe.videoHeight
          ? probe.videoHeight / probe.videoWidth
          : 9 / 16;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = Math.max(1, Math.round(width * ratio));
        const context = canvas.getContext("2d");
        context.drawImage(probe, 0, 0, canvas.width, canvas.height);
        thumbnail = canvas.toDataURL("image/jpeg", 0.76);
      } catch {
        // R2 CORS may not yet allow canvas access; duration can still be shown.
      }
      saveInfo(thumbnail);
    }, { once: true });
    try {
      probe.currentTime = seekTo;
    } catch {
      saveInfo();
    }
  }, { once: true });

  probe.addEventListener("error", () => saveInfo(), { once: true });
  probe.src = videoData.url;
  probe.load();
}

function render() {
  const list = visibleVideos();
  countEl.textContent = state.videos.length.toLocaleString("vi-VN");
  resultLabel.textContent = `${list.length.toLocaleString("vi-VN")} video hiển thị`;
  loadMoreBtn.hidden = !state.hasMore || Boolean(state.query);
  createPosterObserver();
  grid.innerHTML = "";

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state">${state.videos.length ? "Không tìm thấy video phù hợp." : "Bucket hiện chưa có tệp MP4 nào."}</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  list.forEach((video) => {
    const card = document.createElement("article");
    card.className = "video-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Phát ${video.title}`);

    const poster = document.createElement("div");
    poster.className = "poster";
    const image = document.createElement("img");
    image.className = "poster-image";
    image.alt = "";
    image.loading = "lazy";
    image.hidden = true;
    const tag = document.createElement("span");
    tag.className = "poster-tag";
    tag.textContent = "MP4 · R2";
    const symbol = document.createElement("span");
    symbol.className = "poster-symbol";
    symbol.textContent = (video.title.trim()[0] || "F").toLocaleUpperCase();
    const play = document.createElement("span");
    play.className = "poster-play";
    play.textContent = "▶";
    const duration = document.createElement("span");
    duration.className = "duration-badge";
    duration.textContent = "…";
    poster.append(image, tag, symbol, play, duration);

    const info = document.createElement("div");
    info.className = "card-info";
    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = video.title;
    title.title = video.key;
    const meta = document.createElement("div");
    meta.className = "card-meta";
    const size = document.createElement("span");
    size.textContent = formatSize(video.size);
    const date = document.createElement("span");
    date.textContent = safeDate(video.uploaded);
    meta.append(size, date);
    info.append(title, meta);
    card.append(poster, info);
    card._filmVideo = video;

    const open = () => openPlayer(video);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
    fragment.append(card);
    applyMediaInfo(video, card);
    posterObserver.observe(card);
  });
  grid.append(fragment);
}

async function fetchPage(cursor = null, reset = false) {
  if (state.loading) return;
  state.loading = true;
  errorPanel.hidden = true;
  if (reset) {
    state.videos = [];
    state.cursor = null;
    state.hasMore = false;
    grid.innerHTML = `<div class="loading-card"><div class="spinner"></div><span>Đang đồng bộ video từ R2…</span></div>`;
  } else {
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = "Đang tải…";
  }

  try {
    const params = new URLSearchParams({ limit: "1000" });
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`/api/videos?${params.toString()}`, { headers: { accept: "application/json" } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || payload.error || `HTTP ${response.status}`);

    state.videos.push(...payload.videos);
    state.cursor = payload.cursor;
    state.hasMore = Boolean(payload.truncated && payload.cursor);
    statusEl.textContent = "Đã đồng bộ";
    statusEl.style.color = "#65d9a7";
    render();
  } catch (error) {
    statusEl.textContent = "Lỗi kết nối";
    statusEl.style.color = "#ff9da8";
    errorPanel.hidden = false;
    errorPanel.textContent = `Không thể tải thư viện: ${error.message}\n\nKiểm tra R2 binding MOVIES, bucket lol và Worker deployment.`;
    if (!state.videos.length) grid.innerHTML = `<div class="empty-state">Không thể kết nối thư viện R2. Vui lòng thử làm mới.</div>`;
  } finally {
    state.loading = false;
    loadMoreBtn.disabled = false;
    loadMoreBtn.innerHTML = 'Tải thêm video <span>↓</span>';
  }
}

function openPlayer(video) {
  document.getElementById("playerTitle").textContent = video.title;
  player.crossOrigin = "anonymous";
  player.src = video.url;
  document.getElementById("openOriginal").href = video.url;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  player.play().catch(() => {});
  try {
    localStorage.setItem("filmcloudflare:last-viewed", JSON.stringify({
      key: video.key, title: video.title, at: new Date().toISOString()
    }));
  } catch {}
}

function closePlayer() {
  player.pause();
  player.removeAttribute("src");
  player.load();
  modal.hidden = true;
  document.body.style.overflow = "";
}

document.getElementById("closePlayer").addEventListener("click", closePlayer);
modal.addEventListener("click", (event) => {
  if (event.target.dataset.close === "true") closePlayer();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) closePlayer();
});
document.getElementById("refreshBtn").addEventListener("click", () => fetchPage(null, true));
loadMoreBtn.addEventListener("click", () => state.cursor && fetchPage(state.cursor));
document.getElementById("searchInput").addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  render();
});
document.getElementById("filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  document.querySelectorAll(".filter").forEach((el) => el.classList.toggle("active", el === button));
  render();
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    document.getElementById("searchInput").focus();
  }
});
document.getElementById("year").textContent = new Date().getFullYear();
fetchPage(null, true);
