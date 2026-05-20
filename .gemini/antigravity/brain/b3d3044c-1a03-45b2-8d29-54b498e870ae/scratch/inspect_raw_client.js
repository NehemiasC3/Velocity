const fetch = require('c:/Users/nehfu/OneDrive/Documentos/Velocity/node_modules/node-fetch');

async function test() {
    const apiKey = '7531ec1c-b820-4959-9ae0-1b13fd9c4c1b';
    const baseUrl = 'https://www.cloud.wispro.co/api/v1';

    try {
        const cid = '496888a4-c9a4-4563-8bf1-7f816124726c';
        const url = `${baseUrl}/clients/${cid}`;
        const r = await fetch(url, {
            headers: { 'Authorization': apiKey, 'Accept': 'application/json' }
        });
        const cData = await r.json();
        console.log(`URL: ${url}`);
        console.log(`Status: ${r.status}`);
        console.log(`Body:`, JSON.stringify(cData, null, 2));
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
