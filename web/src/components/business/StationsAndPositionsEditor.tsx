'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Spinner, Alert, Input, Modal, Textarea } from 'shared/components';
import { Plus, Edit, Trash2, Save, X, Info } from 'lucide-react';
import { 
  getBusinessStations, 
  createBusinessStation, 
  updateBusinessStation, 
  deleteBusinessStation,
  type BusinessStation 
} from '@/api/scheduling';
import {
  getPositions,
  createPosition,
  updatePosition,
  deletePosition,
  getOrganizationalTiers,
  type Position,
  type OrganizationalTier,
  type CreatePositionData
} from '@/api/orgChart';

interface StationsAndPositionsEditorProps {
  businessId: string;
  token: string;
  canManage: boolean;
  onSave?: () => void;
}

const STATION_TYPES = [
  { value: 'BOH', label: 'Back of House', description: 'Kitchen, prep, cooking stations' },
  { value: 'FOH', label: 'Front of House', description: 'Server, host, cashier stations' },
  { value: 'MANAGEMENT', label: 'Management', description: 'Manager on duty, supervisor' },
  { value: 'HEALTHCARE', label: 'Healthcare', description: 'Nurse stations, tech positions' },
  { value: 'MANUFACTURING', label: 'Manufacturing', description: 'Production lines, quality control' },
  { value: 'OTHER', label: 'Other', description: 'Custom station types' },
];

const JOB_FUNCTIONS = [
  // Back of House
  { value: 'GRILL', label: 'Grill', type: 'BOH' },
  { value: 'FRY', label: 'Fry Station', type: 'BOH' },
  { value: 'PREP', label: 'Prep', type: 'BOH' },
  { value: 'PIZZA', label: 'Pizza', type: 'BOH' },
  { value: 'PANTRY', label: 'Pantry', type: 'BOH' },
  { value: 'DISH', label: 'Dish', type: 'BOH' },
  { value: 'LINE_COOK', label: 'Line Cook', type: 'BOH' },
  { value: 'EXPO', label: 'Expo', type: 'BOH' },
  { value: 'COOK', label: 'Cook', type: 'BOH' },
  { value: 'CHEF', label: 'Chef', type: 'BOH' },
  // Front of House
  { value: 'SERVER', label: 'Server', type: 'FOH' },
  { value: 'HOST', label: 'Host', type: 'FOH' },
  { value: 'RUNNER', label: 'Runner', type: 'FOH' },
  { value: 'BARTENDER', label: 'Bartender', type: 'FOH' },
  { value: 'CASHIER', label: 'Cashier', type: 'FOH' },
  { value: 'BARISTA', label: 'Barista', type: 'FOH' },
  // Management
  { value: 'MANAGER_ON_DUTY', label: 'Manager on Duty', type: 'MANAGEMENT' },
  { value: 'SHIFT_LEAD', label: 'Shift Lead', type: 'MANAGEMENT' },
  { value: 'SUPERVISOR', label: 'Supervisor', type: 'MANAGEMENT' },
  // Healthcare
  { value: 'NURSE', label: 'Nurse', type: 'HEALTHCARE' },
  { value: 'CNA', label: 'CNA', type: 'HEALTHCARE' },
  { value: 'TECH', label: 'Tech', type: 'HEALTHCARE' },
  { value: 'DOCTOR', label: 'Doctor', type: 'HEALTHCARE' },
  // Other
  { value: 'CUSTOM', label: 'Custom', type: 'OTHER' },
];

const formatTimeRange = (start?: string | null, end?: string | null): string | null => {
  if (start && end) {
    return `${start} - ${end}`;
  }
  if (start) {
    return `Starts ${start}`;
  }
  if (end) {
    return `Ends ${end}`;
  }
  return null;
};

