BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'empresas'
      AND column_name = 'codigo_empresa'
      AND data_type NOT IN ('bigint', 'integer', 'smallint', 'numeric')
  ) THEN
    UPDATE empresas
    SET codigo_empresa = id::text
    WHERE codigo_empresa !~ '^[0-9]+$';

    ALTER TABLE empresas
      ALTER COLUMN codigo_empresa TYPE BIGINT USING codigo_empresa::BIGINT;
  END IF;
END $$;

COMMIT;
