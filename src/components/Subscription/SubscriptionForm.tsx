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

// Update the standard input field styles with consistent improved classes 
// for better visibility in dark mode
const inputClasses = `w-full rounded-md border-gray-300 dark:border-gray-600 
px-3 py-2 shadow-sm transition-colors 
focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 
dark:bg-gray-700 dark:text-gray-100 
placeholder-gray-400 dark:placeholder-gray-400`;

const selectClasses = `w-full rounded-md border-gray-300 dark:border-gray-600 
px-3 py-2 shadow-sm transition-colors 
focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 
dark:bg-gray-700 dark:text-gray-100 
appearance-none bg-no-repeat bg-right pr-8`;

const errorClasses = "border-red-500 dark:border-red-500 focus:border-red-500 focus:ring-red-500";

// Create new class variables for consistent styling of section containers and buttons
const sectionClasses = `mt-6 bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6 border border-gray-100 dark:border-gray-700`;
const labelClasses = `block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1`;
const requiredFieldMark = `after:content-['*'] after:ml-0.5 after:text-red-500 dark:after:text-red-400`;

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

  // Function to render type-specific fields - with updated styling for labels and sections
  const renderTypeSpecificFields = () => {
    switch (formData.type) {
      case 'vehicle':
        return (
          <div className={sectionClasses}>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              {t('Vehicle Details')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-1 sm:col-span-2">
                <label htmlFor="vehicleNumber" className={`${labelClasses} ${requiredFieldMark}`}>
                  {t('vehicleSubscription.vehicleNumber')}
                </label>
                <input
                  type="text"
                  id="vehicleNumber"
                  name="vehicleNumber"
                  value={formData.vehicleNumber || ''}
                  onChange={handleChange}
                  className={`${inputClasses} ${errors.vehicleNumber ? errorClasses : ''}`}
                />
                {errors.vehicleNumber && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.vehicleNumber}</p>}
              </div>
              <div>
                <label htmlFor="vehicleType" className={labelClasses}>
                  {t('vehicleSubscription.vehicleType')}
                </label>
                <input
                  type="text"
                  id="vehicleType"
                  name="vehicleType"
                  value={formData.vehicleType || ''}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="registrationType" className={labelClasses}>
                  {t('vehicleSubscription.registrationType')}
                </label>
                <input
                  type="text"
                  id="registrationType"
                  name="registrationType"
                  value={formData.registrationType || ''}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label htmlFor="owner" className={labelClasses}>
                  {t('vehicleSubscription.owner')}
                </label>
                <input
                  type="text"
                  id="owner"
                  name="owner"
                  value={formData.owner || ''}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
            </div>
          </div>
        );
      case 'membership':
        return (
          <div className={sectionClasses}>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              {t('Membership Details')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-1 sm:col-span-2">
                <label htmlFor="membershipId" className={`${labelClasses} ${requiredFieldMark}`}>
                  {t('membershipSubscription.membershipId')}
                </label>
                <input
                  type="text"
                  id="membershipId"
                  name="membershipId"
                  value={formData.membershipId || ''}
                  onChange={handleChange}
                  className={`${inputClasses} ${errors.membershipId ? errorClasses : ''}`}
                />
                {errors.membershipId && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.membershipId}</p>}
              </div>
              <div>
                <label htmlFor="level" className={labelClasses}>
                  {t('membershipSubscription.level')}
                </label>
                <input
                  type="text"
                  id="level"
                  name="level"
                  value={formData.level || ''}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
            </div>
          </div>
        );
      case 'utility':
        return (
          <div className={sectionClasses}>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              {t('Utility Details')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="utilityType" className={labelClasses}>
                  {t('utilitySubscription.utilityType')}
                </label>
                <input
                  type="text"
                  id="utilityType"
                  name="utilityType"
                  value={formData.utilityType || ''}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="accountNumber" className={`${labelClasses} ${requiredFieldMark}`}>
                  {t('utilitySubscription.accountNumber')}
                </label>
                <input
                  type="text"
                  id="accountNumber"
                  name="accountNumber"
                  value={formData.accountNumber || ''}
                  onChange={handleChange}
                  className={`${inputClasses} ${errors.accountNumber ? errorClasses : ''}`}
                />
                {errors.accountNumber && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.accountNumber}</p>}
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label htmlFor="serviceAddress" className={labelClasses}>
                  {t('utilitySubscription.serviceAddress')}
                </label>
                <input
                  type="text"
                  id="serviceAddress"
                  name="serviceAddress"
                  value={formData.serviceAddress || ''}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
            </div>
          </div>
        );
      case 'insurance':
        return (
          <div className={sectionClasses}>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              {t('Insurance Details')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-1 sm:col-span-2">
                <label htmlFor="policyNumber" className={`${labelClasses} ${requiredFieldMark}`}>
                  {t('insuranceSubscription.policyNumber')}
                </label>
                <input
                  type="text"
                  id="policyNumber"
                  name="policyNumber"
                  value={formData.policyNumber || ''}
                  onChange={handleChange}
                  className={`${inputClasses} ${errors.policyNumber ? errorClasses : ''}`}
                />
                {errors.policyNumber && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.policyNumber}</p>}
              </div>
              <div>
                <label htmlFor="coverageType" className={labelClasses}>
                  {t('insuranceSubscription.coverageType')}
                </label>
                <input
                  type="text"
                  id="coverageType"
                  name="coverageType"
                  value={formData.coverageType || ''}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="coverage" className={labelClasses}>
                  {t('insuranceSubscription.coverage')}
                </label>
                <input
                  type="number"
                  id="coverage"
                  name="coverage"
                  value={formData.coverage || 0}
                  onChange={handleChange}
                  className={inputClasses}
                />
              </div>
            </div>
          </div>
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
      <div className={sectionClasses}>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Additional Details
        </h3>
        
        {dynamicFields.map((field) => {
          const fieldValue = formData[field];
          const fieldType = typeof fieldValue === 'number' ? 'number' : 'text';
          
          return (
            <div className="mb-4" key={field}>
              <label htmlFor={field} className={labelClasses}>
                {/* Convert camelCase to Title Case */}
                {field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </label>
              <input
                type={fieldType}
                id={field}
                name={field}
                value={fieldValue}
                onChange={handleChange}
                className={inputClasses}
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
      <div className={sectionClasses}>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Contact Information
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Owner Name field */}
          <div className="col-span-1 md:col-span-2">
            <label htmlFor="ownerName" className={labelClasses}>
              Owner/Customer Name
            </label>
            <input
              id="ownerName"
              name="ownerName"
              type="text"
              value={formData.ownerName || ''}
              onChange={handleChange}
              className={inputClasses}
            />
          </div>
          
          {/* Address field */}
          <div className="col-span-1 md:col-span-2">
            <label htmlFor="address" className={labelClasses}>
              Address
            </label>
            <input
              id="address"
              name="address"
              type="text"
              value={formData.address || ''}
              onChange={handleChange}
              className={inputClasses}
            />
          </div>
          
          {/* Contact Number field */}
          <div>
            <label htmlFor="contactNumber" className={labelClasses}>
              Contact Number
            </label>
            <input
              id="contactNumber"
              name="contactNumber"
              type="text"
              value={formData.contactNumber || ''}
              onChange={handleChange}
              className={inputClasses}
            />
          </div>
          
          {/* Email field */}
          <div>
            <label htmlFor="email" className={labelClasses}>
              Email ID
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email || ''}
              onChange={handleChange}
              className={inputClasses}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-2 sm:p-4 md:p-6 border border-gray-100 dark:border-gray-700">
      {/* Mobile-friendly heading shown only on small screens */}
      <h2 className="text-lg font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-white md:hidden">
        {t('Subscription Details')}
      </h2>
      
      {/* Top buttons row */}
      <div className="flex flex-col-reverse sm:flex-row justify-between items-center mb-6 gap-3">
        {/* QR Scanner Button - Top */}
        <button
          type="button"
          onClick={() => setShowQRScanner(true)}
          className="w-full sm:w-auto flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 transition-colors"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5 mr-2 text-indigo-500 dark:text-indigo-400" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          {t('Scan QR Code/PDF')}
        </button>
        
        {/* Form buttons - Top */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full sm:w-auto flex justify-center items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors dark:focus:ring-offset-gray-800"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('common.saving')}...
              </>
            ) : (
              t('common.save')
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 transition-colors"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
      
      {/* Basic Form Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-2 sm:gap-y-3 mb-3 sm:mb-4">
        <div className="sm:col-span-2">
          <label htmlFor="name" className={`${labelClasses} ${requiredFieldMark}`}>
            {t('common.name')}
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={`${inputClasses} ${errors.name ? errorClasses : ''}`}
            placeholder={t('Enter subscription name')}
          />
          {errors.name && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="startDate" className={`${labelClasses} ${requiredFieldMark}`}>
            {t('common.startDate')}
          </label>
          <input
            type="date"
            id="startDate"
            name="startDate"
            value={formData.startDate}
            onChange={handleChange}
            className={`${inputClasses} ${errors.startDate ? errorClasses : ''} dark:text-gray-100`}
          />
          {errors.startDate && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.startDate}</p>}
        </div>

        <div>
          <label htmlFor="endDate" className={`${labelClasses} ${requiredFieldMark}`}>
            {t('common.endDate')}
          </label>
          <input
            type="date"
            id="endDate"
            name="endDate"
            value={formData.endDate}
            onChange={handleChange}
            className={`${inputClasses} ${errors.endDate ? errorClasses : ''} dark:text-gray-100`}
          />
          {errors.endDate && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.endDate}</p>}
        </div>

        <div>
          <label htmlFor="provider" className={`${labelClasses} ${requiredFieldMark}`}>
            {t('common.provider')}
          </label>
          <input
            type="text"
            id="provider"
            name="provider"
            value={formData.provider}
            onChange={handleChange}
            className={`${inputClasses} ${errors.provider ? errorClasses : ''}`}
            placeholder={t('Enter provider name')}
          />
          {errors.provider && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.provider}</p>}
        </div>

        <div>
          <label htmlFor="type" className={`${labelClasses} ${requiredFieldMark}`}>
            {t('common.type')}
          </label>
          <div className="relative">
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              className={selectClasses}
            >
              <option value="vehicle">{t('subscriptionTypes.vehicle')}</option>
              <option value="membership">{t('subscriptionTypes.membership')}</option>
              <option value="utility">{t('subscriptionTypes.utility')}</option>
              <option value="insurance">{t('subscriptionTypes.insurance')}</option>
              <option value="other">{t('subscriptionTypes.other')}</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
              </svg>
            </div>
          </div>
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
              className={`${inputClasses} pl-9`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('common.currency')}
          </label>
          <div className="relative">
            <select
              id="currency"
              name="currency"
              value={formData.currency}
              onChange={handleChange}
              className={`${selectClasses} bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400`}
              disabled
            >
              <option value="INR">INR - Indian Rupee</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
              </svg>
            </div>
          </div>
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
              className={inputClasses}
            />
          </div>
          <div className="flex items-center mt-5 sm:mt-6">
            <input
              type="checkbox"
              id="reminder"
              name="reminder"
              checked={formData.reminder}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-indigo-600 dark:focus:ring-offset-gray-800"
            />
            <label htmlFor="reminder" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              {t('Enable Reminder')}
            </label>
          </div>
        </div>
      </div>

      {/* Type Specific Fields */}
      <div className="mb-6">
        {renderTypeSpecificFields()}
      </div>

      {/* Notes field in its own section */}
      <div className={`${sectionClasses} sm:col-span-2`}>
        <label htmlFor="notes" className={labelClasses}>
          {t('common.notes')}
        </label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes || ''}
          onChange={handleChange}
          rows={3}
          className={inputClasses}
          placeholder={t('Add any additional notes here')}
        />
      </div>

      {/* Contact Information Fields */}
      {renderContactInfoFields()}

      {/* Dynamic Fields */}
      {renderDynamicFields()}

      {/* Move QR Scanner Button after the form fields - Bottom */}
      <div className="mb-4 mt-6">
        <button
          type="button"
          onClick={() => setShowQRScanner(true)}
          className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 transition-colors"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5 mr-2 text-indigo-500 dark:text-indigo-400" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          {t('Scan QR Code/PDF')}
        </button>
      </div>

      {/* Form buttons - Bottom */}
      <div className="flex flex-col sm:flex-row-reverse gap-2 sm:gap-3 mt-4 sm:mt-6">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full sm:w-auto flex justify-center items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors dark:focus:ring-offset-gray-800"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t('common.saving')}...
            </>
          ) : (
            t('common.save')
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 transition-colors"
        >
          {t('common.cancel')}
        </button>
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