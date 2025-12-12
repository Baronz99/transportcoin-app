"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/* ===========================
   COUNTRY OPTIONS + AUTO-DETECTION
=========================== */

const COUNTRY_OPTIONS = [
  // North America
  "United States",
  "Canada",
  "Mexico",

  // South America
  "Brazil",
  "Argentina",
  "Chile",
  "Colombia",
  "Peru",

  // Europe – major markets
  "United Kingdom",
  "Ireland",
  "Germany",
  "France",
  "Netherlands",
  "Belgium",
  "Switzerland",
  "Austria",
  "Italy",
  "Spain",
  "Portugal",
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
  "Poland",
  "Czech Republic",
  "Greece",
  "Turkey",

  // Middle East
  "United Arab Emirates",
  "Saudi Arabia",
  "Qatar",
  "Kuwait",
  "Israel",

  // Asia – major markets
  "India",
  "Singapore",
  "Japan",
  "South Korea",
  "Hong Kong",
  "China",
  "Malaysia",
  "Indonesia",
  "Philippines",
  "Vietnam",
  "Thailand",

  // Oceania – Australia included
  "Australia",
  "New Zealand",

  // Africa – ONLY the two requested
  "South Africa",
  "Egypt",
];


function detectCountryFromTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (!tz) return "United States";

    if (tz.includes("America")) {
      if (tz.includes("Sao_Paulo")) return "Brazil";
      if (tz.includes("Argentina")) return "Argentina";
      if (tz.includes("Mexico")) return "Mexico";
      return "United States";
    }

    if (tz.includes("Europe")) return "United Kingdom";
    if (tz.includes("Africa")) return "South Africa"; // no Nigeria
    if (tz.includes("Asia")) return "India";
    if (tz.includes("Australia")) return "Australia";

    return "United States";
  } catch {
    return "United States";
  }
}


/* ===========================
   TYPES
=========================== */

type Profile = {
  fullName: string;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
};

type UserMeta = {
  email: string;
  tier?: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
};

/* ===========================
   PAGE
=========================== */

export default function SettingsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile>({
    fullName: "",
    phone: "",
    country: "United States",
    city: "",
  });

  const [userMeta, setUserMeta] = useState<UserMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("transportcoin_token")
      : null;

  /* ===========================
     AUTH CHECK
  =========================== */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = localStorage.getItem("transportcoin_token");
    if (!t) router.push("/login");
  }, [router]);

  /* ===========================
     LOAD PROFILE
  =========================== */
  useEffect(() => {
    if (!token) return;

    setLoading(true);

    fetch("/api/profile", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          if (
            data.error === "Unauthorized" ||
            data.error === "User not found"
          ) {
            localStorage.removeItem("transportcoin_token");
            router.push("/login");
          }
          return;
        }

        const detected = detectCountryFromTimezone();

        if (data.profile) {
          setProfile({
            fullName: data.profile.fullName ?? "",
            phone: data.profile.phone ?? "",
            country: data.profile.country || detected,
            city: data.profile.city ?? "",
          });
        }

        if (data.user) {
          setUserMeta({
            email: data.user.email,
            tier: data.user.tier,
            createdAt: data.user.createdAt,
            lastLoginAt: data.user.lastLoginAt,
          });
        }
      })
      .finally(() => setLoading(false));
  }, [token, router]);

  /* ===========================
     INPUT HANDLER
  =========================== */
  const handleChange =
    (field: keyof Profile) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setProfile((prev) => ({ ...prev, [field]: e.target.value }));
    };

  /* ===========================
     SAVE PROFILE
  =========================== */
  const handleSave = async () => {
    if (!token) return router.push("/login");
    if (!profile.fullName.trim()) return alert("Full name is required");

    setSaving(true);

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profile),
      });

      const data = await res.json();

      if (!res.ok) alert(data.error || "Error saving profile");
      else alert("Profile updated successfully");
    } catch {
      alert("Network error");
    } finally {
      setSaving(false);
    }
  };

  /* ===========================
     LOGOUT
  =========================== */
  const handleLogout = () => {
    localStorage.removeItem("transportcoin_token");
    router.push("/login");
  };

  const formatDate = (v?: string | null) =>
    v ? new Date(v).toLocaleString() : "—";

  if (loading) {
    return (
      <p className="text-sm text-slate-400">Loading your account settings…</p>
    );
  }

  /* ===========================
     UI
  =========================== */
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-white">Account Settings</h1>

      {/* PROFILE */}
      <div className="bg-black border border-slate-800 rounded-xl p-4 text-xs">
        <h2 className="text-white font-semibold mb-3">Profile</h2>

        <div className="grid gap-3">
          <input
            value={profile.fullName}
            onChange={handleChange("fullName")}
            placeholder="Full Name"
            className="p-2 rounded bg-black border border-slate-700 text-white"
          />

          <input
            value={profile.phone ?? ""}
            onChange={handleChange("phone")}
            placeholder="Phone Number"
            className="p-2 rounded bg-black border border-slate-700 text-white"
          />

          {/* ✅ COUNTRY DROPDOWN */}
          <select
            value={profile.country ?? "United States"}
            onChange={handleChange("country")}
            className="p-2 rounded bg-black border border-slate-700 text-white"
          >
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <input
            value={profile.city ?? ""}
            onChange={handleChange("city")}
            placeholder="City"
            className="p-2 rounded bg-black border border-slate-700 text-white"
          />

          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-yellow-500 text-black p-2 rounded font-bold"
          >
            {saving ? "Saving…" : "Save Profile"}
          </button>
        </div>
      </div>

      {/* ACCOUNT META */}
      <div className="bg-black border border-slate-800 rounded-xl p-4 text-xs">
        <h2 className="text-white font-semibold mb-2">Account Info</h2>

        <div>Email: {userMeta?.email}</div>
        <div>Tier: {userMeta?.tier ?? "BASIC"}</div>
        
        <div>Last Login: {formatDate(userMeta?.lastLoginAt)}</div>

        <button
          onClick={handleLogout}
          className="mt-3 border border-slate-700 px-3 py-2 rounded text-white"
        >
          Log Out
        </button>
      </div>
    </div>
  );
}
