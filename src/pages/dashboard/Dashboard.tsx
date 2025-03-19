import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { db, collection, query, where, getDocs } from "../../firebase";
import { Subscription } from "../../types";
import { Link } from "react-router-dom";

export function Dashboard() {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    // Create an AbortController to cancel the fetch if component unmounts
    const controller = new AbortController();
    
    async function fetchSubscriptions() {
      if (!currentUser) return;

      try {
        setLoading(true);
        
        // Set a timeout to handle the request to prevent hanging
        const timeoutId = setTimeout(() => {
          if (loading && !controller.signal.aborted) {
            controller.abort();
            setError("Request timed out. Please try again.");
            setLoading(false);
          }
        }, 10000); // 10 second timeout
        
        const q = query(
          collection(db, "subscriptions"),
          where("userId", "==", currentUser.uid)
        );
        
        const querySnapshot = await getDocs(q);
        
        // Clear the timeout since we got the data
        clearTimeout(timeoutId);
        
        if (controller.signal.aborted) return;
        
        const subscriptionsData: Subscription[] = [];
        querySnapshot.forEach((doc) => {
          subscriptionsData.push({ id: doc.id, ...doc.data() } as Subscription);
        });
        
        setSubscriptions(subscriptionsData);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching subscriptions:", error);
        // Only set error if not aborted to avoid React state updates on unmounted component
        if (!controller.signal.aborted) {
          setError("Failed to load subscriptions");
          setLoading(false);
        }
      }
    }

    fetchSubscriptions();
    
    // Cleanup function to abort fetch if component unmounts
    return () => {
      controller.abort();
    };
  }, [currentUser]);

  // Calculate statistics
  const currentDate = new Date();
  const activeSubscriptions = subscriptions.filter(
    (sub) => new Date(sub.endDate) >= currentDate
  );
  
  const expiringSubscriptions = activeSubscriptions.filter(
    (sub) => {
      const endDate = new Date(sub.endDate);
      const daysRemaining = Math.ceil(
        (endDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysRemaining <= 30; // Expiring in the next 30 days
    }
  );
  
  const totalSpending = activeSubscriptions.reduce(
    (total, sub) => total + sub.amount,
    0
  );

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mb-4"></div>
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
          {t("common.loading")}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          {t("Fetching your subscription data...")}
        </p>
      </div>
    );
  }

  // If there's an error but no subscriptions, show a more helpful message
  if (error && subscriptions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">{error}</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Please check your internet connection and try again.
          </p>
          <div className="mt-6">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t("navigation.dashboard")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t("app.tagline")}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900 p-4 rounded-md mb-6">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {/* Total Subscriptions Card */}
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {t("dashboard.totalSubscriptions")}
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900 dark:text-white">
                      {subscriptions.length}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Active Subscriptions Card */}
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {t("dashboard.activeSubscriptions")}
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900 dark:text-white">
                      {activeSubscriptions.length}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Expiring Subscriptions Card */}
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {t("dashboard.expiringSubscriptions")}
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900 dark:text-white">
                      {expiringSubscriptions.length}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Total Spending Card */}
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {t("dashboard.totalSpending")}
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900 dark:text-white">
                      <span className="text-lg">₹</span>
                       {totalSpending.toFixed(2)}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expiring Subscriptions List */}
      {expiringSubscriptions.length > 0 && (
        <div className="mt-8 mb-6">
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                {t("dashboard.aboutToExpire")}
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                {t("dashboard.subscriptionsExpiringSoon")}
              </p>
            </div>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {expiringSubscriptions
                .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
                .map((subscription) => {
                  const endDate = new Date(subscription.endDate);
                  const daysRemaining = Math.ceil(
                    (endDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
                  );
                  
                  return (
                    <li key={subscription.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <h4 className="text-md font-medium text-gray-900 dark:text-white">
                            {subscription.name}
                          </h4>
                          <div className="flex items-center mt-1">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {t(`subscriptionTypes.${subscription.type}`)} • {subscription.provider}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <div className="mr-4 text-right">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {new Intl.DateTimeFormat('default', { dateStyle: 'medium' }).format(endDate)}
                            </div>
                            <div className={`text-sm ${daysRemaining <= 7 ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                              {daysRemaining === 0 
                                ? t("dashboard.expiringToday")
                                : daysRemaining === 1
                                  ? t("dashboard.expiringTomorrow")
                                  : t("dashboard.daysRemaining", { days: daysRemaining })}
                            </div>
                          </div>
                          <Link
                            to={`/subscriptions/${subscription.id}`}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 dark:text-indigo-100 dark:bg-indigo-900 dark:hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            {t("common.view")}
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-center">
        <Link
          to="/subscriptions/add"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          {t("subscription.add")}
        </Link>
      </div>
    </div>
  );
} 