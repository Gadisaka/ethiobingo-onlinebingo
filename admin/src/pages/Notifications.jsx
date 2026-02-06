import React from 'react';
import { Bell } from 'lucide-react';

const Notifications = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
          <p className="text-gray-500">Send and manage notifications</p>
        </div>
        <button className="px-4 py-2 bg-primary text-white rounded-lg">
          Send Notification
        </button>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Bell className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">Notification History</h3>
        <p className="text-gray-500 mt-2">Notification management will go here.</p>
      </div>
    </div>
  );
};

export default Notifications;

