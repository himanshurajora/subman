import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeData, SubscriptionFormFields } from '../../types';
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
  reminderDays: 20,
  reminder: true,
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
      ...data.data,  // This will overwrite existing fields and add any new dynamic fields
      type: data.type
    };
    
    console.log('QR scan data received:', data);
    console.log('Updated form data with dynamic fields:', updatedData);
    
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

  // Function to render any additional dynamic fields detected by AI
  const renderDynamicFields = () => {
    // Get all standard field names that we don't want to display twice
    const standardFields = [
      'type', 'name', 'provider', 'startDate', 'endDate', 'reminderDays', 'amount', 'currency', 
      'notes', 'reminder', 'vehicleNumber', 'vehicleType', 'registrationType', 'owner',
      'membershipId', 'level', 'accountNumber', 'utilityType', 'serviceAddress',
      'policyNumber', 'coverageType', 'coverage', 'ownerName', 'address', 'contactNumber', 'email'
    ];
    
    // Find all non-standard fields in formData
    const dynamicFields = Object.keys(formData)
      .filter(key => 
        !standardFields.includes(key) && 
        formData[key] !== undefined && 
        formData[key] !== null && 
        formData[key] !== ''
      );
    
    if (dynamicFields.length === 0) {
      return null;
    }
    
    return (
      <div className="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Additional Details
        </h3>
        
        {dynamicFields.map((field) => {
          const fieldValue = formData[field];
          const fieldType = typeof fieldValue === 'number' ? 'number' : 'text';
          
          return (
            <div className="mb-4" key={field}>
              <label htmlFor={field} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {/* Convert camelCase to Title Case */}
                {field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </label>
              <input
                type={fieldType}
                id={field}
                name={field}
                value={fieldValue}
                onChange={handleChange}
                className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
              />
            </div>
          );
        })}
      </div>
    );
  };

  // Function to render contact information fields
  const renderContactInfoFields = () => {
    // Only render this section if at least one contact field has a value
    if (!formData.ownerName && !formData.address && !formData.contactNumber && !formData.email) {
      return null;
    }
    
    return (
      <div className="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Contact Information
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Owner Name field */}
          <div className="col-span-1 md:col-span-2">
            <label htmlFor="ownerName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Owner/Customer Name
            </label>
            <input
              id="ownerName"
              name="ownerName"
              type="text"
              value={formData.ownerName || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white dark:bg-gray-800"
            />
          </div>
          
          {/* Address field */}
          <div className="col-span-1 md:col-span-2">
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Address
            </label>
            <input
              id="address"
              name="address"
              type="text"
              value={formData.address || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white dark:bg-gray-800"
            />
          </div>
          
          {/* Contact Number field */}
          <div>
            <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Contact Number
            </label>
            <input
              id="contactNumber"
              name="contactNumber"
              type="text"
              value={formData.contactNumber || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white dark:bg-gray-800"
            />
          </div>
          
          {/* Email field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email ID
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white dark:bg-gray-800"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 md:p-6">
      {/* Mobile-friendly heading shown only on small screens */}
      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white md:hidden">
        {t('Subscription Details')}
      </h2>
      
      {/* Basic Form Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 mb-4">
        <div className="sm:col-span-2">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('common.name')} *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={`w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white text-base ${errors.name ? 'border-red-500' : ''}`}
            placeholder={t('Enter subscription name')}
          />
          {errors.name && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('common.startDate')} *
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
            {t('common.endDate')} *
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

        <div>
          <label htmlFor="provider" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('common.provider')} *
          </label>
          <input
            type="text"
            id="provider"
            name="provider"
            value={formData.provider}
            onChange={handleChange}
            className={`w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white ${errors.provider ? 'border-red-500' : ''}`}
            placeholder={t('Enter provider name')}
          />
          {errors.provider && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.provider}</p>}
        </div>

        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('common.type')} *
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

        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('common.amount')}
          </label>
          <div className="relative rounded-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <span className="text-gray-500 dark:text-gray-400 sm:text-sm">₹</span>
            </div>
            <input
              type="number"
              id="amount"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              min="0"
              step="0.01"
              className="block w-full rounded-md border-gray-300 pl-9 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('common.currency')}
          </label>
          <select
            id="currency"
            name="currency"
            value={formData.currency}
            onChange={handleChange}
            className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
            disabled
          >
            <option value="INR">INR - Indian Rupee</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-4">
          <div className="w-full sm:w-1/2">
            <label htmlFor="reminderDays" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.reminderDays')}
            </label>
            <input
              type="number"
              id="reminderDays"
              name="reminderDays"
              value={formData.reminderDays}
              onChange={handleChange}
              min="1"
              max="90"
              className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div className="flex items-center mt-5 sm:mt-6">
            <input
              type="checkbox"
              id="reminder"
              name="reminder"
              checked={formData.reminder}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800"
            />
            <label htmlFor="reminder" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              {t('Enable Reminder')}
            </label>
          </div>
        </div>
      </div>

      {/* Contact Information Fields */}
      {renderContactInfoFields()}

      {/* Type Specific Fields */}
      <div className="mb-6">
        {renderTypeSpecificFields()}
      </div>

      {/* Dynamic Fields */}
      {renderDynamicFields()}

      <div className="mb-4">
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('common.notes')}
        </label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes || ''}
          onChange={handleChange}
          rows={3}
          className="w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
          placeholder={t('Add any additional notes here')}
        />
      </div>

      {/* QR Scanner Button */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowQRScanner(true)}
          className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5 mr-2" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          {t('Scan QR Code/PDF')}
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row-reverse gap-3 sm:gap-2 mt-6">
        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
          fullWidth={true}
          className="order-1 sm:order-none"
        >
          {t('common.save')}
        </Button>
        <Button
          type="button"
          variant="tertiary"
          onClick={onCancel}
          fullWidth={true}
        >
          {t('common.cancel')}
        </Button>
      </div>

      {showQRScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <QRScanner
              onScan={handleQRScan}
              onClose={() => setShowQRScanner(false)}
            />
          </div>
        </div>
      )}
    </form>
  );
} 