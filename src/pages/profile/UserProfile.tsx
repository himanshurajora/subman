import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { db, doc, getDoc, updateDoc } from "../../firebase";
import { User } from "../../types";
import { Button } from "../../components/UI/Button";

export function UserProfile() {
  const { t } = useTranslation();
  const { currentUser, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [userProfile, setUserProfile] = useState<Partial<User>>({
    displayName: "",
    email: "",
    language: "en",
    theme: "light",
  });

  useEffect(() => {
    async function fetchUserProfile() {
      if (!currentUser) {
        navigate("/login");
        return;
      }

      try {
        setLoading(true);
        setError("");
        
        // Fetch user data from Firestore
        const userRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          setUserProfile({
            displayName: userData.displayName || currentUser.displayName || "",
            email: currentUser.email || "",
            language: userData.language || "en",
            theme: userData.theme || "light",
          });
        } else {
          // If no user document exists, use data from auth
          setUserProfile({
            displayName: currentUser.displayName || "",
            email: currentUser.email || "",
            language: "en",
            theme: "light",
          });
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        setError("Failed to load profile. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchUserProfile();
  }, [currentUser, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setUserProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      // Retry logic for profile updates
      const updateWithRetry = async (operation: () => Promise<void>, errorMsg: string) => {
        let retries = 3;
        while (retries > 0) {
          try {
            await operation();
            return true;
          } catch (error: any) {
            console.error(errorMsg, error);
            // If we have retries left and this is a network error, try again
            if (retries > 1 && 
                (error.code === 'unavailable' || 
                 error.code === 'deadline-exceeded' ||
                 error.message?.includes('network'))) {
              console.log(`Retrying operation. Attempts left: ${retries - 1}`);
              retries--;
              // Wait a bit before retrying
              await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
              // Either no retries left or not a network error, so rethrow
              throw error;
            }
          }
        }
        return false;
      };

      // Update Firebase Auth profile (display name, etc.)
      await updateWithRetry(
        async () => {
          await updateUserProfile({
            displayName: userProfile.displayName || "",
          });
        },
        "Error updating auth profile:"
      );

      // Update Firestore user document
      await updateWithRetry(
        async () => {
          const userRef = doc(db, "users", currentUser.uid);
          await updateDoc(userRef, {
            displayName: userProfile.displayName,
            language: userProfile.language,
            theme: userProfile.theme,
            updatedAt: new Date().toISOString(),
          });
        },
        "Error updating user document:"
      );

      setSuccess("Profile updated successfully");
      
      // Apply theme if changed
      if (userProfile.theme) {
        document.documentElement.classList.toggle('dark', userProfile.theme === 'dark');
      }
    } catch (error: any) {
      console.error("Error updating profile:", error);
      let errorMessage = "Failed to update profile. Please try again.";
      
      // Provide more specific error messages
      if (error.code === 'permission-denied') {
        errorMessage = "You don't have permission to update your profile.";
      } else if (error.code === 'unavailable' || error.message?.includes('network')) {
        errorMessage = "Network error. Please check your connection and try again.";
      }
      
      setError(errorMessage);
    } finally {
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t("Your Profile")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t("Manage your account settings and preferences")}
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900 p-4 rounded-md">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 dark:bg-green-900 p-4 rounded-md">
          <p className="text-green-800 dark:text-green-200">{success}</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("Display Name")}
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                value={userProfile.displayName || ""}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white dark:bg-gray-800"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("Email")}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                disabled
                value={userProfile.email || ""}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t("Email cannot be changed")}
              </p>
            </div>

            <div>
              <label htmlFor="language" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("Language")}
              </label>
              <select
                id="language"
                name="language"
                value={userProfile.language || "en"}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white dark:bg-gray-800"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
            </div>

            <div>
              <label htmlFor="theme" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("Theme")}
              </label>
              <select
                id="theme"
                name="theme"
                value={userProfile.theme || "light"}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white dark:bg-gray-800"
              >
                <option value="light">{t("Light")}</option>
                <option value="dark">{t("Dark")}</option>
              </select>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                disabled={saving}
              >
                {saving ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
} 