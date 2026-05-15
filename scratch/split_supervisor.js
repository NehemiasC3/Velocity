const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../public/src/js/supervisor.js');
let code = fs.readFileSync(srcPath, 'utf8');

function extractFunc(searchStr) {
    const startIdx = code.indexOf(searchStr);
    if (startIdx === -1) {
        console.error("NOT FOUND: " + searchStr);
        return "";
    }
    
    let braces = 0;
    let endIdx = -1;
    let started = false;
    for (let i = startIdx; i < code.length; i++) {
        if (code[i] === '{') {
            braces++;
            started = true;
        } else if (code[i] === '}') {
            braces--;
        }
        
        if (started && braces === 0) {
            endIdx = i + 1;
            break;
        }
    }
    
    if (endIdx === -1) {
        console.error("COULD NOT FIND END OF FUNC: " + searchStr);
        return "";
    }
    
    while (endIdx < code.length && (code[endIdx] === '\r' || code[endIdx] === '\n')) {
        endIdx++;
    }
    
    const funcCode = code.substring(startIdx, endIdx);
    code = code.replace(funcCode, '');
    return funcCode;
}

function extractBlock(startStr, endStr) {
    const startIdx = code.indexOf(startStr);
    if (startIdx === -1) return "";
    const endIdx = code.indexOf(endStr, startIdx);
    if (endIdx === -1) return "";
    const block = code.substring(startIdx, endIdx + endStr.length);
    code = code.replace(block, '');
    return block;
}

// 1. STATE
const stateCode = extractBlock('// ── PALETAS', 'let apiPromise = Promise.resolve();\r\n') || extractBlock('// ── PALETAS', 'let apiPromise = Promise.resolve();\n');

// 2. API
const apiFuncs = [
    extractFunc('async function apiFetch'),
    extractFunc('async function serverSync'),
    extractFunc('async function serverPush'),
    extractFunc('async function apiPages'),
    extractFunc('function cacheGet'),
    extractFunc('function cacheSet'),
    extractFunc('function cacheClear'),
    extractFunc('function loadDynamicClients'),
    extractFunc('function saveDynamicClients'),
    extractFunc('async function loadStaticData'),
    extractFunc('async function loadTodayOrders'),
    extractFunc('async function resolveUnified'),
    extractFunc('async function loadIssues'),
    extractFunc('async function fetchMonthlyIssues')
];

// 3. UI
const uiFuncs = [
    extractFunc('function updateSystemStatus'),
    extractFunc('function debounce'),
    extractFunc('function showNotification'),
    extractFunc('function getRelativeTime'),
    extractFunc('function techColor'),
    extractFunc('function techInitials'),
    extractFunc('function isActiveTech'),
    extractFunc('function sinceBadge'),
    extractFunc('function statusBadge'),
    extractFunc('window.deleteInactiveUsers = function()'),
    extractFunc('function fmtDate'),
    extractFunc('window.switchTab = function(tab)'),
    extractFunc('function renderTab(tab)')
];

let apiCodeStr = `// Velocity API Module\n\n` + apiFuncs.filter(Boolean).join('\n\n');
// FIX PARALLEL
apiCodeStr = apiCodeStr.replace(
    /    \/\/ Si es una ruta local del servidor, no la encolamos para máxima velocidad[\s\S]*?return apiPromise = apiPromise\.catch\(\(\) => \{\}\)\.then\(executeFetch\);/,
    "    // Ejecutamos siempre en paralelo para máxima velocidad sin usar colas\n    return executeFetch();"
);

fs.writeFileSync(path.join(__dirname, '../public/src/js/core/api.js'), apiCodeStr);

const uiCodeStr = `// Velocity UI Module\n\n` + uiFuncs.filter(Boolean).join('\n\n');
fs.writeFileSync(path.join(__dirname, '../public/src/js/core/ui.js'), uiCodeStr);

// State code already saved earlier but we extracted it from supervisor to clean it up
const stateContent = `// Cargar configuración desde config.js
const CFG = typeof VELOCITY_CONFIG !== 'undefined' ? VELOCITY_CONFIG : {};

` + stateCode;
fs.writeFileSync(path.join(__dirname, '../public/src/js/core/state.js'), stateContent);

// Clean up headers
const headersToRemove = [
    '// ── SINCRONIZACIÓN CON SERVIDOR ───────────────────────────────────────────\r\n',
    '// ── CACHE ─────────────────────────────────────────────────────────────────\r\n',
    '// ── SISTEMA DE NOTIFICACIONES ─────────────────────────────────────────────\r\n',
    '// ── REPORTES MENSUALES ENGINE ─────────────────────────────────────────────\r\n',
    '// ── HELPERS ───────────────────────────────────────────────────────────────\r\n',
    '// ── NAVEGACIÓN ────────────────────────────────────────────────────────────\r\n',
    '// ── SINCRONIZACIÓN CON SERVIDOR ───────────────────────────────────────────\n',
    '// ── CACHE ─────────────────────────────────────────────────────────────────\n',
    '// ── SISTEMA DE NOTIFICACIONES ─────────────────────────────────────────────\n',
    '// ── REPORTES MENSUALES ENGINE ─────────────────────────────────────────────\n',
    '// ── HELPERS ───────────────────────────────────────────────────────────────\n',
    '// ── NAVEGACIÓN ────────────────────────────────────────────────────────────\n'
];
headersToRemove.forEach(h => {
    code = code.replace(h, '');
});

fs.writeFileSync(srcPath, code);

console.log('Clean extraction complete');
