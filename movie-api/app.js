require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;

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

  // Validate director
  if (!partial && body.director === undefined) {
    errors.push("director is required");
  }

  if (
    body.director !== undefined &&
    (typeof body.director !== "string" || body.director.trim().length === 0)
  ) {
    errors.push("director must be a non-empty string");
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

  return errors;
}


// GET /movies - Return all movies with optional filtering and sorting
app.get("/movies", async (req, res, next) => {
  try {
    const conditions = [];
    const values = [];

    // Filter by director
    if (req.query.director) {
      values.push(req.query.director);
      conditions.push(`LOWER(director) = LOWER($${values.length})`);
    }

    // Filter by release year
    if (req.query.year !== undefined) {
      const year = Number(req.query.year);

      if (req.query.year.trim() === "" || !Number.isInteger(year)) {
        return res.status(400).json({
          error: {
            code: "INVALID_QUERY",
            message: "year must be an integer"
          }
        });
      }

      values.push(year);
      conditions.push(`release_year = $${values.length}`);
    }

    // Build WHERE clause
    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    // Strict allow-list for sorting
    const allowedSortFields = {
      id: "id",
      year: "release_year",
      title: "title"
    };

    const sortBy = req.query.sortBy || "id";

    if (!Object.prototype.hasOwnProperty.call(allowedSortFields, sortBy)) {
      return res.status(400).json({
        error: {
          code: "INVALID_QUERY",
          message: "sortBy must be id, year or title"
        }
      });
    }

    const sortColumn = allowedSortFields[sortBy];

    const query = `
      SELECT
        id,
        title,
        director,
        release_year AS year
      FROM movies
      ${whereClause}
      ORDER BY ${sortColumn}
    `;

    const result = await pool.query(query, values);

    res.status(200).json(result.rows);

  } catch (error) {
    next(error);
  }
});



 // GET /movies/:id - Return one movie from PostgreSQL
app.get("/movies/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    // Validate ID
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: {
          code: "INVALID_ID",
          message: "Movie ID must be a positive integer"
        }
      });
    }

    const result = await pool.query(
      `SELECT
        id,
        title,
        director,
        release_year AS year
      FROM movies
      WHERE id = $1`,
      [id]
    );

    // Check whether the movie exists
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "MOVIE_NOT_FOUND",
          message: "Movie not found"
        }
      });
    }

    res.status(200).json(result.rows[0]);

  } catch (error) {
    next(error);
  }
});



 // POST /movies - Add a new movie to PostgreSQL
app.post("/movies", async (req, res, next) => {
  try {
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

    const result = await pool.query(
      `INSERT INTO movies (
        title,
        director,
        release_year
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        title,
        director,
        release_year AS year`,
      [
        req.body.title.trim(),
        req.body.director.trim(),
        req.body.year
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (error) {
    next(error);
  }
});

  
 // PUT /movies/:id - Replace an existing movie
app.put("/movies/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    // Validate ID
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: {
          code: "INVALID_ID",
          message: "Movie ID must be a positive integer"
        }
      });
    }

    // Validate complete movie data
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

    const result = await pool.query(
      `UPDATE movies
       SET
         title = $1,
         director = $2,
         release_year = $3
       WHERE id = $4
       RETURNING
         id,
         title,
         director,
         release_year AS year`,
      [
        req.body.title.trim(),
        req.body.director.trim(),
        req.body.year,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "MOVIE_NOT_FOUND",
          message: "Movie not found"
        }
      });
    }

    res.status(200).json(result.rows[0]);

  } catch (error) {
    next(error);
  }
});

 // PATCH /movies/:id - Partially update a movie
app.patch("/movies/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    // Validate ID
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: {
          code: "INVALID_ID",
          message: "Movie ID must be a positive integer"
        }
      });
    }

    // Reject an empty PATCH body
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "PATCH body cannot be empty"
        }
      });
    }

    // Allow only fields defined by the server
    const allowedFields = {
      title: "title",
      director: "director",
      year: "release_year"
    };

    // Reject unsupported fields
    const invalidFields = Object.keys(req.body).filter(
      field => !Object.prototype.hasOwnProperty.call(allowedFields, field)
    );

    if (invalidFields.length > 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: `Unsupported fields: ${invalidFields.join(", ")}`
        }
      });
    }

    // Validate supplied values
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

    const setClauses = [];
    const values = [];

    // Build SQL SET clauses using only allowed column names
    for (const [field, value] of Object.entries(req.body)) {
      values.push(
        field === "title" || field === "director"
          ? value.trim()
          : value
      );

      setClauses.push(
        `${allowedFields[field]} = $${values.length}`
      );
    }

    // Add movie ID as the final parameter
    values.push(id);

    const query = `
      UPDATE movies
      SET ${setClauses.join(", ")}
      WHERE id = $${values.length}
      RETURNING
        id,
        title,
        director,
        release_year AS year
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "MOVIE_NOT_FOUND",
          message: "Movie not found"
        }
      });
    }

    res.status(200).json(result.rows[0]);

  } catch (error) {
    next(error);
  }
});

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



app.delete("/movies/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    // Validate ID
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: {
          code: "INVALID_ID",
          message: "Movie ID must be a positive integer"
        }
      });
    }

    const result = await pool.query(
      `DELETE FROM movies
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "MOVIE_NOT_FOUND",
          message: "Movie not found"
        }
      });
    }

    res.status(204).send();

  } catch (error) {
    next(error);
  }
});

app.get("/health/database", async (req, res, next) => {
    try {
        const result = await pool.query(
            "SELECT NOW() AS database_time"
        );

        res.json({
            status: "ok",
            databaseTime: result.rows[0].database_time
        });
    } catch (error) {
        next(error);
    }
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
