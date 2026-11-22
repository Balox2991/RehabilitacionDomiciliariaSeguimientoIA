-- Calidad de la medición de cada sesión (ver apps/tracking-prototype/src/reliability.js).
-- JSON {verdict, score, failed[], metrics{}} calculado en el SERVIDOR a partir del registro guardado. NULL = sesión sin registro
-- (no hay de dónde juzgarla). El fisioterapeuta lo usa para saber si puede fiarse de los ángulos de esa sesión.
ALTER TABLE sessions ADD COLUMN quality TEXT;
