import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { db, doc, getDoc, updateDoc } from "../../firebase";
import { Subscription, SubscriptionFormFields } from "../../types";
import { SubscriptionForm } from "../../components/Subscription/SubscriptionForm";

export function EditSubscription() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
          setError("You don't have permission to edit this subscription");
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

  const handleSubmit = async (formData: SubscriptionFormFields) => {
    if (!currentUser || !id) return;

    try {
      setSaving(true);
      setError("");

      const subscriptionRef = doc(db, "subscriptions", id);
      
      // Add timestamps to the data
      const updatedData = {
        ...formData,
        updatedAt: new Date().toISOString(),
      };

      // Save to Firestore with retry logic
      let retries = 3;
      while (retries > 0) {
        try {
          await updateDoc(subscriptionRef, updatedData);
          // Success - navigate to view subscription
          navigate(`/subscriptions/${id}`);
          return;
        } catch (saveError: any) {
          // If we have retries left and this is a network error, try again
          if (retries > 1 && 
              (saveError.code === 'unavailable' || 
               saveError.code === 'deadline-exceeded' ||
               saveError.message?.includes('network'))) {
            console.log(`Retrying update operation. Attempts left: ${retries - 1}`);
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
      console.error("Error updating subscription:", error);
      let errorMessage = "Failed to update subscription. Please try again.";
      
      // Provide more specific error messages
      if (error.code === 'permission-denied') {
        errorMessage = "You don't have permission to update this subscription.";
      } else if (error.code === 'unavailable' || error.message?.includes('network')) {
        errorMessage = "Network error. Please check your connection and try again.";
      }
      
      setError(errorMessage);
      setSaving(false);
    }
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
        <button
          onClick={() => navigate("/subscriptions")}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {t("Back to Subscriptions")}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t("Edit Subscription")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t("Update the details for")} {subscription?.name}
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900 p-4 rounded-md">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {subscription && (
        <SubscriptionForm
          initialData={subscription}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/subscriptions/${id}`)}
          isLoading={saving}
        />
      )}
    </div>
  );
} 