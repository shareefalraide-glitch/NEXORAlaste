-- Initial development schema. Production role separation, external audit
-- anchoring, encryption and partitioning require the work listed in SECURITY.md.
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    email TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'analyst', 'responder', 'auditor', 'viewer')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, id)
);
CREATE UNIQUE INDEX users_org_email_lower ON users (organization_id, lower(email));

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL,
    refresh_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(refresh_hash) = 32),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (organization_id, user_id) REFERENCES users (organization_id, id)
);
CREATE INDEX sessions_org_user ON sessions (organization_id, user_id);

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
    kind TEXT NOT NULL CHECK (kind IN ('server', 'workstation', 'network_device', 'other')),
    criticality TEXT NOT NULL CHECK (criticality IN ('low', 'medium', 'critical')),
    primary_ip INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, id)
);
CREATE INDEX assets_org_created ON assets (organization_id, created_at DESC, id DESC);

-- A source is an actual organization-owned device/emitter, not the parser or
-- protocol. The token identifies the ingestion source and is stored as a hash.
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
    kind TEXT NOT NULL CHECK (kind IN ('sensor', 'network_device', 'host', 'other')),
    collection_method TEXT NOT NULL CHECK (length(collection_method) BETWEEN 1 AND 80),
    token_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    last_received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, id)
);
CREATE INDEX sources_org_created ON sources (organization_id, created_at DESC, id DESC);

-- Bounded ECS-inspired subset; adapters, GeoIP/IoC enrichment, clock-skew
-- enforcement and TimescaleDB retention are NOT implemented in this slice.
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    source_id UUID NOT NULL,
    source_sequence TEXT NOT NULL CHECK (length(source_sequence) BETWEEN 1 AND 128),
    original_timestamp TEXT NOT NULL CHECK (length(original_timestamp) BETWEEN 1 AND 64),
    observed_at TIMESTAMPTZ NOT NULL,
    asset_id UUID,
    category TEXT NOT NULL CHECK (length(category) BETWEEN 1 AND 100),
    action TEXT NOT NULL CHECK (length(action) BETWEEN 1 AND 100),
    source_ip INET,
    destination_ip INET,
    message TEXT NOT NULL DEFAULT '' CHECK (length(message) <= 4096),
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (organization_id, source_id) REFERENCES sources (organization_id, id),
    FOREIGN KEY (organization_id, asset_id) REFERENCES assets (organization_id, id),
    UNIQUE (organization_id, source_id, observed_at, source_sequence),
    UNIQUE (organization_id, id)
);
CREATE INDEX events_org_time ON events (organization_id, observed_at DESC, id DESC);
CREATE INDEX events_org_asset_time ON events (organization_id, asset_id, observed_at DESC);
CREATE INDEX events_org_source_ip_time ON events (organization_id, source_ip, observed_at DESC);

CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
    description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'assigned', 'investigating', 'contained', 'resolved', 'closed')),
    origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin = 'manual'),
    asset_id UUID,
    assignee_id UUID,
    root_cause TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (organization_id, asset_id) REFERENCES assets (organization_id, id),
    FOREIGN KEY (organization_id, assignee_id) REFERENCES users (organization_id, id),
    UNIQUE (organization_id, id)
);
CREATE INDEX incidents_org_created ON incidents (organization_id, created_at DESC, id DESC);
CREATE INDEX incidents_org_status ON incidents (organization_id, status, updated_at DESC);

CREATE TABLE incident_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    incident_id UUID NOT NULL,
    author_id UUID NOT NULL,
    body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (organization_id, incident_id) REFERENCES incidents (organization_id, id),
    FOREIGN KEY (organization_id, author_id) REFERENCES users (organization_id, id)
);
CREATE INDEX incident_notes_org_incident ON incident_notes (organization_id, incident_id, created_at, id);

-- The current append-only chain shares the operational database. A privileged
-- database owner can bypass triggers; independent storage/anchors are pending.
CREATE TABLE audit_entries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    occurred_at TIMESTAMPTZ NOT NULL,
    actor TEXT NOT NULL CHECK (length(actor) BETWEEN 1 AND 180),
    action TEXT NOT NULL CHECK (length(action) BETWEEN 1 AND 100),
    resource_type TEXT NOT NULL CHECK (length(resource_type) BETWEEN 1 AND 100),
    resource_id TEXT NOT NULL CHECK (length(resource_id) BETWEEN 1 AND 180),
    payload TEXT NOT NULL,
    previous_hash TEXT NOT NULL CHECK (previous_hash ~ '^[0-9a-f]{64}$'),
    entry_hash TEXT NOT NULL CHECK (entry_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX audit_org_sequence ON audit_entries (organization_id, id);
CREATE FUNCTION prevent_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit entries are append-only';
END;
$$;
CREATE TRIGGER audit_no_update_delete BEFORE UPDATE OR DELETE ON audit_entries
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON audit_entries
    FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_mutation();
