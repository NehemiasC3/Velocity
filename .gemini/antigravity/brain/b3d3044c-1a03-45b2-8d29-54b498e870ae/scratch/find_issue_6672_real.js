const fetch = require('c:/Users/nehfu/OneDrive/Documentos/Velocity/node_modules/node-fetch');

async function test() {
    const apiKey = '7531ec1c-b820-4959-9ae0-1b13fd9c4c1b';
    const baseUrl = 'https://www.cloud.wispro.co/api/v1';

    try {
        let page = 1;
        let found = false;
        // Loop pages to find the real issue 6672
        while (page <= 50) {
            const url = `${baseUrl}/help_desk/issues?per_page=100&page=${page}`;
            console.log('Searching page:', page);
            const r = await fetch(url, {
                headers: { 'Authorization': apiKey, 'Accept': 'application/json' }
            });
            const d = await r.json();
            const items = d.data || [];
            if (items.length === 0) {
                console.log("No more issues found.");
                break;
            }

            const target = items.find(i => String(i.public_id) === '6672' || String(i.public_id) === '6708');
            if (target) {
                console.log("\nFOUND REAL ISSUE:", JSON.stringify(target, null, 2));
                found = true;
                break;
            }
            page++;
        }
        if (!found) {
            console.log("Could not find issue 6672 or 6708 in the first 50 pages of general fetch.");
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
