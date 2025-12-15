import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { db, collection, query, where, getDocs, orderBy } from "../../firebase";
import { Subscription, QRCodeData, SubscriptionType } from "../../types";
import { Link, useNavigate } from "react-router-dom";
import { QRScanner } from "../../components/QRScanner/QRScanner";

// Sort field types for dashboard tables
type ExpiringSortField = 'name' | 'endDate' | 'amount' | 'type';
type RecentSortField = 'name' | 'createdAt' | 'amount' | 'type';

export function Dashboard() {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [error, setError] = useState("");
  const [showQRScanner, setShowQRScanner] = useState(false);
  const navigate = useNavigate();

  // Expiring subscriptions filters and sorting
  const [expiringTypeFilter, setExpiringTypeFilter] = useState<SubscriptionType | "all">("all");
  const [expiringDaysFilter, setExpiringDaysFilter] = useState<number>(30);
  const [expiringSortField, setExpiringSortField] = useState<ExpiringSortField>('endDate');
  const [expiringSortDirection, setExpiringSortDirection] = useState<'asc' | 'desc'>('asc');

  // Recent subscriptions filters and sorting
  const [recentTypeFilter, setRecentTypeFilter] = useState<SubscriptionType | "all">("all");
  const [recentSortField, setRecentSortField] = useState<RecentSortField>('createdAt');
  const [recentSortDirection, setRecentSortDirection] = useState<'asc' | 'desc'>('desc');

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
          where("userId", "==", currentUser.uid),
          orderBy("createdAt", "desc")
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
  
  // Filtered and sorted expiring subscriptions
  const expiringSubscriptions = useMemo(() => {
    return activeSubscriptions
      .filter((sub) => {
        const endDate = new Date(sub.endDate);
        const daysRemaining = Math.ceil(
          (endDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        // Filter by days
        if (daysRemaining > expiringDaysFilter) return false;
        // Filter by type
        if (expiringTypeFilter !== "all" && sub.type !== expiringTypeFilter) return false;
        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (expiringSortField) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'amount':
            comparison = a.amount - b.amount;
            break;
          case 'type':
            comparison = a.type.localeCompare(b.type);
            break;
          case 'endDate':
          default:
            comparison = new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
            break;
        }
        return expiringSortDirection === 'asc' ? comparison : -comparison;
      });
  }, [activeSubscriptions, expiringDaysFilter, expiringTypeFilter, expiringSortField, expiringSortDirection, currentDate]);
  
  const totalSpending = activeSubscriptions.reduce(
    (total, sub) => total + sub.amount,
    0
  );

  // Filtered and sorted recent subscriptions
  const recentSubscriptions = useMemo(() => {
    return [...subscriptions]
      .filter(sub => {
        // Filter by type
        if (recentTypeFilter !== "all" && sub.type !== recentTypeFilter) return false;
        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (recentSortField) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'amount':
            comparison = a.amount - b.amount;
            break;
          case 'type':
            comparison = a.type.localeCompare(b.type);
            break;
          case 'createdAt':
          default: {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            comparison = dateA - dateB;
            break;
          }
        }
        return recentSortDirection === 'asc' ? comparison : -comparison;
      })
      .slice(0, 5); // Get only the first 5
  }, [subscriptions, recentTypeFilter, recentSortField, recentSortDirection]);

  // Handle QR scan data
  const handleQRScan = (data: QRCodeData) => {
    console.log("QR code scanned:", JSON.stringify(data, null, 2));
    setShowQRScanner(false);
    
    // Validate the data structure before navigating
    if (!data || !data.type || !data.data) {
      console.error("Invalid QR data format:", data);
      alert("The scanned QR code doesn't contain valid subscription information. Please try again.");
      return;
    }
    
    // Navigate to add subscription with pre-filled data
    navigate("/subscriptions/add", { state: { prefillData: data } });
  };

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
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t("navigation.dashboard")}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t("app.tagline")}
          </p>
        </div>
        
        {/* Scan QR / Upload PDF button - visible on desktop only */}
        <button
          onClick={() => setShowQRScanner(true)}
          className="hidden sm:flex items-center justify-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm transition-colors"
          aria-label={t("subscription.scanQROrPDF")}
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
          {t("subscription.scanQROrPDF")}
        </button>
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
      {(expiringSubscriptions.length > 0 || expiringTypeFilter !== "all" || expiringDaysFilter !== 30) && (
        <div className="mt-8 mb-6">
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                    {t("dashboard.aboutToExpire")}
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                    {t("dashboard.subscriptionsExpiringSoon")}
                  </p>
                </div>
                
                {/* Filters and Sort for Expiring Subscriptions */}
                <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
                  {/* Days filter */}
                  <select
                    className="rounded-md border-gray-300 dark:border-gray-600 py-1.5 pl-2 pr-8 text-xs text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700"
                    value={expiringDaysFilter}
                    onChange={(e) => setExpiringDaysFilter(Number(e.target.value))}
                  >
                    <option value={7}>7 {t("dashboard.daysRemaining", { days: "" }).replace("{{days}}", "").trim()}</option>
                    <option value={14}>14 {t("dashboard.daysRemaining", { days: "" }).replace("{{days}}", "").trim()}</option>
                    <option value={30}>30 {t("dashboard.daysRemaining", { days: "" }).replace("{{days}}", "").trim()}</option>
                    <option value={60}>60 {t("dashboard.daysRemaining", { days: "" }).replace("{{days}}", "").trim()}</option>
                    <option value={90}>90 {t("dashboard.daysRemaining", { days: "" }).replace("{{days}}", "").trim()}</option>
                  </select>
                  
                  {/* Type filter */}
                  <select
                    className="rounded-md border-gray-300 dark:border-gray-600 py-1.5 pl-2 pr-8 text-xs text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700"
                    value={expiringTypeFilter}
                    onChange={(e) => setExpiringTypeFilter(e.target.value as SubscriptionType | "all")}
                  >
                    <option value="all">{t("filters.allTypes")}</option>
                    <option value="vehicle">{t("subscriptionTypes.vehicle")}</option>
                    <option value="membership">{t("subscriptionTypes.membership")}</option>
                    <option value="utility">{t("subscriptionTypes.utility")}</option>
                    <option value="insurance">{t("subscriptionTypes.insurance")}</option>
                    <option value="other">{t("subscriptionTypes.other")}</option>
                  </select>
                  
                  {/* Sort dropdown */}
                  <select
                    className="rounded-md border-gray-300 dark:border-gray-600 py-1.5 pl-2 pr-8 text-xs text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700"
                    value={`${expiringSortField}-${expiringSortDirection}`}
                    onChange={(e) => {
                      const [field, dir] = e.target.value.split('-') as [ExpiringSortField, 'asc' | 'desc'];
                      setExpiringSortField(field);
                      setExpiringSortDirection(dir);
                    }}
                  >
                    <option value="endDate-asc">{t("subscription.endDate")} ↑</option>
                    <option value="endDate-desc">{t("subscription.endDate")} ↓</option>
                    <option value="name-asc">{t("subscription.name")} A-Z</option>
                    <option value="name-desc">{t("subscription.name")} Z-A</option>
                    <option value="amount-asc">{t("subscription.amount")} ↑</option>
                    <option value="amount-desc">{t("subscription.amount")} ↓</option>
                    <option value="type-asc">{t("subscription.type")} A-Z</option>
                    <option value="type-desc">{t("subscription.type")} Z-A</option>
                  </select>
                </div>
              </div>
            </div>
            
            {expiringSubscriptions.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("No subscriptions found")}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {expiringSubscriptions.map((subscription) => {
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
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 mr-2">
                              {t(`subscriptionTypes.${subscription.type}`)}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {subscription.provider}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {new Intl.NumberFormat('default', {
                              style: 'currency',
                              currency: subscription.currency || 'INR',
                            }).format(subscription.amount)}
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
            )}
          </div>
        </div>
      )}

      {/* Recently Added Subscriptions */}
      {(recentSubscriptions.length > 0 || recentTypeFilter !== "all") && (
        <div className="mt-8 mb-6">
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                    {t("dashboard.recentlyAdded")}
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                    {t("dashboard.recentlyAddedDescription")}
                  </p>
                </div>
                
                {/* Filters and Sort for Recent Subscriptions */}
                <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
                  {/* Type filter */}
                  <select
                    className="rounded-md border-gray-300 dark:border-gray-600 py-1.5 pl-2 pr-8 text-xs text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700"
                    value={recentTypeFilter}
                    onChange={(e) => setRecentTypeFilter(e.target.value as SubscriptionType | "all")}
                  >
                    <option value="all">{t("filters.allTypes")}</option>
                    <option value="vehicle">{t("subscriptionTypes.vehicle")}</option>
                    <option value="membership">{t("subscriptionTypes.membership")}</option>
                    <option value="utility">{t("subscriptionTypes.utility")}</option>
                    <option value="insurance">{t("subscriptionTypes.insurance")}</option>
                    <option value="other">{t("subscriptionTypes.other")}</option>
                  </select>
                  
                  {/* Sort dropdown */}
                  <select
                    className="rounded-md border-gray-300 dark:border-gray-600 py-1.5 pl-2 pr-8 text-xs text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700"
                    value={`${recentSortField}-${recentSortDirection}`}
                    onChange={(e) => {
                      const [field, dir] = e.target.value.split('-') as [RecentSortField, 'asc' | 'desc'];
                      setRecentSortField(field);
                      setRecentSortDirection(dir);
                    }}
                  >
                    <option value="createdAt-desc">{t("filters.createdAt")} ↓</option>
                    <option value="createdAt-asc">{t("filters.createdAt")} ↑</option>
                    <option value="name-asc">{t("subscription.name")} A-Z</option>
                    <option value="name-desc">{t("subscription.name")} Z-A</option>
                    <option value="amount-asc">{t("subscription.amount")} ↑</option>
                    <option value="amount-desc">{t("subscription.amount")} ↓</option>
                    <option value="type-asc">{t("subscription.type")} A-Z</option>
                    <option value="type-desc">{t("subscription.type")} Z-A</option>
                  </select>
                </div>
              </div>
            </div>
            
            {recentSubscriptions.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("No subscriptions found")}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentSubscriptions.map((subscription) => {
                const isExpired = new Date(subscription.endDate) < currentDate;
                const createdDate = subscription.createdAt ? new Date(subscription.createdAt) : null;
                
                return (
                  <li key={subscription.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <h4 className="text-md font-medium text-gray-900 dark:text-white">
                          {subscription.name}
                        </h4>
                        <div className="flex items-center mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 mr-2">
                            {t(`subscriptionTypes.${subscription.type}`)}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {subscription.provider}
                          </span>
                        </div>
                        {createdDate && (
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {t("dashboard.addedOn")} {new Intl.DateTimeFormat('default', { dateStyle: 'medium' }).format(createdDate)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center">
                        <div className="mr-4 text-right">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Intl.NumberFormat('default', {
                              style: 'currency',
                              currency: subscription.currency || 'INR',
                            }).format(subscription.amount || 0)}
                          </div>
                          <div className={`text-sm ${isExpired ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            {isExpired ? t("dashboard.expired") : t("dashboard.active")}
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
            )}
            <div className="px-4 py-3 sm:px-6 border-t border-gray-200 dark:border-gray-700 text-center">
              <Link
                to="/subscriptions"
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                {t("dashboard.viewAllSubscriptions")}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* No Subscriptions Yet Message - only show if there are no subscriptions at all */}
      {subscriptions.length === 0 && (
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-6 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">
              {t("dashboard.noSubscriptionsYet")}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("dashboard.addFirstSubscription")}
            </p>
            <div className="mt-6">
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

      {/* QR Scanner Modal */}
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
      
      {/* Mobile floating action button - visible on mobile only */}
      <button
        onClick={() => setShowQRScanner(true)}
        className="sm:hidden fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
        aria-label={t("subscription.scanQROrPDF")}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-6 w-6" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
      </button>
    </div>
  );
} 