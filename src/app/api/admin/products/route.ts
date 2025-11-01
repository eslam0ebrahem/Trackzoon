import { NextResponse } from 'next/server';
import Product from '@/lib/models/Product';
import mongoose from 'mongoose';
import getPrice from '@/lib/scraper/getPrice'; // Import getPrice
import getProductName from '@/lib/scraper/getProductName'; // Import getProductName

// Helper function to ensure DB connection
async function connectDb() {
  if (mongoose.connection.readyState !== 1) {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined');
    }
    await mongoose.connect(process.env.MONGODB_URI);
  }
}

export async function GET() {
  try {
    await connectDb();
    const products = await Product.find({});
    return NextResponse.json(products);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectDb();
    const { name, url, thresholdPrice } = await request.json();

    if (!url || !thresholdPrice) {
      return NextResponse.json({ error: 'URL and Threshold Price are required' }, { status: 400 });
    }

    const asinMatch = url.match(/dp\/([A-Za-z0-9]{10})/);
    if (!asinMatch) {
      return NextResponse.json({ error: 'Invalid Amazon product URL' }, { status: 400 });
    }
    const asin = asinMatch[1];

    let product = await Product.findOne({ asin });
    if (product) {
      return NextResponse.json({ error: 'Product with this ASIN already exists' }, { status: 409 });
    }

    let productName = name;
    if (!productName) {
      try {
        productName = await getProductName(url);
      } catch (err) {
        console.error("Error fetching product name:", err);
        productName = `ASIN:${asin}`;
      }
    }

    let currentPrice;
    try {
      currentPrice = await getPrice(url);
    } catch (err) {
      console.error("Error fetching initial price:", err);
      currentPrice = 0; // Default to 0 or handle as appropriate
    }

    product = new Product({
      asin,
      url,
      name: productName,
      trackedBy: [], // No users tracking initially from admin panel
      thresholdPrice: parseFloat(thresholdPrice),
      priceHistory: [{ price: currentPrice, date: new Date() }]
    });

    await product.save();

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await connectDb();
    const { asin, ...updateData } = await request.json();

    if (!asin) {
      return NextResponse.json({ error: 'ASIN is required for update' }, { status: 400 });
    }

    const updatedProduct = await Product.findOneAndUpdate({ asin }, updateData, { new: true });

    if (!updatedProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(updatedProduct);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await connectDb();
    const { asin } = await request.json();

    if (!asin) {
      return NextResponse.json({ error: 'ASIN is required for deletion' }, { status: 400 });
    }

    const deletedProduct = await Product.findOneAndDelete({ asin });

    if (!deletedProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
