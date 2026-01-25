export function withdrawalStatusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "READY_FOR_PAYOUT":
      return "Ready for payout";
    case "COMPLETED":
      return "Completed";
    case "REJECTED":
      return "Rejected";
    default:
      return status.replace(/_/g, " ").toLowerCase();
  }
}

export function withdrawalStatusChipClasses(status: string) {
  switch (status) {
    case "PENDING":
      return "bg-amber-900/60 text-amber-300";
    case "READY_FOR_PAYOUT":
      return "bg-blue-900/60 text-blue-200";
    case "COMPLETED":
      return "bg-emerald-900/60 text-emerald-300";
    case "REJECTED":
      return "bg-rose-900/60 text-rose-300";
    default:
      return "bg-slate-800 text-slate-200";
  }
}

export function withdrawalStatusRank(status: string) {
  switch (status) {
    case "PENDING":
      return 1;
    case "READY_FOR_PAYOUT":
      return 2;
    case "COMPLETED":
      return 3;
    case "REJECTED":
      return 4;
    default:
      return 5;
  }
}
