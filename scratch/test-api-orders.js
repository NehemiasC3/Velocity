const fetch = require('node-fetch');

async function test() {
    const baseUrl = 'https://www.cloud.wispro.co/api/v1';
    const token = '7531ec1c-b820-4959-9ae0-1b13fd9c4c1b';
    
    // Test 1: Simple fetch
    console.log('--- Test 1: Simple fetch ---');
    let res = await fetch(`${baseUrl}/order/orders?per_page=1`, {
        headers: { 'Authorization': token }
    });
    console.log('Status:', res.status);
    console.log('Body:', await res.text());

    // Test 2: With sorting
    console.log('\n--- Test 2: With sorting (q[s]=start_at+desc) ---');
    res = await fetch(`${baseUrl}/order/orders?per_page=1&q[s]=start_at+desc`, {
        headers: { 'Authorization': token }
    });
    console.log('Status:', res.status);
    console.log('Body:', await res.text());
}

test();
