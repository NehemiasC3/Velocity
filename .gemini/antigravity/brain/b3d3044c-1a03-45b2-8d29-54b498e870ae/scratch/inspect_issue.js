const fetch = require('c:/Users/nehfu/OneDrive/Documentos/Velocity/node_modules/node-fetch');

async function test() {
    const apiKey = '7531ec1c-b820-4959-9ae0-1b13fd9c4c1b';
    const baseUrl = 'https://www.cloud.wispro.co/api/v1';

    try {
        const url = `${baseUrl}/help_desk/issues?per_page=5`;
        console.log('Fetching:', url);
        const res = await fetch(url, {
            headers: {
                'Authorization': apiKey,
                'Accept': 'application/json'
            }
        });
        const data = await res.json();
        console.log('API Response structure:');
        console.log(JSON.stringify(data.data[0], null, 2));
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
