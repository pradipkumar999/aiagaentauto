// Products list component with Supabase integration
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Plus, Trash2, Pencil, X } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  description: string;
  link: string;
  audience: string;
  commission: string;
}

export default function ProductsPage({ products: initialProducts }: { products: Product[] }) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    link: '',
    audience: '',
    commission: ''
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = '/api/products';
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { ...formData, id: editingId } : formData;

      const response = await fetch(url, {
        method: method,
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        setIsAdding(false);
        setEditingId(null);
        setFormData({ name: '', description: '', link: '', audience: '', commission: '' });
        
        // Refresh local list
        const res = await fetch('/api/products');
        const updated = await res.json();
        if (Array.isArray(updated)) {
          setProducts(updated);
        }
        
        router.refresh();
      } else {
        const errorData = await response.json();
        alert('Error: ' + (errorData.error || 'Failed to save product'));
      }
    } catch (err) {
      alert('Failed to save product. Check console.');
      console.error(err);
    }
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setIsAdding(true);
    setFormData({
      name: product.name,
      description: product.description,
      link: product.link,
      audience: product.audience,
      commission: product.commission
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ name: '', description: '', link: '', audience: '', commission: '' });
  }

  async function deleteProduct(id: number) {
    if (confirm('Are you sure you want to delete this product?')) {
      const response = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
      if (response.ok) {
        setProducts(products.filter(p => p.id !== id));
        router.refresh();
      }
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Affiliate Products</h2>
          <p className="text-gray-600">Manage your affiliate products and links.</p>
        </div>
        <button 
          onClick={() => isAdding ? cancelEdit() : setIsAdding(true)}
          className={`flex items-center px-4 py-2 rounded-lg transition text-white ${isAdding ? 'bg-gray-500 hover:bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isAdding ? <><X className="w-4 h-4 mr-2" /> Cancel</> : <><Plus className="w-4 h-4 mr-2" /> Add Product</>}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8 max-w-2xl animate-in slide-in-from-top duration-300">
          <h3 className="text-lg font-bold text-gray-800 mb-4">{editingId ? 'Edit Product' : 'Add New Product'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Product Name</label>
              <input 
                type="text" 
                required 
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea 
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Affiliate Link</label>
                <input 
                  type="url" 
                  required 
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
                  value={formData.link}
                  onChange={e => setFormData({ ...formData, link: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Target Audience</label>
                <input 
                  type="text" 
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none"
                  value={formData.audience}
                  onChange={e => setFormData({ ...formData, audience: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Commission %</label>
              <input 
                type="text" 
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none w-32"
                value={formData.commission}
                onChange={e => setFormData({ ...formData, commission: e.target.value })}
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-bold">
              {editingId ? 'Update Product' : 'Save Product'}
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <div key={product.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col group hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div className="flex space-x-3">
                <button 
                  onClick={() => startEdit(product)}
                  className="text-blue-500 hover:text-blue-700 p-1 transition-colors"
                  title="Edit Product"
                >
                  <Pencil className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => deleteProduct(product.id)}
                  className="text-red-500 hover:text-red-700 p-1 transition-colors"
                  title="Delete Product"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{product.name}</h3>
            <p className="text-sm text-gray-500 mb-4 line-clamp-2 h-10">{product.description}</p>
            <div className="mt-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Audience:</span>
                <span className="font-medium text-gray-900">{product.audience || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Commission:</span>
                <span className="font-medium text-green-600">{product.commission}%</span>
              </div>
              <a 
                href={product.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block text-center mt-4 text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Visit Link
              </a>
            </div>
          </div>
        ))}

        {products.length === 0 && !isAdding && (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-xl border-2 border-dashed border-gray-200">
            No products added yet. Click &quot;Add Product&quot; to get started.
          </div>
        )}
      </div>
    </div>
  );
}
