import Product from '../models/Product.js';
import PDFDocument from 'pdfkit';

export const exportPdf = async (req, res) => {
    try {
        const products = await Product.find({});

        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=trackzoon_report.pdf');

        doc.pipe(res);

        doc.fontSize(20).text('Trackzoon Product Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown();

        products.forEach((p, i) => {
            doc.fontSize(14).text(`${i + 1}. ${p.name.substring(0, 50)}...`);
            doc.fontSize(10).text(`ASIN: ${p.asin} | Price: EGP ${p.currentPrice}`);
            doc.text(`URL: ${p.url}`);
            doc.moveDown();
        });

        doc.end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getRssFeed = async (req, res) => {
    try {
        const products = await Product.find({}).sort({ lastUpdated: -1 }).limit(20);

        let xml = '<?xml version="1.0" encoding="UTF-8" ?>';
        xml += '<rss version="2.0">';
        xml += '<channel>';
        xml += '<title>Trackzoon Deals</title>';
        xml += '<link>http://localhost:3000</link>';
        xml += '<description>Latest price drops and deals</description>';

        products.forEach(p => {
            xml += '<item>';
            xml += `<title>${p.name.replace(/&/g, '&amp;')}</title>`;
            xml += `<link>${p.url}</link>`;
            xml += `<description>Price: EGP ${p.currentPrice}</description>`;
            xml += `<pubDate>${new Date(p.lastUpdated).toUTCString()}</pubDate>`;
            xml += `<guid>${p.asin}</guid>`;
            xml += '</item>';
        });

        xml += '</channel>';
        xml += '</rss>';

        res.setHeader('Content-Type', 'application/xml');
        res.send(xml);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
