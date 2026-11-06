package domain

import "testing"

func TestIncidentTransitionsFailClosed(t *testing.T) {
	cases := []struct {
		from string
		in   Transition
		want string
	}{
		{"new", Transition{ToStatus: "closed", RootCause: "x"}, "invalid_transition"},
		{"new", Transition{ToStatus: "assigned"}, "assignee_required"},
		{"new", Transition{ToStatus: "assigned", AssigneeID: "user"}, ""},
		{"assigned", Transition{ToStatus: "investigating"}, ""},
		{"investigating", Transition{ToStatus: "contained"}, "containment_unavailable"},
		{"resolved", Transition{ToStatus: "closed"}, "root_cause_required"},
		{"resolved", Transition{ToStatus: "closed", RootCause: "cause"}, ""},
		{"closed", Transition{ToStatus: "new"}, "reopen_reason_required"},
		{"closed", Transition{ToStatus: "new", Reason: "documented request"}, ""},
	}
	for _, c := range cases {
		if got, _ := CanTransition(c.from, c.in); got != c.want {
			t.Errorf("%s -> %s: got %q, want %q", c.from, c.in.ToStatus, got, c.want)
		}
	}
}
