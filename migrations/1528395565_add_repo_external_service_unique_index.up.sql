CREATE UNIQUE INDEX CONCURRENTLY repo_external_service_unique
ON repo (external_id, external_service_type, external_service_id);
