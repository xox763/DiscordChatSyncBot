import { handleRequest } from "./worker.js";

// Must re-export every DO class referenced in wrangler.toml bindings,
// even if the class itself lives in another file.
export { KeyValueStore } from "./durable-objects/kv-store.js";

export default {
    async fetch(request, env, ctx) {
        return handleRequest(request, env);
    },
};