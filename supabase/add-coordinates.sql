-- Agrega coordenadas geográficas a la tabla de estudiantes
-- para integración con Google Maps Places API
ALTER TABLE estudiantes
  ADD COLUMN latitud  DECIMAL(10, 7),
  ADD COLUMN longitud DECIMAL(10, 7);
