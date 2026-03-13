import { supabase } from "@/lib/db";
import ProductsList from "@/components/ProductsList";

export const dynamic = 'force-dynamic';

interface Product {
  id: number;
  name: string;
  description: string;
  link: string;
  audience: string;
  commission: string;
}

export default async function ProductsPage() {
  if (!supabase) throw new Error('Supabase not initialized');
  const { data: products, error } = await supabase
    .from('affiliate_products')
    .select('*');
  
  if (error) {
    console.error('Error fetching products:', error);
  }
  
  return <ProductsList products={(products as Product[]) || []} />;
}
