export default {
  // --- PARTIE 1 : LE CRON JOB (Scheduler) ---
  // S'exécute automatiquement selon l'intervalle configuré
  async scheduled(event, env, ctx) {
    const HEALTH_CHECK_URL = "https://dependent-klarika-rorymercury91-e1486cf2.koyeb.app/api/publisher/health";

    console.log(`[Cron] Lancement du check de santé à : ${new Date(event.scheduledTime).toISOString()}`);

    try {
      const response = await fetch(HEALTH_CHECK_URL, {
        method: 'GET',
        headers: {
          'User-Agent': 'Cloudflare-Worker-Cron-Monitor',
        },
      });

      if (response.ok) {
        console.log("✅ Bot Koyeb est en ligne et réveillé !");
      } else {
        console.warn(`⚠️ Le bot a répondu avec un statut : ${response.status}`);
      }
    } catch (error) {
      console.error("❌ Erreur lors du ping vers Koyeb :", error.message);
    }
  },

  // --- PARTIE 2 : LE PROXY (Fetch) ---
  // S'exécute quand ton application Tauri appelle le Worker
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Gérer les requêtes OPTIONS (preflight CORS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    // On définit l'API de Discord comme destination finale
    const targetUrl = "https://discord.com/api" + url.pathname + url.search;

    console.log(`[Proxy] ${request.method} vers : ${targetUrl}`);

    // On clone la requête pour modifier les headers si nécessaire (CORS)
    const modifiedRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'follow'
    });

    try {
      const response = await fetch(modifiedRequest);

      // On crée une nouvelle réponse pour pouvoir ajouter les headers CORS
      const newResponse = new Response(response.body, response);
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      newResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
      newResponse.headers.set("Access-Control-Allow-Headers", "*");

      return newResponse;
    } catch (error) {
      return new Response(`Erreur de proxy : ${error.message}`, {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
          "Access-Control-Allow-Headers": "*"
        }
      });
    }
  }
};
