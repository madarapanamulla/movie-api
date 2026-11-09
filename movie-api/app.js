
const express = require("express");
const morgan = require("morgan");

const app = express();
const PORT = 3000;

// Enable JSON request bodies
app.use(express.json());
app.use(morgan("dev"));
// Simple logging middleware
function simpleLogger(req, res, next) {
  console.log(req.method, req.originalUrl);
  next();
}

//app.use(simpleLogger);
// Starting movie collection
// Starting movie collection
let movies = [
  {
    id: 1,
    title: "Inception",
    year: 2010,
    genre: "Sci-Fi"
  },
  {
    id: 2,
    title: "The Matrix",
    year: 1999,
    genre: "Sci-Fi"
  },
  {
    id: 3,
    title: "Parasite",
    year: 2019,
    genre: "Thriller"
  }
];
// Validate movie data
function validateMovie(body, partial = false) {
  const errors = [];
  const maximumYear = new Date().getFullYear() + 5;

  // Validate title
  if (!partial && body.title === undefined) {
    errors.push("title is required");
  }

  if (
    body.title !== undefined &&
    (typeof body.title !== "string" || body.title.trim().length === 0)
  ) {
    errors.push("title must be a non-empty string");
  }

  // Validate year
  if (!partial && body.year === undefined) {
    errors.push("year is required");
  }

  if (
    body.year !== undefined &&
    (
      !Number.isInteger(body.year) ||
      body.year < 1888 ||
      body.year > maximumYear
    )
  ) {
    errors.push("year must be a valid integer");
  }

  // Validate genre
  if (!partial && body.genre === undefined) {
    errors.push("genre is required");
  }

  if (
    body.genre !== undefined &&
    (typeof body.genre !== "string" || body.genre.trim().length === 0)
  ) {
    errors.push("genre must be a non-empty string");
  }

  return errors;
}

// GET /movies - Return all movies with optional filtering
app.get("/movies", (req, res) => {
  let result = [...movies];

  // Filter by genre
  if (req.query.genre) {
    result = result.filter(movie =>
      movie.genre.toLowerCase() === req.query.genre.toLowerCase()
    );
  }
// Filter by minimum year
if (req.query.minYear !== undefined) {
  const minYear = Number(req.query.minYear);

  if (req.query.minYear.trim() === "" || !Number.isInteger(minYear)) {
    return res.status(400).json({
      error: {
        code: "INVALID_QUERY",
        message: "minYear must be an integer"
      }
    });
  }

  result = result.filter(movie => movie.year >= minYear);
}
// Sort movies
if (req.query.sort === "year") {
  result.sort((a, b) => a.year - b.year);
} else if (req.query.sort === "title") {
  result.sort((a, b) => a.title.localeCompare(b.title));
} else if (req.query.sort !== undefined) {
  return res.status(400).json({
    error: {
      code: "INVALID_QUERY",
      message: "sort must be year or title"
    }
  });
}
  res.status(200).json(result);
});

// GET /movies/:id - Return one movie
app.get("/movies/:id", (req, res) => {
  const id = Number(req.params.id);

  const movie = movies.find(movie => movie.id === id);

  if (!movie) {
    return res.status(404).json({
  error: {
    code: "MOVIE_NOT_FOUND",
    message: "Movie not found"
  }
});
  }

  res.status(200).json(movie);
});

// POST /movies - Add a new movie
// POST /movies - Add a new movie
app.post("/movies", (req, res) => {
  const errors = validateMovie(req.body);

  // Check for validation errors
  if (errors.length > 0) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Movie data is invalid",
        details: errors
      }
    });
  }

  // Generate a new ID
  const newId = Math.max(0, ...movies.map(movie => movie.id)) + 1;

  const newMovie = {
    id: newId,
    title: req.body.title.trim(),
    year: req.body.year,
    genre: req.body.genre.trim()
  };

  // Add the new movie
  movies.push(newMovie);

  res.status(201).json(newMovie);
});
// PUT /movies/:id - Replace an existing movie
app.put("/movies/:id", (req, res) => {
  const id = Number(req.params.id);

  const movie = movies.find(movie => movie.id === id);

  if (!movie) {
    return res.status(404).json({
      error: {
        code: "MOVIE_NOT_FOUND",
        message: "Movie not found"
      }
    });
  }

  const errors = validateMovie(req.body);

  if (errors.length > 0) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Movie data is invalid",
        details: errors
      }
    });
  }

  const updatedMovie = {
    id: movie.id,
    title: req.body.title.trim(),
    year: req.body.year,
    genre: req.body.genre.trim()
  };

  const index = movies.findIndex(movie => movie.id === id);
  movies[index] = updatedMovie;

  res.status(200).json(updatedMovie);
});

// PATCH /movies/:id - Partially update a movie
// PATCH /movies/:id - Update selected movie fields
app.patch("/movies/:id", (req, res) => {
  const id = Number(req.params.id);

  const movie = movies.find(movie => movie.id === id);

  if (!movie) {
    return res.status(404).json({
      error: {
        code: "MOVIE_NOT_FOUND",
        message: "Movie not found"
      }
    });
  }

  const errors = validateMovie(req.body, true);

  if (errors.length > 0) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Movie data is invalid",
        details: errors
      }
    });
  }

  if (req.body.title !== undefined) {
    movie.title = req.body.title.trim();
  }

  if (req.body.year !== undefined) {
    movie.year = req.body.year;
  }

  if (req.body.genre !== undefined) {
    movie.genre = req.body.genre.trim();
  }

  res.status(200).json(movie);
});


app.delete("/movies/:id", (req, res) => {
  const id = Number(req.params.id);

  const index = movies.findIndex(movie => movie.id === id);

  if (index === -1) {
    return res.status(404).json({
      error: {
        code: "MOVIE_NOT_FOUND",
        message: "Movie not found"
      }
    });
  }

  movies.splice(index, 1);

  res.status(204).send();
});


// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "The requested route does not exist"
    }
  });
});
// Handle unexpected server errors
app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected server error occurred"
    }
  });
});
// Start the server
app.listen(PORT, () => {
  console.log(`Movie API running at http://localhost:${PORT}`);
});
