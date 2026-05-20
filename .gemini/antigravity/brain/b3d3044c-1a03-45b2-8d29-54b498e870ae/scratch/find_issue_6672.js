const fetch = require('c:/Users/nehfu/OneDrive/Documentos/Velocity/node_modules/node-fetch');

async function test() {
    const apiKey = '7531ec1c-b820-4959-9ae0-1b13fd9c4c1b';
    const baseUrl = 'https://www.cloud.wispro.co/api/v1';

    try {
        // Query by public_id_eq
        const url = `${baseUrl}/help_desk/issues?q[public_id_eq]=6672`;
        const r = await fetch(url, {
            headers: { 'Authorization': apiKey, 'Accept': 'application/json' }
        });
        const cData = await r.json();
        console.log(`URL: ${url}`);
        console.log(`Status: ${r.status}`);
        if (cData.data && cData.data.length > 0) {
            console.log("Found by public_id_eq:");
            console.log(JSON.stringify(cData.data[0], null, 2));
        } else {
            console.log("No issue found with q[public_id_eq]=6672");
            // Let's try searching general
            const url2 = `${baseUrl}/help_desk/issues?per_page=100`;
            const r2 = await fetch(url2, {
                headers: { 'Authorization': apiKey, 'Accept': 'application/json' }
            });
            const cData2 = await r2.json();
            const items = cData2.data || [];
            console.log(`Inspecting first 10 items from general search:`);
            items.slice(0, 10).forEach(i => {
                console.log(`  Issue #${i.public_id} (ID: ${i.id}) - Client ID: ${i.client_id}`);
            });
            const found = items.find(i => i.public_id === 6672 || i.public_id === '6672');
            if (found) {
                console.log("Found in first 100:", JSON.stringify(found, null, 2));
            }
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
