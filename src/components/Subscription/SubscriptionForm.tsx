import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SubscriptionFormFields, SubscriptionType, QRCodeData } from '../../types';
import { QRScanner } from '../QRScanner/QRScanner';

interface SubscriptionFormProps {
  initialData?: Partial<SubscriptionFormFields>;
  onSubmit: (data: SubscriptionFormFields) => void;
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

export function SubscriptionForm({ initialData = {}, onSubmit, isLoading }: SubscriptionFormProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<SubscriptionFormFields>({
    ...DEFAULT_FORM_DATA,
    ...initialData
  });
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when initialData changes
  useEffect(() => {
    setFormData({
      ...DEFAULT_FORM_DATA,
      ...initialData
    });
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    // Handle number inputs
    if (type === 'number') {
      setFormData({
        ...formData,
        [name]: parseFloat(value)
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
    // Update form with QR code data
    setFormData({
      ...formData,
      ...data.data,
      type: data.type
    });
    
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
    <div>
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => setShowQRScanner(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {t('subscription.scanQR')}
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-6 bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{t('subscription.details')}</h3>
          
          <div className="mb-4">
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('subscription.type')} *
            </label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
            >
              <option value="vehicle">{t('subscriptionTypes.vehicle')}</option>
              <option value="membership">{t('subscriptionTypes.membership')}</option>
              <option value="utility">{t('subscriptionTypes.utility')}</option>
              <option value="insurance">{t('subscriptionTypes.insurance')}</option>
              <option value="other">{t('subscriptionTypes.other')}</option>
            </select>
          </div>
          
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('subscription.name')} *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white ${errors.name ? 'border-red-500' : ''}`}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('subscription.startDate')} *
              </label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className={`w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white ${errors.startDate ? 'border-red-500' : ''}`}
              />
              {errors.startDate && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.startDate}</p>}
            </div>
            
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('subscription.endDate')} *
              </label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                className={`w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white ${errors.endDate ? 'border-red-500' : ''}`}
              />
              {errors.endDate && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.endDate}</p>}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('subscription.amount')}
              </label>
              <input
                type="number"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
              />
            </div>
            
            <div>
              <label htmlFor="currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('subscription.currency')}
              </label>
              <input
                type="text"
                id="currency"
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
              />
            </div>
            
            <div>
              <label htmlFor="reminderDays" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('subscription.reminderDays')}
              </label>
              <input
                type="number"
                id="reminderDays"
                name="reminderDays"
                value={formData.reminderDays}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>
          
          <div className="mb-4">
            <label htmlFor="provider" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('subscription.provider')} *
            </label>
            <input
              type="text"
              id="provider"
              name="provider"
              value={formData.provider}
              onChange={handleChange}
              className={`w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white ${errors.provider ? 'border-red-500' : ''}`}
            />
            {errors.provider && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.provider}</p>}
          </div>
          
          <div className="mb-4">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('subscription.notes')}
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              value={formData.notes}
              onChange={handleChange}
              className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
            ></textarea>
          </div>
        </div>
        
        {formData.type !== 'other' && (
          <div className="mb-6 bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              {t(`subscriptionTypes.${formData.type}`)} {t('subscription.details')}
            </h3>
            
            {renderTypeSpecificFields()}
          </div>
        )}
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isLoading ? t('common.loading') : t('common.save')}
          </button>
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