module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/mongoose [external] (mongoose, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("mongoose", () => require("mongoose"));

module.exports = mod;
}),
"[project]/src/lib/models/Product.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

// src/models/Product.js
const mongoose = __turbopack_context__.r("[externals]/mongoose [external] (mongoose, cjs)");
const ProductSchema = new mongoose.Schema({
    asin: String,
    url: String,
    name: String,
    trackedBy: [
        Number
    ],
    thresholdPrice: Number,
    priceHistory: [
        {
            price: Number,
            date: Date
        }
    ]
});
module.exports = mongoose.model('Product', ProductSchema);
}),
"[externals]/node:stream [external] (node:stream, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:stream", () => require("node:stream"));

module.exports = mod;
}),
"[externals]/buffer [external] (buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("buffer", () => require("buffer"));

module.exports = mod;
}),
"[externals]/string_decoder [external] (string_decoder, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("string_decoder", () => require("string_decoder"));

module.exports = mod;
}),
"[externals]/stream [external] (stream, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("stream", () => require("stream"));

module.exports = mod;
}),
"[externals]/node:assert [external] (node:assert, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:assert", () => require("node:assert"));

module.exports = mod;
}),
"[externals]/node:net [external] (node:net, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:net", () => require("node:net"));

module.exports = mod;
}),
"[externals]/node:http [external] (node:http, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:http", () => require("node:http"));

module.exports = mod;
}),
"[externals]/node:querystring [external] (node:querystring, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:querystring", () => require("node:querystring"));

module.exports = mod;
}),
"[externals]/node:events [external] (node:events, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:events", () => require("node:events"));

module.exports = mod;
}),
"[externals]/node:diagnostics_channel [external] (node:diagnostics_channel, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:diagnostics_channel", () => require("node:diagnostics_channel"));

module.exports = mod;
}),
"[externals]/node:util [external] (node:util, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:util", () => require("node:util"));

module.exports = mod;
}),
"[externals]/node:tls [external] (node:tls, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:tls", () => require("node:tls"));

module.exports = mod;
}),
"[externals]/node:buffer [external] (node:buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:buffer", () => require("node:buffer"));

module.exports = mod;
}),
"[externals]/node:zlib [external] (node:zlib, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:zlib", () => require("node:zlib"));

module.exports = mod;
}),
"[externals]/node:perf_hooks [external] (node:perf_hooks, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:perf_hooks", () => require("node:perf_hooks"));

module.exports = mod;
}),
"[externals]/node:util/types [external] (node:util/types, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:util/types", () => require("node:util/types"));

module.exports = mod;
}),
"[externals]/node:worker_threads [external] (node:worker_threads, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:worker_threads", () => require("node:worker_threads"));

module.exports = mod;
}),
"[externals]/node:crypto [external] (node:crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:crypto", () => require("node:crypto"));

module.exports = mod;
}),
"[externals]/node:http2 [external] (node:http2, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:http2", () => require("node:http2"));

module.exports = mod;
}),
"[externals]/node:async_hooks [external] (node:async_hooks, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:async_hooks", () => require("node:async_hooks"));

module.exports = mod;
}),
"[externals]/node:console [external] (node:console, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:console", () => require("node:console"));

module.exports = mod;
}),
"[externals]/node:fs/promises [external] (node:fs/promises, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:fs/promises", () => require("node:fs/promises"));

module.exports = mod;
}),
"[externals]/node:path [external] (node:path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:path", () => require("node:path"));

module.exports = mod;
}),
"[externals]/node:timers [external] (node:timers, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:timers", () => require("node:timers"));

module.exports = mod;
}),
"[externals]/node:dns [external] (node:dns, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:dns", () => require("node:dns"));

module.exports = mod;
}),
"[project]/src/lib/scraper/getPrice.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

// src/scraper/getPrice.js
const fetch = (...args)=>__turbopack_context__.A("[project]/node_modules/node-fetch/src/index.js [app-route] (ecmascript, async loader)").then(({ default: fetch })=>fetch(...args));
const cheerio = __turbopack_context__.r("[project]/node_modules/cheerio/dist/commonjs/index.js [app-route] (ecmascript)");
async function getPrice(url) {
    const headers = {
        'User-Agent': 'Mozilla/5.0',
        'Accept-Language': 'en-US,en;q=0.9'
    };
    const response = await fetch(url, {
        headers
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    // Look for most common price selectors
    let priceText = $('#priceblock_dealprice').text() || $('#priceblock_ourprice').text() || $('.a-price .a-offscreen').first().text();
    if (!priceText) throw new Error('Price not found!');
    // Clean and convert price string
    priceText = priceText.replace(/[^\d.]/g, '');
    const price = parseFloat(priceText);
    return isNaN(price) ? null : price;
}
module.exports = getPrice;
}),
"[project]/src/lib/priceUpdater.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

const Product = __turbopack_context__.r("[project]/src/lib/models/Product.js [app-route] (ecmascript)");
const getPrice = __turbopack_context__.r("[project]/src/lib/scraper/getPrice.js [app-route] (ecmascript)");
const mongoose = __turbopack_context__.r("[externals]/mongoose [external] (mongoose, cjs)");
async function updateAllProductPrices(botInstance = null) {
    if (mongoose.connection.readyState !== 1) {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined');
        }
        await mongoose.connect(process.env.MONGODB_URI);
    }
    const products = await Product.find({});
    for (const product of products){
        try {
            const currentPrice = await getPrice(product.url);
            const previousPrice = product.priceHistory.length > 0 ? product.priceHistory.slice(-1)[0].price : null;
            product.priceHistory.push({
                price: currentPrice,
                date: new Date()
            });
            await product.save();
            // Alerting logic (only if botInstance is provided)
            if (botInstance) {
                for (const tracked of product.trackedBy){
                    // Assuming 'tracked' is an object with chatId, muteUntil, lastAlertedAt, alertType
                    // This part needs to be adapted based on the actual structure of 'trackedBy' in your Product model
                    // For now, I'll assume trackedBy contains chatIds directly, and we need to fetch user details for alertType etc.
                    // This is a simplification for now, a more robust solution would involve storing alert preferences with trackedBy
                    // Simplified alerting logic for demonstration
                    if (currentPrice <= product.thresholdPrice) {
                        // In a real scenario, you'd fetch user preferences for alerts
                        await botInstance.telegram.sendMessage(tracked, `Alert for "${product.name}" - Price is now ${currentPrice}`);
                    // Update lastAlertedAt for the specific user if needed
                    }
                }
            }
        } catch (error) {
            console.error(`Failed to check price for ${product.name}:`, error);
        }
    }
}
module.exports = {
    updateAllProductPrices
};
}),
"[project]/src/app/api/admin/trigger-price-update/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$priceUpdater$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/priceUpdater.js [app-route] (ecmascript)");
;
;
async function POST() {
    try {
        console.log('Manually triggering price update...');
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$priceUpdater$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["updateAllProductPrices"])();
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            message: 'Price update triggered successfully.'
        });
    } catch (error) {
        console.error('Error triggering price update:', error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Failed to trigger price update.'
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__50950fe3._.js.map