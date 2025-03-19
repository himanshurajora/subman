import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SubscriptionFormFields, SubscriptionType, QRCodeData } from '../../types';
import { QRScanner } from '../QRScanner/QRScanner';
import { Button } from '../UI/Button';

interface SubscriptionFormProps {
  initialData?: Partial<SubscriptionFormFields>;
  onSubmit: (data: SubscriptionFormFields) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const DEFAULT_FORM_DATA: SubscriptionFormFields = {
  name: '',
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
  reminderDays: 30,
  amount: 0,
  currency: 'INR',
  provider: '',
  notes: '',
  type: 'other'
};

export function SubscriptionForm({ initialData = {}, onSubmit, onCancel, isLoading }: SubscriptionFormProps) {
  const { t } = useTranslation();
  
  // Initialize form data once with the merged defaults and initialData
  const [formData, setFormData] = useState<SubscriptionFormFields>(() => {
    // Always use INR as currency regardless of initialData
    return {
      ...DEFAULT_FORM_DATA,
      ...initialData,
      currency: 'INR' // Force currency to be INR
    };
  });

  const [showQRScanner, setShowQRScanner] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // Handle number inputs
    if (type === 'number') {
      setFormData({
        ...formData,
        [name]: parseFloat(value)
      });
    } else if (type === 'checkbox') {
      // Handle checkbox inputs
      const target = e.target as HTMLInputElement;
      setFormData({
        ...formData,
        [name]: target.checked
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
    
    // Clear error for this field if it exists
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  const handleQRScan = (data: QRCodeData) => {
    // Create a copy of the current form data before updating
    const updatedData = {
      ...DEFAULT_FORM_DATA,
      ...formData,
      ...data.data,
      type: data.type
    };
    
    // Update form with QR code data
    setFormData(updatedData);
    
    // Close the QR scanner
    setShowQRScanner(false);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Required fields
    if (!formData.name.trim()) {
      newErrors.name = t('This field is required');
    }
    
    if (!formData.startDate) {
      newErrors.startDate = t('This field is required');
    }
    
    if (!formData.endDate) {
      newErrors.endDate = t('This field is required');
    } else if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      newErrors.endDate = t('End date must be after start date');
    }
    
    if (!formData.provider.trim()) {
      newErrors.provider = t('This field is required');
    }
    
    // Validate based on subscription type
    switch (formData.type) {
      case 'vehicle':
        if (!formData.vehicleNumber?.trim()) {
          newErrors.vehicleNumber = t('This field is required');
        }
        break;
      case 'membership':
        if (!formData.membershipId?.trim()) {
          newErrors.membershipId = t('This field is required');
        }
        break;
      case 'utility':
        if (!formData.accountNumber?.trim()) {
          newErrors.accountNumber = t('This field is required');
        }
        break;
      case 'insurance':
        if (!formData.policyNumber?.trim()) {
          newErrors.policyNumber = t('This field is required');
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  // Render dynamic fields based on subscription type
  const renderTypeSpecificFields = () => {
    switch (formData.type) {
      case 'vehicle':
        return (
          <>
            <div className="mb-4">
              <label htmlFor="vehicleNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('vehicleSubscription.vehicleNumber')} *
              </label>
              <input
                type="text"
                id="vehicleNumber"
                name="vehicleNumber"
                value={formData.vehicleNumber || ''}
                onChange={handleChange}
                className={`w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white ${errors.vehicleNumber ? 'border-red-500' : ''}`}
              />
              {errors.vehicleNumber && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.vehicleNumber}</p>}
            </div>
            <div className="mb-4">
              <label htmlFor="vehicleType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('vehicleSubscription.vehicleType')}
              </label>
              <input
                type="text"
                id="vehicleType"
                name="vehicleType"
                value={formData.vehicleType || ''}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="registrationType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('vehicleSubscription.registrationType')}
              </label>
              <input
                type="text"
                id="registrationType"
                name="registrationType"
                value={formData.registrationType || ''}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="owner" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('vehicleSubscription.owner')}
              </label>
              <input
                type="text"
                id="owner"
                name="owner"
                value={formData.owner || ''}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </>
        );
      case 'membership':
        return (
          <>
            <div className="mb-4">
              <label htmlFor="membershipId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('membershipSubscription.membershipId')} *
              </label>
              <input
                type="text"
                id="membershipId"
                name="membershipId"
                value={formData.membershipId || ''}
                onChange={handleChange}
                className={`w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white ${errors.membershipId ? 'border-red-500' : ''}`}
              />
              {errors.membershipId && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.membershipId}</p>}
            </div>
            <div className="mb-4">
              <label htmlFor="level" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('membershipSubscription.level')}
              </label>
              <input
                type="text"
                id="level"
                name="level"
                value={formData.level || ''}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </>
        );
      case 'utility':
        return (
          <>
            <div className="mb-4">
              <label htmlFor="utilityType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('utilitySubscription.utilityType')}
              </label>
              <input
                type="text"
                id="utilityType"
                name="utilityType"
                value={formData.utilityType || ''}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('utilitySubscription.accountNumber')} *
              </label>
              <input
                type="text"
                id="accountNumber"
                name="accountNumber"
                value={formData.accountNumber || ''}
                onChange={handleChange}
                className={`w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white ${errors.accountNumber ? 'border-red-500' : ''}`}
              />
              {errors.accountNumber && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.accountNumber}</p>}
            </div>
            <div className="mb-4">
              <label htmlFor="serviceAddress" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('utilitySubscription.serviceAddress')}
              </label>
              <input
                type="text"
                id="serviceAddress"
                name="serviceAddress"
                value={formData.serviceAddress || ''}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </>
        );
      case 'insurance':
        return (
          <>
            <div className="mb-4">
              <label htmlFor="policyNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('insuranceSubscription.policyNumber')} *
              </label>
              <input
                type="text"
                id="policyNumber"
                name="policyNumber"
                value={formData.policyNumber || ''}
                onChange={handleChange}
                className={`w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white ${errors.policyNumber ? 'border-red-500' : ''}`}
              />
              {errors.policyNumber && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.policyNumber}</p>}
            </div>
            <div className="mb-4">
              <label htmlFor="coverageType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('insuranceSubscription.coverageType')}
              </label>
              <input
                type="text"
                id="coverageType"
                name="coverageType"
                value={formData.coverageType || ''}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="coverage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('insuranceSubscription.coverage')}
              </label>
              <input
                type="number"
                id="coverage"
                name="coverage"
                value={formData.coverage || 0}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Name field */}
          <div className="col-span-1 md:col-span-2">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('subscription.name')} *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white dark:bg-gray-800"
            />
          </div>
          
          {/* Provider field */}
          <div>
            <label htmlFor="provider" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('subscription.provider')}
            </label>
            <input
              id="provider"
              name="provider"
              type="text"
              value={formData.provider}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white dark:bg-gray-800"
            />
          </div>
          
          {/* Type field */}
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('subscription.type')} *
            </label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white dark:bg-gray-800"
            >
              <option value="vehicle">{t('subscriptionTypes.vehicle')}</option>
              <option value="membership">{t('subscriptionTypes.membership')}</option>
              <option value="utility">{t('subscriptionTypes.utility')}</option>
              <option value="insurance">{t('subscriptionTypes.insurance')}</option>
              <option value="other">{t('subscriptionTypes.other')}</option>
            </select>
          </div>
          
          {/* Start date field */}
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('subscription.startDate')} *
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              required
              value={formData.startDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white dark:bg-gray-800"
            />
          </div>
          
          {/* End date field */}
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('subscription.endDate')}
            </label>
            <input
              id="endDate"
              name="endDate"
              type="date"
              value={formData.endDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white dark:bg-gray-800"
            />
          </div>
          
          {/* Amount field - show with fixed INR currency */}
          <div className="col-span-1 md:col-span-2">
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('subscription.amount')} (₹) *
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              value={formData.amount}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white dark:bg-gray-800"
            />
          </div>
          
          {/* Reminder toggle */}
          <div className="col-span-1 md:col-span-2 flex items-center">
            <input
              id="reminder"
              name="reminder"
              type="checkbox"
              checked={formData.reminder || false}
              onChange={handleChange}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="reminder" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Subscription reminder
            </label>
          </div>
          
          {/* Reminder days field - only show if reminder is enabled */}
          {formData.reminder && (
            <div className="col-span-1 md:col-span-2">
              <label htmlFor="reminderDays" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('subscription.reminderDays')}
              </label>
              <input
                id="reminderDays"
                name="reminderDays"
                type="number"
                min="1"
                max="30"
                value={formData.reminderDays}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white dark:bg-gray-800"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t('subscription.reminderDaysHelp')}
              </p>
            </div>
          )}
        </div>
        
        {formData.type !== 'other' && (
          <div className="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              {t(`subscriptionTypes.${formData.type}`)} {t('subscription.details')}
            </h3>
            
            {renderTypeSpecificFields()}
          </div>
        )}
        
        <div className="mt-8 flex justify-between items-center">
          <div>
            <Button 
              type="button"
              variant="secondary"
              onClick={() => setShowQRScanner(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z" clipRule="evenodd" />
                <path d="M11 4a1 1 0 10-2 0v1a1 1 0 002 0V4zM10 7a1 1 0 011 1v1h2a1 1 0 110 2h-3a1 1 0 01-1-1V8a1 1 0 011-1zM16 9a1 1 0 100 2 1 1 0 000-2zM9 13a1 1 0 011-1h1a1 1 0 110 2v2a1 1 0 11-2 0v-3zM7 11a1 1 0 100-2H4a1 1 0 100 2h3zM17 13a1 1 0 01-1 1h-2a1 1 0 110-2h2a1 1 0 011 1zM16 17a1 1 0 100-2h-3a1 1 0 100 2h3z" />
              </svg>
              {t('subscription.scanQR')}
            </Button>
          </div>
          
          <div className="flex gap-3">
            <Button
              type="button"
              variant="tertiary"
              onClick={onCancel}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading}
            >
              {isLoading ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </div>
      </form>
      
      {showQRScanner && (
        <QRScanner 
          onScan={handleQRScan}
          onClose={() => setShowQRScanner(false)}
        />
      )}
    </div>
  );
} 