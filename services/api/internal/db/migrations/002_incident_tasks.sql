CREATE TABLE incident_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    incident_id UUID NOT NULL,
    title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    assignee_id UUID,
    due_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (organization_id, incident_id) REFERENCES incidents (organization_id, id),
    FOREIGN KEY (organization_id, assignee_id) REFERENCES users (organization_id, id)
);
CREATE INDEX incident_tasks_org_incident ON incident_tasks (organization_id, incident_id, created_at, id);
