import db from "@/lib/db";
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
  const products = db.prepare("SELECT * FROM affiliate_products").all() as Product[];
  
  return <ProductsList products={products} />;
}
