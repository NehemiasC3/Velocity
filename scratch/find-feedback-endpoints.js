const fetch = require('node-fetch');

const API_KEY = '7531ec1c-b820-4959-9ae0-1b13fd9c4c1b';
const BASE_URL = 'https://www.cloud.wispro.co/api/v1';

async function test() {
    const candidates = [
        '/feedbacks',
        '/order_feedbacks',
        '/comments',
        '/issue_comments',
        '/help_desk/issue_comments',
        '/help_desk/comments',
        '/help_desk/feedbacks',
        '/help_desk/issue_feedbacks',
        '/help_desk/issues/feedbacks',
        '/help_desk/issues/comments'
    ];

    console.log("=== CHECKING GLOBAL ENDPOINTS ===");
    for (let c of candidates) {
        try {
            const res = await fetch(`${BASE_URL}${c}?per_page=1`, {
                headers: { 'Authorization': API_KEY, 'Accept': 'application/json' }
            });
            console.log(`Endpoint ${c} - Status: ${res.status}`);
            if (res.status !== 404) {
                const text = await res.text();
                console.log(`- Response: ${text.slice(0, 300)}`);
            }
        } catch (e) {
            console.error(`Endpoint ${c} failed:`, e.message);
        }
    }
}

test();
