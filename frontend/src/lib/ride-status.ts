export const rideStatusLabels: Record<string, string> = {
  pending: "لسه مستنين الطلب",
  searching_driver: "بندور على كابتن",
  offered: "اتبعت للكباتن",
  accepted: "كابتن قبل المشوار",
  driver_on_the_way: "الكابتن في الطريق",
  driver_arrived: "الكابتن وصل",
  trip_started: "المشوار بدأ",
  completed: "المشوار اكتمل",
  cancelled: "المشوار اتلغى",
};

export const rideOfferStatusLabels: Record<string, string> = {
  offered: "مستني ردك",
  accepted: "تم القبول",
  rejected: "اترفض",
  expired: "انتهى الوقت",
  cancelled: "اتلغى",
};

export function getRideStatusLabel(status: string | null | undefined) {
  return (status && rideStatusLabels[status]) || "حالة غير معروفة";
}

export function getOfferStatusLabel(status: string | null | undefined) {
  return (status && rideOfferStatusLabels[status]) || "غير معروف";
}

export function getRideStatusTone(status: string | null | undefined) {
  switch (status) {
    case "completed":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-400/20";
    case "accepted":
    case "driver_on_the_way":
    case "driver_arrived":
    case "trip_started":
      return "bg-primary/15 text-primary border-primary/20";
    case "offered":
    case "searching_driver":
      return "bg-amber-500/15 text-amber-300 border-amber-400/20";
    case "cancelled":
    case "rejected":
    case "expired":
      return "bg-rose-500/15 text-rose-300 border-rose-400/20";
    default:
      return "bg-white/5 text-white/70 border-white/10";
  }
}

export function formatRideDate(date: string | null | undefined) {
  if (!date) return "لسه";

  try {
    return new Intl.DateTimeFormat("ar-EG", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(date));
  } catch {
    return date;
  }
}
