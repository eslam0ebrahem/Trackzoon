import Product from '../models/Product.js';

export class ExportService {
  static async getAllProducts() {
    return Product.find({});
  }

  static buildPdfReport(doc, products) {
    doc.fontSize(20).text('Trackzoon Product Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown();

    products.forEach((product, index) => {
      const name = product.name ? product.name.substring(0, 50) : 'Unknown Product';
      doc.fontSize(14).text(`${index + 1}. ${name}${product.name && product.name.length > 50 ? '...' : ''}`);
      doc.fontSize(10).text(`ASIN: ${product.asin} | Price: EGP ${product.currentPrice}`);
      doc.text(`URL: ${product.url}`);
      doc.moveDown();
    });
  }

  static async buildRssFeed({ limit = 20, baseUrl = 'http://localhost:3000' } = {}) {
    const products = await Product.find({})
      .sort({ lastUpdated: -1 })
      .limit(limit);

    let xml = '<?xml version="1.0" encoding="UTF-8" ?>';
    xml += '<rss version="2.0">';
    xml += '<channel>';
    xml += '<title>Trackzoon Deals</title>';
    xml += `<link>${baseUrl}</link>`;
    xml += '<description>Latest price drops and deals</description>';

    products.forEach(product => {
      xml += '<item>';
      xml += `<title>${String(product.name || '').replace(/&/g, '&amp;')}</title>`;
      xml += `<link>${product.url}</link>`;
      xml += `<description>Price: EGP ${product.currentPrice}</description>`;
      xml += `<pubDate>${new Date(product.lastUpdated).toUTCString()}</pubDate>`;
      xml += `<guid>${product.asin}</guid>`;
      xml += '</item>';
    });

    xml += '</channel>';
    xml += '</rss>';

    return xml;
  }
}
