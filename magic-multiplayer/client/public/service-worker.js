const CACHE_NAME = "dalas-games-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/static/js/main.chunk.js",
  "/static/js/bundle.js",
  "/static/css/main.chunk.css",
];

// Instala e faz cache dos assets principais
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {
        // Ignora erros de cache (arquivos podem não existir ainda)
      });
    })
  );
  self.skipWaiting();
});

// Ativa e limpa caches antigos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Estratégia: Network first, cache fallback
// Para o jogo multiplayer, sempre tenta a rede primeiro
self.addEventListener("fetch", (event) => {
  // Não intercepta requisições do Socket.io ou Scryfall
  const url = event.request.url;
  if (
    url.includes("socket.io") ||
    url.includes("scryfall.com") ||
    url.includes("render.com") ||
    event.request.method !== "GET"
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Salva no cache se for válido
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Se offline, tenta o cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Fallback para index.html (SPA)
          return caches.match("/index.html");
        });
      })
  );
});
