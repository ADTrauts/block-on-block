/**
 * Pin Icon Options Comparison
 * 
 * This file demonstrates all available pin icon options from lucide-react
 * Use this as a reference to choose the best pin icon for your design
 */

import React from 'react';
import { 
  Pin,           // Standard push pin (recommended for "pinning" items)
  MapPin,        // Location pin (currently used, but more for maps)
  MapPinOff,     // Disabled location pin
  Paperclip,     // Paperclip (alternative for "attaching/pinning")
  Bookmark,      // Bookmark (alternative for saving/pinning)
  Tag            // Tag (alternative for marking/pinning)
} from 'lucide-react';

export const PinIconOptions = () => {
  const icons = [
    { name: 'Pin', component: Pin, description: 'Standard push pin - best for "pinning" items' },
    { name: 'MapPin', component: MapPin, description: 'Location pin - currently used, but more map-oriented' },
    { name: 'MapPinOff', component: MapPinOff, description: 'Disabled location pin' },
    { name: 'Paperclip', component: Paperclip, description: 'Paperclip - alternative for attaching' },
    { name: 'Bookmark', component: Bookmark, description: 'Bookmark - alternative for saving/favoriting' },
    { name: 'Tag', component: Tag, description: 'Tag - alternative for marking/categorizing' },
  ];

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold mb-6">Pin Icon Options</h1>
      
      {icons.map(({ name, component: Icon, description }) => (
        <div key={name} className="border rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold">{name}</h2>
          <p className="text-gray-600">{description}</p>
          
          <div className="grid grid-cols-4 gap-4">
            {/* Unpinned state - wireframe */}
            <div className="flex flex-col items-center space-y-2">
              <div className="p-4 bg-gray-50 rounded-lg">
                <Icon className="w-6 h-6 text-gray-400" />
              </div>
              <span className="text-xs text-gray-500">Unpinned (outline)</span>
            </div>
            
            {/* Pinned state - filled */}
            <div className="flex flex-col items-center space-y-2">
              <div className="p-4 bg-gray-50 rounded-lg">
                <Icon className="w-6 h-6 text-yellow-500 fill-current" />
              </div>
              <span className="text-xs text-gray-500">Pinned (filled)</span>
            </div>
            
            {/* Small size - unpinned */}
            <div className="flex flex-col items-center space-y-2">
              <div className="p-4 bg-gray-50 rounded-lg">
                <Icon className="w-4 h-4 text-gray-400" />
              </div>
              <span className="text-xs text-gray-500">Small (outline)</span>
            </div>
            
            {/* Small size - pinned */}
            <div className="flex flex-col items-center space-y-2">
              <div className="p-4 bg-gray-50 rounded-lg">
                <Icon className="w-4 h-4 text-yellow-500 fill-current" />
              </div>
              <span className="text-xs text-gray-500">Small (filled)</span>
            </div>
          </div>
        </div>
      ))}
      
      <div className="mt-8 p-6 bg-blue-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Recommendation</h3>
        <p className="text-gray-700">
          <strong>Pin</strong> is the best choice for "pinning" items because:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
          <li>It's specifically designed for pinning/attaching items</li>
          <li>Looks like a push pin (matches the concept)</li>
          <li>Works well with fill-current for filled state</li>
          <li>More intuitive than MapPin (which is for locations)</li>
        </ul>
      </div>
    </div>
  );
};

export default PinIconOptions;

