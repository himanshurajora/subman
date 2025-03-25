import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { db, collection, doc, setDoc } from "../../firebase";
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

  const handleSubmit = async (data: SubscriptionFormFields) => {
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
    </div>
  );
} 