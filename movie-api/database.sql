
-- Remove the old movies table if it exists
DROP TABLE IF EXISTS movies;

-- Create the movies table
CREATE TABLE movies (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    director VARCHAR(200) NOT NULL,
    release_year INTEGER NOT NULL
);

-- Insert initial movie data
INSERT INTO movies (
    title,
    director,
    release_year
)
VALUES
    ('Inception', 'Christopher Nolan', 2011),
    ('The Matrix', 'The Wachowskis', 1999),
    ('Parasite', 'Bong Joon-ho', 2019);

-- Display all movies
SELECT *
FROM movies
ORDER BY id;
