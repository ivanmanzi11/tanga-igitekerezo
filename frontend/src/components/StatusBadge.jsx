const LABELS = {
  received: "Received",
  under_review: "Under Review",
  assigned: "Assigned",
  needs_info: "Needs Info",
  resolved: "Resolved",
  responded: "Responded",
  closed: "Closed",
};

export default function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{LABELS[status] || status}</span>;
}
