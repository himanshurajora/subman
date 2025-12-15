import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { collection, db, getDocs, query, where, orderBy } from "../../firebase";
import { Subscription, SubscriptionType } from "../../types";

// Sort field types
type SortField = 'name' | 'type' | 'provider' | 'amount' | 'startDate' | 'endDate' | 'createdAt';

export function Subscriptions() {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [error, setError] = useState("");
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired">("all");
  const [typeFilter, setTypeFilter] = useState<SubscriptionType | "all">("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<{ startDate: string; endDate: string }>({ startDate: "", endDate: "" });
  const [amountRangeFilter, setAmountRangeFilter] = useState<{ min: string; max: string }>({ min: "", max: "" });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Derive unique providers and currencies from subscriptions for filter dropdowns
  const uniqueProviders = useMemo(() => {
    const providers = [...new Set(subscriptions.map(sub => sub.provider).filter(Boolean))];
    return providers.sort();
  }, [subscriptions]);

  const uniqueCurrencies = useMemo(() => {
    const currencies = [...new Set(subscriptions.map(sub => sub.currency).filter(Boolean))];
    return currencies.sort();
  }, [subscriptions]);

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

  // Format date function
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('default', { 
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  };

  // Handle sort click - supports all sortable fields
  const handleSortClick = (field: SortField) => {
    if (sortField === field) {
      // If already sorting by this field, toggle direction
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // If sorting by a new field, set it with default desc direction
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setTypeFilter("all");
    setProviderFilter("all");
    setCurrencyFilter("all");
    setDateRangeFilter({ startDate: "", endDate: "" });
    setAmountRangeFilter({ min: "", max: "" });
    setCurrentPage(1);
  };

  // Check if any filters are active
  const hasActiveFilters = searchTerm || statusFilter !== "all" || typeFilter !== "all" || 
    providerFilter !== "all" || currencyFilter !== "all" || 
    dateRangeFilter.startDate || dateRangeFilter.endDate ||
    amountRangeFilter.min || amountRangeFilter.max;

  // Filter and search subscriptions with enhanced filtering
  const filteredSubscriptions = subscriptions
    .filter(sub => {
      const currentDate = new Date();
      const endDate = new Date(sub.endDate);
      const isActive = endDate >= currentDate;
      
      // Status filter
      if (statusFilter === "active" && !isActive) return false;
      if (statusFilter === "expired" && isActive) return false;
      
      // Type filter
      if (typeFilter !== "all" && sub.type !== typeFilter) return false;
      
      // Provider filter
      if (providerFilter !== "all" && sub.provider !== providerFilter) return false;
      
      // Currency filter
      if (currencyFilter !== "all" && sub.currency !== currencyFilter) return false;
      
      // Date range filter (based on end date)
      if (dateRangeFilter.startDate) {
        const filterStart = new Date(dateRangeFilter.startDate);
        if (endDate < filterStart) return false;
      }
      if (dateRangeFilter.endDate) {
        const filterEnd = new Date(dateRangeFilter.endDate);
        if (endDate > filterEnd) return false;
      }
      
      // Amount range filter
      if (amountRangeFilter.min) {
        const minAmount = parseFloat(amountRangeFilter.min);
        if (!isNaN(minAmount) && sub.amount < minAmount) return false;
      }
      if (amountRangeFilter.max) {
        const maxAmount = parseFloat(amountRangeFilter.max);
        if (!isNaN(maxAmount) && sub.amount > maxAmount) return false;
      }
      
      return true;
    })
    .filter(sub => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        sub.name.toLowerCase().includes(term) ||
        sub.provider.toLowerCase().includes(term) ||
        sub.type.toLowerCase().includes(term) ||
        (sub.notes && sub.notes.toLowerCase().includes(term)) ||
        (sub.vehicleNumber && sub.vehicleNumber.toLowerCase().includes(term)) ||
        (sub.policyNumber && sub.policyNumber.toLowerCase().includes(term)) ||
        (sub.membershipId && sub.membershipId.toLowerCase().includes(term)) ||
        (sub.accountNumber && sub.accountNumber.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'provider':
          comparison = a.provider.localeCompare(b.provider);
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'startDate':
          comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
          break;
        case 'endDate':
          comparison = new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
          break;
        case 'createdAt':
        default: {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          comparison = dateA - dateB;
          break;
        }
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  // Calculate pagination
  const totalPages = Math.ceil(filteredSubscriptions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSubscriptions = filteredSubscriptions.slice(startIndex, startIndex + itemsPerPage);

  // Reset to first page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, providerFilter, currencyFilter, dateRangeFilter, amountRangeFilter]);

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>, subscriptionId: string) => {
    // Check if the click was on or inside an action button
    const isActionButton = (e.target as HTMLElement).closest('.action-button');
    if (!isActionButton) {
      navigate(`/subscriptions/${subscriptionId}`);
    }
  };

  // Pagination component
  const Pagination = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 sm:px-6">
        <div className="flex flex-1 justify-between sm:hidden">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="relative inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            {t("Previous")}
          </button>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            {t("Next")}
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t("Showing")} <span className="font-medium">{startIndex + 1}</span> {t("to")}{" "}
              <span className="font-medium">
                {Math.min(startIndex + itemsPerPage, filteredSubscriptions.length)}
              </span>{" "}
              {t("of")} <span className="font-medium">{filteredSubscriptions.length}</span>{" "}
              {t("results")}
            </p>
          </div>
          <div>
            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 dark:text-gray-500 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
              >
                <span className="sr-only">{t("Previous")}</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                </svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  // Show first page, last page, current page, and pages around current page
                  return (
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1
                  );
                })
                .map((page, index, array) => {
                  // Add ellipsis where there are gaps
                  if (index > 0 && page - array[index - 1] > 1) {
                    return (
                      <span
                        key={`ellipsis-${page}`}
                        className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:outline-offset-0"
                      >
                        ...
                      </span>
                    );
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 focus:outline-offset-0 ${
                        currentPage === page
                          ? "z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                          : "text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 dark:text-gray-500 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
              >
                <span className="sr-only">{t("Next")}</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </button>
            </nav>
          </div>
        </div>
      </div>
    );
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t("navigation.subscriptions")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t("Manage all your subscriptions in one place")}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900 p-4 rounded-md mb-6">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          {/* Main search and quick filters row */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="w-full sm:max-w-md">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="text"
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 pl-10 pr-12 py-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 shadow-sm transition-colors text-sm sm:text-base"
                  placeholder={t("filters.searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto mt-3 sm:mt-0">
              {/* Status Filter */}
              <div className="w-full sm:w-40">
                <select
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 py-2 pl-3 pr-10 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 dark:bg-gray-700 shadow-sm transition-colors"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "expired")}
                >
                  <option value="all">{t("filters.allStatus")}</option>
                  <option value="active">{t("filters.active")}</option>
                  <option value="expired">{t("filters.expired")}</option>
                </select>
              </div>
              
              {/* Type Filter */}
              <div className="w-full sm:w-40">
                <select
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 py-2 pl-3 pr-10 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 dark:bg-gray-700 shadow-sm transition-colors"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as SubscriptionType | "all")}
                >
                  <option value="all">{t("filters.allTypes")}</option>
                  <option value="vehicle">{t("subscriptionTypes.vehicle")}</option>
                  <option value="membership">{t("subscriptionTypes.membership")}</option>
                  <option value="utility">{t("subscriptionTypes.utility")}</option>
                  <option value="insurance">{t("subscriptionTypes.insurance")}</option>
                  <option value="other">{t("subscriptionTypes.other")}</option>
                </select>
              </div>
              
              {/* Advanced Filters Toggle */}
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md shadow-sm transition-colors ${
                  showAdvancedFilters || hasActiveFilters
                    ? 'border-indigo-500 text-indigo-600 bg-indigo-50 dark:bg-indigo-900 dark:text-indigo-200'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                </svg>
                {t("filters.advancedFilters")}
                {hasActiveFilters && (
                  <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-600 text-white">
                    !
                  </span>
                )}
              </button>
              
              <Link
                to="/subscriptions/add"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                {t("subscription.add")}
              </Link>
            </div>
          </div>
          
          {/* Advanced Filters Panel */}
          {showAdvancedFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Provider Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("filters.provider")}
                  </label>
                  <select
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 py-2 pl-3 pr-10 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 dark:bg-gray-700 shadow-sm transition-colors"
                    value={providerFilter}
                    onChange={(e) => setProviderFilter(e.target.value)}
                  >
                    <option value="all">{t("filters.allProviders")}</option>
                    {uniqueProviders.map(provider => (
                      <option key={provider} value={provider}>{provider}</option>
                    ))}
                  </select>
                </div>
                
                {/* Currency Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("filters.currency")}
                  </label>
                  <select
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 py-2 pl-3 pr-10 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 dark:bg-gray-700 shadow-sm transition-colors"
                    value={currencyFilter}
                    onChange={(e) => setCurrencyFilter(e.target.value)}
                  >
                    <option value="all">{t("filters.allCurrencies")}</option>
                    {uniqueCurrencies.map(currency => (
                      <option key={currency} value={currency}>{currency}</option>
                    ))}
                  </select>
                </div>
                
                {/* Amount Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("filters.amountRange")}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder={t("filters.min")}
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 py-2 px-3 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 dark:bg-gray-700 shadow-sm transition-colors"
                      value={amountRangeFilter.min}
                      onChange={(e) => setAmountRangeFilter(prev => ({ ...prev, min: e.target.value }))}
                    />
                    <input
                      type="number"
                      placeholder={t("filters.max")}
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 py-2 px-3 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 dark:bg-gray-700 shadow-sm transition-colors"
                      value={amountRangeFilter.max}
                      onChange={(e) => setAmountRangeFilter(prev => ({ ...prev, max: e.target.value }))}
                    />
                  </div>
                </div>
                
                {/* Date Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("filters.endDateRange")}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 py-2 px-3 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 dark:bg-gray-700 shadow-sm transition-colors"
                      value={dateRangeFilter.startDate}
                      onChange={(e) => setDateRangeFilter(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                    <input
                      type="date"
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 py-2 px-3 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 dark:bg-gray-700 shadow-sm transition-colors"
                      value={dateRangeFilter.endDate}
                      onChange={(e) => setDateRangeFilter(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              
              {/* Clear Filters Button */}
              {hasActiveFilters && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={clearAllFilters}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    {t("filters.clearAll")}
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* Active filters summary */}
          {hasActiveFilters && !showAdvancedFilters && (
            <div className="mt-3 flex flex-wrap gap-2">
              {searchTerm && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                  {t("filters.search")}: {searchTerm}
                  <button onClick={() => setSearchTerm('')} className="ml-1 hover:text-indigo-600" aria-label={t("filters.removeFilter")}>×</button>
                </span>
              )}
              {statusFilter !== "all" && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  {t("filters.status")}: {t(`filters.${statusFilter}`)}
                  <button onClick={() => setStatusFilter("all")} className="ml-1 hover:text-green-600" aria-label={t("filters.removeFilter")}>×</button>
                </span>
              )}
              {typeFilter !== "all" && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  {t("filters.type")}: {t(`subscriptionTypes.${typeFilter}`)}
                  <button onClick={() => setTypeFilter("all")} className="ml-1 hover:text-purple-600" aria-label={t("filters.removeFilter")}>×</button>
                </span>
              )}
              {providerFilter !== "all" && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                  {t("filters.provider")}: {providerFilter}
                  <button onClick={() => setProviderFilter("all")} className="ml-1 hover:text-yellow-600" aria-label={t("filters.removeFilter")}>×</button>
                </span>
              )}
              {currencyFilter !== "all" && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {t("filters.currency")}: {currencyFilter}
                  <button onClick={() => setCurrencyFilter("all")} className="ml-1 hover:text-blue-600" aria-label={t("filters.removeFilter")}>×</button>
                </span>
              )}
              {(amountRangeFilter.min || amountRangeFilter.max) && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200">
                  {t("filters.amount")}: {amountRangeFilter.min || '0'} - {amountRangeFilter.max || t("filters.noLimit")}
                  <button onClick={() => setAmountRangeFilter({ min: '', max: '' })} className="ml-1 hover:text-pink-600" aria-label={t("filters.removeFilter")}>×</button>
                </span>
              )}
              {(dateRangeFilter.startDate || dateRangeFilter.endDate) && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                  {t("filters.dateRange")}: {dateRangeFilter.startDate || '...'} - {dateRangeFilter.endDate || '...'}
                  <button onClick={() => setDateRangeFilter({ startDate: '', endDate: '' })} className="ml-1 hover:text-orange-600" aria-label={t("filters.removeFilter")}>×</button>
                </span>
              )}
              <button
                onClick={clearAllFilters}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {t("filters.clearAll")}
              </button>
            </div>
          )}
        </div>
        
        {paginatedSubscriptions.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              {t("No subscriptions found")}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchTerm
                ? t("Try adjusting your search or filter to find what you're looking for")
                : t("Get started by creating a new subscription")}
            </p>
            {!searchTerm && (
              <div className="mt-6">
                <Link
                  to="/subscriptions/add"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  {t("Add Subscription")}
                </Link>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:text-indigo-500 dark:hover:text-indigo-400"
                      onClick={() => handleSortClick('name')}
                    >
                      <div className="flex items-center">
                        {t("subscription.name")}
                        {sortField === 'name' && (
                          <svg 
                            className={`ml-1 h-4 w-4 transition-transform ${sortDirection === 'desc' ? 'transform rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:text-indigo-500 dark:hover:text-indigo-400"
                      onClick={() => handleSortClick('type')}
                    >
                      <div className="flex items-center">
                        {t("subscription.type")}
                        {sortField === 'type' && (
                          <svg 
                            className={`ml-1 h-4 w-4 transition-transform ${sortDirection === 'desc' ? 'transform rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:text-indigo-500 dark:hover:text-indigo-400"
                      onClick={() => handleSortClick('provider')}
                    >
                      <div className="flex items-center">
                        {t("subscription.provider")}
                        {sortField === 'provider' && (
                          <svg 
                            className={`ml-1 h-4 w-4 transition-transform ${sortDirection === 'desc' ? 'transform rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:text-indigo-500 dark:hover:text-indigo-400"
                      onClick={() => handleSortClick('amount')}
                    >
                      <div className="flex items-center">
                        {t("subscription.amount")}
                        {sortField === 'amount' && (
                          <svg 
                            className={`ml-1 h-4 w-4 transition-transform ${sortDirection === 'desc' ? 'transform rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:text-indigo-500 dark:hover:text-indigo-400"
                      onClick={() => handleSortClick('endDate')}
                    >
                      <div className="flex items-center">
                        {t("subscription.endDate")}
                        {sortField === 'endDate' && (
                          <svg 
                            className={`ml-1 h-4 w-4 transition-transform ${sortDirection === 'desc' ? 'transform rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t("filters.status")}
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:text-indigo-500 dark:hover:text-indigo-400"
                      onClick={() => handleSortClick('createdAt')}
                    >
                      <div className="flex items-center">
                        {t("filters.createdAt")}
                        {sortField === 'createdAt' && (
                          <svg 
                            className={`ml-1 h-4 w-4 transition-transform ${sortDirection === 'desc' ? 'transform rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {t("filters.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedSubscriptions.map((subscription) => {
                    const isExpired = new Date(subscription.endDate) < new Date();
                    return (
                      <tr 
                        key={subscription.id}
                        onClick={(e) => handleRowClick(e, subscription.id)}
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {subscription.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                            {t(`subscriptionTypes.${subscription.type}`)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {subscription.provider}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {new Intl.NumberFormat('default', {
                            style: 'currency',
                            currency: subscription.currency,
                          }).format(subscription.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(subscription.endDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isExpired ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                              {t("filters.expired")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              {t("filters.active")}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {subscription.createdAt ? formatDate(subscription.createdAt) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link 
                            to={`/subscriptions/${subscription.id}`} 
                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-4 action-button"
                          >
                            {t("common.view")}
                          </Link>
                          <Link 
                            to={`/subscriptions/${subscription.id}/edit`} 
                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 action-button"
                          >
                            {t("common.edit")}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <Pagination />
          </>
        )}
      </div>
    </div>
  );
} 