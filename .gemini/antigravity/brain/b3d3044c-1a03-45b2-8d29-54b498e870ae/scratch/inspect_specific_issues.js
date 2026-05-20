const fetch = require('c:/Users/nehfu/OneDrive/Documentos/Velocity/node_modules/node-fetch');

async function test() {
    const apiKey = '7531ec1c-b820-4959-9ae0-1b13fd9c4c1b';
    const baseUrl = 'https://www.cloud.wispro.co/api/v1';

    try {
        const ids = [6672, 6708];
        for (const id of ids) {
            const url = `${baseUrl}/help_desk/issues?q[sequential_id_eq]=${id}`;
            const r = await fetch(url, {
                headers: { 'Authorization': apiKey, 'Accept': 'application/json' }
            });
            const cData = await r.json();
            console.log(`\nURL: ${url}`);
            console.log(`Status: ${r.status}`);
            console.log(`Response:`, JSON.stringify(cData, null, 2));
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
