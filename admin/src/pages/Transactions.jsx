import React from 'react';
import { ArrowRightLeft } from 'lucide-react';

const Transactions = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Transactions</h2>
          <p className="text-gray-500">View financial records</p>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <ArrowRightLeft className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">Transaction History</h3>
        <p className="text-gray-500 mt-2">Financial transactions table will go here.</p>
      </div>
    </div>
  );
};

export default Transactions;

