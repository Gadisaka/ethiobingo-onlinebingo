import React from 'react';
import { Megaphone } from 'lucide-react';

const Ads = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Ads Management</h2>
          <p className="text-gray-500">Manage advertisements and banners</p>
        </div>
        <button className="px-4 py-2 bg-primary text-white rounded-lg">
          Create Ad
        </button>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Megaphone className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">Active Ads</h3>
        <p className="text-gray-500 mt-2">Advertisement management will go here.</p>
      </div>
    </div>
  );
};

export default Ads;