export default function StationsAndPositionsEditor({
  businessId,
  token,
  canManage,
  onSave
}: StationsAndPositionsEditorProps) {
  const [stations, setStations] = useState<BusinessStation[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [tiers, setTiers] = useState<OrganizationalTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreatePositionModal, setShowCreatePositionModal] = useState(false);
  const [editingStation, setEditingStation] = useState<BusinessStation | null>(null);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    stationType: 'BOH' as 'BOH' | 'FOH' | 'MANAGEMENT' | 'HEALTHCARE' | 'MANUFACTURING' | 'OTHER',
    jobFunction: '' as string,
    customStationType: '',
    customJobFunction: '',
    description: '',
    color: '',
    isRequired: false,
    priority: '',
    defaultStartTime: '',
    defaultEndTime: '',
  });

  const [positionFormData, setPositionFormData] = useState({
    title: '',
    description: '',
    tierId: '',
    departmentId: '',
    maxOccupants: '',
    defaultStartTime: '',
    defaultEndTime: '',
  });

  useEffect(() => {
    if (businessId && token) {
      loadStations();
      loadPositions();
      loadTiers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, token]);

  const loadStations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getBusinessStations(businessId, token);
      setStations(response.stations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stations');
    } finally {
      setLoading(false);
    }
  };

  const loadPositions = async () => {
    try {
      setLoadingPositions(true);
      const response = await getPositions(businessId, token);
      if (response.success) {
        setPositions(response.data || []);
      }
    } catch (err) {
      console.error('Failed to load positions:', err);
    } finally {
      setLoadingPositions(false);
    }
  };

  const loadTiers = async () => {
    try {
      const response = await getOrganizationalTiers(businessId, token);
      if (response.success) {
        setTiers(response.data || []);
      }
    } catch (err) {
      console.error('Failed to load tiers:', err);
    }
  };

  const handleCreateStation = async () => {
    if (!formData.name.trim()) {
      setError('Station name is required');
      return;
    }

    if (!formData.stationType) {
      setError('Station type is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await createBusinessStation(
        businessId,
        {
          name: formData.name.trim(),
          stationType: formData.stationType,
          jobFunction: formData.jobFunction === 'CUSTOM' && formData.customJobFunction 
            ? formData.customJobFunction.trim() 
            : formData.jobFunction || undefined,
          description: formData.description || undefined,
          color: formData.color || undefined,
          isRequired: formData.isRequired,
          priority: formData.priority ? parseInt(formData.priority, 10) : undefined,
          defaultStartTime: formData.defaultStartTime || undefined,
          defaultEndTime: formData.defaultEndTime || undefined,
        },
        token
      );

      setShowCreateModal(false);
      setFormData({
        name: '',
        stationType: 'BOH',
        jobFunction: '',
        customStationType: '',
        customJobFunction: '',
        description: '',
        color: '',
        isRequired: false,
        priority: '',
        defaultStartTime: '',
        defaultEndTime: '',
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await loadStations();
      if (onSave) onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create station');
    } finally {
      setSaving(false);
    }
  };

  const handleEditStation = (station: BusinessStation) => {
    setEditingStation(station);
    // Check if jobFunction is not in the enum list (custom value)
    const isCustomJobFunction = station.jobFunction && !JOB_FUNCTIONS.find(jf => jf.value === station.jobFunction);
    setFormData({
      name: station.name,
      stationType: station.stationType,
      jobFunction: isCustomJobFunction ? 'CUSTOM' : (station.jobFunction || ''),
      customStationType: station.stationType === 'OTHER' ? station.name : '',
      customJobFunction: (isCustomJobFunction && station.jobFunction) ? station.jobFunction : '',
      description: station.description || '',
      color: station.color || '',
      isRequired: station.isRequired,
      priority: station.priority?.toString() || '',
      defaultStartTime: station.defaultStartTime || '',
      defaultEndTime: station.defaultEndTime || '',
    });
    setShowCreateModal(true);
  };

  const handleUpdateStation = async () => {
    if (!editingStation) return;
    if (!formData.name.trim()) {
      setError('Station name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await updateBusinessStation(
        editingStation.id,
        businessId,
        {
          name: formData.name.trim(),
          stationType: formData.stationType,
          jobFunction: formData.jobFunction === 'CUSTOM' && formData.customJobFunction 
            ? formData.customJobFunction.trim() 
            : formData.jobFunction || null,
          description: formData.description || null,
          color: formData.color || null,
          isRequired: formData.isRequired,
          priority: formData.priority ? parseInt(formData.priority, 10) : null,
          isActive: true,
          defaultStartTime: formData.defaultStartTime ? formData.defaultStartTime : null,
          defaultEndTime: formData.defaultEndTime ? formData.defaultEndTime : null,
        },
        token
      );

      setShowCreateModal(false);
      setEditingStation(null);
      setFormData({
        name: '',
        stationType: 'BOH',
        jobFunction: '',
        customStationType: '',
        customJobFunction: '',
        description: '',
        color: '',
        isRequired: false,
        priority: '',
        defaultStartTime: '',
        defaultEndTime: '',
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await loadStations();
      if (onSave) onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update station');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStation = async (stationId: string) => {
    if (!confirm('Are you sure you want to delete this station? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(stationId);
      setError(null);

      await deleteBusinessStation(stationId, businessId, token);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await loadStations();
      if (onSave) onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete station');
    } finally {
      setDeleting(null);
    }
  };

  const getJobFunctionsForStationType = (stationType: string) => {
    return JOB_FUNCTIONS.filter(jf => jf.type === stationType || stationType === 'OTHER');
  };

  const handleCreatePosition = async () => {
    if (!positionFormData.title.trim()) {
      setError('Position title is required');
      return;
    }

    if (!positionFormData.tierId) {
      setError('Organizational tier is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const positionData: CreatePositionData = {
        businessId,
        title: positionFormData.title.trim(),
        description: positionFormData.description || undefined,
        tierId: positionFormData.tierId,
        departmentId: positionFormData.departmentId || undefined,
        maxOccupants: positionFormData.maxOccupants ? parseInt(positionFormData.maxOccupants, 10) : undefined,
        defaultStartTime: positionFormData.defaultStartTime || undefined,
        defaultEndTime: positionFormData.defaultEndTime || undefined,
      };

      await createPosition(positionData, token);

      setShowCreatePositionModal(false);
      setPositionFormData({
        title: '',
        description: '',
        tierId: '',
        departmentId: '',
        maxOccupants: '',
        defaultStartTime: '',
        defaultEndTime: '',
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await loadPositions();
      if (onSave) onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create position');
    } finally {
      setSaving(false);
    }
  };

  const handleEditPosition = (position: Position) => {
    setEditingPosition(position);
    setPositionFormData({
      title: position.name,
      description: position.description || '',
      tierId: position.tierId,
      departmentId: position.departmentId || '',
      maxOccupants: position.capacity?.toString() || '',
      defaultStartTime: position.defaultStartTime || '',
      defaultEndTime: position.defaultEndTime || '',
    });
    setShowCreatePositionModal(true);
  };

  const handleUpdatePosition = async () => {
    if (!editingPosition) return;
    if (!positionFormData.title.trim()) {
      setError('Position title is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await updatePosition(
        editingPosition.id,
        {
          title: positionFormData.title.trim(),
          description: positionFormData.description || undefined,
          tierId: positionFormData.tierId,
          departmentId: positionFormData.departmentId || undefined,
          maxOccupants: positionFormData.maxOccupants ? parseInt(positionFormData.maxOccupants, 10) : undefined,
          defaultStartTime: positionFormData.defaultStartTime || undefined,
          defaultEndTime: positionFormData.defaultEndTime || undefined,
        },
        token
      );

      setShowCreatePositionModal(false);
      setEditingPosition(null);
      setPositionFormData({
        title: '',
        description: '',
        tierId: '',
        departmentId: '',
        maxOccupants: '',
        defaultStartTime: '',
        defaultEndTime: '',
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await loadPositions();
      if (onSave) onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update position');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePosition = async (positionId: string) => {
    if (!confirm('Are you sure you want to delete this position? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(positionId);
      setError(null);

      await deletePosition(positionId, token);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await loadPositions();
      if (onSave) onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete position');
    } finally {
      setDeleting(null);
    }
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingStation(null);
    setFormData({
      name: '',
      stationType: 'BOH',
      jobFunction: '',
      customStationType: '',
      customJobFunction: '',
      description: '',
      color: '',
      isRequired: false,
      priority: '',
      defaultStartTime: '',
      defaultEndTime: '',
    });
    setError(null);
  };

  const handleClosePositionModal = () => {
    setShowCreatePositionModal(false);
    setEditingPosition(null);
    setPositionFormData({
      title: '',
      description: '',
      tierId: '',
      departmentId: '',
      maxOccupants: '',
      defaultStartTime: '',
      defaultEndTime: '',
    });
    setError(null);
  };

  const activeStations = stations.filter(s => s.isActive);
  const filteredJobFunctions = getJobFunctionsForStationType(formData.stationType);

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <Alert type="error" title="Error">
          {error}
        </Alert>
      )}

      {/* Success Alert */}
      {success && (
        <Alert type="success" title="Success">
          {editingStation ? 'Station updated' : editingPosition ? 'Position updated' : editingStation !== null ? 'Station created' : 'Position created'} successfully!
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Stations & Positions</h3>
          <p className="text-sm text-gray-600 mt-1">
            Manage business stations and job functions for scheduling
          </p>
        </div>
        {canManage && (
          <div className="flex items-center space-x-2">
            <Button variant="secondary" onClick={() => setShowCreatePositionModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Position
            </Button>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Station
            </Button>
          </div>
        )}
      </div>

      {/* Info Card */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-700">
            <p className="font-medium mb-1">About Stations & Positions</p>
            <ul className="space-y-1 ml-4 list-disc text-xs">
              <li>Stations are business-level and shared across all positions</li>
              <li>Use stations for station-based scheduling (e.g., "Grill 1", "Server 1-10")</li>
              <li>Job functions help categorize stations by work type</li>
              <li>Priority determines which stations are filled first during scheduling</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Positions List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-md font-semibold text-gray-900">Positions</h4>
        </div>
        {loadingPositions ? (
          <div className="flex justify-center py-4">
            <Spinner size={24} />
          </div>
        ) : positions.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-gray-600 mb-4">No positions configured yet.</p>
            {canManage && (
              <Button variant="secondary" onClick={() => setShowCreatePositionModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Position
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {positions.map((position) => (
              <Card key={position.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-semibold text-gray-900">{position.name}</h4>
                    </div>
                    {position.tier && (
                      <Badge color="gray" size="sm" className="mb-2">
                        {position.tier.name}
                      </Badge>
                    )}
                    {position.department && (
                      <div className="text-xs text-gray-600 mt-1">
                        {position.department.name}
                      </div>
                    )}
                    {position.description && (
                      <p className="text-xs text-gray-600 mt-2">{position.description}</p>
                    )}
                    <div className="text-xs text-gray-500 mt-2">
                      Capacity: {position.currentEmployees} / {position.capacity}
                    </div>
                    {formatTimeRange(position.defaultStartTime, position.defaultEndTime) && (
                      <div className="text-xs text-gray-500 mt-1">
                        Default shift: {formatTimeRange(position.defaultStartTime, position.defaultEndTime)}
                      </div>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex items-center space-x-1 ml-2">
                      <button
                        onClick={() => handleEditPosition(position)}
                        className="p-1 text-gray-600 hover:text-blue-600"
                        title="Edit position"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePosition(position.id)}
                        disabled={deleting === position.id}
                        className="p-1 text-gray-600 hover:text-red-600 disabled:opacity-50"
                        title="Delete position"
                      >
                        {deleting === position.id ? (
                          <Spinner size={16} />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Stations List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-md font-semibold text-gray-900">Stations</h4>
        </div>
        {loading ? (
        <div className="flex justify-center py-8">
          <Spinner size={32} />
        </div>
      ) : activeStations.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-600 mb-4">No stations configured yet.</p>
          {canManage && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Station
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeStations.map((station) => (
            <Card key={station.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-semibold text-gray-900">{station.name}</h4>
                    {station.isRequired && (
                      <Badge color="blue" size="sm">Required</Badge>
                    )}
                  </div>
                  <Badge color="gray" size="sm" className="mb-2">
                    {STATION_TYPES.find(t => t.value === station.stationType)?.label || station.stationType}
                  </Badge>
                  {station.jobFunction && (
                    <div className="text-xs text-gray-600 mt-1">
                      {JOB_FUNCTIONS.find(jf => jf.value === station.jobFunction)?.label || station.jobFunction}
                    </div>
                  )}
                  {station.description && (
                    <p className="text-xs text-gray-600 mt-2">{station.description}</p>
                  )}
                  {station.priority && (
                    <div className="text-xs text-gray-500 mt-2">
                      Priority: {station.priority}
                    </div>
                  )}
                  {formatTimeRange(station.defaultStartTime, station.defaultEndTime) && (
                    <div className="text-xs text-gray-500 mt-2">
                      Default shift: {formatTimeRange(station.defaultStartTime, station.defaultEndTime)}
                    </div>
                  )}
                </div>
                {canManage && (
                  <div className="flex items-center space-x-1 ml-2">
                    <button
                      onClick={() => handleEditStation(station)}
                      className="p-1 text-gray-600 hover:text-blue-600"
                      title="Edit station"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteStation(station.id)}
                      disabled={deleting === station.id}
                      className="p-1 text-gray-600 hover:text-red-600 disabled:opacity-50"
                      title="Delete station"
                    >
                      {deleting === station.id ? (
                        <Spinner size={16} />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      </div>

      {/* Create/Edit Station Modal */}
      <Modal
        open={showCreateModal}
        onClose={handleCloseModal}
        title={editingStation ? 'Edit Station' : 'Create New Station'}
        size="large"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Station Name *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Grill 1, Server 1-10, ICU Nurse"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Station Type *
            </label>
            <select
              value={formData.stationType}
              onChange={(e) => {
                setFormData({ 
                  ...formData, 
                  stationType: e.target.value as typeof formData.stationType,
                  jobFunction: '', // Reset job function when type changes
                  customStationType: '', // Reset custom station type when changing
                  customJobFunction: '' // Reset custom job function when type changes
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
            >
              {STATION_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label} - {type.description}
                </option>
              ))}
            </select>
            {formData.stationType === 'OTHER' && (
              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Custom Station Type Name *
                </label>
                <Input
                  value={formData.customStationType}
                  onChange={(e) => setFormData({ ...formData, customStationType: e.target.value })}
                  placeholder="e.g., Manufacturing, Warehouse, Distribution"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Enter a name for your custom station type
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Job Function (Optional)
            </label>
            <select
              value={formData.jobFunction}
              onChange={(e) => setFormData({ 
                ...formData, 
                jobFunction: e.target.value,
                customJobFunction: e.target.value !== 'CUSTOM' ? '' : formData.customJobFunction
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
            >
              <option value="">None</option>
              {filteredJobFunctions.map((jf) => (
                <option key={jf.value} value={jf.value}>
                  {jf.label}
                </option>
              ))}
            </select>
            {formData.jobFunction === 'CUSTOM' && (
              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Custom Job Function Name *
                </label>
                <Input
                  value={formData.customJobFunction}
                  onChange={(e) => setFormData({ ...formData, customJobFunction: e.target.value })}
                  placeholder="e.g., Warehouse Manager, Delivery Driver, Quality Inspector"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Enter a name for your custom job function
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Description (Optional)
            </label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this station"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Color (Hex) (Optional)
              </label>
              <div className="flex items-center space-x-2">
                <Input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#3B82F6"
                  className="flex-1"
                />
                {formData.color && (
                  <div
                    className="w-10 h-10 rounded border border-gray-300"
                    style={{ backgroundColor: formData.color }}
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Priority (1-10) (Optional)
              </label>
              <Input
                type="number"
                min="1"
                max="10"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                placeholder="Higher = fill first"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Default Start Time (Optional)
              </label>
              <Input
                type="time"
                value={formData.defaultStartTime}
                onChange={(e) => setFormData({ ...formData, defaultStartTime: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Default End Time (Optional)
              </label>
              <Input
                type="time"
                value={formData.defaultEndTime}
                onChange={(e) => setFormData({ ...formData, defaultEndTime: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isRequired"
              checked={formData.isRequired}
              onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isRequired" className="ml-2 text-sm text-gray-900">
              Required daily coverage (must be covered every day)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button
              onClick={editingStation ? handleUpdateStation : handleCreateStation}
              disabled={
                saving || 
                !formData.name.trim() || 
                (formData.stationType === 'OTHER' && !formData.customStationType.trim()) ||
                (formData.jobFunction === 'CUSTOM' && !formData.customJobFunction.trim())
              }
            >
              {saving ? (
                <>
                  <div className="mr-2">
                    <Spinner size={16} />
                  </div>
                  {editingStation ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {editingStation ? 'Update Station' : 'Create Station'}
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create/Edit Position Modal */}
      <Modal
        open={showCreatePositionModal}
        onClose={handleClosePositionModal}
        title={editingPosition ? 'Edit Position' : 'Create New Position'}
        size="large"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Position Title *
            </label>
            <Input
              value={positionFormData.title}
              onChange={(e) => setPositionFormData({ ...positionFormData, title: e.target.value })}
              placeholder="e.g., Server, Manager, Nurse"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Organizational Tier *
            </label>
            <select
              value={positionFormData.tierId}
              onChange={(e) => setPositionFormData({ ...positionFormData, tierId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
            >
              <option value="">Select a tier</option>
              {tiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name}
                </option>
              ))}
            </select>
            {tiers.length === 0 && (
              <p className="text-xs text-gray-600 mt-1">
                No organizational tiers found. Please create tiers in the Organization Chart first.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Department (Optional)
            </label>
            <Input
              value={positionFormData.departmentId}
              onChange={(e) => setPositionFormData({ ...positionFormData, departmentId: e.target.value })}
              placeholder="Department ID (optional)"
            />
            <p className="text-xs text-gray-600 mt-1">
              Leave empty if position is not department-specific
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Description (Optional)
            </label>
            <Textarea
              value={positionFormData.description}
              onChange={(e) => setPositionFormData({ ...positionFormData, description: e.target.value })}
              placeholder="Brief description of this position"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Maximum Occupants (Optional)
            </label>
            <Input
              type="number"
              min="1"
              value={positionFormData.maxOccupants}
              onChange={(e) => setPositionFormData({ ...positionFormData, maxOccupants: e.target.value })}
              placeholder="Maximum number of employees in this position"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Default Start Time (Optional)
              </label>
              <Input
                type="time"
                value={positionFormData.defaultStartTime}
                onChange={(e) => setPositionFormData({ ...positionFormData, defaultStartTime: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Default End Time (Optional)
              </label>
              <Input
                type="time"
                value={positionFormData.defaultEndTime}
                onChange={(e) => setPositionFormData({ ...positionFormData, defaultEndTime: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={handleClosePositionModal}>
              Cancel
            </Button>
            <Button
              onClick={editingPosition ? handleUpdatePosition : handleCreatePosition}
              disabled={
                saving || 
                !positionFormData.title.trim() || 
                !positionFormData.tierId
              }
            >
              {saving ? (
                <>
                  <div className="mr-2">
                    <Spinner size={16} />
                  </div>
                  {editingPosition ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {editingPosition ? 'Update Position' : 'Create Position'}
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

