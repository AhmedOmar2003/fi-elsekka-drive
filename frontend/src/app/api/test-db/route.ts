import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchOffers, fetchBestSellers } from '@/services/productsService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // 1. Test raw Supabase exactly as the backend sees it
    const { data: rawOffers, error: rawErr } = await supabase
      .from('products')
      .select('*')
      .eq('show_in_offers', true);

    const { data: rawBest, error: rawBestErr } = await supabase
      .from('products')
      .select('*')
      .eq('is_best_seller', true);

    // 2. Test the service functions
    const serviceOffers = await fetchOffers();
    const serviceBest = await fetchBestSellers();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      raw: {
        offersCount: rawOffers?.length || 0,
        offersError: rawErr,
        bestCount: rawBest?.length || 0,
        bestError: rawBestErr,
      },
      service: {
        offersCount: serviceOffers?.length || 0,
        bestCount: serviceBest?.length || 0,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
