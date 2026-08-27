const ALLOWED_PREFIX = 'https://discord.com/api/webhooks/';

export async function handleRequest(request, env) {
    try {
        // Handle CORS preflight request
        if (request.method === 'OPTIONS') {
            return handleCORS();
        }

        // Allow only POST requests
        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ origin: 'relay', status: 'error', message: 'Method Not Allowed' }), {
                status: 405, // Method Not Allowed
                headers: getCORSHeaders('application/json'),
            });
        }

        // Parse request body from browser
        const data = await request.json();

        if (data.resetTimeId) {
            const { channelName, webhookURL } = data;
            const kvStoreName = channelName ? `#${channelName}-${webhookURL}` : webhookURL;
            const stub = env.KV_STORE.get(env.KV_STORE.idFromName(kvStoreName));
            await stub.delete('lastTimeId');
            return new Response(JSON.stringify({ origin: 'relay', status: 'success', message: `Successfully deleted last time ID for ${channelName ?? 'default channel'}` }), {
                status: 200, // OK
                headers: getCORSHeaders('application/json'),
            });
        }

        // Simple validation for required fields
        if (data.username == null || data.content == null || data.webhookURL == null) {
            return new Response(JSON.stringify({ origin: 'relay', status: 'error', message: 'Invalid message data' }), {
                status: 400, // Bad Request
                headers: getCORSHeaders('application/json'),
            });
        }

        const { userId, timeId, channelName, webhookURL, ...discordPayload } = data;

        if (!webhookURL.toLowerCase().startsWith(ALLOWED_PREFIX)) {
            return new Response(
                JSON.stringify({ origin: 'relay', status: 'error', message: 'Invalid webhook URL' }),
                {
                    status: 400, // Bad Request
                    headers: getCORSHeaders('application/json'),
                }
            );
        }

        const kvStoreName = channelName ? `#${channelName}-${webhookURL}` : webhookURL;
        const stub = env.KV_STORE.get(env.KV_STORE.idFromName(kvStoreName));
        const lastTimeId = await stub.get('lastTimeId');
        if (lastTimeId) {
            if (timeId) {
                if (timeId.ctime < lastTimeId.ctime || timeId.id <= lastTimeId.id) {
                    return new Response(JSON.stringify({ origin: 'relay', status: 'success', message: 'Old message data received and ignored' }), {
                        status: 200, // OK
                        headers: getCORSHeaders('application/json'),
                    });
                }
            }
        }

        if (timeId) {
            await stub.set('lastTimeId', timeId);
            discordPayload.content = `${discordPayload.content} <t:${timeId.ctime}:R>`;
        }
        if (channelName) {
            discordPayload.username = `[#${channelName}] ${discordPayload.username}`;
        }

        // Send payload to Discord Webhook
        const discordResponse = await fetch(data.webhookURL, {
            method: 'POST',
            headers: {
                // 'Authorization': `Bot ${env.BOT_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(discordPayload),
        });

        const responseBody = await discordResponse.arrayBuffer();
        const contentType = discordResponse.headers.get('content-type') || 'application/json';

        return new Response(responseBody, {
            status: discordResponse.status,
            headers: getCORSHeaders(contentType),
        });
    } catch (error) {
        return new Response(JSON.stringify({ origin: 'relay', status: 'error', message: 'Relay Worker Internal Error', details: error.message }), {
            status: 500,
            headers: getCORSHeaders('application/json'),
        });
    }
}

// Return CORS headers to allow browser requests
function getCORSHeaders(contentType = 'text/plain') {
    return {
        'Access-Control-Allow-Origin': '*', // Replace '*' with your specific domain in production
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': contentType,
    };
}

// Handle CORS preflight options request
function handleCORS() {
    return new Response(null, {
        status: 204,
        headers: getCORSHeaders(),
    });
}