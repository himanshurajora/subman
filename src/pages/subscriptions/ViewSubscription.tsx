import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { db, doc, getDoc } from "../../firebase";
import { Subscription } from "../../types";
import { Button } from "../../components/UI/Button";

export function ViewSubscription() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchSubscription() {
      if (!currentUser || !id) {
        navigate("/subscriptions");
        return;
      }

      try {
        setLoading(true);
        setError("");
        
        const subscriptionRef = doc(db, "subscriptions", id);
        const subscriptionDoc = await getDoc(subscriptionRef);
        
        if (!subscriptionDoc.exists()) {
          setError("Subscription not found");
          setLoading(false);
          return;
        }
        
        // Check if the subscription belongs to the current user
        const subscriptionData = { id: subscriptionDoc.id, ...subscriptionDoc.data() } as Subscription;
        
        if (subscriptionData.userId !== currentUser.uid) {
          setError("You don't have permission to view this subscription");
          setLoading(false);
          return;
        }
        
        setSubscription(subscriptionData);
      } catch (error) {
        console.error("Error fetching subscription:", error);
        setError("Failed to load subscription. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchSubscription();
  }, [currentUser, id, navigate]);

  // Format date function
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('default', { dateStyle: 'long' }).format(date);
  };

  // Format currency function
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mb-4"></div>
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
          {t("common.loading")}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900 p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-4">{t("Error")}</h2>
        <p className="text-red-700 dark:text-red-300 mb-6">{error}</p>
        <Button variant="primary" onClick={() => navigate("/subscriptions")}>
          {t("Back to Subscriptions")}
        </Button>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900 p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-yellow-800 dark:text-yellow-200 mb-4">
          {t("Subscription Not Found")}
        </h2>
        <p className="text-yellow-700 dark:text-yellow-300 mb-6">
          {t("The subscription you're looking for doesn't exist or has been removed.")}
        </p>
        <Button variant="primary" onClick={() => navigate("/subscriptions")}>
          {t("Back to Subscriptions")}
        </Button>
      </div>
    );
  }

  const isExpired = new Date(subscription.endDate) < new Date();

  return (
    <div className="max-w-3xl mx-auto px-1 sm:px-4 py-3 sm:py-6">
      <div className="mb-4 sm:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <button
            className="mb-2 sm:mb-0 inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
            onClick={() => navigate("/subscriptions")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t("Back to Subscriptions")}
          </button>
          
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {subscription.name}
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            {t(`subscriptionTypes.${subscription.type}`)} • {t("Provided by")} {subscription.provider}
          </p>
        </div>
        <div className="flex mt-3 sm:mt-0 space-x-3">
          <button 
            className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 dark:text-indigo-200 dark:bg-indigo-900 dark:hover:bg-indigo-800 rounded-md"
            onClick={() => navigate(`/subscriptions/${id}/edit`)}
          >
            {t("common.edit")}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        {/* Subscription status banner */}
        <div className={`p-2 sm:p-4 ${isExpired ? 'bg-red-500' : 'bg-green-500'} text-white`}>
          <p className="font-medium">
            {isExpired ? t("Expired Subscription") : t("Active Subscription")}
          </p>
        </div>

        <div className="p-3 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white text-lg mb-4">
                {t("Subscription Details")}
              </h3>
              
              <dl className="grid grid-cols-1 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t("subscription.type")}
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {t(`subscriptionTypes.${subscription.type}`)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t("subscription.provider")}
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {subscription.provider}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t("subscription.amount")}
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {formatCurrency(subscription.amount)}
                  </dd>
                </div>
                {subscription.notes && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t("subscription.notes")}
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {subscription.notes}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 dark:text-white text-lg mb-4">
                {t("Date Information")}
              </h3>
              
              <dl className="grid grid-cols-1 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t("subscription.startDate")}
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {formatDate(subscription.startDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t("subscription.endDate")}
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {formatDate(subscription.endDate)}
                  </dd>
                </div>
                {isExpired && (
                  <div className="mt-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                      {t("Expired")}
                    </span>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t("Reminder Setting")}
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {subscription.reminder 
                      ? t("{{days}} days before expiry", { days: subscription.reminderDays }) 
                      : t("No reminder set")}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Type-specific details */}
          {subscription.type !== 'other' && (
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-white text-lg mb-4">
                {t(`subscriptionTypes.${subscription.type}`)} {t("Details")}
              </h3>
              
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {subscription.type === 'vehicle' && (
                  <>
                    {subscription.vehicleNumber && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {t("vehicleSubscription.vehicleNumber")}
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                          {subscription.vehicleNumber}
                        </dd>
                      </div>
                    )}
                    {subscription.vehicleType && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {t("vehicleSubscription.vehicleType")}
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                          {subscription.vehicleType}
                        </dd>
                      </div>
                    )}
                    {subscription.registrationType && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {t("vehicleSubscription.registrationType")}
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                          {subscription.registrationType}
                        </dd>
                      </div>
                    )}
                  </>
                )}
                
                {subscription.type === 'membership' && (
                  <>
                    {subscription.membershipId && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {t("membershipSubscription.membershipId")}
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                          {subscription.membershipId}
                        </dd>
                      </div>
                    )}
                    {subscription.level && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {t("membershipSubscription.level")}
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                          {subscription.level}
                        </dd>
                      </div>
                    )}
                  </>
                )}
                
                {subscription.type === 'insurance' && (
                  <>
                    {subscription.policyNumber && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {t("insuranceSubscription.policyNumber")}
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                          {subscription.policyNumber}
                        </dd>
                      </div>
                    )}
                    {subscription.coverageType && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {t("insuranceSubscription.coverageType")}
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                          {subscription.coverageType}
                        </dd>
                      </div>
                    )}
                    {typeof subscription.coverage !== 'undefined' && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {t("insuranceSubscription.coverage")}
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                          {formatCurrency(subscription.coverage)}
                        </dd>
                      </div>
                    )}
                  </>
                )}
                
                {subscription.type === 'utility' && (
                  <>
                    {subscription.accountNumber && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {t("utilitySubscription.accountNumber")}
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                          {subscription.accountNumber}
                        </dd>
                      </div>
                    )}
                    {subscription.utilityType && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {t("utilitySubscription.utilityType")}
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                          {subscription.utilityType}
                        </dd>
                      </div>
                    )}
                    {subscription.serviceAddress && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {t("utilitySubscription.serviceAddress")}
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                          {subscription.serviceAddress}
                        </dd>
                      </div>
                    )}
                  </>
                )}
              </dl>
            </div>
          )}
          
          {/* Contact Information Section */}
          {(subscription.ownerName || subscription.address || subscription.contactNumber || subscription.email) && (
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-white text-lg mb-4">
                {t("Contact Information")}
              </h3>
              
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {subscription.ownerName && (
                  <div className="col-span-1 md:col-span-2">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t("Owner/Customer Name")}
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {subscription.ownerName}
                    </dd>
                  </div>
                )}
                
                {subscription.address && (
                  <div className="col-span-1 md:col-span-2">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t("Address")}
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {subscription.address}
                    </dd>
                  </div>
                )}
                
                {subscription.contactNumber && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t("Contact Number")}
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {subscription.contactNumber}
                    </dd>
                  </div>
                )}
                
                {subscription.email && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t("Email ID")}
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {subscription.email}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}
          
          {/* Document Section - merges all files from fileUrl and fileUrls into one list */}
          {(() => {
            // Build a unified list of all files
            const allFiles: { url: string; metadata?: import('../../types').FileMetadata }[] = [];
            
            // Add files from fileUrls array
            if (subscription.fileUrls && subscription.fileUrls.length > 0) {
              subscription.fileUrls.forEach((url, index) => {
                allFiles.push({ url, metadata: subscription.fileMetadataList?.[index] });
              });
            }
            
            // Add the single fileUrl if it exists and isn't already in the list
            if (subscription.fileUrl && !allFiles.some(f => f.url === subscription.fileUrl)) {
              allFiles.push({ url: subscription.fileUrl, metadata: subscription.fileMetadata });
            }
            
            if (allFiles.length === 0) return null;
            
            return (
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white text-lg mb-4">
                  {allFiles.length > 1 ? t("Documents") : t("Document")} ({allFiles.length})
                </h3>
                
                <div className="space-y-4">
                  {allFiles.map((file, index) => {
                    const isImage = file.metadata?.originalName?.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) 
                      || file.url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)/i);
                    return (
                      <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 flex flex-col gap-3">
                        {isImage && (
                          <div className="flex justify-center">
                            <img 
                              src={file.url} 
                              alt={file.metadata?.originalName || `Document ${index + 1}`}
                              className="max-h-64 rounded-md object-contain border border-gray-200 dark:border-gray-700"
                            />
                          </div>
                        )}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="flex-grow min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {file.metadata?.originalName || `${t("File")} ${index + 1}`}
                            </p>
                            {file.metadata && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {t("Uploaded By")} {file.metadata.uploadedBy} • {new Date(file.metadata.uploadedAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                          
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 whitespace-nowrap"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            {t("View/Download")}
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          
          {/* Additional Details (Dynamic Fields) */}
          {(() => {
            // List of all standard field names
            const standardFields = [
              'id', 'userId', 'type', 'name', 'provider', 'startDate', 'endDate', 'reminderDays', 'amount', 
              'currency', 'notes', 'reminder', 'vehicleNumber', 'vehicleType', 'registrationType', 'owner',
              'membershipId', 'level', 'accountNumber', 'utilityType', 'serviceAddress',
              'policyNumber', 'coverageType', 'coverage', 'ownerName', 'address', 'contactNumber', 'email',
              'createdAt', 'updatedAt', 'fileUrl', 'fileMetadata', 'fileUrls', 'fileMetadataList', 'attachments', 'uniqId'
            ];
            
            // Find any non-standard fields
            const dynamicFields = Object.keys(subscription)
              .filter(key => 
                !standardFields.includes(key) && 
                subscription[key] !== undefined && 
                subscription[key] !== null && 
                subscription[key] !== '' &&
                typeof subscription[key] !== 'object' // Exclude objects like fileMetadata
              );
            
            if (dynamicFields.length === 0) {
              return null;
            }
            
            return (
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white text-lg mb-4">
                  {t("Additional Details")}
                </h3>
                
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dynamicFields.map(field => {
                    const fieldValue = subscription[field];
                    return (
                      <div key={field}>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {/* Convert camelCase to Title Case */}
                          {field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                          {typeof fieldValue === 'number' 
                            ? formatCurrency(fieldValue) 
                            : String(fieldValue)}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
} 