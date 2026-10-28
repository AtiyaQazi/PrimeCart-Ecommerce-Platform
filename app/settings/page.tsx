
"use client";

import { useEffect, useState } from "react";
import {
  User,
  Bell,
  Shield,
  Store,
  Save,
} from "lucide-react";

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import DashboardLayout from "../../components/layout/DashboardLayout";
import { db } from "../../lib/firestore";
import { auth } from "../../lib/firebase";

interface SettingsData {
  storeName: string;
  adminEmail: string;
  notifications: boolean;
}

const defaultSettings: SettingsData = {
  storeName: "PrimeCart Store",
  adminEmail: "",
  notifications: true,
};

export default function SettingsPage() {
  const [storeName, setStoreName] = useState(
    defaultSettings.storeName
  );

  const [email, setEmail] = useState(
    defaultSettings.adminEmail
  );

  const [notifications, setNotifications] = useState(
    defaultSettings.notifications
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // LOAD SETTINGS
  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      try {
        setLoading(true);
        setError("");

        const user = auth.currentUser;

        if (!user) {
          if (mounted) {
            setError(
              "You must be logged in to view settings."
            );
            setLoading(false);
          }

          return;
        }

        const settingsRef = doc(
          db,
          "settings",
          user.uid
        );

        const snapshot = await getDoc(settingsRef);

        if (!mounted) return;

        if (snapshot.exists()) {
          const data = snapshot.data();

          setStoreName(
            typeof data.storeName === "string"
              ? data.storeName
              : defaultSettings.storeName
          );

          setEmail(
            typeof data.adminEmail === "string"
              ? data.adminEmail
              : user.email || ""
          );

          setNotifications(
            typeof data.notifications === "boolean"
              ? data.notifications
              : defaultSettings.notifications
          );
        } else {
          setStoreName(defaultSettings.storeName);
          setEmail(user.email || "");
          setNotifications(defaultSettings.notifications);
        }
      } catch (err) {
        console.error("Error loading settings:", err);

        if (mounted) {
          setError(
            "Failed to load settings. Please refresh the page."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  // SAVE SETTINGS
  const handleSave = async () => {
    try {
      setSaving(true);
      setSaved(false);
      setError("");

      const user = auth.currentUser;

      if (!user) {
        setError(
          "You must be logged in to save settings."
        );
        return;
      }

      const trimmedStoreName = storeName.trim();
      const trimmedEmail = email.trim();

      if (!trimmedStoreName) {
        setError("Store name cannot be empty.");
        return;
      }

      if (!trimmedEmail) {
        setError("Admin email cannot be empty.");
        return;
      }

      const settingsRef = doc(
        db,
        "settings",
        user.uid
      );

      await setDoc(
        settingsRef,
        {
          storeName: trimmedStoreName,
          adminEmail: trimmedEmail,
          notifications,
          updatedAt: serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      setSaved(true);
    } catch (err) {
      console.error("Error saving settings:", err);

      setError(
        "Failed to save settings. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  // Automatically hide the success message.
  useEffect(() => {
    if (!saved) return;

    const timeout = setTimeout(() => {
      setSaved(false);
    }, 2500);

    return () => clearTimeout(timeout);
  }, [saved]);

  return (
    <DashboardLayout>
      <main className="min-h-screen bg-[#F4EBDD] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          {/* PAGE HEADER */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-[#111111]">
              Settings
            </h1>

            <p className="mt-2 text-sm text-[#6B706C]">
              Manage your store and account preferences.
            </p>
          </div>

          {/* ERROR MESSAGE */}
          {error && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            >
              {error}
            </div>
          )}

          {/* STORE INFORMATION */}
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <SectionHeader
              icon={<Store size={21} />}
              title="Store Information"
              description="Basic store details and contact information."
            />

            <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
              <Field
                label="Store Name"
                value={storeName}
                onChange={setStoreName}
                disabled={loading || saving}
              />

              <Field
                label="Admin Email"
                value={email}
                onChange={setEmail}
                type="email"
                disabled={loading || saving}
              />
            </div>
          </section>

          {/* ACCOUNT SETTINGS */}
          <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
            <SectionHeader
              icon={<User size={21} />}
              title="Account Settings"
              description="Manage your notification preferences and account security."
            />

            <div className="space-y-0 px-5 sm:px-6">
              {/* EMAIL NOTIFICATIONS */}
              <SettingRow
                icon={<Bell size={19} />}
                title="Email Notifications"
                description="Receive notifications about orders and store activity."
              >
                {loading ? (
                  <div
                    className="h-6 w-11 shrink-0 animate-pulse rounded-full bg-[#DEDAD1]"
                    aria-label="Loading notification settings"
                  />
                ) : (
                  <button
                    type="button"
                    aria-label="Toggle email notifications"
                    aria-pressed={notifications}
                    disabled={saving}
                    onClick={() => {
                      setNotifications((current) => !current);
                      setSaved(false);
                    }}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                      notifications
                        ? "bg-[#355E4B]"
                        : "bg-[#C9C5BC]"
                    } ${
                      saving
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200 ${
                        notifications ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                )}
              </SettingRow>

              {/* ACCOUNT SECURITY */}
              <SettingRow
                icon={<Shield size={19} />}
                title="Account Security"
                description="Your account is protected by Firebase authentication."
              >
                <span className="shrink-0 rounded-full bg-[#E6F3EC] px-3 py-1 text-xs font-semibold text-[#286044]">
                  Protected
                </span>
              </SettingRow>
            </div>
          </section>

          {/* SAVE SETTINGS */}
          <div className="mt-6 flex flex-col-reverse items-stretch justify-end gap-3 sm:flex-row sm:items-center">
            {saved && (
              <span
                role="status"
                className="text-sm font-medium text-[#286044]"
              >
                Settings saved successfully.
              </span>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#355E4B] px-5 text-sm font-semibold text-white transition hover:bg-[#284B3A] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={17} />

              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}

/* SECTION HEADER */

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-[#ECE7DE] p-5 sm:p-6">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E8F2EC] text-[#355E4B]">
        {icon}
      </div>

      <div className="min-w-0">
        <h2 className="text-lg font-bold text-[#111111]">
          {title}
        </h2>

        <p className="mt-1 text-sm text-[#727771]">
          {description}
        </p>
      </div>
    </div>
  );
}

/* INPUT FIELD */

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div className="min-w-0">
      <label className="mb-2 block text-sm font-semibold text-[#222222]">
        {label}
      </label>

      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-[#D8D4CB] bg-white px-4 text-sm text-[#111111] outline-none transition placeholder:text-[#858981] focus:border-[#355E4B] focus:ring-2 focus:ring-[#355E4B]/10 disabled:cursor-not-allowed disabled:bg-[#F1EEE8] disabled:text-[#777D78]"
      />
    </div>
  );
}

/* SETTINGS ROW */

function SettingRow({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 border-b border-[#ECE7DE] py-5 last:border-b-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 shrink-0 text-[#355E4B]">
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#222222]">
            {title}
          </p>

          <p className="mt-1 text-sm leading-5 text-[#727771]">
            {description}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center self-end sm:self-auto">
        {children}
      </div>
    </div>
  );
}
