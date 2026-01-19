'use client';

import React, { useState } from 'react';
import { Card, Button, Modal, Spinner, Alert } from 'shared/components';
import { Package, Plus, X } from 'lucide-react';
import { useModuleIntegration } from '@/hooks/useModuleIntegration';
import { toast } from 'react-hot-toast';
import type { EmployeeOnboardingTask } from '@/api/hrOnboarding';

interface OnboardingEquipmentRequestProps {
  task: EmployeeOnboardingTask;
  businessId: string;
  onRequestSubmitted?: (equipmentData: { items: Array<{ name: string; sku?: string; size?: string; color?: string }> }) => void;
}

interface EquipmentItem {
  name: string;
  sku?: string;
  size?: string;
  color?: string;
  quantity?: number;
}

export default function OnboardingEquipmentRequest({
  task,
  businessId,
  onRequestSubmitted,
}: OnboardingEquipmentRequestProps) {
  const { hasDrive, loading: moduleLoading } = useModuleIntegration(businessId);
  const [showModal, setShowModal] = useState(false);
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleAddItem = () => {
    setItems([...items, { name: '', quantity: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, updates: Partial<EquipmentItem>) => {
    setItems(items.map((item, i) => (i === index ? { ...item, ...updates } : item)));
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast.error('Please add at least one equipment item');
      return;
    }

    if (items.some(item => !item.name.trim())) {
      toast.error('Please provide a name for all equipment items');
      return;
    }

    try {
      setSubmitting(true);
      onRequestSubmitted?.({ items });
      toast.success('Equipment request submitted');
      setShowModal(false);
      setItems([]);
    } catch (error) {
      console.error('Failed to submit equipment request:', error);
      toast.error('Failed to submit equipment request');
    } finally {
      setSubmitting(false);
    }
  };

  if (moduleLoading) {
    return null;
  }

  // Equipment requests can work without Drive, but it's better if Drive is available for document storage
  // For now, we'll show the component regardless

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setShowModal(true)}
      >
        <Package className="w-4 h-4 mr-1" />
        Request Equipment
      </Button>

      {showModal && (
        <Modal open={true} onClose={() => setShowModal(false)} title="Request Equipment">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{task.title}</h3>
              {task.description && (
                <p className="text-sm text-gray-600">{task.description}</p>
              )}
            </div>

            <Alert type="info" title="Equipment Request">
              <p className="text-sm text-gray-700">
                Submit your equipment request. HR will review and process your request.
              </p>
            </Alert>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Equipment Items</label>
                <Button variant="secondary" size="sm" onClick={handleAddItem}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border border-dashed rounded-lg">
                  <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No equipment items added yet</p>
                  <p className="text-xs text-gray-400 mt-1">Click "Add Item" to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <Card key={index} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-900">Item {index + 1}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Equipment Name *
                          </label>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateItem(index, { name: e.target.value })}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. Laptop, Monitor, Headset"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Quantity
                          </label>
                          <input
                            type="number"
                            value={item.quantity || 1}
                            onChange={(e) => handleUpdateItem(index, { quantity: parseInt(e.target.value) || 1 })}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min={1}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            SKU / Model (optional)
                          </label>
                          <input
                            type="text"
                            value={item.sku || ''}
                            onChange={(e) => handleUpdateItem(index, { sku: e.target.value })}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. MacBook Pro 16"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Size / Color (optional)
                          </label>
                          <input
                            type="text"
                            value={item.size || item.color || ''}
                            onChange={(e) => {
                              // Simple: if it looks like a size, store as size, otherwise as color
                              const value = e.target.value;
                              if (/^(XS|S|M|L|XL|\d+)$/i.test(value)) {
                                handleUpdateItem(index, { size: value });
                              } else {
                                handleUpdateItem(index, { color: value });
                              }
                            }}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. Large, Black, 15 inch"
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <Button variant="ghost" onClick={() => setShowModal(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={submitting || items.length === 0}
              >
                {submitting ? (
                  <>
                    <span className="mr-2"><Spinner size={16} /></span>
                    Submitting...
                  </>
                ) : (
                  'Submit Request'
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

