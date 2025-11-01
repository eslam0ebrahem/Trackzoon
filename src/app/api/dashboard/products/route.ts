import { NextResponse } from 'next/server';
import Product from '@/lib/models/Product';
import mongoose from 'mongoose';

export async function GET() {
  try {
    if (mongoose.connection.readyState !== 1) {
      if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not defined');
      }
      await mongoose.connect(process.env.MONGODB_URI);
    }
    const products = await Product.find({});
    return NextResponse.json(products);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
