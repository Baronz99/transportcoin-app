export function withdrawalStatusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "WAITING_QUEUE":
      return "Waiting queue";
    case "ON_HOLD_COLLATERAL":
      return "On hold (collateral)";
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
    case "WAITING_QUEUE":
      return "bg-indigo-900/60 text-indigo-200";
    case "ON_HOLD_COLLATERAL":
      return "bg-amber-900/60 text-amber-200";
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
    case "WAITING_QUEUE":
      return 2;
    case "ON_HOLD_COLLATERAL":
      return 3;
    case "READY_FOR_PAYOUT":
      return 4;
    case "COMPLETED":
      return 5;
    case "REJECTED":
      return 6;
    default:
      return 6;
  }
}
