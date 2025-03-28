import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { db, collection, doc, setDoc, query, where, getDocs } from "../../firebase";
import { SubscriptionFormFields, QRCodeData } from "../../types";
import { SubscriptionForm } from "../../components/Subscription/SubscriptionForm";

export function AddSubscription() {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const [initialData, setInitialData] = useState<Partial<SubscriptionFormFields>>({});
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [pendingData, setPendingData] = useState<SubscriptionFormFields | null>(null);

  // Check if we have QR scan data in location state
  useEffect(() => {
    if (location.state?.prefillData) {
      const qrData = location.state.prefillData as QRCodeData;
      console.log("Received QR data:", JSON.stringify(qrData, null, 2));
      
      if (qrData.type && qrData.data) {
        // Pre-fill form with QR data - merge type and data fields
        const formData: Partial<SubscriptionFormFields> = {
          ...qrData.data,
          type: qrData.type
        };
        
        console.log("Setting form data:", JSON.stringify(formData, null, 2));
        setInitialData(formData);
      } else {
        console.error("Invalid QR data format. Expected {type, data} but got:", qrData);
      }
    }
  }, [location.state]);

  const checkForDuplicateUniqId = async (uniqId: string) => {
    if (!uniqId || !currentUser) return false;
    
    try {
      // Query for subscriptions with the same uniqId belonging to this user
      const q = query(
        collection(db, "subscriptions"),
        where("userId", "==", currentUser.uid),
        where("uniqId", "==", uniqId)
      );
      
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error("Error checking for duplicate uniqId:", error);
      return false;
    }
  };

  const saveSubscription = async (data: SubscriptionFormFields) => {
    if (!currentUser) return;

    try {
      setLoading(true);
      setError("");

      // Create a new document reference
      const subscriptionsRef = collection(db, "subscriptions");
      const newSubscriptionRef = doc(subscriptionsRef);

      // Add user ID and timestamps to the data
      const subscriptionData = {
        ...data,
        userId: currentUser.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to Firestore with retry logic
      let retries = 3;
      while (retries > 0) {
        try {
          await setDoc(newSubscriptionRef, subscriptionData);
          // Success - navigate back to subscriptions list
          navigate("/subscriptions");
          return;
        } catch (saveError: any) {
          // If we have retries left and this is a network error, try again
          if (retries > 1 && 
              (saveError.code === 'unavailable' || 
               saveError.code === 'deadline-exceeded' ||
               saveError.message?.includes('network'))) {
            console.log(`Retrying save operation. Attempts left: ${retries - 1}`);
            retries--;
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            // Either no retries left or not a network error, so rethrow
            throw saveError;
          }
        }
      }
    } catch (error: any) {
      console.error("Error adding subscription:", error);
      let errorMessage = "Failed to add subscription. Please try again.";
      
      // Provide more specific error messages
      if (error.code === 'permission-denied') {
        errorMessage = "You don't have permission to add subscriptions.";
      } else if (error.code === 'unavailable' || error.message?.includes('network')) {
        errorMessage = "Network error. Please check your connection and try again.";
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: SubscriptionFormFields) => {
    if (!currentUser) return;

    try {
      setLoading(true);
      
      // Skip the duplicate check if no uniqId is provided
      if (!data.uniqId) {
        await saveSubscription(data);
        return;
      }

      // Check if this uniqId already exists in the user's subscriptions
      const isDuplicate = await checkForDuplicateUniqId(data.uniqId);
      
      if (isDuplicate) {
        // Store data and show warning
        setPendingData(data);
        setShowDuplicateWarning(true);
        setLoading(false);
      } else {
        // No duplicate, proceed with save
        await saveSubscription(data);
      }
    } catch (error) {
      console.error("Error checking for duplicate:", error);
      // Fall back to direct save if checking fails
      await saveSubscription(data);
    }
  };

  const handleDuplicateConfirm = async () => {
    if (pendingData) {
      setShowDuplicateWarning(false);
      await saveSubscription(pendingData);
    }
  };

  const handleDuplicateCancel = () => {
    setShowDuplicateWarning(false);
    setPendingData(null);
    setLoading(false);
  };

  const handleCancel = () => {
    navigate("/subscriptions");
  };

  return (
    <div className="max-w-3xl mx-auto px-1 sm:px-4 py-3 sm:py-6">
      <div className="mb-3 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          {t("Add New Subscription")}
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
          {t("Fill in the details to add a new subscription")}
        </p>
      </div>

      {error && (
        <div className="mb-3 sm:mb-6 bg-red-50 dark:bg-red-900 p-2 sm:p-4 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <SubscriptionForm
        initialData={initialData}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={loading}
      />

      {/* Duplicate Warning Modal */}
      {showDuplicateWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-auto">
            <div className="flex items-center justify-center mb-4 text-amber-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h3 className="text-lg font-medium text-gray-900 dark:text-white text-center mb-2">
              {t("Duplicate Document Detected")}
            </h3>
            
            <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
              {t("A similar document has already been added to your subscriptions. Are you sure you would like to proceed with adding this document?")}
            </p>
            
            <div className="flex justify-center space-x-4">
              <button
                onClick={handleDuplicateCancel}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                {t("Cancel")}
              </button>
              
              <button
                onClick={handleDuplicateConfirm}
                className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors"
              >
                {t("Proceed")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 