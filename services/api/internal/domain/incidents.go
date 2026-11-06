package domain

import "strings"

type Transition struct {
	ToStatus   string `json:"to_status"`
	AssigneeID string `json:"assignee_id,omitempty"`
	Reason     string `json:"reason,omitempty"`
	RootCause  string `json:"root_cause,omitempty"`
}

// CanTransition applies the lifecycle from the report. Containment is
// deliberately fail-closed until approval and a verified connector exist.
func CanTransition(from string, t Transition) (string, string) {
	next := map[string]string{"new": "assigned", "assigned": "investigating", "investigating": "contained", "contained": "resolved", "resolved": "closed", "closed": "new"}
	if next[from] != t.ToStatus {
		return "invalid_transition", "The requested transition is not allowed."
	}
	if t.ToStatus == "assigned" && strings.TrimSpace(t.AssigneeID) == "" {
		return "assignee_required", "An assignee is required."
	}
	if from == "closed" && strings.TrimSpace(t.Reason) == "" {
		return "reopen_reason_required", "A documented reopen reason is required."
	}
	if t.ToStatus == "closed" && strings.TrimSpace(t.RootCause) == "" {
		return "root_cause_required", "A root cause is required to close an incident."
	}
	if t.ToStatus == "contained" {
		return "containment_unavailable", "Containment is blocked until an approval and verified execution connector are implemented."
	}
	if len(t.Reason) > 4000 || len(t.RootCause) > 4000 {
		return "invalid_input", "Reason or root cause is too long."
	}
	return "", ""
}
