// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'syncProduct') {
        syncData(request.data).then(sendResponse);
        return true; // Keep channel open for async response
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

        const result = await response.json();
        return { status: 'success', result };

    } catch (error) {
        console.error('Trackzoon: Sync failed', error);
        return { status: 'error', message: error.message };
    }
}
