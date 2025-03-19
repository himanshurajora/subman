import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate, Link } from "react-router-dom";
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
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {subscription.name}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t(`subscriptionTypes.${subscription.type}`)} • {t("Provided by")} {subscription.provider}
          </p>
        </div>
        <div className="flex space-x-4">
          <Button 
            variant="secondary" 
            onClick={() => navigate(`/subscriptions/${id}/edit`)}
          >
            {t("common.edit")}
          </Button>
          <Button 
            variant="tertiary" 
            onClick={() => navigate("/subscriptions")}
          >
            {t("common.back")}
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        {/* Subscription status banner */}
        <div className={`p-4 ${isExpired ? 'bg-red-500' : 'bg-green-500'} text-white`}>
          <p className="font-medium">
            {isExpired ? t("Expired Subscription") : t("Active Subscription")}
          </p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        </div>
      </div>
    </div>
  );
} 