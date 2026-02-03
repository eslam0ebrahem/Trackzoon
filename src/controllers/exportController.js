import PDFDocument from 'pdfkit';
import { ExportService } from '../services/exportService.js';

export const exportPdf = async (req, res) => {
    try {
        const products = await ExportService.getAllProducts();

        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=trackzoon_report.pdf');

        doc.pipe(res);

        ExportService.buildPdfReport(doc, products);
        doc.end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getRssFeed = async (req, res) => {
    try {
        const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
        const xml = await ExportService.buildRssFeed({ baseUrl });

        res.setHeader('Content-Type', 'application/xml');
        res.send(xml);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
