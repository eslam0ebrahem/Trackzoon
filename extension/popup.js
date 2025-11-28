document.addEventListener('DOMContentLoaded', async () => {
    const serverUrlInput = document.getElementById('serverUrl');
    const apiKeyInput = document.getElementById('apiKey');
    const statusDiv = document.getElementById('status');

    // Load saved settings
    const settings = await chrome.storage.sync.get(['serverUrl', 'apiKey']);
    if (settings.serverUrl) serverUrlInput.value = settings.serverUrl;
    if (settings.apiKey) apiKeyInput.value = settings.apiKey;

    document.getElementById('saveBtn').addEventListener('click', () => {
        const serverUrl = serverUrlInput.value.replace(/\/$/, ''); // Remove trailing slash
        const apiKey = apiKeyInput.value;

        chrome.storage.sync.set({ serverUrl, apiKey }, () => {
            statusDiv.textContent = 'Settings saved!';
            setTimeout(() => { statusDiv.textContent = ''; }, 2000);
        });
    });
});
