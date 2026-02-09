const DEFAULT_SETTINGS = {
    serverUrl: '',
    apiKey: '',
    autoSync: true,
    showTrackButton: true,
    syncCooldownMinutes: 30
};

let currentProduct = null;

document.addEventListener('DOMContentLoaded', async () => {
    const serverUrlInput = document.getElementById('serverUrl');
    const apiKeyInput = document.getElementById('apiKey');
    const autoSyncInput = document.getElementById('autoSync');
    const showTrackButtonInput = document.getElementById('showTrackButton');
    const syncCooldownInput = document.getElementById('syncCooldown');
    const statusDiv = document.getElementById('status');
    const pageStatus = document.getElementById('pageStatus');
    const productCard = document.getElementById('productCard');
    const productTitle = document.getElementById('productTitle');
    const productAsin = document.getElementById('productAsin');
    const productPrice = document.getElementById('productPrice');
    const productStock = document.getElementById('productStock');
    const lastSync = document.getElementById('lastSync');
    const syncNowBtn = document.getElementById('syncNowBtn');
    const trackBtn = document.getElementById('trackBtn');
    const copyAsinBtn = document.getElementById('copyAsinBtn');
    const refreshBtn = document.getElementById('refreshBtn');

    function setStatus(message, isError = false) {
        statusDiv.textContent = message || '';
        statusDiv.classList.toggle('error', isError);
        if (message) {
            setTimeout(() => {
                if (statusDiv.textContent === message) {
                    statusDiv.textContent = '';
                    statusDiv.classList.remove('error');
                }
            }, 2500);
        }
    }

    function formatPrice(price) {
        if (price === null || price === undefined || Number.isNaN(price)) return '—';
        return `EGP ${Number(price).toFixed(2)}`;
    }

    async function saveSettings(showFeedback = true) {
        const serverUrl = serverUrlInput.value.trim().replace(/\/$/, '');
        const apiKey = apiKeyInput.value.trim();
        const autoSync = Boolean(autoSyncInput.checked);
        const showTrackButton = Boolean(showTrackButtonInput.checked);
        const syncCooldownMinutes = Math.max(1, Number(syncCooldownInput.value) || DEFAULT_SETTINGS.syncCooldownMinutes);

        await chrome.storage.sync.set({ serverUrl, apiKey, autoSync, showTrackButton, syncCooldownMinutes });
        if (showFeedback) {
            setStatus('Settings saved');
        }
    }

    async function loadSettings() {
        const stored = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
        const settings = { ...DEFAULT_SETTINGS, ...stored };
        serverUrlInput.value = settings.serverUrl || '';
        apiKeyInput.value = settings.apiKey || '';
        autoSyncInput.checked = Boolean(settings.autoSync);
        showTrackButtonInput.checked = Boolean(settings.showTrackButton);
        syncCooldownInput.value = settings.syncCooldownMinutes || DEFAULT_SETTINGS.syncCooldownMinutes;
    }

    async function loadLastSync(asin) {
        if (!asin) {
            lastSync.textContent = '';
            return;
        }
        const stored = await chrome.storage.local.get(['lastSyncByAsin']);
        const entry = stored.lastSyncByAsin ? stored.lastSyncByAsin[asin] : null;
        if (!entry) {
            lastSync.textContent = '';
            return;
        }
        const time = new Date(entry.timestamp).toLocaleString();
        const details = entry.smartScore !== undefined ? ` | Smart ${entry.smartScore}` : '';
        lastSync.textContent = `Last sync: ${time} (${entry.status || 'ok'}${details})`;
    }

    async function fetchCurrentPage() {
        pageStatus.textContent = 'Reading page...';
        productCard.classList.add('hidden');
        currentProduct = null;

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
            pageStatus.textContent = 'No active tab found.';
            return;
        }

        chrome.tabs.sendMessage(tab.id, { action: 'getProductData' }, async (response) => {
            if (chrome.runtime.lastError || !response || !response.data) {
                pageStatus.textContent = 'Open an Amazon.eg product page.';
                return;
            }

            currentProduct = response.data;
            pageStatus.textContent = '';
            productCard.classList.remove('hidden');

            productTitle.textContent = currentProduct.name || 'Unknown Product';
            productAsin.textContent = currentProduct.asin || '—';
            productPrice.textContent = formatPrice(currentProduct.price);
            productStock.textContent = currentProduct.isOutOfStock ? 'Out of stock' : 'In stock';

            await loadLastSync(currentProduct.asin);
        });
    }

    async function storeLastSync(asin, entry) {
        if (!asin) return;
        const stored = await chrome.storage.local.get(['lastSyncByAsin']);
        const lastSyncByAsin = stored.lastSyncByAsin || {};
        lastSyncByAsin[asin] = entry;
        await chrome.storage.local.set({ lastSyncByAsin });
    }

    async function sendSync(create = false) {
        if (!currentProduct || !currentProduct.asin) {
            setStatus('No product found', true);
            return;
        }
        syncNowBtn.disabled = true;
        trackBtn.disabled = true;
        setStatus('Syncing...');

        chrome.runtime.sendMessage(
            { action: 'syncProduct', data: { ...currentProduct, create } },
            async (response) => {
                syncNowBtn.disabled = false;
                trackBtn.disabled = false;

                if (!response) {
                    setStatus('No response from background', true);
                    return;
                }
                if (response.status === 'error') {
                    setStatus(response.message || 'Sync failed', true);
                    return;
                }

                const result = response.result || {};
                const status = result.status || 'ok';
                const smartScore = result.product ? result.product.smartScore : undefined;

                await storeLastSync(currentProduct.asin, {
                    timestamp: Date.now(),
                    status,
                    price: currentProduct.price,
                    smartScore
                });
                await loadLastSync(currentProduct.asin);

                if (status === 'created') {
                    setStatus('Tracking enabled');
                } else if (status === 'updated') {
                    setStatus('Price synced');
                } else if (status === 'new_product') {
                    setStatus('Needs tracking approval', true);
                } else {
                    setStatus('Sync complete');
                }
            }
        );
    }

    document.getElementById('saveBtn').addEventListener('click', () => saveSettings(true));
    autoSyncInput.addEventListener('change', () => saveSettings(false));
    showTrackButtonInput.addEventListener('change', () => saveSettings(false));
    syncCooldownInput.addEventListener('change', () => saveSettings(false));
    refreshBtn.addEventListener('click', fetchCurrentPage);

    syncNowBtn.addEventListener('click', () => sendSync(false));
    trackBtn.addEventListener('click', () => sendSync(true));

    copyAsinBtn.addEventListener('click', async () => {
        if (!currentProduct || !currentProduct.asin) {
            setStatus('No ASIN found', true);
            return;
        }
        try {
            await navigator.clipboard.writeText(currentProduct.asin);
            setStatus('ASIN copied');
        } catch (error) {
            setStatus('Copy failed', true);
        }
    });

    await loadSettings();
    await fetchCurrentPage();
});
