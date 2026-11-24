
require("dotenv").config();

const express = require("express");
const morgan = require("morgan");
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(morgan("dev"));

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
    (typeof body.director !== "string" ||
      body.director.trim().length === 0)
  ) {
    errors.push("director must be a non-empty string");
  }

  // Validate release year
  if (!partial && body.release_year === undefined) {
    errors.push("release_year is required");
  }

  if (
    body.release_year !== undefined &&
    (!Number.isInteger(body.release_year) ||
      body.release_year < 1888 ||
      body.release_year > maximumYear)
  ) {
    errors.push("release_year must be a valid integer");
  }

  return errors;
}

// GET /health/database - Check database connection
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

// GET /movies - Return all movies with optional filtering
app.get("/movies", async (req, res, next) => {
  try {
    let query =
      "SELECT id, title, director, release_year FROM movies";

    const conditions = [];
    const values = [];

    // Filter by director
    if (req.query.director) {
      values.push(req.query.director);
      conditions.push(
        `LOWER(director) = LOWER($${values.length})`
      );
    }

    // Filter by minimum year
    if (req.query.minYear !== undefined) {
      const minYear = Number(req.query.minYear);

      if (
        req.query.minYear.trim() === "" ||
        !Number.isInteger(minYear)
      ) {
        return res.status(400).json({
          error: {
            code: "INVALID_QUERY",
            message: "minYear must be an integer"
          }
        });
      }

      values.push(minYear);
      conditions.push(
        `release_year >= $${values.length}`
      );
    }

    // Add filters
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    // Sort movies
    if (req.query.sort === "year") {
      query += " ORDER BY release_year ASC";
    } else if (req.query.sort === "title") {
      query += " ORDER BY title ASC";
    } else if (req.query.sort !== undefined) {
      return res.status(400).json({
        error: {
          code: "INVALID_QUERY",
          message: "sort must be year or title"
        }
      });
    } else {
      query += " ORDER BY id ASC";
    }

    const result = await pool.query(query, values);

    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /movies/:id - Return one movie
app.get("/movies/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const result = await pool.query(
      "SELECT id, title, director, release_year FROM movies WHERE id = $1",
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

    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /movies - Add a new movie
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

    const { title, director, release_year } = req.body;

    const result = await pool.query(
      `INSERT INTO movies (title, director, release_year)
       VALUES ($1, $2, $3)
       RETURNING id, title, director, release_year`,
      [title.trim(), director.trim(), release_year]
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

    const { title, director, release_year } = req.body;

    const result = await pool.query(
      `UPDATE movies
       SET title = $1, director = $2, release_year = $3
       WHERE id = $4
       RETURNING id, title, director, release_year`,
      [title.trim(), director.trim(), release_year, id]
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

    const allowedFields = {
      title: "title",
      director: "director",
      release_year: "release_year"
    };

    const fields = Object.keys(req.body).filter(
      field => allowedFields[field]
    );

    if (fields.length === 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "At least one valid movie field is required"
        }
      });
    }

    const values = [];
    const updates = [];

    fields.forEach(field => {
      let value = req.body[field];

      if (typeof value === "string") {
        value = value.trim();
      }

      values.push(value);
      updates.push(
        `${allowedFields[field]} = $${values.length}`
      );
    });

    values.push(id);

    const result = await pool.query(
      `UPDATE movies
       SET ${updates.join(", ")}
       WHERE id = $${values.length}
       RETURNING id, title, director, release_year`,
      values
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

// DELETE /movies/:id - Delete a movie
app.delete("/movies/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const result = await pool.query(
      "DELETE FROM movies WHERE id = $1 RETURNING id",
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
