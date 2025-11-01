import { NextResponse } from 'next/server';
import { updateAllProductPrices } from '@/lib/priceUpdater';

export async function POST() {
  try {
    console.log('Manually triggering price update...');
    await updateAllProductPrices();
    return NextResponse.json({ message: 'Price update triggered successfully.' });
  } catch (error) {
    console.error('Error triggering price update:', error);
    return NextResponse.json({ error: 'Failed to trigger price update.' }, { status: 500 });
  }
}
