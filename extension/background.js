// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'syncProduct') {
        syncData(request.data).then(sendResponse);
        return true; // Keep channel open for async response
    }
    if (request.action === 'checkStatus') {
        checkStatus(request.asin).then(sendResponse);
        return true;
    }
});

async function syncData(productData) {
    try {
        // Get settings
        const settings = await chrome.storage.sync.get(['serverUrl', 'apiKey']);
        const serverUrl = settings.serverUrl || 'http://localhost:3000';
        const apiKey = settings.apiKey;

        if (!apiKey) {
            console.warn('Trackzoon: No API Key set.');
            return { status: 'error', message: 'No API Key' };
        }

        const response = await fetch(`${serverUrl}/api/v1/extension/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            },
            body: JSON.stringify(productData)
        });

        let result = null;
        try {
            result = await response.json();
        } catch (error) {
            return { status: 'error', message: 'Invalid server response' };
        }

        if (!response.ok) {
            return { status: 'error', message: result.error || 'Sync failed' };
        }

        return { status: 'success', result };

    } catch (error) {
        console.error('Trackzoon: Sync failed', error);
        return { status: 'error', message: error.message };
    }
}

async function checkStatus(asin) {
    try {
        if (!asin) {
            return { status: 'error', message: 'Missing ASIN' };
        }
        const settings = await chrome.storage.sync.get(['serverUrl', 'apiKey']);
        const serverUrl = settings.serverUrl || 'http://localhost:3000';
        const apiKey = settings.apiKey;

        if (!apiKey) {
            return { status: 'error', message: 'No API Key' };
        }

        const response = await fetch(`${serverUrl}/api/v1/extension/status?asin=${encodeURIComponent(asin)}`, {
            method: 'GET',
            headers: {
                'x-api-key': apiKey
            }
        });

        let result = null;
        try {
            result = await response.json();
        } catch (error) {
            return { status: 'error', message: 'Invalid server response' };
        }

        if (!response.ok) {
            return { status: 'error', message: result.error || 'Status check failed' };
        }

        return { status: 'success', result };
    } catch (error) {
        console.error('Trackzoon: Status check failed', error);
        return { status: 'error', message: error.message };
    }
}
