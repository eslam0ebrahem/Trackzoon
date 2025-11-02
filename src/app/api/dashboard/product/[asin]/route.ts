import { NextResponse } from 'next/server';
import Product from '@/lib/models/Product';
import mongoose from 'mongoose';

export async function GET(request: Request, { params }: { params: Promise<{ asin: string }> }) {
  try {
    if (mongoose.connection.readyState !== 1) {
      if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not defined');
      }
      await mongoose.connect(process.env.MONGODB_URI);
    }
    const { asin } = await params;
    const product = await Product.findOne({ asin });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
