const asValidDate = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (value, fallback = "-") => {
  const date = asValidDate(value);
  return date
    ? date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : fallback;
};

export const formatTime = (value, fallback = "-") => {
  const date = asValidDate(value);
  return date
    ? date.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
      })
    : fallback;
};

export const formatDateTime = (value, fallback = "-") => {
  const date = asValidDate(value);
  return date
    ? date.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : fallback;
};

export const toLocalDateInputValue = (value = new Date()) => {
  const date = asValidDate(value);
  if (!date) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const toLocalTimeInputValue = (value = new Date()) => {
  const date = asValidDate(value);
  if (!date) {
    return "";
  }

  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
};
