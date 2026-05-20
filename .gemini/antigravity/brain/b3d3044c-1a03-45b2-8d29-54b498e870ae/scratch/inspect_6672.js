const fetch = require('c:/Users/nehfu/OneDrive/Documentos/Velocity/node_modules/node-fetch');

async function test() {
    const apiKey = '7531ec1c-b820-4959-9ae0-1b13fd9c4c1b';
    const baseUrl = 'https://www.cloud.wispro.co/api/v1';

    try {
        const url = `${baseUrl}/help_desk/issues?q[sequential_id_eq]=6672`;
        const r = await fetch(url, {
            headers: { 'Authorization': apiKey, 'Accept': 'application/json' }
        });
        const cData = await r.json();
        console.log(`URL: ${url}`);
        console.log(`Status: ${r.status}`);
        if (cData.data && cData.data.length > 0) {
            const item = cData.data[0];
            console.log(`Issue fields:`, Object.keys(item));
            console.log(`client_id:`, item.client_id);
            console.log(`contract_id:`, item.contract_id);
            console.log(`public_id:`, item.public_id);
            console.log(`title:`, item.title);
            console.log(`description:`, item.description);
            console.log(`state:`, item.state);
        } else {
            console.log("No issue found with sequential_id = 6672");
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
