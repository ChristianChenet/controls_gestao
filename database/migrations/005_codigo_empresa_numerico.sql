BEGIN;

UPDATE empresas
SET codigo_empresa = id::text
WHERE codigo_empresa !~ '^[0-9]+$';

ALTER TABLE empresas
  ALTER COLUMN codigo_empresa TYPE BIGINT USING codigo_empresa::BIGINT;

COMMIT;
