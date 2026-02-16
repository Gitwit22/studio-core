const KEY = "sl_entry_lane";

export const setEduLane = () => {
  try {
    localStorage.setItem(KEY, "edu");
    localStorage.setItem("sl_mode", "edu");
  } catch {}

  try {
    document.cookie = `edu_mode=1; path=/; SameSite=Lax`;
  } catch {}
};

export const isEduLane = () => {
  try {
    return localStorage.getItem(KEY) === "edu";
  } catch {
    return false;
  }
};

export const clearEduLane = () => {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem("sl_mode");
  } catch {}

  try {
    document.cookie = `edu_mode=; path=/; max-age=0; SameSite=Lax`;
  } catch {}
};

export const isEduBypassEnabled = () => {
  if (!import.meta.env.DEV) return false;
  try {
    return localStorage.getItem("sl_edu_bypass") === "1";
  } catch {
    return false;
  }
};

export const setEduBypassEnabled = () => {
  if (!import.meta.env.DEV) return;
  try {
    localStorage.setItem("sl_edu_bypass", "1");
  } catch {}
};

export const clearEduBypassEnabled = () => {
  try {
    localStorage.removeItem("sl_edu_bypass");
  } catch {}
};
