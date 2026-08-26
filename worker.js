export default {
    async fetch(request, env, ctx) {
        // Handle CORS preflight request
        if (request.method === 'OPTIONS') {
            return handleCORS();
        }

        // Allow only POST requests
        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ origin: 'relay', error: 'Method Not Allowed' }), {
                status: 405, // Method Not Allowed
                headers: getCORSHeaders('application/json'),
            });
        }

        try {
            // Parse request body from browser
            const data = await request.json();

            // Simple validation for required fields
            if (data.username == null || data.content == null || data.webhookURL == null) {
                return new Response(JSON.stringify({ origin: 'relay', error: 'Invalid message data' }), {
                    status: 400, // Bad Request
                    headers: getCORSHeaders('application/json'),
                });
            }

            const { userId, timestamp, webhookURL, ...discordPayload } = data;

            if (timestamp) {
                if (Math.abs(Date.now() - timestamp) > 5000) {
                    discordPayload.content = `${discordPayload.content} <t:${Math.floor(timestamp/1000)}:R>`;
                }
            }

            // Construct Discord Embed Payload
            // const discordPayload = {
            //     username: 'Chat Forwarder Bot',
            //     embeds: [
            //         {
            //             title: data.title,
            //             description: data.message,
            //             color: 3447003, // Blue color code
            //             fields: data.fields || [],
            //             timestamp: new Date().toISOString(),
            //         },
            //     ],
            // };

            // Send payload to Discord Webhook
            const discordResponse = await fetch(data.webhookURL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bot ${env.BOT_TOKEN}`,
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
            return new Response(JSON.stringify({ origin: 'relay', error: 'Relay Worker Internal Error', details: error.message }), {
                status: 500,
                headers: getCORSHeaders('application/json'),
            });
        }
    },
};

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