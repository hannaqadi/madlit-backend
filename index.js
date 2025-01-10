const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

app.get('/api/stories', async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default to page 1
  const limit = parseInt(req.query.limit) || 3; // Default to 3 items per page
  const search = req.query.search || ''; // Default to no search
  const offset = (page - 1) * limit;

  try {
    const query = `
      SELECT *,
      CASE
        WHEN title::text ILIKE $3 THEN 3
        WHEN title::text ILIKE $4 THEN 2
        ELSE 1
      END AS relevance
      FROM stories
      WHERE title::text ILIKE $2
      ORDER BY relevance DESC, id ASC
      LIMIT $1 OFFSET $5
    `;

    const searchTerm = `%${search}%`; // Partial match
    const startsWithTerm = `${search}%`; // Starts with match

    // Ensure parameters match placeholders in the query
    const result = await pool.query(query, [limit, searchTerm, startsWithTerm, searchTerm, offset]);
    // console.log({ limit, searchTerm, startsWithTerm, offset });
    // console.log('Result rows:', result.rows);
    // console.log(`Page: ${page}, Offset: ${offset}`);
    const total = await pool.query(
      'SELECT COUNT(*) FROM stories WHERE title ILIKE $1',
      [searchTerm]
    );

    res.json({
      stories: result.rows,
      currentPage: page,
      totalPages: Math.ceil(total.rows[0].count / limit),
    });
  } catch (error) {
    console.error('Error fetching stories:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});