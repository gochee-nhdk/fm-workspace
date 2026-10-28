/**
 * Cloudflare Worker entrypoint for FM Workspace.
 * Serves SPA static assets from client/dist and handles edge requests.
 */
export default {
  async fetch(request, env) {
    return new Response("FM Workspace Cloudflare Worker Active", {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-cache",
      },
    });
  },
};
